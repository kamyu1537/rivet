export const title = "Rivet project TASK activation";

const label = (k) =>
  ({ Absent: "missing", None: "no block", One: "valid block", Broken: "broken markers" })[k] ?? k;

export const state = (v) => [
  v.reported ? "status: enabled" : "status: disabled",
  `CLAUDE.md ${label(v.claude)}`,
  `AGENTS.md ${label(v.agents)}`,
];

export const step = (action) =>
  ({
    EnableClaude: "you enable with --file CLAUDE.md",
    EnableAgents: "you enable with --file AGENTS.md",
    EnableBare: "you enable with no --file [already on]",
    Disable: "you disable",
    CorruptClaude: "CLAUDE.md markers break",
    CorruptAgents: "AGENTS.md markers break",
    ForceBothOne: "both files get a valid block",
    ClearClaude: "you clear the CLAUDE.md block by hand",
    ClearAgents: "you clear the AGENTS.md block by hand",
    DeleteClaude: "empty CLAUDE.md is removed",
    DeleteAgents: "empty AGENTS.md is removed",
    Done: null,
  })[action] ?? action;

export const group = (v) => (v.reported ? "on" : "off");

export const colors = {
  on: "teal",
  off: "tan",
};
