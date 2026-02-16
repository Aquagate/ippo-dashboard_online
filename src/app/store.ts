// ===== Global State (Store) =====

import type { DataCache, Entry, Memo } from '../domain/schema';

// In-memory data cache — the single source of truth
export let dataCache: DataCache = {
    schemaVersion: 2,
    entries: [],
    memos: [],
    simulations: [],
    dailyStates: {},
};

// In-memory working arrays
export let entries: Entry[] = [];
export let nextMemos: Memo[] = [];

// Setters (for mutable global state)
export function setDataCache(newCache: DataCache): void {
    dataCache = newCache;
}

export function setEntries(newEntries: Entry[]): void {
    entries = newEntries;
}

export function setNextMemos(newMemos: Memo[]): void {
    nextMemos = newMemos;
}

export function getActiveEntries(): Entry[] {
    return entries.filter(e => !e.deleted);
}
