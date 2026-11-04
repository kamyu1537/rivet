import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const readJson = (file) => JSON.parse(readFileSync(join(root, file), "utf8"));
const pkg = readJson("package.json");
assert.equal(existsSync(join(root, "plugin.json")), false, "A root plugin.json overrides the Codex manifest and disables its hooks");
for (const file of [".claude-plugin/plugin.json", ".codex-plugin/plugin.json", ".cursor-plugin/plugin.json"]) {
  const manifest = readJson(file);
  assert.equal(manifest.name, pkg.name);
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.description?.trim());
  for (const field of ["skills", "hooks"]) {
    if (!manifest[field]) continue;
    const target = resolve(root, manifest[field]);
    assert.ok(manifest[field].startsWith("./") && !relative(root, target).startsWith(".."));
    assert.ok(existsSync(target), `${file}: missing ${target}`);
  }
}
for (const file of [".claude-plugin/marketplace.json", ".cursor-plugin/marketplace.json", ".agents/plugins/marketplace.json"]) {
  const marketplace = readJson(file);
  assert.equal(marketplace.name, pkg.name);
  assert.equal(marketplace.plugins.length, 1);
  assert.equal(marketplace.plugins[0].name, pkg.name);
  const source = marketplace.plugins[0].source;
  assert.equal(typeof source === "string" ? source : source.path, "./");
}
for (const extension of pkg.omp.extensions) assert.ok(existsSync(join(root, extension)));

function checkFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      checkFiles(file);
      continue;
    }
    if (!/\.(md|mdc)$/.test(file)) continue;
    const content = readFileSync(file, "utf8");
    if (entry.name === "SKILL.md") {
      const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      assert.ok(frontmatter, `${file}: missing frontmatter`);
      assert.equal(frontmatter[1].match(/^name: (.+)$/m)?.[1], basename(dirname(file)));
      assert.ok(/^description: .+$/m.test(frontmatter[1]), `${file}: missing description`);
    }
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].split("#")[0];
      if (!target || /^[a-z]+:/i.test(target)) continue;
      assert.ok(existsSync(resolve(dirname(file), target)), `${file}: broken link ${target}`);
    }
  }
}
checkFiles(root);

const forbidden = [
  { id: "gemini", pattern: /gemini/i },
  { id: "opencode", pattern: /opencode/i },
  { id: "copilot", pattern: /copilot/i },
  { id: "cross-review", pattern: /cross-review/i },
  { id: "internal-workstyle", pattern: /internal-workstyle/i },
  { id: "internal-cross-review", pattern: /internal-cross-review/i },
  { id: "CodeGraph", pattern: /codegraph/i },
];

function checkForbidden(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      checkForbidden(file);
      continue;
    }
    if (!/\.(md|mdc|mjs|json)$/.test(file)) continue;
    const relativeFile = relative(root, file).replaceAll("\\", "/");
    if (relativeFile === "scripts/validate.mjs") continue;
    for (const [index, line] of readFileSync(file, "utf8").split(/\r?\n/).entries()) {
      for (const rule of forbidden) {
        if (!rule.pattern.test(line)) continue;
        assert.fail(`${relativeFile}:${index + 1}: forbidden surface "${rule.id}"`);
      }
    }
  }
}
checkForbidden(root);

const situationalOnly = ["workstyle-root-cause"];
const skillNames = readdirSync(join(root, "skills"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
assert.deepEqual(
  skillNames.filter((name) => name.startsWith("workstyle-")),
  situationalOnly,
  "workstyle-* skills must stay situational-only; always-on rules belong in prompts/workstyle.md",
);

process.stdout.write("Manifests, skill metadata, extension paths, local links, and forbidden surfaces are valid.\n");
