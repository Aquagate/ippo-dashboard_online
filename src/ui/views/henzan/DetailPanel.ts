// ===== Henzan Detail Panel (View Component) =====
// 資産およびAI提案の詳細表示を担当する。

import { 
    el, setText, getAssets, getActiveEntries, 
    ASSET_TYPE_ICONS, ASSET_STATUS_COLORS, escapeHtml 
} from './shared';
import { dataCache } from '../../../app/store';

/**
 * 資産の詳細を表示する。
 */
export function showAssetDetail(assetId: string): void {
    const asset = getAssets().find(a => a.id === assetId);
    if (!asset) return;

    const panel = el('henzanDetailPanel');
    if (panel) panel.style.display = 'block';

    const icon = ASSET_TYPE_ICONS[asset.type] || '';
    setText('henzanDetailName', `${icon} ${asset.name}`);

    const meta = el('henzanDetailMeta');
    if (meta) {
        meta.innerHTML = `
            <span class="henzan-scale-badge">${asset.scale}</span>
            <span class="henzan-status-badge ${ASSET_STATUS_COLORS[asset.status]}">${asset.status}</span>
            <span>確信度: ${asset.confidence}</span>
            <span>根拠: ${asset.evidence_log_ids.length}件</span>
        `;
    }

    const summary = el('henzanDetailSummary');
    if (summary) summary.textContent = asset.summary || '（説明なし）';

    // 階層表示（親・子の相互リンク）
    renderHierarchy(assetId);

    // 根拠ログ表示
    renderEvidenceLogs(asset.evidence_log_ids);
}

/**
 * AI提案の詳細を表示する。
 */
export function showProposalDetail(proposalId: string): void {
    const proposal = dataCache.henzanProposals?.find(p => p.id === proposalId);
    if (!proposal) return;

    const panel = el('henzanDetailPanel');
    if (panel) panel.style.display = 'block';

    const asset = proposal.candidate;
    const icon = asset?.type ? (ASSET_TYPE_ICONS[asset.type] || '') : '📋';
    
    setText('henzanDetailName', `【提案詳細】 ${icon} ${asset?.name || '名称未設定'}`);

    const meta = el('henzanDetailMeta');
    if (meta) {
        let opLabel: string = proposal.operation;
        if (opLabel === 'create') opLabel = '✨ 新規発見';
        if (opLabel === 'update_existing') opLabel = '🔄 既存更新';
        if (opLabel === 'merge_into_existing') opLabel = '🔗 既存へ統合';
        if (opLabel === 'rename_existing') opLabel = '✏️ 改名提案';
        if (opLabel === 'promote_scale') opLabel = '⭐ 規模昇格';

        meta.innerHTML = `
            <span class="henzan-scale-badge">${asset?.scale || '-'}</span>
            <span class="henzan-review-type" style="margin-left: 8px;">${opLabel}</span>
            <span style="margin-left: 8px;">確信度: ${proposal.confidence}</span>
            <span style="margin-left: 8px;">根拠: ${proposal.evidence_log_ids?.length || 0}件</span>
        `;
    }

    const summary = el('henzanDetailSummary');
    if (summary) {
        summary.innerHTML = `
            <div style="margin-bottom: 8px;"><strong>理由:</strong> ${escapeHtml(proposal.reason || '')}</div>
            <div><strong>要約:</strong> ${escapeHtml(asset?.summary || '（説明なし）')}</div>
        `;
    }

    // 階層表示は、提案時点では暫定的なものになるため一旦非表示
    const hierarchyDiv = el('henzanDetailHierarchy');
    if (hierarchyDiv) hierarchyDiv.style.display = 'none';

    // 根拠ログ表示
    renderEvidenceLogs(proposal.evidence_log_ids || []);
}

/**
 * 資産の階層表示（親・子資産へのリンク）を行う。
 */
function renderHierarchy(currentAssetId: string): void {
    const hierarchyDiv = el('henzanDetailHierarchy');
    if (!hierarchyDiv) return;

    const assets = getAssets();
    const asset = assets.find(a => a.id === currentAssetId);
    if (!asset) return;

    const parent = asset.parent_id ? assets.find(a => a.id === asset.parent_id) : null;
    const children = assets.filter(a => a.parent_id === asset.id);

    if (!parent && children.length === 0) {
        hierarchyDiv.style.display = 'none';
        return;
    }

    hierarchyDiv.style.display = 'block';
    let html = '';
    if (parent) {
        html += `<div><h5>親資産</h5><span class="henzan-hierarchy-link" data-id="${parent.id}">${ASSET_TYPE_ICONS[parent.type]} ${escapeHtml(parent.name)}</span></div>`;
    }
    if (children.length > 0) {
        html += `<div style="margin-top:8px;"><h5>子資産（構成要素）</h5>`;
        html += children.map(c => `<div class="henzan-hierarchy-link" data-id="${c.id}" style="margin-bottom:2px;">${ASSET_TYPE_ICONS[c.type]} ${escapeHtml(c.name)}</div>`).join('');
        html += `</div>`;
    }
    hierarchyDiv.innerHTML = html;

    // リンクにイベントリスナー追加
    hierarchyDiv.querySelectorAll('.henzan-hierarchy-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const id = (e.currentTarget as HTMLElement).dataset.id;
            if (id) showAssetDetail(id);
        });
    });
}

/**
 * 根拠ログ一覧を表示する。
 */
function renderEvidenceLogs(logIds: string[]): void {
    const evidenceDiv = el('henzanDetailEvidence');
    if (!evidenceDiv) return;

    const entries = getActiveEntries();
    const evidenceLogs = logIds
        .map(id => entries.find(e => e.id === id))
        .filter(Boolean);

    if (evidenceLogs.length === 0) {
        evidenceDiv.innerHTML = '<div class="empty-state">紐づく一歩ログはありません。</div>';
    } else {
        evidenceDiv.innerHTML = evidenceLogs.map(e => `
            <div class="henzan-evidence-item">
                <span class="henzan-evidence-date">${e!.date}</span>
                <span class="henzan-evidence-text">${escapeHtml(e!.text)}</span>
            </div>
        `).join('');
    }
}
