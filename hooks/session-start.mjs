import { readJsonInput } from "../scripts/json-input.mjs";
import { sessionContext } from "../scripts/context.mjs";

const host = process.argv[2];
if (!["claude", "codex", "cursor"].includes(host)) {
  process.stderr.write("Expected host: claude, codex, or cursor\n");
  process.exit(1);
}
const cursor = host === "cursor";
let event = {};
try {
  event = readJsonInput("{}");
} catch {
  process.stderr.write("Invalid session-start JSON; TASK scope cannot be registered\n");
}
const context = cursor
  ? sessionContext(host, event.conversation_id, event.workspace_roots?.[0])
  : sessionContext(host, event.session_id, event.cwd);
const output = cursor
  ? { additional_context: context }
  : { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } };
process.stdout.write(JSON.stringify(output));
