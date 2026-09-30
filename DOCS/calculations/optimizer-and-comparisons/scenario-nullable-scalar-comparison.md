## Claim

Kind: composition. `scenarios/scalarComparison.ts#compareNullableScalars` (until B2-P1 slice 3 the private `scenarios/comparison.ts#nullableScalar`) preserves nullable baseline and proposal values and publishes `proposal-baseline` only when both exist, otherwise publishing a null delta, in the metric's own units and with no stated rounding.

## Justification

The type comment makes comparability conjunctive: `d=p-b` if `b!=null` and `p!=null`, else `d=null`; absence is not numerical zero. The valid domain is any pair of finite numbers or nulls.

## Inputs

| Case | Baseline | Proposal | Unit |
|---|---:|---:|---|
| Both present | 2041 | 2044 | calendar year |
| Baseline absent | null | 2044 | calendar year |

## Arithmetic

Present case: `2044-2041=3` years. Absent case: one operand is null, so delta is `null` and no subtraction is defined.

## Expected

The present comparison has exact integer delta `3`; the absent comparison has exactly `null` delta.

## Wrong readings

- Reversing the present subtraction gives `-3`.
- Coercing null to zero gives absent-case delta `2044`, falsely presenting a comparison.

## Family

outputs: `scenario-comparison-cell`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-slice-seven.md in this directory.

Reviewed by: Grok (grok-4.7), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-grok-2.md`.

## Restated (B2-P1 slice 3, 2026-09-27)

The helper moved, unchanged in its arithmetic, from a private function of `scenarios/comparison.ts` to the exported leaf module `scenarios/scalarComparison.ts` as `compareNullableScalars`; a present value that is not finite is refused with a `RangeError`, and a negative zero is published as 0. It serves the scenario comparison's nullable cells (the depletion year, the spending-capacity figures and the annual rows where only one horizon has the year) and the Compare page's depletion age; the candidate evaluation's deltas (`decisions/evaluateCandidate.ts`) are plain subtractions and do not use it. The evidence asserts the worksheet's two cases directly on the exported helper as well as through `compareScenarioPlans`. The record is `unreviewed` again because its statement and pins changed. Derivation and check: RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice3-derivation.md` and `b2p1-slice3-check.md`.
