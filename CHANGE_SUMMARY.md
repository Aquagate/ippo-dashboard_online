# CHANGE_SUMMARY.md

## 実装タスク一覧

### P0（IMPROVEMENT_PLAN より）

| ID | タイトル | 状態 | コミット |
|---|---|---|---|
| P0-01 | 起動手順の整合 | ✅ 完了 | `b9e9fec` |
| P0-02 | 起動時の自動復旧 | ✅ 完了 | `ee6ce29` |
| P0-03 | 最小テスト導入 | ✅ 完了 | `8c238c9` |
| P0-04 | 同期ログ露出を制御 | ✅ 完了 | `f579f23` |

### vNEXT 先行実装

| ID | タイトル | 状態 | コミット |
|---|---|---|---|
| vN-01 | 復旧ループガード | ✅ 完了 | `58a272d` |
| vN-02 | debugLogging UIトグル | ✅ 完了 | `58a272d` |
| vN-03 | main.ts → bootstrap.ts 分割 | ✅ 完了 | `58a272d` |

---

## 変更ファイル一覧

### P0 で変更

| ファイル | 変更内容 |
|---|---|
| `package.json` | `start` / `test` スクリプト追加、vitest/jsdom devDependencies追加 |
| `README.md` | ポート修正(8083→5173)、死んだSEED_v5リンク修正、コマンド表追加 |
| `src/services/storage/localStorage.ts` | `storageLoadData` にlastGoodフォールバック追加、`wasRecoveredFromLastGood()` エクスポート |
| `src/main.ts` | 復旧時のトースト通知追加 |
| `src/services/sync/onedrive.ts` | MSALログを`debugLogging`フラグで制御 |
| `vitest.config.ts` | 新規: vitest設定（jsdom環境） |
| `src/domain/merge.test.ts` | 新規: マージテスト5本 |
| `src/domain/validate.test.ts` | 新規: バリデーションテスト5本 |
| `src/domain/recovery.test.ts` | 新規: 復旧フローテスト3本 |
| `.github/workflows/static.yml` | `npm test` ステップ追加（build前） |

### vNEXT で変更

| ファイル | 変更内容 |
|---|---|
| `src/app/bootstrap.ts` | 新規: 認証リダイレクト処理、タブ切替、初期化シーケンスを `main.ts` から移設 |
| `src/main.ts` | 464行→280行に縮小。`setupEvents()` + `bootstrap()` 呼び出しのみ |
| `index.html` | Debug Logsセクションにチェックボックス・バッジ・警告文を追加 |
| `src/ui/views/syncSettings.ts` | debugLoggingトグルのロード/保存/UI反映ロジックを追加 |

---

## 動作確認結果

| 確認項目 | 結果 |
|---|---|
| `npm ci` | ✅ |
| `npm run build` (`tsc && vite build`) | ✅ |
| `npm start` | ✅ (port 5173で起動) |
| `npm test` (vitest) | ✅ 13/13 テスト通過 |
| README手順通りの起動 | ✅ |
| デバッグログ非表示（通常モード） | ✅ MSAL出力がUIに流れない |
| **画面運用テスト: タブ切替** | ✅ 一歩ログ/未来ラボ/設定が正常遷移 |
| **画面運用テスト: デバッグトグル** | ✅ ON→バッジ+警告表示、OFF→非表示 |
| **画面運用テスト: 初期化** | ✅ bootstrap.ts分割後も正常起動 |

---

## 既知の未対応/残課題
- `validateDataCache` は `localStorage.ts` に残っている（P1-02で `domain/validate.ts` へ移設予定）
- 復旧フローのE2Eテスト未実施（IDBモックのみ）
- `futureLab.ts` の肥大化は未着手（P2以降）
- 同期エラー分類の表示（P1-03）

## リスク/注意点
- **復旧ループ**: 復旧直後は `saveLastGood` を30秒遅延に変更（通常5秒）。タイマー依存→明示ガードに昇格済み
- **CI依存**: vitest は `jsdom` 環境を使用。GitHub Actions (ubuntu-latest, Node20) で動作確認が必要
- **デバッグトグル**: ONのまま放置するとMSALログがUI上に蓄積するが、readonlyなので情報漏洩リスクは限定的
