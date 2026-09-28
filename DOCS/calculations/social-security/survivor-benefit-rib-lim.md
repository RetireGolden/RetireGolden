## Claim

Kind: composition. `socialSecurity/survivorBenefit.ts#survivorReductionFactor; #survivorBenefitMonthly` computes the monthly survivor benefit as the larger of the deceased's PIA and the deceased's actual benefit, multiplied by a linear widow(er) factor from 71.5% at age 60 to 100% at the survivor FRA, and then, only when the deceased was ever entitled to an old-age benefit reduced for an early claim, cut to the larger of the deceased's actual benefit and 82.5% of the deceased's PIA if it is greater than both.

Restated 2026-09-27 (decision D-SS-LAW-2, problem 2 of the B2-P1 slice 4 derivation, confirmed with a correction by its independent check): until then the helper took `max(actual, 0.825 × PIA)` first and reduced that for age, so the limit was reduced a second time.

## Justification

42 U.S.C. 402(e)(2)(A): the widow's benefit "shall be equal to the primary insurance amount (as determined for purposes of this subsection after application of subparagraphs (B) and (C)) of such deceased individual." Subparagraph (C) deems the PIA up to the old-age benefit the deceased was receiving when that is larger (delayed credits).

42 U.S.C. 402(e)(2)(D): "If the deceased individual ... was, at any time, entitled to an old-age insurance benefit which was reduced by reason of the application of subsection (q), the widow's insurance benefit ... for any month shall, if the amount of the widow's insurance benefit ... (as determined under subparagraph (A) and after application of subsection (q)) is greater than- (i) the amount of the old-age insurance benefit to which such deceased individual would have been entitled (after application of subsection (q)) for such month if such individual were still living ..., and (ii) 82½ percent of the primary insurance amount (as determined without regard to subparagraph (C)) of such deceased individual, be reduced to the amount referred to in clause (i), or (if greater) the amount referred to in clause (ii)."

SSA POMS RS 00615.320 A.1: "Consider the RIB LIM when the WIB is effective beginning 01/73 or later if the deceased NH was ever entitled to a reduced RIB or reduced DIB." A.3: "The RIB LIM will apply when the WIB after adjustment for the family maximum and reduction for age is more than BOTH 82 1/2 percent of the NH's death PIA and the RIB or DIB if they were alive."

So the order is the age reduction first, then the limit, and the limit exists only for a deceased who was paid a reduced benefit. With the widow(er) factor \(f\), the deceased's PIA \(P\) and actual benefit \(A\):

- ever reduced: \(W=\min(\max(P,A)\,f,\ \max(A,0.825P))\);
- otherwise: \(W=\max(P,A)\,f\).

The check's correction writes the ever-reduced branch with \(\max(P,A)\) rather than \(P\): subparagraph (C) deems the base up to a larger old-age benefit, while clause (ii) alone uses the PIA "without regard to subparagraph (C)". The two agree whenever \(A\le P\), which is every ever-reduced case the projection produces. The factor is \(1-0.285(1-(m-720)/(F-720))\) for \(720<m<F\), 0.715 at \(m\le720\) and 1 at \(m\ge F\), where \(m\) is the survivor's age in months and \(F\) the survivor FRA (usc-42-402-q-1-widow-survivor-early-reduction-schedule).

## Inputs

| Case | Deceased PIA | Deceased actual | Ever reduced | Survivor age | Survivor FRA |
|---|---:|---:|---|---|---|
| A (the check's switching case A) | 2,400 | 1,680 (claimed at 62, factor 0.70) | yes | 62y0m (744 months) | 67y0m (804) |
| A at FRA | 2,400 | 1,680 | yes | 67y0m (804) | 67y0m (804) |
| B (POMS RS 00615.320) | 2,000 | 1,400 | yes | 63y0m (756) | 66y0m (792) |
| C (this worksheet's first case) | 2,000 | 1,400 | yes | 60y0m (720) | 66y8m (800) |
| D (delayed credits) | 2,000 | 2,480 | no | 63y0m (756) | 66y0m (792) |

All amounts are dollars a month, before COLA and haircut. Constants are `WIDOW_LIMIT_PIA_FRACTION` (0.825), `SURVIVOR_EARLIEST_AGE` (60) and `SURVIVOR_MAX_REDUCTION` (0.285).

## Arithmetic

Case A: \(f=1-0.285\times60/84=0.796428571\). Reduced for age: \(\max(2400,1680)\times f=1{,}911.43\). The limit is \(\max(1680,\ 0.825\times2400=1980)=1{,}980\), and 1,911.43 is not greater than it, so the benefit is **$1,911.43**. The engine before the fix: \(1980\times f=\$1{,}576.93\).

Case A at FRA: \(f=1\); \(\min(2400,1980)=\$1{,}980\) (the limit binds). Unchanged by the fix.

Case B: \(f=1-0.285\times36/72=0.8575\); \(2000\times0.8575=1{,}715\), greater than both 1,400 and 1,650, so it is cut to **$1,650**. The engine before the fix: \(1650\times0.8575=\$1{,}414.875\).

Case C: \(f=0.715\); \(2000\times0.715=1{,}430\), below the 1,650 limit, so **$1,430**. The engine before the fix: \(1650\times0.715=\$1{,}179.75\).

Case D: never reduced, so no limit; \(\max(2000,2480)\times0.8575=\$2{,}126.60\). Unchanged by the fix.

## Expected

| Case | Before (engine to 2026-09-26) | After (statute) |
|---|---:|---:|
| A, survivor at 62 | 1,576.93 | **1,911.43** |
| A, survivor at FRA | 1,980.00 | **1,980.00** |
| B | 1,414.875 | **1,650.00** |
| C | 1,179.75 | **1,430.00** |
| D | 2,126.60 | **2,126.60** |

Exact figures: case A after 1,911.428571428571…, before 1,576.928571428571…; the widow factor at 62 is 0.796428571428…. Fixture tolerance: absolute $0.005 for dollars and cents computed in binary floating point, and 1e-12 for the factors.

## Wrong readings

- The limit taken first and reduced for age (the engine before 2026-09-27): case A 1,576.93, case B 1,414.875, case C 1,179.75.
- No limit at all: case A at FRA 2,400 rather than 1,980, and case B 1,715 rather than 1,650.
- The limit applied to a deceased who was never paid a reduced benefit: no difference in case D (the limit is below the base), which is why the flag is asserted separately with an actual benefit equal to the PIA (case B's inputs with an unreduced deceased pay 1,715).
- Using the worker FRA 67 instead of the survivor FRA changes every reduction between 60 and FRA (case B would use 804 months and give 2,000 × (1 − 0.285 × 48/84) = 1,674.29 before the limit).

## Family

outputs: none.

feeds: `social-security-benefit-annual`, `social-security-expected-present-value`, `social-security-survivor-switch-pv`.

## Provenance

The formula and case A are from the B2-P1 slice 4 derivation (problem 2) and its independent check (A2, with the correction to the general form), RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice4-derivation.md` and `b2p1-slice4-check.md`; the statute and POMS text are quoted from uscode.house.gov and secure.ssa.gov as saved by that check. Cases B, C and D and every figure above were recomputed by hand and by a script that does not import the engine. Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed.

Revision 2026-09-27 (B2-P1 slice 4): the benefits-only expected value and the survivor switching analysis, now engine models, price the widow(er) benefit with this helper, so the record feeds their families too. No value changes. Restated by claude (opus 5.5); not yet reviewed.
