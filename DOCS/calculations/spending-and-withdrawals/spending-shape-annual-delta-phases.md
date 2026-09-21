## Claim

Kind: model. `spending/shapePresets.ts#annualDeltaPhases` compiles an annual real spending delta into five-year phase multipliers through age 100, using `(1+delta/100)^(age-retirementAge)`, rounding each multiplier to two decimals and clamping to `[0,3]`; zero delta emits no phases.

## Justification

Compound change multiplies the prior year's real level, so powers rather than linear subtraction are required. Five-year steps are an explicit editable approximation to annual change, not exact annual spending.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Annual real delta | -2 | percent/year |
| Retirement age | 65 | years |

## Arithmetic

At 70: `0.98^5=0.9039207968`, rounded `0.90`. At 75: `0.98^10=0.817072806887547`, rounded `0.82`.

## Expected

The first two phase rows use ages `70,75` and multipliers `0.90,0.82`, exact to the declared two-decimal rounding.

## Wrong readings

- Linear decline gives `0.90` at 70 but `0.80` at 75 instead of `0.82`.
- Starting the first step at retirement age emits age 65 multiplier `1.00`, an off-by-one phase.

## Family

`spending-base-annual`, `spending-shape-delta-vs-flat`, `sustainable-spending-result-max-base-annual`, `sustainable-spending-result-spending-slack-dollars`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see ../accounts-and-growth/REVIEW-2026-09-18.md.
