# Review, 2026-09-29 (grok-3-after-769: the records #769 changed, derived by Codex)

Reviewer: Grok (grok-4.7, xAI), headless and read-only, by independent recomputation without executing the engine, its tests or its scripts, on a snapshot of RetireGolden main at commit `38f6c739` (after #769). Scope: the 2 records below, derived by codex, so the reviewer is of a different agent family from the deriver (catalog gate 7): `social-security-benefit-annual`, `social-security-cola-factor`. Verdicts: 2 approve, 0 reject. The reviewer's script is in `DOCS/calculations/reviews/scripts/grok-3-after-769/` (recompute.py), and runs from the repository root. The only edits to the report below replace the reviewer's own scratch-folder paths with that repository path. Left out of that folder: the downloaded source pages (cfr-404-*.html, cornell-404-*.html, fr-2025-19763.html and .txt, poms-02501-150.html, usc-402.html and usc-403.html; 2.1 MB) and extract_sources.py and extract_more.py, because the pages are the reviewer's copies of the public statutes, regulations, POMS section and Federal Register notice the report cites by URL, and the two scripts only pull text out of those copies. Verbatim output follows.

---

# Independent review of calculation records

Reviewer: Grok (grok-4.7, xAI), headless, read-only.
Date: 2026-09-29.
Repository commit: `38f6c739`.
Scope: `social-security-benefit-annual`, `social-security-cola-factor`. The assignment listed both worksheets as null; the records name `DOCS/calculations/social-security/social-security-benefit-annual.md` and `DOCS/calculations/social-security/social-security-cola-factor.md`.

Method: every worked case was recomputed from the worksheet's inputs and stated method, in exact rationals, by `DOCS/calculations/reviews/scripts/grok-3-after-769/recompute.py`. No file under `packages/` was imported, and no engine test or script was run. Function bodies were not used as the derivation; signatures and the `YearIncomes.socialSecurity` comment were read. Primary-source sentences below are quoted only from pages fetched for this review: OLRC for 42 U.S.C. 402 and 403, LII's e-CFR text for the cited sections of 20 CFR part 404, SSA's POMS page for RS 02501.150, and the Federal Register notice of 3 November 2025 (90 FR 49047) for the 2026 figures. eCFR and ssa.gov returned access walls; those hosts are not quoted.

---

## social-security-benefit-annual

### Recomputed

Script: `DOCS/calculations/reviews/scripts/grok-3-after-769/recompute.py`. The early-claim factor is \(1 - \min(m,36)\times 5/900 - \max(0,m-36)\times 5/1200\); the spouse factor uses \(25/36\) of 1% for the first 36 months. Both are the rates the cases use.

Own claim, 1960 birth, FRA 67y0m, claim at 64y3m (33 months early, all in the first band): \(1 - 33 \times 5/900 = 49/60\). Claim year pays \(12 - 3 = 9\) months. \(2{,}000 \times 49/60 \times 9 \times 1 \times 0.95 = 13{,}965\) exactly. Later year: \(2{,}000 \times 49/60 \times 12 \times 1.06 \times 0.95 = 19{,}737.20\) exactly (\(98{,}686/5\)).

Two-person case, both at FRA: excess \(\max(0, 0.5 \times 2{,}000 - 300) = 700\); candidate \(300 + 700 = 1{,}000\); household \((2{,}000 + 1{,}000) \times 12 = 36{,}000\).

Below FRA: \(\max(0, (34{,}480 - 24{,}480)/2) = 5{,}000\), under the \(24{,}000\) benefit, so paid \(19{,}000\).

Family charge (E5). Both born January 1964, FRA 67 in January 2031, claim at 62 is 60 months early: own factor \(7/10\), spouse factor \(13/20\). W's own \(1{,}400\); S's own \(280\); spouse part \((1{,}000 - 400) \times 0.65 = 390\); family benefit on his record \(1{,}400 + 390 = 1{,}790\). Excess \(\lfloor(60{,}000 - 24{,}480)/2\rfloor = 17{,}760\). Nine months take \(16{,}110\); October takes \(1{,}650\) and leaves \(140\), shared \(2{,}000:1{,}000\), which is \(280/3\) and \(140/3\). W paid \(280/3 + 2 \times 1{,}400 = 8{,}680/3 = 2{,}893.33\overline{3}\). S paid \(12 \times 280 + 140/3 + 2 \times 390 = 12{,}560/3 = 4{,}186.66\overline{6}\). Ten crediting months. From January 2031, 50 months early: W \(2{,}000 \times 89/120 = 4{,}450/3\) a month, \(17{,}800\) a year; S \(280 + 600 \times 83/120 = 695\) a month, \(8{,}340\).

E7b. Her excess \(\lfloor(36{,}000 - 24{,}480)/2\rfloor = 5{,}760\). What his charge left of her benefits is her own \(280\) for nine months (\(2{,}520\)), \(280 + 140/3 = 980/3\) in October, and \(670\) in November and December: \(12{,}560/3 = 4{,}186.66\overline{6}\), less than \(5{,}760\), so she is paid \(0\). Twelve crediting months: from January 2031, \(400 \times 3/4 + 600 \times 7/10 = 720\) a month, \(8{,}640\). W is unchanged at \(2{,}893.33\).

E1. Born 1964-03-10, FRA in March 2031, claim at 62 entitled from March 2026, but the payable-months convention pays all twelve months at \(1{,}400\), gross \(16{,}800\). Excess \(\lfloor(40{,}000 - 24{,}480)/2\rfloor = 7{,}760\). January and February are not charged, so March through July take \(7{,}000\) and August \(760\); paid \(16{,}800 - 7{,}760 = 9{,}040\). Six crediting months. From March 2031, 54 months early: factor \(29/40 = 0.725\), \(1{,}450\) a month. 2031 pays \(2 \times 1{,}400 + 10 \times 1{,}450 = 17{,}300\); 2032 pays \(17{,}400\).

### Match

Yes. All fifteen expected rows equal the recomputation. Thirteen are exact to the cent. E5's two 2026 rows are repeating thirds (\(8{,}680/3\) and \(12{,}560/3\)) whose cent display is \(2{,}893.33\) and \(4{,}186.67\), inside \(0.005\) of the exact values (the differences are \(1/300\) and \(1/300\)).

### Tolerance

Absolute \(\$0.005\). The operations are products of stated decimals and rationals, one integer floor of an excess that lands on a whole dollar in every worked case, and one two-to-one split of \(\$140\). That split is the only figure that is not a cent; the half-cent band is what makes its displayed cents match, and it is the band the worksheet states for binary floating point. It does not hide a different rounding rule. Justified.

The worksheet also names a real departure from SSA's dollar floor (20 CFR 404.304(f)), which can move a month by up to a dollar. None of these cases needs that extra dollar to match, and the record's limits name it. The \(\$0.005\) band is not standing in for that departure.

### Wrong readings checked

Each one produces a different number.

- The old \(0.8\) factor beside these nine months: \(2{,}000 \times 0.8 \times 9 \times 0.95 = 13{,}680\), not \(13{,}965\). The evidence block states this figure as `incompatibleFactorAndMonthsWrongReading`.
- The \(\$700\) excess as the whole spousal candidate: \((2{,}000 + 700) \times 12 = 32{,}400\), not \(36{,}000\).
- Below-FRA excess divided by 3: \((34{,}480 - 24{,}480)/3 = 3{,}333.33\overline{3}\) withheld and \(20{,}666.66\overline{6}\) paid, not \(5{,}000\) and \(19{,}000\).
- Charging his excess against his own benefit only. His \(17{,}760\) exceeds twelve months of his own \(1{,}400\) (\(16{,}800\)) by \(960\), so the deduction stops at his benefit and he is paid \(0\); her untouched \(670 \times 12 = 8{,}040\). The worksheet's \(0\) and \(8{,}040\) are those numbers. The cap is the statute's own, not an extra assumption: 403(b)(1) stops the month's deduction at "the amount of such excess earnings" when the excess is less than the benefits, and at the benefits when it is not. Without that cap the arithmetic would be \(-960\), which is not a payment.
- Sparing her own benefit in the months his excess took her spouse benefit: nine months of her own \(280\) is \(2{,}520\), not \(0\).
- Leaving his charge out when hers is made: \(8{,}040 - 5{,}760 = 2{,}280\), not \(0\).
- The adjustment from January of the FRA year: \(12 \times 1{,}450 = 17{,}400\) in 2031, not \(17{,}300\).
- Charging January and February, before entitlement, and crediting neither. The \(7{,}760\) then takes January through May and \(760\) of June, and only March through June are credited, so 56 months early remain: factor \(43/60\), \(4{,}300/3\) a month. 2031 pays \(2 \times 1{,}400 + 10 \times 4{,}300/3 = 51{,}400/3 = 17{,}133.33\overline{3}\), and 2032 pays \(17{,}200\). The worksheet's \(17{,}133.33\) and \(17{,}200\) are that reading.

### Sources

42 U.S.C. 403(b)(1), OLRC preliminary text fetched 2026-09-29: deductions are made from the individual's payments "and from any payment or payments to which any other persons are entitled on the basis of such individual's wages and self-employment income, until the total of such deductions equals— (A) such individual's benefit or benefits … and (B) … the benefit or benefits of all other persons … based on such individual's wages and self-employment income," when he is charged with excess earnings equal to that total. The same paragraph: a person already deducted from "shall be deemed entitled to payments … only to the extent of the total of his benefits remaining after such earlier deductions have been made." E5 charges his excess against his benefit and her spouse benefit on his record, and not against her own benefit. E7b then charges her excess against what remains. That is this paragraph.

42 U.S.C. 403(f)(1), same page: the excess "shall be charged to the first month of such taxable year" an amount equal to that month's payments on his wages, "and the balance, if any, of such excess earnings shall be charged to each succeeding month." And "no part of the excess earnings of an individual shall be charged to any month (A) for which such individual was not entitled to a benefit under this subchapter, (B) in which such individual was at or above retirement age." E1's refusal to charge January and February is clause (A). Charging from January toward the FRA month is this paragraph. The statute's "first month" is the earliest month clauses (A) through (F) do not forbid, which is why January and February drop out and March is first.

42 U.S.C. 403(f)(3), same page: excess earnings are "33 1/3 percent of his earnings for such year in excess of the product of the applicable exempt amount" when he attains retirement age before the close of the year, "or 50 percent of his earnings for such year in excess of such product in the case of any other individual." "The excess earnings as derived under the first sentence of this paragraph, if not a multiple of $1, shall be reduced to the next lower multiple of $1." The below-FRA cases use the 50 percent limb and the dollar floor. The FRA-year one-third limb is stated as the alternate and is not the case being worked. The same sentence excludes "any earnings of such individual for the month in which he attains such age and any subsequent month"; no worked case is an FRA year, so that exclusion is not exercised here.

42 U.S.C. 403(f)(7), same page, is the partial-month proportion the worksheet attributes to 20 CFR 404.439: the unpaid difference "shall be paid … to such individual and other persons in the proportion that the benefit to which each of them is entitled (without regard to such charging, without the application of section 402(k)(3) of this title, and prior to the application of section 403(a) of this title) bears to the total of the benefits to which all of them are entitled." For a worker and one spouse that proportion is his PIA to half of it, two to one, which is the split used. The worksheet cites the regulation for this step rather than (f)(7). The two agree on this case.

20 CFR 404.434(b)(1), LII e-CFR text fetched 2026-09-29: "For each $1 of your excess earnings we will decrease by $1 the benefits to which you and all others are entitled (or deemed entitled—see § 404.420) on your earnings record." 404.434(b)(3): "your excess earnings are charged first against the total family benefits payable (or deemed payable) on your earnings record … Next, the excess earnings of a person entitled on your earnings record are charged against his or her own benefits remaining after part of your excess earnings have been charged against his/her benefits." E5 and E7b follow that order.

20 CFR 404.439, same fetch: the difference "is paid … to each person in the proportion that the benefit to which each is entitled (before the application of the reductions described in § 404.403 for the family maximum, § 404.407 for entitlement to more than one type of benefit, and section 202(q) of the Act for entitlement to benefits before retirement age) and before the application of § 404.304(f) to round to the next lower dollar bears to the total of the benefits to which all of them are entitled." The worksheet's "benefits before any reduction, his PIA 2,000 to half of it 1,000" is this proportion. The regulation's own example (165 and 82.50, a partial of 200, paid 133 and 66) is the same two-to-one split, and it applies the dollar floor after the split. The worksheet does not. The record says so.

20 CFR 404.440, same fetch: where a prorated share "exceeds the benefit rate to which he was entitled before excess earnings of the insured individual were charged, such person's share of the partial benefit is reduced to the amount he would have been paid had there been no deduction for excess earnings." E5's shares, \(93.33\overline{3}\) and \(46.66\overline{6}\), are both inside the month's benefits (\(1{,}400\) and \(390\)), so the cap does not move this case. The method includes it.

SSA POMS RS 02501.150 A.1, the POMS page fetched 2026-09-29: "When a beneficiary has entitlement to both auxiliary benefits and retirement insurance benefits (RIB), charge the excess earnings against their auxiliary benefit to the extent that the auxiliary benefit is not subject to deductions because of the other NH's work. Charge the excess earnings to the RIB without regard to the other NH's excess earnings." E7b charges her remaining excess against her own benefit after his charge has taken her spouse benefit. That is this sentence. A.2 of the same page, on a partial month, says to charge her excess "to the combined amount of their RIB and their share of the partial benefit" and then to cap the spouse-record charge at "the amount paid to them after charging the spouse's excess earnings." October is such a month. Her excess still exceeds everything left, so A.1 and A.2 pay her the same zero here. The worksheet's narrative follows A.1's order (own benefit in the fully withheld months, then what remains). It does not mis-state A.2's result for this case.

20 CFR 404.412(b), LII e-CFR text: "Increases in benefit amounts based upon this adjustment are effective with the month of attainment of full retirement age." E1's March 2031 start is that sentence. 42 U.S.C. 402(q)(7), OLRC: the adjusted reduction period excludes "(A) any month in which such benefit was subject to deductions under section 403(b)." Counting only the six charged months, all inside the reduction period, is that exclusion. The worksheet does not claim the other exclusions in (q)(7).

20 CFR 404.304(f), LII e-CFR text: "After all other deductions or reductions, we reduce any monthly benefit that is not a multiple of $1 to the next lower multiple of $1." The method does not do this. The worksheet and the record both say so, and they give the direction: a month can be up to a dollar above what SSA pays. That is a named departure, not a silent one. E5's October shares are the case it would touch: SSA would floor each share, and the engine keeps the unrounded third.

20 CFR 404.410(a), LII e-CFR text: "The reduction is 5/9 of 1 percent for each of the first 36 months and 5/12 of 1 percent for each month in excess of 36." The own-benefit factors use this sentence. 404.410(b): the wife's or husband's reduction "is 25/36 of 1 percent for each of the first 36 months and 5/12 of 1 percent for each month in excess of 36." The spouse part uses this sentence. The worksheet borrows both from the companion records rather than citing them itself; the numbers follow them.

The 2026 constants are in the notice the parameter file cites. 90 FR 49047, fetched from federalregister.gov on 2026-09-29: "there will be a 2.8 percent cost-of-living increase in Social Security benefits effective December 2025." "The lower annual exempt amount is $24,480 under the retirement earnings test." "The higher annual exempt amount is $65,160 under the retirement earnings test." The worksheet's \(24{,}480\) and \(65{,}160\) are those two sentences. The \(2.8\) is the benefit increase, used by the other record as an example rate; this record uses it only as the published pack's figure, not as a factor in these cases.

No worked case departs from a cited sentence except the dollar floor, which is named.

### Record consistency

The statement, formula and limits describe the composition the worksheet derives: own benefit as PIA times the claim factor, a current-spouse candidate of own monthly plus the reduced excess replacing the lower amount when larger, then the earnings test charged month by month from January, the worker first against the family benefit on his record, a partial month shared two to one, and the adjustment from the FRA month for months of the reduction period. The formula's symbols cover the worked cases. The limits name the dollar floor the method skips, the claim-year convention that pays months before entitlement, and both restatements. They do not claim the FRA-year one-third limb is exercised by a worked case; the worksheet only states it as the alternate. No overclaim.

One wording gap, not a number: the formula writes the FRA-year excess as \(\lfloor(\text{wages} \times b/12 - \text{higher})/3\rfloor\), which is the reading of 403(f)(3)'s exclusion of earnings from the FRA month on. No case in this worksheet computes it. The limits do not need to add an approximation the worksheet does not use.

### Evidence binding

`packages/engine/src/projection/internal/annualSocialSecurity.benefitAnnual.evidence.test.ts` asserts the first five expected rows by name against the worksheet table (`Own claim year, 2024` through `Below-FRA withheld, 2026`) at absolute \(0.005\), and asserts the three wrong readings \(13{,}680\), \(32{,}400\) and \(3{,}333.33\) as not matching. The E5, E7b and E1 tests read the remaining expected rows from that same table (`E5 W paid, 2026` through `E1 paid, 2032`) and compare each person's published stream sum, rounded to the cent, with them. They also assert the family-charge and adjustment wrong readings as not equal (\(8{,}040\), \(2{,}520\), \(2{,}280\), \(17{,}400\), \(17{,}133.33\)). Headline values bound. The test was not run.

### Verdict

**Approve.**

---

## social-security-cola-factor

### Recomputed

Script: `DOCS/calculations/reviews/scripts/grok-3-after-769/recompute.py`. Fixed rate \(2.8\% = 7/250\), so the factor is \((257/250)^n\).

- 2026, offset 0: \(1\).
- 2027, offset 1: \(1.028\).
- 2028, offset 2: \(66{,}049/62{,}500 = 1.056784\).

On a \(\$2{,}000\) start-year monthly amount: \(\$2{,}000\), \(\$2{,}056\), and \(\$2{,}113.568\).

### Match

Yes. The three factors and the three monthly amounts equal the worksheet's figures exactly.

### Tolerance

Absolute \(1 \times 10^{-12}\). Two multiplications of an exactly specified decimal, and no output rounding. In IEEE 754, \((1 + 2.8/100)^2\) and \(1.028^2\) both print \(1.056784\) and differ from \(1.056784\) by \(0\) at double precision; \(2{,}000 \times 1.028^2\) is \(2{,}113.5679999999998\), about \(2 \times 10^{-13}\) under the exact \(2{,}113.568\), inside the band. The band is the right size for that representation and is not covering a rounding rule. Justified.

### Wrong readings checked

- Applying the factor once in the first projection year: \(1.028\), \(1.056784\), \(1.086373952\). Each differs from \(1\), \(1.028\), \(1.056784\).
- Adding \(2.8\) points a year instead of compounding: the third-year factor is \(1.056\), not \(1.056784\).
- Combining plan inflation with the fixed rate would apply a second factor. The worked case has no second rate, so there is no separate number to recompute; the reading is a different formula, and the record's limits say the two modes are alternatives.

### Sources

This record is a projection convention, not a statutory COLA. The statutory increase is the one SSA announces for a December, applied to the benefit. 90 FR 49047, fetched 2026-09-29: "OASDI monthly benefits will increase by 2.8 percent for individuals eligible for December 2025 benefits, payable in January 2026 and thereafter." The worksheet uses \(2.8\) as the plan's fixed annual rate, taken from `year2026.socialSecurity.colaPct`, and compounds it from the projection start with exponent zero in the start year. That is not the statute's December increase, and the record does not say it is. The limits say the \(2.8\) "is year2026.socialSecurity.colaPct used as the plan's fixed rate; the parameter figure is not itself the plan default." The factor \(1\) in the first year is the ledger comment's rule: "COLA factor: the inflation factor from the start year under matchInflation, else (1 + annualPct / 100)^(year − start year)." The fixed formula matches that comment. No cited statute is departed from, because none is claimed.

### Record consistency

The statement and formula say what the worksheet derives: factor 1 in the start year, \((1 + \text{rate})^n\) at offset \(n\) for the fixed mode, and the plan's inflation factor from the start year for the other mode, never both. Rounding none, which is what the worksheet says. The 2026-09-27 restatement, that the factor and the haircut are two functions and that a Monte Carlo path passes its own inflation series, does not change a worked number; the worksheet says its cases are unchanged. The limits name the evidence's plan-level reading and the two modes as alternatives. No overclaim.

### Evidence binding

`packages/engine/src/projection/internal/annualSocialSecurity.evidence.test.ts`, the `social-security-cola-factor` block, asserts the published benefit of one stream already in force, divided by the start-year benefit, against `factors: [1, 1.028, 1.056784]` at absolute \(1 \times 10^{-12}\), and the monthly amount against `[2_000, 2_056, 2_113.568]` at absolute \(0.005\). It also asserts the start-year benefit equals \(2{,}000 \times 12\), which is the first wrong reading ruled out. The pack's `colaPct` is asserted equal to the input \(2.8\). Headline values bound. The test was not run.

### Verdict

**Approve.**
