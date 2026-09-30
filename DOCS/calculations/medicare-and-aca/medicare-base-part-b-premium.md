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

## Whose publication the premium scale reads (D-2027-ROLLOVER)

`premiumScale` runs from the year of CMS's latest publication of the Part B premium and IRMAA amounts (`params/index.ts#componentPackView` with the `cmsMedicare` component), no longer from the year of the whole set of published figures. Today CMS's latest year is 2026, so the scale and every premium are unchanged: from a 2028 view the Medicare figures are still 2026's `202.90` a month, read at year 2026. The evidence file asserts it. When CMS publishes 2027, a 2027 premium is read at a scale of 1 while that year's other figures may still be projected.

Restated 2026-09-28 by the implementer of decision D-2027-ROLLOVER (Claude Opus 5.5), from the derivation and the independent check (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/rollover-2027-derivation.md` and `rollover-2027-check.md`). Not yet reviewed: the record is `reviewedBy: 'unreviewed'`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.

Reviewed by: Grok (grok-4.7), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-grok-2.md`.

Restated 2026-09-29 by claude (opus 5.5), after the Grok review above: the record's formula wrote the Part B premium as the standard premium times the applicable percentage over 25, which the engine no longer computes above tier 0; it now reads CMS's published tier totals (`medicare-irmaa-first-tier-boundary`). The formula says so, with the standard premium at tier 0. The tier-0 case here, $2,434.80, does not move. The restated formula is Claude's, so the record was unreviewed until the review below.

Reviewed by: Codex (GPT-6-Sol), 2026-09-30, targeted re-check after the fix, `DOCS/calculations/reviews/REVIEW-2026-09-30-recheck-codex.md`.
