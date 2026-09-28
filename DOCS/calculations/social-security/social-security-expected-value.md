## Claim

Kind: model. `socialSecurity/analysis/expectedValue.ts` publishes the survival-weighted, discounted present value of a person's or a couple's Social Security benefits under a claiming strategy, in the start year's dollars at a chosen real rate, with each year's benefits priced by the ledger's own rules:

- **Single** (`#expectedPvSingle`): for each year t from the start year while the person is at most 119, S(t) × monthly(t) × payable months(t) × scale(y) × (1 + r)^−t. monthly is the own benefit (the start-year PIA × the claim factor with its months), or a larger former-spouse benefit the ledger would pay that year (`socialSecurity/maritalBenefits.ts#bestMaritalBenefit`: a divorced spouse's own benefit plus the reduced excess, only for a single household and from the calendar year of the first month the ex is 62 throughout, the ledger's gate (the year the ex turns 62, or the next for an ex born in December after the 2nd); a widow(er) benefit on a deceased or surviving-divorced record). Payable months are the ledger's (`social-security-payable-months`).
- **Couple** (`#expectedPvCouple`): EV = Σ_t (1 + r)^−t scale(y) [S_A(t) S_B(t) both(t) + Σ_{k<t} S_A(t) D_B(k) alone_A(t, k) + Σ_{k<t} S_B(t) D_A(k) alone_B(t, k)], with D(k) the probability of dying in year k (alive through year k, the ledger's death convention), independent lives. While both are alive, the lower earner (by PIA; the second person on a tie, as the ledger) is paid the own benefit plus the reduced spouse excess for the months both are paid (`dual-entitlement-composition`, the excess reduced for the lower earner's age in the first month of the spouse benefit, the later of the two claims, and capped by the worker's family maximum as the ledger caps it). After a death in year k the survivor is paid, from the next year and once their own claim has started, the larger of the own benefit and the widow(er) benefit: on the deceased's claimed benefit if the deceased's claim year had come by the death, otherwise on the benefit for the month before a December death (`neverClaimedDeceasedFactor`); reduced for the survivor's age in the first month of widow(er) entitlement, the later of the survivor's own claim and January after the death (`survivor-reduction-entitlement-month`); then held to the widow's limit when the deceased claimed before full retirement age (`survivor-benefit-rib-lim`).
- **scale(y)** is the ledger's COLA factor over its inflation factor, times the haircut (`socialSecurity/colaFactor.ts`): exactly 1 when the COLA matches inflation and there is no haircut, so the value is in the start year's dollars; a fixed COLA below inflation or a haircut lowers later years.
- S is the engine's one survival curve (`montecarlo/survival.ts#survivalCurve`).

`#benefitsOnlyRanking` prices every whole-year claim-age combination (62 to 70, none before the age reached in the start year, 70 alone for someone past it) for the plan's one or two claimants, on the PIA the projection pays from, and ranks them highest first; a claimant whose benefit the ledger pays as a disability benefit from its onset is named and nothing is ranked.

New 2026-09-27 (B2-P1 slice 4, owner decision R7). Until then planner-ui's `socialSecurity/expectedPv.ts` paid a spouse the larger of the own reduced benefit and a reduced half of the other's PIA, a survivor the larger of the two claimed benefits with no age reduction, ignored claim months, priced a divorced spouse from the claim age whatever the ex's age, ignored widow(er) records and scaled nothing for COLA drift or a haircut; it kept its own copy of the survival curve.

## Justification

- Own benefit: 20 CFR 404.410(a), "The reduction is 5/9 of 1 percent for each of the first 36 months and 5/12 of 1 percent for each month in excess of 36", and 404.313(b)(2) for the delayed credits.
- Spouse or divorced spouse with an own benefit: 42 U.S.C. 402(q)(3)(B) reduces the spouse benefit "by the sum of- (i) the amount by which such old-age insurance benefit is reduced under paragraph (1) for such month, and (ii) the amount by which such wife's or husband's insurance benefit would be reduced under paragraph (1) for such month if it were equal to the excess", and 402(k)(3)(A) offsets the own benefit against it; the composition, its first month and its factor are the ledger's own record `dual-entitlement-composition`.
- Widow(er): 402(e)(2)(A) and (C) set the base, 402(q)(6)(A)(iii) starts the reduction period "with the first day of the first month for which such individual is entitled to such benefit or the first day of the month in which such individual attains age 60, whichever is the later", 20 CFR 404.410(c)(1) gives the reduction, and 402(e)(2)(D) applies the widow's limit after it (`survivor-benefit-rib-lim`, `survivor-reduction-entitlement-month`). A worker who died before claiming passes on the old-age benefit "which he was receiving (or would upon application have received) for the month prior to the month in which he died" (402(e)(2)(C)).
- The expectation over death years is exact for independent lives: P(A alive at t, B died in year k) = S_A(t) S_B(k) q_B(x_B + k), and Σ_{k<t} S_B(k) q_B = 1 − S_B(t). The derivation checked the couple formula against a direct simulation of 400,000 paired lives; the independent check repeated that with its own code (z of 0.04 and −0.04).
- The family maximum cannot bind with one auxiliary under 20 CFR 404.404, which counts the worker's PIA against it: the maximum is at least 150% of the worker's PIA (42 U.S.C. 403(a)(1)) and the spouse's excess is at most 50%. The model calls the ledger's own `socialSecurity/familyMaximum.ts#currentSpouseMonthlyUnderFamilyMaximum`, which holds half the worker's PIA to the maximum less that PIA before the dual-entitlement reduction (20 CFR 404.410(b)); the ledger counted the worker's benefit with delayed credits until RetireGolden #756 (D-FAMILY-MAX-PIA), where it could bind with one spouse (case C-E).

## Inputs

Every case starts in 2026 at a 2% real rate, with the COLA matching 2.5% inflation and no haircut unless stated.

| Case | People | Claim |
|---|---|---|
| S-A | female 1963-06-15 (63), PIA 1,850 (the guardrails-flex-goals plan's person) | 67y0m |
| S-B | as S-A | 67y6m |
| S-C | female 1964-06-15 (62), PIA 800, single; divorced ex born 1966-02-10, PIA 2,000, married 12 years | 62y0m |
| S-D | as S-A, fixed COLA 2%, inflation 2.5%, haircut 17% from 2034 | 67y0m |
| S-E | male 1909-03-03 (117), PIA 1,000 | 70y0m |
| C-A | L female 1964-06-15 (62), PIA 800; H male 1964-02-10 (62), PIA 2,000 | both 62y0m |
| C-B | L female 1964-03-10 (62), PIA 800; H male 1964-08-20 (62), PIA 2,400 | L 62y0m, H 70y0m |
| C-C | W female 1962-06-15 (64), PIA 1,000; H male 1960-06-15 (66), PIA 3,000 (the survivor-years plan's people) | W 67y0m, H 70y0m |
| C-D | W female 1959-03-10 (67), PIA 500; H male 1964-02-10 (62), PIA 2,000 | W 67y0m, H 62y0m |
| C-E | W female 1964-06-15 (62), PIA 100; H male 1964-01-15 (62), PIA 1,000 | W 67y0m, H 70y0m |

## Arithmetic

Factors for births in 1964 (full retirement age 67, 804 months): own at 62 = 0.70; spouse at 62 = 1 − (36 × 25/36 + 24 × 5/12)/100 = 0.65; widow(er) at m months = 1 − 0.285 × (804 − m)/84.

**S-E (closed form).** Born 1909: full retirement age 65, a credit of 1/12% a month, so 70 pays 1.05: 12,600 a year. q(117) = 1 − (0.59 − 0.5)/(0.54 + 0.5), q(118) = 1 − 0.04/1.00, q(119) = 1. EV = 12,600 × [1 + 0.0865385/1.02 + 0.0865385 × 0.04/1.0404] = 12,600 × 1.0881687 = 13,710.93.

**S-A.** 22,200 a year from 67 (t = 4); the first term is S(63 → 67) = 0.95803 × 22,200 / 1.02^4 = 19,648.6. The retired model gives the same value to 1 part in 10^15 (no rule differs for a single person with no records and a whole-year claim).

**S-B (months).** 67y6m is six months past full retirement age: factor 1.04 and six payable months in 2030; the retired model priced 67y0m.

**S-C (divorced).** 2026-2027: own 560 (the ledger's gate: the ex is under 62 in those calendar years). The ex attains 62 on February 9, 2028 and is 62 throughout March 2028, when the claimant is 765 months old: 39 months early, spouse factor 1 − (36 × 25/36 + 3 × 5/12)/100 = 0.7375. From 2028: 560 + (1,000 − 800) × 0.7375 = 707.50 a month (the retired model: 0.5 × 2,000 × 0.65 = 650 from 2026).

**C-A (the R7 case).** Both alive: L = 560 + 200 × 0.65 = 690 a month (the retired model 650); 2026 pays 12 × (1,400 + 690) = 25,080. If H dies in December 2026, L's widow(er) benefit starts in January 2027, when she is 751 months old: factor 1 − 0.285 × 53/84 = 0.8201786; 2,000 × 0.8201786 = 1,640.36, below the limit max(1,400, 1,650), so 1,640.36 a month from 2027 (the retired model: max(560, 1,400) = 1,400).

**C-B (staggered).** H claims at 70 in August 2034, when L is 845 months old, past her full retirement age: L = 560 + (1,200 − 800) = 960 a month from 2034 (the retired model and the ledger's old fallback: max(560, 1,200 × 0.65) = 780).

**C-D (a death in the claim year).** H claims at 62 in 2026, reduced to 1,400. If he dies in December 2026, his claim year, he had claimed, so W's widow(er) benefit is on his reduced benefit: in January 2027 she is 814 months old, past her survivor full retirement age (66y6m for 1959), so the factor is 1 and 2,000 is held to the widow's limit max(1,400, 1,650) = 1,650. Read as a death before claiming, it would be 2,000 with no limit.

**C-E (the family maximum, 20 CFR 404.404).** H's PIA of 1,000 is below the first family-maximum bend point, so his family maximum is 150%, 1,500. W's spouse excess at her full retirement age is 0.5 × 1,000 − 100 = 400. Counting his PIA, the room is 1,500 − 1,000 = 500 and she is paid the full 400; the ledger counts his benefit at 70, 1,240, leaving 260. The value below is the rule's, 400 paid (the model of the review, which applies no cap, since 400 is within the room), and the engine's since #756; before it the engine gave 229,976.29.

**C-C (never claimed).** If H dies at 68 in December 2028 before claiming, W is paid from 2029 on 3,000 × (1 + 18 × 2/3 %) = 3,360; her widow(er) benefit starts with her own claim at 67 (June 2029, 804 months), so it is unreduced. The retired model paid her own 1,000 until H "would have" turned 70 and then 3,720.

## Expected

| Case | Expected PV | Retired model |
|---|---:|---:|
| S-A | 305,509.37844887906 | 305,509.378448879 |
| S-B | 307,512.4908247772 | 305,509.378448879 |
| S-C | 150,077.80870016152 | 141,086.72112983052 |
| S-D | 249,651.06224728294 | |
| S-E | 13,710.926270960872 | 13,710.926270960872 |
| C-A | 474,876.9339831568 | 454,498.8463629754 |
| C-B | 598,954.9039081854 | 589,214.1122231962 |
| C-C | 846,822.0328072809 | 851,441.5365267406 |
| C-D | 483,390.3677212512 | |
| C-E (20 CFR 404.404) | 241,079.31700373453 | |
| C-D widow monthly, death 2026 | 1,650 | |
| C-A 2026 benefits | 25,080 | 24,600 |
| C-A widow monthly, death 2026 | 1,640.357142857143 | 1,400 |
| S-C monthly from 2028 | 707.5 | 650 |
| C-B lower earner monthly from 2034 | 960 | 780 |
| C-C survivor base monthly, death 2028 | 3,360.0000000000005 | 3,720 |

Tolerance: 1e−12 relative on the present values, 1e−9 absolute on the monthly and yearly amounts.

The derivation's values for S-C, C-A and C-B (149,916.64, 474,856.84 and 598,835.28) used the month of death, December, as the widow(er) benefit's first month and the month the ex attains 62 as a divorced spouse's; the Social Security law change the slice sits on settled both on review (D-SS-LAW-2): January after the death, the first month the ledger pays, and the first month the ex is 62 throughout (POMS RS 00202.005 B.2.a). The values above are the derivation's independent model with those two conventions and nothing else changed (the model imports nothing from the engine); the engine's output equals them to two units in the last place.

## Wrong readings

- The larger of the own reduced benefit and the reduced half, for an early claimer (C-A 650, C-B 780).
- The spouse factor at the lower earner's own claim age when the worker files later (C-B 780 against 960).
- The widow(er) reduction at the survivor's own claim age: C-A 1,650 × 0.796429 = 1,314.11 or, with the limit after the reduction, 1,592.86, against 1,640.36.
- The widow's limit before the age reduction: 1,650 × 0.8201786 = 1,353.29 in C-A's 2026-death branch.
- The survivor paid the deceased's claimed benefit with credits never earned, from the age the deceased would have claimed (C-C).
- A divorced-spouse benefit before the ex is 62 (S-C 650 in 2026-2027).
- A death in the claim year read as a death before claiming: C-D's widow(er) benefit 2,000 with no limit, against 1,650.
- The family maximum's room net of the worker's benefit with delayed credits rather than his PIA: C-E 260 of the 400 excess paid (the ledger before #756), 229,976.29.
- Survival as a ratio of products from age 0 with rounded ages: equal at integer ages to float error, different at fractional ones.

## Family

outputs: `social-security-expected-present-value`.

feeds: `social-security-fica-return-ratio`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27, B2-P1 slice 4 derivation, worksheet `social-security-expected-present-value.md` (S-E and the C-A pieces by hand, totals by its independent model, the couple formula by direct simulation); independently checked (the check's C2: every value reproduced to 1e−15 by its own model, and by its own simulation). The three values the base's review conventions move were recomputed by the derivation's model with those conventions (`C:/rgwt/staging/b2p1-s4/impl/model/run-base.mjs`). Cases C-D and C-E are the slice review's (F16's EV5 and F3), their values by the review's independent model (`ssmodel.py`, January start; it imports nothing from the engine). Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed.
