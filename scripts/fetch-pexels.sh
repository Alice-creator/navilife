#!/usr/bin/env bash
# Fetch landscape photos from Pexels for use as app backgrounds.
# Paginates (Pexels caps per_page at 80), filters by min width, dedups by ID.
#
# Usage: PEXELS_API_KEY=xxx ./scripts/fetch-pexels.sh "landscape wallpaper" 200
# Args:  query (default "landscape wallpaper"), count (default 200)
# Env:   MIN_WIDTH (default 1920), OUT_DIR (default ./pexels-downloads)

set -euo pipefail

QUERY="${1:-landscape wallpaper}"
TARGET_COUNT="${2:-200}"
MIN_WIDTH="${MIN_WIDTH:-1920}"
OUT_DIR="${OUT_DIR:-./pexels-downloads}"
PER_PAGE=80

if [[ -z "${PEXELS_API_KEY:-}" ]]; then
  echo "Error: set PEXELS_API_KEY" >&2; exit 1
fi

mkdir -p "$OUT_DIR"
encoded=$(jq -nr --arg q "$QUERY" '$q | @uri')
pages=$(( (TARGET_COUNT + PER_PAGE - 1) / PER_PAGE ))

echo "Fetching ~$TARGET_COUNT results for: $QUERY"
echo "Pages: $pages × $PER_PAGE"

meta_file=$(mktemp)
trap "rm -f $meta_file" EXIT

for page in $(seq 1 "$pages"); do
  remaining=$(( TARGET_COUNT - (page - 1) * PER_PAGE ))
  per_page=$(( remaining < PER_PAGE ? remaining : PER_PAGE ))
  curl -sf -H "Authorization: $PEXELS_API_KEY" \
    "https://api.pexels.com/v1/search?query=${encoded}&per_page=${per_page}&orientation=landscape&page=${page}&size=large" \
    | jq '.photos[]'
done | jq -s 'unique_by(.id)' > "$meta_file"

raw_count=$(jq 'length' "$meta_file")
echo "  → got $raw_count unique results from API"

# Filter by min width.
filtered_file=$(mktemp)
trap "rm -f $meta_file $filtered_file" EXIT
jq --argjson minW "$MIN_WIDTH" '[.[] | select(.width >= $minW)]' "$meta_file" > "$filtered_file"
filt_count=$(jq 'length' "$filtered_file")
echo "  → $filt_count meet min-width $MIN_WIDTH"

# Download.
jq -r '.[] | [.id, .src.large2x, .photographer, .width, .height] | @tsv' "$filtered_file" \
  | while IFS=$'\t' read -r id url photographer width height; do
      slug=$(echo "$photographer" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/--*/-/g; s/^-//; s/-$//')
      [[ -z "$slug" ]] && slug="photo"
      filename="$OUT_DIR/${slug}-${id}.jpg"
      if [[ -f "$filename" ]]; then continue; fi
      printf '  ↓ %s (%dx%d)\n' "$(basename "$filename")" "$width" "$height"
      curl -sLf -o "$filename" "$url" || echo "    (download failed)"
    done

total=$(ls -1 "$OUT_DIR"/*.jpg 2>/dev/null | wc -l)
echo "Done. $total files in $OUT_DIR"
