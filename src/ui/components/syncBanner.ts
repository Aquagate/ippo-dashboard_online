// ===== Sync Auth Banner =====
// ヘッダー直下に表示される同期ステータスバナー。
// 未認証時は「ワンタップでサインイン」、認証済みは自動非表示。
// 認証切れ時は穏やかに再認証を促す。

import { registerSyncCallbacks, syncSignIn } from '../../services/sync/syncManager';
import { odLoadSettings } from '../../services/storage/localStorage';

type BannerState = 'hidden' | 'needs_signin' | 'needs_reauth' | 'syncing' | 'connected' | 'offline';

let currentState: BannerState = 'hidden';

export function initSyncBanner(): void {
    const banner = document.getElementById('sync-auth-banner');
    if (!banner) return;

    // 設定がなければバナーも出さない
    const settings = odLoadSettings();
    if (!settings?.clientId) {
        banner.style.display = 'none';
        return;
    }

    // ベーススタイル
    banner.style.cssText = `
        margin: 0 auto;
        max-width: 960px;
        padding: 0 16px;
        transition: all 0.3s ease;
    `;

    function setBannerState(state: BannerState): void {
        if (state === currentState) return;
        currentState = state;

        if (state === 'hidden' || state === 'connected') {
            // 接続済み → 一瞬「同期済み」表示してからフェードアウト
            if (state === 'connected') {
                banner.style.display = 'block';
                banner.innerHTML = buildBannerHTML('connected');
                setTimeout(() => {
                    banner.style.opacity = '0';
                    setTimeout(() => { banner.style.display = 'none'; }, 300);
                }, 2000);
            } else {
                banner.style.display = 'none';
            }
            return;
        }

        banner.style.display = 'block';
        banner.style.opacity = '1';
        banner.innerHTML = buildBannerHTML(state);

        // サインインボタンのイベント
        const btn = banner.querySelector('#banner-signin-btn');
        if (btn) {
            btn.addEventListener('click', async () => {
                try {
                    setBannerState('syncing');
                    await syncSignIn();
                } catch {
                    // リダイレクトの場合はここに来ない
                }
            });
        }
    }

    function buildBannerHTML(state: BannerState): string {
        switch (state) {
            case 'needs_signin':
                return `
                    <div style="
                        display: flex; align-items: center; justify-content: space-between;
                        padding: 10px 16px; margin-top: 8px;
                        background: linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.12));
                        border: 1px solid rgba(59,130,246,0.25);
                        border-radius: 12px; gap: 12px; flex-wrap: wrap;
                    ">
                        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                            <span style="font-size:20px;">☁️</span>
                            <div style="min-width:0;">
                                <div style="font-size:13px; font-weight:600; color:#93c5fd;">OneDrive同期</div>
                                <div style="font-size:11px; color:#9ca3af;">サインインすると他のデバイスとデータが同期されます</div>
                            </div>
                        </div>
                        <button id="banner-signin-btn" type="button" style="
                            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                            color: white; border: none; padding: 8px 20px;
                            border-radius: 8px; font-size: 13px; font-weight: 600;
                            cursor: pointer; white-space: nowrap;
                            transition: transform 0.15s ease, box-shadow 0.15s ease;
                            box-shadow: 0 2px 8px rgba(59,130,246,0.3);
                        " onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
                            サインイン
                        </button>
                    </div>`;

            case 'needs_reauth':
                return `
                    <div style="
                        display: flex; align-items: center; justify-content: space-between;
                        padding: 10px 16px; margin-top: 8px;
                        background: linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.08));
                        border: 1px solid rgba(245,158,11,0.25);
                        border-radius: 12px; gap: 12px; flex-wrap: wrap;
                    ">
                        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                            <span style="font-size:20px;">🔑</span>
                            <div style="min-width:0;">
                                <div style="font-size:13px; font-weight:600; color:#fde68a;">セッション切れ</div>
                                <div style="font-size:11px; color:#9ca3af;">再サインインすると同期が再開します（ローカルデータは安全です）</div>
                            </div>
                        </div>
                        <button id="banner-signin-btn" type="button" style="
                            background: linear-gradient(135deg, #f59e0b, #d97706);
                            color: white; border: none; padding: 8px 20px;
                            border-radius: 8px; font-size: 13px; font-weight: 600;
                            cursor: pointer; white-space: nowrap;
                            transition: transform 0.15s ease;
                            box-shadow: 0 2px 8px rgba(245,158,11,0.3);
                        " onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
                            再サインイン
                        </button>
                    </div>`;

            case 'syncing':
                return `
                    <div style="
                        display: flex; align-items: center; justify-content: center;
                        padding: 10px 16px; margin-top: 8px;
                        background: rgba(59,130,246,0.08);
                        border: 1px solid rgba(59,130,246,0.15);
                        border-radius: 12px; gap: 10px;
                    ">
                        <span style="font-size:18px; animation: sync-spin 1s linear infinite; display:inline-block;">🔄</span>
                        <span style="font-size:13px; color:#93c5fd;">接続中...</span>
                    </div>`;

            case 'connected':
                return `
                    <div style="
                        display: flex; align-items: center; justify-content: center;
                        padding: 8px 16px; margin-top: 8px;
                        background: rgba(34,197,94,0.08);
                        border: 1px solid rgba(34,197,94,0.2);
                        border-radius: 12px; gap: 8px;
                    ">
                        <span style="font-size:16px;">✅</span>
                        <span style="font-size:13px; color:#86efac;">同期済み</span>
                    </div>`;

            case 'offline':
                return `
                    <div style="
                        display: flex; align-items: center; justify-content: center;
                        padding: 8px 16px; margin-top: 8px;
                        background: rgba(107,114,128,0.08);
                        border: 1px solid rgba(107,114,128,0.15);
                        border-radius: 12px; gap: 8px;
                    ">
                        <span style="font-size:16px;">📱</span>
                        <span style="font-size:12px; color:#9ca3af;">ローカルモードで動作中（オンライン復帰時に自動同期）</span>
                    </div>`;

            default:
                return '';
        }
    }

    // ===== コールバック登録 =====
    registerSyncCallbacks({
        onStatusChange: (status: string) => {
            if (status.startsWith("接続")) {
                setBannerState('connected');
            } else if (status.includes("認証期限切れ")) {
                setBannerState('needs_reauth');
            } else if (status === "未接続" || status === "未接続 (設定なし)") {
                // 設定はあるが未サインイン
                if (settings?.clientId) {
                    setBannerState('needs_signin');
                }
            }
        },
        onSyncStateChange: (state: string) => {
            if (state.includes("同期中") || state.includes("送信中")) {
                setBannerState('syncing');
            } else if (state === "オフライン") {
                setBannerState('offline');
            } else if (state.includes("要・再認証") || state.includes("🔑")) {
                setBannerState('needs_reauth');
            } else if (state === "同期済み") {
                setBannerState('connected');
            }
        },
        onError: (msg: string) => {
            if (msg === "auth_session_expired" || msg.includes("サインインしてません")) {
                setBannerState('needs_reauth');
            }
        },
        onSynced: () => {
            // syncInit時の過去情報のリストアでも呼ばれるため、ここでは状態変更しない。
            // 実際の同期成功時は onSyncStateChange("同期済み") が呼ばれるのでそちらに任せる。
        }
    });

    // 初期状態: 起動時にサインインが必要かチェック
    // （bootstrapで syncAutoConnect → syncInit が呼ばれ、コールバック経由で状態が設定される）
}
