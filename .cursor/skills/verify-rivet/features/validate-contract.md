# Validate contract

`pnpm run validate` fails the tree when removed harness or skill surfaces return, and asserts situational-only `workstyle-*` skills.

## Sub-features

- `forbidden-surfaces` rejects the retired host and skill id strings listed in `scripts/validate.mjs` (outside that file itself).
- `situational-skills` requires exactly the four `workstyle-*` skill directories.

## How to get to it (user POV)

- Run `pnpm run validate` from the rivet repo root after editing manifests, skills, or prompts.

## Driving it with pnpm

Preconditions:

- Repo root checkout. No isolate required.
- Working tree may be dirty; validate reads files as they are.

- **Clean validate.** Run `pnpm run validate`. Exit 0. Stdout mentions forbidden surfaces are valid.
- **Forbidden reintroduction (optional break proof).** Temporarily add one retired host id string from `scripts/validate.mjs` into a tracked `.md` outside that file, run validate, expect exit nonzero, then revert the edit.
- **Proof.** Save validate stdout/stderr under `EVIDENCE/validate-contract/`.

## Gotchas

- `scripts/validate.mjs` is skipped by the forbidden scan so its own patterns do not self-fail.
- Always-on comment/commit/computer-use rules must stay in `prompts/workstyle.md`, not as new `workstyle-*` skills.
