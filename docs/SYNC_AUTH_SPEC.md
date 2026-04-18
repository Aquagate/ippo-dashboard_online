# OneDrive 同期・認証 仕様書

> 最終更新: 2026-04-19  
> 対象コード: `src/services/sync/`, `src/app/bootstrap.ts`, `src/ui/components/sync*.ts`

---

## 設計原則

### 1. オフラインファースト
- アプリは**認証・同期の有無に関わらず常に即座に起動**する。
- 認証が必要な場合もアプリの起動をブロックしない。
- ローカルデータ（IndexedDB）が常にマスターであり、同期は「便利な追加機能」として動作する。

### 2. リダイレクト認証統一
- 認証フローは**リダイレクト方式（`loginRedirect`）に統一**。
- ポップアップ方式（`loginPopup`）は使用しない。
  - 理由: スマホブラウザ（Safari / Chrome Mobile）がポップアップをブロックし、`no_token_request_cache_error` を引き起こすため。
- リダイレクト方式はPC・スマホ・タブレットすべてで統一的に動作する。

### 3. 自動トークン更新
- 初回サインイン後は、`offline_access` スコープによるリフレッシュトークンで**数ヶ月間、認証画面なしで自動更新**される。
- ユーザーが意識的に認証操作を行う必要がないのが正常状態。

---

## 認証フロー

### 初回サインイン

```
ユーザー操作（バナーの「サインイン」ボタン）
  → syncSignIn()
    → odSignIn()
      → acquireTokenSilent() 失敗（アカウント未登録）
      → ssoSilent() 失敗（Microsoftセッションなし）
      → loginRedirect() ← ページ遷移が発生
        → Microsoft 認証画面
          → ユーザーがサインイン
            → アプリにリダイレクト
              → bootstrap() → handleAuthRedirect()
                → odEnsureMsal() → handleRedirectPromise()
                  → トークン取得成功
                  → loginHint を localStorage に保存
                  → URLクリーンアップ（code= パラメータ除去）
```

### 2回目以降（自動ログイン）

```
アプリ起動
  → bootstrap() → handleAuthRedirect()
    → odEnsureMsal()
      → handleRedirectPromise() → null（リダイレクトなし）
      → getAllAccounts() → キャッシュ済みアカウント検出
  → syncAutoConnect()
    → odSignIn()
      → acquireTokenSilent() ← リフレッシュトークンで自動更新
        → 成功（認証画面なし）✅
    → syncFetchAndMerge() → 同期完了✅
```

### セッション期限切れ時

```
定期同期（5分間隔）
  → syncFlush()
    → odGetToken()
      → acquireTokenSilent() 失敗
        → odAccount = null（セッション無効化）
        → throw "auth_session_expired"
    → syncManager が検知
      → UI通知「🔑 要・再認証」（バナー + ステータスインジケーター）
      → アプリの動作は継続（ローカルモード）

ユーザーがバナーの「再サインイン」をタップ
  → syncSignIn()
    → loginRedirect()（loginHint 付きでアカウント選択スキップ）
      → Microsoft 画面 → ワンタップで完了
        → アプリに戻り → 自動ログイン復帰✅
```

---

## MSAL 設定

```typescript
{
  auth: {
    clientId: "<Azure AD アプリの Client ID>",
    authority: "https://login.microsoftonline.com/{tenant}",
    redirectUri: "<アプリのURL>",
  },
  cache: {
    cacheLocation: "localStorage",       // ブラウザ再起動後もトークンを保持
    storeAuthStateInCookie: true,        // 一部ブラウザの互換性対策
  },
  system: {
    allowNativeBroker: false,            // WAM ブローカー無効化
  }
}
```

### スコープ

| スコープ | 用途 |
|---------|------|
| `Files.ReadWrite.AppFolder` | OneDrive の `/Apps/<AppName>/` 配下の読み書き |
| `offline_access` | リフレッシュトークンの取得（長期間の自動更新） |

### loginHint

- `localStorage` に `ippoOneDriveLoginHint_v1` キーで保存。
- 再認証時に `loginHint` パラメータとして渡すことで、アカウント選択画面をスキップする。
- ユーザー体験: Microsoft の画面が一瞬出て自動で戻る（ワンタップまたはゼロタップ）。

---

## 同期フロー

### データ構造

```
OneDrive: /Apps/<AppName>/IppoDashboard/ippo_data.json
ローカル: IndexedDB (ippoDataCache_v1)
```

### 同期トリガー

| トリガー | タイミング | 関数 |
|---------|-----------|------|
| 起動時 | `bootstrap()` 完了後 | `syncAutoConnect()` |
| データ変更時 | エントリ追加・編集・削除 | `syncFlush()` |
| 定期 | 5分間隔 | `startPeriodicSync()` |
| オンライン復帰 | `window.online` イベント | `syncFlush()` |
| タブ復帰 | `visibilitychange` イベント | `syncFlush()` |

### 同期ロジック（fetch-merge-push）

```
1. GET  リモートデータ + ETag
2. MERGE ローカルとリモートをマージ（ID + updatedAt ベース）
3. PUT  マージ結果を If-Match: ETag 付きで保存
4. 成功 → キューをクリア、ETag を更新
5. ETag不一致(412) → もう一度 GET → MERGE → PUT（1回リトライ）
```

### ETag 管理

- GETが成功 → `_odEtag = remote.etag`
- GETが404（ファイルなし） → `_odEtag = null`（stale etag を残さない）
- PUTが成功 → `_odEtag = 新しいETag`

> **注意**: `_odEtag = remote.etag || _odEtag` ではなく `_odEtag = remote.etag ?? null` を使用すること。  
> `||` だと空文字列や `null` の場合に古い stale etag が残り、404エラーの原因になる。

---

## タイムアウト・エラーハンドリング

### MSAL初期化タイムアウト

```typescript
const MSAL_INIT_TIMEOUT_MS = 10_000; // 10秒

// handleRedirectPromise() に Promise.race でタイムアウトを適用
// ネットワーク不通時の永久フリーズを防止
await Promise.race([
    odMsalApp.handleRedirectPromise(),
    timeoutPromise,   // 10秒後に null を返す
]);
```

### エラー分類

| エラー | 処理 | ユーザー体験 |
|-------|------|------------|
| `auth_session_expired` | UI通知のみ、アプリは継続 | バナー「再サインイン」表示 |
| `no_token_request_cache_error` | 吸収して無視、アプリ起動続行 | 何も起きない（次回アクセスで回復） |
| `etag_mismatch` (412) | 1回リトライ | 「競合解決中...」表示 |
| OneDrive 404 | etag リセット→新規作成 | 自動回復 |
| ネットワークエラー | ローカルモードで継続 | 「📱 ローカルモード」表示 |

---

## UI コンポーネント

### Sync Banner（`syncBanner.ts`）

ヘッダー直下に表示されるバナー。状態に応じて自動切り替え。

| 状態 | 表示 | アクション |
|------|------|-----------|
| `needs_signin` | ☁️「サインインすると同期されます」 | 「サインイン」ボタン |
| `needs_reauth` | 🔑「セッション切れ」 | 「再サインイン」ボタン |
| `syncing` | 🔄「接続中...」 | なし |
| `connected` | ✅「同期済み」→ 2秒後フェードアウト | なし |
| `offline` | 📱「ローカルモードで動作中」 | なし |

### Sync Status Indicator（`syncStatus.ts`）

右下フローティングインジケーター。同期状態を常時表示。
`authExpired` 状態の場合はクリックで再認証を開始できる。

---

## Azure AD アプリ登録の前提条件

1. **プラットフォーム**: SPA（Single Page Application）として登録
2. **リダイレクトURI**: デプロイ先のURL（例: `https://<user>.github.io/<repo>/`）を登録
3. **API アクセス許可**: `Files.ReadWrite.AppFolder`, `offline_access`
4. **サポートされているアカウントの種類**: 「任意の組織ディレクトリ内のアカウントと個人の Microsoft アカウント」

---

## ファイル構成

```
src/
├── services/
│   ├── sync/
│   │   ├── onedrive.ts      # MSAL初期化・認証・Graph API通信
│   │   └── syncManager.ts   # 同期ロジック・キュー・定期同期・コールバック管理
│   └── storage/
│       └── localStorage.ts  # 設定・キュー・キャッシュの永続化
├── app/
│   └── bootstrap.ts         # 起動シーケンス（認証リダイレクト処理含む）
└── ui/
    └── components/
        ├── syncBanner.ts     # ヘッダー直下の認証バナー
        └── syncStatus.ts     # 右下フローティングインジケーター
```
