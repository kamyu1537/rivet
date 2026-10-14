import { copyFileSync, existsSync, mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync } from "node:fs";
import { cp } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = realpathSync.native(fileURLToPath(new URL("../", import.meta.url)));

try {
  if (process.argv.length !== 3) throw new Error("Usage: node scripts/package-codex.mjs <new-output-directory>");
  const target = resolve(process.argv[2]);
  const output = join(realpathSync.native(dirname(target)), basename(target));
  const distance = relative(root, output);
  if (!isAbsolute(distance) && distance !== ".." && !distance.startsWith(`..${sep}`)) throw new Error("Codex output must be outside the source directory");
  if (existsSync(output)) throw new Error(`Codex output already exists: ${output}`);
  const staging = mkdtempSync(join(dirname(output), `.${basename(output)}-`));
  try {
    for (const directory of [".codex-plugin", "hooks", "scripts", "prompts", "skills", "setup", "cursor"]) await cp(join(root, directory), join(staging, directory), { recursive: true });
    mkdirSync(join(staging, ".claude-plugin"));
    copyFileSync(join(root, ".claude-plugin/marketplace.json"), join(staging, ".claude-plugin/marketplace.json"));
    for (const file of ["README.md", "AGENTS.md", "package.json"]) copyFileSync(join(root, file), join(staging, file));
    renameSync(staging, output);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  process.stdout.write(`${output}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
