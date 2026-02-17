// ===== Sync Settings UI View =====
// Handles OneDrive Settings Panel and Status Display

import {
    registerSyncCallbacks, syncInit, syncSignIn, syncSignOut, syncFlush, syncAutoConnect
} from '../../services/sync/syncManager';
import {
    odLoadSettings, odSaveSettings, odClearSettings, odLoadQueue
} from '../../services/storage/localStorage';
import { renderAll, renderNextMemos } from './ippoLog';
import { loadEntriesFromCache, loadNextMemosFromCache, importJsonFile, downloadJson } from '../../app/actions';
import { odGetRedirectUriDefault } from '../../services/sync/onedrive';

const DEFAULT_FILE_PATH = "/Apps/IppoDashboard/ippo_data.json";

function odEls() {
    return {
        details: document.getElementById("onedriveDetails"),
        clientId: document.getElementById("odClientId") as HTMLInputElement,
        tenant: document.getElementById("odTenant") as HTMLInputElement,
        redirectInput: document.getElementById("odRedirectInput") as HTMLInputElement,
        filePath: document.getElementById("odFilePath") as HTMLInputElement,
        status: document.getElementById("odStatus"),
        redirect: document.getElementById("odRedirectUri"),
        copyRedirect: document.getElementById("odCopyRedirect"),
        save: document.getElementById("odSave"),
        clear: document.getElementById("odClear"),
        signIn: document.getElementById("odSignIn") as HTMLButtonElement,
        signOut: document.getElementById("odSignOut") as HTMLButtonElement,
        syncNow: document.getElementById("odSyncNow") as HTMLButtonElement,
        exportBtn: document.getElementById("odExport"),
        importInput: document.getElementById("odImportInput"),
        syncState: document.getElementById("odSyncState"),
        lastSync: document.getElementById("odLastSync"),
        pendingCount: document.getElementById("odPendingCount"),
        lastError: document.getElementById("odLastError"),
    };
}

// UI Updaters

function updateStatus(text: string) {
    const el = odEls().status;
    if (el) el.textContent = text;
}

function updateSyncState(state: string) {
    const el = odEls().syncState;
    if (el) el.textContent = state;
}

function updateError(message: string) {
    const el = odEls().lastError;
    if (el) el.textContent = message;
    if (message && message !== "-") updateSyncState("エラー");
}

function updateSynced(timeStr: string) {
    const els = odEls();
    if (els.lastSync) els.lastSync.textContent = timeStr;
    if (els.lastError) els.lastError.textContent = "-";
    if (els.syncState) els.syncState.textContent = "同期済み"; // Overwritten by syncState callback
}

function updateQueueCount() {
    const el = odEls().pendingCount;
    if (el) {
        const queue = odLoadQueue();
        el.textContent = String(queue.length);
    }
}

function updateButtons() {
    const els = odEls();
    const hasSettings = !!(els.clientId?.value?.trim());
    // We don't have direct access to auth state here easily unless we track it or ask manager.
    // For simplicity, we can rely on status text or just enable sign-in if settings exist.
    // Ideally syncManager should expose `isAuthenticated()`.

    // But for Cycle 4, let's keep it simple.
    if (els.signIn) els.signIn.disabled = !hasSettings;
    // signOut/syncNow state depends on auth.
    // We can assume if status contains "接続:", we are signed in.
    const isConnected = els.status?.textContent?.includes("接続:") || false;

    if (els.signOut) els.signOut.disabled = !isConnected;
    if (els.syncNow) els.syncNow.disabled = !(isConnected && hasSettings);
}

// Init

export function initSyncUI(): void {
    try {
        console.log("Starting initSyncUI...");
        const els = odEls();
        if (!els.details) {
            console.warn("Element #onedriveDetails not found.");
            return;
        }

        // Load Settings
        const saved = odLoadSettings() || {};
        if (els.redirect) els.redirect.textContent = odGetRedirectUriDefault();
        if (saved.clientId) els.clientId.value = saved.clientId;
        if (saved.tenant) els.tenant.value = saved.tenant;
        if (els.redirectInput) els.redirectInput.value = saved.redirectUri || odGetRedirectUriDefault();
        if (els.filePath) els.filePath.value = saved.filePath || DEFAULT_FILE_PATH;

        console.log("Registering callbacks...");
        // Register Callbacks
        registerSyncCallbacks({
            onStatusChange: (status) => {
                updateStatus(status);
                updateButtons();
            },
            onSyncStateChange: (state) => {
                updateSyncState(state);
            },
            onError: (msg) => {
                updateError(msg);
            },
            onSynced: (ts) => {
                updateSynced(ts);
                updateQueueCount();
            },
            onDataUpdated: () => {
                // Reload & Render
                loadEntriesFromCache();
                loadNextMemosFromCache();
                renderAll();
                renderNextMemos();
                updateQueueCount();
            }
        });

        console.log("Attaching listeners...");
        // Attach Listeners
        if (els.save) {
            els.save.addEventListener("click", () => {
                console.log("Save clicked");
                const clientId = els.clientId.value.trim();
                const tenant = els.tenant.value.trim();
                const redirectUri = els.redirectInput.value.trim();
                const filePath = els.filePath.value.trim();

                if (!clientId) {
                    alert("Client ID を設定してください。");
                    return;
                }

                odSaveSettings({ clientId, tenant, redirectUri, filePath });
                updateStatus("設定保存 (再接続してね)");
                updateButtons();

                // Retrigger init
                syncInit();
            });
        } else {
            console.error("Save button #odSave not found!");
        }

        els.clear?.addEventListener("click", () => {
            if (!confirm("OneDrive設定をクリアしますか？")) return;
            odClearSettings();
            els.clientId.value = "";
            els.tenant.value = "";
            els.redirectInput.value = odGetRedirectUriDefault();
            els.filePath.value = DEFAULT_FILE_PATH;

            updateStatus("未接続");
            updateButtons();
        });

        els.signIn?.addEventListener("click", () => syncSignIn());
        els.signOut?.addEventListener("click", () => syncSignOut());
        els.syncNow?.addEventListener("click", () => syncFlush());

        els.exportBtn?.addEventListener("click", () => downloadJson());
        els.importInput?.addEventListener("change", async (ev) => {
            const file = (ev.target as HTMLInputElement).files?.[0];
            if (file) {
                await importJsonFile(file);
                (ev.target as HTMLInputElement).value = "";
            }
        });

        // Copy Redirect
        els.copyRedirect?.addEventListener("click", async () => {
            const txt = els.redirect?.textContent || "";
            try {
                await navigator.clipboard.writeText(txt);
                alert("コピーしました");
            } catch {
                prompt("コピーしてください", txt);
            }
        });

        // Queue count init
        updateQueueCount();

        // Initial sync check
        syncInit();

        console.log("initSyncUI completed.");

    } catch (e) {
        console.error("Critical Error in initSyncUI:", e);
        alert("Sync UI Init Error: " + e);
    }
}
