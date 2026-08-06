-- AlterTable
ALTER TABLE "poke_lids" ADD COLUMN     "retired_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "poke_lids_retired_at_idx" ON "poke_lids"("retired_at");
