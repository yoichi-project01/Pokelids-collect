# ポケふた収集 (pokelids-collect)

「ポケふた」（ご当地ポケモンマンホール）を実際に訪問して写真を撮り、収集記録として残すアプリ。

- **API**: Express + Prisma (PostgreSQL)
- **モバイル/Web**: Expo Router（React Native）。Web版は静的書き出しをAPIサーバーが配信
- **共通パッケージ**: 型定義・座標計算などをAPI/モバイルで共有

## モノレポ構成

```
apps/
  api/       Express API サーバー（Prisma、ETL、写真アップロード）
  mobile/    Expo Router アプリ（iOS/Android/Web）
packages/
  shared/    API/モバイル共通の型定義・関数（要ビルド、下記参照）
```

## セットアップ

### 前提

- Node.js 20.x
- Docker / Docker Compose（本番相当の起動に使用）
- PostgreSQL（Dockerで起動する場合は不要）

### 環境変数

`.env.example` を `.env` にコピーして値を設定してください。

```sh
cp .env.example .env
```

主な変数:

| 変数                                       | 説明                                       |
| ------------------------------------------ | ------------------------------------------ |
| `DATABASE_URL`                             | PostgreSQL接続文字列                       |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT署名用シークレット                      |
| `PHOTO_TOKEN_SECRET`                       | 写真URLの短命署名トークン用シークレット    |
| `CORS_ORIGIN`                              | 許可するオリジン（本番は自ドメインに限定） |
| `PHOTO_STORAGE_PATH`                       | 写真の保存先パス                           |
| `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` | `npm run seed` で作成する管理者アカウント  |
| `ETL_CONTACT_EMAIL`                        | `etl/scrape.ts` のUser-Agentに含める連絡先 |

### 依存パッケージのインストール

```sh
npm install
```

### `packages/shared` のビルド

`apps/api` と `apps/mobile` は `@pokelids/shared` のビルド済み `dist/` を参照します。依存する関数を追加・変更した際は必ずビルドし直してください。

```sh
npm run build --workspace=@pokelids/shared
```

## 開発

```sh
# API（http://localhost:3000）
npm run dev --workspace=@pokelids/api

# モバイル/Web（Expo）
npm run start --workspace=@pokelids/mobile
```

### 型チェック・Lint・整形

```sh
npm run typecheck
npm run lint
npm run format       # 自動整形
npm run format:check # 整形が必要な箇所のチェックのみ
```

## データ投入（ETL）

ポケふたのマスタデータを [local.pokemon.jp](https://local.pokemon.jp) から取得します。

```sh
npm run etl:scrape --workspace=@pokelids/api
```

公式画像は取得時に `PHOTO_STORAGE_PATH/official` にダウンロードされ、以後は自前配信（`/api/official-images/`）されます。

## 本番起動（Docker Compose）

```sh
docker compose up -d --build
```

- APIコンテナは非rootユーザー（`node`）で実行されます
- DB・写真データのホストパスは `docker-compose.yml` の `POSTGRES_DATA_HOST_DIR` / `PHOTO_STORAGE_HOST_DIR` で変更可能（未設定時のデフォルトは現行運用パス）

### バックアップ

`scripts/backup.sh` がDB（`pg_dump`）と写真ディレクトリ（`rsync`）を同一マシンの別ディレクトリ（`/home/setoyama/pokelids-backups/`）に日次バックアップします（cron登録済み、14日分保持）。ディスク/RAID全体の物理障害には対応しないため、より高い可用性が必要な場合は別マシン・オフサイトへのコピーを検討してください。

## ライセンス

MIT（[LICENSE](./LICENSE) 参照）。ただしポケふたの画像・データ等の著作権は株式会社ポケモン等の権利者に帰属し、本ライセンスの対象外です。
