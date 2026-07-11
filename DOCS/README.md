# RetireGolden documentation

RetireGolden is a **free, privacy-first, full-service retirement planner** that runs entirely in the
browser — no account, no server, no data leaving the device. It projects a household's finances year by
year and models federal + state taxes, Social Security, RMDs, Roth conversions, withdrawal strategy,
insurance, Monte Carlo, and an in-app optimizer, with an integrated Learning Center.

**Live app:** [https://retiregolden.app/](https://retiregolden.app/)

These docs describe **what the app is and why it's built that way** — ground truth, not plans. When code
and a doc disagree, fix the doc to match the code.

## Start here

| Doc | What it covers |
|-----|----------------|
| [architecture.md](architecture.md) | The system design: pure engine + React shell, local-first, the simulation core |
| [code-map.md](code-map.md) | Where everything lives in `app/src/`, entry points, and commands |
| [standards.md](standards.md) | Conventions to follow when changing the app (read before contributing) |
| [CHANGELOG.md](../CHANGELOG.md) | Sequential high-level history of system changes (from commits + shipped work) |

## Keep it current

| Doc | What it covers |
|-----|----------------|
| [maintenance-schedule.md](maintenance-schedule.md) | When to re-research tax/SS/Medicare/state rules and Learn content so nothing gets stuck in 2026 |

## Domain knowledge (`domain/`)

| Doc | What it covers |
|-----|----------------|
| [domain/domain-rules-reference.md](domain/domain-rules-reference.md) | The financial rules the engine encodes, with 2026 figures and sources |
| [domain/state-tax-research/](domain/state-tax-research/) | Per-state income-tax research (all 50 states + DC) behind the state packs |

## Features — what each capability does and why (`features/`)

[features/README.md](features/README.md) is the capability catalog. Deep dives:
[social-security](features/social-security.md) · [taxes](features/taxes.md) ·
[roth-and-withdrawals](features/roth-and-withdrawals.md) ·
[monte-carlo-and-scenarios](features/monte-carlo-and-scenarios.md) · [insurance](features/insurance.md) ·
[optimizer](features/optimizer.md) · [learning-center](features/learning-center.md) ·
[longevity](features/longevity.md).

## Operations (`operations/`)

| Doc | What it covers |
|-----|----------------|
| [operations/ci-cd-and-deploy.md](operations/ci-cd-and-deploy.md) | Build, test, and deploy to Azure Static Web Apps |
| [operations/security-scanning.md](operations/security-scanning.md) | Semgrep (SAST) + OWASP ZAP (DAST) and how they gate the pipeline |

## App routes

| Route | Page |
|-------|------|
| `/` | Plan picker — adaptive home (welcome + getting-started paths for newcomers; plans-first for returning users) |
| `/examples` | Example library — curated teaching households to open in the planner |
| `/plan/*` | The planner: household, accounts, income, spending, strategy, results, SS analysis, Monte Carlo, scenarios, optimize, report |
| `/compare` | Compare two saved plans |
| `/learn/*` | Learning Center |
| `/disclaimer` | Full disclaimer |

Routes are declared in [`packages/planner-ui/src/App.tsx`](../packages/planner-ui/src/App.tsx). See [code-map.md](code-map.md) for the source layout.
