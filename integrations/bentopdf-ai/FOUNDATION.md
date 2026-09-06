# Planner foundation — implementation checkpoints

Baseline: Trendy Tools `5587eb4`; BentoPDF v2.8.8 at
`f96cd4e5166f3d51393dfe9f3c440b5bb77802f1`.

This branch does not merge or deploy production. Its focused GitHub Actions job
has read-only permissions, no deployment steps, no provider credentials, and
uses mocked AI responses.

## Checkpoint 1
- Existing validation and control conversions moved into the capability registry.
- Existing Plan v1 API and serialized workflow format retained.
- Focused pull-request/feature-branch CI added.
- Original unit tests pass with the refactor.

## Checkpoint 2
- Plan v2 separates operation IDs/parameters from serialized graph details.
- Missing page selections/text and all rotation values require local clarification.
- Proposal review and explicit acknowledgement precede canvas loading.
- Encryption is last, with local masked passwords; native save/export/import omit secret controls.
- Strict runtime preflight and transactional replacement retain original node objects on failure.
- Replacement is refused for attached files/certificates or active execution.
- 60-second generation timeout, cancellation/stale-response guards, modal focus management.
- Original tests plus new planner/transaction tests pass (25 tests); adapted upstream typechecks.

## Checkpoint 3
- At the foundation milestone, the expanded browser suite covered all 13 then-enabled processing constructors and all three mocked
  providers, review/clarification, secret-free native persistence and error cases.
- Full pinned-source production build passed in CI; local build exceeded sandbox
  resources. Initial Plan v2 browser suite passed in CI.
- Expanded tests corrected for native save-confirmation dismissal and translated
  node labels (the actual English label is "Encrypt PDF", not "Encrypt").
- The latest PR check is authoritative for the expanded browser-suite result.

## Before merging
- Confirm the latest CI check is green and review the UI changes.
- No real-model accuracy or PDF-engine execution claims are made by this suite.

## Limits
- Free-text secret detection is best-effort. Do not paste confidential content into prompts.
- Previously saved templates are not rewritten automatically; old persisted secrets need user-directed cleanup.
- PDF execution engines are not validated by planning/graph-construction tests.
- Rotation is always confirmed locally; language-specific intent inference is not treated as proof.
- No additional nodes are enabled. Shortlisting, recipes, structured output negotiation,
  semantic evaluation and node expansion are later milestones.
- Registry normalization is centralized; a future generic parameter schema can replace its existing switch without changing the public planning contract.
