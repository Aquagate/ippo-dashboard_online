# 趣味ブースト要塞（Hobby Fortress） v0.41

このリポジトリは、**Core Ledger（行動台帳 / 一歩ログの役割）**を中心に、趣味探索〜育成を「行動の連鎖」と「資産化」で回すための設計一式です。

## 重要な考え方（1行）
- ローカルは **保存・表示・ルールによる確定** を担当する
- LLMは **候補生成（提案）だけ** を担当する
- API連携なし前提で、LLMは **AIBridge（JSONコピペ）** で接続する
- 機能増殖しても迷子にならないよう **Codex（図鑑）** で参照可能にする（推薦はしない）

## 入口
- `concept/00_OVERVIEW.md`：全体像
- `concept/STEP01.md`〜`concept/STEP17.md`：思想と仕様のステップ分解
- `data/ledger/`：イベント台帳（JSONL、追記のみ）
- `data/catalog/`：ノード/カード/相性/勲章などの辞書
- `schemas/`：JSON Schema（AIBridgeや台帳の検証に使う）
- `bridge_packets/`：AIBridgeのサンプル入出力（request/response）
- `rules/`：憲法（暴走防止の確定ルール）
- `ui_specs/`：最低限の画面と導線

## 実装順（推奨）
1. Ledger（追記のみ） + Catalog読込 + Armory（武器庫）で実行→台帳追記
2. Council（毎朝の配給）をAIBridgeで接続（JSON request/response）
3. Foundry（週1鍛造）でカードが自己更新
4. Codex（図鑑）で巨大化しても迷子にならない

## ライセンス
この内容は会話ベースの設計案です。社内外で利用する場合は適切に調整してください。
