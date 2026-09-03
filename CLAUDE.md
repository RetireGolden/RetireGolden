# RetireGolden — agent notes

Standing rules live in @AGENTS.md

## Claude Code specifics

- Run mechanical loops (`/needful` rounds, rebases, check watches, scoped fix
  clusters) in subagents spawned with `model: "opus"`, which is cheaper than
  this session's default model. Keep the main session on orchestration,
  judgment calls (disputed findings, merge gating), and verifying each
  subagent's report against live GitHub state before acting.
- Every subagent prompt carries these AGENTS.md rules verbatim, whatever the
  task: no merging, no release or production dispatches, no CI or CLA
  workflow edits, no guessed @-handles.
