#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  printf 'Missing .env. Run scripts/init-env.sh first.\n' >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source ./.env
set +a

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p backups
chmod 700 backups

docker compose exec -T postgres pg_dump \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --format=custom \
  --no-owner > "backups/${stamp}-postgres.dump"

tar --exclude='./logs' --exclude='./backups' \
  -czf "backups/${stamp}-app-data.tgz" data Caddyfile caddy

find backups -type f -mtime +14 -delete
chmod 600 backups/*
printf 'Backup completed: %s\n' "$stamp"
