# 改善指示書（Antigravity / Claude Code向け）
## Hobby Fortress v0.41 → “動くMVP” 実装ブリーフ

> 目的：このリポジトリ（ZIP展開物）を **“実際に回せる最小運用”** にする。  
> 方針：**ローカル完結**＋**AIBridge（JSONコピペ）**。LLMは候補生成のみ、確定は憲法（rules）で固定。

---

## 0. 前提（絶対に守る）
- **仕様の真実は `concept/` と `rules/` と `schemas/`** にある。勝手に改変しない。
- **LLM出力はJSONのみ**（自然文禁止）。`schemas/bridge_*.schema.json` に通ること。
- **意思決定コスト増やす改修は禁止**（“機能増殖”でUIや検索を盛りすぎない）。
- MVPでは **カード最大12枚ルール**、まずは `data/catalog/cards.v0.41.json` の **8枚**を使う。
- Ledger（台帳）は **追記のみ**。編集・削除はMVPでは不要。

---

## 1. MVPで提供すべき体験（ユーザー導線）
### /home（今日の配給）
- energy / mood / available_min / time_of_day（morning/noon/night）入力
- **Council request JSON生成ボタン**
- response JSON貼付欄（A/B/C）
- **autopick（原則A）を強調表示**
- 「実行」ボタン（最大1つ）  
  → 実行したカードに対応する **ledger_event** を作って追記（後述）

### /armory（武器庫）
- 8枚カードを棚（label）でフィルタ表示（回復/継続/探索/積み上げ/閉じ）
- 7/15/25の時間表示
- 1行命令（one_line_command）
- 実行ボタン → ledgerに追記

### /bridge（AIBridge）
- `council_request` の生成（サンプルに準拠）
- `council_response` の貼付→ **schema検証** → UI反映
- できれば `foundry_request` も生成だけ（MVP+α）

### /log（台帳）
- 今日/週の簡易一覧（時刻、タイプ、ref_id、duration、joy/strain）
- JSONLエクスポート（後述）

---

## 2. Ledger（台帳）の現実的な取り扱い（重要）
ブラウザだけでPC上の既存JSONLに“追記保存”は難しい。MVPは次のどちらかで実装する。

### 推奨：Fileピッカー方式（軽量で実用）
- 起動時に「ledger JSONLを選択」→読み込み→メモリ保持
- 実行で 1行（JSON）を末尾に追加
- 「Download ledger」ボタンで **更新済みJSONLをダウンロード**（上書き保存はユーザーが行う）

### 代替：localStorage方式（超簡単）
- localStorageにイベント配列として保持
- ExportでJSONL出力
- 後でOneDrive等に置く

どっちでもOK。ただし **ledger_event.schema.json に沿う**こと。

---

## 3. 技術選定（MVP向け）
「速さ優先」なので以下でいく：
- **Vite + TypeScript（またはJS）** のシンプルSPA
- JSON Schema検証は **Ajv**（ブラウザで動く）
- ルーティングは最小（Hash Routerでも可）

※凝ったUI/デザインは不要。「動く」「迷わない」を優先。

---

## 4. 実装タスク（順番固定）

### Phase0: 既存資産の読み込み
1. ZIP展開をリポジトリ化
2. `scripts/check_coverage.py` が通ること（変更で壊さない）
3. Catalog読み込みユーティリティを作る
   - `data/catalog/cards.v0.41.json`
   - `data/catalog/nodes.v0.41.json`
   - `data/catalog/branches.v0.41.json`
   - `data/catalog/synergy.v0.41.json`（MVPでは表示だけでもOK）

### Phase1: /armory（武器庫）
1. カード一覧表示（labelフィルタ）
2. 実行ボタン → `ledger_event` 生成
3. イベントに含める項目（最低限）
   - id（日時ベースでユニーク）
   - ts（ISO +09:00）
   - type（node_typeに合わせる：workshop/explore/guild/tool/spark）
   - ref_id（node_id）
   - branch_id（nodeから）
   - duration_min（カード値）
   - metrics（joy/strainは後入力でも可。MVPはnullでもいいが、できれば0-3で入力UI）

### Phase2: /bridge（AIBridge）
1. council_request生成
   - recent_events：直近N件（例：20件）
   - armory_cards：カードの要約（card_id/label/duration_min）
   - rules：max_recommendations=3 / execute_max=1 / autopick=A
2. response貼付 → Ajvで `bridge_council_response.schema.json` 検証
3. UIにA/B/C表示（Aを太字）

### Phase3: /home（配給→実行）
1. /bridgeの結果を /home に反映（または統合）
2. autopickに従って「実行候補」を1つ固定
3. 実行 → ledger追記
4. 実行後に “閉じ” を促す（card_Z1）  
   ※強制しない。おすすめ表示だけ。

### Phase4（MVP+α）: /log と簡易統計
- 今日の件数、週の件数
- branch別件数
- joy/strain平均（入力がある場合のみ）

---

## 5. 受入条件（これが通ればMVP合格）
- AIBridgeの **request/response がschema検証で通る**
- 武器庫のカードを1つ実行すると ledger_event が生成され、**JSONLとしてエクスポートできる**
- /homeで A/B/C が表示され、**autopickで迷わず1つ実行できる**
- ルール（最大3提案、実行1つ）が破れない

---

## 6. 禁止事項（地雷）
- Codex（図鑑）をMVPで作り込まない（棚→一覧→詳細の“棚”止まりならOK）
- カードを増やしすぎない（まず8枚で回せ）
- “便利そう”で検索やタグを盛りすぎない（迷いが増える）
- LLMに自然文を出させる（AIBridgeはJSONオンリー）
- 仕様を改変して辻褄合わせ（仕様に合わせて実装しろ）

---

## 7. LLMへの指示（そのまま貼れる短文）
- 「このリポジトリの `concept/` `rules/` `schemas/` を仕様として遵守し、Viteで最小SPAを作成。/home /armory /bridge /log を実装。AIBridgeはJSONコピペでschema検証（Ajv）を通す。LedgerはJSONLエクスポート可能に。」

---

## 8. 次版（v0.42）候補（MVPが動いた後にだけ）
- Foundry request/responseの実装（週1鍛造）
- Synergy Mapの “1日1回だけ連鎖提案” をUIに追加（7分推奨）
- 機能増殖アンロック（Loadout切替、Quick Draw）を慎重に追加

