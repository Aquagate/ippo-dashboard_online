const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const bodyParser = require('body-parser');

const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const config = require('../../ops/config');
const { runBackup } = require('../../ops/backup_data');

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
const PORT = config.PORT;
const DATA_DIR = config.PATHS.DATA_DIR;
const INTAKES_FILE = config.PATHS.INTAKES_FILE;
const EMPLOYEES_FILE = config.PATHS.EMPLOYEES_FILE;

// --- Auth Middleware ---
const SESSION_COOKIE_NAME = 'ops_os_session';
// Simple in-memory session store for MVP (In production, use Redis/DB)
// Map<CookieValue, UserObject>
const sessions = new Map();

const authMiddleware = (req, res, next) => {
    // Public paths
    const publicPaths = ['/login.html', '/api/login', '/css/', '/js/', '/api/data/employees', '/manifest.json'];
    const isPublic = publicPaths.some(p => req.path.startsWith(p) || req.path === '/');

    // Allow static assets if needed, but best to guard html
    if (isPublic) return next();

    // Check Cookie
    const sessionToken = req.cookies[SESSION_COOKIE_NAME];
    if (sessionToken && sessions.has(sessionToken)) {
        req.user = sessions.get(sessionToken);
        next();
    } else {
        // Redirect to login for HTML requests, 401 for API
        if (req.accepts('html')) {
            res.redirect('/login.html');
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    }
};

app.use(authMiddleware);

// --- Auth APIs ---
app.post('/api/login', async (req, res) => {
    const { userId } = req.body;
    try {
        const employees = await fs.readJson(EMPLOYEES_FILE).catch(() => []);
        const user = employees.find(e => e.id === userId);

        if (user) {
            // Create Session
            const token = crypto.randomBytes(32).toString('hex');
            sessions.set(token, user);

            // Set Cookie (HttpOnly, Secure in Prod, SameSite=Strict)
            const isProduction = process.env.NODE_ENV === 'production';
            res.cookie(SESSION_COOKIE_NAME, token, {
                httpOnly: true,
                secure: isProduction,
                sameSite: 'Strict',
                maxAge: 24 * 60 * 60 * 1000 // 1 day
            });

            res.json({ success: true, role: user.role });
        } else {
            res.status(401).json({ error: 'Invalid User' });
        }
    } catch (e) {
        res.status(500).json({ error: 'Login Error' });
    }
});

app.post('/api/logout', (req, res) => {
    const token = req.cookies[SESSION_COOKIE_NAME];
    if (token) sessions.delete(token);
    res.clearCookie(SESSION_COOKIE_NAME);
    res.json({ success: true });
});

// 静的ファイルの配信 (publicフォルダ)
app.use(express.static(path.join(__dirname, '../../public')));

// データ取得 (汎用: /api/data/tasks -> tasks.json)
app.get('/api/data/:filename', async (req, res) => {
    const filename = req.params.filename;
    // 安全のため、英数字とアンダースコアのみ許可
    if (!/^[a-zA-Z0-9_]+$/.test(filename)) {
        return res.status(400).send('Invalid filename');
    }

    const filePath = path.join(DATA_DIR, `${filename}.json`);

    try {
        if (await fs.pathExists(filePath)) {
            const data = await fs.readJson(filePath);
            res.json(data);
        } else {
            res.status(404).send('Data not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error reading data');
    }
});

// 全データ取得 (デバッグ用)
app.get('/api/data', async (req, res) => {
    try {
        const files = await fs.readdir(DATA_DIR);
        const result = {};
        for (const file of files) {
            if (file.endsWith('.json')) {
                const key = path.basename(file, '.json');
                result[key] = await fs.readJson(path.join(DATA_DIR, file));
            }
        }
        res.json(result);
    } catch (err) {
        res.status(500).send('Error reading data dir');
    }
});

// データ保存 (汎用: POST /api/data/tasks)
app.post('/api/data/:filename', async (req, res) => {
    const filename = req.params.filename;
    if (!/^[a-zA-Z0-9_]+$/.test(filename)) {
        return res.status(400).send('Invalid filename');
    }

    const filePath = path.join(DATA_DIR, `${filename}.json`);

    try {
        await fs.writeJson(filePath, req.body, { spaces: 2 });
        res.send('Saved successfully');
    } catch (err) {
        res.status(500).send('Error saving data');
    }
});

// --- MVP Specific APIs ---

// 1. Intake (受付) API
app.post('/api/intake', async (req, res) => {
    try {
        const newIntake = req.body;
        // ID生成 (YYYYMMDD-HHmmss-NNN)
        const now = new Date();
        const id = now.toISOString().replace(/[-T:\.Z]/g, '').slice(0, 14);

        newIntake.intake_id = `INT-${id}`;
        newIntake.status = 'RECEIVED';
        newIntake.created_at = now.toISOString();

        // 既存データを読み込み、追加して保存
        const intakes = await fs.pathExists(INTAKES_FILE) ? await fs.readJson(INTAKES_FILE) : [];
        intakes.push(newIntake);

        await fs.writeJson(INTAKES_FILE, intakes, { spaces: 2 });
        res.json({ success: true, id: newIntake.intake_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to save intake' });
    }
});

// 2. AI Bridge Context API
app.get('/api/bridge/context', async (req, res) => {
    try {
        const intakes = await fs.readJson(INTAKES_FILE).catch(() => []);

        // Filter: Exclude completely finished tasks (optional, maybe keep recent done ones?)
        // For now, we want to see everything active.
        const activeIntakes = intakes.filter(i => i.status !== 'ARCHIVED'); // Assuming 'ARCHIVED' might exist later. 'DONE' is still relevant for reporting.

        let contextText = "# AI Bridge Context\n\n## Active Intakes\n";

        // Group by Status
        const grouped = activeIntakes.reduce((acc, curr) => {
            const s = curr.status || 'UNKNOWN';
            if (!acc[s]) acc[s] = [];
            acc[s].push(curr);
            return acc;
        }, {});

        Object.keys(grouped).forEach(status => {
            contextText += `### Status: ${status} (${grouped[status].length})\n`;
            grouped[status].forEach(item => {
                contextText += `- **[${item.intake_id}]** ${item.summary}\n`;
                contextText += `  - Requester: ${item.requester}\n`;
                contextText += `  - Details: ${item.details.replace(/\n/g, ' ')}\n`;
            });
            contextText += '\n';
        });

        res.json({ context: contextText });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to generate context' });
    }
});

// --- Startup Checks ---
async function checkIntegrity() {
    console.log('🔍 Running Integrity Checks...');
    const criticalFiles = ['employees.json', 'intakes.json', 'tasks.json'];
    let issues = 0;

    for (const file of criticalFiles) {
        const filePath = path.join(DATA_DIR, file);
        if (!await fs.pathExists(filePath)) {
            console.warn(`⚠️  Missing file: ${file}. Creating new...`);
            await fs.writeJson(filePath, []);
        } else {
            try {
                await fs.readJson(filePath);
            } catch (e) {
                console.error(`❌ CORRUPTED FILE DETECTED: ${file}`, e.message);
                issues++;
            }
        }
    }

    if (issues > 0) {
        console.error('⚠️  integrity issues detected. Check logs.');
    } else {
        console.log('✅ Integrity Check Passed.');
    }
}

// Start Server Sequence
(async () => {
    // 1. Auto Validation & Backup
    await checkIntegrity(); // Check first, if valid, then backup? Or backup as is? 
    // Let's backup first to be safe, but since backup_data handles errors, it's fine.
    // Actually, backup first preserves the state "as found".
    console.log('📦 Starting Auto-Backup...');
    await runBackup();

    // 3. Health Check
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    });

    // 4. Start Server with Graceful Shutdown
    const startServer = (port) => {
        const server = app.listen(port, 'localhost', () => {
            console.log(`\n🌱 SEED v3 Server running at http://localhost:${port}`);
            console.log(`Security: Restricted to localhost.`);
            console.log(`Health Check: http://localhost:${port}/api/health`);
        });

        server.on('error', (e) => {
            if (e.code === 'EADDRINUSE') {
                console.log(`Port ${port} is busy, trying ${port + 1}...`);
                startServer(port + 1);
            } else {
                console.error(e);
            }
        });

        // Graceful Shutdown Logic
        const gracefulShutdown = (signal) => {
            console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
            server.close(() => {
                console.log('✅ Server connections closed.');
                process.exit(0);
            });

            // Force close after 10s
            setTimeout(() => {
                console.error('⚠️  Could not close connections in time, forcefully shutting down');
                process.exit(1);
            }, 10000);
        };

        process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.once('SIGINT', () => gracefulShutdown('SIGINT'));
    };

    startServer(PORT);
})();
