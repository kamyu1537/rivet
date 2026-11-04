# Rivet verification map

Maintained source for verifying rivet’s user-facing CLI and hook behavior after the 2.0.0 redesign.

## Baseline preconditions

- Repo root is a clean checkout of rivet with `pnpm` available when running validate-contract.
- Use `node .cursor/skills/verify-rivet/scripts/isolate.mjs` for a disposable plugin copy, workspace, and home.
- Never write TASK blocks into the real repo’s `CLAUDE.md` / `AGENTS.md` during verification.
- Run doctor (`tasks.mjs status` in the fixture) before the first drive of a fixture.

## Driving conventions

- Start every recipe from a fresh isolate unless the feature file says otherwise.
- Treat every command as literal.
- Prefer the isolate helper’s printed paths over hand-built temp dirs.
- Restore nothing into the repo. Dispose fixture dirs after the drive; keep evidence.

## Proof and skip reporting

- CLI proof includes command, stdout, stderr, and exit code.
- Activation proof includes the resulting `CLAUDE.md` / `AGENTS.md` bytes.
- Hook proof includes the parsed context string that names `Workstyle skill` and `TASK enabled`.
- Report unreachable paths with the unmet precondition. Do not call a skipped host verified via another host.

## Features

- [Project TASK activation](./project-task-activation.md) covers enable, disable, status, bare enable failure, and ignored home flag.
- [Session-start context](./session-start-context.md) covers workstyle path and TASK enabled lines for claude, codex, cursor, and omp.
- [TASK run lifecycle](./task-run-lifecycle.md) covers begin/set/show/check and Stop continuation budget.
- [Validate contract](./validate-contract.md) covers the validator’s retired-surface scan and situational workstyle skill asserts.
