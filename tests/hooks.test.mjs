import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

test("installed hooks route to an internal skill within the startup budget and obey the TASK flag", async (t) => {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), "rivet 한글 ")));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const plugin = join(temp, "long plugin directory ".repeat(3).trim(), "installed plugins", "plugin copy");
  const workspace = join(temp, process.platform === "win32" ? "workspace copy" : "workspace copy\\source");
  mkdirSync(workspace);
  for (const directory of ["hooks", "scripts", "prompts", "skills"]) await cp(join(root, directory), join(plugin, directory), { recursive: true });
  const home = join(temp, "home");
  mkdirSync(home);
  const flag = join(home, ".config", "rivet", "tasks-enabled");
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const run = (file, args = [], input) => spawnSync(process.execPath, [join(plugin, file), ...args], { cwd: workspace, env, encoding: "utf8", input: JSON.stringify(input) });
  const context = (host) => {
    const result = run("hooks/session-start.mjs", [host], host === "cursor" ? { conversation_id: "flag-session", workspace_roots: [workspace] } : { session_id: "flag-session", cwd: workspace });
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    if (host === "cursor") return payload.additional_context;
    assert.equal(payload.hookSpecificOutput.hookEventName, "SessionStart");
    return payload.hookSpecificOutput.additionalContext;
  };
  const bootstrap = readFileSync(join(plugin, "prompts/session-start.md"), "utf8").trim();
  const skillPath = join(plugin, "skills/internal-workstyle/SKILL.md");
  const assertRules = (actual, tasks) => {
    assert.ok(Buffer.byteLength(actual, "utf8") < 2000, "startup context must fit the ~2 KB hook output preview");
    assert.ok(actual.startsWith(bootstrap));
    assert.ok(actual.includes(`TASK enabled: ${tasks}`));
    const actualPath = JSON.parse(actual.match(/^Workstyle skill: (.+)$/m)[1]);
    assert.equal(resolve(actualPath), skillPath);
    if (process.platform === "win32") assert.ok(!actualPath.includes("\\"), "Windows display paths use forward slashes");
    const skill = readFileSync(actualPath, "utf8");
    const references = [...skill.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((match) => resolve(dirname(actualPath), match[1]));
    assert.deepEqual(references, [join(plugin, "prompts/global.md"), join(plugin, "prompts/tasks.md")]);
    for (const path of references) assert.ok(readFileSync(path, "utf8").trim());
  };
  const disabled = context("claude");
  for (const host of ["claude", "codex", "cursor"]) {
    const actual = context(host);
    assert.equal(actual, disabled);
    assertRules(actual, false);
    assert.doesNotMatch(actual, /TASK (script|scope|workspace|revision):/);
  }
  assert.deepEqual(readdirSync(home), []);
  assert.equal(run("scripts/tasks.mjs", ["status"]).stdout, `disabled\n${flag}\n`);
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = run("scripts/tasks.mjs", ["enable"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, `enabled\n${flag}\n`);
  }
  for (const host of ["claude", "codex", "cursor"]) {
    const actual = context(host);
    assertRules(actual, true);
    assert.match(actual, /TASK scope: [a-f0-9]{64}/);
    const script = JSON.parse(actual.match(/^TASK script: (.+)$/m)[1]);
    const actualWorkspace = JSON.parse(actual.match(/^TASK workspace: (.+)$/m)[1]);
    assert.equal(resolve(script), join(plugin, "scripts/tasks.mjs"));
    const canonicalWorkspace = realpathSync.native(workspace);
    assert.equal(resolve(actualWorkspace), process.platform === "win32" ? canonicalWorkspace.toLowerCase() : canonicalWorkspace);
    if (process.platform === "win32") {
      assert.ok(!script.includes("\\"));
      assert.ok(!actualWorkspace.includes("\\"));
    }
  }
  assert.equal(readFileSync(flag, "utf8"), "");
  const before = context("cursor");
  for (const file of ["global", "tasks"]) writeFileSync(join(plugin, `prompts/${file}.md`), "규칙이 늘어도 시작 문맥은 커지지 않는다.\n".repeat(1000));
  assert.equal(context("cursor"), before);
  writeFileSync(flag, "preserve user content");
  assert.notEqual(run("scripts/tasks.mjs", ["disable"]).status, 0);
  assert.equal(readFileSync(flag, "utf8"), "preserve user content");
  writeFileSync(flag, "");
  for (let attempt = 0; attempt < 2; attempt++) assert.equal(run("scripts/tasks.mjs", ["disable"]).stdout, `disabled\n${flag}\n`);
  assert.equal(context("claude"), disabled);
  assert.notEqual(run("scripts/tasks.mjs", ["unknown"]).status, 0);
  assert.notEqual(run("hooks/session-start.mjs", ["unknown"]).status, 0);
  mkdirSync(flag);
  assert.notEqual(run("scripts/tasks.mjs", ["enable"]).status, 0);
  assert.equal(context("cursor"), disabled);
});

test("OMP queues hidden context on startup, switching and compaction using the host context", async (t) => {
  const temp = mkdtempSync(join(tmpdir(), "rivet-omp-"));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  for (const directory of ["hooks", "scripts", "prompts"]) await cp(join(root, directory), join(temp, directory), { recursive: true });
  writeFileSync(join(temp, "scripts/context.mjs"), 'export function sessionContext(host, sessionId, cwd) { return JSON.stringify({ host, sessionId, cwd }); }\n');
  const { default: register } = await import(pathToFileURL(join(temp, "hooks/omp-session-start.mjs")));
  const handlers = new Map();
  const messages = [];
  register({
    on(event, callback) { handlers.set(event, callback); },
    sendMessage(message, options) { messages.push({ message, options }); },
  });
  assert.equal(messages.length, 0);
  for (const event of ["session_start", "session_switch", "session_compact"]) {
    messages.length = 0;
    handlers.get(event)({ reason: "new" }, { cwd: temp, sessionManager: { getSessionId: () => "omp-session" } });
    assert.deepEqual(messages, [{
      message: { customType: "rivet", content: JSON.stringify({ host: "omp", sessionId: "omp-session", cwd: temp }), display: false },
      options: { deliverAs: "nextTurn" },
    }]);
  }
});
