import { describe, it, expect } from 'vitest';
import { isRequirementSatisfied, evaluateTrack } from './match';
import type { CompassRequirement, CompassTrack } from './schema';
import type { HenzanAsset } from '../henzan/schema';

describe('isRequirementSatisfied', () => {
    it('asset_name: 名前を含む資産があれば満たされる', () => {
        const req: CompassRequirement = { id: 'r1', label: 'fishing', type: 'asset_name', expected: '釣り' };
        const assets: HenzanAsset[] = [{ id: 'a1', name: '海釣り', type: '環境', scale: '中', status: '活性' } as HenzanAsset];
        const result = isRequirementSatisfied(req, assets);
        expect(result.satisfied).toBe(true);
    });

    it('asset_type: 種別が一致すれば満たされる', () => {
        const req: CompassRequirement = { id: 'r2', label: 'item', type: 'asset_type', expected: '環境' };
        const assets: HenzanAsset[] = [{ id: 'a1', name: 'ペン', type: '環境', scale: '中', status: '活性' } as HenzanAsset];
        const result = isRequirementSatisfied(req, assets);
        expect(result.satisfied).toBe(true);
    });
});

describe('evaluateTrack', () => {
    const dummyTrack: CompassTrack = {
        id: 't1',
        name: 'test track',
        description: 'desc',
        levels: [
            {
                id: 'l1',
                order: 1,
                name: 'Level 1',
                description: 'desc1',
                unlock_text: 'unlocked 1',
                requirements: [
                    { id: 'req1', label: 'buy item', type: 'asset_type', expected: '環境' }
                ],
                missions: [
                    { id: 'm1', label: 'mission 1', kind: 'buy', summary: 'buy it', related_requirement_ids: ['req1'] },
                    { id: 'm2', label: 'mission 2', kind: 'visit', summary: 'visit', related_requirement_ids: ['req1'] }
                ]
            }
        ]
    };

    it('条件を満たしていない場合、ミッションがサジェストされる', () => {
        const result = evaluateTrack(dummyTrack, []);
        expect(result.readyToAdvance).toBe(false);
        expect(result.suggestedMissions).toHaveLength(2);
    });

    it('制約(体力: strict) がある場合、サジェスト数が制限される', () => {
        const result = evaluateTrack(dummyTrack, [], { time: 'loose', energy: 'strict', money: 'loose', family: 'loose' });
        expect(result.suggestedMissions).toHaveLength(1); // 2個の候補が1個になる
    });

    it('制約(時間: strict) がある場合、visit系が除外される', () => {
        const result = evaluateTrack(dummyTrack, [], { time: 'strict', energy: 'loose', money: 'loose', family: 'loose' });
        expect(result.suggestedMissions).toHaveLength(1); // m2 (visit) が外れる
        expect(result.suggestedMissions[0].id).toBe('m1');
    });
});
