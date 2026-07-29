#!/usr/bin/env bash
# Daily snapshot backup for the pokelids-collect DB and uploaded photos.
#
# This backs up to a different directory on the SAME machine — it protects
# against accidental deletion, a bad migration, or app-level data corruption,
# but NOT against a whole-disk/array failure (the source data already lives
# on a RAID6 array tolerating 2 drive failures; true disaster recovery would
# need an off-site or separate-machine copy, which this does not provide).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="/home/setoyama/pokelids-backups"
DB_BACKUP_DIR="$BACKUP_ROOT/db"
PHOTOS_BACKUP_DIR="$BACKUP_ROOT/photos"
PHOTOS_SOURCE_DIR="/mnt/photos/pokelids"
RETENTION_DAYS=14
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

set -a
# shellcheck disable=SC1091
source "$REPO_DIR/.env"
set +a

mkdir -p "$DB_BACKUP_DIR" "$PHOTOS_BACKUP_DIR"

echo "[$TIMESTAMP] Starting backup"

echo "[$TIMESTAMP] Dumping database..."
docker exec pokelids_postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$DB_BACKUP_DIR/pokelids-$TIMESTAMP.sql.gz"

echo "[$TIMESTAMP] Copying photos..."
# --link-dest hardlinks unchanged files against the previous snapshot instead
# of copying them, so disk usage stays close to one full copy regardless of
# how many days of snapshots are retained.
LATEST_SNAPSHOT="$(find "$PHOTOS_BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d | sort | tail -1)"
rsync -a ${LATEST_SNAPSHOT:+--link-dest="$LATEST_SNAPSHOT"} "$PHOTOS_SOURCE_DIR/" "$PHOTOS_BACKUP_DIR/$TIMESTAMP/"

echo "[$TIMESTAMP] Pruning backups older than $RETENTION_DAYS days..."
find "$DB_BACKUP_DIR" -maxdepth 1 -name '*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
find "$PHOTOS_BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} +

echo "[$TIMESTAMP] Backup complete"
