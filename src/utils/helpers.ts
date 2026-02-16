// ===== Utility Functions =====

export function uuid(): string {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    const arr = new Uint8Array(16);
    window.crypto?.getRandomValues?.(arr);
    if (!arr.length) {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === "x" ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    arr[6] = (arr[6] & 0x0f) | 0x40;
    arr[8] = (arr[8] & 0x3f) | 0x80;
    const hex = Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function formatDateTimeForRecord(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${d} ${hh}:${mm}`;
}

export function parseDateStr(str: string): Date | null {
    const parts = str.split("-");
    if (parts.length !== 3) return null;
    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    const d = Number(parts[2]);
    return new Date(y, m, d);
}

export function simpleHash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash; // 32bit
    }
    return Math.abs(hash).toString(36).slice(0, 8);
}

export function parseRecordedAtToTs(recordedAt: any): number | null {
    if (!recordedAt) return null;
    if (typeof recordedAt === "number") return recordedAt;
    const match = recordedAt.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
    if (!match) return null;
    const [, y, m, d, hh, mm] = match.map(Number);
    return new Date(y, m - 1, d, hh, mm).getTime();
}
