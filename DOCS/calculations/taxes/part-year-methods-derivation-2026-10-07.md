# State part-year methods and what the engine charges

> **What this is.** The read-only derivation, dated 2026-10-07, that the part-year descriptors in engine 0.4.2 (phase 1) and 0.4.3 (phase 2) were built from, published so a non-author can follow each state's method to its form. Its "Engine" columns are engine 0.4.1, before either phase. The engine's current behavior and its stated limits are in `state-enacted-tax-year-figures.md` (section "Part-year residents") and the state notes under `DOCS/domain/state-tax-research/`. Where this derivation and a later Codex review differ (Kentucky's cap, Oregon's retirement credit, Michigan's exemption ratio), the review and the code follow the 2025 form: see `DOCS/calculations/reviews/REVIEW-2026-10-08-part-year-*.md`. Quotes marked WebFetch-returned or search snippet are not verbatim.


2026-10-07. Read-only research. The engine figures come from RetireGolden at `3a6e845b` (engine 0.4.1, 2026 state pack). The methods come from the 2025 part-year or nonresident instructions of all 41 income-tax states and DC.

**Sources and how far to trust each quote**
- **Form text**: copied from `pdftotext` output of the official PDF. Verbatim, except that line wraps are joined.
- **WebFetch-returned**: what a research helper's WebFetch call returned. That tool can drop parentheticals or paraphrase, so check these against the PDF before putting one in a `quotedText` field.
- **Search snippet**: search-engine text from the official document. It is not read in context.
- **Blocked or unreadable**:
  - ftb.ca.gov, mass.gov, tax.colorado.gov and michigan.gov returned 403 to WebFetch.
  - The 2025 Kentucky 740-NP form and New Mexico's 2025 PIT-B were not reachable on the state sites.

## Method-independent engine defects (fix regardless of method)

1. **Wisconsin's sliding standard deduction escapes the split-year proration. The engine understates Wisconsin by $433.92 in the case below.**
   - `wisconsinStandardDeduction` (`stateMidwestExtras.ts`) is not scaled by `prorateParams`.
   - It is phased down on the slice's income, not the year's: the slice's $50,000 instead of $100,000.
   - The slice gets a $10,374 deduction, against $4,374 for the full year and $2,187 for half of it.
   - Form 1NPR computes the deduction on the full year's federal income (line 33, the larger of Wisconsin or federal income) and prorates only the tax.
2. **Exemptions and credits that need `householdFacts` are dropped from every slice.** The split path never passes household facts, so each slice drops these with a warning:
   - the Illinois, Connecticut, Wisconsin and Massachusetts personal exemptions;
   - Oregon's retirement income credit;
   - Utah's retirement credits;
   - Iowa's alternate-tax test.

   The coarse full-year path omits several of them too. So the comparison below is like for like, but both figures omit them.

## Method counts

| Method | Count | States |
|---|---|---|
| (a) resident-period income on the ordinary schedule, graduated or with a zero band | 9 | NJ, HI, SC, DC, MD, VA, AL, MS, ID |
| (a) resident-period income at a flat rate | 8 | AZ, KY, LA, GA, MI, IN, IL, MA |
| (b) tax on all income as if resident × state-income ratio | 21 | CA, NY, CT, DE, WV, VT, RI, MN, OR, WI, CO, UT, MT, NM, ND, NE, KS, OK, MO, AR, NC |
| (b), credit form: tax on all income less a credit for the out-of-state share | 3 | ME, OH, IA |
| (c) other: flat rate on resident-period income, no deduction or exemption | 1 | PA |
| **Total** | **42** | |

So 17 use (a), 24 use (b) counting the three credit-form states, and 1 uses (c).

**Correction to the brief.** New Jersey is not an income-percentage state for a part-year resident. NJ-1040 taxes the resident-period income on the ordinary table. The income percentage belongs to NJ-1040NR, which only nonresidents (and the nonresident months of a part-year resident with NJ-source income) use.

**Elective states.** SC, DE and MO let a part-year resident file as a full-year resident and claim a credit for tax paid to the other state. For a move to a no-tax state that election never helps, since there is no credit to claim. It matters only for moves between two taxing states.

## The simple case

Single, age 50, $100,000 of ordinary income spread evenly over 2026. Resident six months in the state and six in Texas.

The columns:
- **Engine**: `computeStateTaxYearTotal` with `stateResidency: [{state, months: 6}, {state: 'TX', months: 6}]`, run from a scratch vitest root outside the repository.
- **Law (engine model)**: the same pack data priced by the state's method:
  - (b) and (c): half the full-year resident tax;
  - (a) with the deduction prorated: the $50,000 slice on the unscaled schedule with half the deduction;
  - (a) with the deduction in full: the same with the whole deduction.

Both columns use the engine's pack figures and omit the same exemptions and credits. The difference isolates the method.

With even income the months ratio equals the income ratio, so the proration basis (months, days, income) does not move these figures. It matters once income is uneven: see the design note.

## Table

Confidence:
- **H**: method read in the 2025 form or instruction text;
- **M**: read in a statute, regulation or official HTML, or in snippets of the 2025 text, or in an earlier year's form;
- **L**: inferred.

"Retirement exclusions" says whether the exclusions apply only to income received while resident, and whether a dollar cap is cut down.

| St | Method | Deduction / exemption proration | Retirement exclusions | Citation | Conf | Engine | Law | Engine − law |
|---|---|---|---|---|---|---|---|---|
| NJ | (a) | No std ded. Exemptions by months (15 days = a month) | Resident-period receipts. Pension-exclusion max prorated by months if whole-year income ≤ $100k, not above. Eligibility on whole-year income | NJ-1040 instr. 2025; GIT-6 | H | 2121.88 | 1270.00 | **+851.88 over** |
| HI | (a) | Std ded and exemptions × HI AGI / total AGI | Pensions and SS excluded without cap | N-15 (Rev. 2025) | H | 2941.60 | 2395.20 | **+546.40 over** |
| SC | (a) | Federal std/itemized × line 31 Col B / Col A | Retirement income received while resident; caps not prorated; $15,000 age-65 deduction in full | Sch NR instr. 2025 | H | 1731.25 | 1248.25 | **+483.00 over** |
| DC | (a) | Std ded by days (Calc. C); credits, additions, subtractions by days | $3,000 pension exclusion prorated by days with the other subtractions | D-40 booklet 2025 | H | 2812.50 | 2362.50 | **+450.00 over** |
| WI | (b) | Sliding std ded on full-year federal income; exemptions full; tax × WI/federal income | 67+ retirement subtraction max × WI AGI / federal AGI (new 2025) | 1NPR instr. 2025 | H | 1798.39 | 2232.31 | **−433.92 under** (defect 1) |
| MS | (a) | Deductions and exemptions × MS AGI / total AGI | Exempt without cap | 80-100 instr. 2025 | H (helper) | 1754.00 | 1554.00 | **+200.00 over** |
| AZ | (a) flat | **Std ded not prorated**; exemptions × AZ income ratio | SS subtraction resident period; $2,500 gov't pension cap: no proration rule found | 140PY instr. 2025 | H | 1053.13 | 856.25 | **+196.88 over** |
| LA | (a) flat | **Std ded $12,500 in full**; itemized excess × ratio | Exempt codes only on LA-column income; $12,000 65+ cap not prorated | IT-540B 2025 | H | 1306.88 | 1113.75 | **+193.13 over** |
| ID | (a) flat + zero band | Deduction × ID % (income ratio); $4,811 zero band in full | Retirement-benefits deduction × share received while resident | Form 43, booklet 2025 | H | 2095.86 | 1968.37 | **+127.49 over** |
| AL | (a) | **Std ded and exemptions in full** | $6,000 65+ exclusion up to retirement income taxable to AL | Form 40 / 40NR booklets 2025 | H (helper) | 2405.00 | 2310.00 | **+95.00 over** |
| KY | (a) flat | **Std ded not prorated**; itemized and personal credits × KY AGI % | Pension exclusion on KY column; cap proration not found | 740-NP Sch A 2025; 740-NP form (2020) | M | 1691.20 | 1632.40 | **+58.80 over** |
| MD | (a) | Std/itemized and exemptions × MD income factor (MD AGI / FAGI) | Pension exclusion computed as if full-year, × months / 12 | Tax Tip #52; COMAR 03.04.02.12 | M | 2268.00 | 2241.75 | **+26.25 over** (state only) |
| VA | (a) | Std ded × FAGI-while-resident / FAGI; exemptions by days | Age deduction × days ratio; SS to residence period | 760PY instr. 2025 | H (record) | 2339.20 | 2339.20 | 0 (already unscaled) |
| GA | (a) flat | Std ded and dependents × GA / federal income (time ratio optional) | Retirement exclusion prorated by GA-source share of retirement income | IT-511 2025; Sch 3 | H | 2120.75 | 2120.75 | 0 |
| IL | (a) flat | Exemption × IL base income / total base income | Retirement subtraction on resident-period receipts only; no cap | Sch NR 2025 | H | 2475.00 | 2475.00 | 0 (exemption dropped both ways) |
| IN | (a) flat | Exemptions × Sch A proration ratio | Nonresident-period retirement never in Col B | IT-40PNR 2025 | H | 1475.00 | 1475.00 | 0 (exemptions unmodeled) |
| MI | (a) flat | Exemption × MI AGI / total AGI | Col B resident-period; subtraction caps not prorated (statute + secondary) | MCL 206.30(5); Sch NR (403) | M | 2125.00 | 2125.00 | 0 (exemption unmodeled) |
| MA | (a) flat | Exemptions × days resident / 365 | Gov't pensions exempt; private taxable if received while resident | 1-NR/PY instr. 2025 (403; snippets) | M− | 2500.00 | 2500.00 | 0 (exemption unmodeled) |
| PA | (c) | None exist | Retirement income not taxable | PA-40 IN 2025 | H | 1535.00 | 1535.00 | 0 |
| CA | (b) | Deduction and exemption credits × CA / total ratio | Col E: IRA/pension received while resident; no cap | 540NR 2025 (403; snippets) | M | 2603.99 | 2603.99 | 0 |
| NY | (b) | Std ded and exemptions full; tax × NY-column / federal-column AGI | $20,000 pension exclusion per taxable period, not prorated; ratio after it | IT-203-I 2025 | H | 2429.88 | 2429.88 | 0 |
| CT | (b) | Exemption full in CT AGI; tax × CT-source / CT AGI | Modifications in CT AGI; part-year limit unverified | CT-1040NR/PY instr. 2025 | H | 2375.00 | 2375.00 | 0 |
| DE | (b) | Std ded full; personal credits × proration decimal | Pension exclusion Col B = cap × share of pension that is DE-source | PIT-NON form and instr. 2025 | H | 2684.50 | 2684.50 | 0 |
| WV | (b) | Exemptions full; tax × WV income / federal AGI | Exclusions in the full-year tax; ratio on unreduced federal AGI | IT-140 booklet 2025, Sch A | H | 1891.25 | 1891.25 | 0 |
| VT | (b) | Std ded and exemption full; tax × IN-113 % | Exclusions full in IN-111; % on AGI | IN-113 instr. 2025 | H | 2216.26 | 2216.26 | 0 |
| RI | (b) | Std ded and exemption full; tax × Sch III ratio | Modifications follow the column of the income | RI-1040NR instr. 2025 | H (helper) | 1698.75 | 1698.75 | 0 |
| MN | (b) | Full on M1; tax × M1NR line 30 | Col B: IRA/pension received while resident | Sch M1NR 2025 | H | 2638.30 | 2638.30 | 0 |
| OR | (b) | Std ded full; exemption credit × OR % | Pensions while resident taxable; credit treatment not found | OR-40-P 2025; OR-17 | H | 4088.19 | 4088.19 | 0 |
| CO | (b) | In federal taxable income; tax × CO / federal modified AGI | Pension subtraction only to the extent of CO income; cap proration unresolved | Rule 39-22-110; DR 0104PN (403) | M | 1845.80 | 1845.80 | 0 |
| UT | (b) | Taxpayer credit full, then ratio | Retirement credits are apportionable, × ratio | TC-40 instr. 2025 (TC-40B) | H | 2225.00 | 2225.00 | 0 |
| MT | (b) | In the full computation; tax × MT-source / total | SS and pensions are MT-source only while resident | Form 2 instr. 2025 | H | 2144.55 | 2144.55 | 0 |
| NM | (b) | In the full computation; tax × NM / total income | Retirement before residency not allocable (NMAC 3.3.11.13) | PIT-B (2022 official; 2025 snippet) | M | 1784.55 | 1784.55 | 0 |
| ND | (b) | In federal taxable income; tax × ND / total | Col B SS and pensions received while resident | Sch ND-1NR 2025 | H | 334.67 | 334.67 | 0 |
| NE | (b) | Std ded full; personal exemption credit "residents only" on line 18 (Sch III handles part-year) | Not determined | 1040N 2025; 316 NAC 22 | M | 1923.23 | 1923.23 | 0 |
| KS | (b) | Std ded and exemptions full; tax × Sch S B23 | Subtractions in KS AGI; numerator only KS-source modifications | K-40 booklet 2025 | H (helper) | 2645.72 | 2645.72 | 0 |
| OK | (b) | Full; tax × OK AGI / all-source AGI | OK-column exclusion = part tied to OK income, "not prorated" | 511-NR packet 2025 | H | 1999.75 | 1999.75 | 0 |
| MO | (b) | Full; tax × MO income % (or resident + MO-CR) | Taken on the as-if-resident return; cap rule not found | MO-1040 2024; MO DOR HTML | M | 1881.33 | 1881.33 | 0 |
| AR | (b) | Std ded and personal credits full; net tax × AR ratio | $6,000 exemption; Col C treatment not stated | AR1000F/NR instr. 2025 | H (helper) | 1620.71 | 1620.71 | 0 |
| NC | (b) | Std ded full; taxable income × taxable % | Numerator: resident-period modified income | D-401 2025 | H | 1740.64 | 1740.64 | 0 |
| ME | (b) credit | Std ded and exemption full; credit = tax × non-ME share | Pension deduction full; Sch NR prorates the non-ME part by pension received as nonresident | Sch NR 2025 | H (helper) | 2753.88 | 2753.88 | 0 |
| OH | (b) credit | Exemption full; IT NRC credit for the non-Ohio share | Retirement and senior credits in the full computation | IT 1040 booklet 2025 (IT NRC) | H | 1182.81 | 1182.81 | 0 |
| IA | (b) credit | Std ded and exemption credits full; IA 126 credit | Numerator: non-exempt pensions received while resident | IA 1040 expanded instr. 2025 | H (helper) | 1594.10 | 1594.10 | 0 |

**Over** means the engine charges more than the law; **under** means less.

**Where the engine is wrong in this case:**
- **11 states overstated**: NJ, HI, SC, DC, MS, AZ, LA, ID, AL, KY, MD. Every one is a method-(a) state.
  - In NJ, HI, SC, DC, MS, ID and MD the cause is the scaled brackets or zero band.
  - In AZ, LA, AL and KY the cause is a halved standard deduction that the state allows in full.
- **1 state understated**: WI, by defect 1.
- **Zero in this case** for every method-(b) state other than WI, and for VA.
- **Flat-rate method-(a) states with no deduction in the pack** (IL, IN, MI, MA, GA) also show zero here. They would diverge once their exemptions are modeled.

## Per-state notes

### Method (a), graduated or with a zero band

**New Jersey: (a), high.**
- **Return:** a part-year resident files NJ-1040 for the resident months, and NJ-1040NR only for NJ-source income in the nonresident months.
  - Form text (NJ-1040 instr. 2025, p. 4): "There is no part-year resident return. You may have to file both Form NJ-1040 to report income you received for the part of the year you were a resident and Form NJ-1040NR…"
- **Pensions:** Form text, line 20a: "Part-Year Residents. Include only the taxable amounts you received while you were a resident of New Jersey."
- **Exemptions, line 30:** "Prorate the total on line 13 for the time you were a New Jersey resident … 15 days or more is considered a month."
- **Pension exclusion, line 28a:**
  - Whole-year income must be ≤ $150,000.
  - At ≤ $100,000 the maximum is prorated by months. Form text: "If your income for the entire year is over $100,000, do not prorate the exclusion amount."
  - The engine's current scaling of the NJ exclusion (full-year income test, prorated maximum) matches this.
- **GIT-6** (May 2026), form text: "Part-year residents must prorate all of their exemptions, deductions, and credits, in addition to pension and other retirement income exclusions, to reflect the time period covered by their return."
- **Tax:** the NJ Tax Table or Rate Schedules on the resident-period taxable income, with no ratio.
- **URLs:** https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf; GIT-6 on nj.gov (also https://www.nj.gov/treasury/taxation/njit26.shtml).

**Hawaii: (a), high.**
- **Mechanics** (Form N-15, Rev. 2025):
  - Line 37 is the ratio, Hawaii AGI over total AGI.
  - Line 40b prorates the standard deduction ($4,400 single): "40b Multiply line 40a by the ratio on line 37 … Prorated Standard Deduction."
  - Line 42b prorates the exemptions: "Multiply line 42a by the ratio on line 37 … Prorated Exemption(s)."
  - Line 44 takes the tax from the Tax Table or Tax Rate Schedule on Hawaii taxable income.
- **Retirement:** employer-funded pensions and Social Security are excluded without a cap.
- **Statute:** HRS 235-5(d), WebFetch-returned: "The standard deduction … and personal exemptions … shall be allowed only to the extent of the ratio of the adjusted gross income attributed to this State".
- **URL:** https://files.hawaii.gov/tax/forms/current/n15_i.pdf. Despite the name, this is the form; the 2025 instructions are n15ins.pdf.

**South Carolina: (a), high.**
- **Proration**, form text (Sch NR instr. 2025): "Line 45: Proration — Divide line 31, Column B by line 31, Column A." Line 47, from the form via a search snippet, multiplies the line 46 deduction by line 45. Line 48 goes to SC1040 line 5 and is taxed on the regular tables.
- **Retirement:** "South Carolina taxes retirement income received while you are a resident of this state."
  - The deduction is $3,000 under 65 and $10,000 at 65+, with no proration.
  - Age-65 deduction: "If you are a resident of South Carolina for at least part of the year and reach the age of 65 during the tax year, you are entitled to a deduction of $15,000 against any South Carolina income."
- **Election:** a part-year resident may instead file as a resident with the SC1040TC credit.
- **URL:** https://dor.sc.gov/sites/dor/files/forms/SchNRInst_2025.pdf

**District of Columbia: (a), high.**
- **Method**, form text (2025 D-40 booklet): "The calculation of tax liability for a part-year resident is prorated based on the income earned in DC during the period of residency … All credits, exemptions and deductions must be prorated according to the time domiciled in DC."
- **Line 8** removes income received while domiciled outside DC.
- **Standard deduction** by days, Calculation C: "Divide Line b by the number 365 (366 if leap year)."
- **Other items:** the same day ratio multiplies "your credit, additions or subtractions amounts not previously prorated". That includes the $3,000 pension exclusion.
- **Statute vs booklet:** D.C. Code 47-1801.04(44)(D) says months (WebFetch-returned: "prorated by the number of months that the individual was a resident"). The booklet uses days.
- **URL:** https://otr.cfo.dc.gov/sites/default/files/dc/sites/otr/publication/attachments/2025_D40_Book_082026_v1.pdf (URL as reported by the helper; text read from the booklet copy).

**Maryland: (a), medium.**
- **Method:** Form 502 with "P".
  - Nonresident-period income is subtracted on line 13.
  - The standard or itemized deduction and the exemptions are multiplied by the Maryland income factor (MD AGI / FAGI).
  - State and county tax are computed on Maryland taxable income on the ordinary schedule.
- **Tax Tip #52**, form text: "The standard deduction must be prorated using the Maryland income factor."
- **Pensions**, same tip: "Prorate the amount on line 5 by the number of months of Maryland residence divided by 12" (or months resident ÷ months receiving the pension, if it started that year).
- **Caveat:** the tip cites the 2014 booklet's instruction numbers.
- **County tax:** county of domicile on the last day of the year (Tax-General 10-103, helper). The engine's flat `localPct` is linear, so its local figure scales either way.
- **URLs:** https://www.marylandtaxes.gov/forms/Personal_Tax_Tips/tip52.pdf; COMAR 03.04.02.12.

**Virginia: (a), high (the reference case, already implemented).**
- **Proration:**
  - Standard deduction × FAGI received while resident ÷ FAGI.
  - $930 and $800 exemptions by days (Ratio Schedule).
  - Age deduction × the Ratio Schedule factor. Search snippet: "Multiply the age deduction by the ratio amount from the Ratio Schedule on Page 39".
- **Tax:** the regular rate schedule.
- **URL:** https://www.tax.virginia.gov/sites/default/files/vatax-pdf/2025-760py-instructions.pdf

**Alabama: (a), high (helper).**
- **Return:** part-year residents file Form 40 with only resident-period income.
- **Deductions**, WebFetch-returned (Form 40 booklet 2025): "Part-year residents are allowed to deduct the full standard deduction, personal, and dependent exemptions."
- **40NR booklet**, form text: "both the total personal exemption and the dependent exemption must be claimed in the part-year resident return … The part year resident return should include only income and deductions incurred during the period of residency."
- **Federal income tax deduction:** prorated.
- **Retirement:** the $6,000 65+ exclusion is limited to retirement income taxable to Alabama.
- **URLs:** https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf; Schedule RS, https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25schrsblk.pdf

**Mississippi: (a), high (helper).**
- **Proration:** line 13c ratio (MS AGI / total AGI) multiplies deductions (14b) and exemptions (15b).
- **Rate:** 0% on the first $10,000, 4.4% above.
- **Quote**, WebFetch-returned: "You will be taxed only on income earned while a resident of Mississippi" … "you will prorate your deductions and exemptions."
- **Retirement:** qualifying retirement income and Social Security are "exempt in total".
- **URL:** https://www.dor.ms.gov/sites/default/files/tax-forms/individual/80100251%202.pdf

**Idaho: (a), high.**
- **Mechanics**, form text (Form 43, 2025):
  - "38. Idaho percentage. Divide line 31, Column B, by line 31, Column A"
  - "39. Multiply amount on line 37 by the percentage on line 38"
  - The line 42 worksheet subtracts a fixed $4,811 (single) before 5.3%. The zero band is not prorated.
- **Retirement**, Form 39NR: "Column B benefits deduction. Multiply line 22f by line 22h". The deduction is cut to the share of benefits received while resident (IDAPA 35.01.01.254).
- **URL:** https://tax.idaho.gov/wp-content/uploads/forms/EIN00046/EIN00046_03-02-2026.pdf

### Method (a), flat rate

**Arizona: (a), high.**
- **Mechanics** (Form 140PY instr. 2025, form text):
  - "Tax Tip: The standard deduction is not prorated."
  - "Line 51 – Prorated Exemptions. Multiply the amount on line 50 by the Arizona income ratio from line 27"
  - "Line 56 – Tax Amount. Multiply line 55 by 2.5% (.025)".
- **Retirement:** the Social Security subtraction is limited to benefits in Arizona income. No proration rule was found for the $2,500 government-pension cap.
- **URL:** https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140PYi.pdf

**Kentucky: (a), medium.**
- **Standard deduction:** 2025 Schedule A instructions, form text: "If you do not itemize, you may elect to take a standard deduction of $3,270 and it does not have to be prorated."
- **Form mechanics**, from the 2020 740-NP; the 2025 form was not reachable:
  - KY AGI (Column B) minus the standard deduction "(do not prorate)" or itemized × KY %, times the flat rate.
  - Personal tax credits × KY %.
- **Retirement:** the pension exclusion ($31,110) sits on the column worksheet. Cap proration was not found.
- **URLs:** https://revenue.ky.gov/Forms/740-NP%20Schedule%20A%20(2025).pdf; https://revenue.ky.gov/Forms/Form%20740-NP.pdf (2020 form).

**Louisiana: (a), high.**
- **Mechanics**, form text (IT-540B 2025):
  - "10 LOUISIANA STANDARD DEDUCTION – … Enter $12,500 if filing status is 1 or 3".
  - "11E ALLOWABLE DEDUCTIONS – Multiply Line 11D by the percentage on Line 9" (itemized excess only).
  - "13 YOUR LOUISIANA INCOME TAX – Multiply Line 12 by .03."
- **Retirement:** exempt-income codes apply only to LA-column income. The 65+ $12,000 cap is not prorated (helper).
- **URL:** https://dam.ldr.la.gov/taxforms/IT540B(2025)WEB-BC-F.pdf

**Georgia: (a), high.**
- **Mechanics:** Schedule 3 line 9 is the ratio (Column C / Column A). The $12,000 standard deduction and $4,000 dependent exemptions × ratio go on line 13. Tax is 5.19%. The DOR also allows a time ratio.
- **Retirement exclusion**, form text (IT-511 2025): "Part-year residents and nonresidents must prorate the retirement income exclusion. The earned income portion and unearned income portion must be separately prorated."
- **URL:** https://dor.georgia.gov/document/document/2025-it-511-individual-income-tax-booklet/download

**Illinois: (a), high.**
- **Mechanics**, form text (Schedule NR 2025):
  - "48 Divide Line 46 by Line 47 (round to three decimal places)."
  - "50 Multiply Line 49 by the decimal on Line 48. This is your Illinois exemption allowance."
  - Tax is 4.95% of Illinois net income.
- **Retirement:** line 42 subtracts retirement income and Social Security received as an Illinois resident.
- **URL:** https://tax.illinois.gov/forms/incometax/currentyear/individual/il-1040-schedule-nr-instr.html

**Indiana: (a), high.**
- **Mechanics:**
  - Column B holds income while resident plus Indiana-source income.
  - Exemptions: Schedule D form text, "9. Multiply line 7 by line 8. Enter here and on Form IT-40PNR, line 6", where line 8 is the Schedule A proration ratio.
  - Flat state rate, plus county tax.
- **URL:** https://forms.in.gov/Download.aspx?id=16921

**Michigan: (a), medium.**
- **Mechanics:** Schedule NR Column B, resident-period plus MI-source income. The exemption × MI / total AGI ratio. 4.25% flat.
- **Statute**, MCL 206.30(5), WebFetch-returned: "that the taxpayer's portion of adjusted gross income from Michigan sources bears to the taxpayer's total adjusted gross income."
- **Retirement:** subtraction caps are not prorated (statute structure plus a secondary source).
- **Access:** michigan.gov returned 403.

**Massachusetts: (a), medium-low.**
- **Mechanics:** resident-period income at 5%. Exemptions × days resident / 365.
- **Source:** search snippet only (mass.gov returned 403): "Prorate your total exemptions claimed on Form 1-NR/PY by multiplying line 22a by line 3".

### Method (c)

**Pennsylvania: (c), high.**
- **Method**, form text (PA-40 IN 2025): "PA law taxes part-year residents on all income from all sources while a PA resident, and all income (loss) earned, received, and realized from PA sources when not a resident".
- **Deductions:** "PA law does not allow standard deductions, deductions for personal exemptions, itemized deductions".
- **URL:** https://www.pa.gov/content/dam/copapwp-pagov/en/revenue/documents/formsandpublications/formsforindividuals/pit/documents/2025/2025_pa-40in.pdf

### Method (b)

**California: (b), medium.**
- **Access:** ftb.ca.gov returned 403 to WebFetch.
- **Mechanics** (search snippets of the 2025 Form 540NR):
  - Line 31 is tax on all-source taxable income.
  - Line 36: "CA Tax Rate. Divide line 31 by line 19"
  - Line 37 = line 35 (CA taxable income) × line 36.
  - Schedule CA (540NR) Part IV prorates the deduction by CA AGI / total AGI. Exemption credits × line 38.
- **Net effect:** tax × CA AGI / total AGI.
- **Retirement:** Column E takes pensions and IRA distributions received while resident.
- **URL:** https://www.ftb.ca.gov/forms/2025/2025-540nr-booklet.pdf

**New York: (b), high.**
- **Method**, form text (IT-203-I 2025): "You will calculate a base tax as if you were a full-year resident, then determine the percentage of your income that is subject to New York State tax".
- **Line 45:** "divide the amount from line 31 in the New York State amount column by the amount from line 31 in the Federal amount column."
- **Pension exclusion:** "a pension and annuity income exclusion of up to $20,000 for each of your taxable periods … include that part of the qualifying pension and annuity income that you received during the period you were a resident, but not more than $20,000."
- **URL:** https://www.tax.ny.gov/pdf/2025/inc/it203i_2025.pdf

**Connecticut: (b), high.**
- **Method**, form text (CT-1040NR/PY instr. 2025): "Nonresidents or part-year residents must calculate the tax in the same manner as resident individuals. Then, nonresidents or part-year residents prorate the tax based upon the percentage of their Connecticut adjusted gross income derived from or connected with Connecticut sources."
- **Special accrual:** applies to part-year residents.
- **Retirement:** treatment in the source column is unverified.
- **URL:** https://portal.ct.gov/-/media/drs/forms/2025/income/2025-ct-1040-nrpy-instructions_1225.pdf

**Delaware: (b), high.**
- **Mechanics** (PIT-NON 2025, form text):
  - "42. TAXABLE INCOME – Subtract Line 41 from Line 38, and compute tax on this amount"
  - "43. TAX LIABILITY COMPUTATION … PRORATION DECIMAL", which is Line 30a / Line 30b.
  - Personal credits: "Multiply this amount by the proration decimal on Line 43".
- **Pension exclusion**, instructions: "Enter in the Delaware column the ratio of pension and eligible retirement income reported in Column B, divided by the pension and eligible retirement income reported in Column A. Multiply this ratio by the pension exclusion amount".
- **Election:** "Part-Year Residents may elect to file either a resident or non- resident return."
- **URL:** https://revenuefiles.delaware.gov/2025/PITForms_Instructions/PIT-NON_2025-01_PaperInteractiveIPM.pdf

**West Virginia: (b), high.**
- **Mechanics**, form text (IT-140 booklet 2025, Schedule A Part I): "4. Tax (divide line 2 by line 3, round to 4 decimal places and multiply the result by line 1." Line 1 is the tentative tax on IT-140 line 7. Line 2 is West Virginia income. Line 3 is federal AGI.
- **Retirement:** the decreasing modifications (Social Security, $8,000 senior) reduce the tentative tax. The ratio uses unreduced federal-AGI amounts.
- **URL:** https://tax.wv.gov/Documents/PIT/2025/it140.PersonalIncomeTaxFormsAndInstructions.2025.pdf

**Vermont: (b), high.**
- **Mechanics**, form text (IN-113 instr. 2025): "Line 35 Divide Line 34 by Line 30. Also enter on Form IN-111, Line 15." IN-111 line 16 = line 14 (tax on all income) × line 15.
- **Column B:** "the Vermont portion is the income received from Vermont sources or received while a Vermont resident."
- **URL:** https://tax.vermont.gov/sites/tax/files/documents/IN-113-Instr-2025.pdf

**Rhode Island: (b), high (helper).**
- **Mechanics:** Schedule III line 14 = line 13 ÷ line 12 Column A. Line 16 = tax × line 14.
- **Quote**, WebFetch-returned: "Divide the amount on line 13 by the amount on line 12, Column A."
- **Retirement:** Schedule M modifications follow the column of the income.
- **URL:** https://tax.ri.gov/sites/g/files/xkgbur541/files/2025-12/2025%201040NR%20Instructions%20122025.pdf

**Minnesota: (b), high.**
- **Mechanics**, form text (Schedule M1NR 2025): "30 Divide line 28 by line 29 … 32 Multiply line 30 by line 31. Enter the result here and on line 13 of Form M1". Line 31 is Form M1 line 12, the tax on all income.
- **URL:** https://www.revenue.state.mn.us/sites/default/files/2026-07/m1nr-25.pdf

**Oregon: (b), high.**
- **Mechanics**, form text (OR-40-P 2025): "45. Oregon income tax. Line 44 multiplied by the Oregon percentage from line 35". The standard deduction is full; the exemption credit is multiplied by the Oregon percentage (helper).
- **URL:** https://www.oregon.gov/dor/forms/FormsPubs/form-or-40-n_or-40-p-inst_101-048-1_2025.pdf

**Wisconsin: (b), high.**
- **Method**, form text (1NPR instr. 2025): "Even though you may start the tax computation based on federal income, the tax will be later prorated based on the ratio of your Wisconsin income to federal income."
- **Line 32** is Wisconsin income ÷ federal income. The standard deduction is looked up on line 33, the larger of the two (in practice federal income).
- **Retirement subtraction:** the new 2025 67+ subtraction (up to $24,000) is prorated by WI AGI / federal AGI (helper, snippet).
- **Engine:** see defect 1.
- **URL:** https://www.revenue.wi.gov/TaxForms2025/2025-Form1NPR-Inst.pdf

**Colorado: (b), medium.**
- **Access:** tax.colorado.gov returned 403.
- **Rule 39-22-110**, WebFetch-returned: "the Colorado income tax calculated as if taxpayer was a full-year Colorado resident … multiplied by the ratio of the Colorado modified federal adjusted gross income".
- **Retirement:** the pension subtraction is allowed only "to the extent the underlying or related income is included in Colorado gross income". Whether the $20,000 / $24,000 caps are cut is unresolved.
- **URL:** https://tax.colorado.gov/sites/tax/files/documents/DR0104PN_2025.pdf

**Utah: (b), high.**
- **Mechanics**, form text (TC-40 instr. 2025): "Nonresidents and part-year residents: Subtract line 24 from line 23 and enter the result on TC-40B … line 40". TC-40B: "Multiply line 40 by the decimal on line 39." The retirement and Social Security credits are apportionable, so they are computed for the full year and then multiplied by the ratio.
- **URL:** https://incometax.utah.gov/instructions/tc-40b

**Montana: (b), high.**
- **Mechanics**, form text (Form 2 instr. 2025): "The tax on Montana source income is first calculated using the taxable income determined as if the taxpayer was a resident. Then, a ratio of the taxpayer's income from Montana sources over income from all sources is applied to the tax."
- **Retirement:** MCA 15-30-2101 makes Social Security and pensions received while resident Montana-source.
- **URL:** https://revenue.mt.gov/files/forms/Montana-Individual-Income-Tax-Return-Form-2-Instructions/2025_Montana_Individual_Income_Tax_Return_Form_2_Instructions.pdf

**New Mexico: (b), medium.**
- **Mechanics** (2025 layout via a third-party copy; the official 2022 PIT-B has the same structure). Search snippets: line 12 = line 11 Column 2 ÷ Column 1, and "MULTIPLY line 12 by line 13. Enter the amount here and on PIT-1, line 18".
- **Retirement:** retirement income received before New Mexico residency is not allocable to New Mexico (NMAC 3.3.11.13).
- **URL:** https://realfile.tax.newmexico.gov/2022pit-b.pdf

**North Dakota: (b), high.**
- **Mechanics**, form text (Schedule ND-1NR 2025):
  - "20. North Dakota income ratio. Divide line 18 by line 19."
  - "23. Tax on North Dakota source income. Multiply line 22 by ratio on line 20."
- **URL:** https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/28724-schedule-nd-1nr-2025.pdf

**Nebraska: (b), medium.**
- **Mechanics:** form text (1040N 2025), line 15: "Partial-year residents and nonresidents enter the result from line 9, NE Sch III". Line 18, the personal exemption credit, is "for residents only".
- **Regulation**, WebFetch-returned (316 NAC 22): "The tax is a percentage of the tax owed by a resident individual with the same taxable income."
- **URL:** https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/f_1040N.pdf

**Kansas: (b), high (helper).**
- **Mechanics:** K-40 line 10 = line 8 × the line 9 Schedule S percentage. WebFetch-returned: "Multiply line 8 by the percentage on line 9 and enter the result on line 10."
- **Deductions:** the standard deduction and exemptions are full.
- **URL:** https://ksrevenue.gov/incomebook25.html

**Oklahoma: (b), high.**
- **Method**, form text (511-NR packet 2025): "After the taxable income is calculated, it is prorated using a percentage of the AGI from Oklahoma sources divided by the AGI from all sources. This prorated tax is the Oklahoma tax."
- **Line 18:** "Multiply line 16 by line 17."
- **Retirement exclusion:** the Oklahoma-column amount is the part tied to Oklahoma income; "This exclusion is not prorated."
- **Correction to the brief:** the ratio is applied to the tax, not to the deductions.
- **URL:** https://oklahoma.gov/content/dam/ok/en/tax/documents/forms/individuals/current/511-NR-Pkt.pdf

**Missouri: (b), medium.**
- **Options**, form text (MO-1040 booklet, 2024 edition): a part-year resident may "be taxed as a resident for the entire year by using the Credit for Income Taxes Paid to Other States … (Form MO-CR)", or "use Missouri Income Percentage (Form MO-NRI)".
- **2025:** the same method per the DOR HTML (helper).
- **URL:** https://dor.mo.gov/forms/MO-NRI_2025.pdf

**Arkansas: (b), high (helper).**
- **Mechanics:** AR1000NR line 38D = net tax (after personal credits) × line 38C (AR AGI / total AGI).
- **Quote**, WebFetch-returned: "After all allowable tax credits have been subtracted from the total tax, prorate the remaining balance."
- **URL:** https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000F_and_AR1000NR_Instructions.pdf

**North Carolina: (b), high.**
- **Mechanics**, form text (D-401 2025): "If you were a part-year resident or nonresident, multiply the amount from Line 12b by the taxable percentage on Line 13." Then 4.25%.
- **Equivalence:** with a flat rate, applying the ratio to taxable income equals applying it to the tax.
- **URL:** https://www.ncdor.gov/2025-d-401-individual-income-tax-instructions/open

**Maine: (b), credit form, high (helper).**
- **Mechanics:** 1040ME taxes all income. The Schedule NR credit = tax × non-Maine AGI / Maine AGI.
- **Quote**, WebFetch-returned: "first calculating a tax amount as if the part-year resident … were a Maine resident … for the entire year and then reducing that amount by a 'nonresident credit.'"
- **URL:** https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/25_1040me_sch_nr_fillable.pdf

**Ohio: (b), credit form, high.**
- **Mechanics**, form text (IT 1040 booklet 2025): "Individuals must use the IT NRC to calculate the nonresident portion of their Ohio adjusted gross income, which is used to calculate the Ohio nonresident credit."
- **URL:** https://dam.assets.ohio.gov/image/upload/v1735920104/tax.ohio.gov/forms/ohio_individual/individual/2025/it1040-booklet.pdf

**Iowa: (b), credit form, high (helper).**
- **Mechanics:** IA 126 credit = (tax − credits) × the non-Iowa percentage.
- **Quote**, WebFetch-returned: "The taxpayer receives a credit against the initial tax liability based on the percentage of income from outside Iowa."
- **URL:** https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/1040-expanded-instructions/credit-nonpart-year-resident

## What the engine does now

`packages/engine/src/tax/stateTax.ts`: `computeStateTaxYearTotal`, `prorateParams`, `prorateInput`.

- **Income:** each slice multiplies every income field by `s = months/12`.
- **Full-year figures:** taxable Social Security and federal AGI are computed once for the full year. A slice takes `s` of the taxable Social Security.
- **What `prorateParams` scales by `s`:**
  - the standard deduction and the age-65 addition;
  - every bracket edge and `baseTax`, except Virginia (`partYearRateSchedule: 'unscaled'`);
  - the retirement-exclusion caps;
  - Virginia's age deduction and exemptions;
  - New Jersey's pension exclusion.
- **Maine:** the deduction phase-out is tested on the full year.
- **What the arithmetic amounts to:** with income, deductions and bracket edges all scaled by `s`, the slice's tax is `s·T(I)`, the months share of a full-year resident's tax.
  - That is method (b) with a months ratio in place of the income ratio.
  - It is exact for (b) when income is even.
  - It overstates a graduated (a) state (convexity).
  - It overstates any (a) state that allows the whole standard deduction (AZ, LA, AL, KY).
- **Rich facts never reach a slice:** characterized rows, household facts, HSA, QCD and NJ IRA pools are all skipped. The year is marked `state-rich-split-year-adapter-required`.

## Design note

### What each method needs

- **(a) resident-period income on the ordinary schedule.** It needs:
  - the slice's own income, item by item, in state terms;
  - the year's deduction and exemption amounts;
  - per state, a deduction ratio and a separate exemption ratio. The observed values:
    - none / full: AZ, LA, AL and KY standard deduction; AL exemptions;
    - income ratio: HI, SC, MD, MS, ID, GA; IL, IN, MI and AZ exemptions;
    - months: NJ exemptions;
    - days: DC, MA; VA exemptions;
    - FAGI ratio: VA standard deduction;
  - the unscaled rate schedule, including any zero band (ID, MS);
  - full-year federal AGI only where a phase-out or ratio reads it.
- **(b) income percentage, including the credit form.** It needs:
  - the full-year tax as if resident, which the rich path already produces (`computeStateTaxYearResult` with no `stateResidency`);
  - a numerator (resident-period income plus nonresident-period state-source income);
  - the state's denominator. The denominator differs in ways that matter to a retiree:
    - NY divides NY-column by federal-column AGI after the $20,000 pension exclusion;
    - DE uses modified DE-source income over DE AGI after its exclusions;
    - WV uses unreduced federal AGI;
    - OK uses OK AGI over all-source AGI;
    - MT uses source income over taxable income.

  So the pack needs a `ratioBasis`, and the numerator needs the slice-allocated characterized rows.
- **(c) Pennsylvania:** slice income × rate, with no deduction.
- **When the methods agree:** only when income is even. Otherwise both follow the dollars received while resident. A Roth conversion or large IRA distribution in the resident months raises the state's share. The engine spreads it by months, so "convert after the move" cannot be represented.

### Retirement-exclusion caps in a part year (per-state pack fact)

| Policy | States |
|---|---|
| Full cap, applied to resident-period receipts only | NY ($20,000 per taxable period), SC, OK ("not prorated"), LA, MI, AL, and likely KY |
| Cap prorated by months | NJ (only if whole-year income ≤ $100k), MD (months / 12, or months resident ÷ months receiving) |
| Prorated by days | VA (age deduction), DC (all subtractions) |
| Prorated by the share of retirement income received while resident | DE, GA, ID, ME |
| Prorated by the income ratio | WI (2025 retirement subtraction) |
| Computed for the full year, then diluted by the tax ratio | Most (b) states: UT credits, VT, MT, NM, OH credits, MN, CT, WV, KS |

Today the engine scales every cap by months (`scaleExclusion`). That is right only for the second row, and only roughly.

### Allocating characterized retirement rows to slices

1. **Dated rows.** A row with `retirementDistributionEvidence.distributionDate`, `qcdEventEvidence.transferDate` or a retirement-action `executionDate` goes whole into the slice holding its date.
2. **Monthly streams.** Social Security (start from `claimAge` and `dob`), pensions (`startAge`), annuities and wages (`endAge`) are allocated by the months they pay inside each slice.
3. **Undated lumps.** RMDs, withdrawals, Roth conversions (`{ year, amount }`), one-time income (`year`), property sales (`plannedSaleYear`) and gains are spread evenly by months. The result says so.
4. **Splitting a row.** A split row keeps its id, owner, source and year-end age, and scales `federallyIncludedAmount`, `grossDistribution`, `rothConversionAmount`, `rothConversionAmountAtAge59HalfOrOlder` and `taxableSocialSecurityAllocated` together.
5. **Basis pools.** The MA, VA, UT, NJ-IRA and CA/NJ HSA pools are committed once a year, after both slices are priced.
6. **Unused override.** `stateAllocation: { state, fraction }[]` on retirement and QCD evidence is parsed but never read by the tax code. It is the natural override.

### What the plan carries and what it lacks

- **Carries:**
  - the move (`stateMoves[].fromYear` and `fromMonth`, month only);
  - birth dates;
  - start months for Social Security, pensions and the end of wages;
  - optional evidence dates;
  - the QCD `residency: 'partYear'` flag.
- **Lacks:**
  - a month on Roth conversions, one-time income, property sales, recurring income, withdrawals, RMDs and gains;
  - the day of the move (DC, MA and VA use days);
  - nonresident-period state-source income;
  - the credit for tax paid to the other state;
  - special accrual on change of residence (CT confirmed in its 2025 instructions; also NY and CA, not checked here);
  - the elections in SC, DE and MO to file as a full-year resident.

### Recommendation (changed from the partial draft)

1. **Pack descriptor, first and cheapest.** Replace `partYearRateSchedule` with:

   `partYear: { method: 'residentPeriod' | 'incomePercentage' | 'incomePercentageCredit' | 'residentPeriodFlatNoDeduction', standardDeductionRatio: 'full' | 'months' | 'days' | 'incomeRatio' | 'fagiRatio', exemptionRatio: …, exclusionCap: 'full' | 'months' | 'days' | 'retirementShare' | 'incomeRatio' | 'viaTaxRatio', ratioBasis?: …, citation }`

   - **What changed:** the draft had a single deduction ratio. It needs a separate standard-deduction and exemption ratio, and a `'full'` option. AZ, LA, AL and KY allow the whole standard deduction, so unscaling the brackets alone does not fix them.
   - **What setting it alone fixes:** every simple-case error except Wisconsin, with no adapter work. Set `residentPeriod` with the right ratios on the 11 overstated states: NJ, HI, SC, DC, MS, AZ, LA, ID, AL, KY, MD.
2. **Price method (b) from the full-year rich path:** `computeStateTaxYearResult(as if full-year resident) × clamp(numerator / denominator)`.
   - This fixes Wisconsin's sliding deduction with it, because the full-year path phases the deduction on the full year's income.
   - It reuses every characterized rule unchanged.
   - If (b) pricing is not built soon, patch defect 1 on its own.
3. **Pass household facts to slices.** Exemptions and credits should be prorated by the pack's ratio rather than dropped (defect 2).
4. **Build the slice allocator** in the projection adapter, by the rule above, for (a) slices and for (b) numerators.
5. **Lift `state-rich-split-year-adapter-required` state by state** as each lands.
6. **Optional:** a `month` on Roth conversions and one-time income, so "convert after the move" can be planned.
