import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, sep } from "node:path";

export const tasksFlag = join(homedir(), ".config", "rivet", "tasks-enabled");

export function tasksEnabled() {
  return statSync(tasksFlag, { throwIfNoEntry: false })?.isFile() ?? false;
}

const directory = join(dirname(tasksFlag), "tasks");
const hosts = ["claude", "codex", "cursor", "omp", "gemini", "copilot", "opencode"];
const statuses = ["pending", "active", "done", "waiting", "cancelled"];
const openStatuses = ["pending", "active"];
const historyActions = ["begin", "add", "set", "resume", "continue"];
const mutationFields = {
  begin: ["expectedRevision", "title", "items"],
  add: ["expectedRevision", "runId", "items"],
  set: ["expectedRevision", "runId", "itemId", "status", "evidence", "reason"],
  resume: ["expectedRevision", "runId", "reason"],
};
const continuationLimit = 2;
const actionable = (item) => openStatuses.includes(item.status);
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const currentRun = (state) => state.runs.find((run) => run.id === state.currentRunId);

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalPath(path) {
  const real = realpathSync.native(path);
  return process.platform === "win32" ? real.toLowerCase() : real;
}

function findWorkspace(cwd) {
  requireValue(nonempty(cwd) && isAbsolute(cwd), "An absolute workspace directory is required");
  let root = realpathSync(cwd);
  let git = false;
  try {
    root = execFileSync("git", ["-C", root, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 2000 }).replace(/\r?\n$/, "");
    git = true;
  } catch (error) {
    if (error.code !== "ENOENT" && !String(error.stderr).includes("not a git repository")) throw error;
  }
  return { root: canonicalPath(root), git };
}

function requireRegisteredWorkspace(root, cwd) {
  const distance = relative(root, canonicalPath(cwd));
  requireValue(distance !== ".." && !distance.startsWith(`..${sep}`) && !isAbsolute(distance), "Run TASK commands inside the registered worktree root");
  const current = findWorkspace(cwd);
  requireValue(current.git ? current.root === root : !findWorkspace(root).git, "TASK workspace root changed; start a new session context");
}

function scopeHash(scope) {
  return createHash("sha256").update(JSON.stringify([scope.host, scope.sessionId, scope.worktreeRoot])).digest("hex");
}

function resolveScope(host, sessionId, cwd) {
  requireValue(hosts.includes(host), "Unknown TASK host");
  requireValue(nonempty(sessionId), "A stable host session ID is required");
  const scope = { host, sessionId, worktreeRoot: findWorkspace(cwd).root };
  return { scope, scopeId: scopeHash(scope) };
}

function scopeFiles(scopeId) {
  requireValue(typeof scopeId === "string" && /^[a-f0-9]{64}$/.test(scopeId), "Invalid TASK scope ID");
  return { state: join(directory, `${scopeId}.json`), marker: join(directory, `${scopeId}.registered`), lock: join(directory, `${scopeId}.lock`) };
}

function withLock(scopeId, operation) {
  mkdirSync(directory, { recursive: true });
  const { lock } = scopeFiles(scopeId);
  const deadline = Date.now() + 500;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      requireValue(Date.now() < deadline, `TASK lock is busy: ${lock}. Verify no writer is running before manually removing a leftover lock; age alone is not proof.`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
  try {
    return operation();
  } finally {
    rmdirSync(lock);
  }
}

function requireUniqueIds(items) {
  requireValue(new Set(items.map((item) => item.id)).size === items.length, "Duplicate item ID");
}

function validateItem(item) {
  requireValue(isRecord(item) && typeof item.id === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(item.id), "Each item requires an ID of 1-64 letters, numbers, underscores or hyphens");
  requireValue(nonempty(item.title) && nonempty(item.verification), "Each item requires a title and verification method");
  requireValue(statuses.includes(item.status), "Invalid item status");
  requireValue(item.evidence === null || nonempty(item.evidence), "Invalid item evidence");
  requireValue(item.reason === null || nonempty(item.reason), "Invalid item reason");
  requireValue(item.status !== "done" || nonempty(item.evidence), "Done requires verification evidence");
  requireValue(!["waiting", "cancelled"].includes(item.status) || nonempty(item.reason), "Waiting and cancelled require a reason");
}

function validateRun(run, stateRevision) {
  requireValue(isRecord(run) && nonempty(run.id) && nonempty(run.title), "Invalid TASK run");
  requireValue(Number.isInteger(run.continuationCount) && run.continuationCount >= 0 && run.continuationCount <= continuationLimit, "Invalid continuation count");
  requireValue(Array.isArray(run.items) && run.items.length > 0 && Array.isArray(run.history) && run.history.length > 0, "Invalid TASK items or history");
  run.items.forEach(validateItem);
  requireUniqueIds(run.items);
  let previousRevision = 0;
  for (const event of run.history) {
    requireValue(isRecord(event) && Number.isSafeInteger(event.revision) && event.revision > previousRevision && event.revision <= stateRevision && historyActions.includes(event.action), "Invalid TASK history");
    previousRevision = event.revision;
  }
}

function validateState(state, scopeId) {
  requireValue(isRecord(state) && state.schemaVersion === 1 && state.scopeId === scopeId, "Invalid TASK snapshot schema or scope");
  requireValue(isRecord(state.scope) && hosts.includes(state.scope.host) && nonempty(state.scope.sessionId) && nonempty(state.scope.worktreeRoot) && isAbsolute(state.scope.worktreeRoot), "Invalid TASK scope identity");
  requireValue(scopeHash(state.scope) === scopeId, "TASK scope identity mismatch");
  requireValue(Number.isSafeInteger(state.revision) && state.revision >= 0 && Array.isArray(state.runs), "Invalid TASK revision or runs");
  for (const run of state.runs) validateRun(run, state.revision);
  requireValue(new Set(state.runs.map((run) => run.id)).size === state.runs.length, "Duplicate TASK run ID");
  requireValue(state.runs.length === 0 ? state.currentRunId === null && state.revision === 0 : currentRun(state), "Invalid current TASK run");
  requireValue(state.runs.every((run) => run.id === state.currentRunId || !run.items.some(actionable)), "A non-current TASK run has actionable items");
}

function readState(scopeId) {
  const files = scopeFiles(scopeId);
  const registered = existsSync(files.marker);
  if (!existsSync(files.state)) {
    requireValue(!registered, "Registered TASK state is missing; cannot verify completion. Preserve the registration marker and restore the snapshot from a trusted backup.");
    return null;
  }
  let state;
  try {
    state = JSON.parse(readFileSync(files.state, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read TASK state; cannot verify completion: ${error.message}`);
  }
  validateState(state, scopeId);
  if (registered) requireValue(state.runs.length > 0, "Registered TASK state lost its runs; cannot verify completion");
  else requireValue(state.runs.length === 0, "TASK registration marker is missing; cannot verify completion");
  return state;
}

function saveState(state) {
  const file = scopeFiles(state.scopeId).state;
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function runOutcome(run) {
  if (!run) return "unregistered";
  if (run.items.every((item) => item.status === "done")) return "completed";
  if (run.items.some(actionable)) return "actionable";
  return run.items.some((item) => item.status === "waiting") ? "waiting" : "cancelled";
}

function readPlan(input) {
  requireValue(Array.isArray(input) && input.length > 0, "A nonempty plan is required");
  const items = input.map((item) => {
    requireValue(isRecord(item) && Object.keys(item).every((key) => ["id", "title", "verification"].includes(key)), "Plan items accept only id, title and verification");
    const result = { ...item, status: "pending", evidence: null, reason: null };
    validateItem(result);
    return result;
  });
  requireUniqueIds(items);
  return items;
}

function applyMutation(state, action, input) {
  requireValue(isRecord(input) && Object.keys(input).every((key) => mutationFields[action].includes(key)), "Unexpected TASK command field");
  requireValue(input.expectedRevision === state.revision, `Revision conflict: expectedRevision must equal ${state.revision}; run show before retrying`);
  const run = currentRun(state);
  const revision = state.revision + 1;
  if (action === "begin" || action === "resume") {
    requireValue(!run?.items.some(actionable), "Finish, wait or cancel actionable items before beginning or resuming another run");
  } else {
    requireValue(run && input.runId === run.id, "The current runId is required");
  }
  if (action === "begin") {
    requireValue(nonempty(input.title), "A run title is required");
    const items = readPlan(input.items);
    const id = randomUUID();
    state.runs.push({ id, title: input.title, continuationCount: 0, items, history: [{ revision, action, items: structuredClone(items) }] });
    state.currentRunId = id;
  } else if (action === "resume") {
    const target = state.runs.find((candidate) => candidate.id === input.runId);
    requireValue(target && nonempty(input.reason), "Resume requires an existing runId and a reason");
    target.history.push({ revision, action, reason: input.reason });
    state.currentRunId = target.id;
  } else if (action === "add") {
    const items = readPlan(input.items);
    requireUniqueIds([...run.items, ...items]);
    run.items.push(...items);
    run.history.push({ revision, action, items: structuredClone(items) });
  } else {
    const item = run.items.find((candidate) => candidate.id === input.itemId);
    requireValue(item, "Unknown itemId");
    requireValue(input.evidence === undefined || nonempty(input.evidence), "Evidence must be nonempty text");
    requireValue(input.reason === undefined || nonempty(input.reason), "Reason must be nonempty text");
    const reopening = !actionable(item) && openStatuses.includes(input.status);
    requireValue(!reopening || nonempty(input.reason), "Reopening an item requires a reason");
    const next = { ...item, status: input.status, evidence: input.evidence ?? null, reason: input.reason ?? null };
    validateItem(next);
    run.history.push({ revision, action, itemId: item.id, from: item.status, to: next.status, evidence: next.evidence, reason: next.reason });
    Object.assign(item, next);
  }
  state.revision = revision;
}

export function openTaskScope(host, sessionId, cwd) {
  const { scope, scopeId } = resolveScope(host, sessionId, cwd);
  return withLock(scopeId, () => {
    const existing = readState(scopeId);
    if (existing) return existing;
    const state = { schemaVersion: 1, scopeId, scope, revision: 0, currentRunId: null, runs: [] };
    saveState(state);
    return state;
  });
}

export function runTaskCommand(scopeId, action, input, cwd) {
  requireValue(action === "show" || action === "check" || Object.hasOwn(mutationFields, action), "Unknown TASK command");
  return withLock(scopeId, () => {
    const state = readState(scopeId);
    requireValue(state, "Unknown TASK scope; use the scope supplied by the session-start hook");
    requireRegisteredWorkspace(state.scope.worktreeRoot, cwd);
    if (action === "show") return state;
    if (action === "check") {
      const run = currentRun(state);
      const outcome = runOutcome(run);
      return { scopeId, revision: state.revision, runId: run?.id ?? null, outcome, actionable: run?.items.filter(actionable) ?? [], completed: outcome === "completed" };
    }
    applyMutation(state, action, input);
    closeSync(openSync(scopeFiles(scopeId).marker, "a", 0o600));
    saveState(state);
    return state;
  });
}

export function checkTaskStop(host, sessionId, cwd, reentry) {
  try {
    const { scopeId } = resolveScope(host, sessionId, cwd);
    return withLock(scopeId, () => {
      const state = readState(scopeId);
      const run = state && currentRun(state);
      const outcome = runOutcome(run);
      if (outcome === "unregistered" || outcome === "completed") return { retry: false };
      if (outcome !== "actionable") return { retry: false, warning: `TASK run ${run.id} is ${outcome}, not completed. Report remaining reasons and required user or external action.` };
      const remaining = run.items.filter(actionable).map((item) => `${item.id}: ${item.title}; verify: ${item.verification}`).join("\n");
      if (run.continuationCount >= continuationLimit) return { retry: false, warning: `TASK continuation limit reached (${continuationLimit}). Run ${run.id} remains incomplete:\n${remaining}\nReport the remaining work; do not claim completion.` };
      run.continuationCount++;
      state.revision++;
      run.history.push({ revision: state.revision, action: "continue" });
      saveState(state);
      return { retry: true, message: `TASK run ${run.id} has actionable work (${run.continuationCount}/${continuationLimit} continuations):\n${remaining}\nUse show with scope ${scopeId} to read the new revision. Continue the registered work and verification. Mark done only with evidence; mark waiting or cancelled only with a concrete reason. Do not claim completion while work remains.` };
    });
  } catch (error) {
    const warning = `TASK cannot verify completion: ${error.message}`;
    return reentry ? { retry: false, warning } : { retry: true, message: `${warning}\nReport this state error and the remaining work. Do not recreate or delete registered state, do not claim completion, and do not repeatedly retry a busy lock.` };
  }
}
