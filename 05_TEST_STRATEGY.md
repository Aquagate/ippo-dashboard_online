# 05_TEST_STRATEGY（テスト戦略）

## 1) テスト方針（レイヤ別）
### Unit（最優先）
- domain/merge.ts：決定的マージ（同時更新、同値）
- domain/migrations.ts：旧→新の変換（欠損しない）
- domain/validate.ts：スキーマ検証（異常入力を弾く）
- services/storage/snapshots.ts：lastGood/世代管理

### Integration（次点）
- Storage（IDB）読み書き → validate → migrate → normalize の一連
- Sync Engine：排他、再実行フラグ、デバウンスpush、定期pullの基本動作（モックで）

### E2E（最小でOK）
- Playwright等で “最低1〜3本” のシナリオを固定し、回帰を防ぐ

### Lint / Format
- ESLint + Prettier（自動整形）
- TypeScript strict（可能な範囲で）

### Security（最低ライン）
- innerHTML禁止（lint規約 or grepチェック）
- 依存はnpm管理（CDN排除）
- CSP導入（RC）

---

## 2) 最初に作るE2Eシナリオ（1〜3本）
### E2E-1：基本入力→保存→再起動
1. アプリ起動
2. 一歩を1件追加
3. リロード
4. 追加した一歩が残っている

期待：IDB保存が機能し、表示は崩れない

### E2E-2：lastGoodロールバック
1. 正常データで起動（lastGoodが作られる）
2. 意図的に破損データを注入（テスト用フックでOK）
3. リロード
4. 自動ロールバックが走り、正常に復旧＋通知される

期待：検証→復旧が自動で動く

### E2E-3：疑似マルチデバイス同期（モック可）
1. 端末Aでデータ更新→push
2. 端末Bで定期pull→反映
3. A/Bで同一idを更新（同値ケース含む）
4. 最終状態が決定的に収束する

期待：deviceId+revで揺れない

---

## 3) 回帰テストの考え方
- “壊れたら終わる箇所” を固定：merge / migrate / validate / snapshots / sync排他
- 1改善ごとに、最低でも Unit が通ることをゲート条件にする

---

## 4) 失敗時の切り分け手順
1. どの層で落ちたか（Unit / Integration / E2E）
2. 直近差分の影響範囲を特定
3. 最小修正で復旧（仕様変更はチケット）
4. 再テスト（同じ失敗が再発しないことを確認）
