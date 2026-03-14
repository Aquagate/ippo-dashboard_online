# SEED v5.3: Self-Evolving Weaponry Guide
**Concept**: "Resilient Butterfly (強靭な蝶)"

## 🦋 概要: なぜ SEED v5.3 なのか？
SEED v5.3 は、単なるテンプレートではありません。**「プロジェクトの生存率」を最大化するための、自己進化する武器庫**です。

v5.3は、v4で確立された **Rubric Driven Development (RDD)** による「品質の自動担保」を前提としつつ、さらに**「変化への適応（Resilience）」**と**「未来予測（Simulation）」**を実装しました。

### 🌍 世界観 (The Philosophy)
> *"Gravity pulls everything down to chaos. SEED is your Antigravity."*
> 重力（エントロピー）は、全てのソフトウェアを陳腐化と混沌へ引きずり込む。SEEDは、それに抗うための**「反重力装置」**である。

SEED v5.3 の根底には、3つの強烈な思想が流れています。

1.  **Weaponized Intelligence (知性の武器化)**
    「ツールに使われるな、武器として振るえ」。
    SEEDは単なる便利セットではありません。プロジェクトの生存競争に勝つために、自ら必要な機能を選び (`Weapon Selector`)、不要なものを切り捨てる「意思」を持った武器庫です。

2.  **Resilient Butterfly (強靭な蝶)**
    「変化しないものは滅びる」。
    完璧な設計図よりも、変化への適応能力を重視します。過去の文脈を理解し (`Trajectory Analysis`)、データ不整合による"死"を自己修復する (`Strict Sync`)、しなやかな生命体のようなシステムを目指します。

3.  **Entropy Resistance (エントロピーへの抵抗)**
    「作りっぱなしは罪である」。
    Rubric Engine による常時監視 (`RDD`) は、開発者が怠惰になっても品質を落とさないための「安全装置」です。SEEDを使うことは、無秩序へ向かう力に抗い、常に洗練された状態を保つことを意味します。

---

## ⛩️ The 3-Layer Drive System (3層駆動アーキテクチャ)
SEED v5.3 の最大の特徴は、3つの異なる「駆動エンジン」を**直列に積層**していることです。
これらを混ぜるとプロジェクトは破綻します。順序を守って積み上げることで、最強の開発体制が完成します。

### 1. PDRD: 思想駆動 (Philosophy-Driven Relay Development)
**「意思決定の“憲法”」**
- **役割**: 判断軸（何が正義か）を固定する。
- **成果物**: `SEED_GUIDE.md`, `Project Plan`, DoD (完了の定義)。
- **Rule**: 思想がブレると全タスクが無意味になるため、これは**「短く・硬く」**固定します。

### 2. RDD: ルーブリック駆動 (Rubric-Driven Development)
**「品質と進化の“採点表”」**
- **役割**: 出来を“採点可能”にし、改善を“測定可能”にする。
- **成果物**: `Rubric Engine` (Score), テストカバレッジ, `npm test` 結果。
- **Rule**: 「気分」で評価せず、quote完全一致やschema検証など、**「数値」**でゲートを作ります。

### 3. AIDD: AI駆動 (AI-Driven Development)
**「実装・生成の“エンジン”」**
- **役割**: PDRDで決めたことを、RDDに通るように、超高速で実装する。
- **成果物**: 生成コード, リファクタリング, 雑務処理。
- **Rule**: 人間が手で書くよりも、AIに「指示→生成→検証」のループを回させる方が速く、正確です。

---

### ⚠️ The Golden Stack (黄金の積層)
この3つは**同列ではありません**。以下のように積み上げてください。

> **PDRD (憲法)** が「何を作るべきか」を決め、
> **RDD (採点表)** が「良くなったか」を測り、
> **AIDD (エンジン)** が「現物」を作る。

| 観点 | PDRD (思想) | RDD (ルーブリック) | AIDD (AI) |
| :--- | :--- | :--- | :--- |
| **駆動力** | 判断軸（憲法） | 評価基準（採点表） | 生成能力（実装速度） |
| **得意** | 方向性の統一、“迷子”防止 | 品質の安定、回帰の検知、改善の再現性 | スピード、反復、実装量 |
| **苦手** | 曖昧だと全部破綻 | 基準が雑だと“点取りゲーム”化 | 検証不足だと捏造と事故が量産 |
| **主担当** | 人間 (AXIS) | 測定システム (PROBE) | AI & エンジニア (FORGE) |

---

## 💎 Rubric Driven Development (RDD) の詳細
3層の中でも、SEEDの中核（心臓部）となるのが **RDD** です。
AI (AIDD) が暴走しないよう、常に RDD が監視し、PDRD の思想に合致しているかを判定します。

1.  **Generate**: "High-Entropy AI" (Gemini/GPT) が、創造的なアイデアやコードを出す。 (AIDD)
2.  **Evaluate**: "Low-Entropy Judge" (Local/Strict AI) が、冷徹に採点する。 (RDD)
3.  **Gate**: スコアが基準（例: 95点）未満なら、ユーザーに出す前に棄却または再生成される。

このループにより、SEED v5.3 は「運用するほどに賢く、行儀良くなる」特性を持ちます。

---

## 🛡️ 5つの柱 (The 5 Pillars)

### 1. Rubric Engine (品質保証) - **The Heart**
**「品質を数値で管理せよ」**
v5.3 でも変わらぬ最重要エンジンです。
- **Groundedness**: 事実に基づいているか？（ハルシネーションの排除）
- **Safety**: 倫理的に問題ないか？
- **Tone**: ユーザーに適切な態度か？
これらが担保されて初めて、シミュレーションや自動化が許されます。

### 2. Simulation First (未来予測)
**「RDDによる事前検証」**
コードを書く前に、AIを使ってシミュレーションを行います。この時も RDD が作動し、シミュレーション結果の妥当性をAIが自己評価します。
- **Command**: `npm test`
- **Impact**: 「間違った仕様」が実装されるのを防ぎます。

### 3. Weapon Selector (装備選択)
**「必要な武器だけを持つ」**
Rubric の評価に基づき、プロジェクトのリスクや規模に合わせて最適な機能セットを選定します。

### 4. Strict Sync (絶対整合性)
**「ゾンビを蘇らせない」**
分散開発や、複数デバイスでの作業において、削除したはずのデータが復活する「ゾンビ現象」を完全に排除します。
- **Mechanism**: 論理削除フラグ + 厳格なタイムスタンプ比較 (`ops/snippets/strict_sync_logic.js`)

### 5. Hybrid Intelligence (ハイブリッド知能)
**「安く、速く、賢く」**
開発フェーズではローカルの Mock AI (`LLM_MOCK=true`) を使い、コストゼロで高速にループを回します。本番では高度なクラウドAIに切り替え、クリエイティブな能力を発揮させます。

---

## 🔄 進化プロトコル (Evolution Protocol)

### Phase 1: Define & Select (PDRD Phase)
1.  **Define**: 何を作るか決める。
    > **Rule 1**: 思想（憲法）を勝手に変えない。変えるなら版を上げる。
2.  **Select**: 戦うための武器を選ぶ (`ops/WEAPON_SELECTOR.md`)。

### Phase 2: Simulate (RDD Phase)
3.  **Plan**: 計画を立てる。
4.  **Simulate**: シナリオテストを実行する。
    > **Rule 2**: ルーブリックの指標は“本文に照合できるもの”を優先する（quote完全一致、schema pass、coverage）。

### Phase 3: Build & Verify (AIDD Phase)
5.  **Develop**: 実装する。
    > **Rule 3**: AIの出力は“ゲートを通ったものだけ”採用する（validate→repair→revalidate）。
6.  **Test**: `npm test` で動作保証。

### Phase 4: Evolve
7.  **Analyze**: 運用データを分析し、自身を進化させる。

---

## 👥 チーム役割 (The Hexagon)

| Role | Name | v5.3 RDD Responsibility |
|---|---|---|
| **PROBE** | Measure | **Rubric Score の監視役 (最重要)**。品質が落ちていないか常に目を光らせる。 |
| **AXIS** | Decide | スコアに基づき、採用/却下を決定する。 |
| **FORGE** | Build | Rubric を通過するクオリティの実装を行う。 |
| **FRAME** | Report | シミュレーション結果を正しく伝える。 |
| **LEDGER** | Organize | データの整合性を保つ。 |
| **DELIVER** | Operate | ユーザーに価値を届ける。 |

---
**Powered by Antigravity Agent & SEED Ecosystem**
