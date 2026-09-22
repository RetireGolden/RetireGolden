## Claim

Kind: model. `projection/internal/types/result.ts#YearResult.rothConversion`, sized by `strategies/rothConversion.ts#sizeRothConversion`, fills a selected federal bracket. The type comment states that without Social Security the `topOfBracket` amount is bracket upper bound minus `(ordinary income - deduction)`; with benefits, the amount is instead found by bisection because taxable Social Security phases in.

## Justification

For a 2026 single filer selecting the 22% bracket, the upper bound is the next bracket's `lowerBound`, `$105,700`, from `year2026.federalTax.brackets.single`. The base deduction is the 2026 single standard deduction, `$16,100`, from `year2026.federalTax.standardDeduction.single`.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Tax year / filing status | 2026 / single | year / status |
| Selected bracket | 22 | percent |
| Selected bracket upper bound | 105,700 | dollars taxable income |
| Ordinary income before conversion | 70,000 | dollars |
| Standard deduction | 16,100 | dollars |
| Social Security benefits | 0 | dollars |
| Available traditional balance after RMD reserve | 100,000 | dollars |

## Arithmetic

Taxable ordinary income before conversion `= $70,000 - $16,100 = $53,900`. Bracket headroom `= $105,700 - $53,900 = $51,800`. The available balance is sufficient, so the annual conversion is `$51,800`.

Benefits branch: when Social Security benefits are positive, the comment requires bisection against the federal engine because an added conversion may make additional benefits taxable; no closed-form numeric result is asserted for that branch.

## Expected

Exact value for the no-benefits case: `$51,800`. Fixture tolerance: absolute `$0.005`, because the published dollar figure is computed in binary floating point. Benefits branch: no numeric expectation; evidence must show the bisection result for its full tax input.

## Wrong readings

- Ignoring the deduction gives `$105,700 - $70,000 = $35,700`.
- Using the 22% bracket's lower bound `$50,400` as its upper bound gives `$50,400 - $53,900 = -$3,500`, commonly clamped to `$0`.
- Applying the no-benefits subtraction when benefits are present can overstate headroom because taxable Social Security can rise with the conversion.

## Family

outputs: `roth-conversion-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eleven.md in this directory.
