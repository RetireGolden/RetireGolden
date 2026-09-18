## Claim

Kind: composition. `projection/compare.ts#summarizeProjection` publishes ending estate heir tax as the sum of every `EstateAccountBreakdown.heirTax` amount after each account's destination, charity carve-out, taxable pre-tax base and heir rate have been applied, in nominal horizon dollars with no stated rounding.

## Justification

The interface comment gives the exact identity `endingEstateHeirTax=sum_a estateBreakdown[a].heirTax`; it must sum the already resolved per-account tax rather than recomputing taxable bases or taxing gross balances a second time. The domain is a finite estate breakdown with finite nonnegative tax amounts.

## Inputs

| Account | Gross balance | Taxable pre-tax base | Charity amount | Published heir tax | Unit |
|---|---:|---:|---:|---:|---|
| Traditional IRA | 300,000.00 | 240,000.00 | 30,000.00 | 52,800.00 | nominal dollars |
| Non-spouse HSA | 40,000.00 | 40,000.00 | 0.00 | 8,800.00 | nominal dollars |
| Roth IRA | 125,000.00 | 0.00 | 0.00 | 0.00 | nominal dollars |

## Arithmetic

`$52,800.00 + $8,800.00 + $0.00 = $61,600.00`.

## Expected

Ending estate heir tax is exactly `$61,600.00`, with exact-cent tolerance because the summary adds the supplied per-account cent amounts.

## Wrong readings

- Applying 22% to the full traditional gross and HSA gross gives `0.22($300,000+$40,000)=$74,800.00`.
- Subtracting the charity amount again from the already resolved heir-tax total gives `$31,600.00`.

## Family

outputs: `estate-heir-income-tax`.

feeds: `projection-summary-ending-after-tax-estate`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
