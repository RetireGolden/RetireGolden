# Contributing to RetireGolden

Thanks for your interest in improving RetireGolden — a free, privacy-first retirement planner that runs
entirely in your browser.

## Before you start

- Read [DOCS/standards.md](DOCS/standards.md) (conventions) and
  [DOCS/architecture.md](DOCS/architecture.md) (how the pieces fit). The one invariant that is never
  negotiable: **all money math lives in the pure engine; UI never recomputes dollars.**
- For anything beyond a small fix, open an issue first so we can agree on the approach before you invest
  time.

## Development

```bash
cd app
npm ci
npm run dev      # local dev server
npm test         # unit + engine tests (must pass)
npm run build    # production build (must pass)
```

The test suite includes golden/regression gates for the financial math. If your change legitimately moves
a golden number, explain why in the PR — with a source (IRS/SSA publication, statute, worksheet).

## Licensing of contributions

RetireGolden's source is licensed under **AGPL-3.0** (see [LICENSE](LICENSE)) and that will not change —
the community edition stays free and open forever.

RetireGolden, LLC also ships a commercial desktop edition built from this same engine, which funds the
free product. To make that possible, **all contributions require signing our Contributor License
Agreement (CLA)** — a one-time, automated step on your first pull request. The CLA grants RetireGolden,
LLC the right to relicense your contribution for the commercial edition; you keep the copyright to your
work, and your contribution remains available to everyone under AGPL-3.0 here.

If you're not comfortable with that, we understand — but we can't merge unsigned contributions.

## What makes a good PR

- One focused change; tests updated or added alongside it.
- Domain claims (tax rules, SS formulas, RMD tables) cite an authoritative source.
- No new runtime dependencies without prior discussion — the app's privacy posture depends on a small,
  auditable supply chain.
- No telemetry, analytics, tracking, or network calls with user data. Ever. PRs that add them will be
  closed.

## Reporting security issues

Please don't open public issues for vulnerabilities — see [SECURITY.md](SECURITY.md).
