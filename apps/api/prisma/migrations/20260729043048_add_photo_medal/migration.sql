/*
  Warnings:

  - You are about to drop the column `geo_verified` on the `photos` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PhotoMedal" AS ENUM ('GOLD', 'SILVER', 'NONE');

-- AlterTable
ALTER TABLE "photos" DROP COLUMN "geo_verified",
ADD COLUMN     "medal" "PhotoMedal" NOT NULL DEFAULT 'NONE';
