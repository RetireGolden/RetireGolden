## Claim

Kind: composition. `projection/internal/types/aca.ts#YearAcaResult.grossEnrollmentPremium` sums each covered member's enrollment premium over all 12 months, while `projection/internal/types/aca.ts#YearAcaResult.applicableSlcspPremium` sums that member's SLCSP benchmark only in months whose enrollment premium is above zero; the latter is `null` without an ACA contract or when example-contract inputs mismatch. These identities are stated directly by the field comments.

## Justification

The benchmark gate is monthly and member-specific. A benchmark quote alone does not make a month applicable when enrollment premium is zero.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Covered member | person-a | id |
| Covered months | January–March | months |
| Enrollment premium, January–March | 500 each | dollars/month |
| Enrollment premium, April–December | 0 each | dollars/month |
| SLCSP benchmark, January–April | 600 each | dollars/month |
| SLCSP benchmark, May–December | 0 each | dollars/month |
| Contract present / inputs match | true / true | Booleans |

## Arithmetic

Gross enrollment premium `= 3 × $500 + 9 × $0 = $1,500`. Applicable SLCSP premium counts January–March because enrollment is above zero, but excludes April despite its `$600` benchmark: `3 × $600 = $1,800`.

No-contract case: `applicableSlcspPremium = null` by contract; it is not a numeric zero.

## Expected

Exact values: gross enrollment premium `$1,500`; applicable SLCSP premium `$1,800`; no-contract applicable SLCSP premium `null`. Fixture tolerance: absolute `$0.005` for dollar figures because monthly totals are computed in binary floating point; exact for `null`.

## Wrong readings

- Counting April's benchmark despite zero enrollment gives applicable SLCSP `$2,400`.
- Summing the benchmark into gross enrollment gives `$1,800` instead of `$1,500`.
- Publishing `$0` without a contract loses the contract's required `null` distinction.

## Family

outputs: `aca-gross-enrollment-premium-annual`; `aca-applicable-slcsp-premium-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eleven.md in this directory.
