## Claim

Kind: model. `montecarlo/mortality.ts#sampleDeathAge` walks integer ages from the current age, compares one injected uniform draw per year with `q(x)`, and returns the last full age alive, deterministically for a fixed RNG stream.

## Justification

Inverse Bernoulli sampling declares death in the age-`x` interval when `U<q(x)` and otherwise advances. This uses period-table hazards as if applicable throughout the remaining lifetime and does not predict an individual's death.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Current age | 65 | integer age |
| Sex | male | category |
| Draw at age 65 | 0.5 | uniform probability |
| Draw at age 66 | 0.01 | uniform probability |
| `q65`, `q66` | 0.0179294389820704, 0.0192655027092113 | probability |

## Arithmetic

At 65, `0.5 >= q65`, so the person survives to 66. At 66, `0.01 < q66`, so death occurs before age 67 and the last full year alive is 66.

## Expected

Death age `66`, exact integer.

## Wrong readings

- Returning the next birthday gives `67` (off by one).
- Testing `U > q` as death would kill the path at age 65 because `0.5 > 0.0179`, returning `65`.

## Family

`monte-carlo-success-rate`, `monte-carlo-ending-investable-histogram`; none has a direct death-age field yet.

## Revision

2026-09-14: Corrected the wrong-reading rule so its stated comparison matches the numbers and the resulting wrong age 65.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory.
