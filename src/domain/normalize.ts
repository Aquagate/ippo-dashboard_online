// ===== Data Normalization =====

import type { Entry, Memo, Simulation } from './schema';
import { uuid } from '../utils/helpers';
import { inferCategory, normalizeCategory } from './categories';

export function normalizeEntry(entry: any): Entry {
    let category = entry.category;
    if (!category) {
        category = inferCategory(entry.text);
    }
    category = normalizeCategory(category);

    if (!entry.id) {
        entry.id = uuid();
    }

    return {
        id: entry.id,
        date: entry.date || "",
        text: entry.text || "",
        category: category,
        energy: entry.energy ?? null,
        mental: entry.mental ?? null,
        starred: !!entry.starred,
        tod: Array.isArray(entry.tod) ? entry.tod : [],
        ts: entry.ts || entry.updatedAt || 0,
        updatedAt: entry.updatedAt || entry.ts || 0,
        deleted: !!entry.deleted,
        rev: entry.rev || 0,
        deviceId: entry.deviceId || "legacy",
    };
}

export function normalizeMemo(memo: any): Memo {
    if (!memo.id) {
        memo.id = uuid();
    }
    
    // Also fix the case where old `done: true` needs to map to `deleted: true`
    // or we just preserve both cleanly.
    return {
        id: memo.id,
        text: memo.text || "",
        createdAt: memo.createdAt || Date.now(),
        updatedAt: memo.updatedAt || memo.createdAt || 0,
        done: !!memo.done,
        deleted: !!memo.deleted,
        rev: memo.rev || 0,
        deviceId: memo.deviceId || "legacy",
    };
}

export function normalizeSimulationV2(sim: any): Simulation {
    if (!sim.id) {
        sim.id = uuid();
    }
    return {
        id: sim.id,
        createdAt: sim.createdAt || Date.now(),
        updatedAt: sim.updatedAt || sim.createdAt || 0,
        promptVersion: sim.promptVersion || "SEED_v5",
        logWindowDays: sim.logWindowDays || 90,
        recentCount: sim.recentCount || 30,
        seedKey: sim.seedKey || null,
        inputDigest: sim.inputDigest || {},
        result: sim.result || {},
        commit: sim.commit || null,
        assetCommits: sim.assetCommits || [],
        memoedStepIndices: sim.memoedStepIndices || [],
        deleted: !!sim.deleted,
        rev: sim.rev || 0,
        deviceId: sim.deviceId || "legacy",
    };
}

export function normalizeSimulation(sim: any): Simulation {
    if (!sim.id) {
        sim.id = uuid();
    }
    return {
        id: sim.id,
        createdAt: sim.createdAt || Date.now(),
        updatedAt: sim.updatedAt || Date.now(),
        promptVersion: sim.promptVersion || 'unknown',
        logWindowDays: sim.logWindowDays || 90,
        recentCount: sim.recentCount || 30,
        seedKey: sim.seedKey || null,
        inputDigest: sim.inputDigest || {},
        result: sim.result || {},
        commit: sim.commit || null,
        assetCommits: sim.assetCommits || [],
        memoedStepIndices: sim.memoedStepIndices || [],
        deleted: !!sim.deleted,
        rev: sim.rev || 0,
        deviceId: sim.deviceId || "legacy",
    };
}
