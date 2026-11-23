import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const plan = [{ id: "build", title: "Implement change", verification: "Run the behavior test" }, { id: "verify", title: "Verify change", verification: "Inspect actual CLI output" }];

async function fixture(t) {
  const temp = mkdtempSync(join(tmpdir(), "task 한글 "));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const plugin = join(temp, "설치 copy");
  const cwd = join(temp, "workspace 한글");
  const home = join(temp, "home");
  for (const directory of ["hooks", "scripts", "prompts", "skills"]) await cp(join(root, directory), join(plugin, directory), { recursive: true });
  mkdirSync(cwd);
  mkdirSync(home);
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const run = (file, args, input, options = {}) => spawnSync(process.execPath, [join(plugin, file), ...args], { cwd, env, encoding: "utf8", input: input === undefined ? undefined : JSON.stringify(input), ...options });
  const cli = (action, scope, input, options) => {
    const fileArgs = action === "enable" ? ["--file", "AGENTS.md"] : [];
    const scopeArgs = action !== "enable" && scope ? ["--scope", scope] : [];
    return run("scripts/tasks.mjs", [action, ...fileArgs, ...scopeArgs], input, options);
  };
  const hook = (host, event = {}, stop = false) => run(stop ? "hooks/stop.mjs" : "hooks/session-start.mjs", [host], {
    ...(host === "cursor" ? { conversation_id: "session-A", workspace_roots: [cwd] }
      : host === "antigravity" ? { conversationId: "session-A", workspacePaths: [cwd] }
      : { session_id: "session-A", cwd, hook_event_name: stop ? "Stop" : "SessionStart" }),
    ...event,
  });
  const start = (host = "claude", event) => {
    const result = hook(host, event);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    const context = host === "cursor" ? output.additional_context
      : host === "antigravity" ? output.injectSteps[0].systemMessage.systemMessage
      : output.hookSpecificOutput.additionalContext;
    const scope = context.match(/TASK scope: ([a-f0-9]{64})/)?.[1];
    assert.equal(typeof scope, "string", context);
    return scope;
  };
  const good = (result) => {
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const begin = (scope, revision = 0, items = plan) => good(cli("begin", scope, { expectedRevision: revision, title: "Feature request", items }));
  const set = (scope, state, itemId, status, details = {}) => good(cli("set", scope, { expectedRevision: state.revision, runId: state.currentRunId, itemId, status, ...details }));
  const stateFile = (scope) => join(home, ".config", "rivet", "tasks", `${scope}.json`);
  assert.equal(cli("enable").status, 0);
  return { temp, plugin, cwd, home, env, run, cli, hook, start, good, begin, set, stateFile };
}

test("CLI enforces evidence, reasons, revisions and preserves completed runs and reopened history", async (t) => {
  const f = await fixture(t);
  const scope = f.start();
  assert.equal(f.good(f.cli("check", scope)).outcome, "unregistered");
  for (const input of [{ expectedRevision: 0, title: "Empty", items: [] }, { expectedRevision: 0, title: "Bad", items: [{ id: "bad", title: "Missing verification" }] }]) assert.equal(f.cli("begin", scope, input).status, 1);
  let state = f.begin(scope);
  const firstRunId = state.currentRunId;
  const invalid = (details, pattern) => {
    const result = f.cli("set", scope, { expectedRevision: state.revision, runId: state.currentRunId, itemId: "build", status: "done", ...details });
    assert.equal(result.status, 1);
    assert.match(JSON.parse(result.stderr).error, pattern);
    assert.deepEqual(f.good(f.cli("show", scope)), state);
  };
  invalid({}, /evidence/i);
  invalid({ evidence: " " }, /nonempty/);
  invalid({ evidence: "passed", expectedRevision: 0 }, /Revision conflict/);
  invalid({ evidence: "passed", runId: "other" }, /runId/);
  invalid({ status: "waiting" }, /reason/);
  invalid({ status: "cancelled" }, /reason/);
  invalid({ status: "unknown" }, /status/);
  invalid({ evidence: "passed", typo: true }, /Unexpected/);
  assert.equal(f.cli("begin", scope, { expectedRevision: state.revision, title: "Cannot replace", items: plan }).status, 1);
  state = f.set(scope, state, "build", "done", { evidence: "Behavior test passed" });
  invalid({ status: "active" }, /Reopening/);
  state = f.set(scope, state, "build", "active", { reason: "Additional case found" });
  state = f.set(scope, state, "build", "done", { evidence: "Both cases passed" });
  state = f.set(scope, state, "verify", "done", { evidence: "CLI returned expected output" });
  assert.equal(f.good(f.cli("check", scope)).completed, true);
  const completed = structuredClone(state.runs[0]);
  state = f.begin(scope, state.revision);
  assert.notEqual(state.currentRunId, firstRunId);
  assert.deepEqual(state.runs[0], completed);
  const added = f.good(f.cli("add", scope, { expectedRevision: state.revision, runId: state.currentRunId, items: [{ id: "review", title: "Review result", verification: "Inspect diff" }] }));
  assert.deepEqual(added.runs[1].items.map((item) => item.id), ["build", "verify", "review"]);
  assert.deepEqual(completed.history.map((entry) => entry.action), ["begin", "set", "set", "set", "set"]);
});

test("waiting and cancelled items remain incomplete and old runs can be resumed explicitly", async (t) => {
  const f = await fixture(t);
  const scope = f.start();
  let state = f.begin(scope);
  const waitingRunId = state.currentRunId;
  state = f.set(scope, state, "build", "waiting", { reason: "Need account access" });
  state = f.set(scope, state, "verify", "cancelled", { reason: "User removed this check" });
  assert.equal(f.good(f.cli("check", scope)).completed, false);
  assert.equal(f.good(f.cli("check", scope)).outcome, "waiting");
  assert.match(f.good(f.hook("claude", {}, true)).systemMessage, /not completed/);
  state = f.begin(scope, state.revision, [plan[0]]);
  assert.equal(f.cli("resume", scope, { expectedRevision: state.revision, runId: waitingRunId, reason: "Access restored" }).status, 1);
  state = f.set(scope, state, "build", "done", { evidence: "Current work verified" });
  assert.equal(f.cli("set", scope, { expectedRevision: state.revision, runId: waitingRunId, itemId: "build", status: "active", reason: "Access restored" }).status, 1);
  assert.equal(f.cli("resume", scope, { expectedRevision: state.revision, runId: waitingRunId }).status, 1);
  state = f.good(f.cli("resume", scope, { expectedRevision: state.revision, runId: waitingRunId, reason: "Access restored" }));
  state = f.set(scope, state, "build", "active", { reason: "Access restored" });
  assert.equal(state.currentRunId, waitingRunId);
  assert.equal(f.good(f.cli("check", scope)).outcome, "actionable");
});

test("Stop retries only the current scope and preserves its finite budget across edits and restart", async (t) => {
  const f = await fixture(t);
  for (const host of ["claude", "codex", "cursor", "antigravity"]) {
    const scope = f.start(host);
    let state = f.begin(scope);
    const event = host === "cursor" ? { status: "completed", loop_count: 0 } : { stop_hook_active: false };
    const first = f.good(f.hook(host, event, true));
    if (host !== "cursor") assert.equal(first.decision, host === "antigravity" ? "continue" : "block");
    assert.match(host === "cursor" ? first.followup_message : first.reason, /build: Implement change/);
    assert.deepEqual(f.good(f.hook(host, { ...event, session_id: "other-session", sessionId: "other-session", conversation_id: "other-session", conversationId: "other-session" }, true)), {});
    state = f.good(f.cli("show", scope));
    state = f.set(scope, state, "build", "active");
    assert.equal(f.start(host), scope);
    const second = f.good(f.hook(host, { ...event, stop_hook_active: true, loop_count: 1 }, true));
    assert.match(host === "cursor" ? second.followup_message : second.reason, /2\/2 continuations/);
    const exhausted = f.hook(host, { ...event, stop_hook_active: true, loop_count: 2 }, true);
    assert.match(exhausted.stderr, /limit reached/);
    assert.equal(host === "cursor" ? JSON.parse(exhausted.stdout).followup_message : JSON.parse(exhausted.stdout).decision, undefined);
    state = f.good(f.cli("show", scope));
    assert.equal(state.runs[0].continuationCount, 2);
    state = f.set(scope, state, "build", "waiting", { reason: "Need response" });
    state = f.set(scope, state, "verify", "cancelled", { reason: "User cancelled" });
    state = f.good(f.cli("resume", scope, { expectedRevision: state.revision, runId: state.currentRunId, reason: "Response arrived" }));
    state = f.set(scope, state, "build", "active", { reason: "Response arrived" });
    assert.match(f.hook(host, event, true).stderr, /limit reached/);
    assert.equal(f.good(f.cli("check", scope)).completed, false);
  }
});

test("Markdown content never gates Stop and disabled hooks do not change state or settings", async (t) => {
  const f = await fixture(t);
  const legacy = "# Other session\n- [ ] incomplete\n```md\n- [ ] example\n```\n## Later\n- [ ] deferred\n";
  writeFileSync(join(f.cwd, "TASKS.md"), legacy);
  const scope = f.start();
  assert.deepEqual(f.good(f.hook("claude", {}, true)), {});
  let state = f.begin(scope, 0, [plan[0]]);
  state = f.set(scope, state, "build", "done", { evidence: "Verified with real CLI" });
  assert.deepEqual(f.good(f.hook("claude", {}, true)), {});
  state = f.begin(scope, state.revision);
  assert.equal(f.cli("disable").status, 0);
  assert.deepEqual(f.good(f.hook("claude", {}, true)), {});
  assert.equal(f.cli("set", scope, { expectedRevision: state.revision, runId: state.currentRunId, itemId: "build", status: "active" }).status, 1);
  assert.equal(f.good(f.hook("claude")).hookSpecificOutput.additionalContext.includes("TASK scope:"), false);
  assert.deepEqual(JSON.parse(readFileSync(f.stateFile(scope), "utf8")), state);
  assert.equal(readFileSync(join(f.cwd, "TASKS.md"), "utf8"), legacy);
  assert.deepEqual(readdirSync(f.home), [".config"]);
});

test("deleted, malformed and mismatched registered state cannot be verified and error reentry is bounded", async (t) => {
  const f = await fixture(t);
  const scope = f.start();
  const state = f.begin(scope);
  for (const damage of ["deleted", "malformed", "mismatch", "empty", "history"]) {
    writeFileSync(f.stateFile(scope), JSON.stringify(state));
    if (damage === "deleted") rmSync(f.stateFile(scope));
    if (damage === "malformed") writeFileSync(f.stateFile(scope), "{");
    if (damage === "mismatch") writeFileSync(f.stateFile(scope), JSON.stringify({ ...state, scope: { ...state.scope, sessionId: "other" } }));
    if (damage === "empty") writeFileSync(f.stateFile(scope), JSON.stringify({ ...state, revision: 0, currentRunId: null, runs: [] }));
    if (damage === "history") writeFileSync(f.stateFile(scope), JSON.stringify({ ...state, runs: [{ ...state.runs[0], history: [] }] }));
    assert.equal(f.cli("show", scope).status, 1);
    assert.match(f.good(f.hook("claude", {}, true)).reason, /cannot verify completion/i);
    const reentry = f.good(f.hook("claude", { stop_hook_active: true }, true));
    assert.equal(reentry.decision, undefined);
    assert.match(reentry.systemMessage, /cannot verify completion/i);
    assert.match(f.good(f.hook("claude")).hookSpecificOutput.additionalContext, /cannot verify or register/);
    if (damage === "deleted") assert.equal(existsSync(f.stateFile(scope)), false);
  }
});

test("Antigravity Stop skips errored turns and never retries an unverifiable state", async (t) => {
  const f = await fixture(t);
  const scope = f.start("antigravity");
  f.begin(scope);
  assert.deepEqual(f.good(f.hook("antigravity", { error: "model failed" }, true)), {});
  assert.equal(f.good(f.cli("show", scope)).runs[0].continuationCount, 0);
  writeFileSync(f.stateFile(scope), "{");
  const unverifiable = f.hook("antigravity", {}, true);
  assert.deepEqual(f.good(unverifiable), {});
  assert.match(unverifiable.stderr, /cannot verify completion/i);
});

test("scope locks are bounded and concurrent updates reject stale revisions", async (t) => {
  const f = await fixture(t);
  const scope = f.start();
  const state = f.begin(scope);
  const lock = f.stateFile(scope).replace(/\.json$/, ".lock");
  mkdirSync(lock);
  const blocked = f.cli("set", scope, { expectedRevision: state.revision, runId: state.currentRunId, itemId: "build", status: "active" });
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /lock is busy/);
  assert.equal(existsSync(lock), true);
  assert.deepEqual(JSON.parse(readFileSync(f.stateFile(scope), "utf8")), state);
  assert.match(f.good(f.hook("claude", {}, true)).reason, /lock is busy/);
  assert.equal(f.good(f.hook("claude", { stop_hook_active: true }, true)).decision, undefined);
  rmSync(lock, { recursive: true });
  const change = (itemId) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(f.plugin, "scripts/tasks.mjs"), "set", "--scope", scope], { cwd: f.cwd, env: f.env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
    child.stdin.end(JSON.stringify({ expectedRevision: state.revision, runId: state.currentRunId, itemId, status: "done", evidence: `${itemId} verified` }));
  });
  const results = await Promise.all([change("build"), change("verify")]);
  assert.deepEqual(results.map((result) => result.status).sort(), [0, 1]);
  assert.match(results.find((result) => result.status === 1).stderr, /Revision conflict/);
  const after = f.good(f.cli("show", scope));
  assert.equal(after.revision, 2);
  assert.deepEqual(after.runs[0].items.map((item) => item.status).sort(), ["done", "pending"]);
  assert.equal(readdirSync(join(f.home, ".config", "rivet", "tasks")).some((name) => name.endsWith(".tmp") || name.endsWith(".lock")), false);
});

test("first snapshot write failure preserves registration and cannot silently reset the run", async (t) => {
  const f = await fixture(t);
  const scope = f.start();
  const original = readFileSync(f.stateFile(scope), "utf8");
  const preload = join(f.temp, "failed rename.mjs");
  writeFileSync(preload, `import fs from "node:fs";\nimport { syncBuiltinESMExports } from "node:module";\nfs.renameSync = () => { throw new Error("Injected filesystem write failure"); };\nsyncBuiltinESMExports();\n`);
  const result = spawnSync(process.execPath, ["--import", pathToFileURL(preload).href, join(f.plugin, "scripts/tasks.mjs"), "begin", "--scope", scope], {
    cwd: f.cwd, env: f.env, encoding: "utf8", input: JSON.stringify({ expectedRevision: 0, title: "First plan", items: plan }),
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /filesystem write failure/);
  assert.equal(readFileSync(f.stateFile(scope), "utf8"), original);
  assert.equal(readFileSync(f.stateFile(scope).replace(/\.json$/, ".registered"), "utf8"), "");
  assert.match(f.good(f.hook("claude")).hookSpecificOutput.additionalContext, /Registered TASK state lost its runs/);
  assert.equal(f.cli("begin", scope, { expectedRevision: 0, title: "Retry", items: plan }).status, 1);
  assert.match(f.good(f.hook("claude", {}, true)).reason, /cannot verify completion/);
  assert.equal(readdirSync(join(f.home, ".config", "rivet", "tasks")).some((name) => name.endsWith(".tmp") || name.endsWith(".lock")), false);
});

test("Git worktrees, hosts and sessions are isolated while subdirectories share a Git scope", async (t) => {
  const f = await fixture(t);
  const git = (args) => {
    const result = spawnSync("git", args, { cwd: f.cwd, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  git(["init"]);
  git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "-m", "test: initial"]);
  const other = join(f.temp, "other worktree");
  git(["worktree", "add", "--detach", other]);
  const scope = f.start();
  f.begin(scope);
  const subdir = join(f.cwd, "subdir");
  mkdirSync(subdir);
  assert.equal(f.start("claude", { cwd: subdir }), scope);
  assert.equal(f.cli("show", scope, undefined, { cwd: subdir }).status, 0);
  assert.notEqual(f.start("claude", { session_id: "session-B" }), scope);
  assert.notEqual(f.start("codex"), scope);
  assert.notEqual(f.start("cursor"), scope);
  const otherContext = f.good(f.hook("claude", { cwd: other })).hookSpecificOutput.additionalContext;
  assert.match(otherContext, /TASK enabled: false/);
  assert.equal(otherContext.includes("TASK scope:"), false);
  assert.equal(f.cli("show", scope, undefined, { cwd: other }).status, 1);
  assert.deepEqual(f.good(f.hook("claude", { cwd: other }, true)), {});
  const outside = join(f.temp, "plain");
  mkdirSync(outside);
  assert.equal(f.cli("enable", undefined, undefined, { cwd: outside }).status, 0);
  const plainScope = f.start("claude", { cwd: outside });
  const nested = join(outside, "nested");
  mkdirSync(nested);
  assert.equal(f.cli("show", plainScope, undefined, { cwd: nested }).status, 1);
  assert.match(f.good(f.hook("claude", { cwd: nested })).hookSpecificOutput.additionalContext, /TASK enabled: false/);
  const init = spawnSync("git", ["init", nested], { encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);
  assert.equal(f.cli("show", plainScope, undefined, { cwd: nested }).status, 1);
  assert.equal(f.cli("enable", undefined, undefined, { cwd: nested }).status, 0);
  assert.notEqual(f.start("claude", { cwd: nested }), plainScope);
});

test("Windows 8.3 short paths share the long path scope", { skip: process.platform !== "win32" && "Windows only" }, async (t) => {
  const f = await fixture(t);
  const long = realpathSync.native(f.cwd);
  const command = "$ErrorActionPreference = 'Stop'; [Console]::OutputEncoding = [Text.Encoding]::UTF8; (New-Object -ComObject Scripting.FileSystemObject).GetFolder($env:TASK_LONG_PATH).ShortPath";
  const shortPath = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { env: { ...process.env, TASK_LONG_PATH: long }, encoding: "utf8" });
  assert.equal(shortPath.status, 0, shortPath.stderr);
  assert.equal(shortPath.stderr, "");
  const short = shortPath.stdout.trim();
  assert.notEqual(short, "");
  if (short.toLowerCase() === long.toLowerCase()) return t.skip("8.3 short name generation is disabled for this volume");
  assert.equal(existsSync(short), true);
  const plainScope = f.start("claude", { cwd: long });
  assert.equal(f.start("claude", { cwd: short }), plainScope);
  const git = spawnSync("git", ["init", long], { encoding: "utf8" });
  assert.equal(git.status, 0, git.stderr);
  const scope = f.start("claude", { cwd: long });
  assert.equal(f.start("claude", { cwd: short }), scope);
  const state = f.good(f.cli("begin", scope, { expectedRevision: 0, title: "Short path", items: plan }, { cwd: short }));
  assert.equal(state.scope.worktreeRoot, long.toLowerCase());
  assert.deepEqual(f.good(f.cli("show", scope, undefined, { cwd: long })), state);
  assert.deepEqual(f.good(f.cli("show", scope, undefined, { cwd: short })), state);
});

test("Cursor aborts and errors do not continue; absent session IDs are not guessed", async (t) => {
  const f = await fixture(t);
  const scope = f.start("cursor");
  const state = f.begin(scope);
  for (const status of ["aborted", "error"]) assert.deepEqual(f.good(f.hook("cursor", { status, loop_count: 0 }, true)), {});
  assert.deepEqual(f.good(f.cli("show", scope)), state);
  const missing = f.good(f.hook("claude", { session_id: null }));
  assert.match(missing.hookSpecificOutput.additionalContext, /stable host session ID is required/);
  assert.equal(missing.hookSpecificOutput.additionalContext.includes("TASK scope:"), false);
  const scopes = readdirSync(join(f.home, ".config", "rivet", "tasks")).filter((name) => name.endsWith(".json"));
  assert.equal(scopes.length, 1);
});

for (const bomCount of [1, 2]) test(`UTF-8 input with ${bomCount} leading BOMs preserves the Cursor TASK lifecycle and rejects malformed mutations`, async (t) => {
  const f = await fixture(t);
  const event = { conversation_id: "bom-session", workspace_roots: [f.cwd] };
  const bom = (file, args, input) => f.run(file, args, undefined, { input: Buffer.from(`${"\uFEFF".repeat(bomCount)}${JSON.stringify(input)}\r\n`, "utf8") });
  const context = f.good(bom("hooks/session-start.mjs", ["cursor"], event)).additional_context;
  const scope = context.match(/TASK scope: ([a-f0-9]{64})/)?.[1];
  assert.equal(typeof scope, "string", context);
  let state = f.good(bom("scripts/tasks.mjs", ["begin", "--scope", scope], { expectedRevision: 0, title: "한글 요청", items: plan }));
  assert.equal(state.runs[0].title, "한글 요청");
  const utf16Mutation = Buffer.from(`\uFEFF${JSON.stringify({ expectedRevision: state.revision, runId: state.currentRunId, itemId: "build", status: "done", evidence: "Unsupported encoding" })}`, "utf16le");
  for (const input of ["", "\uFEFF", "\uFEFF\uFEFF", "\uFEFF{broken", utf16Mutation]) {
    assert.equal(f.run("scripts/tasks.mjs", ["set", "--scope", scope], undefined, { input }).status, 1);
    assert.deepEqual(f.good(f.cli("show", scope)), state);
  }
  const stopEvent = { ...event, status: "completed", loop_count: 0 };
  assert.match(f.good(bom("hooks/stop.mjs", ["cursor"], stopEvent)).followup_message, /build: Implement change/);
  state = f.good(f.cli("show", scope));
  for (const item of plan) {
    state = f.good(bom("scripts/tasks.mjs", ["set", "--scope", scope], { expectedRevision: state.revision, runId: state.currentRunId, itemId: item.id, status: "done", evidence: "한글 검증 완료" }));
  }
  assert.equal(state.runs[0].items[0].evidence, "한글 검증 완료");
  assert.deepEqual(f.good(bom("hooks/stop.mjs", ["cursor"], { ...stopEvent, loop_count: 1 })), {});
  assert.equal(f.good(f.cli("check", scope)).completed, true);
});

const documentedEncoding = readFileSync(join(root, "prompts/tasks.md"), "utf8").match(/`(\$OutputEncoding = [^`]+)`/)[1];

test("Windows PowerShell UTF-8 pipelines register Cursor scopes", { skip: process.platform !== "win32" && "Windows only" }, async (t) => {
  const f = await fixture(t);
  const payloadFile = join(f.temp, "payload.json");
  for (const shell of ["powershell.exe", "pwsh.exe"]) {
    const payload = JSON.stringify({ conversation_id: shell, workspace_roots: [f.cwd] });
    writeFileSync(payloadFile, payload);
    const command = `${documentedEncoding}; Get-Content -LiteralPath $env:TASK_PAYLOAD_FILE -Raw -Encoding UTF8 | & { $input | & $env:TASK_NODE $env:TASK_SCRIPT cursor }`;
    const result = spawnSync(shell, ["-NoProfile", "-NonInteractive", "-Command", command], {
      cwd: f.cwd, encoding: "utf8", env: { ...f.env, TASK_NODE: process.execPath, TASK_SCRIPT: join(f.plugin, "hooks/session-start.mjs"), TASK_PAYLOAD_FILE: payloadFile },
    });
    if (result.error?.code === "ENOENT") {
      t.diagnostic(`${shell} is not installed`);
      continue;
    }
    const failure = `${shell}: ${result.stderr}`;
    assert.equal(result.status, 0, failure);
    assert.equal(result.stderr, "", failure);
    const context = JSON.parse(result.stdout).additional_context;
    assert.equal(resolve(JSON.parse(context.match(/^Workstyle skill: (.+)$/m)?.[1])), join(f.plugin, "skills", "workstyle", "SKILL.md"), `${shell}: skill path`);
    assert.equal(resolve(JSON.parse(context.match(/^TASK script: (.+)$/m)?.[1])), join(f.plugin, "scripts", "tasks.mjs"), `${shell}: script path`);
    assert.equal(resolve(JSON.parse(context.match(/^TASK workspace: (.+)$/m)?.[1])), realpathSync.native(f.cwd).toLowerCase(), `${shell}: workspace path`);
    const scope = context.match(/TASK scope: ([a-f0-9]{64})/)?.[1];
    assert.equal(typeof scope, "string", context);
    const state = f.good(f.cli("show", scope));
    assert.equal(state.scope.sessionId, shell);
    assert.equal(state.scope.worktreeRoot, realpathSync.native(f.cwd).toLowerCase());
  }
});

for (const shell of ["powershell.exe", "pwsh.exe"]) for (const mode of ["FullLanguage", "ConstrainedLanguage"]) test(`${shell} ${mode} preserves Korean TASK text with the documented UTF-8 pipeline`, { skip: process.platform !== "win32" && "Windows only" }, async (t) => {
  const f = await fixture(t);
  const scope = f.start("cursor");
  const payload = JSON.stringify({
    expectedRevision: 0,
    title: "한글 요청 보존",
    items: [{ id: "verify", title: "검증 항목", verification: "저장된 원문 확인" }],
  });
  const command = `$ExecutionContext.SessionState.LanguageMode = '${mode}'; ${documentedEncoding}; $env:TASK_PAYLOAD | & $env:TASK_NODE $env:TASK_SCRIPT begin --scope $env:TASK_SCOPE`;
  const result = spawnSync(shell, ["-NoProfile", "-NonInteractive", "-Command", command], {
    cwd: f.cwd, encoding: "utf8", env: { ...f.env, TASK_NODE: process.execPath, TASK_SCRIPT: join(f.plugin, "scripts/tasks.mjs"), TASK_PAYLOAD: payload, TASK_SCOPE: scope },
  });
  if (result.error?.code === "ENOENT") {
    t.skip(`${shell} is not installed`);
    return;
  }
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const state = f.good(f.cli("show", scope));
  assert.equal(state.runs[0].title, "한글 요청 보존");
  assert.equal(state.runs[0].items[0].title, "검증 항목");
  assert.equal(state.runs[0].items[0].verification, "저장된 원문 확인");
});

test("OMP uses session_stop continuation contract and skips aborted and error stops", async (t) => {
  const f = await fixture(t);
  const source = `
    import assert from 'node:assert/strict';
    import { spawnSync } from 'node:child_process';
    import register from ${JSON.stringify(pathToFileURL(join(f.plugin, "hooks/omp-session-start.mjs")).href)};
    const handlers = new Map();
    const messages = [];
    const warnings = [];
    register({ on: (name, fn) => handlers.set(name, fn), sendMessage: (message, options) => messages.push({ message, options }) });
    const ctx = { cwd: process.cwd(), sessionManager: { getSessionId: () => 'omp-test' }, ui: { notify: (message, severity) => warnings.push({ message, severity }) } };
    handlers.get('session_start')({ type: 'session_start' }, ctx);
    const scope = messages[0].message.content.match(/TASK scope: ([a-f0-9]{64})/)[1];
    const result = spawnSync(process.execPath, [${JSON.stringify(join(f.plugin, "scripts/tasks.mjs"))}, 'begin', '--scope', scope], { encoding: 'utf8', input: JSON.stringify({ expectedRevision: 0, title: 'OMP test', items: ${JSON.stringify(plan)} }) });
    assert.equal(result.status, 0, result.stderr);
    const event = { type: 'session_stop', messages: [], turn_id: 1, session_id: 'omp-test', stop_hook_active: false, signal: new AbortController().signal, last_assistant_message: { role: 'assistant', stopReason: 'stop', content: [] } };
    assert.equal(handlers.has('agent_end'), false);
    const controller = new AbortController();
    controller.abort();
    assert.equal(handlers.get('session_stop')({ ...event, signal: controller.signal }, ctx), undefined);
    for (const stopReason of ['error', 'aborted']) assert.equal(handlers.get('session_stop')({ ...event, last_assistant_message: { role: 'assistant', stopReason } }, ctx), undefined);
    const first = handlers.get('session_stop')(event, ctx);
    assert.equal(first.continue, true);
    assert.match(first.additionalContext, /1\\/2 continuations/);
    handlers.get('session_compact')({ type: 'session_compact' }, ctx);
    const second = handlers.get('session_stop')({ ...event, stop_hook_active: true }, ctx);
    assert.equal(second.continue, true);
    assert.match(second.additionalContext, /2\\/2 continuations/);
    assert.equal(handlers.get('session_stop')({ ...event, stop_hook_active: true }, ctx), undefined);
    assert.equal(messages.length, 2);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].severity, 'warning');
    assert.match(warnings[0].message, /limit reached/);
    process.stdout.write('OMP stop contract verified');
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], { cwd: f.cwd, env: f.env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "OMP stop contract verified");
});

test("TASK activation follows one project file block and ignores the home flag", async (t) => {
  const temp = mkdtempSync(join(tmpdir(), "task-block "));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const workspace = join(temp, "workspace");
  const home = join(temp, "home");
  mkdirSync(workspace);
  mkdirSync(join(home, ".config", "rivet"), { recursive: true });
  const flag = join(home, ".config", "rivet", "tasks-enabled");
  writeFileSync(flag, "still here");
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const block = "<!-- rivet-tasks:start -->\nRivet TASK tracking is enabled for this project.\n<!-- rivet-tasks:end -->\n";
  const claude = join(workspace, "CLAUDE.md");
  const agents = join(workspace, "AGENTS.md");
  const run = (args, cwd = workspace) => spawnSync(process.execPath, [join(root, "scripts/tasks.mjs"), ...args], { cwd, env, encoding: "utf8" });
  const hook = (cwd = workspace) => {
    const result = spawnSync(process.execPath, [join(root, "hooks/session-start.mjs"), "claude"], {
      cwd, env, encoding: "utf8", input: JSON.stringify({ session_id: "block-session", cwd }),
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
  };
  const status = (cwd = workspace) => {
    const result = run(["status"], cwd);
    assert.equal(result.status, 0, result.stderr);
    const [state, path] = result.stdout.split("\n");
    return { state, path, stdout: result.stdout };
  };

  const disabled = status();
  assert.equal(disabled.stdout, `disabled\n${disabled.path}\n`);
  assert.match(hook(), /TASK enabled: false/);
  assert.equal(hook().includes("TASK scope:"), false);
  assert.equal(readFileSync(flag, "utf8"), "still here");
  const refused = run(["enable"]);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /--file CLAUDE.md or --file AGENTS.md/);
  assert.equal(existsSync(claude), false);
  assert.equal(existsSync(agents), false);
  assert.equal(run(["enable", "--file", "README.md"]).status, 1);
  assert.equal(existsSync(join(workspace, "README.md")), false);

  writeFileSync(claude, "keep\n");
  const enabled = run(["enable", "--file", "AGENTS.md"]);
  assert.equal(enabled.status, 0, enabled.stderr);
  assert.equal(readFileSync(claude, "utf8"), "keep\n");
  assert.equal(readFileSync(agents, "utf8"), block);
  assert.equal(status().stdout, `enabled\n${join(disabled.path, "AGENTS.md")}\n`);
  const context = hook();
  assert.match(context, /TASK enabled: true/);
  const scope = context.match(/TASK scope: ([a-f0-9]{64})/)?.[1];
  assert.equal(typeof scope, "string");
  const begin = spawnSync(process.execPath, [join(root, "scripts/tasks.mjs"), "begin", "--scope", scope], {
    cwd: workspace, env, encoding: "utf8",
    input: JSON.stringify({ expectedRevision: 0, title: "Block", items: [{ id: "check", title: "Check block", verification: "Read the file" }] }),
  });
  assert.equal(begin.status, 0, begin.stderr);
  const again = run(["enable"]);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(readFileSync(agents, "utf8"), block);
  assert.equal(readFileSync(claude, "utf8"), "keep\n");

  writeFileSync(agents, `notes\n${block}tail\n`);
  const converged = run(["enable"]);
  assert.equal(converged.status, 0, converged.stderr);
  assert.equal(readFileSync(agents, "utf8"), `notes\ntail\n${block}`);
  assert.equal(status().state, "enabled");

  writeFileSync(claude, `${block}<!-- rivet-tasks:start -->\nsecret\n<!-- rivet-tasks:end -->\nkept\n`);
  writeFileSync(agents, block);
  assert.equal(status().state, "disabled");
  const moved = run(["enable", "--file", "CLAUDE.md"]);
  assert.equal(moved.status, 0, moved.stderr);
  assert.equal(readFileSync(claude, "utf8"), `kept\n${block}`);
  assert.equal(existsSync(agents), false);
  assert.equal(status().stdout, `enabled\n${join(disabled.path, "CLAUDE.md")}\n`);

  writeFileSync(claude, "<!-- rivet-tasks:start -->\nkeep this line\n");
  writeFileSync(agents, " \n");
  const cleaned = run(["enable", "--file", "AGENTS.md"]);
  assert.equal(cleaned.status, 0, cleaned.stderr);
  assert.equal(readFileSync(claude, "utf8"), "keep this line\n");
  assert.equal(readFileSync(agents, "utf8"), block);

  writeFileSync(claude, block.replaceAll("\n", "\r\n"));
  writeFileSync(agents, "plain\n");
  assert.equal(status().stdout, `enabled\n${join(disabled.path, "CLAUDE.md")}\n`);
  writeFileSync(agents, `${block}${block}`);
  assert.equal(status().state, "disabled");
  writeFileSync(agents, "plain\n");
  writeFileSync(claude, "<!-- rivet-tasks:start -->\nwrong body\n<!-- rivet-tasks:end -->\n");
  assert.equal(status().state, "disabled");
  const off = run(["disable"]);
  assert.equal(off.status, 0, off.stderr);
  assert.equal(off.stdout, `disabled\n${disabled.path}\n`);
  assert.equal(readFileSync(agents, "utf8"), "plain\n");
  assert.equal(existsSync(claude), false);
  const offAgain = run(["disable"]);
  assert.equal(offAgain.status, 0, offAgain.stderr);
  assert.equal(offAgain.stdout, off.stdout);
  assert.equal(readFileSync(flag, "utf8"), "still here");
  const denied = spawnSync(process.execPath, [join(root, "scripts/tasks.mjs"), "begin", "--scope", scope], {
    cwd: workspace, env, encoding: "utf8",
    input: JSON.stringify({ expectedRevision: 1, title: "No", items: [{ id: "check", title: "No", verification: "Exit" }] }),
  });
  assert.equal(denied.status, 1);
  assert.match(denied.stderr, /disabled/);
  assert.match(hook(), /TASK enabled: false/);

  const repo = join(temp, "repo");
  const child = join(repo, "child");
  mkdirSync(child, { recursive: true });
  const init = spawnSync("git", ["init", repo], { encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);
  const fromChild = run(["enable", "--file", "CLAUDE.md"], child);
  assert.equal(fromChild.status, 0, fromChild.stderr);
  assert.equal(existsSync(join(child, "CLAUDE.md")), false);
  assert.equal(existsSync(join(repo, "AGENTS.md")), false);
  assert.equal(readFileSync(join(repo, "CLAUDE.md"), "utf8"), block);
  assert.equal(status(child).stdout, status(repo).stdout);
  assert.equal(status(child).state, "enabled");
});
