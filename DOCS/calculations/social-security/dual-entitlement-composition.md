## Claim

Kind: composition. `socialSecurity/dualEntitlement.ts#spouseDualEntitlementMonthly` pays a person entitled to both an own old-age benefit and a spouse or divorced-spouse benefit `max(own, min(own, ownPia) + max(0, spouseBase − ownPia) × f)`: the own benefit plus the excess of half the worker's PIA over the own PIA, reduced by the spouse factor `f` for the claimant's age in the first month of the spouse benefit (`#spouseEntitlementAgeMonths`, `#spouseReductionFactorAtAgeMonths`). The ledger's current-spouse pass (`projection/internal/annualSocialSecurity.ts#annualSocialSecurity`, with the family maximum on the excess), the divorced-spouse menu (`socialSecurity/maritalBenefits.ts#maritalBenefitFor`) and the claim-milestone insight all use it.

New 2026-09-27 (decision D-SS-LAW-2, problem 3 of the B2-P1 slice 4 derivation, confirmed by its independent check). It replaces two records: `current-spouse-excess-poms-order`, which priced this composition only inside a narrow guard (simultaneous early claims, the worker filing no later than the claimant, one stream each, no disability, married filing jointly), and `current-spouse-excess-fallback`, the approximation every other couple got: `max(own, half × f)` with `f` at the claimant's own claim age. The divorced-spouse menu used the same maximum.

## Justification

42 U.S.C. 402(q)(3)(A): the rule applies "If the first month for which an individual both is entitled to a wife's, husband's, widow's, or widower's insurance benefit and has attained age 62 ... is a month for which such individual is also entitled to- (i) an old-age insurance benefit (to which such individual was first entitled for a month before he attains retirement age ...)".

42 U.S.C. 402(q)(3)(B): "such individual's wife's or husband's insurance benefit shall be reduced by the sum of- (i) the amount by which such old-age insurance benefit is reduced under paragraph (1) for such month, and (ii) the amount by which such wife's or husband's insurance benefit would be reduced under paragraph (1) for such month if it were equal to the excess of such wife's or husband's insurance benefit (before reduction under this subsection) over such old-age insurance benefit (before reduction under this subsection)."

42 U.S.C. 402(k)(3)(A): the other benefit, "after any reduction under subsection (q) ..., shall be reduced, but not below zero, by an amount equal to such old-age or disability insurance benefit (after reduction under such subsection (q))".

With the own PIA \(P\), its factor \(f_o\), the spouse base \(W\) (half the worker's PIA) and the spouse factor \(f_s\), the spouse benefit after (q)(3)(B) is \(W-(1-f_o)P-(1-f_s)(W-P)\), and after (k)(3)(A) the total is \(P f_o + (W-P) f_s\) whenever \(W>P\).

SSA POMS RS 00615.250: "first reduce the RIB PIA by the RIB reduction factor. Then subtract the RIB PIA from the unreduced spouse's benefit, and reduce the excess by the spouse's reduction factor." POMS RS 00615.694: "the combined payment amount is computed without consideration of the DRCs. The DRCs are then added to the RIB and that amount is subtracted from the combined payment amount". For an own benefit with delayed credits this pays the larger of that benefit and \(P+(W-P)f_s\). The check's one-line form, \(\max(A,\ \min(A,P)+\max(0,W-P)f_s)\) with \(A\) the own benefit as paid, covers both.

42 U.S.C. 402(q)(6)(A)(ii) starts the spouse reduction period with the first month a certificate is effective, which 402(q)(5)(C) deems filed in the first month of entitlement. Under 402(r)(1), as amended by Pub. L. 114-74 section 831(a) for people who attain 62 after 2015 (births from January 2, 1954), a person entitled to an own benefit who becomes eligible for a spouse benefit is deemed to apply for it in that month. So the spouse benefit starts in the later of the claimant's own claim month and the first month the worker's record supports it. For a current spouse that is the worker's configured claim month, under the plan's claim-age convention (the month the claim age is attained, the same convention that prices the worker's own benefit). For a divorced spouse whose ex need not have filed, SSA POMS RS 00202.005 B.2.a: "the NH must be 62 throughout the first month of entitlement but need not have filed a claim for benefits". A person attains 62 on the day before the 62nd birthday, so an ex born on the 1st or the 2nd is 62 throughout the birth month, and any other ex only from the month after it. The claimant's age then, \(s\), sets \(f_s\): \(1-(\min(36,F-s)\times25/36+\max(0,F-s-36)\times5/12)/100\) before the full retirement age \(F\), 1 after it. An age is attained on the day before the birthday.

## Inputs

Every ledger case: plan start 2026, no inflation, COLA factor 1, no benefit haircut, no tax, a large cash account; own claim at 62y0m; full retirement age 67 (804 months) for every claimant here.

| Case | Claimant | Worker or ex | Year priced |
|---|---|---|---|
| A (the derivation's C-B) | born 1964-03-10, PIA 800 | current spouse born 1964-08-20, PIA 2,400, claims at 70y0m | 2034 |
| B (the derivation's S-C) | single, born 1964-06-15, PIA 800 | divorced ex born 1966-02-10, PIA 2,000, married 12 years | 2028 |
| C (the check's Y1) | born 1965-04-12, PIA 700 | current spouse born 1963-11-02, PIA 2,200, claims at 65y0m | 2028 |
| D (the check's Z1) | single, born 1964-12-18, PIA 900 | divorced ex born 1967-05-25, PIA 2,400, married 15 years | 2029 |
| E (simultaneous early claims) | born 1964-01-02, PIA 800 | current spouse born 1964-01-02, PIA 4,000, claims at 62y0m | 2027 |
| F (helper) | PIA 1,000, own factor 13/15 (paid 866.67) | worker PIA 3,000, spouse factor 5/6 (24 months early) | |
| G (helper, delayed credits) | PIA 1,000, own factor 1.24 (paid 1,240) | worker PIA 3,000, spouse factor 1 | |
| H (helper, delayed credits above the combined amount) | PIA 1,000, own factor 1.24 (paid 1,240) | worker PIA 2,200, spouse factor 1 | |
| I (an ex born in December after the 2nd) | single, born 1964-06-15, PIA 800 | divorced ex born 1964-12-05, PIA 4,000, married 12 years | 2026 and 2027 |

## Arithmetic

Case A. Own 800 × 0.70 = 560. The husband attains 70 in August 2034; the claimant attains age 0 in March 1964, so she is \(845\) months old then, past her full retirement age: \(f_s=1\). Total \(560+(1200-800)\times1=\) **$960** a month, 11,520 a year; the household with his 2,400 × 1.24 × 12 = 35,712 is **$47,232** in 2034. Before: \(\max(560,\ 1200\times0.65)=780\), household \$45,072.

Case B. Own 560. The ex attains 62 on February 9, 2028, and is 62 throughout March 2028, when the claimant is \(765\) months old: 39 months early, \(f_s=1-(36\times25/36+3\times5/12)/100=0.7375\). Total \(560+(1000-800)\times0.7375=\) **$707.50** a month, **$8,490** in 2028 (the ledger pays the whole of the year the spouse benefit starts, its annual convention for a first year). Before: \(\max(560,\ 1000\times0.65)=650\), \$7,800.

Case C. Own 700 × 0.70 = 490. The husband claims at 65 in November 2028, when she is \(763\) months old: 41 months early, \(f_s=1-(25+5\times5/12)/100=0.729167\). Total \(490+400\times0.729167=\) **$781.67** a month, 9,380 a year; with his 2,200 × 0.866667 × 12 = 22,880, the household is **$32,260** in 2028. Before: \(\max(490,\ 1100\times0.65)=715\), household \$31,460.

Case D. Own 900 × 0.70 = 630. The ex attains 62 on May 24, 2029, and is 62 throughout June 2029, when the claimant is \(774\) months old: 30 months early, \(f_s=1-30\times25/36/100=0.791667\). Total \(630+(1200-900)\times0.791667=\) **$867.50** a month, **$10,410** in 2029. Before: \(\max(630,\ 1200\times0.65)=780\), \$9,360.

Case E. Both claim at 62 in January 2026, so \(s=744\) and \(f_s=0.65\). Total \(560+(2000-800)\times0.65=1{,}340\) a month, **$16,080** a year for her stream in 2027. The worker's family maximum for a 4,000 PIA (6,999.30 at the 2026 bend points) leaves 4,199.30 above his 2,800, so the 780 excess is not capped. This is the case the guarded helper priced; it does not change.

Case F. \(\max(866.67,\ 866.67+500\times5/6)=\) **$1,283.33**. The fallback gave \(\max(866.67,\ 1500\times5/6)=1{,}250\).

Case G. \(\max(1240,\ \min(1240,1000)+500\times1)=\) **$1,500**: the combined amount without the delayed credits exceeds the own benefit with them.

Case H. \(\max(1240,\ \min(1240,1000)+100\times1)=\) **$1,240**: the combined amount without the credits, 1,100, is below the own benefit with them, which is paid (POMS RS 00615.694 leaves no spouse benefit).

Case I. Own 560 from her claim in 2026. The ex attains 62 on December 4, 2026, and is first 62 throughout January 2027, so the divorced-spouse benefit starts in 2027, when she is \(751\) months old: 53 months early, \(f_s=1-(25+17\times5/12)/100=0.679167\). In 2026 the ledger pays only her own benefit, \(560\times12=\) **$6,720**; from 2027 the total \(560+(2000-800)\times0.679167=1{,}375\) a month, **$16,500** a year. Before: \(\max(560,\ 2000\times0.65)=1{,}300\), \$15,600 in both years.

## Expected

| Case | Before (engine to 2026-09-26) | After |
|---|---:|---:|
| A, 2034 household | 45,072.00 | **47,232.00** |
| A, 2034 claimant | 9,360.00 | **11,520.00** |
| B, 2028 | 7,800.00 | **8,490.00** |
| C, 2028 household | 31,460.00 | **32,260.00** |
| C, 2028 claimant | 8,580.00 | **9,380.00** |
| D, 2029 | 9,360.00 | **10,410.00** |
| E, 2027 claimant | 16,080.00 | **16,080.00** |
| F, monthly | 1,250.00 | **1,283.33** |
| G, monthly | 1,500.00 | **1,500.00** |
| H, monthly | 1,240.00 | **1,240.00** |
| I, 2026 | 15,600.00 | **6,720.00** |
| I, 2027 | 15,600.00 | **16,500.00** |

A, B, C, D, E and I are published amounts: `YearResult.incomes.socialSecurity` for a household, and the claimant's `socialSecurityStreams` row (`preWithholdingAnnual`) for a claimant. The spouse-start ages are exact integers: A 845, B 765, C 763, D 774, I 751. Exact: case B's factor is 0.7375, D's 0.791666…, F 3,850/3. Fixture tolerance: absolute $0.005.

## Wrong readings

- The larger of the own benefit and the reduced half, the engine's rule outside the guard and for every divorced spouse before 2026-09-27: A 9,360, B 7,800, C 8,580, D 9,360, F 1,250.
- The own benefit plus the excess reduced at the claimant's own claim age, ignoring when the spouse benefit starts: A 560 + 400 × 0.65 = 820 a month (9,840); B 560 + 200 × 0.65 = 690 (8,280).
- The retirement factor applied to the excess: E 560 + 1,200 × 0.70 = 1,400 a month.
- Adding the full delayed own benefit to the excess (ignoring POMS RS 00615.694): G 1,240 + 500 = 1,740.
- The combined amount without the outer comparison with the own benefit: H 1,100, below the 1,240 own benefit the claimant is paid anyway.
- The divorced spouse's benefit started in the month the ex attains 62 rather than the first month the ex is 62 throughout (this worksheet's first version, corrected 2026-09-27 on independent review): B 764 months, 706.67 a month (8,480); D 773 months, 865.42 (10,385).
- The divorced spouse's benefit paid for the whole of the calendar year the ex turns 62, before its first month (the ledger's gate until the review of RetireGolden #755): I 2026 16,500 rather than 6,720.

## Family

outputs: none.

feeds: `social-security-benefit-annual`, `social-security-expected-present-value`.

## Provenance

The composition, cases A and B and their before-figures are from the B2-P1 slice 4 derivation (problem 3) and its independent check (A3, cases C-B, S-C, Y1 and Z1, and its one-line POMS RS 00615.694 form), RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice4-derivation.md` and `b2p1-slice4-check.md`; the statute, POMS and Pub. L. 114-74 section 831 text are quoted as saved by that check. Case I is the review of RetireGolden #755's case (2026-09-27), its before-figures the engine at `4a80669e` and its intermediate reading the gate before that review, both run. Case E is the guarded case of `usc-42-402-q-3-B-k-3-A-current-spouse-dual-entitlement`, and F the case of the two retired worksheets. Every after-figure was recomputed by a script that does not import the engine, and the before-figures are the check's engine runs at RetireGolden `4a80669e`. Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed at the time; see the review below.

Revision 2026-09-27 (B2-P1 slice 4): the benefits-only expected value prices a couple's lower earner and a divorced spouse with this composition, so the record feeds its family too. No value changes.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-1-social-security.md`.
