// ===== 編纂室: 資産データバリデーション =====
// 資産とイベントデータの整合性チェック。
// IndexedDB からのロード時やLLM出力パース時に使用する。

import {
    ASSET_TYPES, ASSET_SCALES, ASSET_STATUSES, CONFIDENCE_LEVELS,
    REVIEW_EVENT_TYPES, HENZAN_PROPOSAL_OPERATIONS,
    type HenzanAsset, type ReviewEvent,
    type HenzanBridgeRun, type HenzanProposal,
} from './schema';

/** バリデーション結果 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * HenzanAsset のバリデーション。
 * 必須フィールドの存在と値域チェック。
 */
export function validateHenzanAsset(data: unknown): ValidationResult {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['資産データがオブジェクトではありません'] };
    }
    const d = data as Record<string, unknown>;

    // 必須文字列フィールド
    if (typeof d.id !== 'string' || !d.id) errors.push('id が未設定です');
    if (typeof d.name !== 'string' || !d.name) errors.push('name が未設定です');
    if (typeof d.summary !== 'string') errors.push('summary が文字列ではありません');

    // 列挙値チェック
    if (!ASSET_TYPES.includes(d.type as any)) {
        errors.push(`type "${d.type}" は無効です（有効値: ${ASSET_TYPES.join(', ')}）`);
    }
    if (!ASSET_SCALES.includes(d.scale as any)) {
        errors.push(`scale "${d.scale}" は無効です（有効値: ${ASSET_SCALES.join(', ')}）`);
    }
    if (!ASSET_STATUSES.includes(d.status as any)) {
        errors.push(`status "${d.status}" は無効です（有効値: ${ASSET_STATUSES.join(', ')}）`);
    }
    if (!CONFIDENCE_LEVELS.includes(d.confidence as any)) {
        errors.push(`confidence "${d.confidence}" は無効です（有効値: ${CONFIDENCE_LEVELS.join(', ')}）`);
    }

    // 配列フィールド
    if (!Array.isArray(d.evidence_log_ids)) {
        errors.push('evidence_log_ids が配列ではありません');
    }
    if (!Array.isArray(d.related_asset_ids)) {
        errors.push('related_asset_ids が配列ではありません');
    }

    // タイムスタンプ
    if (typeof d.created_at !== 'number' || d.created_at <= 0) {
        errors.push('created_at が不正です');
    }
    if (typeof d.updated_at !== 'number' || d.updated_at <= 0) {
        errors.push('updated_at が不正です');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * ReviewEvent のバリデーション。
 */
export function validateReviewEvent(data: unknown): ValidationResult {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['イベントデータがオブジェクトではありません'] };
    }
    const d = data as Record<string, unknown>;

    if (typeof d.id !== 'string' || !d.id) errors.push('id が未設定です');
    if (!REVIEW_EVENT_TYPES.includes(d.type as any)) {
        errors.push(`type "${d.type}" は無効です`);
    }
    if (typeof d.target_asset_id !== 'string' || !d.target_asset_id) {
        errors.push('target_asset_id が未設定です');
    }
    if (typeof d.created_at !== 'number') errors.push('created_at が不正です');
    if (typeof d.resolved !== 'boolean') errors.push('resolved がboolean型ではありません');

    return { valid: errors.length === 0, errors };
}

/**
 * 資産配列を一括バリデーションし、有効なもののみ返す。
 * 不正データを静かに弾くことで、壊れたデータでもアプリが死なないようにする。
 */
export function filterValidAssets(assets: unknown[]): HenzanAsset[] {
    if (!Array.isArray(assets)) return [];
    return assets.filter(a => validateHenzanAsset(a).valid) as HenzanAsset[];
}

/**
 * イベント配列を一括バリデーション。
 */
export function filterValidEvents(events: unknown[]): ReviewEvent[] {
    if (!Array.isArray(events)) return [];
    return events.filter(e => validateReviewEvent(e).valid) as ReviewEvent[];
}

/**
 * HenzanBridgeRun のバリデーション
 */
export function validateHenzanBridgeRun(data: unknown): ValidationResult {
    const errors: string[] = [];
    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Runデータがオブジェクトではありません'] };
    }
    const d = data as Record<string, unknown>;

    if (typeof d.id !== 'string' || !d.id) errors.push('id がありません');
    if (typeof d.prompt_version !== 'string' || !d.prompt_version) errors.push('prompt_version がありません');
    if (!['discovery', 'curate', 'promote'].includes(d.mode as string)) errors.push(`mode "${d.mode}" が無効です`);
    if (typeof d.window_days !== 'number') errors.push('window_days が数値ではありません');
    if (typeof d.created_at !== 'number') errors.push('created_at が数値ではありません');
    if (!Array.isArray(d.proposal_ids)) errors.push('proposal_ids が配列ではありません');

    return { valid: errors.length === 0, errors };
}

/**
 * HenzanProposal のバリデーション
 */
export function validateHenzanProposal(data: unknown): ValidationResult {
    const errors: string[] = [];
    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Proposalデータがオブジェクトではありません'] };
    }
    const d = data as Record<string, unknown>;

    if (typeof d.id !== 'string' || !d.id) errors.push('id がありません');
    if (typeof d.run_id !== 'string' || !d.run_id) errors.push('run_id がありません');
    if (!HENZAN_PROPOSAL_OPERATIONS.includes(d.operation as any)) errors.push(`operation "${d.operation}" が無効です`);

    // オプションのインポート一時ID
    if (d.temp_id && typeof d.temp_id !== 'string') errors.push('temp_id が文字列ではありません');
    if (d.parent_temp_id && typeof d.parent_temp_id !== 'string') errors.push('parent_temp_id が文字列ではありません');

    if (typeof d.candidate !== 'object' || !d.candidate) {
        errors.push('candidate がオブジェクトではありません');
    } else {
        const c = d.candidate as Record<string, any>;
        if (d.operation === 'create') {
            if (!c.name || typeof c.name !== 'string') errors.push('operation: "create" needs candidate.name and candidate.type');
        }
    }

    if (d.operation !== 'create') {
        if (typeof d.target_asset_id !== 'string' || !d.target_asset_id) {
            errors.push(`operation: "${d.operation}" needs target_asset_id`);
        }
    }
    
    if (d.operation === 'merge_into_existing') {
        if (typeof d.merge_target_id !== 'string' || !d.merge_target_id) {
            errors.push(`operation: "${d.operation}" needs target_asset_id and merge_target_id`);
        }
    }

    if (!Array.isArray(d.evidence_log_ids)) errors.push('evidence_log_ids が配列ではありません');
    if (!Array.isArray(d.evidence_quotes)) errors.push('evidence_quotes が配列ではありません');
    if (typeof d.reason !== 'string') errors.push('reason が文字列ではありません');
    if (!CONFIDENCE_LEVELS.includes(d.confidence as any)) errors.push(`confidence "${d.confidence}" が無効です`);
    if (typeof d.resolved !== 'boolean') errors.push('resolved がbooleanではありません');

    return { valid: errors.length === 0, errors };
}
