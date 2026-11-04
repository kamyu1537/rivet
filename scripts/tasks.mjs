import { readJsonInput } from "./json-input.mjs";
import { disableProjectTasks, enableProjectTasks, projectTaskStatus, runTaskCommand, tasksEnabled } from "./task-state.mjs";

const [action, ...args] = process.argv.slice(2);
const usage = "Usage: node tasks.mjs enable [--file CLAUDE.md|AGENTS.md]|disable|status, or begin|add|set|resume|show|check --scope <scope ID> with mutation JSON on stdin";

function printStatus(cwd) {
  const status = projectTaskStatus(cwd);
  process.stdout.write(`${status.enabled ? "enabled" : "disabled"}\n${status.path}\n`);
}

try {
  const cwd = process.cwd();
  if (action === "status" && args.length === 0) printStatus(cwd);
  else if (action === "disable" && args.length === 0) {
    disableProjectTasks(cwd);
    printStatus(cwd);
  } else if (action === "enable" && args.length === 0) {
    enableProjectTasks(cwd);
    printStatus(cwd);
  } else if (action === "enable" && args.length === 2 && args[0] === "--file") {
    enableProjectTasks(cwd, args[1]);
    printStatus(cwd);
  } else if (["begin", "add", "set", "resume", "show", "check"].includes(action) && args.length === 2 && args[0] === "--scope") {
    if (!tasksEnabled(cwd)) throw new Error("TASK tracking is disabled");
    const input = ["show", "check"].includes(action) ? null : readJsonInput();
    process.stdout.write(`${JSON.stringify(runTaskCommand(args[1], action, input, cwd))}\n`);
  } else {
    throw new Error(usage);
  }
} catch (error) {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exitCode = 1;
}
