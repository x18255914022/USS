---
name: safe-change
description: Minimize risk when changing code, configuration, data, and infrastructure.
---

Classify risk before work:

- Low: local code or tests without external side effects.
- Medium: API contract, shared package, auth, configuration, worker behavior.
- High: migration, production data, billing, deployment, secrets, permissions, deletion, infrastructure, third-party side effects.

Rules:

- For high-risk actions, explain the exact plan and wait for explicit confirmation.
- Do not execute destructive commands without approval.
- Do not discard unrelated working-tree changes.
- Do not hide failed or skipped validation.
- Prefer reversible operations and minimal diffs.
- Use `/handoff` before a large change or model switch.
