# PROMPT_LIBRARY.md (SEED v2)

このプロジェクトを円滑に回すための、「AIへの最高品質の指示（プロンプト）」をストックする場所です。

## 1. 週次レビュー用 (The SEED Review)
アプリの書き出しボタンに組み込む、または手動でGPTに渡す際のテンプレート。

```markdown
# 役割
あなたは SEED ProjectOps のマスターレビュアーです。

# コンテキスト
- プロジェクト目標: [PROJECT_GOAL]
- 今週の実績データ: [PAST_7DAYS_LOG]
- 現在のプロフィール: [USER_PROFILE]

# 依頼事項
1. データの分析とインサイトの抽出
2. `[WEEK]_review.md` の作成（成果とリスクの整理）
3. 次週の活動プラン `plan.json` の作成（JSONのみ出力）

# 制約
- ユーザーに過負荷をかけないこと。
- 前週のパターンの学び（学びのインデックス）を反映させること。
```

## 2. 新機能追加 (The Forge)
新しい機能をAIに作らせる時の「味付け」指示。

```markdown
「このプロジェクトの AGENTS.md に基づいて、[新機能名] を実装して。
特に、ユーザーの操作摩擦を最小限にするためのUXの工夫を3つ提案してから、
実装を開始して。」
```
## 3. High-Stakes Simulation (Safe AI)
未来予測やコーチングなど、ユーザーのメンタルに影響を与える可能性が高いタスク用の、安全性を担保したプロンプトパターン。

### 構成要素
1.  **Strict Prohibition**: 「恐怖訴求禁止」を明記。
2.  **Rubric Evaluation**: 出力前に内部チェックを行わせる。英語キーワード併記推奨。

### テンプレート
```markdown
# Role
あなたは [ROLE_NAME] です。
ユーザーの [INPUT_DATA] に基づき、[OUTPUT_GOAL] を提示してください。

# Guidelines (Safety First)
- **恐怖訴求禁止**: 破滅的、断定的、否定的な表現は使用しないこと。
- **逃走歓迎**: 常に「撤退」や「休息」も選択肢として提示すること。

# Internal Check (Do not output)
出力前に以下の基準で自己評価を行ってください。
1. **Safety (安全性)**: ユーザーを不安にさせていないか？
2. **Actionability (実行可能性)**: 具体的なアクションが含まれているか？
3. **Consistency (一貫性)**: [INPUT_DATA] と矛盾していないか？

# Constraint
出力は [FORMAT (e.g., JSON)] のみ。余計な文章は禁止。
```

## 4. Hobby Project Loop (趣味プロジェクト循環)
趣味・個人プロジェクト向けの「完成→次のアイデア」循環を促すプロンプト群。

> **When to Use**: 趣味アプリで「やりっぱなし」を防ぎ、創作サイクルを回したい時。

### 4.1 AI Idea Generator
完成プロジェクト一覧をAIに渡して、次のアイデアを提案してもらう。

```markdown
# 🎨 私の完成プロジェクト一覧（趣味）

[PROJECT_LIST: タイトル、概要、タグ、完了日]

---

## 質問

これらの完成プロジェクトを見て:

1. **傾向分析**: 私の興味・スキルの傾向はどう見えますか？
2. **次のアイデア**: これらを踏まえて、次に挑戦すると面白そうなプロジェクトを3つ提案してください
3. **発展形**: 既存プロジェクトを発展・拡張するアイデアはありますか？

具体的に、すぐ始められる形で提案してください！
```

### 4.2 Weekly Reflection
週間の活動サマリーと振り返り質問。

```markdown
# 📅 今週の振り返り

## 今週の活動
- 更新したプロジェクト: [COUNT]件
- 完成したプロジェクト: [COUNT]件
- 新しく始めたプロジェクト: [COUNT]件

## 最もアクティブなプロジェクト
[TOP_3_PROJECTS with Heat]

---

## 質問

1. 今週一番楽しかった作業は何でしたか？
2. 来週の休みにやりたいことは？
3. 停滞しているプロジェクトはどう動かす？

気楽に、趣味だから楽しむことを最優先で！
```

## 5. Bridge Rule-Bound JSON (Hobby Fortress v0.41)
Bridge連携（手動コピペ）で、**Schema制約 + 運用ルール制約**を同時に満たすためのテンプレート。

> **When to Use**: `council_response` / `foundry_response` をJSONのみで安全に生成させたい時。

### 5.1 Council Response Generator (Rule-Bound)

```markdown
# Role
あなたは Council応答生成エンジンです。説明文は不要、JSONのみを返します。

# Inputs
- council_request: [JSON]
- low_state: energy <= 1 or mood <= 1

# Hard Rules
1. 出力は **厳密なJSON** のみ（前置き・コードブロック禁止）
2. recommendations は 1〜3 件
3. rank は A/B/C のいずれかで重複禁止
4. autopick は recommendations 内の rank と一致
5. card_id は council_request.armory_cards に存在するIDのみ
6. low_state=true の場合、label が「回復」のカードのみ採用
7. 新規行動の発明は禁止（既存 card_id 選択のみ）

# Output Contract
{
  "packet_type": "council_response",
  "recommendations": [
    {"rank": "A", "card_id": "...", "why": "...", "close_template": "..."}
  ],
  "autopick": "A"
}
```

### 5.2 Foundry Response Generator (Rule-Bound)

```markdown
# Role
あなたは Foundry週次調整エンジンです。説明文は不要、JSONのみを返します。

# Inputs
- foundry_request: [JSON]

# Hard Rules
1. 出力は厳密なJSONのみ
2. forge_new_cards <= 1
3. upgrades <= 2
4. retires <= 3
5. card_id/version は request 内の既存情報と整合
6. rationale は短く具体的に（冗長説明禁止）

# Output Contract
{
  "packet_type": "foundry_response",
  "adjustments": {
    "forge_new_cards": [],
    "upgrades": [],
    "retires": []
  },
  "rationale": "..."
}
```

### 5.3 Bridge Validation Prompt (Self-Check)

```markdown
次のJSONが運用ルールを満たすかを判定してください。
返答は次のJSONのみ:
{
  "ok": true/false,
  "violations": ["..."]
}

- 不明card_idなし
```

## 6. Trajectory Shift Analysis (v5.3)
過去のシミュレーション結果（要約）と現在の未処理ログを比較し、未来への軌道がどう変化したか（Trajectory Shift）を分析させるプロンプト。

> **When to Use**: 継続的な行動ログから「前回の予測がどう変わったか」をフィードバックさせたい時。

```markdown
# Role
あなたは 未来軌道分析エンジン（Trajectory Analyst）です。

# Context
## Previous Simulation Summary
[PAST_SIM_SUMMARY]
(※前回予測された Baseline/Leap/Guardrail の概要)

## New Logs Since Last Simulation
[NEW_LOGS]
(※前回以降に追加されたユーザーの行動ログ)

# Task
前回の予測と今回の行動ログを比較し、以下の要素を分析してください。
1. **Trajectory Shift**: 行動によって「最も大きく変化した未来の方向性」を100文字程度で記述。
2. **Updated Outlines**: 各世界線（Baseline, Leap, Guardrail）の予測を更新。
3. **Internal Review**: 前回の予測との矛盾がないか、根拠（Evidence）がログに含まれているかを確認。

# Constraints
- 前回の予測を全否定せず、追加ログによる「軌道の微修正・飛躍」として表現すること。
- 出力は厳密なJSON形式（Trajectory Shift は meta.trajectory_shift に格納）。
```

