# Case Study: Ippo Dashboard v2.0 (Future Lab & AI Bridge)

> **Project**: Ippo Dashboard v2.0
> **Date**: 2026-02-08
> **Focus**: AI-Driven Future Simulation, Modern UI/UX

## 1. Overview
本プロジェクトでは、「未来の選択肢を増やす」ことを目的としたシミュレーション機能（Future Lab）のUI刷新と、AI生成ロジック（AI Bridge）の高度化を行った。
特に、**心理的安全性 (Psychological Safety)** を担保したAIプロンプト設計と、**Glassmorphism** を採用した没入感のあるUIデザインにおいて重要な知見が得られた。

## 2. Key Challenges & Solutions

### Challenge 1: AIによる「未来の断定」が引き起こす不安
初期のAIプロンプトでは、「リスク」や「警告」が強く出過ぎてしまい、ユーザー（観測者）に対して不要な不安やプレッシャーを与えていた。また、「エネルギー」という曖昧な概念が自己評価のストレスになっていた。

**Solution: Safe AI Design Pattern**
1.  **用語の再定義**: "Risk" を "詰まりポイント"、"Guardrail" を "逃走歓迎 / 回復の足場" と定義し直し、失敗を許容するスタンスを明示した。
2.  **Explicit Prohibition (明示的禁止)**: プロンプトに「恐怖訴求禁止（破滅/手遅れ/最悪 などの煽り語を使わない）」を追加。
3.  **Concept Removal**: UIおよびロジックから「Energy」を完全に排除し、主観的で変動しやすい指標への依存をなくした。

### Challenge 2: コンテキストの乖離（AIが生活リズムを理解しない）
AIはログのテキスト内容のみを見ており、「いつ」その行動が行われたかを考慮していなかったため、朝活の推奨を夜に行うなどの不整合があった。

**Solution: Time-of-Day (TOD) Injection**
1.  **Icon + Tag**: ログ行に `🌅(morning)` のような形式でTOD情報を埋め込み、AIが視覚的・意味的に時間を認識できるようにした。
2.  **Statistical Context**: ログ全体における時間帯の割合（朝型か夜型か）を集計し、`Top Categories` と並列でContextとして渡した。

### Challenge 3: 情報過多によるUIの複雑化
3つの世界線を提示するカードUIは、詳細情報（Assets, Risks, Evidence）を含めると縦に長くなりすぎ、比較検討が困難だった。

**Solution: Bento Grid & Collapsible UI**
1.  **Bento Grid**: CSS Grid (`grid-template-columns: repeat(3, 1fr)`) で3カラムレイアウトを強制。
2.  **Progressive Disclosure**: 重要な「Roadmap」「Micro Steps」のみを常時表示し、詳細情報は `<details>` タグで折りたたむことで、一覧性と詳細性の両立を図った。

## 3. Architecture Decisions

### Glassmorphism UI
- **理由**: 未来感と軽やかさを演出するため。
- **実装**: `background: rgba(255, 255, 255, 0.05)`, `backdrop-filter: blur(10px)`, `border: 1px solid rgba(255, 255, 255, 0.1)` の組み合わせ。
- **注意点**: 可読性を保つため、文字色はコントラスト比が高い色（`#fff`, `#ccc`）を使用し、背景色との融和に注意した。

### Rubric-Driven Prompting (v2.5 tuned)
- **理由**: JSON出力の形式崩れや、論理的整合性の欠如を防ぐため。
- **実装**: プロンプト内に「内部チェック（Internal Monologue）」セクションを設け、出力前に自己評価を行わせる。
- **工夫**: 評価軸に `一貫性 (Consistency)` のように英語キーワードを併記し、解釈ブレを防いだ。

## 4. Unsolved Issues / Future Work
- **LocalStorageの限界**: データ量増加に伴うパフォーマンス低下の可能性。IndexedDBへの移行が必要になるかもしれない。
- **AIモデルの進化追従**: 新しいモデル（Gemini Ultra等）が登場した際、プロンプトの調整（特にトークン数や推論能力に合わせた最適化）が必要。

## 5. Harvested Assets (To SEED)
- **Prompt Library**: `Safe AI Simulation Prompt (v2.5 tuned)`
- **Snippet**: `TOD Statistics Logic`
- **Knowledge**: `Glassmorphism CSS Pattern`
