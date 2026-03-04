// ===== merge.ts テスト =====
// 決定的マージの基本動作を検証

import { describe, it, expect } from 'vitest'
import { mergeData } from './merge'

describe('mergeData', () => {
    // 基本構造の生成ヘルパー
    const makeCache = (overrides: any = {}) => ({
        schemaVersion: 2,
        entries: [],
        memos: [],
        simulations: [],
        dailyStates: {},
        ...overrides,
    })

    const makeEntry = (id: string, rev: number, updatedAt: number, text = 'test') => ({
        id,
        date: '2026-01-01',
        text,
        category: 'その他',
        tod: [],
        ts: updatedAt,
        updatedAt,
        deleted: false,
        rev,
        deviceId: 'dev-A',
    })

    it('同一IDのエントリは高revが勝つ', () => {
        const base = makeCache({
            entries: [makeEntry('e1', 1, 1000, '古い')],
        })
        const incoming = makeCache({
            entries: [makeEntry('e1', 3, 2000, '新しい')],
        })
        const result = mergeData(base, incoming)
        const e = result.entries.find(e => e.id === 'e1')
        expect(e).toBeDefined()
        expect(e!.text).toBe('新しい')
        expect(e!.rev).toBe(3)
    })

    it('同一revの場合はupdatedAtが新しい方が勝つ', () => {
        const base = makeCache({
            entries: [makeEntry('e1', 2, 3000, 'ローカル')],
        })
        const incoming = makeCache({
            entries: [{ ...makeEntry('e1', 2, 5000, 'リモート'), deviceId: 'dev-B' }],
        })
        const result = mergeData(base, incoming)
        const e = result.entries.find(e => e.id === 'e1')
        expect(e!.text).toBe('リモート')
    })

    it('異なるIDのエントリは両方保持される', () => {
        const base = makeCache({
            entries: [makeEntry('e1', 1, 1000, 'ローカル')],
        })
        const incoming = makeCache({
            entries: [makeEntry('e2', 1, 2000, 'リモート')],
        })
        const result = mergeData(base, incoming)
        expect(result.entries.length).toBe(2)
    })

    it('空のbase/incomingでもクラッシュしない', () => {
        const result = mergeData(null, null)
        expect(result.entries).toEqual([])
        expect(result.memos).toEqual([])
        expect(result.simulations).toEqual([])
    })

    it('メモのマージも決定的に動作する', () => {
        const base = makeCache({
            memos: [{ id: 'm1', text: '古いメモ', createdAt: 1000, updatedAt: 1000, done: false, deleted: false, rev: 1, deviceId: 'dev-A' }],
        })
        const incoming = makeCache({
            memos: [{ id: 'm1', text: '更新メモ', createdAt: 1000, updatedAt: 2000, done: false, deleted: false, rev: 2, deviceId: 'dev-B' }],
        })
        const result = mergeData(base, incoming)
        const m = result.memos.find(m => m.id === 'm1')
        expect(m!.text).toBe('更新メモ')
        expect(m!.rev).toBe(2)
    })
})
