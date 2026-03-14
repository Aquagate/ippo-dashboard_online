# プロジェクト計画書: [プロジェクト名]
**バージョン**: 1.0 (ドラフト)
**作成日**: 202X-XX-XX
**ベース**: SEED v4 (Intelligence & Stability Edition)

## 1. エグゼクティブサマリー
### 1.1 背景と課題
*   (記述エリア)

### 1.2 目的 (ゴール)
*   **業務の標準化**: ロールベースのワークフローによる品質担保。
*   **知識の自動蓄積**: AI Knowledge Loop による暗黙知の形式知化。
*   **★AI品質の保証**: Rubric Engine による「信頼できるAI」の実現。

## 2. スコープと機能
### 2.1 ロール定義 (Multi-Role)
| ロール | 役割・責任 | 標準画面 |
|---|---|---|
| **Requester** | 申請、ステータス確認。 | Reception Portal |
| **Operator** | タスク実行、一次判断。 | Operator Console |
| **Supervisor** | エスカレーション承認。 | SV Console |
| **PM** | **AI品質監視**、ルール策定。 | PM Console |

### 2.2 主要機能
1.  **受付 & トリアージ**
2.  **ガイド付きワークフロー** (Nudge UI)
3.  **例外ハンドリング & エスカレーション**
4.  **AIナレッジループ & 自動評価 (Rubric Check)**

## 3. アーキテクチャと技術スタック (v4 Standard)
*   **Frontend**: HTML5, Vanilla JS, CSS (Toast UI, Secure Logout).
*   **Backend**: Node.js (Secure Session, Graceful Shutdown).
*   **Database**: JSON-based local storage (Integrity Checked).
*   **AI**: Local LLM + **Rubric Evaluation**.

## 4. 導入計画 (フェーズ)
*   **Phase 1: セットアップ & Rubric定義**: システム構築と「AIの品質基準」の策定。
*   **Phase 2: MVP**: コア業務の実装。
*   **Phase 3: パイロット & 品質測定**: 実際の業務データで Rubric スコアを計測。
*   **Phase 4: 本番運用 & 自動化**: スコア安定後、AIによる自動提案を本格化。

## 5. 成功指標 (KPIs)
*   **処理効率**: 平均処理時間の短縮率。
*   **★AI品質スコア**: Rubric Engineによる平均スコア (目標: 90点以上)。
*   **★自動化率**: 人間の修正なしで完了したタスクの割合 (Target: 'SURGEON' Class > 30%)。
*   **安全性**: Safety Violation によるブロック数 (目標: 0件)。

## 6. 標準開発体制 (RACI)
*   **AXIS**: プロジェクトオーナー。
*   **FRAME**: PMO。進捗管理。
*   **FORGE**: 実装チーム。
*   **PROBE**: **品質管理 (QC)**。AIスコアの分析を担当。
*   **LEDGER**: ルールキーパー。
*   **DELIVER**: 運用チーム。
