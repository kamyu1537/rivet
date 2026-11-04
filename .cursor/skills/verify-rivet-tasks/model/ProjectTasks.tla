---- MODULE ProjectTasks ----
\* Models rivet scripts/task-state.mjs project TASK activation for two files.
\* Kinds match classifyTaskText / absent. reported is what status/tasksEnabled returns.

EXTENDS Integers

VARIABLES claude, agents, reported
vars == <<claude, agents, reported>>

Kinds == {"Absent", "None", "One", "Broken"}

ActuallyEnabled ==
  \/ /\ claude = "One"
     /\ agents \in {"Absent", "None"}
  \/ /\ agents = "One"
     /\ claude \in {"Absent", "None"}

TypeOK ==
  /\ claude \in Kinds
  /\ agents \in Kinds
  /\ reported \in BOOLEAN

Init ==
  /\ claude = "Absent"
  /\ agents = "Absent"
  /\ reported = FALSE

\* enable --file CLAUDE.md: strip both, write one block on Claude
EnableClaude ==
  /\ claude' = "One"
  /\ agents' = IF agents = "Absent" THEN "Absent" ELSE "None"
  /\ reported' = TRUE

\* enable --file AGENTS.md
EnableAgents ==
  /\ agents' = "One"
  /\ claude' = IF claude = "Absent" THEN "Absent" ELSE "None"
  /\ reported' = TRUE

\* enable with no --file: only when already enabled; rewrite active file
EnableBare ==
  /\ reported
  /\ ActuallyEnabled
  /\ IF claude = "One"
     THEN /\ claude' = "One"
          /\ agents' = IF agents = "Absent" THEN "Absent" ELSE "None"
     ELSE /\ agents' = "One"
          /\ claude' = IF claude = "Absent" THEN "Absent" ELSE "None"
  /\ reported' = TRUE

Disable ==
  /\ claude' = IF claude = "Absent" THEN "Absent" ELSE "None"
  /\ agents' = IF agents = "Absent" THEN "Absent" ELSE "None"
  /\ reported' = FALSE

CorruptClaude ==
  /\ claude # "Broken"
  /\ claude' = "Broken"
  /\ UNCHANGED agents
  /\ reported' = ActuallyEnabled' 

CorruptAgents ==
  /\ agents # "Broken"
  /\ agents' = "Broken"
  /\ UNCHANGED claude
  /\ reported' = ActuallyEnabled'

\* User copies a valid block onto the other file (both One); status recomputes
ForceBothOne ==
  /\ claude' = "One"
  /\ agents' = "One"
  /\ reported' = FALSE

ClearClaude ==
  /\ claude \in {"One", "Broken"}
  /\ claude' = "None"
  /\ UNCHANGED agents
  /\ reported' = ActuallyEnabled'

ClearAgents ==
  /\ agents \in {"One", "Broken"}
  /\ agents' = "None"
  /\ UNCHANGED claude
  /\ reported' = ActuallyEnabled'

DeleteClaude ==
  /\ claude = "None"
  /\ claude' = "Absent"
  /\ UNCHANGED agents
  /\ reported' = ActuallyEnabled'

DeleteAgents ==
  /\ agents = "None"
  /\ agents' = "Absent"
  /\ UNCHANGED claude
  /\ reported' = ActuallyEnabled'

Done ==
  /\ TRUE
  /\ UNCHANGED vars

Next ==
  \/ EnableClaude
  \/ EnableAgents
  \/ EnableBare
  \/ Disable
  \/ CorruptClaude
  \/ CorruptAgents
  \/ ForceBothOne
  \/ ClearClaude
  \/ ClearAgents
  \/ DeleteClaude
  \/ DeleteAgents
  \/ Done

Spec == Init /\ [][Next]_vars

\* status/tasksEnabled must match hasSingleValidBlock
ReportMatchesFiles == reported <=> ActuallyEnabled

\* enable --file never leaves both files as One
EnableLeavesSingleOne ==
  ~(claude = "One" /\ agents = "One" /\ reported)

====
