# Maine (ME) — state income tax for retirement planning

Tax year: 2026. Researched 2026-06-13; standard-deduction correction 2026-09-05.

> **2026 update (PR #23 review, 2026-07-17; age-addition and phase-out correction 2026-09-05):**
> Maine **decoupled from the federal basic standard deduction** for tax years
> from 2026 (36 M.R.S. §5124-C(1-B)). Per the MRS revised 2026 rate schedule
> (rev. 2026-05-20): **basic** standard deduction **$15,700 / $31,400**; brackets
> 5.8% / 6.75% / 7.15% at **$27,400 / $64,850** single and **$54,850 / $129,750**
> MFJ; plus a new **2% surcharge** on taxable income over $1,000,000 single /
> $1,500,000 MFJ (encoded in the pack as an equivalent 9.15% top bracket;
> surcharge thresholds index from 2027).
>
> Subsection (1-B)(B) separately makes the **additional** standard deduction the
> amount allowed under IRC §63(c)(3). The settled repair models only the
> **§63(f)(1) age** limb for 2026: **$2,050** unmarried / **$1,650** married or
> qualifying surviving spouse per age-65 condition (MRS schedule; IRS Rev. Proc.
> 2025-32). Blindness and head-of-household basics remain outside that settled
> component. The pack therefore keeps Maine’s published basic amounts **without**
> `standardDeductionConformity: 'federal'`, and marks
> `standardDeductionAge65AdditionConformity: 'federal'` so the resolver attaches
> the federal age-65 addition without federally scaling Maine’s basic.
>
> **§5124-C(2) phase-out:** the engine now phases out the **combined** basic
> plus age total once modeled Maine AGI exceeds **$102,250** single /
> **$204,550** MFJ (over **$75,000 / $150,000** ranges; fully out at
> **$177,250 / $354,550**). Phase-out income is a **modeled Maine-AGI proxy**
> (wages plus represented modifications), not certified Form 1040ME AGI. Split-
> year residency uses the annual fraction before month proration — still the
> existing month approximation, not statutory apportionment.
>
> **§5403 annual indexing:** the basic standard deduction (§5124-C(1-B)) and the
> phase-out numerator starts (§5124-C(2)) are restated each year under 36 M.R.S.
> §5403. Subsection (2) requires the assessor, on or about September 15, to
> multiply the COLA adjustment by the §5124-C(1-B) basic amount; subsection (4)
> does the same for the numerator dollars in §5124-C(2)(A)–(C). The registry
> records `mrs-36-5124-c-1-b-decoupled-standard-deduction` and
> `mrs-36-5124-c-2-standard-deduction-phaseout` cite both limbs and are
> `annuallyIndexed`. A re-verification pass must open §5403 and the September
> MRS restatement — not treat the pack figures below as frozen statutory amounts.
>
> Source (primary): MRS 2026 rate schedule PDF (rev. May 20, 2026),
> https://www.maine.gov/revenue/sites/maine.gov.revenue/files/2026-05/ind_tax_rate_sched_2026_rev.pdf;
> MRS 2026 phase-out worksheet (rev. December 2025); 36 M.R.S. §5124-C(1-B) and (2);
> 36 M.R.S. §5403(2) and (4).

## Summary
- Broad individual income tax: **yes** (graduated, 5.8%–7.15%, plus surcharge bracket)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): excluded up to **$49,824 per person** for 2026 (MRS July 2026 Form 1040ES-ME instructions; pack aligned)
- Standard deduction (2026): Maine basic **$15,700 / $31,400** plus IRC 63(c)(3) age-65 addition (**$2,050 / $1,650** per eligible person), with §5124-C(2) proportional phase-out above the published starts

## Proposed StateTaxParams (2026 pack)
- code: "ME"
- name: "Maine"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 15700, marriedFilingJointly: 31400 }
- standardDeductionAge65AdditionConformity: "federal"
- standardDeductionPhaseout: { startsAt: { single: 102250, marriedFilingJointly: 204550 }, range: { single: 75000, marriedFilingJointly: 150000 } }
- brackets.single:
  - { lowerBound: 0, ratePct: 5.8 }
  - { lowerBound: 27400, ratePct: 6.75 }
  - { lowerBound: 64850, ratePct: 7.15 }
  - { lowerBound: 1000000, ratePct: 9.15 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 5.8 }
  - { lowerBound: 54850, ratePct: 6.75 }
  - { lowerBound: 129750, ratePct: 7.15 }
  - { lowerBound: 1500000, ratePct: 9.15 }
- retirement: { kind: "capped", capPerPerson: 49824 }

## Retirement-income detail
Maine has three graduated brackets for 2026 plus the surcharge top bracket.
Single thresholds are $27,400 and $64,850; MFJ thresholds are $54,850 and
$129,750 (MRS 2026 rate schedule). Social Security benefits are fully exempt.

Maine offers a **pension income deduction** under 36 M.R.S. §5122(2)(M-2). For
tax year 2026, Maine Revenue Services' July 2026 Form 1040ES-ME instructions
publish a maximum of **$49,824** per eligible recipient — tied to the annual
Social Security benefit at retirement age as of January 1, 2026. The nonmilitary
limb in §5122(2)(M-2)(1)(a) limits the deduction to qualifying retirement-plan
benefits included in federal adjusted gross income and reduces the pension amount
by gross Social Security and Railroad Retirement benefits (floor at zero).
Military retirement is a separate full-deduction limb under §5122(2)(M-2)(1)(b).
From 2025, §5122(2)(M-3) phases the nonmilitary deduction down above an indexed
federal-AGI threshold.

The pack maps `retirement: { kind: "capped", capPerPerson: 49824 }` with no age
gate and no Social Security offset. Registry record
`me-mrs-36-5122-2-m2-m3-2026-pension-deduction` registers the exact 2026
maximum and discloses that the flat cap cannot enforce plan qualification,
military separation, the gross-benefit offset, or the M-3 phaseout.

## Modeled standard-deduction examples

Independent worksheet, single Maine resident, wages/ordinary income, inflation
scale 1 — **modeled pack taxable income only** (personal exemption not
subtracted):

| Wages | Age | Modeled taxable base | Modeled tax |
|---:|---:|---:|---:|
| $30,000 | 65 | $12,250 | $710.50 |
| $139,750 | 65 | $130,875 | $8,837.8625 |

At $139,750 the §5124-C(2) fraction is 0.5 on the combined $17,750 deduction
(allowed $8,875). Age benefit at that income is $1,025 of deduction and
$73.2875 of tax, not the full $2,050 / $146.575.

## Simplifications / not modeled
- **Pension deduction scope:** the flat cap does not verify that every `privateRetirementIncome` dollar qualifies under M-2, does not separate military retirement (§5122(2)(M-2)(1)(b)), does not reduce the nonmilitary maximum by gross Social Security or Railroad Retirement (§5122(2)(M-2)(1)(a)), and does not apply the M-3 federal-AGI phaseout. The runtime cap matches the July 2026 MRS maximum (**$49,824**); the offset and phaseout omissions can still move modeled tax in either direction.
- **Personal exemption** ($5,300 on the MRS 2026 schedule) not modeled; that omission can offset modeled tax on a complete return, so no net Form 1040ME tax direction is asserted.
- **Blindness** additional amount not modeled — the engine age counter drives IRC 63(f) age relief only.
- Head-of-household basic amounts and other Form 1040ME lines outside the pack levers are not modeled.
- Modeled Maine AGI is a proxy: not every §5122 modification is representable in the plan model.
- Pre-2026 Maine inputs use the sole 2026 state pack as a parameter stand-in; those dollars are not certified historical Maine amounts.
- Brackets are annually indexed (September restatement). The Maine basic and the §5124-C(2) phase-out starts are indexed under §5403(2) and §5403(4). The engine holds pack-year nominals transcribed from the published MRS schedule — $15,700 / $31,400 basic and $102,250 / $204,550 phase-out starts for 2026 — and does not auto-reconcile them with each year's statutory restatement. Range widths ($75,000 / $150,000) stay fixed per §5124-C(2). Only the borrowed federal age addition is inflation-scaled with assumed plan inflation, not a statutory COLA oracle.
- Part-year residency remains month proration of income, deductions, and brackets — not certified statutory nonresident apportionment.

## Citations
- https://www.maine.gov/revenue/sites/maine.gov.revenue/files/2026-05/ind_tax_rate_sched_2026_rev.pdf — MRS 2026 rate schedules (basic $15,700/$31,400; age/blindness addition $2,050 unmarried / $1,650 married; brackets and surcharge).
- https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/26_item_stand_%20ded_phaseout_wksht_0.pdf — MRS 2026 phase-out worksheet (rev. December 2025).
- https://legislature.maine.gov/statutes/36/title36sec5124-C.html — 36 M.R.S. §5124-C(1-B) basic + IRC 63(c)(3) additional; subsection 2 phase-out.
- https://legislature.maine.gov/statutes/36/title36sec5403.html — 36 M.R.S. §5403(2) basic standard-deduction indexing; §5403(4) phase-out numerator indexing (September restatement).
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section63&num=0&edition=prelim — IRC 63(c)(3), 63(f)(1).
- https://www.irs.gov/irb/2025-45_IRB — Rev. Proc. 2025-32 §4.14(3) (2026 age-65 addition amounts).
- https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/26_1040es_fillable.pdf — MRS 2026 Form 1040ES-ME Instructions (rev. July 2026): TY2026 pension maximum $49,824.
- https://legislature.maine.gov/statutes/36/title36sec5122.html — 36 M.R.S. §5122(2)(M-2) pension deduction; (M-3) AGI phaseout.
- https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/ind_tax_rate_sched_2025.pdf — 2025 schedules (historical).
- Tax Foundation, State Individual Income Tax Rates and Brackets — ME rates context.
