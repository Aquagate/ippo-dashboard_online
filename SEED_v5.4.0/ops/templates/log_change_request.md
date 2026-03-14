# Change Request (差分PR)

**PRタイトル**: [SEED][task:{{task_id}}] {{change_summary}}

## 変更概要
### 変更タイプ
- [ ] ルール追加/変更
- [ ] チェックリスト修正
- [ ] テンプレート更新
- [ ] 判例（Exception Card）追加
- [ ] 業務フロー変更

### 対象
- **Task ID**: {{task_id}}
- **Module ID**: {{module_id}}

## 変更内容 (Before / After)
### 行うこと
{{what_to_change}}

### 理由
{{reason}}

## 期待する効果 (KPI)
- **ターゲットKPI**: {{target_kpi}} (例: KPI-1 裁定時間)
- **仮説**: {{hypothesis}}

## ロールバック条件
- 2週間経過して効果（{{success_criteria}}）が確認できない場合
- 現場からの問い合わせが {{threshold}} 件を超えた場合

## レビュー観点
- [ ] 既存ルールとの矛盾はないか
- [ ] 禁止情報（PII等）が含まれていないか
- [ ] 運用負荷が許容範囲内か
