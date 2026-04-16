# Case Study: Hobby Fortress v0.41 (Rule-Bound Static Bridge)

> **Project Path**: `D:\dev\hobby-fortress`  
> **Archive Date**: 2026-02-14  
> **Scope for Harvest**: `SEED_v5.1/` 以外の成果物

## 1. Overview
Hobby Fortress v0.41 は、趣味探索から育成までを「行動の連鎖」と「資産化」で回す静的SPAです。  
ローカル側を確定層（保存・表示・ルール強制）に固定し、LLMはAIBridge経由の候補生成だけに限定しました。

本ケースでSEEDに還流する価値が高かったのは、次の5点です。
- Schema検証のローカル優先フォールバック（オフライン耐性）
- JSONL台帳のimport/export運用（`merge/replace` + normalize + dedupe）
- 週境界を含む日付レンジ計算（`this_week`/`last_week`）
- 低状態ルールの境界テスト（手順書 + 自動テスト）
- 構成カバレッジ検査スクリプト（成果物不足の早期検知）

## 2. Key Challenges & Solutions

### Challenge 1: 静的配信でのSchema検証器依存
**Problem**: CDN依存のみだと、ネットワーク状態で検証可否がぶれる。  
**Solution**: ローカルモジュールを先に読み、失敗時のみCDNへフォールバック。

```javascript
async function loadAjv2020Class() {
  try {
    const local = await import("./vendor/ajv2020.local.js");
    if (typeof local?.default === "function") return { ctor: local.default, source: "local" };
  } catch (error) {}
  const remote = await import("https://esm.sh/ajv@8.17.1/dist/2020");
  return { ctor: remote.default, source: "cdn" };
}
```

Source: `app/app.js:313`, `app/app.js:326`

### Challenge 2: JSONL取り込み時のデータ品質揺れ
**Problem**: 欠損・不正行・重複IDで台帳が壊れやすい。  
**Solution**: 行ごとにparseし、取り込み前に正規化とSchema検証を通す。最終的にIDベースでdedupe。

Source: `app/app.js:218`, `app/app.js:231`, `app/app.js:603`, `app/app.js:637`

### Challenge 3: 週次集計の境界不整合
**Problem**: 「今週」「先週」の定義が実装によってぶれる。  
**Solution**: 月曜起点で週境界を固定し、`today/rolling7/last_week/this_month/this_week` を共通化。

Source: `app/app.js:172`, `app/app.js:189`

### Challenge 4: 低状態ルールの漏れ検知
**Problem**: UI側だけで制御すると、Bridge貼り付け経路で規約逸脱が混入し得る。  
**Solution**: 手動境界テスト手順と自動テストを併用し、`energy<=1 or mood<=1` の回復限定を検証。

Source: `LOW_STATE_TEST_PLAN.md:5`, `LOW_STATE_TEST_PLAN.md:84`, `scripts/test_low_state_rules.py:35`

## 3. Architecture Decisions
- **Static-Only Frontend**: API連携なしで配布性を優先。`index.html + app/*.js` で完結。
- **AIBridge as Manual Boundary**: LLMはJSON提案に限定し、最終確定はローカルルールで拘束。
- **JSON First**: request/response/event をSchemaで管理し、自然文による曖昧処理を排除。
- **Policy as Testable Contract**: Council/Foundryの上限・境界条件を関数化して検証可能にした。

## 4. Unsolved Issues
- **通知文言のエンコーディング揺れ**: 一部環境で表示文字化けが発生し得る（要UTF-8運用統一）。
- **大規模台帳時の性能**: `localStorage` 前提のため、長期運用でIndexedDB移行余地あり。
- **Bridge運用の手作業コスト**: JSONコピペ手順の自動化は今後の検討事項。

## 5. Harvest Matrix
| Category | Asset | Decision | Destination in SEED v5.2 | Evidence / Reference |
| :--- | :--- | :--- | :--- | :--- |
| Harvest | Schema Fallback Loader Pattern | Adopt | `ops/snippets/schema_validation_fallback.js` | `app/app.js:313`, `app/app.js:326` |
| Harvest | JSONL Ledger I/O Pattern | Adopt | `ops/snippets/jsonl_ledger_io.js` | `app/app.js:218`, `app/app.js:231`, `app/app.js:603`, `app/app.js:637` |
| Harvest | Date Range Presets Pattern | Adopt | `ops/snippets/date_range_presets.js` | `app/app.js:172`, `app/app.js:189` |
| Harvest | Low-State Boundary Test Template | Adopt | `ops/snippets/tests/low_state_policy_test.py` | `scripts/test_low_state_rules.py:35`, `LOW_STATE_TEST_PLAN.md:5` |
| Harvest | Bridge Rule-Bound Prompt | Adopt | `ops/PROMPT_LIBRARY.md` (Section 5) | `rules/council_rules.v0.41.md`, `app/app.js:425`, `app/app.js:790` |
| Keep | `/home` `/armory` `/bridge` `/log` 固有レイアウト | Keep (Do Not Harvest) | N/A | アプリ固有UI |
| Keep | 趣味カード/枝分岐の語彙・辞書 | Keep (Do Not Harvest) | N/A | ドメイン固有モデル |
| Duplicate (Existing) | Manual AI Bridge | Record Only (No New Harvest) | 既存資産参照のみ | `SEED_v5.1/README.md:20` |
| Duplicate (Existing) | Weapon Selector mapping (Serverless -> Manual AI Bridge) | Record Only (No New Harvest) | 既存資産参照のみ | `SEED_v5.1/ops/WEAPON_SELECTOR.md:25` |

### Notes on Deletion Risk
本ケースの方針は「削除ではなく追記」。既存機能を削除・縮小すると、参照切れと学習履歴断絶が発生します。  
置換が必要な場合は `Deprecated` 注記 + `Superseded by ...` を採用し、CHANGELOGに明示します。
