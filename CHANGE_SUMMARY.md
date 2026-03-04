# CHANGE_SUMMARY.md

## 実装タスク一覧

| ID | タイトル | 状態 | コミット |
|---|---|---|---|
| P0-01 | 起動手順の整合 | ✅ 完了 | `b9e9fec` |
| P0-02 | 起動時の自動復旧 | ✅ 完了 | `ee6ce29` |
| P0-03 | 最小テスト導入 | ✅ 完了 | `8c238c9` |
| P0-04 | 同期ログ露出を制御 | ✅ 完了 | `f579f23` |

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `package.json` | `start` / `test` スクリプト追加、vitest/jsdom devDependencies追加 |
| `README.md` | ポート修正(8083→5173)、死んだSEED_v5リンク修正、コマンド表追加 |
| `src/services/storage/localStorage.ts` | `storageLoadData` にlastGoodフォールバック追加、`wasRecoveredFromLastGood()` エクスポート |
| `src/main.ts` | 復旧時のトースト通知追加 |
| `src/services/sync/onedrive.ts` | MSALログを`debugLogging`フラグで制御、シングルトンMSAL（前回修正） |
| `vitest.config.ts` | 新規: vitest設定（jsdom環境） |
| `src/domain/merge.test.ts` | 新規: マージテスト5本 |
| `src/domain/validate.test.ts` | 新規: バリデーションテスト5本 |
| `src/domain/recovery.test.ts` | 新規: 復旧フローテスト3本 |
| `.github/workflows/static.yml` | `npm test` ステップ追加（build前） |

## 動作確認結果

| 確認項目 | 結果 |
|---|---|
| `npm ci` | ✅ |
| `npm run build` (`tsc && vite build`) | ✅ |
| `npm start` | ✅ (port 5173で起動) |
| `npm test` (vitest) | ✅ 13/13 テスト通過 |
| README手順通りの起動 | ✅ |
| デバッグログ非表示（通常モード） | ✅ MSAL出力がUIに流れない |

## 既知の未対応/残課題
- `validateDataCache` は `localStorage.ts` に残っている（P1-02で `domain/validate.ts` へ移設予定）
- 復旧フローのE2Eテスト未実施（IDBモックのみ）
- `debugLogging` フラグのUIトグルが未実装（現状はlocalStorageを手動編集）
- `futureLab.ts` の肥大化は未着手（P1以降）

## リスク/注意点
- **復旧ループ回避**: 復旧後の `saveLastGood` タイミングは `main.ts` の5秒タイマーに依存。復旧直後に壊れたデータを保存し直すリスクは低い（復旧時点でIDBも上書き済み）
- **CI依存**: vitest は `jsdom` 環境を使用。GitHub Actions (ubuntu-latest, Node20) で動作確認が必要
