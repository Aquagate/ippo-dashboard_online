# Auto-Sync UX Pattern

> **When to Use**: クラウド同期機能で「ボタンが多すぎて分かりにくい」問題を解決したい時。

## 🎯 Problem

従来のクラウド同期UI:
```
[サインイン] [サインアウト] [設定保存] | [読込] [保存] | [Export] [Import]
```
→ ボタンが8個もあり、ユーザーが「今何を押すべきか」迷う

## ✅ Solution: Auto-Sync Default

### Design Principle
**「デフォルトで全部自動、手動は隠す」**

### Simplified UI
```
OneDrive 同期設定
├─ Client ID [          ]
├─ 保存先    [          ]
├─ [✅ 接続済み] 起動時に自動で読込・変更時に自動保存
├─ ▸ 詳細設定 (折りたたみ)
│   ├─ テナントID
│   ├─ Redirect URI
│   └─ [サインアウト] [Export] [Import]
└─ ▸ 動作履歴
```

### Implementation

#### HTML Structure
```html
<div class="sync-block">
  <h3>OneDrive 同期設定</h3>
  
  <!-- Essential fields only -->
  <div class="form-grid compact">
    <label>Client ID <input id="clientId" /></label>
    <label>保存先 <input id="path" /></label>
  </div>
  
  <!-- Status indicator -->
  <div class="sync-status-row">
    <span class="sync-badge">接続済み</span>
    <span class="sync-info">起動時に自動で読込・変更時に自動保存</span>
  </div>
  
  <!-- Hidden by default -->
  <details class="sync-advanced">
    <summary>詳細設定</summary>
    <!-- Advanced options -->
  </details>
</div>
```

#### CSS Styles
```css
.sync-status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.sync-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  background: rgba(16, 185, 129, 0.15);
  color: var(--accent-success);
}

.sync-badge.offline {
  background: rgba(239, 68, 68, 0.15);
  color: var(--accent-danger);
}

.sync-info {
  font-size: 0.7rem;
  color: var(--text-muted);
}
```

#### JavaScript Flow
```javascript
async function init() {
  // 1. Load settings
  loadSettings();
  
  // 2. Auto-sync on startup (if configured)
  if (settings.clientId && navigator.onLine) {
    await autoLoadFromCloud();
  }
}

function saveState() {
  // 1. Save to localStorage
  localStorage.setItem('data', JSON.stringify(state));
  
  // 2. Auto-upload to cloud (debounced)
  if (settings.autoSync) {
    debounce(uploadToCloud, 2000)();
  }
}
```

---

## 🔄 Sync State Management

| State | Badge | Behavior |
|-------|-------|----------|
| 未接続 | 🔴 offline | Client ID未設定 |
| 接続中 | 🟡 syncing | アップロード/ダウンロード中 |
| 接続済み | 🟢 connected | 自動同期稼働中 |
| オフライン | 🟠 offline | ネット切断、ローカル保存のみ |

---

## 💡 Key Insight

> **「ボタンを減らす = 機能を減らす」ではない**
> 
> 手動ボタンを削除するのではなく、**デフォルトを自動にして手動を隠す**ことで、
> シンプルなUIと完全な機能を両立できる。
