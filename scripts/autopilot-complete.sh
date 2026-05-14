#!/usr/bin/env bash
# Exits 0 iff every prompt in the REMAINING + SKIP set has a row in
# the manifest. Anything else exits non-zero so the autopilot loop
# keeps running.
set -euo pipefail
MANIFEST=docs/reference/feroz-build-manifest.md
[ -f "$MANIFEST" ] || { echo "no manifest"; exit 10; }

required="7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 43 44 45 46 47 48 49"
missing=""
for n in $required; do
  if ! grep -E "^\| ${n}[[:space:]]+\|" "$MANIFEST" | grep -qE "(done|skipped:[a-z0-9_-]+)"; then
    missing="$missing $n"
  fi
done
if [ -n "$missing" ]; then
  echo "NOT DONE — missing or unflagged:$missing"
  exit 1
fi

# Cross-check every `done` row's commit hash is reachable from
# origin/main.
git fetch origin --quiet || true
while IFS= read -r line; do
  hash=$(printf '%s' "$line" | awk -F'|' '{gsub(/ /,"",$4); print $4}')
  [ -z "$hash" ] && continue
  [ "$hash" = "-" ] && continue
  [ "$hash" = "n/a" ] && continue
  if ! git merge-base --is-ancestor "$hash" origin/main 2>/dev/null; then
    echo "FAIL — manifest hash $hash not on origin/main"; exit 2
  fi
done < <(grep -E "^\| [0-9]+[[:space:]]+\| done[[:space:]]+\|" "$MANIFEST")

# Rollback tag must still resolve to b300d3b.
tag_sha=$(git rev-list -n 1 pre-feroz-build-3.4.1 2>/dev/null || true)
case "$tag_sha" in
  b300d3b*) ;;
  *) echo "FAIL — rollback tag drifted to $tag_sha"; exit 3 ;;
esac
echo "DONE"
