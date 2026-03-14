# IMPROVEMENT_PLAN.md

## まずここを直せば勝てる（3行）
1. READMEとnpm scriptsのズレを直し、「誰でも同じ手順で起動・ビルド」できる状態に戻す。  
2. 起動時のデータ破損に対し、lastGoodへの自動ロールバックを実装して「壊れても復活」を本物にする。  
3. merge / validate / storage の最小テストを入れて、改善ループが回る足場を作る。  

---

## 全体方針（何を、なぜ、どう直すか）
本プロジェクトは「ローカル正（IndexedDB）＋OneDrive追従同期」という、壊れやすいけど価値が高い構造です。  
したがって改善の順序は以下に固定します。

- **P0（最優先）**：再現可能（起動・ビルド・復旧）を確実にし、データ喪失リスクを下げる  
- **P1**：壊れにくさ（テスト・ログ・責務分割）を増やし、変更が追える状態にする  
- **P2**：構造改善・UX改善・セキュリティ強化（CSP等）を“壊さず”に進める

---

## 改善バックログ

### P0（再現性・復旧・最小テスト）

- ID: P0-01
- タイトル: 起動手順の整合
- 目的: READMEと実態のズレを無くし、誰がやっても同じ手順で起動できるようにする
- 変更内容:
  - `README.md` の **起動コマンド・ポート・リンク**を現状に合わせて修正
  - `package.json` に `start` スクリプトを追加（`vite` へエイリアス）
  - README内の存在しない参照（例: `SEED_v5/...`）を削除/置換（docsへの誘導にする）
- 手順:
  1. `package.json` に `"start": "vite"` を追加
  2. `README.md` の Usage を `npm install` → `npm run dev`（または `npm start`）に統一
  3. ポート表記を `vite.config.ts` の既定（5173）に合わせる
  4. 存在しないパス参照を削除し、`docs/PROJECT_CONCEPT.md` など実在する導線に差し替える
- DoD:
  - `npm ci` が通る
  - `npm run build` が通る
  - `npm start` で開発サーバが起動し、ブラウザでトップページが表示される
  - READMEの手順通りに実行して迷子にならない
- 影響範囲: ドキュメント、npm scripts
- リスク/注意: 変更は軽微だが、READMEが外部に配布されるため誤記は信用を削る
- 推定工数感: S

---

- ID: P0-02
- タイトル: 起動時の自動復旧
- 目的: データ破損や読み込み失敗で「fresh初期化」へ落ちる事故を避け、lastGoodへ自動退避させる
- 変更内容:
  - `src/services/storage/localStorage.ts`
    - `storageLoadData()` の読み込みフローを強化
    - IDB読み込み/validate失敗時に `loadLastGood()` を試し、成功したら自動復旧
  - UI通知（最低限）
    - 復旧が走ったときに、トースト等で「復旧した」ことが分かる表示（既存の `showToast` を利用、または控えめなステータス表示）
- 手順:
  1. `odLoadCache()` 内で握りつぶしている例外の扱いを整理
     - 「読み込み失敗」か「validate失敗」かを区別できるようにする（例: `odLoadCache` は throw、呼び元で復旧分岐）
  2. `storageLoadData()` を次の優先順にする  
     2-1) IDBからロード→validate成功→return  
     2-2) 失敗したら lastGood をロード→validate成功→IDBへ上書き→return  
     2-3) それも無理なら localStorage移行（既存 `migrateFromLocalStorage()`）  
     2-4) 最後に fresh
  3. 復旧が発生した場合のみ、控えめに通知（ログに生データは出さない）
- DoD:
  - 破損データをIDBに入れた状態で起動しても、アプリが起動し続ける（lastGoodが存在する前提）
  - lastGoodが存在する場合、freshではなくlastGoodへ復元される
  - 復旧時にユーザーが把握できる（トースト/ステータス表示のいずれか）
- 影響範囲: 起動フロー、ストレージ層
- リスク/注意:
  - 復旧ループ（壊れたデータを保存し直す）を避けるため、復旧後は `saveLastGood` のタイミングに注意
- 推定工数感: M

---

- ID: P0-03
- タイトル: 最小テスト導入
- 目的: merge/validate/storage の「壊れたら終わる」部分だけでも自動検知できるようにする
- 変更内容:
  - テストランナーを追加（軽量寄りでOK：Vitest推奨）
  - `package.json` に `test` スクリプト追加
  - テストを最小3本
    - `src/domain/merge.ts`：同一idの競合が決定的に収束する
    - `validateDataCache`（現状は `localStorage.ts` 内）: 欠損フィールドが最低限補正される/弾かれる
    - 「復旧フロー」：`storageLoadData` が lastGood を優先して復元する（IDB部分はモック）
  - GitHub Actions（`static.yml`）に `npm test` を追加（build前）
- 手順:
  1. `devDependencies` に `vitest` と `@vitest/ui` は不要（最小で）
  2. `package.json` に `"test": "vitest run"` を追加
  3. `tests/` または `src/**/__tests__` を追加し、上記3本を書く
  4. `.github/workflows/static.yml` に `npm test` ステップを追加
- DoD:
  - `npm test` がローカルで通る
  - GitHub Actionsで `npm test` が実行され、落ちたらデプロイされない
- 影響範囲: devDependencies / CI / domain / storage
- リスク/注意:
  - IndexedDBはNode上でそのまま動かないため、storageテストは「ロジック分離」か「薄いモック」で行う（重いE2EはP1以降）
- 推定工数感: M

---

- ID: P0-04
- タイトル: 同期ログ露出を制御
- 目的: 同期や認証のログがUIに流れ続けることで、運用時に不要な情報が露出するリスクを下げる
- 変更内容:
  - `src/services/sync/onedrive.ts`
    - MSALの `loggerCallback` が `debugLogArea` へ書き込む挙動を **デバッグモード時のみ**に限定
  - デバッグモード判定は「設定（localStorageの既存settingsに1フラグ追加）」で実装
- 手順:
  1. `odLoadSettings()` が返す設定に `debugLogging?: boolean` を追加（既存構造を壊さない形で）
  2. `onedrive.ts` の loggerCallback で、`debugLogging` が true のときだけ textarea へ追記
  3. それ以外は console出力も控えめに（warning以上、かつPIIなし）
- DoD:
  - 通常モードで、認証ログが画面に増殖しない
  - デバッグON時のみ、従来通り `debugLogArea` に出る
- 影響範囲: 同期・設定UI（設定項目を追加する場合）
- リスク/注意: 「何も見えない」状態になると障害対応が辛いので、ステータス表示は残す（ログ全文は隠す）
- 推定工数感: S

---

### P1（壊れにくさ・責務分割・運用しやすさ）

- ID: P1-01
- タイトル: 起動処理を分割
- 目的: `src/main.ts` が巨大化しており、変更時の影響範囲が読みにくいのを改善する
- 変更内容:
  - `src/app/bootstrap.ts`（新規）を作り、初期化シーケンスを移す
  - `main.ts` は「bootstrap呼び出し＋グローバルCSS読み込み」程度に縮小
- 手順:
  1. `main.ts` 内の `DOMContentLoaded` ハンドラ内容を `bootstrap()` に移す
  2. `bootstrap()` 内を「ストレージ読込 → migrate → view init → sync init」の順に整理
  3. 動作確認（最低限：起動して各タブが表示される）
- DoD:
  - `main.ts` の責務が明確に減る（見た目で分かるレベル）
  - `npm run dev` で従来通り動作する
- 影響範囲: 起動シーケンス
- リスク/注意: import循環に注意（store/actions/viewsの相互依存）
- 推定工数感: M

---

- ID: P1-02
- タイトル: validateをdomainへ移設
- 目的: `validateDataCache` が storage層にあり、仕様進化（schema/migration）と分離されていない
- 変更内容:
  - `src/domain/validate.ts`（新規）へ移設
  - storage層は `domain/validate` を呼ぶだけにする
- 手順:
  1. 既存 `validateDataCache` を `src/domain/validate.ts` に移す
  2. storage側は import差し替え
  3. P0-03のテスト対象も `domain/validate` に寄せる
- DoD:
  - validateの入口がdomainに一本化される
  - テストが引き続き通る
- 影響範囲: storage/domain
- リスク/注意: 互換性のため、挙動はP1では変えず“場所だけ”移す
- 推定工数感: S

---

- ID: P1-03
- タイトル: 同期エラー分類
- 目的: 同期が失敗した時に「何をすれば復旧するか」がユーザー/運用側に伝わらない
- 変更内容:
  - `src/services/sync/syncManager.ts` の error handling を整理し、UIに渡すメッセージを分類
  - 例: オフライン / 認証切れ / 412競合 / Graph一時障害
- 手順:
  1. fetch例外/HTTPステータスから分類関数を作る（小さく）
  2. `onError` callbackへ渡す文言を統一（秘密情報は含めない）
  3. UI側（syncStatusなど）が表示できることを確認
- DoD:
  - 少なくとも 401/403/412/ネットワーク断 の区別が表示上分かる
- 影響範囲: sync/UI
- リスク/注意: メッセージの詳細化でログ露出が増えないように注意
- 推定工数感: M

---

### P2（構造改善・セキュリティ強化・磨き）

- ID: P2-01
- タイトル: CSPの段階導入
- 目的: 保存型XSSへの最後の保険としてCSPを導入する（ただし壊しやすいので段階的に）
- 変更内容:
  - `index.html` に最初は緩めのCSP（report-only相当の考え方）を入れるか、ドキュメントで手順化
- 手順:
  1. MSAL/Graph/必要CDNの通信先を整理
  2. まずは“壊れない範囲”のCSPを追加
  3. 動作確認（認証リダイレクト含む）
- DoD:
  - 認証・保存・表示が壊れない
- 影響範囲: 全体
- リスク/注意: MSALのリダイレクトやscript要件でハマりやすい。P2扱いが妥当
- 推定工数感: L

---

- ID: P2-02
- タイトル: ESLint/format整備
- 目的: 人間が読めるコードを維持し、リファクタの事故率を下げる
- 変更内容:
  - ESLint導入、最低限のルール（危険APIやany濫用など）
- 手順:
  1. 導入は最小（TypeScript + import整列程度）
  2. “innerHTML使用時はsanitize必須”のルールを足す（可能なら）
- DoD:
  - `npm run lint` が用意され、CIで回せる
- 影響範囲: 開発体験
- リスク/注意: ルール強化で一気に修正が増えがち。段階導入
- 推定工数感: M

---

## やらないこと（スコープ外を明示）
- サーバ常設・バックエンド新設（静的配布が前提のため）
- 重いフレームワーク全面移行（例: 大規模状態管理FW、巨大UIフレームワーク追加）
- 同期先をOneDrive以外に増やす（要求が出るまで禁止）
- 大規模なUI刷新（まず壊れない土台が先）