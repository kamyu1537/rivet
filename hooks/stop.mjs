import { readJsonInput } from "../scripts/json-input.mjs";
import { checkTaskStop, tasksEnabled } from "../scripts/task-state.mjs";

const host = process.argv[2];
if (!["claude", "codex", "cursor", "gemini", "copilot"].includes(host)) {
  process.stderr.write("Expected host: claude, codex, cursor, gemini, or copilot\n");
  process.exit(1);
}
const cursor = host === "cursor";
let result = { retry: false };
try {
  const event = readJsonInput("{}");
  const completed = cursor ? event.status === "completed"
    : host === "copilot" ? event.stopReason === "end_turn"
    : host === "gemini" ? event.hook_event_name === "AfterAgent" : true;
  if (tasksEnabled() && completed) {
    result = cursor
      ? checkTaskStop(host, event.conversation_id, event.workspace_roots?.[0], event.loop_count > 0)
      : checkTaskStop(host, host === "copilot" ? event.sessionId : event.session_id, event.cwd, event.stop_hook_active === true);
  }
} catch (error) {
  result = { retry: false, warning: `TASK cannot verify completion: ${error.message}` };
}
if (result.warning) process.stderr.write(`${result.warning}\n`);
let output = {};
if (result.retry) output = cursor ? { followup_message: result.message } : { decision: host === "gemini" ? "deny" : "block", reason: result.message };
else if (result.warning && !cursor && host !== "copilot") output = { systemMessage: result.warning };
process.stdout.write(JSON.stringify(output));
