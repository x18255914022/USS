---
name: db-migration
description: Safely change database schema, ORM models, migrations, and data behavior.
---

Before changes:

1. Read `.pi/PROJECT.md`.
2. Find schema, migration history, seed data, and every use of affected models.
3. Determine development/test/production database differences.
4. Evaluate rollback, locks, data volume, and zero-downtime requirements.

Rules:

- Never rewrite an applied migration.
- Never run reset, drop, delete, or production migrations without explicit approval.
- Introduce new required fields safely: nullable/default, backfill, application rollout, then constraint if needed.
- Check indexes, foreign keys, uniqueness, transactions, and concurrency.
- Add integration tests for important data behavior.

Report schema diff, migration strategy, rollback strategy, validation, and risks.
