-- init(20260728170409)で定義されていた original_filename 列が、リポジトリに
-- 存在しないマイグレーション 20260730133315_photo_exif_distance_only が
-- 2026-07-30に本番サーバー上で直接作成・適用された際に失われたと見られるため、
-- 本番DBに復旧する。経緯の詳細は README.md の「本番DBスキーマドリフトの記録」参照。
--
-- 現時点（2026-08-08確認）で photos テーブルは0行だが、行が存在する環境で
-- 再実行されても壊れないよう、一時的な DEFAULT を付けてから外す。
--
-- IF NOT EXISTS が必須: このマイグレーションは「本番の壊れたDB」（列が
-- 失われた状態）を直す前提で書いたが、init(20260728170409) 以降を
-- 空DBに順番適用する経路（CIの migrate deploy 検証、新規環境構築）では
-- init の CREATE TABLE の時点で original_filename 列がすでに存在するため、
-- IF NOT EXISTS なしだと「列が既に存在する」で失敗する。
ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "original_filename" TEXT NOT NULL DEFAULT '';
ALTER TABLE "photos" ALTER COLUMN "original_filename" DROP DEFAULT;
