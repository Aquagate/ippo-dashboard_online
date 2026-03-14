# EXECUTION_RUNBOOK.md

## 目的
IDE/エージェントが「順番通りに」作業し、1タスク＝1コミットで安全に改善を積み上げるための手順書です。  
データや秘密情報を扱う前提なので、ログ出力や外部送信は増やしません。

---

## 0. 事前準備（ローカル環境）
- Node.js: 20系（GitHub Actionsが20なので合わせる）
- コマンドはリポジトリルートで実行

---

## 1. 現状把握（最初に必ずやる）
1) 依存導入
```bash
npm ci

2）開発起動（現状確認）
npm run dev
ブラウザで開き、Ippo / Future / Settings の各タブが表示されることを確認

3）ビルド確認
npm run build
npm run preview

4）変更点の棚卸し
git status
git diff

3. 推奨実行順（順番が命）
Step A: P0-01（起動手順の整合）

package.json に start を追加

README.md を修正（コマンド/ポート/リンク）

DoDのコマンドを全部実行して通す

コミット

Step B: P0-02（起動時の自動復旧）

storageLoadData() を中心に復旧フローを実装

lastGoodがある場合の復旧を確認

「復旧した」ことが分かるUI通知を最小で入れる

コミット

Step C: P0-03（最小テスト導入）

vitest導入、npm test 追加

merge/validate/復旧の最小テスト作成

GitHub Actionsに npm test を追加

コミット

Step D: P0-04（同期ログ露出を制御）

デバッグログ出力のフラグ化

通常モードでUIへログが流れないことを確認

コミット


4. 変更 → テスト → 確認 → コミット のテンプレ

変更

目的に対して最小限の差分にする（ついで作業禁止）

テスト

npm run build
npm test   # 導入後

手動確認（最小）

npm run dev で起動

Ippo / Future / Settings をクリックして表示が崩れないこと

（復旧タスクの場合）復旧が走った時の通知が出ること

コミット

git add -A
git commit -m "P0-0X: <短いタイトル>"
5. 失敗時のリカバリ
ビルドが落ちる

直前の変更を疑う（import循環、型不一致）

git diff
npm run build
テストが落ちる（導入後）

どのテストが落ちたかで層を切る

domain: merge/validate

storage: 復旧フロー

失敗が再現する最小ケースを作り、修正→再実行

起動時に真っ白

コンソールを確認（ただし秘密情報は貼らない）

まず npm run build が通るか

直近コミットを戻して切り分け

git reset --hard HEAD~1
同期が怪しい

オフラインか、認証が切れてないか、412競合が出てないかをステータスで確認

“自動で直らないもの”は手動再ログイン導線へ誘導（ログ全文は出さない）

6. 禁止事項（守らないと地獄を見る）

APIキー/クライアントID/テナント情報などを、ログ・README・コメントに貼らない

ユーザーデータ（entriesなど）の中身をconsoleに出さない

重い新規基盤（巨大FW/過剰SaaS）へ逃げない


---

## 3) ARCHITECTURE_SNAPSHOT.md

```markdown
# ARCHITECTURE_SNAPSHOT.md

## 1. 概要
Ippo Dashboard は、日々のログ（Entry/Memo）と未来ラボ（Simulation）を扱う静的Webアプリです。  
データは **ローカル（IndexedDB）を正** とし、OneDrive（Graph API）へ追従同期します。

---

## 2. 主要モジュールと責務

### UI層（表示・イベント）
- `src/ui/views/ippoLog.ts`
  - 一歩ログの表示、チャート描画（Chart.js）、日次テーブルなど
- `src/ui/views/futureLab.ts`
  - 未来ラボの表示・資産確定・ストーリーモードなど（機能大きめ）
- `src/ui/views/settings.ts` / `src/ui/views/syncSettings.ts`
  - 設定と同期設定UI
- `src/ui/components/syncStatus.ts` / `src/ui/toast.ts`
  - 同期ステータス、トーストなど

### アプリ層（状態・ユースケース）
- `src/app/store.ts`
  - メモリ上の状態（entries / memos / dataCacheなど）
- `src/app/actions.ts`
  - “状態→保存→同期キュー” のオーケストレーション
  - Entry/Memo生成（rev/deviceId付与）やCSV/JSON入出力など

### ドメイン層（決定的ロジック）
- `src/domain/schema.ts`
  - DataCache / Entry / Memo / Simulation などの型
- `src/domain/merge.ts`
  - 決定的マージ（rev → updatedAt → deviceId）
- `src/domain/normalize.ts` / `src/domain/categories.ts`
  - 正規化・カテゴリ推定など

### ストレージ/同期
- `src/services/storage/idb.ts`
  - IndexedDB の kv ラッパ（外部依存なし）
- `src/services/storage/localStorage.ts`
  - 実態は「IDB中心＋一部localStorage（設定/キュー）」の統合層
  - lastGood保存/復元の仕組みを持つ
- `src/services/sync/onedrive.ts`
  - MSAL認証、Graph APIでファイル（`/Apps/...`）を読み書き
- `src/services/sync/syncManager.ts`
  - キュー・排他・push/pull・エラー通知など同期ロジック

---

## 3. データの流れ（ざっくり）
1) UI操作 → actionsでEntry/Memoを更新（rev/deviceId/updatedAtを付与）  
2) actions → `storageSaveData()` → IDBへ保存  
3) 保存後、同期キューに積み、オンラインなら `syncFlush()` が走る  
4) SyncはGraph上のJSONを取得/更新し、必要なら `mergeData()` で収束させる  

---

## 4. 外部依存（API/ライブラリ）
- OneDrive同期
  - MSAL: `@azure/msal-browser`
  - Graph API: `https://graph.microsoft.com/v1.0/...`（AppFolder: `special/approot` を利用）
  - 権限: `Files.ReadWrite.AppFolder`, `offline_access`（コード内定義）
- UI
  - Chart.js
- XSS対策
  - DOMPurify（`src/utils/sanitize.ts`）

---

## 5. 設定・環境変数
- サーバ環境変数は前提にしていない（静的配布）
- OneDrive設定（clientId/tenant/redirectUri/filePath等）は localStorage に保存される実装
  - 秘密情報ではないが、露出を増やさない運用が望ましい

---

## 6. 地雷マップ（変更影響が大きい場所）
- `src/services/storage/localStorage.ts`
  - 起動/保存/復旧の中心。ここが壊れるとデータ喪失が発生しうる
- `src/domain/merge.ts`
  - 決定性が崩れるとマルチ端末で「揺れ」が止まらない
- `src/services/sync/syncManager.ts` / `onedrive.ts`
  - 排他/競合/認証周り。ログや例外処理の変更は慎重に
- `src/ui/views/futureLab.ts`
  - ファイルが巨大で、影響範囲が読みづらい（P1で分割候補）
4) RISKS_AND_ASSUMPTIONS.md
# RISKS_AND_ASSUMPTIONS.md

## 既知リスク（重点）

### セキュリティ/プライバシー
- 保存型XSSリスク
  - DOMPurifyは入っているが、UI側で `innerHTML` を使う箇所があり得るため、運用で油断すると事故る
- ログ露出
  - MSALログがUI（textarea）に出る経路があり、通常運用で情報が増殖するリスクがある
- 同期設定情報の扱い
  - clientId等がlocalStorageにある。秘密鍵ではないが、貼り付け・共有時に混入しやすい

### 運用/品質
- データ破損時の復旧不足
  - lastGood保存はあるが、読み込み失敗時に自動復旧へ繋がりにくい（fresh初期化へ落ちうる）
- テスト不在による回帰
  - merge/storage/syncは壊れたら致命的だが、検知の仕組みが薄い
- FutureLabの肥大化
  - 巨大ファイルは改修時にバグを混入させやすい

### コスト
- 依存更新で壊れるリスク
  - lockfileはあるが、CIでの自動検知が弱い（テストがない）

### 法務っぽい注意
- Graph API / MSAL の利用は各規約に従う必要あり（特にスコープとデータの保存場所）
- ユーザーデータを外部送信しない方針は現状コード設計上も前提。ログ/分析導入で逸脱しないこと

---

## ASSUMPTIONS（不明点の仮定）
- A-01: 「lastGood」は “起動できる最後の状態” としてIDBに保存され、起動時に自動復旧へ利用したい意図がある（ドキュメントと実装から推定）
- A-02: OneDrive同期は「AppFolder」配下の単一JSONファイルを正とし、競合時はmergeで収束させる設計
- A-03: テストは“最小でよい”方針のため、当面はUnit中心（E2Eは後回し）で許容される
- A-04: 認証周りは秘密情報を扱う可能性があるため、トークン等をログに出さない方針を最優先する

---

## OPEN_QUESTIONS（答えがないと詰むものだけ）
- Q-01: lastGoodの期待挙動は「自動復旧（黙って戻す）」か「ユーザーに選ばせる（復旧UI）」か、どちらが正？
  - ※P0では“自動復旧＋控えめ通知”で進められるが、最終仕様として確定が必要
- Q-02: OneDrive同期の対象ファイルパスは固定（`/Apps/IppoDashboard/ippo_data.json`）で良いか、それともユーザーが変更できるのが必須か？
  - ※既に設定UIがある気配はあるため、壊さない範囲で扱う