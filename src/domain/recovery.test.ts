// ===== 復旧フロー テスト =====
// storageLoadDataがlastGoodへフォールバックする動作を検証
// IDB部分はモック化して、ロジックのみを確認

import { describe, it, expect, vi, beforeEach } from 'vitest'

// IDBをモック化
vi.mock('../services/storage/idb', () => {
    const store: Record<string, any> = {}
    return {
        idbGet: vi.fn(async (key: string) => store[key] ?? null),
        idbSet: vi.fn(async (key: string, value: any) => { store[key] = value }),
        __store: store,
        __reset: () => { Object.keys(store).forEach(k => delete store[k]) },
    }
})

// syncFlushをモック化（循環依存回避）
vi.mock('../services/sync/syncManager', () => ({
    syncFlush: vi.fn(),
}))

import { storageLoadData, saveLastGood, wasRecoveredFromLastGood } from '../services/storage/localStorage'

// IDBモックのstore参照を取得
const idbMock = await import('../services/storage/idb') as any

describe('storageLoadData 復旧フロー', () => {
    beforeEach(() => {
        idbMock.__reset()
        // wasRecoveredFromLastGoodはモジュールレベル変数で、テスト間でリセットが必要
        // ただし直接アクセスできないため、テスト順序に注意
    })

    it('IDBにデータがある場合はそのまま返す', async () => {
        const goodData = {
            schemaVersion: 2,
            entries: [{ id: 'e1', text: 'テスト', date: '2026-01-01' }],
            memos: [],
            simulations: [],
            dailyStates: {},
        }
        idbMock.__store['ippoDataCache_v1'] = goodData

        const result = await storageLoadData()
        expect(result.entries.length).toBe(1)
        expect(result.entries[0].id).toBe('e1')
    })

    it('IDBが空でlastGoodがある場合はlastGoodから復旧する', async () => {
        const lastGood = {
            schemaVersion: 2,
            entries: [{ id: 'backup', text: 'バックアップ', date: '2026-01-01' }],
            memos: [],
            simulations: [],
            dailyStates: {},
        }
        // IDBメインは空、lastGoodにデータあり
        idbMock.__store['ippoDataCache_lastGood'] = lastGood

        const result = await storageLoadData()
        expect(result.entries.length).toBe(1)
        expect(result.entries[0].id).toBe('backup')
    })

    it('すべて空の場合はfreshを返す', async () => {
        const result = await storageLoadData()
        expect(result.schemaVersion).toBe(2)
        expect(result.entries).toEqual([])
        expect(result.memos).toEqual([])
    })
})
