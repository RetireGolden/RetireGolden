## Claim

Kind: data. `tax/medicare.ts#medicareAnnualPremiumPerPerson` publishes the 2026 standard Part B premium per Medicare-covered person as the pack's monthly premium times 12, with no Part D surcharge at tier 0.

## Justification

`year2026.medicare.partBStandardMonthly` is `$202.90`, sourced in the pack header to CMS 2026. Annualizing a monthly premium requires twelve monthly charges.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Standard Part B premium | 202.90 | dollars/person/month |
| IRMAA tier | 0 | tier |
| Months | 12 | months/year |

## Arithmetic

Part B annual: `$202.90 × 12 = $2,434.80`.

Part D surcharge annual: `$0 × 12 = $0`.

IRMAA surcharge annual: `$0`.

## Expected

Exact derived values: `partBAnnual = $2,434.80`, `partDSurchargeAnnual = $0`, `irmaaSurchargeAnnual = $0`; published figures are the same. Fixture tolerance: absolute `$0.005` for the Part B binary-floating-point product and exact for zero.

## Wrong readings

- Treating `$202.90` as annual produces `$202.90`.
- Adding the pack's `$2,100` Part D out-of-pocket threshold as a premium produces `$4,534.80`.

## Family

outputs: `medicare-premiums-annual`; `irmaa-surcharge-annual`.

feeds: `spending-healthcare-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
