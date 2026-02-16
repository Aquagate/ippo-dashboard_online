const http = require('http');
const fs = require('fs-extra');
const path = require('path');

// Configuration
const PORT = 8085; // Current running port
const BASE_URL = `http://localhost:${PORT}`;

function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(body || '{}')); } catch (e) { resolve(body); }
            });
        });
        req.on('error', (e) => reject(e));
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function runAISimulation() {
    console.log(`🤖 Starting AI Knowledge Loop Simulation...`);

    try {
        // Step 1: Create a "Non-Standard" Task (Simulating implicit knowledge)
        const intakeData = {
            requester: "鈴木 開発",
            channel: "Slack",
            summary: "PowerBI Proライセンスの割当依頼",
            details: "プロジェクトで必要になったため、PowerBI Proのライセンスを割り当ててください。承認済みです。"
        };
        await request('POST', '/api/intake', intakeData);

        // Fetch to find the ID
        const intakes = await request('GET', '/api/data/intakes');
        const myTask = intakes.find(i => i.summary === intakeData.summary);
        console.log(`[1] Created Task: ${myTask.intake_id}`);

        // Step 2: Operator completes it as "Others" (MAN-999)
        myTask.status = 'DONE';
        myTask.resolution = {
            resolved_at: new Date().toISOString(),
            resolved_by: "佐藤 次郎",
            manual_ref_id: "MAN-999", // Key trigger for AI
            final_answer: "PowerBI管理ポータルからライセンスを付与しました。利用開始メールが届きます。"
        };
        await request('POST', '/api/data/intakes', [myTask, ...intakes.filter(i => i.intake_id !== myTask.intake_id)]);
        console.log(`[2] Operator completed task as 'Others' (MAN-999)`);

        // Step 3: Run Analysis Script
        console.log(`[3] Running Analysis Script...`);
        const { execSync } = require('child_process');
        // Force mock mode if no local LLM
        if (!process.env.LLM_ENDPOINT) {
            console.log("    (Running in Mock Mode for verification)");
            process.env.LLM_MOCK = 'true';
        }
        execSync('node ops/analyze_patterns.js', { stdio: 'inherit' });

        // Step 4: Verify Proposal Created
        const proposals = await fs.readJson('data/manual_proposals.json');
        const newProp = proposals.find(p => p.source_task === intakeData.summary);

        if (newProp) {
            console.log(`\n✅ SUCCESS: AI Proposal Created!`);
            console.log(JSON.stringify(newProp, null, 2));
        } else {
            console.error(`\n❌ FAILED: No proposal found.`);
        }

    } catch (e) {
        console.error('Simulation Failed:', e);
    }
}

runAISimulation();
