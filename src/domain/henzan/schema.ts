// ===== 編纂室: 資産スキーマ定義 =====
// Phase 1 実装計画書 vNext+ に基づく型定義。
// 資産の種別・規模・状態・確信度を厳密に型定義し、
// 将来の制約資源スロット拡張にも対応できる構造とする。

// --- 資産種別 ---
export const ASSET_TYPES = ['技能', '環境', '知見', '進行資産'] as const;
export type AssetType = typeof ASSET_TYPES[number];

// --- 規模 ---
export const ASSET_SCALES = ['小', '中', '大'] as const;
export type AssetScale = typeof ASSET_SCALES[number];

// --- 状態 ---
export const ASSET_STATUSES = ['候補', '活性', '休眠', '進行中'] as const;
export type AssetStatus = typeof ASSET_STATUSES[number];

// --- AI判定の確信度 ---
export const CONFIDENCE_LEVELS = ['高', '中', '低'] as const;
export type Confidence = typeof CONFIDENCE_LEVELS[number];

// --- 種別表示用アイコン ---
export const ASSET_TYPE_ICONS: Record<AssetType, string> = {
    '技能': '⚡',
    '環境': '🏠',
    '知見': '💡',
    '進行資産': '🚀',
};

// --- 状態表示用カラー（CSSクラス名で使用） ---
export const ASSET_STATUS_COLORS: Record<AssetStatus, string> = {
    '候補': 'status-candidate',
    '活性': 'status-active',
    '休眠': 'status-dormant',
    '進行中': 'status-inprogress',
};

/**
 * 編纂室の資産データ。
 * 一歩ログから抽出・整理された再利用可能な資産を表す。
 */
export interface HenzanAsset {
    /** 資産固有ID（UUID v4） */
    id: string;
    /** 資産名称（例: "バイブコーディング"） */
    name: string;
    /** 種別 */
    type: AssetType;
    /** 規模 */
    scale: AssetScale;
    /** 状態 */
    status: AssetStatus;
    /** 資産の短い説明文 */
    summary: string;
    /** 根拠となる一歩ログID一覧 */
    evidence_log_ids: string[];
    /** 親資産ID（大中小の親子関係用） */
    parent_id: string | null;
    /** 関連資産ID一覧 */
    related_asset_ids: string[];
    /** AI判定の確信度 */
    confidence: Confidence;
    /** 作成日時（Unix ms） */
    created_at: number;
    /** 更新日時（Unix ms） */
    updated_at: number;
    // --- 将来拡張用（Phase 1では未使用） ---
    // importance?: number;
    // review_notes?: string;
    // last_reviewed_at?: number;
    // time_budget?: string;
    // energy_state?: '軽' | '中' | '重';
    // money_band?: '無料' | '安' | '中' | '高';
    // family_constraint?: 'なし' | '軽' | '重';
    // day_type_affinity?: '進む日' | '守る日' | 'どちらでも';
}

// --- 要確認トレイのイベント種別 ---
export const REVIEW_EVENT_TYPES = [
    '新規候補',
    '統合候補',
    '昇格候補',
    '親子関係候補',
    '命名変更候補',
] as const;
export type ReviewEventType = typeof REVIEW_EVENT_TYPES[number];

// --- 解決結果 ---
export type ReviewResolution = 'accepted' | 'rejected';

/**
 * 要確認トレイのイベント。
 * AIまたはルールベース抽出が生成し、人間が採択/却下する。
 */
export interface ReviewEvent {
    /** イベント固有ID */
    id: string;
    /** イベント種別 */
    type: ReviewEventType;
    /** 対象資産ID */
    target_asset_id: string;
    /** 提案内容（資産の一部フィールド） */
    suggested_data: Partial<HenzanAsset>;
    /** 統合先の資産ID（統合候補の場合のみ） */
    merge_target_id?: string;
    /** 作成日時（Unix ms） */
    created_at: number;
    /** 解決済みか */
    resolved: boolean;
    /** 解決日時 */
    resolved_at?: number;
    /** 解決結果 */
    resolution?: ReviewResolution;
}

// --- ユーティリティ ---

/** 新しい資産IDを生成する */
export function generateAssetId(): string {
    return crypto.randomUUID();
}

/** 新しいイベントIDを生成する */
export function generateEventId(): string {
    return `evt_${crypto.randomUUID()}`;
}

export function generateRunId(): string {
    return `run_${crypto.randomUUID()}`;
}

export function generateProposalId(): string {
    return `pro_${crypto.randomUUID()}`;
}

/** 新規資産のデフォルト値を生成する */
export function createDefaultAsset(overrides: Partial<HenzanAsset> = {}): HenzanAsset {
    const now = Date.now();
    return {
        id: generateAssetId(),
        name: '',
        type: '技能',
        scale: '小',
        status: '候補',
        summary: '',
        evidence_log_ids: [],
        parent_id: null,
        related_asset_ids: [],
        confidence: '中',
        created_at: now,
        updated_at: now,
        ...overrides,
    };
}

/** 表示用のフォーマット済み資産名を返す */
export function formatAssetLabel(asset: HenzanAsset): string {
    const icon = ASSET_TYPE_ICONS[asset.type] || '';
    return `${icon} ${asset.type}: ${asset.name}（${asset.scale}）`;
}

// ===== AIブリッジ 新スキーマ (vNext Plus) =====

export const HENZAN_PROPOSAL_OPERATIONS = [
    'create',
    'update_existing',
    'merge_into_existing',
    'rename_existing',
    'promote_scale',
    'link_related',
] as const;
export type HenzanProposalOperation = typeof HENZAN_PROPOSAL_OPERATIONS[number];

/** AIによる編纂提案の単体 */
export interface HenzanProposal {
    id: string;
    run_id: string;
    operation: HenzanProposalOperation;
    /** 操作対象の既存資産ID（update / promote / rename / link 等） */
    target_asset_id: string | null;
    /** 統合先の既存資産ID（merge の場合のみ使用） */
    merge_target_id: string | null;
    /** 新規または更新対象となるプロパティのみを保持 */
    candidate: Partial<HenzanAsset>;
    /** この提案の根拠となった一歩ログID一覧 */
    evidence_log_ids: string[];
    /** 根拠ログから抽出された証拠フレーズ一覧 */
    evidence_quotes: string[];
    /** AIによる提案理由の説明 */
    reason: string;
    /** 判定の確信度 */
    confidence: Confidence;
    
    // --- 原子分解/親子構造用 一時ID (インポート時のみ使用) ---
    /** 同一Run内での参照用一時ID（例: "p1"） */
    temp_id?: string;
    /** 同一Run内の別提案への参照用一時ID（例: "p1"） */
    parent_temp_id?: string;
    
    // --- 人間レビュー用状態 ---
    resolved: boolean;
    resolution?: 'accepted' | 'rejected' | 'snoozed';
    created_at: number;
    resolved_at?: number;
}

export type BridgeMode = 'discovery' | 'curate' | 'promote';

/** 1回のAIプロンプト実行（＝Bridge出力の取り込み）の単位情報 */
export interface HenzanBridgeRun {
    id: string;
    prompt_version: string;
    mode: BridgeMode;
    window_days: number;
    created_at: number;
    /** このRun由来のProposal ID群 */
    proposal_ids: string[];
}

