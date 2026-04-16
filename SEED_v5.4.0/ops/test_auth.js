const http = require('http');
const querystring = require('querystring');

const COOKIE_NAME = 'ops_os_session';
const PORT = 8083;

function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        const headers = options.headers || {};
        if (options.body) {
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = Buffer.byteLength(options.body);
        }
        if (options.cookie) {
            headers['Cookie'] = options.cookie;
        }

        const req = http.request({
            hostname: 'localhost',
            port: PORT,
            path: path,
            method: options.method || 'GET',
            headers: headers
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ res, data }));
        });

        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

async function testAuth() {
    console.log("🔍 Starting Auth Test...");

    // 1. Test Redirect (No Cookie)
    console.log("\n[Test 1] Accessing Protected Page (No Cookie)");
    const r1 = await request('/dashboard_pm.html');
    if (r1.res.statusCode === 302 && r1.res.headers.location === '/login.html') {
        console.log("✅ SUCCESS: Redirected to /login.html");
    } else {
        console.log("❌ FAILED: Status", r1.res.statusCode, "Loc", r1.res.headers.location);
    }

    // 2. Login
    console.log("\n[Test 2] Logging in as PM-001");
    const r2 = await request('/api/login', {
        method: 'POST',
        body: JSON.stringify({ userId: 'PM-001' })
    });

    let cookie = null;
    if (r2.res.statusCode === 200) {
        const setCookie = r2.res.headers['set-cookie'];
        if (setCookie && setCookie[0].includes(COOKIE_NAME)) {
            cookie = setCookie[0].split(';')[0];
            console.log("✅ SUCCESS: Login OK. Cookie received:", cookie);
        } else {
            console.log("❌ FAILED: No cookie set.");
        }
    } else {
        console.log("❌ FAILED: Login Status", r2.res.statusCode);
    }

    if (!cookie) return;

    // 3. Access Protected Page (With Cookie)
    console.log("\n[Test 3] Accessing Protected Page (With Cookie)");
    const r3 = await request('/dashboard_pm.html', { cookie: cookie });
    if (r3.res.statusCode === 200) {
        console.log("✅ SUCCESS: Access Granted (200 OK)");
    } else {
        console.log("❌ FAILED: Status", r3.res.statusCode);
    }
}

testAuth();
