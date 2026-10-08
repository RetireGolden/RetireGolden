# Review, 2026-10-08 (part-year-income-percentage-codex)

Reviewer: Codex (GPT-6-Sol), headless and read-only, by independent recomputation from the cited primary sources without executing the engine, on a snapshot of branch `claude/engine-0.4.3` at `6e347f249`. The work was done by Claude (Opus). Scope: part-year phase 2 for the income-percentage states and the three credit-form states, each priced as the full-year tax times its own ratio, recomputed from the 2025 part-year forms. Verdicts: 23 approve, 2 reject. The reviewer's scripts are published at `DOCS/calculations/reviews/scripts/part-year-income-percentage-2026-10-08-codex/`; they run with Python 3 and import nothing from this repository. The only edits to the report below replace local snapshot paths with repository paths. Verbatim output follows.

---

# Independent review — part-year phase 2, method (b)

**Reviewer:** Codex GPT · headless · read-only snapshot. **Date:** 2026-10-08. **Commit:** `6e347f249`.

I used a separate Python `Decimal` calculation in `scripts/part-year-income-percentage-2026-10-08-codex/recompute.py`; I read but did not import or execute the engine or its tests. The 2026 rate and deduction assumptions are the cited state pack; the allocation method is checked against 2025 forms and the snapshot’s `DOCS/calculations/taxes/part-year-methods-derivation-2026-10-07.md`. Dollar figures below are *modeled schedule figures before return-level whole-dollar and ratio rounding* and omit credits or exemptions for which the worked tests supply no household facts. They are therefore not presented as final filed-return amounts. For all cases the resident period is January–June, Texas July–December. Ordinary income is $50,000 in each period; the dated $40,000 conversion goes wholly in March or September. Except Oklahoma, both states’ ratio lines have numerator/denominator $50,000/$100,000 (even), $90,000/$140,000 (resident conversion), and $50,000/$140,000 (Texas conversion) because these cases have no other modifications.

The 2025 California [booklet](https://www.ftb.ca.gov/forms/2025/2025-540nr-booklet.html) is accessible as official HTML, though the derivation’s PDF request was blocked. The 2025 Colorado [DR 0104PN](https://tax.colorado.gov/sites/tax/files/documents/DR0104PN_2025.pdf) is also accessible now. I could not open New Mexico’s original 2025 PIT-B host; its [2025 form copy](https://www.taxformfinder.org/forms/2025/2025-new-mexico-form-pit-b.pdf) shows lines 11–14, consistent with the cited older official form. No quotation below is attributed to the blocked host.

## AR — approve

**Authority and basis:** [AR1000NR 38C–D: Arkansas AGI / total AGI; net tax after personal credits](https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000F_and_AR1000NR_Instructions.pdf). Descriptor: `stateIncome`. The independent schedule calculation uses the pack’s $2,470 deduction, giving taxable bases $97,530 and $137,530.

**Recomputation:** Full-year tax $3,241.4100 / $4,721.4100. Even $3,241.4100 × 1/2 = $1,620.7050. Resident conversion $4,721.4100 × 90,000/140,000 = $3,035.1921; Texas conversion $4,721.4100 × 50,000/140,000 = $1,686.2179.

## CA — reject

**Authority and basis:** [540NR 31, 35–37: California taxable income / total taxable income after proportional deduction](https://www.ftb.ca.gov/forms/2025/2025-540nr-booklet.html). Descriptor: `stateIncome`. The independent schedule calculation uses the pack’s $5,706 deduction, giving taxable bases $94,294 and $134,294.

**Recomputation:** Full-year tax $5,207.9800 / $8,927.9800. Even $5,207.9800 × 1/2 = $2,603.9900. Resident conversion $8,927.9800 × 90,000/140,000 = $5,739.4157; Texas conversion $8,927.9800 × 50,000/140,000 = $3,188.5643.

**Form check and reason to reject:** Form 540NR line 36 divides tax on total taxable income (line 31) by total taxable income (line 19), rounds that *effective rate* to four decimals, then line 37 multiplies it by California taxable income (line 35). Schedule CA Part IV rounds its deduction percentage to four decimals too. The 2025 [official tax table](https://www.ftb.ca.gov/forms/2025/2025-540-taxtable.pdf) gives $5,209 at $94,294 taxable, not the pack schedule’s $5,207.98. Holding the same 2026 pack rate bands as the test, taking whole-dollar line-31 amounts and the form’s displayed rates yields approximate pre-final-rounding California taxes of $2,602.5144 even (versus $2,603.9900), $5,741.0522 resident (versus $5,739.4157), and $3,189.4988 Texas (versus $3,188.5643). The `stateIncome` ratio is algebraically equivalent before the form’s intermediate rounding for this simple standard-deduction case, but it is **not** the line 36 numerator/denominator and the stated figures do not reproduce the cited form. The 2026 form/table is not published, so these are method differences using the available 2025 form, not a claim about final 2026 filed dollars.

## CO — approve

**Authority and basis:** [DR 0104PN 32–36: Colorado modified AGI / modified AGI](https://tax.colorado.gov/sites/tax/files/documents/DR0104PN_2025.pdf). Descriptor: `stateIncome`. The independent schedule calculation uses the pack’s $16,100 deduction, giving taxable bases $83,900 and $123,900.

**Recomputation:** Full-year tax $3,691.6000 / $5,451.6000. Even $3,691.6000 × 1/2 = $1,845.8000. Resident conversion $5,451.6000 × 90,000/140,000 = $3,504.6000; Texas conversion $5,451.6000 × 50,000/140,000 = $1,947.0000.

## CT — approve

**Authority and basis:** [CT-1040NR/PY 5–6: Connecticut-source modified AGI / Connecticut AGI](https://portal.ct.gov/-/media/drs/forms/2025/income/2025-ct-1040-nrpy-instructions_1225.pdf). Descriptor: `stateIncome`. The independent schedule calculation uses the pack’s $0 deduction, giving taxable bases $100,000 and $140,000.

**Recomputation:** Full-year tax $4,750.0000 / $7,150.0000. Even $4,750.0000 × 1/2 = $2,375.0000. Resident conversion $7,150.0000 × 90,000/140,000 = $4,596.4286; Texas conversion $7,150.0000 × 50,000/140,000 = $2,553.5714.

## DE — approve

**Authority and basis:** [PIT-NON 30a/30b and 43: Delaware-column income / all-source income; tax after the full deduction](https://revenuefiles.delaware.gov/2025/PITForms_Instructions/PIT-NON_2025-01_PaperInteractiveIPM.pdf). Descriptor: `stateIncome`. The independent schedule calculation uses the pack’s $3,250 deduction, giving taxable bases $96,750 and $136,750.

**Recomputation:** Full-year tax $5,369.0000 / $8,009.0000. Even $5,369.0000 × 1/2 = $2,684.5000. Resident conversion $8,009.0000 × 90,000/140,000 = $5,148.6429; Texas conversion $8,009.0000 × 50,000/140,000 = $2,860.3571.

## IA — approve

**Authority and basis:** [IA 126 27–34: Iowa-source net income / all-source net income; credit on tax after preceding credits](https://revenue.iowa.gov/media/4385/download?inline=). Descriptor: `stateIncome`. The independent schedule calculation uses the pack’s $16,100 deduction, giving taxable bases $83,900 and $123,900.

**Recomputation:** Full-year tax $3,188.2000 / $4,708.2000. Even $3,188.2000 × 1/2 = $1,594.1000. Resident conversion $4,708.2000 × 90,000/140,000 = $3,026.7000; Texas conversion $4,708.2000 × 50,000/140,000 = $1,681.5000.

**Credit check:** With the exact share, subtracting the nonresident credit leaves precisely the amounts above (difference $0 in all three cases). The 2025 form’s printed ratio gives form-minus-exact differences of $0 even, −$0.0007 resident and $0.0007 Texas, before whole-dollar return entries. Iowa rounds its income percentage to six decimal places.

## KS — approve

**Authority and basis:** [K-40 9–10 and Schedule S: Kansas-source income / total income](https://ksrevenue.gov/incomebook25.html). Descriptor: `stateIncome`. The independent schedule calculation uses the pack’s $3,605 deduction, giving taxable bases $96,395 and $136,395.

**Recomputation:** Full-year tax $5,291.4410 / $7,523.4410. Even $5,291.4410 × 1/2 = $2,645.7205. Resident conversion $7,523.4410 × 90,000/140,000 = $4,836.4978; Texas conversion $7,523.4410 × 50,000/140,000 = $2,686.9432.

## ME — approve

**Authority and basis:** [Schedule NR 6–9: non-Maine AGI / Maine AGI for the credit, leaving the Maine share](https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/25_1040me_sch_nr_fillable.pdf). Descriptor: `stateIncome`. The modeled Maine deduction is $15,700 at $100,000 and $7,797.6667 at $140,000 after its annual income phaseout.

**Recomputation:** Full-year tax $5,507.7500 / $8,932.7668. Even $5,507.7500 × 1/2 = $2,753.8750. Resident conversion $8,932.7668 × 90,000/140,000 = $5,742.4930; Texas conversion $8,932.7668 × 50,000/140,000 = $3,190.2739.

**Credit check:** With the exact share, subtracting the nonresident credit leaves precisely the amounts above (difference $0 in all three cases). The 2025 form’s printed ratio gives form-minus-exact differences of $0 even, $0.3828 resident and −$0.3828 Texas, before whole-dollar return entries. Maine rounds its non-Maine share to four decimals.

## MN — approve

**Authority and basis:** [M1NR 28–32: Minnesota income / all-source income; line 31 full tax](https://www.revenue.state.mn.us/sites/default/files/2026-07/m1nr-25.pdf). Descriptor: `federalAgi`. The independent schedule calculation uses the pack’s $15,300 deduction, giving taxable bases $84,700 and $124,700.

**Recomputation:** Full-year tax $5,276.6050 / $8,156.9400. Even $5,276.6050 × 1/2 = $2,638.3025. Resident conversion $8,156.9400 × 90,000/140,000 = $5,243.7471; Texas conversion $8,156.9400 × 50,000/140,000 = $2,913.1929.

## MO — approve

**Authority and basis:** [MO-NRI Missouri income percentage applied to the all-source tax](https://dor.mo.gov/forms/MO-NRI_2025.pdf). Descriptor: `stateIncome`. The independent schedule calculation uses the pack’s $16,100 deduction, giving taxable bases $83,900 and $123,900.

**Recomputation:** Full-year tax $3,762.6680 / $5,642.6680. Even $3,762.6680 × 1/2 = $1,881.3340. Resident conversion $5,642.6680 × 90,000/140,000 = $3,627.4294; Texas conversion $5,642.6680 × 50,000/140,000 = $2,015.2386.

## MT — approve

**Authority and basis:** [Form 2: Montana-source income / all-source income applied to resident tax](https://revenue.mt.gov/files/forms/Montana-Individual-Income-Tax-Return-Form-2-Instructions/2025_Montana_Individual_Income_Tax_Return_Form_2_Instructions.pdf). Descriptor: `federalAgi`. The independent schedule calculation uses the pack’s $16,100 deduction, giving taxable bases $83,900 and $123,900.

**Recomputation:** Full-year tax $4,289.1000 / $6,549.1000. Even $4,289.1000 × 1/2 = $2,144.5500. Resident conversion $6,549.1000 × 90,000/140,000 = $4,210.1357; Texas conversion $6,549.1000 × 50,000/140,000 = $2,338.9643.

## NC — approve

**Authority and basis:** [D-400 Schedule PN 22–24: North Carolina taxable percentage of gross income; flat rate makes tax allocation equivalent](https://www.ncdor.gov/2025-d-400-schedule-pn-handwritten-version/open). Descriptor: `stateIncome`. The independent schedule calculation uses the pack’s $12,750 deduction, giving taxable bases $87,250 and $127,250.

**Recomputation:** Full-year tax $3,481.2750 / $5,077.2750. Even $3,481.2750 × 1/2 = $1,740.6375. Resident conversion $5,077.2750 × 90,000/140,000 = $3,263.9625; Texas conversion $5,077.2750 × 50,000/140,000 = $1,813.3125.

## ND — approve

**Authority and basis:** [ND-1NR 18–23: North Dakota source income / total income; tax times ratio](https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/28724-schedule-nd-1nr-2025.pdf). Descriptor: `federalAgi`. The independent schedule calculation uses the pack’s $16,100 deduction, giving taxable bases $83,900 and $123,900.

**Recomputation:** Full-year tax $669.3375 / $1,449.3375. Even $669.3375 × 1/2 = $334.6688. Resident conversion $1,449.3375 × 90,000/140,000 = $931.7170; Texas conversion $1,449.3375 × 50,000/140,000 = $517.6205.

## NE — approve

**Authority and basis:** [Schedule III 1–4, 8–9: Nebraska AGI / (1040N 5 + 12 − 13); tax after personal exemption credit times ratio](https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/f_1040N_Schs.pdf). Descriptor: `federalAgi`. The independent schedule calculation uses the pack’s $8,850 deduction, giving taxable bases $91,150 and $131,150.

**Recomputation:** Full-year tax $3,846.4560 / $5,666.4560. Even $3,846.4560 × 1/2 = $1,923.2280. Resident conversion $5,666.4560 × 90,000/140,000 = $3,642.7217; Texas conversion $5,666.4560 × 50,000/140,000 = $2,023.7343.

**Approximation:** Schedule III actually divides Nebraska AGI by federal AGI **plus Nebraska additions minus Nebraska subtractions**. Here both adjustments are zero, so the federal-AGI proxy agrees. A positive net denominator adjustment makes this proxy ratio higher than the form ratio; a negative one makes it lower, holding the numerator fixed. The 2025 form also subtracts a $171 personal exemption credit for an eligible single filer before multiplying; this worked fixture omits household-fact credits and is not a complete return.

## NM — approve

**Authority and basis:** [PIT-B 11–14: New Mexico column 2 / all-source column 1, tax times ratio](https://www.taxformfinder.org/forms/2025/2025-new-mexico-form-pit-b.pdf). Descriptor: `federalAgi`. The independent schedule calculation uses the pack’s $16,100 deduction, giving taxable bases $83,900 and $123,900.

**Recomputation:** Full-year tax $3,569.1000 / $5,529.1000. Even $3,569.1000 × 1/2 = $1,784.5500. Resident conversion $5,529.1000 × 90,000/140,000 = $3,554.4214; Texas conversion $5,529.1000 × 50,000/140,000 = $1,974.6786.

**Source access:** The original 2025 state-hosted PDF was inaccessible; the linked copy reproduces the 2025 form’s ratio and tax lines. This supports the method, with the original-host verification still outstanding.

## NY — approve

**Authority and basis:** [IT-203 31 and 45: New York amount / federal amount after New York modifications](https://www.tax.ny.gov/pdf/2025/inc/it203i_2025.pdf). Descriptor: `stateIncome`. The independent schedule calculation uses the pack’s $8,000 deduction, giving taxable bases $92,000 and $132,000.

**Recomputation:** Full-year tax $4,859.7500 / $7,219.7500. Even $4,859.7500 × 1/2 = $2,429.8750. Resident conversion $7,219.7500 × 90,000/140,000 = $4,641.2679; Texas conversion $7,219.7500 × 50,000/140,000 = $2,578.4821.

## OH — approve

**Authority and basis:** [IT NRC 16–20: nonresident Ohio AGI / Ohio AGI credits the out-of-state share](https://dam.assets.ohio.gov/image/upload/tax.ohio.gov/forms/ohio_individual/individual/2025/itnrc-fi.pdf). Descriptor: `stateIncome`. The modeled full tax is $332 plus 2.75% of income over $26,050.

**Recomputation:** Full-year tax $2,365.6250 / $3,465.6250. Even $2,365.6250 × 1/2 = $1,182.8125. Resident conversion $3,465.6250 × 90,000/140,000 = $2,227.9018; Texas conversion $3,465.6250 × 50,000/140,000 = $1,237.7232.

**Credit check:** With the exact share, subtracting the nonresident credit leaves precisely the amounts above (difference $0 in all three cases). The 2025 form’s printed ratio gives form-minus-exact differences of $0 even, $0.1485 resident and $0.1980 Texas, before whole-dollar return entries. Ohio truncates its nonresident share to four decimals.

## OK — approve

**Authority and basis:** [511-NR 16–18: Oklahoma AGI / all-source AGI after Oklahoma adjustments](https://oklahoma.gov/content/dam/ok/en/tax/documents/forms/individuals/current/511-NR-Pkt.pdf). Descriptor: `stateIncome`. The 2026 $10,000 Oklahoma retirement exclusion reduces the full-year denominator to $130,000 and the resident-conversion numerator to $80,000; a Texas conversion leaves the numerator $50,000.

**Recomputation:** Full-year tax $3,999.5000 / $5,349.5000. Even $3,999.5000 × 1/2 = $1,999.7500. Resident conversion $5,349.5000 × 80,000/130,000 = $3,292.0000; Texas conversion $5,349.5000 × 50,000/130,000 = $2,057.5000.

## OR — approve

**Authority and basis:** [OR-40-P 35 and 44–45: Oregon percentage applied to full-year tax](https://www.oregon.gov/dor/forms/FormsPubs/form-or-40-n_or-40-p-inst_101-048-1_2025.pdf). Descriptor: `stateIncome`. The independent schedule calculation uses the pack’s $2,910 deduction, giving taxable bases $97,090 and $137,090.

**Recomputation:** Full-year tax $8,176.3750 / $11,815.4100. Even $8,176.3750 × 1/2 = $4,088.1875. Resident conversion $11,815.4100 × 90,000/140,000 = $7,595.6207; Texas conversion $11,815.4100 × 50,000/140,000 = $4,219.7893.

## RI — approve

**Authority and basis:** [RI-1040NR Schedule III 12–16: Rhode Island modified AGI / total modified AGI](https://tax.ri.gov/sites/g/files/xkgbur541/files/2026-01/2025%20RI-1040NR%20Schedule%20III_w.pdf). Descriptor: `stateIncome`. The independent schedule calculation uses the pack’s $11,200 deduction, giving taxable bases $88,800 and $128,800.

**Recomputation:** Full-year tax $3,397.5000 / $5,297.5000. Even $3,397.5000 × 1/2 = $1,698.7500. Resident conversion $5,297.5000 × 90,000/140,000 = $3,405.5357; Texas conversion $5,297.5000 × 50,000/140,000 = $1,891.9643.

## UT — approve

**Authority and basis:** [TC-40B 39–40: Utah-source income / all-source income, times full tax](https://incometax.utah.gov/instructions/tc-40b). Descriptor: `stateIncome`. The independent schedule calculation uses the pack’s $0 deduction, giving taxable bases $100,000 and $140,000.

**Recomputation:** Full-year tax $4,450.0000 / $6,230.0000. Even $4,450.0000 × 1/2 = $2,225.0000. Resident conversion $6,230.0000 × 90,000/140,000 = $4,005.0000; Texas conversion $6,230.0000 × 50,000/140,000 = $2,225.0000.

## VT — approve

**Authority and basis:** [IN-113 30, 34–35: Vermont income / all-source income, times IN-111 tax](https://tax.vermont.gov/sites/tax/files/documents/IN-113-Instr-2025.pdf). Descriptor: `federalAgi`. The independent schedule calculation uses the pack’s $7,850 deduction, giving taxable bases $92,150 and $132,150.

**Recomputation:** Full-year tax $4,432.5250 / $7,165.5250. Even $4,432.5250 × 1/2 = $2,216.2625. Resident conversion $7,165.5250 × 90,000/140,000 = $4,606.4089; Texas conversion $7,165.5250 × 50,000/140,000 = $2,559.1161.

## WI — approve

**Authority and basis:** [1NPR 30–33: Wisconsin income / federal income after common adjustments; deduction on full-year income](https://www.revenue.wi.gov/TaxForms2025/2025-Form1NPR-Inst.pdf). Descriptor: `stateOverFederalAgi`. The modeled sliding deduction is $4,374.40 at $100,000 and zero at $140,000; it is calculated on full-year income before allocation.

**Recomputation:** Full-year tax $4,464.6168 / $6,816.4600. Even $4,464.6168 × 1/2 = $2,232.3084. Resident conversion $6,816.4600 × 90,000/140,000 = $4,382.0100; Texas conversion $6,816.4600 × 50,000/140,000 = $2,434.4500.

**Approximation:** Form 1NPR lines 30/31 use Wisconsin income after its adjustments over federal income after common adjustments; the engine’s federal-AGI-items share agrees here because there are no modifications. Its approximation has no universal tax direction when state-specific subtractions or additions change the numerator; the $4,374.40 full-year sliding deduction is correctly computed on line 33’s full-year income. The $700 personal exemption is absent from this no-household-facts fixture.

## WV — approve

**Authority and basis:** [IT-140 Schedule A 26 and Part I 1–4: West Virginia income / federal AGI](https://tax.wv.gov/Documents/PIT/2025/it140.Schedule-A.2025.pdf). Descriptor: `federalAgi`. The independent schedule calculation uses the pack’s $0 deduction, giving taxable bases $100,000 and $140,000.

**Recomputation:** Full-year tax $3,782.5000 / $5,614.5000. Even $3,782.5000 × 1/2 = $1,891.2500. Resident conversion $5,614.5000 × 90,000/140,000 = $3,609.3214; Texas conversion $5,614.5000 × 50,000/140,000 = $2,005.1786.

## limits — reject

The tax documentation’s limits accurately say that the projection has only a move month, that undated income is spread by months, that it does not apply form ratio rounding, and that nonresident-period in-state source income, other-state tax credits, special accrual, and full-year elections are omitted. The Nebraska and Wisconsin federal-AGI proxies are disclosed, though their error direction depends on the adjustments and cannot be stated as a universal overcharge or undercharge. The [tax documentation](DOCS/calculations/taxes/state-enacted-tax-year-figures.md) correctly says a *named* Roth conversion’s execution date does **not** reach its annual account row. [`annualStateRetirementEvents.ts`](packages/engine/src/projection/internal/annualStateRetirementEvents.ts) produces that account row without `distributionDate`; `allocateSplitYear` then gives it the months share. The Unreleased changelog’s limit says “a named conversion’s execution date included,” which reverses the behavior and overclaims the demonstrated dated-conversion tests. Those tests inject a dated `retirementDistributions` row directly. Correct the changelog and distinguish dated external rows from named-plan conversions.

A second precision caveat: the 2025 California booklet says to use its tax table when total taxable income is at most $100,000, and it rounds the effective tax rate on line 36. The figures here use the 2026 pack’s continuous rate schedule, so its $5,207.98 modeled full tax at $94,294 taxable income should not be labeled a cent-exact filed 540NR figure. The generic ratio-rounding limit covers part, but does not disclose this separate table and effective-rate step.
