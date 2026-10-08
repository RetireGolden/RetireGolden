# Review, 2026-10-08 (part-year-methods-codex)

Reviewer: Codex (GPT-6-Sol), headless and read-only, by independent recomputation from the cited primary sources without executing the engine, on a snapshot of branch `claude/queued-0.4.2` at `2abaf4cce`. The work was done by Claude (Opus). Scope: part-year (split-year) methods for NJ, HI, SC, DC, MS, ID, MD, AZ, LA, KY, AL and Wisconsin, recomputed from the 2025 part-year forms, and the restated income-annuity-annual record. Verdicts: 15 approve, 0 reject. The reviewer's scripts are published at `DOCS/calculations/reviews/scripts/part-year-methods-2026-10-08-codex/`; they run with Python 3 and import nothing from this repository. The only edits to the report below replace local snapshot paths with repository paths. Verbatim output follows.

---

# Independent review: part-year state methods, phase 1

Reviewer: **Codex GPT**. Headless, read-only review of snapshot `2abaf4cce` on `claude/queued-0.4.2`. Date: **2026-10-08**. I did not run the engine or its tests or import from `packages/`. I transcribed the relevant 2026 pack figures and recomputed with Python `Decimal` in [scratch/recompute.py](scripts/part-year-methods-2026-10-08-codex/recompute.py). Dollar results below are unrounded rate-schedule results; the displayed cents follow the tests' rounding. The snapshot has no Git metadata, so literal before/after source diffs could not be checked here.

## 1. Method (a): resident-period income on the ordinary schedule

For the specified single filer, annual ordinary income is $100,000 and the six-month resident-period slice is $50,000. The 2025 sources establish the methods; the amounts and rates below are the pack's **2026** figures, not asserted 2025 return amounts. Income and residency ratios both equal one-half in this fixture. Month ratios do not generally replace income or day ratios on actual returns.

### NJ — approve

[NJ-1040 instructions](https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf) direct a part-year resident to report resident-period income on the resident return, prorate the personal exemption by resident months, and use the ordinary tax table/rates. The pack models the $1,000 exemption as $500 and keeps the schedule whole. Taxable income is **$49,500**; $20,000 × 1.4% + $15,000 × 1.75% + $5,000 × 3.5% + $9,500 × 5.525% = **$1,242.375**, displayed **$1,242.38**. This is a rate-schedule approximation to NJ's $50-wide tax table, as the record discloses.

### HI — approve

[Form N-15](https://files.hawaii.gov/tax/forms/2025/n15_i.pdf), lines 37, 40b, 42b and 43–44, applies the Hawaii-to-total AGI ratio to the standard deduction and exemptions, then taxes Hawaii taxable income on the ordinary table. The 2026 pack's $8,000 deduction becomes $4,000. Taxable income **$46,000** gives **$2,395.20** on the pack schedule. Hawaii exemptions are not modeled in this fixture; the quoted 2025 form's deduction amount is different from the enacted 2026 pack amount.

### SC — approve, as a disclosed partial result

[2025 Schedule NR](https://dor.sc.gov/sites/dor/files/forms/SchNR_2025.pdf), lines 45–48, prorates the deduction by the South Carolina-to-total income ratio and sends South Carolina taxable income to the ordinary return. [2026 Act 110](https://www.scstatehouse.gov/sess126_2025-2026/bills/4216.htm) substitutes SCIAD for the old deduction and sets the $30,000 rate break. The modeled unphased $15,000 SCIAD becomes $7,500; $42,500 taxable yields $30,000 × 1.99% + $12,500 × 5.21% = **$1,248.25**. At the fixture's $100,000 federal AGI, Act 110 phases the actual SCIAD to zero; applying the same half ratio would produce **$1,639.00**. The test and rule record expressly distinguish that legal counterfactual, so $1,248.25 is a characterization of the current slice, not an accurate full return.

### DC — approve

The [2025 D-40 booklet](https://otr.cfo.dc.gov/sites/default/files/dc/sites/otr/publication/attachments/2025_D40_Book_082026_v1.pdf), Calculation C, prorates the standard deduction by **days** domiciled and taxes the period's DC income on the ordinary schedule. The engine's half-year month proxy gives a $7,500 deduction and $42,500 taxable: $10,000 × 4% + $30,000 × 6% + $2,500 × 6.5% = **$2,362.50**. An exact six-calendar-month residence need not be exactly half the days.

### MS — approve

[Form 80-100 instructions](https://www.dor.ms.gov/sites/default/files/tax-forms/individual/80100251%202.pdf), lines 13c, 14 and 15, prorate deductions and exemptions by the Mississippi-income ratio. The ordinary 2026 zero band remains $10,000. Deduction $2,300 ÷ 2 = $1,150; ($50,000 − $1,150 − $10,000) × 4% = **$1,554.00**. The statutory personal exemption is not in the pack's modeled figure.

### ID — approve

[Form 43 instructions](https://tax.idaho.gov/wp-content/uploads/forms/EIN00046/EIN00046_03-02-2026.pdf), lines 38–42, apply the Idaho percentage to the deduction but subtract the **whole** zero band on the tax worksheet. Deduction $16,100 ÷ 2 = $8,050; ($50,000 − $8,050 − $4,811) × 5.3% = **$1,968.367**, displayed **$1,968.37**.

### MD — approve for the method and pack arithmetic

[Maryland Tax Tip #52](https://www.marylandtaxes.gov/forms/Personal_Tax_Tips/tip52.pdf) uses the Maryland income factor for the standard deduction and exemptions, and Form 502's ordinary schedule applies. The pack's $3,400 deduction becomes $1,700; taxable income $48,300 gives $20 + $30 + $40 + $45,300 × 4.75% = **$2,241.75**. The [Comptroller's 2026 estimated-tax worksheet](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/forms/worksheets/2026-pv-worksheet.pdf) instead prints $3,350 single: using that figure would give **$2,242.9375**. The test explicitly records this pre-existing parameter discrepancy; this review approves the part-year method and arithmetic from the requested pack, not the pack's separate deduction provenance.

### AZ — approve

[Form 140PY instructions](https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140PYBooklet.pdf) expressly say the standard deduction is **not prorated**; the resident-period taxable income takes the ordinary 2.5% rate. ($50,000 − $15,750) × 2.5% = **$856.25**. The descriptor prorates any applicable exemptions by the Arizona income ratio; none enters this single-filer fixture.

### LA — approve

[Form IT-540B](https://dam.ldr.la.gov/taxforms/IT540B(2025)WEB-BC-F.pdf), lines 10–13, takes the standard deduction whole, prorates only the excess itemized deduction in this portion of the form, and applies the ordinary 3% rate. ($50,000 − $12,875) × 3% = **$1,113.75**.

### KY — approve

[Form 740-NP Schedule A instructions](https://revenue.ky.gov/Forms/740-NP%20Schedule%20A%20(2025).pdf) explicitly say the standard deduction need not be prorated. The 2026 pack gives one $3,360 deduction per return. ($50,000 − $3,360) × 3.5% = **$1,632.40**.

### AL — approve for the modeled amount, with exemption omission

The [2025 Form 40 booklet](https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf) says part-year residents report resident-period income and may take the **full** standard deduction, personal exemption and dependent exemptions; Form 40NR's proration rule is for the separate nonresident return. The descriptor correctly marks deduction and exemptions `full`. The pack has a $3,000 single deduction but **does not model Alabama personal exemptions**. On that explicitly incomplete base, taxable income is $47,000 and $500 × 2% + $2,500 × 4% + $44,000 × 5% = **$2,310.00**. Adding a $1,500 personal exemption would reduce this simple tax by $75; $2,310 is not a complete Form 40 liability.

## 2. Wisconsin — approve

[2025 Form 1NPR instructions](https://www.revenue.wi.gov/TaxForms2025/2025-Form1NPR-Inst.pdf) look up the standard deduction from **federal income on line 31**, apply the Wisconsin-to-federal income ratio at line 32, and tax after the deduction. For the requested 2026 pack figures, the full-year $100,000 income phases the $13,960 maximum to $13,960 − 12% × ($100,000 − $20,120) = **$4,374.40**. Full-year taxable income is $95,625.60; tax is $15,110 × 3.5% + $36,840 × 4.4% + $43,675.60 × 5.3% = **$4,464.6168**. At the fixture's one-half ratio this is **$2,232.3084**, displayed **$2,232.31**. `wisconsinSlice` implements the equivalent scaled parameters. This excludes the personal exemption that the split-year path cannot supply and uses continuous pack arithmetic rather than the form's table rounding.

## 3. Virginia — approve

The current descriptor retains the resident-period, unscaled schedule and prorated standard deduction and exemptions. The previously documented under-65 illustration still recomputes: $30,000 slice − $8,750 ÷ 2 − $930 ÷ 2 = $25,160 taxable; the ordinary Virginia schedule gives **$1,189.20**. The new state entries do not alter that rule in the inspected snapshot. I could not establish byte-for-byte historical unchanged status because the supplied snapshot has no `.git` directory; the current behavior and the stated prior worksheet agree. [Form 760PY instructions](https://www.tax.virginia.gov/sites/default/files/vatax-pdf/2025-760py-instructions.pdf) use actual residency and income factors where the engine uses months.

## 4. Stated limits — approve

The `va-code-58-1-322-03-2-personal-exemptions` record and Unreleased changelog identify the remaining split-year approximation plainly. `computeStateTaxYearTotal` constructs prorated coarse inputs; the rich-result path flags a split year as incomplete. A slice lacks the household facts needed for the listed exemptions, credits and Iowa alternate-tax test; SC therefore takes an unphased SCIAD, whose **$390.75** understatement in the fixture is quantified above. Characterized retirement rows are not allocated between states. The coarse retirement caps and NJ pension maximum use month scaling although state-specific returns can use a different ratio or whole amount. Income-percentage methods substitute residency months for their own tax/income ratios. These are disclosed limits, not claims of whole-return accuracy. The statement about “every retirement-exclusion cap” is read in the context of caps used by this coarse slice; specialized rich-fact rules do not run on allocated characterized rows.

## 5. Restated `income-annuity-annual` record — approve with verification boundary

The record's annuity payment worksheet remains $1,500 × 12 × 1.02 × 60% = **$11,016**; the part-year change affects only its separate pre-start purchase limit text. For “Moving in retirement,” Kentucky's July 2029 half-year slice now takes an additional $3,360 ÷ 2 = $1,680 deduction, worth **$58.80** at 3.5%. The stated lifetime tax change, **$732,565.75 − $732,506.95 = $58.80**, has exactly that sign and magnitude. For U1, the 2026-start annuity effect changes from **−$147,623.51 to −$147,615.81**, a $7.70 improvement. Its Kentucky-to-Florida November move and the same whole-deduction rule make that direction and scale plausible; the exact $7.70 is a **difference between two projections**, with and without the annuity, and cannot be derived from the available isolated slice worksheet. I verified its arithmetic difference and the record's consistency with the method; I did **not** verify either full-horizon output, ending-investable compounding or the 2027-start pin, because the requested review forbids running the projection.
