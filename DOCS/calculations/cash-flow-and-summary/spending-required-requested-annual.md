## Claim

Kind: composition. `projection/internal/annualExpenseSummary.ts#annualExpenseSummary` publishes `YearExpenses.requiredSpending` as system-computed required costs (debt service, property costs, healthcare, insurance premiums, and net LTC care cost) plus required lifestyle, required-classified funded goals, and the nominal amount of required-classified goals skipped by the scheduler.

## Justification

Net LTC is `careCost - ltcBenefit`. Skipped required goals remain intended required spending even though they were not funded. This layer summary is not added again to `expenses.total`.

## Inputs

| Input | Every-term case | No-skips case | Unit |
|---|---:|---:|---|
| Debt service | 6,000 | 3,000 | dollars/year |
| Property costs | 4,000 | 2,000 | dollars/year |
| Healthcare | 5,000 | 4,000 | dollars/year |
| Insurance premiums | 1,000 | 1,000 | dollars/year |
| Gross LTC care cost | 3,000 | 3,000 | dollars/year |
| LTC benefit | 1,000 | 1,000 | dollars/year |
| Required lifestyle | 24,000 | 18,000 | dollars/year |
| Required funded goals | 2,500 | 2,000 | dollars/year |
| Skipped required goals, nominal | 1,500 | 0 | dollars/year |

## Arithmetic

Every-term case: system-required costs `= 6,000 + 4,000 + 5,000 + 1,000 + 3,000 - 1,000 = $18,000`. Required spending `= 18,000 + 24,000 + 2,500 + 1,500 = $46,000`.

No-skips case: system-required costs `= 3,000 + 2,000 + 4,000 + 1,000 + 3,000 - 1,000 = $12,000`. Required spending `= 12,000 + 18,000 + 2,000 + 0 = $32,000`.

## Expected

Exact `YearExpenses.requiredSpending`: every-term case `$46,000`; no-skips case `$32,000`. Fixture tolerance: absolute `$0.005`, because dollar figures are computed in binary floating point.

## Wrong readings

- Omitting the skipped required goal produces `$44,500` in the every-term case.
- Adding gross LTC cost without subtracting the benefit produces `$47,000` in the every-term case.
- Omitting system-computed costs and summing only lifestyle and goals produces `$28,000` in the every-term case.

## Family

outputs: `spending-required-requested-annual`.

feeds: `spending-required-shortfall-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six-followup.md in this directory.
