# Longevity (life expectancy)

A **transparent, non-medical** estimate of remaining life expectancy from a short questionnaire, used to
set each person's planning horizon (and to inform SS claiming / break-even intuition). Outputs are framed
as educational estimates, never clinical predictions. The model carried forward from the original app; it
is surfaced inside the planner via the Longevity modal rather than a standalone page.

## Code map

| Area | Location |
|------|----------|
| SSA period life table (2023 period, 2026 Trustees Report): q(x) and e(x) by sex, ages 0–119, with its source record | [`longevity/ssaPeriodLifeTable.ts`](../../packages/engine/src/longevity/ssaPeriodLifeTable.ts) |
| Lifestyle multipliers + comments | [`longevity/factors.ts`](../../packages/planner-ui/src/longevity/factors.ts) |
| Baseline × clamped product + illustrative band | [`longevity/model.ts`](../../packages/planner-ui/src/longevity/model.ts) |
| Wizard + results UI | [`longevity/LongevityWizard.tsx`](../../packages/planner-ui/src/longevity/LongevityWizard.tsx), [`LongevityResults.tsx`](../../packages/planner-ui/src/longevity/LongevityResults.tsx) |
| Planner entry point | [`planner/LongevityModal.tsx`](../../packages/planner-ui/src/planner/LongevityModal.tsx) (opened from the Household screen) |
| Persistence guard | [`longevity/storage.ts`](../../packages/planner-ui/src/longevity/storage.ts), [`persistedGuard.ts`](../../packages/planner-ui/src/longevity/persistedGuard.ts) |
| Tests | [`longevity/model.test.ts`](../../packages/planner-ui/src/longevity/model.test.ts), [`LongevityResults.test.tsx`](../../packages/planner-ui/src/longevity/LongevityResults.test.tsx); the table's evidence is [`ssaPeriodLifeTable.evidence.test.ts`](../../packages/engine/src/longevity/ssaPeriodLifeTable.evidence.test.ts) (calculation record `ssa-period-life-table`) |

## Baseline data source

- **Table:** SSA "Actuarial Life Table" (Table 4C6), the **2023 period table, as used in the 2026 Trustees
  Report**: the male and female **life expectancy** e(x) and **probability of dying within one year** q(x)
  columns, as printed, read from SSA's page on 2026-09-27. The source record in `ssaPeriodLifeTable.ts`
  names the page, the edition, the read date, an Internet Archive capture and the SHA-256 of the columns,
  which the evidence test rebuilds from the numbers.
- **URL:** https://www.ssa.gov/oact/STATS/table4c6.html
- **Interpretation (per SSA's note on that page):** at exact age x, e is the **average remaining years**
  expected before death, using 2023 mortality rates over the remainder of life (Social Security area
  population); q is the probability of dying within one year.
- **The questionnaire's baseline** is SSA's printed e(x) (for "average", the mean of the male and female
  values). The survival curve behind the percentile planning age, the Monte Carlo lifespans and the Social
  Security expected values reads the published q(x) instead (record `mortality-published-death-probability`),
  so its own life expectancy differs from the printed e by at most 0.005 years at the questionnaire's ages
  (record `survival-hazard-from-expectancy-multiplier`). The engine closes the table at 119, where SSA prints
  q = 0.926604.
- **"Average" sex** is a person whose sex the plan does not state: every survival probability is the mean of
  the male and female ones, as for someone equally likely to be either (the 50/50 mixture of the two
  curves from the current age; record `survival-probability-product`).
- **Stored figures keep their edition.** A saved questionnaire result and a percentile pick record the table
  edition they were computed on; one saved before 2026-09-27 has none and was made on the 2022 period table
  (2025 Trustees Report), and is labelled so. The editions a stored figure can name are a closed set, each with
  SSA's own page (`ssaPeriodLifeTable.ts#KNOWN_LIFE_TABLE_EDITIONS`: the 2022 table at
  https://www.ssa.gov/oact/STATS/table4c6_2022_TR2025.html and the 2023 table at the live page); any other
  edition reads "table edition not recognized" and links the live page. The Assumptions card and its exports
  cite each planning age to the parameter-provenance entry for the edition it was computed on
  (`ssa-life-table`, `ssa-life-table-2022`); a questionnaire age, whose edition the plan does not store, takes
  the edition of the result saved in this browser for that person when that result gives the plan's age, and
  otherwise says "table edition not recorded" and cites no table.

Refresh the embedded table when SSA publishes a new edition: replace the columns and the source record in
`ssaPeriodLifeTable.ts` (the file name carries no edition) as a reviewed data change, add the outgoing edition
to `KNOWN_LIFE_TABLE_EDITIONS` with SSA's page for it, and give it a `PARAMETER_PROVENANCE` entry at that page,
so figures stored on it keep a citation. The vintage record
`ssa-table-4c6-period-life-table-vintage` comes due yearly (`rules:due`) and its quoted text stops matching
the page the day SSA posts the next edition (`verify:quotes`) — tracked in
[maintenance-schedule.md](../maintenance-schedule.md).

## Questionnaire

Nine steps: age (18–110), sex table column (male / female / "Not stated (average of male and female)"), BMI category, smoking, alcohol,
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
