import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

test("standalone review skills resolve their local dependencies without the plugin", async (t) => {
  const temp = mkdtempSync(join(tmpdir(), "rivet review 한글 "));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const installed = join(temp, "skills copy");
  const names = ["adversarial-cross-review", "cross-review", "internal-cross-review"];
  for (const name of names) await cp(join(root, "skills", name), join(installed, name), { recursive: true });
  assert.deepEqual(readdirSync(installed).sort(), names);

  const inspect = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) {
        inspect(file);
        continue;
      }
      if (!/\.(md|mdc)$/.test(entry.name)) continue;
      const content = readFileSync(file, "utf8");
      if (entry.name === "SKILL.md") {
        const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        assert.ok(frontmatter, `${file}: missing frontmatter`);
        assert.equal(frontmatter[1].match(/^name: (.+)$/m)?.[1], basename(directory));
        assert.ok(/^description: .+$/m.test(frontmatter[1]), `${file}: missing description`);
      }
      for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const reference = match[1].split("#")[0];
        if (!reference || /^[a-z]+:/i.test(reference)) continue;
        const target = resolve(dirname(file), reference);
        const distance = relative(installed, target);
        assert.ok(distance !== ".." && !distance.startsWith(`..${sep}`) && !isAbsolute(distance), `${file}: dependency outside standalone installation: ${reference}`);
        assert.ok(statSync(target).isFile(), `${file}: missing file dependency: ${reference}`);
        assert.ok(readFileSync(target, "utf8").trim(), `${file}: empty dependency: ${reference}`);
      }
    }
  };
  for (const name of names) inspect(join(installed, name));
});
