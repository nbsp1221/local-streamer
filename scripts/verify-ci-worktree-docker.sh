#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

bun_version="$(
  bun --print "JSON.parse(require('node:fs').readFileSync('package.json', 'utf8')).packageManager.split('@')[1]"
)"

git ls-files -z --cached --others --exclude-standard \
  | while IFS= read -r -d '' path; do
      if [ -e "$path" ]; then
        printf '%s\0' "$path"
      fi
    done \
  | tar \
    --null \
    --exclude='.playwright-mcp' \
    --exclude='playwright-report' \
    --exclude='test-results' \
    --files-from=- \
    -cf - \
  | docker run --rm -i \
    -e CI=true \
    -e GITHUB_ACTIONS=true \
    -e LOCAL_STREAMER_PLAYWRIGHT_INSTALL_DEPS=true \
    -e LANG=C.UTF-8 \
    -e LC_ALL=C.UTF-8 \
    -e TZ=Etc/UTC \
    "oven/bun:${bun_version}" \
    bash -lc '
      apt-get update >/dev/null &&
      apt-get install -y nodejs npm git curl xz-utils >/dev/null &&
      mkdir -p /tmp/workspace &&
      tar -xf - -C /tmp/workspace &&
      git config --global --add safe.directory /tmp/workspace &&
      cd /tmp/workspace &&
      bun install --frozen-lockfile &&
      bun run verify:ci-faithful
    '
