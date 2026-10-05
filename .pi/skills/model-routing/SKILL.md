---
name: model-routing
description: Select an appropriate OpenCode Go Plus model and reasoning level for the current task.
---

Use only models declared in `.pi/PROJECT.md`.

Default routing:

1. Discovery, system design, ADR, cross-module planning: `opencode-go/glm-5.3`, high.
2. Normal backend/TypeScript/service implementation and tests: `opencode-go/kimi-k2.7-code`, medium.
3. Complex bugs, races, transactions, security review: `opencode-go/deepseek-v4-pro`, high.
4. Short search, docs, narrow safe edits: `opencode-go/glm-5.3-flash`, minimal.
5. UI/layout/components: `opencode-go/minimax-m2.7`, low.
6. Broad unfamiliar repository exploration: `opencode-go/kimi-k2.6` or `opencode-go/longcat-2.0`, medium.

Do not switch models mid-implementation when continuity matters. If a change is needed:

1. Run `/handoff`.
2. Start a new Pi session.
3. Select the model through `/model`.
4. Paste the handoff.
