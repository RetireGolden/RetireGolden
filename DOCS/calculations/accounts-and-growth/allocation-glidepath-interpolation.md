## Claim

Kind: model. `allocation/assetClasses.ts#targetWeightsAt` linearly interpolates normalized class weights between endpoints for a linear/custom glidepath, clamps outside first/last years, and holds staged policies as a step function from each stage year.

## Justification

At year `y` between `y0,y1`, componentwise interpolation is `a+t(b-a)`, `t=(y-y0)/(y1-y0)`. Convex interpolation preserves nonnegativity and unit sum when endpoints have both. This is a policy compilation convention, not an optimal-allocation claim.

## Inputs

| Year | US stocks | Bonds | Unit |
|---:|---:|---:|---|
| 2020 endpoint | 0.8 | 0.2 | fraction |
| 2030 endpoint | 0.6 | 0.4 | fraction |
| Probe | 2025 | | calendar year |

## Arithmetic

`t=(2025-2020)/10=1/2`. US `=0.8+(1/2)(-0.2)=0.7`; bonds `=0.2+(1/2)(0.2)=0.3`. A 2015 probe clamps to `[0.8,0.2]`; 2035 clamps to `[0.6,0.4]`.

## Expected

2025 `[0.7,0.3]`, 2015 `[0.8,0.2]`, 2035 `[0.6,0.4]`; absolute tolerance `1e-12`.

## Wrong readings

- Integer step selection gives `[0.8,0.2]` in 2025.
- Extrapolation gives `[0.9,0.1]` in 2015 instead of the flat endpoint.

## Family

`bucket-lens-allocation`, `income-taxable-yield-annual` upstream.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.

Revision, 2026-09-27 (B2-P1 slice 2, after the review of RetireGolden #752): the record's limit about `bucket-lens-allocation` was restated because the code moved. It said the bucket lens reads only the published investable total; the lens now lives in the engine (`projection/bucketLens.ts#bucketLens`, its own record `bucket-lens-allocation`) and reads the published investable total and the published net portfolio need, refusing a year whose need is not a finite number. The family above is still reached only through the balances, and this record still does not list it. The record's text changed after the review above, so its `reviewedBy` was `unreviewed` again.

Reviewed by: Grok (grok-4.7), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-grok-1.md`.
