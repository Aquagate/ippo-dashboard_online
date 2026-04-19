// ===== Henzan Proposal Resolver (Logic) =====
// UIに依存しない、提案の採択・却下・資産反映のコアロジックを管理する。

import { getDataCache } from '../../app/store';
import { storageSaveData } from '../../services/storage/localStorage';
import { 
    type HenzanProposal, type HenzanAsset, 
    createDefaultAsset 
} from '../../domain/henzan/schema';

/**
 * 提案を解決（採択または却下）し、必要に応じて資産データを更新する。
 * @returns 採択された場合に新しく作成/更新された Asset ID。却下時やエラー時は null。
 */
export function resolveProposalData(proposalId: string, resolution: 'accepted' | 'rejected'): string | null {
    const currentCache = getDataCache();
    if (!currentCache.henzanProposals) return null;
    
    const proposal = currentCache.henzanProposals.find(p => p.id === proposalId);
    if (!proposal) return null;

    // 1. 提案情報の更新
    proposal.resolved = true;
    proposal.resolved_at = Date.now();
    proposal.resolution = resolution;

    let resultAssetId: string | null = null;

    // 2. 採択時の処理
    if (resolution === 'accepted') {
        resultAssetId = applyProposalToAssets(proposal);
        
        // 親子紐付けの伝搬: 同一Run内の未解決な子提案に対して、確定した親IDをセットする
        if (proposal.temp_id && resultAssetId) {
            const sameRunChildren = currentCache.henzanProposals.filter(p => 
                p.run_id === proposal.run_id && 
                p.parent_temp_id === proposal.temp_id && 
                !p.resolved
            );
            sameRunChildren.forEach(child => {
                if (!child.candidate) child.candidate = {};
                child.candidate.parent_id = resultAssetId!;
            });
        }
    }

    // 3. ストレージ保存
    storageSaveData(currentCache);
    
    return resultAssetId;
}

/**
 * 提案内容を資産データ（henzanAssets）に反映させる。
 */
function applyProposalToAssets(proposal: HenzanProposal): string | null {
    const cache = getDataCache();
    const now = Date.now();
    let resultAssetId: string | null = null;
    
    const candidate = proposal.candidate;
    if (!candidate) return null;

    if (proposal.operation === 'create') {
        const newAsset: HenzanAsset = {
            ...createDefaultAsset(),
            name: candidate.name || '名称未設定',
            type: candidate.type || '知見',
            scale: candidate.scale || '小',
            summary: candidate.summary || '',
            evidence_log_ids: [...proposal.evidence_log_ids],
            parent_id: candidate.parent_id || null, 
            status: '活性',
            created_at: now,
            updated_at: now,
        };
        cache.henzanAssets.push(newAsset);
        resultAssetId = newAsset.id;
    } 
    else if (proposal.operation === 'update_existing' && proposal.target_asset_id) {
        const asset = cache.henzanAssets.find(a => a.id === proposal.target_asset_id);
        if (asset) {
            if (candidate.name) asset.name = candidate.name;
            if (candidate.summary) asset.summary = candidate.summary;
            if (candidate.scale) asset.scale = candidate.scale;
            if (candidate.type) asset.type = candidate.type;
            if (candidate.parent_id !== undefined) asset.parent_id = candidate.parent_id;
            
            const newIds = proposal.evidence_log_ids.filter(id => !asset.evidence_log_ids.includes(id));
            asset.evidence_log_ids.push(...newIds);
            
            asset.status = '活性';
            asset.updated_at = now;
            resultAssetId = asset.id;
        }
    }
    else if (proposal.operation === 'rename_existing' && proposal.target_asset_id) {
        const asset = cache.henzanAssets.find(a => a.id === proposal.target_asset_id);
        if (asset) {
            if (candidate.name) asset.name = candidate.name;
            if (candidate.summary) asset.summary = candidate.summary;
            
            const newIds = proposal.evidence_log_ids.filter(id => !asset.evidence_log_ids.includes(id));
            asset.evidence_log_ids.push(...newIds);
            
            asset.status = '活性';
            asset.updated_at = now;
            resultAssetId = asset.id;
        }
    }
    else if (proposal.operation === 'merge_into_existing' && proposal.target_asset_id && proposal.merge_target_id) {
        const sourceAsset = cache.henzanAssets.find(a => a.id === proposal.target_asset_id);
        const targetAsset = cache.henzanAssets.find(a => a.id === proposal.merge_target_id);
        
        if (sourceAsset && targetAsset) {
            const newIds = sourceAsset.evidence_log_ids.filter(id => !targetAsset.evidence_log_ids.includes(id));
            targetAsset.evidence_log_ids.push(...newIds);
            
            if (candidate.name) targetAsset.name = candidate.name;
            if (candidate.summary) targetAsset.summary = candidate.summary;
            
            targetAsset.status = '活性';
            targetAsset.updated_at = now;
            
            sourceAsset.status = '休眠';
            sourceAsset.summary = `[統合済: ${targetAsset.name}] ` + sourceAsset.summary;
            sourceAsset.updated_at = now;
            resultAssetId = targetAsset.id;
        }
    }
    else if (proposal.operation === 'promote_scale' && proposal.target_asset_id) {
        const asset = cache.henzanAssets.find(a => a.id === proposal.target_asset_id);
        if (asset) {
            if (candidate.scale) asset.scale = candidate.scale;
            if (candidate.name) asset.name = candidate.name;
            if (candidate.summary) asset.summary = candidate.summary;
            
            asset.status = '活性';
            asset.updated_at = now;
            resultAssetId = asset.id;
        }
    }
    return resultAssetId;
}
