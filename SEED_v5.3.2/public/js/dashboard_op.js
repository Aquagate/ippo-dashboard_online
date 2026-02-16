document.addEventListener('DOMContentLoaded', async () => {
    const taskListEl = document.getElementById('task-list');
    const detailViewEl = document.getElementById('detail-view');
    const userDisplay = document.getElementById('user-display');

    // User Context
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (user.role !== 'OPERATOR') {
        alert('Access Denied: You are not an Operator.');
        window.location.href = '/login.html';
        return;
    }
    userDisplay.innerText = `${user.name} (${user.dept})`;

    // Data Stores
    let data = { intakes: [], executions: [], drafts: [] };
    let currentFilter = 'inbox'; // inbox, processing, backed, history
    let currentTaskId = null;

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
            const [intakeRes, execRes, draftRes] = await Promise.all([
                fetch('/api/data/intakes'),
                fetch('/api/data/executions'),
                fetch('/api/data/drafts')
            ]);
            data.intakes = await intakeRes.json();
            data.executions = await execRes.json();
            data.drafts = await draftRes.json();

            // Sort: Newest first
            data.intakes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            renderList();
        } catch (e) { console.error(e); }
    }

    function renderList() {
        let filtered = [];
        const myName = user.name; // In real app, match ID

        if (currentFilter === 'inbox') {
            // Unassigned & Received
            filtered = data.intakes.filter(i => i.status === 'RECEIVED');
        } else if (currentFilter === 'processing') {
            // Processing or Assigned to me (Simulated by checking status for MVP)
            filtered = data.intakes.filter(i => i.status === 'PROCESSING'); // && assignee === me
        } else if (currentFilter === 'backed') {
            // Returned from SV
            filtered = data.intakes.filter(i => i.status === 'REVIEW_BACKED');
        } else if (currentFilter === 'history') {
            // Done or Resolved
            filtered = data.intakes.filter(i => ['DONE', 'RESOLVED', 'EXCEPTION'].includes(i.status));
        }

        taskListEl.innerHTML = filtered.map(item => `
            <div class="task-card" onclick="selectTask('${item.intake_id}')">
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-secondary);">
                    <span>${item.intake_id}</span>
                    <span>${new Date(item.created_at).toLocaleDateString()}</span>
                </div>
                <div style="font-weight:500; margin-top:4px;">${item.summary}</div>
                ${item.status === 'REVIEW_BACKED' ? '<span style="color:#ef4444; font-size:0.7rem;">⚠️ 差し戻し詳細を確認してください</span>' : ''}
            </div>
        `).join('');

        if (filtered.length === 0) taskListEl.innerHTML = '<div style="padding:20px; color:var(--text-secondary); text-align:center;">No tasks</div>';
    }

    // Load Manuals
    let manuals = {};
    try {
        const res = await fetch('/api/data/manuals_index');
        manuals = await res.json();
    } catch (e) { console.error('Manuals load error', e); }

    window.selectTask = (id) => {
        currentTaskId = id;
        const item = data.intakes.find(i => i.intake_id === id);

        // Render Detail
        let actionArea = '';

        if (item.status === 'RECEIVED') {
            actionArea = `<button class="btn-primary-xl" onclick="updateStatus('${id}', 'PROCESSING')">🚀 Start Work (着手)</button>`;
        } else if (item.status === 'PROCESSING' || item.status === 'REVIEW_BACKED') {
            const manualOptions = Object.entries(manuals).map(([k, v]) =>
                `<option value="${k}">${k}: ${v.title}</option>`
            ).join('');

            actionArea = `
                <div style="display:flex; gap:20px; margin-top:20px; align-items:flex-start;">
                    <!-- Nudge: Make the correct path obvious -->
                    <a href="/guide.html?intake_id=${id}" class="btn-primary-xl" style="text-decoration:none; flex:1; text-align:center;">
                        📋 Open Guide & Start Process
                        <div style="font-size:0.8rem; font-weight:normal; opacity:0.8; margin-top:4px;">Recommended Action</div>
                    </a>
                    
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <a href="/draft.html?intake_id=${id}" class="btn-secondary" style="text-decoration:none; text-align:center; padding:12px 20px;">
                            ✉️ Create Reply
                        </a>
                        <button class="btn-secondary" onclick="escalateToSV('${id}')" style="padding:12px 20px;">
                            ✋ Ask SV (Escalate)
                        </button>
                    </div>
                </div>
                ${item.status === 'REVIEW_BACKED' ? `
                    <div style="margin-top:20px; padding:15px; background:rgba(239, 68, 68, 0.15); border:1px solid #ef4444; border-radius:8px;">
                        <strong style="color:#fca5a5;">⚠️ Supervisor Feedback:</strong> <br>
                        ${getLatestComment(id)}
                    </div>
                ` : ''}

                <div style="margin-top:40px; border-top:1px solid var(--glass-border); padding-top:20px; background:rgba(0,0,0,0.1); padding:20px; border-radius:12px;">
                    <h3>✅ Complete Task</h3>
                    <p style="color:var(--text-secondary); font-size:0.9rem; margin-bottom:15px;">
                        作業を完了するには、参照したマニュアルと最終回答を入力してください。
                    </p>
                    
                    <div style="margin-bottom:15px;">
                        <label style="display:block; color:var(--text-secondary); font-size:0.85rem; margin-bottom:5px;">参照したマニュアル (Evidence) <span style="color:#ef4444;">*</span></label>
                        <select id="manual-ref" onchange="checkCompletion()" style="width:100%; padding:10px; background:rgba(0,0,0,0.3); border:1px solid var(--glass-border); color:white; border-radius:6px;">
                            <option value="">-- Select Manual --</option>
                            ${manualOptions}
                        </select>
                    </div>
                    <div style="margin-bottom:20px;">
                        <label style="display:block; color:var(--text-secondary); font-size:0.85rem; margin-bottom:5px;">最終回答 / 処置内容 <span style="color:#ef4444;">*</span></label>
                        <textarea id="final-answer" oninput="checkCompletion()" style="width:100%; height:80px; background:rgba(0,0,0,0.3); border:1px solid var(--glass-border); color:white; padding:10px; border-radius:6px;" placeholder="例: アカウント発行完了。パスワードを通知済み。"></textarea>
                    </div>
                    
                    <button id="btn-complete" class="btn-primary btn-disabled" onclick="completeTask('${id}')" disabled style="width:100%;">
                        Fill details to Complete
                    </button>
                </div>
            `;
        } else if (['DONE', 'RESOLVED', 'EXCEPTION'].includes(item.status)) {
            // History View
            const resInfo = item.resolution || {};
            const man = manuals[resInfo.manual_ref_id];
            actionArea = `
                <div style="margin-top:20px; padding:15px; background:rgba(255,255,255,0.05); border-radius:8px; border:1px solid var(--glass-border);">
                    <h4>Resolution Info</h4>
                    <p><strong>Status:</strong> ${item.status}</p>
                    <p><strong>Manual Ref:</strong> ${resInfo.manual_ref_id} (${man ? man.title : 'Unknown'})</p>
                    <p><strong>Answer:</strong> ${resInfo.final_answer || '-'}</p>
                    <p style="font-size:0.8rem; color:grey;">Resolved by: ${resInfo.resolved_by} at ${new Date(resInfo.resolved_at).toLocaleString()}</p>
                </div>
            `;
        }

        detailViewEl.innerHTML = `
            <div style="margin-bottom:20px;">
                <h2 style="margin-bottom:5px;">${item.summary}</h2>
                <div style="color:var(--text-secondary); font-size:0.9rem;">
                    Requester: ${item.requester} <span style="margin:0 10px;">|</span> Status: <strong style="color:${getStatusColor(item.status)}">${item.status}</strong>
                </div>
            </div>
            
            <div style="background:rgba(255,255,255,0.03); padding:20px; border-radius:12px; white-space:pre-wrap; border:1px solid var(--glass-border); margin-bottom:20px;">${item.details}</div>
            
            ${actionArea}
        `;
    };

    window.checkCompletion = () => {
        const manual = document.getElementById('manual-ref').value;
        const answer = document.getElementById('final-answer').value;
        const btn = document.getElementById('btn-complete');

        if (manual && answer.trim().length > 0) {
            btn.disabled = false;
            btn.classList.remove('btn-disabled');
            btn.innerHTML = "✅ Complete Task (完了)";
        } else {
            btn.disabled = true;
            btn.classList.add('btn-disabled');
            btn.innerHTML = "Fill details to Complete";
        }
    };

    function getStatusColor(s) {
        if (s === 'PROCESSING') return '#3b82f6';
        if (s === 'REVIEW_BACKED') return '#ef4444';
        if (s === 'REVIEW_WAITING') return '#f59e0b';
        if (s === 'DONE') return '#10b981';
        return 'var(--text-secondary)';
    }

    window.updateStatus = async (id, status) => {
        const item = data.intakes.find(i => i.intake_id === id);
        item.status = status;
        await saveIntakes();
        await refreshData();
        selectTask(id);
    };

    window.escalateToSV = async (id) => {
        const reason = prompt("エスカレーション/承認依頼のコメントを入力してください:");
        if (!reason) return;

        const item = data.intakes.find(i => i.intake_id === id);
        item.status = 'REVIEW_WAITING'; // Wait for SV

        // Add comment log (Simulated structure)
        if (!item.comments) item.comments = [];
        item.comments.push({
            user: user.name,
            role: 'OPERATOR',
            text: reason,
            at: new Date().toISOString()
        });

        await saveIntakes();
        await refreshData();
        detailViewEl.innerHTML = '<div style="text-align:center; margin-top:100px;">Task sent to Supervisor.</div>';
    };

    window.completeTask = async (id) => {
        const manualId = document.getElementById('manual-ref').value;
        const answer = document.getElementById('final-answer').value;

        if (!manualId) {
            alert('完了するには「参照マニュアル」の選択が必須です。\n該当なしの場合は「その他」を選択してください。');
            return;
        }
        if (!answer) {
            alert('「最終回答」を入力してください。');
            return;
        }

        const item = data.intakes.find(i => i.intake_id === id);
        item.status = 'DONE'; // Directly DONE for OP-only flow, or use separate Approved status if needed
        item.resolution = {
            resolved_at: new Date().toISOString(),
            resolved_by: user.name,
            manual_ref_id: manualId,
            final_answer: answer
        };

        await saveIntakes();
        await refreshData();
        detailViewEl.innerHTML = '<div style="text-align:center; margin-top:100px;">✅ Task Completed!</div>';
    };

    function getLatestComment(id) {
        const item = data.intakes.find(i => i.intake_id === id);
        if (item.comments && item.comments.length > 0) {
            const last = item.comments[item.comments.length - 1];
            return `${last.text} (by ${last.user})`;
        }
        return "No comments.";
    }

    async function saveIntakes() {
        await fetch('/api/data/intakes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data.intakes)
        });
    }
});
