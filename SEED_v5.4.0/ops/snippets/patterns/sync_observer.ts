/**
 * Pattern: Sync Observer (Decoupled Sync Logic)
 * Origin: Ippo Dashboard Online (SEED v5.3)
 * Description: Reference implementation of a Sync Manager that uses the Observer Pattern
 *              to notify multiple listeners (UI components) about sync status, errors, and data updates.
 *              This allows the UI to be completely decoupled from the sync logic.
 */

// Callbacks interface
export interface SyncCallbacks {
    onStatusChange?: (status: string) => void;
    onSyncStateChange?: (state: string) => void;
    onError?: (message: string) => void;
    onSynced?: (lastSyncTime: string) => void;
    onDataUpdated?: () => void;
}

// State
let listeners: SyncCallbacks[] = [];

// Method to register listeners
export function registerSyncCallbacks(callbacks: SyncCallbacks) {
    listeners.push(callbacks);
}

// Helper to notify all listeners
function notify(action: (cb: SyncCallbacks) => void) {
    listeners.forEach(cb => action(cb));
}

// Example Usage in a Sync Function
/*
export async function syncSomething() {
    notify(cb => cb.onSyncStateChange?.("Syncing..."));
    
    try {
        // do async work
        await someAsyncWork();
        
        notify(cb => cb.onStatusChange?.("Connected"));
        notify(cb => cb.onDataUpdated?.());
        notify(cb => cb.onSynced?.(new Date().toISOString()));
        
    } catch (e: any) {
        notify(cb => cb.onError?.(e.message));
    }
}
*/
