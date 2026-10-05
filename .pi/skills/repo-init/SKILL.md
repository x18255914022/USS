---
name: repo-init
description: Analyze an unfamiliar repository and adapt Pi Starter Kit: PROJECT.md, settings, model routing, prompts, and relevant skills.
---

# Purpose

Turn a portable Pi Starter Kit into a verified project profile. This skill is used by `/project-init`. It must not modify files before explicit user confirmation.

# Phase 1: Discovery

## Read order

1. `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `README*`.
2. Root manifests/configuration: package manager manifests, workspace files, build files, Docker, CI, IaC, deployment configuration.
3. Top-level directories and workspace manifests.
4. Tests, migrations, schemas, API specs, docs, runbooks.
5. Existing AI configuration: `.pi`, `.claude`, `.cursor`, `.opencode`, Copilot instructions.

## Safe commands

Use only read-only discovery commands, for example:

```bash
git status --short
git log -5 --oneline
git branch --show-current
git diff --stat
find . -maxdepth 2 -type f
```

Use package-manager introspection only when it cannot install, download, write lockfiles, build, test, migrate, seed, deploy, or generate code.

## Detect

Determine:

- product purpose;
- language and runtime;
- monorepo or single app;
- package manager and verified commands;
- build, lint, format, typecheck, tests;
- apps, services, packages, data flow;
- APIs, data stores, ORM, migrations;
- jobs, queues, cron, webhooks;
- frontend/mobile/CLI;
- containers, CI/CD, infrastructure;
- secret boundaries;
- existing working-tree changes;
- unknowns and risks.

# Phase 1 output

Before any modification, present:

1. Project classification
2. Architecture map
3. Toolchain and verified commands
4. Quality gates
5. Risks and safety boundaries
6. Recommended default model
7. Task-to-model routing
8. Skills to enable
9. Files proposed for change
10. Open questions

Ask for explicit confirmation for Phase 2.

# Model routing

Use only OpenCode Go Plus models:

| Work type | Primary model | Fallback | Thinking |
|---|---|---|---|
| Discovery, planning, ADR, architecture | `opencode-go/glm-5.3` | `opencode-go/kimi-k3` | high |
| General backend / TypeScript / services | `opencode-go/kimi-k2.7-code` | `opencode-go/glm-5.3` | medium |
| Complex bug, concurrency, hard refactor, review | `opencode-go/deepseek-v4-pro` | `opencode-go/kimi-k3` | high |
| Short read/search/docs/simple edits | `opencode-go/glm-5.3-flash` | `opencode-go/kimi-k2.6` | minimal |
| UI, component iteration, styles | `opencode-go/minimax-m2.7` | `opencode-go/kimi-k2.7-code` | low |
| Large codebase exploration | `opencode-go/kimi-k2.6` | `opencode-go/longcat-2.0` | medium |

Adjust the profile to project facts:

- No frontend: do not recommend frontend skills or UI models.
- No database/migrations: do not enable db-migration.
- No queues/cron/webhooks: do not enable background-job.
- Monorepo: enable git-worktree.
- Containers, CI, or IaC: recommend container-ops/release-safety only if those skills exist or explicitly propose their creation.
- Small project: keep the profile minimal.
- Existing project conventions take precedence unless the user explicitly requests replacement.

# Phase 2: Write policy

After confirmation:

1. Fill `.pi/PROJECT.md` with verified facts; mark inferences as inferred.
2. Create or minimally update `.pi/settings.json` without overwriting valid custom fields.
3. Keep prompts universal; place project-specific facts only in `PROJECT.md`.
4. Keep core skills and enable only relevant domain skills.
5. Create or supplement `AGENTS.md` only when missing critical instructions; preserve existing rules.
6. Run `git diff --check`.
7. Never commit, push, deploy, publish, migrate production data, or run destructive commands.

# PROJECT.md sections

Maintain these headings:

- Purpose
- Architecture
- Stack
- Workspace
- Commands
- Quality Gates
- Architecture Rules
- Data and APIs
- Background Processing
- Security Boundaries
- Change Risk Matrix
- Pi Model Routing
- Enabled Skills
- Open Questions
