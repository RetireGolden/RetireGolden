# Hawaii (HI) — state income tax for retirement planning

Tax year: 2026. Researched 2026-06-13; standard deduction corrected 2026-09-07.

## Summary
- Broad individual income tax: **yes** (graduated, 1.4%–11.0%, 12 brackets; widened by Act 46, SLH 2024)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: preferential — capped at 7.25% (modeled as ordinary; flagged)
- Retirement income: employer-funded pensions fully exempt; **IRA/401(k) distributions fully taxable**

## Proposed StateTaxParams (2026)
- code: "HI"
- name: "Hawaii"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 8000, marriedFilingJointly: 16000 }
- brackets.single:
  - { lowerBound: 0, ratePct: 1.4 }
  - { lowerBound: 9600, ratePct: 3.2 }
  - { lowerBound: 14400, ratePct: 5.5 }
  - { lowerBound: 19200, ratePct: 6.4 }
  - { lowerBound: 24000, ratePct: 6.8 }
  - { lowerBound: 36000, ratePct: 7.2 }
  - { lowerBound: 48000, ratePct: 7.6 }
  - { lowerBound: 125000, ratePct: 7.9 }
  - { lowerBound: 175000, ratePct: 8.25 }
  - { lowerBound: 225000, ratePct: 9.0 }
  - { lowerBound: 275000, ratePct: 10.0 }
  - { lowerBound: 325000, ratePct: 11.0 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 1.4 }
  - { lowerBound: 19200, ratePct: 3.2 }
  - { lowerBound: 28800, ratePct: 5.5 }
  - { lowerBound: 38400, ratePct: 6.4 }
  - { lowerBound: 48000, ratePct: 6.8 }
  - { lowerBound: 72000, ratePct: 7.2 }
  - { lowerBound: 96000, ratePct: 7.6 }
  - { lowerBound: 250000, ratePct: 7.9 }
  - { lowerBound: 350000, ratePct: 8.25 }
  - { lowerBound: 450000, ratePct: 9.0 }
  - { lowerBound: 550000, ratePct: 10.0 }
  - { lowerBound: 650000, ratePct: 11.0 }
- retirement: { kind: "none" }

## Standard deduction — operative law (2026 phase)

Haw. Rev. Stat. § 235-2.4(a)(2)(F) sets the standard deduction for taxable years beginning after December 31, 2025 at **$8,000** for an unmarried individual and **$16,000** on a joint return. Limb (F) governs tax years beginning after December 31, 2025 through **2026–2027**; limb (G) applies from taxable years beginning after December 31, 2027 (**2028** onward) with different amounts that are outside this pack.

The [Hawaii DOTAX HRS ch. 235 compilation](https://files.hawaii.gov/tax/legal/hrs/hrs_235.pdf) is labeled an unofficial compilation as of December 31, 2025; the operative section and effective-year language are nevertheless explicit. The engine models supported single and married-filing-jointly statuses only; head-of-household, married-filing-separately, and surviving-spouse limbs are outside this record.

### Historical context

Act 46, SLH 2024 doubled the 2025 standard deduction to $4,400 / $8,800 and widened brackets. The 2026 pack previously carried those 2025 amounts; it now reflects the post-2025 (F) phase.

## Retirement-income detail
Hawaii has a 12-bracket graduated tax from 1.4% to 11.0%. Brackets were **substantially widened for 2025** by Act 46, SLH 2024 (single 1.4% bracket now runs to $9,600; 11% top rate starts at $325,000). MFJ brackets are exactly **2×** the single brackets (verified).

Hawaii fully exempts **employer-funded pension** distributions (public and private) where the employee did not contribute. However, distributions from traditional **IRAs and 401(k)/deferred-compensation** plans are treated as a return on individual investment and are **fully taxable**. Because the common modern retiree's IRA/401(k) income is taxed, this maps to `retirement: { kind: "none" }` (conservative for those with a true non-contributory employer pension). The private-pension distinction is **not modeled** in the current pack.

## Social Security

Hawaii lists IRC section 86 among the Internal Revenue Code provisions that are **not operative** for Hawaii income-tax purposes (Haw. Rev. Stat. § 235-2.3(b)(3)). The quoted paragraph names tier 1 railroad retirement alongside Social Security, but the settled fixture at `hi-hrs-235-2-3-social-security-subtraction` exercises only the Social Security `ssBenefits` path; tier 1 railroad eligibility typing is not certified by that fixture, and there is no separate railroad-retirement registered record. Social Security benefits included in federal adjusted gross income therefore do not enter the Hawaii base. Employer-funded pension exclusions under § 235-7 are registered separately at `hi-hrs-235-7-pension-and-social-security`.

## Simplifications / not modeled
- Fully-employer-funded pension exemption not modeled (`none` overstates tax for retirees with a traditional non-contributory pension). The model targets the dominant IRA/401(k) case, which Hawaii taxes.
- Capital gains: Hawaii caps the long-term capital-gains rate at **7.25%**; we set `capitalGainsAsOrdinary: true`, which overstates tax for high-bracket filers with large gains.
- Employee-contributed pensions are partially taxable (pro-rata); not modeled.
- Standard deduction phases after 2027 under § 235-2.4(a)(2)(G) and later limbs; only the 2026–2027 (F) phase is carried.
- Head-of-household, MFS, and surviving-spouse standard-deduction amounts not modeled.

## Citations
- https://files.hawaii.gov/tax/legal/hrs/hrs_235.pdf — Haw. Rev. Stat. § 235-2.3(b)(3) (IRC § 86 nonoperative; Social Security exclusion).
- https://files.hawaii.gov/tax/legal/hrs/hrs_235.pdf — Haw. Rev. Stat. § 235-2.4(a)(2)(F) (2026–2027 standard deduction phase).
- https://files.hawaii.gov/tax/news/announce/ann24-03.pdf — Hawaii DOTAX Announcement 2024-03: Act 46 bracket/standard-deduction changes effective 1/1/2025.
- https://support.taxslayer.com/hc/en-us/articles/360029385331-Is-my-retirement-income-taxable-to-Hawaii — secondary aggregator: employer pensions exempt; IRA/401(k) taxable (retirement-income limb only).
