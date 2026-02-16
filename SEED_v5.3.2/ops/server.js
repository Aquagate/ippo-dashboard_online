const app = require('./core/app');
const http = require('http');
const config = require('./config');
const fs = require('fs-extra');
const { runBackup } = require('./backup_data');

// --- Startup Logic ---

async function checkIntegrity() {
    console.log('🔍 Running Integrity Checks...');

    // Ensure Data Directory Exists
    await fs.ensureDir(config.PATHS.DATA_DIR);

    const criticalFiles = [
        { path: config.PATHS.EMPLOYEES_FILE, default: [{ id: "admin", name: "Admin User", role: "ADMIN" }, { id: "req", name: "Requester", role: "REQUESTER" }] },
        { path: config.PATHS.INTAKES_FILE, default: [] },
        { path: config.PATHS.TASKS_FILE, default: [] },
        { path: config.PATHS.CHECKLISTS_FILE, default: {} },
        { path: config.PATHS.PROPOSALS_FILE, default: [] }
    ];

    let issues = 0;

    for (const file of criticalFiles) {
        if (!await fs.pathExists(file.path)) {
            console.warn(`⚠️  Missing file: ${file.path}. Creating new with default data...`);
            await fs.writeJson(file.path, file.default, { spaces: 2 });
        } else {
            try {
                await fs.readJson(file.path);
            } catch (e) {
                console.error(`❌ CORRUPTED FILE DETECTED: ${file.path}`, e.message);
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

// --- Backup Handler ---
async function handleExit() {
    console.log('\n🛑 Shutting down...');
    try {
        console.log('📦 Creating Backup before exit...');
        // We import runBackup dynamically or use the one from top level if safe
        // Ideally backup_data.js should use config.js too.
        await runBackup();
        console.log('✅ Backup complete.');
    } catch (e) {
        console.error('❌ Backup failed:', e);
    }
    process.exit(0);
}

// Start Server Sequence
(async () => {
    try {
        // 1. Integrity Check & Init
        await checkIntegrity();

        // 2. Start Server
        const server = http.createServer(app);

        const tryListen = (port) => {
            server.listen(port, 'localhost', () => {
                console.log(`\n🌱 SEED v5.3 Server running at http://localhost:${port}`);
                console.log(`Health Check: http://localhost:${port}/api/health`);
            }).on('error', (e) => {
                if (e.code === 'EADDRINUSE') {
                    console.log(`Port ${port} is busy, trying ${port + 1}...`);
                    tryListen(port + 1);
                } else {
                    console.error('Server Error:', e);
                    process.exit(1);
                }
            });
        };

        tryListen(config.PORT);

        // 3. Graceful Shutdown
        process.on('SIGTERM', handleExit);
        process.on('SIGINT', handleExit);

    } catch (e) {
        console.error('Fatal Startup Error:', e);
        process.exit(1);
    }
})();
