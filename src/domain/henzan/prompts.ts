// ===== 編纂室 AIブリッジ プロンプト生成モジュール =====
// 一歩ログ（抽出対象）と既存資産リストを受け取り、
// LLMに渡すためのプロンプトを生成する。

import { ASSET_TYPE_ICONS, type HenzanAsset } from './schema';
import type { Entry } from '../schema';

/** プロンプトの基本ルール（共通） */
const COMMON_RULES = `
## 基本ルール
- あなたの出力は必ず指定された出力スキーマ(JSON)に厳密に従ってください。前置きや解説は一切不要です。
- 根拠ログの引用 (evidence_quotes) は一歩ログの原文をそのまま切り出してください（捏造禁止）。
- 抽象的すぎる名前は禁止です（「成長力」「問題解決力」「継続力」など）。
- 具体的な行為、実装された導線・道具、再現可能な経験・理解を優先してください。
- 以下の「禁止語」を含む候補は生成しないでください。

## 禁止語リスト
なんか, 嬉しい, そういえば, 一歩ログ, 数知れん, あれ, これ, それ, いい感じ, ちょっと, 多分
`;

/** Discovery (新規資産発見) モードのプロンプト */
export function generateDiscoveryPrompt(recentEntries: Entry[], existingAssets: HenzanAsset[], windowDays: number): string {
    const logSummary = formatEntries(recentEntries);
    const assetList = formatAssets(existingAssets);

    return `# 編纂室 AIブリッジ: Discoveryモード (過去 ${windowDays}日)

あなたの役割は、日々の行動記録（一歩ログ）を分析し、まだ資産化されていない【新規の資産候補】を発見することです。

${COMMON_RULES}

## Discovery特別ルール
- 主な目的は「新しく生まれた技能・環境・知見」を拾い上げることです（operation: "create"）。
- 既存資産と類似・重複するものは拾わないでください。それはCurateモードの仕事です。
- 各ログIDと紐づけて、なぜそれを独立した資産とみなすか明確な理由を提示してください。
- 提案は1〜5件までとします。

## 既存資産リスト（重複を避けるための参考）
${assetList}

## 抽出対象の一歩ログ
${logSummary}

## 出力Jsonスキーマ
\`\`\`json
{
  "run_meta": {
    "prompt_version": "discovery-v1",
    "mode": "discovery",
    "window_days": ${windowDays}
  },
  "proposals": [
    {
      "operation": "create",
      "target_asset_id": null,
      "merge_target_id": null,
      "candidate": {
        "name": "資産名",
        "type": "技能|環境|知見|進行資産",
        "scale": "小",
        "summary": "資産の短い要約"
      },
      "evidence_log_ids": ["entry_123", "entry_456"],
      "evidence_quotes": ["ログ内の証拠フレーズ1", "証拠フレーズ2"],
      "reason": "なぜこれを新規資産として提案するかの理由",
      "confidence": "高|中|低"
    }
  ]
}
\`\`\`
`.trim();
}

/** Curate (更新・統合) モードのプロンプト */
export function generateCuratePrompt(recentEntries: Entry[], existingAssets: HenzanAsset[], windowDays: number): string {
    const logSummary = formatEntries(recentEntries);
    const assetList = formatAssets(existingAssets);

    return `# 編纂室 AIブリッジ: Curateモード (過去 ${windowDays}日)

あなたの役割は、日々の行動記録（一歩ログ）と【既存資産】を見比べ、既存資産の「更新」や「統合」および「証拠の追記」を行うことです。

${COMMON_RULES}

## Curate特別ルール
- 既存資産のアップデート（operation: "update_existing"）や、名前の変更（operation: "rename_existing"）を提案してください。
- 複数の既存資産が実は同じ概念を指している場合は、片方への統合（operation: "merge_into_existing"）を提案してください。
- 新規の資産（create）は提案しないでください。必ず target_asset_id または merge_target_id を指定します。
- 提案は1〜5件までとします。

## 既存資産リスト
${assetList}

## 抽出対象の一歩ログ
${logSummary}

## 出力Jsonスキーマ
\`\`\`json
{
  "run_meta": {
    "prompt_version": "curate-v1",
    "mode": "curate",
    "window_days": ${windowDays}
  },
  "proposals": [
    {
      "operation": "update_existing | merge_into_existing | rename_existing",
      "target_asset_id": "対象の資産ID",
      "merge_target_id": "統合先資産ID (mergeの場合のみ指定)",
      "candidate": {
        "name": "変更後の名前(変更がない場合は元の名前)",
        "summary": "変更後の要約"
      },
      "evidence_log_ids": ["entry_789"],
      "evidence_quotes": ["証拠フレーズ"],
      "reason": "更新/統合/改名する理由",
      "confidence": "高|中|低"
    }
  ]
}
\`\`\`
`.trim();
}

/** Promote (昇格考察) モードのプロンプト */
export function generatePromotePrompt(recentEntries: Entry[], existingAssets: HenzanAsset[], windowDays: number): string {
    const assetList = formatAssets(existingAssets);

    // Promoteは長期間の文脈や既存資産の「小」レイヤーの相関を見るため、ログより資産リストが主軸
    return `# 編纂室 AIブリッジ: Promoteモード

あなたの役割は、【既存資産リスト】を俯瞰し、小規模な資産の組み合わせから、一つ上の階層（中規模・大規模）へと昇格できそうな概念を見つけることです。

${COMMON_RULES}

## Promote特別ルール
- 現在「小」となっている複数の資産が連携して実用効果を生んでいる場合、それを「中」規模として昇格（operation: "promote_scale"）するか、新たな「中」規模資産の創出（operation: "create" かつ scale: "中" にて related_asset_ids に小資産を紐付ける形式）を提案してください。
- 過去の細かいログよりも、資産同士の相乗効果にフォーカスしてください。
- 提案は1〜3件に絞ってください。

## 既存資産リスト
${assetList}

## 出力Jsonスキーマ
\`\`\`json
{
  "run_meta": {
    "prompt_version": "promote-v1",
    "mode": "promote",
    "window_days": ${windowDays}
  },
  "proposals": [
    {
      "operation": "promote_scale",
      "target_asset_id": "昇格対象の既存資産ID",
      "merge_target_id": null,
      "candidate": {
        "scale": "中",
        "name": "必要に応じてより上位概念の名前に変更",
        "summary": "どのように小規模資産が結合・成熟したかの要約"
      },
      "evidence_log_ids": [],
      "evidence_quotes": [],
      "reason": "昇格を提案する戦略的理由",
      "confidence": "中"
    }
  ]
}
\`\`\`
`.trim();
}

// ===== 内部ヘルパー =====

function formatEntries(entries: Entry[]): string {
    if (entries.length === 0) return 'なし';
    return entries.map(e => `- [ID:${e.id}] [${e.date}] [${e.category}] ${e.text}`).join('\n');
}

function formatAssets(assets: HenzanAsset[]): string {
    if (assets.length === 0) return 'なし';
    return assets.map(a => 
        `- [ID:${a.id}] ${ASSET_TYPE_ICONS[a.type]} ${a.type}: ${a.name}（${a.scale}）[${a.status}]\n  要約: ${a.summary}`
    ).join('\n');
}
