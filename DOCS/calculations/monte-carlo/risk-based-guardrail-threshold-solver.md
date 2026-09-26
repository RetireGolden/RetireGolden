## Claim

Kind: model. `montecarlo/riskBasedGuardrails.ts#solveRiskBasedGuardrails` finds, for each edge of the plan's success band, the portfolio level where fixed-target success meets that edge, and the spending change that brings success back to the middle of the band there.

Let `S(f, m)` be the success rate of the plan with fixed target spending, every investable balance scaled by `f` and target spending by `m`, on shared seeded Monte Carlo paths. When the optional `successProbe(f, m)` is given (D-SOLVER-SEAM, decided 2026-09-25), its value replaces each of those runs; it must return a finite number from 0 to 1, and any other value is refused with a RangeError. Without a probe the solver is unchanged.

- Band `L/U` percent (the plan's policy, else 70/95); recovery target `(L + U)/200`.
- For each edge `p`: if `S(0.02, 1) >= p` the outcome is `always-above-band`; if `S(4, 1) < p` it is `never-reaches-band`; otherwise ten bisections on `[0.02, 4]` move `hi` to the midpoint when `S(mid, 1) >= p` and `lo` otherwise, and the solved `balanceFrac` is `hi`. `balanceDollars = balanceFrac x starting investable`; `successAtThreshold = S(balanceFrac, 1)`.
- At a solved lower edge `f_L`, the suggested cut evaluates the best case `S(f_L, m_min)` with `m_min = max(0.3, required/base)`; if it is below the recovery target there is no cut. Otherwise eight bisections on `[m_min, 1]` move `lo` when `S(f_L, mid) >= target`, and the cut is `m = lo`. At a solved upper edge the raise evaluates `S(f_U, 2)`; if it is above the target the raise is reported at `m = 2`; otherwise eight bisections on `[1, 2]` do the same. `annualDollars = |1 - m| x base`, `monthlyDollars = annualDollars / 12`, `successAfter = S(f, m)`.
- Successes at a balance scale are cached by `round(f x 1e6)`; the spending phase is not cached.

## Justification

On shared seeded paths, success is nondecreasing in the balance scale and nonincreasing in spending, so each band edge is a single crossing and bisection finds it. The analytic curve `S(f, m) = min(1, f/(2m))` has both properties, so it can stand in for the Monte Carlo and every solver output can be derived by hand.

**Balance lattice.** The bracket width is `4 - 0.02 = 3.98`. Ten halvings give step `h = 3.98/1024 = 0.00388671875`, and every midpoint and every returned edge is `0.02 + k h`. The end classification requires `S(0.02) < p <= S(4)`, so the returned `hi` has `k` in `{1, ..., 1024}`: `k = 1024` is reached when `S(mid) < p` at every midpoint, so that `hi` stays at 4. Because the edge is the smallest lattice point meeting the target, `k = ceil((f* - 0.02)/h)`, where `f*` is the smallest `f` with `S(f, 1) >= p` (for a strictly increasing `S` that does not cross exactly on a lattice point).

**Spending lattices.** The cut bisects `[0.3, 1]` eight times, step `0.7/256 = 0.002734375`, points `0.3 + j 0.7/256`. The raise bisects `[1, 2]`, points `1 + j/256`. The returned `lo` is the largest lattice point with `S >= target`.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| `successProbe` | `S(f, m) = min(1, f/(2m))` | success rate |
| Plan | one taxable account of $500,000, no required spending | plan |
| Base annual spending | 40,000 | today's dollars |
| Lower/upper band | 70 / 95 | percent success |
| Recovery target | (70 + 95)/2/100 = 0.825 | success rate |
| Search bracket | 0.02 / 4 | fraction of starting investable |
| Balance and spending bisections | 10 and 8 | iterations |

## Arithmetic

**successAtCurrent** `= S(1, 1) = 0.5`.

**Lower edge (70%).** `f* = 1.4`, and `(1.4 - 0.02)(1024/3.98) = 355.0553`, so `k = 356`. Bisection path in `k`:

| Mid k | S >= 0.70 | Moves |
|---:|---|---|
| 512 | yes | hi |
| 256 | no | lo |
| 384 | yes | hi |
| 320 | no | lo |
| 352 | no | lo |
| 368 | yes | hi |
| 360 | yes | hi |
| 356 | yes | hi |
| 354 | no | lo |
| 355 | no | lo |

It ends at `lo = 355`, `hi = 356`. The edge is `0.02 + 356 h = 1.403671875` (as a double `1.4036718749999997`, because 0.02 is not a binary fraction). `balanceDollars = 1.403671875 x 500,000 = $701,835.9375`; `successAtThreshold = 1.403671875 / 2 = 0.7018359375`.

**Upper edge (95%).** `f* = 1.9`, and `(1.9 - 0.02)(1024/3.98) = 483.7035`, so `k = 484`. Path in `k`: 512 yes (cached), 256 no (cached), 384 no (cached), then 448 no, 480 no, 496 yes, 488 yes, 484 yes, 482 no, 483 no. It ends at `lo = 483`, `hi = 484`. The edge is `1.901171875`; `balanceDollars = $950,585.9375`; `successAtThreshold = 0.9505859375`.

**Suggested cut.** Best case `S(1.403671875, 0.3) = 1 >= 0.825`, so the solve proceeds. `S(f_L, m) >= 0.825` exactly when `m <= f_L/1.65 = 0.8507102272727...`, that is `j <= 201.40`. Mids in `j`: 128 yes, 192 yes, 224 no, 208 no, 200 yes, 204 no, 202 no, 201 yes. The cut is `m = 0.3 + 201 (0.7/256) = 0.849609375` (exact in doubles). `annualDollars = 0.150390625 x 40,000 = $6,015.625`; `monthlyDollars = $501.3020833333333`; `successAfter = 1.403671875 / 1.69921875 = 0.8260689655172412`.

**Suggested raise.** Best case `S(1.901171875, 2) = 0.4753`, not above 0.825, so the solve bisects. `m <= f_U/1.65 = 1.1522253787878...`, so `j <= 38.97`. Mids in `j`: 128 no, 64 no, 32 yes, 48 no, 40 no, 36 yes, 38 yes, 39 no. The raise is `m = 1 + 38/256 = 1.1484375` (exact). `annualDollars = $5,937.50`; `monthlyDollars = $494.7916666666667`; `successAfter = 1.901171875 / 2.296875 = 0.8277210884353741`.

**Probe calls.**

| Phase | Calls | Detail |
|---|---:|---|
| successAtCurrent | 1 | `f = 1` |
| Lower edge | 12 | the ends 0.02 and 4, then 10 mids; `S(hi)` is cached |
| Upper edge | 7 | the new mids 448, 480, 496, 488, 484, 482, 483; the ends and 512, 256, 384 are cached |
| Cut | 10 | best case, 8 mids, successAfter |
| Raise | 10 | the same shape |
| **Total** | **40** | 20 distinct balance fractions |

`onProbeDone` is last called with `(40, 41)`, because its total of 41 counts no cache hits.

The planner persists `round(balanceFrac x 10000)/100`, 140.37 and 190.12 percent; the callouts then print `1.4037 x 500,000 = $701,850` and `$950,600`, $14.06 away from `balanceDollars`. That rounding is why the printed callout is a different census family (`display-guardrail-balance-thresholds`).

**Degenerate probes.** A constant 0.99 gives `always-above-band` on both edges, both thresholds null and both adjustments null. `min(1, f/10)` gives `never-reaches-band` on both edges. A probe returning 1.5, -0.1 or NaN is refused on its first call, at `balanceFrac 1`, `spendingMultiplier 1`.

## Expected

- Edges at lattice indices `k = 356` and `484`: `balanceFrac` `1.403671875` and `1.901171875` (absolute tolerance `1e-12`), `balanceDollars` `$701,835.9375` and `$950,585.9375` (absolute tolerance `1e-6`).
- `successAtCurrent = 0.5`.
- Cut `m = 0.849609375`, `$6,015.625` a year, `$501.3020833333333` a month, `successAfter = 0.8260689655172412`.
- Raise `m = 1.1484375`, `$5,937.50` a year, `$494.7916666666667` a month, `successAfter = 0.8277210884353741`.
- 40 probe calls in the order above; progress ends at `(40, 41)`.
- The degenerate outcomes and the refusal `RangeError: successProbe returned <value> at balanceFrac 1, spendingMultiplier 1; a success probability must be a finite number from 0 to 1.`

With the real Monte Carlo and one path, `S` is 0 or 1, so the 70% and 95% tests are the same test and both edges return the same `k`. That remains a stated property, not an example.

## Wrong readings

- Returning `lo` instead of `hi` gives the lattice point just below the edge: `1.3997851562499997` (`k = 355`) and `1.8972851562499997` (`k = 483`).
- Using step `4/1024` forgets the lower end of the bracket: at `k = 1` the correct point is `0.02388671875`, not `0.02 + 4/1024 = 0.02390625`.
- Limiting `k` to 1 through 1023 misses the case where every midpoint fails and `hi` stays at 4 (`k = 1024`).
- Treating the curve's crossings 1.4 and 1.9 as the solver's outputs ignores the lattice: the solver returns `1.403671875` and `1.901171875`.

## Family

Outputs: `risk-based-guardrail-solved-balance-thresholds` (the solved `balanceFrac`) and `risk-based-guardrail-suggested-adjustment-monthly` (the suggested cut or raise per month). Feeds: `display-guardrail-balance-thresholds` (the callouts print the persisted percent of today's investable) and `spending-guardrail-factor-annual` (the persisted percents drive the projection's guardrail rule).

## Limits

- Monotonicity is assumed, not checked; a probe that is not monotone yields a lattice point but not a meaningful edge.
- The Spending card always solves under the headline lognormal model (12 percent volatility, 60/40) with 200 paths and the plan-id seed, whatever model the Monte Carlo page shows.
- The cache key `round(f x 1e6)` would merge two fractions closer than 5e-7; the lattice step is 3.9e-3, so it cannot bite on the lattice.
- The spending phase is uncached: `successAfter` re-evaluates a multiplier the bisection has usually tried already (it has in both adjustments above, and their 10 calls include that repeat).

## Provenance

Derived by: claude (Opus 5.5), 2026-09-25/26, from origin/main `aeb2861a` (the Monte Carlo derivation for the decisions of 2026-09-25, section 4). Every number was computed twice, by a replica of the stated contract that imports no engine code and by a reference implementation, and the two probe-call sequences are identical. An independent checker reproduced every headline number. Reviewed by: not yet reviewed as a record.

Revision: the first derivation (codex, 2026-09-18, reviewed by cursor) could not evidence the edges because the solver took no success rule; it stated the lattice with `k` from 1 through 1023, which is corrected here to 1 through 1024. D-SOLVER-SEAM (decided 2026-09-25) added the optional `successProbe` and the two census families, so the edges and the adjustments are now evidenced against the analytic curve.
