#!/usr/bin/env bash
set -euo pipefail

for tool in it-tools bentopdf squoosh freecut omniclip d2-playground cyberchef minipaint jupyterlite decimen bolo excalidraw openqr keeweb; do
  test -f "tools/$tool/index.html"
done

grep -q '/tools/it-tools/' tools/it-tools/index.html
grep -q '/tools/bentopdf/' tools/bentopdf/index.html
grep -q 'id="trendy-bentopdf-workflow-first"' tools/bentopdf/index.html
grep -q 'AI-powered' tools/bentopdf/index.html
grep -q 'All PDF tools' tools/bentopdf/index.html
! grep -q 'id="donation-ribbon"' tools/bentopdf/index.html
! grep -q 'id="features-section"' tools/bentopdf/index.html
! grep -q 'id="security-compliance-section"' tools/bentopdf/index.html
! grep -q 'id="faq-accordion"' tools/bentopdf/index.html
! grep -q 'id="testimonials-section"' tools/bentopdf/index.html
test -f tools/bentopdf/pdf-workflow.html
grep -q 'id="trendy-ai-workflow-button"' tools/bentopdf/pdf-workflow.html
grep -q 'id="trendy-ai-workflow-modal"' tools/bentopdf/pdf-workflow.html
grep -Rq 'trendytools.ai.v1' tools/bentopdf/assets
grep -Rq 'openrouter.ai/api/v1/chat/completions' tools/bentopdf/assets
grep -Rq 'api.b.ai/v1/chat/completions' tools/bentopdf/assets
grep -Rq 'Custom provider' tools/bentopdf/assets
grep -Rq 'https://js.puter.com/v2/' tools/bentopdf/assets
grep -Rq 'RotateNode may only be used' tools/bentopdf/assets
grep -q '/tools/squoosh/' tools/squoosh/index.html
grep -q '/tools/freecut/' tools/freecut/index.html
test -f tools/freecut/sw.js
grep -q '"/tools/omniclip/vendor/sparrow-rtc/"' tools/omniclip/importmap.json
grep -q '/tools/omniclip/vendor/sparrow-rtc/vendor/@benev/slate/' tools/omniclip/importmap.json
test -f tools/omniclip/vendor/@benev/slate/x/index.js
test -f tools/omniclip/vendor/sparrow-rtc/vendor/@benev/slate/x/tools/data/hex.js
test -f tools/omniclip/coi-serviceworker.js
test -f tools/d2-playground/build/out.js
test -f tools/d2-playground/build/style.css
test -f tools/d2-playground/build/out.css
grep -q './js/vendor/onig.wasm?v=2a6cf2d' tools/d2-playground/build/out.js
! grep -q '../js/vendor/onig.wasm' tools/d2-playground/build/out.js
test -f tools/d2-playground/js/vendor/onig.wasm
grep -q 'id="ai-create-panel"' tools/d2-playground/index.html
grep -q 'trendytools.ai.v1' tools/d2-playground/build/out.js
grep -q 'openrouter.ai/api/v1/chat/completions' tools/d2-playground/build/out.js
grep -q 'api.b.ai/v1/chat/completions' tools/d2-playground/build/out.js
grep -q 'Custom provider' tools/d2-playground/build/out.js
grep -q 'https://js.puter.com/v2/' tools/d2-playground/build/out.js
grep -q '#ai-create-panel' tools/d2-playground/build/style.css
! grep -q 'data-domain="play.d2lang.com"' tools/d2-playground/index.html
grep -q '/tools/decimen/' tools/decimen/index.html
test -f tools/cyberchef/assets/main.js
test -f tools/minipaint/dist/bundle.js
grep -q '/tools/excalidraw/' tools/excalidraw/index.html
test -f tools/excalidraw/manifest.webmanifest
grep -q '/tools/openqr/_next/' tools/openqr/index.html
for asset in openqr-logo-stacked.svg openqr-logo-stacked-dark.svg favicon.svg favicon.ico apple-touch-icon.png; do
  test -f "tools/openqr/$asset"
done
grep -q '/tools/openqr/openqr-logo-stacked.svg' tools/openqr/index.html
grep -q '/tools/openqr/openqr-logo-stacked-dark.svg' tools/openqr/index.html
grep -q '/tools/openqr/favicon.svg' tools/openqr/index.html
grep -q '/tools/openqr/favicon.ico' tools/openqr/index.html
grep -q '/tools/openqr/apple-touch-icon.png' tools/openqr/index.html
! grep -q 'src="/openqr-logo-stacked' tools/openqr/index.html
! grep -q 'href="/favicon' tools/openqr/index.html
! grep -q 'href="/apple-touch-icon' tools/openqr/index.html
test -f tools/keeweb/service-worker.js
grep -q '1.18.9' tools/keeweb/service-worker.js
