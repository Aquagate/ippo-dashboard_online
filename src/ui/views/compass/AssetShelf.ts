import { sanitize } from '../../../utils/sanitize';
import { getCommittedAssets, getAllAssets } from '../../../logic/compass/compassResolver';

export interface AssetShelfActions {
    onShowAssetPrompt: (encodedAsset: string) => void;
    onShowMyAssetPrompt: (key: string) => void;
}

export function renderAssetShelf(
    container: HTMLElement,
    actions: AssetShelfActions
): void {
    const committedAssets = getCommittedAssets();
    const allAssets = getAllAssets();
    const typeIcons: Record<string, string> = { template: "📄", script: "⚙️", checklist: "✅", doc: "📋" };

    container.innerHTML = `
        <div style="margin-bottom:20px;">
            <div style="font-size:12px; color:#22c55e; margin-bottom:12px; font-weight:bold; display:flex; align-items:center; gap:6px;">
                <span>📌 MY ASSETS (確定済み資産)</span>
                <span style="background:#22c55e; color:#000; font-size:9px; padding:1px 5px; border-radius:10px;">${committedAssets.length}</span>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
                ${committedAssets.map(ac => `
                    <div class="my-asset-card" data-asset-key="${ac.mapKey}" style="background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3); border-radius:6px; padding:8px 12px; cursor:pointer; min-width:120px; transition:all 0.2s;">
                        <div style="font-size:10px; color:#22c55e; margin-bottom:2px;">${typeIcons[ac.type] || "📋"} ${sanitize(ac.type)}</div>
                        <div style="font-size:12px; color:#fff; font-weight:bold;">${sanitize(ac.asset)}</div>
                        ${ac.commitCount > 1 ? `<div style="font-size:9px; color:#22c55e; margin-top:4px;">重複検知: ${ac.commitCount}回</div>` : ""}
                    </div>
                `).join("")}
                ${committedAssets.length === 0 ? '<div style="font-size:11px; color:#666;">まだ確定された資産はありません</div>' : ""}
            </div>
        </div>

        <div>
            <div style="font-size:12px; color:#fbbf24; margin-bottom:12px; font-weight:bold; display:flex; align-items:center; gap:6px;">
                <span>💡 ASSET IDEAS (出現頻度の高い提案)</span>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
                ${allAssets.slice(0, 8).map(a => `
                    <div class="asset-idea-card" data-asset-raw="${encodeURIComponent(JSON.stringify(a))}" style="background:rgba(251,191,36,0.05); border:1px solid rgba(251,191,36,0.2); border-radius:6px; padding:8px 12px; cursor:pointer; transition:all 0.2s;">
                        <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                            <div style="font-size:12px; color:#eee;">${sanitize(a.asset)}</div>
                            <span style="font-size:9px; background:rgba(251,191,36,0.2); color:#fbbf24; padding:1px 4px; border-radius:4px;">${a.count}回</span>
                        </div>
                        <div style="font-size:9px; color:#888; margin-top:4px;">${typeIcons[a.type] || "📋"} ${sanitize(a.type)}</div>
                    </div>
                `).join("")}
            </div>
        </div>
    `;

    // Bind events
    container.querySelectorAll(".my-asset-card").forEach(el => {
        el.addEventListener("click", () => {
            const key = el.getAttribute("data-asset-key")!;
            actions.onShowMyAssetPrompt(key);
        });
    });

    container.querySelectorAll(".asset-idea-card").forEach(el => {
        el.addEventListener("click", () => {
            const raw = el.getAttribute("data-asset-raw")!;
            actions.onShowAssetPrompt(raw);
        });
    });
}
