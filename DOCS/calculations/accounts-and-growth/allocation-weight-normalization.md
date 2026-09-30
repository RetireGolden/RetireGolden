## Claim

Kind: formula. `allocation/assetClasses.ts#weightsToVector` converts class weights into normalized fractions in the fixed order US stocks, international stocks, bonds, cash; no rounding is stated.

## Justification

For nonnegative weights `w_i` with positive sum `W`, normalized fraction `f_i=w_i/W`; then `sum f_i=1`. Domain: one finite nonnegative weight per asset class and positive total.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| US / international / bonds / cash | 60 / 20 / 20 / 0 | relative weights |

## Arithmetic

`W=100`; vector `=[60/100,20/100,20/100,0/100]=[0.6,0.2,0.2,0]`; sum `=1`.

## Expected

`[0.6,0.2,0.2,0]`, absolute tolerance `1e-12` per component.

## Wrong readings

- Returning percentages gives `[60,20,20,0]` with sum 100.
- Sorting by magnitude rather than class order can silently move the 20% bond weight into another class.

## Family

`bucket-lens-allocation` upstream; no direct engine weight-vector family yet.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.

Revision, 2026-09-27 (B2-P1 slice 2, after the review of RetireGolden #752): the record's limit about `bucket-lens-allocation` was restated because the code moved. It said the bucket lens reads only the published investable total; the lens now lives in the engine (`projection/bucketLens.ts#bucketLens`, its own record `bucket-lens-allocation`) and reads the published investable total and the published net portfolio need, refusing a year whose need is not a finite number. The family above is still reached only through the balances, and this record still does not list it. The record's text changed after the review above, so its `reviewedBy` was `unreviewed` again.

Reviewed by: Grok (grok-4.7), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-grok-1.md`.
