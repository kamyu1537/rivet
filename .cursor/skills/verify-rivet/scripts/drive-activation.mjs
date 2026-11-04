import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const isolate = spawnSync(process.execPath, [join(root, ".cursor/skills/verify-rivet/scripts/isolate.mjs")], {
  encoding: "utf8",
});
if (isolate.status !== 0) {
  process.stderr.write(isolate.stderr || isolate.stdout);
  process.exit(isolate.status ?? 1);
}

const envLines = Object.fromEntries(
  isolate.stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split("="))
    .map(([key, ...rest]) => [key, rest.join("=")]),
);
const { PLUGIN, WORKSPACE, HOME, EVIDENCE, TEMP } = envLines;
const evidenceDir = join(EVIDENCE, "project-task-activation");
mkdirSync(evidenceDir, { recursive: true });

const env = { ...process.env, HOME, USERPROFILE: HOME };
const run = (args) =>
  spawnSync(process.execPath, [join(PLUGIN, "scripts/tasks.mjs"), ...args], {
    cwd: WORKSPACE,
    env,
    encoding: "utf8",
  });

const steps = [];
const record = (name, result) => {
  steps.push({ name, status: result.status, stdout: result.stdout, stderr: result.stderr });
  writeFileSync(join(evidenceDir, `${name}.stdout.txt`), result.stdout ?? "");
  writeFileSync(join(evidenceDir, `${name}.stderr.txt`), result.stderr ?? "");
  writeFileSync(join(evidenceDir, `${name}.status.txt`), String(result.status));
};

const status0 = run(["status"]);
record("01-status-initial", status0);
if (status0.status !== 0 || !status0.stdout.startsWith("disabled")) {
  process.stderr.write("doctor failed: expected disabled status\n");
  process.exit(1);
}

const enable = run(["enable", "--file", "AGENTS.md"]);
record("02-enable-agents", enable);
const agentsPath = join(WORKSPACE, "AGENTS.md");
const block = "<!-- rivet-tasks:start -->\nRivet TASK tracking is enabled for this project.\n<!-- rivet-tasks:end -->\n";
if (enable.status !== 0 || !enable.stdout.startsWith("enabled") || readFileSync(agentsPath, "utf8") !== block) {
  process.stderr.write("enable --file AGENTS.md failed\n");
  process.exit(1);
}

const bareOn = run(["enable"]);
record("03-enable-bare-on", bareOn);
if (bareOn.status !== 0) {
  process.stderr.write("bare enable while on failed\n");
  process.exit(1);
}

const disable = run(["disable"]);
record("04-disable", disable);
if (disable.status !== 0 || !disable.stdout.startsWith("disabled")) {
  process.stderr.write("disable failed\n");
  process.exit(1);
}

const bareOff = run(["enable"]);
record("05-enable-bare-off", bareOff);
if (bareOff.status === 0) {
  process.stderr.write("bare enable while off should fail\n");
  process.exit(1);
}

mkdirSync(join(HOME, ".config", "rivet"), { recursive: true });
writeFileSync(join(HOME, ".config", "rivet", "tasks-enabled"), "still here");
const flagged = run(["status"]);
record("06-status-with-home-flag", flagged);
if (!flagged.stdout.startsWith("disabled")) {
  process.stderr.write("home flag should be ignored\n");
  process.exit(1);
}

writeFileSync(join(evidenceDir, "summary.json"), JSON.stringify({ steps, agentsExists: existsSync(agentsPath) }, null, 2));
rmSync(TEMP, { recursive: true, force: true });
process.stdout.write(`OK evidence=${evidenceDir}\n`);
