# Maine (ME) — state income tax for retirement planning

Tax year: 2026. Researched 2026-06-13; standard-deduction correction 2026-09-05.

> **2026 update (PR #23 review, 2026-07-17; age-addition correction 2026-09-05):**
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
> **Impact disclosure:** the legally verified class is 2026+ below the
> §5124-C(2) phase-out. Actual modeled reach is wider because the phase-out is
> unmodeled (high-income age-65 rows also change), the sole 2026 pack is the
> stand-in for earlier years (not certified historical amounts), and future age
> amounts scale with assumed plan inflation rather than a statutory COLA oracle.
> Unmodeled phase-out can further understate high-income Maine tax; the
> unmodeled personal exemption can offset on a complete return, so no net Form
> 1040ME tax direction is asserted. Observed 1,224-case regression vector:
> nine changed rows, all Maine age-65+.
>
> Source (primary): MRS 2026 rate schedule PDF (rev. May 20, 2026),
> https://www.maine.gov/revenue/sites/maine.gov.revenue/files/2026-05/ind_tax_rate_sched_2026_rev.pdf;
> 36 M.R.S. §5124-C(1-B).

## Summary
- Broad individual income tax: **yes** (graduated, 5.8%–7.15%, plus surcharge bracket)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): excluded up to $48,216 per person (2025 figure carried), reduced by Social Security/Railroad Retirement received
- Standard deduction (2026): Maine basic **$15,700 / $31,400** plus IRC 63(c)(3) age-65 addition (**$2,050 / $1,650** per eligible person)

## Proposed StateTaxParams (2026 pack)
- code: "ME"
- name: "Maine"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 15700, marriedFilingJointly: 31400 }
- standardDeductionAge65AdditionConformity: "federal"
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
- retirement: { kind: "capped", capPerPerson: 48216 }

## Retirement-income detail
Maine has three graduated brackets for 2026 plus the surcharge top bracket.
Single thresholds are $27,400 and $64,850; MFJ thresholds are $54,850 and
$129,750 (MRS 2026 rate schedule). Social Security benefits are fully exempt.

Maine offers a **pension income deduction** of up to **$48,216 per eligible
recipient** for 2025 (carried pending a dedicated 2026 refresh), covering
employer pensions and IRA/401(k) distributions (the deduction is per person, so
both spouses can claim it on a joint return). The deduction is **reduced
dollar-for-dollar by Social Security and Railroad Retirement benefits**
received. Mapped to `retirement: { kind: "capped", capPerPerson: 48216 }`, no
age gate (Maine's pension deduction is not strictly age-conditioned for the
general non-military deduction).

## Modeled standard-deduction example (below phase-out)

Independent worksheet, single Maine resident, wages/ordinary income $30,000,
inflation scale 1, AGI below §5124-C(2) phase-out — **modeled pack taxable
income only** (personal exemption not subtracted):

| Age | Modeled taxable base | Modeled tax at 5.8% |
|---|---:|---:|
| 64 | $30,000 − $15,700 = **$14,300** | **$829.40** |
| 65 | $30,000 − $15,700 − $2,050 = **$12,250** | **$710.50** |

Age benefit: **$118.90**. If the $5,300 personal exemption alone were also
modeled, the age-65 first-bracket tax would be **$403.10**; that line remains
unmodeled and is not a certified Form 1040ME liability.

## Simplifications / not modeled
- The pension deduction's reduction by SS/Railroad Retirement received is not modeled — modeling the full $48,216 cap understates Maine tax for retirees with large SS benefits.
- Military retirement pay is fully exempt (separate, uncapped); approximated by the $48,216 cap (conservative for military retirees).
- Standard deduction **phase-out** for high earners (§5124-C(2)) not modeled. The settled legal component is limited to 2026+ below phase-out, but the runtime age addition is unconditional, so high-income age-65 rows also change and can further understate Maine tax there.
- **Personal exemption** ($5,300 on the MRS 2026 schedule) not modeled; that omission can offset the age-addition effect on a complete return, so no net Form 1040ME tax direction is asserted.
- **Blindness** additional amount not modeled — the engine age counter drives IRC 63(f) age relief only.
- Head-of-household basic amounts and other Form 1040ME lines outside the pack levers are not modeled.
- Pre-2026 Maine inputs use the sole 2026 state pack as a parameter stand-in; those dollars are not certified historical Maine amounts.
- Brackets and the Maine basic are CPI-adjusted under Maine law; the engine holds pack-year nominals for the basic ($15,700 / $31,400 published, no COLA reconciliation claimed here) and scales only the borrowed federal age addition with assumed plan inflation, not a statutory COLA oracle.

## Citations
- https://www.maine.gov/revenue/sites/maine.gov.revenue/files/2026-05/ind_tax_rate_sched_2026_rev.pdf — MRS 2026 rate schedules (basic $15,700/$31,400; age/blindness addition $2,050 unmarried / $1,650 married; brackets and surcharge).
- https://legislature.maine.gov/statutes/36/title36sec5124-C.html — 36 M.R.S. §5124-C(1-B) basic + IRC 63(c)(3) additional; subsection 2 phase-out.
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section63&num=0&edition=prelim — IRC 63(c)(3), 63(f)(1).
- https://www.irs.gov/irb/2025-45_IRB — Rev. Proc. 2025-32 §4.14(3) (2026 age-65 addition amounts).
- https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/ind_tax_rate_sched_2025.pdf — 2025 schedules (historical).
- Tax Foundation, State Individual Income Tax Rates and Brackets — ME rates context.
