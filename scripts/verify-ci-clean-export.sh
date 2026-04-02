#!/usr/bin/env bash
set -euo pipefail

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

git checkout-index --all --force --prefix="$tmpdir"/
cd "$tmpdir"
bun install --frozen-lockfile
bun run verify:ci-faithful
