## Claim

Kind: composition. `scenarios/comparison.ts#compareScenarioPlans` counts, separately for baseline and proposal, the projection years whose published `YearResult.irmaaTier` is strictly above tier 0 and compares those integer counts.

## Justification

The result type defines tier 0 as standard premium and tiers 1-5 as surcharge tiers, so the exact side count is `sum_y 1[irmaaTier_y>0]`; Medicare premium dollars and maximum tier are different outputs. The domain is a finite sequence of integer tier classifications from 0 through 5.

## Inputs

| Side | Annual tiers | Unit |
|---|---|---|
| Baseline | 0, 1, 3, 0, 5 | tier classification |
| Proposal | 0, 0, 2, 0, 4 | tier classification |

## Arithmetic

Baseline indicators are `0,1,1,0,1`, totaling `3`. Proposal indicators are `0,0,1,0,1`, totaling `2`. Proposal-minus-baseline delta is `2-3=-1` year.

## Expected

Expected baseline surcharge-tier years `3`, proposal surcharge-tier years `2`, and comparison delta `-1`, all exact integers.

## Wrong readings

- Summing tier numbers gives baseline `9` and proposal `6`.
- Counting tier 0 as a surcharge year gives `5` for both sides and delta `0`.

## Family

outputs: `scenario-irmaa-surcharge-tier-years`.

feeds: `scenario-comparison-cell`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
