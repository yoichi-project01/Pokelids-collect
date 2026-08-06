-- 2-2: 1収集記録につき主写真（is_primary = true）は最大1枚に制限する。
-- Prisma は部分ユニークインデックスに対応していないため、schema.prisma には
-- 何も書かず、ここに生SQLとして定義する（prisma migrate diff の出力には
-- 現れないため、このファイルは手書きしている）。
--
-- 既存データに対する事前クリーンアップは不要。isPrimary は
-- POST /api/collections で「その収集記録に最初にアップロードされた1枚」
-- にのみ true を設定する実装になっており、これまで複数 true が同時に
-- 存在しうる経路が存在しなかったため。
CREATE UNIQUE INDEX "one_primary_per_collection" ON "photos" ("collection_id") WHERE "is_primary";
