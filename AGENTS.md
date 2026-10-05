# 🤖 Project Agents

This project uses specialized agents for different tasks. Each agent has specific expertise and permissions.

## Available Agents

### 🎨 Frontend Agent (`frontend-agent`)
**Specialization:** Next.js 16, React 19, TypeScript, Tailwind CSS

**Use for:**
- UI components and pages
- React hooks and state management
- Client-side API integration
- Forms and validation
- Responsive design
- Zustand store management

**Example:**
```
@frontend-agent Create a schedule calendar component with day/week views
```

---

### ⚙️ Backend Agent (`backend-agent`)
**Specialization:** Fastify, REST APIs, JWT Authentication, RBAC

**Use for:**
- API route development
- Authentication and authorization
- Business logic services
- Middleware and plugins
- JWT token handling
- Permission-based access control

**Example:**
```
@backend-agent Add an endpoint for bulk schedule imports with CSV parsing
```

---

### 🗄️ Database Agent (`database-agent`)
**Specialization:** Prisma ORM, PostgreSQL, Schema Design

**Use for:**
- Database schema changes
- Migration creation
- Complex queries and relations
- Performance optimization
- Data modeling
- Seed data creation

**Example:**
```
@database-agent Add a model for tracking classroom equipment bookings
```

---

### 🏗️ Fullstack Agent (`fullstack-agent`) *[Default]*
**Specialization:** End-to-end features across all layers

**Use for:**
- Complex features requiring frontend + backend + database
- Architecture decisions
- Integration tasks
- Feature planning and implementation
- Cross-layer debugging

**Example:**
```
@fullstack-agent Implement a notification system with web push and email
```

---

### 🔍 Code Reviewer (`code-reviewer`)
**Specialization:** Code quality, security, best practices

**Use for:**
- Pre-commit code review
- Security audit
- Best practices validation
- Refactoring suggestions
- Pull request review

**Example:**
```
@code-reviewer Review the changes in apps/api/src/routes/schedule.ts
```

**Note:** This agent has read-only permissions for safety.

---

### 🚀 DevOps Agent (`devops-agent`)
**Specialization:** Docker, deployment, infrastructure

**Use for:**
- Docker configuration
- Deployment scripts
- Environment setup
- CI/CD pipelines
- Redis configuration
- Infrastructure tasks

**Example:**
```
@devops-agent Create a production Docker Compose configuration with Nginx
```

---

## How to Use

### Inline in Chat
Mention an agent with `@` followed by the agent name:

```
@frontend-agent Create a login form with email/password validation
```

### As Default Agent
The `fullstack-agent` is set as default for general tasks. For specialized work, explicitly mention the appropriate agent.

### Combining Agents
You can chain agents for complex workflows:

```
@database-agent Design the schema for student attendance tracking
[after completion]
@backend-agent Create the API endpoints for attendance management
[after completion]
@frontend-agent Build the attendance marking interface
```

---

## Agent Selection Guide

| Task Type | Recommended Agent |
|-----------|-------------------|
| UI component | `frontend-agent` |
| Page layout | `frontend-agent` |
| API endpoint | `backend-agent` |
| Authentication | `backend-agent` |
| Database schema | `database-agent` |
| Complex query | `database-agent` |
| End-to-end feature | `fullstack-agent` |
| Code review | `code-reviewer` |
| Docker/Deploy | `devops-agent` |
| Bug fixing (any layer) | Use layer-specific agent |
| Refactoring | `code-reviewer` first, then implement |

---

## Agent Files Location

Agent definitions are stored in:
```
.opencode/agents/
├── frontend-agent.md
├── backend-agent.md
├── database-agent.md
├── fullstack-agent.md
├── code-reviewer.md
└── devops-agent.md
```

To modify an agent, edit its corresponding `.md` file.

---

## Configuration

Agent configuration is managed in `.opencode/opencode.json`:
- Default agent selection
- Model assignments
- Permission levels
- Tool access

**Note:** After modifying agent files or configuration, restart opencode for changes to take effect.

---

## Pi Coding Agent

This repo also carries a Pi configuration in `.pi/` (project profile, skills, prompts, guard extension):

- **`.pi/PROJECT.md`** — source of truth for project facts: architecture, verified commands, quality gates, model routing, enabled skills. Read it before non-trivial work.
- **Enabled skills**: core (`repo-init`, `repo-discovery`, `model-routing`, `safe-change`, `test-strategy`) + domain (`api-contract`, `db-migration`, `background-job`, `frontend-change`, `git-worktree`).
- **Guard extension** `.pi/extensions/project-guard.ts` blocks destructive bash commands (rm -rf, git reset --hard, prisma reset/push, DROP TABLE…).
- **Key commands**: `pnpm typecheck`, `pnpm lint`, `pnpm --filter @app/api test:unit`, `pnpm --filter @app/api test:integration`, `pnpm --filter @app/worker test`. Details in `.pi/PROJECT.md`.