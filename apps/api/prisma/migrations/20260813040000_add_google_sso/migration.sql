-- 5-4: Google SSO。他の手書きマイグレーションと同じ理由（本番以外に
-- Postgresがなく `prisma migrate dev` を直接実行すると本番へ即適用されて
-- しまうため）で手書き。README.md「本番DBスキーマドリフトの記録」参照。

-- password_hash を nullable 化：Google専用アカウント（パスワードを
-- 一度も設定していない）はここに書くものがない。既存の全行は password_hash
-- が既にNOT NULLの値を持っているため、NULL許容への変更（NOT NULL制約の
-- 緩和）はデータを一切書き換えない安全な変更。
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "google_id" TEXT;

-- CreateIndex
-- Postgresのユニークインデックスは複数のNULLを互いに区別する（NULL同士は
-- 重複とみなさない）ため、パスワードのみのアカウントが全員 google_id = NULL
-- のまま共存できる。poke_lids.official_ref と同じパターン。
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
