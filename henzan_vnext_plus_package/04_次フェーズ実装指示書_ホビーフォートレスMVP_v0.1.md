# 次フェーズ実装指示書: ホビーフォートレスMVP v0.1

## 0. この文書の位置づけ
本書は、`ippo-dashboard_online-1` の現行コードベースを前提に、**ホビーフォートレスMVP** を追加実装するための実装指示書である。

上位文書:
- 編纂室 / ホビーフォートレス 統合構想書 vNext+
- Phase 1 実装計画書: 編纂室 vNext+

本書の役割:
- 次フェーズで何をどこまで作るかを固定する
- 変更対象ファイルを具体化する
- DoD と検証方法を明確にする
- IDE 実装に渡せる粒度まで落とす

---

## 1. 目的
編纂室に蓄積された資産を使って、**趣味の次階層がどこまで到達可能か** を見えるようにする。

MVP時点では、以下だけできればよい。

- 1趣味の階層定義を持てる
- 編纂室資産と条件を照合できる
- 「達成済み / 不足」を表示できる
- 次のミッションを 1〜3 件出せる

---

## 2. スコープ

### 2-1. やること
- ホビーフォートレス用のデータスキーマ追加
- 1趣味分のサンプル定義追加
- 資産照合ロジック追加
- ホビーフォートレス画面追加
- 新タブ追加
- 最低限のテスト追加

### 2-2. やらないこと
- AIによる自動階層生成
- 複数趣味の本格運用
- 制約資源の本格判定
- 未来研究所との連携
- 複雑なアニメーション
- 重いゲーム化

---

## 3. 実装方針

### 方針1. 編纂室の下流として作る
ホビーフォートレスは、編纂室の土台を使う側である。
したがって、編纂室の資産名・種別・状態を読む実装を優先し、ホビーフォートレス独自の巨大な状態管理は持ち込まない。

### 方針2. まずは手動定義
MVPでは、趣味階層はコードまたはローカルJSONで手動定義する。
AIで自動生成しない。そこに夢を見始めると着地が消える。

### 方針3. 1趣味・3階層で止める
最初は以下のような極小構成でよい。

- 趣味: 釣り
- 階層1: 釣り堀で体験する
- 階層2: 自前の竿で釣る
- 階層3: 狙う魚や場所を選んで釣行する

### 方針4. 判定結果を言い切りすぎない
表示文は次のトーンを守る。

- 「到達済み」
- 「あと1条件で到達可能」
- 「不足条件」
- 「次のミッション候補」

断定的な人格評価はしない。
趣味ページでまで評価面談を始める必要はない。

---

## 4. 変更対象ファイル

### 4-1. 新規作成
- `src/domain/hobbyFortress/schema.ts`
- `src/domain/hobbyFortress/validate.ts`
- `src/domain/hobbyFortress/match.ts`
- `src/domain/hobbyFortress/sampleHobbies.ts`
- `src/domain/hobbyFortress/match.test.ts`
- `src/ui/views/hobbyFortress.ts`

### 4-2. 既存変更
- `src/domain/schema.ts`
- `src/app/store.ts`
- `src/app/bootstrap.ts`
- `src/services/storage/localStorage.ts`
- `index.html`
- `src/styles/main.css`

### 4-3. 変更を避ける対象
- `src/ui/views/henzanRoom.ts` の大規模改造
- `src/ui/views/futureLab.ts`
- OneDrive同期ロジックの大変更
- 既存データ構造の全面破壊

---

## 5. データ設計

### 5-1. 新しい型
#### HobbyFortressRequirement
- `id`
- `label`
- `type`  
  - `asset_name`
  - `asset_type`
  - `scale_at_least`
  - `status_any_of`
- `expected`
- `optional`  
- `note`

#### HobbyFortressMission
- `id`
- `label`
- `kind`
  - `buy`
  - `learn`
  - `search`
  - `visit`
  - `setup`
  - `practice`
- `summary`
- `related_requirement_ids`

#### HobbyFortressLevel
- `id`
- `order`
- `name`
- `description`
- `requirements`
- `missions`
- `unlock_text`

#### HobbyFortressTrack
- `id`
- `name`
- `description`
- `levels`

### 5-2. DataCache拡張
`src/domain/schema.ts` の `DataCache` に最低限これを追加する。

- `hobbyFortressState?: { selectedTrackId?: string | null }`

MVPでは状態は軽くてよい。
本格的な進捗DBはまだ持たない。

---

## 6. 判定ロジック

### 6-1. 必要関数
`src/domain/hobbyFortress/match.ts` に以下を持つ。

#### `evaluateTrack(track, assets)`
返却値:
- currentLevel
- nextLevel
- satisfiedRequirements
- missingRequirements
- readyToAdvance
- suggestedMissions

#### `isRequirementSatisfied(requirement, assets)`
要件ごとの達成判定を返す

#### `buildSuggestedMissions(nextLevel, assets)`
不足条件に対応するミッション一覧を返す

### 6-2. MVPの判定ルール
#### asset_name
指定名を含む資産が存在するか

#### asset_type
指定種別の資産が存在するか

#### scale_at_least
指定した規模以上の資産が存在するか  
規模順は 小 < 中 < 大 とする

#### status_any_of
活性 / 進行中 などの許容状態に合う資産があるか

### 6-3. 現在階層の決め方
- 上から順に見るのではなく、下位から順に満たしている最大階層を現在階層とする
- 次階層は `currentLevel + 1`
- 次階層がなければ「最終階層到達」とする

---

## 7. UI設計

### 7-1. タブ追加
`index.html` と `bootstrap.ts` に `hobby` タブを追加する。

タブ名:
**ホビーフォートレス**

### 7-2. MVP画面要素
#### ヘッダ
- ページタイトル
- 説明文
- 選択中の趣味名

#### 現在地カード
- 現在階層
- 次階層
- 到達判定

#### 条件カード
- 達成済み条件
- 不足条件

#### ミッションカード
- 次にやる候補 1〜3 件

#### 根拠資産カード
- 判定に使った編纂室資産の一部一覧

### 7-3. 初期表示
最初は `sampleHobbies.ts` に置く 1 趣味だけを表示する。
セレクタはあってもよいが、なくてもよい。

---

## 8. 実装タスク分解

## P0
### P0-01 スキーマ追加
- `schema.ts`
- `validate.ts`
を作成
- 型とバリデーションを実装

**DoD**
- 型が定義される
- 不正な track データが弾ける

### P0-02 サンプル趣味追加
- `sampleHobbies.ts` に 1 趣味 3 階層を追加
- まずは「釣り」を採用

**DoD**
- トラック定義が 1 つ読める
- requirements / missions / levels が埋まっている

### P0-03 判定ロジック追加
- `match.ts`
に判定関数を実装

**DoD**
- assets を渡すと currentLevel / nextLevel / missingRequirements が返る
- 最低 3 ケースの unit test が通る

## P1
### P1-01 DataCacheとタブ追加
- `src/domain/schema.ts`
- `src/app/store.ts`
- `src/services/storage/localStorage.ts`
- `src/app/bootstrap.ts`
- `index.html`
を更新

**DoD**
- hobby タブが表示される
- アプリ起動でエラーにならない
- localStorage / IndexedDB の読込が壊れない

### P1-02 View実装
- `src/ui/views/hobbyFortress.ts`
を実装

**DoD**
- 現在階層 / 次階層 / 不足条件 / ミッションが見える
- 編纂室資産が空でも壊れない
- 1 趣味分の画面が出る

## P2
### P2-01 スタイル追加
- `src/styles/main.css`
に最小限のカードUIを追加

**DoD**
- Future Lab や編纂室を壊さない
- ダッシュボード内で浮かない最低限の見た目になる

### P2-02 根拠資産の表示
- 判定に使った資産名を表示

**DoD**
- 「なぜその階層判定なのか」が分かる

---

## 9. テスト戦略

### 必須
- `match.test.ts`
  - 条件を満たす場合
  - 一部不足する場合
  - 資産ゼロの場合

### できれば
- `validate.ts` 用の簡単なテスト
- `localStorage.ts` の schemaVersion 互換確認

---

## 10. 受け入れ基準

### 機能面
- hobby タブが追加される
- 1 趣味の階層定義が表示される
- 編纂室資産と照合できる
- 不足条件が出る
- ミッションが出る

### UX面
- 「次に何をやればいいか」が分かる
- 義務化装置にならない
- 資産ゼロでも責める表示にならない

### 安全面
- 既存の編纂室 / Future Lab / Ippo Log を壊さない
- データ読込で落ちない
- タブ切替で落ちない

---

## 11. 今回の注意点
- 編纂室側のスキーマを勝手に大きくいじりすぎない
- 趣味階層を抽象化しすぎない
- AI自動生成に飛びつかない
- 「楽しい導線」を壊すほど厳密化しない

---

## 12. 最後の判断
このフェーズの成功は、完璧な趣味OSを作ることではない。  
**編纂室の資産が、実際に次の階層判定へ使える**ことを示すことにある。

まずは小さく、1 趣味で、動かす。
そこから広げればいい。人間はすぐ大陸制覇から始めたがるが、まず港を作るのが先。
