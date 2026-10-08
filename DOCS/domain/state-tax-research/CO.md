# Colorado retirement tax rules — TY2026

Colorado starts from federal taxable income, modified by statutory additions and subtractions, at the enacted 4.4% rate. The federal standard deduction already enters that base; no second Colorado standard deduction applies.

## Social Security and pension shared cap

Each recipient has a $20,000 cap at ages 55–64 or $24,000 at 65+. Taxable Social Security consumes the cap first. At 65+, a benefit above $24,000 increases the cap to that benefit. At 55–64, a benefit above $20,000 increases the cap only if AGI is at most $75,000 individual/$95,000 joint. Otherwise the ordinary cap remains. Social Security below the ordinary cap leaves capacity for other eligible pension income. Joint taxable benefits are allocated in the gross-benefit ratio. Premature IRA amounts require statutory eligibility; death/disability and survivor facts are distinct from the ordinary age test. RRA benefits have a separate federally protected subtraction.

Examples from the statute: age 65 with $30,000 taxable SS excludes $30,000; age 60 at AGI $75,000 with $18,000 taxable SS and $10,000 pension excludes $20,000 total. Unknown recipient/source/inclusion facts produce incomplete status.

## High-AGI deduction addback

Beginning in TY2026, federal AGI at least $300,000 triggers an addback of actual federal standard/itemized deductions above $1,000 single or $2,000 joint. This uses the deduction actually claimed.

## Sources and scope

[C.R.S. 39-22-104(3)(p.7), (4)(f)](https://olls.info/crs/crs2026-title-39.htm) and [Colorado DOR Social Security, pensions and annuities](https://tax.colorado.gov/sites/tax/files/documents/ITT_Social_Security_Pensions_and_Annuities_Jan_2025.pdf). Verified September 12, 2026. The characterized state calculation applies these rules; the record does not claim all Colorado credits, itemization choices or whole-return fidelity.

## Part-year residents (2026-10-08)

Method (b), Rule 39-22-110 (DR 0104PN returned 403): the tax as a full-year resident times Colorado modified federal AGI over modified federal AGI; how the pension subtraction's caps apply to a part year is unresolved (co-crs-39-22-104-federal-base-and-pension-cap). The 2026 figures carry it as `partYear: { method: 'incomePercentage', ratioBasis: 'stateIncome' }` (params/state/data/year2026.ts), priced by tax/stateTax.ts#computeSplitYearResult on the income tax/statePartYear.ts#allocateSplitYear gives the months resident: a dated distribution or QCD transfer whole in the slice of its month, Social Security by the months paid, everything else by the months.

A single filer of 50 with $100,000 of ordinary income spread over 2026, resident six months in Colorado and six in Texas, owes $1,845.80 for the Colorado months, the same as before. With a $40,000 Roth conversion on top, the slice is $3,504.60 when the conversion falls in the months resident and $1,947.00 when it falls in Texas's, where the months share of the year gave $2,725.80 either way. How the return applies its capped retirement exclusion to a part year is not stated, so the slice takes the year's exclusion times the months, and the split year is marked incomplete (`state-rich-split-year-adapter-required`) only where the whole cap on the slice's own receipts would give it a different income: with income spread evenly, where the slice's qualifying retirement income exceeds the months' share of the cap.

The limits every state shares (days priced as months, undated income spread by months, nonresident-period source income, the credit for tax paid to the other state, special accrual and the full-year elections not modeled) are in `va-code-58-1-322-03-2-personal-exemptions`; the worked figures are in packages/engine/src/tax/statePartYear*.rules.test.ts.
