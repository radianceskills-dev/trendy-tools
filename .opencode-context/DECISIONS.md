# Decisions

## Use GitHub Actions As The Canonical Build

Decision: keep GitHub Actions plus Netlify as the primary build/test/deploy workflow instead of requiring a full local build.

Why:

- The project began as a remote/phone-driven workflow.
- The tools require Linux shell behavior, multiple package managers, Python, release extraction, and browser-specific setup.
- Netlify headers and redirects are part of runtime correctness.
- Production fidelity matters more than reproducing every build locally on Windows.

Rejected alternative: translate and maintain a complete Windows-native build as the required path. A Windows build was explored and quickly exposed unnecessary shell and dependency complexity. Local targeted work remains useful, but is not canonical.

## Split The Monolithic Build Into Independent Jobs

Decision: one matrix job per implemented tool, then one assembly/validation/deploy job.

Why:

- The old workflow rebuilt every tool sequentially and took roughly 20 minutes.
- Parallel jobs make failures attributable to a named tool.
- Per-tool cached outputs let dashboard or unrelated integration changes avoid expensive rebuilds on normal pushes.
- Deployment still needs the whole catalog, so artifacts are assembled behind one final gate.

Rejected alternative: deploy a changed tool independently. That risks publishing a partial or internally inconsistent catalog.

## Keep Explicit Tool-Specific Build Logic

Decision: preserve a case-based `scripts/build-tool.sh` and focused adapters.

Why:

- Build semantics differ substantially across tools.
- Some modules use source builds; others use official release artifacts.
- Some require service-worker, router, import-map, analytics, telemetry, or base-path changes.
- Explicit logic is easier to audit against pinned upstream versions.

Rejected alternative: one generic manifest-driven `npm run build` abstraction. The manifest remains useful for version intent, but is not sufficient to express actual production build behavior.

## Pin Every Upstream Version

Decision: use tags or full commit SHAs; never track upstream `main` or `master` automatically.

Why:

- Reproducibility.
- Adapter assumptions are tied to exact upstream source shapes.
- License and behavior changes should be reviewed deliberately.

## Do Not Commit Generated Tool Bundles

Decision: generated `tools/` outputs are CI artifacts, not repository source.

Why:

- They are large and reproducible.
- Source review should focus on pins, adapters, integrations, and validation.
- Per-tool CI artifacts support modular assembly.

## Shared Browser AI Configuration

Decision: the dashboard owns one browser-local AI setup contract shared by BentoPDF and D2.

Why:

- Users should configure AI once, not separately in each tool.
- The tools remain static/client-side.
- Secrets and auth state stay in the user's browser.

Current options:

- OpenRouter OAuth PKCE with local key storage.
- Puter authentication with no pasted key.
- Manual Custom setup with OpenRouter, B.AI, or another OpenAI-compatible HTTPS endpoint.

Important correction preserved from iteration: OpenCode Zen was removed as a first-class preset. Existing saved OpenCode settings are treated as Custom for migration continuity.

## Defensive Preset Endpoint Resolution

Decision: OpenRouter and B.AI consumers use hard-coded trusted endpoints for those preset IDs, even though local storage also contains endpoint fields.

Why:

- Local storage is user-controlled and may be tampered with.
- Selecting a trusted preset should not silently redirect credentials to an arbitrary endpoint.
- Custom is the explicit escape hatch for user-provided endpoints.

## Keep AI Planning Reviewed And Non-Destructive

Decision: BentoPDF AI proposes workflows; users review and confirm before loading them. Sensitive passwords are collected locally after generation and are not sent to providers or persisted in exported templates.

Why:

- Generated plans can misunderstand requests even when structurally valid.
- PDF workflows can be destructive.
- Secrets should not enter prompts or stored templates.

Related decision: local workflow templates remain usable with no AI provider and should not make AI provider requests.

## Dashboard Visual Direction

Decision: use a light Arctic Frost visual language, not the previous dark generic card grid.

Current intentions:

- Off-white/arctic-grey surfaces, not pure white.
- Editorial/asymmetric cards rather than generic rounded SaaS cards.
- Whole-card navigation for ready tools; no separate Open button.
- BentoPDF and D2 receive visible `AI powered` indicators and featured sizing.
- Card Ready/Soon pills and header ready-count/version-lock pills were removed at user request.

## Dashboard Ask AI Chat

Decision: implement Ask AI only on the main dashboard, with one shared conversation across providers.

Why:

- It is a product-level assistant and should not duplicate tool-specific AI surfaces.
- The user requested one conversation even when the selected transport changes.
- Browser-local IndexedDB keeps the experience persistent without adding a backend.

Implementation constraints:

- Full history is retained locally, but each request sends a recent approximately 3,000-token window.
- The system prompt is stable and placed first to improve the chance of upstream prompt-cache reuse. No changing timestamps or random metadata are added to the prompt prefix.
- Streaming is preferred and normalized across OpenAI-compatible SSE and Puter async iterables.
- Markdown is rendered without a third-party dependency. Output is escaped first; only a deliberately limited safe subset is emitted as HTML.
- The dialog is intentionally not dismissible by backdrop click or Escape. Only the explicit close button closes it.

Rejected alternative: using a Markdown dependency such as `marked` plus `DOMPurify`. The user explicitly preferred a dependency-free dashboard.

## Static Live Capability Catalog

Decision: maintain one hand-authored `ai-capabilities.json` file containing only the 14 currently live tools.

Why:

- The catalog is small and expected to change infrequently.
- One file is easier to review than distributed capability fragments.
- Planned/unbuilt tools must not be recommended by Ask AI.
- Local retrieval provides compact all-tool awareness plus focused details and direct links without a backend or vector database.

The chat keeps a compact index in context and appends focused details for up to four locally ranked tools based on the current user message. The catalog is data, not executable code, and is loaded from the same static origin.

The system prompt explicitly tells smaller models to choose the best live tool, explain the match, include the direct link, avoid invented capabilities, ask a clarification question when needed, and say when no live tool fits. Local ranking expands common synonyms before selecting focused records.

## Netlify Remains The Runtime Host

Decision: keep a single Netlify site and deploy the fully assembled repository root.

Why:

- The site needs route-specific redirects, caching, isolation headers, and CSP.
- All tools share one origin and consistent `/tools/<id>/` routes.

The site was already linked before this development session. No new Netlify project was created.

## Use Pull Requests And Validate Before Merge

Decision: substantial changes are developed on branches, manually dispatch the workflow, inspect failures, then squash-merge after success.

Why:

- Workflow/config changes can break every route or deployment.
- The final GitHub Actions result is the authoritative validation.

Historical correction: local GitHub CLI was initially authenticated as a different account, then deliberately logged out. Later it was authenticated as `radianceskills-dev`, the repository owner, with admin permission. Composio remains a separate connected GitHub account path, but normal repository publication can now use local `gh`.
