// ===== IndexedDB Wrapper =====
// Minimal key-value store on top of IndexedDB.
// No external dependencies.

const DB_NAME = "ippo_dashboard";
const DB_VERSION = 1;
const STORE_NAME = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function idbOpen(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
            dbPromise = null;
            reject(req.error);
        };
    });
    return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
    const db = await idbOpen();
    return new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
    });
}

export async function idbSet(key: string, value: unknown): Promise<void> {
    const db = await idbOpen();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function idbDelete(key: string): Promise<void> {
    const db = await idbOpen();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}
