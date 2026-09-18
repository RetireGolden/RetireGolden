## Claim

Kind: model. `insights/detectors/irmaaTierEdge.ts#irmaaTierEdge.screen` publishes the nominal annual Medicare premium cliff for a selected IRMAA edge as the all-enrollee Part B-plus-Part D annual premium just above the MAGI threshold minus the corresponding premium one dollar below it, using the healthcare-premium scale for the charge year two years later and no stated rounding; this difference formula is the convention implied by the target description and must be checked against the engine.

## Justification

An IRMAA threshold is a cliff because an additional dollar of lookback MAGI changes the applicable premium schedule for every covered enrollee, so `cliff=n(P_above-P_below)`. The model is intended as a rough avoidance signal, not a claim that reducing current-year income changes a premium already charged or that every dollar of conversion can be trimmed. Valid inputs require a selected next threshold, at least one Medicare enrollee and finite same-year per-person premiums.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Medicare enrollees in charge year | 2 | people |
| Premium one dollar below threshold | 2,400 | nominal dollars/person/year |
| Premium just above threshold | 4,200 | nominal dollars/person/year |
| MAGI-to-premium lag | 2 | years |

## Arithmetic

Per-person cliff `=$4,200-$2,400=$1,800/year`. Household annual cliff `=2*$1,800=$3,600/year`.

## Expected

Annual premium cliff is exactly `$3,600.00`, with exact-cent tolerance because the example premiums and person count are exact.

## Wrong readings

- Forgetting the second enrollee gives `$1,800.00`.
- Reversing above and below gives `-$3,600.00`.

## Family

outputs: `insight-irmaa-tier-edge-premium-cliff`.

feeds: `insight-impact-ending-after-tax-estate-delta`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
