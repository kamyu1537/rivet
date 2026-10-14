import { closeSync, mkdirSync, openSync, statSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { readJsonInput } from "./json-input.mjs";
import { runTaskCommand, tasksEnabled, tasksFlag } from "./task-state.mjs";

const [action, ...args] = process.argv.slice(2);
const usage = "Usage: node tasks.mjs enable|disable|status, or begin|add|set|resume|show|check --scope <scope ID> with mutation JSON on stdin";

function updateFlag(action) {
  const entry = statSync(tasksFlag, { throwIfNoEntry: false });
  if (entry && !entry.isFile()) throw new Error(`Flag path is not a file: ${tasksFlag}`);
  if (action === "enable" && !entry) {
    mkdirSync(dirname(tasksFlag), { recursive: true });
    try {
      closeSync(openSync(tasksFlag, "wx"));
    } catch (error) {
      if (error.code !== "EEXIST" || !tasksEnabled()) throw error;
    }
  }
  if (action === "disable" && entry) {
    if (entry.size !== 0) throw new Error(`Refusing to delete a nonempty flag: ${tasksFlag}`);
    unlinkSync(tasksFlag);
  }
}

try {
  if (["enable", "disable", "status"].includes(action) && args.length === 0) {
    updateFlag(action);
    process.stdout.write(`${tasksEnabled() ? "enabled" : "disabled"}\n${tasksFlag}\n`);
  } else if (["begin", "add", "set", "resume", "show", "check"].includes(action) && args.length === 2 && args[0] === "--scope") {
    if (!tasksEnabled()) throw new Error("TASK tracking is disabled");
    const input = ["show", "check"].includes(action) ? null : readJsonInput();
    process.stdout.write(`${JSON.stringify(runTaskCommand(args[1], action, input, process.cwd()))}\n`);
  } else {
    throw new Error(usage);
  }
} catch (error) {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exitCode = 1;
}
