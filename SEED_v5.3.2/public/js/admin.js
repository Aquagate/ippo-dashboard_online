document.addEventListener('DOMContentLoaded', async () => {
    const taskListEl = document.getElementById('task-list');
    const detailViewEl = document.getElementById('detail-view');

    // Data Stores
    let data = {
        intakes: [],
        executions: [],
        exceptions: [],
        drafts: [],
        checklists: {}
    };

    let currentTab = 'inbox'; // inbox, waiting, resolved, done, process
    let currentTaskId = null;
    let currentChecklistKey = null;

    window.switchTab = (tabName) => {
        currentTab = tabName;
        // Visual update tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.getAttribute('onclick').includes(tabName)) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // Toggle Views
        const detailView = document.getElementById('detail-view');
        const processView = document.getElementById('process-view');
        const taskList = document.getElementById('task-list');

        if (tabName === 'process') {
            detailView.classList.add('hidden');
            processView.classList.remove('hidden');
            taskList.parentElement.style.opacity = '0.5'; // Dim sidebar
            taskList.parentElement.style.pointerEvents = 'none';
            loadProcessEditor();
        } else {
            detailView.classList.remove('hidden');
            processView.classList.add('hidden');
            taskList.parentElement.style.opacity = '1';
            taskList.parentElement.style.pointerEvents = 'auto';
            renderList();
        }
    };

    // Initial Load
    await refreshData();

    async function refreshData() {
        try {
            const [intakeRes, execRes, excepRes, draftRes, checkRes] = await Promise.all([
                fetch('/api/data/intakes'),
                fetch('/api/data/executions'),
                fetch('/api/data/exceptions'),
                fetch('/api/data/drafts'),
                fetch('/api/data/checklists')
            ]);

            data.intakes = await intakeRes.json();
            data.executions = await execRes.json();
            data.exceptions = await excepRes.json();
            data.drafts = await draftRes.json();
            data.checklists = await checkRes.json();

            // 新しい順
            data.intakes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            if (currentTab !== 'process') renderList();
        } catch (err) {
            console.error(err);
        }
    }

    // --- Process Editor Logic ---
    function loadProcessEditor() {
        const selector = document.getElementById('checklist-selector');
        const listKeys = Object.keys(data.checklists);

        selector.innerHTML = listKeys.map(key => `
            <div style="padding: 10px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.1); ${key === currentChecklistKey ? 'background: rgba(255,255,255,0.1);' : ''}"
                 onclick="selectChecklist('${key}')">
                📄 ${key}
            </div>
        `).join('');
    }

    window.selectChecklist = (key) => {
        currentChecklistKey = key;
        loadProcessEditor(); // refresh selection highlight

        const targetData = data.checklists[key];
        document.getElementById('editor-target-id').innerText = key;
        document.getElementById('rules-editor').value = JSON.stringify(targetData, null, 4);
    };

    window.deployRules = async () => {
        if (!currentChecklistKey) return;

        const content = document.getElementById('rules-editor').value;
        const reason = document.getElementById('change-reason').value;
        if (!reason) { alert('Change Reason is required.'); return; }

        try {
            const newRules = JSON.parse(content);
            data.checklists[currentChecklistKey] = newRules;

            // 1. Save Checklist
            await fetch('/api/data/checklists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data.checklists) // Save ALL checklists (careful: race condition risk)
            });

            // 2. Log Change Request
            let log = [];
            try { log = await (await fetch('/api/data/change_requests')).json(); } catch (e) { }

            log.push({
                cr_id: `CR-${Date.now()}`,
                target: `checklists.json [${currentChecklistKey}]`,
                reason: reason,
                deployed_at: new Date().toISOString()
            });
            await fetch('/api/data/change_requests', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(log)
            });

            showToast('🚀 Rules Deployed successfully!', 'success');
        } catch (e) {
            alert('JSON Syntax Error: ' + e.message);
        }
    };

    function renderList() {
        // Filter by Tab
        const filtered = data.intakes.filter(i => {
            const s = i.status;
            if (currentTab === 'inbox') return s === 'RECEIVED';
            if (currentTab === 'waiting') return s === 'EXCEPTION';
            if (currentTab === 'resolved') return s === 'RESOLVED'; // 仮: 新設ステータス
            if (currentTab === 'done') return s === 'DONE';
            return false;
        });

        taskListEl.innerHTML = filtered.map(item => `
            <div class="task-item ${item.intake_id === currentTaskId ? 'active' : ''}" onclick="selectTask('${item.intake_id}')">
                <div class="meta">
                    <span>${item.intake_id}</span>
                </div>
                <div class="title">${item.summary}</div>
                <div class="meta" style="margin-top: 4px;">
                    <span style="font-size: 0.7rem;">${new Date(item.created_at).toLocaleString('ja-JP')}</span>
                </div>
            </div>
        `).join('');

        if (filtered.length === 0) {
            taskListEl.innerHTML = `<div style="padding:20px; text-align:center; color: var(--text-secondary);">No items</div>`;
        }
    }

    window.selectTask = (id) => {
        currentTaskId = id;
        renderList(); // Re-render to show active state

        const item = data.intakes.find(i => i.intake_id === id);
        if (!item) return;

        // Generate Timeline Events
        const events = [];

        // 1. Intake
        events.push({
            type: 'intake',
            time: item.created_at,
            label: '申請受信',
            desc: `Requester: ${item.requester}`
        });

        // 2. Executions
        const execs = data.executions.filter(e => e.intake_id === id);
        execs.forEach(e => events.push({
            type: 'execution',
            time: e.completed_at,
            label: 'ガイド実行完了',
            desc: `Checklist passed`
        }));

        // 3. Exceptions
        const excepts = data.exceptions.filter(e => e.intake_id === id);
        excepts.forEach(e => events.push({
            type: 'exception',
            time: e.resolved_at || e.created_at || new Date().toISOString(), // fallback
            label: `例外裁定: ${e.decision}`,
            desc: e.rationale
        }));

        // 4. Drafts
        const drafts = data.drafts.filter(d => d.intake_id === id);
        drafts.forEach(d => events.push({
            type: 'draft',
            time: d.created_at,
            label: 'ドラフト作成',
            desc: `Subject: ${d.subject}`
        }));

        // Sort by Time
        events.sort((a, b) => new Date(a.time) - new Date(b.time));


        // Render Detail View
        const isDone = item.status === 'DONE';
        const isException = item.status === 'EXCEPTION';
        const isResolved = item.status === 'RESOLVED';

        // Timeline HTML
        const timelineHtml = events.map(e => `
            <div class="timeline-item type-${e.type}">
                <div class="timeline-time">${new Date(e.time).toLocaleString('ja-JP')}</div>
                <div class="timeline-content">
                    <strong>${e.label}</strong>
                    <div>${e.desc}</div>
                </div>
            </div>
        `).join('');

        detailViewEl.innerHTML = `
            <div>
                <span class="status-badge status-${item.status.toLowerCase()}">${item.status}</span>
                <span style="color: var(--text-secondary); margin-left: 10px;">${item.intake_id}</span>
            </div>
            <h2 style="margin-top: 10px; border: none;">${item.summary}</h2>
            
            <div class="field-value">
                <div class="field-label">依頼者</div>
                <div class="field-content">${item.requester}</div>
            </div>
            <div class="field-value">
                <div class="field-label">詳細</div>
                <div class="field-content" style="white-space: pre-wrap; background: rgba(0,0,0,0.1); padding: 10px; border-radius: 8px;">${item.details}</div>
            </div>

            <!-- Action Area -->
            <div class="exception-controls">
                <h3>次のアクション</h3>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <a href="/guide.html?intake_id=${id}" class="btn-secondary" style="text-decoration: none;">📋 ガイドを開く</a>
                    
                    ${item.status !== 'DONE' ? `
                    <button class="btn-primary" onclick="updateStatus('${id}', 'DONE')">完了にする</button>
                    ` : ''}
                    
                    ${item.status === 'EXCEPTION' ? `
                     <!-- Exception Handling Form is handled below -->
                    ` : ''}
                </div>
                
                ${isException ? `
                <div style="margin-top: 20px; background: rgba(239, 68, 68, 0.1); padding: 15px; border-radius: 8px;">
                    <h4>例外裁定 (管理者のみ)</h4>
                    <textarea class="rationale-input" id="rationale" placeholder="コメントを入力..."></textarea>
                    <div style="display: flex; gap: 10px;">
                            <button class="btn-primary" onclick="resolveException('${id}', 'APPROVED')">承認してResolvedへ</button>
                            <button class="btn-secondary" onclick="resolveException('${id}', 'REJECTED')">却下してResolvedへ</button>
                    </div>
                </div>
                ` : ''}
            </div>

            <!-- Timeline -->
            <div class="timeline-section">
                <h3>処理履歴 (Timeline)</h3>
                <div class="timeline">
                    ${timelineHtml}
                </div>
            </div>
        `;
    };

    window.updateStatus = async (id, newStatus) => {
        try {
            // Optimistic Update
            const currentIntakes = data.intakes;
            const idx = currentIntakes.findIndex(i => i.intake_id === id);

            if (idx !== -1) {
                currentIntakes[idx].status = newStatus;
                renderList(); // Immediate reflection

                // Call dedicated API (Implemented in P1-04)
                await fetch(`/api/intake/${id}/status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });

                showToast(`Status updated to ${newStatus}`, 'success');
                await refreshData();
                selectTask(id);
            }
        } catch (e) {
            console.error(e);
            showToast('Failed to update status', 'error');
            await refreshData(); // Revert on error
        }
    };

    window.resolveException = async (id, decision) => {
        const rationale = document.getElementById('rationale').value;
        if (!rationale) { alert('コメントを入力してください'); return; }

        try {
            // Save log
            let exceptions = data.exceptions;
            exceptions.push({
                exception_id: `EX-${Date.now()}`,
                intake_id: id,
                decision: decision,
                rationale: rationale,
                resolved_at: new Date().toISOString()
            });

            await fetch('/api/data/exceptions', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(exceptions)
            });

            // Update Status -> RESOLVED (SV判断済み)
            await updateStatus(id, 'RESOLVED'); // 'DONE' ではなく 'RESOLVED' にして作業者に返す

        } catch (e) { console.error(e); }
    };
});
