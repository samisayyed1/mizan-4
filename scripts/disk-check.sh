#!/usr/bin/env bash
# Quick disk-usage snapshot for the Mizan monorepo.
#
# Run via `pnpm disk:check`. Prints the size of each rebuildable
# artefact directory plus the working tree as a whole, then the host
# disk's free space. Read-only — never deletes anything.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

print_size() {
  local label="$1"
  local path="$2"
  if [ -e "$path" ]; then
    printf "  %-30s %s\n" "$label" "$(du -sh "$path" 2>/dev/null | awk '{print $1}')"
  else
    printf "  %-30s %s\n" "$label" "(missing)"
  fi
}

echo "Mizan disk-usage report"
echo "======================="
echo ""

echo "Build / cache artefacts:"
print_size "target/"                "target"
print_size "node_modules/ (root)"   "node_modules"
print_size "dist/"                  "dist"
print_size "apps/tauri/gen/"        "apps/tauri/gen"
print_size ".turbo/"                ".turbo"
print_size ".next/"                 ".next"
print_size "playwright-report/"     "playwright-report"
print_size "test-results/"          "test-results"
echo ""

echo "Other node_modules across the workspace:"
find . -name node_modules -type d -prune \
  ! -path "./node_modules" -print 2>/dev/null \
  | while read -r d; do
      printf "  %-30s %s\n" "$d" "$(du -sh "$d" 2>/dev/null | awk '{print $1}')"
    done
echo ""

print_size ".git"                   ".git"
printf "  %-30s %s\n" "TOTAL repo" "$(du -sh . 2>/dev/null | awk '{print $1}')"
echo ""

echo "Host disk (\$HOME):"
df -h "$HOME" | tail -1 | awk '{printf "  %s %s used of %s, %s free (%s)\n", $9, $3, $2, $4, $5}'
