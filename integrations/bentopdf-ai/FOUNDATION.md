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

## Remaining before review readiness
- Built-app browser verification, including persistence and all three mocked providers.
- Review focused CI results and production workflow compatibility.

## Limits
- Free-text secret detection is best-effort. Do not paste confidential content into prompts.
- Previously saved templates are not rewritten automatically; old persisted secrets need user-directed cleanup.
- PDF execution engines are not validated by planning/graph-construction tests.
- Rotation is always confirmed locally; language-specific intent inference is not treated as proof.
- No additional nodes are enabled. Shortlisting, recipes, structured output negotiation,
  semantic evaluation and node expansion are later milestones.
- Registry normalization is centralized; a future generic parameter schema can replace its existing switch without changing the public planning contract.
