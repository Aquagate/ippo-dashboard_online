// ===== localStorage Wrapper + IndexedDB =====
// Cycle 2: Uses IndexedDB for main data, localStorage for settings/meta.

import type { DataCache, Entry, Memo, Simulation } from '../../domain/schema';
import { normalizeSimulation } from '../../domain/normalize';
import { dataCache, setDataCache } from '../../app/store';
import { idbGet, idbSet } from './idb';
import { syncFlush } from '../../services/sync/syncManager';

const IDB_CACHE_KEY = "ippoDataCache_v1"; // Same key name for IDB
const IDB_LAST_GOOD_KEY = "ippoDataCache_lastGood"; // Backup key
const OD_CACHE_KEY = "ippoDataCache_v1"; // Legacy localStorage key
const OD_QUEUE_KEY = "ippoSyncQueue_v1";
const OD_MIGRATION_KEY = "ippoMigrationDone_v1";
const OD_SETTINGS_KEY = "ippoOneDriveSettings_v2";
const OD_STATUS_KEY = "ippoSyncStatus_v1";
export const STORAGE_KEY = "ippoLogEntries_v2"; // Very old legacy key
export const NEXT_MEMO_KEY = "ippoNextMemo_v1"; // Very old legacy key

// ===== Validation =====

export function validateDataCache(data: unknown): DataCache {
    if (!data || typeof data !== "object") throw new Error("Invalid data format: not an object");
    const d = data as any;

    // Schema version check
    if (typeof d.schemaVersion !== "number") {
        d.schemaVersion = 2; // Auto-fix if missing
    }

    // Arrays check
    if (!Array.isArray(d.entries)) d.entries = [];
    if (!Array.isArray(d.memos)) d.memos = [];
    if (!Array.isArray(d.simulations)) d.simulations = [];
    if (!d.dailyStates || typeof d.dailyStates !== "object") d.dailyStates = {};

    // Entries validation (minimal)
    d.entries = d.entries.filter((e: any) => e && typeof e.id === "string" && typeof e.text === "string" && typeof e.date === "string");

    // Memos validation (minimal)
    d.memos = d.memos.filter((m: any) => m && typeof m.id === "string" && typeof m.text === "string");

    return d as DataCache;
}

// ===== Cache Load/Save (Async/IDB) =====

export async function odLoadCache(): Promise<DataCache | null> {
    try {
        const fromIdb = await idbGet<DataCache>(IDB_CACHE_KEY);
        if (fromIdb) return validateDataCache(fromIdb);
        return null;
    } catch (e) {
        console.error("IDB Load Error:", e);
        return null;
    }
}

export async function odSaveCache(cache: DataCache): Promise<void> {
    try {
        const validated = validateDataCache(cache);
        await idbSet(IDB_CACHE_KEY, validated);
    } catch (e) {
        console.error("IDB Save Error:", e);
    }
}

// ===== Settings (Sync/localStorage) =====

export function odLoadSettings(): any {
    try { return JSON.parse(localStorage.getItem(OD_SETTINGS_KEY) || "null"); } catch { return null; }
}

export function odSaveSettings(s: any): void {
    localStorage.setItem(OD_SETTINGS_KEY, JSON.stringify(s));
}

export function odClearSettings(): void {
    localStorage.removeItem(OD_SETTINGS_KEY);
}

// ===== Sync Meta (Sync/localStorage) =====

export function odLoadSyncMeta(): any {
    try {
        const raw = localStorage.getItem(OD_STATUS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export function odSaveSyncMeta(meta: any): void {
    localStorage.setItem(OD_STATUS_KEY, JSON.stringify(meta));
}

// ===== Queue (Sync/localStorage) =====

export function odLoadQueue(): any[] {
    try {
        const raw = localStorage.getItem(OD_QUEUE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function odSaveQueue(queue: any[]): void {
    localStorage.setItem(OD_QUEUE_KEY, JSON.stringify(queue));
}

// ===== Migration Key =====

export function getMigrationDone(): boolean {
    return !!localStorage.getItem(OD_MIGRATION_KEY);
}

export function setMigrationDone(): void {
    localStorage.setItem(OD_MIGRATION_KEY, "1");
}

// ===== Migration Logic =====

async function migrateFromLocalStorage(): Promise<DataCache | null> {
    const raw = localStorage.getItem(OD_CACHE_KEY);
    if (!raw) return null;

    try {
        console.log("Migrating from localStorage to IndexedDB...");
        const parsed = JSON.parse(raw);
        const validated = validateDataCache(parsed);
        // Save to IDB
        await idbSet(IDB_CACHE_KEY, validated);
        // Remove from localStorage
        localStorage.removeItem(OD_CACHE_KEY);
        console.log("Migration complete.");
        return validated;
    } catch (e) {
        console.error("Migration failed:", e);
        return null;
    }
}

// ===== High-level Storage API =====

export async function storageLoadData(): Promise<DataCache> {
    // 1. Try IDB
    let cached = await odLoadCache();

    // 2. If no IDB, try migration from localStorage
    if (!cached) {
        cached = await migrateFromLocalStorage();
    }

    if (cached) {
        if (!cached.schemaVersion || cached.schemaVersion < 2) {
            cached.schemaVersion = 2;
        }
        // Normalize
        if (cached.simulations) {
            cached.simulations = cached.simulations.map((sim: any) => normalizeSimulation(sim));
        }
        setDataCache(cached);
        return cached;
    }

    // 3. Fallback to fresh
    const fresh: DataCache = { schemaVersion: 2, entries: [], memos: [], simulations: [], dailyStates: {} };
    setDataCache(fresh);
    await odSaveCache(fresh);
    return fresh;
}

export async function storageSaveData(newData: DataCache): Promise<void> {
    setDataCache(newData);
    await odSaveCache(newData);
    odEnqueueChange();
    if (navigator.onLine) {
        // Trigger sync (no await to avoid blocking UI)
        syncFlush();
    }
}

export function odEnqueueChange(): void {
    const queue = odLoadQueue();
    queue.push({ ts: Date.now() });
    odSaveQueue(queue);
}

export function odClearQueue(): void {
    odSaveQueue([]);
}

// ===== Last Good Known Config (Rescue) =====

export async function saveLastGood(cache: DataCache): Promise<void> {
    try {
        const validated = validateDataCache(cache);
        await idbSet(IDB_LAST_GOOD_KEY, validated);
        console.log("Saved Last Good Configuration.");
    } catch (e) {
        console.error("Failed to save Last Good:", e);
    }
}

export async function loadLastGood(): Promise<DataCache | null> {
    try {
        const fromIdb = await idbGet<DataCache>(IDB_LAST_GOOD_KEY);
        if (fromIdb) return validateDataCache(fromIdb);
        return null;
    } catch (e) {
        console.error("Failed to load Last Good:", e);
        return null;
    }
}

export async function restoreFromLastGood(): Promise<boolean> {
    const backup = await loadLastGood();
    if (!backup) return false;

    // Overwrite main cache in IDB
    await idbSet(IDB_CACHE_KEY, backup);

    // Update memory
    setDataCache(backup);

    // Update queue to force sync (optional, but good to be safe)
    odEnqueueChange();

    return true;
}

