# Build And Deploy

## Canonical Build Environment

GitHub Actions is the canonical build environment. Local full-site builds are optional diagnostics, not the required development path.

This was a deliberate decision. The original project was developed remotely, including from a phone, and the production pipeline already handles Linux shell behavior, multiple package managers, Python tooling, release downloads, browser/WASM requirements, and Netlify deployment. Requiring every contributor to reproduce all of that on Windows would add complexity without improving production fidelity.

Use local development for dashboard work, adapter syntax, focused tests, and targeted builds when practical. Use GitHub Actions and the deployed URL for authoritative full-batch validation.

## Workflow Triggers

`.github/workflows/build-and-deploy.yml` runs on:

- Pushes to `main` when one of these paths changes:
  - `index.html`
  - `ai-capabilities.json`
  - `tools-manifest.json`
  - `.github/workflows/build-and-deploy.yml`
  - `netlify.toml`
  - `integrations/**`
  - `scripts/**`
- Manual `workflow_dispatch` on any selected ref.

The workflow does not currently trigger automatically for pull requests. During development, branch validation has been started manually with:

```powershell
gh workflow run build-and-deploy.yml --ref <branch>
```

## Parallel Tool Jobs

`build-tool` is a 14-entry matrix. Each job:

1. Checks out full history because change detection compares refs.
2. Sets up Node 24 and Python 3.12.
3. Switches to Node 22 for Excalidraw.
4. Installs pnpm and unzip.
5. Restores the most recent `tools/<tool>` cache.
6. Decides whether the tool must rebuild.
7. Runs `scripts/build-tool.sh <tool>` if needed.
8. Saves a new per-tool cache only after a rebuild.
9. Uploads artifact `tool-<tool>` with seven-day retention.

## Change Detection

`scripts/should-build-tool.sh` determines module impact.

All tools rebuild when one of these changes:

- `.github/workflows/build-and-deploy.yml`
- `scripts/build-tool.sh`
- `scripts/should-build-tool.sh`

Tool-specific rebuilds:

- BentoPDF: `scripts/adapt-bentopdf-*` or `integrations/bentopdf-*`
- D2 Playground: `scripts/adapt-d2-ai.mjs` or `integrations/d2-ai/`
- FreeCut: `scripts/adapt-freecut.mjs`
- Omniclip: `scripts/adapt-omniclip.mjs`
- Excalidraw: `scripts/adapt-excalidraw.mjs`
- OpenQR: `scripts/adapt-openqr.mjs` or `scripts/openqr.next.config.mjs`

If `tools-manifest.json` changes, the script compares the previous and current JSON entry for each tool and rebuilds only entries that changed.

Manual dispatch always rebuilds every tool. A missing cached `index.html` also forces a rebuild.

Dashboard-only changes still execute all matrix jobs, but unchanged tools normally restore cached outputs rather than rebuilding on `main` push. A manual branch dispatch rebuilds all tools by design.

The dashboard Ask AI chat is first-party inline dashboard code. It does not add a package dependency or a generated tool build. Changes to it still redeploy the complete site, but normally do not require rebuilding unchanged tool outputs on a normal `main` push.

`ai-capabilities.json` is deployed as a root static asset and is a workflow trigger. Updating it redeploys the dashboard without requiring third-party tool bundle rebuilds on a normal `main` push.

## Artifact Assembly

The final job downloads all `tool-*` artifacts into `tools/`, then renames:

```text
tools/tool-bentopdf -> tools/bentopdf
```

and likewise for every matrix module.

The checkout supplies the current dashboard, Netlify configuration, integrations, and scripts. Artifacts supply generated third-party tool routes.

## Validation Gate

`scripts/validate-build.sh` verifies:

- Every implemented route has `index.html`.
- Required subpath rewrites are present.
- BentoPDF product customizations and AI transport markers are present.
- D2 integration, WASM path fixes, AI markers, and analytics removal are present.
- FreeCut service worker exists.
- Omniclip nested vendored dependencies and isolation worker exist.
- CyberChef, miniPaint, Excalidraw, OpenQR, and KeeWeb expected assets exist.

Validation intentionally uses stable generated markers. Bundlers may minify variable/property names, so avoid assertions against source-only identifiers such as `settings.endpoint` unless the literal is guaranteed to survive production bundling.

After static validation, the final job runs the BentoPDF browser test using Playwright Core and a runner-provided Chrome/Chromium binary. It clones and installs BentoPDF source separately because the test needs upstream locale files and `pdf-lib`, which are not all present in the static artifact.

## Deployment

Only the final job deploys. It uses `nwtgck/actions-netlify@v3` with:

- `publish-dir: .`
- `production-deploy: true`
- `NETLIFY_AUTH_TOKEN` repository secret
- `NETLIFY_SITE_ID` repository secret

The linked Netlify project is `trendytools` with production URL `https://trendytools.netlify.app` and site ID `25425031-1c38-4531-8f1c-776cc2e3a5ee` as observed during project setup. Secret values cannot be read back from GitHub; successful workflow deployments are the evidence that the linkage is valid.

Manual branch dispatches currently use `production-deploy: true` as well. In this project, feature-branch validation runs have therefore deployed to the production Netlify site before merge. This behavior is factual and potentially surprising. Changing it to deploy previews would be reasonable future work, but must be an explicit product/deployment decision.

## Local Development

The dashboard can be served directly:

```powershell
py -m http.server 8080 --bind 127.0.0.1
```

This validates only the dashboard unless `tools/` outputs already exist.

A plain Python server does not reproduce Netlify redirects or headers. In particular, it does not supply SPA fallbacks, COOP/COEP, or Netlify CSP rules. Do not treat successful local static serving as proof that FreeCut, Omniclip, or all SPA routes work correctly.

The build scripts are Bash/Linux-oriented. On Windows, Git Bash may perform syntax checks, but the complete canonical run is GitHub Actions on Ubuntu. WSL is not assumed to be installed.

## Known Build Quirks

- BentoPDF requires `npm install --legacy-peer-deps`; install-time hooks are important.
- OpenQR requires pnpm `10.16.1`.
- Excalidraw requires Node 22 rather than the workflow's Node 24 default.
- Omniclip's lock metadata is repaired with `npm install --package-lock-only --ignore-scripts` before `npm ci`.
- Omniclip directories named `node_modules` are renamed to `vendor` because Netlify recursively excludes `node_modules` directories.
- Squoosh is old/pinned and requires source patching before build.
- D2 requires a recursive submodule, esbuild `0.16.3`, and a patched Monaco `onig.wasm` path.
- JupyterLite is built from pinned Python packages, not an upstream repository checkout.
- CyberChef and KeeWeb use official ZIP artifacts rather than source builds.
- Git tags may resolve through tag objects, producing harmless "tag is not a commit" checkout warnings.

## Do Not Simplify Away

- The final complete-batch deployment gate.
- Per-tool artifacts and cache isolation.
- Tool-specific runtimes and package-manager versions.
- Adapter signature checks.
- Browser validation of BentoPDF.
- Route-specific Netlify headers and redirects.
- Pinned refs and explicit manual upgrades.
