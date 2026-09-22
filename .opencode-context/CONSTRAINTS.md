# Constraints

Treat these as hard invariants unless the user explicitly changes the product architecture.

## Product And Privacy

- Tools must remain browser-first. Do not add server-side document/media processing as a convenience refactor.
- Do not upload user files to a Trendy Tools backend; no such backend currently exists.
- Preserve removal/disablement of upstream analytics and telemetry where adapters currently enforce it.
- AI keys/auth state remain browser-local. Never commit, log, or embed user credentials.
- Custom AI endpoints must use HTTPS.
- OpenRouter and B.AI preset IDs must resolve to their trusted fixed endpoints, not arbitrary stored endpoint values.

## Versioning And Upstream Sources

- Every live tool must be pinned to an exact release tag or full commit SHA.
- Never switch a pin to upstream `main` or `master` for convenience.
- Do not auto-update dependencies or pins without an explicit upgrade decision and validation.
- Preserve each upstream license and attribution.
- Do not vendor broad upstream source trees into this repository when a build adapter is sufficient.

## Build And Deployment

- GitHub Actions is the canonical full build.
- A deploy must contain the complete validated implemented catalog, not only changed modules.
- Do not remove the final assembly, static validation, or BentoPDF browser-test gates.
- Do not deploy from an incomplete or failed matrix.
- Generated `tools/` output is not source and should not be committed by default.
- Keep tool outputs isolated under `/tools/<tool-id>/`; root-relative asset collisions are release blockers.
- Preserve per-tool cache/artifact separation.
- Preserve Node 22 for Excalidraw unless a tested pin upgrade removes that requirement.
- Preserve pinned package-manager/tool versions where explicitly specified, especially OpenQR pnpm and D2 esbuild.

## Adapters And Integrations

- Adapter failures caused by missing expected upstream text must fail the build. Do not convert signature checks to silent best-effort replacements.
- Changes to the shared AI settings schema must be reviewed against both BentoPDF and D2 consumers.
- BentoPDF password fields remain local-only and must not enter provider prompts, persisted templates, or exported workflow JSON.
- BentoPDF AI must not replace an existing workflow containing attached files.
- Local BentoPDF templates must continue to work with no AI provider configuration.
- Preserve D2 analytics removal and the Monaco `onig.wasm` route fix.
- Preserve Omniclip's nested dependency/vendor rewrite; Netlify excludes `node_modules` directories.
- Preserve FreeCut and Omniclip cross-origin isolation headers.

## Dashboard

- Keep the dashboard usable on desktop and mobile.
- Keep full-card navigation for ready tools.
- Keep BentoPDF and D2 visibly identified as AI-powered unless those features are removed.
- Do not reintroduce the Ready/Soon card pills or the ready-count/version-lock header pills without explicit user direction.
- Preserve the light Arctic Frost direction: off-white and arctic-grey surfaces rather than stark white or the former dark theme.
- Keep OpenRouter, Puter, and Custom as distinct AI setup tabs. Only the active tab's controls should be visible.
- Show the dashboard `Ask AI` action only when a valid AI configuration exists.
- Ask AI is dashboard-only for now; do not inject it into every tool.
- Persist chat history in IndexedDB, not a server and not API-key storage.
- Preserve full local history while trimming only the outbound context to approximately 3,000 estimated tokens.
- Keep the chat dialog open on backdrop clicks and Escape; only its explicit close button may dismiss it.
- Keep Markdown rendering dependency-free and escape user/model text before rendering the supported subset.
- Preserve streaming behavior for both OpenAI-compatible and Puter transports.

## Netlify Runtime Rules

- `netlify.toml` route-specific headers and redirects are functional requirements.
- Do not replace all route rules with one broad fallback/header policy.
- Do not mark un-hashed tool routes or HTML/service-worker files immutable.
- Keep SPA fallbacks for the tools that need them.
- Keep HTTPS provider connectivity for BentoPDF and D2 AI unless the provider architecture changes.

## Validation Discipline

- For substantial changes, use a branch and PR, run the full workflow manually if necessary, and inspect the final assembly job before merge.
- A locally served dashboard does not prove Netlify routing/header correctness.
- Generated-bundle checks must use literals stable after minification.
- If a test allows an external request, allow the narrowest known hostname/URL rather than broadly disabling the assertion.
- Do not claim an interactive OAuth/provider flow works solely because static CI passed; mark real-provider verification separately when relevant.
