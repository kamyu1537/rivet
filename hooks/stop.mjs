import { readJsonInput } from "../scripts/json-input.mjs";
import { checkTaskStop, tasksEnabled } from "../scripts/task-state.mjs";

const host = process.argv[2];
if (!["claude", "codex", "cursor"].includes(host)) {
  process.stderr.write("Expected host: claude, codex, or cursor\n");
  process.exit(1);
}
const cursor = host === "cursor";
let result = { retry: false };
try {
  const event = readJsonInput("{}");
  const cwd = cursor ? event.workspace_roots?.[0] : event.cwd;
  const completed = cursor ? event.status === "completed" : true;
  if (completed && tasksEnabled(cwd)) {
    result = cursor
      ? checkTaskStop(host, event.conversation_id, event.workspace_roots?.[0], event.loop_count > 0)
      : checkTaskStop(host, event.session_id, event.cwd, event.stop_hook_active === true);
  }
} catch (error) {
  result = { retry: false, warning: `TASK cannot verify completion: ${error.message}` };
}
if (result.warning) process.stderr.write(`${result.warning}\n`);
let output = {};
if (result.retry) output = cursor ? { followup_message: result.message } : { decision: "block", reason: result.message };
else if (result.warning && !cursor) output = { systemMessage: result.warning };
process.stdout.write(JSON.stringify(output));
