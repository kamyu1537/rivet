# Project TASK activation

A user turns rivet TASK tracking on or off for one project by writing or clearing a three-line block in `CLAUDE.md` or `AGENTS.md`. Status reports whether the project is enabled and which path owns the block.

## Sub-features

- `enable-with-file` turns TASK on with `--file CLAUDE.md` or `--file AGENTS.md`.
- `enable-bare-when-off` fails when TASK is off and `--file` is omitted.
- `enable-bare-when-on` rewrites the active file when TASK is already on.
- `disable` clears markers from both files and leaves status disabled.
- `home-flag-ignored` leaves TASK off even when `~/.config/rivet/tasks-enabled` exists.

## How to get to it (user POV)

- Run `node scripts/tasks.mjs enable --file CLAUDE.md` or `--file AGENTS.md` in the project root.
- Run `node scripts/tasks.mjs enable` with no `--file`.
- Run `node scripts/tasks.mjs disable`.
- Run `node scripts/tasks.mjs status`.

## Driving it with isolate + tasks.mjs

Preconditions:

- A fresh isolate from `node .cursor/skills/verify-rivet/scripts/isolate.mjs`.
- Fixture workspace has neither `CLAUDE.md` nor `AGENTS.md`.
- Doctor `status` prints `disabled` and the workspace path.

- **Enable with file.** Run `node <PLUGIN>/scripts/tasks.mjs enable --file AGENTS.md` with cwd and home from the isolate. Exit 0. Stdout starts with `enabled`. `AGENTS.md` contains the three-line rivet-tasks block. `CLAUDE.md` is absent.
- **Bare enable while on.** Run `enable` with no `--file`. Exit 0. `AGENTS.md` still has exactly one valid block.
- **Disable.** Run `disable`. Exit 0. Stdout starts with `disabled`. Neither file holds the block.
- **Bare enable while off.** Run `enable` with no `--file`. Exit 1. Stderr names `--file CLAUDE.md` or `--file AGENTS.md`.
- **Home flag ignored.** Write `still here` to `<HOME>/.config/rivet/tasks-enabled`. Run `status`. Still `disabled`.
- **Proof.** Save stdout/stderr and the final `AGENTS.md`/`CLAUDE.md` bytes under `EVIDENCE/project-task-activation/`.

Or run `node .cursor/skills/verify-rivet/scripts/drive-activation.mjs` which performs this recipe and writes evidence.

## Gotchas

- Enabling from a Git subdirectory writes the block at the worktree root, not the subdirectory.
- A broken or duplicated block leaves status `disabled` even if markers remain.
- Do not use the real repository root as the fixture workspace.
