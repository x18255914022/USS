---
description: Independently review current code changes without editing files
---

Read `AGENTS.md`, `.pi/PROJECT.md`, and the current git diff.

Review this task: $ARGUMENTS

Do not edit files.

Check:
- architecture and scope conformance;
- types, contracts, validation, and error handling;
- authentication, authorization, and data exposure;
- races, idempotency, retries, and timeouts;
- database/migrations/indexes/backwards compatibility;
- observability and diagnostics;
- tests and likely regressions;
- unnecessary or dangerous changes.

Return findings by severity:

| Severity | File:line | Finding | Impact | Concrete fix |
|---|---|---|---|---|

Use: critical, high, medium, low.

Do not invent findings. If none are found, write `No findings` and list unreviewed areas.
