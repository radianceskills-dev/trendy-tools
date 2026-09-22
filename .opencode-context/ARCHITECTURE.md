# Architecture

## System Shape

Trendy Tools is one static site, but it is not one application build. It is a composition of independently sourced and independently built browser applications mounted beneath a shared dashboard:

```text
index.html
tools/
  it-tools/
  bentopdf/
  ...
netlify.toml
```

The source repository contains the dashboard, version manifest, adapters, integrations, validation, and deployment workflow. Generated `tools/` output is ephemeral CI output and is deliberately not committed.

This boundary exists because the upstream projects use different frameworks, package managers, runtime versions, release formats, base-path assumptions, service workers, and browser security requirements. A generic "clone and npm build" abstraction would hide important per-tool behavior and make failures harder to diagnose.

## Primary Boundaries

### Dashboard Boundary

`index.html` is a first-party static application and product catalog. It owns:

- Tool discovery and navigation.
- Availability display.
- Shared AI provider configuration.
- Dashboard-only Ask AI chat, including IndexedDB history and browser-side streaming.
- The visual identity of Trendy Tools.

It does not contain or proxy the third-party tools. Ready cards link directly to `/tools/<id>/`.

The dashboard is intentionally plain HTML/CSS/JavaScript. Introducing a framework would add a build system for a page that currently deploys directly and would couple dashboard iteration to package management without a demonstrated need.

### Tool Build Boundary

Each implemented tool is one module in `scripts/build-tool.sh`. A module owns:

- Its exact upstream repository/release URL and ref.
- Its package manager and runtime assumptions.
- Subpath adaptation for `/tools/<id>/`.
- Output copying into `tools/<id>/`.

This explicit case-based script is intentional. Do not replace it with a generic manifest executor unless every tool-specific behavior remains visible, testable, and failure-isolated.

### Adapter Boundary

Files under `scripts/adapt-*.mjs` mutate temporary upstream checkouts at build time. The repository does not fork or vendor whole upstream applications.

Why this boundary exists:

- Upstream sources remain pinned and reproducible.
- Trendy Tools changes remain reviewable as small adapters.
- Route fixes, privacy changes, and product integrations can be reapplied when upgrading a pin.
- Signature checks fail loudly when an upstream ref no longer matches adapter assumptions.

### Integration Boundary

Files under `integrations/` are first-party product features injected into upstream applications.

- `integrations/bentopdf-ai/` contains the reviewed AI workflow system, tests, templates, capability registry, and browser test.
- `integrations/bentopdf-home/` contains homepage and service-worker adaptations.
- `integrations/d2-ai/` contains the D2 AI panel, transport behavior, and styling.

The shared browser AI setting is a cross-module contract. Dashboard schema changes must be checked against both BentoPDF and D2 consumers.

### Deployment Assembly Boundary

Individual matrix jobs never deploy independently. They upload one artifact each. `assemble-validate-deploy` downloads all 14 outputs, restores the required directory layout, validates the complete batch, runs the BentoPDF browser test, and only then performs a production deploy.

This complete-batch gate prevents a successful partial build from publishing a dashboard with broken tool routes.

## Module Map And Dependencies

| Module | Upstream form | Build/adaptation dependency | Output |
|---|---|---|---|
| IT-Tools | Git tag | Vite base-path patch | `tools/it-tools/` |
| BentoPDF | Git tag | `adapt-bentopdf-ai.mjs`, `adapt-bentopdf-home.mjs`, both Bento integrations, tests | `tools/bentopdf/` |
| Squoosh | Git commit | Python source patch for static URLs/PWA paths | `tools/squoosh/` |
| FreeCut | Git commit | `adapt-freecut.mjs`, PWA/router/subpath changes | `tools/freecut/` |
| Omniclip | Git commit | `adapt-omniclip.mjs`, telemetry removal, import-map/vendor rewrite | `tools/omniclip/` |
| D2 Playground | Git commit + submodule | `adapt-d2-ai.mjs`, D2 integration, Monaco path patch | `tools/d2-playground/` |
| CyberChef | Official ZIP | Release extraction only | `tools/cyberchef/` |
| miniPaint | Git tag | Upstream build plus static source-relative assets | `tools/minipaint/` |
| JupyterLite | Python packages | Python 3.12, JupyterLite/Pyodide build | `tools/jupyterlite/` |
| Decimen | Git commit | Vite base-path patch | `tools/decimen/` |
| Bolo | Git commit | Copy standalone HTML | `tools/bolo/` |
| Excalidraw | Git tag | Node 22, `adapt-excalidraw.mjs`, tracking disabled | `tools/excalidraw/` |
| OpenQR | Git tag | pnpm 10.16.1, custom Next config, `adapt-openqr.mjs` | `tools/openqr/` |
| KeeWeb | Official ZIP | Release extraction only | `tools/keeweb/` |

Planned but unimplemented modules:

- DuckDB-Wasm: requires a first-party SQL workspace rather than exposing only a library package.
- WebLLM: requires a first-party local-chat workspace rather than exposing only a library package.

## Shared Dependencies

The build environment uses:

- Ubuntu GitHub-hosted runners.
- Node.js 24 globally.
- Node.js 22 specifically for Excalidraw.
- Python 3.12 for JupyterLite and Squoosh patching.
- npm, pnpm, Yarn, Git, curl, unzip, esbuild, and Chrome/Chromium.

The runtime site is static. It has no application backend. AI provider calls originate from the user's browser.

## Routing And Browser Security

`netlify.toml` is part of the architecture, not incidental hosting configuration.

- Excalidraw, IT-Tools, and FreeCut receive SPA fallbacks.
- FreeCut and Omniclip receive COOP/COEP headers for workers, WASM threads, WebCodecs, and related browser features.
- BentoPDF and D2 permit HTTPS `connect-src` because users may configure OpenAI-compatible providers and Puter/OpenRouter auth uses external services.
- HTML, service workers, and general tool routes are not cached aggressively during integration work.
- Content-hashed assets beneath `/tools/*/assets/*` may be cached immutably.

Do not flatten these rules into one global policy. The route-specific behavior exists because tools have materially different browser requirements.

## Shared AI Contract

The dashboard writes `trendytools.ai.v1`. Current settings distinguish transports:

- `transport: "openai"`: includes provider, model, API key, and endpoint/base URL.
- `transport: "puter"`: includes Puter provider identity and selected model; no pasted key.

OpenRouter preset requests must use the fixed OpenRouter endpoint even if stored endpoint data is tampered with. B.AI behaves similarly. Only Custom trusts a stored HTTPS endpoint.

This defensive resolution belongs in each consumer because browser local storage is user-controlled and should not be treated as authoritative for preset endpoints.

## Dashboard Chat Boundary

The Ask AI chat is intentionally implemented inside the standalone dashboard rather than injected into every tool. It is a product-level assistant, not a replacement for tool-specific AI workflows.

- The floating button is visible only when a valid shared AI setting exists.
- Full chat history is stored in IndexedDB (`trendytools-chat`, `messages` store), not localStorage and not a server.
- The active request uses a stable system prompt plus the newest messages that fit an estimated 3,000-token budget. Older history remains persisted but is omitted from the active request.
- OpenAI-compatible providers stream SSE `data:` chunks; Puter streams async iterable chunks. Both are normalized into incremental assistant text.
- Markdown is rendered by a small dependency-free renderer with escaped text, limited Markdown constructs, and HTTPS-only external links.
- The native dialog cancel event is prevented so only the explicit close button dismisses the chat.
