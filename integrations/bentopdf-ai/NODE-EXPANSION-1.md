# Node expansion 1: page structure and cleanup

Base: `3e083ab70f68d755c2d4f35b62d4dd0a1f2eafc4` (released PR #2).

## Enabled operations

- `reverse_pages` → upstream `ReversePagesNode`; no parameters.
- `remove_annotations` → upstream `RemoveAnnotationsNode`; no parameters.
- `add_blank_page` → upstream `AddBlankPageNode`.
  - `blankPosition` is required and must be `start`, `end`, or `after`.
  - `afterPage` is required only when position is `after`.
  - `count` defaults to 1 and is limited to 1–100.

This raises the enabled processing catalog from 13 to 16 operations. Plan v2
still permits at most 12 processing steps, so generated workflows remain within
the existing 14-node input/processing/download safety ceiling.

## Safety and wording

- Reverse Pages explicitly warns that first and last page positions swap.
- Remove Annotations warns that all page annotations are removed and that this
  is not content redaction.
- Blank-page position is never inferred from silence; the review UI asks the
  user. An `after` proposal without a page number is also blocked for local
  clarification.
- The selector has reviewed English aliases and bounded flexible patterns for
  phrases such as “insert two blank pages” and “remove all annotations.”
- The complete compact operation-name catalog remains visible to the provider;
  detailed controls are shortlisted only under the existing confidence rules.

## Real PDF-output fixtures

`workflow-node-execution.test.ts` is copied temporarily into the pinned upstream
BentoPDF test tree and executed by Vitest in both focused PR CI and the
production build. It uses synthetic, in-memory PDFs and verifies output bytes:

1. Three distinct page widths are reversed to prove real page order changed.
2. A low-level page annotation dictionary is present before execution and absent
   after Remove Annotations.
3. Two blank pages are inserted after page 1, with page count, dimensions,
   ordering, and output filename checked after reloading the saved PDF.

The loader's optional qpdf repair path is mocked to direct `pdf-lib` loading so
these deterministic tests exercise the node transformations without loading a
browser WASM repair engine. No user files, network providers, or external AI
services are involved.
