// ===== Application Actions =====
// Orchestrates data flow between store, storage, and UI

import type { Entry, Memo, DataCache } from '../domain/schema';
import { uuid, formatDate, formatDateTimeForRecord, parseDateStr, parseRecordedAtToTs } from '../utils/helpers';
import { inferCategory, normalizeCategory, CATEGORY_LIST } from '../domain/categories';
import { normalizeEntry, normalizeMemo } from '../domain/normalize';
import { mergeData } from '../domain/merge';
import { dataCache, setDataCache, entries, nextMemos, setEntries, setNextMemos, getActiveEntries } from './store';
import {
    storageLoadData, storageSaveData, odSaveCache, odEnqueueChange,
    STORAGE_KEY, NEXT_MEMO_KEY, getMigrationDone, setMigrationDone,
} from '../services/storage/localStorage';
import { syncFlush } from '../services/sync/syncManager';
import { getDeviceId } from '../utils/device';

export function createEntry(base: Partial<Entry>): Entry {
    const now = Date.now();
    return {
        id: uuid(),
        date: formatDate(new Date()),
        text: "",
        category: "その他",
        tod: [],
        ts: now,
        updatedAt: now,
        deleted: false,
        energy: null,
        mental: null,
        starred: false,
        ...base,
        rev: 1,
        deviceId: getDeviceId(),
    };
}

export function touchEntry(e: Entry): void {
    e.rev = (e.rev || 0) + 1;
    e.deviceId = getDeviceId();
    e.updatedAt = Date.now();
}

export function createMemo(text: string): Memo {
    const now = Date.now();
    return {
        id: uuid(),
        text,
        createdAt: now,
        updatedAt: now,
        done: false,
        deleted: false,
        rev: 1,
        deviceId: getDeviceId(),
    };
}

export function touchMemo(m: Memo): void {
    m.rev = (m.rev || 0) + 1;
    m.deviceId = getDeviceId();
    m.updatedAt = Date.now();
}


// ===== Entry Management =====

export function loadEntriesFromCache(): void {
    setEntries((dataCache.entries || []).map(normalizeEntry));
}

export function saveEntriesToStorage(): void {
    const normalized = entries.map(normalizeEntry);
    const deleted = normalized.filter(e => e.deleted);
    const active = normalized.filter(e => !e.deleted);
    dataCache.entries = [...deleted, ...active];
    storageSaveData(dataCache);
}

export function loadNextMemosFromCache(): void {
    setNextMemos(
        (dataCache.memos || []).map(normalizeMemo).filter(m => !m.done && !m.deleted)
    );
}

export function saveNextMemosToStorage(updatedMemo?: Memo | null): void {
    const memoMap = new Map<string, Memo>();
    (dataCache.memos || []).map(normalizeMemo).forEach(m => memoMap.set(m.id, m));
    nextMemos.map(normalizeMemo).forEach(m => memoMap.set(m.id, m));
    if (updatedMemo) {
        const normalized = normalizeMemo(updatedMemo);
        memoMap.set(normalized.id, normalized);
    }
    dataCache.memos = Array.from(memoMap.values());
    storageSaveData(dataCache);
}

export function deleteEntryById(id: string): void {
    const target = entries.find(en => en.id === id);
    if (!target) return;
    target.deleted = true;
    target.updatedAt = Date.now();
    saveEntriesToStorage();
}

// ===== Entry Queries =====

export function getEntriesForDate(dateStr: string): Entry[] {
    return entries.filter(e => e.date === dateStr && !e.deleted);
}

export function getUniqueDatesFromEntries(): string[] {
    const set = new Set(getActiveEntries().map(e => e.date));
    return Array.from(set).filter(Boolean).sort();
}

export function getEntriesInLastNDays(n: number): Entry[] {
    const active = getActiveEntries();
    if (!active.length) return [];
    const dates = getUniqueDatesFromEntries();
    const latestStr = dates[dates.length - 1];
    const latestDate = parseDateStr(latestStr);
    if (!latestDate) return active.slice();
    const threshold = new Date(latestDate);
    threshold.setDate(threshold.getDate() - (n - 1));
    return active.filter(e => {
        const d = parseDateStr(e.date);
        return d && d >= threshold && d <= latestDate;
    });
}

export function getRecordTime(entry: Entry): string {
    const ts = entry.ts || entry.updatedAt || Date.now();
    return formatDateTimeForRecord(new Date(ts));
}

// ===== Metrics =====

export function computeMetrics(): {
    total: number; weekly: number; monthly: number;
    weekStart: Date | null; weekEnd: Date | null;
    baseMonth: number | null; baseYear: number | null;
} {
    const active = getActiveEntries();
    if (!active.length) {
        return { total: 0, weekly: 0, monthly: 0, weekStart: null, weekEnd: null, baseMonth: null, baseYear: null };
    }
    const dates = getUniqueDatesFromEntries();
    const latestStr = dates[dates.length - 1];
    const latestDate = parseDateStr(latestStr);
    if (!latestDate) return { total: active.length, weekly: active.length, monthly: active.length, weekStart: null, weekEnd: null, baseMonth: null, baseYear: null };

    const baseYear = latestDate.getFullYear();
    const baseMonth = latestDate.getMonth();

    const day = latestDate.getDay();
    const diffToMonday = (day + 6) % 7;
    const weekStart = new Date(latestDate);
    weekStart.setDate(weekStart.getDate() - diffToMonday);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    let weekly = 0;
    let monthly = 0;
    active.forEach(e => {
        const d = parseDateStr(e.date);
        if (!d) return;
        if (d >= weekStart && d <= weekEnd) weekly++;
        if (d.getFullYear() === baseYear && d.getMonth() === baseMonth) monthly++;
    });

    return { total: active.length, weekly, monthly, weekStart, weekEnd, baseMonth, baseYear };
}

export function countCategories(list: Entry[]): Record<string, number> {
    const counts: Record<string, number> = {};
    CATEGORY_LIST.forEach(c => counts[c] = 0);
    list.forEach(e => {
        const c = normalizeCategory(e.category || inferCategory(e.text));
        counts[c] += 1;
    });
    return counts;
}

// ===== CSV Parsing =====

export function parseRawCsv(text: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = "";
    let inQuote = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (inQuote) {
            if (char === '"') {
                if (nextChar === '"') {
                    currentField += '"';
                    i++; // skip escaped quote
                } else {
                    inQuote = false;
                }
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                inQuote = true;
            } else if (char === ',') {
                currentRow.push(currentField);
                currentField = "";
            } else if (char === '\r' || char === '\n') {
                if (char === '\r' && nextChar === '\n') {
                    i++;
                }
                currentRow.push(currentField);
                rows.push(currentRow);
                currentRow = [];
                currentField = "";
            } else {
                currentField += char;
            }
        }
    }
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }
    return rows;
}

export function cleanupLegacyEntry(raw: any): { date: string; text: string; recordedAt: string; category: string } {
    let date = raw.date || raw["日付"] || "";
    let text = raw.text || raw["内容"] || "";
    let recordedAt = raw.recordedAt || raw["記録日時"] || "";
    let category = raw.category || raw["カテゴリ"] || "";

    const m = text.match(/^(.*?),(20\d{2}\/\d{2}\/\d{2} \d{2}:\d{2})(?:,(\d+))?(?:,(\d+))?.*$/);
    if (m) {
        text = m[1];
        if (!recordedAt || /^\d+$/.test(recordedAt)) {
            recordedAt = m[2];
        }
    }

    category = normalizeCategory(category || inferCategory(text));
    return { date, text, recordedAt, category };
}

export function parseIppoCsv(csvText: string): Entry[] {
    const rows = parseRawCsv(csvText);
    const result: Entry[] = [];
    let inEntries = false;

    for (const cols of rows) {
        if (cols.length === 0) continue;
        if (cols.length === 1 && !cols[0].trim()) continue;

        const col0 = (cols[0] || "").trim();

        if (!inEntries) {
            if (col0 === "日付") {
                inEntries = true;
            }
            continue;
        }

        if (cols.length < 2) continue;

        const date = col0;
        const text = (cols[1] || "").trim();
        const recordedAt = (cols[2] || "").trim();

        if (!date || !text) continue;

        const entry = cleanupLegacyEntry({
            date,
            text,
            recordedAt,
            category: inferCategory(text)
        });

        let ts = parseRecordedAtToTs(entry.recordedAt);
        if (!ts && (entry.date || date)) {
            const d = new Date(entry.date || date);
            if (!isNaN(d.getTime())) ts = d.getTime();
        }
        ts = ts || Date.now();

        result.push(createEntry({
            id: uuid(),
            date: entry.date || date,
            text: entry.text || text,
            category: normalizeCategory(entry.category || inferCategory(text)),
            tod: [],
            ts: ts,
            updatedAt: Date.now(),
            deleted: false,
        }));
    }

    return result;
}

// ===== CSV Export =====

export function toCsv(rows: any[][]): string {
    return rows.map(cols => cols.map(c => {
        const s = (c == null) ? "" : String(c);
        if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, rows: any[][]): void {
    if (!rows || !rows.length) {
        alert("エクスポートするデータがありません。");
        return;
    }
    const csvText = toCsv(rows);
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function buildMonthlySummaryRows(): any[][] {
    if (!getActiveEntries().length) return [];
    const monthMap: Record<string, Record<string, number>> = {};
    getActiveEntries().forEach(e => {
        const dateStr = e.date || "";
        if (!dateStr) return;
        const month = dateStr.slice(0, 7);
        const cat = normalizeCategory(e.category || inferCategory(e.text));
        if (!monthMap[month]) monthMap[month] = {};
        if (!monthMap[month][cat]) monthMap[month][cat] = 0;
        monthMap[month][cat]++;
    });

    const months = Object.keys(monthMap).sort();
    const rows: any[][] = [["月", "カテゴリ", "件数"]];
    months.forEach(m => {
        CATEGORY_LIST.forEach(cat => {
            const count = monthMap[m][cat] || 0;
            if (count > 0) rows.push([m, cat, count]);
        });
    });
    return rows;
}

export function buildAllEntriesRows(): any[][] {
    if (!getActiveEntries().length) return [];
    const rows: any[][] = [["日付", "一歩の内容", "記録日時", "カテゴリ"]];
    const sorted = getActiveEntries().slice().sort((a, b) => {
        const ka = (a.date || "") + " " + getRecordTime(a);
        const kb = (b.date || "") + " " + getRecordTime(b);
        return ka.localeCompare(kb);
    });
    sorted.forEach(e => {
        rows.push([
            e.date || "",
            e.text || "",
            getRecordTime(e),
            normalizeCategory(e.category || inferCategory(e.text))
        ]);
    });
    return rows;
}

// ===== JSON Import / Export =====

export function downloadJson(): void {
    const payload = JSON.stringify(dataCache, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ippo_data.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function importJsonFile(file: File): Promise<void> {
    const text = await file.text();
    let parsed: any;
    try { parsed = JSON.parse(text); } catch {
        alert("JSONの読み込みに失敗しました。");
        return;
    }
    if (!parsed || !Array.isArray(parsed.entries) || !Array.isArray(parsed.memos)) {
        alert("JSON形式が違います。");
        return;
    }
    const merged = mergeData(dataCache, parsed);
    setDataCache(merged);
    odSaveCache(merged);
    odEnqueueChange();
    loadEntriesFromCache();
    loadNextMemosFromCache();
    // Lazy import to avoid circular dependency
    const { renderAll, renderNextMemos } = await import('../ui/views/ippoLog');
    renderAll();
    renderNextMemos();
    if (navigator.onLine) syncFlush();
}

// ===== Legacy Data Migration =====

export function migrateLegacyData(): void {
    if (getMigrationDone()) return;
    const legacyEntriesRaw = localStorage.getItem(STORAGE_KEY);
    const legacyMemosRaw = localStorage.getItem(NEXT_MEMO_KEY);
    if (!legacyEntriesRaw && !legacyMemosRaw) {
        setMigitionDone();
        return;
    }
    let legacyEntries: any[] = [];
    let legacyMemos: any[] = [];
    try { legacyEntries = JSON.parse(legacyEntriesRaw || "[]"); } catch { legacyEntries = []; }
    try { legacyMemos = JSON.parse(legacyMemosRaw || "[]"); } catch { legacyMemos = []; }

    const mappedEntries = Array.isArray(legacyEntries)
        ? legacyEntries.map(raw => {
            const cleaned = cleanupLegacyEntry(raw);
            return {
                id: uuid(),
                date: cleaned.date || "",
                text: cleaned.text || "",
                category: normalizeCategory(cleaned.category || inferCategory(cleaned.text)),
                ts: parseRecordedAtToTs(cleaned.recordedAt) || Date.now(),
                updatedAt: Date.now(),
                deleted: false,
            };
        })
        : [];

    const mappedMemos = Array.isArray(legacyMemos)
        ? legacyMemos.map(m => {
            const createdAt = parseRecordedAtToTs(m.createdAt) || Date.now();
            return {
                id: uuid(),
                text: m.text || "",
                createdAt,
                updatedAt: createdAt,
                done: false,
                deleted: false,
            };
        })
        : [];

    const merged = mergeData(dataCache, {
        schemaVersion: 2,
        entries: mappedEntries,
        memos: mappedMemos,
        simulations: [],
        dailyStates: {},
    });
    setDataCache(merged);
    odSaveCache(merged);
    odEnqueueChange();
    setMigrationDone();
}

// Typo fix (reexport)
function setMigitionDone() {
    setMigrationDone();
}
