// src/ui/views/insight.ts
import { fetchOllamaModels, generateOllamaResponse } from '../../services/ollama';
import { getActiveEntries, dataCache } from '../../app/store';
import { buildEvidenceSummary } from '../../domain/future/evidence';

interface InsightResult {
    weekly_bias: string;
    unperformed: string;
    diff_last_week: string;
    reignition_target: string;
    energy_trap: string;
    synergy: string;
}

const INSIGHT_SCHEMA = {
    type: "object",
    properties: {
        weekly_bias: { type: "string" },
        unperformed: { type: "string" },
        diff_last_week: { type: "string" },
        reignition_target: { type: "string" },
        energy_trap: { type: "string" },
        synergy: { type: "string" }
    },
    required: ["weekly_bias", "unperformed", "diff_last_week", "reignition_target", "energy_trap", "synergy"]
};

let initialized = false;

export async function initInsightTab() {
    if (initialized) return;
    initialized = true;

    const select = document.getElementById("insightModelSelect") as HTMLSelectElement;
    const input = document.getElementById("insightModelInput") as HTMLInputElement;
    const periodSelect = document.getElementById("insightPeriodSelect") as HTMLSelectElement;
    const btn = document.getElementById("btnRunInsight") as HTMLButtonElement;
    const msg = document.getElementById("insightStatusMsg") as HTMLDivElement;

    if (!select || !input || !periodSelect || !btn || !msg) return;

    // Load Last State
    const savedModel = localStorage.getItem("ippo_insight_model") || "gemma4:e4b";
    const savedPeriod = localStorage.getItem("ippo_insight_period") || "14";
    input.value = savedModel;
    periodSelect.value = savedPeriod;

    const savedResult = localStorage.getItem("ippo_insight_last_result");
    if (savedResult) {
        try {
            renderInsightResult(JSON.parse(savedResult));
        } catch(e) {}
    }

    // Load models
    try {
        const models = await fetchOllamaModels();
        select.innerHTML = '<option value="">(ローカルモデル一覧)</option>';
        if (models.length === 0) {
            select.innerHTML = '<option value="">Ollama未起動 or モデルなし</option>';
        } else {
            models.forEach(m => {
                const opt = document.createElement("option");
                opt.value = m.name;
                opt.textContent = m.name;
                select.appendChild(opt);
            });
            select.addEventListener("change", () => {
                if (select.value) {
                    input.value = select.value;
                }
            });
        }
    } catch(e) {
        select.innerHTML = '<option value="">Ollama接続に失敗</option>';
    }

    btn.addEventListener("click", async () => {
        const modelName = input.value.trim() || "gemma4:e4b";
        const period = parseInt(periodSelect.value, 10) || 14;

        if (!modelName) {
            msg.textContent = "モデル名が未指定です。";
            return;
        }

        msg.style.color = "var(--text)";
        msg.textContent = `🤖 ログを集計し、Ollama (${modelName}) で分析中... (数十秒〜数分かかります)`;
        btn.disabled = true;
        document.getElementById("insightResultsArea")!.style.display = "none";
        
        localStorage.setItem("ippo_insight_model", modelName);
        localStorage.setItem("ippo_insight_period", period.toString());

        try {
            // Context Generation (圧縮済み要約と差異の取得)
            const entries = getActiveEntries();
            const dailyStates = dataCache.dailyStates || {};
            
            const currentSummary = buildEvidenceSummary({ entries, dailyStates, windowDays: period });
            
            // 前の同期間のログ
            const borderTime = Date.now() - period * 24 * 60 * 60 * 1000;
            const previousEntries = entries.filter(e => e.ts < borderTime);
            const previousSummary = buildEvidenceSummary({ 
                entries: previousEntries, 
                dailyStates, 
                windowDays: period 
            });

            if (currentSummary.entryCount < 5) {
                throw new Error(`直近${period}日間のログが${currentSummary.entryCount}件しかありません。分析には最低でも5件以上の記録が必要です。`);
            }

            const prompt = `あなたは「一歩」ダッシュボードの行動アナリストAIです。
提供する直近${period}日間のログ統計要約データと、その前の同じ期間の比較データを元に、ユーザーの行動傾向やインサイトを分析し、指定されたフォーマットで回答してください。

[分析対象データ（直近${period}日間）]
総件数: ${currentSummary.entryCount}件
継続テーマ: ${JSON.stringify(currentSummary.sustainedThemes)}
気力と行動の罠/インサイトパターン: ${JSON.stringify(currentSummary.traps)}

[比較対象データ（その前の${period}日間）]
総件数: ${previousSummary.entryCount}件

要求: 提供されたJSON Schemaに厳密に従い、以下の6つの項目の分析結果を短いテキストで構築してください。
必ず正しいJSONを出力し、マークダウンや自由な前置きを含めないでください。`;

            const result = await generateOllamaResponse<InsightResult>({
                model: modelName,
                prompt: prompt,
                format: INSIGHT_SCHEMA
            });
            
            localStorage.setItem("ippo_insight_last_result", JSON.stringify(result));
            renderInsightResult(result);
            msg.textContent = "✅ 分析が完了しました。";

        } catch(e: any) {
            console.error(e);
            msg.style.color = "#ef4444";
            msg.textContent = `❌ エラー: ${e.message}`;
        } finally {
            btn.disabled = false;
        }
    });
}

function renderInsightResult(data: InsightResult) {
    document.getElementById("insightResultsArea")!.style.display = "grid";
    
    const slots = [
        { id: "insightSlot1", content: data.weekly_bias },
        { id: "insightSlot2", content: data.unperformed },
        { id: "insightSlot3", content: data.diff_last_week },
        { id: "insightSlot4", content: data.reignition_target },
        { id: "insightSlot5", content: data.energy_trap },
        { id: "insightSlot6", content: data.synergy },
    ];
    
    slots.forEach(slot => {
        const el = document.getElementById(slot.id);
        if (el) {
            el.textContent = slot.content || "（該当なし）";
        }
    });
}
