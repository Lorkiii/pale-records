# PALE Project Instructions

These instructions define the shared working rules for the entire PALE
repository.

## Scope and Instruction Hierarchy

- Apply these rules to every file under the repository root, including
  `client/` and `server/`.
- Also follow the closest nested `AGENTS.md` for the area being changed.
- Before changing files under `client/` or `server/`, read that area's nested
  `AGENTS.md`. Read both nested files for work that crosses both areas, even
  when the task starts from the repository root.
- Nested instructions may add more specific requirements or override a root
  rule when the two directly conflict.
- Keep client design and accessibility rules in `client/AGENTS.md`. Keep
  server architecture, validation, security, and database rules in
  `server/AGENTS.md`.

## General Working Principles

- Inspect the relevant existing code, tests, configuration, and documentation
  before making changes.
- Confirm the current architecture, runtime paths, payloads, and product
  behavior instead of assuming files or features exist.
- Implement the smallest complete solution that satisfies the current request.
- Keep straightforward work straightforward. Prefer code whose control flow,
  data flow, and ownership are easy for the next maintainer to follow.
- Preserve existing behavior and project structure unless the request requires
  a change.
- Reuse existing conventions and utilities when they fit. Do not introduce
  speculative abstractions, placeholder layers, or unused extension points.
- Avoid unrelated refactors and do not invent product features, data, metrics,
  activity, security behavior, or operational claims.

## YAGNI, Scalability, and Maintainability

- Follow YAGNI: implement only the behavior required by the current request and
  demonstrated runtime paths.
- Do not add abstractions, configuration, dependencies, state, or infrastructure
  solely for imagined future requirements.
- Treat every new layer and indirection as a maintenance cost. Add complexity
  only when a current, concrete requirement makes the simpler design inadequate.
- Make the project scalable through clear responsibilities, stable boundaries,
  bounded work, and explicit data flow rather than additional layers by default.
- Keep modules focused and names explicit. Split code when a distinct current
  responsibility or testing boundary can be identified, not only because a file
  has grown.
- Extract shared code only when there is real duplication or a stable boundary
  that multiple current consumers need.
- Prefer maintainable, readable code over clever compression, premature
  optimization, or highly generic solutions.

## File Documentation

- Every source file that is created or meaningfully modified must contain a
  short file-purpose comment explaining the responsibility it owns.
- If a suitable purpose comment already exists, keep it or update it when the
  file's responsibility changes. Do not add a duplicate comment.
- Keep comments concise and focused on intent or responsibility. Do not add
  comments that merely restate obvious code.
- Use JSDoc only for non-obvious functions, behavior, or important constraints.
- Respect required headers, directives, and the syntax of each file format.
  Do not add comments to formats that do not support them, such as JSON.
- Do not modify lockfiles, generated files, snapshots, build output, or
  generated migration artifacts solely to add comments.
- Formatting-only or generated changes do not require a meaningless purpose
  comment.

## Change Discipline and Safety

- Keep changes limited to the user's request and preserve unrelated existing
  or uncommitted work.
- Do not delete, overwrite, revert, or rewrite files or history without clear
  authorization.
- Do not commit, push, deploy migrations, reset or seed a persistent database,
  or use destructive database shortcuts unless the user explicitly authorizes
  that action in the current task.
- Add dependencies only when they are necessary and the current stack cannot
  solve the task clearly.
- Do not change configuration, authentication, authorization, database
  behavior, or permissions as part of an unrelated task.
- Never expose, store, return, or log credentials, secrets, tokens, cookies,
  password data, API keys, or database URLs.
- Treat presentation-only controls as presentation, not as proof of real
  authorization or security.

## Verification

- Treat this section and the closest nested `AGENTS.md` verification section as
  required even when a phase or implementation prompt does not repeat them.
- Run checks that are relevant to every changed area. For cross-client/server
  work, run both nested verification sets.
- Add or update focused tests when behavior changes and the existing test setup
  supports them.
- After file changes, run `git diff --check`, inspect `git status --short`, and
  review the final diff for accidental or unrelated changes.
- Documentation-only changes do not require application test suites unless the
  documentation also changes executable configuration or runtime behavior.
- Wait for every verification process to finish before reporting its result.
- Never claim that a check passed unless it was actually run successfully.
- If a relevant check or browser workflow cannot run, report the exact reason
  and do not imply runtime or visual verification occurred.

## Completion Report

After any task that creates or modifies files, provide one concise final report
that includes:

- `Changed files`: list every changed file with a short explanation of what
  changed and why.
- `Summary`: explain the overall completed work and any important safeguards.
- `Verification`: list the checks that passed and any checks not run, including
  the reason.

When migrations are in scope, also state which migration artifacts were
created or remain pending and whether any migration was applied. State whether
a commit or push occurred.

Report once after the complete task rather than interrupting the work after
each individual file edit.
