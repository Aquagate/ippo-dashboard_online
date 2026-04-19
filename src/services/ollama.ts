// src/services/ollama.ts

export interface OllamaModelInfo {
    name: string;
    size: number;
    digest: string;
}

/**
 * Local Ollama サーバーから利用可能なモデル一覧を取得
 */
export async function fetchOllamaModels(): Promise<OllamaModelInfo[]> {
    try {
        const res = await fetch("http://localhost:11434/api/tags", {
            method: "GET",
            headers: {
                "Accept": "application/json",
            }
        });
        if (!res.ok) {
            console.warn("Ollama /api/tags returned status:", res.status);
            return [];
        }
        const data = await res.json();
        return data.models || [];
    } catch (e) {
        console.error("Failed to fetch Ollama models:", e);
        return [];
    }
}

export interface OllamaGenerateOptions {
    model: string;
    prompt: string;
    format?: any; // JSON schema or "json"
}

/**
 * /api/generate を呼び出して JSON (パース済み) を返す。
 * stream: false 固定、3分タイムアウト、JSON Schema 準拠対応。
 */
export async function generateOllamaResponse<T>(options: OllamaGenerateOptions): Promise<T> {
    const controller = new AbortController();
    // 3分タイムアウト
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    try {
        const res = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: options.model,
                prompt: options.prompt,
                stream: false,
                format: options.format,
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Ollamaからのエラー (${res.status}): ${errText}`);
        }

        const data = await res.json();
        const responseText = data.response;
        
        try {
            return JSON.parse(responseText) as T;
        } catch (e) {
            console.error("Ollama JSON parse error:", responseText);
            throw new Error("Local LLMから返されたJSONの形式が不正です。再実行してください。");
        }
        
    } catch (e: any) {
        clearTimeout(timeoutId);
        // fetchの例外判定
        if (e.name === 'AbortError' || e.message?.includes('aborted')) {
            throw new Error("タイムアウトしました。モデルのロードや生成に時間がかかりすぎた可能性があります。");
        }
        if (e.message?.includes('Failed to fetch')) {
            throw new Error("Ollamaに接続できません。アプリ(Ollama)が起動しているか確認してください。");
        }
        throw e;
    }
}
