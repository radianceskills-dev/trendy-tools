# Trendy Tools — Implementation Plan

## Definition of done
A tool is marked **Live** only when all of the following are true:

1. Its exact upstream release tag or commit SHA is recorded in `tools-manifest.json`.
2. Its static output is served from `/tools/<tool-id>/` without root-path asset collisions.
3. Opening the tool route and its JavaScript/CSS/WASM assets returns HTTP 200.
4. The primary customer workflow is tested in a browser.
5. Its upstream license and source attribution are included in the application.

## Architecture

- **Single Netlify site:** `trendytools.netlify.app`
- **One independently built route per tool:** `/tools/<tool-id>/`
- **Tool-specific build adapters:** no generic `npm run build` assumption
- **Version locking:** tag or full commit SHA only; never `main`/`master`
- **Deployment gate:** an incomplete build must fail the deployment rather than publish a partial catalog
- **Customer-facing wrappers:** DuckDB-Wasm and WebLLM are libraries, so Trendy Tools will provide a small first-party browser UI pinned to the chosen library version.

## Work batches

### Batch 1 — Direct static applications
1. IT-Tools
2. CyberChef
3. miniPaint
4. Decimen
5. Bolo
6. JupyterLite

### Batch 2 — Direct applications requiring path/build adaptation
7. BentoPDF
8. Squoosh
9. FreeCut
10. Omniclip
11. Excalidraw
12. D2 Playground
13. OpenQR
14. KeeWeb

### Batch 3 — First-party browser interfaces over libraries
15. DuckDB-Wasm SQL workspace
16. WebLLM local-chat workspace

## Current rule
No card is labelled Live until it passes the above acceptance checks. This replaces the earlier partial-build approach, which could publish 404s or broken assets.
