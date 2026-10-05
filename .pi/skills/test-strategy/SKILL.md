---
name: test-strategy
description: Select the smallest sufficient validation set based on change type and project rules.
---

Read `.pi/PROJECT.md` first.

Guidance:

| Change | Minimum |
|---|---|
| Local pure function | Unit test plus relevant lint/typecheck |
| Backend/API | Unit plus API/integration tests plus typecheck |
| Shared contract | Targeted checks for all known consumers |
| DB/schema/migration | Schema/migration validation plus integration tests |
| Worker/job/queue | Unit tests for retries/idempotency plus integration where available |
| Frontend | Typecheck plus component/e2e checks if configured |
| CI/container/infra | Configuration validation plus safe build/dry-run |

Rules:

- Do not run all monorepo tests without a reason.
- Start with the narrowest relevant scope.
- Find commands in repository manifests, CI, or PROJECT.md; never invent commands.
- Report skipped checks explicitly.
