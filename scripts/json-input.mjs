import { readFileSync } from "node:fs";

export function readJsonInput(fallback = "") {
  const input = readFileSync(0, "utf8").replace(/^\uFEFF+/, "");
  return JSON.parse(input || fallback);
}
