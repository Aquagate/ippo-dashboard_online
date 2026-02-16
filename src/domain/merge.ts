// ===== Deterministic Merge Logic =====

import type { DataCache } from './schema';
import { MAX_SIMULATION_HISTORY } from './schema';
import { normalizeEntry, normalizeMemo, normalizeSimulationV2 } from './normalize';
import { appendDebugLog } from '../ui/debug';

// Deterministic conflict resolution
// Priority:
// 1. Higher Revision Wins (rev)
// 2. Newer Timestamp Wins (updatedAt)
// 3. Device ID String Compare (deviceId) - Tie breaker
function resolveConflict<T extends { rev: number; updatedAt?: number; deviceId: string }>(local: T, remote: T): T {
    // 1. Revision
    if (remote.rev > local.rev) return remote;
    if (remote.rev < local.rev) return local;

    // 2. Timestamp (handle undefined as 0)
    const remoteTime = remote.updatedAt || 0;
    const localTime = local.updatedAt || 0;
    if (remoteTime > localTime) return remote;
    if (remoteTime < localTime) return local;

    // 3. Device ID (Determinism)
    if (remote.deviceId > local.deviceId) return remote;
    return local;
}

export function mergeData(base: any, incoming: any): DataCache {
    const merged: DataCache = {
        schemaVersion: 2,
        entries: [],
        memos: [],
        simulations: [],
        dailyStates: {},
    };

    // Entries merge
    const entryMap = new Map();
    const baseEntries = (base?.entries || []).map(normalizeEntry);
    const incEntries = (incoming?.entries || []).map(normalizeEntry);

    // Combine to a map, resolving conflicts
    [...baseEntries, ...incEntries].forEach(e => {
        const existing = entryMap.get(e.id);
        if (!existing) {
            entryMap.set(e.id, e);
        } else {
            entryMap.set(e.id, resolveConflict(existing, e));
        }
    });
    merged.entries = Array.from(entryMap.values());

    // Memos merge
    const memoMap = new Map();
    const baseMemos = (base?.memos || []).map(normalizeMemo);
    const incMemos = (incoming?.memos || []).map(normalizeMemo);

    [...baseMemos, ...incMemos].forEach(m => {
        const existing = memoMap.get(m.id);
        if (!existing) {
            memoMap.set(m.id, m);
        } else {
            memoMap.set(m.id, resolveConflict(existing, m));
        }
    });
    merged.memos = Array.from(memoMap.values());

    // Simulations merge
    const simMap = new Map();
    const baseSims = (base?.simulations || []).map(normalizeSimulationV2);
    const incSims = (incoming?.simulations || []).map(normalizeSimulationV2);

    console.groupCollapsed("🧩 Simulation Merge Debug");
    [...baseSims, ...incSims].forEach(s => {
        const existing = simMap.get(s.id);
        if (!existing) {
            simMap.set(s.id, s);
        } else {
            const winner = resolveConflict(existing, s);
            const isRemoteWin = winner === s;

            const log = `Compare [${s.id.slice(0, 4)}...]:\n` +
                `  Local  : rev=${existing.rev}, up=${existing.updatedAt}, dev=${existing.deviceId}\n` +
                `  Remote : rev=${s.rev}, up=${s.updatedAt}, dev=${s.deviceId}\n` +
                `  Result : ${isRemoteWin ? "Remote Wins" : "Local Keeps"}`;
            console.log(log);
            appendDebugLog(log);

            simMap.set(s.id, winner);
        }
    });
    console.groupEnd();
    appendDebugLog(`Merge finished. Total: ${simMap.size} simulations (Filtered to ${MAX_SIMULATION_HISTORY})`);

    const allSims = Array.from(simMap.values()).sort((a: any, b: any) => b.createdAt - a.createdAt);
    merged.simulations = allSims.slice(0, MAX_SIMULATION_HISTORY);

    // DailyStates merge
    merged.dailyStates = {};
    const baseStates = base?.dailyStates || {};
    const incStates = incoming?.dailyStates || {};
    const allDates = new Set([...Object.keys(baseStates), ...Object.keys(incStates)]);

    allDates.forEach(date => {
        const b = baseStates[date];
        const i = incStates[date];

        if (!b && i) {
            merged.dailyStates[date] = i;
        } else if (b && !i) {
            merged.dailyStates[date] = b;
        } else if (b && i) {
            // Both exist. Treat incomplete data as low weak.
            const bSafe = { ...b, rev: b.rev || 0, updatedAt: b.updatedAt || 0, deviceId: b.deviceId || "legacy" };
            const iSafe = { ...i, rev: i.rev || 0, updatedAt: i.updatedAt || 0, deviceId: i.deviceId || "legacy" };
            merged.dailyStates[date] = resolveConflict(bSafe, iSafe);
        }
    });

    return merged;
}
