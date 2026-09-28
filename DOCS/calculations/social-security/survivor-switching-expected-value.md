## Claim

Kind: model. `socialSecurity/analysis/survivorSwitching.ts` ranks, for a single household whose one claimant has a deceased or surviving-divorced former spouse, the ways to sequence a widow(er) benefit and the claimant's own benefit. `#survivorSwitchingInputs` picks, of the records that pass the ledger's modeled widow(er) gates, the one whose survivor benefit at the claimant's survivor full retirement age is largest (the first on a tie), with the deceased's benefit the PIA times the deceased's claim factor (the full retirement age when none is entered). `#expectedPvSwitch` values a strategy (survivor benefit from one whole-year age, own benefit from another, or either alone) as Σ over ages from the current age to 119 of S(age) × the larger claimed yearly benefit × scale(y) × (1 + r)^−(age − current age), with scale(y) the plan's COLA factor over its inflation factor times the haircut for the year y the age is reached (`analysis/expectedValue.ts#realBenefitScale`, the ranking's own; 1 when the COLA matches inflation and there is no haircut), the survivor benefit from the ledger's `survivorBenefitMonthly` (the deceased's PIA, or the actual benefit when it carried delayed credits, reduced for the survivor's age, then held to the widow's limit when the deceased claimed early) and S the engine's survival curve. `#rankSwitchStrategies` offers survivor ages {the current age (at least 60), the survivor full retirement age's year} and own ages {the current age (62 to 70), the full retirement age's year, 70}, every pairing and each benefit alone; strategies that pay the same yearly stream are one strategy, kept as the one with fewer claims and then the earlier ages, and equal values are ordered the same way. A claimant whose benefit is paid as a disability benefit from its onset gets no switching input, since no own claim age starts it. The page labels each strategy and prints the top five.

Restated 2026-09-27 (the slice's independent review, F13): the values now carry the plan's COLA drift and benefit cut, as the benefits-only ranking beside them does, so the three panels of the tab show the plan's dollars. Case A, whose COLA matches inflation with no cut, is unchanged; cases B and C are new, B for the drift and cut and for a widow of 60, C for a widow of 65 (the review's F16).

New 2026-09-27 (B2-P1 slice 4). Until then planner-ui's `socialSecurity/survivorSwitching.ts` priced the same streams, with its own survival curve, and printed strategies that pay the same benefits as different choices: in case A below, three rows at one value before the widow's-limit fix of the Social Security law change this slice sits on (D-SS-LAW-2), four after it, one of them a switch whose second benefit is never paid.

## Justification

42 U.S.C. 402(e)(2)(A), (C) and (D) and 20 CFR 404.338(c) give the widow(er) base and the limit after the age reduction; 20 CFR 404.410(c)(1) the reduction; 20 CFR 404.409(b) the survivor full retirement age; 402(k)(3)(A) pays the larger of the two benefits. The engine's record `usc-42-402-r-survivor-deemed-filing-exemption` quotes POMS GN 00204.035: "Deemed filing does not apply to survivor benefits ... The claimant may restrict the WIB application and delay filing for RIB", which makes the sequencing a real choice. Two strategies that pay the same benefit every year are the same choice, so printing both, or crowning a switch that never pays its second benefit, misleads; which of them to name is a presentation choice, so the rule is stated: fewer claims, then earlier ages.

## Inputs

Case A: a widow born 1964-06-15 (62 in 2026), female, own PIA 1,500 (full retirement age 67); her deceased spouse was born 1962-01-20, PIA 2,400, and claimed at 62y0m (factor 0.70, benefit 1,680, the limit's floor 0.825 × 2,400 = 1,980); a 2% real rate; the COLA matches 2.5% inflation, no haircut. Her survivor full retirement age is 67 (born 1964). Survivor ages {62, 67}, own ages {62, 67, 70}.

Case B: a widow born 1966-03-10 (60 in 2026), female, own PIA 1,200 (full retirement age 67); her deceased spouse was born 1963-08-01, PIA 2,000, and claimed at 67y0m, his full retirement age (factor 1, benefit 2,000, never reduced); a 2% real rate; a fixed 2% COLA against 2.5% inflation, and a 20% haircut from 2034. Survivor full retirement age 67. Survivor ages {60, 67}, own ages {62, 67, 70}.

Case C: a widow born 1961-02-10 (65 in 2026), female, own PIA 2,000 (full retirement age 67); her deceased spouse was born 1958-05-01, PIA 2,200, and claimed at 70 (full retirement age 66y8m, 40 months of credits at 2/3 percent: 2,786.67, never reduced); a 2% real rate; the COLA matches inflation, no haircut. Survivor full retirement age 66y10m (born 1961). Survivor ages {65, 66}, own ages {65, 67, 70}: none before the age she has reached.

## Arithmetic

Survivor at 62: the widow(er) factor is 1 − 0.285 × 60/84 = 0.796428571, so 2,400 × 0.796429 = 1,911.43, below the limit max(1,680, 1,980): 1,911.43. Survivor at 67: 2,400 at factor 1, held to 1,980. Own at 62, 67, 70: 1,050, 1,500, 1,860.

The survivor benefit at 62 exceeds every own amount, so "survivor at 62, then own at 62, 67 or 70" pays 1,911.43 every year, the same stream as "survivor only, at 62": one strategy, kept as survivor only. Likewise survivor at 67 (1,980) exceeds own at 67 and 70, so those pairings are "survivor only, at 67". "Own at 62, switch to survivor at 67" pays 1,050 for five years and then 1,980: a different stream, kept.

**B.** Survivor at 60: 2,000 × 0.715 = 1,430 (no limit: the deceased never took a reduced benefit); at 67: 2,000. Own at 62, 67, 70: 840, 1,200, 1,488. Each year's amount is multiplied by scale(y) = (1.02/1.025)^(y − 2026), times 0.8 from 2034: 0.995122 in 2027, 0.956945 × 0.8 = 0.765556 in 2035, the year she turns 69. Survivor at 60 then own at 62 or 67 is survivor at 60 alone (1,430 exceeds 840 and 1,200); survivor at 60 then own at 70 pays 1,430 to 69 and 1,488 from 70, a different stream. Without the drift and cut the switch from own at 62 to survivor at 67 ranks first (357,348.57 against 341,319.19); with them the later survivor years are worth less, and survivor at 60 then own at 70 ranks first.

**C.** Survivor at 65 (780 months against a survivor full retirement age of 802): 1 − 0.285 × 22/82 = 0.923537, so 2,786.67 × 0.923537 = 2,573.59; at 66 (792 months): 1 − 0.285 × 10/82 = 0.965244, 2,689.81. Own at 65, 67, 70: 2,000 × (1 − 24 × 5/900) = 1,733.33, 2,000, 2,480. Every survivor amount exceeds every own amount, so each pairing that starts with the survivor benefit is that survivor benefit alone, and own at 65 then survivor at 66 is kept. Own ages start at 65: a claim at 62 or 63 is in the past and is not offered.

## Expected

| Case: strategy | Expected PV |
|---|---:|
| A: Survivor only, at 62 | 423,379.4782211079 |
| A: Own at 62, switch to survivor at 67 | 385,837.9868067318 |
| A: Survivor only, at 67 | 326,304.123883093 |
| A: Own only, at 70 | 250,509.69318397678 |
| A: Own only, at 67 | 247,200.09385082786 |
| A: Own only, at 62 | 232,573.92861921855 |
| B: Survivor at 60, switch to own at 70 | 281,757.01279284194 |
| B: Own at 62, switch to survivor at 67 | 278,144.5787973238 |
| B: Survivor only, at 60 | 276,357.45142424677 |
| B: Survivor only, at 67 | 233,887.58233068977 |
| B: Own only, at 62 | 142,489.78104552373 |
| B: Own only, at 67 | 140,332.5493984139 |
| B: Own only, at 70 | 138,526.67787017403 |
| C: Own at 65, switch to survivor at 66 | 535,281.9217035525 |
| C: Survivor only, at 65 | 523,134.68603762885 |
| C: Survivor only, at 66 | 514,481.9217035524 |
| C: Own only, at 70 | 364,061.1173324963 |
| C: Own only, at 67 | 359,251.33765557106 |
| C: Own only, at 65 | 352,335.5608701224 |

Each case's rows are its whole ranking, in this order. Tolerance: 1e−12 relative. The survivor benefit at 62 in case A is 1,911.4285714285716 a month (1e−9 absolute). The retired page's top five, on the 2022 table: survivor at 62, switch to own at 70 ($379k); own at 62, switch to survivor at 67 ($377k); and three rows at $342k.

Revision 2026-09-27 (D-LIFE-TABLE-2023): the values are on SSA's published 2023 q(x) (`mortality-published-death-probability`); the order of every case is unchanged. On the 2022 table's identity case A was 414,887.98, 377,121.85, 317,678.29, 242,685.79, 240,665.37 and 227,909.32, case B 276,824.41 to 134,086.36 and case C 523,626.49 to 344,824.72. They are the slice review's independent model (`ssmodel.py`, importing nothing from the engine) with its q(x) replaced by SSA's published 2023 column and nothing else changed; run with its own 2022 q it reproduces every previous value to the last digit, and the D-LIFE-TABLE-2023 derivation's own model gives case A to within four units in the last place.

## Wrong readings

- The widow's limit before the age reduction (the engine before D-SS-LAW-2): 1,980 × 0.796429 = 1,576.93 at 62.
- No limit at all: 2,400 at 67 rather than 1,980.
- The deceased's PIA as the base, ignoring an early claim: 2,400 at 67.
- The worker full retirement age where the survivor's applies: the same for births from 1962, different for 1957 to 1961.
- Strategies with the same stream printed separately: four rows at $423k in case A.
- No COLA drift or haircut (the model before this restatement): case B ranks the switch from own at 62 to survivor at 67 first, at 357,348.57.
- Survivor ages from 62 whatever the widow's age: case B loses survivor at 60.
- Own ages from 62 whatever the widow's age: case C offers claims at 62 she can no longer make.

## Family

outputs: `social-security-survivor-switch-pv`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27, B2-P1 slice 4 derivation, worksheet `social-security-survivor-switch-pv.md` (survivor amounts by hand, values by its independent model); independently checked (C5; its correction 10 added the tie-break). Cases B and C: the slice review's findings F13 and F16, their values by the review's independent model (`ssmodel.py`, written from the statute and SSA's tables, importing nothing from the engine) with the drift and cut added, and their survivor and own amounts by hand above. Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed (the slice review, by the same model family as the author, does not count as the independent review).

Revision 2026-09-27 (D-LIFE-TABLE-2023): the survival-weighted values restated on SSA's published 2023 q(x) by claude (opus 5.5), with the slice review's independent model (`ssmodel.py`, which imports nothing from the engine) given SSA's 2023 column in place of its q(x) and 'average' as the mixture of the two sexes' curves, cross-checked against the D-LIFE-TABLE-2023 derivation's model and its independent check (both in RetireGolden-Docs, `calculations/bidirectional-validation-plan-2026-09-13/evidence/life-table-2023-derivation.md` and `calculations/bidirectional-validation-plan-2026-09-13/evidence/life-table-2023-check.md`, at commit `75e1cf87`) where they overlap; not yet reviewed.
