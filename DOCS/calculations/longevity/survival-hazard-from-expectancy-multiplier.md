## Claim

Kind: model. `montecarlo/survival.ts#hazardForExpectancyMultiplier` returns exactly `1` for the multiplier `m = 1`, and otherwise selects by bisection a bounded positive hazard power `h` whose half-year-plus-survival-sum expectancy `E(h)` on the survival curve equals `m` times the curve's own expectancy at power 1, `E(1)`, when that target lies within the reach of the powers 0.2 to 8. For 'average' the curve is the 50/50 mixture of the two sexes, with one power for both halves.

Revision 2026-09-27 (decision D-LIFE-TABLE-2023): the target was `m` times SSA's printed baseline e(x), and m = 1 was bisected. With q read as published, the printed e no longer equals the curve's own expectancy, so the old target put the root away from 1 at every age (0.99508 to 1.00331 on the 2023 table) and moved a percentile pick at m = 1. The target is now the curve's own E(1), and m = 1 returns 1 exactly.

## Justification

Adjusted annual survival is `p^h`; increasing `h` lowers every nontrivial survival factor and therefore remaining expectancy monotonically, permitting bisection (for 'average', each sex's term falls, so the mixture's expectancy falls too). That needs a nontrivial factor: from age 119, the table's last age, the closed last row (q = 1) makes every survival factor 0, so `E(h) = 0.5` for every `h`, no power reaches `m × E(1) = 0.5m` for `m ≠ 1`, and the clamps return 8 for `m < 1` and 0.2 for `m > 1` (the engine gives 8 at m = 0.8 and 0.2 at m = 1.2 for a man of 119 or 125, with the expectancy still 0.5). A clamped result below 119 need not reach its target either: a man of 118 at m = 0.8 gets 8. The questionnaire's multiplier is a ratio: its central estimate is its baseline times `m` (`longevity/model.ts`). The power that carries it to the curve must make the adjusted curve's expectancy `m` times the unadjusted curve's, so the target is `m × E(1)`, and `h = 1` is then the exact root at `m = 1` whatever column the baseline comes from: `E(1) = 1 × E(1)`. The bisection cannot land on 1 (after 40 halvings of [0.2, 8] it returns the midpoint of an interval 7.8/2^40 wide), so `m = 1` returns the root directly. This calibrates a proportional-hazards model to a questionnaire multiplier; it does not validate the questionnaire factor or an individual's lifespan.

The printed e(x) the questionnaire shows differs from the curve's E(1): e is printed to two decimals, SSA's person-years within a year of age need not be exactly one half, and SSA's table continues past 119 while the engine closes it. At 65 a man's E(1) is 18.116335599472606 against the printed 18.12; the largest gap at the questionnaire's ages 18 to 110 is 0.00496 years (a man of 46), and at 110 it is −0.0045. The engine publishes that largest gap with the table (`longevity/ssaPeriodLifeTable.ts#CURVE_EXPECTANCY_GAP`, 0.004961383989225965), `longevity/curveExpectancyGap.test.ts` recomputes it from the columns, and the questionnaire's results card prints it rounded up to the thousandth ("at most 0.005 years").

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Ages | 18 to 110 (the identity); 65 (the non-identity case); 25 (the pick) | years |
| Sexes | male, female, 'average' | category |
| Multipliers `m` | 1; 0.8 | ratio |
| SSA printed baseline at 65, male | 18.12 | years |

## Arithmetic

**m = 1.** The power is 1 at every age from 18 to 110 and every sex: 279 points.

**m = 0.8 at 65.** Target = 0.8 × E(1): a man 0.8 × 18.116335599472606, a woman 0.8 × 20.6635926681499, 'average' 0.8 × 19.389964133811254 (the mean of the two). Bisecting [0.2, 8] for 40 halvings with E computed as the record states (each survival a left-to-right product of (1 − q)^h in doubles, the mixture the mean of the two, the sum stopped once a survival is at most 1e−12) gives h = 1.6380679198085089 for a man, 1.7644201878877537 for a woman and 1.7001583225654944 for 'average', which is not the mean of the two. At each solved power E(h)/E(1) − 0.8 is +3.6e−13, −4.1e−13 and −3.7e−13. Aiming at 0.8 × the printed 18.12 instead gives 1.637384881102935 for the man.

**m near 1 is not 1.** Only m = 1 exactly returns 1. A multiplier within 1e-3 of it, such as 0.9991 (a product of questionnaire factors such as 0.97 × 1.03), is bisected like any other: a man of 65 gets 1.0021382271476797.

**The pick at m = 1.** A woman of 25 reaches 95 with at least 10 percent chance and not 96, at power 1; the power the multiplier 1 maps to is 1, so the adjusted pick is 95. Aiming at the printed e(25) gave a power of 0.99953 and the pick 96.

These were computed in doubles by a script that imports nothing from the engine and follows the record's rule, on SSA's printed columns.

## Expected

| Case | Value |
|---|---:|
| Power at m = 1, every age 18 to 110 and sex | 1 |
| Male at 65, m = 0.8 | 1.6380679198085089 |
| Female at 65, m = 0.8 | 1.7644201878877537 |
| Average at 65, m = 0.8 | 1.7001583225654944 |
| Expectancy ratio at the solved power, m = 0.8 | 0.8 |
| Male E(1) at 65 | 18.116335599472606 |
| Male printed e(65) | 18.12 |
| Female of 25 at 10%, power for m = 1 | 95 |
| Male at 65, m = 0.9991 | 1.0021382271476797 |

Tolerance: the identity exactly (`=== 1`, not a tolerance); the solved powers 1e−9 absolute; the expectancy ratio 1e−9 absolute; E(1) 1e−12 relative; the printed e and the pick exact.

## Wrong readings

- The target m × the printed e(x): h(m = 1) is 0.9995201649005138 for a man of 65 (0.99508 to 1.00331 over the 279 points), and the woman of 25 at 10 percent gets 96; at m = 0.8 a man of 65 gets 1.637384881102935.
- A shortcut that returns 1 whenever m is within 1e-3 of 1: the man of 65 at m = 0.9991 gets 1 instead of 1.0021.
- Treating `m` itself as hazard would use `h=0.8` for `m=0.8`, which improves rather than worsens survival.
- Inverting the meaning (`h<1` is worse health) reverses every nonidentity case.

## Family

`longevity-survival-percentile-age` upstream.

## Revision

2026-09-14: Clarified that rounded SSA `e(x)` rows made the rebuilt identity and the `h=1` root approximate within the stated tolerances, not exact.

2026-09-27 (D-LIFE-TABLE-2023): the identity case (m = 1 at 65, male, baseline 17.48, h within 1e−6 of 1) is replaced by the exact identity at every point, the non-identity case at m = 0.8, and the pick at m = 1.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory.

Revision 2026-09-27: restated by claude (opus 5.5) from the D-LIFE-TABLE-2023 derivation (sections 5 and 8.3) and its independent check (F3: every figure reproduced bit for bit with the checker's own expectancy and the bisection rule) (both in RetireGolden-Docs, `calculations/bidirectional-validation-plan-2026-09-13/evidence/life-table-2023-derivation.md` and `calculations/bidirectional-validation-plan-2026-09-13/evidence/life-table-2023-check.md`, at commit `75e1cf87`); the values above were recomputed by the implementer's own script on the printed columns, importing nothing from the engine; not yet reviewed.

Revision 2026-09-29 (Codex review, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-3-longevity-ladders-taxes.md`): the strict decrease of `E` and the exact calibration to `m × E(1)` are stated only below age 119 and for a target the clamped powers reach; from 119 `E(h)` is 0.5 for every `h`, a limit of the record. No worked value changes. Revised by claude (opus 5.5); unreviewed until the reviewer checks the revision.

Reviewed by: Codex (GPT-6-Sol), 2026-09-30, targeted re-check after the fix, `DOCS/calculations/reviews/REVIEW-2026-09-30-recheck-codex.md`.
