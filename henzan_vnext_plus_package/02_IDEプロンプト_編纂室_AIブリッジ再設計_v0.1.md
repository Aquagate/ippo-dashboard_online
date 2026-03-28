# IDE実装プロンプト: 編纂室 AIブリッジ再設計 v0.1

あなたは、既存の `ippo-dashboard_online-1` リポジトリに対して、**編纂室を「ルールベース抽出中心」から「AIブリッジ + 人間編集中心」へ再設計する担当**です。

## 現状認識
現行コードでは、`src/ui/views/henzanRoom.ts` の `handleAutoExtract()` が主導線になっており、
- カテゴリ頻度から「◯◯関連の活動」
- 頻出語から「なんか」「嬉しい」等のノイズ候補
を要確認トレイへ積み上げてしまいます。

また、AI周りも
- プロンプト生成が粗い
- import が `parsed.assets` 前提
- 新規候補追加しかできない
- 更新 / 統合 / 昇格 / 改名を扱えない
という制約があります。

今回のゴールは、**編纂室を実用に寄せること**です。
ルールベース単独ではなく、AIブリッジと人間編集を主導線にしてください。

---

## 今回の目的
以下を実現してください。

1. ルールベース抽出を主導線から降ろす
2. AIブリッジの入出力スキーマを新設する
3. AI import を create / update / merge / promote 対応にする
4. 要確認トレイを「編集トレイ」に寄せる
5. 根拠ログと提案理由を見やすくする

---

## 必須要件

### 1. ルールベース抽出を主導線から降ろす
- `handleAutoExtract()` は残してもよいが、実験用 / 補助に降格してください
- 主ボタン表記や説明を変えて、「これが本命」と見えないようにしてください

### 2. AIブリッジ用の新スキーマを作る
最低限、以下の概念を導入してください。

- `HenzanBridgeRun`
- `HenzanProposal`
- `HenzanProposalOperation`

operation は最低でも以下を含めてください。

- `create`
- `update_existing`
- `merge_into_existing`
- `rename_existing`
- `promote_scale`
- `link_related`

### 3. DataCache を拡張する
`src/domain/schema.ts` に、少なくとも以下を追加してください。

- `henzanBridgeRuns`
- `henzanProposals`

既存の `reviewEvents` は壊さず、段階的移行でも構いません。

### 4. AIプロンプト生成を再設計する
`handlePromptGenerate()` を置き換えるか分割し、少なくとも以下を持つ prompt packet を生成してください。

- `prompt_version`
- `mode`
- `window_days`
- 既存資産一覧（id/name/type/scale/status）
- ログ一覧（id/date/category/text）
- 禁止語
- 命名ルール
- 出力スキーマ

mode は最低でも以下にしてください。

- `discovery`
- `curate`
- `promote`

### 5. AI import を新スキーマ対応にする
以下の形式を受けられるようにしてください。

```json
{
  "run_meta": {
    "prompt_version": "henzan-bridge-v1",
    "mode": "curate",
    "window_days": 60
  },
  "proposals": [
    {
      "operation": "create",
      "target_asset_id": null,
      "merge_target_id": null,
      "candidate": {
        "name": "バイブコーディング",
        "type": "技能",
        "scale": "小",
        "summary": "AI支援で小規模な実装や試行を進める実践力"
      },
      "evidence_log_ids": ["entry_1", "entry_2"],
      "evidence_quotes": ["Codexを触った", "Antigravityの代替導線を確認した"],
      "reason": "複数ログにわたり一貫して現れるため",
      "confidence": "高"
    }
  ]
}
```

### 6. 編集トレイを強化する
要確認トレイでは最低限、以下を見せてください。

- operation
- candidate 名
- target / merge先
- evidence件数
- reason
- prompt_version
- mode

さらに、以下の操作を最低限入れてください。

- 採択
- 却下
- 採択前編集
- 保留

### 7. 根拠表示を強化する
選択中の proposal に対して、
- evidence_log_ids
- evidence_quotes
- 対応ログ原文
を表示してください。

---

## 実装制約
- Future Lab は大改造しない
- 羅針盤には触りすぎない
- 同期やOneDriveまわりを壊さない
- 一歩ログ入力画面を壊さない
- 既存の編纂室資産はなるべく維持する
- ルールベース抽出を即完全削除しなくてよい
- ただし主導線には置かない

---

## UX制約
- AIが決めた正解のように見せない
- 人間が編集長であることが伝わるUIにする
- 候補の“理由”と“根拠”が見えるようにする
- ノイズ候補を正面から減らす
- 主導線は「AI候補を編む」であり、「自動抽出で増やす」ではない

---

## 期待する変更対象
### 新規候補
- `src/domain/henzan/bridge.ts`
- `src/domain/henzan/prompts.ts`
- `src/domain/henzan/import.ts`
- `src/domain/henzan/bridge.test.ts`

### 既存変更
- `src/domain/henzan/schema.ts`
- `src/domain/henzan/validate.ts`
- `src/domain/schema.ts`
- `src/ui/views/henzanRoom.ts`
- `src/services/storage/localStorage.ts`
- `index.html`
- `src/styles/main.css`

---

## 期待する出力
1. 変更ファイル一覧
2. 実装内容の要約
3. どの導線が変わったか
4. 追加した新スキーマの説明
5. テスト結果
6. まだ後回しにした論点

---

## 最後に
今回の本質は、編纂室を「自動で雑に増える棚」から「AI候補を人間が編む編集室」へ戻すことです。

派手な自動化より、
- 候補の質
- 根拠
- 編集しやすさ
を優先して実装してください。
