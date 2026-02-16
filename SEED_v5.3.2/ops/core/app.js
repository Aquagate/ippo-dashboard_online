const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const config = require('../config'); // Use centralized config

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());

// --- Auth Middleware ---
const SESSION_COOKIE_NAME = 'ops_os_session';
const sessions = new Map(); // Simple in-memory session store

const authMiddleware = (req, res, next) => {
    const publicPaths = ['/login.html', '/api/login', '/css/', '/js/', '/api/data/employees', '/manifest.json', '/api/health', '/api/intake', '/api/bridge/context'];
    const isPublic = publicPaths.some(p => req.path.startsWith(p) || req.path === '/');
    console.log(`[Auth] ${req.method} ${req.path} -> Public? ${isPublic}`);

    if (isPublic) return next();

    const sessionToken = req.cookies[SESSION_COOKIE_NAME];
    if (sessionToken && sessions.has(sessionToken)) {
        req.user = sessions.get(sessionToken);
        next();
    } else {
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
        const employees = await fs.readJson(config.PATHS.EMPLOYEES_FILE).catch(() => []);
        const user = employees.find(e => e.id === userId);

        if (user) {
            const token = crypto.randomBytes(32).toString('hex');
            sessions.set(token, user);

            const isProduction = config.NODE_ENV === 'production';
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
        console.error(e);
        res.status(500).json({ error: 'Login Error' });
    }
});

app.post('/api/logout', (req, res) => {
    const token = req.cookies[SESSION_COOKIE_NAME];
    if (token) sessions.delete(token);
    res.clearCookie(SESSION_COOKIE_NAME);
    res.json({ success: true });
});

// --- Static Files ---
app.use(express.static(config.PATHS.PUBLIC_DIR));

// --- Data APIs (Generic) ---
app.get('/api/data/:filename', async (req, res) => {
    const filename = req.params.filename;
    if (!/^[a-zA-Z0-9_]+$/.test(filename)) return res.status(400).send('Invalid filename');

    const filePath = path.join(config.PATHS.DATA_DIR, `${filename}.json`);
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

app.post('/api/data/:filename', async (req, res) => {
    const filename = req.params.filename;
    if (!/^[a-zA-Z0-9_]+$/.test(filename)) return res.status(400).send('Invalid filename');

    const filePath = path.join(config.PATHS.DATA_DIR, `${filename}.json`);
    try {
        await fs.writeJson(filePath, req.body, { spaces: 2 });
        res.send('Saved successfully');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error saving data');
    }
});

// --- MVP Specific APIs ---
app.post('/api/intake', async (req, res) => {
    try {
        const newIntake = req.body;
        const now = new Date();
        const id = now.toISOString().replace(/[-T:\.Z]/g, '').slice(0, 14);

        newIntake.intake_id = `INT-${id}`;
        newIntake.status = 'RECEIVED';
        newIntake.created_at = now.toISOString();

        const intakes = await fs.pathExists(config.PATHS.INTAKES_FILE) ? await fs.readJson(config.PATHS.INTAKES_FILE) : [];
        intakes.push(newIntake);

        await fs.writeJson(config.PATHS.INTAKES_FILE, intakes, { spaces: 2 });
        res.json({ success: true, id: newIntake.intake_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to save intake' });
    }
});

// AI Bridge Context API
app.get('/api/bridge/context', async (req, res) => {
    try {
        const intakes = await fs.readJson(config.PATHS.INTAKES_FILE).catch(() => []);
        const activeIntakes = intakes.filter(i => i.status !== 'ARCHIVED');

        let contextText = "# AI Bridge Context\n\n## Active Intakes\n";
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

// 3. Status Update API
app.post('/api/intake/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const intakes = await fs.pathExists(config.PATHS.INTAKES_FILE) ? await fs.readJson(config.PATHS.INTAKES_FILE) : [];
        const idx = intakes.findIndex(i => i.intake_id === id);

        if (idx !== -1) {
            intakes[idx].status = status;
            intakes[idx].updated_at = new Date().toISOString();

            await fs.writeJson(config.PATHS.INTAKES_FILE, intakes, { spaces: 2 });
            res.json({ success: true, id: id, status: status });
        } else {
            res.status(404).json({ error: 'Intake not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

module.exports = app;
