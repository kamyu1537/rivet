import { readJsonInput } from "../scripts/json-input.mjs";
import { sessionContext } from "../scripts/context.mjs";

const host = process.argv[2];
if (!["claude", "codex", "cursor", "gemini", "copilot"].includes(host)) {
  process.stderr.write("Expected host: claude, codex, cursor, gemini, or copilot\n");
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
  : sessionContext(host, host === "copilot" ? event.sessionId : event.session_id, event.cwd);
let output;
if (cursor) output = { additional_context: context };
else if (host === "copilot") output = { additionalContext: context };
else output = { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } };
process.stdout.write(JSON.stringify(output));
