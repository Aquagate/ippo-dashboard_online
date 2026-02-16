import { setSyncCallbacks } from '../../services/sync/syncManager';

export function initSyncStatus(): void {
    // Create UI Container
    const container = document.createElement('div');
    container.id = 'sync-status-indicator';
    container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        transition: all 0.3s ease;
        opacity: 0.8;
        pointer-events: none; /* Let clicks pass through unless we add interactivity */
        border: 1px solid rgba(255, 255, 255, 0.1);
    `;

    const icon = document.createElement('span');
    icon.textContent = '☁️'; // Default

    const text = document.createElement('span');
    text.textContent = '待機中';

    container.appendChild(icon);
    container.appendChild(text);
    document.body.appendChild(container);

    // Register Callbacks
    setSyncCallbacks({
        onStatusChange: (status: string) => {
            // "接続: user" or "未接続"
            if (status.startsWith("接続")) {
                container.title = status;
            } else {
                text.textContent = status;
                icon.textContent = '🔌';
                container.style.border = '1px solid #666';
            }
        },
        onSyncStateChange: (state: string) => {
            text.textContent = state;
            container.style.opacity = '1.0';

            if (state.includes("同期中") || state.includes("送信中")) {
                icon.textContent = '🔄';
                icon.style.animation = 'spin 1s linear infinite';
                container.style.borderColor = '#3b82f6'; // Blue
                container.style.color = '#bfdbfe';
            } else if (state === "オフライン") {
                icon.textContent = '📴';
                icon.style.animation = '';
                container.style.borderColor = '#6b7280'; // Gray
                container.style.color = '#9ca3af';
            } else {
                // Idle / Synced
                icon.textContent = '☁️';
                icon.style.animation = '';
                container.style.borderColor = '#22c55e'; // Green
                container.style.color = '#bbf7d0';

                // Fade out after 3s
                setTimeout(() => {
                    if (text.textContent === state) {
                        container.style.opacity = '0.5';
                    }
                }, 3000);
            }
        },
        onError: (msg: string) => {
            console.error("Sync Error:", msg);
            text.textContent = "エラー";
            container.title = msg;
            icon.textContent = '⚠️';
            icon.style.animation = '';
            container.style.borderColor = '#ef4444'; // Red
            container.style.color = '#fca5a5';
            container.style.opacity = '1.0';
        },
        onSynced: (ts: string) => {
            container.title = `Last Synced: ${ts}`;
        }
    });

    // Add CSS animation for spin
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}
