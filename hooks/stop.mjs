import { readJsonInput } from "../scripts/json-input.mjs";
import { checkTaskStop, tasksEnabled } from "../scripts/task-state.mjs";

const host = process.argv[2];
if (!["claude", "codex", "cursor", "antigravity"].includes(host)) {
  process.stderr.write("Expected host: claude, codex, cursor, or antigravity\n");
  process.exit(1);
}
const cursor = host === "cursor";
const antigravity = host === "antigravity";
let result = { retry: false };
try {
  const event = readJsonInput("{}");
  let sessionId = event.session_id;
  let cwd = event.cwd;
  let completed = true;
  let reentry = event.stop_hook_active === true;
  if (cursor) {
    sessionId = event.conversation_id;
    cwd = event.workspace_roots?.[0];
    completed = event.status === "completed";
    reentry = event.loop_count > 0;
  } else if (antigravity) {
    sessionId = event.conversationId;
    cwd = event.workspacePaths?.[0];
    completed = !event.error;
    reentry = true;
  }
  if (completed && tasksEnabled(cwd)) result = checkTaskStop(host, sessionId, cwd, reentry);
} catch (error) {
  result = { retry: false, warning: `TASK cannot verify completion: ${error.message}` };
}
if (result.warning) process.stderr.write(`${result.warning}\n`);
let output = {};
if (result.retry) {
  if (cursor) output = { followup_message: result.message };
  else if (antigravity) output = { decision: "continue", reason: result.message };
  else output = { decision: "block", reason: result.message };
} else if (result.warning && !cursor && !antigravity) {
  output = { systemMessage: result.warning };
}
process.stdout.write(JSON.stringify(output));
