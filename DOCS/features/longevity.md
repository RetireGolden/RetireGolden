# Longevity (life expectancy)

A **transparent, non-medical** estimate of remaining life expectancy from a short questionnaire, used to
set each person's planning horizon (and to inform SS claiming / break-even intuition). Outputs are framed
as educational estimates, never clinical predictions. The model carried forward from the original app; it
is surfaced inside the planner via the Longevity modal rather than a standalone page.

## Code map

| Area | Location |
|------|----------|
| SSA 2022 period table e(x), ages 0–119 | [`longevity/ssaPeriod2022.ts`](../../app/src/longevity/ssaPeriod2022.ts) |
| Lifestyle multipliers + comments | [`longevity/factors.ts`](../../app/src/longevity/factors.ts) |
| Baseline × clamped product + illustrative band | [`longevity/model.ts`](../../app/src/longevity/model.ts) |
| Wizard + results UI | [`longevity/LongevityWizard.tsx`](../../app/src/longevity/LongevityWizard.tsx), [`LongevityResults.tsx`](../../app/src/longevity/LongevityResults.tsx) |
| Planner entry point | [`planner/LongevityModal.tsx`](../../app/src/planner/LongevityModal.tsx) (opened from the Household screen) |
| Persistence guard | [`longevity/storage.ts`](../../app/src/longevity/storage.ts), [`persistedGuard.ts`](../../app/src/longevity/persistedGuard.ts) |
| Tests | [`longevity/model.test.ts`](../../app/src/longevity/model.test.ts) |

## Baseline data source

- **Table:** SSA "Actuarial Life Table" **period, 2022 (2025 Trustees Report)** — Table 4C6, male/female
  **life expectancy** columns.
- **URL:** https://www.ssa.gov/oact/STATS/table4c6.html
- **Interpretation (per SSA's note on that page):** at exact age x, the value is the **average remaining
  years** expected before death, using 2022 mortality rates over the remainder of life (Social Security
  area population).

Refresh the embedded table when SSA publishes new Trustees-Report rows (bump `ssaPeriod2022.ts` + the
citation year) — tracked in [maintenance-schedule.md](../maintenance-schedule.md).

## Questionnaire

Nine steps: age (18–110), sex table row (male / female / average), BMI category, smoking, alcohol,
activity, diabetes, self-rated health, parental longevity (80+). Each answer maps to a multiplier in
`factors.ts` (conservative magnitudes; the combined product is clamped in `model.ts`).

## Outputs

- **Central:** baseline remaining years × applied multiplier.
- **Band:** 90%–108% of central — **illustrative only**, not a confidence interval.
- **Planning age:** age + rounded central remaining years (a planning visual; the plan horizon uses it but
  the user can override).

The results screen uses "estimated remaining years" / "educational estimate" language (never "you will
live to…"), shows a disclaimer block, and references the baseline source. No network calls are made for
personal data.

## Out of scope

- Replacing physician or actuarial individualized underwriting.
- Copying third-party proprietary longevity-quiz scoring.
- Income/education proxies (sensitive; deliberately omitted). Adjustment magnitudes are an educational
  heuristic — refine with an epidemiology review before tightening any claim.

## Related

Stochastic, mortality-weighted longevity (per-path lifespans for Monte Carlo) is modeled separately — see
[monte-carlo-and-scenarios.md](monte-carlo-and-scenarios.md) and [insurance.md](insurance.md).
