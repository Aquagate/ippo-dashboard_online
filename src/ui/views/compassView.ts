// ===== 羅針盤（羅針盤）View =====
// 編纂室の資産を使い、趣味の現在地・条件・ミッション・根拠を表示する。

import { dataCache } from '../../app/store';
import type { HenzanAsset } from '../../domain/henzan/schema';
import { ASSET_TYPE_ICONS } from '../../domain/henzan/schema';
import { SAMPLE_TRACKS } from '../../domain/compass/sampleTracks';
import { evaluateTrack } from '../../domain/compass/match';
import { MISSION_KIND_ICONS } from '../../domain/compass/schema';
import type { TrackEvaluation, CompassTrack } from '../../domain/compass/schema';
import { SAMPLE_CONSTRAINTS, CONSTRAINT_META } from '../../domain/compass/constraints';

// --- 初期化フラグ ---
let initialized = false;

// --- DOM参照 ---
function el(id: string): HTMLElement | null {
    return document.getElementById(id);
}

function escapeHtml(str: string): string {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

// ===== 初期化 =====

export function initCompass(): void {
    renderCompass();
    initialized = true;
}

// ===== メイン描画 =====

function renderCompass(): void {
    // 現在選択中のトラックを取得（MVPは1つ固定）
    const track = SAMPLE_TRACKS[0];
    if (!track) {
        renderEmptyState('趣味トラックが定義されていません。');
        return;
    }

    // 編纂室の資産を取得
    const assets: HenzanAsset[] = dataCache.henzanAssets || [];

    // トラック評価
    const evaluation = evaluateTrack(track, assets, SAMPLE_CONSTRAINTS);

    // 各カードを描画
    renderTrackHeader(track);
    renderConstraintsCard();
    renderCurrentCard(track, evaluation);
    renderRequirementsCard(track, evaluation);
    renderMissionCard(evaluation);
    renderEvidenceCard(evaluation);
}

// ===== ヘッダ描画 =====

function renderTrackHeader(track: CompassTrack): void {
    const nameEl = el('compassTrackName');
    if (nameEl) {
        nameEl.innerHTML = `
            <div class="compass-track-label">🎣 ${escapeHtml(track.name)}</div>
            <div class="compass-track-desc">${escapeHtml(track.description)}</div>
        `;
    }
}

// ===== 現在地カード =====

function renderConstraintsCard(): void {
    const body = el('compassConstraintsBody');
    if (!body) return;

    const c = SAMPLE_CONSTRAINTS;
    const m = CONSTRAINT_META;

    let html = '<div class="compass-constraints-grid">';
    
    const list = [
        { key: 'time', val: c.time },
        { key: 'energy', val: c.energy },
        { key: 'money', val: c.money },
        { key: 'family', val: c.family },
    ] as const;

    for (const item of list) {
        const meta = m[item.key];
        
        let valClass = 'compass-const-mid';
        if (item.val === 'strict') valClass = 'compass-const-strict';
        if (item.val === 'loose') valClass = 'compass-const-loose';

        html += `
            <div class="compass-constraint-item">
                <div class="compass-const-header">
                    <span class="compass-const-icon">${meta.icon}</span>
                    <span class="compass-const-label">${escapeHtml(meta.label)}</span>
                </div>
                <div class="compass-const-value ${valClass}">${escapeHtml(meta.labelValue)}</div>
            </div>
        `;
    }
    
    html += '</div>';
    html += '<div class="compass-const-note">※現在は表示のみの参考情報です。</div>';
    body.innerHTML = html;
}

// ===== 現在地カード =====

function renderCurrentCard(track: CompassTrack, ev: TrackEvaluation): void {
    const body = el('compassCurrentBody');
    if (!body) return;

    const totalLevels = track.levels.length;

    if (ev.currentLevel === 0) {
        body.innerHTML = `
            <div class="compass-current-status compass-status-start">
                <div class="compass-level-indicator">まだここから</div>
                <p class="compass-status-msg">
                    まだ資産がないか、最初の風景の条件を満たしていません。<br>
                    まずは日々の一歩ログから資産を抽出してみましょう。
                </p>
            </div>
            ${ev.nextLevel ? `<div class="compass-next-hint">次の風景: <strong>${escapeHtml(ev.nextLevel.name)}</strong></div>` : ''}
        `;
    } else if (ev.currentLevel >= totalLevels) {
        // 最終階層到達
        const currentLevelDef = track.levels.find(l => l.order === ev.currentLevel);
        body.innerHTML = `
            <div class="compass-current-status compass-status-complete">
                <div class="compass-level-indicator">Lv.${ev.currentLevel} ${escapeHtml(currentLevelDef?.name || '')}</div>
                <p class="compass-status-msg">このテーマで目指していたひとつの風景に到達しています。</p>
                <p class="compass-unlock-text">${escapeHtml(currentLevelDef?.unlock_text || '')}</p>
            </div>
        `;
    } else {
        // 途中
        const currentLevelDef = track.levels.find(l => l.order === ev.currentLevel);
        const missingCount = ev.missingRequirements.length;
        const statusClass = missingCount === 0 ? 'compass-status-ready' : 'compass-status-progress';
        const statusMsg = missingCount === 0
            ? '次の風景へ進む準備が整っています。'
            : `次の風景まで、あと ${missingCount} つの条件`;

        body.innerHTML = `
            <div class="compass-current-status ${statusClass}">
                <div class="compass-level-indicator">Lv.${ev.currentLevel} ${escapeHtml(currentLevelDef?.name || '')}</div>
                <div class="compass-progress-bar">
                    <div class="compass-progress-fill" style="width: ${Math.round(((ev.currentLevel) / totalLevels) * 100)}%"></div>
                </div>
                <p class="compass-status-msg">${statusMsg}</p>
            </div>
            ${ev.nextLevel ? `<div class="compass-next-hint">次の風景: <strong>Lv.${ev.nextLevel.order} ${escapeHtml(ev.nextLevel.name)}</strong></div>` : ''}
        `;
    }
}

// ===== 条件カード =====

function renderRequirementsCard(track: CompassTrack, ev: TrackEvaluation): void {
    const body = el('compassRequirementsBody');
    if (!body) return;

    if (!ev.nextLevel && ev.currentLevel > 0) {
        // 最終到達時
        body.innerHTML = '<div class="empty-state">今のところ不足している条件はありません。</div>';
        return;
    }

    const targetLevel = ev.nextLevel || track.levels[0];
    if (!targetLevel) {
        body.innerHTML = '<div class="empty-state">条件が定義されていません。</div>';
        return;
    }

    const satisfiedIds = new Set(ev.satisfiedRequirements.map(s => s.req.id));

    let html = `<div class="compass-req-level-label">Lv.${targetLevel.order} ${escapeHtml(targetLevel.name)} の条件:</div>`;
    html += '<ul class="compass-req-list">';

    for (const req of targetLevel.requirements) {
        const isSatisfied = satisfiedIds.has(req.id);
        const icon = isSatisfied ? '✅' : (req.optional ? '⭕' : '❓');
        const cssClass = isSatisfied ? 'compass-req-satisfied' : 'compass-req-missing';

        html += `
            <li class="${cssClass}">
                <span class="compass-req-icon">${icon}</span>
                <span class="compass-req-label">${escapeHtml(req.label)}</span>
                ${req.note ? `<span class="compass-req-note">${escapeHtml(req.note)}</span>` : ''}
                ${req.optional ? '<span class="compass-req-optional">（任意）</span>' : ''}
            </li>
        `;
    }

    html += '</ul>';
    body.innerHTML = html;
}

// ===== ミッションカード =====

function renderMissionCard(ev: TrackEvaluation): void {
    const body = el('compassMissionBody');
    if (!body) return;

    if (ev.suggestedMissions.length === 0) {
        if (ev.currentLevel > 0 && !ev.nextLevel) {
            body.innerHTML = '<div class="empty-state">現在のテーマでこれ以上進める予定はありません。</div>';
        } else {
            body.innerHTML = '<div class="empty-state">まずは日々の記録から資産を抽出してみましょう。</div>';
        }
        return;
    }

    let html = '<div class="compass-mission-list">';
    ev.suggestedMissions.forEach((mission, i) => {
        const kindIcon = MISSION_KIND_ICONS[mission.kind] || '📌';
        html += `
            <div class="compass-mission-item">
                <div class="compass-mission-header">
                    <span class="compass-mission-number">${i + 1}</span>
                    <span class="compass-mission-icon">${kindIcon}</span>
                    <span class="compass-mission-label">${escapeHtml(mission.label)}</span>
                </div>
                <div class="compass-mission-summary">${escapeHtml(mission.summary)}</div>
            </div>
        `;
    });
    html += '</div>';
    html += '<div class="compass-mission-note">※これらは単なる候補であり、義務ではありません。</div>';
    body.innerHTML = html;
}

// ===== 根拠資産カード =====

function renderEvidenceCard(ev: TrackEvaluation): void {
    const body = el('compassEvidenceBody');
    if (!body) return;

    const uniqueAssets = new Map<string, HenzanAsset>();
    ev.satisfiedRequirements.forEach(s => {
        if (s.matchedAsset && !uniqueAssets.has(s.matchedAsset.id)) {
            uniqueAssets.set(s.matchedAsset.id, s.matchedAsset);
        }
    });

    if (uniqueAssets.size === 0) {
        body.innerHTML = '<div class="empty-state">まだ判定に使える資産がありません。<br>編纂室で一歩ログから資産を抽出してみましょう。</div>';
        return;
    }

    let html = '<ul class="compass-evidence-list">';
    uniqueAssets.forEach(asset => {
        const icon = ASSET_TYPE_ICONS[asset.type] || '📋';
        html += `
            <li class="compass-evidence-item">
                <span class="compass-evidence-icon">${icon}</span>
                <span class="compass-evidence-name">${escapeHtml(asset.name)}</span>
                <span class="compass-evidence-meta">${asset.type} / ${asset.scale} / ${asset.status}</span>
            </li>
        `;
    });
    html += '</ul>';
    body.innerHTML = html;
}

// ===== 空状態描画 =====

function renderEmptyState(message: string): void {
    const body = el('compassCurrentBody');
    if (body) body.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}
