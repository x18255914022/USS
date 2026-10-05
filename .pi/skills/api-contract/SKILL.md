---
name: api-contract
description: Safely change HTTP/RPC/API contracts, validation, authorization, and shared types.
---

For every endpoint or contract change:

1. Find the route/controller/handler/service and a comparable endpoint.
2. Find shared DTO/schema/client types.
3. Determine authentication, ownership, roles, input validation, and error behavior.
4. Identify consumers and compatibility impact.

Rules:

- Validate input at the boundary.
- Do not trust user or tenant IDs from request input when auth context owns that identity.
- Do not expose stack traces, secrets, or provider internals.
- Breaking changes require a compatible transition or explicit versioning plan.
- Test success, validation error, unauthorized, forbidden, not found, and conflict where applicable.

At the end list contract changes and known consumers.
