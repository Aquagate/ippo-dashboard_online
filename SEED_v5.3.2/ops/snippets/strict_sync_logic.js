/**
 * Strict Sync Protocol (Anti-Zombie)
 * 
 * 分散環境や同期遅延がある環境で、論理削除フラグの消失や
 * 過去データによる復活を防ぐためのマージロジック。
 */

function mergeDataStrict(base, incoming, normalizer) {
    const mergedMap = new Map();

    [...(base || []), ...(incoming || [])].forEach(raw => {
        const item = normalizer(raw);
        const existing = mergedMap.get(item.id);

        if (!existing) {
            mergedMap.set(item.id, item);
        } else {
            // STRICT NEWER WINS: 
            // タイムスタンプが完全に新しい場合のみ上書き。
            // 同一時刻の場合は、既存（ローカルの変更や削除状態）を保持することでゾンビ復活を防ぐ。
            if (item.updatedAt > existing.updatedAt) {
                mergedMap.set(item.id, item);
            }
        }
    });

    return Array.from(mergedMap.values());
}

/** 
 * Data Normalization Example for Simulation v2
 */
function normalizeSimulationV2(sim) {
    return {
        id: sim.id,
        createdAt: sim.createdAt || Date.now(),
        updatedAt: sim.updatedAt || sim.createdAt || Date.now(),
        result: sim.result || {},
        commit: sim.commit || null,
        assetCommits: sim.assetCommits || [],
        memoedStepIndices: sim.memoedStepIndices || [],
        deleted: !!sim.deleted, // Ensure logical deletion flag is preserved
    };
}
