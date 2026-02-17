// ===== Sync Manager (Logic Layer) =====
// Handles Sync Flow, Queue, and State.
// Decoupled from UI (uses callbacks).

import { mergeData } from '../../domain/merge';
import { dataCache, setDataCache } from '../../app/store';
import {
    odLoadQueue, odSaveQueue, odClearQueue, odSaveCache, odLoadSettings,
    odLoadSyncMeta, odSaveSyncMeta
} from '../storage/localStorage';
import {
    odEnsureMsal, odSignIn, odSignOut, odGetRemoteData, odPutRemoteData,
    odGetAccountName, OdAuthConfig
} from './onedrive';
import { formatDateTimeForRecord } from '../../utils/helpers';

// Callbacks interface
export interface SyncCallbacks {
    onStatusChange?: (status: string) => void;
    onSyncStateChange?: (state: string) => void;
    onError?: (message: string) => void;
    onSynced?: (lastSyncTime: string) => void;
    onDataUpdated?: () => void;
}

let listeners: SyncCallbacks[] = [];
let _isSyncing = false;
let _odEtag: string | null = null;

export function registerSyncCallbacks(callbacks: SyncCallbacks) {
    listeners.push(callbacks);
}

// Helper to notify all listeners
function notify(action: (cb: SyncCallbacks) => void) {
    listeners.forEach(cb => action(cb));
}

// Helper to get config from storage
function getConfig(): OdAuthConfig | null {
    const s = odLoadSettings();
    if (!s || !s.clientId) return null;
    return {
        clientId: s.clientId,
        tenant: s.tenant,
        redirectUri: s.redirectUri,
    };
}

function getFilePath(): string {
    const s = odLoadSettings();
    return s?.filePath || "/Apps/IppoDashboard/ippo_data.json";
}

// ===== Auth Actions =====

export async function syncInit(): Promise<void> {
    const config = getConfig();
    if (!config) {
        notify(cb => cb.onStatusChange?.("未接続 (設定なし)"));
        return;
    }

    try {
        await odEnsureMsal(config);
        const account = odGetAccountName();
        notify(cb => cb.onStatusChange?.(account ? `接続: ${account}` : "未接続"));

        // Restore meta state
        const meta = odLoadSyncMeta();
        if (meta.lastSync) notify(cb => cb.onSynced?.(meta.lastSync));
        if (meta.lastError && meta.lastError !== "-") notify(cb => cb.onError?.(meta.lastError));
        notify(cb => cb.onSyncStateChange?.(navigator.onLine ? "待機中" : "オフライン"));

    } catch (e: any) {
        notify(cb => cb.onError?.(e.message || String(e)));
    }
}

export async function syncSignIn(): Promise<void> {
    const config = getConfig();
    if (!config) throw new Error("設定が足りません (Client ID)");

    await odSignIn(config);
    const account = odGetAccountName();
    notify(cb => cb.onStatusChange?.(account ? `接続: ${account}` : "未接続"));

    await syncFetchAndMerge();
}

export async function syncSignOut(): Promise<void> {
    const config = getConfig();
    if (config) await odSignOut(config);
    notify(cb => cb.onStatusChange?.("未接続"));
}

// ===== Sync Logic =====

export async function syncFetchAndMerge(): Promise<void> {
    const config = getConfig();
    if (!config || !odGetAccountName() || !navigator.onLine) return;

    _isSyncing = true;
    notify(cb => cb.onSyncStateChange?.("同期中..."));

    try {
        const remote = await odGetRemoteData(config, getFilePath());
        _odEtag = remote.etag || _odEtag;

        if (remote.data) {
            const merged = mergeData(remote.data, dataCache);
            setDataCache(merged);
            await odSaveCache(merged);
        } else {
            // No remote data, upload local
            const newEtag = await odPutRemoteData(config, getFilePath(), dataCache, null);
            if (newEtag) _odEtag = newEtag;
        }

        notifySuccess();
    } catch (e: any) {
        notify(cb => cb.onError?.(e.message || String(e)));
    } finally {
        _isSyncing = false;
    }
}

export async function syncFlush(): Promise<void> {
    const config = getConfig();
    if (!config || !odGetAccountName() || !navigator.onLine) return;

    const queue = odLoadQueue();
    if (queue.length === 0) return; // Nothing to sync

    _isSyncing = true;
    notify(cb => cb.onSyncStateChange?.("送信中..."));

    try {
        // Optimistic: Try to push if we have an etag
        // But safer to always fetch-merge-push to avoid conflicts
        // Since we are decoupling, let's stick to the robust fetch-merge-push logic

        const remote = await odGetRemoteData(config, getFilePath());
        _odEtag = remote.etag || _odEtag;

        let toSave = dataCache;

        if (remote.data) {
            toSave = mergeData(remote.data, dataCache);
            setDataCache(toSave);
        }

        const newEtag = await odPutRemoteData(config, getFilePath(), toSave, _odEtag);
        if (newEtag) _odEtag = newEtag;

        odClearQueue();
        await odSaveCache(toSave);
        notifySuccess();

    } catch (e: any) {
        if (e.message === "etag_mismatch") {
            // Retry once
            notify(cb => cb.onSyncStateChange?.("競合解決中..."));
            try {
                const retryRemote = await odGetRemoteData(config, getFilePath());
                _odEtag = retryRemote.etag || _odEtag;

                const retryMerged = mergeData(retryRemote.data || { schemaVersion: 2, entries: [], memos: [], simulations: [], dailyStates: {} }, dataCache);
                setDataCache(retryMerged);

                const retryEtag = await odPutRemoteData(config, getFilePath(), retryMerged, _odEtag);
                if (retryEtag) _odEtag = retryEtag;

                odClearQueue();
                await odSaveCache(retryMerged);
                notifySuccess();
            } catch (inner: any) {
                notify(cb => cb.onError?.(inner.message || String(inner)));
            }
        } else {
            notify(cb => cb.onError?.(e.message || String(e)));
        }
    } finally {
        _isSyncing = false;
    }
}

// Auto Connect (Bootstrap)
export async function syncAutoConnect(): Promise<void> {
    await syncInit(); // Ensure MSAL init
    if (odGetAccountName() && navigator.onLine) {
        await syncFetchAndMerge();
    }
}

// Internal Helpers
function notifySuccess() {
    const now = new Date();
    const ts = formatDateTimeForRecord(now);
    notify(cb => cb.onSynced?.(ts));
    notify(cb => cb.onDataUpdated?.());
    notify(cb => cb.onSyncStateChange?.("同期済み"));
    odSaveSyncMeta({ lastSync: ts, lastError: "-" });
}
