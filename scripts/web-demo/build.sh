#!/usr/bin/env bash
# Gera o app do motorista para a web (modo simulado), para a demo pública e para as capturas do README.
#
# Monta uma cópia temporária do projeto, instala ali o suporte web do Expo (react-native-web,
# react-dom, @expo/metro-runtime), troca os módulos nativos por stubs (como no Expo Go), usa um
# SQLite em memória (sql.js) e exporta para a pasta indicada. O projeto em si não muda.
#
# Uso: ./scripts/web-demo/build.sh <pasta-de-saída> [caminho-base]
#      caminho-base: onde o site fica publicado, ex. /rodar-mobile no GitHub Pages (padrão: raiz)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$(mkdir -p "$1" && cd "$1" && pwd)"
BASE_URL="${2:-}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "› cópia do projeto em $WORK"
(cd "$ROOT" && git ls-files -co --exclude-standard -z | tar --null -T - -cf -) | tar -xf - -C "$WORK/"
cp -al "$ROOT/node_modules" "$WORK/node_modules" 2>/dev/null || cp -r "$ROOT/node_modules" "$WORK/node_modules"

cd "$WORK"
cp "$HERE/overlay/metro.config.js" metro.config.js
cp "$HERE/overlay/index.web.js" index.web.js
mkdir -p web-stubs && cp "$HERE/overlay/stubs/"*.js web-stubs/
node -e "const f='package.json',p=require('./'+f);p.main='index.web.js';require('fs').writeFileSync(f,JSON.stringify(p,null,2))"

if [ -n "$BASE_URL" ]; then
  # Publicado num subcaminho (GitHub Pages de projeto): o Expo precisa saber a base dos arquivos.
  grep -q '^    \.\.\.config,$' app.config.ts || { echo "app.config.ts mudou: ajuste a injeção do baseUrl em $0" >&2; exit 1; }
  sed -i "0,/^    \.\.\.config,\$/s##    ...config,\n    experiments: { baseUrl: '$BASE_URL' },#" app.config.ts
fi

echo "› suporte web do Expo (só na cópia)"
CI=1 npx expo install react-native-web react-dom @expo/metro-runtime >/dev/null

echo "› exportando para a web"
rm -rf "$OUT"/*
CI=1 npx expo export --platform web --output-dir "$OUT" >/dev/null
echo "› pronto: $OUT"
