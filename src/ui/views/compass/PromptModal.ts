import { sanitize } from '../../../utils/sanitize';
import { getActiveEntries, dataCache } from '../../../app/store';
import { showToast } from '../../toast';

export interface PromptModalActions {
    onSaveCustomPrompt: (assetKey: string, newPrompt: string) => void;
}

export function showAssetPrompt(encodedAsset: string): void {
    try {
        const asset = JSON.parse(decodeURIComponent(encodedAsset));
        const entries = getActiveEntries();
        const categoryCount: Record<string, number> = {};
        entries.slice(0, 30).forEach(e => {
            const cat = e.category || "その他";
            categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        });
        const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];

        const prompt = `# 資産生成リクエスト\n\n## 目的\n${asset.asset}\n\n## 出力形式\n${asset.type === "template" ? "Markdownテンプレート" : asset.type === "script" ? "実行可能なスクリプト" : asset.type === "checklist" ? "チェックリスト形式" : "ドキュメント（構造化）"}\n\n## 制約\n- 短く、再利用できる、現場で使える\n- 過度に複雑にしない\n- すぐに使い始められる形で\n\n## ユーザーの傾向\n最近のログでは「${topCategory ? topCategory[0] : "その他"}」カテゴリが多い。\n理由: ${asset.why}\n\n必要な成果物のみを出力してください。`;

        renderModal({
            id: "assetPromptModal",
            title: `📝 資産生成プロンプト`,
            subtitle: `🏆 ${asset.asset} <span style="color:#9ca3af;">[${asset.type}]</span>`,
            content: `<pre id="assetPromptText" style="background:rgba(0,0,0,0.4); color:#e2e8f0; padding:16px; border-radius:8px; font-size:12px; line-height:1.6; white-space:pre-wrap; word-wrap:break-word; border:1px solid rgba(255,255,255,0.1); margin:0;">${prompt}</pre>`,
            footer: `
                <button class="copy-prompt-btn" style="background:#fbbf24; color:#000; border:none; padding:6px 16px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:bold;">📋 コピー</button>
            `,
            borderColor: "rgba(255,215,0,0.3)"
        });

        const modal = document.getElementById("assetPromptModal");
        modal?.querySelector(".copy-prompt-btn")?.addEventListener("click", () => {
            navigator.clipboard.writeText(document.getElementById("assetPromptText")?.textContent || "").then(() => showToast("📋 コピーしました", "ok"));
        });

    } catch (e) {
        console.error(e);
        showToast("プロンプト表示に失敗しました", "err");
    }
}

export function showMyAssetPrompt(key: string, actions: PromptModalActions): void {
    const sims = dataCache.simulations || [];
    let assetInfo: any = null;
    for (const sim of sims) {
        for (const ac of (sim.assetCommits || [])) {
            if ((ac.asset || "").toLowerCase().trim() === key) { assetInfo = ac; break; }
        }
        if (assetInfo) break;
    }
    if (!assetInfo) { showToast("資産が見つかりません", "err"); return; }

    const activeEntries = getActiveEntries();
    const categoryCount: Record<string, number> = {};
    activeEntries.slice(0, 30).forEach(e => { const cat = e.category || "その他"; categoryCount[cat] = (categoryCount[cat] || 0) + 1; });
    const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];
    const defaultPrompt = `# 資産生成リクエスト\n\n## 目的\n${assetInfo.asset}\n\n## 出力形式\n${assetInfo.type === "template" ? "Markdownテンプレート" : assetInfo.type === "script" ? "実行可能なスクリプト" : assetInfo.type === "checklist" ? "チェックリスト形式" : "ドキュメント（構造化）"}\n\n## 制約\n- 短く、再利用できる、現場で使える\n- 過度に複雑にしない\n- すぐに使い始められる形で\n\n## ユーザーの傾向\n最近のログでは「${topCategory ? topCategory[0] : "その他"}」カテゴリが多い。\n理由: ${assetInfo.why || "（未設定）"}\n\n必要な成果物のみを出力してください。`;
    const promptText = assetInfo.customPrompt || defaultPrompt;
    const dateStr = new Date(assetInfo.committedAt).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });

    renderModal({
        id: "assetPromptModal",
        title: `📌 ${assetInfo.asset}`,
        subtitle: `<span>📂 ${assetInfo.type}</span><span>📅 ${dateStr}</span>${assetInfo.customPrompt ? '<span style="color:#fbbf24;">✏️ カスタム済み</span>' : '<span>📝 デフォルト</span>'}`,
        content: `
            <div style="font-size:11px; color:#ccc; margin-bottom:6px;">プロンプト（編集可能）:</div>
            <textarea id="myAssetPromptText" style="width:100%; min-height:250px; background:rgba(0,0,0,0.4); color:#e2e8f0; padding:14px; border-radius:8px; font-size:12px; line-height:1.6; border:1px solid rgba(255,255,255,0.15); resize:vertical; font-family:inherit; box-sizing:border-box;">${promptText}</textarea>
        `,
        footer: `
            <button class="save-prompt-btn" style="background:#22c55e; color:#fff; border:none; padding:6px 16px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:bold;">💾 保存</button>
            <button class="copy-prompt-btn" style="background:#fbbf24; color:#000; border:none; padding:6px 16px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:bold;">📋 コピー</button>
        `,
        borderColor: "rgba(34,197,94,0.4)"
    });

    const modal = document.getElementById("assetPromptModal");
    modal?.querySelector(".save-prompt-btn")?.addEventListener("click", () => {
        const val = (document.getElementById("myAssetPromptText") as HTMLTextAreaElement).value;
        actions.onSaveCustomPrompt(key, val);
    });
    modal?.querySelector(".copy-prompt-btn")?.addEventListener("click", () => {
        const val = (document.getElementById("myAssetPromptText") as HTMLTextAreaElement).value;
        navigator.clipboard.writeText(val).then(() => showToast("📋 コピーしました", "ok"));
    });
}

function renderModal(config: { id: string, title: string, subtitle: string, content: string, footer: string, borderColor: string }): void {
    const existing = document.getElementById(config.id);
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = config.id;
    modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;";
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });

    const inner = document.createElement("div");
    inner.style.cssText = `background:#1e1e2e; border:1px solid ${config.borderColor}; border-radius:12px; padding:20px; max-width:600px; width:100%; max-height:85vh; overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.5);`;
    inner.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div style="font-size:14px; color:${config.borderColor.replace('0.3', '1').replace('0.4', '1')}; font-weight:bold;">${config.title}</div>
            <button class="close-modal-btn" style="background:none; border:none; color:#9ca3af; font-size:18px; cursor:pointer; padding:4px;">✕</button>
        </div>
        <div style="font-size:10px; color:#9ca3af; margin-bottom:16px; display:flex; gap:12px;">
            ${config.subtitle}
        </div>
        ${config.content}
        <div style="display:flex; gap:8px; margin-top:16px; justify-content:space-between; flex-wrap:wrap;">
            <div style="display:flex; gap:8px;">
                ${config.footer}
            </div>
            <button class="close-modal-btn" style="background:rgba(255,255,255,0.1); color:#ccc; border:1px solid rgba(255,255,255,0.2); padding:6px 16px; border-radius:6px; font-size:11px; cursor:pointer;">閉じる</button>
        </div>`;
    modal.appendChild(inner);
    document.body.appendChild(modal);

    inner.querySelectorAll(".close-modal-btn").forEach(b => b.addEventListener("click", () => modal.remove()));
}
