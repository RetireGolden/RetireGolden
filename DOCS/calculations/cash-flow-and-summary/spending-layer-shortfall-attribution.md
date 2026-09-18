## Claim

Kind: formula. `spending/layers.ts#attributeShortfall` first reduces the nominal annual spending attempted after any guardrail cut by the withdrawal shortfall to obtain actually funded dollars, then attributes each layer's miss against those dollars. The target miss includes the guardrail's deliberate cut as well as every attempted dollar the portfolio could not produce; ideal/excess misses are gaps in their successive layers, and no rounding is stated.

## Justification

Let actually funded dollars be `A=max(0,F-max(0,W))`. Priority funding allocates `A` to required, then target discretionary, then ideal, then excess. Thus `Rmiss=max(0,R-A)` and `Tmiss=max(0,T-A)`. For the successive upside layers, `idealFunded=max(0,min(I,A-T))` and `Imiss=I-idealFunded`; `excessFunded=max(0,min(X,A-T-I))` and `Xmiss=X-excessFunded`. Domain: finite nonnegative dollars with `T>=R`, optional layers defaulting to zero.

## Inputs

Case (a):

| Input | Value | Unit |
|---|---:|---|
| Required `R` | 60 | nominal dollars/year |
| Target `T` | 100 | nominal dollars/year |
| Ideal increment `I` | 20 | nominal dollars/year |
| Excess increment `X` | 10 | nominal dollars/year |
| Funded/attempted `F` | 85 | nominal dollars/year |
| Withdrawal shortfall `W` | 5 | nominal dollars/year |

Case (b) uses the same `R=60`, `T=100`, `I=20`, and `X=10`, with `F=62` and `W=5`, all in nominal dollars/year.

Case (c) uses the same `R=60`, `T=100`, `I=20`, and `X=10`, with `F=130` and `W=5`, all in nominal dollars/year.

## Arithmetic

Case (a): `A=max(0,85-max(0,5))=80`. `Rmiss=max(0,60-80)=0`. `Tmiss=max(0,100-80)=20`. `idealFunded=max(0,min(20,80-100))=0`, so `Imiss=20-0=20`. `excessFunded=max(0,min(10,80-100-20))=0`, so `Xmiss=10-0=10`.

Case (b): `A=max(0,62-max(0,5))=57`. `Rmiss=max(0,60-57)=3`. `Tmiss=max(0,100-57)=43`. `idealFunded=max(0,min(20,57-100))=0`, so `Imiss=20-0=20`. `excessFunded=max(0,min(10,57-100-20))=0`, so `Xmiss=10-0=10`.

Case (c): `A=max(0,130-max(0,5))=125`. `Rmiss=max(0,60-125)=0`. `Tmiss=max(0,100-125)=0`. `idealFunded=max(0,min(20,125-100))=20`, so `Imiss=20-20=0`. `excessFunded=max(0,min(10,125-100-20))=5`, so `Xmiss=10-5=5`.

## Expected

Case (a) required/target/ideal/excess shortfalls are `$0/$20/$20/$10`. Case (b) required/target/ideal/excess shortfalls are `$3/$43/$20/$10`. Case (c) required/target/ideal/excess shortfalls are `$0/$0/$0/$5`. Expected tolerance is absolute `1e-12` dollars because only subtraction, min, and max occur.

## Wrong readings

- Treating `F` as delivered dollars gives case (a) target shortfall `$15` rather than `$20`.
- Charging the whole withdrawal shortfall to the floor gives case (a) required shortfall `$5` rather than `$0`.
- Using `max(0,W-(T-R))` for the required miss gives case (b) required shortfall `$0` rather than `$3`, because that expression ignores the guardrail cut.
- Returning the full increments regardless of funding gives ideal/excess shortfalls `$20/$10` for case (c).

## Family

`spending-required-shortfall-annual`, `spending-target-shortfall-annual`, `spending-ideal-shortfall-annual`, `spending-excess-shortfall-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract and the orchestrator's contract statement for the attempted-versus-delivered distinction, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory (first review and the addendum for the cases added on 2026-09-18).

Revision note: The first derivation read `fundedSpending` as delivered dollars although its doc comment says attempted. The doc comment already states the contract, so no engine comment change is needed. Case (c) was added on 2026-09-18 so partially funded upside layers discriminate the successive-layer attribution rule from returning full increments.
