// ===== Bootstrap: アプリ初期化シーケンス =====

import { dataCache } from './store';
import {
    storageLoadData, saveLastGood,
    wasRecoveredFromLastGood, odLoadSettings,
} from '../services/storage/localStorage';
import {
    loadEntriesFromCache, loadNextMemosFromCache, migrateLegacyData,
} from './actions';
import { syncAutoConnect, syncFlush, startPeriodicSync } from '../services/sync/syncManager';
import { odEnsureMsal } from '../services/sync/onedrive';
import { renderAll, renderNextMemos } from '../ui/views/ippoLog';
import { initFutureLab } from '../ui/views/futureLab';
import { initHenzanRoom } from '../ui/views/henzanRoom';
import { initCompass } from '../ui/views/compassView';
import { initSettings } from '../ui/views/settings';
import { initSyncUI } from '../ui/views/syncSettings';
import { initSyncStatus } from '../ui/components/syncStatus';
import { initSyncBanner } from '../ui/components/syncBanner';
import { showToast } from '../ui/toast';

/**
 * MSAL リダイレクトの処理（認証コールバック）。
 * URL に code= や error= が含まれている場合に呼ばれる。
 * @returns 認証処理が行われた場合は true
 */
async function handleAuthRedirect(): Promise<boolean> {
    const hash = window.location.hash;
    const search = window.location.search;

    if (!hash.includes("code=") && !hash.includes("error=") && !search.includes("code=") && !search.includes("error=")) {
        return false;
    }

    // 認証処理中のUI表示
    const loadingDiv = document.createElement("div");
    loadingDiv.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); color:white; display:flex; flex-direction:column; justify-content:center; align-items:center; z-index:9999;";
    loadingDiv.innerHTML = `<h1>🔄 Processing Login...</h1><p>Please wait while we complete authentication.</p><div id="debug-status" style="margin-top:20px; font-family:monospace; font-size:12px; max-width:80%;">Initializing...</div>`;
    document.body.appendChild(loadingDiv);

    const statusDiv = document.getElementById("debug-status")!;
    const odSettings = odLoadSettings();

    if (odSettings?.clientId) {
        statusDiv.innerHTML = "Settings found. Calling MSAL...";
        try {
            const result = await odEnsureMsal({
                clientId: odSettings.clientId,
                tenant: odSettings.tenant,
                redirectUri: odSettings.redirectUri
            });

            if (result) {
                statusDiv.innerHTML = "✅ Authentication Successful! Resuming app...";
                const url = new URL(window.location.href);
                url.hash = "";
                url.search = "";
                window.history.replaceState({}, document.title, url.pathname);
                document.body.removeChild(loadingDiv);
            } else {
                statusDiv.innerHTML += "<br>⚠️ MSAL finished but returned no result. Proceeding...";
                setTimeout(() => document.body.removeChild(loadingDiv), 1000);
            }
        } catch (e: any) {
            loadingDiv.innerHTML = `
                <div style="padding:20px; font-family:sans-serif; color:white; background:darkred; height:100vh; width:100%;">
                    <h1>❌ Authentication Failed</h1>
                    <p>Could not complete sign-in.</p>
                    <div style="background:black; padding:10px; font-family:monospace;">
                        Error: ${e.message || e}
                    </div>
                    <div id="diag-area"></div>
                    <button onclick="window.location.reload()" style="margin-top:20px; padding:10px;">Reload App</button>
                </div>
            `;
            const diagArea = loadingDiv.querySelector("#diag-area")!;

            try {
                const currentOrigin = new URL(window.location.href).origin;
                const redirectOrigin = new URL(odSettings.redirectUri).origin;
                if (currentOrigin !== redirectOrigin) {
                    diagArea.innerHTML = `
                        <div style="margin-top:15px; background:#500; padding:10px; border:1px solid red;">
                            <strong>⚠️ CONFIG ERROR: Origin Mismatch</strong><br>
                            Current: ${currentOrigin}<br>
                            Config: ${redirectOrigin}<br>
                            Update Redirect URI in settings to match Current.
                        </div>`;
                }
            } catch { }

            const msalKeys = Object.keys(localStorage).filter(k => k.toLowerCase().includes("msal"));
            if (msalKeys.length === 0) {
                diagArea.innerHTML += `
                    <div style="margin-top:10px; border-top:1px solid #555; padding-top:5px;">
                        <strong>⚠️ Storage Error:</strong> No MSAL keys found in LocalStorage.
                    </div>`;
            }

            throw new Error("Authentication failed"); // 初期化を中断
        }
    } else {
        statusDiv.innerHTML += "<br>⚠️ No settings found. Proceeding...";
        setTimeout(() => document.body.removeChild(loadingDiv), 2000);
    }

    return true;
}

/**
 * タブ切り替えの初期化
 */
function initTabs(): void {
    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = (btn as HTMLElement).dataset.tab;
            if (target) switchTab(target);
        });
    });
}

export function switchTab(tabName: string): void {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.toggle("active", (btn as HTMLElement).dataset.tab === tabName);
    });
    document.getElementById("tabIppo")?.classList.toggle("active", tabName === "ippo");
    document.getElementById("tabFuture")?.classList.toggle("active", tabName === "future");
    document.getElementById("tabHenzan")?.classList.toggle("active", tabName === "henzan");
    document.getElementById("tabCompass")?.classList.toggle("active", tabName === "compass");
    document.getElementById("tabSettings")?.classList.toggle("active", tabName === "settings");
    if (tabName === "future") {
        initFutureLab();
    }
    if (tabName === "henzan") {
        initHenzanRoom();
    }
    if (tabName === "compass") {
        initCompass();
    }
}

/**
 * メインのブートストラップシーケンス。
 * DOMContentLoaded から呼ばれる。
 */
export async function bootstrap(): Promise<void> {
    // 0. 認証リダイレクトの処理（コールバック）
    try {
        await handleAuthRedirect();
    } catch {
        return; // 認証失敗時は初期化を中断
    }

    // 1. ストレージからデータ読み込み
    await storageLoadData();
    if (wasRecoveredFromLastGood()) {
        showToast("⚠️ データ破損を検出しました。前回正常起動時のバックアップから復旧しました。", "ok");
    }
    migrateLegacyData();
    loadEntriesFromCache();
    loadNextMemosFromCache();

    // 2. URLクエリパラメータからタブ復元
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab) switchTab(tab);

    // 3. UI描画
    renderAll();
    renderNextMemos();

    // 4. UI初期化
    initTabs();
    initSettings();
    initSyncUI();
    initSyncStatus();
    initSyncBanner(); // ヘッダー直下のサインインバナー

    // 5. 同期接続（バックグラウンド、fire-and-forget）
    // → 認証が失敗してもアプリは完全に使える（オフラインファースト）
    syncAutoConnect().then(() => {
        if (navigator.onLine) syncFlush().catch(() => {});
        startPeriodicSync(); // 5分間隔の定期同期を開始
    }).catch(() => {
        console.info("Sync unavailable. Running in offline mode.");
    });

    // 6. LastGoodバックアップ（復旧直後はスキップ）
    if (!wasRecoveredFromLastGood()) {
        setTimeout(() => {
            saveLastGood(dataCache);
        }, 5000);
    } else {
        // 復旧直後の場合、壊れたデータを上書きするリスクがあるため、
        // より長い遅延で安全性を確保（30秒後に保存）
        setTimeout(() => {
            saveLastGood(dataCache);
        }, 30000);
    }
}
