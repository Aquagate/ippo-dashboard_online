/**
 * Utility functions for Ops OS
 */

// Simple Toast Notification
function showToast(message, type = 'info') {
    // Create container if not exists
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');

    // Colors based on type
    let bg = 'rgba(30, 41, 59, 0.9)';
    let border = '1px solid rgba(255, 255, 255, 0.1)';
    let icon = 'ℹ️';

    if (type === 'success') {
        bg = 'rgba(16, 185, 129, 0.9)'; // Green
        border = '1px solid #059669';
        icon = '✅';
    } else if (type === 'error') {
        bg = 'rgba(239, 68, 68, 0.9)'; // Red
        border = '1px solid #b91c1c';
        icon = '❌';
    } else if (type === 'warning') {
        bg = 'rgba(245, 158, 11, 0.9)'; // Orange
        border = '1px solid #d97706';
        icon = '⚠️';
    }

    toast.style.cssText = `
        background: ${bg};
        border: ${border};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        gap: 10px;
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.3s ease;
        min-width: 250px;
    `;

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    // Remove after 3s
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => {
            if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 300);
    }, 3000);
}

// Unified Logout Function
async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        showToast('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 800);
    } catch (e) {
        console.error(e);
        // Force redirect anyway
        window.location.href = '/login.html';
    }
}

// Export to window
window.showToast = showToast;
window.handleLogout = handleLogout;
