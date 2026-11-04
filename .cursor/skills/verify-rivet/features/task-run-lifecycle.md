# TASK run lifecycle

With TASK enabled, a user registers a plan, updates item status with evidence or reasons, and Stop asks to continue only while pending or active items remain, with a finite retry budget.

## Sub-features

- `begin` registers a run with nonempty verified items.
- `set-done` requires evidence; waiting/cancelled require a reason.
- `show-check` reports state and outcome without mutating.
- `stop-continue` requests continuation for open items and stops after the budget.

## How to get to it (user POV)

- Enable TASK, then use begin/set/show/check through the agent’s TASK script path from session context.
- End the turn so the harness Stop hook runs.

## Driving it with isolate + tasks.mjs + stop.mjs

Preconditions:

- Fresh isolate with TASK enabled via `--file AGENTS.md`.
- Session started once so a scope ID exists (`TASK scope:` from session-start).

- **Begin.** Pipe JSON `{expectedRevision:0,title:"Verify",items:[{id:"a",title:"A",verification:"See evidence"}]}` into `begin --scope <scope>`. Exit 0.
- **Set done without evidence.** `set` with status `done` and no evidence. Exit 1.
- **Set done with evidence.** Exit 0. `check` outcome is not blocking when all items are done.
- **Stop with open item.** Leave an item pending. Run stop for the host. Response asks to continue and respects the documented loop limit of 2.
- **Proof.** Save begin/set/check/stop transcripts under `EVIDENCE/task-run-lifecycle/`.

## Gotchas

- Mutations need `expectedRevision` matching show.
- Begin while disabled exits 1 with `disabled`.
- Cursor Agent CLI may not run Stop hooks; then run `show` and `check` directly.
