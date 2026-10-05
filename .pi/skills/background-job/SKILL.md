---
name: background-job
description: Implement reliable queues, workers, cron tasks, webhooks, and background processing.
---

Before implementation:

1. Find producer, transport/queue, consumer, payload schema, and current retry behavior.
2. Define idempotency key and deduplication strategy.
3. Classify errors as retryable, terminal, or unknown.
4. Check timeouts, leases/visibility, partial failure, and duplicate delivery.

Rules:

- Never perform an irreversible user-facing side effect twice.
- Keep secrets and excessive personal data out of payloads.
- Add structured logs and correlation/job IDs.
- Test duplicate delivery, retry, timeout, and terminal failure.
- Do not send real messages, emails, or webhooks in tests without explicit permission.

Report payload, idempotency, retry policy, observability, and tests.
