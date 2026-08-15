#!/usr/bin/env bash
# Weekly re-scrape of local.pokemon.jp into the DB (etl/scrape.ts), run from
# host cron — see `crontab -l`.
#
# Runs the ETL directly on the host (`npm run etl:scrape`), not via
# `docker exec` into pokelids_api, for two reasons: (1) the API image
# doesn't contain the ETL's source, tsx, or cheerio at all — the Dockerfile
# only copies apps/api/dist (compiled) and prisma, never apps/api/etl —
# so there is nothing to exec into; (2) even if it did, the ETL doesn't
# need anything docker-exec would provide. Unlike backup.sh's pg_dump
# (which has to run inside the postgres container to reach its own local
# socket), the ETL only needs DATABASE_URL (reachable via the host-exposed
# 127.0.0.1:5433 — see the override below) and a filesystem path for
# images (the RAID-mounted /mnt/photos/pokelids) — both already reachable
# directly from the host, exactly how this has always been run manually
# (see webapp/CLAUDE.md's own notes on host-side ETL runs).
#
# A docker-compose service with its own in-container scheduler (option b)
# was rejected: it would mean baking tsx/cheerio/etl/ into an image that
# doesn't need them to serve traffic, plus a new always-on process for
# something that only needs to run once a week. A systemd timer (option c)
# would work, but splits "where are this project's scheduled jobs" across
# two mechanisms when crontab already holds backup.sh (5-3) — cron alone is
# precise enough for a weekly job, and keeps both jobs in one place.
#
# Frequency: weekly, not daily. New poke lids appear on the order of tens
# per year (a handful of weeks apart, not days), so daily scraping would
# mostly just be extra load on local.pokemon.jp for no new information —
# but letting a retirement (2-1's retiredAt) sit undetected for a month
# leaves the collection-progress denominator wrong for that long, so
# monthly was too infrequent. Scheduled for early Sunday morning JST (see
# crontab — this host's system clock is UTC, so the crontab line itself
# reads as Saturday evening) specifically to avoid scraping during Japan
# daytime, when local.pokemon.jp sees real visitor traffic.
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Same log location as backup.sh's own log (see that script's comment for
# why not the root LVM volume) — one place to look for this project's
# scheduled-job output.
LOG_FILE="/mnt/photos/pokelids-backups/etl.log"
# Matches pc-monitor's own ALERT_TO (check_containers.sh) — reuses the
# msmtp "default" account already configured at ~/.msmtprc rather than
# standing up new notification infrastructure for this one script (the
# task this shipped for explicitly asked for that: reuse what's there).
ALERT_TO="setoyama.yoichi@gmail.com"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

cd "$REPO_DIR"

# .env's own DATABASE_URL/PHOTO_STORAGE_PATH point at Docker-internal
# hostnames (pokelids_postgres:5432, /data/photos) that only resolve
# *inside* a container on the compose network — not from this host cron
# run. Sourcing first (for POSTGRES_USER/PASSWORD/DB) then overriding both
# is the same override CLAUDE.md documents for manual host-side ETL runs.
set -a
# shellcheck disable=SC1091
source .env
set +a
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5433/${POSTGRES_DB}"
export PHOTO_STORAGE_PATH="/mnt/photos/pokelids"

echo "[$TIMESTAMP] Starting ETL scrape"

# NOT --force: a dropped-count trip of 1-1's safety device must stay a
# stop, never something a scheduled job pushes through unattended. It's
# still an *expected* kind of failure (a site-structure change, not a bug)
# — handled as "alert and stop", not silently ignored or treated as a
# crash needing a different response.
if npm run etl:scrape --workspace=@pokelids/api; then
  echo "[$TIMESTAMP] ETL scrape completed successfully. If the log above shows any Upserted/retired/restored count > 0, the bundled snapshot is now stale — see webapp/CLAUDE.md for the manual dump-poke-lids + rebuild steps this does NOT run automatically."
else
  exit_code=$?
  echo "[$TIMESTAMP] ETL scrape FAILED (exit $exit_code) — see the output above for why (often 1-1's count-safety device tripping on a local.pokemon.jp structure change; the DB was NOT updated in that case). Full history: $LOG_FILE"
  {
    echo "To: ${ALERT_TO}"
    echo "Subject: [ポケふたコレクト] ETL失敗"
    echo ""
    echo "ETLの定期実行が失敗しました（終了コード ${exit_code}）。"
    echo "多くの場合、件数の安全装置（1-1）が公式サイトの構造変更を検出して中断しています。"
    echo "この場合DBは更新されていません。"
    echo ""
    echo "詳細ログ: ${LOG_FILE}"
    echo "ホスト: $(hostname)"
    echo "時刻: $(date '+%Y-%m-%d %H:%M:%S')"
  } | msmtp -a default "${ALERT_TO}" || echo "[$TIMESTAMP] Failed to send alert email (msmtp itself failed — check ~/.msmtprc / ~/msmtp.log)"
  exit "$exit_code"
fi
