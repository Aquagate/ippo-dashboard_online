// ===== Henzan UI Shared Utilities & Constants =====

import { getDataCache, getActiveEntries } from '../../../app/store';
import { ASSET_TYPE_ICONS, ASSET_STATUS_COLORS, type HenzanAsset, type HenzanProposal } from '../../../domain/henzan/schema';

// --- DOM参照キャッシュ ---
const els: Record<string, HTMLElement | null> = {};

/**
 * IDを指定してDOM要素を取得し、キャッシュする。
 */
export function el(id: string): HTMLElement | null {
    if (!els[id]) els[id] = document.getElementById(id);
    return els[id];
}

/**
 * テキストを安全に設定する。
 */
export function setText(id: string, text: string): void {
    const e = el(id);
    if (e) e.textContent = text;
}

/**
 * メッセージを表示する（簡易ラベル）。
 */
export function showMessage(id: string, msg: string): void {
    const e = el(id);
    if (e) e.textContent = msg;
}

/**
 * HTMLをエスケープする。
 */
export function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// --- データ取得ヘルパー ---

export function getAssets(): HenzanAsset[] {
    return getDataCache().henzanAssets || [];
}

export function getPendingProposals(): HenzanProposal[] {
    return (getDataCache().henzanProposals || []).filter(p => !p.resolved);
}

export function getFilteredAssets(): HenzanAsset[] {
    let assets = getAssets();

    const typeFilter = (el('henzanFilterType') as HTMLSelectElement)?.value;
    const scaleFilter = (el('henzanFilterScale') as HTMLSelectElement)?.value;
    const statusFilter = (el('henzanFilterStatus') as HTMLSelectElement)?.value;

    if (typeFilter) assets = assets.filter(a => a.type === typeFilter);
    if (scaleFilter) assets = assets.filter(a => a.scale === scaleFilter);
    if (statusFilter) assets = assets.filter(a => a.status === statusFilter);

    // 更新日時降順
    return assets.sort((a, b) => b.updated_at - a.updated_at);
}

export { ASSET_TYPE_ICONS, ASSET_STATUS_COLORS, getActiveEntries };
