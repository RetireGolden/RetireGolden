## Claim

Kind: model. `decisions/search.ts#refineConversionSchedule` deterministically searches annual Roth-conversion dollars by fixed-order coordinate descent, first coarse then fine steps, retaining only hard-constraint-feasible moves whose exact-ledger primary metric improves by more than the minimum, subject to simulation and sweep caps.

## Justification

Coordinate descent is a local optimizer: changing one schedule year at a time makes a finite neighborhood searchable under a budget. It does not claim a global optimum, convexity, or that after-tax estate is the only appropriate objective.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Seed schedule | 2026: $0 | nominal dollars |
| Coarse/fine step | $10,000 / $2,500 | dollars |
| Minimum improvement | $1 | objective dollars |
| Independent exact-ledger score table | $0→100, $10k→130, $20k→125, $12.5k→135 | score units |

## Arithmetic

From `$0`, the `$10,000` move improves `100` to `130` by `30>1`, so retain it. `$20,000` scores 125 and is rejected. Fine move `$12,500` improves `130` to `135` by `5>1`, so retain it.

## Expected

Best conversion `$12,500`, improved `true`; selection is exact given the supplied score oracle.

## Wrong readings

- Accepting every nonnegative move ends at `$20,000` with score 125.
- Requiring improvement of at least the coarse step `$10,000` rejects all moves and stays at `$0`.

## Family

`optimizer-recommended-conversion-annual`, `optimizer-schedule-conversion-total` upstream.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
