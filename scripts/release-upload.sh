#!/usr/bin/env bash
# Uploads one release folder to the update host (ADR-0056): the installers and blockmaps first, latest.yml last,
# so a client never reads a manifest that names a file not yet there.
# Usage: release-upload.sh <local folder> <prefix: dev|beta|stable|releases/<version>>
# Env: UPDATES_S3_BUCKET, UPDATES_S3_ENDPOINT (empty for AWS), AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION.
set -euo pipefail

src="${1:?local folder}"
prefix="${2:?bucket prefix}"
dest="s3://${UPDATES_S3_BUCKET:?UPDATES_S3_BUCKET is not set}/${prefix}"
endpoint=()
[[ -n "${UPDATES_S3_ENDPOINT:-}" ]] && endpoint=(--endpoint-url "$UPDATES_S3_ENDPOINT")

aws s3 cp "$src" "$dest" --recursive --exclude latest.yml --no-progress "${endpoint[@]}" \
  --cache-control 'public, max-age=31536000, immutable'
aws s3 cp "$src/latest.yml" "$dest/latest.yml" --no-progress "${endpoint[@]}" \
  --cache-control 'no-cache' --content-type 'text/yaml'
echo "release-upload: $src -> $dest"
