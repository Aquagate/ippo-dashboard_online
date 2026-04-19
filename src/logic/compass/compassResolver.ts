import type { Simulation, SimulationResult, Worldline, SimulationAssetStep } from '../../domain/schema';
import { formatDate, simpleHash, getDayOfWeek, formatDateWithContext } from '../../utils/helpers';
import { dataCache, getActiveEntries } from '../../app/store';
import { buildEvidenceSummary } from '../../domain/future/evidence';

// ===== Simulation Data Helpers =====

export function findSimulationBySeedKey(seedKey: string): Simulation | undefined {
    const sims = dataCache.simulations || [];
    return sims.find(s => s.seedKey === seedKey);
}

export function hasRecentAssetCommit(): boolean {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const sims = dataCache.simulations || [];
    return sims.some(sim => {
        const assetCommits = sim.assetCommits || [];
        return assetCommits.some(ac => ac.committedAt >= sevenDaysAgo);
    });
}

export function hasTodayCommit(): boolean {
    const today = formatDate(new Date());
    const sims = dataCache.simulations || [];
    return sims.some(sim => {
        if (!sim.commit) return false;
        const commitDate = formatDate(new Date(sim.commit.committedAt));
        return commitDate === today;
    });
}

export function getTodayCommit(): Simulation | undefined {
    const today = formatDate(new Date());
    const sims = dataCache.simulations || [];
    return sims.find(sim => {
        if (!sim.commit) return false;
        const commitDate = formatDate(new Date(sim.commit.committedAt));
        return commitDate === today;
    });
}

export function generateSeedKey(recentEntries: any[]): string {
    const today = formatDate(new Date());
    const ids = recentEntries.map(e => e.id).join('|');
    const hash = simpleHash(ids);
    return `${today}_${recentEntries.length}_${hash}`;
}

// ===== Prompt Generation (SEED v5) =====

export function buildPreviousSimSummary(sim: Simulation | null): string | null {
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

/**
 * SEED v5 シミュレーション用のプロンプトコンテキストを構築する
 */
export function buildSimulationPromptContext(days: number = 90): string {
    const sorted = getActiveEntries().slice().sort((a, b) => b.ts - a.ts);

    // Evidence Summary 生成
    const evidenceSummary = buildEvidenceSummary({
        entries: sorted,
        dailyStates: dataCache.dailyStates || {},
        windowDays: days,
    });

    const windowMs = days * 24 * 60 * 60 * 1000;
    const border = Date.now() - windowMs;
    let recent = sorted.filter(e => e.ts >= border);

    if (recent.length < 30) {
        recent = sorted.slice(0, Math.min(30, sorted.length));
    }

    // InputDigest 生成
    const categoryCount: Record<string, number> = {};
    const keywordCount: Record<string, number> = {};
    const todMap: Record<string, string> = { "morning": "🌅", "afternoon": "☀️", "day": "☀️", "night": "🌙" };
    const todStats: Record<string, number> = { "morning": 0, "afternoon": 0, "day": 0, "night": 0 };
    let todTotal = 0;

    recent.forEach(e => {
        const cat = e.category || "その他";
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        const words = (e.text || "").split(/[\s、。,]+/).filter(w => w.length >= 2 && w.length <= 10);
        words.forEach(w => { keywordCount[w] = (keywordCount[w] || 0) + 1; });

        if (e.tod && Array.isArray(e.tod)) {
            e.tod.forEach(t => {
                if (todStats[t] !== undefined) { todStats[t]++; todTotal++; }
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

    const dailyEnergyList: { date: string; morning: number | null; night: number | null }[] = [];
    const visitedDates = new Set<string>();
    recent.forEach(e => {
        if (!e.date || visitedDates.has(e.date)) return;
        visitedDates.add(e.date);
        const state = (dataCache.dailyStates || {})[e.date];
        if (state && (state.morningEnergy != null || state.nightEnergy != null)) {
            dailyEnergyList.push({ date: e.date, morning: state.morningEnergy ?? null, night: state.nightEnergy ?? null });
        }
    });
    dailyEnergyList.sort((a, b) => a.date.localeCompare(b.date));

    const dailyEnergyContext = dailyEnergyList.length > 0
        ? dailyEnergyList.map(d => `- ${d.date}: 朝 ${d.morning ?? '-'}, 夜 ${d.night ?? '-'}`).join("\n")
        : "No daily energy records available.";

    const userLogs = recent.map(e => {
        const dateWithCtx = formatDateWithContext(e.date);
        const tods = (e.tod || []).map(k => {
            const icon = todMap[k] || "";
            return icon ? `${icon}(${k})` : "";
        }).join(" ");
        const todStr = tods ? ` ${tods}` : "";
        return `${dateWithCtx}${todStr} [${e.category}]: ${e.text}`;
    }).join("\n");

    const sims = (dataCache.simulations || []).filter(s => !s.deleted);
    const previousSim = sims.length > 0 ? sims[0] : null;
    const previousSummary = previousSim ? buildPreviousSimSummary(previousSim) : null;

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

    // プロンプト本文の組み立て (SEED v5)
    return `
# SEED v5 Simulation Request (v2.6.0 — Leap Enhanced)

あなたは「未来シミュレーションエンジン」です。
ユーザーの過去ログ（観測）と **事前生成されたEvidence Summary** にもとづき、3つの世界線（Baseline / Leap / Guardrail）を提示してください。
**「活動時間帯（Time of Day）」と「行動内容」の相関**にも注目し、生活リズムの観点からも分析を行ってください。

## 大前提（守るルール）
- 曜日の考慮：曜日のリズム（週明け、週末、祝日前後）に基づいた現実的な一歩を提案すること。
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

## Simulation Metadata
シミュレーション基準日: ${formatDate(new Date())} (${getDayOfWeek(new Date())})
ログ期間: ${dateRange.from} 〜 ${dateRange.to}
ログ件数: ${recent.length}件

## Context (User Logs & Optional States)

Top Categories:
${topCategories.map(c => `- ${c.category}: ${c.count}件`).join("\n")}

Top Keywords:
${topKeywords.map(k => `- ${k.keyword}: ${k.count}回`).join("\n")}

Daily Energy (optional, 1=Low, 10=High, 朝/夜ごと、未入力は不明として扱う):
${dailyEnergyContext}

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

## Self-Rubric Scoring（必須プロセス・厳守）
(省略... 90点以上のスコアを要求する内容)

## JSON Output Schema
最終出力は JSON 形式のみを Markdown の \`\`\`json コードブロックで囲んで出力してください。
...
`.trim();
}

// ===== Simulation Import & Normalization =====

export function normalizeSimulationResult(rawText: string): any {
    let raw = rawText.trim();
    // Markdownコードブロック除去
    raw = raw.replace(/```json\n?|\n?```/g, "").trim();

    // パース
    let data: any;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start === -1 || end === -1) throw new Error("JSON not found");
        const cleanJson = raw.substring(start, end + 1);
        data = JSON.parse(cleanJson);
    }

    // 配列形式(worldlines)で来た場合の正規化
    if (Array.isArray(data.worldlines)) {
        const map: Record<string, string> = { "Baseline": "worldline_baseline", "Leap": "worldline_leap", "Guardrail": "worldline_guardrail" };
        data.worldlines.forEach((w: any) => {
            const key = map[w.id] || map[w.label] || map[w.worldline];
            if (key) {
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
        const keys = Object.keys(data).join(", ");
        throw new Error(`Invalid structure: worldline_baseline/leap/guardrail missing. (Found keys: ${keys})`);
    }

    return data;
}

// ===== Asset Aggregation =====

export function getAllAssets() {
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

export function getCommittedAssets() {
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
