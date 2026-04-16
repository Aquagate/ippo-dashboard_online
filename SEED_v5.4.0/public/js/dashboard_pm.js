document.addEventListener('DOMContentLoaded', async () => {
    const mainView = document.getElementById('main-view');
    const userDisplay = document.getElementById('user-display');

    // User Context
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (user.role !== 'PM') {
        alert('Access Denied: You are not a PM.');
        window.location.href = '/login.html';
        return;
    }
    userDisplay.innerText = `${user.name}`;

    window.switchView = (view) => {
        const mainView = document.getElementById('main-view');
        // Reset active class
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

        if (view === 'rules') {
            loadRulesEditor();
        } else if (view === 'ai_suggestions') {
            loadAISuggestions();
        } else if (view === 'risk') {
            mainView.innerHTML = '<h3>Risks & Escalations</h3><p>Coming soon...</p>';
        } else {
            loadAnalytics();
        }
    };

    // Initial View
    switchView('ai_suggestions'); // Default to new feature for demo

    async function loadAISuggestions() {
        const mainView = document.getElementById('main-view');
        mainView.innerHTML = '<div style="text-align:center; padding:50px;">🤖 AIがトレンドを分析中...</div>';

        try {
            const res = await fetch('/api/data/manual_proposals');
            const proposals = await res.json();
            // Show only PENDING ones. BLOCKED/APPROVED/REJECTED are for analytics/history.
            const pending = proposals.filter(p => p.status === 'PENDING');

            if (pending.length === 0) {
                mainView.innerHTML = `
                    <h2>✨ AI Knowledge Suggestions</h2>
                    <div style="padding:40px; text-align:center; color:var(--text-secondary); background:rgba(255,255,255,0.05); border-radius:12px;">
                        新しい提案はありません。すべて処理済みです！
                    </div>
                `;
                return;
            }

            mainView.innerHTML = `
                <h2>✨ AI Knowledge Suggestions (${pending.length})</h2>
                <p style="color:var(--text-secondary); margin-bottom:20px;">
                    AIが「その他 (MAN-999)」で処理された案件から、頻出パターンを検出しました。<br>
                    内容を確認し、標準マニュアルとして承認してください。
                </p>
                <div style="display:grid; grid-template-columns:1fr; gap:20px;">
                    ${pending.map(p => {
                // Rubric Badge Logic
                let scoreBadge = '';
                if (p.rubric) {
                    const cls = p.rubric.class;
                    const score = p.rubric.finalScore;
                    let color = '#f59e0b'; // Intern
                    if (cls === 'SURGEON') color = '#10b981';
                    if (cls === 'ADVISOR') color = '#3b82f6';
                    scoreBadge = `<span style="background:${color}; padding:2px 8px; border-radius:12px; font-size:0.75rem; color:white; font-weight:bold; margin-left:10px;">
                                ${cls} (${score})
                            </span>`;
                }

                return `
                        <div style="background:linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(16, 185, 129, 0.05)); border:1px solid rgba(59, 130, 246, 0.3); padding:20px; border-radius:12px;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                                <div style="display:flex; align-items:center;">
                                    <strong style="font-size:1.1rem; color:#60a5fa;">💡 新規マニュアル化の提案</strong>
                                    ${scoreBadge}
                                </div>
                                <span style="font-size:0.8rem; color:var(--text-secondary);">${new Date(p.created_at).toLocaleDateString()}</span>
                            </div>
                            
                            <div style="background:rgba(0,0,0,0.3); padding:15px; border-radius:8px; margin-bottom:15px;">
                                <div style="font-size:0.9rem; color:grey; margin-bottom:5px;">元になったオペレーター対応:</div>
                                <em>"${p.source_task}"</em>
                            </div>

                            <div style="margin-bottom:15px;">
                                <label style="display:block; font-size:0.8rem; color:var(--text-secondary);">タイトル案 (Suggested Title)</label>
                                <input type="text" id="title-${p.proposal_id}" value="${p.ai_result.suggested_title || ''}" 
                                    style="width:100%; padding:10px; background:rgba(0,0,0,0.5); border:1px solid #3b82f6; color:white; border-radius:6px; font-weight:bold;">
                            </div>

                            <div style="margin-bottom:20px;">
                                <label style="display:block; font-size:0.8rem; color:var(--text-secondary);">カテゴリ (Category)</label>
                                <input type="text" id="cat-${p.proposal_id}" value="${p.ai_result.category || 'General'}" 
                                    style="width:100%; padding:10px; background:rgba(0,0,0,0.5); border:1px solid grey; color:white; border-radius:6px;">
                            </div>

                            <div style="display:flex; gap:10px;">
                                <button class="btn-primary" onclick="approveProposal('${p.proposal_id}')">✅ 承認してマニュアル追加</button>
                                <button class="btn-secondary" onclick="rejectProposal('${p.proposal_id}')">❌ 却下</button>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            `;
        } catch (e) { console.error(e); }
    }

    // --- Analytics Feature ---
    async function loadAnalytics() {
        const mainView = document.getElementById('main-view');
        mainView.innerHTML = '<div style="text-align:center; padding:50px;">📊 データを集計中...</div>';

        try {
            const pRes = await fetch('/api/data/manual_proposals');
            const proposals = await pRes.json();

            const total = proposals.length;
            if (total === 0) {
                mainView.innerHTML = '<h3>Analytics</h3><p>データがまだありません。</p>';
                return;
            }

            // Rubric Classes Stats
            const classes = { SURGEON: 0, ADVISOR: 0, INTERN: 0, BLOCKED: 0 };
            let totalScore = 0;
            let scoredCount = 0;

            proposals.forEach(p => {
                const cls = p.status === 'BLOCKED' ? 'BLOCKED' : (p.rubric ? p.rubric.class : 'INTERN');
                // Or verify rubric object
                if (p.rubric) {
                    // Use actual rubric result if available
                    const rubricCls = (p.status === 'BLOCKED') ? 'BLOCKED' : p.rubric.class;
                    classes[rubricCls] = (classes[rubricCls] || 0) + 1;
                    totalScore += p.rubric.finalScore;
                    scoredCount++;
                } else if (p.status === 'BLOCKED') {
                    classes.BLOCKED++;
                }
            });

            const avgScore = scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : 0;

            // Simple Chart Helper
            const renderBar = (label, count, total, color) => {
                const pct = total > 0 ? (count / total) * 100 : 0;
                return `
                    <div style="margin-bottom:15px;">
                        <div style="display:flex; justify-content:space-between; font-size:0.9rem; margin-bottom:5px;">
                            <span>${label}</span>
                            <span>${count} (${pct.toFixed(1)}%)</span>
                        </div>
                        <div style="width:100%; height:12px; background:rgba(255,255,255,0.1); border-radius:6px; overflow:hidden;">
                            <div style="width:${pct}%; height:100%; background:${color};"></div>
                        </div>
                    </div>
                `;
            };

            mainView.innerHTML = `
                <h2>📊 AI Performance Analytics (Rubric Engine)</h2>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:20px; margin-bottom:30px;">
                    <div style="background:var(--card-bg); padding:20px; border-radius:12px; border:1px solid var(--glass-border);">
                        <div style="font-size:0.9rem; color:var(--text-secondary);">Average Quality Score</div>
                        <div style="font-size:2.5rem; font-weight:bold; color:#ec4899;">${avgScore}</div>
                        <div style="font-size:0.8rem; color:grey;">Target: > 90.0</div>
                    </div>
                    <div style="background:var(--card-bg); padding:20px; border-radius:12px; border:1px solid var(--glass-border);">
                        <div style="font-size:0.9rem; color:var(--text-secondary);">Automation Rate (Surgeon)</div>
                        <div style="font-size:2.5rem; font-weight:bold; color:#10b981;">${((classes.SURGEON / total) * 100).toFixed(1)}%</div>
                        <div style="font-size:0.8rem; color:grey;">${classes.SURGEON} / ${total} Proposals</div>
                    </div>
                    <div style="background:var(--card-bg); padding:20px; border-radius:12px; border:1px solid var(--glass-border);">
                        <div style="font-size:0.9rem; color:var(--text-secondary);">Safety Blocks</div>
                        <div style="font-size:2.5rem; font-weight:bold; color:#ef4444;">${classes.BLOCKED}</div>
                        <div style="font-size:0.8rem; color:grey;">Interceptions</div>
                    </div>
                </div>

                <div style="background:var(--card-bg); padding:20px; border-radius:12px; border:1px solid var(--glass-border);">
                    <h3 style="margin-bottom:20px;">🏆 Score Distribution (Class)</h3>
                    ${renderBar('SURGEON (95-100) - Fully Automated', classes.SURGEON, total, '#10b981')}
                    ${renderBar('ADVISOR (70-94) - Human Review', classes.ADVISOR, total, '#3b82f6')}
                    ${renderBar('INTERN (<70) - Assist Only', classes.INTERN, total, '#f59e0b')}
                    ${renderBar('BLOCKED (Safety Violation)', classes.BLOCKED, total, '#ef4444')}
                </div>
            `;
        } catch (e) {
            console.error(e);
            mainView.innerHTML = '<p>Error loading analytics.</p>';
        }
    }

    window.approveProposal = async (id) => {
        const title = document.getElementById(`title-${id}`).value;
        const cat = document.getElementById(`cat-${id}`).value;

        if (!confirm(`「${title}」をマニュアル一覧に追加しますか？`)) return;

        // 1. Add to Manuals Index
        const manualId = `MAN-${Math.floor(100 + Math.random() * 900)}`; // Simple ID Gen
        try {
            const mRes = await fetch('/api/data/manuals_index');
            const manuals = await mRes.json();

            manuals[manualId] = {
                category: cat,
                title: title,
                url: "/docs/manuals/new_generated.md" // Placeholder
            };
            await fetch('/api/data/manuals_index', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(manuals) });

            // 2. Update Proposal Status
            const pRes = await fetch('/api/data/manual_proposals');
            const proposals = await pRes.json();
            const target = proposals.find(p => p.proposal_id === id);
            if (target) target.status = 'APPROVED';

            await fetch('/api/data/manual_proposals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(proposals) });

            alert(`承認完了しました！ 新規マニュアルID: ${manualId}`);
            loadAISuggestions();

        } catch (e) { console.error(e); alert('エラーが発生しました'); }
    };

    window.rejectProposal = async (id) => {
        if (!confirm('この提案を却下しますか？')) return;
        try {
            const pRes = await fetch('/api/data/manual_proposals');
            const proposals = await pRes.json();
            const target = proposals.find(p => p.proposal_id === id);
            if (target) target.status = 'REJECTED';

            await fetch('/api/data/manual_proposals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(proposals) });
            loadAISuggestions();
        } catch (e) { console.error(e); }
    };

    // Reuse Rule Editor Logic (Simplified)
    async function loadRulesEditor() {
        mainView.innerHTML = `
            <h2>Rule Management</h2>
            <div style="display:flex; gap:20px; height:80%;">
                <div id="checklist-list" style="width:200px; border-right:1px solid grey;">Loading...</div>
                <div style="flex:1; display:flex; flex-direction:column;">
                    <textarea id="json-editor" style="flex:1; background:rgba(0,0,0,0.3); color:white; font-family:monospace; padding:10px;"></textarea>
                    <button class="btn-primary" onclick="saveRules()" style="margin-top:10px;">Deploy Rules</button>
                    <input type="hidden" id="current-key">
                </div>
            </div>
        `;

        const res = await fetch('/api/data/checklists');
        const checklists = await res.json();

        const listEl = document.getElementById('checklist-list');
        listEl.innerHTML = Object.keys(checklists).map(k => `
            <div style="padding:10px; cursor:pointer;" onclick="editKey('${k}')">📄 ${k}</div>
        `).join('');

        window.editKey = (key) => {
            document.getElementById('current-key').value = key;
            document.getElementById('json-editor').value = JSON.stringify(checklists[key], null, 4);
        };

        window.saveRules = async () => {
            const key = document.getElementById('current-key').value;
            if (!key) return;
            try {
                const newContent = JSON.parse(document.getElementById('json-editor').value);
                checklists[key] = newContent;
                await fetch('/api/data/checklists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(checklists) });
                alert('Saved!');
            } catch (e) { alert('Error: ' + e.message); }
        };
    }
});
