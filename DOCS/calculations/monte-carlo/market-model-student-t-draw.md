## Claim

Kind: model. `montecarlo/marketModels.ts#createStudentTModel`, despite being named
`student-t`, samples a normal draw with a 5% tail-multiplier mixture rather than a
Student-t variate. `df` selects only the tail multiplier: `2.5` when `df > 4`, or
`3.5` otherwise after applying the floor `df = max(3, config.df ?? 5)`.

## Justification

Per decision `D-STUDENT-T-MIXTURE`, the return innovation is standard normal and
is multiplied on the strict branch `u < 0.05`. No t variate is sampled. The
mixture is not rescaled to the configured `sigma`, so its unconditional variance
exceeds `sigma^2`: it is
`sigma^2 * (0.95 + 0.05 * multiplier^2)`.

## Inputs

All three cases are one path year. Each uses `returnVolScalePct = 12`,
`inflationMeanPct = 0`, `inflationVolPct = 0`, `correlation = 0`, and a scripted
second normal draw `z2 = 0` (its value is immaterial because inflation volatility
is zero).

| Case | `df` | First normal `z` | Uniform `u` | Unit |
|---|---:|---:|---:|---|
| (a), no multiplier | 5 | 1 | 0.5 | raw draws |
| (b), 2.5 tail multiplier | 5 | 1 | 0.01 | raw draws |
| (c), 3.5 tail multiplier | 3 | 1 | 0.01 | raw draws |

## Arithmetic

In every case, `sigma = 12 / 100 = 0.12`, and the published shock is
`sigma * adjustedZ * 100` percent.

- (a): `u = 0.5` is not less than `0.05`, so `adjustedZ = 1` and
  `0.12 * 1 * 100 = 12` percent.
- (b): `u = 0.01 < 0.05` and `df = 5 > 4`, so `adjustedZ = 1 * 2.5` and
  `0.12 * 2.5 * 100 = 30` percent.
- (c): `u = 0.01 < 0.05` and `df = 3` is not greater than `4`, so
  `adjustedZ = 1 * 3.5` and `0.12 * 3.5 * 100 = 42` percent.

Inflation in each case is
`0 + 0 * (0 * adjustedZ + sqrt(1 - 0^2) * 0) = 0` percent.

## Expected

| Case | Return shock (%) | Inflation (%) | Tolerance |
|---|---:|---:|---|
| (a) | 12 | 0 | absolute `1e-12` |
| (b) | 30 | 0 | absolute `1e-12` |
| (c) | 42 | 0 | absolute `1e-12` |

## Wrong readings

- Treating the model as a scaled Student-t,
  `sigma * T * sqrt((df - 2) / df)`, gives
  `12 * sqrt(3 / 5) = 9.295160030897806` percent for case (a) with `T = 1`.
- Applying the multiplier when `u = 0.05` exactly gives `30` percent for the
  case-(a) parameters, but the branch is strict (`u < 0.05`), so the correct
  boundary result is `12` percent.
- Using multiplier `2.5` for `df = 3` gives `30` percent for case (c), instead
  of `42` percent.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`,
`monte-carlo-ending-investable-histogram`,
`monte-carlo-ending-after-tax-estate-percentiles`,
`monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment corrections) and the orchestrator's contract statements, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory (addendum).

Revision note: the first derivation lacked the normal-draw 5% tail-multiplier mixture and incorrectly derived a scaled Student-t model.
