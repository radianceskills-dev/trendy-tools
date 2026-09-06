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

## Remaining before review readiness
- Plan v2 metadata, clarification and review UI.
- Local password fields and secret filtering on native save/export/import.
- Strict runtime preflight and safe canvas replacement.
- Default-deny browser test networking and expanded tests.
- Typecheck/build and browser verification in CI.

No additional nodes are enabled in this milestone. Shortlisting, recipes,
provider capability negotiation and node expansion are subsequent milestones.
