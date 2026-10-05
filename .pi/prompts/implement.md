---
description: Implement a task with controlled scope and validation
---

Read `AGENTS.md`, `.pi/PROJECT.md`, and relevant skills.

Implement this task: $ARGUMENTS

Workflow:
1. Study the current implementation, analogous modules, and tests.
2. Show a concise implementation plan and file list.
3. Ask for confirmation only before risky or irreversible actions: migrations, deletes/resets, external side effects, auth/permission changes, deploy, publish, billing, or production infrastructure.
4. Make minimal necessary changes.
5. Preserve project conventions, layering, and naming.
6. Update types, contracts, and tests with the implementation.
7. Run the smallest sufficient validation set from `.pi/PROJECT.md`.
8. Report actual results.

Constraints:
- Do not perform unrelated refactors.
- Never read, print, modify, commit, or transmit real `.env` contents, credentials, private keys, cookies, or production dumps.
- Do not use destructive git commands, force push, destructive data operations, or production migrations without explicit user permission.
- Do not commit or push without an explicit request.
- Separate pre-existing failures from regressions introduced by this work.

Return:

## Changed
Files and the purpose of each change.

## Validation
A table with command, status, and result.

## Risks and follow-ups
Remaining risks, omitted checks, and reasons.

## Suggested commit
One Conventional Commit title only; do not run `git commit`.
