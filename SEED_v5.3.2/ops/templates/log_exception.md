# Exception Log (例外裁定ログ)

## コンテキスト
- **例外ID**: {{exception_id}}
- **発生日**: {{date}}
- **対象業務**: {{task_id}} - {{task_name}}
- **担当者**: {{operator}}

## 例外事象
### 起きていること
{{issue_description}}

### なぜ標準で対応できないか
{{reason_for_exception}}

## 裁定 (Adjudication)
### 結論
- [ ] 特例承認
- [ ] 代替案提示
- [ ] 却下
- [ ] 保留（エスカレーション）

**決定内容**:
{{decision_detail}}

### 根拠 (Rationale)
{{rationale}}

### 条件 (Conditions)
- この例外を適用する条件: {{conditions}}

### 影響範囲 (Impact)
- 他の業務への影響: {{impact}}

## 今後の対策 (Feedback Loop)
- [ ] 今回限りの特例とする（一過性）
- [ ] ルールを変更・追加する（差分PRへ）
- [ ] 判例として記録する（Exception Cardへ）
