## Claim

Kind: composition. `projection/internal/types/result.ts#YearResult.expenses.baseSpending` is recurring lifestyle spending actually intended after the guardrail: required lifestyle plus target lifestyle times `min(1, guardrailFactor)`, plus funded ideal and excess lifestyle. This formula is stated by the `YearExpenses.baseSpending` field comment in `projection/internal/types/yearLedger.ts`.

## Justification

One-time goals and system-computed costs are excluded. The cap prevents a guardrail factor above one from multiplying the target layer; upside enters through separately funded ideal and excess layers.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Required lifestyle | 36,000 | nominal dollars/year |
| Target lifestyle layer | 24,000 | nominal dollars/year |
| Guardrail factor | 0.75 | factor |
| Ideal lifestyle funded | 4,000 | nominal dollars/year |
| Excess lifestyle funded | 1,500 | nominal dollars/year |
| One-time goals | 8,000 | nominal dollars/year |

## Arithmetic

Target funded `= 24,000 × min(1, 0.75) = $18,000`. Base spending `= 36,000 + 18,000 + 4,000 + 1,500 = $59,500`. The `$8,000` one-time goal is excluded.

## Expected

Exact value: `$59,500`. Fixture tolerance: absolute `$0.005`, because the ledger composes binary-floating-point dollar values.

## Wrong readings

- Applying the factor to required spending too produces `$50,500`.
- Including the one-time goal produces `$67,500`.
- Omitting funded ideal and excess layers produces `$54,000`.

## Family

outputs: `spending-base-annual`.

feeds: `spending-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six.md in this directory.
