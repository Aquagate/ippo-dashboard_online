# PROJECT_HUB_CASE_STUDY.md

> **Project**: Project Hub v2.0  
> **Date**: 2026-02-10  
> **Theme**: Hobby Project Ecosystem (趣味プロジェクト循環)

---

## 1. Overview

### Purpose
趣味プロジェクト管理に特化したPWA。「締切駆動」ではなく「やりたさ駆動」で動く、プレッシャーフリーのプロジェクト管理を実現。

### Key Outcomes
- **Heat System**: 熱量(1-3)による優先度管理
- **Showcase Loop**: 完成→殿堂入り→AIアイデア→新プロジェクトの循環
- **Auto-Sync UX**: ボタン削減による同期UI簡略化
- **Device-Adaptive UI**: モバイル入力特化 / PC一覧特化

---

## 2. Key Challenges & Solutions

### Challenge 1: 完成後放置問題
**Problem**: プロジェクトが「完了」になっても、そのまま忘れ去られる。

**Solution**: Showcase → AI Idea Loop
```javascript
// 殿堂入りプロジェクトからAIプロンプト生成
function generateIdeaPrompt() {
  const showcase = getShowcaseProjects();
  return `これらの完成プロジェクトを見て、次のアイデアを3つ提案してください...`;
}
```

### Challenge 2: 締切ベースが合わない
**Problem**: 趣味プロジェクトに「期限」は馴染まない。

**Solution**: Heat System
```javascript
// 熱量でソート（やりたい順）
function sortByHeat(projects) {
  return projects.sort((a, b) => b.heat - a.heat);
}

// 休日フィルター（高熱量のみ）
function getWeekendProjects(projects) {
  return projects.filter(p => p.heat >= 3);
}
```

### Challenge 3: 同期UIが複雑
**Problem**: サインイン/サインアウト/読込/保存... ボタンが多すぎる。

**Solution**: Auto-Sync Default
- 起動時: 自動サインイン + 自動読込
- 変更時: 自動保存 + 自動アップロード
- 手動ボタン: 詳細設定に隠す

---

## 3. Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend | なし (Static) | GitHub Pages対応、シンプル運用 |
| Storage | LocalStorage + OneDrive | オフライン対応 + クラウドバックアップ |
| AI Integration | Manual Bridge | ChatGPTにコピペ、API不要 |
| Auth | Entra ID | 個人Microsoft垢で即利用可 |

---

## 4. Unsolved Issues

- [ ] **スマートタグ提案**: タイトル/概要からタグを自動推薦（NLP必要）
- [ ] **プロジェクト間リンク**: 「前作の続き」関係を表現
- [ ] **PWA完全対応**: Service Worker実装、オフライン編集
- [ ] **Heat自動減衰**: 長期間触らないプロジェクトの熱量を下げる

---

## 5. Harvested to SEED v5.1

| Asset | Destination |
|-------|-------------|
| Heat System | `ops/snippets/hobby_patterns.md` |
| Showcase Loop | `ops/snippets/hobby_patterns.md` |
| Auto-Sync UX | `ops/snippets/ui_patterns/auto_sync.md` |
| Dark Slate Theme | `ops/snippets/ui_patterns/dark_slate.css` |
| AI Idea Prompt | `ops/PROMPT_LIBRARY.md` Section 4 |
| Weekly Reflection | `ops/PROMPT_LIBRARY.md` Section 4 |

---

> **"End with a Seed."** - 完成から次の種が生まれる。
