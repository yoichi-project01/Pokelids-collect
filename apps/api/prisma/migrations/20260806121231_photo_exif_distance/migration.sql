-- 2-3: EXIF の生の GPS 座標を DB に持たない。判定に必要なのは距離だけなので、
-- 既存データは exif_latitude/exif_longitude からポケふたの登録座標までの
-- 距離を計算して exif_distance_meters に移してから、座標列を drop する。
--
-- 順序が重要: ADD → UPDATE（座標列がまだ存在するうちに計算）→ DROP。
-- 逆順にすると座標列が先に消え、距離を計算できないまま既存データが失われる。
--
-- 距離の計算式は packages/shared の haversineDistanceMeters と同じ
-- （地球半径 6371000m の球面三角法）。photo.medal は determinePhotoMedal
-- (distance, 200) の結果をアップロード時に保存したものであり、この移行では
-- 再計算しない（列を追加するだけで medal 自体は変更しない）。数式が一致して
-- いれば、後から exif_distance_meters を使って再判定しても medal は変わらない。

-- AlterTable
ALTER TABLE "photos" ADD COLUMN "exif_distance_meters" DOUBLE PRECISION;

-- UPDATE: 既存の座標を距離に変換
WITH haversine_a AS (
  SELECT
    p.id,
    POWER(SIN(RADIANS(pl.latitude - p.exif_latitude) / 2), 2)
      + COS(RADIANS(p.exif_latitude)) * COS(RADIANS(pl.latitude))
        * POWER(SIN(RADIANS(pl.longitude - p.exif_longitude) / 2), 2) AS a
  FROM "photos" p
  JOIN "collections" c ON c.id = p.collection_id
  JOIN "poke_lids" pl ON pl.id = c.poke_lid_id
  WHERE p.exif_latitude IS NOT NULL AND p.exif_longitude IS NOT NULL
)
UPDATE "photos"
SET "exif_distance_meters" = 2 * 6371000 * ATAN2(SQRT(haversine_a.a), SQRT(1 - haversine_a.a))
FROM haversine_a
WHERE "photos".id = haversine_a.id;

-- AlterTable
ALTER TABLE "photos" DROP COLUMN "exif_latitude",
DROP COLUMN "exif_longitude";
