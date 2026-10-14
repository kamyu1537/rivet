import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

test("Codex marketplace source ships working hooks and skill dependencies without packaging", async (t) => {
  const temp = mkdtempSync(join(tmpdir(), "rivet codex 한글 "));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const repository = join(temp, "repository copy");
  await cp(root, repository, { recursive: true, filter: (source) => ![".git", "node_modules", ".serena", ".audit"].includes(basename(source)) });
  const marketplace = JSON.parse(readFileSync(join(repository, ".agents/plugins/marketplace.json"), "utf8"));
  assert.equal(marketplace.name, "rivet");
  assert.equal(marketplace.plugins[0].source.source, "local");
  const plugin = resolve(repository, marketplace.plugins[0].source.path);
  assert.equal(existsSync(join(plugin, "plugin.json")), false, "portable manifests suppress hooks in Codex 0.162.1");
  const manifest = JSON.parse(readFileSync(join(plugin, ".codex-plugin/plugin.json"), "utf8"));
  assert.equal(manifest.name, marketplace.plugins[0].name);
  assert.equal(manifest.version, JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version);
  assert.deepEqual(readdirSync(resolve(plugin, manifest.skills)).sort(), ["adversarial-cross-review", "cross-review", "internal-agent-setup", "internal-cross-review", "internal-workstyle", "tasks-setup"]);
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
  checkLinks(plugin);
  const home = join(temp, "home");
  const workspace = join(temp, "작업 공간");
  mkdirSync(home);
  mkdirSync(workspace);
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const cli = (args, input) => spawnSync(process.execPath, [join(plugin, "scripts/tasks.mjs"), ...args], { cwd: workspace, env, encoding: "utf8", input: JSON.stringify(input) });
  const hooks = JSON.parse(readFileSync(resolve(plugin, manifest.hooks), "utf8")).hooks;
  assert.deepEqual(Object.keys(hooks), ["SessionStart", "Stop"]);
  const fire = (name, event) => {
    const entry = hooks[name][0].hooks[0];
    const command = (process.platform === "win32" ? entry.commandWindows : entry.command).replaceAll("${CLAUDE_PLUGIN_ROOT}", plugin.replaceAll("\\", "/"));
    const result = process.platform === "win32"
      ? spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { cwd: workspace, env, encoding: "utf8", input: JSON.stringify(event) })
      : spawnSync("sh", ["-c", command], { cwd: workspace, env, encoding: "utf8", input: JSON.stringify(event) });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const event = { session_id: "installed-codex", cwd: workspace, hook_event_name: "SessionStart", source: "startup" };
  const disabled = fire("SessionStart", event).hookSpecificOutput;
  assert.equal(disabled.hookEventName, "SessionStart");
  assert.match(disabled.additionalContext, /TASK enabled: false/);
  const skillPath = JSON.parse(disabled.additionalContext.match(/^Workstyle skill: (.+)$/m)[1]);
  assert.equal(resolve(skillPath), resolve(plugin, manifest.skills, "internal-workstyle/SKILL.md"));
  assert.ok(readFileSync(skillPath, "utf8").trim());
  assert.equal(cli(["enable"]).status, 0);
  const context = fire("SessionStart", event).hookSpecificOutput.additionalContext;
  const scope = context.match(/TASK scope: ([a-f0-9]{64})/)[1];
  assert.equal(resolve(JSON.parse(context.match(/^TASK script: (.+)$/m)[1])), join(plugin, "scripts/tasks.mjs"));
  const begin = cli(["begin", "--scope", scope], { expectedRevision: 0, title: "Install test", items: [{ id: "verify", title: "Verify configured hook", verification: "Run its configured command" }] });
  assert.equal(begin.status, 0, begin.stderr);
  assert.equal(fire("Stop", { ...event, hook_event_name: "Stop", stop_hook_active: false }).decision, "block");
  const state = JSON.parse(cli(["show", "--scope", scope]).stdout);
  const done = cli(["set", "--scope", scope], { expectedRevision: state.revision, runId: state.currentRunId, itemId: "verify", status: "done", evidence: "Configured SessionStart and Stop commands executed successfully" });
  assert.equal(done.status, 0, done.stderr);
  assert.equal(JSON.parse(cli(["check", "--scope", scope]).stdout).completed, true);
  assert.deepEqual(fire("Stop", { ...event, hook_event_name: "Stop", stop_hook_active: false }), {});
});
