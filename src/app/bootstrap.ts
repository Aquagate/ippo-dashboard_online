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
 * Microsoft からのリダイレクト復帰時に handleRedirectPromise() を呼ぶ。
 * 認証失敗してもアプリの起動をブロックしない（オフラインファースト）。
 * @returns 認証処理が行われた場合は true
 */
async function handleAuthRedirect(): Promise<boolean> {
    const odSettings = odLoadSettings();
    if (!odSettings?.clientId) return false;

    try {
        const result = await odEnsureMsal({
            clientId: odSettings.clientId,
            tenant: odSettings.tenant,
            redirectUri: odSettings.redirectUri
        });

        if (result) {
            // 認証コールバックが処理された → URLをクリーンアップ
            const url = new URL(window.location.href);
            url.hash = "";
            url.search = "";
            window.history.replaceState({}, document.title, url.pathname);
            showToast("✅ サインインしました", "ok");
            return true;
        }
    } catch (e: any) {
        // 認証エラーが起きても、アプリは使い続けられる（オフラインファースト）
        console.warn("[Bootstrap] 認証リダイレクト処理エラー:", e.message || e);

        // URLにcode=やerror=が残っている場合はクリーンアップ
        const href = window.location.href;
        if (href.includes("code=") || href.includes("error=")) {
            const url = new URL(href);
            url.hash = "";
            url.search = "";
            window.history.replaceState({}, document.title, url.pathname);
        }
        // アプリの起動をブロックしない（throwしない）
    }

    return false;
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
    // handleAuthRedirect は失敗してもアプリの起動をブロックしない
    await handleAuthRedirect();

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
