-- 5-3: メールアドレス確認。手書きの理由は他の手書きマイグレーションと同じ
-- （README.md「本番DBスキーマドリフトの記録」参照）— このマシンには本番の
-- pokelids_postgres 以外に Postgres がなく、`prisma migrate dev` を直接
-- 実行すると本番へ即適用されてしまうため、既存のマイグレーション（例:
-- 20260730125116_add_password_reset_tokens）と同じ構造をそのまま踏襲して
-- 手書きしている。

-- AlterTable
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
