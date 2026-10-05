---
description: Verify current changes without modifying them
---

Read `AGENTS.md` and `.pi/PROJECT.md`.

Verify the current changes for: $ARGUMENTS

1. Run `git status --short` and inspect the diff.
2. Identify affected packages and change types.
3. Choose the smallest sufficient validation set from `.pi/PROJECT.md`.
4. Do not edit files or fix problems without a separate request.
5. Clearly distinguish a regression introduced by the current diff, a pre-existing issue, and an unexecuted check.

Return:

| Check | Command | Status | Result |
|---|---|---|---|

## Findings
Confirmed problems only.

## Not verified
What was not run and why.

## Release impact
Whether a migration, API-breaking change, security issue, or rollout requirement exists.
