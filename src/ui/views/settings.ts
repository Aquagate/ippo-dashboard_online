// ===== Settings View =====
// Handles Backup/Restore/Reset UI logic

import { showToast } from '../toast';
import { dataCache, setDataCache } from '../../app/store';
import type { DataCache } from '../../domain/schema';
import {
    saveLastGood, restoreFromLastGood, storageSaveData, odLoadSettings, odSaveSettings
} from '../../services/storage/localStorage';
import { odClearQueue } from '../../services/storage/localStorage';

export function initSettings(): void {
    // Restore Last Good
    const btnRestore = document.getElementById("btnRestoreLastGood");
    if (btnRestore) {
        btnRestore.addEventListener("click", async () => {
            if (!confirm("前回正常起動時のデータに復元しますか？\n現在の未保存データは失われる可能性があります。")) return;

            const success = await restoreFromLastGood();
            if (success) {
                showToast("✅ 復元しました。リロードします...", "ok");
                setTimeout(() => location.reload(), 1500);
            } else {
                showToast("❌ 復元データが見つかりません", "err");
            }
        });
    }

    // Save Last Good (Manual Backup)
    const btnSave = document.getElementById("btnSaveLastGood");
    if (btnSave) {
        btnSave.addEventListener("click", async () => {
            await saveLastGood(dataCache);
            showToast("💾 現在の状態をバックアップしました", "ok");
        });
    }

    // Reset All Data
    const btnReset = document.getElementById("btnResetAll");
    if (btnReset) {
        btnReset.addEventListener("click", async () => {
            if (!confirm("⚠️ 【危険】本当に全データを削除しますか？\nこの操作は取り消せません。\n(OneDrive上のデータは消えません)")) return;

            // Clear in-memory
            const empty: DataCache = { schemaVersion: 2, entries: [], memos: [], simulations: [], dailyStates: {}, henzanAssets: [], reviewEvents: [], compassState: {} };
            setDataCache(empty);

            // Clear storage
            await storageSaveData(empty);
            odClearQueue();

            // Clear settings too? Maybe not settings, just data.
            // But user might want full reset. Let's keep settings for now or ask.
            // implementation_plan says "全データを削除". 
            // I'll stick to dataCache reset to avoid re-login hassle unless requested.

            showToast("🗑 全データを削除しました", "ok");
            setTimeout(() => location.reload(), 1000);
        });
    }
}
