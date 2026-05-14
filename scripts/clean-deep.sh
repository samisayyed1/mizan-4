#!/usr/bin/env bash
# Aggressive disk-reclaim pass for the Mizan monorepo.
#
# Wipes every rebuildable artefact (Rust target/, node_modules/, dist/,
# Tauri gen/, tool caches). Source files and committed state are
# untouched. Run via `pnpm clean:deep`.
#
# After running you'll need `pnpm install` and the next `cargo` /
# `pnpm tauri dev` invocation will rebuild from scratch — slow once,
# fast forever after.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

echo "→ Cleaning Rust target/ via cargo clean"
cargo clean 2>&1 | tail -1

echo "→ Removing build / cache / gen directories"
# IMPORTANT: only wipe transient Tauri gen subdirs. The Xcode project
# under `apps/tauri/gen/apple/` is checked into git and must survive.
rm -rf dist build .turbo .next .parcel-cache .nyc_output coverage \
       playwright-report test-results blob-report \
       apps/tauri/gen/schemas apps/tauri/gen/.tauri \
       apps/tauri/src-tauri/target

echo "→ Removing every node_modules/ in the workspace"
rm -rf node_modules
find . -name node_modules -type d -prune -exec rm -rf {} +

echo "→ Removing stale incremental TS build info"
find . -name "*.tsbuildinfo" -type f -delete 2>/dev/null || true

echo "✓ Deep clean complete"
du -sh "$repo_root" 2>/dev/null || true
echo ""
echo "Next steps:"
echo "  pnpm install        # restore node_modules from local pnpm store"
echo "  cargo build         # first rebuild will repopulate target/"
