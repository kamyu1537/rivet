---
name: verify-rivet-tasks
description: >-
  Formally check rivet project TASK activation with TLA+/TLC. Use when changing
  scripts/task-state.mjs enable/disable/status, TASK file markers, or
  hasSingleValidBlock rules.
---

# Verify rivet TASK activation (formal)

## Property

`tasks.mjs status` / `tasksEnabled` report enabled if and only if exactly one of `CLAUDE.md` or `AGENTS.md` holds a single valid rivet-tasks block and the other is missing or has no markers.

## Harm if broken

Agents would track TASKS against a project the user did not enable, or refuse tracking when the project block is valid.

## Tool

TLA+ model checked with TLC. Read every TLC result with the pstack `/statechart` skill (by name). Do not copy statechart command flags from memory; open that skill.

## Coverage

| Code | Role |
| --- | --- |
| `scripts/task-state.mjs` | `classifyTaskText`, `hasSingleValidBlock`, `projectTasks`, `enableProjectTasks`, `disableProjectTasks` |
| `scripts/tasks.mjs` | CLI enable/disable/status wiring |

Sync commit: `442c38d853a9e2fcf6a82589a406ed809d894d65`

Move the sync commit forward only after you confirm this model still describes the code at the new commit.

## Bounds and assumptions

- Two files only (`CLAUDE.md`, `AGENTS.md`), each in {Absent, None, One, Broken}.
- Enable with `--file` strips both then writes one valid block.
- Bare enable runs only when already enabled.
- External corruption and dual-valid-block edits are modeled; Git worktree root resolution is not.
- Concurrent writers and lock files are out of scope.

## Run

From the repo root (PowerShell):

```powershell
$jar = "$env:TEMP\tla2tools-1.7.4.jar"
if (-not (Test-Path $jar)) {
  Invoke-WebRequest -Uri "https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar" -OutFile $jar
}
$env:TLA2TOOLS = $jar
$env:JAVA = "java"
$stage = Join-Path $env:TEMP ("rivet-tasks-stage-" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $stage | Out-Null
$model = Resolve-Path .cursor/skills/verify-rivet-tasks/model
$worker = Resolve-Path "<pstack-statechart-scripts>/worker.ts"
bun $worker $stage "$model\ProjectTasks.tla" "$model\ProjectTasks.cfg" "$model\view.mjs"
```

Replace `<pstack-statechart-scripts>` with the absolute `skills/statechart/scripts` directory from the installed pstack plugin. Exit 0 means every invariant holds. Inspect `$stage\done\report.md` and `$stage\done\chart.mmd`.

On Unix, `/statechart`’s `statechart.ts` entrypoint may work if `/bin/sh` is available; on Windows prefer `worker.ts` with `TLA2TOOLS` set as above.

## Able to fail

Break the model by changing `EnableClaude` to leave `agents' = "One"` when it was `"One"`, then rerun. `ReportMatchesFiles` or `EnableLeavesSingleOne` must fail. Drop the break before committing.

## After a code change

Follow `/maintain-formal-verification-skill`. Update the model from the code, rerun, then move the sync commit only if the description matches.

## Not covered

- Stop-hook continuation budget and run JSON shape
- Host-specific session-start JSON
- `validate.mjs` forbidden-surface scanning (see `verify-rivet`)
