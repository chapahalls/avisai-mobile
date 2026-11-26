#!/usr/bin/env bash
# Regera as telas e o tour do README (docs/assets/readme/) a partir do app atual.
#
# Gera o app para a web com scripts/web-demo/build.sh (o mesmo da demo pública) e percorre as
# telas no Chromium em 390 × 844, no modo Mock e em pt-BR. O projeto não muda.
#
# Precisa de: Node 20+, dependências instaladas (npm install), Playwright com Chromium
# (require('playwright')) e ffmpeg.
# Uso: ./scripts/readme-captures/capture.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$ROOT/docs/assets/readme"
WORK="$(mktemp -d)"
PORT="${PORT:-8765}"
trap 'kill "${SERVER_PID:-0}" 2>/dev/null || true; rm -rf "$WORK"' EXIT

echo "› app para a web"
"$ROOT/scripts/web-demo/build.sh" "$WORK/dist-web"

cd "$WORK"
node -e "
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve('dist-web');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.json':'application/json'};
http.createServer((q,s)=>{let f=path.join(root,decodeURIComponent(q.url.split('?')[0]));
if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(root,'index.html');
s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(s);}).listen($PORT);
" &
SERVER_PID=$!
sleep 1

echo "› telas"
mkdir -p stills video
node "$HERE/tour.mjs" "http://localhost:$PORT/" stills stills
echo "› tour em vídeo"
node "$HERE/tour.mjs" "http://localhost:$PORT/" video video

mkdir -p "$OUT"
for f in stills/*.png; do
  ffmpeg -y -v error -i "$f" -vf "scale=585:-1:flags=lanczos" -q:v 3 "$OUT/$(basename "${f%.png}").jpg"
done
RAW="$(ls video/*.webm | head -1)"
ffmpeg -y -v error -ss 2 -i "$RAW" -vf "setpts=PTS/1.5,scale=390:-2:flags=lanczos" -an \
  -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart "$OUT/tour.mp4"
ffmpeg -y -v error -ss 2 -i "$RAW" -vf "setpts=PTS/1.5,fps=6,scale=300:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle" \
  "$OUT/tour.gif"

echo "› pronto: $OUT"
ls -la "$OUT"
