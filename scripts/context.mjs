import { readFileSync } from "node:fs";
import { sep } from "node:path";
import { fileURLToPath } from "node:url";
import { openTaskScope, tasksEnabled } from "./task-state.mjs";

const prompt = (file) => readFileSync(new URL(`../prompts/${file}`, import.meta.url), "utf8").trim();
const displayPath = (path) => JSON.stringify(path.split(sep).join("/"));

function taskScopeDetails(host, sessionId, cwd) {
  try {
    const state = openTaskScope(host, sessionId, cwd);
    return `TASK script: ${displayPath(fileURLToPath(new URL("./tasks.mjs", import.meta.url)))}\nTASK scope: ${state.scopeId}\nTASK workspace: ${displayPath(state.scope.worktreeRoot)}\nTASK revision: ${state.revision}`;
  } catch (error) {
    return `TASK cannot verify or register this scope: ${error.message}. Report this limitation; do not guess a session ID or recreate registered state.`;
  }
}

export function sessionContext(host, sessionId, cwd) {
  const context = `${prompt("session-start.md")}\n\nWorkstyle skill: ${displayPath(fileURLToPath(new URL("../skills/internal-workstyle/SKILL.md", import.meta.url)))}`;
  if (!tasksEnabled()) return `${context}\nTASK enabled: false`;
  return `${context}\nTASK enabled: true\n\n${taskScopeDetails(host, sessionId, cwd)}`;
}
