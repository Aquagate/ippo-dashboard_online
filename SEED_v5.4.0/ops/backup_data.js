const fs = require('fs-extra');
const path = require('path');

const config = require('./config');

const DATA_DIR = config.PATHS.DATA_DIR;
const BACKUP_ROOT = config.PATHS.BACKUP_DIR;

async function runBackup() {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const targetDir = path.join(BACKUP_ROOT, today);

        // Ensure backup directory exists
        await fs.ensureDir(targetDir);

        // Copy all JSON files from data/ to backups/YYYY-MM-DD/
        await fs.copy(DATA_DIR, targetDir, {
            filter: (src) => {
                // Copy directories or .json files only
                return fs.lstatSync(src).isDirectory() || src.endsWith('.json');
            }
        });

        console.log(`✅ Backup completed successfully to: ${targetDir}`);
        return true;
    } catch (err) {
        console.error('❌ Backup failed:', err);
        return false;
    }
}

// Execute if run directly
if (require.main === module) {
    runBackup();
}

module.exports = { runBackup };
