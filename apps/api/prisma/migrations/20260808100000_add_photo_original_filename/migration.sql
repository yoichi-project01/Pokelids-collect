-- init(20260728170409)で定義されていた original_filename 列が、リポジトリに
-- 存在しないマイグレーション 20260730133315_photo_exif_distance_only が
-- 2026-07-30に本番サーバー上で直接作成・適用された際に失われたと見られるため、
-- 本番DBに復旧する。経緯の詳細は README.md の「本番DBスキーマドリフトの記録」参照。
--
-- 現時点（2026-08-08確認）で photos テーブルは0行だが、行が存在する環境で
-- 再実行されても壊れないよう、一時的な DEFAULT を付けてから外す。
ALTER TABLE "photos" ADD COLUMN "original_filename" TEXT NOT NULL DEFAULT '';
ALTER TABLE "photos" ALTER COLUMN "original_filename" DROP DEFAULT;
