const http = require('http');
const https = require('https');
const config = require('./config');

/**
 * LLM Client Adapter
 * Connects to a local LLM service (e.g., Ollama) or mocks response.
 */

const SYSTEM_PROMPT = `
あなたはSEEDプロジェクトの高度な開発アシスタントです。
以下のルールを厳守してください：
1. 回答は必ず「日本語」で行うこと。
2. 技術用語は適切に使用するが、説明文は日本語とする。
3. 特に指定がない限り、論理的かつ簡潔に回答すること。
4. JSON形式が指定された場合は、妥当なJSONのみを返し、前後の説明文は一切加えないこと。
`;

async function generateCompletion(prompt, options = { json: true }) {
    if (config.LLM.MOCK_MODE) {
        return mockResponse(prompt, options);
    }

    const jsonInstruction = options.json ? "\n\nRespond in JSON format only. (Values must be in Japanese)" : "\n\n日本語で回答してください。Markdown形式を推奨します。";
    const fullPrompt = `${SYSTEM_PROMPT}\n\n[USER REQUEST]\n${prompt}${jsonInstruction}`;

    const postData = JSON.stringify({
        model: config.LLM.MODEL,
        prompt: fullPrompt,
        stream: false,
        format: options.json ? "json" : undefined
    });

    try {
        const response = await makeRequest(config.LLM.ENDPOINT, postData, config.LLM.TIMEOUT_MS);

        // Ollama returns { "response": "..." }
        if (response.response) {
            if (options.json) {
                try {
                    return JSON.parse(response.response);
                } catch (e) {
                    console.warn("Failed to parse AI response as JSON. Returning raw string.");
                    return response.response;
                }
            }
            return response.response;
        }
        return response; // Fallback
    } catch (e) {
        console.warn("LLM Connection Failed/Timed Out. Falling back to Mock.", e.message);
        return mockResponse(prompt, options);
    }
}

function makeRequest(urlStr, postData, timeoutMs) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlStr);
        const lib = url.protocol === 'https:' ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = lib.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error('Invalid JSON response'));
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request Timed Out'));
        });

        req.on('error', e => reject(e));

        if (timeoutMs) {
            req.setTimeout(timeoutMs);
        }

        req.write(postData);
        req.end();
    });
}

function mockResponse(prompt, options) {
    console.log("[Mock LLM] Analyzing prompt context...");

    // 1. Safety Check Mock
    if (prompt.includes("strict safety filter") || prompt.includes("PII") || prompt.includes("Offensive language")) {
        return {
            has_violation: false,
            violation_severity: "none",
            reason: "Mock: No safety violations detected in the provided text."
        };
    }

    // 2. Groundedness Check Mock
    if (prompt.includes("strict fact-checker") || prompt.includes("Identify factual claims")) {
        return {
            total_claims: 3,
            supported_claims: 3,
            reason: "Mock: All claims are supported by the context."
        };
    }

    // 3. Tone Check Mock
    if (prompt.includes("Rate the tone")) {
        return {
            score: 95,
            reason: "Mock: Tone is professional and helpful."
        };
    }

    // 4. Pattern Analysis Mock (Default for analyze_patterns)
    if (prompt.includes("Example Input") || prompt.includes("suggested_title")) {
        return {
            trigger_text: "パスワード リセット 忘れた",
            suggested_title: "アカウントロック解除・パスワード初期化手順",
            category: "Account",
            reason: "Mock: パスワード関連の問い合わせのため、標準手順化を推奨。"
        };
    }

    // Default Fallback
    if (options.json) {
        return {
            mock_status: "fallback",
            message: "日本語での応答モックです。"
        };
    }
    return "これはモックの応答です。LLMが接続されていないか、タイムアウトしました。";
}

module.exports = { generateCompletion };
