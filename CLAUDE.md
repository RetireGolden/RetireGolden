# RetireGolden — agent notes

Standing rules live in @AGENTS.md

## Claude Code specifics

- Run mechanical loops (`/needful` rounds, rebases, check watches, scoped fix
  clusters) in subagents on a cheaper model than the orchestrating session
  (currently `model: "opus"`). Keep the main session on orchestration,
  judgment calls (disputed findings, merge gating), and verifying each
  subagent's report against live GitHub state before acting.
- Subagent prompts carry the AGENTS.md rules that matter for the task: no
  guessed @-handles, no merging, no release or production dispatches, no CI
  or CLA workflow edits. A subagent that will post to GitHub always gets the
  handles rule.
