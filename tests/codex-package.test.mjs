import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

test("Codex package preserves the source and ships working legacy hooks and skill dependencies", (t) => {
  const temp = mkdtempSync(join(tmpdir(), "rivet codex 한글 "));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const output = join(temp, "plugin copy");
  const sourceManifest = readFileSync(join(root, "plugin.json"), "utf8");
  const pack = (target) => spawnSync(process.execPath, [join(root, "scripts/package-codex.mjs"), target], { encoding: "utf8" });
  const neighbor = join(temp, "plugin copy.tmp");
  mkdirSync(neighbor);
  writeFileSync(join(neighbor, "keep.txt"), "user data");
  const built = pack(output);
  assert.equal(built.status, 0, built.stderr);
  assert.deepEqual(readdirSync(temp).sort(), ["plugin copy", "plugin copy.tmp"]);
  assert.equal(readFileSync(join(neighbor, "keep.txt"), "utf8"), "user data");
  assert.equal(readFileSync(join(root, "plugin.json"), "utf8"), sourceManifest);
  assert.equal(existsSync(join(output, "plugin.json")), false, "portable manifests suppress hooks in Codex 0.162.1");
  const manifest = JSON.parse(readFileSync(join(output, ".codex-plugin/plugin.json"), "utf8"));
  assert.equal(manifest.name, "rivet");
  assert.equal(manifest.version, JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version);
  const marketplace = JSON.parse(readFileSync(join(output, ".claude-plugin/marketplace.json"), "utf8"));
  assert.equal(marketplace.name, "rivet");
  assert.equal(marketplace.plugins[0].name, manifest.name);
  assert.equal(resolve(output, marketplace.plugins[0].source), output);
  assert.deepEqual(readdirSync(resolve(output, manifest.skills)).sort(), ["adversarial-cross-review", "cross-review", "internal-agent-setup", "internal-cross-review", "internal-workstyle", "tasks-setup"]);
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
  const home = join(temp, "home");
  const workspace = join(temp, "작업 공간");
  mkdirSync(home);
  mkdirSync(workspace);
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const cli = (args, input) => spawnSync(process.execPath, [join(output, "scripts/tasks.mjs"), ...args], { cwd: workspace, env, encoding: "utf8", input: JSON.stringify(input) });
  const hooks = JSON.parse(readFileSync(resolve(output, manifest.hooks), "utf8")).hooks;
  assert.deepEqual(Object.keys(hooks), ["SessionStart", "Stop"]);
  const fire = (name, event) => {
    const entry = hooks[name][0].hooks[0];
    const command = (process.platform === "win32" ? entry.commandWindows : entry.command).replaceAll("${CLAUDE_PLUGIN_ROOT}", output.replaceAll("\\", "/"));
    const result = process.platform === "win32"
      ? spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { cwd: workspace, env, encoding: "utf8", input: JSON.stringify(event) })
      : spawnSync("sh", ["-c", command], { cwd: workspace, env, encoding: "utf8", input: JSON.stringify(event) });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const event = { session_id: "packaged-codex", cwd: workspace, hook_event_name: "SessionStart", source: "startup" };
  const disabled = fire("SessionStart", event).hookSpecificOutput;
  assert.equal(disabled.hookEventName, "SessionStart");
  assert.match(disabled.additionalContext, /TASK enabled: false/);
  const skillPath = JSON.parse(disabled.additionalContext.match(/^Workstyle skill: (.+)$/m)[1]);
  assert.equal(resolve(skillPath), join(output, "skills/internal-workstyle/SKILL.md"));
  assert.ok(readFileSync(skillPath, "utf8").trim());
  assert.equal(cli(["enable"]).status, 0);
  const context = fire("SessionStart", event).hookSpecificOutput.additionalContext;
  const scope = context.match(/TASK scope: ([a-f0-9]{64})/)[1];
  assert.equal(resolve(JSON.parse(context.match(/^TASK script: (.+)$/m)[1])), join(output, "scripts/tasks.mjs"));
  const begin = cli(["begin", "--scope", scope], { expectedRevision: 0, title: "Package test", items: [{ id: "verify", title: "Verify shipped hook", verification: "Run its configured command" }] });
  assert.equal(begin.status, 0, begin.stderr);
  assert.equal(fire("Stop", { ...event, hook_event_name: "Stop", stop_hook_active: false }).decision, "block");
  const state = JSON.parse(cli(["show", "--scope", scope]).stdout);
  const done = cli(["set", "--scope", scope], { expectedRevision: state.revision, runId: state.currentRunId, itemId: "verify", status: "done", evidence: "Shipped SessionStart and Stop commands executed successfully" });
  assert.equal(done.status, 0, done.stderr);
  assert.equal(JSON.parse(cli(["check", "--scope", scope]).stdout).completed, true);
  assert.deepEqual(fire("Stop", { ...event, hook_event_name: "Stop", stop_hook_active: false }), {});
  const sentinel = join(output, "preserve.txt");
  writeFileSync(sentinel, "existing package");
  assert.equal(pack(output).status, 1);
  assert.equal(readFileSync(sentinel, "utf8"), "existing package");
  assert.equal(readFileSync(join(output, ".codex-plugin/plugin.json"), "utf8"), readFileSync(join(root, ".codex-plugin/plugin.json"), "utf8"));
  const nested = join(root, "codex-output-test");
  assert.equal(pack(nested).status, 1);
  assert.equal(existsSync(nested), false);
});

test("Codex package removes only its own partial output when copying fails", async (t) => {
  const temp = mkdtempSync(join(tmpdir(), "rivet-codex-fail-"));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const source = join(temp, "source");
  for (const directory of [".codex-plugin", ".claude-plugin", "hooks", "scripts", "prompts", "skills", "setup"]) {
    await cp(join(root, directory), join(source, directory), { recursive: true });
  }
  const parent = join(temp, "dest");
  const neighbor = join(parent, "plugin.tmp");
  mkdirSync(neighbor, { recursive: true });
  writeFileSync(join(neighbor, "keep.txt"), "user data");
  const output = join(parent, "plugin");
  const built = spawnSync(process.execPath, [join(source, "scripts/package-codex.mjs"), output], { encoding: "utf8" });
  assert.equal(built.status, 1);
  assert.match(built.stderr, /cursor/);
  assert.deepEqual(readdirSync(parent), ["plugin.tmp"]);
  assert.equal(readFileSync(join(neighbor, "keep.txt"), "utf8"), "user data");
});

for (const script of ["package-codex.mjs", "package-gemini.mjs"]) test(`${script} rejects an output inside the source given through its Windows 8.3 short path`, { skip: process.platform !== "win32" && "Windows only" }, async (t) => {
  const temp = mkdtempSync(join(tmpdir(), "rivet-codex-short-"));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const source = join(temp, "long source directory");
  await cp(join(root, "scripts"), join(source, "scripts"), { recursive: true });
  const command = "$ErrorActionPreference = 'Stop'; [Console]::OutputEncoding = [Text.Encoding]::UTF8; (New-Object -ComObject Scripting.FileSystemObject).GetFolder($env:PACKAGE_SOURCE_PATH).ShortPath";
  const shortPath = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { env: { ...process.env, PACKAGE_SOURCE_PATH: source }, encoding: "utf8" });
  assert.equal(shortPath.status, 0, shortPath.stderr);
  const short = shortPath.stdout.trim();
  if (short.toLowerCase() === source.toLowerCase()) return t.skip("8.3 short name generation is disabled for this volume");
  const output = join(short, "package-output");
  const built = spawnSync(process.execPath, [join(source, "scripts", script), output], { encoding: "utf8" });
  assert.equal(built.status, 1);
  assert.match(built.stderr, /outside the source directory/);
  assert.equal(existsSync(output), false);
});

test("Codex package can retry the same output after being killed mid-copy", (t) => {
  const temp = mkdtempSync(join(tmpdir(), "rivet-codex-kill-"));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const preload = join(temp, "kill-after-first-copy.mjs");
  writeFileSync(preload, [
    'import fsp from "node:fs/promises";',
    'import { syncBuiltinESMExports } from "node:module";',
    "const copy = fsp.cp;",
    'fsp.cp = async (...args) => { await copy(...args); process.kill(process.pid, "SIGKILL"); };',
    "syncBuiltinESMExports();",
  ].join("\n"));
  const output = join(temp, "plugin");
  const script = join(root, "scripts/package-codex.mjs");
  const killed = spawnSync(process.execPath, ["--import", pathToFileURL(preload).href, script, output], { encoding: "utf8" });
  assert.notEqual(killed.status, 0);
  assert.equal(existsSync(output), false);
  const retried = spawnSync(process.execPath, [script, output], { encoding: "utf8" });
  assert.equal(retried.status, 0, retried.stderr);
  assert.ok(existsSync(join(output, ".codex-plugin/plugin.json")));
  assert.ok(existsSync(join(output, "package.json")));
});
