# IDE実装プロンプト: ホビーフォートレスMVP v0.1

あなたは、既存の `ippo-dashboard_online-1` リポジトリに対して、**次フェーズとしてホビーフォートレスMVPを追加実装する担当**です。

## 前提
このリポジトリには、すでに以下が存在します。

- 一歩ログ画面
- Future Lab
- 編纂室 (`src/ui/views/henzanRoom.ts`)
- 編纂室用の型 (`src/domain/henzan/schema.ts`)
- DataCache に `henzanAssets` / `reviewEvents`

まだ存在しないもの:
- ホビーフォートレスのコード
- 趣味階層スキーマ
- 編纂室資産と趣味条件の照合ロジック
- hobby タブと画面

## 今回の目的
編纂室資産を使って、「趣味の次階層へどこまで進めるか」を見せるMVPを追加してください。

---

## 必須要件

### 1. 新しいドメインを追加
以下のファイルを新規作成してください。

- `src/domain/hobbyFortress/schema.ts`
- `src/domain/hobbyFortress/validate.ts`
- `src/domain/hobbyFortress/match.ts`
- `src/domain/hobbyFortress/sampleHobbies.ts`
- `src/domain/hobbyFortress/match.test.ts`

### 2. MVPスコープ
MVPでは以下だけ実装してください。

- 1趣味分の階層定義
- 3階層
- 編纂室資産との照合
- 現在階層の判定
- 次階層の不足条件表示
- 次ミッション 1〜3 件表示

### 3. 初期サンプル趣味
最初の趣味は **釣り** にしてください。

最低でも以下の階層を持ってください。

- レベル1: 釣り堀で体験する
- レベル2: 自前の竿で釣る
- レベル3: 狙う魚や場所を選んで釣行する

### 4. 判定に使う条件種別
最低限これだけ対応してください。

- `asset_name`
- `asset_type`
- `scale_at_least`
- `status_any_of`

### 5. UI追加
以下を追加してください。

- `index.html` に hobby タブ
- `tabHobby` 画面セクション
- `src/ui/views/hobbyFortress.ts`
- `bootstrap.ts` の `switchTab()` に hobby 分岐

### 6. DataCache最小拡張
`src/domain/schema.ts` と `src/app/store.ts` と `src/services/storage/localStorage.ts` を更新し、
最低限の hobby state を保持できるようにしてください。

例:
- `hobbyFortressState?: { selectedTrackId?: string | null }`

### 7. テスト
最低限 `match.test.ts` を作成し、以下を検証してください。

- 資産が十分あると currentLevel が上がる
- 一部条件不足だと missingRequirements が返る
- 資産ゼロでもエラーにならない

---

## 実装制約

- 既存の編纂室を大改造しない
- Future Lab に触りすぎない
- OneDrive同期ロジックを壊さない
- Reactなど重いフレームワークへ移行しない
- まずはVanilla TypeScriptの流儀を維持する
- AI自動階層生成は入れない
- 派手なUIより「動くこと」を優先する

---

## UX制約

- 文言は日本語
- 義務化装置にしない
- 次の階層が見えることを優先する
- 不足条件の表示は責めるトーンにしない
- 編纂室資産ゼロでも穏当な表示にする

---

## 期待する出力
1. 変更ファイル一覧
2. 実装内容の要約
3. テスト結果
4. 追加したファイルの説明
5. 今後の Phase 2B 候補（短く）

---

## 補足
今回のゴールは、完璧な趣味OSを作ることではありません。  
**編纂室の資産が、実際にホビーフォートレスの階層判定に使える**ことを示すことです。

1趣味、3階層、最小のミッション提示で十分です。  
壊さず、小さく、でもちゃんと前に進む形で実装してください。
