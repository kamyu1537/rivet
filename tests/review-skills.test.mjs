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

test("cross review selects installed reviewers at runtime and pins no model", () => {
  const skill = readFileSync(join(root, "skills/internal-cross-review/SKILL.md"), "utf8");
  assert.doesNotMatch(skill, /\b(gpt-?\d|o\d-?(mini|pro)|claude-(opus|sonnet|haiku)-\d|grok-\d|composer-\d)\b|--model\b/i, "a model ID or --model is pinned");
  for (const cli of ["codex", "grok", "cursor-agent", "claude"]) assert.match(skill, new RegExp(`\`command -v ${cli}\``), `${cli}: not detected with command -v`);
  assert.match(skill, /`codex exec`/);
  assert.match(skill, /GPT·ChatGPT 계열 리뷰는 이 경로로만/);
  assert.match(skill, /`agent` 실행 파일은[^\n]*Cursor로 취급하지 않는다/);
  assert.match(skill, /Grok 또는 Composer 계열 모델만 사용한다[^\n]*Codex·GPT·Claude 모델이 보여도[^\n]*선택하지 않는다/);
  assert.match(skill, /호스트가 Claude Code가 아닐 때만/);
  assert.match(skill, /리뷰어가 하나도 없으면 교차 리뷰를 건너뛰고/);
});

test("review skills run only when the user invokes them", () => {
  for (const name of ["adversarial-cross-review", "cross-review", "internal-cross-review"]) {
    const frontmatter = readFileSync(join(root, "skills", name, "SKILL.md"), "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/)[1];
    assert.match(frontmatter, /^disable-model-invocation: true$/m, `${name}: Claude Code and Cursor may invoke it implicitly`);
    assert.match(frontmatter, /^  opencode\/autoinvoke: "false"$/m, `${name}: OpenCode may invoke it implicitly`);
    assert.match(readFileSync(join(root, "skills", name, "agents/openai.yaml"), "utf8"), /^policy:\r?\n  allow_implicit_invocation: false$/m, `${name}: Codex may invoke it implicitly`);
  }
});
