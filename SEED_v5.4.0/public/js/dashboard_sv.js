document.addEventListener('DOMContentLoaded', async () => {
    const taskListEl = document.getElementById('task-list');
    const detailViewEl = document.getElementById('detail-view');
    const userDisplay = document.getElementById('user-display');

    // User Context
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (user.role !== 'SV') {
        alert('Access Denied: You are not a Supervisor.');
        window.location.href = '/login.html';
        return;
    }
    userDisplay.innerText = `${user.name}`;

    // Data Stores
    let data = { intakes: [] };
    let currentFilter = 'approval';

    window.filterTasks = (filter) => {
        currentFilter = filter;
        document.querySelectorAll('.nav-item').forEach(el => {
            if (el.innerText.toLowerCase().includes(filter)) el.classList.add('active');
            else el.classList.remove('active');
        });
        renderList();
    };

    // Initial Load
    await refreshData();

    async function refreshData() {
        try {
            const res = await fetch('/api/data/intakes');
            data.intakes = await res.json();
            data.intakes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            renderList();
        } catch (e) { console.error(e); }
    }

    function renderList() {
        let filtered = [];
        if (currentFilter === 'approval') {
            filtered = data.intakes.filter(i => i.status === 'REVIEW_WAITING');
        } else if (currentFilter === 'exceptions') {
            filtered = data.intakes.filter(i => i.status === 'EXCEPTION');
        } else {
            filtered = data.intakes;
        }

        taskListEl.innerHTML = filtered.map(item => `
            <div style="padding:12px; border-bottom:1px solid rgba(255,255,255,0.1); cursor:pointer;" onclick="selectTask('${item.intake_id}')">
                <div style="font-size:0.8rem; color:var(--text-secondary);">${item.intake_id}</div>
                <div style="font-weight:500;">${item.summary}</div>
                <div style="font-size:0.75rem; color:${getStatusColor(item.status)};">${item.status}</div>
            </div>
        `).join('');
    }

    window.selectTask = (id) => {
        const item = data.intakes.find(i => i.intake_id === id);

        let commentsHtml = '';
        if (item.comments) {
            commentsHtml = item.comments.map(c => `
                <div style="margin-bottom:8px; padding:8px; background:rgba(255,255,255,0.05); border-radius:4px; font-size:0.9rem;">
                    <strong>${c.user} (${c.role})</strong>: ${c.text}
                </div>
            `).join('');
        }

        let resolutionHtml = '';
        if (item.resolution) {
            resolutionHtml = `
                <div style="margin-bottom:20px; padding:15px; background:rgba(16, 185, 129, 0.1); border:1px solid #10b981; border-radius:8px;">
                    <h4>✅ Resolution Report</h4>
                    <p><strong>Manual Ref:</strong> ${item.resolution.manual_ref_id}</p>
                    <p><strong>Answer:</strong> ${item.resolution.final_answer}</p>
                    <p style="font-size:0.8rem; color:grey;">By ${item.resolution.resolved_by}</p>
                </div>
            `;
        }

        detailViewEl.innerHTML = `
            <h2>${item.summary}</h2>
            <div style="margin-bottom:20px;">Requester: ${item.requester}</div>
            <div style="padding:15px; background:rgba(0,0,0,0.2); border-radius:8px;">${item.details}</div>
            
            <div style="margin-top:20px;">
                ${resolutionHtml}
                <h3>Comments History</h3>
                ${commentsHtml || '<div style="color:grey;">No comments</div>'}
            </div>

            <div style="margin-top:30px; border-top:1px dashed grey; padding-top:20px;">
                <h3>Supervisor Actions</h3>
                <textarea id="sv-comment" style="width:100%; height:80px; background:rgba(0,0,0,0.3); border:1px solid grey; color:white; padding:8px;" placeholder="Comment..."></textarea>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button class="btn-primary" onclick="processTask('${id}', 'RESOLVED')">Approve (承認)</button>
                    <button class="btn-secondary" onclick="processTask('${id}', 'REVIEW_BACKED')" style="border-color:#ef4444; color:#ef4444;">Reject / Back (差し戻し)</button>
                    <button class="btn-secondary" onclick="processTask('${id}', 'ESCALATED_TO_PM')">Escalate to PM</button>
                </div>
            </div>
        `;
    };

    window.processTask = async (id, newStatus) => {
        const comment = document.getElementById('sv-comment').value;
        if (!comment && newStatus === 'REVIEW_BACKED') {
            alert('差し戻しの場合はコメントが必須です。');
            return;
        }

        const item = data.intakes.find(i => i.intake_id === id);
        item.status = newStatus;
        if (comment) {
            if (!item.comments) item.comments = [];
            item.comments.push({
                user: user.name,
                role: 'SV',
                text: comment,
                at: new Date().toISOString()
            });
        }

        await fetch('/api/data/intakes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data.intakes)
        });

        await refreshData();
        detailViewEl.innerHTML = '<div style="text-align:center; margin-top:100px;">Task Processed.</div>';
    };

    function getStatusColor(s) {
        if (s === 'REVIEW_WAITING') return '#f59e0b';
        if (s === 'EXCEPTION') return '#ef4444';
        return 'grey';
    }
});
