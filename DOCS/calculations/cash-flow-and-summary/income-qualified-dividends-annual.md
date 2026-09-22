## Claim

Kind: formula. `projection/internal/distributedTaxableYieldRows.ts#distributedTaxableYieldRows`, folded by `projection/internal/annualIncomeSetup.ts#annualIncomeSetup`, computes qualified dividends as generated dividends times the resolved qualified-dividend ratio for each taxable account with a positive start-of-year balance. The start-of-year balance is the prior year's closing balance; a zero or negative start balance produces no yield row.

## Justification

The qualified ratio is the account's own `qualifiedRatio` when set, else the allocation blend's ratio, else `DEFAULT_QUALIFIED_DIVIDEND_RATIO = 0.85`, clamped to `[0,1]`.

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

Explicit case: dividends `= 100,000 * 1.75 / 100 = $1,750`; qualified dividends `= 1,750 * 0.60 = $1,050`.

Defaults case: dividends `= 80,000 * 2.50 / 100 = $2,000`; qualified dividends `= 2,000 * 0.85 = $1,700`. The absent reinvestment flag defaults to true, so the yield is credited back to the account and the year's cash inflows are unchanged.

## Expected

Exact annual qualified dividends: explicit case `$1,050`; defaults case `$1,700`. Fixture tolerance: absolute `$0.005`, because dollar figures are computed in binary floating point.

## Wrong readings

- Applying the 0.85 fallback despite the explicit ratio produces `$1,487.50` in the explicit case.
- Applying the default as 85 rather than 0.85 produces `$170,000` in the defaults case.
- Treating reinvestment as suppressing dividend characterization produces `$0` in the defaults case instead of `$1,700`.

## Family

outputs: `income-qualified-dividends-annual`.

feeds: `tax-total-annual`; `magi-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract and the orchestrator's contract statement for the two defaults, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six-followup.md in this directory.
