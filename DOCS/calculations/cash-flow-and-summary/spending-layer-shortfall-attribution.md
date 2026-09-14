## Claim

Kind: formula. `spending/layers.ts#attributeShortfall` attributes nominal annual misses so required shortfall is withdrawal shortfall remaining after target discretionary dollars, target shortfall is the gap from funded spending to the full target, and ideal/excess misses are capped gaps in their successive layers; no rounding is stated.

## Justification

Priority funding allocates dollars to required, then target discretionary, then ideal, then excess. Thus `Rmiss=max(0,W-(T-R))`, `Tmiss=max(0,T-F)`, `Imiss=min(I,max(0,T+I-F))`, and `Xmiss=min(X,max(0,T+I+X-F))`. Domain: finite nonnegative dollars with `T>=R`, optional layers defaulting to zero.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Required `R` | 60 | nominal dollars/year |
| Target `T` | 100 | nominal dollars/year |
| Ideal increment `I` | 20 | nominal dollars/year |
| Excess increment `X` | 10 | nominal dollars/year |
| Funded/attempted `F` | 85 | nominal dollars/year |
| Withdrawal shortfall `W` | 5 | nominal dollars/year |

## Arithmetic

Target discretionary capacity is `100-60=40`. `Rmiss=max(0,5-40)=0`. `Tmiss=max(0,100-85)=15`. `Imiss=min(20,max(0,120-85))=20`. `Xmiss=min(10,max(0,130-85))=10`.

## Expected

Required/target/ideal/excess shortfalls are `$0/$15/$20/$10`, with absolute tolerance `1e-12` dollars because only subtraction, min, and max occur.

## Wrong readings

- Charging all withdrawal shortfall to essentials gives required shortfall `$5`.
- Counting only the withdrawal failure and ignoring a deliberate guardrail cut gives target shortfall `$5` rather than `$15`.

## Family

`spending-required-shortfall-annual`, `spending-target-shortfall-annual`, `spending-ideal-shortfall-annual`, `spending-excess-shortfall-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
