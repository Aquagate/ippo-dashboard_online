# SEED Auto-Evolution Factory 指示書群（v0.1）

このフォルダは、「一歩ログ + 未来ラボ」アプリを **Vite + TypeScript** に移行し、
**データ保護（壊れても復活）** と **マルチデバイス自動同期（揺れない）** を強化しながら、
IDE / 開発AI が **MVP → 改善ループ → RC宣言** まで自律運用できるようにするための指示書群です。

---

## 1. 全体像（工程）
### フェーズ
- **MVP（基盤改造の第一波）**
  - Vite+TS化 / 依存npm化
  - IndexedDB移行 + スキーマ検証
  - lastGoodスナップショット + 自動ロールバック
  - 同期エンジン分離（debounce push / interval pull / 排他）
  - deviceId + rev による決定的マージ
  - XSS自爆防止（innerHTML排除 or サニタイズ）
  - 同期状態UI / 復元導線
- **改善ループ（1サイクル1改善）**
  - テスト拡充（merge/migration/validation）
  - 世代スナップショットの強化
  - エラー分類とUX改善
- **RC（正式版候補）宣言**
  - DoDを満たし、回帰が出ない状態
  - リリースチェックリストを満たす

---

## 2. ゲート（承認点）
- **Gate A：MVP完成宣言**
  - 02_DOD.md の MVP項目を満たす証拠を提出
- **Gate B：改善採用**
  - 1改善ごとにチケット提出（07_GATES_AND_TICKETS.md）
- **Gate C：RC宣言**
  - RC DoD と 08_RELEASE_CHECKLIST.md を満たす証拠を提出

---

## 3. 役割分担（人間 / AI）
### 人間（うぜん）の責任範囲
- 方針・優先順位・スコープの最終決定
- 破壊的操作（全消し / 復元 / 同期先変更など）の承認
- 実機での最終動作確認（マルチデバイス実験含む）
- Open Questionsへの回答（必要なものだけ）

### IDE / 開発AI の責任範囲
- 本指示書群に基づく実装・テスト・修正
- 変更差分の説明、テスト結果、リスク、ロールバック手順の提示
- ゲート到達時の「証拠パッケージ」作成（ログ、スクショ、手順）

---

## 4. 使い方（最短手順）
1. 01_PHILOSOPHY.md / 03_CONSTRAINTS.md を読み、禁止事項を固定  
2. 04_ARCHITECTURE.md に従い、Vite+TSプロジェクト雛形を作成  
3. 05_TEST_STRATEGY.md の最小テストを先に作る（merge/migrationから）  
4. 90_PROMPT_FOR_IDE.md を IDE/開発AI に貼って自律運用開始  
5. Gate A 到達で、うぜんが Go/NoGo を判断

---

## 5. 重要ルール（破壊を防ぐ）
- ローカル保存（正）と同期（追従）を混ぜない  
- schemaVersion + migrate + validate を必ず通す  
- lastGood（最後の正常）を常に保持し、失敗時はロールバック  
- ユーザー入力は innerHTML で描画しない（原則 textContent）  
- 秘密情報（鍵/トークン/APIキー）をドキュメント・ログに出さない

---

## 6. ファイル一覧
- 00_README.md：この説明
- 01_PHILOSOPHY.md：北極星・原則・Not-To-Do
- 02_DOD.md：MVP/RC/v1 の完結条件
- 03_CONSTRAINTS.md：制約と禁止事項（強い）
- 04_ARCHITECTURE.md：構造・データモデル・壊れやすい点
- 05_TEST_STRATEGY.md：テスト計画とE2E最小シナリオ
- 06_AUTONOMY_PLAYBOOK.md：自律改善ループの手順
- 07_GATES_AND_TICKETS.md：ゲートとチケットテンプレ
- 08_RELEASE_CHECKLIST.md：RC〜リリースのチェック
- 09_RISK_REGISTER.md：リスク台帳
- 10_CHANGELOG.md：変更履歴ルール
- 90_PROMPT_FOR_IDE.md：IDE/開発AI運用プロンプト（最重要）
