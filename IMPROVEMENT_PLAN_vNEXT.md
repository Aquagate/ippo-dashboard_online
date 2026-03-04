# IMPROVEMENT_PLAN_vNEXT.md

## vNext方針
P0の「再現性・復旧・最小テスト」が整ったため、vNextでは **壊れにくさの強化** と **保守性の改善** に集中する。
具体的には、肥大化した `main.ts` の責務分割、`validateDataCache` の domain 層移設、同期エラーの分類表示を進める。
P0で入ったテスト基盤を活かし、変更のたびにテストを追加する「テスト文化」を定着させる。
UIの大幅刷新は引き続きスコープ外とし、小さな改善を安全に積む方針を継続する。

---

## 改善バックログ

### P0（vNextでの最優先）

- ID: P0-01
- タイトル: debugLogging UIトグル
- 目的: P0-04で実装したdebugLoggingフラグを設定UIからON/OFFできるようにする
- 変更内容:
  - `src/ui/views/syncSettings.ts` にチェックボックス追加
  - `index.html` にUI要素追加
- 手順:
  1. 設定フォーム内にチェックボックスを追加
  2. `odSaveSettings()` に `debugLogging` フラグを含めて保存
  3. チェック状態の復元処理を追加
- DoD:
  - 設定UIからデバッグログのON/OFFが切り替えられる
  - ONにするとMSALログがUIに表示される
- 影響範囲: 設定UI、同期設定
- リスク/注意: 既存の設定構造を壊さないこと
- 推定工数感: S

---

### P1（壊れにくさ・責務分割）

- ID: P1-01
- タイトル: 起動処理を分割
- 目的: `main.ts` の DOMContentLoaded ハンドラが450行超。変更影響が読みにくい
- 変更内容:
  - `src/app/bootstrap.ts`（新規）を作り、初期化シーケンスを移す
  - `main.ts` は「bootstrap呼び出し＋グローバルCSS読み込み」程度に縮小
- 手順:
  1. `main.ts` 内の `DOMContentLoaded` ハンドラ内容を `bootstrap()` に移す
  2. 動作確認（起動して各タブが表示される）
- DoD:
  - `main.ts` が100行以下になる
  - `npm run dev` で従来通り動作する
- 影響範囲: 起動シーケンス
- リスク/注意: import循環に注意
- 推定工数感: M

---

- ID: P1-02
- タイトル: validateをdomainへ移設
- 目的: `validateDataCache` が storage層にあり、テストしづらい
- 変更内容:
  - `src/domain/validate.ts`（新規）へ移設
  - storage側は import差し替え
  - テストのimportパスも更新
- DoD:
  - validateの入口がdomainに一本化される
  - 既存テストが引き続き通る
- 影響範囲: storage/domain
- 推定工数感: S

---

- ID: P1-03
- タイトル: 同期エラー分類
- 目的: 同期失敗時に何が起きたか、何をすればいいかがユーザーに伝わらない
- 変更内容:
  - `syncManager.ts` の error handling を整理
  - UIに渡すメッセージを分類（オフライン/認証切れ/412競合/Graph障害）
- DoD:
  - 401/403/412/ネットワーク断の区別が表示上分かる
- 推定工数感: M

---

- ID: P1-04
- タイトル: テスト追加（同期フロー）
- 目的: P0-03で入れたテストに、syncManager の基本フローテストを追加
- 変更内容:
  - `src/services/sync/syncManager.test.ts`（新規）
  - fetch/MSAL をモックして syncFlush / syncFetchAndMerge の分岐を検証
- DoD:
  - `npm test` で同期系テストが通る
- 推定工数感: M

---

### P2（構造改善・セキュリティ）

- ID: P2-01
- タイトル: CSPの段階導入
- 目的: 保存型XSSの最後の保険
- DoD: 認証・保存・表示が壊れない
- 推定工数感: L

---

- ID: P2-02
- タイトル: ESLint/format整備
- 目的: コード品質の底上げ
- DoD: `npm run lint` が使える
- 推定工数感: M

---

- ID: P2-03
- タイトル: futureLab.ts 分割
- 目的: 1200行超のファイルを3–4モジュールに分割し、影響範囲を読みやすくする
- DoD: futureLab.ts が400行以下になる
- 推定工数感: L

---

## やらないこと
- サーバ常設・バックエンド新設
- 重いフレームワーク全面移行
- 同期先の追加（OneDrive以外）
- 大規模なUI刷新
- E2Eテストの大規模整備（P1ではUnit中心を維持）
