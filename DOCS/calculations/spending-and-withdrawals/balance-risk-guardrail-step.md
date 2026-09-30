## Claim

Kind: model. `spending/guardrails.ts#nextBalanceGuardrailMultiplier` compares deflated current portfolio dollars with lower/upper percentages of starting portfolio dollars, moves the discretionary multiplier one adjustment step outside solved thresholds, and otherwise holds.

## Justification

Expressing both balances in real dollars makes the ratio time-consistent. Missing/degenerate thresholds must hold because inventing a trigger would not be evidence-based.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Previous multiplier | 0.8 | fraction |
| Current/start balance | 70 / 100 | real dollars |
| Lower threshold | 80 | percent of start |
| Adjustment | 10 | percentage points |

## Arithmetic

Lower dollar trigger `=100(0.80)=80`; `70<80`, so multiplier `=0.8-0.10=0.7`.

## Expected

`{multiplier:0.7, action:'cut'}`, absolute tolerance `1e-12`.

## Wrong readings

- Comparing nominal current balance with real starting balance can suppress or create a trigger.
- Using 80 as a fraction creates an `$8,000` threshold and incorrectly cuts nearly always.

## Family

`spending-guardrail-factor-annual`, `display-guardrail-balance-thresholds` upstream.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see ../accounts-and-growth/REVIEW-2026-09-18.md.

Revision, 2026-09-27 (B2-P1 slice 2): the record's limit about the dollar thresholds was restated because the code moved. It said the Results and Monte Carlo pages re-derived the thresholds in planner-ui without calling this step; since B2-P1 slice 2 the pages read `montecarlo/riskBasedGuardrails.ts#guardrailThresholdDollars`, which publishes this step's L and U on the first-year anchor, and the record now lists `display-guardrail-balance-thresholds` in its feeds. The worked example and its evidence are unchanged. The review above (cursor) covered the earlier text, so the record is `unreviewed` until the new limit is reviewed.

Reviewed by: Grok (grok-4.7), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-grok-2.md`.
