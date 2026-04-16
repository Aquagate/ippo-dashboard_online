# プロジェクト計画書: AIポジティブ日記 "Sunlight"
**バージョン**: 0.1 (Demo)
**ベース**: SEED v4

## 1. エグゼクティブサマリー
### 1.1 目的 (ゴール)
*   ユーザーが日々の出来事を入力すると、AIが必ず「ポジティブな側面」を見つけてフィードバックする。
*   **★AI品質の保証**: AIが「説教」や「無関心な返答」をしないよう、Rubric Engine で感情品質を担保する。

## 2. スコープと機能 (SEED v4 Role Map)
SEEDの標準ロールを書き換えて使用する。

| SEED Original | Diary App Role | 役割 |
|---|---|---|
| **Requester** | **Author (ユーザー)** | 日記を書く人。 |
| **Operator** | **AI Partner** | 日記を読み、返事をするAI。 |
| **Supervisor** | **User (Reviewer)** | AIの返事が気に入らない時に再生成させる自分。 |
| **PM** | **Meta-AI** | ユーザーの感情推移を分析する裏側のAI。 |

## 3. 主要機能 (v4 Features)
1.  **日記入力フォーム**: `Reception Portal` を改造して作成。
2.  **即時フィードバック**: `analyze_patterns.js` を流用し、投稿直後にAIが返信。
3.  **Rubric Guard**: 返信前に「共感できているか？」を自動採点し、低い場合はリテイク。

## 4. 品質基準 (Rubric Strategy)
Ops OS (業務) とは基準をガラリと変える。
*   × 正確性 (Groundedness) → ◎ **共感性 (Empathy)**: ユーザーの感情に寄り添っているか？
*   × 堅苦しさ (Tone) → ◎ **親しみやすさ (Warmth)**: 友達のような口調か？
