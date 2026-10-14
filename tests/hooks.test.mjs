import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

test("installed hooks route to an internal skill within the startup budget and obey the TASK flag", async (t) => {
  const temp = mkdtempSync(join(tmpdir(), "rivet 한글 "));
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
    const result = run("hooks/session-start.mjs", [host], host === "cursor" ? { conversation_id: "flag-session", workspace_roots: [workspace] }
      : host === "copilot" ? { sessionId: "flag-session", cwd: workspace } : { session_id: "flag-session", cwd: workspace });
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    if (host === "cursor") return payload.additional_context;
    if (host === "copilot") return payload.additionalContext;
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
  for (const host of ["claude", "codex", "cursor", "gemini", "copilot"]) {
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
  for (const host of ["claude", "codex", "cursor", "gemini", "copilot"]) {
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

test("Gemini packaging keeps local references and executes the shipped hooks outside the source tree", (t) => {
  const temp = mkdtempSync(join(tmpdir(), "rivet gemini 한글 "));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const output = join(temp, "extension copy");
  const pack = (target) => spawnSync(process.execPath, [join(root, "scripts/package-gemini.mjs"), target], { encoding: "utf8" });
  const built = pack(output);
  assert.equal(built.status, 0, built.stderr);
  const manifest = JSON.parse(readFileSync(join(output, "gemini-extension.json"), "utf8"));
  assert.equal(manifest.name, "rivet");
  assert.equal(manifest.version, JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version);
  assert.equal(existsSync(join(root, "gemini-extension.json")), false);
  assert.deepEqual(readdirSync(join(output, "skills")).sort(), ["adversarial-cross-review", "cross-review", "internal-agent-setup", "internal-cross-review", "internal-workstyle", "tasks-setup"]);
  const checkLinks = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) checkLinks(file);
      else if (/\.(md|mdc)$/.test(file)) {
        for (const match of readFileSync(file, "utf8").matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
          const target = match[1].split("#")[0];
          if (target && !/^[a-z]+:/i.test(target)) assert.ok(existsSync(resolve(dirname(file), target)), `${file}: missing ${target}`);
        }
      }
    }
  };
  checkLinks(output);
  const hooks = JSON.parse(readFileSync(join(output, "hooks/hooks.json"), "utf8")).hooks;
  assert.deepEqual(Object.keys(hooks), ["SessionStart", "AfterAgent"]);
  assert.ok(readFileSync(join(root, "hooks/hooks.json"), "utf8").includes("CLAUDE_PLUGIN_ROOT"));
  const home = join(temp, "home");
  mkdirSync(home);
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const cli = (args, input) => spawnSync(process.execPath, [join(output, "scripts/tasks.mjs"), ...args], { cwd: temp, env, encoding: "utf8", input: JSON.stringify(input) });
  const fire = (name, event) => {
    const entry = hooks[name][0].hooks[0];
    assert.equal(entry.timeout, 10000);
    const command = entry.command.replaceAll("${extensionPath}", output.replaceAll("\\", "/"));
    const result = process.platform === "win32"
      ? spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { cwd: temp, env, encoding: "utf8", input: JSON.stringify(event) })
      : spawnSync("sh", ["-c", command], { cwd: temp, env, encoding: "utf8", input: JSON.stringify(event) });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const event = { session_id: "packaged-gemini", cwd: temp, hook_event_name: "SessionStart", source: "startup" };
  const disabled = fire("SessionStart", event).hookSpecificOutput.additionalContext;
  assert.match(disabled, /TASK enabled: false/);
  const skillPath = JSON.parse(disabled.match(/^Workstyle skill: (.+)$/m)[1]);
  assert.equal(resolve(skillPath), join(output, "skills/internal-workstyle/SKILL.md"));
  assert.ok(readFileSync(skillPath, "utf8").trim());
  assert.equal(cli(["enable"]).status, 0);
  const context = fire("SessionStart", event).hookSpecificOutput.additionalContext;
  const scope = context.match(/TASK scope: ([a-f0-9]{64})/)[1];
  assert.equal(resolve(JSON.parse(context.match(/^TASK script: (.+)$/m)[1])), join(output, "scripts/tasks.mjs"));
  assert.equal(cli(["begin", "--scope", scope], { expectedRevision: 0, title: "Package test", items: [{ id: "verify", title: "Verify shipped hook", verification: "Run its configured command" }] }).status, 0);
  assert.equal(fire("AfterAgent", { ...event, hook_event_name: "AfterAgent", stop_hook_active: false }).decision, "deny");
  const saved = readFileSync(join(output, "gemini-extension.json"), "utf8");
  assert.equal(pack(output).status, 1);
  assert.equal(readFileSync(join(output, "gemini-extension.json"), "utf8"), saved);
  const nested = join(root, "gemini-output-test");
  assert.equal(pack(nested).status, 1);
  assert.equal(existsSync(nested), false);
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

test("Copilot plugin uses its namespaced hooks and the host-provided plugin root on each shell", async (t) => {
  const temp = mkdtempSync(join(tmpdir(), "rivet copilot 한글 "));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const plugin = join(temp, "plugin copy");
  for (const directory of ["com.github.copilot", "hooks", "scripts", "prompts", "skills"]) await cp(join(root, directory), join(plugin, directory), { recursive: true });
  const manifest = JSON.parse(readFileSync(join(root, "plugin.json"), "utf8"));
  assert.equal(manifest.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
  assert.equal(manifest.hooks, undefined);
  assert.equal(manifest.skills, undefined);
  const config = JSON.parse(readFileSync(join(plugin, "com.github.copilot/hooks/hooks.json"), "utf8"));
  assert.equal(config.version, 1);
  assert.deepEqual(Object.keys(config.hooks), ["sessionStart", "agentStop"]);
  const home = join(temp, "home");
  mkdirSync(home);
  const env = { ...process.env, HOME: home, USERPROFILE: home, PLUGIN_ROOT: plugin };
  const cli = (args, input) => spawnSync(process.execPath, [join(plugin, "scripts/tasks.mjs"), ...args], { cwd: temp, env, encoding: "utf8", input: JSON.stringify(input) });
  const fire = (name, event) => {
    const entry = config.hooks[name][0];
    assert.equal(entry.timeoutSec, 10);
    const result = process.platform === "win32"
      ? spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", entry.powershell], { cwd: temp, env, encoding: "utf8", input: JSON.stringify(event) })
      : spawnSync("bash", ["-c", entry.bash], { cwd: temp, env, encoding: "utf8", input: JSON.stringify(event) });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const event = { sessionId: "configured-copilot", cwd: temp, source: "new", timestamp: Date.now() };
  const disabled = fire("sessionStart", event).additionalContext;
  assert.match(disabled, /TASK enabled: false/);
  const skillPath = JSON.parse(disabled.match(/^Workstyle skill: (.+)$/m)[1]);
  assert.equal(resolve(skillPath), join(plugin, "skills/internal-workstyle/SKILL.md"));
  assert.ok(readFileSync(skillPath, "utf8").trim());
  assert.equal(cli(["enable"]).status, 0);
  const context = fire("sessionStart", event).additionalContext;
  const scope = context.match(/TASK scope: ([a-f0-9]{64})/)[1];
  assert.equal(cli(["begin", "--scope", scope], { expectedRevision: 0, title: "Copilot test", items: [{ id: "verify", title: "Verify configured hook", verification: "Run the command with PLUGIN_ROOT" }] }).status, 0);
  const stop = fire("agentStop", { ...event, stopReason: "end_turn", stop_hook_active: false });
  assert.equal(stop.decision, "block");
  assert.match(stop.reason, /1\/2 continuations/);
});
