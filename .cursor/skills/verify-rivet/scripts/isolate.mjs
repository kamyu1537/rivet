import { mkdtempSync, mkdirSync } from "node:fs";
import { cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const runId = `${Date.now().toString(36)}-${process.pid}`;
const temp = mkdtempSync(join(tmpdir(), "rivet-verify-"));
const plugin = join(temp, "plugin");
const workspace = join(temp, "workspace");
const home = join(temp, "home");
const evidence = join(tmpdir(), `verify-rivet-${runId}`);

mkdirSync(workspace);
mkdirSync(home);
mkdirSync(evidence);
for (const directory of ["hooks", "scripts", "prompts", "skills"]) {
  await cp(join(root, directory), join(plugin, directory), { recursive: true });
}

process.stdout.write(`RUN_ID=${runId}\n`);
process.stdout.write(`TEMP=${temp}\n`);
process.stdout.write(`PLUGIN=${plugin}\n`);
process.stdout.write(`WORKSPACE=${workspace}\n`);
process.stdout.write(`HOME=${home}\n`);
process.stdout.write(`EVIDENCE=${evidence}\n`);
process.stdout.write(`ROOT=${root}\n`);
