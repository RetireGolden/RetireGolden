## Claim

Kind: formula. `projection/internal/types/result.ts#YearResult.incomes.recurring`, produced by `projection/internal/otherIncomeStreams.ts#otherIncomeStreams`, pays a recurring stream inside its stated year window while any household member is alive, multiplying by the supplied cumulative general-inflation factor only when `inflationAdjusted` is true. The formula is derived from the extract's stated window, household gate, and inflation-election convention.

## Justification

Recurring streams are household flows rather than person-owned flows. Tax treatment controls tax routing, not whether the row joins recurring income.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Annual amount | 12,000 | today dollars/year |
| Start / end year | 2029 / 2032 | inclusive calendar-year window |
| Current year | 2030 | year |
| Inflation adjusted | true | Boolean |
| Cumulative inflation factor | 1.08 | nominal/today ratio |
| Any household member alive | true | Boolean |
| Tax treatment | none | treatment |

## Arithmetic

2030 is inside 2029–2032 and the household gate passes. Amount `= 12,000 × 1.08 = $12,960`. `taxTreatment: none` changes no cash amount.

## Expected

Exact value: `$12,960`. Fixture tolerance: absolute `$0.005`, because inflation multiplication uses binary floating point.

## Wrong readings

- Ignoring the inflation election produces `$12,000`.
- Dropping a tax-free row from cash income produces `$0`.
- Paying after the last household death would produce `$12,960`; the household gate instead produces `$0`.

## Family

outputs: `income-recurring-annual`.

feeds: `income-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six.md in this directory.
