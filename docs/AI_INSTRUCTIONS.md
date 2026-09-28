# AI/Copilot Development Instructions

These rules apply to future AI-assisted work in this repository.

## Before making changes

1. Read `docs/PRD.md` and `docs/TRD.md` completely. Read this file as well.
2. Inspect the relevant implementation, tests, route mounts, schema, and current working tree. Do not assume that a dormant controller or unmounted page is active functionality.
3. Confirm which phase and scope the user approved. If the requirement conflicts with existing behavior or is not specified, stop for clarification instead of inventing product rules.
4. Before implementation, summarize the current state, scope, files expected to change, and whether a database change is necessary when the user requests an assessment.

## Phase and scope control

- Work on one approved phase at a time.
- Do not implement later-phase features early, even if schema tables, placeholder pages, dormant routes, seed data, or prior code suggest they may be useful.
- Do not begin a phase that the user asked only to analyze or prepare.
- Stop after the requested phase and wait for the user's next instruction.
- Do not rebuild working authentication, database, student complaint, or admin functionality unless the request requires a minimal change.

## Architecture and persistence

- Follow the current React/Vite frontend, Express backend, MySQL database, and existing module structure.
- Reuse existing components, API services, middleware, database connection helpers, and validation conventions where appropriate.
- Use real MySQL persistence for persistent application functionality.
- Do not use mock data or browser local storage as a substitute for backend persistence. Existing authentication token storage in local storage is not a reason to store application records there.
- Use parameterized SQL values. If dynamic identifiers/order clauses are needed, select them from explicit server-owned allowlists.
- Do not create or change tables unless the approved requirements need a change that the current schema cannot represent. Explain the reason before applying a requested schema change.
- Do not expose password hashes, secrets, tokens, or environment credentials in responses, logs, commits, documentation examples, or tests.

## Authentication, authorization, and validation

- Reuse the existing JWT authentication and role middleware.
- Enforce ownership and role authorization on the backend. Frontend route protection is not an authorization boundary.
- Derive the acting user identity and role from the verified server-side user record; never trust client-supplied identity or role values.
- Validate request data on the server, including required fields, types, maximum lengths, enums, IDs, referenced records, file count/type/size, and state transitions where explicitly defined.
- Preserve safe error handling: return useful expected 4xx responses, do not turn errors into success-shaped fallbacks, and do not expose internal stack traces or sensitive details.

## Preserve existing behavior

- Make precise, minimal, complete changes related to the request.
- Do not rewrite working features or make unrelated cleanup changes.
- Preserve existing route contracts, response shapes, database constraints, and user flows unless the approved task explicitly changes them.
- Add or update tests for changed behavior, including authorization and invalid input where relevant.
- Update directly related documentation when implementation changes.

## Verification before completion

1. Run the smallest relevant tests first, then applicable regression tests.
2. For backend changes, run `npm run test:server`; MySQL-backed integration tests require the configured database and clean up their temporary records.
3. For frontend changes, run `npm run build:client`.
4. Run `npm run db:check` when the task requires database connectivity verification.
5. Fix failures caused by the change; do not claim success when verification has not completed. Distinguish environment-blocked checks from passed checks.
6. Report the files created/modified, functionality implemented, database changes (or none), tests/builds run and results, and any remaining uncertainty.
7. Stop at the approved scope. Do not silently continue to another phase.

## Documentation and uncertainty

- Describe only behavior confirmed by active code, schema, tests, or existing project documentation.
- Clearly label planned, partial, dormant, or unmounted functionality.
- Do not invent APIs, tables, integrations, lifecycle rules, or acceptance criteria.
- If an applicable specification is missing or ambiguous, report that limitation and ask for approval or clarification before implementing dependent behavior.
