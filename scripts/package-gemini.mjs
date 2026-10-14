import { copyFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = realpathSync.native(fileURLToPath(new URL("../", import.meta.url)));

try {
  if (process.argv.length !== 3) throw new Error("Usage: node scripts/package-gemini.mjs <new-output-directory>");
  const target = resolve(process.argv[2]);
  const output = join(realpathSync.native(dirname(target)), basename(target));
  const distance = relative(root, output);
  if (!isAbsolute(distance) && distance !== ".." && !distance.startsWith(`..${sep}`)) throw new Error("Gemini output must be outside the source directory");
  const { name, version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const { description } = JSON.parse(readFileSync(join(root, ".claude-plugin/plugin.json"), "utf8"));
  mkdirSync(output);
  for (const directory of ["hooks", "scripts", "prompts", "skills", "setup", "cursor"]) await cp(join(root, directory), join(output, directory), { recursive: true });
  for (const file of ["README.md", "AGENTS.md"]) copyFileSync(join(root, file), join(output, file));
  copyFileSync(join(root, "hooks/gemini.json"), join(output, "hooks/hooks.json"));
  writeFileSync(join(output, "gemini-extension.json"), `${JSON.stringify({ name, version, description }, null, 2)}\n`);
  process.stdout.write(`${output}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
