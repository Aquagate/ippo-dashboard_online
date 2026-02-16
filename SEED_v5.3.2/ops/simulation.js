const http = require('http');

// Configuration
const PORT = 8085; // Updated to match running server
const BASE_URL = `http://localhost:${PORT}`;

// Helper to make requests
function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body || '{}'));
                } catch (e) {
                    resolve(body);
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function runSimulation() {
    console.log(`🚀 Starting Workflow Simulation on port ${PORT}...`);

    try {
        // Step 1: Requester submits an intake
        console.log('\n[1] Requester: Submitting new request...');
        const intakeData = {
            requester: "山田 太郎",
            channel: "Form",
            summary: "VPN接続申請 (Simulation)",
            details: "自宅からのVPN接続ができません。権限の確認をお願いします。"
        };
        // The API currently doesn't return the created object ID directly in MVP, 
        // but let's assume we can find it by fetching latest.
        await request('POST', '/api/intake', intakeData);

        // Fetch to find the ID
        const intakes = await request('GET', '/api/data/intakes');
        const myTask = intakes.find(i => i.summary === intakeData.summary);
        if (!myTask) throw new Error('Task not found!');
        console.log(`✅ Task Created: ${myTask.intake_id} [${myTask.status}]`);

        // Step 2: Operator starts work
        console.log('\n[2] Operator: Starting work...');
        myTask.status = 'PROCESSING';
        await request('POST', '/api/data/intakes', [myTask, ...intakes.filter(i => i.intake_id !== myTask.intake_id)]);
        console.log(`✅ Status updated to PROCESSING`);

        // Step 3: Operator Escalates to SV
        console.log('\n[3] Operator: Escalating to SV...');
        myTask.status = 'REVIEW_WAITING';
        if (!myTask.comments) myTask.comments = [];
        myTask.comments.push({
            user: "佐藤 次郎",
            role: "OPERATOR",
            text: "マニュアルに記載がないエラーのため判断をお願いします。",
            at: new Date().toISOString()
        });
        await request('POST', '/api/data/intakes', [myTask, ...intakes.filter(i => i.intake_id !== myTask.intake_id)]);
        console.log(`✅ Status updated to REVIEW_WAITING with comment`);

        // Step 4: SV Rejects (Back)
        console.log('\n[4] Supervisor: Checking and Sending Back...');
        // In reality SV would fetch first, but we have the object reference
        myTask.status = 'REVIEW_BACKED';
        myTask.comments.push({
            user: "高橋 リーダー",
            role: "SV",
            text: "P.54のトラブルシューティング手順を試してから再申請してください。",
            at: new Date().toISOString()
        });
        await request('POST', '/api/data/intakes', [myTask, ...intakes.filter(i => i.intake_id !== myTask.intake_id)]);
        console.log(`✅ Status updated to REVIEW_BACKED with comment`);

        // Step 5: Operator Completes Task with Manual Ref
        console.log('\n[5] Operator: Completing Task with Manual Ref...');
        myTask.status = 'DONE';
        myTask.resolution = {
            resolved_at: new Date().toISOString(),
            resolved_by: "佐藤 次郎",
            manual_ref_id: "MAN-002",
            final_answer: "手順通りアカウント発行し、Slack DMで通知しました。"
        };
        await request('POST', '/api/data/intakes', [myTask, ...intakes.filter(i => i.intake_id !== myTask.intake_id)]);
        console.log(`✅ Status updated to DONE with Resolution info`);

        // Step 6: Verification (AI Bridge Context)
        console.log('\n[6] Verifying via AI Bridge...');
        const context = await request('GET', '/api/bridge/context');
        console.log('--- AI Bridge Output (Partial) ---');
        // Simple check
        if (context.context && context.context.length > 10) {
            console.log('✅ AI Bridge is active.');
        }

        // Verify data persistence
        const finalIntakes = await request('GET', '/api/data/intakes');
        const finalTask = finalIntakes.find(i => i.intake_id === myTask.intake_id);
        if (finalTask.resolution && finalTask.resolution.manual_ref_id === "MAN-002") {
            console.log('\n✅ TEST PASSED: Manual Reference (MAN-002) is correctly saved.');
        } else {
            console.error('\n❌ TEST FAILED: Manual Reference not saved.');
        }

    } catch (e) {
        console.error('Simulation Failed:', e);
    }
}

runSimulation();
