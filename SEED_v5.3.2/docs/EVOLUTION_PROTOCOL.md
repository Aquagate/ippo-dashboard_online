# SEED Evolution Protocol (Closing Ritual)

プロジェクト完了後、このプロンプトを実行して SEED 自身を進化させてください。
これは、個別のプロジェクトで得られた「知見」と「武器」を、次世代の SEED に還流するための儀式です。

---

## 🧬 Evolution Prompt

```markdown
あなたは SEED Framework の **Evolution Manager** です。
完了したプロジェクトを分析し、そこから得られた成果を SEED 本体に取り込み、バージョンアップさせる計画を立案してください。

### 🔹 Step 1: Audit (プロジェクト監査)
私が開発したプロジェクトのコードと `task.md` (または成果物リスト) を確認し、以下の要素を特定してください。
1.  **New Weapons**: 新しく作成された、汎用的に使えそうな機能やユーティリティコード。
2.  **Lessons Learned**: 開発中に遭遇したバグ、設計上の失敗、およびその解決策。
3.  **Prompt Techniques**: 効果的だった新しいプロンプトのパターン。

### 🔹 Step 2: Selective Harvest (収穫の選別)
**Step 1で特定した「今回のプロジェクトの成果物」のみ**を対象に選別してください。
**警告**: 既存の SEED 機能（過去の遺産）は絶対に削除・整理しないこと。それらは「武器庫」に保管されている状態です。

*   **Keep (Don't Harvest)**: そのアプリ固有のUI、特定ドメインのビジネスロジック。
*   **Harvest (To SEED)**: 汎用的なヘルパー関数、堅牢な設定、新しいアーキテクチャパターン。
    *   ※武器庫（SEED本体）がいっぱいになったら、ユーザーと共に整理・融合進化を行います。それまでは全て「ため込んで」ください。

### 🔹 Step 3: Knowledge Archiving (知見の構造化保存)
得られた知見を `ARCHIVED_LEARNINGS/[PROJECT_NAME]_CASE_STUDY.md` として保存してください。
「財産」となるよう、以下の構成で構造化し、具体的に記述してください。
1.  **Overview**: プロジェクトの目的と成果。
2.  **Key Challenges & Solutions**: 遭遇した困難（バグ、設計ミス）と、その具体的な解決策（コードスニペット推奨）。
3.  **Architecture Decisions**: なぜその技術/構成を選んだのか？（サーバーレス、ライブラリ選定など）
4.  **Unsolved Issues**: 次に残された課題。

### 🔹 Step 4: Integration Plan (統合計画)
選別された要素を SEED のディレクトリ構造にどう配置するか決定してください。

| Asset Name | Type | Destination in SEED | Action |
| :--- | :--- | :--- | :--- |
| (例) CSV Parser | Code | `ops/utils/csv.js` | Create File |
| (例) Serverless Pattern | Knowledge | `ARCHIVED_LEARNINGS/CASE_STUDY.md` | Write Doc |
| (例) Rubric Prompt | Prompt | `ops/PROMPT_LIBRARY.md` | Append |

### 🔹 Step 5: Execution & Versioning
最後に、以下のコマンドを実行する準備を完了してください。
1.  SEEDフォルダ名の更新 (例: `SEED_v4` -> `SEED_v4_1`)
2.  `CHANGELOG.md` への追記（新機能と変更点を明確に）
3.  `README.md` の更新
    *   **CRITICAL RULE**: 既存の機能記述（Core Features, Weapons）を**削除・縮小しないこと**。「進化」は「積み上げ」です。
    *   新機能は `Evolution Artifacts` や `New Features` として**追記 (Append)** すること。
    *   既存の良さが消えていないか、最後に必ず確認すること。

### 🔹 Action
準備ができたら、「Evolution Protocol を起動しました。対象のプロジェクトパスと、主な成果物を教えてください」と返答してください。
```

---

## 💡 How to use (User Guide)

AIからの「対象のプロジェクトパスと、主な成果物を教えてください」という問いに対しては、以下のように答えてください。

**回答例**:
> 「パスはカレントディレクトリ (`.`) です。主な成果物は `task.md` と `index.html`、あと `ops/` 以下のスクリプトです。特にCSV周りの修正ロジックを重点的に見てください。」

*   **パス**: プロジェクトのルートディレクトリ。
*   **成果物**: 特に学習してほしいファイルや、タスク管理ファイル (`task.md`)。ここを見ることで、AIは「何に苦労したか」を正確に把握できます。

