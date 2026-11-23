import { readJsonInput } from "../scripts/json-input.mjs";
import { sessionContext } from "../scripts/context.mjs";

const host = process.argv[2];
if (!["claude", "codex", "cursor", "antigravity"].includes(host)) {
  process.stderr.write("Expected host: claude, codex, cursor, or antigravity\n");
  process.exit(1);
}
let event = {};
try {
  event = readJsonInput("{}");
} catch {
  process.stderr.write("Invalid session-start JSON; TASK scope cannot be registered\n");
}
let output;
if (host === "cursor") {
  output = { additional_context: sessionContext(host, event.conversation_id, event.workspace_roots?.[0]) };
} else if (host === "antigravity") {
  const context = sessionContext(host, event.conversationId, event.workspacePaths?.[0]);
  output = { injectSteps: [{ systemMessage: { systemMessage: context } }] };
} else {
  const context = sessionContext(host, event.session_id, event.cwd);
  output = { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } };
}
process.stdout.write(JSON.stringify(output));
