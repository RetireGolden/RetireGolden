## Claim

Kind: formula. `projection/internal/distributedTaxableYieldRows.ts#distributedTaxableYieldRows`, folded by `projection/internal/annualIncomeSetup.ts#annualIncomeSetup`, computes taxable yield as taxable interest plus all dividends for each taxable account with a positive start-of-year balance. The start-of-year balance is the prior year's closing balance; a zero or negative start balance produces no yield row.

## Justification

Qualified and ordinary dividends partition dividends; they do not add on top of dividends again. Tax-exempt interest is separate and is not part of taxable yield.

## Inputs

| Input | Explicit case | Defaults case | Unit |
|---|---:|---:|---|
| Account type | taxable | taxable | type |
| Prior-year closing / start-of-year balance | 100,000 | 80,000 | dollars |
| Account interest yield | 2.25 | 1.25 | percent/year |
| Account dividend yield | 1.75 | 2.50 | percent/year |
| Account tax-exempt interest yield | 0 | 0 | percent/year |
| Account qualified ratio | 0.60 | absent, with no allocation blend (default 0.85) | fraction |
| Reinvest dividends | false | absent (default true) | Boolean |

## Arithmetic

Explicit case: interest `= 100,000 * 2.25 / 100 = $2,250`; dividends `= 100,000 * 1.75 / 100 = $1,750`; taxable yield `= 2,250 + 1,750 = $4,000`.

Defaults case: interest `= $1,000`; dividends `= $2,000`; taxable yield `= 1,000 + 2,000 = $3,000`. The absent `reinvestDividends` flag defaults to true, so this `$3,000` is credited back to the account and contributes `$0` to the year's cash inflows.

## Expected

Exact annual taxable yield: explicit case `$4,000`; defaults case `$3,000`. Fixture tolerance: absolute `$0.005`, because dollar figures are computed in binary floating point.

## Wrong readings

- Adding interest, dividends, qualified dividends, and ordinary dividends double-counts the dividend partition and produces `$5,750` in the explicit case.
- Including a hypothetical 0.50% tax-exempt yield would produce `$4,500` rather than `$4,000`; exempt interest is separate from taxable yield.
- Treating absent reinvestment as false adds `$3,000` to the defaults case's cash inflows instead of `$0`.

## Family

outputs: `income-taxable-yield-annual`.

feeds: `income-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract and the orchestrator's contract statement for the two defaults, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six-followup.md in this directory.
