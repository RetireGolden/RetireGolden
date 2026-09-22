## Claim

Kind: model. `decisions/pensionElection.ts#analyzePensionElections (presentValueAtCurveRate, curveRatePct)` uses `curveNominalDiscountRatePct`—the embedded TIPS real yield linearly interpolated at `max(5, planning age - current age)` plus plan inflation—and `pensionAnnuityPresentValue`, the annual discounted payment stream. These identities are stated by `PensionDecisionAnalysis` and the helper comments.

## Justification

The embedded `REAL_YIELD_CURVE_2026` anchors are 5 years `1.85%`, 7 years `2.05%`, 10 years `2.25%`, 20 years `2.55%`, and 30 years `2.70%`, with linear interpolation and flat endpoints.

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

Curve horizon `= max(5, 70 - 64) = 6 years`. Six-year real yield lies halfway from the 5-year `1.85%` anchor to the 7-year `2.05%` anchor: `1.85% + (6-5)/(7-5)(2.05%-1.85%) = 1.95%`. Therefore `curveRatePct = 1.95% + 2.00% = 3.95%`.

For `analyzePensionElections.presentValueAtCurveRate`, the planning age also supplies `ownerDeathAge = 70`. The owner therefore receives `$12,000` from start age 65 through age 70, at offsets 1 through 6, with no COLA and no survivor payments. Present value `= Σ(k=1..6) $12,000/1.0395^k = $63,008.166010097986`.

Second case, explicitly at `pensionAnnuityPresentValue`: set `ownerDeathAge = 67` while retaining current age 64, start age 65, and discount rate `3.95%`. The three payments at offsets 1, 2, and 3 have present value `$12,000/1.0395 + $12,000/1.0395^2 + $12,000/1.0395^3 = $33,332.7193407416`.

## Expected

Exact values: `curveRatePct = 3.95%`; `presentValueAtCurveRate = $63,008.166010097986`; explicit three-payment `pensionAnnuityPresentValue = $33,332.7193407416`. Fixture tolerance: absolute `1e-9` percentage points for the rate and absolute `$0.005` for present value, because interpolation and discounting use binary floating point.

## Wrong readings

- Stopping the field's payment stream at death age 67 while deriving its rate from planning age 70 chooses the payment count and curve horizon independently and reports the helper's `$33,332.7193407416` instead of the field's six-payment value.
- Using the 5-year endpoint without interpolation gives `curveRatePct = 3.85%` and six-payment PV `$63,213.991361387314`.
- Omitting plan inflation gives a `1.95%` rate and six-payment PV `$67,330.738824470143`.
- Treating the explicit helper case's three payments as valuation-date cash gives `$36,000` instead of discounting offsets 1–3.

## Family

outputs: `pension-election-annuity-present-value`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment completion), without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eleven.md in this directory (the re-check section named "Re-check, 2026-09-18 (three worksheets after the slice-thirteen comment completion)") (approved with a note on the three-payment helper value, which the orchestrator recomputed by script the same day and found exact as written, 33,332.7193407416; the reviewer's hand discounting was off by under a dollar).

Revision: The first derivation stopped the stream after three payments even though the stated planning age 70 sets both the six-year curve horizon and the field's owner death age; the implementation's fixture found the mismatch.
