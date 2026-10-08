# Review, 2026-10-08 (part-year-resident-period-codex)

Reviewer: Codex (GPT-6-Sol), headless and read-only, by independent recomputation from the cited primary sources without executing the engine, on a snapshot of branch `claude/engine-0.4.3` at `6e347f249`. The work was done by Claude (Opus). Scope: part-year phase 2 for the resident-period states (AL, AZ, DC, GA, HI, ID, IL, IN, KY, LA, MD, MA, MI, MS, NJ, SC, VA) and Pennsylvania, recomputed from the 2025 part-year forms in the even and uneven (Roth conversion) cases. Verdicts: 16 approve, 3 reject. The reviewer's scripts are published at `DOCS/calculations/reviews/scripts/part-year-resident-period-2026-10-08-codex/`; they run with Python 3 and import nothing from this repository. The only edits to the report below replace local snapshot paths with repository paths. Verbatim output follows.

---

# Independent review — part-year phase 2, resident-period states

Reviewer: **Codex GPT**. Headless, read-only review, 2026-10-08. Snapshot commit: **`6e347f249`**. I did not run or import the engine or its tests. I independently recalculated the fixtures with Python `Decimal` in [scratch/recompute.py](scripts/part-year-resident-period-2026-10-08-codex/recompute.py), using the 2026 pack's stated dollar figures and rates and the cited 2025 return mechanics. “Even / resident / Texas” below means $100,000 spread evenly; then $100,000 plus a $40,000 conversion in the state's six months; then the conversion in Texas's six months. Amounts omit pre-existing engine gaps such as personal exemptions where the test explicitly supplies no household facts or the pack has no field. They use unrounded ratios and continuous pack rate schedules, as the tests do; several actual 2025 forms require ratio rounding and, for incomes under a threshold, a tax table. Those differences are discussed under **limits**.

The test figures come from `statePartYear.rules.test.ts`. The relevant descriptors are in `year2026.ts`; “whole,” “half,” and “ratio” below refer to the deduction or exemption share, not a change to the tax brackets. All single-filer brackets and deductions used below are the 2026 pack values. Texas contributes zero.

## AL — approve

Recomputed **$2,310 / $4,310 / $2,310**, matching the tests: whole $3,000 pack deduction, then $500×2% + $2,500×4% + the remainder over $3,000×5%, on $47,000 / $87,000 / $47,000 taxable. [2025 Form 40 instructions](https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf) put resident-period income on Form 40 and allow the whole standard deduction and exemptions; the descriptor's `residentPeriod`, full deduction/exemptions and full 65+ retirement cap fit. The test does not model Alabama's actual personal exemption or income-sliding deduction, so these are pack-model figures, not a literal completed Form 40.

## AZ — approve

Recomputed **$856.25 / $1,856.25 / $856.25**, matching: ($50,000 / $90,000 / $50,000 − $15,750)×2.5%. [2025 Form 140PY instructions](https://azdor.gov/sites/default/files/document/FORMS_INDIVIDUAL_2025_140PYi_0.pdf) expressly keep the standard deduction whole, prorate exemptions by Arizona income over federal AGI, and tax the Arizona taxable amount at 2.5%; the descriptor matches. The government-pension cap is inapplicable at age 50.

## DC — approve

Recomputed **$2,362.50 / $5,412.50 / $2,362.50**, matching: $15,000×1/2 deduction leaves $42,500 / $82,500 / $42,500; the 2026 schedule gives $400 + $1,800 + $162.50 on $42,500 and $400 + $1,800 + $1,300 + $1,912.50 on $82,500. [2025 D-40 Calculation C and part-year instructions](https://otr.cfo.dc.gov/sites/default/files/dc/sites/otr/publication/attachments/2025_D40_Book_Final_wLinks_030526_v1.0.pdf) use resident-period income and days for standard deduction and related proration. The descriptor's months surrogate is disclosed because the plan lacks a move day; no capped pension amount is earned in this fixture.

## GA — approve

Recomputed **$2,120.75 / $4,009.821429 / $2,227.678571**, matching the test's three-decimal values: ($50,000−$15,000/2), ($90,000−$15,000×9/14), and ($50,000−$15,000×5/14), each ×4.99%. [2025 IT-511 Schedule 3, line 9](https://dor.georgia.gov/document/document/2025-it-511-individual-income-tax-booklet/download) divides Georgia adjusted income by total adjusted income for deductions and exemptions. Its retirement-exclusion instruction prorates earned and unearned components separately; `retirementShare` captures the modeled retirement-receipt limb, but no age-eligible retirement exclusion occurs here.

## HI — approve

Recomputed **$2,395.20 / $5,340.342857 / $2,477.485714**, matching the test's three-decimal values. [2025 N-15, lines 37, 40b, 42b and 44](https://files.hawaii.gov/tax/forms/current/n15_i.pdf) uses Hawaii AGI / total AGI for the deduction and exemptions, then the ordinary tax computation. The 2026 pack's $8,000 deduction becomes $4,000 / $5,142.857143 / $2,857.142857; applying its unscaled brackets to $46,000 / $84,857.142857 / $47,142.857143 gives the figures. The form rounds its ratio and mandates a tax table below $100,000, so these are explicitly unrounded pack-schedule estimates, not exact filed-return amounts.

## ID — approve

Recomputed **$1,968.367 / $3,966.467 / $2,090.267**, matching: deduction $16,100×(1/2, 9/14, 5/14) and a whole $4,811 zero band, followed by 5.3% on the excess. [2025 Form 43 lines 38–42 and instructions](https://tax.idaho.gov/wp-content/uploads/forms/EFO00091/EFO00091_09-29-2025.pdf) prorate the deduction by Idaho adjusted-income percentage and do not prorate the zero band. The descriptor's state-income ratio and retirement-receipt share fit the cited Form 39NR rule; the fixture has no qualifying age-based deduction.

## IL — approve

Recomputed **$2,475 / $2,475 / $2,475**, matching: Illinois removes the $40,000 IRA conversion if received while resident, leaving $50,000×4.95% in all three cases. [2025 Schedule NR, lines 42 and 46–52](https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/incometax/documents/currentyear/individual/il-1040-schedule-nr.pdf) taxes Illinois base income and prorates the personal exemption by Illinois base income / total base income; the descriptor's `stateIncome` ratio is correct. The separate fixture without household facts omits the exemption.

## IN — approve

Recomputed **$1,475 / $2,655 / $1,475**, matching $50,000 / $90,000 / $50,000×the pack's 2.95%. [2025 IT-40PNR forms and booklet](https://secure.in.gov/dor/tax-forms/individual/current/) allocate resident-period income to Indiana and prorate Schedule D exemptions using Schedule A's income percentage, as the descriptor says. The pack has no standard deduction and the test omits exemptions and county tax; the conversion is taxable here.

## KY — reject

Recomputed **$1,632.40 / $1,943.55 / $1,632.40** from the current source. The even and Texas tests match. The resident test expects **$2,487.975**, because code falls back to a **$15,555 half-year pension cap**: ($90,000−$3,360−$15,555)×3.5%. But [2025 Form 740-NP, Section A](https://revenue.ky.gov/Forms/25_42A740-NP.pdf) keeps the standard deduction whole, and [2025 Schedule P, Part III line 3 and its instructions](https://revenue.ky.gov/Forms/Schedule%20P%20%282025%29.pdf) direct 740-NP filers to report only pension income received while a Kentucky resident and take the lesser of that amount or the **full $31,110** cap. The $40,000 IRA conversion is pension/IRA income on federal line 4b under those instructions. Thus ($90,000−$3,360−$31,110)×3.5% = **$1,943.55**, $544.425 below the test. The derivation's “2025 form unreachable/cap not found” premise is obsolete. Also, Form 740-NP's Kentucky-percentage line 34 divides Kentucky AGI (after its pension exclusion) by federal AGI, while the descriptor says `federalAgi`; any future modeled prorated credit would use the wrong numerator.

## LA — approve

Recomputed **$1,113.75 / $2,313.75 / $1,113.75**, matching: ($50,000 / $90,000 / $50,000−the pack's whole $12,875 deduction)×3%. [2025 IT-540B, lines 10–13](https://dam.ldr.la.gov/taxforms/IT540B%282025%29WEB-BC-F.pdf) enters the whole standard deduction and applies the income ratio only to excess itemized deductions; the descriptor matches. Its 65+ capped exclusion does not arise at age 50.

## MD — approve

Recomputed **$2,241.75 / $4,118.678571 / $2,264.821429**, matching the tests' three-decimal values. [Maryland Tax Tip 52](https://www.marylandtaxes.gov/forms/Personal_Tax_Tips/tip52.pdf) multiplies the standard deduction by the Maryland income factor. The pack's $3,400 gives $1,700 / $2,185.714286 / $1,214.285714, leaving $48,300 / $87,814.285714 / $48,785.714286; on the pack schedule this is $90 plus 4.75% of income over $3,000. The descriptor uses Maryland AGI over federal AGI, correctly, and its months-based pension cap follows the tip; the pension cap is inapplicable here. These are state-only figures with no county tax.

## MA — approve

Recomputed **$2,500 / $4,500 / $2,500**, matching $50,000 / $90,000 / $50,000×5%. The [official 2025 Form 1-NR/PY listing](https://www.mass.gov/lists/2025-personal-income-tax-forms-and-instructions) and [Massachusetts DOR's exemption guidance](https://www.mass.gov/info-details/personal-income-tax-exemptions) support resident-period tax and a days-resident exemption ratio; the descriptor uses the disclosed months surrogate. **Access limit:** opening the official 2025 instruction PDF at mass.gov returned HTTP 403, so I could not verify its PDF text directly. The test supplies no household facts, and therefore omits the real personal exemption; government pension exemption is not implicated.

## MI — reject

Recomputed **$2,125 / $3,825 / $2,125**, matching $50,000 / $90,000 / $50,000×4.25%; the age-50 conversion is not eligible for Michigan's pension subtraction. But the descriptor's exemption `ratioBasis: 'stateIncome'` does **not** match [2025 Schedule NR lines 14–19](https://www.michigan.gov/taxes/-/media/Project/Websites/taxes/Forms/IIT/TY2025/Schedule-NR.pdf) or [MCL 206.30(5)](https://www.legislature.mi.gov/mileg.aspx?objectName=mcl-206-30&page=getObject): the exemption ratio is Michigan-source **adjusted gross income** from line 14B over total **adjusted gross income** from line 14A, before Michigan-specific retirement subtractions. In `stateTax.ts`, `stateIncome` is `preExemptionReliefBound` after the state retirement delta, so the descriptor changes that ratio when Michigan modifications are present. The error is dormant in these tests because the Michigan exemption itself is not modeled.

## MS — approve

Recomputed **$1,554 / $1,554 / $1,554**, matching: the conversion is excluded, Mississippi-source income remains $50,000, the pack's $2,300 deduction×1/2 leaves $48,850, and ($48,850−the whole $10,000 zero band)×4% = $1,554. [2025 Form 80-100 instructions, line 13c and lines 14b/15b](https://www.dor.ms.gov/sites/default/files/tax-forms/individual/80100251%202.pdf) use Mississippi income / all-source Mississippi-law income to prorate deductions and exemptions. The IRA-to-Roth exclusion is specifically recognized in the [Mississippi DOR's statutory-change instructions](https://www.dor.ms.gov/sites/default/files/Forms/ProviderProgram/IndividualIncome/indiv_8010010.pdf). The descriptor's state-income ratio and full uncapped exclusion fit. The pack omits the separate personal exemption.

## NJ — approve

Recomputed **$1,242.375 / $3,574.90 / $1,242.375**, matching the tests' continuous 2026 pack schedule: resident income $50,000 / $90,000 / $50,000, less $1,000×1/2 personal exemption. [2025 NJ-1040 instructions](https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf) require a resident return for income received while resident, prorate line-30 exemptions by resident months, and prorate the pension-exclusion maximum at whole-year income at or below $100,000; the descriptor captures those rules. At age 50 there is no pension exclusion. **Form fidelity:** the 2025 line-43 instruction requires its tax table below $100,000; its table yields $1,244 on $49,500 and $3,576 on $89,500, whereas the engine uses the rate schedule. The 2026 table is not in the pack, so these test figures establish the method and rate-schedule approximation only.

## SC — approve

Recomputed **$1,248.25 / $3,064.307143 / $1,359.892857**, matching. The pack's $15,000 SCIAD without supplied annual-AGI household facts is multiplied by 1/2, 9/14 or 5/14; in the resident-conversion case the $3,000 under-65 retirement deduction is also taken. Tax is 1.99% on the first $30,000 taxable, then 5.21%. [2025 Schedule NR instructions](https://dor.sc.gov/sites/dor/files/forms/SchNRInst_2025.pdf) divide pre-modification AGI columns at line 45 for the general deduction and apply the retirement deduction to resident-period qualifying income. The descriptor's federal-AGI ratio, whole retirement cap, and ordinary schedule fit. The 2026 SCIAD's use on Schedule NR is an expressly disclosed extrapolation because the 2026 form was not yet published; supplied $100,000 annual AGI would phase SCIAD out and yield a different figure.

## VA — approve

Recomputed **$2,339.20 / $4,567.325 / $2,411.075**, matching. The $8,750 pack deduction×1/2, 9/14 or 5/14 and $930 exemption×1/2 leave $45,160 / $83,910 / $46,410 taxable; the unscaled Virginia schedule gives $720 on the first $17,000 plus 5.75% of the excess. [2025 Form 760PY instructions](https://www.tax.virginia.gov/sites/default/files/vatax-pdf/2025-760py-instructions.pdf) use the resident-period ordinary schedule, an income fraction for the standard deduction and a days-resident exemption fraction. The descriptor matches those bases with the disclosed months surrogate. No age deduction applies at 50.

## PA — approve

Recomputed **$1,535 / $1,535 / $1,535**, matching $50,000×3.07% in every case. [2025 PA-40 instructions](https://www.pa.gov/content/dam/copapwp-pagov/en/revenue/documents/formsandpublications/formsforindividuals/pit/documents/2025/2025_pa-40in.pdf) tax income received while a resident without a standard deduction or personal exemption, and treat a fully transferred traditional-IRA-to-Roth conversion as nontaxable. `residentPeriod` with zero pack deductions/exemptions implements method (c); full cap policy is inert for this uncapped treatment.

## limits — reject

The detailed [part-year documentation](DOCS/calculations/taxes/state-enacted-tax-year-figures.md) correctly says that a **named Roth conversion's execution date does not reach its account's annual row**. `allocateSplitYear` can place a row only when `distributionDate` is present, and the named conversion's annual row is undated. Yet the [Unreleased Changelog](CHANGELOG.md) describes the remaining limit as undated income spread by months, **“a named conversion's execution date included.”** That wording can be read as saying the date is honored, rather than explicitly saying it is ignored in the annual row. The detailed limits also omit the continuous-schedule versus mandatory-tax-table approximation visible in [NJ-1040 line 43](https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf) and [Hawaii N-15 line 44](https://files.hawaii.gov/tax/forms/current/n15ins.pdf). Ratio rounding, missing nonresident-source income, credits/elections, and day-versus-month approximations otherwise describe the code's boundaries. The Kentucky cap is no longer an unknown source rule: its 2025 Schedule P is available, so the “unknown, months fallback” limit is stale.
