---
name: git-worktree
description: Isolate parallel tasks and Pi sessions using git worktrees.
---

Use for independent tasks or isolated areas only.

Before creating a worktree:

1. Check `git status --short`.
2. Preserve existing uncommitted work.
3. Use a clear branch name.
4. Do not run agents in parallel against the same shared package, schema, lockfile, or contract.

Template:

```bash
git worktree add ../<repo>-<task> -b <type>/<task>
cd ../<repo>-<task>
pi
```

Rules:

- Modify shared contracts and schema sequentially.
- One worktree equals one primary agent task.
- Do not delete worktrees, merge, or rebase without user direction.
