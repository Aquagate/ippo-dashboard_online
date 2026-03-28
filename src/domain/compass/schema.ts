// ===== 羅針盤: スキーマ定義 =====
// 人生の進むべき方向性（トラック）と到達すべき風景（階層）、
// および次の一歩（ミッション）を定義する。
// 編纂室の HenzanAsset を入力として照合する。

import type { HenzanAsset } from '../henzan/schema';

// --- 条件種別 ---
export const REQUIREMENT_TYPES = [
    'asset_name',       // 指定名を含む資産が存在するか
    'asset_type',       // 指定種別の資産が存在するか
    'scale_at_least',   // 指定規模以上の資産が存在するか
    'status_any_of',    // 許容状態のいずれかに合う資産があるか
] as const;
export type RequirementType = typeof REQUIREMENT_TYPES[number];

// --- ミッション種別 ---
export const MISSION_KINDS = [
    'buy',       // 購入・入手
    'learn',     // 学ぶ・調べる
    'search',    // 検索・探す
    'visit',     // 行く・体験する
    'setup',     // 準備・環境構築
    'practice',  // 練習・実践
] as const;
export type MissionKind = typeof MISSION_KINDS[number];

// --- ミッション種別アイコン ---
export const MISSION_KIND_ICONS: Record<MissionKind, string> = {
    buy: '🛒',
    learn: '📖',
    search: '🔍',
    visit: '🏃',
    setup: '🔧',
    practice: '🎯',
};

// --- 風景の条件（階層到達条件） ---
export interface CompassRequirement {
    id: string;
    label: string;
    type: RequirementType;
    expected: string;
    optional?: boolean;
    note?: string;
}

// --- 次の小さな一歩（ミッション候補） ---
export interface CompassMission {
    id: string;
    label: string;
    kind: MissionKind;
    summary: string;
    related_requirement_ids: string[];
}

// --- 1つの風景（階層） ---
export interface CompassLevel {
    id: string;
    order: number;
    name: string;             // 風景の名称
    description: string;
    requirements: CompassRequirement[];
    missions: CompassMission[];
    unlock_text: string;      // 到達時の静かなメッセージ
}

// --- 羅針盤が指す1つのテーマ（トラック） ---
export interface CompassTrack {
    id: string;
    name: string;             // 例: 「釣り」「水墨画」
    description: string;
    levels: CompassLevel[];
}

// --- 照合結果型 ---
export interface SatisfiedRequirement {
    req: CompassRequirement;
    matchedAsset?: HenzanAsset;
}

export interface TrackEvaluation {
    trackId: string;
    currentLevel: number;
    nextLevel: CompassLevel | null;
    readyToAdvance: boolean;
    satisfiedRequirements: SatisfiedRequirement[];
    missingRequirements: CompassRequirement[];
    suggestedMissions: CompassMission[];
}

// --- 状態保存（Storage用） ---
export interface CompassState {
    selectedTrackId?: string | null;
}
