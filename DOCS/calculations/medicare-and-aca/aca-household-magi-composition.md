## Claim

Kind: composition. `tax/aca.ts#buildAcaHouseholdMagi` computes current-year ACA household MAGI as federal AGI plus nontaxable Social Security, tax-exempt interest, foreign-exclusion addback, and MAGI of dependents required to file, without feeding those addbacks into ordinary taxable income.

## Justification

The result's named components define a sum. Nontaxable Social Security is gross minus taxable Social Security; only required-filer dependents enter. Unknown material inputs make the result non-actionable, which this fully known example avoids.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Federal AGI | 50,000 | dollars/year |
| Gross Social Security | 20,000 | dollars/year |
| Taxable Social Security | 5,000 | dollars/year |
| Tax-exempt interest | 1,000 known | dollars/year |
| Foreign-exclusion addback | 2,000 known | dollars/year |
| Required-filer dependent MAGI | 3,000 | dollars/year |
| Non-required-filer dependent MAGI | 4,000 | dollars/year |

## Arithmetic

Nontaxable Social Security: `$20,000 - $5,000 = $15,000`.

Included dependent MAGI: `$3,000 + $0 = $3,000`.

ACA household MAGI: `$50,000 + $15,000 + $1,000 + $2,000 + $3,000 = $71,000`.

## Expected

Exact actionable result MAGI: `$71,000`, with components `{federalAgi: 50000, nontaxableSocialSecurity: 15000, taxExemptInterest: 1000, foreignExclusionAddback: 2000, requiredFilerDependentMagi: 3000}`; fixture tolerance: exact.

## Wrong readings

- Adding gross SS without subtracting taxable SS double-counts `$5,000` and produces `$76,000`.
- Including the non-required-filer dependent produces `$75,000`.

## Family

outputs: `magi-annual`.

feeds: `aca-modeled-allowable-ptc-annual`; `aca-economic-net-premium-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
