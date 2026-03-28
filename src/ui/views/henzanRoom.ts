// ===== 編纂室 View =====
// サマリバー、要確認トレイ、資産一覧テーブル、
// 資産詳細パネル、抽出ブリッジを管理する。

import { dataCache } from '../../app/store';
import { storageSaveData } from '../../services/storage/localStorage';
import { getActiveEntries } from '../../app/store';
import {
    ASSET_TYPE_ICONS, ASSET_STATUS_COLORS,
    type HenzanAsset, type ReviewEvent,
    type AssetType, type AssetScale, type Confidence,
    createDefaultAsset, generateEventId,
} from '../../domain/henzan/schema';
import { filterValidAssets, filterValidEvents } from '../../domain/henzan/validate';
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

    // ルールベース自動抽出
    el('btnHenzanAutoExtract')?.addEventListener('click', handleAutoExtract);

    // AIプロンプト生成
    el('btnHenzanPrompt30')?.addEventListener('click', () => handlePromptGenerate(30));
    el('btnHenzanPrompt90')?.addEventListener('click', () => handlePromptGenerate(90));

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

    const pendingCount = getPendingEvents().length;
    const badge = el('henzanReviewBadge');
    if (badge) {
        badge.style.display = pendingCount > 0 ? 'flex' : 'none';
    }
    setText('henzanReviewCount', String(pendingCount));
    setText('henzanReviewCount2', String(pendingCount));
}

// ===== 要確認トレイ =====

function renderReviewTray(): void {
    const container = el('henzanReviewList');
    if (!container) return;

    const pending = getPendingEvents();

    if (pending.length === 0) {
        container.innerHTML = '<div class="empty-state">現在、確認待ちの候補はありません。</div>';
        return;
    }

    container.innerHTML = '';
    pending.forEach(event => {
        const card = document.createElement('div');
        const asset = event.suggested_data;

        // 確信度に応じたクラス付与
        const confidenceClass = asset?.confidence === '高' ? 'confidence-high' :
                                asset?.confidence === '中' ? 'confidence-medium' :
                                asset?.confidence === '低' ? 'confidence-low' : '';
        card.className = `henzan-review-card ${confidenceClass}`;

        const icon = asset?.type ? (ASSET_TYPE_ICONS[asset.type] || '') : '📋';
        const name = asset?.name || '（名称不明）';
        const typeBadge = event.type;

        card.innerHTML = `
            <div class="henzan-review-card-header">
                <span class="henzan-review-type">${typeBadge}</span>
                <span>${icon} ${escapeHtml(name)}</span>
            </div>
            <div class="henzan-review-card-summary">${escapeHtml(asset?.summary || '')}</div>
            <div class="henzan-review-card-actions">
                <button type="button" class="btn-ghost henzan-btn-accept" data-event-id="${event.id}">✅ 採択</button>
                <button type="button" class="btn-ghost henzan-btn-reject" data-event-id="${event.id}">❌ 却下</button>
            </div>
        `;

        // イベントリスナー
        card.querySelector('.henzan-btn-accept')?.addEventListener('click', () => resolveEvent(event.id, 'accepted'));
        card.querySelector('.henzan-btn-reject')?.addEventListener('click', () => resolveEvent(event.id, 'rejected'));

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
    assets.forEach(asset => {
        const tr = document.createElement('tr');
        tr.className = 'henzan-asset-row';
        tr.dataset.assetId = asset.id;

        const icon = ASSET_TYPE_ICONS[asset.type] || '';
        const statusClass = ASSET_STATUS_COLORS[asset.status] || '';
        const dateStr = new Date(asset.updated_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });

        tr.innerHTML = `
            <td class="henzan-asset-name">${icon} ${escapeHtml(asset.name)}</td>
            <td><span class="henzan-scale-badge">${asset.scale}</span></td>
            <td><span class="henzan-status-badge ${statusClass}">${asset.status}</span></td>
            <td class="henzan-evidence-count">${asset.evidence_log_ids.length}</td>
            <td class="henzan-date">${dateStr}</td>
        `;

        tr.addEventListener('click', () => showDetail(asset.id));
        tbody.appendChild(tr);
    });
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

// ===== ルールベース自動抽出 =====

function handleAutoExtract(): void {
    const entries = getActiveEntries();
    if (entries.length === 0) {
        showMessage('henzanAutoExtractMsg', '一歩ログがありません。先にログを追加してください。');
        return;
    }

    const existingAssets = getAssets();
    const existingNames = new Set(existingAssets.map(a => a.name.toLowerCase()));

    // 過去60日のエントリを対象
    const border = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const recent = entries.filter(e => e.ts >= border);
    if (recent.length === 0) {
        showMessage('henzanAutoExtractMsg', '過去60日のログがありません。');
        return;
    }

    // カテゴリ頻度集計
    const catCount: Record<string, number> = {};
    recent.forEach(e => {
        const cat = e.category || 'その他';
        catCount[cat] = (catCount[cat] || 0) + 1;
    });

    // キーワード抽出（頻出単語）
    const wordCount: Record<string, number> = {};
    recent.forEach(e => {
        const words = extractKeywords(e.text);
        words.forEach(w => {
            wordCount[w] = (wordCount[w] || 0) + 1;
        });
    });

    // 候補生成
    const newEvents: ReviewEvent[] = [];
    const now = Date.now();

    // 1. カテゴリベースの技能候補
    const topCats = Object.entries(catCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    topCats.forEach(([cat, count]) => {
        if (count >= 3) {
            const skillName = `${cat}関連の活動`;
            if (!existingNames.has(skillName.toLowerCase())) {
                const asset = createDefaultAsset({
                    name: skillName,
                    type: '技能',
                    summary: `過去60日で${count}件の${cat}カテゴリのログあり`,
                    confidence: count >= 10 ? '高' : count >= 5 ? '中' : '低',
                    evidence_log_ids: recent.filter(e => e.category === cat).slice(0, 5).map(e => e.id),
                });
                newEvents.push({
                    id: generateEventId(),
                    type: '新規候補',
                    target_asset_id: asset.id,
                    suggested_data: asset,
                    created_at: now,
                    resolved: false,
                });
            }
        }
    });

    // 2. 頻出キーワードベースの知見候補
    const topWords = Object.entries(wordCount)
        .filter(([w]) => w.length >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    topWords.forEach(([word, count]) => {
        if (count >= 3 && !existingNames.has(word.toLowerCase())) {
            const matchingEntries = recent.filter(e => e.text.includes(word)).slice(0, 3);
            const asset = createDefaultAsset({
                name: word,
                type: '知見',
                summary: `「${word}」が過去60日で${count}回出現`,
                confidence: '低',
                evidence_log_ids: matchingEntries.map(e => e.id),
            });
            newEvents.push({
                id: generateEventId(),
                type: '新規候補',
                target_asset_id: asset.id,
                suggested_data: asset,
                created_at: now,
                resolved: false,
            });
        }
    });

    // 3. 既存資産への根拠追記候補
    existingAssets.forEach(existing => {
        const newEvidence = recent.filter(e => {
            const text = e.text.toLowerCase();
            return text.includes(existing.name.toLowerCase()) &&
                !existing.evidence_log_ids.includes(e.id);
        });
        if (newEvidence.length > 0) {
            // 自動反映（要確認に回さない）
            existing.evidence_log_ids.push(...newEvidence.map(e => e.id));
            existing.updated_at = now;
            if (existing.status === '休眠') {
                existing.status = '活性';
            }
        }
    });

    if (newEvents.length > 0) {
        dataCache.reviewEvents.push(...newEvents);
    }

    // 保存
    storageSaveData(dataCache);
    renderAll();

    const msg = newEvents.length > 0
        ? `✅ ${newEvents.length}件の新規候補を要確認トレイに追加しました。`
        : '✅ 抽出完了。新規候補はありませんでした（既存資産への根拠追記は自動反映済み）。';
    showMessage('henzanAutoExtractMsg', msg);
    showToast(msg, 'ok');
}

// ===== AIプロンプト生成 =====

function handlePromptGenerate(days: number): void {
    const entries = getActiveEntries();
    const border = Date.now() - days * 24 * 60 * 60 * 1000;
    const recent = entries.filter(e => e.ts >= border);

    if (recent.length === 0) {
        showToast(`過去${days}日のログがありません。`, 'err');
        return;
    }

    const existingAssets = getAssets();

    // ログの要約（最大50件）
    const logSummary = recent.slice(0, 50).map(e =>
        `- [${e.date}] [${e.category}] ${e.text}`
    ).join('\n');

    // 既存資産リスト
    const assetList = existingAssets.length > 0
        ? existingAssets.map(a => `- ${ASSET_TYPE_ICONS[a.type]} ${a.type}: ${a.name}（${a.scale}）[${a.status}]`).join('\n')
        : '（まだ資産はありません）';

    const prompt = `# 編纂室: 資産候補抽出プロンプト

## あなたの役割
一歩ログ（日々の行動記録）を分析し、再利用可能な「資産」を抽出してください。

## 資産の種別
- 技能: 自分が扱える能力、手法、実践力
- 環境: 実装済みの装備、導線、道具
- 知見: 経験から得た再利用可能な理解
- 進行資産: 未完了だが進行中の対象

## ルール
- 1ログあたり0〜3件の候補
- 抽象的すぎる名前は禁止（成長力、問題解決力、継続力 など）
- 具体的な行為・実装・理解を優先
- 既存資産と重複する場合は新規追加せず、根拠追記として扱う
- 規模: 小（単独成立）/ 中（複数の小を束ねた実用単位）/ 大（体系・OS・構造）

## 既存資産
${assetList}

## 過去${days}日の一歩ログ（${recent.length}件）
${logSummary}

## 出力形式（JSON）
以下の形式で出力してください:
\`\`\`json
{
  "assets": [
    {
      "name": "資産名",
      "type": "技能|環境|知見|進行資産",
      "scale": "小|中|大",
      "summary": "短い説明",
      "confidence": "高|中|低",
      "evidence_entries": ["対応するログの日付や内容の一部"],
      "is_new": true,
      "similar_existing": null
    }
  ]
}
\`\`\``;

    navigator.clipboard.writeText(prompt).then(() => {
        showToast('📋 プロンプトをクリップボードにコピーしました。外部LLMに貼り付けてください。', 'ok');
    }).catch(() => {
        showToast('コピーに失敗しました。', 'err');
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
        // JSON部分を抽出（```json ... ``` でラップされている場合も対応）
        let jsonStr = textarea.value.trim();
        const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1].trim();

        const parsed = JSON.parse(jsonStr);
        if (!parsed.assets || !Array.isArray(parsed.assets)) {
            throw new Error('assets 配列が見つかりません');
        }

        const now = Date.now();
        const entries = getActiveEntries();
        let importCount = 0;

        parsed.assets.forEach((raw: any) => {
            if (!raw.name || !raw.type) return;

            // 正規化マッピング
            const mappedType = mapAiType(String(raw.type));
            const mappedScale = mapAiScale(String(raw.scale || ''));
            const mappedConfidence = mapAiConfidence(String(raw.confidence || ''));

            // エントリIDのマッチング（日付やテキストで）
            const evidenceIds: string[] = [];
            if (raw.evidence_entries && Array.isArray(raw.evidence_entries)) {
                raw.evidence_entries.forEach((hint: string) => {
                    const match = entries.find(e =>
                        e.text.includes(hint) || e.date === hint
                    );
                    if (match) evidenceIds.push(match.id);
                });
            }

            const asset = createDefaultAsset({
                name: raw.name,
                type: mappedType,
                scale: mappedScale,
                summary: raw.summary || '',
                confidence: mappedConfidence,
                evidence_log_ids: evidenceIds,
            });

            const event: ReviewEvent = {
                id: generateEventId(),
                type: '新規候補',
                target_asset_id: asset.id,
                suggested_data: asset,
                created_at: now,
                resolved: false,
            };

            dataCache.reviewEvents.push(event);
            importCount++;
        });

        storageSaveData(dataCache);
        renderAll();

        textarea.value = '';
        showMessage('henzanAiImportMsg', `✅ ${importCount}件の候補を要確認トレイに追加しました。`);
        showToast(`📥 ${importCount}件の資産候補を取り込みました。`, 'ok');
    } catch (e: any) {
        showMessage('henzanAiImportMsg', `❌ JSON解析エラー: ${e.message}`);
    }
}

// ===== イベント解決（採択/却下） =====

function resolveEvent(eventId: string, resolution: 'accepted' | 'rejected'): void {
    // UX: 解決アニメーション開始
    const btn = document.querySelector(`.henzan-btn-${resolution === 'accepted' ? 'accept' : 'reject'}[data-event-id="${eventId}"]`);
    const cardEl = btn?.closest('.henzan-review-card');
    if (cardEl) {
        cardEl.classList.add('henzan-card-solving');
    }

    // アニメーション(400ms)後にステート更新と再描画
    setTimeout(() => {
        const event = dataCache.reviewEvents.find(e => e.id === eventId);
        if (!event) return;

        event.resolved = true;
        event.resolved_at = Date.now();
        event.resolution = resolution;

        if (resolution === 'accepted' && event.suggested_data) {
            // 新規候補の場合: 資産として正式追加、状態を「活性」に
            const newAsset: HenzanAsset = {
                ...createDefaultAsset(),
                ...event.suggested_data,
                status: '活性',
                updated_at: Date.now(),
            };
            dataCache.henzanAssets.push(newAsset);
            showToast(`✅ 「${newAsset.name}」を資産に追加しました。`, 'ok');
        } else {
            showToast('❌ 候補を却下しました。', 'ok');
        }

        storageSaveData(dataCache);
        renderAll();
    }, 400);
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

function getAssets(): HenzanAsset[] {
    return dataCache.henzanAssets || [];
}

function getPendingEvents(): ReviewEvent[] {
    return (dataCache.reviewEvents || []).filter(e => !e.resolved);
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

function extractKeywords(text: string): string[] {
    // 基本的なキーワード抽出（日本語対応の簡易版）
    // 不要語を除外して2文字以上の語を返す
    const stopWords = new Set([
        'した', 'する', 'ある', 'いる', 'なる', 'やる', 'できる',
        'この', 'その', 'あの', 'ため', 'こと', 'もの', 'ところ',
        'ない', 'ので', 'から', 'まで', 'など', 'として', 'について',
    ]);

    return text
        .replace(/[、。！？「」（）\[\]【】・\n\r]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 2 && !stopWords.has(w))
        .slice(0, 10);
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
