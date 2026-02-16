document.addEventListener('DOMContentLoaded', async () => {
    // URLパラメータからIntake IDを取得 (例: ?intake_id=INT-XXX)
    const urlParams = new URLSearchParams(window.location.search);
    const intakeId = urlParams.get('intake_id');
    const taskId = 'TASK-001'; // MVPでは固定、本来はIntake情報から取得

    const intakeDetailsEl = document.getElementById('intake-details');
    const checklistArea = document.getElementById('checklist-area');
    const alertsArea = document.getElementById('alerts-area');
    const btnComplete = document.getElementById('btn-complete');

    // データ読み込み
    try {
        // 1. Intake情報の取得 (本来はAPIでID指定Getだが、MVPは全件から検索)
        const intakesRes = await fetch('/api/data/intakes');
        const intakes = await intakesRes.json();
        const intake = intakes.find(i => i.intake_id === intakeId) || intakes[intakes.length - 1]; // 指定なしなら最新

        renderIntakeInfo(intake);

        // 2. Checklist & Rules の取得
        const [clRes, rulesRes] = await Promise.all([
            fetch('/api/data/checklists'),
            fetch('/api/data/guide_rules')
        ]);
        const checklists = await clRes.json();
        const rules = await rulesRes.json();

        // 3. レンダリング
        renderChecklist(checklists, taskId);
        evaluateRules(rules, checklistArea, intake);

    } catch (err) {
        console.error(err);
        showToast('データの読み込みに失敗しました', true);
    }

    // 完了ボタンハンドラ
    btnComplete.addEventListener('click', async () => {
        // チェック状況の収集
        const checks = Array.from(document.querySelectorAll('input[type="checkbox"]')).map(cb => ({
            id: cb.id,
            checked: cb.checked
        }));

        const executionLog = {
            execution_id: `EXEC-${Date.now()}`,
            intake_id: intakeId || 'UNKNOWN',
            task_id: taskId,
            completed_at: new Date().toISOString(),
            checklist_results: checks,
            status: 'COMPLETED'
        };

        // 保存 (executions.jsonに追加)
        // MVPでは簡易的に既存読み込み -> 追記 -> 保存 (排他制御なし)
        try {
            // executions.jsonを読み込む
            let executions = [];
            try {
                const exRes = await fetch('/api/data/executions');
                if (exRes.ok) executions = await exRes.json();
            } catch (e) { /* ignore */ }

            executions.push(executionLog);

            // 保存API
            const saveRes = await fetch('/api/data/executions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(executions)
            });

            if (saveRes.ok) {
                showToast('✅ 工程完了！ドラフト作成へ移動します...');
                setTimeout(() => {
                    window.location.href = `/draft.html?intake_id=${intakeId}`;
                }, 1000);
            } else {
                showToast('❌ 保存に失敗しました', true);
            }
        } catch (err) {
            console.error(err);
            showToast('❌ エラー', true);
        }
    });

    function renderIntakeInfo(intake) {
        if (!intake) {
            intakeDetailsEl.innerHTML = '<p>No intake data found.</p>';
            return;
        }
        intakeDetailsEl.innerHTML = `
            <div class="field-value">
                <div class="field-label">Requester</div>
                <div class="field-content">${intake.requester}</div>
            </div>
            <div class="field-value">
                <div class="field-label">Summary</div>
                <div class="field-content">${intake.summary}</div>
            </div>
            <div class="field-value">
                <div class="field-label">Content</div>
                <div class="field-content" style="white-space: pre-wrap; font-size: 0.9rem;">${intake.details}</div>
            </div>
        `;
    }

    function renderChecklist(checklists, targetTaskId) {
        const cl = checklists.find(c => c.scope_task_id === targetTaskId);
        if (!cl) {
            checklistArea.innerHTML = '<p>No checklist definition found.</p>';
            return;
        }

        checklistArea.innerHTML = cl.items.map(item => `
            <div class="checklist-item">
                <input type="checkbox" id="${item.id}" data-required="${item.required}">
                <label for="${item.id}">${item.text}</label>
            </div>
        `).join('');

        // チェック状態監視
        checklistArea.addEventListener('change', updateCompleteButtonState);
    }

    function updateCompleteButtonState() {
        const requiredCbs = document.querySelectorAll('input[data-required="true"]');
        const allChecked = Array.from(requiredCbs).every(cb => cb.checked);
        btnComplete.disabled = !allChecked;
    }

    function evaluateRules(rules, container, intake) {
        // 簡易ルールエンジン
        // logic: if intake contains 'Partner' -> show warning
        // 本来はrules.jsonを解析するが、MVPではハードコードに近い形でデモ

        // サンプル: "details" に "Partner" が含まれていたら警告
        if (intake && intake.details && intake.details.includes('Partner')) {
            alertsArea.innerHTML += `
                <div class="warning-box">
                    <span>⚠️ <strong>Partner権限の申請検知:</strong> セキュリティチームの追加承認が必要です。</span>
                </div>
             `;
        }
    }

    // エスカレーションボタン
    const btnEscalate = document.getElementById('btn-escalate');
    if (btnEscalate) {
        btnEscalate.addEventListener('click', async () => {
            if (!confirm('管理者にエスカレーション（例外扱い）しますか？')) return;

            try {
                // ステータスを EXCEPTION に更新
                const intakesRes = await fetch('/api/data/intakes');
                const intakes = await intakesRes.json();
                const idx = intakes.findIndex(i => i.intake_id === intakeId);

                if (idx !== -1) {
                    intakes[idx].status = 'EXCEPTION';
                    await fetch('/api/data/intakes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(intakes)
                    });

                    showToast('⚠️ エスカレーションしました。管理画面へ移動します。');
                    setTimeout(() => window.location.href = `/admin.html`, 1000);
                }
            } catch (err) {
                console.error(err);
                showToast('エラーが発生しました', true);
            }
        });
    }

    function showToast(message, isError = false) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.style.backgroundColor = isError ? '#ef4444' : '#10b981';
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }
});
