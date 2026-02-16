// ===== Debug Log =====

export function appendDebugLog(msg: string): void {
    const el = document.getElementById("debugLogArea") as HTMLTextAreaElement | null;
    if (!el) return;
    const time = new Date().toLocaleTimeString();
    el.value += `[${time}] ${msg}\n`;
    el.scrollTop = el.scrollHeight;
}
