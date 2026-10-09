#!/usr/bin/env bash
# Moves the full SimpleAssets history between manifests/sa-history and the
# repo's "sa-history" branch. The branch is force-pushed as one single commit
# each time, so hundreds of MB of history never pile up in git.
#   restore   clone the branch into manifests/sa-history (empty folder if none yet)
#   publish   push manifests/sa-history as the new branch content
# Needs GH_TOKEN and GITHUB_REPOSITORY (set automatically in Actions).
set -euo pipefail
DIR=manifests/sa-history
URL="https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"

case "${1:-}" in
  restore)
    rm -rf "$DIR"
    if git ls-remote --exit-code --heads "$URL" sa-history >/dev/null 2>&1; then
      git clone --quiet --depth 1 --branch sa-history "$URL" "$DIR"
      rm -rf "$DIR/.git"
      echo "Restored sa-history branch."
    else
      mkdir -p "$DIR"
      echo "No sa-history branch yet — starting fresh."
    fi
    ;;
  publish)
    cd "$DIR"
    rm -rf .git
    git init --quiet -b sa-history
    git config user.name "gpk-history-bot"
    git config user.email "actions@github.com"
    git add -A
    git commit --quiet -m "SimpleAssets history ($(date -u +%Y-%m-%dT%H:%MZ))"
    git push --quiet --force "$URL" sa-history
    rm -rf .git
    echo "Published sa-history branch."
    ;;
  *) echo "usage: $0 restore|publish" >&2; exit 2 ;;
esac
