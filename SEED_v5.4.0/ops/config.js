const path = require('path');
require('dotenv').config();

// Root is where ops/ is located, so we go up one level for project root
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');

module.exports = {
    // Server Configuration
    PORT: process.env.PORT || 8083,
    NODE_ENV: process.env.NODE_ENV || 'development',
    SESSION_SECRET: process.env.SESSION_SECRET || 'seed_v5_secret_key_change_me',

    // LLM Configuration
    LLM: {
        ENDPOINT: process.env.LLM_ENDPOINT || 'http://localhost:11434/api/generate',
        MODEL: process.env.LLM_MODEL || 'gemma3:12b',
        MOCK_MODE: process.env.LLM_MOCK === 'true', // string 'true' to boolean
        TIMEOUT_MS: parseInt(process.env.LLM_TIMEOUT_MS) || 10000
    },

    // Paths
    PATHS: {
        ROOT: PROJECT_ROOT,
        DATA_DIR: DATA_DIR,
        PUBLIC_DIR: path.join(PROJECT_ROOT, 'public'),
        BACKUP_DIR: path.join(PROJECT_ROOT, 'backup'),
        
        // Data Files
        INTAKES_FILE: path.join(DATA_DIR, 'intakes.json'),
        EMPLOYEES_FILE: path.join(DATA_DIR, 'employees.json'),
        TASKS_FILE: path.join(DATA_DIR, 'tasks.json'),
        PROPOSALS_FILE: path.join(DATA_DIR, 'manual_proposals.json'),
        CHECKLISTS_FILE: path.join(DATA_DIR, 'checklists.json'),
    }
};
