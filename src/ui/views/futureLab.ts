// ===== Future Lab View (未来ラボ) =====
// AI Bridge simulation, story mode, butterfly diff, asset shelf

import type { Simulation, SimulationResult, Worldline, AssetCommit } from '../../domain/schema';
import { MAX_SIMULATION_HISTORY } from '../../domain/schema';
import { uuid, formatDate, formatDateTimeForRecord, simpleHash, parseDateStr } from '../../utils/helpers';
import { inferCategory } from '../../domain/categories';
import { normalizeSimulationV2 } from '../../domain/normalize';
import { dataCache, setDataCache, getActiveEntries } from '../../app/store';
import { getRecordTime, saveNextMemosToStorage, createMemo } from '../../app/actions';
import { getDeviceId } from '../../utils/device';
import { storageSaveData, odSaveCache, odEnqueueChange } from '../../services/storage/localStorage';
import { showToast } from '../toast';
import { renderFlowChart, renderCrossTodChart, renderKeywordChart, renderRadarChart, renderGreatStepsGallery, renderAll, renderNextMemos } from './ippoLog';
import { nextMemos, setNextMemos } from '../../app/store';
import { buildEvidenceSummary } from '../../domain/future/evidence';
import { sanitize } from '../../utils/sanitize';

let isLabInitialized = false;
let storyModeEnabled = false;

// ===== Utility Functions =====

function findSimulationBySeedKey(seedKey: string): any {
    const sims = dataCache.simulations || [];
    return sims.find(s => s.seedKey === seedKey);
}

function hasRecentAssetCommit(): boolean {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const sims = dataCache.simulations || [];
    return sims.some(sim => {
        const assetCommits = sim.assetCommits || [];
        return assetCommits.some(ac => ac.committedAt >= sevenDaysAgo);
    });
}

function hasTodayCommit(): boolean {
    const today = formatDate(new Date());
    const sims = dataCache.simulations || [];
    return sims.some(sim => {
        if (!sim.commit) return false;
        const commitDate = formatDate(new Date(sim.commit.committedAt));
        return commitDate === today;
    });
}

function getTodayCommit(): any {
    const today = formatDate(new Date());
    const sims = dataCache.simulations || [];
    return sims.find(sim => {
        if (!sim.commit) return false;
        const commitDate = formatDate(new Date(sim.commit.committedAt));
        return commitDate === today;
    });
}

function commitAsset(simulationId: string, worldlineKey: string, assetIndex: number): void {
    const sim = (dataCache.simulations || []).find(s => s.id === simulationId);
    if (!sim) { showToast("Simulation not found", "err"); return; }
    const worldline = (sim.result as any)[worldlineKey];
    if (!worldline || !worldline.asset_steps || !worldline.asset_steps[assetIndex]) {
        showToast("Asset not found", "err"); return;
    }
    const asset = worldline.asset_steps[assetIndex];
    const now = Date.now();
    if (!sim.assetCommits) sim.assetCommits = [];
    sim.assetCommits.push({
        worldline: worldlineKey, assetIndex, committedAt: now,
        asset: asset.asset, type: asset.type || "doc", why: asset.why || ""
    });
    sim.updatedAt = now;
    storageSaveData(dataCache);
    renderFutureCards(sim.result, sim.id);
    renderAssetShelf();
    showToast(`📌 「${asset.asset.slice(0, 20)}...」を資産として確定しました`, "ok");
}

function toggleStoryMode(): void {
    if (!hasRecentAssetCommit()) {
        showToast("⚠️ Story Mode解禁には直近7日で資産の確定が必要です", "warn");
        return;
    }
    storyModeEnabled = !storyModeEnabled;
    localStorage.setItem("storyModeEnabled", storyModeEnabled ? "1" : "0");
    const latestSim = (dataCache.simulations || [])[0];
    if (latestSim) renderFutureCards(latestSim.result, latestSim.id);
    showToast(storyModeEnabled ? "📖 Story Mode ON（物語表示）" : "📐 設計図モード（デフォルト）", "ok");
}

function loadSimulation(simId: string): void {
    const sim = (dataCache.simulations || []).find(s => s.id === simId);
    if (!sim || !sim.result) { showToast("Simulation not found", "err"); return; }
    renderFutureCards(sim.result, sim.id);
    const container = document.getElementById("futureCardsContainer");
    if (container) container.style.display = "grid";
    showToast("📂 履歴からロードしました", "ok");
}

function deleteSimulation(simId: string): void {
    if (!confirm("このシミュレーション履歴を削除しますか？\n（元に戻せません）")) return;
    const sim = (dataCache.simulations || []).find(s => s.id === simId);
    if (!sim) return;
    sim.deleted = true;
    sim.updatedAt = Date.now();
    storageSaveData(dataCache);
    renderSimulationHistory();
    showToast("🗑️ 履歴を削除しました", "ok");
}

export function initFutureLab(): void {
    if (isLabInitialized) return;
    console.log("Initializing Future Lab...");
    console.log("🚀 Ippo Dashboard v5.2.1-vite initialized");
    showToast("🚀 System Updated (v5.2.1-vite)", "ok");
    isLabInitialized = true;

    setTimeout(() => {
        renderRadarChart();
        renderFlowChart();
        renderCrossTodChart();
        renderKeywordChart();
        renderGreatStepsGallery();
        initBridgeEvents();
        initStoryMode();

        const sims = (dataCache.simulations || []).filter(s => !s.deleted);
        if (sims.length > 0) {
            const latestSim = sims[0];
            if (latestSim.result) {
                renderFutureCards(latestSim.result, latestSim.id);
                const container = document.getElementById("futureCardsContainer");
                if (container) container.style.display = "grid";
            }
        }
        renderSimulationHistory();
    }, 100);
}

// ===== Simulation Context Generation =====

function generateSeedKey(recentEntries: any[]): string {
    const today = formatDate(new Date());
    const ids = recentEntries.map(e => e.id).join('|');
    const hash = simpleHash(ids);
    return `${today}_${recentEntries.length}_${hash}`;
}

function buildPreviousSimSummary(sim: Simulation | null): string | null {
    if (!sim || !sim.result) return null;
    const r = sim.result;
    const isV5 = r.worldline_baseline && r.worldline_leap && r.worldline_guardrail;
    if (!isV5) return "前回シミュレーションは旧バージョン(v4)です。";

    const dateStr = new Date(sim.createdAt).toLocaleDateString("ja-JP");
    const getOutcomes = (wl: Worldline | undefined) => {
        if (!wl || !wl.roadmap) return "";
        const w1 = wl.roadmap.find(x => x.horizon === "1w")?.outcome || "";
        const m6 = wl.roadmap.find(x => x.horizon === "6m")?.outcome || "";
        return `1w:${w1.slice(0, 30)}... / 6m:${m6.slice(0, 30)}...`;
    };

    return `
前回シミュレーション (${dateStr}):
- Baseline: 「${r.worldline_baseline!.title}」→ ${getOutcomes(r.worldline_baseline)}
- Leap: 「${r.worldline_leap!.title}」→ ${getOutcomes(r.worldline_leap)}
- Guardrail: 「${r.worldline_guardrail!.title}」→ ${getOutcomes(r.worldline_guardrail)}
- rubric_score: B:${r.worldline_baseline!.rubric_score} / L:${r.worldline_leap!.rubric_score} / G:${r.worldline_guardrail!.rubric_score}
`.trim();
}

async function copySimulationContext(days: number = 90): Promise<void> {
    const entries = getActiveEntries();
    const sorted = entries.slice().sort((a, b) => b.ts - a.ts);

    // Evidence Summary 生成（P1-06）
    const evidenceSummary = buildEvidenceSummary({
        entries: sorted,
        dailyStates: dataCache.dailyStates || {},
        windowDays: days,
    });

    // 指定された日数
    const windowMs = days * 24 * 60 * 60 * 1000;
    const border = Date.now() - windowMs;
    let recent = sorted.filter(e => e.ts >= border);

    // データが少なすぎる場合の最低保証 (Min 30)
    if (recent.length < 30) {
        recent = sorted.slice(0, Math.min(30, sorted.length));
    }

    // InputDigest生成
    const categoryCount: Record<string, number> = {};
    const keywordCount: Record<string, number> = {};

    const todMap: Record<string, string> = { "morning": "🌅", "afternoon": "☀️", "day": "☀️", "night": "🌙" };
    const todStats: Record<string, number> = { "morning": 0, "afternoon": 0, "day": 0, "night": 0 };
    let todTotal = 0;

    recent.forEach(e => {
        const cat = e.category || "その他";
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        // 簡易キーワード抽出
        const words = (e.text || "").split(/[\s、。,]+/).filter(w => w.length >= 2 && w.length <= 10);
        words.forEach(w => {
            keywordCount[w] = (keywordCount[w] || 0) + 1;
        });

        // TOD集計
        if (e.tod && Array.isArray(e.tod)) {
            e.tod.forEach(t => {
                if (todStats[t] !== undefined) {
                    todStats[t]++;
                    todTotal++;
                }
            });
        }
    });

    const topCategories = Object.entries(categoryCount)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 5)
        .map(([category, count]) => ({ category, count }));

    const topKeywords = Object.entries(keywordCount)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 10)
        .map(([keyword, count]) => ({ keyword, count }));

    // TOD Context生成
    let todContext = "No time-of-day tags found.";
    if (todTotal > 0) {
        todContext = Object.entries(todStats)
            .filter(([_k, v]) => v > 0)
            .map(([k, v]) => `- ${k}: ${Math.round((v / todTotal) * 100)}% (${v}回)`)
            .join("\n");
    }

    const dateRange = recent.length > 0 ? {
        from: recent[recent.length - 1].date,
        to: recent[0].date
    } : { from: "", to: "" };

    // 日次メンタルデータの抽出
    const dailyMentalList: { date: string; mental: number }[] = [];
    const visitedDates = new Set<string>();
    recent.forEach(e => {
        if (!e.date || visitedDates.has(e.date)) return;
        visitedDates.add(e.date);
        const state = (dataCache.dailyStates || {})[e.date];
        if (state && state.mental) {
            dailyMentalList.push({ date: e.date, mental: state.mental });
        }
    });
    dailyMentalList.sort((a, b) => a.date.localeCompare(b.date));

    const dailyMentalContext = dailyMentalList.length > 0
        ? dailyMentalList.map(d => `- ${d.date}: Mental Lv.${d.mental}`).join("\n")
        : "No daily mental records available.";

    const userLogs = recent.map(e => {
        const tods = (e.tod || []).map(k => {
            const icon = todMap[k] || "";
            return icon ? `${icon}(${k})` : "";
        }).join(" ");
        const todStr = tods ? ` ${tods}` : "";
        return `${e.date}${todStr} [${e.category}]: ${e.text}`;
    }).join("\n");

    // 前回シミュレーション情報の取得
    const sims = (dataCache.simulations || []).filter(s => !s.deleted);
    const previousSim = sims.length > 0 ? sims[0] : null;
    const previousSummary = previousSim ? buildPreviousSimSummary(previousSim) : null;

    // 差分ログ（前回作成日以降）
    let newLogsContext = "（初回のため比較なし）";
    if (previousSim) {
        const prevTime = previousSim.createdAt;
        const newLogs = recent.filter(e => e.ts > prevTime);
        if (newLogs.length > 0) {
            newLogsContext = newLogs.map(e => `- ${e.date} [${e.category}]: ${e.text.slice(0, 50)}...`).join("\n");
        } else {
            newLogsContext = "（前回以降の新規ログなし）";
        }
    }

    const prompt = `
# SEED v5 Simulation Request (v2.6.0 — Leap Enhanced)

あなたは「未来シミュレーションエンジン」です。
ユーザーの過去ログ（観測）と **事前生成されたEvidence Summary** にもとづき、3つの世界線（Baseline / Leap / Guardrail）を提示してください。
**「活動時間帯（Time of Day）」と「行動内容」の相関**にも注目し、生活リズムの観点からも分析を行ってください。

## 大前提（守るルール）
- 占い化禁止：未来は「当てる」のではなく「選択肢を増やす」ための未来地図
- 世界線は固定3本（迷宮化防止）
  - Baseline（現状延長）
  - Leap（10X飛躍）
  - Guardrail（崩れ回避 / 逃走歓迎 / 回復の足場）
- 医療・診断の断定は禁止
- ログに無い文脈を捏造しない（evidenceはログ引用ベース）
- 恐怖訴求は禁止（破滅/手遅れ/最悪 などの煽り語を使わない）
- 出力はJSONのみ（余計な文章は禁止）

## Evidence Summary（アプリ側で事前生成・事実ベース）
${evidenceSummary.text}

## Context (User Logs & Optional States)
期間: ${dateRange.from} 〜 ${dateRange.to}
件数: ${recent.length}件

Top Categories:
${topCategories.map(c => `- ${c.category}: ${c.count}件`).join("\n")}

Top Keywords:
${topKeywords.map(k => `- ${k.keyword}: ${k.count}回`).join("\n")}

Daily Mental (optional, 1=Low, 5=High, 未入力は不明として扱う):
${dailyMentalContext}

Time-of-day tags (optional, morning/afternoon/night の割合。無いなら不明):
${todContext}

--- 過去ログ（観測） ---
${userLogs}
--- ここまで ---

## Previous Simulation（前回との比較用）
${previousSummary || "（過去データなし）"}

### 前回から今回までに追加されたログ
${newLogsContext}

指示: 前回の予測と今回のログ差分を踏まえ、軌道がどう変わったかを \`meta.trajectory_shift\` に1-2文で記述してください。
（例：「前回のBaselineでは〇〇を懸念していたが、〇〇の実践によりLeap寄りの軌道へ修正された」など）

## Self-Rubric Scoring（必須プロセス・厳守）

各世界線を以下6観点で採点し、合計90点以上になるまで内部で修正を繰り返してください。
**90点未満の世界線は出力禁止。** 内部で修正してから出力すること。

| # | 観点                 | 配点 | 基準                                                   |
|---|----------------------|------|--------------------------------------------------------|
| 1 | Consistency          | 20点 | ログの傾向・キーワードと提案の方向が一致している         |
| 2 | Causality            | 20点 | micro_steps → roadmapの因果が論理的に通る               |
| 3 | Actionability        | 15点 | 全micro_stepsが15分以内で着手可能（「検討する」は不可） |
| 4 | Asset Leverage       | 15点 | asset_stepsが再利用可能な具体的形式になっている         |
| 5 | Guardrail Sanity     | 15点 | Guardrailが回復・逃走の足場として実際に機能する         |
| 6 | Evidence Grounding   | 15点 | 全evidenceがログから直接引用できる                       |

rubric_score = 6観点の合計（/100）
rubric_reason = 最も低い観点名 + 改善した内容（1行）
rubric_detail = { consistency: 点, causality: 点, actionability: 点, asset_leverage: 点, guardrail_sanity: 点, evidence_grounding: 点 }

## 世界線独立性チェック（必須）

3つの世界線（Baseline / Leap / Guardrail）のmicro_stepsに重複が30%以上あれば作り直すこと。
各世界線は異なるアプローチ・戦略を示すこと。

## Leap三段構造（worldline_leap専用ルール）

worldline_leap には、通常のフィールドに加えて **\`leap_sections\`** を必ず含めること。
この3セクションが Leap の核心であり、Evidence Summary を土台に「踏襲＋飛躍」を安定して出力する。

\`\`\`
leap_sections: {
  evidence_mirror: "Evidence Summaryから読み取れる『繰り返し・強み・避けるべき罠』を5〜8項目で列挙し、踏襲する軸を3つに圧縮して宣言する。箇条書き。",
  chaos_leap: "踏襲する軸を壊さずに、矛盾を注入した10X飛躍案を5本出す。各案に『何が変われば可能か』を1行添える。うち2本は異世界レベルで飛ぶ（役割/環境/時間の使い方を反転）。箇条書き。",
  action_seeds: "飛躍案から『今日できる1分』を3つ、『今週できる30分』を3つ提案。それぞれに成功条件を1行で書く。箇条書き。"
}
\`\`\`

## 出力言語

title, narrative, micro_steps, roadmap, asset_steps, risks, guardrails, evidence, rubric_reason, leap_sections の各値は全て日本語で出力してください。
キー名のみ英語。

## JSON Output Schema
最終出力は以下のJSON形式のみを Markdown の \`\`\`json コードブロックで囲んで出力してください。
件数ルールは厳守。文字列の埋め草（"..."）は禁止。

\`\`\`json
{
  "meta": {
    "version": "SEED_v5",
    "generated_at": "YYYY-MM-DD",
    "time_horizon_days": 180,
    "notes": "仮説。未来は選択肢を増やすための地図。",
    "trajectory_shift": "前回比での軌道変化を1-2文で（※変化がない場合は「特になし」と明記）"
  },
  "worldline_baseline": {
    "title": "タイトル",
    "narrative": "説明（簡潔）",
    "roadmap": [
      { "horizon": "1w", "outcome": "", "measurement": "", "focus": "" },
      { "horizon": "1m", "outcome": "", "measurement": "", "focus": "" },
      { "horizon": "3m", "outcome": "", "measurement": "", "focus": "" },
      { "horizon": "6m", "outcome": "", "measurement": "", "focus": "" }
    ],
    "micro_steps": [
      { "action": "", "reason": "" },
      { "action": "", "reason": "" },
      { "action": "", "reason": "" },
      { "action": "", "reason": "" },
      { "action": "", "reason": "" }
    ],
    "asset_steps": [
      { "asset": "", "type": "template|script|checklist|doc", "why": "" },
      { "asset": "", "type": "template|script|checklist|doc", "why": "" },
      { "asset": "", "type": "template|script|checklist|doc", "why": "" }
    ],
    "risks": ["詰まりポイント", "詰まりポイント"],
    "guardrails": ["復帰手順", "復帰手順"],
    "evidence": [
      { "log_excerpt": "YYYY-MM-DD [カテゴリ]: ...", "why": "" },
      { "log_excerpt": "YYYY-MM-DD [カテゴリ]: ...", "why": "" },
      { "log_excerpt": "YYYY-MM-DD [カテゴリ]: ...", "why": "" }
    ],
    "rubric_score": 0,
    "rubric_reason": "",
    "rubric_detail": {
      "consistency": 0,
      "causality": 0,
      "actionability": 0,
      "asset_leverage": 0,
      "guardrail_sanity": 0,
      "evidence_grounding": 0
    }
  },
  "worldline_leap": {
    "title": "Leapタイトル",
    "narrative": "Leap説明",
    "roadmap": [],
    "micro_steps": [],
    "asset_steps": [],
    "risks": [],
    "guardrails": [],
    "evidence": [],
    "leap_sections": {
      "evidence_mirror": "（箇条書き: 繰り返し・強み・罠 + 踏襲軸3つ）",
      "chaos_leap": "（箇条書き: 10X飛躍案5本 + 各導線1行。うち2本は異世界級）",
      "action_seeds": "（箇条書き: 今日1分×3 + 今週30分×3 + 成功条件）"
    },
    "rubric_score": 0,
    "rubric_detail": {}
  },
  "worldline_guardrail": {
    "title": "Guardrailタイトル",
    "narrative": "Guardrail説明",
    "roadmap": [],
    "micro_steps": [],
    "asset_steps": [],
    "risks": [],
    "guardrails": [],
    "evidence": [],
    "rubric_score": 0,
    "rubric_detail": {}
  }
}
\`\`\`

## 重要：JSONの構造について
必ず \`worldline_baseline\`, \`worldline_leap\`, \`worldline_guardrail\` の3つのキーをトップレベルに持つオブジェクトとして出力してください。
配列（\`worldlines: [...]\`）形式は避けてください。
`.trim();

    try {
        await navigator.clipboard.writeText(prompt);
        showToast(`📋 SEED v5 Context (${days} days) copied! LLMに貼り付けて未来をシミュレート`, "ok");
    } catch (e) {
        console.error(e);
        showToast("コピー失敗（SSLが必要な場合があります）", "err");
    }
}

// ===== Simulation Import =====

function importSimulationResult(): void {
    const textarea = document.getElementById("bridgeInput") as HTMLTextAreaElement;
    if (!textarea || !textarea.value.trim()) {
        showToast("JSONを貼り付けてください。", "warn");
        return;
    }

    try {
        let raw = textarea.value.trim();
        // Markdownコードブロック除去
        raw = raw.replace(/```json\n?|\n?```/g, "").trim();

        // いきなりパースを試みる（余計な加工で壊さないため）
        let data: any;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            // パース失敗時のみ、{...} の抽出を試みる
            const start = raw.indexOf("{");
            const end = raw.lastIndexOf("}");
            if (start === -1 || end === -1) throw new Error("JSON not found");

            const cleanJson = raw.substring(start, end + 1);
            try {
                data = JSON.parse(cleanJson);
            } catch (inner) {
                // 文字列中の改行やタブが原因の場合があるため、簡易的な制御文字除去を試す
                // ただし、データ内の改行(\n)はJSONとして有効なので、\r や制御コードのみ対象にする必要あり
                // ここでは単純にエラーを投げる（nodeでパースできたならここまでは来ないはず）
                throw new Error("Invalid JSON format: " + (inner as Error).message);
            }
        }

        // 配列形式(worldlines)で来た場合の正規化
        if (Array.isArray(data.worldlines)) {
            console.log("Normalizing worldlines array to keys...");
            const map: Record<string, string> = { "Baseline": "worldline_baseline", "Leap": "worldline_leap", "Guardrail": "worldline_guardrail" };
            data.worldlines.forEach((w: any) => {
                const key = map[w.id] || map[w.label] || map[w.worldline]; // w.worldline を追加
                if (key) {
                    // Internal Field Normalization for different schemas
                    if (!w.title && w.label) w.title = w.label;
                    if (!w.narrative && w.core_assumption) w.narrative = w.core_assumption;

                    if (!w.micro_steps && w.next_14_days_experiments) {
                        w.micro_steps = w.next_14_days_experiments.map((e: any) => ({
                            action: e.title || e.experiment_id,
                            reason: (e.protocol || "") + (e.success_condition ? ` (Goal: ${e.success_condition})` : "")
                        }));
                    }

                    if (!w.risks && w.anti_patterns_to_watch) {
                        w.risks = w.anti_patterns_to_watch.map((ap: any) => `${ap.name}: ${ap.mechanism}`);
                    }

                    if (!w.evidence && w.evidence_anchor) {
                        w.evidence = w.evidence_anchor.map((ev: any) => ({
                            log_excerpt: `${ev.date} [${ev.category}] ${ev.text}`,
                            why: "Anchor"
                        }));
                    }

                    data[key] = w;
                }
            });
        }

        // v5 (3世界線) or v4 (2世界線) を判定
        const isV5 = data.worldline_baseline && data.worldline_leap && data.worldline_guardrail;
        const isV4 = data.persona_solid && data.persona_leap;

        if (!isV5 && !isV4) {
            // エラーメッセージを詳細化
            const keys = Object.keys(data).join(", ");
            throw new Error(`Invalid structure: worldline_baseline/leap/guardrail missing. (Found keys: ${keys})`);
        }

        // seedKeyを生成（未来固定用）
        const entries = getActiveEntries();
        const recent = entries.slice().sort((a, b) => b.ts - a.ts).slice(0, 30);
        const seedKey = generateSeedKey(recent);

        // 同一seedKeyのsimulationがあれば再利用（リセマラ禁止）
        const chk = document.getElementById("chkDisableLimit") as HTMLInputElement;
        const disableLimit = chk?.checked || false;
        if (!disableLimit) {
            const existingSim = findSimulationBySeedKey(seedKey);
            if (existingSim) {
                showToast("📌 今日は既にシミュレーション済み（未来固定）", "warn");
                renderFutureCards(existingSim.result, existingSim.id);
                const container = document.getElementById("futureCardsContainer");
                if (container) container.style.display = "grid";
                renderSimulationHistory();
                return;
            }
        }

        // 過去のSimulation履歴を作るためのデータを整形
        const simulation: Simulation = {
            id: uuid(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            promptVersion: isV5 ? "SEED_v5" : "SEED_v4",
            logWindowDays: 90,
            recentCount: recent.length,
            seedKey: seedKey,
            inputDigest: {
                range: recent.length > 0 ? { from: recent[recent.length - 1].date, to: recent[0].date } : {},
                topCategories: [] as any[],
                topKeywords: [] as any[]
            },
            result: data,
            commit: null,
            assetCommits: [],
            memoedStepIndices: [],
            deleted: false,
            rev: 1,
            deviceId: getDeviceId()
        };

        // dataCacheに追加
        dataCache.simulations = dataCache.simulations || [];
        dataCache.simulations.unshift(simulation);
        if (dataCache.simulations.length > MAX_SIMULATION_HISTORY) {
            dataCache.simulations = dataCache.simulations.slice(0, MAX_SIMULATION_HISTORY);
        }
        storageSaveData(dataCache);

        // Rubric score 警告チェック
        const worldlines = isV5
            ? [data.worldline_baseline, data.worldline_leap, data.worldline_guardrail]
            : [data.persona_solid, data.persona_leap];
        const lowScores = worldlines.filter((w: any) => w && w.rubric_score !== undefined && w.rubric_score < 90);
        if (lowScores.length > 0) {
            showToast(`⚠️ ${lowScores.length}件の世界線でrubric_score<90（品質警告）`, "warn");
        }

        renderFutureCards(data, simulation.id);
        const container = document.getElementById("futureCardsContainer");
        if (container) container.style.display = "grid";
        renderSimulationHistory();
        textarea.value = "";
        showToast("🔮 未来をシミュレート完了！", "ok");
    } catch (e: any) {
        console.error("Import Error Error:", e);
        showToast("Import Error: " + (e?.message || String(e)), "err");
    }
}

function renderFutureCards(result: SimulationResult, simId: string): void {
    const container = document.getElementById("futureCardsContainer");
    if (!container) return;
    container.innerHTML = "";

    // Story Mode toggle UI
    const canEnableStoryMode = hasRecentAssetCommit();
    const storyToggle = document.createElement("div");
    storyToggle.style.cssText = "grid-column: 1/-1; display:flex; justify-content:flex-end; gap:8px; align-items:center; margin-bottom:8px;";
    const toggleLabel = document.createElement("span");
    toggleLabel.style.cssText = "font-size:11px; color:#888;";
    toggleLabel.textContent = "📖 Story Mode";
    const toggleBtn = document.createElement("button");
    toggleBtn.style.cssText = `background:${storyModeEnabled ? '#d946ef' : '#333'}; color:${storyModeEnabled ? '#fff' : '#666'}; border:1px solid ${canEnableStoryMode ? '#d946ef' : '#555'}; padding:4px 10px; border-radius:4px; font-size:10px; cursor:${canEnableStoryMode ? 'pointer' : 'not-allowed'};`;
    toggleBtn.textContent = storyModeEnabled ? "ON" : "OFF";
    toggleBtn.disabled = !canEnableStoryMode;
    if (!canEnableStoryMode) toggleBtn.title = "直近7日でコミットが必要";
    toggleBtn.addEventListener("click", () => toggleStoryMode());
    storyToggle.appendChild(toggleLabel);
    storyToggle.appendChild(toggleBtn);
    container.appendChild(storyToggle);

    const isV5 = !!(result.worldline_baseline && result.worldline_leap && result.worldline_guardrail);
    const worldlines = isV5 ? [
        { key: "worldline_baseline", color: "#38bdf8", icon: "🌱", label: "Baseline（現状延長）" },
        { key: "worldline_leap", color: "#d946ef", icon: "🚀", label: "Leap（10X飛躍）" },
        { key: "worldline_guardrail", color: "#22c55e", icon: "🛡️", label: "Guardrail（帰還ルート）" }
    ] : [
        { key: "persona_solid", color: "#38bdf8", icon: "🌱", label: "Solid Future" },
        { key: "persona_leap", color: "#d946ef", icon: "🚀", label: "Leap Future" }
    ];

    worldlines.forEach(wl => {
        const item = (result as any)[wl.key] as Worldline | undefined;
        if (!item) return;

        const card = document.createElement("div");
        card.style.cssText = `background:rgba(0,0,0,0.3); border:1px solid ${wl.color}; border-radius:8px; padding:16px;`;

        // Micro steps
        const steps = item.micro_steps || (item as any).next_steps || [];
        const sim = (dataCache.simulations || []).find(s => s.id === simId);
        const memoedSteps = sim?.memoedStepIndices || [];

        const stepsHtml = steps.map((step: any, i: number) => {
            const isMemoed = memoedSteps.includes(`${wl.key}-${i}`);
            const btnHtml = isMemoed
                ? `<span style="flex-shrink:0; background:#22c55e; color:#fff; padding:4px 8px; border-radius:4px; font-size:10px;">✓ Added</span>`
                : `<button class="memo-btn" data-sim="${simId}" data-wl="${wl.key}" data-idx="${i}" style="flex-shrink:0; background:${wl.color}22; border:1px solid ${wl.color}; color:${wl.color}; padding:4px 8px; border-radius:4px; font-size:10px; cursor:pointer;">メモ</button>`;
            return `<div style="margin-bottom:10px; display:flex; gap:8px; align-items:flex-start;">
                <span style="color:${wl.color}; font-family:monospace; font-weight:bold; flex-shrink:0;">#${i + 1}</span>
                <div style="flex:1;">
                    <div style="font-size:13px; font-weight:bold; color:#fff;">${sanitize(step.action || step.toString())}</div>
                    <div style="font-size:11px; color:${wl.color}; opacity:0.7; margin-top:2px;">${sanitize(step.reason || "")}</div>
                </div>
                ${btnHtml}
            </div>`;
        }).join("");

        // Roadmap
        const roadmapHtml = item.roadmap ? `
            <div style="background:${wl.color}11; padding:10px; border-radius:6px; margin-bottom:12px; border:1px solid ${wl.color}22;">
                <div style="font-size:10px; color:${wl.color}; margin-bottom:6px; letter-spacing:1px;">📍 ROADMAP</div>
                ${item.roadmap.map(r => `<div style="font-size:11px; margin-bottom:4px; display:flex; gap:6px;">
                    <span style="color:${wl.color}; font-weight:bold; min-width:30px;">${sanitize(r.horizon)}</span>
                    <span style="color:#ccc;">${sanitize(r.outcome)}</span>
                </div>`).join("")}
            </div>` : "";

        // Asset steps
        const assetHtml = item.asset_steps ? `
            <div style="background:rgba(255,215,0,0.1); padding:10px; border-radius:6px; margin-top:12px; border:1px solid rgba(255,215,0,0.3);">
                <div style="font-size:10px; color:#fbbf24; margin-bottom:6px; letter-spacing:1px;">🏆 ASSET STEPS</div>
                ${item.asset_steps.map((a, idx) => {
            const isCommitted = sim?.assetCommits?.some(ac => ac.worldline === wl.key && ac.assetIndex === idx);
            return `<div style="font-size:11px; margin-bottom:6px;">
                        <div style="color:#fff; font-weight:bold;">${sanitize(a.asset)} <span style="color:#fbbf24; font-size:9px;">[${sanitize(a.type)}]</span></div>
                        <div style="color:#aaa; font-size:10px;">${sanitize(a.why)}</div>
                        <div style="display:flex; gap:6px; margin-top:4px;">
                            <button class="asset-prompt-btn" data-asset="${encodeURIComponent(JSON.stringify(a))}" style="background:#fbbf24; color:#000; border:none; padding:2px 6px; border-radius:3px; font-size:9px; cursor:pointer;">📝 資産生成プロンプトを表示</button>
                            ${isCommitted
                    ? `<span style="color:#22c55e; font-size:9px;">✓ 確定済み</span>`
                    : `<button class="commit-asset-btn" data-sim="${simId}" data-wl="${wl.key}" data-idx="${idx}" style="background:#22c55e; color:#fff; border:none; padding:2px 6px; border-radius:3px; font-size:9px; cursor:pointer;">📌 資産として確定</button>`}
                        </div>
                    </div>`;
        }).join("")
            }
</div>` : "";

        // Risks & Guardrails
        const risksHtml = item.risks ? `<div style="margin-top:10px; font-size:10px;"><span style="color:#f59e0b;">⚡ 詰まりポイント:</span> <span style="color:#aaa;">${item.risks.slice(0, 2).map(r => sanitize(r)).join(", ")}</span></div>` : "";
        const guardrailsHtml = item.guardrails ? `<div style="font-size:10px; margin-top:4px;"><span style="color:#22c55e;">🛡️ 復帰手順:</span> <span style="color:#aaa;">${item.guardrails.slice(0, 2).map(g => sanitize(g)).join(", ")}</span></div>` : "";

        // Evidence
        const evidenceHtml = item.evidence ? `
            <div style="background:rgba(100,100,100,0.2); padding:8px; border-radius:6px; margin-top:10px;">
                <div style="font-size:10px; color:#9ca3af; margin-bottom:4px;">📋 Evidence</div>
                ${item.evidence.slice(0, 2).map(e => `<div style="font-size:10px; color:#6b7280; margin-bottom:4px; font-style:italic;">"${sanitize(e.log_excerpt?.slice(0, 50) || "")}..."</div>`).join("")}
            </div>` : "";

        // Rubric detail
        const scoreColor = (item.rubric_score || 0) >= 90 ? wl.color : "#ef4444";
        const rd = item.rubric_detail || {} as any;
        const hasDetail = rd.consistency !== undefined;
        const detailHtml = hasDetail ? `
            <div style="margin-top:6px; font-size:9px; color:#9ca3af; display:flex; flex-wrap:wrap; gap:3px;">
                <span style="color:${rd.consistency >= 16 ? '#22c55e' : '#ef4444'}">一貫${rd.consistency}</span>
                <span style="color:${rd.causality >= 16 ? '#22c55e' : '#ef4444'}">因果${rd.causality}</span>
                <span style="color:${rd.actionability >= 12 ? '#22c55e' : '#ef4444'}">実行${rd.actionability}</span>
                <span style="color:${rd.asset_leverage >= 12 ? '#22c55e' : '#ef4444'}">資産${rd.asset_leverage}</span>
                <span style="color:${rd.guardrail_sanity >= 12 ? '#22c55e' : '#ef4444'}">安全${rd.guardrail_sanity}</span>
                <span style="color:${rd.evidence_grounding >= 12 ? '#22c55e' : '#ef4444'}">根拠${rd.evidence_grounding}</span>
            </div>` : "";

        // Leap三段セクション（P1-05: Leap専用、leap_sectionsがある場合のみ表示）
        let leapSectionsHtml = "";
        if (wl.key === "worldline_leap" && item.leap_sections) {
            const ls = item.leap_sections;
            const sectionData = [
                { title: "🪞 Evidence Mirror", content: ls.evidence_mirror, color: "#38bdf8" },
                { title: "🌀 Chaos Leap", content: ls.chaos_leap, color: "#d946ef" },
                { title: "🌱 Action Seeds", content: ls.action_seeds, color: "#22c55e" },
            ];
            leapSectionsHtml = sectionData
                .filter(s => s.content)
                .map(s => `
                    <details class="leap-section" open>
                        <summary style="font-size:12px; font-weight:bold; color:${s.color}; cursor:pointer; padding:6px 0; list-style:none; display:flex; align-items:center; gap:6px;">
                            <span style="font-size:8px;">▶</span> ${s.title}
                        </summary>
                        <div style="font-size:12px; color:#ccc; line-height:1.6; padding:4px 0 10px 8px; white-space:pre-wrap;">${sanitize(s.content || "")}</div>
                    </details>
                `).join("");
            if (leapSectionsHtml) {
                leapSectionsHtml = `
                    <div style="background:rgba(217,70,239,0.08); border:1px solid rgba(217,70,239,0.25); border-radius:8px; padding:12px; margin-bottom:12px;">
                        <div style="font-size:10px; color:#d946ef; margin-bottom:6px; letter-spacing:1px;">🎯 LEAP三段構造</div>
                        ${leapSectionsHtml}
                    </div>`;
            }
        }

        card.className = "future-lab-card";
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <span style="color:${wl.color}; font-weight:bold; font-size:12px;">${wl.icon} ${wl.label}</span>
                <div style="text-align:right;">
                    <span style="background:${scoreColor}; color:#fff; font-size:10px; padding:2px 6px; border-radius:4px;">Score: ${item.rubric_score}${(item.rubric_score || 0) < 90 ? ' ⚠️' : ''}</span>
                    ${detailHtml}
                </div>
            </div>
            <h4 style="margin:0 0 8px; font-size:16px; color:#fff;">${sanitize(item.title)}</h4>
            ${storyModeEnabled
                ? `<p style="font-size:12px; color:#ccc; line-height:1.5; margin-bottom:12px; font-style:italic;">"${sanitize(item.narrative)}"</p>`
                : `<p style="font-size:11px; color:#666; margin-bottom:8px;">📐 設計図モード（Story ModeをONで物語表示）</p>`}
            ${leapSectionsHtml}
            ${roadmapHtml}
            <div style="background:${wl.color}11; padding:12px; border-radius:6px; border:1px solid ${wl.color}33; margin-bottom:12px;">
                <div style="font-size:10px; color:${wl.color}; margin-bottom:8px; letter-spacing:1px;">
                    ${wl.key === "worldline_guardrail" ? "🛡️ 15分で復帰の足場を作る" : "🚀 MICRO STEPS (15分以内)"}
                </div>
                ${stepsHtml}
            </div>
            <details style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                <summary style="font-size:11px; color:#aaa; cursor:pointer; list-style:none; display:flex; align-items:center; gap:4px;">
                    <span style="font-size:10px;">▶</span> 詳細を表示 (Assets, Risks, Evidence)
                </summary>
                <div style="padding-top:8px;">
                    ${assetHtml}
                    ${risksHtml}
                    ${guardrailsHtml}
                    ${evidenceHtml}
                </div>
            </details>`;
        container.appendChild(card);
    });

    // Bind event listeners (no inline onclick)
    container.querySelectorAll(".memo-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const sId = btn.getAttribute("data-sim")!;
            const wlKey = btn.getAttribute("data-wl")!;
            const idx = parseInt(btn.getAttribute("data-idx")!, 10);
            memoMicroStep(sId, wlKey, idx, "");
        });
    });
    container.querySelectorAll(".commit-asset-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            commitAsset(btn.getAttribute("data-sim")!, btn.getAttribute("data-wl")!, parseInt(btn.getAttribute("data-idx")!, 10));
        });
    });
    container.querySelectorAll(".asset-prompt-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            showAssetPrompt(btn.getAttribute("data-asset")!);
        });
    });
}

function memoMicroStep(simId: string, worldlineKey: string, stepIndex: number, _action: string): void {
    const sim = (dataCache.simulations || []).find(s => s.id === simId);
    if (!sim) { showToast("Simulation not found", "err"); return; }
    const worldline = (sim.result as any)[worldlineKey];
    if (!worldline) { showToast("Worldline not found", "err"); return; }
    const steps = worldline.micro_steps || worldline.next_steps || [];
    const step = steps[stepIndex];
    if (!step) { showToast("Step not found", "err"); return; }

    sim.memoedStepIndices = sim.memoedStepIndices || [];
    const memoKey = `${worldlineKey}-${stepIndex}`;
    if (sim.memoedStepIndices.includes(memoKey)) { showToast("Already memoed", "ok"); return; }

    const worldlineLabel = worldlineKey.replace("worldline_", "").replace("persona_", "");
    const memoText = `${step.action} 【Future:${worldlineLabel}】`;
    const newMemo = createMemo(memoText);
    if (!dataCache.memos) dataCache.memos = [];
    dataCache.memos.push(newMemo);
    nextMemos.push(newMemo);
    saveNextMemosToStorage();

    sim.memoedStepIndices.push(memoKey);
    sim.updatedAt = Date.now();
    storageSaveData(dataCache);
    showToast("メモに追加しました", "ok");
    renderFutureCards(sim.result, sim.id);
    renderNextMemos();
}

// ===== Simulation History (Full) =====

function renderSimulationHistory(): void {
    const containerId = "simulationHistory";
    let container = document.getElementById(containerId);
    if (!container) {
        const futureContainer = document.getElementById("futureCardsContainer");
        if (!futureContainer || !futureContainer.parentNode) return;
        container = document.createElement("div");
        container.id = containerId;
        container.style.cssText = "margin-top:24px; padding:16px; background:rgba(0,0,0,0.2); border-radius:8px;";
        futureContainer.parentNode.insertBefore(container, futureContainer.nextSibling);
    }

    const sims = (dataCache.simulations || []).filter(s => !s.deleted);
    if (sims.length === 0) {
        container.innerHTML = `<div style="font-size:12px; color:#9ca3af;">📚 シミュレーション履歴はまだありません</div>`;
        return;
    }

    const itemsHtml = sims.slice(0, 10).map(sim => {
        const date = new Date(sim.createdAt).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        const isV5 = !!(sim.result?.worldline_baseline);
        const titles = isV5
            ? [sim.result.worldline_baseline?.title, sim.result.worldline_leap?.title, sim.result.worldline_guardrail?.title].filter(Boolean)
            : [sim.result?.persona_solid?.title, sim.result?.persona_leap?.title].filter(Boolean);
        const hasCommit = !!sim.commit;
        return `<div class="sim-history-item" data-sim-id="${sim.id}" style="cursor:pointer; padding:8px 12px; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.2); border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:10px; color:#9ca3af;">${date}</span>
                </div>
                <span style="font-size:11px; color:#fff; margin-left:8px;">${(titles[0] as string)?.slice(0, 30) || "Untitled"}...</span>
                ${hasCommit ? '<span style="color:#22c55e; font-size:10px; margin-left:6px;">✓ committed</span>' : ''}
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:10px; color:#38bdf8;">${sim.promptVersion}</span>
                <button class="delete-sim-btn" data-sim-id="${sim.id}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:14px; opacity:0.7;" title="この履歴を削除">🗑️</button>
            </div>
        </div>`;
    }).join("");

    container.innerHTML = `
        <div style="font-size:12px; color:#38bdf8; margin-bottom:12px; font-weight:bold;">📚 SIMULATION HISTORY (直近${Math.min(sims.length, 10)}件)</div>
        <div style="display:flex; flex-direction:column; gap:8px;">${itemsHtml}</div>
        ${sims.length >= 2 ? `<div id="butterflyDiff" style="margin-top:16px;"></div>` : ""}
    `;

    // Bind load events
    container.querySelectorAll(".sim-history-item").forEach(el => {
        el.addEventListener("click", (e) => {
            if ((e.target as HTMLElement).closest(".delete-sim-btn")) return;
            const sId = el.getAttribute("data-sim-id")!;
            loadSimulation(sId);
        });
    });
    // Bind delete events
    container.querySelectorAll(".delete-sim-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteSimulation(btn.getAttribute("data-sim-id")!);
        });
    });

    // Butterfly Diff
    if (sims.length >= 2) renderButterflyDiff(sims[0], sims[1]);
    // Asset Shelf
    renderAssetShelf();
}

// ===== Butterfly Diff =====

function renderButterflyDiff(latest: any, previous: any): void {
    const container = document.getElementById("butterflyDiff");
    if (!container) return;

    const daysDiff = Math.round((latest.createdAt - previous.createdAt) / (1000 * 60 * 60 * 24));
    const dateLabel = daysDiff === 0 ? "Same Day" : `${daysDiff} days later`;
    const shiftText = latest.result?.meta?.trajectory_shift || "";

    const getScore = (sim: any, type: string) => sim?.result?.[`worldline_${type}`]?.rubric_score || 0;
    const compareScore = (type: string, label: string) => {
        const curr = getScore(latest, type);
        const prev = getScore(previous, type);
        const diff = curr - prev;
        const color = diff > 0 ? "#22c55e" : diff < 0 ? "#ef4444" : "#9ca3af";
        const sign = diff > 0 ? "+" : diff < 0 ? "" : "±";
        return `<div style="display:flex; flex-direction:column; align-items:center;">
            <span style="font-size:9px; color:#aaa;">${label}</span>
            <span style="font-size:12px; font-weight:bold; color:${color};">${curr} <span style="font-size:9px;">(${sign}${diff})</span></span>
        </div>`;
    };

    const scoreDiffHtml = latest.result?.meta?.version?.includes("v5") ? `
        <div style="display:flex; justify-content:space-around; margin-bottom:12px; background:rgba(0,0,0,0.2); padding:8px; border-radius:6px;">
            ${compareScore("baseline", "Baseline")}${compareScore("leap", "Leap")}${compareScore("guardrail", "Guardrail")}
        </div>
    ` : "";

    function normalizeStep(raw: any): string {
        if (typeof raw === 'string') return raw.toLowerCase().trim();
        return (raw.action || raw.title || '').toLowerCase().trim();
    }

    function getStepsList(sim: any): string[] {
        const r = sim.result;
        if (!r) return [];
        const wls = r.worldline_baseline
            ? [r.worldline_baseline, r.worldline_leap, r.worldline_guardrail]
            : [r.persona_solid, r.persona_leap];
        return wls.flatMap((w: any) => (w?.micro_steps || w?.next_steps || []).map((s: any) => normalizeStep(s))).filter((s: string) => s);
    }

    const latestList = getStepsList(latest);
    const previousList = getStepsList(previous);
    const latestSteps = new Set(latestList);
    const previousSteps = new Set(previousList);
    const added = [...latestSteps].filter(s => !previousSteps.has(s));
    const removed = [...previousSteps].filter(s => !latestSteps.has(s));
    const prevIndexMap = new Map(previousList.map((s, i) => [s, i]));
    const moved = latestList.filter(s => previousSteps.has(s)).map(s => ({ step: s, latestIdx: latestList.indexOf(s), prevIdx: prevIndexMap.get(s)! })).filter(m => Math.abs(m.latestIdx - m.prevIdx) >= 1).slice(0, 3);
    const totalSteps = Math.max(latestSteps.size + previousSteps.size, 1);
    const changeScore = Math.round((added.length + removed.length) / totalSteps * 100);

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-size:12px; color:#d946ef; font-weight:bold;">🦋 BUTTERFLY DIFF</div>
            <div style="font-size:10px; color:#666;">vs Previous (${dateLabel})</div>
        </div>
        ${shiftText ? `<div style="font-size:11px; color:#e2e8f0; background:rgba(217,70,239,0.1); border-left:3px solid #d946ef; padding:8px; margin-bottom:12px; line-height:1.4;">
            <div style="font-size:9px; color:#d946ef; margin-bottom:2px; font-weight:bold;">TRAJECTORY SHIFT</div>${shiftText}</div>` : ""}
        ${scoreDiffHtml}
        <div style="font-size:11px; color:#9ca3af; margin-bottom:8px;">
            Step Change: <span style="color:${changeScore > 30 ? '#f59e0b' : '#22c55e'}; font-weight:bold;">${changeScore}%</span>
        </div>
        ${added.length > 0 ? `<div style="font-size:10px; margin-bottom:6px;"><span style="color:#22c55e;">+ 追加されたステップ:</span><div style="color:#aaa; margin-left:12px;">${added.slice(0, 3).map(s => `• ${s?.slice(0, 40)}...`).join("<br>")}</div></div>` : ""}
        ${removed.length > 0 ? `<div style="font-size:10px; margin-bottom:6px;"><span style="color:#ef4444;">- 削除されたステップ:</span><div style="color:#aaa; margin-left:12px;">${removed.slice(0, 3).map(s => `• ${s?.slice(0, 40)}...`).join("<br>")}</div></div>` : ""}
        ${moved.length > 0 ? `<div style="font-size:10px; margin-bottom:6px;"><span style="color:#f59e0b;">↕️ 順位変動:</span><div style="color:#aaa; margin-left:12px;">${moved.map(m => `• ${m.step?.slice(0, 30)}... (${m.prevIdx + 1}→${m.latestIdx + 1})`).join("<br>")}</div></div>` : ""}
        ${added.length === 0 && removed.length === 0 && moved.length === 0 ? `<div style="font-size:10px; color:#6b7280;">ステップに大きな変化はありません</div>` : ""}
    `;
}

// ===== Asset Prompt Modal =====

function showAssetPrompt(encodedAsset: string): void {
    try {
        const asset = JSON.parse(decodeURIComponent(encodedAsset));
        const entries = getActiveEntries();
        const categoryCount: Record<string, number> = {};
        entries.slice(0, 30).forEach(e => {
            const cat = e.category || "その他";
            categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        });
        const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];

        const prompt = `# 資産生成リクエスト\n\n## 目的\n${asset.asset}\n\n## 出力形式\n${asset.type === "template" ? "Markdownテンプレート" : asset.type === "script" ? "実行可能なスクリプト" : asset.type === "checklist" ? "チェックリスト形式" : "ドキュメント（構造化）"}\n\n## 制約\n- 短く、再利用できる、現場で使える\n- 過度に複雑にしない\n- すぐに使い始められる形で\n\n## ユーザーの傾向\n最近のログでは「${topCategory ? topCategory[0] : "その他"}」カテゴリが多い。\n理由: ${asset.why}\n\n必要な成果物のみを出力してください。`;

        const existing = document.getElementById("assetPromptModal");
        if (existing) existing.remove();

        const modal = document.createElement("div");
        modal.id = "assetPromptModal";
        modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;";
        modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });

        const inner = document.createElement("div");
        inner.style.cssText = "background:#1e1e2e; border:1px solid rgba(255,215,0,0.3); border-radius:12px; padding:20px; max-width:560px; width:100%; max-height:80vh; overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.5);";
        inner.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <div style="font-size:14px; color:#fbbf24; font-weight:bold;">📝 資産生成プロンプト</div>
                <button class="close-modal-btn" style="background:none; border:none; color:#9ca3af; font-size:18px; cursor:pointer; padding:4px;">✕</button>
            </div>
            <div style="font-size:11px; color:#fbbf24; margin-bottom:8px;">🏆 ${asset.asset} <span style="color:#9ca3af;">[${asset.type}]</span></div>
            <pre id="assetPromptText" style="background:rgba(0,0,0,0.4); color:#e2e8f0; padding:16px; border-radius:8px; font-size:12px; line-height:1.6; white-space:pre-wrap; word-wrap:break-word; border:1px solid rgba(255,255,255,0.1); margin:0;">${prompt}</pre>
            <div style="display:flex; gap:8px; margin-top:16px; justify-content:flex-end;">
                <button class="copy-prompt-btn" style="background:#fbbf24; color:#000; border:none; padding:6px 16px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:bold;">📋 コピー</button>
                <button class="close-modal-btn" style="background:rgba(255,255,255,0.1); color:#ccc; border:1px solid rgba(255,255,255,0.2); padding:6px 16px; border-radius:6px; font-size:11px; cursor:pointer;">閉じる</button>
            </div>`;
        modal.appendChild(inner);
        document.body.appendChild(modal);

        inner.querySelectorAll(".close-modal-btn").forEach(b => b.addEventListener("click", () => modal.remove()));
        inner.querySelector(".copy-prompt-btn")?.addEventListener("click", () => {
            navigator.clipboard.writeText(document.getElementById("assetPromptText")?.textContent || "").then(() => showToast("📋 コピーしました", "ok"));
        });
    } catch (e) {
        console.error(e);
        showToast("プロンプト表示に失敗しました", "err");
    }
}

function showMyAssetPrompt(key: string): void {
    const sims = dataCache.simulations || [];
    let assetInfo: any = null;
    for (const sim of sims) {
        for (const ac of (sim.assetCommits || [])) {
            if ((ac.asset || "").toLowerCase().trim() === key) { assetInfo = ac; break; }
        }
        if (assetInfo) break;
    }
    if (!assetInfo) { showToast("資産が見つかりません", "err"); return; }

    const activeEntries = getActiveEntries();
    const categoryCount: Record<string, number> = {};
    activeEntries.slice(0, 30).forEach(e => { const cat = e.category || "その他"; categoryCount[cat] = (categoryCount[cat] || 0) + 1; });
    const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];
    const defaultPrompt = `# 資産生成リクエスト\n\n## 目的\n${assetInfo.asset}\n\n## 出力形式\n${assetInfo.type === "template" ? "Markdownテンプレート" : assetInfo.type === "script" ? "実行可能なスクリプト" : assetInfo.type === "checklist" ? "チェックリスト形式" : "ドキュメント（構造化）"}\n\n## 制約\n- 短く、再利用できる、現場で使える\n- 過度に複雑にしない\n- すぐに使い始められる形で\n\n## ユーザーの傾向\n最近のログでは「${topCategory ? topCategory[0] : "その他"}」カテゴリが多い。\n理由: ${assetInfo.why || "（未設定）"}\n\n必要な成果物のみを出力してください。`;
    const promptText = assetInfo.customPrompt || defaultPrompt;

    const existing = document.getElementById("assetPromptModal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "assetPromptModal";
    modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;";
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });

    const dateStr = new Date(assetInfo.committedAt).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
    const inner = document.createElement("div");
    inner.style.cssText = "background:#1e1e2e; border:1px solid rgba(34,197,94,0.4); border-radius:12px; padding:20px; max-width:600px; width:100%; max-height:85vh; overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.5);";
    inner.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div style="font-size:14px; color:#22c55e; font-weight:bold;">📌 ${assetInfo.asset}</div>
            <button class="close-modal-btn" style="background:none; border:none; color:#9ca3af; font-size:18px; cursor:pointer; padding:4px;">✕</button>
        </div>
        <div style="font-size:10px; color:#9ca3af; margin-bottom:16px; display:flex; gap:12px;">
            <span>📂 ${assetInfo.type}</span><span>📅 ${dateStr}</span>
            ${assetInfo.customPrompt ? '<span style="color:#fbbf24;">✏️ カスタム済み</span>' : '<span>📝 デフォルト</span>'}
        </div>
        <div style="font-size:11px; color:#ccc; margin-bottom:6px;">プロンプト（編集可能）:</div>
        <textarea id="myAssetPromptText" style="width:100%; min-height:250px; background:rgba(0,0,0,0.4); color:#e2e8f0; padding:14px; border-radius:8px; font-size:12px; line-height:1.6; border:1px solid rgba(255,255,255,0.15); resize:vertical; font-family:inherit; box-sizing:border-box;">${promptText}</textarea>
        <div style="display:flex; gap:8px; margin-top:16px; justify-content:space-between; flex-wrap:wrap;">
            <div style="display:flex; gap:8px;">
                <button class="save-prompt-btn" style="background:#22c55e; color:#fff; border:none; padding:6px 16px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:bold;">💾 保存</button>
                <button class="copy-prompt-btn" style="background:#fbbf24; color:#000; border:none; padding:6px 16px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:bold;">📋 コピー</button>
            </div>
            <button class="close-modal-btn" style="background:rgba(255,255,255,0.1); color:#ccc; border:1px solid rgba(255,255,255,0.2); padding:6px 16px; border-radius:6px; font-size:11px; cursor:pointer;">閉じる</button>
        </div>`;
    modal.appendChild(inner);
    document.body.appendChild(modal);

    inner.querySelectorAll(".close-modal-btn").forEach(b => b.addEventListener("click", () => modal.remove()));
    inner.querySelector(".copy-prompt-btn")?.addEventListener("click", () => {
        const ta = document.getElementById("myAssetPromptText") as HTMLTextAreaElement;
        navigator.clipboard.writeText(ta?.value || "").then(() => showToast("📋 コピーしました", "ok"));
    });
    inner.querySelector(".save-prompt-btn")?.addEventListener("click", () => saveMyAssetPrompt(key));
}

function saveMyAssetPrompt(key: string): void {
    const textarea = document.getElementById("myAssetPromptText") as HTMLTextAreaElement;
    if (!textarea) return;
    const newPrompt = textarea.value.trim();
    if (!newPrompt) { showToast("プロンプトが空です", "warn"); return; }

    let updated = false;
    (dataCache.simulations || []).forEach(sim => {
        (sim.assetCommits || []).forEach(ac => {
            if ((ac.asset || "").toLowerCase().trim() === key) {
                ac.customPrompt = newPrompt;
                ac.updatedAt = Date.now();
                updated = true;
            }
        });
    });
    if (updated) { storageSaveData(dataCache); showToast("💾 プロンプトを保存しました", "ok"); }
    else { showToast("保存先が見つかりません", "err"); }
}

// ===== Asset Shelf =====

function getAllAssets(): { asset: string; type: string; why: string; firstSeenAt: number; count: number }[] {
    const sims = dataCache.simulations || [];
    const assetMap = new Map<string, { asset: string; type: string; why: string; firstSeenAt: number; count: number }>();
    sims.forEach(sim => {
        const r = sim.result;
        if (!r) return;
        const wls = r.worldline_baseline ? [r.worldline_baseline, r.worldline_leap, r.worldline_guardrail] : [r.persona_solid, r.persona_leap];
        wls.forEach(wl => {
            if (!wl?.asset_steps) return;
            wl.asset_steps.forEach(a => {
                const key = (a.asset || "").toLowerCase().trim();
                if (!key) return;
                if (assetMap.has(key)) { assetMap.get(key)!.count++; }
                else { assetMap.set(key, { asset: a.asset, type: a.type || "doc", why: a.why || "", firstSeenAt: sim.createdAt, count: 1 }); }
            });
        });
    });
    return Array.from(assetMap.values()).sort((a, b) => b.count - a.count);
}

function getCommittedAssets(): { mapKey: string; asset: string; type: string; why: string; customPrompt: string | null; committedAt: number; worldline: string; simulationId: string; commitCount: number }[] {
    const sims = dataCache.simulations || [];
    const commitMap = new Map<string, any>();
    sims.forEach(sim => {
        (sim.assetCommits || []).forEach(ac => {
            const key = (ac.asset || "").toLowerCase().trim();
            if (!key) return;
            if (commitMap.has(key)) {
                const existing = commitMap.get(key);
                if (ac.committedAt > existing.committedAt) { existing.committedAt = ac.committedAt; if (ac.why) existing.why = ac.why; }
                existing.commitCount++;
            } else {
                commitMap.set(key, { mapKey: key, asset: ac.asset, type: ac.type || "doc", why: ac.why || "", customPrompt: ac.customPrompt || null, committedAt: ac.committedAt, worldline: ac.worldline, simulationId: sim.id, commitCount: 1 });
            }
        });
    });
    return Array.from(commitMap.values()).sort((a: any, b: any) => b.committedAt - a.committedAt);
}

function renderAssetShelf(): void {
    const containerId = "assetShelf";
    let container = document.getElementById(containerId);
    if (!container) {
        const historyContainer = document.getElementById("simulationHistory");
        if (!historyContainer || !historyContainer.parentNode) return;
        container = document.createElement("div");
        container.id = containerId;
        container.style.cssText = "margin-top:24px; padding:16px; background:rgba(255,215,0,0.05); border:1px solid rgba(255,215,0,0.2); border-radius:8px;";
        historyContainer.parentNode.insertBefore(container, historyContainer.nextSibling);
    }

    const committedAssets = getCommittedAssets();
    const allAssets = getAllAssets();
    const typeIcons: Record<string, string> = { template: "📄", script: "⚙️", checklist: "✅", doc: "📋" };

    // MY ASSETS
    let myAssetsHtml: string;
    if (committedAssets.length === 0) {
        myAssetsHtml = `<div style="font-size:11px; color:#9ca3af; padding:12px; background:rgba(0,0,0,0.2); border-radius:6px;">
            まだ確定した資産はありません。<br>世界線カードの「📌 資産として確定」で資産を登録できます。</div>`;
    } else {
        const byType: Record<string, any[]> = {};
        committedAssets.forEach(a => { const t = a.type || "doc"; if (!byType[t]) byType[t] = []; byType[t].push(a); });
        myAssetsHtml = `<div style="font-size:10px; color:#9ca3af; margin-bottom:10px;">確定済み ${committedAssets.length} 件 ｜ 使えるときに使う資産ストック</div>
            ${Object.entries(byType).map(([type, items]) => `<div style="margin-bottom:10px;">
                <div style="font-size:11px; color:#22c55e; margin-bottom:6px;">${typeIcons[type] || "📋"} ${type.toUpperCase()} (${items.length})</div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                    ${items.map((a: any) => {
            const dateStr = new Date(a.committedAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
            return `<div class="my-asset-item" data-key="${a.mapKey}" style="background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.4); padding:6px 10px; border-radius:4px; font-size:10px; cursor:pointer; transition:all 0.15s;">
                            <div style="color:#fff; font-weight:bold;">${a.asset.slice(0, 40)}${a.asset.length > 40 ? '...' : ''}</div>
                            <div style="color:#22c55e; font-size:9px; margin-top:2px;">✓ ${dateStr}${a.commitCount > 1 ? ` ×${a.commitCount}回` : ''} · 📝 クリックでプロンプト</div>
                        </div>`;
        }).join("")}
                </div>
            </div>`).join("")}`;
    }

    // ASSET IDEAS
    let ideasHtml = "";
    if (allAssets.length > 0) {
        const byType: Record<string, any[]> = {};
        allAssets.forEach(a => { const t = a.type || "doc"; if (!byType[t]) byType[t] = []; byType[t].push(a); });
        ideasHtml = `<details style="margin-top:16px; border-top:1px solid rgba(255,215,0,0.15); padding-top:12px;">
            <summary style="font-size:11px; color:#fbbf24; cursor:pointer; list-style:none; display:flex; align-items:center; gap:4px;">
                <span style="font-size:10px;">▶</span> 💡 ASSET IDEAS（AIの資産案 ${allAssets.length}件）
            </summary>
            <div style="padding-top:10px;">
                <div style="font-size:10px; color:#9ca3af; margin-bottom:8px;">全シミュレーションの提案を集約 ｜ 複数回出現 = 重要度高</div>
                ${Object.entries(byType).map(([type, items]) => `<div style="margin-bottom:10px;">
                    <div style="font-size:11px; color:#fbbf24; margin-bottom:6px;">${typeIcons[type] || "📋"} ${type.toUpperCase()} (${items.length})</div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${items.map((a: any) => `<div style="background:rgba(251,191,36,0.1); border:1px solid rgba(251,191,36,0.3); padding:6px 10px; border-radius:4px; font-size:10px;">
                            <div style="color:#fff; font-weight:bold;">${a.asset.slice(0, 30)}${a.asset.length > 30 ? '...' : ''}</div>
                            ${a.count > 1 ? `<div style="color:#fbbf24; font-size:9px;">×${a.count}回出現</div>` : ''}
                        </div>`).join("")}
                    </div>
                </div>`).join("")}
            </div>
        </details>`;
    }

    container.innerHTML = `
        <div style="font-size:12px; color:#22c55e; margin-bottom:12px; font-weight:bold;">📌 MY ASSETS（確定済み資産）</div>
        ${myAssetsHtml}
        ${ideasHtml}
        <div style="margin-top:16px; padding:12px; background:rgba(100,100,100,0.1); border-radius:6px; border:1px dashed #555;">
            <div style="font-size:10px; color:#9ca3af; margin-bottom:6px;">📦 月1棚卸し推奨</div>
            <div style="font-size:9px; color:#6b7280; line-height:1.4;">
                資産が増えたら月1で棚卸し。<br>
                • <span style="color:#22c55e;">統合</span>: 重複・類似を1つに<br>
                • <span style="color:#ef4444;">削除</span>: 使わなくなったものを整理<br>
                • <span style="color:#fbbf24;">昇格</span>: 頻度高いものをテンプレ化
            </div>
        </div>`;

    // Bind MY ASSET click events
    container.querySelectorAll(".my-asset-item").forEach(el => {
        el.addEventListener("click", () => showMyAssetPrompt(el.getAttribute("data-key")!));
    });
}

// ===== Story Mode Init =====

function initStoryMode(): void {
    storyModeEnabled = localStorage.getItem("storyModeEnabled") === "1";
}

// ===== Bridge Events =====

function initBridgeEvents(): void {
    document.getElementById("btnBridgeExport30")?.addEventListener("click", () => copySimulationContext(30));
    document.getElementById("btnBridgeExport90")?.addEventListener("click", () => copySimulationContext(90));
    document.getElementById("btnBridgeImport")?.addEventListener("click", importSimulationResult);

    const chk = document.getElementById("chkDisableLimit") as HTMLInputElement;
    if (chk) {
        chk.checked = localStorage.getItem("ippo_disable_limit") === "true";
        chk.addEventListener("change", () => {
            localStorage.setItem("ippo_disable_limit", String(chk.checked));
        });
    }
}

