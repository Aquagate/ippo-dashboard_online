// ===== Henzan Review Tray (View Component) =====
// AI提案の確認トレイ描画を担当する。

import { 
    el, getAssets, getPendingProposals, 
    ASSET_TYPE_ICONS, escapeHtml 
} from './shared';

/**
 * AIによる改善提案一覧（編集トレイ）をレンダリングする。
 */
export function renderReviewTray(
    onAccept: (id: string) => void,
    onReject: (id: string) => void,
    onShowDetail: (id: string) => void
): void {
    const container = el('henzanReviewList');
    if (!container) return;

    const pending = getPendingProposals();

    if (pending.length === 0) {
        container.innerHTML = '<div class="empty-state">現在、確認待ちの候補はありません。</div>';
        return;
    }

    container.innerHTML = '';
    pending.forEach(proposal => {
        const card = document.createElement('div');
        const asset = proposal.candidate;

        // 確信度バッジのクラス
        const confidenceClass = proposal.confidence === '高' ? 'confidence-high' :
                                proposal.confidence === '中' ? 'confidence-medium' :
                                proposal.confidence === '低' ? 'confidence-low' : '';
        card.className = `henzan-review-card ${confidenceClass}`;
        
        // 操作種別に応じたバッジ
        let opLabel: string = proposal.operation;
        if (opLabel === 'create') opLabel = '✨ 新規発見';
        if (opLabel === 'update_existing') opLabel = '🔄 既存更新';
        if (opLabel === 'merge_into_existing') opLabel = '🔗 既存へ統合';
        if (opLabel === 'rename_existing') opLabel = '✏️ 改名提案';
        if (opLabel === 'promote_scale') opLabel = '⭐ 規模昇格';

        const icon = asset?.type ? (ASSET_TYPE_ICONS[asset.type] || '') : '📋';
        const name = asset?.name || '（名称不明）';

        // 親子関係のコンテキスト表示
        let contextHtml = '';
        if (proposal.parent_temp_id) {
            const parentProposal = pending.find(p => p.run_id === proposal.run_id && p.temp_id === proposal.parent_temp_id);
            if (parentProposal) {
                contextHtml = `<div class="henzan-review-card-context">↳ ${escapeHtml(parentProposal.candidate?.name || '親候補')} の構成要素</div>`;
            }
        } else if (proposal.candidate?.parent_id) {
            const parentAsset = getAssets().find(a => a.id === proposal.candidate?.parent_id);
            if (parentAsset) {
                contextHtml = `<div class="henzan-review-card-context">↳ 既存資産: ${escapeHtml(parentAsset.name)} の子として</div>`;
            }
        }

        const evidenceCount = proposal.evidence_log_ids?.length || 0;

        card.innerHTML = `
            <div class="henzan-review-card-header">
                <span class="henzan-review-type">${opLabel}</span>
                <span>${icon} ${escapeHtml(name)}</span>
            </div>
            ${contextHtml}
            <div class="henzan-review-card-summary">
                ${escapeHtml(asset?.summary || '')}
            </div>
            <div class="henzan-proposal-reason" style="font-size: 11px; margin: 6px 0; color: #a1a1aa; background: rgba(0,0,0,0.2); padding: 4px; border-left: 2px solid #8b5cf6;">
                <strong>理由:</strong> ${escapeHtml(proposal.reason || '')}
            </div>
            <div class="henzan-review-card-actions" style="margin-top: 8px;">
                <button type="button" class="btn-ghost detail-btn">🔍 詳細・根拠 (${evidenceCount}件)</button>
                <div style="flex:1"></div>
                <button type="button" class="btn-ghost henzan-btn-accept">✅ 採択</button>
                <button type="button" class="btn-ghost henzan-btn-reject">❌ 却下</button>
            </div>
        `;

        card.querySelector('.henzan-btn-accept')?.addEventListener('click', (e) => {
            e.stopPropagation();
            onAccept(proposal.id);
        });
        card.querySelector('.henzan-btn-reject')?.addEventListener('click', (e) => {
            e.stopPropagation();
            onReject(proposal.id);
        });
        card.querySelector('.detail-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            onShowDetail(proposal.id);
        });

        // カード全体のクリックでも詳細を表示
        card.addEventListener('click', () => onShowDetail(proposal.id));

        container.appendChild(card);
    });
}
