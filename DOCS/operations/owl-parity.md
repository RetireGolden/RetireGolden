# Owl parity oracle

A dev/CI-only harness that cross-checks RetireGolden's Roth-conversion optimizer against
[Owl](https://github.com/mdlacasse/Owl), an independent open-source retirement optimizer, on a shared
fixture matrix. It exists because "the optimizer produces good schedules" should be a measured,
repeatable claim, not an assertion — the harness catches optimizer regressions and surfaces movement when
Owl itself updates.

Run it from the repo root:

```bash
npm run owl-parity                             # skips cleanly if Python/Owl are unavailable
npm run owl-parity -- --install-owl --strict-owl   # isolated pinned virtualenv + enforced gate
```

## How the comparison works

The design principle is **one yardstick**: both engines' schedules are priced on RetireGolden's exact
annual ledger, so a delta reflects optimization quality rather than model differences.

1. A curated fixture matrix of household plans is defined in
   [`app/src/cases/owlParity.ts`](../../app/src/cases/owlParity.ts) — traditional-heavy low-income
   bridge, balanced couple with low-basis taxable, Roth-heavy control, high-tax state, survivor-phase,
   and Social Security tax-torpedo cases, each with mapping notes describing exactly how the plan
   translates to Owl's inputs and which knobs are intentionally excluded.
2. Each fixture is emitted both as a RetireGolden `Plan` and as an Owl TOML case (written under
   `app/artifacts/owl-parity/owl-cases/`), so both engines see the same household.
3. [`app/scripts/owl_runner.py`](../../app/scripts/owl_runner.py) runs Owl **out-of-process** and records
   its recommended schedule per fixture.
4. The comparator runs RetireGolden's own `optimizePlan`, then replays Owl's schedule through
   RetireGolden's exact ledger (`evaluateExactLedgerSchedule`), and emits a deterministic `manifest.json`
   plus a human-readable `report.md` under `app/artifacts/owl-parity/`.

## The gate

> RetireGolden's ending after-tax estate ≥ (Owl's schedule priced on the RetireGolden ledger) − tolerance,
> on **every** fixture.

- Default tolerance: **$1,000** (`OWL_PARITY_DEFAULT_TOLERANCE_DOLLARS` in
  [`app/src/cases/owlParity.ts`](../../app/src/cases/owlParity.ts)).
- Owl is pinned to commit `f09b4022b05e033efc34a74c7c384d605239c9bf` (tag `v2026.07.04`,
  `OWL_PARITY_OWL_PINNED_COMMIT`). Strict runs install exactly this pin in an isolated virtualenv; any
  other locally-available Owl invocation is marked **unverified** in the runner summary.
- Without `--strict-owl`, a missing Python/Owl environment degrades to a clear skip, never a failure — the
  harness must not break `npm test` for contributors who don't have Python set up.

## CI

[`.github/workflows/owl-parity.yml`](../../.github/workflows/owl-parity.yml) runs the harness on demand
(`workflow_dispatch`, Actions tab) with a `strict` input that defaults to `true`. It installs Node 22 +
Python 3.12, runs `npm run owl-parity -- --install-owl [--strict-owl]`, and uploads
`app/artifacts/owl-parity` as a workflow artifact (14-day retention) — the report is the reviewable
output.

## Licensing boundary

Owl is GPL. It is used strictly as a **black-box oracle**: invoked out-of-process in a dev/CI Python
environment, never bundled, never a runtime or build dependency, and its code is never read, vendored, or
translated into RetireGolden. The same arm's-length rule applies to all copyleft oracles — see the
source-registry cautions in [../external-oracles.md](../external-oracles.md).

## Maintenance

- **Re-pin deliberately.** Bumping the Owl pin is an intentional change: update
  `OWL_PARITY_OWL_PINNED_COMMIT`, re-run a strict pass, and read the report — Owl's own improvements can
  legitimately narrow margins, and that is exactly the signal the harness exists to surface.
- Re-run the gate during the annual parameter-pack refresh
  ([../maintenance-schedule.md](../maintenance-schedule.md)) and after any optimizer or
  withdrawal-ordering change.
- Fixture-mapping fairness is the real work: tax-pack vintages, state handling, and Social Security
  assumptions must be normalized or documented in the fixture's mapping notes, or a delta is
  apples-to-oranges rather than a finding.
