# Agent Context Router

Read the relevant context before changing this repository:

- `.opencode-context/CURRENT_STATE.md`: current production state, implemented features, incomplete work, and known issues.
- `.opencode-context/ARCHITECTURE.md`: system boundaries, module relationships, and why the project is structured this way.
- `.opencode-context/BUILD_AND_DEPLOY.md`: modular GitHub Actions pipeline, rebuild rules, artifacts, validation, Netlify deployment, and build quirks.
- `.opencode-context/DECISIONS.md`: architectural decisions, rejected alternatives, and user-directed design choices.
- `.opencode-context/CONSTRAINTS.md`: invariants that must not be casually changed.

For dashboard-only work, read `CURRENT_STATE.md`, `DECISIONS.md`, and `CONSTRAINTS.md`.

For any tool, adapter, integration, CI, cache, routing, or deployment work, read all five documents.

Before ending substantial implementation work, update the relevant files under `.opencode-context/` if your changes made their contents inaccurate.

Do not add routine implementation details or a chronological transcript. Record only information that a fresh agent would need in order to continue the project correctly.
