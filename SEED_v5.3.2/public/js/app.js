document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('intake-form');
    const bridgeBtn = document.getElementById('btn-bridge');

    // Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            requester: document.getElementById('requester').value,
            channel: document.getElementById('channel').value,
            summary: document.getElementById('summary').value,
            details: document.getElementById('details').value
        };

        try {
            const res = await fetch('/api/intake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                showToast('✅ 送信しました！');
                form.reset();
            } else {
                showToast('❌ エラーが発生しました', true);
            }
        } catch (err) {
            console.error(err);
            showToast('❌ 接続エラー', true);
        }
    });

    // AI Bridge Context Export
    bridgeBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/bridge/context');
            const data = await res.json();

            if (data.context) {
                await navigator.clipboard.writeText(data.context);
                showToast('📋 AI用コンテキストをコピーしました！');
            } else {
                showToast('⚠️ データがありません', true);
            }
        } catch (err) {
            console.error(err);
            showToast('❌ コピーに失敗しました', true);
        }
    });
});

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.backgroundColor = isError ? '#ef4444' : '#10b981';
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}
