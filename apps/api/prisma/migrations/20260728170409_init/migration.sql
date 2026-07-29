-- CreateTable
CREATE TABLE "prefectures" (
    "id" INTEGER NOT NULL,
    "name_ja" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "prefectures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_info" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poke_lids" (
    "id" TEXT NOT NULL,
    "official_ref" TEXT,
    "name" TEXT NOT NULL,
    "pokemon_featured" TEXT[],
    "prefecture_id" INTEGER NOT NULL,
    "municipality" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "install_date" DATE,
    "official_image_url" TEXT,
    "official_source_url" TEXT NOT NULL,
    "notes" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poke_lids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "poke_lid_id" TEXT NOT NULL,
    "visited_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "exif_captured_at" TIMESTAMP(3),
    "exif_latitude" DECIMAL(9,6),
    "exif_longitude" DECIMAL(9,6),
    "geo_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "poke_lids_official_ref_key" ON "poke_lids"("official_ref");

-- CreateIndex
CREATE INDEX "poke_lids_prefecture_id_idx" ON "poke_lids"("prefecture_id");

-- CreateIndex
CREATE INDEX "collections_user_id_idx" ON "collections"("user_id");

-- CreateIndex
CREATE INDEX "collections_poke_lid_id_idx" ON "collections"("poke_lid_id");

-- CreateIndex
CREATE UNIQUE INDEX "collections_user_id_poke_lid_id_key" ON "collections"("user_id", "poke_lid_id");

-- CreateIndex
CREATE INDEX "photos_collection_id_idx" ON "photos"("collection_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poke_lids" ADD CONSTRAINT "poke_lids_prefecture_id_fkey" FOREIGN KEY ("prefecture_id") REFERENCES "prefectures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_poke_lid_id_fkey" FOREIGN KEY ("poke_lid_id") REFERENCES "poke_lids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
