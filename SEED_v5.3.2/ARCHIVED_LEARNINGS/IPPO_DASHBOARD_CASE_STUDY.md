# Ippo Dashboard プロジェクト学習ログ

> **ソースプロジェクト**: Ippo Dashboard (Personal Data Visualization)
> **アーカイブ日**: 2026-02-03
> **目的**: SEED v4.1 (Serverless/Manual) への進化リソース

## 📜 開発履歴 (Key Milestones)

### Phase 4: Future Simulation
- **Manual AI Bridge**: Serverless環境下でも、Copy & Pasteのみで高度なAIシミュレーション（未来予測）を実現。
- **Self-Correction Rubric**: プロンプト内で「整合性チェック」を行わせることで、サーバーサイド評価なしで高品質な回答（Score 85+）を安定生成。

### Phase 3: Future Lab (Visualization)
- **Client-side Analysis**: サーバーを持たず、ブラウザ上のJSのみで数千件のログデータの統計・可視化を完遂。
- **No-LLM Analysis**: 統計的アプローチ（ワードクラウド、ヒートマップ）により、低コストで深い洞察を提供。

### Debugging Experience
- **CSV Parser Conflict**: 単純な `split(",")` が、本文中のカンマ/改行により破綻。
- **RFC4180 Solution**: 独自実装のステートマシン型パーサーを導入し、ライブラリ依存なしで解決。

## 💡 得られた知見 (SEED v4 へのフィードバック)

1.  **Architecture Agnosticism (サーバーレスへの回帰)**
    *   SEED v4は「Node.jsサーバーありき」だったが、個人の振り返りツールのような「静的サイト」の需要も高い。
    *   "Minimal Bridge" パターン（Clipbord I/O）は、強力な武器になる。

2.  **Rubric Anywhere**
    *   Rubric Engineは `ops/rubric_engine.js` (Server) だけでなく、プロンプト ("Internal Monologue") としても実装できる。これにより適用範囲が激増する。

3.  **Data Robustness**
    *   「データは必ず汚れている」。最初から堅牢なパーサー (Robust CSV IO) を標準装備すべきである。
