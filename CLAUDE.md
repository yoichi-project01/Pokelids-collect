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
- **`react-native-web` の `RefreshControl`（`FlatList`/`SectionList` の
  `refreshing`/`onRefresh`）は完全な no-op。** `View` を描画するだけでプルの
  ジェスチャー自体を実装していないため、Web版ではユーザーが指で引っ張っても
  何も起きない。ネイティブ版のみ機能する。Web版で「更新した」と伝えたいなら
  `useFocusEffect`（画面に戻ってきたら自動再取得）か、明示的な更新ボタンに
  頼ること。
- **`react-native-safe-area-context` を npm workspaces で二重インストールすると、Context ベースの上書きが黙って効かなくなる。**
  `apps/mobile/package.json` は `~5.7.0` を指定しているが、`expo-router` の
  peerDependency（`>= 5.4.0`、上限なし）を npm が自動解決する際に最新の
  `5.8.0` をルート `node_modules` に先に確定させ、`~5.7.0` はそれを満たせず
  `apps/mobile/node_modules` に別インスタンスとしてネスト installされる、
  という初回 `npm install` 時からの潜在バグがあった（2026-08-10発見）。
  `apps/mobile` 配下のコードは近い方の `apps/mobile/node_modules` を、
  `expo-router` に内蔵された `BottomTabView.js` はルートの `node_modules` を
  解決するため、同じ `SafeAreaInsetsContext` に見えて実体は別の React
  Context オブジェクトになり、`Provider` で上書きした値が `Consumer` 側に
  一切届かない。エラーは出ず、`Platform.OS==='web'` の分岐は正常に通り、
  値も正しく計算されるため発見しづらい。`npm dedupe`（ルートで実行、
  `~5.7.0` の唯一のバージョンである `5.7.0` に収束させる）で解消する。
  **モノレポで `expo-router` 経由のライブラリと自前コードが同じ React
  Context を共有する前提のコードを書くときは、`find . -path
"*/node_modules/<pkg>/package.json" -not -path "*/node_modules/*/node_modules/*"`
  で複数バージョンが同居していないか確認すること。**
  （このdedupe自体は今も有効。ただし、これが解消しようとしていた
  「WebSafeAreaFloorが効かない」という当時の症状そのものは、後述の通り
  対処すべき問題ではなかったと判明している。）
- **`env(safe-area-inset-bottom)` が Android Chrome で 0 を返すのは、
  3ボタンナビゲーション端末では正しい挙動であり、バグではない。**
  （旧: WebSafeAreaFloor、8318c21で導入・2026-08-10に問題ごと削除）
  タブバーのラベルが「見切れている」という報告を受け、Android Chrome は
  ジェスチャーナビ環境のホームバー分の余白を `env(safe-area-inset-bottom)`
  で報告しないという仮説のもと、Web版で無条件に24pxの底上げを注入する
  `WebSafeAreaFloor`（`SafeAreaInsetsContext.Provider`で`insets.bottom`を
  `Math.max(insets.bottom, 24)`に上書き）を追加した。しかし実機の拡大
  スクリーンショットで確認したところラベルは切れておらず、見えていたのは
  この24pxの余白そのものだった。報告者の端末は**3ボタンナビゲーション**
  （|||/○/<）で、この場合ブラウザの表示領域はナビゲーションバーの下まで
  拡張されないため、`env(safe-area-inset-bottom)`が0を返すのはむしろ正しい
  （余白を足す必要がある領域が実際に存在しない）。つまり存在しない問題への
  対処が、「ラベルの下に不自然な白帯ができる」という新しい問題を生んでいた。
  `WebSafeAreaFloor`と、それを `(tabs)/_layout.tsx` でラップしていた箇所は
  削除済み。**Android端末で safe-area 関連の報告を受けたときは、まず
  3ボタンナビかジェスチャーナビかを確認すること。** ジェスチャーナビ環境
  （画面下端に細いピルが浮くタイプ）では、ブラウザの表示領域がナビ操作
  エリアの下まで拡張される可能性があり、そちらは実際に対処が必要になり
  うる。`9823682`の`viewport-fit=cover`+`100dvh`はその可能性に備えて
  残してある。
- **`tabBarLabelStyle` を指定しないと、react-navigation のデフォルト
  （`fontSize: 10` のみ・`lineHeight` 指定なし）が使われ、日本語ラベルの
  下端が `numberOfLines={1}` の `overflow: hidden` で数px クリップされる。**
  `Text` の `lineHeight: normal` は欧文フォントのメトリクスを前提にした値で、
  日本語グリフの実際のインク（特に「ン」「ク」等の下端）はそれより下まで
  はみ出す。目視・スクリーンショット比較では判別できないほど小さい
  （後述の検証方法参照）。`(tabs)/_layout.tsx` の `tabBarLabelStyle:
{ fontSize: 10, lineHeight: 14 }` で解消（2026-08-10）。`lineHeight` を
  16 までさらに上げても効果は変わらなかった（14で頭打ち）ため、それ以上
  増やす意味はない。
- **数px単位のテキストクリップは、スクリーンショットの目視比較や
  `Range.getBoundingClientRect()` の数値だけでは判定を誤る。**
  前者は倍率を上げても人間の目では気づけないことがあり、後者はフォントの
  メトリクス上の余白を含むため実際に描画されていない分まで「はみ出し」と
  カウントしてしまう（今回、修正前の実測は3pxクリップだったが、目視では
  修正前後の画像が同一にしか見えなかった）。確実に判定するには、対象要素の
  `overflow` を一時的に `visible` に変えた状態としない状態でスクリーン
  ショットを撮り、ピクセル単位で diff を取ること（`sharp` の `raw()` で
  RGB を比較し、閾値を超える画素数を数える）。本物のクリップがあれば、
  各文字の下端に揃った一貫した帯としてdiffが現れる（ランダムなアンチ
  エイリアシングのノイズとは区別できる）。
- **react-navigation の `BottomTabBar` は、safe-area 下端の余白を `[role="tablist"]`
  自身ではなく、その親の外側 `View`（背景色付き・高さ = コンテンツ高 + `insets.bottom`、
  `paddingBottom: insets.bottom`）に付与する。** `[role="tablist"]` はタブボタンの
  行だけを表す内側要素で、常に本来のコンテンツ高（例: 48px）のまま変化しない。
  Web版でタブバーの安全域パディングを DevTools で確認するときは、
  `[role="tablist"]` ではなく `document.querySelector('[role="tablist"]').parentElement`
  の `height`/`paddingBottom` を見ること。誤って内側要素を測ると、
  実際には正しく効いている修正を「効いていない」と誤診断する
  （2026-08-10、`WebSafeAreaFloor` の検証で実際に踏んだ）。
- **マイグレーションは開発環境に Postgres がないため手作りになる。** CI が
  空DBへの `migrate deploy` とドリフト検出を行うので、push 前にローカルで
  通ることを確認できなくても CI で検出される。ただし「本番DBの現状」とは
  別物なので、本番適用前には必ず `_prisma_migrations` の状態を確認すること。

**Playwright でこのアプリをモックAPI相手にテストするときの落とし穴**
（`apps/mobile` を `expo start --web` でローカル起動してテストする場合）:

- 本番APIの `CORS_ORIGIN` は本番ドメイン固定なので、ローカルの `expo start --web`
  から直接叩くとブロックされる。`EXPO_PUBLIC_API_BASE_URL` にdevサーバー自身の
  オリジンを指定し、`page.route('**/api/**', ...)` で同一オリジンとしてモックする。
- `public/sw.js`（Service Worker）はSWのスレッド内で直接 `fetch()` するため、
  `page.route` のモックをすり抜けて実ネットワークに飛ぶ（ポケふたデータの
  network-first戦略が原因）。テスト時は `navigator.serviceWorker.register` を
  `addInitScript` で上書きして登録自体を無効化すること。
- タブバーは `<a href="/...">` として描画されるため、`page.click('text=...')`
  はヘッダーの見出し文言（例:「ポケふたコレクト」）と部分一致して誤クリック
  しうる。`page.click('a[href="/collection"]')` のように href で狙うこと。

## 外部データ

ポケふたのマスタデータは `apps/api/etl/scrape.ts` が `local.pokemon.jp` から取得する。
セレクタ依存なので公式サイトのリニューアルで壊れる。ETL を触るときは
件数の安全装置（前回比を下回ったら中断）を必ず維持すること。
