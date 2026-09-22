## Claim

Kind: composition. `params/index.ts#standardDeduction; #age65StandardDeductionAddition` and `tax/federalTax.ts#computeFederalTax` compute the 2026 single-filer standard deduction as the basic annual deduction plus the per-person age-65 addition times the number of qualifying people, in dollars.

## Justification

If basic deduction is \(D\), per-person addition is \(A\), and qualifying count is the nonnegative integer \(n\), the composed deduction is \(D+nA\). This is distinct from the separate OBBBA senior deduction.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Filing status | single | status |
| Basic deduction | 16,100 | 2026 dollars/year |
| Age-65 addition | 2,050 | 2026 dollars/person/year |
| People aged 65+ | 1 | people |

The dollar values are `year2026.federalTax.standardDeduction.single` and `year2026.federalTax.age65Addition.single`.

## Arithmetic

Age addition: `1 × $2,050 = $2,050`.

Standard deduction: `$16,100 + $2,050 = $18,150`.

## Expected

Exact derived and published figure: `$18,150`; fixture tolerance: exact, because the published pack values and head count are integers.

## Wrong readings

- Omitting the age addition produces `$16,100`.
- Substituting the separate `$6,000` OBBBA senior deduction produces `$22,100`.

## Family

outputs: none.

feeds: `tax-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
