# Intake Log (受付ログ)

## 基本情報
- **日付**: {{date}}
- **依頼者**: {{requester}}
- **部署/役割**: {{role}}
- **チャネル**: {{channel}} (Slack/Form/Email)

## 依頼内容
### 要約
{{summary}}

### 詳細
{{details}}

### 添付ファイル
- [ ] なし
- [ ] あり: {{attachments}}

## トリアージ結果 (AI Suggestion)
以下の候補から最も適切なものを選択してください。

| 候補 | 業務ID | 業務名 | 確信度 |
| :--- | :--- | :--- | :--- |
| 1 | {{suggest_1_id}} | {{suggest_1_name}} | {{suggest_1_conf}}% |
| 2 | {{suggest_2_id}} | {{suggest_2_name}} | {{suggest_2_conf}}% |
| 3 | {{suggest_3_id}} | {{suggest_3_name}} | {{suggest_3_conf}}% |

- **確定業務ID**: {{confirmed_task_id}}

## 不足情報 (Missing Info)
- [ ] なし（着手可）
- [ ] あり:
  - {{missing_info_1}}
  - {{missing_info_2}}

---
**Status**: `RECEIVED` -> `TRIAGED`
