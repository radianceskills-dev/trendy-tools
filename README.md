# Trendy Tools

A self-hosted, version-locked collection of 16 browser-only open-source tools. All processing happens client-side -- no server, no uploads, no tracking.

Live at: [trendytools.netlify.app](https://trendytools.netlify.app)

## How It Works

1. **Dashboard** (`index.html`) -- a static hub page linking to all 16 tools
2. **tools-manifest.json** -- pins each tool to a specific git tag or commit
3. **GitHub Actions** -- clones, builds, and deploys all tools to Netlify on push
4. **Version locked** -- tools never auto-update; you choose when to upgrade

## Tools Included

| # | Tool | Category | Version | License |
|---|------|----------|---------|--------|
| 1 | BentoPDF | PDF / Documents | v2.8.8 | AGPL-3.0 |
| 2 | IT-Tools | Developer Utilities | v2024.10.22 | GPL-3.0 |
| 3 | CyberChef | Data / Crypto / Encoding | v11.3.0 | Apache-2.0 |
| 4 | Squoosh | Image Optimization | commit-pinned | Apache-2.0 |
| 5 | miniPaint | Image Editing | v4.14.3 | MIT |
| 6 | FreeCut | Video Editing | commit-pinned | MIT |
| 7 | Omniclip | Video Editing | commit-pinned | MIT |
| 8 | Excalidraw | Whiteboarding / Diagrams | v0.18.1 | MIT |
| 9 | D2 Playground | Diagram-as-Code | commit-pinned | BSD-2-Clause |
| 10 | JupyterLite | Coding / Python | v0.8.2 | BSD-3-Clause |
| 11 | DuckDB-Wasm | Data Analysis / SQL | v1.33.0 | MIT |
| 12 | OpenQR | QR Utilities | v1.0.0 | AGPL-3.0 |
| 13 | Decimen | QR File Transfer | commit-pinned | MIT |
| 14 | KeeWeb | Password Vault | v1.18.7 | MIT |
| 15 | WebLLM | Local AI | v0.2.83 | Apache-2.0 |
| 16 | Bolo | Screen Recording | commit-pinned | MIT |

## Deployment

Push to `main` triggers GitHub Actions which builds all tools and deploys to Netlify.

To upgrade a tool: update its `ref` in `tools-manifest.json` and push.

## License

Dashboard and build infrastructure: MIT. Each tool retains its original license.
