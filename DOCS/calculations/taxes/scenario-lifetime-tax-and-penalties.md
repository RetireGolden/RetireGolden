## Claim

Kind: composition. `scenarios/comparison.ts#compareScenarioPlans` separately sums nominal annual `YearResult.tax` and `YearResult.penalties` for each scenario side, then places each baseline/proposal total in its comparison cell without mixing the two channels.

## Justification

For side `s`, `lifetimeTax_s=sum_y tax_{s,y}` and `lifetimePenalties_s=sum_y penalties_{s,y}`; penalties are excluded from `tax` by the result-type contract, and the comparison delta is handled by the separate comparison-cell identity. The domain is two finite, aligned or independently complete projection sequences.

## Inputs

| Side | Annual taxes | Annual penalties | Unit |
|---|---|---|---|
| Baseline | 12,000.00; 9,500.00; 8,000.00 | 300.00; 0.00; 1,200.00 | nominal dollars |
| Proposal | 11,000.00; 9,000.00; 7,750.00 | 0.00; 0.00; 250.00 | nominal dollars |

## Arithmetic

Baseline tax `=$29,500.00`; proposal tax `=$27,750.00`. Baseline penalties `=$1,500.00`; proposal penalties `=$250.00`.

## Expected

Tax comparison inputs are exactly baseline `$29,500.00` and proposal `$27,750.00`; penalty comparison inputs are exactly baseline `$1,500.00` and proposal `$250.00`, all with exact-cent tolerance because they are finite sums of cent amounts.

## Wrong readings

- Folding penalties into tax gives baseline tax `$31,000.00` and proposal tax `$28,000.00`.
- Subtracting proposal annual rows from baseline while aggregating produces tax `$1,750.00` and penalties `$1,250.00`, which are deltas rather than side totals.

## Family

outputs: `scenario-lifetime-tax`, `scenario-lifetime-penalties`.

feeds: `scenario-comparison-cell`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
