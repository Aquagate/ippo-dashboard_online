// ===== 編纂室: バリデーションテスト =====

import { describe, it, expect } from 'vitest';
import { validateHenzanAsset, validateReviewEvent, filterValidAssets } from './validate';
import { createDefaultAsset, generateEventId } from './schema';

describe('validateHenzanAsset', () => {
    it('有効な資産を通す', () => {
        const asset = createDefaultAsset({ name: 'バイブコーディング' });
        const result = validateHenzanAsset(asset);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('null を弾く', () => {
        const result = validateHenzanAsset(null);
        expect(result.valid).toBe(false);
    });

    it('name 未設定を弾く', () => {
        const asset = createDefaultAsset();
        // name は空文字のまま
        const result = validateHenzanAsset(asset);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('name'))).toBe(true);
    });

    it('不正な type を弾く', () => {
        const asset = createDefaultAsset({ name: 'テスト' }) as any;
        asset.type = '不正な種別';
        const result = validateHenzanAsset(asset);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('type'))).toBe(true);
    });

    it('不正な scale を弾く', () => {
        const asset = createDefaultAsset({ name: 'テスト' }) as any;
        asset.scale = 'XL';
        const result = validateHenzanAsset(asset);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('scale'))).toBe(true);
    });

    it('不正な status を弾く', () => {
        const asset = createDefaultAsset({ name: 'テスト' }) as any;
        asset.status = '削除済み';
        const result = validateHenzanAsset(asset);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('status'))).toBe(true);
    });

    it('evidence_log_ids が配列でない場合を弾く', () => {
        const asset = createDefaultAsset({ name: 'テスト' }) as any;
        asset.evidence_log_ids = 'not_array';
        const result = validateHenzanAsset(asset);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('evidence_log_ids'))).toBe(true);
    });
});

describe('validateReviewEvent', () => {
    it('有効なイベントを通す', () => {
        const event = {
            id: generateEventId(),
            type: '新規候補' as const,
            target_asset_id: 'asset_123',
            suggested_data: {},
            created_at: Date.now(),
            resolved: false,
        };
        const result = validateReviewEvent(event);
        expect(result.valid).toBe(true);
    });

    it('不正な type を弾く', () => {
        const event = {
            id: generateEventId(),
            type: '不正なイベント',
            target_asset_id: 'asset_123',
            created_at: Date.now(),
            resolved: false,
        };
        const result = validateReviewEvent(event);
        expect(result.valid).toBe(false);
    });
});

describe('filterValidAssets', () => {
    it('有効な資産のみフィルタする', () => {
        const valid1 = createDefaultAsset({ name: 'バイブコーディング' });
        const valid2 = createDefaultAsset({ name: '踏み台昇降' });
        const invalid = { id: '', name: '' }; // 不正データ

        const result = filterValidAssets([valid1, invalid, valid2]);
        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('バイブコーディング');
        expect(result[1].name).toBe('踏み台昇降');
    });

    it('配列でない入力に対して空配列を返す', () => {
        expect(filterValidAssets('not_array' as any)).toEqual([]);
    });
});
