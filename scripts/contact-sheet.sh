#!/usr/bin/env bash
# Generate a static HTML contact sheet from all .jpg files in OUT_DIR.
# Open the resulting file in a browser to scan candidates.
# Usage: ./scripts/contact-sheet.sh [folder]

set -euo pipefail
DIR="${1:-./pexels-downloads}"
OUT="$DIR/contact.html"

cat > "$OUT" <<'HEAD'
<!doctype html><meta charset="utf-8">
<title>Pexels contact sheet</title>
<style>
  body { background:#0B0D13; color:#E2E4EA; font-family:system-ui,sans-serif; margin:0; padding:16px; }
  h1 { font-size:14px; font-weight:600; color:#7B819A; margin:0 0 12px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:8px; }
  figure { margin:0; }
  img { width:100%; height:170px; object-fit:cover; border-radius:6px; display:block; cursor:pointer; }
  figcaption { font-size:10px; color:#7B819A; margin-top:4px; word-break:break-all; user-select:all; }
  img:hover { outline:2px solid #6B8AFF; }
</style>
<h1 id="counter"></h1>
<div class="grid" id="grid"></div>
<script>
HEAD

# Build a JS array of filenames so the page can render them.
echo "const files = [" >> "$OUT"
ls "$DIR"/*.jpg 2>/dev/null | xargs -n1 basename | sort | sed 's/.*/  "&",/' >> "$OUT"
cat >> "$OUT" <<'TAIL'
];
document.getElementById('counter').textContent = files.length + ' files. Click filename to copy.';
const grid = document.getElementById('grid');
files.forEach(f => {
  const fig = document.createElement('figure');
  const img = document.createElement('img');
  img.src = f; img.loading = 'lazy';
  const cap = document.createElement('figcaption');
  cap.textContent = f;
  cap.onclick = () => navigator.clipboard.writeText(f);
  fig.append(img, cap);
  grid.appendChild(fig);
});
</script>
TAIL

echo "Wrote $OUT — open it in a browser."
