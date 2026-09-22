## Claim

Kind: composition. `projection/internal/types/result.ts#YearResult.expenses.baseSpending` is recurring lifestyle spending actually intended after the guardrail: required lifestyle plus target lifestyle times `min(1, guardrailFactor)`, plus funded ideal and excess lifestyle. This formula is stated by the `YearExpenses.baseSpending` field comment in `projection/internal/types/yearLedger.ts`.

## Justification

One-time goals and system-computed costs are excluded. The cap prevents a guardrail factor above one from multiplying the target layer; upside enters through separately funded ideal and excess layers. With a policy active the two funded upside layers draw on `max(0, discretionaryMultiplier - 1) × guardrailStepBasis`, so both are 0 in any year the multiplier is at or below 1, every cutting year included.

## Inputs

| Input | Case 1: active policy, cutting year | Case 2: no policy active | Unit |
|---|---:|---:|---|
| Required lifestyle | 36,000 | 36,000 | nominal dollars/year |
| Target lifestyle layer | 24,000 | 24,000 | nominal dollars/year |
| Guardrail factor | 0.75 | not applicable | factor |
| Ideal lifestyle funded | 0 | 4,000 | nominal dollars/year |
| Excess lifestyle funded | 0 | 1,500 | nominal dollars/year |
| One-time goals | 8,000 | 8,000 | nominal dollars/year |

## Arithmetic

Case 1: Target funded `= 24,000 × min(1, 0.75) = $18,000`. Base spending `= 36,000 + 18,000 + 0 + 0 = $54,000`. The `$8,000` one-time goal is excluded.

Case 2: With no guardrail policy active, the full target layer applies and the funded upside budget is the full ideal plus excess lifestyle. Base spending `= 36,000 + 24,000 + 4,000 + 1,500 = $65,500`. The `$8,000` one-time goal is excluded.

## Expected

Exact values: Case 1 `$54,000`; Case 2 `$65,500`. Fixture tolerance: absolute `$0.005`, because the ledger composes binary-floating-point dollar values.

## Wrong readings

- Applying the factor to required spending too in Case 1 produces `36,000 × 0.75 + 18,000 = $45,000`.
- Including the one-time goal in Case 1 produces `$62,000`.
- Funding the ideal and excess layers in a cutting year produces `$59,500` in Case 1 (`$54,000 + $4,000 + $1,500`), the state the contract rules out.
- Applying a `0.75` factor to the target layer in Case 2 although no policy is active produces `36,000 + 18,000 + 4,000 + 1,500 = $59,500`, the same figure reached from the other side.

## Family

outputs: `spending-base-annual`.

feeds: `spending-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six.md in this directory. Revision 2026-09-22: the single case, a cutting year carrying funded upside layers, is not a state the corrected YearExpenses.baseSpending contract allows (the upside layers are 0 whenever the multiplier is at or below 1); it was split into a cutting-year case with no upside ($54,000) and a no-policy case with the full layers ($65,500). Re-derived by codex without executing the engine.
