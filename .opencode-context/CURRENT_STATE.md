# Current State

## Project Snapshot

Trendy Tools is a static, browser-first collection of independently maintained Trendy Tools editions deployed as one Netlify site at `https://trendytools.netlify.app`.

The deployment repository does not contain generated tool bundles. GitHub Actions clones source repositories owned by `radianceskills-dev` or downloads owned release artifacts, adapts them for subpath hosting, builds them, validates the complete assembled site, browser-tests the BentoPDF AI workflow, and deploys the repository root to Netlify.

All 16 manifest tools have public `radianceskills-dev/trendy-<tool>` source repositories. CyberChef, KeeWeb, and JupyterLite build artifacts consumed directly by production are stored as releases on their corresponding owned repositories. Applicable original licenses, notices, copyright statements, and source history remain part of each maintained repository.

The latest verified production deployment at the time this file was written is GitHub Actions run `35731448856` for commit `58a6252`; it completed successfully.

## Implemented Routes

The CI matrix currently produces 14 routes under `tools/`:

- `it-tools`
- `bentopdf`
- `squoosh`
- `freecut`
- `omniclip`
- `d2-playground`
- `cyberchef`
- `minipaint`
- `jupyterlite`
- `decimen`
- `bolo`
- `excalidraw`
- `openqr`
- `keeweb`

The dashboard still represents a 16-tool product vision. `duckdb-wasm` and `web-llm` are listed but are not built by the workflow. They require first-party browser interfaces over library packages before they can become live routes.

## Dashboard

`index.html` is a standalone dashboard with inline CSS and JavaScript.

Current dashboard behavior:

- Light "Arctic Frost" design using off-white and blue-grey surfaces rather than pure white.
- Ready tools use full-card links; there is no separate Open button.
- BentoPDF and D2 Playground are visually featured and marked `AI powered`.
- Card-level Ready/Soon pills and header ready-count/version-lock pills were intentionally removed.
- Search and availability filters remain.
- AI setup uses three tabs: OpenRouter, Puter, and Custom.
- `ai-capabilities.json` is the single hand-maintained catalog for the 14 live tools. Ask AI loads it and uses it for local relevance selection and direct tool links.
- Ask AI's system prompt explicitly requires live-tool selection, capability-grounded answers, direct links, and a clear no-fit response. The compact catalog includes key capability phrases and local ranking expands common task synonyms.
- When AI is configured, the dashboard shows an `Ask AI` floating action button.
- Ask AI is a dashboard-only chat dialog with IndexedDB-persisted history, dependency-free Markdown rendering, OpenAI-compatible SSE streaming, and Puter async-iterable streaming.
- Chat keeps full history locally but sends only a recent context window estimated at approximately 3,000 tokens.
- The chat dialog closes only through its explicit close button; backdrop clicks and Escape do not dismiss it.

## Shared AI Setup

AI settings are stored in browser `localStorage` under `trendytools.ai.v1` and are consumed by the dashboard, BentoPDF integration, and D2 integration.

Supported setup paths:

- OpenRouter browser authentication using OAuth PKCE. The browser exchanges the returned code for a user-controlled key and defaults to `openrouter/free`.
- Puter browser authentication using Puter.js. Tools call `puter.ai.chat()` without a user-pasted API key.
- Custom/manual OpenAI-compatible configuration. The user can choose the OpenRouter or B.AI preset or enter another HTTPS base URL, API key, and model.

Authenticated OpenRouter and Puter tabs load model lists and allow model search and selection. The Custom tab retains manual provider URL, key, and model controls.

BentoPDF and D2 both consume the shared transport contract. Preset endpoints are fixed by the integration code; only a `custom` provider may use its stored endpoint. Legacy saved OpenCode Zen settings are migrated in memory to the Custom transport.

## BentoPDF Customization

BentoPDF is a maintained Trendy Tools source repository. Its owned repository contains:

- A simplified Trendy Tools homepage that prioritizes the PDF Workflow Builder.
- An AI workflow-planning modal and toolbar entry.
- Capability selection and reviewed workflow planning.
- Local templates that do not require an AI provider.
- Local-only collection of sensitive PDF passwords.
- Guards against replacing workflows containing attached files.
- Service-worker cleanup/unregistration behavior.

The workflow validates generated HTML and bundle markers and runs `integrations/bentopdf-ai/browser-test.cjs` with mocked providers.

## D2 Customization

D2 Playground is a maintained Trendy Tools source repository containing the AI panel. The AI creates complete D2 source and replaces the current diagram only after confirmation. Production analytics are removed. Monaco's WASM path is patched for the `/tools/d2-playground/` route.

## Known Issues And Incomplete Work

- DuckDB-Wasm and WebLLM have manifest/dashboard entries but no production build modules or first-party UIs.
- Changes made directly in an owned tool repository do not automatically trigger this deployment repository. Run `build-and-deploy.yml` manually, or add an explicit cross-repository dispatch workflow when automatic tool-source deployments are needed.
- The central build no longer runs the BentoPDF or D2 production adapters. Those files remain migration references; production AI source is committed in the owned repositories.
- CyberChef AI recipe builder is committed in `radianceskills-dev/trendy-cyberchef` at `dd79de5c`. The production build now compiles that owned source rather than downloading the preserved baseline ZIP.
- The root `README.md` has some stale wording/version information. For example, it still describes a monolithic build and lists KeeWeb as `v1.18.7`, while the actual build uses the `v1.18.9` official web artifact. Treat workflow scripts and this context as the current source of truth until README cleanup is done.
- GitHub Actions emits warnings that several actions still target deprecated Node.js 20 internally and that `ubuntu-latest` will migrate to Ubuntu 26. These are warnings, not current failures.
- The AI flows have CI coverage for generated transports and mocked BentoPDF behavior, but real interactive OpenRouter and Puter sign-in still require manual browser verification when those providers change behavior.
- The new dashboard chat has local syntax/HTTP checks but does not yet have a dedicated browser test for IndexedDB persistence, Markdown rendering, SSE chunking, Puter streaming, or the close-only behavior.
- The change detector does not treat `netlify.toml`, `index.html`, or `scripts/validate-build.sh` as reasons to rebuild tool bundles. This is intentional for dashboard/config-only changes because cached tool outputs are assembled with the current checkout. If future changes make those files alter generated tool contents, update `scripts/should-build-tool.sh`.

## Likely Next Steps

- Implement and validate the DuckDB-Wasm SQL workspace.
- Implement and validate the WebLLM local-chat workspace.
- Add focused dashboard browser tests, especially for tab visibility, OpenRouter callback state, and Puter model selection.
- Add focused dashboard chat browser tests for IndexedDB persistence, context trimming, Markdown safety, streaming, and close behavior.
- Keep the live capability catalog current when a tool's user-facing capabilities or route changes.
- The catalog and system prompt are deliberately included in the outbound context; the complete system/catalog prompt is counted against the approximately 3,000-token budget before older chat history.
- Clean up stale README and manifest `build` descriptions where they no longer match the actual scripts.
- Consider removing obsolete dashboard CSS constants left behind by iterative redesign only when visual regression risk is controlled.
