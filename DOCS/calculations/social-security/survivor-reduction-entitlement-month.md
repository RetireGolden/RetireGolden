## Claim

Kind: composition. `projection/internal/annualSocialSecurity.ts#annualSocialSecurity` reduces a current spouse's widow(er) benefit at the survivor's age in the first month of widow(er) entitlement, `socialSecurity/survivorBenefit.ts#widowEntitlementAgeMonths`: the later of the survivor's own configured claim age and the survivor's age in January of the year after the worker died, the first month the ledger pays the survivor (`socialSecurity/nra.ts#attainedAgeMonthsInMonth`). From the year the survivor reaches the survivor full retirement age, only months in which the widow(er) benefit itself was withheld under the earnings test are credited back.

New 2026-09-27 (decision D-SS-LAW-2, problem 1 of the B2-P1 slice 4 derivation, confirmed by its independent check). Until then the ledger reduced the widow(er) benefit at the survivor's own claim age, and credited every month ever withheld from the survivor, including months of her own benefit before the death. Restated the same day on independent review: the first version reduced from December of the death year, a month the ledger never pays.

## Justification

42 U.S.C. 402(q)(1): the reduction applies "if the first month for which an individual is entitled to an old-age, wife's, husband's, widow's, or widower's insurance benefit is a month before the month in which such individual attains retirement age".

42 U.S.C. 402(q)(6)(A)(iii): the reduction period begins, "in the case of a widow's or widower's insurance benefit, with the first day of the first month for which such individual is entitled to such benefit or the first day of the month in which such individual attains age 60, whichever is the later".

42 U.S.C. 402(q)(3)(E): "if the first month for which an individual is entitled to a widow's or widower's insurance benefit is a month for which such individual is also entitled to an old-age insurance benefit to which such individual was first entitled for that month or for a month before she or he became entitled to a widow's or widower's benefit, the reduction in such widow's or widower's insurance benefit shall be determined under paragraph (1)." An own benefit claimed earlier keeps its own reduction; it does not lend its months to the widow(er) benefit.

20 CFR 404.410(c)(1): "The number of months of entitlement prior to full retirement age is multiplied by .285 and then divided by the number of months in the period beginning with the month of attainment of age 60 and ending with the month immediately before the month of attainment of full retirement age."

20 CFR 404.621(a)(4)(ii): a widow(er) of an insured person "who died in the month before you applied and you were at least age 60 in the month of death ... can be entitled beginning with the month the insured person died if you choose". The month of death is a lawful first month of entitlement, at the widow(er)'s choice; the month after it, a normal month of application, is equally lawful.

42 U.S.C. 402(q)(7)(A): the adjusted reduction period for a benefit excludes "any month in which such benefit was subject to deductions". Months withheld from the survivor's own benefit before the death were not months of the widow(er) benefit.

The plan states a life age, not a date of death, and keeps the worker alive through the whole year he attains it, so December of that year is the ledger's month of death (the convention of `usc-42-402-e-survivor-of-worker-who-died-before-claiming`), and the ledger first pays the survivor in January of the next year. Reducing from December would count one month of reduction that buys no payment, so the ledger takes January, the first month it pays, as the first month of entitlement. The plan's one claim age pays the survivor benefit no earlier than the survivor's own claim. So the survivor's age at the first month of entitlement is

\(e=\max(c,\ a_{\text{Jan}})\),

where \(c\) is the configured own claim age in months and \(a_{\text{Jan}}\) is the survivor's age in months in January of the year after the death, counting an age as attained on the day before the birthday. From the year the survivor reaches the survivor FRA \(F\), \(m=\min(F,\ e+w)\) with \(w\) the widow(er) months withheld; before it, \(m=e\). The widow(er) factor is survivor-benefit-rib-lim's, at \(m\).

## Inputs

Every case: plan start 2026, no inflation, COLA factor 1, no benefit haircut, no tax, a large cash account, and a married couple filing jointly. Survivor FRA 67 (804 months) for each survivor here (births 1962 and 1964).

| Case | Survivor | Worker | Worker's life age (year of death) | Wages |
|---|---|---|---|---|
| A (the derivation's couple case A) | born 1964-06-15, PIA 800, own claim 62y0m (744) | born 1964-02-10, PIA 2,000, claimed 62y0m (paid 1,400) | 64 (2028) | none |
| B (the check's case X1) | born 1962-09-20, PIA 1,200, own claim 62y0m (744) | born 1961-03-05, PIA 2,600, claimed 63y0m (factor 0.75, paid 1,950) | 65 (2026) | none |
| C (the check's case X2) | as B, own claim 66y0m (792) | as B | 65 (2026) | none |
| D | as B, own claim 62y0m | born 1961-03-05, PIA 2,600, claim age 67y0m, so he dies unclaimed | 65 (2026) | survivor, $40,000 in 2026 only |
| E | as D | as D | 65 (2026) | survivor, $40,000 in 2026 and 2027 |

## Arithmetic

Case A. The survivor attains age 0 in June 1964 (index \(1964\times12+5\)); January 2029 is \(2029\times12+0\), so \(a_{\text{Jan}}=775\) and \(e=\max(744,775)=775\). Factor \(1-0.285\times29/84=0.901607\). The widow's amount after the age reduction is \(2000\times0.901607=1{,}803.21\), above both 1,400 and \(0.825\times2000=1{,}650\), so the limit of 42 U.S.C. 402(e)(2)(D) holds it at 1,650: **$19,800** in 2029. Before the fix: \(1650\times0.796429\times12=\$15{,}769.29\) (the limit reduced at her own claim age, 744 months). With only this record's fix and the old order of the limit: \(1650\times0.901607\times12=\$17{,}851.82\); with only the order fixed: \(\min(2000\times0.796429,1650)\times12=\$19{,}114.29\).

Case B. \(a_{\text{Jan}}\) for January 2027 is 772, \(e=772\), factor \(1-0.285\times32/84=0.891429\); \(2600\times0.891429=2{,}317.71\), above both 1,950 and 2,145, so 2,145: **$25,740** in 2027. Before: \(2145\times0.796429\times12=\$20{,}500.07\); this fix alone \(2145\times0.891429\times12=\$22{,}945.37\); the order alone \(2600\times0.796429=2{,}070.71\), below the 2,145 limit, so \(2070.71\times12=\$24{,}848.57\).

Case C. Her own claim at 66y0m is after the death, so \(e=\max(792,772)=792\), factor \(1-0.285\times12/84=0.959286\); \(2600\times0.959286=2{,}494.14\), held at 2,145: **$25,740** in 2028 (she is paid nothing in 2027, before her claim age). This record changes nothing here; before the fix the engine paid \(2145\times0.959286\times12=\$24{,}692.01\), which the limit's order changes.

Case D. The worker dies unclaimed at 65, before his FRA, so the survivor base is his PIA, 2,600, with no limit (`usc-42-402-e-survivor-of-worker-who-died-before-claiming`). In 2026 the earnings test withholds \((40000-24480)/2=7{,}760\) of her own \(840\times12=10{,}080\), which the ledger counts as \(\mathrm{round}(7760/10080\times12)=9\) months. From 2027 she is paid the widow's benefit at \(e=772\): \(2600\times0.891429\times12=\$27{,}812.57\). In 2029, the year she reaches 67, no widow(er) month was withheld, so it stays **$27,812.57**. Crediting her nine own months would give \(e+9=781\), factor \(1-0.285\times23/84=0.921964\), \$28,765.29. Before the fix: \(744+9=753\), \(2600\times(1-0.285\times51/84)\times12=\$25{,}801.29\).

Case E. As D, and in 2027 the earnings test withholds 7,760 of the widow's \$27,812.57, which the ledger counts as \(\mathrm{round}(7760/27812.57\times12)=3\) widow(er) months (she is paid \$20,052.57 that year). In 2029: \(m=\min(804,772+3)=775\), factor 0.901607, \(2600\times0.901607\times12=\) **$28,130.14**. Before the fix: 13 months in all (9, then 4 of the smaller benefit it paid in 2027), \(744+13=757\), \(\$26{,}224.71\).

## Expected

| Case | Before (engine to 2026-09-26) | After |
|---|---:|---:|
| A, 2029 | 15,769.29 | **19,800.00** |
| B, 2027 | 20,500.07 | **25,740.00** |
| C, 2028 | 24,692.01 | **25,740.00** |
| D, 2029 | 25,801.29 | **27,812.57** |
| E, 2029 | 26,224.71 | **28,130.14** |

These are the published `YearResult.incomes.socialSecurity` of the year named, the household's whole Social Security (the worker is dead). Exact: B's factor is 0.891428571…, D's after-figure 27,812.571428…, E's 28,130.142857…. Fixture tolerance: absolute $0.005. The entitlement ages are exact integers: A 775, B 772, C 792.

## Wrong readings

- The widow(er) benefit reduced at the survivor's own claim age (the engine before 2026-09-27): A 17,851.82 with the old order of the limit or 19,114.29 with the new one; B 22,945.37 or 24,848.57.
- Every withheld month credited to the widow(er) benefit: D 28,765.29.
- The survivor's age counted from the birthday itself rather than the day before: no difference for these birthdays (none falls on the 1st); a survivor born on the 1st of a month is a month older in each January.

Not a wrong reading, but not what the ledger does: reducing from December of the death year, the month of death, which 20 CFR 404.621(a)(4)(ii) lets a widow(er) choose. The ledger pays nothing for that month, so it would add one month of reduction with no payment for it (this worksheet's first version): B would use 771 months and still pay 25,740 because the limit binds; D would pay \$27,706.71 and E \$28,024.29.

## Family

outputs: none.

feeds: `social-security-benefit-annual`.

## Provenance

Cases A, B and C, their before-figures and the formula are from the B2-P1 slice 4 derivation (problem 1) and its independent check (A1, cases C-A, X1 and X2), RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice4-derivation.md` and `b2p1-slice4-check.md`; the statute and regulations are quoted from uscode.house.gov and the eCFR as saved by that check. Cases D and E were added for the earnings-test credit the check's note (a) asks for. The January first month is the independent review's finding 5 (2026-09-27). Every after-figure was recomputed by a script that does not import the engine, and the before-figures by running the engine at RetireGolden `4a80669e`. Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed.
