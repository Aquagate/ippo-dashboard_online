# デプロイメントガイド (汎用テンプレート)

このガイドは、**SEED v4** で構築されたアプリケーションをデプロイするための標準手順です。

## 1. 前提条件
- Node.js v18 以上
- npm v9 以上
- (任意) Docker / PM2

## 2. インストール手順

1. ファイルを本番サーバーへコピーします:
   ```bash
   /opt/your-app-name/
   ├── data/          # 読み書き権限 (Read/Write) を確認してください
   ├── ops/
   ├── public/
   ├── package.json
   └── .env           # .env.example から作成
   ```

2. 本番用依存パッケージをインストールします:
   ```bash
   npm install --production
   ```

## 3. 設定 (.env)

`.env.example` を元に `.env` ファイルを作成してください:

```ini
PORT=8080
NODE_ENV=production
LLM_ENDPOINT=http://host.docker.internal:11434/api/generate
```

> **セキュリティ上の注意**: `NODE_ENV=production` を設定すると、自動的に **Secure Cookies** (HTTPS必須) と **HttpOnly** モードが有効になります。

## 4. サーバーの起動

### PM2 を使用する場合 (推奨)
```bash
npm install -g pm2
pm2 start ops/server.js --name "your-app-name"
pm2 save
```

### 直接起動する場合
```bash
npm start
```

## 5. セキュリティ・チェックリスト
- [ ] **SSL/TLS**: アプリの前段に Nginx やロードバランサを配置し、HTTPS 化してください (Secure Cookieに必須)。
- [ ] **FW (ファイアウォール)**: ポート 8080 への直接アクセスを遮断してください。
- [ ] **バックアップ**: `data/` ディレクトリの定期バックアップを設定してください。
