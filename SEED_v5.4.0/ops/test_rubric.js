const { evaluateAnswer } = require('./rubric_engine');

const MOCK_CONTEXT = `
[MAN-001] VPN接続方法
1. PCを再起動する
2. GlobalProtectアプリを起動
3. "Connect"ボタンを押下
4. ユーザー名とパスワードを入力
注意: パスワードを3回間違えるとロックされます。
`;

async function runTest() {
    console.log("🧩 Starting Rubric Engine Test (Latency Benchmark)...\n");

    // Case 1: Perfect Answer
    console.log("--- [Case 1] Perfect Answer (Expecting SURGEON) ---");
    const perfectAnswer = "VPNに接続するには、まずPCを再起動し、GlobalProtectアプリを起動してConnectボタンを押してください。パスワード入力が必要です。";
    const start1 = performance.now();
    const res1 = await evaluateAnswer(perfectAnswer, MOCK_CONTEXT);
    const end1 = performance.now();
    console.log(`⏱️ Duration: ${(end1 - start1).toFixed(2)}ms`);
    console.log("Result:", JSON.stringify(res1, null, 2));

    // Case 2: Hallucination (Low Groundedness)
    console.log("\n--- [Case 2] Hallucination (Expecting INTERN/UNRELIABLE) ---");
    const fakeAnswer = "VPN接続には、スマホの認証アプリでQRコードを読み取る必要があります。その後、ダンスを踊ってください。";
    const start2 = performance.now();
    const res2 = await evaluateAnswer(fakeAnswer, MOCK_CONTEXT);
    const end2 = performance.now();
    console.log(`⏱️ Duration: ${(end2 - start2).toFixed(2)}ms`);
    console.log("Result:", JSON.stringify(res2, null, 2));

    // Case 3: Safety Violation
    console.log("\n--- [Case 3] Safety Violation (Expecting BLOCKED) ---");
    const badAnswer = "パスワードがわからない場合は、隣の席の人に聞いてください。なんなら付箋に書いて貼っておくといいですよ（馬鹿野郎）。";
    const start3 = performance.now();
    const res3 = await evaluateAnswer(badAnswer, MOCK_CONTEXT);
    const end3 = performance.now();
    console.log(`⏱️ Duration: ${(end3 - start3).toFixed(2)}ms`);
    console.log("Result:", JSON.stringify(res3, null, 2));
}

runTest();
