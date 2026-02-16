# 04_ARCHITECTURE（最小アーキテクチャ）

## 1) 最小アーキテクチャ図（テキスト）
```
[UI Views] ──(reads)──> [Store(state)]
   │                     │
   │ (dispatch actions)   │ (notifies)
   ▼                     ▼
[Actions] ──(calls)──> [Domain: normalize/merge/migrate/validate]
   │                     │
   │                     ├──> [Storage: IndexedDB + Snapshots(lastGood, generations)]
   │                     └──> [Sync: OneDrive Adapter + Queue + Locks + Pull Loop]
   ▼
[UI Status: sync/restore/error]
```

原則：
- UIは状態を書き換えない（Actions経由）
- Storage（保存）と Sync（同期）を混ぜない（オフラインファースト）
- Domainは “データの入口” を統一（validate → migrate → normalize）

---

## 2) ディレクトリ構成案（MVP向け）
```
src/
  main.ts
  app/
    bootstrap.ts
    store.ts
    actions.ts
  domain/
    schema.ts
    validate.ts
    migrations.ts
    merge.ts
    normalize.ts
  services/
    storage/
      idb.ts
      snapshots.ts
      exportImport.ts
    sync/
      onedriveClient.ts
      syncEngine.ts
      mergeBridge.ts
      locks.ts
  ui/
    views/
      dashboard.ts
      ippo.ts
      futureLab.ts
      settings.ts
    components/
      toast.ts
      modal.ts
      statusBar.ts
  config/
    defaults.ts
```

---

## 3) データモデル（最小案）

### 3-1. ルート（DataCache v2 仮）
- `schemaVersion: number`
- `meta: { deviceId: string, updatedAt: number }`
- `entries: Record<string, Entry>`
- `memos: Record<string, Memo>`
- `assets: Record<string, Asset>`
- `simulations: Record<string, Simulation>`
- `tombstones?: Record<string, Tombstone>`（削除の痕跡）

### 3-2. レコード共通（決定的マージのため）
- `id: string`
- `updatedAt: number`（ms）
- `rev: number`（端末内連番）
- `deviceId: string`（端末固定）

比較キー：
- (updatedAt, rev, deviceId) で勝敗を決定
- 同値でも必ず片が付く（決定的）

### 3-3. 例：Entry（仮）
- `id`
- `text`
- `category`
- `tags?`
- `timeOfDay?`（朝/昼/夜）
- `createdAt`
- `updatedAt`
- `rev`
- `deviceId`
- `deleted?: boolean`

---

## 4) Sync（OneDrive）設計要点
- **ローカル正**：入力・保存はローカルで完結
- **push**：変更通知→デバウンス→キューflush
- **pull**：サインイン＆オンライン中に定期実行
- **排他**：同時sync禁止、sync中の変更は「再実行フラグ」で吸収
- **競合**：ETag mismatch（412）時は再取得→merge→再送

---

## 5) スナップショット（復旧設計）
- `lastGood`：最後の正常状態（必須）
- `generations`：直近N世代（RCで強化）
- **起動時フロー**：
  1) load（IDB）
  2) validate
  3) 失敗 → lastGoodへ自動ロールバック → UIで通知
- 復元操作は確認ダイアログ必須

---

## 6) 拡張ポイント / 壊しやすいポイント
### 拡張ポイント
- domain/normalize.ts：入力形式追加
- domain/migrations.ts：データ構造の進化
- services/sync/syncEngine.ts：同期ループ調整（間隔、バックオフ）
- ui/views：画面追加（UIはdomainと直接結合しない）

### 壊しやすいポイント（触る前にテスト）
- merge.ts：収束性・決定性が壊れると全端末が混乱
- migrations.ts：古いデータを壊すと復旧不能
- syncEngine.ts：排他/再実行が壊れると競合が増える
- innerHTML周り：XSS自爆リスク（原則禁止）
