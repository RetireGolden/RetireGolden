## Claim

Kind: composition. `scenarios/comparison.ts#scalar` publishes a finite numeric metric's baseline, proposal and delta in that metric's own units, with `delta=proposal-baseline` and no stated rounding.

## Justification

The type comment fixes the exact signed identity `d=p-b`; baseline and proposal are preserved rather than reordered by magnitude. This applies to finite scalar money, year, count and probability values, with the unit inherited from the compared metric.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Baseline | 120,000.00 | nominal dollars |
| Proposal | 95,000.00 | nominal dollars |

## Arithmetic

`delta=$95,000.00-$120,000.00=-$25,000.00`.

## Expected

Comparison is baseline `$120,000.00`, proposal `$95,000.00`, delta `-$25,000.00`, with exact-cent tolerance because the example uses exact cent amounts and one subtraction.

## Wrong readings

- Baseline minus proposal gives `+$25,000.00`.
- Dividing the difference by baseline reports `-20.8333333333%`, a relative change rather than the required same-unit delta.

## Family

outputs: `scenario-comparison-cell`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-slice-seven.md in this directory.
