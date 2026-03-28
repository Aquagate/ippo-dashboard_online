// ===== 羅針盤: 制約資源定義 =====
// ユーザーの行動制約（時間、体力、お金、家族制約など）を表す。

export type ConstraintLevel = 'strict' | 'mid' | 'loose';

export interface CompassConstraints {
    /** 確保できる時間 */
    time: ConstraintLevel;
    /** 現在の体力・気力 */
    energy: ConstraintLevel;
    /** 使えるお金 */
    money: ConstraintLevel;
    /** 家族・家事などの制約 */
    family: ConstraintLevel;
}

/**
 * 開発用モックデータ
 * UI上で右上に表示し、将来的には判定エンジンにも組み込む。
 */
export const SAMPLE_CONSTRAINTS: CompassConstraints = {
    time: 'mid',
    energy: 'strict',
    money: 'loose',
    family: 'mid'
};

/**
 * 制約レベルに対応する色味クラスへのマッピング
 */
export function getConstraintColorClass(level: ConstraintLevel): string {
    switch (level) {
        case 'strict': return 'hobby-const-strict'; // 後でcompass-const-strict等に変更するが、CSSはまだそのままの場合は後で修正。
        case 'mid': return 'hobby-const-mid';
        case 'loose': return 'hobby-const-loose';
    }
}

/**
 * 制約レベルに対応する表示文言のマッピング
 */
export function getConstraintLabel(level: ConstraintLevel): string {
    switch (level) {
        case 'strict': return '守る';
        case 'mid': return '中';
        case 'loose': return '進む';
    }
}

export const CONSTRAINT_META: Record<keyof CompassConstraints, { icon: string, label: string, labelValue: string }> = {
    time: { icon: '⏳', label: '時間帯', labelValue: '中' },
    energy: { icon: '🔋', label: '体力帯', labelValue: '守る' },
    money: { icon: '💰', label: 'お金帯', labelValue: '進む' },
    family: { icon: '🏠', label: '家族制約', labelValue: '中' }
};
