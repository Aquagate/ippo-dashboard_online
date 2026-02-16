## [5.3.2] - 2026-02-16
### ⛩️ The 3-Layer Drive System Edition
**"思想(PDRD)で決め、ルーブリック(RDD)で測り、AI(AIDD)で回す"**

SEEDの設計思想を「3層駆動アーキテクチャ」として再定義しました。
機能追加ではなく、マニュアルと哲学の大幅なアップデートです。

### Documentation
- **New Philosophy**: `SEED_GUIDE.md` を全面改訂。PDRD/RDD/AIDD の3層構造を定義。
- **Guide Restructure**: 旧ガイドを `docs/legacy/SEED_GUIDE_v4.md` にアーカイブ。
- **Weapon Selector**: `ops/WEAPON_SELECTOR.md` を v5.3 仕様（3層構造への誘導）に更新。

## [5.3.1] - 2026-02-15
### 🛡️ Stabilization & Regression Testing
**"自動テストによる品質の固定"**

リリース前の安定化措置として、自動テストコマンドとテストシナリオを整備しました。

### Added
- **Automated Testing**: `npm test` コマンドを追加。`ops/tests/scenario_runner.js` で3つのシナリオ（受付・承認・AI連携）を自動検証。
- **LLM Mocking**: `.env` に `LLM_MOCK=true` を追加し、ローカルでの高速テストを可能に。

## [5.3.0] - 2026-02-15
### 🦋 Butterfly Analysis & Resilient Sync Edition
**"過去の自分を文脈に変え、データの不整合を徹底的に排除する"**

Ippo Dashboard Future プロジェクトから、過去のシミュレーションと現在を繋ぐ「軌道分析」と、分散環境でのデータの一貫性を保つ「堅牢な同期ロジック」を統合しました。

### Added
- **Trajectory Context Injection**: `ops/snippets/trajectory_context.js`  
  前回のシミュレーション要約をプロンプトに注入し、変化を分析させるパターン。
- **Strict Sync Protocol (Anti-Zombie)**: `ops/snippets/strict_sync_logic.js`  
  論理削除と `Strict Newer Wins` による、物理削除を使わない堅牢なマージパターン。
- **Safe Prompting for Evolution**: `ops/PROMPT_LIBRARY.md` Section 6  
  AIに過去の文脈を比較・分析させるための「Trajectory Shift」プロンプト。
- **Case Study**: `ARCHIVED_LEARNINGS/IPPO_FUTURE_CASE_STUDY.md`

### Fixed
- **Sync Conflict**: マージ時のタイムスタンプ同一判定を厳格化し、削除フラグの消失（ゾンビ復活）を解消。

## [5.2.0] - 2026-02-14
### 🧩 Rule-Bound Bridge & Ledger Harvest Edition
**"重複を増やさず、運用パターンを武器庫に積み上げる"**

Hobby Fortress v0.41 から、静的運用で再利用しやすい実装パターンを選別して統合しました。
重複判定の結果、Manual AI Bridge 系は新規収穫せず、既存資産への参照として記録のみ実施しています。

### Added
- **Schema Validation Fallback**: `ops/snippets/schema_validation_fallback.js`  
  ローカルAjv優先、失敗時CDNフォールバックの静的サイト向けパターン。
- **JSONL Ledger I/O**: `ops/snippets/jsonl_ledger_io.js`  
  JSONLのparse/export、import時の`merge/replace`、正規化、重複除去パターン。
- **Date Range Presets**: `ops/snippets/date_range_presets.js`  
  月曜起点の`this_week`/`last_week`を含む期間プリセット計算パターン。
- **Low-State Boundary Test Template**: `ops/snippets/tests/low_state_policy_test.py`  
  `energy/mood` 境界での回復カード制約を検証するテンプレート。
- **Bridge Rule-Bound Prompt**: `ops/PROMPT_LIBRARY.md` Section 5  
  Council/FoundryのJSON出力をルール境界で拘束するプロンプトテンプレート。
- **Case Study**: `ARCHIVED_LEARNINGS/HOBBY_FORTRESS_v0_41_CASE_STUDY.md`

### Changed
- **Harvest Governance**: 重複資産の非採用（記録のみ）と、削除ではなく追記/Deprecatedで運用する非破壊ポリシーを明文化。

## [5.1.0] - 2026-02-10
### 🎨 Hobby Ecosystem Edition
**"趣味プロジェクト循環システム"**

Project Hub v2.0 から得られた「熱量駆動」「完成→アイデア循環」「Auto-Sync UX」の知見を統合しました。

### Added
- **Hobby Project Loop**: `ops/PROMPT_LIBRARY.md` Section 4 - AI Idea Generator, Weekly Reflection プロンプト
- **Heat System**: `ops/snippets/hobby_patterns.md` - 熱量ソート、休日フィルター、Showcaseステータス
- **Auto-Sync UX**: `ops/snippets/ui_patterns/auto_sync.md` - ボタン削減、自動同期デフォルト化パターン
- **Dark Slate Theme**: `ops/snippets/ui_patterns/dark_slate.css` - プロ向けコンパクトダークテーマ
- **Hobby Mode**: `ops/WEAPON_SELECTOR.md` - 趣味プロジェクト向け装備セット
- **Case Study**: `ARCHIVED_LEARNINGS/PROJECT_HUB_CASE_STUDY.md`

## [5.0.0] - 2026-02-08
### 🧬 Evolution Protocol Edition
**"プロジェクトからの還流による、自己進化するSEED"**

Ippo Dashboard v2.0 プロジェクトから得られた「心理的安全性 (Safe AI)」「時間帯分析 (TOD)」「没入型UI」の知見をコア機能として統合しました。

### Added
- **Safe AI Prompts**: `ops/PROMPT_LIBRARY.md` に Section 3 "High-Stakes Simulation" を追加。Rubricによる内部チェックと恐怖訴求禁止を標準化。
- **Snippet Library**: `ops/snippets/` を新設。
  - `log_analysis_tod.js`: ログの時間帯統計分析ロジック。
  - `ui_patterns/glassmorphism.css`: Bento Grid対応のNeon Glassmorphismスタイル。
- **Archived Knowledge**: `ARCHIVED_LEARNINGS/IPPO_DASHBOARD_v2_CASE_STUDY.md` (Safe AI Design & Modern UI)。

### Architecture
- Directory renamed to `SEED_v5`.

## [4.1.0] - 2026-02-03
### ⚔️ Weaponized & Serverless Edition
**"プロジェクトに合わせた武器を自律選択する、拡張されたSEED"**

### Added
- **Weapon Selector**: プロジェクト開始時に `ops/WEAPON_SELECTOR.md` を通じて最適な機能セットを診断・提案する機能。
- **Manual AI Bridge**: Serverless環境でもクリップボード経由でRubric AIを利用できるアーキテクチャ。
- **Robust CSV Utils**: `ops/csv_utils.js` (RFC4180準拠) による堅牢なデータ処理。

### Architecture
- **Kickoff Update**: KICKOFF_PROMPTに「武器選定」ステップを追加。
- Directory renamed to `SEED_v4_1`.

## [4.0.0] - 2026-02-01
### 🚀 SEED v4 初版リリース
**"Intelligence & Stability Edition" (知能と安定性)**

標準搭載された機能:
- **Rubric Engine v2.0**: AI出力の品質を自動評価する内蔵エンジン (正確性, 安全性, トーン)。
- **エンタープライズ・セキュリティ**: Secure Cookies, HttpOnly, サーバーサイドセッション, CSRF対策済み。
- **本番運用の安定性**: Graceful Shutdown (安全な停止), ヘルスチェック (`/api/health`), 整合性スキャン。
- **ロール別UIテンプレート**: 標準的な役割 (PM, SV, OP) に対応した Glassmorphism ダッシュボード。
