# Hobby Project Patterns

> **When to Use**: 趣味・個人プロジェクト向けアプリで、「締切駆動」ではなく「やりたさ駆動」で動かしたい時。

## 🔥 Heat System (熱量システム)

### Concept
プロジェクトの優先度を「締切」や「重要度」ではなく、**ユーザーの熱量（ワクワク感）**で決定する仕組み。

### Implementation
```javascript
// Heat levels: 1(低) 2(中) 3(高)
const HEAT_LABELS = {
  1: '🔥',
  2: '🔥🔥', 
  3: '🔥🔥🔥'
};

// Heat-based sorting
function sortByHeat(projects) {
  return [...projects].sort((a, b) => 
    (parseInt(b.heat) || 2) - (parseInt(a.heat) || 2)
  );
}

// Weekend filter: high-heat active/idea projects
function getWeekendProjects(projects) {
  return projects.filter(p => 
    (p.status === 'active' || p.status === 'idea') &&
    (parseInt(p.heat) || 2) >= 3
  );
}
```

### UI Pattern
```html
<select id="heatInput">
  <option value="1">🔥 (低)</option>
  <option value="2">🔥🔥 (中)</option>
  <option value="3">🔥🔥🔥 (高)</option>
</select>

<option value="weekend">🔥 休みにやること</option>
```

---

## 🏆 Showcase Status (殿堂入り)

### Concept
「完了」の先にある特別なステータス。単に終わったのではなく、**成果として誇れる完成品**を祝う仕組み。

### Implementation
```javascript
const STATUS_LABELS = {
  idea: "アイデア",
  active: "進行中",
  stuck: "停滞",
  done: "完了",
  showcase: "殿堂入り",  // ← 追加
};

function getShowcaseProjects() {
  return state.projects.filter(p => 
    p.status === 'showcase' && !p.archived
  );
}
```

### Usage Flow
1. プロジェクト完成 → `done` に変更
2. 成果物を眺めて満足 → `showcase` (殿堂入り) に昇格
3. 殿堂入りプロジェクトを分析 → 次のアイデアへ

---

## 🎨 Design Philosophy

### 「プレッシャーなし」原則
- ❌ 締切厳守
- ✅ やりたい時にやる
- ❌ 生産性最大化
- ✅ 楽しさ最大化
- ❌ 効率的なタスク消化
- ✅ ワクワクするプロジェクト選び

### 循環システム
```
[アイデア] → [進行中] → [完了] → [殿堂入り]
     ↑                              ↓
     └──── [AIアイデア生成] ←───────┘
```
