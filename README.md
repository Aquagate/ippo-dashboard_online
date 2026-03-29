# Ippo Dashboard v2.1

> **「未来シミュレーションで自己理解を深める」**
> 日々の小さな一歩（Ippo Log）から、多元的な未来（世界線）を可視化するパーソナルダッシュボード。

## 🌟 Concept
日々の一歩（Ippo Log）を入力とし、AIが半年先の「多元的な未来（世界線）」をシミュレーションするダッシュボードです。
「未来を当てる」ことではなく、「未来の選択肢を増やす」ことを目的としています。

## 🚀 Key Features
- **Future Lab**: 3つの世界線 (Baseline, Leap, Guardrail) を生成し、行動による未来の変化を可視化。
- **Safe AI Bridge**: ユーザーを脅かさず、前向きな行動変容を促す心理的安全性重視のAI設計。
- **Bento Grid UI**: 没入感のあるGlassmorphismデザインを採用したモダンなインターフェース。

## 📦 セットアップ

### 前提条件
- Node.js 20系

### インストール & 起動

```bash
# 依存関係のクリーンインストール (node_modules がある場合は一旦削除推奨)
npm ci

# 開発サーバ起動
npm run dev
```

ブラウザで `http://localhost:5173` を開いてください。
※ `dist/` ディレクトリはビルド成果物のため Git 管理外です。本番相当を確認する場合は `npm run build` を実行してください。

ブラウザで `http://localhost:5173` を開いてください。

### その他のコマンド
| コマンド | 説明 |
|---|---|
| `npm start` | 開発サーバ起動（`npm run dev` と同じ） |
| `npm run build` | TypeScriptコンパイル + Viteビルド |
| `npm run preview` | ビルド成果物のプレビュー |

## 🛠️ Architecture
- **UI層**: Vanilla TypeScript + Chart.js
- **ストレージ**: IndexedDB（正）+ OneDrive追従同期
- **XSS対策**: DOMPurify
- 詳細は [docs/PROJECT_CONCEPT.md](./docs/PROJECT_CONCEPT.md) を参照。

## 🔒 セキュリティ
- APIキーやクライアントIDはコード/README/ログに直接記載しないこと。
- OneDrive設定はブラウザのlocalStorageに保存されます。

---
*End with a Seed.*
