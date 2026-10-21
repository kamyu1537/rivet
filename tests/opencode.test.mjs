import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

async function fixture(t, enabled = true, flagFailure = false) {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), "rivet-opencode 한글 ")));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const plugin = join(temp, "plugin copy");
  const cwd = join(temp, "workspace");
  const home = join(temp, "home");
  for (const dir of ["hooks", "scripts", "prompts", "skills"]) await cp(join(root, dir), join(plugin, dir), { recursive: true });
  if (flagFailure) writeFileSync(join(plugin, "scripts/task-state.mjs"), 'export function tasksEnabled() { throw new Error("EACCES: tasks-enabled"); }\nexport function openTaskScope() {}\nexport function checkTaskStop() {}\n');
  mkdirSync(cwd);
  mkdirSync(join(home, ".config", "rivet"), { recursive: true });
  const flag = join(home, ".config", "rivet", "tasks-enabled");
  if (enabled) writeFileSync(flag, "");
  const previous = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  let register;
  let tasks;
  try {
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    ({ default: register } = await import(pathToFileURL(join(plugin, "hooks/opencode.mjs"))));
    tasks = await import(pathToFileURL(join(plugin, "scripts/task-state.mjs")));
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  const prompts = [];
  const warnings = [];
  const histories = new Map();
  const sessions = new Map();
  const client = {
    session: {
      get: async ({ path }) => ({ data: sessions.get(path.id) ?? { id: path.id } }),
      messages: async ({ path, query, throwOnError }) => {
        assert.deepEqual(query, { directory: cwd, limit: 1 });
        assert.equal(throwOnError, true);
        return { data: histories.get(path.id) ?? [] };
      },
      promptAsync: async (request) => { prompts.push(request); },
    },
    tui: { showToast: async ({ body }) => { warnings.push(body.message); } },
  };
  const hooks = await register({ client, directory: cwd });
  const event = (type, sessionID, properties = {}) => hooks.event({ event: { type, properties: { sessionID, ...properties } } });
  const context = async (sessionID = "ses_A") => {
    const output = { system: ["Host rules"] };
    await hooks["experimental.chat.system.transform"]({ sessionID }, output);
    assert.equal(output.system.length, 1);
    return output.system[0];
  };
  const begin = async (sessionID = "ses_A") => {
    await context(sessionID);
    const state = tasks.openTaskScope("opencode", sessionID, cwd);
    return tasks.runTaskCommand(state.scopeId, "begin", { expectedRevision: state.revision, title: "Feature", items: [{ id: "verify", title: "Verify change", verification: "Run behavior test" }] }, cwd);
  };
  const finish = (sessionID, id, extra = {}) => {
    histories.set(sessionID, [{ info: {
      id, sessionID, role: "assistant", parentID: "msg_user", mode: "plan", modelID: "model", providerID: "provider", variant: "high", time: { created: 1, completed: 2 }, finish: "stop", ...extra,
    }, parts: [] }]);
  };
  return { plugin, cwd, home, flag, tasks, client, hooks, event, context, begin, finish, prompts, warnings, histories, sessions };
}

test("OpenCode merges bundled skills and supplies bounded current context on every model request", async (t) => {
  const f = await fixture(t, false);
  const config = { skills: { paths: ["custom skills"], urls: ["https://example.com/skills"] } };
  await f.hooks.config(config);
  await f.hooks.config(config);
  assert.deepEqual(config, { skills: { paths: ["custom skills", join(f.plugin, "skills")], urls: ["https://example.com/skills"] } });
  const disabled = await f.context();
  assert.ok(disabled.startsWith("Host rules\n\n"));
  assert.match(disabled, /TASK enabled: false/);
  const skillPath = JSON.parse(disabled.match(/^Workstyle skill: (.+)$/m)[1]);
  assert.equal(resolve(skillPath), join(f.plugin, "skills/internal-workstyle/SKILL.md"));
  assert.ok(readFileSync(skillPath, "utf8").trim());
  assert.ok(Buffer.byteLength(disabled, "utf8") < 4096);
  assert.equal(await f.context(), disabled);
  writeFileSync(f.flag, "");
  const first = await f.context();
  assert.match(first, /TASK scope: [a-f0-9]{64}/);
  const state = await f.begin();
  const resumed = await f.context();
  assert.ok(resumed.includes(`TASK scope: ${state.scopeId}`));
  assert.match(resumed, /TASK revision: 1$/);
  assert.notEqual(await f.context("ses_B"), resumed);
  const missing = { system: ["Internal model request"] };
  await f.hooks["experimental.chat.system.transform"]({}, missing);
  assert.deepEqual(missing.system, ["Internal model request"]);
});

test("OpenCode retries unfinished top-level work twice, deduplicates idle, and preserves agent/model", async (t) => {
  const f = await fixture(t);
  const state = await f.begin();
  for (let i = 1; i <= 3; i++) {
    await f.hooks["chat.message"]({ sessionID: "ses_A" });
    f.finish("ses_A", `msg_${i}`);
    await Promise.all([f.event("session.idle", "ses_A"), f.event("session.idle", "ses_A")]);
    await f.event("session.idle", "ses_A");
  }
  assert.equal(f.prompts.length, 2);
  assert.deepEqual(f.prompts[0].path, { id: "ses_A" });
  assert.deepEqual(f.prompts[0].query, { directory: f.cwd });
  assert.equal(f.prompts[0].throwOnError, true);
  assert.equal(f.prompts[0].body.agent, "plan");
  assert.deepEqual(f.prompts[0].body.model, { providerID: "provider", modelID: "model" });
  assert.equal(f.prompts[0].body.variant, "high");
  assert.match(f.prompts[0].body.parts[0].text, /1\/2 continuations/);
  assert.match(f.prompts[1].body.parts[0].text, /2\/2 continuations/);
  assert.match(f.warnings[0], /continuation limit reached/);
  assert.equal(f.tasks.runTaskCommand(state.scopeId, "show", undefined, f.cwd).runs[0].continuationCount, 2);
});

test("OpenCode does not resume aborts, errors, incomplete responses, summaries, children or disabled TASK", async (t) => {
  const f = await fixture(t);
  await f.begin();
  const cases = [
    { error: { name: "MessageAbortedError", data: { message: "Aborted" } } },
    { error: { name: "APIError", data: { message: "Failed" } } },
    { finish: "tool-calls" }, { finish: "length" }, { finish: "content-filter" }, { finish: undefined },
    { time: { created: 1 } }, { summary: true }, { role: "user" },
  ];
  for (const [i, extra] of cases.entries()) {
    f.finish("ses_A", `msg_${i}`, extra);
    await f.event("session.idle", "ses_A");
  }
  f.finish("ses_A", "msg_normal");
  await f.event("session.error", "ses_A", { error: { name: "MessageAbortedError" } });
  await f.event("session.status", "ses_A", { status: { type: "busy" } });
  await f.event("session.idle", "ses_A");
  await f.hooks["chat.message"]({ sessionID: "ses_A" });
  f.sessions.set("ses_A", { id: "ses_A", parentID: "ses_parent" });
  await f.event("session.idle", "ses_A");
  f.sessions.delete("ses_A");
  rmSync(f.flag);
  await f.event("session.idle", "ses_A");
  assert.equal(f.prompts.length, 0);
  writeFileSync(f.flag, "");
  await f.event("session.idle", "ses_A");
  assert.equal(f.prompts.length, 1);
});

test("OpenCode cancels pending checks on new input, busy status, errors and deletion", async (t) => {
  const f = await fixture(t);
  const state = await f.begin();
  for (const action of ["input", "busy", "error", "deleted"]) {
    await f.hooks["chat.message"]({ sessionID: "ses_A" });
    f.finish("ses_A", `msg_${action}`);
    let release;
    f.client.session.messages = () => new Promise((resolve) => { release = resolve; });
    const checking = f.event("session.idle", "ses_A");
    if (action === "input") await f.hooks["chat.message"]({ sessionID: "ses_A" });
    if (action === "busy") await f.event("session.status", "ses_A", { status: { type: "busy" } });
    if (action === "error") await f.event("session.error", "ses_A", { error: { name: "MessageAbortedError" } });
    if (action === "deleted") await f.hooks.event({ event: { type: "session.deleted", properties: { info: { id: "ses_A" } } } });
    release({ data: f.histories.get("ses_A") });
    await checking;
  }
  assert.equal(f.prompts.length, 0);
  assert.equal(f.tasks.runTaskCommand(state.scopeId, "show", undefined, f.cwd).runs[0].continuationCount, 0);
});

test("OpenCode isolates session errors and bounds corrupted-state retries", async (t) => {
  const f = await fixture(t);
  const state = await f.begin();
  await f.begin("ses_B");
  await f.event("session.error", "ses_B", { error: { name: "APIError" } });
  writeFileSync(join(f.home, ".config", "rivet", "tasks", `${state.scopeId}.json`), "broken");
  for (let i = 0; i < 2; i++) {
    f.finish("ses_A", `msg_${i}`);
    await f.event("session.idle", "ses_A");
  }
  assert.equal(f.prompts.length, 1);
  assert.match(f.prompts[0].body.parts[0].text, /cannot verify completion/);
  assert.match(f.warnings[0], /cannot verify completion/);
  await f.hooks["chat.message"]({ sessionID: "ses_B" });
  f.finish("ses_B", "msg_B");
  f.client.session.promptAsync = async () => { throw new Error("Connection closed"); };
  await assert.doesNotReject(f.event("session.idle", "ses_B"));
  assert.match(f.warnings.at(-1), /Connection closed/);
});

test("OpenCode contains TASK flag read failures inside its asynchronous event handler", async (t) => {
  const f = await fixture(t, true, true);
  await f.hooks["chat.message"]({ sessionID: "ses_A" });
  await assert.doesNotReject(f.event("session.idle", "ses_A"));
  assert.equal(f.prompts.length, 0);
  assert.match(f.warnings[0], /EACCES: tasks-enabled/);
});
