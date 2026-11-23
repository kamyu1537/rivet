# Session-start context

When a supported harness starts a session, rivet injects a short context that names the workstyle skill path and whether TASK is enabled for the workspace.

## Sub-features

- `workstyle-path` includes an absolute workstyle skill path.
- `task-enabled-flag` includes `TASK enabled: true` or `TASK enabled: false` matching the project block.
- `hosts` covers claude, codex, cursor, omp, and antigravity JSON shapes.

## How to get to it (user POV)

- Start a new Claude Code, Codex, Cursor, OMP, or Antigravity session in a project with rivet installed.
- Or run the session-start hook script the way the harness would.

## Driving it with isolate + session-start.mjs

Preconditions:

- Fresh isolate. Optionally enable TASK with `--file AGENTS.md` first when testing the true branch.
- Doctor status matches the intended enabled/disabled state.

- **Claude off.** Run `node <PLUGIN>/hooks/session-start.mjs claude` with stdin `{"session_id":"verify-A","cwd":"<WORKSPACE>","hook_event_name":"SessionStart"}`. Exit 0. Parsed `hookSpecificOutput.additionalContext` contains `Workstyle skill:` and `TASK enabled: false`.
- **Claude on.** Enable TASK, run the same hook. Context contains `TASK enabled: true` and a `TASK scope:` line.
- **Cursor.** Stdin uses `conversation_id` and `workspace_roots: ["<WORKSPACE>"]`. Read `additional_context`.
- **Codex / OMP.** Same as Claude host arg `codex` or `omp`.
- **Antigravity.** Stdin uses `conversationId` and `workspacePaths: ["<WORKSPACE>"]`. Read `injectSteps[0].systemMessage.systemMessage`.
- **Proof.** Write each host’s raw stdout under `EVIDENCE/session-start-context/`.

## Gotchas

- Cursor’s field name is `additional_context`, not `hookSpecificOutput.additionalContext`.
- Antigravity runs hooks from the plugin root, so the workspace comes only from `workspacePaths`.
- Scope registration needs a writable fixture `HOME`. A broken scope prints `TASK enabled: false` plus a limitation line.
