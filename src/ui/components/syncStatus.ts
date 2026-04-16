// ===== Sync Status Indicator =====
// 右下のフローティングインジケーター。同期状態を直感的に表示。
// Tier 3: 認証期限切れを「自然な状態」として表示 + クリックで再認証可能。

import { registerSyncCallbacks, syncSignIn } from '../../services/sync/syncManager';
import { odLoadQueue } from '../../services/storage/localStorage';

// 状態定義: アイコン・色・テキストを統一管理
interface SyncVisual {
    icon: string;
    text: string;
    borderColor: string;
    textColor: string;
    animate: boolean;
    clickable: boolean;
    fadeAfter: number | null; // ms後にフェードアウト（nullなら常時表示）
}

const SYNC_VISUALS: Record<string, SyncVisual> = {
    synced: {
        icon: '☁️', text: '同期済み',
        borderColor: '#22c55e', textColor: '#bbf7d0',
        animate: false, clickable: false, fadeAfter: 3000,
    },
    syncing: {
        icon: '🔄', text: '同期中...',
        borderColor: '#3b82f6', textColor: '#bfdbfe',
        animate: true, clickable: false, fadeAfter: null,
    },
    sending: {
        icon: '🔄', text: '送信中...',
        borderColor: '#3b82f6', textColor: '#bfdbfe',
        animate: true, clickable: false, fadeAfter: null,
    },
    offline: {
        icon: '📱', text: 'ローカルモード',
        borderColor: '#6b7280', textColor: '#9ca3af',
        animate: false, clickable: false, fadeAfter: 5000,
    },
    authExpired: {
        icon: '🔑', text: '再認証が必要',
        borderColor: '#f59e0b', textColor: '#fde68a',
        animate: false, clickable: true, fadeAfter: null, // 常時表示（要アクション）
    },
    error: {
        icon: '⚠️', text: 'エラー',
        borderColor: '#ef4444', textColor: '#fca5a5',
        animate: false, clickable: false, fadeAfter: null,
    },
    waiting: {
        icon: '☁️', text: '待機中',
        borderColor: '#6b7280', textColor: '#9ca3af',
        animate: false, clickable: false, fadeAfter: 5000,
    },
    disconnected: {
        icon: '🔌', text: '未接続',
        borderColor: '#6b7280', textColor: 'white',
        animate: false, clickable: false, fadeAfter: null,
    },
};

export function initSyncStatus(): void {
    // ===== DOM構築 =====
    const container = document.createElement('div');
    container.id = 'sync-status-indicator';
    container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: white;
        padding: 8px 14px;
        border-radius: 20px;
        font-size: 12px;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        transition: all 0.3s ease;
        opacity: 0.8;
        cursor: default;
        border: 1px solid rgba(255, 255, 255, 0.1);
        user-select: none;
    `;

    const icon = document.createElement('span');
    icon.id = 'sync-status-icon';
    icon.textContent = '☁️';
    icon.style.cssText = 'font-size: 14px; line-height: 1;';

    const text = document.createElement('span');
    text.id = 'sync-status-text';
    text.textContent = '待機中';
    text.style.cssText = 'font-size: 12px; white-space: nowrap;';

    // 未送信件数バッジ
    const badge = document.createElement('span');
    badge.id = 'sync-status-badge';
    badge.style.cssText = `
        display: none;
        background: #f59e0b;
        color: #000;
        font-size: 10px;
        font-weight: bold;
        padding: 1px 5px;
        border-radius: 8px;
        min-width: 16px;
        text-align: center;
        line-height: 14px;
    `;

    container.appendChild(icon);
    container.appendChild(text);
    container.appendChild(badge);
    document.body.appendChild(container);

    // ===== フェード管理 =====
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;

    function applyVisual(key: string, customText?: string): void {
        const visual = SYNC_VISUALS[key] || SYNC_VISUALS.waiting;

        icon.textContent = visual.icon;
        text.textContent = customText || visual.text;
        container.style.borderColor = visual.borderColor;
        container.style.color = visual.textColor;
        container.style.opacity = '1.0';

        // アニメーション
        icon.style.animation = visual.animate ? 'sync-spin 1s linear infinite' : '';

        // クリック可能状態
        container.style.cursor = visual.clickable ? 'pointer' : 'default';
        container.style.pointerEvents = visual.clickable ? 'auto' : 'none';

        // フェード制御
        if (fadeTimer) clearTimeout(fadeTimer);
        if (visual.fadeAfter !== null) {
            fadeTimer = setTimeout(() => {
                // テキストが変わっていなければフェード
                if (text.textContent === (customText || visual.text)) {
                    container.style.opacity = '0.4';
                }
            }, visual.fadeAfter);
        }
    }

    // ===== キュー数更新 =====
    function updateBadge(): void {
        const queue = odLoadQueue();
        if (queue.length > 0) {
            badge.textContent = String(queue.length);
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    }

    // ===== クリックで再認証 =====
    container.addEventListener('click', async () => {
        if (container.style.cursor !== 'pointer') return;
        try {
            applyVisual('syncing', '再接続中...');
            await syncSignIn();
        } catch {
            // syncSignInがリダイレクトする場合はここには来ない
            // ssoSilent成功ならそのまま同期される
        }
    });

    // ===== コールバック登録 =====
    registerSyncCallbacks({
        onStatusChange: (status: string) => {
            if (status.startsWith("接続")) {
                container.title = status;
                applyVisual('synced', '接続済み');
            } else if (status.includes("認証期限切れ")) {
                applyVisual('authExpired');
                container.title = 'クリックして再認証';
            } else {
                applyVisual('disconnected', status);
            }
        },
        onSyncStateChange: (state: string) => {
            if (state.includes("同期中")) {
                applyVisual('syncing');
            } else if (state.includes("送信中")) {
                applyVisual('sending');
            } else if (state === "オフライン") {
                applyVisual('offline');
            } else if (state.includes("要・再認証") || state.includes("🔑")) {
                applyVisual('authExpired');
                container.title = 'クリックして再認証';
            } else if (state.includes("競合")) {
                applyVisual('syncing', '競合解決中...');
            } else if (state === "同期済み" || state === "接続済み") {
                applyVisual('synced', state);
            } else {
                applyVisual('waiting', state);
            }
            updateBadge();
        },
        onError: (msg: string) => {
            console.error("Sync Error:", msg);
            // 認証エラーは authExpired として表示（赤エラーにしない）
            if (msg === "auth_session_expired" || msg.includes("サインインしてません")) {
                applyVisual('authExpired');
                container.title = 'クリックして再認証';
            } else {
                applyVisual('error');
                container.title = msg;
            }
        },
        onSynced: (ts: string) => {
            container.title = `最終同期: ${ts}`;
            updateBadge();
        }
    });

    // ===== CSSアニメーション注入 =====
    const style = document.createElement('style');
    style.textContent = `
        @keyframes sync-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        #sync-status-indicator:hover {
            opacity: 1.0 !important;
        }
    `;
    document.head.appendChild(style);

    // ===== 初期キュー数表示 =====
    updateBadge();
}
