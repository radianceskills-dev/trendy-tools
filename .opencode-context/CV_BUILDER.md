# CV Builder

Owned source: `radianceskills-dev/trendy-cv`, derived from Reactive Resume at `1fc835e5f` with original history and MIT license retained.

Static app: `apps/trendy-cv`. Uses the existing schema, import, and browser PDF packages; no auth, server, or database service is needed by this entry point. Build with Node 24 / pnpm 12.6.0, filtered install, then `pnpm --filter trendy-cv build`.

Route: `/tools/cv-builder/`. Added as an independent matrix job; existing assembly and browser-test gates remain. App smoke test runs before artifact upload.

Features: structured editor, 15 design choices, simple/sidebar/two-page starting layouts, six palettes, standard PDF fonts, A4/Letter, manual section-to-page assignment, IndexedDB draft, full JSON backup, JSON Resume import, and reviewed selected-text AI rewrites through shared settings.

Limits: manual preview refresh, no automatic overflow guarantees, no JSON Resume export yet, no photo/custom-section UI, no whole-CV AI review. Do not advertise those as implemented. AI must not invent facts or transmit unselected contact/section data.
