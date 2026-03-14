document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const intakeId = urlParams.get('intake_id');

    const intakePreview = document.getElementById('intake-preview');
    const templateSelect = document.getElementById('template-select');
    const subjectInput = document.getElementById('draft-subject');
    const bodyInput = document.getElementById('draft-body');
    const btnCopy = document.getElementById('btn-copy');
    const btnSave = document.getElementById('btn-save');

    let currentIntake = null;
    let templates = [];

    // Load Data
    try {
        const [intakesRes, tmplRes] = await Promise.all([
            fetch('/api/data/intakes'),
            fetch('/api/data/templates')
        ]);
        const intakes = await intakesRes.json();
        templates = await tmplRes.json();

        currentIntake = intakes.find(i => i.intake_id === intakeId) || intakes[intakes.length - 1];

        renderIntake(currentIntake);
        renderTemplates(templates);

    } catch (err) {
        console.error(err);
        showToast('データ読み込みエラー', true);
    }

    // Template Change
    templateSelect.addEventListener('change', (e) => {
        const tmplId = e.target.value;
        const tmpl = templates.find(t => t.template_id === tmplId);
        if (tmpl) {
            applyTemplate(tmpl, currentIntake);
        }
    });

    // Copy
    btnCopy.addEventListener('click', async () => {
        const text = `Subject: ${subjectInput.value}\n\n${bodyInput.value}`;
        await navigator.clipboard.writeText(text);
        showToast('📋 クリップボードにコピーしました');
    });

    // Save
    btnSave.addEventListener('click', async () => {
        const draft = {
            draft_id: `DFT-${Date.now()}`,
            intake_id: intakeId,
            subject: subjectInput.value,
            body: bodyInput.value,
            created_at: new Date().toISOString()
        };

        try {
            // Save draft
            let drafts = [];
            try {
                const res = await fetch('/api/data/drafts');
                if (res.ok) drafts = await res.json();
            } catch (e) { }

            drafts.push(draft);

            await fetch('/api/data/drafts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(drafts)
            });

            showToast('✅ 保存完了！ダッシュボードへ戻ります');
            setTimeout(() => {
                const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
                if (user.role === 'OPERATOR') window.location.href = '/dashboard_op.html';
                else if (user.role === 'SV') window.location.href = '/dashboard_sv.html';
                else if (user.role === 'PM') window.location.href = '/dashboard_pm.html';
                else window.location.href = '/';
            }, 1500);

        } catch (err) {
            console.error(err);
            showToast('保存エラー', true);
        }
    });

    function renderIntake(intake) {
        if (!intake) return;
        intakePreview.innerHTML = `
            <p><strong>${intake.requester}</strong></p>
            <p>${intake.summary}</p>
            <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 10px 0;">
            <p style="font-size: 0.8rem">${intake.details}</p>
        `;
    }

    function renderTemplates(list) {
        list.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.template_id;
            opt.textContent = t.title;
            templateSelect.appendChild(opt);
        });
    }

    function applyTemplate(tmpl, intake) {
        let subj = tmpl.subject;
        let body = tmpl.body;

        // Simple Variable Replacement
        const vars = {
            '{{requester}}': intake.requester,
            '{{summary}}': intake.summary,
            '{{task_name}}': 'アカウント発行' // 仮
        };

        for (const [key, val] of Object.entries(vars)) {
            subj = subj.replace(new RegExp(key, 'g'), val);
            body = body.replace(new RegExp(key, 'g'), val);
        }

        subjectInput.value = subj;
        bodyInput.value = body;
    }

    function showToast(msg, isErr) {
        const t = document.getElementById('toast');
        t.innerText = msg;
        t.style.background = isErr ? '#ef4444' : '#10b981';
        t.classList.remove('hidden');
        setTimeout(() => t.classList.add('hidden'), 3000);
    }
});
