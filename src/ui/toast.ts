// ===== Toast Notification System =====

export function showToast(message: string, type: "ok" | "warn" | "err" = "ok"): void {
    const containerId = "toastContainer";
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement("div");
        container.id = containerId;
        container.style.cssText = "position:fixed; top:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:8px;";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    const bgColor = type === "ok" ? "#10b981" : type === "warn" ? "#f59e0b" : "#ef4444";
    toast.style.cssText = `
    background: ${bgColor}; color: white; padding: 12px 16px; border-radius: 8px;
    font-size: 13px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); animation: slideIn 0.3s ease;
    max-width: 300px; word-wrap: break-word;
  `;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "fadeOut 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
