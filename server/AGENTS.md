# PALE Server Instructions

## Scope

These rules apply to every file under `server/`. Follow any repository-level
instructions first; a more specific nested `AGENTS.md` may override them.

## Priorities

1. Correctness and data integrity
2. Security at the server boundary
3. Simple, readable code
4. Consistency with the existing project

## YAGNI, Scalability, and Maintainability

- Follow YAGNI: implement only what the current request requires.
- Keep simple tasks simple. Choose the smallest clear solution that fully works.
- Prefer code whose request flow, data flow, and ownership can be understood
  without tracing unnecessary indirection.
- Do not add speculative abstractions, wrappers, factories, repositories, base
  classes, configuration systems, or extension points for possible future use.
- Treat every new layer and infrastructure component as a maintenance cost. Add
  it only when a current, concrete requirement makes the simpler design inadequate.
- Add a shared helper or new layer only when it solves a present, demonstrated
  need and makes the code easier to understand.
- Do not add dependencies when the current stack can solve the task clearly.
- Do not create placeholder routes, services, types, or security checks that are
  not used by a real runtime path.
- Avoid unrelated refactors. Preserve existing behavior and project structure
  unless the request requires a change.
- Scale from demonstrated product and runtime needs. Do not add queues, caches,
  workers, repository layers, distributed-system patterns, or other
  infrastructure for hypothetical load.
- Keep request flow and ownership clear: routes register middleware and
  controllers, controllers own HTTP concerns, services own meaningful business
  or database logic, validation modules own runtime schemas, and `lib/` owns
  shared infrastructure.
- Keep modules focused and dependencies explicit. Split a module when it gains a
  distinct current responsibility or testing boundary, not merely because it is
  long.
- Extract shared helpers only for real repeated behavior or a stable boundary
  used by multiple current call sites.
- Prefer bounded queries and operations, explicit field selection, database
  constraints, and stateless request handling where practical before adding
  architectural complexity.

## Inspect Before Editing

- Read the relevant routes, controllers, services, middleware, Prisma schema,
  tests, and configuration before changing them.
- Confirm actual models, endpoints, payloads, and business rules. Do not invent
  missing product behavior or treat planned features as implemented features.
- Reuse existing utilities and conventions when they fit; do not force reuse
  when a direct implementation is clearer.

## Project Conventions

- Use strict TypeScript and avoid `any` unless it is a justified boundary.
- Preserve NodeNext `.js` extensions in relative imports.
- Keep route registration and controllers thin. Put business or database logic
  in a service when there is meaningful logic to own, not for one-line indirection.
- Use Prisma through the existing database client and Zod for runtime validation.
- Add a short purpose comment to newly created files. Use JSDoc only for
  non-obvious behavior.
- Keep secrets and all direct database access inside the server.

## Validation and Security

- Treat request bodies, params, queries, headers, cookies, IDs, dates, enum
  values, filenames, and external-service data as untrusted.
- Validate every client-controlled input at the boundary with the existing Zod
  pattern. Use parsed values in business logic; TypeScript types are not runtime
  validation. Do not create empty schemas for endpoints with no input.
- Map validated fields explicitly. Never pass `req.body` directly to Prisma.
- Require server-side authentication and authorization for protected operations.
  Never trust a client-supplied role or a hidden frontend control.
- Never store, return, or log plaintext passwords, password hashes, session
  tokens, cookies, authorization headers, API keys, database URLs, or other
  secrets.
- Keep authentication failures generic when account details could be exposed.
- Apply controls such as rate limits, upload checks, transactions, and CSRF
  defenses where the actual risk and request flow require them. Do not add
  security theater or unused middleware.

## Data and API Boundaries

- Prefer Prisma query APIs. Avoid unsafe raw SQL; parameterize and justify raw
  SQL when it is genuinely necessary.
- Use database constraints for concurrency-sensitive invariants and transactions
  for writes that must succeed or fail together.
- Bound list and bulk operations. Allowlist client-selected sort or filter fields.
- Select or map only the fields the client needs. Never return a complete Prisma
  object when it may contain internal or sensitive fields.
- Follow the existing success and error response schemas. Use intentional HTTP
  status codes and keep public error messages free of stack traces, Prisma
  details, filesystem paths, and infrastructure metadata.
- Route unexpected failures through the centralized error handler and log only
  the minimum safe diagnostic context.

## Dependencies and Database Changes

- Before adding a package, confirm that it is necessary, maintained, and not
  duplicating an installed capability.
- Review schema relationships, uniqueness, indexes, and deletion behavior before
  changing Prisma models.
- Do not run destructive database commands or rewrite migration history unless
  the user explicitly requests it.
- Do not use `npm audit fix --force`; resolve dependency issues deliberately.

## Verification

- Add focused tests for changed behavior and important failure paths when the
  existing test setup supports them.
- Run `npm test` and `npm run build` after server code changes.
- Run `npx prisma validate` when Prisma schema or configuration changes.
- If a relevant check cannot run, report the exact reason instead of claiming
  the change is verified.

## Completion

A task is complete when the requested behavior works, applicable validation and
authorization are attached to the real request path, sensitive data is excluded,
relevant checks pass, and no unrelated complexity was introduced.

Keep the final report concise: summarize the change, the important safeguards,
and the verification performed.
