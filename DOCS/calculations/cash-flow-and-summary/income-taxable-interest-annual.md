## Claim

Kind: formula. `projection/internal/distributedTaxableYieldRows.ts#distributedTaxableYieldRows`, folded by `projection/internal/annualIncomeSetup.ts#annualIncomeSetup`, computes annual taxable interest for each taxable account with a positive start-of-year balance as `start-of-year balance * interestYieldPct / 100`. The start-of-year balance is the prior year's closing balance; a zero or negative start balance produces no yield row.

## Justification

An account-level interest yield overrides an allocation blend; absent both, the rate is 0. Reinvestment changes where generated cash goes, not its interest characterization.

## Inputs

| Input | Explicit case | Defaults case | Unit |
|---|---:|---:|---|
| Account type | taxable | taxable | type |
| Prior-year closing / start-of-year balance | 100,000 | 80,000 | dollars |
| Account interest yield | 2.25 | 1.25 | percent/year |
| Account dividend yield | 1.75 | 2.50 | percent/year |
| Account qualified ratio | 0.60 | absent (default 0.85) | fraction |
| Reinvest dividends | false | absent (default true) | Boolean |

## Arithmetic

Explicit case: `$100,000 * 2.25 / 100 = $2,250` taxable interest.

Defaults case: `$80,000 * 1.25 / 100 = $1,000` taxable interest. The absent `reinvestDividends` flag defaults to true, so all generated yield is credited back to the account and the year's cash inflows are unchanged by this `$1,000`.

## Expected

Exact annual taxable interest: explicit case `$2,250`; defaults case `$1,000`. Fixture tolerance: absolute `$0.005`, because dollar figures are computed in binary floating point.

## Wrong readings

- Applying the dividend rate instead of the interest rate produces `$1,750` in the explicit case.
- Treating 2.25 as a fraction rather than a percentage produces `$225,000` in the explicit case.
- Treating reinvestment as suppressing the income characterization produces `$0` in the defaults case; it instead leaves the generated `$1,000` characterized while adding `$0` to cash inflows.

## Family

outputs: `income-taxable-interest-annual`.

feeds: `tax-total-annual`; `magi-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract and the orchestrator's contract statement for the two defaults, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six-followup.md in this directory.
