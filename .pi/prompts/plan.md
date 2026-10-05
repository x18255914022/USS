---
description: Plan a task without changing files
---

Read `AGENTS.md` and `.pi/PROJECT.md`.

Plan this task: $ARGUMENTS

Before answering:
1. Find existing implementations and closest comparable scenarios.
2. Read only relevant code, tests, configuration, and contracts.
3. Check `git status --short`.
4. Do not edit files, make commits, call external services, or run destructive commands.

Return exactly:

## Goal
A short verifiable outcome.

## Scope
Affected apps, packages, modules, and contracts.

## Approach
A numbered minimal-change implementation plan.

## Data and compatibility
Database, API, queue, configuration, backwards-compatibility, and rollout effects.

## Risks
Edge cases, concurrency, security, and failure modes.

## Verification
Exact commands and test scenarios from `.pi/PROJECT.md`.

## Files
Existing files likely to change or be created.

If the task is underspecified, ask concrete questions before making unsupported assumptions.
