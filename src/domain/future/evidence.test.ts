// ===== evidence.ts テスト =====
// 構造化要約の生成を検証

import { describe, it, expect } from 'vitest'
import { buildEvidenceSummary } from './evidence'
import type { Entry, DailyState } from '../schema'

// テスト用ヘルパー
function makeEntry(overrides: Partial<Entry> = {}): Entry {
    return {
        id: 'e1',
        date: '2026-01-15',
        text: 'テスト',
        category: '仕事',
        tod: ['morning'],
        ts: Date.now(),
        updatedAt: Date.now(),
        deleted: false,
        rev: 0,
        deviceId: 'test',
        ...overrides,
    }
}

describe('buildEvidenceSummary', () => {
    it('エントリ0件でも破綻しない', () => {
        const result = buildEvidenceSummary({
            entries: [],
            dailyStates: {},
            windowDays: 30,
        })
        expect(result.entryCount).toBe(0)
        expect(result.text).toContain('データ不足')
        expect(result.topCategories).toEqual([])
    })

    it('カテゴリ傾向が正しく集計される', () => {
        const entries = [
            makeEntry({ id: '1', category: '仕事', ts: Date.now() }),
            makeEntry({ id: '2', category: '仕事', ts: Date.now() }),
            makeEntry({ id: '3', category: '健康', ts: Date.now() }),
            makeEntry({ id: '4', category: '学び', ts: Date.now() }),
        ]
        const result = buildEvidenceSummary({
            entries,
            dailyStates: {},
            windowDays: 30,
        })
        expect(result.topCategories[0].category).toBe('仕事')
        expect(result.topCategories[0].count).toBe(2)
        expect(result.text).toContain('カテゴリ傾向')
        expect(result.text).toContain('仕事')
    })

    it('時間帯の偏りが集計される', () => {
        const entries = [
            makeEntry({ id: '1', tod: ['morning'], ts: Date.now() }),
            makeEntry({ id: '2', tod: ['morning'], ts: Date.now() }),
            makeEntry({ id: '3', tod: ['night'], ts: Date.now() }),
        ]
        const result = buildEvidenceSummary({
            entries,
            dailyStates: {},
            windowDays: 30,
        })
        expect(result.todDistribution.morning).toBe(2)
        expect(result.todDistribution.night).toBe(1)
        expect(result.text).toContain('時間帯の偏り')
    })

    it('メンタル低下日の罠が検出される', () => {
        const entries = [
            makeEntry({ id: '1', date: '2026-01-10', category: '仕事', tod: ['night'], ts: Date.now() }),
            makeEntry({ id: '2', date: '2026-01-11', category: '仕事', tod: ['night'], ts: Date.now() }),
            makeEntry({ id: '3', date: '2026-01-12', category: '遊び', tod: ['morning'], ts: Date.now() }),
        ]
        const dailyStates: Record<string, DailyState> = {
            '2026-01-10': { mental: 1, rev: 0, deviceId: 'test' },
            '2026-01-11': { mental: 2, rev: 0, deviceId: 'test' },
            '2026-01-12': { mental: 4, rev: 0, deviceId: 'test' },
        }
        const result = buildEvidenceSummary({
            entries,
            dailyStates,
            windowDays: 30,
        })
        expect(result.traps.length).toBeGreaterThan(0)
        expect(result.text).toContain('避けるべき罠')
    })

    it('文字数上限を超えない', () => {
        // 大量のエントリを生成
        const entries = Array.from({ length: 200 }, (_, i) =>
            makeEntry({
                id: `e${i}`,
                date: `2026-01-${String(1 + (i % 28)).padStart(2, '0')}`,
                text: `テストエントリ${i}の長いテキストここに${i}回目のようやくです`,
                category: ['仕事', '健康', '学び', '遊び', '家族', '投資'][i % 6],
                tod: [['morning', 'afternoon', 'night'][i % 3]],
                ts: Date.now() - i * 60000,
            })
        )
        const result = buildEvidenceSummary({
            entries,
            dailyStates: {},
            windowDays: 90,
        })
        expect(result.text.length).toBeLessThanOrEqual(2000)
    })

    it('削除済みエントリは除外される', () => {
        const entries = [
            makeEntry({ id: '1', deleted: false, ts: Date.now() }),
            makeEntry({ id: '2', deleted: true, ts: Date.now() }),
        ]
        const result = buildEvidenceSummary({
            entries,
            dailyStates: {},
            windowDays: 30,
        })
        expect(result.entryCount).toBe(1)
    })
})
