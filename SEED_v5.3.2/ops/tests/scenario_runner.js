const http = require('http');
const config = require('../config');

// Helper to make requests
function request(method, path, data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: config.PORT,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve(body); // Return raw if not JSON
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runScenarios() {
    console.log('🚀 Starting SEED v5.3 Simulation Scenarios...');
    console.log('------------------------------------------------');

    try {
        // --- Project A: Standard Fix ---
        console.log('\n[Project A] Standard UI Fix Flow');
        const intakeA = await request('POST', '/api/intake', {
            requester: 'Designer-01',
            channel: 'Slack',
            summary: 'Fix Login Button Alignment',
            details: 'The button is off-center by 5px on mobile.'
        });
        console.log('1. Intake Submitted:', intakeA);

        if (!intakeA.success) throw new Error('Intake A failed');

        await sleep(500); // Simulate network
        const statusA = await request('POST', `/api/intake/${intakeA.id}/status`, { status: 'DONE' });
        console.log('2. Status -> DONE:', statusA);

        // --- Project B: Exception Flow ---
        console.log('\n[Project B] Urgent Data Restore (Exception)');
        const intakeB = await request('POST', '/api/intake', {
            requester: 'DevOps-Lead',
            channel: 'Email',
            summary: 'Urgent Data Restore',
            details: 'Production DB snapshot needs restore.'
        });
        console.log('1. Intake Submitted:', intakeB);

        await sleep(500);
        const statusB1 = await request('POST', `/api/intake/${intakeB.id}/status`, { status: 'EXCEPTION' });
        console.log('2. Status -> EXCEPTION:', statusB1);

        await sleep(500);
        const statusB2 = await request('POST', `/api/intake/${intakeB.id}/status`, { status: 'RESOLVED' });
        console.log('3. Status -> RESOLVED (Admin Override):', statusB2);

        // --- Project C: Feature Request (AI Bridge) ---
        console.log('\n[Project C] Dark Mode Feature');
        const intakeC = await request('POST', '/api/intake', {
            requester: 'PM-Suzuki',
            channel: 'Form',
            summary: 'Dark Mode Support',
            details: 'Users requested dark mode for night shifts.'
        });
        console.log('1. Intake Submitted:', intakeC);

        await sleep(1000); // Wait for storage
        const context = await request('GET', '/api/bridge/context');
        console.log('2. AI Bridge Context Retrieved:');

        const contextStr = context.context || '';
        const hasA = contextStr.includes(intakeA.id); // Should be there (DONE is active in context?) -> app.js logic: status !== 'ARCHIVED'
        const hasB = contextStr.includes(intakeB.id);
        const hasC = contextStr.includes(intakeC.id);

        console.log(`   - Project A (DONE) in context? ${hasA ? 'YES' : 'NO'}`);
        console.log(`   - Project B (RESOLVED) in context? ${hasB ? 'YES' : 'NO'}`);
        console.log(`   - Project C (RECEIVED) in context? ${hasC ? 'YES' : 'NO'}`);

        if (!hasC) throw new Error('Project C missing from AI Bridge Context');

        console.log('\n------------------------------------------------');
        console.log('✅ All Scenarios Executed Successfully.');

    } catch (e) {
        console.error('\n❌ Simulation Failed:', e);
        process.exit(1);
    }
}

runScenarios();
