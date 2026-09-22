## Claim

Kind: formula. `projection/internal/distributedTaxableYieldRows.ts#distributedTaxableYieldRows`, folded by `projection/internal/annualIncomeSetup.ts#annualIncomeSetup`, computes ordinary dividends as generated dividends minus qualified dividends for each taxable account with a positive start-of-year balance. The start-of-year balance is the prior year's closing balance; a zero or negative start balance produces no yield row.

## Justification

Generated dividends are `start-of-year balance * dividendYieldPct / 100`; the qualified ratio is the account's ratio when set, else the allocation blend, else 0.85, clamped to `[0,1]`. Ordinary dividends are the remaining share.

## Inputs

| Input | Explicit case | Defaults case | Unit |
|---|---:|---:|---|
| Account type | taxable | taxable | type |
| Prior-year closing / start-of-year balance | 100,000 | 80,000 | dollars |
| Account interest yield | 2.25 | 1.25 | percent/year |
| Account dividend yield | 1.75 | 2.50 | percent/year |
| Account qualified ratio | 0.60 | absent, with no allocation blend (default 0.85) | fraction |
| Reinvest dividends | false | absent (default true) | Boolean |

## Arithmetic

Explicit case: dividends `= 100,000 * 1.75 / 100 = $1,750`; qualified `= 1,750 * 0.60 = $1,050`; ordinary `= 1,750 - 1,050 = $700`.

Defaults case: dividends `= 80,000 * 2.50 / 100 = $2,000`; qualified `= 2,000 * 0.85 = $1,700`; ordinary `= 2,000 - 1,700 = $300`. Because absent `reinvestDividends` means true, the yield is credited back to the account and the year's cash inflows are unchanged.

## Expected

Exact annual ordinary dividends: explicit case `$700`; defaults case `$300`. Fixture tolerance: absolute `$0.005`, because dollar figures are computed in binary floating point.

## Wrong readings

- Treating all explicit-case dividends as ordinary produces `$1,750`.
- Applying the 0.85 fallback despite the explicit 0.60 ratio produces `$262.50` of ordinary dividends in the explicit case.
- Treating absent `reinvestDividends` as false adds the defaults case's `$3,000` gross yield to cash inflows instead of `$0`.

## Family

outputs: `income-ordinary-dividends-annual`.

feeds: `tax-total-annual`; `magi-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract and the orchestrator's contract statement for the two defaults, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six-followup.md in this directory.
