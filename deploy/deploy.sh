#!/usr/bin/env bash
# Muneem production deploy on one VM (ADR-0051; procedures in docs/operations/deploy.md).
#   deploy.sh up <tag>   pull, migrate as the owner role, apply roles.sql, restart, and roll back if never ready
#   deploy.sh rollback   return to the previously deployed tag (the schema stays migrated)
#   deploy.sh rewrap     re-wrap escrowed backup keys under the active master key (ADR-0052)
#   deploy.sh status     the deployed tags and containers
#   deploy.sh grant-operator <email>    make an operator for the admin page, creating the account (ADR-0057)
#   deploy.sh revoke-operator <email>   end an operator grant; open sessions stop at their next request
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
env_file="$here/.env"
state="$here/state"
ready_timeout=${MUNEEM_READY_TIMEOUT:-120}
psql_image=${MUNEEM_PSQL_IMAGE:-postgres:16-alpine}

die() { echo "deploy: $*" >&2; exit 1; }
log() { echo "deploy: $*" >&2; }

# env_value reads one variable from .env without evaluating it as shell.
env_value() {
  sed -n "s/^$1=//p" "$env_file" | tail -n 1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

compose() {
  docker compose --project-directory "$here" -f "$here/docker-compose.prod.yml" --env-file "$env_file" "$@"
}

image() { echo "$(env_value MUNEEM_IMAGE):$1"; }

current_tag() { cat "$state/current" 2>/dev/null || true; }
previous_tag() { cat "$state/previous" 2>/dev/null || true; }

record() {
  mkdir -p "$state"
  if [ -n "$2" ]; then echo "$2" >"$state/previous"; fi
  echo "$1" >"$state/current"
}

migrate() {
  log "migrate-up with $(image "$1")"
  DATABASE_URL=$(env_value MUNEEM_OWNER_DATABASE_URL) docker run --rm -e DATABASE_URL "$(image "$1")" migrate-up
}

apply_roles() {
  log "roles.sql"
  DATABASE_URL=$(env_value MUNEEM_OWNER_DATABASE_URL) MUNEEM_APP_DB_PASSWORD=$(env_value MUNEEM_APP_DB_PASSWORD) \
    MUNEEM_ADMIN_DB_PASSWORD=$(env_value MUNEEM_ADMIN_DB_PASSWORD) \
    docker run --rm -i -e DATABASE_URL -e MUNEEM_APP_DB_PASSWORD -e MUNEEM_ADMIN_DB_PASSWORD "$psql_image" \
    sh -c 'psql "$DATABASE_URL" -X -f -' <"$here/roles.sql"
}

start() {
  log "starting api $1"
  MUNEEM_TAG=$1 compose up -d --no-deps api
  MUNEEM_TAG=$1 compose up -d caddy
}

# wait_ready polls the container health, which is the API's own /v1/ready (Postgres and object storage).
wait_ready() {
  local deadline=$((SECONDS + ready_timeout)) id status
  while [ "$SECONDS" -lt "$deadline" ]; do
    id=$(MUNEEM_TAG=$1 compose ps -q api)
    status=$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null || echo starting)
    [ "$status" = healthy ] && return 0
    sleep 3
  done
  return 1
}

up() {
  local tag=${1:?usage: deploy.sh up <tag>} prev
  prev=$(current_tag)
  docker pull "$(image "$tag")"
  migrate "$tag"
  apply_roles
  start "$tag"
  if wait_ready "$tag"; then
    [ "$prev" = "$tag" ] && prev=$(previous_tag)
    record "$tag" "$prev"
    log "$tag is ready"
    return 0
  fi
  log "$tag never became ready within ${ready_timeout}s; recent logs:"
  MUNEEM_TAG=$tag compose logs --tail 40 api >&2 || true
  [ -n "$prev" ] && [ "$prev" != "$tag" ] || die "no previous tag to roll back to"
  log "rolling back to $prev"
  start "$prev"
  wait_ready "$prev" || die "rollback to $prev is not ready either: investigate now"
  die "deploy of $tag failed; $prev is serving again"
}

rollback() {
  local cur prev
  cur=$(current_tag)
  prev=$(previous_tag)
  [ -n "$prev" ] || die "no previous tag recorded"
  start "$prev"
  wait_ready "$prev" || die "$prev is not ready"
  record "$prev" "$cur"
  log "rolled back to $prev"
}

rewrap() {
  local tag
  tag=$(current_tag)
  [ -n "$tag" ] || die "nothing deployed yet"
  DATABASE_URL=$(env_value MUNEEM_OWNER_DATABASE_URL) \
    MUNEEM_BACKUP_MASTER_KEYS=$(env_value MUNEEM_BACKUP_MASTER_KEYS) MUNEEM_BACKUP_MASTER_KEY=$(env_value MUNEEM_BACKUP_MASTER_KEY) \
    docker run --rm -e DATABASE_URL -e MUNEEM_BACKUP_MASTER_KEYS -e MUNEEM_BACKUP_MASTER_KEY "$(image "$tag")" rewrap
}

# operator runs grant-operator / revoke-operator as the owner role; a new account's password is read without echo.
operator() {
  local cmd=$1 email=${2:?usage: deploy.sh $1 <email>} tag password=""
  tag=$(current_tag)
  [ -n "$tag" ] || die "nothing deployed yet"
  if [ "$cmd" = grant-operator ]; then
    read -rsp "password for $email if the account is new (12+ characters; Enter if it exists): " password
    echo >&2
  fi
  printf '%s\n' "$password" | DATABASE_URL=$(env_value MUNEEM_OWNER_DATABASE_URL) \
    docker run --rm -i -e DATABASE_URL "$(image "$tag")" "$cmd" "$email"
}

status() {
  echo "current:  $(current_tag)"
  echo "previous: $(previous_tag)"
  MUNEEM_TAG=$(current_tag) compose ps
}

[ -f "$env_file" ] || die "$env_file is missing; copy .env.example and fill it in"
case "${1:-}" in
  up) up "${2:-}" ;;
  rollback) rollback ;;
  rewrap) rewrap ;;
  status) status ;;
  grant-operator | revoke-operator) operator "$1" "${2:-}" ;;
  *) sed -n '2,8p' "$0" >&2; exit 2 ;;
esac
