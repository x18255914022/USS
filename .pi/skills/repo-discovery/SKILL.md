---
name: repo-discovery
description: Safely inspect an unfamiliar area of a repository before planning, implementation, or review.
---

Before changing anything:

1. Read `AGENTS.md` and `.pi/PROJECT.md`.
2. Find the closest existing implementation.
3. Read local tests near the target module.
4. Inspect intersecting contracts, schemas, and configuration.
5. Run `git status --short`.

Rules:

- Search and read before editing.
- Verify structure; do not assume it.
- Do not load the whole repository into context without need.
- Do not read secrets or restricted files.
- Resolve uncertainty through code, CI, documentation, and tests.

Before implementation state confirmed facts, affected modules, unknowns, and a minimal plan.
