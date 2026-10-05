#!/usr/bin/env bash
# §37, the sync simulation and the 8f cloud backup restore against the real Go API, Postgres and MinIO (ADR-0042).
# Needs Postgres and MinIO up (`docker compose up -d postgres minio`) and the desktop's workspace packages built.
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
pg=${MUNEEM_E2E_PG:-postgres://muneem:muneem@localhost:5433}
db=${MUNEEM_E2E_DB:-muneem_e2e}
port=${MUNEEM_E2E_PORT:-18081}
owner_url="$pg/$db?sslmode=disable"
api_url="postgres://muneem_app:muneem_app@${pg#*@}/$db?sslmode=disable"
work=$(mktemp -d)
api_pid=""

cleanup() {
  [ -n "$api_pid" ] && kill "$api_pid" 2>/dev/null && wait "$api_pid" 2>/dev/null
  rm -rf "$work"
}
trap cleanup EXIT

# A database of its own, so Go integration tests that truncate the dev database never race this run.
if ! psql "$pg/postgres?sslmode=disable" -tAc "SELECT 1 FROM pg_database WHERE datname = '$db'" | grep -q 1; then
  psql "$pg/postgres?sslmode=disable" -qc "CREATE DATABASE $db"
fi

[ -f "$root/cloud/api/openapi.gen.go" ] || make -C "$root/cloud" gen
(cd "$root/cloud" && nice -n 10 go build -o "$work/muneem-api" ./cmd/api)
DATABASE_URL="$owner_url" JWT_SECRET=unused "$work/muneem-api" migrate-up

# The API connects as a login role inside muneem_api, so row-level security applies as in production.
psql "$owner_url" -v ON_ERROR_STOP=1 -qc "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'muneem_app') THEN CREATE ROLE muneem_app LOGIN PASSWORD 'muneem_app'; END IF; END \$\$;" -c "GRANT muneem_api TO muneem_app;"

DATABASE_URL="$api_url" JWT_SECRET=e2e-secret PORT="$port" \
  MUNEEM_S3_ENDPOINT="${MUNEEM_S3_ENDPOINT:-http://localhost:9000}" MUNEEM_S3_BUCKET="${MUNEEM_S3_BUCKET:-muneem-snapshots}" \
  MUNEEM_S3_ACCESS_KEY="${MUNEEM_S3_ACCESS_KEY:-muneem}" MUNEEM_S3_SECRET_KEY="${MUNEEM_S3_SECRET_KEY:-muneem-dev-secret}" \
  MUNEEM_S3_REGION="${MUNEEM_S3_REGION:-us-east-1}" \
  MUNEEM_BACKUP_MASTER_KEY="${MUNEEM_BACKUP_MASTER_KEY:-$(head -c 32 /dev/urandom | base64)}" \
  nice -n 10 "$work/muneem-api" >"$work/api.log" 2>&1 &
api_pid=$!

base="http://127.0.0.1:$port/v1"
for _ in $(seq 1 60); do
  curl -fs "$base/health" >/dev/null && break
  kill -0 "$api_pid" 2>/dev/null || { cat "$work/api.log"; exit 1; }
  sleep 1
done
curl -fs "$base/health" >/dev/null || { echo "the API never became healthy"; cat "$work/api.log"; exit 1; }

status=0
MUNEEM_E2E_CLOUD="$base" MUNEEM_E2E_DATABASE_URL="$owner_url" \
  nice -n 10 pnpm --dir "$root" --filter @muneem/desktop exec vitest run test/sync/e2eCloud.test.ts --maxWorkers=1 || status=$?
if [ "$status" -ne 0 ]; then
  echo "--- API warnings, errors and failed requests ---"
  grep -E '"status":[45][0-9]{2}|"level":"(WARN|ERROR)"' "$work/api.log" | tail -40 || true
fi
exit "$status"
