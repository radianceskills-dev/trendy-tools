#!/usr/bin/env bash
set -euo pipefail

TOOL="${1:?tool id is required}"
BEFORE_SHA="${2:?base sha is required}"
CURRENT_SHA="${3:?current sha is required}"

changed="$(git diff --name-only "$BEFORE_SHA" "$CURRENT_SHA")"

if grep -Eq '^\.github/workflows/build-and-deploy\.yml$|^scripts/build-tool\.sh$|^scripts/should-build-tool\.sh$' <<< "$changed"; then
  exit 0
fi

case "$TOOL" in
  cyberchef) grep -Eq '^tools-manifest\.json$|^scripts/build-tool\.sh$' <<< "$changed" && exit 0 || true ;;
  freecut) grep -Eq '^scripts/adapt-freecut\.mjs$' <<< "$changed" && exit 0 || true ;;
  omniclip) grep -Eq '^scripts/adapt-omniclip\.mjs$' <<< "$changed" && exit 0 || true ;;
  excalidraw) grep -Eq '^scripts/adapt-excalidraw\.mjs$' <<< "$changed" && exit 0 || true ;;
  openqr) grep -Eq '^scripts/adapt-openqr\.mjs$|^scripts/openqr\.next\.config\.mjs$' <<< "$changed" && exit 0 || true ;;
esac

if grep -qx 'tools-manifest.json' <<< "$changed"; then
  node - "$TOOL" "$BEFORE_SHA" "$CURRENT_SHA" <<'NODE'
const { execFileSync } = require('node:child_process')

const [tool, before, current] = process.argv.slice(2)
const readManifest = (ref) => JSON.parse(execFileSync('git', ['show', `${ref}:tools-manifest.json`], { encoding: 'utf8' }))
const findTool = (manifest) => manifest.tools.find((entry) => entry.id === tool)

const beforeEntry = findTool(readManifest(before))
const currentEntry = findTool(readManifest(current))
if (JSON.stringify(beforeEntry) !== JSON.stringify(currentEntry)) process.exit(0)
process.exit(1)
NODE
fi

exit 1
