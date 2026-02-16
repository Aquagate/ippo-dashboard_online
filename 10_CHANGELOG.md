# 10_CHANGELOG（変更履歴ルール）

このプロジェクトは Keep a Changelog 風に記録する。
AIが自動追記する前提で、以下のルールを守る。

---

## ルール
- 日付は `YYYY-MM-DD`
- セクションは `Added / Changed / Fixed / Security` を基本
- “なぜ” を1行だけ添える（未来の自分が理解できる程度）
- 破壊的変更は必ず `BREAKING` と復旧手順を記載

---

## フォーマット例
## [Unreleased]
### Added
- 例：同期ステータス表示（同期の不安を減らすため）

### Changed
- 例：pushをデバウンス化（過剰同期を抑制するため）

### Fixed
- 例：ETag mismatch時の再試行が二重実行される不具合を修正

### Security
- 例：ユーザー入力の描画をtextContentへ変更（保存型XSS対策）

---

## [2026-02-16]
### Added
- 初期指示書群 v0.1
