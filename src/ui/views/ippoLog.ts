// ===== Ippo Log View (一歩ログ) =====
// All rendering functions for the main dashboard tab

import type { Entry, DailyState } from '../../domain/schema';
import { uuid, formatDate, formatDateTimeForRecord, parseDateStr } from '../../utils/helpers';
import { inferCategory, normalizeCategory, CATEGORY_LIST, CATEGORY_KEYWORDS } from '../../domain/categories';
import { dataCache, entries, nextMemos, setEntries, setNextMemos, getActiveEntries } from '../../app/store';
import {
    loadEntriesFromCache, loadNextMemosFromCache,
    saveEntriesToStorage, saveNextMemosToStorage, deleteEntryById,
    getEntriesForDate, getUniqueDatesFromEntries, getEntriesInLastNDays,
    getRecordTime, computeMetrics, countCategories,
    parseIppoCsv, downloadCsv, buildMonthlySummaryRows, buildAllEntriesRows,
    downloadJson, importJsonFile,
    touchEntry, touchMemo, // Added helpers
} from '../../app/actions';
import { sanitize } from '../../utils/sanitize';
import { storageSaveData, odSaveCache, odEnqueueChange } from '../../services/storage/localStorage';


// ===== Charts =====
// Note: These are stubs for Cycle 1. Chart rendering uses global Chart object loaded via import.
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

let chartRadar: any = null;
let chartFlow: any = null;
let chartCrossTod: any = null;
let chartKeywords: any = null;

function getChartColors() {
    return {
        accent: '#38bdf8',
        accentSoft: 'rgba(56, 189, 248, 0.2)',
        mental: '#a78bfa',
        mentalSoft: 'rgba(167, 139, 250, 0.2)',
        grid: 'rgba(255, 255, 255, 0.08)',
        text: '#94a3b8',
    };
}

// ===== Render Functions =====

export function renderAll(): void {
    renderMetrics();
    renderCategoryBars();
    renderDateSelect();
    const dates = getUniqueDatesFromEntries();
    const select = document.getElementById("dateSelect") as HTMLSelectElement | null;
    if (!select) return;
    let targetDate = select.value;
    if (!targetDate && dates.length) {
        targetDate = dates[dates.length - 1];
        select.value = targetDate;
    }
    if (targetDate) renderDailyTable(targetDate);
    else renderDailyTable("-");
    renderCrossTodChart();
}

export function renderNextMemos(): void {
    const listEl = document.getElementById("nextMemoList");
    const emptyEl = document.getElementById("nextMemoEmpty");
    if (!listEl || !emptyEl) return;

    listEl.innerHTML = "";
    if (!nextMemos.length) {
        emptyEl.style.display = "";
        return;
    }
    emptyEl.style.display = "none";

    nextMemos.forEach(memo => {
        const li = document.createElement("li");
        li.className = "next-memo-item";
        const label = document.createElement("label");
        label.className = "next-memo-label";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "next-memo-check";
        const textWrap = document.createElement("div");
        const textSpan = document.createElement("span");
        textSpan.className = "next-memo-text";
        textSpan.textContent = memo.text;
        const meta = document.createElement("div");
        meta.className = "next-memo-meta";
        meta.textContent = memo.createdAt ? `追加: ${formatDateTimeForRecord(new Date(memo.createdAt))}` : "";
        textWrap.appendChild(textSpan);
        if (memo.createdAt) textWrap.appendChild(meta);
        label.appendChild(checkbox);
        label.appendChild(textWrap);
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "btn-ghost-small";
        delBtn.textContent = "削除";
        checkbox.addEventListener("change", () => {
            if (!checkbox.checked) return;
            const ok = window.confirm("このメモは『終わった』として削除して大丈夫？");
            if (!ok) { checkbox.checked = false; return; }
            touchMemo(memo);
            setNextMemos(nextMemos.filter(x => x.id !== memo.id));
            saveNextMemosToStorage(memo);
            renderNextMemos();
        });
        delBtn.addEventListener("click", () => {
            const ok = window.confirm("このメモを削除しますか？");
            if (!ok) return;
            touchMemo(memo);
            setNextMemos(nextMemos.filter(x => x.id !== memo.id));
            saveNextMemosToStorage(memo);
            renderNextMemos();
        });
        li.appendChild(label);
        li.appendChild(delBtn);
        listEl.appendChild(li);
    });
}

export function renderDateSelect(): void {
    const select = document.getElementById("dateSelect") as HTMLSelectElement | null;
    if (!select) return;
    const dates = getUniqueDatesFromEntries();
    select.innerHTML = "";
    if (!dates.length) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "-";
        select.appendChild(opt);
        return;
    }
    const sortedDesc = dates.slice().sort().reverse();
    sortedDesc.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        select.appendChild(opt);
    });
    const current = select.getAttribute("data-current");
    if (current && sortedDesc.includes(current)) select.value = current;
    else {
        select.value = sortedDesc[0];
        select.setAttribute("data-current", sortedDesc[0]);
    }
}

export function renderDiaryForDate(dateStr: string): void {
    const out = document.getElementById("diaryOutput") as HTMLTextAreaElement | null;
    const msg = document.getElementById("diaryMessage");
    if (!out || !msg) return;

    if (!getActiveEntries().length || !dateStr || dateStr === "-") {
        out.value = "";
        msg.textContent = "一歩がないので、この日の自動日記はまだ作れません。";
        return;
    }

    const list = getEntriesForDate(dateStr);
    if (!list.length) {
        out.value = "";
        msg.textContent = "一歩がないので、この日の自動日記はまだ作れません。";
        return;
    }

    const counts = countCategories(list);
    const total = list.length;
    const nonZeroCats = CATEGORY_LIST.filter(cat => counts[cat] > 0);
    const topCats = nonZeroCats
        .slice()
        .sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
        .slice(0, 3);

    const withTime = list.slice().map(e => {
        const rec = getRecordTime(e);
        let hour: number | null = null;
        const parts = rec.split(" ");
        if (parts.length >= 2) {
            const hh = parts[1].split(":")[0];
            const hNum = Number(hh);
            if (!Number.isNaN(hNum)) hour = hNum;
        }
        return { entry: e, hour };
    }).sort((a, b) => getRecordTime(a.entry).localeCompare(getRecordTime(b.entry)));

    const morning: Entry[] = [];
    const afternoon: Entry[] = [];
    const night: Entry[] = [];

    withTime.forEach(obj => {
        const h = obj.hour;
        if (h == null) afternoon.push(obj.entry);
        else if (h < 12) morning.push(obj.entry);
        else if (h < 18) afternoon.push(obj.entry);
        else night.push(obj.entry);
    });

    const lines: string[] = [];
    lines.push(`【${dateStr}のふりかえり】`);
    lines.push("");
    lines.push(`今日は「一歩」を${total}件。`);

    if (topCats.length === 1) {
        lines.push(`特に ${topCats[0]} まわりで動きが多かった一日。`);
    } else if (topCats.length === 2) {
        lines.push(`特に ${topCats[0]} と ${topCats[1]} あたりで動きが多かった一日。`);
    } else if (topCats.length >= 3) {
        lines.push(`特に ${topCats[0]}・${topCats[1]}・${topCats[2]} あたりに、じわじわと前進が積み上がった。`);
    }

    function addSlotParagraph(label: string, arr: Entry[]) {
        if (!arr.length) return;
        const picked = arr.slice(0, 2);
        const quoted = picked.map(e => `「${e.text}」`).join("、");
        lines.push("");
        lines.push(`${label}は、${quoted} といった一歩を踏んだ時間帯。`);
    }

    const anySlot = morning.length > 0 || afternoon.length > 0 || night.length > 0;
    if (anySlot) {
        addSlotParagraph("午前中", morning);
        addSlotParagraph("午後", afternoon);
        addSlotParagraph("夜は", night);
    } else {
        const picked = list.slice(0, 3);
        const quoted = picked.map(e => `「${e.text}」`).join("、");
        lines.push("");
        lines.push(`一日を通して、${quoted} といった一歩が積み上がった。`);
    }

    lines.push("");
    lines.push("【今日のメモ】");
    lines.push("・うまくいった／進んだと感じたこと：");
    lines.push("・ちょっと引っかかっていること：");
    lines.push("・明日もう一歩だけ続けるなら：");
    lines.push("");
    lines.push("【明日の自分へのひとこと】");
    lines.push("＊ここにひとことメモを書く（例：『今日の続きのここだけやる』『無理しすぎない』など）");

    out.value = lines.join("\n");
    msg.textContent = "時間帯とカテゴリをざっくりまとめたストーリーモードの日記ドラフト。中身は自由に追記・修正OK。";
}

export function renderDailyTable(dateStr: string): void {
    const tbody = document.getElementById("dailyTbody");
    const label = document.getElementById("selectedDateLabel");
    const countLabel = document.getElementById("dailyCountLabel");
    const scoreEl = document.getElementById("dailyScore");
    const wrap = document.getElementById("dailyTableWrap");
    const empty = document.getElementById("noDataDaily");
    if (!tbody || !label || !countLabel || !scoreEl || !wrap || !empty) return;

    if (!getActiveEntries().length || !dateStr || dateStr === "-") {
        wrap.style.display = "none";
        empty.style.display = "";
        label.textContent = "-";
        countLabel.textContent = "0件";
        scoreEl.textContent = "0.0";
        renderDiaryForDate("-");
        return;
    }

    const list = getEntriesForDate(dateStr);
    label.textContent = dateStr || "-";
    countLabel.textContent = list.length + "件";
    const score = Math.min(list.length * 0.2, 5);
    scoreEl.textContent = score.toFixed(1);

    tbody.innerHTML = "";
    list.slice()
        .sort((a, b) => getRecordTime(a).localeCompare(getRecordTime(b)))
        .forEach(e => {
            const tr = document.createElement("tr");

            const tdTime = document.createElement("td");
            const timePart = getRecordTime(e).split(" ")[1] || "";
            tdTime.textContent = timePart;
            tr.appendChild(tdTime);

            // TOD column
            const tdTod = document.createElement("td");
            tdTod.style.whiteSpace = "nowrap";
            const todWrap = document.createElement("div");
            todWrap.className = "tod-wrap";
            const tods = [
                { key: "morning", icon: "🌅", label: "朝" },
                { key: "afternoon", icon: "☀️", label: "昼" },
                { key: "night", icon: "🌙", label: "夜" }
            ];
            tods.forEach(t => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.textContent = t.icon;
                btn.title = t.label;
                btn.className = "btn-tod" + ((e.tod || []).includes(t.key) ? " active" : "");
                btn.addEventListener("click", () => {
                    e.tod = e.tod || [];
                    if (e.tod.includes(t.key)) {
                        e.tod = e.tod.filter(k => k !== t.key);
                    } else {
                        e.tod.push(t.key);
                    }
                    touchEntry(e);
                    saveEntriesToStorage();
                    btn.className = "btn-tod" + (e.tod.includes(t.key) ? " active" : "");
                });
                todWrap.appendChild(btn);
            });
            tdTod.appendChild(todWrap);

            const tdText = document.createElement("td");
            tdText.className = "entry-text";
            tdText.textContent = e.text;
            tr.appendChild(tdText);

            const tdCat = document.createElement("td");
            const selectCat = document.createElement("select");
            selectCat.className = "category-select";
            CATEGORY_LIST.forEach(catName => {
                const opt = document.createElement("option");
                opt.value = catName;
                opt.textContent = catName;
                selectCat.appendChild(opt);
            });
            const currentCat = normalizeCategory(e.category || inferCategory(e.text));
            selectCat.value = currentCat;
            selectCat.addEventListener("change", () => {
                e.category = selectCat.value;
                touchEntry(e);
                saveEntriesToStorage();
                renderMetrics();
                renderCategoryBars();
                const sel = document.getElementById("dateSelect") as HTMLSelectElement;
                renderDiaryForDate(sel.value);
            });
            tdCat.appendChild(selectCat);
            tr.appendChild(tdCat);
            tr.appendChild(tdTod); // TOD after category

            const tdAction = document.createElement("td");
            tdAction.style.whiteSpace = "nowrap";

            // Star button
            const starBtn = document.createElement("button");
            starBtn.type = "button";
            starBtn.textContent = e.starred ? "★" : "☆";
            starBtn.className = "btn-star" + (e.starred ? " starred" : "");
            starBtn.title = e.starred ? "偉大な一歩マークを解除" : "偉大な一歩としてマーク";
            starBtn.addEventListener("click", () => {
                const target = entries.find(en => en.id === e.id);
                if (target) {
                    target.starred = !target.starred;
                    touchEntry(target);
                    saveEntriesToStorage();
                    const sel = document.getElementById("dateSelect") as HTMLSelectElement;
                    renderDailyTable(sel.value);
                }
            });
            tdAction.appendChild(starBtn);

            // Delete button
            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.textContent = "削除";
            delBtn.className = "btn-danger";
            delBtn.addEventListener("click", () => {
                const ok = window.confirm("この一歩を削除しますか？");
                if (!ok) return;
                deleteEntryById(e.id);
                renderAll();
            });
            tdAction.appendChild(delBtn);
            tr.appendChild(tdAction);
            tbody.appendChild(tr);
        });

    wrap.style.display = "";
    empty.style.display = "none";

    // Mental UI update
    const dailyState = (dataCache.dailyStates || {})[dateStr] as DailyState | undefined;
    const currentMental = dailyState?.mental;
    document.querySelectorAll("#dailyMentalBtns .rating-btn").forEach(btn => {
        btn.classList.toggle("selected", parseInt((btn as HTMLButtonElement).dataset.value || "0") === currentMental);
    });

    renderDiaryForDate(dateStr);
}

export function renderMetrics(): void {
    const m = computeMetrics();
    const el = (id: string) => document.getElementById(id);
    if (el("metricTotal")) el("metricTotal")!.textContent = String(m.total);
    if (el("metricWeekly")) el("metricWeekly")!.textContent = String(m.weekly);
    if (el("metricMonthly")) el("metricMonthly")!.textContent = String(m.monthly);

    const subtitle = el("metricsSubtitle");
    const weeklyRange = el("metricWeeklyRange");

    if (!getActiveEntries().length || !m.weekStart || !m.weekEnd) {
        if (subtitle) subtitle.textContent = "データが読み込まれていません";
        if (weeklyRange) weeklyRange.textContent = "-";
        return;
    }
    const ws = formatDate(m.weekStart);
    const we = formatDate(m.weekEnd);
    if (subtitle) subtitle.textContent = `最新の日付を基準に集計（週：${ws}〜${we}）`;
    if (weeklyRange) weeklyRange.textContent = `${ws}〜${we}`;
}

export function renderCategoryBars(): void {
    const container = document.getElementById("categoryBars");
    const empty = document.getElementById("noCategory");
    if (!container || !empty) return;

    if (!getActiveEntries().length) {
        container.innerHTML = "";
        empty.style.display = "";
        return;
    }
    const lastList = getEntriesInLastNDays(7);
    const counts = countCategories(lastList);
    const max = Math.max(...Object.values(counts));

    container.innerHTML = "";
    CATEGORY_LIST.forEach(cat => {
        const c = counts[cat] || 0;
        const wrap = document.createElement("div");
        wrap.className = "category-bar";
        const header = document.createElement("div");
        header.className = "category-bar-header";
        const left = document.createElement("span");
        left.textContent = cat;
        const right = document.createElement("span");
        right.textContent = c + "件";
        header.appendChild(left);
        header.appendChild(right);
        const barOuter = document.createElement("div");
        barOuter.className = "category-bar-fill";
        const barInner = document.createElement("span");
        barInner.style.width = max > 0 ? (c / max * 100).toFixed(1) + "%" : "0%";
        barOuter.appendChild(barInner);
        wrap.appendChild(header);
        wrap.appendChild(barOuter);
        container.appendChild(wrap);
    });
    empty.style.display = "none";
}

// ===== Chart Rendering =====

export function renderRadarChart(): void {
    const ctx = (document.getElementById("chartRadar") as HTMLCanvasElement)?.getContext("2d");
    if (!ctx) return;
    const entries7 = getEntriesInLastNDays(7);
    const counts = countCategories(entries7);
    const labels = CATEGORY_LIST;
    const data = labels.map(l => counts[l] || 0);

    if (chartRadar) chartRadar.destroy();
    chartRadar = new Chart(ctx, {
        type: "radar",
        data: {
            labels,
            datasets: [{ label: "7日分布", data, fill: true, backgroundColor: "rgba(56,189,248,0.2)", borderColor: "#38bdf8" }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { ticks: { display: false }, grid: { color: "rgba(255,255,255,0.1)" } } } },
    });
}

export function renderFlowChart(): void {
    const ctx = (document.getElementById("chartFlow") as HTMLCanvasElement)?.getContext("2d");
    if (!ctx) return;

    const active = getActiveEntries();
    const dates = getUniqueDatesFromEntries();
    if (!dates.length) return;

    const last30 = dates.slice(-30);
    const countData = last30.map(d => active.filter(e => e.date === d).length);
    const mentalData = last30.map(d => {
        const ds = (dataCache.dailyStates || {})[d];
        return ds?.mental ?? null;
    });

    if (chartFlow) chartFlow.destroy();
    chartFlow = new Chart(ctx, {
        type: "line",
        data: {
            labels: last30,
            datasets: [
                { label: "日次アクション数", data: countData, borderColor: "#38bdf8", backgroundColor: "rgba(56,189,248,0.1)", fill: true, tension: 0.3, yAxisID: "y" },
                { label: "メンタルスコア", data: mentalData, borderColor: "#a78bfa", backgroundColor: "transparent", borderDash: [5, 5], tension: 0.3, yAxisID: "y1", spanGaps: true },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: "#9ca3af" } } },
            scales: {
                x: { ticks: { color: "#6b7280", maxRotation: 45 }, grid: { color: "rgba(255,255,255,0.05)" } },
                y: { ticks: { color: "#6b7280" }, grid: { color: "rgba(255,255,255,0.05)" }, position: "left" },
                y1: { ticks: { color: "#a78bfa" }, grid: { display: false }, position: "right", min: 1, max: 5 },
            },
        },
    });
}

export function renderCrossTodChart(): void {
    const ctx = (document.getElementById("chartCrossTod") as HTMLCanvasElement)?.getContext("2d");
    if (!ctx) return;
    const active = getActiveEntries();
    const colors = getChartColors();

    // カテゴリ×TOD集計（元コード準拠: カテゴリ軸 × 朝昼夜未設定 4スタック）
    const todCounts: Record<string, { morning: number; day: number; night: number; none: number }> = {};
    const labels = CATEGORY_LIST.slice();

    labels.forEach(cat => {
        todCounts[cat] = { morning: 0, day: 0, night: 0, none: 0 };
    });

    active.forEach(e => {
        const cat = normalizeCategory(e.category || "その他");
        if (!todCounts[cat]) {
            todCounts[cat] = { morning: 0, day: 0, night: 0, none: 0 };
            if (!labels.includes(cat)) labels.push(cat);
        }
        const tods = e.tod || [];
        if (tods.length === 0) {
            todCounts[cat].none++;
        } else {
            tods.forEach(t => {
                if (t === "morning") todCounts[cat].morning++;
                else if (t === "afternoon" || t === "day") todCounts[cat].day++;
                else if (t === "night") todCounts[cat].night++;
            });
        }
    });

    const dataMorning = labels.map(c => todCounts[c]?.morning || 0);
    const dataDay = labels.map(c => todCounts[c]?.day || 0);
    const dataNight = labels.map(c => todCounts[c]?.night || 0);
    const dataNone = labels.map(c => todCounts[c]?.none || 0);

    if (chartCrossTod) chartCrossTod.destroy();
    chartCrossTod = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [
                { label: "朝", data: dataMorning, backgroundColor: "#fcd34d", stack: "Stack 0" },
                { label: "昼", data: dataDay, backgroundColor: "#38bdf8", stack: "Stack 0" },
                { label: "夜", data: dataNight, backgroundColor: "#818cf8", stack: "Stack 0" },
                { label: "未設定", data: dataNone, backgroundColor: "rgba(255,255,255,0.05)", stack: "Stack 0" },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { color: colors.grid }, ticks: { color: colors.text } },
                y: { stacked: true, grid: { color: colors.grid }, ticks: { color: colors.text } },
            },
            plugins: {
                legend: { labels: { color: colors.text } },
                tooltip: { mode: "index" as const, intersect: false },
            },
        },
    });
}

export function renderKeywordChart(): void {
    const ctx = (document.getElementById("chartKeywords") as HTMLCanvasElement)?.getContext("2d");
    if (!ctx) return;
    const active = getActiveEntries();
    const colors = getChartColors();

    const wordCounts: Record<string, number> = {};

    // CATEGORY_KEYWORDS 辞書からキーワード一覧を取得（元コード準拠）
    const allKeywords: string[] = [];
    Object.values(CATEGORY_KEYWORDS).forEach(list => allKeywords.push(...list));
    const uniqueKeywords = [...new Set(allKeywords)];

    // 全エントリスキャン
    active.forEach(e => {
        const text = e.text || "";
        uniqueKeywords.forEach(word => {
            if (text.includes(word)) {
                wordCounts[word] = (wordCounts[word] || 0) + 1;
            }
        });
    });

    // Top 30を抽出してバブルチャート用に配置
    const sortedWords = Object.entries(wordCounts)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 30);
    if (!sortedWords.length) return;

    const bubbles = sortedWords.map(item => {
        const [word, count] = item;
        return {
            x: Math.random() * 100,
            y: Math.random() * 100,
            r: Math.min((count as number) * 2 + 5, 30),
            word,
            count,
        };
    });

    if (chartKeywords) chartKeywords.destroy();
    chartKeywords = new Chart(ctx, {
        type: "bubble",
        data: {
            datasets: [{
                label: "Keywords",
                data: bubbles,
                backgroundColor: (context: any) => {
                    const v = context.raw?.count || 0;
                    return v > 5 ? colors.accentSoft : colors.mentalSoft;
                },
                borderColor: colors.grid,
                borderWidth: 1,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { display: false },
                y: { display: false },
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context: any) => `${context.raw.word}: ${context.raw.count}`,
                    },
                },
            },
        },
    });
}

export function renderGreatStepsGallery(): void {
    const el = document.getElementById("greatStepsList");
    if (!el) return;
    el.innerHTML = "";

    const starred = getActiveEntries().filter(e => e.starred);
    if (starred.length === 0) {
        el.innerHTML = `<div style="padding:20px; text-align:center; color:#fbbf24; opacity:0.7;">まだ「偉大な一歩」はありません。<br>日報テーブルの☆を押して登録しよう！</div>`;
        return;
    }

    starred.sort((a, b) => b.ts - a.ts);
    starred.forEach(e => {
        const row = document.createElement("div");
        row.style.padding = "8px 12px";
        row.style.background = "rgba(0,0,0,0.2)";
        row.style.borderRadius = "8px";
        row.style.borderLeft = "3px solid #fbbf24";

        row.innerHTML = `
            <div style="font-size:12px; color:#9ca3af; margin-bottom:4px;">${sanitize(e.date)} ${e.tod.includes('morning') ? '🌅' : ''}${e.tod.includes('afternoon') ? '☀️' : ''}${e.tod.includes('night') ? '🌙' : ''}</div>
            <div style="font-weight:bold; color:#fff; margin-bottom:4px;">${sanitize(e.text)}</div>
            <div style="font-size:10px; color:#fbbf24; border:1px solid #fbbf24; display:inline-block; padding:2px 6px; border-radius:4px;">${sanitize(e.category)}</div>
        `;
        el.appendChild(row);
    });
}
