---
name: verify-rivet
description: >-
  Drive rivet’s real CLI and harness hooks to prove TASK activation, session
  context, run lifecycle, and validate contracts. Use when verifying rivet
  behavior after plugin or TASK changes.
---

# Verify rivet

Primary surface is the Node CLI and harness hooks. There is no long-lived server.

## Launch

1. Work from the rivet repo root.
2. Prefer an isolated fixture. Run `node .cursor/skills/verify-rivet/scripts/isolate.mjs` and keep its printed `PLUGIN`, `WORKSPACE`, `HOME`, and `EVIDENCE` paths.
3. Ready means `node scripts/tasks.mjs status` exits 0 in that workspace with the fixture `HOME`/`USERPROFILE`.

There is no daemon to keep alive. Each drive is a fresh `node` process with the fixture env.

## Doctor

From the fixture workspace with fixture env:

```text
node <PLUGIN>/scripts/tasks.mjs status
```

Require exit 0 and stdout starting with `enabled` or `disabled`. Also require `node <PLUGIN>/scripts/validate.mjs` to exit 0 when validating the repo tree (repo root, not the temp plugin copy, for validate-contract).

Do not drive a fixture whose `HOME` points at the operator’s real profile.

## Drive

- CLI. `node <PLUGIN>/scripts/tasks.mjs <args>` with `cwd=<WORKSPACE>` and `HOME`/`USERPROFILE` set to the fixture home.
- Session start. `node <PLUGIN>/hooks/session-start.mjs <host>` with JSON on stdin (`session_id`, `cwd`, or Cursor’s `conversation_id`/`workspace_roots`).
- Stop. `node <PLUGIN>/hooks/stop.mjs <host>` with the same host JSON shape after a run exists.
- Exact recipes live under `features/`. Start from the feature map README.

## Evidence

Store proofs under `%TEMP%/verify-rivet-<run-id>/` (the isolate script prints `EVIDENCE`). Keep:

- command, exit code, stdout, stderr for each CLI step
- file contents of `CLAUDE.md` / `AGENTS.md` when activation is under test
- session-start `additionalContext` / `additional_context` strings when hooks are under test

Proof standards: exercise the real CLI and hooks, not internal setters. Capture the action and the resulting files or hook output. Cleanup must not delete this evidence directory.

## Cleanup

Delete only the isolate script’s temp plugin/workspace/home directories. Never delete `EVIDENCE`. Never kill processes by name.

## Helpers

```text
node .cursor/skills/verify-rivet/scripts/isolate.mjs
node .cursor/skills/verify-rivet/scripts/drive-activation.mjs
```

`isolate.mjs` prints shell-friendly `KEY=value` lines. `drive-activation.mjs` runs the project-task-activation recipe and writes evidence files.

## Feature map

Read [features/README.md](features/README.md) before driving. Cover every listed feature when auditing; for a focused change, drive the features that touch the diff.
