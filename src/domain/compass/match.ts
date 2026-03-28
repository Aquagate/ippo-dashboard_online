// ===== 羅針盤: 照合ロジック =====
// 編纂室の HenzanAsset を入力として、トラックの
// 現在地・不足条件・推奨ミッションを判定する。

import type { HenzanAsset, AssetScale } from '../henzan/schema';
import { ASSET_SCALES } from '../henzan/schema';
import type {
    CompassTrack, CompassLevel,
    CompassRequirement, CompassMission,
    TrackEvaluation, SatisfiedRequirement
} from './schema';
import type { CompassConstraints } from './constraints';

/**
 * 単一の条件が資産群で満たされているか判定する。
 */
export function isRequirementSatisfied(req: CompassRequirement, assets: HenzanAsset[]): { satisfied: boolean; matchedAsset?: HenzanAsset } {
    switch (req.type) {
        case 'asset_name': {
            // 指定文字列を名前に含む資産が存在するか
            const found = assets.find(a => a.name.includes(req.expected));
            return { satisfied: !!found, matchedAsset: found };
        }
        case 'asset_type': {
            // 種別が一致する資産が存在するか
            const found = assets.find(a => a.type === req.expected);
            return { satisfied: !!found, matchedAsset: found };
        }
        case 'status_any_of': {
            // カンマ区切りの許容状態のいずれかに合う資産があるか
            const allowed = req.expected.split(',').map(s => s.trim());
            const found = assets.find(a => allowed.includes(a.status));
            return { satisfied: !!found, matchedAsset: found };
        }
        case 'scale_at_least': {
            // 指定規模以上の資産が存在するか
            const scale = req.expected;
            const threshold = ASSET_SCALES.indexOf(scale as AssetScale);
            if (threshold === -1) return { satisfied: false };

            const found = assets.find(a => {
                if (!a.scale) return false;
                return ASSET_SCALES.indexOf(a.scale) >= threshold;
            });
            return { satisfied: !!found, matchedAsset: found };
        }
        default:
            return { satisfied: false };
    }
}

/**
 * トラックを評価し、現状の到達度と次の一歩を返す。
 * 制約資源 (CompassConstraints) を加味して提案を絞り込む。
 */
export function evaluateTrack(
    track: CompassTrack,
    assets: HenzanAsset[],
    constraints?: CompassConstraints
): TrackEvaluation {
    let currentLevel = 0;
    let nextLevel: CompassLevel | null = null;
    const satisfiedRequirements: SatisfiedRequirement[] = [];
    let missingRequirements: CompassRequirement[] = [];
    let suggestedMissions: CompassMission[] = [];

    // order順に階層を評価
    const sortedLevels = [...track.levels].sort((a, b) => a.order - b.order);

    for (let i = 0; i < sortedLevels.length; i++) {
        const level = sortedLevels[i];
        const reqs = level.requirements || [];

        const levelSatisfied: SatisfiedRequirement[] = [];
        const levelMissing: CompassRequirement[] = [];

        for (const req of reqs) {
            const result = isRequirementSatisfied(req, assets);
            if (result.satisfied) {
                levelSatisfied.push({ req, matchedAsset: result.matchedAsset });
            } else {
                levelMissing.push(req);
            }
        }

        // 不足条件のうち、optionalでないものがあればこの階層は未到達
        const criticalMissing = levelMissing.filter(r => !r.optional);

        if (criticalMissing.length === 0) {
            // この階層は到達済み
            currentLevel = level.order;
            satisfiedRequirements.push(...levelSatisfied);

            // optionalで未達成のものがあれば、それもmissingに入れておく（ミッションサジェスト用）
            // ただし、階層自体は突破しているので「次の階層」に集中させた方がUXが良い場合もある。
            // 今回は、突破した階層のoptionalタスクよりも、次の未突破階層のタスクを優先する。
        } else {
            // この階層でストップ
            nextLevel = level;
            satisfiedRequirements.push(...levelSatisfied);
            missingRequirements = levelMissing;

            // 関連ミッションの抽出
            const missingIds = new Set(levelMissing.map(r => r.id));
            let rawMissions = (level.missions || []).filter(m =>
                m.related_requirement_ids.some(id => missingIds.has(id))
            );

            // 制約エンジンによる絞り込み (Phase 2C)
            if (constraints) {
                // 1. 時間制約によるフィルタ: 厳守なら重いタスク（visit, practice）を除外
                if (constraints.time === 'strict') {
                    rawMissions = rawMissions.filter(m => m.kind !== 'visit' && m.kind !== 'practice');
                }

                // TODO: お金や家族によるフィルタも今後追加していく（今回は簡略）
            }

            suggestedMissions = rawMissions;

            // 2. 体力制約によるサジェスト数の上限
            let maxMissions = 3;
            if (constraints?.energy === 'strict') maxMissions = 1;
            else if (constraints?.energy === 'mid') maxMissions = 2;

            suggestedMissions = suggestedMissions.slice(0, maxMissions);

            break; // 以降の階層は見ない
        }
    }

    return {
        trackId: track.id,
        currentLevel,
        nextLevel,
        readyToAdvance: missingRequirements.filter(r => !r.optional).length === 0 && nextLevel !== null,
        satisfiedRequirements,
        missingRequirements,
        suggestedMissions
    };
}
