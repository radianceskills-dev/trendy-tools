#!/usr/bin/env bash
set -euo pipefail

TOOL="${1:?tool id is required}"
ROOT="$(pwd)"
CACHE="$ROOT/.build-cache"
OUT="$ROOT/tools/$TOOL"

mkdir -p "$CACHE" "$OUT"

case "$TOOL" in
  it-tools)
    git clone --depth 1 --branch main https://github.com/radianceskills-dev/trendy-it-tools.git "$CACHE/it-tools"
    cd "$CACHE/it-tools"
    pnpm install --no-frozen-lockfile
    sed -i 's/vite build/vite build --base=\/tools\/it-tools\//g' package.json
    pnpm run build
    cp -r dist/. "$OUT/"
    ;;
  bentopdf)
    git clone --depth 1 --branch main https://github.com/radianceskills-dev/trendy-bentopdf.git "$CACHE/bentopdf"
    cd "$CACHE/bentopdf"
    npm install --legacy-peer-deps
    mkdir -p src/tests
    cp "$ROOT/integrations/bentopdf-ai/workflow-node-execution.test.ts" src/tests/trendy-workflow-node-execution.test.ts
    npx vitest run src/tests/trendy-workflow-node-execution.test.ts
    rm src/tests/trendy-workflow-node-execution.test.ts
    node "$ROOT/integrations/bentopdf-ai/workflow-plan.test.mjs"
    BASE_URL=/tools/bentopdf npm run build
    cp -r dist/. "$OUT/"
    ;;
  squoosh)
    git clone https://github.com/radianceskills-dev/trendy-squoosh.git "$CACHE/squoosh"
    cd "$CACHE/squoosh"
    python - <<'PY'
from pathlib import Path

p = Path('lib/entry-data-plugin.js')
s = p.read_text()
old = "return fileName.replace(/^static\\//, '/');"
new = "return fileName.replace(/^static\\//, (process.env.BASE_URL || '/').replace(/\\/?$/, '/'));"
if old not in s:
    raise SystemExit('Squoosh URL helper signature changed')
p.write_text(s.replace(old, new, 1))

p = Path('src/static-build/index.tsx')
s = p.read_text()
s = s.replace("start_url: '/?utm_medium", "start_url: '/tools/squoosh/?utm_medium", 1)
s = s.replace("action: '/?utm_medium", "action: '/tools/squoosh/?utm_medium", 1)
p.write_text(s)
PY
    npm install
    BASE_URL=/tools/squoosh/ npm run build
    cp -r build/. "$OUT/"
    ;;
  freecut)
    git clone https://github.com/radianceskills-dev/trendy-freecut.git "$CACHE/freecut"
    cd "$CACHE/freecut"
    npm ci || npm install
    node "$ROOT/scripts/adapt-freecut.mjs"
    npm run build
    cp -r dist/. "$OUT/"
    ;;
  omniclip)
    git clone https://github.com/radianceskills-dev/trendy-omniclip.git "$CACHE/omniclip"
    cd "$CACHE/omniclip"
    npm install --package-lock-only --ignore-scripts
    npm ci
    node "$ROOT/scripts/adapt-omniclip.mjs" pre
    npm run build-netlify
    node "$ROOT/scripts/adapt-omniclip.mjs" post
    cp -r x/. "$OUT/"
    ;;
  d2-playground)
    git clone https://github.com/radianceskills-dev/trendy-d2-playground.git "$CACHE/d2-playground"
    cd "$CACHE/d2-playground"
    git submodule update --init --recursive src/js/d2-vscode
    yarn --cwd src/js install --frozen-lockfile
    sed -i 's|fetch("../js/vendor/onig.wasm")|fetch("./js/vendor/onig.wasm?v=2a6cf2d")|' src/js/monaco/index.ts
    sed -i 's|<title>D2 Playground</title>|<title>D2 Playground</title>\n    <link rel="icon" href="favicon.ico" />|' src/index.html
    mkdir -p "$OUT/build" "$OUT/js"
    npx --yes esbuild@0.16.3 src/js/main.js --bundle --minify --define:ENV=\"PRODUCTION\" --loader:.js=jsx --loader:.ttf=base64 --outfile="$OUT/build/out.js"
    npx --yes esbuild@0.16.3 src/css/main.css --bundle --minify --loader:.svg=base64 --loader:.ttf=base64 --outfile="$OUT/build/style.css"
    cp src/index.html "$OUT/"
    cp src/assets/favicon.ico "$OUT/"
    cp -R src/assets src/fonts "$OUT/"
    cp -R src/js/vendor src/js/snippets "$OUT/js/"
    for js in "$OUT"/js/vendor/*.js "$OUT"/js/snippets/*.js; do
      npx --yes esbuild@0.16.3 "$js" --minify --outfile="$js" --allow-overwrite
    done
    sed -i '/data-domain="play.d2lang.com"/d' "$OUT/index.html"
    ;;
  cyberchef)
    git clone --depth 1 --branch main https://github.com/radianceskills-dev/trendy-cyberchef.git "$CACHE/cyberchef"
    cd "$CACHE/cyberchef"
    npm ci
    npm run test:trendy-ai
    npx grunt prod
    cp -r build/prod/. "$OUT/"
    ;;
  minipaint)
    git clone --depth 1 --branch main https://github.com/radianceskills-dev/trendy-minipaint.git "$CACHE/minipaint"
    cd "$CACHE/minipaint"
    npm ci || npm install
    npm run build
    cp index.html "$OUT/"
    cp -r dist images src/css "$OUT/" 2>/dev/null || true
    mkdir -p "$OUT/src"
    cp -r src/css "$OUT/src/"
    ;;
  jupyterlite)
    curl -fsSL https://github.com/radianceskills-dev/trendy-jupyterlite/releases/download/trendy-packages-v0.8.2/jupyterlite-0.8.2-py3-none-any.whl -o "$CACHE/jupyterlite-0.8.2-py3-none-any.whl"
    curl -fsSL https://github.com/radianceskills-dev/trendy-jupyterlite/releases/download/trendy-packages-v0.8.2/jupyterlite_pyodide_kernel-0.8.3-py3-none-any.whl -o "$CACHE/jupyterlite_pyodide_kernel-0.8.3-py3-none-any.whl"
    python -m pip install --disable-pip-version-check "$CACHE/jupyterlite-0.8.2-py3-none-any.whl" "$CACHE/jupyterlite_pyodide_kernel-0.8.3-py3-none-any.whl"
    mkdir -p "$CACHE/jupyterlite-content"
    jupyter lite build --output-dir "$OUT" --contents "$CACHE/jupyterlite-content" --base-url /tools/jupyterlite/
    ;;
  decimen)
    git clone https://github.com/radianceskills-dev/trendy-decimen.git "$CACHE/decimen"
    cd "$CACHE/decimen"
    npm ci || npm install
    sed -i 's/vite build/vite build --base=\/tools\/decimen\//g' package.json
    npm run build
    cp -r dist/. "$OUT/"
    ;;
  bolo)
    git clone https://github.com/radianceskills-dev/trendy-bolo.git "$CACHE/bolo"
    cp "$CACHE/bolo/index.html" "$OUT/"
    ;;
  excalidraw)
    git clone --depth 1 --branch main https://github.com/radianceskills-dev/trendy-excalidraw.git "$CACHE/excalidraw"
    cd "$CACHE/excalidraw"
    yarn install --frozen-lockfile
    node "$ROOT/scripts/adapt-excalidraw.mjs"
    VITE_APP_ENABLE_TRACKING=false VITE_APP_DISABLE_SENTRY=true yarn build:app:docker
    cp -r excalidraw-app/build/. "$OUT/"
    ;;
  openqr)
    git clone --depth 1 --branch main https://github.com/radianceskills-dev/trendy-openqr.git "$CACHE/openqr"
    cd "$CACHE/openqr"
    npm install -g pnpm@10.16.1
    cp "$ROOT/scripts/openqr.next.config.mjs" next.config.mjs
    node "$ROOT/scripts/adapt-openqr.mjs" .
    pnpm install --frozen-lockfile
    pnpm build
    cp -r out/. "$OUT/"
    ;;
  keeweb)
    mkdir -p "$CACHE/keeweb-release"
    curl -fsSL https://github.com/radianceskills-dev/trendy-keeweb/releases/download/trendy-v1.18.9/KeeWeb-1.18.9.html.zip -o "$CACHE/keeweb.zip"
    unzip -q "$CACHE/keeweb.zip" -d "$CACHE/keeweb-release"
    cp -r "$CACHE/keeweb-release"/. "$OUT/"
    ;;
  *)
    echo "Unknown tool: $TOOL" >&2
    exit 1
    ;;
esac
