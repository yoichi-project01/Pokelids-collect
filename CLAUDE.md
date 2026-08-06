# ポケふたコレクト

Expo Router (web/native共用) + Express + Prisma + PostgreSQL のモノレポ。
Web版は同じコードから `output: "static"` で生成し、`apps/api/public` から配信する。

残タスクの詳細は `TASKS.md`、優先順位と設計方針は `ROADMAP.md` にある。
**必要になった時点で読むこと**（毎回読み込む必要はない）。
何をどの順で作るかで迷ったら `ROADMAP.md` の判断を優先する。

## 完了前に必ず通すこと

```bash
npx prisma generate --schema apps/api/prisma/schema.prisma
npm run typecheck
npm run lint
npx prettier --check .
npm run test
```

`prisma generate` を先に実行しないと typecheck が落ちる。npm workspaces では
`@prisma/client` がルートに巻き上げられる一方スキーマは `apps/api/prisma/` にあるため、
postinstall がスキーマを見つけられず型が生成されないまま `tsc` が走る。

## 規約

- 「なぜその値・その方法にしたか」が非自明な箇所には必ずコメントを残す。
  既存コードはこの方針で書かれているので、それに合わせること。
- ロジックは `packages/shared` に切り出せないか検討し、切り出したものは vitest でテストする。
- Prisma スキーマ変更時は `prisma migrate dev --name <説明的な名前>` で
  マイグレーションを生成し、**生成された SQL を目視確認する**。
  既存データを壊す変更（列削除・NOT NULL 追加）は特に慎重に。
- コミットは1タスク1コミット、メッセージは日本語で「何を・なぜ」。
- 既存の設計と矛盾する箇所を見つけたら、実装を進める前に指摘すること。

## セキュリティ上の不変条件（変更しないこと）

- 写真エンドポイントの所有者チェックは **403 ではなく 404** を返す。存在を隠すため。
- トークンは必ずハッシュで保存する（`RefreshToken.tokenHash` の方式に従う）。
  トークン比較は `timingSafeEqual` を使う。
- アップロード画像は MIME ホワイトリストで検証し、拡張子は**申告値ではなく MIME から導出**する。
  配信時は `X-Content-Type-Options: nosniff` を付ける。
- sharp の再エンコードは EXIF 除去も兼ねている。この処理を外さないこと。
- 認証系のレート制限は `/login` と `/register` のみに適用する。
  `/me` と `/refresh` は通常利用で頻繁に呼ばれるため対象外。

## このリポジトリ特有の落とし穴

- **`react-native-web` の `Alert.alert` は no-op。** Web版では何も表示されない。
  確認ダイアログは `src/lib/confirm.ts` を使う。
- **helmet のデフォルト CSP は `script-src 'self'`。** インラインスクリプトは
  ブロックされるので、Web に JS を足すときは外部ファイルにする
  （`public/sw-register.js` がその例）。
- **`FlatList` の `numColumns` + `flex: 1` は最終行が引き伸ばされる。**
  行数が列数の倍数でないと最後のカードが数倍幅になる。
- **`depends_on: condition: service_healthy` は `docker compose up` 時にしか効かない。**
  ホスト再起動時には順序が保証されない。
- **`app.get('*')` の SPA フォールバックが全 URL を拾う。**
  `express.static` の `extensions: ['html']` がないと静的 HTML に到達しない。
- **アクセストークンは1時間で失効する。** 401 時の自動リフレッシュは
  `src/lib/api.ts` に実装済み。並列リクエストで多重ローテーションが起きないよう
  進行中の Promise を共有しているので、この構造を壊さないこと。

## 外部データ

ポケふたのマスタデータは `apps/api/etl/scrape.ts` が `local.pokemon.jp` から取得する。
セレクタ依存なので公式サイトのリニューアルで壊れる。ETL を触るときは
件数の安全装置（前回比を下回ったら中断）を必ず維持すること。
