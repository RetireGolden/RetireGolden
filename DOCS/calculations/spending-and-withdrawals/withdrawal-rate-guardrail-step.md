## Claim

Kind: model. `spending/guardrails.ts#nextGuardrailMultiplier` cuts or restores the discretionary multiplier by `adjustmentPct/100` when current gross target-spending withdrawal rate is respectively above the upper or below the lower percentage of its starting rate, clamping to `[0,maxMultiplier]`.

## Justification

The threshold signal is a stated noncircular proxy using gross target spending, not net portfolio draw. The rule is deterministic policy and does not claim optimality or preserve required spending through any separate portfolio failure.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Previous multiplier | 0.8 | fraction |
| Current/starting rate | 6 / 4 | percent |
| Upper guardrail | 120 | percent of starting rate |
| Adjustment | 10 | percentage points of full discretionary layer |

## Arithmetic

Upper trigger `=1.20(4%)=4.8%`; `6%>4.8%`, so cut. New multiplier `=0.8-0.10=0.7`, inside `[0,1]`.

## Expected

`{multiplier:0.7, action:'cut'}`, absolute tolerance `1e-12` for multiplier.

## Wrong readings

- Cutting by 10% of the previous multiplier gives `0.72`.
- Comparing current rate directly with 120% treats `6<120` and incorrectly holds.

## Family

`spending-guardrail-factor-annual`, `monte-carlo-guardrail-action-counts`, `monte-carlo-max-cut-depth-percentiles`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see ../accounts-and-growth/REVIEW-2026-09-18.md.
