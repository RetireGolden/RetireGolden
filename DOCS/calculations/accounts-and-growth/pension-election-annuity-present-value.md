## Claim

Kind: model. `decisions/pensionElection.ts#analyzePensionElections (presentValueAtCurveRate, curveRatePct)` uses `curveNominalDiscountRatePct`—the embedded TIPS real yield linearly interpolated at `max(5, planning age - current age)` plus plan inflation—and `pensionAnnuityPresentValue`, the annual discounted payment stream. These identities are stated by `PensionDecisionAnalysis` and the helper comments.

## Justification

The embedded `REAL_YIELD_CURVE_2026` anchors are the official U.S. Treasury par real yields for 2026-06-30 (decision D-TREASURY; see `DOCS/calculations/ladders-and-valuation/treasury-real-yield-curve-2026.md`): 5 years `1.93%`, 7 years `2.06%`, 10 years `2.20%`, 20 years `2.54%`, and 30 years `2.73%`, with linear interpolation and flat endpoints.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Owner current / start age | 64 / 65 | years |
| Planning age (and field-value owner death age) | 70 | years |
| Monthly pension | 1,000 | dollars/month |
| COLA | 0 | percent/year |
| Survivor continuation | 0 | percent |
| Plan inflation | 2.00 | percent/year |

## Arithmetic

Curve horizon `= max(5, 70 - 64) = 6 years`. Six-year real yield lies halfway from the 5-year `1.93%` anchor to the 7-year `2.06%` anchor: `1.93% + (6-5)/(7-5)(2.06%-1.93%) = 1.995%`. Therefore `curveRatePct = 1.995% + 2.00% = 3.995%`.

For `analyzePensionElections.presentValueAtCurveRate`, the planning age also supplies `ownerDeathAge = 70`. The owner therefore receives `$12,000` from start age 65 through age 70, at offsets 1 through 6, with no COLA and no survivor payments. Present value `= Σ(k=1..6) $12,000/1.03995^k = $62,915.883021698835` (exact rational value 62,915.8830216988349…).

Second case, explicitly at `pensionAnnuityPresentValue`: set `ownerDeathAge = 67` while retaining current age 64, start age 65, and discount rate `3.995%`. The three payments at offsets 1, 2, and 3 have present value `$12,000/1.03995 + $12,000/1.03995^2 + $12,000/1.03995^3 = $33,304.25282719482` (exact 33,304.2528271948209…).

## Expected

Exact values: `curveRatePct = 3.995%`; `presentValueAtCurveRate = $62,915.883021698835`; explicit three-payment `pensionAnnuityPresentValue = $33,304.25282719482`. Fixture tolerance: absolute `1e-9` percentage points for the rate and absolute `$0.005` for present value, because interpolation and discounting use binary floating point.

## Wrong readings

- Stopping the field's payment stream at death age 67 while deriving its rate from planning age 70 chooses the payment count and curve horizon independently and reports the helper's `$33,304.25282719482` instead of the field's six-payment value.
- Using the 5-year endpoint without interpolation gives `curveRatePct = 3.93%` and six-payment PV `$63,049.24798059383`.
- Omitting plan inflation gives a `1.995%` rate and six-payment PV `$67,228.51425330607`.
- Keeping the curve row stored before decision D-TREASURY (1.85%, 2.05%, ...) gives `curveRatePct = 3.95%`, six-payment PV `$63,008.166010097986` and three-payment PV `$33,332.7193407416`, the figures this worksheet stated until 2026-09-27.
- Treating the explicit helper case's three payments as valuation-date cash gives `$36,000` instead of discounting offsets 1–3.

## Family

outputs: `pension-election-annuity-present-value`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment completion), without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eleven.md in this directory (the re-check section named "Re-check, 2026-09-18 (three worksheets after the slice-thirteen comment completion)") (approved with a note on the three-payment helper value, which the orchestrator recomputed by script the same day and found exact as written, 33,332.7193407416; the reviewer's hand discounting was off by under a dollar).

Revision: The first derivation stopped the stream after three payments even though the stated planning age 70 sets both the six-year curve horizon and the field's owner death age; the implementation's fixture found the mismatch.

Revision, 2026-09-27 (decision D-TREASURY): the embedded curve became the official 2026-06-30 Treasury row, so the six-year yield moved from 1.95% to 1.995% and every figure above moved with it; the inputs, the method and the wrong readings' logic are unchanged. Recomputed by claude, the implementer of that decision, in exact rational arithmetic by a script that imports nothing from the engine; the same script reproduces the figures this worksheet stated before (3.95%, $63,008.166010097986, $33,332.7193407416). The restated figures were unreviewed until the review below, so the record carried reviewedBy 'unreviewed'.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-2-cash-flow.md`.
