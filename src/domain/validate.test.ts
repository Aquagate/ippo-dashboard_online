// ===== validateDataCache テスト =====
// データ検証と自動補正の動作を確認

import { describe, it, expect } from 'vitest'
import { validateDataCache } from '../services/storage/localStorage'

describe('validateDataCache', () => {
    it('正常なデータはそのまま通る', () => {
        const data = {
            schemaVersion: 2,
            entries: [{ id: 'e1', text: 'テスト', date: '2026-01-01' }],
            memos: [{ id: 'm1', text: 'メモ' }],
            simulations: [],
            dailyStates: {},
        }
        const result = validateDataCache(data)
        expect(result.entries.length).toBe(1)
        expect(result.memos.length).toBe(1)
    })

    it('欠損配列を空配列で補正する', () => {
        const data = { schemaVersion: 2 } as any
        const result = validateDataCache(data)
        expect(result.entries).toEqual([])
        expect(result.memos).toEqual([])
        expect(result.simulations).toEqual([])
        expect(result.dailyStates).toEqual({})
    })

    it('schemaVersionが無い場合は2で補正する', () => {
        const data = { entries: [], memos: [], simulations: [], dailyStates: {} } as any
        const result = validateDataCache(data)
        expect(result.schemaVersion).toBe(2)
    })

    it('nullやundefinedを渡すとエラーが投げられる', () => {
        expect(() => validateDataCache(null)).toThrow()
        expect(() => validateDataCache(undefined)).toThrow()
    })

    it('不正なエントリ（idやtextが無い）はフィルタされる', () => {
        const data = {
            schemaVersion: 2,
            entries: [
                { id: 'valid', text: '有効', date: '2026-01-01' },
                { id: null, text: '無効', date: '2026-01-01' }, // idが無効
                { text: '無効2', date: '2026-01-01' }, // id欠損
                { id: 'valid2', date: '2026-01-01' }, // text欠損
            ],
            memos: [],
            simulations: [],
            dailyStates: {},
        }
        const result = validateDataCache(data)
        expect(result.entries.length).toBe(1)
        expect(result.entries[0].id).toBe('valid')
    })
})
