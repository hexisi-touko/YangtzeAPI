#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ $# -lt 1 || $# -gt 2 ]]; then
  printf 'Usage: %s <domain> [acme-email]\n' "$0" >&2
  exit 2
fi

if [[ -e .env ]]; then
  printf '.env already exists; refusing to overwrite it.\n' >&2
  exit 1
fi

domain="$1"
email="${2:-admin@${domain}}"
if [[ ! "$domain" =~ ^[A-Za-z0-9.-]+$ ]]; then
  printf 'Invalid domain: %s\n' "$domain" >&2
  exit 2
fi

cp .env.example .env
random_value() { openssl rand -hex 32; }

sed -i \
  -e "s|^DOMAIN=.*|DOMAIN=$domain|" \
  -e "s|^ACME_EMAIL=.*|ACME_EMAIL=$email|" \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(random_value)|" \
  -e "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$(random_value)|" \
  -e "s|^SESSION_SECRET=.*|SESSION_SECRET=$(random_value)|" \
  -e "s|^CRYPTO_SECRET=.*|CRYPTO_SECRET=$(random_value)|" \
  .env

mkdir -p data logs postgres redis caddy/data caddy/config backups
chmod 700 data logs postgres redis caddy/data caddy/config backups
chmod 600 .env

printf 'Created %s/.env and persistent data directories.\n' "$ROOT_DIR"
printf 'Review DOMAIN and ACME_EMAIL, then run: docker compose config && docker compose up -d\n'
