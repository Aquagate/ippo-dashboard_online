// ===== 編纂室 View =====
// サマリバー、要確認トレイ、資産一覧テーブル、
// 資産詳細パネル、抽出ブリッジを管理する。

import { getDataCache } from '../../app/store';
import { storageSaveData } from '../../services/storage/localStorage';
import { getActiveEntries, dataCache } from '../../app/store';
import {
    ASSET_TYPE_ICONS, ASSET_STATUS_COLORS,
    type HenzanAsset, type ReviewEvent,
    type HenzanBridgeRun, type HenzanProposal,
    type AssetType, type AssetScale, type Confidence,
    createDefaultAsset, generateEventId, generateRunId, generateProposalId
} from '../../domain/henzan/schema';
import { filterValidAssets, filterValidEvents, validateHenzanBridgeRun, validateHenzanProposal } from '../../domain/henzan/validate';
import { generateDiscoveryPrompt, generateCuratePrompt, generatePromotePrompt } from '../../domain/henzan/prompts';
import { showToast } from '../toast';

// --- 初期化フラグ ---
let initialized = false;

// --- DOM参照キャッシュ ---
let els: Record<string, HTMLElement | null> = {};

function el(id: string): HTMLElement | null {
    if (!els[id]) els[id] = document.getElementById(id);
    return els[id];
}

// ===== 公開: タブ切り替え時に呼ばれる =====

export function initHenzanRoom(): void {
    if (!initialized) {
        bindEvents();
        // expose to window for inline onclicks
        (window as any).showProposalDetail = showProposalDetail;
        initialized = true;
    }
    renderAll();
}

// ===== イベントバインド =====

function bindEvents(): void {
    // フィルタ変更
    el('henzanFilterType')?.addEventListener('change', renderAssetTable);
    el('henzanFilterScale')?.addEventListener('change', renderAssetTable);
    el('henzanFilterStatus')?.addEventListener('change', renderAssetTable);

    // 詳細パネル閉じる
    el('henzanDetailClose')?.addEventListener('click', () => {
        const panel = el('henzanDetailPanel');
        if (panel) panel.style.display = 'none';
    });

    // （旧）ルールベース自動抽出はvNext Plusで完全削除されました

    // AIプロンプト生成
    el('btnHenzanPromptDiscovery')?.addEventListener('click', () => handlePromptGeneration('discovery'));
    el('btnHenzanPromptCurate')?.addEventListener('click', () => handlePromptGeneration('curate'));
    el('btnHenzanPromptPromote')?.addEventListener('click', () => handlePromptGeneration('promote'));

    // AI結果取り込み
    el('btnHenzanAiImport')?.addEventListener('click', handleAiImport);
}

// ===== 全体レンダリング =====

function renderAll(): void {
    renderSummaryBar();
    renderReviewTray();
    renderAssetTable();
}

// ===== サマリバー =====

function renderSummaryBar(): void {
    const assets = getAssets();
    const total = assets.length;

    setText('henzanTotalCount', String(total));
    setText('henzanCountSkill', String(assets.filter(a => a.type === '技能').length));
    setText('henzanCountEnv', String(assets.filter(a => a.type === '環境').length));
    setText('henzanCountInsight', String(assets.filter(a => a.type === '知見').length));
    setText('henzanCountProgress', String(assets.filter(a => a.type === '進行資産').length));

    const pendingCount = getPendingProposals().length;
    const badge = el('henzanReviewBadge');
    if (badge) {
        badge.style.display = pendingCount > 0 ? 'flex' : 'none';
    }
    setText('henzanReviewCount', String(pendingCount));
    setText('henzanReviewCount2', String(pendingCount));
}

// ===== 編集トレイ (要確認トレイの刷新) =====

function renderReviewTray(): void {
    const container = el('henzanReviewList');
    if (!container) return;

    const pending = getPendingProposals();

    if (pending.length === 0) {
        container.innerHTML = '<div class="empty-state">現在、確認待ちの候補はありません。</div>';
        return;
    }

    container.innerHTML = '';
    pending.forEach(proposal => {
        const card = document.createElement('div');
        const asset = proposal.candidate;

        // 確信度バッジ
        const confidenceClass = proposal.confidence === '高' ? 'confidence-high' :
                                proposal.confidence === '中' ? 'confidence-medium' :
                                proposal.confidence === '低' ? 'confidence-low' : '';
        card.className = `henzan-review-card ${confidenceClass}`;
        
        // 操作種別に応じたバッジ
        let opLabel: string = proposal.operation;
        if (opLabel === 'create') opLabel = '✨ 新規発見';
        if (opLabel === 'update_existing') opLabel = '🔄 既存更新';
        if (opLabel === 'merge_into_existing') opLabel = '🔗 既存へ統合';
        if (opLabel === 'rename_existing') opLabel = '✏️ 改名提案';
        if (opLabel === 'promote_scale') opLabel = '⭐ 規模昇格';

        const icon = asset?.type ? (ASSET_TYPE_ICONS[asset.type] || '') : '📋';
        const name = asset?.name || '（名称不明）';

        // 親子関係のコンテキスト表示
        let contextHtml = '';
        if (proposal.parent_temp_id) {
            const parentProposal = pending.find(p => p.run_id === proposal.run_id && p.temp_id === proposal.parent_temp_id);
            if (parentProposal) {
                contextHtml = `<div class="henzan-review-card-context">↳ ${escapeHtml(parentProposal.candidate?.name || '親候補')} の構成要素</div>`;
            }
        } else if (proposal.candidate?.parent_id) {
            const parentAsset = getAssets().find(a => a.id === proposal.candidate?.parent_id);
            if (parentAsset) {
                contextHtml = `<div class="henzan-review-card-context">↳ 既存資産: ${escapeHtml(parentAsset.name)} の子として</div>`;
            }
        }

        // 証拠数と内容
        const evidenceCount = proposal.evidence_log_ids?.length || 0;

        card.innerHTML = `
            <div class="henzan-review-card-header">
                <span class="henzan-review-type">${opLabel}</span>
                <span>${icon} ${escapeHtml(name)}</span>
            </div>
            ${contextHtml}
            <div class="henzan-review-card-summary">
                ${escapeHtml(asset?.summary || '')}
            </div>
            <div class="henzan-proposal-reason" style="font-size: 11px; margin: 6px 0; color: #a1a1aa; background: rgba(0,0,0,0.2); padding: 4px; border-left: 2px solid #8b5cf6;">
                <strong>理由:</strong> ${escapeHtml(proposal.reason || '')}
            </div>
            <div class="henzan-review-card-actions" style="margin-top: 8px;">
                <button type="button" class="btn-ghost" onclick="window.showProposalDetail('${proposal.id}')">🔍 詳細・根拠 (${evidenceCount}件)</button>
                <div style="flex:1"></div>
                <button type="button" class="btn-ghost henzan-btn-accept" data-proposal-id="${proposal.id}">✅ 採択</button>
                <button type="button" class="btn-ghost henzan-btn-reject" data-proposal-id="${proposal.id}">❌ 却下</button>
            </div>
        `;

        card.querySelector('.henzan-btn-accept')?.addEventListener('click', (e) => {
            e.stopPropagation();
            resolveProposal(proposal.id, 'accepted');
        });
        card.querySelector('.henzan-btn-reject')?.addEventListener('click', (e) => {
            e.stopPropagation();
            resolveProposal(proposal.id, 'rejected');
        });

        // カードクリックで詳細表示
        card.addEventListener('click', () => {
            (window as any).showProposalDetail(proposal.id);
        });

        container.appendChild(card);
    });
}

// ===== 資産一覧テーブル =====

function renderAssetTable(): void {
    const tbody = el('henzanAssetTbody') as HTMLTableSectionElement | null;
    const noAssets = el('henzanNoAssets');
    const tableWrap = el('henzanAssetTableWrap');
    if (!tbody) return;

    const assets = getFilteredAssets();

    if (assets.length === 0) {
        tbody.innerHTML = '';
        if (noAssets) noAssets.style.display = 'block';
        if (tableWrap) tableWrap.style.display = 'none';
        return;
    }

    if (noAssets) noAssets.style.display = 'none';
    if (tableWrap) tableWrap.style.display = 'block';

    tbody.innerHTML = '';
    
    // 階層構造の描画
    // フィルタされた資産リストの中で、親がリスト内にいないものを「ルート」とする
    const roots = assets.filter(a => !a.parent_id || !assets.some(p => p.id === a.parent_id));
    
    const renderRow = (asset: HenzanAsset, depth: number) => {
        const tr = document.createElement('tr');
        tr.className = 'henzan-asset-row';
        tr.dataset.assetId = asset.id;

        const icon = ASSET_TYPE_ICONS[asset.type] || '';
        const statusClass = ASSET_STATUS_COLORS[asset.status] || '';
        const dateStr = new Date(asset.updated_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });

        // インデントとノード線の生成
        let indentHtml = '';
        for (let i = 0; i < depth; i++) {
            const isLast = i === depth - 1;
            indentHtml += `<span class="henzan-asset-indent">${isLast ? '<span class="henzan-asset-node-line"></span>' : ''}</span>`;
        }

        tr.innerHTML = `
            <td class="henzan-asset-name">
                ${indentHtml}
                <span>${icon} ${escapeHtml(asset.name)}</span>
            </td>
            <td><span class="henzan-scale-badge">${asset.scale}</span></td>
            <td><span class="henzan-status-badge ${statusClass}">${asset.status}</span></td>
            <td class="henzan-evidence-count">${asset.evidence_log_ids.length}</td>
            <td class="henzan-date">${dateStr}</td>
        `;

        tr.addEventListener('click', () => showDetail(asset.id));
        tbody.appendChild(tr);

        // 子資産の再帰描画
        const children = assets.filter(a => a.parent_id === asset.id);
        children.forEach(child => renderRow(child, depth + 1));
    };

    roots.forEach(root => renderRow(root, 0));
}

// ===== 資産詳細パネル =====

function showDetail(assetId: string): void {
    const asset = getAssets().find(a => a.id === assetId);
    if (!asset) return;

    const panel = el('henzanDetailPanel');
    if (panel) panel.style.display = 'block';

    const icon = ASSET_TYPE_ICONS[asset.type] || '';
    setText('henzanDetailName', `${icon} ${asset.name}`);

    const meta = el('henzanDetailMeta');
    if (meta) {
        meta.innerHTML = `
            <span class="henzan-scale-badge">${asset.scale}</span>
            <span class="henzan-status-badge ${ASSET_STATUS_COLORS[asset.status]}">${asset.status}</span>
            <span>確信度: ${asset.confidence}</span>
            <span>根拠: ${asset.evidence_log_ids.length}件</span>
        `;
    }

    const summary = el('henzanDetailSummary');
    if (summary) summary.textContent = asset.summary || '（説明なし）';

    // 階層表示
    const hierarchyDiv = el('henzanDetailHierarchy');
    if (hierarchyDiv) {
        const assets = getAssets();
        const parent = asset.parent_id ? assets.find(a => a.id === asset.parent_id) : null;
        const children = assets.filter(a => a.parent_id === asset.id);

        if (!parent && children.length === 0) {
            hierarchyDiv.style.display = 'none';
        } else {
            hierarchyDiv.style.display = 'block';
            let html = '';
            if (parent) {
                html += `<div><h5>親資産</h5><span class="henzan-hierarchy-link" data-id="${parent.id}">${ASSET_TYPE_ICONS[parent.type]} ${escapeHtml(parent.name)}</span></div>`;
            }
            if (children.length > 0) {
                html += `<div style="margin-top:8px;"><h5>子資産（構成要素）</h5>`;
                html += children.map(c => `<div class="henzan-hierarchy-link" data-id="${c.id}" style="margin-bottom:2px;">${ASSET_TYPE_ICONS[c.type]} ${escapeHtml(c.name)}</div>`).join('');
                html += `</div>`;
            }
            hierarchyDiv.innerHTML = html;

            // リンクにイベントリスナー追加
            hierarchyDiv.querySelectorAll('.henzan-hierarchy-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    const id = (e.currentTarget as HTMLElement).dataset.id;
                    if (id) showDetail(id);
                });
            });
        }
    }

    // 根拠ログ表示
    const evidenceDiv = el('henzanDetailEvidence');
    if (evidenceDiv) {
        const entries = getActiveEntries();
        const evidenceLogs = asset.evidence_log_ids
            .map(id => entries.find(e => e.id === id))
            .filter(Boolean);

        if (evidenceLogs.length === 0) {
            evidenceDiv.innerHTML = '<div class="empty-state">紐づく一歩ログはありません。</div>';
        } else {
            evidenceDiv.innerHTML = evidenceLogs.map(e => `
                <div class="henzan-evidence-item">
                    <span class="henzan-evidence-date">${e!.date}</span>
                    <span class="henzan-evidence-text">${escapeHtml(e!.text)}</span>
                </div>
            `).join('');
        }
    }
}

function showProposalDetail(proposalId: string): void {
    const proposal = dataCache.henzanProposals?.find(p => p.id === proposalId);
    if (!proposal) return;

    const panel = el('henzanDetailPanel');
    if (panel) panel.style.display = 'block';

    const asset = proposal.candidate;
    const icon = asset?.type ? (ASSET_TYPE_ICONS[asset.type] || '') : '📋';
    
    setText('henzanDetailName', `【提案詳細】 ${icon} ${asset?.name || '名称未設定'}`);

    const meta = el('henzanDetailMeta');
    if (meta) {
        let opLabel: string = proposal.operation;
        if (opLabel === 'create') opLabel = '✨ 新規発見';
        if (opLabel === 'update_existing') opLabel = '🔄 既存更新';
        if (opLabel === 'merge_into_existing') opLabel = '🔗 既存へ統合';
        if (opLabel === 'rename_existing') opLabel = '✏️ 改名提案';
        if (opLabel === 'promote_scale') opLabel = '⭐ 規模昇格';

        meta.innerHTML = `
            <span class="henzan-scale-badge">${asset?.scale || '-'}</span>
            <span class="henzan-review-type" style="margin-left: 8px;">${opLabel}</span>
            <span style="margin-left: 8px;">確信度: ${proposal.confidence}</span>
            <span style="margin-left: 8px;">根拠: ${proposal.evidence_log_ids?.length || 0}件</span>
        `;
    }

    const summary = el('henzanDetailSummary');
    if (summary) {
        summary.innerHTML = `
            <div style="margin-bottom: 8px;"><strong>理由:</strong> ${escapeHtml(proposal.reason || '')}</div>
            <div><strong>要約:</strong> ${escapeHtml(asset?.summary || '（説明なし）')}</div>
        `;
    }

    // 根拠ログ表示
    const evidenceDiv = el('henzanDetailEvidence');
    if (evidenceDiv) {
        const entries = getActiveEntries();
        const evidenceLogs = (proposal.evidence_log_ids || [])
            .map(id => entries.find(e => e.id === id))
            .filter(Boolean);

        if (evidenceLogs.length === 0) {
            evidenceDiv.innerHTML = '<div class="empty-state">紐づく一歩ログはありません。</div>';
        } else {
            // proposal に紐づく証拠引用 (quotes) があればそれを強調するなど
            evidenceDiv.innerHTML = evidenceLogs.map(e => `
                <div class="henzan-evidence-item" style="border-left: 2px solid #8b5cf6;">
                    <span class="henzan-evidence-date">${e!.date}</span>
                    <span class="henzan-evidence-text">${escapeHtml(e!.text)}</span>
                </div>
            `).join('');
        }
    }
}


// ===== 旧ルールベース抽出 =====
// vNext Plus にて handleAutoExtract() は廃止されました。

// ===== AIプロンプト生成 =====

function handlePromptGeneration(mode: 'discovery' | 'curate' | 'promote'): void {
    const entries = getActiveEntries();
    // デフォルトで過去60日とする（より柔軟な設定は今後の課題）
    const windowDays = 60;
    const border = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const recent = entries.filter(e => e.ts >= border);

    if (recent.length === 0) {
        showToast(`過去${windowDays}日のログがありません。`, 'err');
        return;
    }

    const existingAssets = getAssets();
    let prompt = '';

    if (mode === 'discovery') {
        prompt = generateDiscoveryPrompt(recent, existingAssets, windowDays);
    } else if (mode === 'curate') {
        prompt = generateCuratePrompt(recent, existingAssets, windowDays);
    } else if (mode === 'promote') {
        prompt = generatePromotePrompt(recent, existingAssets, windowDays);
    }

    navigator.clipboard.writeText(prompt).then(() => {
        showToast(`📋 ${mode} モードのプロンプトをクリップボードにコピーしました。`, 'ok');
    }).catch(() => {
        showToast('❌ クリップボードへのコピーに失敗しました', 'err');
    });
}

// ===== AI結果取り込み =====

function handleAiImport(): void {
    const textarea = el('henzanAiInput') as HTMLTextAreaElement | null;
    if (!textarea || !textarea.value.trim()) {
        showMessage('henzanAiImportMsg', '❌ JSONを貼り付けてください。');
        return;
    }

    try {
        let jsonStr = textarea.value.trim();
        const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();

        const parsed = JSON.parse(jsonStr);
        // 新スキーマ対応（run_meta と proposals）
        if (!parsed.run_meta || !parsed.proposals || !Array.isArray(parsed.proposals)) {
            // 後方互換性フォールバック（もし古い assets 配列しかなければエラーにする）
            throw new Error('新しいJSON形式（run_meta, proposals）ではありません。新しいプロンプトを使用して生成してください。');
        }

        const now = Date.now();
        const runId = generateRunId();
        const proposalIds: string[] = [];

        const mode = parsed.run_meta.mode || 'curate';
        const windowDays = typeof parsed.run_meta.window_days === 'number' ? parsed.run_meta.window_days : 60;

        parsed.proposals.forEach((rawP: any) => {
            const pid = generateProposalId();
            const proposal: HenzanProposal = {
                id: pid,
                run_id: runId,
                operation: rawP.operation || 'create',
                target_asset_id: rawP.target_asset_id || null,
                merge_target_id: rawP.merge_target_id || null,
                candidate: {
                    name: rawP.candidate?.name,
                    type: mapAiType(String(rawP.candidate?.type || '')),
                    scale: mapAiScale(String(rawP.candidate?.scale || '')),
                    summary: rawP.candidate?.summary,
                },
                evidence_log_ids: Array.isArray(rawP.evidence_log_ids) ? rawP.evidence_log_ids : [],
                evidence_quotes: Array.isArray(rawP.evidence_quotes) ? rawP.evidence_quotes : [],
                reason: rawP.reason || '',
                confidence: mapAiConfidence(String(rawP.confidence || '中')),
                temp_id: rawP.temp_id ? String(rawP.temp_id) : undefined,
                parent_temp_id: rawP.parent_temp_id ? String(rawP.parent_temp_id) : undefined,
                resolved: false,
                created_at: now,
            };

            const val = validateHenzanProposal(proposal);
            if (val.valid) {
                const currentCache = getDataCache();
                if (!currentCache.henzanProposals) currentCache.henzanProposals = [];
                currentCache.henzanProposals.push(proposal);
                proposalIds.push(pid);
            } else {
                console.warn('Skipping invalid proposal:', val.errors, proposal);
            }
        });

        const run: HenzanBridgeRun = {
            id: runId,
            prompt_version: parsed.run_meta.prompt_version || 'unknown',
            mode,
            window_days: windowDays,
            created_at: now,
            proposal_ids: proposalIds,
        };

        const runVal = validateHenzanBridgeRun(run);
        if (runVal.valid) {
            const currentCache = getDataCache();
            if (!currentCache.henzanBridgeRuns) currentCache.henzanBridgeRuns = [];
            currentCache.henzanBridgeRuns.push(run);
        }

        storageSaveData(getDataCache());
        renderAll();

        textarea.value = '';
        showMessage('henzanAiImportMsg', `✅ ${proposalIds.length}件の提案を編集トレイに追加しました。`);
        showToast(`📥 ${proposalIds.length}件の提案を取り込みました。`, 'ok');
    } catch (e: any) {
        showMessage('henzanAiImportMsg', `❌ JSON解析エラー: ${e.message}`);
    }
}

// ===== イベント解決（採択/却下） =====

function resolveProposal(proposalId: string, resolution: 'accepted' | 'rejected'): void {
    const btn = document.querySelector(`.henzan-btn-${resolution === 'accepted' ? 'accept' : 'reject'}[data-proposal-id="${proposalId}"]`);
    const cardEl = btn?.closest('.henzan-review-card');
    if (cardEl) {
        cardEl.classList.add('henzan-card-solving');
    }

    setTimeout(() => {
        const currentCache = getDataCache();
        if (!currentCache.henzanProposals) return;
        const proposal = currentCache.henzanProposals.find(p => p.id === proposalId);
        if (!proposal) return;

        proposal.resolved = true;
        proposal.resolved_at = Date.now();
        proposal.resolution = resolution;

        if (resolution === 'accepted') {
            const newAssetId = applyProposalToAssets(proposal);
            
            // 親子紐付けの伝搬: この提案が temp_id を持っている場合、
            // 同一Run内の子提案（parent_temp_id が一致するもの）の candidate.parent_id を、
            // 今作られた(または更新された) Asset ID に書き換える。
            if (proposal.temp_id && newAssetId) {
                const sameRunChildren = currentCache.henzanProposals.filter(p => 
                    p.run_id === proposal.run_id && 
                    p.parent_temp_id === proposal.temp_id && 
                    !p.resolved
                );
                sameRunChildren.forEach(child => {
                    if (!child.candidate) child.candidate = {};
                    child.candidate.parent_id = newAssetId;
                });
            }

            showToast(`✅ 提案を採択しました。`, 'ok');
        } else {
            showToast('❌ 提案を却下しました。', 'ok');
        }

        storageSaveData(getDataCache());
        renderAll();
    }, 400);
}

function applyProposalToAssets(proposal: HenzanProposal): string | null {
    const now = Date.now();
    let resultAssetId: string | null = null;
    
    if (proposal.operation === 'create') {
        const newAsset: HenzanAsset = {
            ...createDefaultAsset(),
            name: proposal.candidate.name || '名称未設定',
            type: proposal.candidate.type || '知見',
            scale: proposal.candidate.scale || '小',
            summary: proposal.candidate.summary || '',
            evidence_log_ids: [...proposal.evidence_log_ids],
            parent_id: proposal.candidate.parent_id || null, 
            status: '活性',
            created_at: now,
            updated_at: now,
        };
        getDataCache().henzanAssets.push(newAsset);
        resultAssetId = newAsset.id;
    } 
    else if (proposal.operation === 'update_existing' && proposal.target_asset_id) {
        const asset = getDataCache().henzanAssets.find(a => a.id === proposal.target_asset_id);
        if (asset) {
            if (proposal.candidate.name) asset.name = proposal.candidate.name;
            if (proposal.candidate.summary) asset.summary = proposal.candidate.summary;
            if (proposal.candidate.scale) asset.scale = proposal.candidate.scale;
            if (proposal.candidate.type) asset.type = proposal.candidate.type;
            if (proposal.candidate.parent_id !== undefined) asset.parent_id = proposal.candidate.parent_id;
            
            const newIds = proposal.evidence_log_ids.filter(id => !asset.evidence_log_ids.includes(id));
            asset.evidence_log_ids.push(...newIds);
            
            asset.status = '活性';
            asset.updated_at = now;
            resultAssetId = asset.id;
        }
    }
    else if (proposal.operation === 'rename_existing' && proposal.target_asset_id) {
        const asset = getDataCache().henzanAssets.find(a => a.id === proposal.target_asset_id);
        if (asset) {
            if (proposal.candidate.name) asset.name = proposal.candidate.name;
            if (proposal.candidate.summary) asset.summary = proposal.candidate.summary;
            
            const newIds = proposal.evidence_log_ids.filter(id => !asset.evidence_log_ids.includes(id));
            asset.evidence_log_ids.push(...newIds);
            
            asset.status = '活性';
            asset.updated_at = now;
            resultAssetId = asset.id;
        }
    }
    else if (proposal.operation === 'merge_into_existing' && proposal.target_asset_id && proposal.merge_target_id) {
        const sourceAsset = getDataCache().henzanAssets.find(a => a.id === proposal.target_asset_id);
        const targetAsset = getDataCache().henzanAssets.find(a => a.id === proposal.merge_target_id);
        
        if (sourceAsset && targetAsset) {
            const newIds = sourceAsset.evidence_log_ids.filter(id => !targetAsset.evidence_log_ids.includes(id));
            targetAsset.evidence_log_ids.push(...newIds);
            
            if (proposal.candidate.name) targetAsset.name = proposal.candidate.name;
            if (proposal.candidate.summary) targetAsset.summary = proposal.candidate.summary;
            
            targetAsset.status = '活性';
            targetAsset.updated_at = now;
            
            sourceAsset.status = '休眠';
            sourceAsset.summary = `[統合済: ${targetAsset.name}] ` + sourceAsset.summary;
            sourceAsset.updated_at = now;
            resultAssetId = targetAsset.id;
        }
    }
    else if (proposal.operation === 'promote_scale' && proposal.target_asset_id) {
        const asset = getDataCache().henzanAssets.find(a => a.id === proposal.target_asset_id);
        if (asset) {
            if (proposal.candidate.scale) asset.scale = proposal.candidate.scale;
            if (proposal.candidate.name) asset.name = proposal.candidate.name;
            if (proposal.candidate.summary) asset.summary = proposal.candidate.summary;
            
            asset.status = '活性';
            asset.updated_at = now;
            resultAssetId = asset.id;
        }
    }
    return resultAssetId;
}

// AIインポート時の正規化マッピング
function mapAiType(raw: string): AssetType {
    const t = raw.toLowerCase();
    if (t.includes('skill') || t.includes('技能')) return '技能';
    if (t.includes('env') || t.includes('環境')) return '環境';
    if (t.includes('insight') || t.includes('知見')) return '知見';
    if (t.includes('progress') || t.includes('進行資産')) return '進行資産';
    return '知見'; // デフォルト
}

function mapAiScale(raw: string): AssetScale {
    const s = raw.toLowerCase();
    if (s.includes('large') || s.includes('大')) return '大';
    if (s.includes('medium') || s.includes('中')) return '中';
    if (s.includes('small') || s.includes('小')) return '小';
    return '小';
}

function mapAiConfidence(raw: string): Confidence {
    const c = raw.toLowerCase();
    if (c.includes('high') || c.includes('高')) return '高';
    if (c.includes('medium') || c.includes('中')) return '中';
    if (c.includes('low') || c.includes('低')) return '低';
    return '中';
}

// ===== ヘルパー関数 =====

function getPendingProposals(): HenzanProposal[] {
    return (getDataCache().henzanProposals || []).filter(p => !p.resolved);
}

function getAssets(): HenzanAsset[] {
    return getDataCache().henzanAssets || [];
}

function getFilteredAssets(): HenzanAsset[] {
    let assets = getAssets();

    const typeFilter = (el('henzanFilterType') as HTMLSelectElement)?.value;
    const scaleFilter = (el('henzanFilterScale') as HTMLSelectElement)?.value;
    const statusFilter = (el('henzanFilterStatus') as HTMLSelectElement)?.value;

    if (typeFilter) assets = assets.filter(a => a.type === typeFilter);
    if (scaleFilter) assets = assets.filter(a => a.scale === scaleFilter);
    if (statusFilter) assets = assets.filter(a => a.status === statusFilter);

    // 更新日時降順
    return assets.sort((a, b) => b.updated_at - a.updated_at);
}


function setText(id: string, text: string): void {
    const e = el(id);
    if (e) e.textContent = text;
}

function showMessage(id: string, msg: string): void {
    const e = el(id);
    if (e) e.textContent = msg;
}

function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
