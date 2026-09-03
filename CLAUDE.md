# RetireGolden — agent notes

Standing rules live in @AGENTS.md

## Claude Code specifics

- Run mechanical loops (`/needful` rounds, rebases, check watches, scoped fix
  clusters) in subagents with `model: "opus"`. Keep the main session on
  orchestration, judgment calls (disputed findings, merge gating), and
  verifying each subagent's report against live GitHub state before acting.
- Any subagent that will post to GitHub gets the plain-text-name rule from
  AGENTS.md in its prompt.
