# Milestone 2: conservative shortlisting and local templates

Foundation base: `ef8e4f059ff0b24de3c1782c9db6b469a718a933` (PR #1).

## Scope
- This shortlisting milestone introduced no PDF engine or node changes. Later node expansions are documented separately.
- English operation/alias hints live in the frozen capability registry.
- Clear requests get a subset of detailed parameter descriptions, while every
  enabled operation name remains in a compact catalog index.
- Negation, unknown clauses, non-English text, complex requests and known
  ambiguities fall back to full details. No second AI call happens automatically.
- Missing likely requested operations and unexpected proposed operations block
  loading for high-confidence requests. Explicit full-detail retry preserves these
  guards. This is lexical checking, NOT proof of semantic correctness.
- Templates (merge/number/compress, rotate/compress, watermark/compress and
  merge/protect) work without provider settings. Choices/passwords stay local;
  the existing review and safe replacement path is reused.
- PR-only CI removes duplicate cancelled push checks on feature branches.

## Validation
Run `node --test integrations/bentopdf-ai/*.test.mjs` and
`node integrations/bentopdf-ai/selection-evaluation.mjs` on Node 24.

The evaluation reports fixture coverage, fallback frequency, extra candidates and
character counts. It compares against both this revision's full prompt and the
measured foundation baseline (3,012 characters), so the added catalog index does
not artificially inflate the reported improvement. These are not token counts,
latency/cost measurements, or real-model accuracy claims. Fallback-to-full counts
as candidate coverage and is reported separately.

Browser checks include all four templates without provider configuration on a
390px mobile viewport, explicit widening after an omitted operation, and refusal
to replace a canvas holding a synthetic PDF. All provider traffic is mocked;
unrecognized external traffic is blocked.

## Limits
English keyword heuristics can produce false positives or miss paraphrases.
Quoted values and known ambiguities get conservative handling, but user review
is always required. Multilingual semantic matching, recipes beyond these four,
structured-output negotiation and real-model evaluation are future work.
