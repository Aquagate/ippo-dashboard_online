// ===== Henzan Asset Table (View Component) =====
// 資産一覧のツリーグリッド描画を担当する。

import { 
    el, getFilteredAssets, ASSET_TYPE_ICONS, 
    ASSET_STATUS_COLORS, escapeHtml 
} from './shared';
import { type HenzanAsset } from '../../../domain/henzan/schema';

/**
 * 資産一覧テーブルをレンダリングする。
 * @param onShowDetail 資産詳細を表示するためのコールバック。
 */
export function renderAssetTable(onShowDetail: (id: string) => void): void {
    const tbody = el('henzanAssetTbody') as HTMLTableSectionElement | null;
    const noAssets = el('henzanNoAssets');
    const tableWrap = el('henzanAssetTableWrap');
    if (!tbody) return;

    const assets = getFilteredAssets();

    if (assets.length === 0) {
        tbody.innerHTML = '';
        if (noAssets) noAssets.style.display = 'block';
        if (tableWrap) tableWrap.style.display = 'none';
        return;
    }

    if (noAssets) noAssets.style.display = 'none';
    if (tableWrap) tableWrap.style.display = 'block';

    tbody.innerHTML = '';
    
    // 階層構造の描画
    // 親がリストにいないものをルートとして開始
    const roots = assets.filter(a => !a.parent_id || !assets.some(p => p.id === a.parent_id));
    
    const renderRow = (asset: HenzanAsset, depth: number) => {
        const tr = document.createElement('tr');
        tr.className = 'henzan-asset-row';
        tr.dataset.assetId = asset.id;

        const icon = ASSET_TYPE_ICONS[asset.type] || '';
        const statusClass = ASSET_STATUS_COLORS[asset.status] || '';
        const dateStr = new Date(asset.updated_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });

        // インデントとノード線の生成
        let indentHtml = '';
        for (let i = 0; i < depth; i++) {
            const isLast = i === depth - 1;
            indentHtml += `<span class="henzan-asset-indent">${isLast ? '<span class="henzan-asset-node-line"></span>' : ''}</span>`;
        }

        tr.innerHTML = `
            <td class="henzan-asset-name">
                ${indentHtml}
                <span>${icon} ${escapeHtml(asset.name)}</span>
            </td>
            <td><span class="henzan-scale-badge">${asset.scale}</span></td>
            <td><span class="henzan-status-badge ${statusClass}">${asset.status}</span></td>
            <td class="henzan-evidence-count">${asset.evidence_log_ids.length}</td>
            <td class="henzan-date">${dateStr}</td>
        `;

        tr.addEventListener('click', () => onShowDetail(asset.id));
        tbody.appendChild(tr);

        // 子資産の再帰描画
        const children = assets.filter(a => a.parent_id === asset.id);
        children.forEach(child => renderRow(child, depth + 1));
    };

    roots.forEach(root => renderRow(root, 0));
}
