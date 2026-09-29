## Claim

Kind: data. `params/state/index.ts#stateParamsFor` resolves a state for a year after the latest published state figures (2026) by applying every enacted-year module at or before that year in order (`params/state/data/enacted2027.ts#stateEnacted2027` through `enacted2033.ts#stateEnacted2033`). Each field an entry names replaces the field, for every filing status the entry carries; a field named as `null` ends; a field no entry names keeps the 2026 figure. A field can be a rate schedule, the standard deduction, a retirement exclusion, a surtax band, a state-specific block, or whether the state taxes income at all.

The same change corrects the 2026 figures the survey of every state found wrong. The loaded figures are listed below; each has its own rule record. The list is what has been verified against the statutes, not a claim that no other state has changed: the survey of all 51 jurisdictions, recorded state by state in [later-years-survey-2026-09-28.md](../../domain/state-tax-research/later-years-survey-2026-09-28.md), covers the rest. Each loaded figure is carried forward nominally until a later enacted step.

`tax/stateTax.ts#computeStateTaxYearResult`, which the projection prices each year's state tax through, reads `stateParamsFor`.

## Justification

Each figure is law in force on 2026-09-28 that names the year, with no condition attached.

### Enacted for 2027 and later

| State | Years | Figure | Authority (rule record) |
|---|---|---|---|
| Indiana | 2027 on | 2.9% | IC 6-3-2-1(b)(8) (`ic-6-3-2-1-flat-rate-ramp`) |
| Mississippi | 2027, 2028, 2029, 2030 on | 3.75%, 3.5%, 3.25%, 3% above the 10,000 dollar band | Miss. Code Ann. 27-7-5(1)(b)(ii)4-7 (`ms-27-7-5-rate-ramp`) |
| Montana | 2027 on | 4.7% to 65,000 single, 97,500 head of household, 130,000 joint; 5.4% above; gains 3.0% / 4.1% at the same breaks | MCA 15-30-2103 (`mt-mca-15-30-2103-2027-rate-schedule`) |
| Nebraska | 2027 on | 3.99% for rates three and four | Neb. Rev. Stat. 77-2715.03 (`neb-rev-stat-77-2715-03-2027-rates-three-and-four`) |
| North Carolina | 2027-2029, 2030-2032, 2033 on | 3.49%, 3.24%, 2.99% | S.L. 2026-41, section 44.1(a) (`nc-sl-2026-41-2027-flat-rate`, `nc-sl-2026-41-rate-steps-2030-and-after`) |
| Hawaii | 2027-2028, 2029 on | Act 24 tables: 2.5% and 5% in the second and third bands, no 7.9% band, 13% above 500,000 single, 1,000,000 joint, 750,000 head of household; from 2029 wider low bands and no 7.6% band | Act 24, SLH 2026 (`hi-act-24-2026-rate-schedules`) |
| Hawaii | 2028, 2030, 2031 on | standard deduction 9,000 / 18,000, 10,000 / 20,000, 12,000 / 24,000 | HRS 235-2.4(a)(2)(G)-(I) (`hi-hrs-235-2-4-a-2-g-to-i-standard-deduction-steps`) |
| New York | 2027-2032, 2033 on | the five lowest rates 0.1 point lower; top rate 8.82% | Tax Law 601(a), (c) (viii), (ix) (`ny-tax-601-2027-rate-cuts-and-2033-top-rate`) |
| Rhode Island | 2027, 2028, 2029 on | surtax of 1%, 2%, 3% on taxable income over 1,000,000 | 44-30-2.6(c)(3)(A)(I)(2) (`ri-44-30-2-6-high-income-surtax`) |
| Rhode Island | 2027 on | Social Security modification without the age test | 44-30-12(c)(8)(ii) (`ri-h7127-2027-social-security-modification-without-age-test`) |
| Virginia | 2027, 2028-2029, 2030 on | standard deduction 9,200 / 18,400, 9,300 / 18,600, 3,000 / 6,000 | Va. Code 58.1-322.03(1)(b) (`va-code-58-1-322-03-standard-deduction-steps`) |
| Georgia | 2027 on | retirement exclusion 70,000 at 65 or older | O.C.G.A. 48-7-27(a)(5)(A)(xiv) (`ga-hb-463-2027-retirement-exclusion`) |
| Delaware | 2027, 2028, 2029 on | military pension subtraction 15,000, 20,000, 25,000; a greater-of limb at 60 and over | 30 Del. C. 1106(b)(3) (`de-code-30-1106-b-3-military-pension-steps-2027-2029`) |
| Illinois | 2029 on | exemption 1,000 per exemption | 35 ILCS 5/204(b) (`il-35-ilcs-5-204-b-basic-amount-1000-from-2029`) |
| Maine | 2027 on | standard deduction equal to the federal one | 36 M.R.S. 5124-C(1-D) (`me-pl-2025-c650-k-15-federal-standard-deduction-from-2027`) |
| Maryland | 2027, 2028, 2029, 2030 on | public-safety retirement subtraction 17,000, 18,000, 19,000, 20,000 | Tax-General 10-207(mm) (`md-tg-10-207-mm-public-safety-retirement-subtraction`) |
| Oregon | 2032 on | retirement income credit ends | Or. Laws 2009, ch. 913, section 36 (`or-laws-2009-c913-s36-retirement-credit-ends-2032`) |
| California | 2030 on | military retirement and Survivor Benefit Plan exclusions end | RTC 17132.9, 17132.10 (`ca-rtc-17132-9-10-military-retirement-exclusions`) |
| California | 2031 on | the 10.3%, 11.3% and 12.3% bands end | Cal. Const. art. XIII, sec. 36(f)(2) (`ca-const-art-13-sec-36-f-2-top-bands-end-2031`) |
| Washington | 2028 on | 9.9% of federal AGI less long-term gains less 1,000,000, the deduction indexed every second year from 2029 | ESSB 6346 (`wa-essb-6346-2028-income-tax`, `wa-essb-6346-s316-standard-deduction-indexing`) |

### Corrected for 2026

| State | Figure | Before | Authority (rule record) |
|---|---|---|---|
| Arkansas | top rate 3.7% | 3.9% | 2026 Ark. Acts (1st Ex. Sess.), Act 1 (`aca-26-51-201-published-indexed-rate-schedule`) |
| District of Columbia | own basic deduction 15,000 / 30,000 plus the 63(c)(3) addition for 2026 to 2029, indexed from 2027, federal from 2030 | federal 16,100 / 32,200 | D.C. Act 26-416, 47-1801.04(3A) and (44) (`dc-code-47-1801-04-3a-standard-deduction-2026-2029`) |
| Maryland | standard deduction 3,400 / 6,850 | 3,350 / 6,700 | Tax-General 10-217(c) (`md-tg-10-217-2026-indexed-standard-deduction`) |
| Maryland | 2% on net capital gain above 350,000 of federal AGI | not modeled | Tax-General 10-105(a)(3)-(4) (`md-tg-10-105-a-3-capital-gain-surtax`) |
| Maryland | public-safety retirement subtraction 16,000 at 55 | not modeled | Tax-General 10-207(mm) (`md-tg-10-207-mm-public-safety-retirement-subtraction`) |
| Virginia | personal exemptions 930, plus 800 at 65 | not modeled | Va. Code 58.1-322.03(2) (`va-code-58-1-322-03-2-personal-exemptions`) |
| Rhode Island | pension modification up to 50,000; Social Security modification below the AGI limits at full retirement age | 20,000; Social Security taxed for everyone | 44-30-12(c)(8)-(9) (`ri-gen-laws-44-30-12-c-8-c-9-2026-modifications`) |
| California | military retirement and Survivor Benefit Plan exclusions, 20,000 each | not modeled | RTC 17132.9, 17132.10 (`ca-rtc-17132-9-10-military-retirement-exclusions`) |
| Arizona, Colorado, Idaho | the federal senior deduction, 6,000 per person 65 or older less 6% of MAGI above 75,000 (150,000 joint), through 2028 | not carried | `ars-43-1022-35-federal-senior-deduction-subtraction`, `co-crs-39-22-104-federal-taxable-income-senior-deduction`, `id-h559-2026-conformity-senior-deduction` |

### Not loaded: a condition decides them, on a known date

- Colorado's TABOR temporary rate cut: the executive director's estimate due October 1, 2026 (C.R.S. 39-22-627).
- Georgia's rate cut, standard deduction and dependent exemption steps (HB 463): the Office of Planning and Budget's determination as of December 1, 2026, and each December 1 after.
- Minnesota's one-year first-tier cut: the commissioner, by December 15, 2026 (Minn. Stat. 290.036).
- Oklahoma's quarter-point cuts: the State Board of Equalization, preliminary in December 2026 and final in February 2027, for 2028 at the earliest (68 O.S. 2355).
- Michigan's one-year cut below 4.25%: the January 2027 revenue conference (MCL 206.51).
- South Carolina's top-rate cut: the Board of Economic Advisors forecast in effect on February 15, 2027 (S.C. Code 12-6-510(C)(2)).
- Kansas (K.S.A. 79-32,110c), Missouri (RSMo 143.011.4) and West Virginia (W. Va. Code 11-21-4h): determinations not yet published.
- Indiana's cuts from 2030 (IC 6-3-2-1(b)(9)-(15)), Mississippi's from 2031 (2025 H.B. 1, section 2) and North Carolina's from 2035 (G.S. 105-153.7(a1)): later revenue determinations.

In each of those years the engine overstates the tax if the condition is met.

### Loaded, with a vote pending

Enacted law with a vote pending is loaded as current law, with the vote named and dated, and revisited when it is decided:

- Washington's income tax from 2028. Initiative 645, certified for the November 3, 2026 ballot, repeals chapter 238, Laws of 2026.
- The end of California's top three bands from 2031. Proposition 3, on the same ballot, would make them permanent.
- The District of Columbia's own standard deduction for 2026 to 2029. D.C. Act 26-416, an emergency act effective August 13, 2026 for no more than 90 days (to about November 11, 2026), sets it; the temporary law whose text the code site printed, D.C. Law 26-89, expired September 25, 2026; the permanent act, D.C. Act 26-418, is under congressional review with a projected law date of November 20, 2026, when this is revisited. If it fails and no further emergency act follows, the code's permanent text returns to the federal deduction.

### Indexed figures held at their latest published amounts

A figure a state statute indexes stands at its latest published amount in every later year; it is not projected at the plan's inflation, so tax is overstated by more each year the projection runs. Among the figures loaded here: Nebraska's 2027 thresholds (draft forms only), Montana's breaks from 2028, Rhode Island's surtax threshold from 2028 and Social Security limits, Maryland's deduction from 2027, and Illinois's exemption for 2027 and 2028. The registered approximation `neb-rev-stat-77-2715-03-3-indexed-brackets-held-nominal` lists every figure the survey found indexed and pins Nebraska's brackets. Washington's deduction is the exception: ESSB 6346 section 316 indexes it every second year from 2029 by one year's inflation, rounded to $1,000, and the engine projects it on that schedule at the plan's inflation (`wa-essb-6346-s316-standard-deduction-indexing`, unsettled: the contrary reading starts in 2030); at 2.5% a year it is $1,025,000 for 2029 and 2030 and $1,051,000 for 2031 and 2032.

### Washington's capital-gains add-back

Section 302(3) of ESSB 6346 adds back into the income-tax base, for a filer who owes the RCW 82.87 capital gains tax that year, the Washington capital gains taxed under it plus the RCW 82.87.060(1) deduction, with the section 205 credit for the capital gains tax. The engine leaves every long-term gain out of the Washington base, as it leaves out the capital gains excise itself, so this is a stated limit.

### Filing statuses

The plan models single and married filing jointly. Head of household and qualifying surviving spouse need dependents, which the plan does not collect, so a state's head-of-household schedule or deduction is used only on a state return whose filing status is set to head of household (in the planner, the state filing status under Assumptions, State tax worksheet facts). Delaware's new domicile test for the pension subtraction at 60 or older needs a domicile history the plan does not hold and is assumed to be met.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Filing status | married filing jointly, both 61; Georgia both 70; Washington single, 61 | |
| Income, the state standard deduction plus the state taxable income | IN 100,000; MS 104,600; NE 117,700; NC 125,500; MT 182,200; HI 116,000; NY 3,016,050; RI 2,022,400; VA 118,400; ME 132,200; CA 1,011,412; WA 1,500,000 | dollars |
| Georgia retirement income (all of the income) | 200,000 | dollars |
| Plan inflation (so federal-conformed deductions are not scaled) | 0 | percent/year |

## Arithmetic

Indiana 2027: `100,000 × 2.9% = 2,900`.

Mississippi, on `90,000` above the band: 2027 `× 3.75% = 3,375`; 2028 `× 3.5% = 3,150`; 2029 `× 3.25% = 2,925`; 2030 `× 3% = 2,700`.

Nebraska 2027: `8,250 × 2.46% + 41,280 × 3.51% + 50,470 × 3.99% = 202.95 + 1,448.928 + 2,013.753 = 3,665.631`.

North Carolina: 2027 `100,000 × 3.49% = 3,490`; 2030 `× 3.24% = 3,240`; 2033 `× 2.99% = 2,990`.

Montana 2027: `130,000 × 4.7% + 20,000 × 5.4% = 6,110 + 1,080 = 7,190`.

Hawaii, 116,000 of income: 2027, deduction 16,000, taxable 100,000, `4,291 + 4,000 × 7.2% = 4,579`; 2029, deduction 18,000, taxable 98,000 on the 2029 table, `3,514 + 2,000 × 6.8% = 3,650`; 2031, deduction 24,000, taxable 92,000, `1,978 + 20,000 × 6.4% = 3,258`.

New York, 3,000,000 of taxable income: 2027 `143,107 + 844,650 × 9.65% = 224,615.725`; 2033 `143,107 + 844,650 × 8.82% = 217,605.13`.

Rhode Island, 2,000,000 of taxable income: `82,050 × 3.75% + 104,400 × 4.75% + 1,813,550 × 5.99% = 116,667.52`; plus the surtax on 1,000,000, 1% in 2027 (`126,667.52`) and 3% in 2029 (`146,667.52`).

Virginia, 118,400 of income, two exemptions of 930: 2027, deduction 18,400, taxable 98,140, `720 + 81,140 × 5.75% = 5,385.55`; 2030, deduction 6,000, taxable 110,540, `720 + 93,540 × 5.75% = 6,098.55`. The 720 is `3,000 × 2% + 2,000 × 3% + 12,000 × 5%`.

Maine 2027, deduction 32,200, taxable 100,000: `54,850 × 5.8% + 45,150 × 6.75% = 3,181.30 + 3,047.625 = 6,228.925`.

Georgia 2027, 200,000 of retirement income, deduction 30,000, exclusion 70,000 each: taxable 30,000, `× 4.99% = 1,497`.

California, 1,000,000 of joint taxable income: to 145,448, `221.58 + 607.40 + 1,215.04 + 1,930.80 + 2,429.12 = 6,403.94`. 2030 adds `597,510 × 9.3% + 148,584 × 10.3% + 108,458 × 11.3% = 83,128.336`, total `89,532.276`; 2031 adds `854,552 × 9.3% = 79,473.336`, total `85,877.276`.

Washington 2028, single: `(1,500,000 − 1,000,000) × 9.9% = 49,500`.

## Expected

| Quantity | Value |
|---|---:|
| Indiana 2027 tax | 2,900 |
| Mississippi 2027 tax | 3,375 |
| Nebraska 2027 tax | 3,665.631 |
| North Carolina 2027 tax | 3,490 |
| Montana 2027 tax | 7,190 |
| Mississippi 2028 tax | 3,150 |
| Mississippi 2029 tax | 2,925 |
| Mississippi 2030 tax | 2,700 |
| North Carolina 2030 tax | 3,240 |
| North Carolina 2033 tax | 2,990 |
| Hawaii 2027 tax | 4,579 |
| Hawaii 2029 tax | 3,650 |
| Hawaii 2031 tax | 3,258 |
| New York 2027 tax | 224,615.725 |
| New York 2033 tax | 217,605.13 |
| Rhode Island 2027 tax | 126,667.52 |
| Rhode Island 2029 tax | 146,667.52 |
| Virginia 2027 tax | 5,385.55 |
| Virginia 2030 tax | 6,098.55 |
| Maine 2027 tax | 6,228.925 |
| Georgia 2027 tax | 1,497 |
| California 2030 tax | 89,532.276 |
| California 2031 tax | 85,877.276 |
| Washington 2028 tax | 49,500 |

Each 2027 figure for an ordinary-income joint household is also the state tax the projection publishes for it (`YearResult.tax` under a state-only calculator); every figure is priced through the same annual resolver. The other loaded items (Rhode Island's Social Security modification, Delaware's military limbs, Illinois's exemption, Maryland's subtraction and surtax, Oregon's credit, California's military exclusions, and the 2026 corrections) need facts these households do not carry and are priced by their rule records. Tolerance: absolute `$0.005`.

## Wrong readings

- The 2026 figures standing in for every later year (what the engine did before these were loaded): Indiana `2,950`, Mississippi `3,600`, Nebraska `3,948.263`, North Carolina `3,990`, Montana `7,572.50`; Hawaii `5,382.40` on the 2026 tables; New York `224,939.55`; Rhode Island `116,667.52` with no surtax; Virginia `5,544.25` on the 8,750 / 17,500 deduction with no exemptions; Maine `6,282.925` on its own 31,400; Georgia `1,996` at the 65,000 exclusion; California `89,532.276` in 2031; Washington `0`.
- The repealed Act 46 tables for Hawaii (`4,694` in 2027), which Act 24 struck before they took effect.
- The 2027 rate held forward over the later steps: Mississippi `3,375` for 2028 to 2030, North Carolina `3,490` for 2030 and 2033.
- The enacted figures reaching back into an earlier year, or any of the conditional changes above loaded before its determination.

## Family

outputs: none.

feeds: `tax-total-annual`; `relocation-lifetime-state-local-tax`.

## Provenance

Derived by: claude (Claude Opus 5.5), 2026-09-28, under decision D-2027-PUBLISHED-FIGURES and the decision of 2026-09-28 that state income tax follows each state's enacted law, from the statutes and agency publications each rule record quotes, fetched that day and checked with verify-quotes. The first version covered five states' 2027 rates; the same day it gained the later unconditional steps, and then, after an independent review found the set incomplete and a survey of all 51 jurisdictions followed, the widened set and the 2026 corrections above. Reviewed by: unreviewed, until a Codex or Cursor review; the catalog requires a reviewer of a different agent family.
