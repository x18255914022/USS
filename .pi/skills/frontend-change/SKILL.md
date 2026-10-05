---
name: frontend-change
description: Safely change UI, state, accessibility, and frontend integrations.
---

Before changes:

1. Find a similar screen or component.
2. Check design system, UI conventions, hooks, and state patterns.
3. Locate the real API types/client; never invent a contract.
4. Define loading, empty, error, and permission states.

Rules:

- Do not substitute guessed backend contracts.
- Preserve accessibility: labels, keyboard behavior, focus, semantic HTML.
- Handle loading, error, and empty states.
- Do not add heavy dependencies without justification.
- Check responsive behavior when the project supports it.

Report changed components, state transitions, API dependencies, and validation.
