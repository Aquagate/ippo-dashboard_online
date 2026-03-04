// ===== Evidence Summary Generator =====
// 過去ログから構造化された要約を生成する。
// FutureLab のプロンプトに注入し、「踏襲」の安定供給を実現。

import type { Entry, DailyState } from '../schema';

/** evidence_summary の最大文字数 */
const MAX_CHARS = 2000;

export interface EvidenceSummaryInput {
    /** 対象エントリ（ts降順ソート済み推奨） */
    entries: Entry[];
    /** 日次メンタルデータ */
    dailyStates: Record<string, DailyState>;
    /** 集計対象日数 */
    windowDays: number;
}

export interface EvidenceSummary {
    /** 構造化テキスト（プロンプトにそのまま使える） */
    text: string;
    /** カテゴリ傾向（上位） */
    topCategories: { category: string; count: number }[];
    /** カテゴリ傾向（下位） */
    bottomCategories: { category: string; count: number }[];
    /** 時間帯分布 */
    todDistribution: Record<string, number>;
    /** 継続テーマ（3日以上連続で出現するカテゴリ） */
    sustainedThemes: string[];
    /** 途切れやすいテーマ（1日だけ出現後消えるカテゴリ） */
    fragileThemes: string[];
    /** 避けるべき罠（メンタル低下日の共通パターン） */
    traps: string[];
    /** 対象エントリ数 */
    entryCount: number;
    /** 期間 */
    dateRange: { from: string; to: string };
}

/**
 * 過去ログから evidence_summary を生成する。
 * ログが0件でも破綻しない。
 */
export function buildEvidenceSummary(input: EvidenceSummaryInput): EvidenceSummary {
    const { entries, dailyStates, windowDays } = input;

    // 期間フィルタ
    const border = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    let recent = entries.filter(e => !e.deleted && e.ts >= border);

    // 最低保証: 30件
    if (recent.length < 30) {
        recent = entries.filter(e => !e.deleted).slice(0, 30);
    }

    // ゼロ件ガード
    if (recent.length === 0) {
        return {
            text: "（データ不足: 過去ログがありません。evidence_summaryは生成できません。）",
            topCategories: [],
            bottomCategories: [],
            todDistribution: {},
            sustainedThemes: [],
            fragileThemes: [],
            traps: [],
            entryCount: 0,
            dateRange: { from: "", to: "" },
        };
    }

    // 期間
    const sorted = recent.slice().sort((a, b) => a.ts - b.ts);
    const dateRange = {
        from: sorted[0].date,
        to: sorted[sorted.length - 1].date,
    };

    // --- カテゴリ集計 ---
    const categoryCount: Record<string, number> = {};
    recent.forEach(e => {
        const cat = e.category || "その他";
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    const sortedCats = Object.entries(categoryCount)
        .sort((a, b) => b[1] - a[1]);
    const topCategories = sortedCats.slice(0, 5).map(([category, count]) => ({ category, count }));
    const bottomCategories = sortedCats.length > 5
        ? sortedCats.slice(-3).map(([category, count]) => ({ category, count }))
        : [];

    // --- 時間帯集計 ---
    const todDistribution: Record<string, number> = { morning: 0, afternoon: 0, night: 0 };
    let todTotal = 0;
    recent.forEach(e => {
        if (e.tod && Array.isArray(e.tod)) {
            e.tod.forEach(t => {
                const key = t === "day" ? "afternoon" : t;
                if (todDistribution[key] !== undefined) {
                    todDistribution[key]++;
                    todTotal++;
                }
            });
        }
    });

    // --- 継続性分析 ---
    // 日ごとにカテゴリを集計し、連続出現日数を算出
    const dateCategories: Record<string, Set<string>> = {};
    recent.forEach(e => {
        if (!e.date) return;
        if (!dateCategories[e.date]) dateCategories[e.date] = new Set();
        dateCategories[e.date].add(e.category || "その他");
    });
    const uniqueDates = Object.keys(dateCategories).sort();

    // カテゴリごとの最大連続出現日数
    const allCats = new Set(Object.values(categoryCount).length > 0 ? Object.keys(categoryCount) : []);
    const maxStreak: Record<string, number> = {};
    const singleDayCats = new Set<string>();

    allCats.forEach(cat => {
        let streak = 0;
        let maxS = 0;
        let totalDays = 0;
        uniqueDates.forEach(date => {
            if (dateCategories[date]?.has(cat)) {
                streak++;
                totalDays++;
                maxS = Math.max(maxS, streak);
            } else {
                streak = 0;
            }
        });
        maxStreak[cat] = maxS;
        if (totalDays === 1) singleDayCats.add(cat);
    });

    const sustainedThemes = Object.entries(maxStreak)
        .filter(([_, s]) => s >= 3)
        .sort((a, b) => b[1] - a[1])
        .map(([cat]) => cat);

    const fragileThemes = Array.from(singleDayCats)
        .filter(cat => !sustainedThemes.includes(cat));

    // --- 避けるべき罠（メンタル低下日のパターン） ---
    const traps: string[] = [];
    const lowMentalDates = Object.entries(dailyStates || {})
        .filter(([_, s]) => s.mental !== undefined && s.mental <= 2)
        .map(([date]) => date);

    if (lowMentalDates.length > 0) {
        // メンタル低下日のカテゴリ傾向
        const lowDayCats: Record<string, number> = {};
        const lowDayTods: Record<string, number> = {};
        recent.forEach(e => {
            if (lowMentalDates.includes(e.date)) {
                const cat = e.category || "その他";
                lowDayCats[cat] = (lowDayCats[cat] || 0) + 1;
                if (e.tod) e.tod.forEach(t => {
                    lowDayTods[t] = (lowDayTods[t] || 0) + 1;
                });
            }
        });

        const topLowCat = Object.entries(lowDayCats).sort((a, b) => b[1] - a[1])[0];
        if (topLowCat) {
            traps.push(`メンタル低下日に「${topLowCat[0]}」が集中（${topLowCat[1]}件）`);
        }

        const topLowTod = Object.entries(lowDayTods).sort((a, b) => b[1] - a[1])[0];
        if (topLowTod) {
            const todLabels: Record<string, string> = { morning: "朝", afternoon: "昼", day: "昼", night: "夜" };
            traps.push(`メンタル低下日は「${todLabels[topLowTod[0]] || topLowTod[0]}」の活動が多い`);
        }
    }

    // --- テキスト生成（構造化） ---
    const sections: string[] = [];

    // カテゴリ傾向
    sections.push("## カテゴリ傾向");
    sections.push("### 上位（注力領域）");
    topCategories.forEach(c => {
        sections.push(`- ${c.category}: ${c.count}件 (${Math.round(c.count / recent.length * 100)}%)`);
    });
    if (bottomCategories.length > 0) {
        sections.push("### 下位（手薄な領域）");
        bottomCategories.forEach(c => {
            sections.push(`- ${c.category}: ${c.count}件`);
        });
    }

    // 時間帯の偏り
    if (todTotal > 0) {
        sections.push("");
        sections.push("## 時間帯の偏り");
        const todLabels: Record<string, string> = { morning: "🌅 朝", afternoon: "☀️ 昼", night: "🌙 夜" };
        Object.entries(todDistribution)
            .filter(([_, v]) => v > 0)
            .forEach(([k, v]) => {
                sections.push(`- ${todLabels[k] || k}: ${Math.round(v / todTotal * 100)}% (${v}回)`);
            });
    }

    // 継続性
    sections.push("");
    sections.push("## 継続性");
    if (sustainedThemes.length > 0) {
        sections.push("### 継続テーマ（3日以上連続）");
        sustainedThemes.forEach(t => {
            sections.push(`- ${t}（最大${maxStreak[t]}日連続）`);
        });
    }
    if (fragileThemes.length > 0) {
        sections.push("### 途切れやすいテーマ（単発出現）");
        fragileThemes.slice(0, 5).forEach(t => {
            sections.push(`- ${t}`);
        });
    }

    // 避けるべき罠
    if (traps.length > 0) {
        sections.push("");
        sections.push("## 避けるべき罠");
        traps.forEach(t => {
            sections.push(`- ${t}`);
        });
    }

    // 文字数制限
    let text = sections.join("\n");
    if (text.length > MAX_CHARS) {
        text = text.slice(0, MAX_CHARS - 20) + "\n\n（以下省略）";
    }

    return {
        text,
        topCategories,
        bottomCategories,
        todDistribution,
        sustainedThemes,
        fragileThemes,
        traps,
        entryCount: recent.length,
        dateRange,
    };
}
