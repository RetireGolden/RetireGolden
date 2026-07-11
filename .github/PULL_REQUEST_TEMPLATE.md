## What & why

<!-- One focused change per PR. What does it do, and why is it needed? -->

## Domain sources

<!-- If this touches financial math (tax rules, SS formulas, RMD tables, golden numbers):
     cite the authoritative source (IRS/SSA publication, statute, worksheet).
     Delete this section if not applicable. -->

## Checklist

- [ ] Tests pass locally (`npm test` in `app/`) and are updated/added alongside the change
- [ ] All money math stays in the pure engine — no dollar computation in UI code
- [ ] No new runtime dependencies without prior discussion
- [ ] No telemetry, analytics, or network calls with user data
- [ ] **AI disclosure:** if a generative-AI tool produced a material part of this contribution
      (beyond routine completion/formatting), I've disclosed that below, per [CLA.md](../CLA.md) §6(f)

<!-- AI disclosure (if applicable): -->

> First PR? A bot will ask you to sign the [CLA](../CLA.md) — a one-time comment reply.
> See [CONTRIBUTING.md](../CONTRIBUTING.md) for details.
