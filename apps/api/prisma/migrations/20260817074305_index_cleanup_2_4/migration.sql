-- TASKS.md 2-4。

-- コレクション画面の GET /api/collections/me（orderBy: visitedAt desc）用の
-- 複合インデックス。7-6でContext化されて呼び出し回数自体は減ったが、
-- クエリ自体は残っている。
CREATE INDEX "collections_user_id_visited_at_idx" ON "collections"("user_id", "visited_at");

-- User.isAdmin: 削除。管理者専用の機能・チェックがどこにも存在せず、
-- クライアントにも公開されていない（UserDtoにも含まれない）未使用フィールド
-- だった。残すと将来「管理画面がある」と誤認する材料になる。
-- ADMIN_SEED_EMAIL/PASSWORD自体は引き続き最初のユーザーアカウントを
-- 作るために使う（正しく言うと「管理者」ではなく単なる最初のアカウント
-- なので、SEED_USER_EMAIL/PASSWORDに改名した — README.md/.env.example参照）。
ALTER TABLE "users" DROP COLUMN "is_admin";

-- PokeLid.notes: 削除。ETLも他のどのコードもこの列に一度も書き込んでおらず
-- （常にNULL）、APIレスポンスに含めていた値も常にnullだった。
-- PokeLid.installDate: 削除。ETLの取得元（local.pokemon.jp の詳細ページ）
-- に設置日の情報自体が存在せず（実際のHTMLで確認済み）、埋める手段がない。
ALTER TABLE "poke_lids" DROP COLUMN "install_date",
DROP COLUMN "notes";
