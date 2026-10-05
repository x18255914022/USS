---
description: Analyze the repository and adapt Pi Starter Kit into a project profile
---

Use the `repo-init` skill.

Task: adapt this Pi Starter Kit to the current repository.

Work in two phases.

# Phase 1 — discovery only

1. Find and read repository instructions: `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `README*`, docs, ADRs, runbooks, CI files, and existing agent configuration (`.pi`, `.claude`, `.cursor`, `.opencode`, Copilot instructions).
2. Identify languages, runtimes, package managers, workspace structure, apps, packages, services, tests, quality checks, data stores, ORM/migrations, queues/jobs, external integrations, containers, CI/CD, release commands, secret boundaries, and existing working-tree changes.
3. Run only safe read-only inspection commands. Do not install dependencies, run build/test/dev, generate code, migrate data, modify files, commit, push, deploy, publish, or call external services.
4. Produce a discovery report with:
   - project classification and purpose;
   - architecture map;
   - verified toolchain commands;
   - quality gates;
   - risks and safety boundaries;
   - recommended default model and task-to-model routing;
   - relevant skills to enable;
   - proposed files to create or change;
   - open questions.
5. Ask for explicit confirmation before Phase 2.

# Phase 2 — only after explicit confirmation

1. Create or update `.pi/PROJECT.md` using the template in `repo-init`.
2. Create or update `.pi/settings.json`, preserving valid existing settings.
3. Keep prompts universal; put project facts in `.pi/PROJECT.md`, not copied prompts.
4. Keep core skills and add only applicable domain skills.
5. Create or minimally supplement `AGENTS.md` without removing existing rules.
6. Do not add external extensions without separate explicit confirmation.
7. Run `git diff --check` and report changed files, model routing, enabled skills, first-use commands, and remaining unknowns.

Never commit, push, deploy, publish, migrate production data, change infrastructure, or run destructive commands without explicit user approval.
