# West Virginia (WV) — state income tax for retirement planning

Tax year: 2026. Researched 2026-09-05 (rates); Social Security full exemption previously verified 2026-08-04.

> **2026 update (SB 392 / §11-21-4j, 2026-09-05):** During the 2026 Legislative Session, SB 392
> delivered an across-the-board personal income tax cut. Signed **March 31, 2026**; W. Va. Code
> **§11-21-4j** codified effective **June 12, 2026**, **retroactive to January 1, 2026** (Tax Division
> restatement). Subsection (a) sets one five-band table for individuals other than married-filing-separately
> filers — including joint returns — at **2.11% / 2.81% / 3.16% / 4.22% / 4.58%** with shared break points
> **$0 / $10,000 / $25,000 / $40,000 / $60,000**. Subsection (e) applies §11-21-4j for all taxable years
> beginning on or after January 1, 2026 in lieu of §11-21-4i. Primary:
> [§11-21-4J](https://code.wvlegislature.gov/11-21-4J/) and
> [Tax Division 2026 Income Tax Rate Cut](https://tax.wv.gov/Individuals/Pages/PersonalIncomeTaxReductionBill.aspx).
>
> The sole published state pack also stands in for pre-2026 and future years under the existing pack
> fallback. Statutory authority for these rates is **2026+**; using the pack outside 2026 is a stand-in,
> not proof of the historical §11-21-4i table. Future enactment monitoring remains.

## Summary
- Broad individual income tax: **yes** (graduated, **2.11%–4.58%** for 2026 under §11-21-4j(a))
- Taxes Social Security benefits: **no** from 2026 — full exemption at every income level
  (`wv-code-11-21-12-social-security-full-modification`; pack `taxesSocialSecurity: false`)
- Long-term capital gains: modeled as ordinary income (`capitalGainsAsOrdinary: true`; preferential treatment not verified in this rate review)
- Retirement income (pension, IRA, 401k): generally taxed; age-65+ may deduct up to $8,000 per person
  from any income (pack maps this as a capped retirement exclusion — see simplifications)

## Current StateTaxParams (2026)
- code: "WV"
- name: "West Virginia"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single:
  - { lowerBound: 0, ratePct: 2.11 }
  - { lowerBound: 10000, ratePct: 2.81 }
  - { lowerBound: 25000, ratePct: 3.16 }
  - { lowerBound: 40000, ratePct: 4.22 }
  - { lowerBound: 60000, ratePct: 4.58 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 2.11 }
  - { lowerBound: 10000, ratePct: 2.81 }
  - { lowerBound: 25000, ratePct: 3.16 }
  - { lowerBound: 40000, ratePct: 4.22 }
  - { lowerBound: 60000, ratePct: 4.58 }
- retirement: { kind: "capped", capPerPerson: 8000, minAge: 65 }

## Historical 2025 (distinct; superseded for TY2026+)
- Rates under prior §11-21-4i: **2.22% / 2.96% / 3.33% / 4.44% / 4.82%** at the same
  **$0 / $10,000 / $25,000 / $40,000 / $60,000** bounds (single and MFJ shared).
- Social Security in 2025: **partial** — 65% of federally taxable benefits exempt (35% still taxed)
  above AGI thresholds; full exemption below $50,000 single / $100,000 MFJ, phasing to full exemption in 2026.
- Keep 2025 figures for historical comparison only; do not treat them as current pack authority.

The exported selector resolves requested WV TY2025 to the sole 2026 pack, so a modeled taxable base of
$100,000 yields **$3,782.50** under current pack rates — not the enacted 2025
[§11-21-4i(a)](https://code.wvlegislature.gov/11-21-4I/) rate-only figure of **$3,981.50** (a **$199.00**
understatement on rates alone; statute freshly verified in independent adjudication). The current-pack
historical approximation remains uncorrected; exact historical pack resolution is unimplemented. Correcting
only the rate schedule would not certify other 2025 base modifications, including partial Social Security
taxation. No test freezes this incorrect 2025 dollar result; this paragraph does not assert a legal TY2025
tax liability.

## Retirement-income detail
West Virginia taxes income at graduated rates. For 2026, §11-21-4j(a) uses **2.11%–4.58%** with
bracket thresholds **the same for single and MFJ** (not doubled). Subsection (b) publishes a separate
married-filing-separately schedule with half-sized bounds; the engine's accepted filing-status model
does not carry MFS, so that schedule is out of pack scope. WV has **no standard deduction**; it uses
$2,000-per-person personal exemptions instead (set `standardDeduction: 0`, noted below).

**Social Security** is fully exempt from tax years beginning on or after January 1, 2026
(§11-21-12(c)(8)(A)/(B)/(E)/(F)); the pack already ships `taxesSocialSecurity: false`.

Residents **age 65+** (or permanently disabled) may deduct **up to $8,000 per person** of income from
any source. Mapped to `retirement: { kind: "capped", capPerPerson: 8000, minAge: 65 }`.

### Modeled tax deltas on the pack taxable base (rates only; not a full IT-140)
Independent §11-21-4j arithmetic on the modeled taxable base (zero standard deduction, no exemptions):

| Taxable base | Prior §11-21-4i | §11-21-4j (2026) | Delta |
|-------------:|----------------:|-----------------:|------:|
| $10,000 | $222.00 | $211.00 | −$11.00 |
| $100,000 | $3,981.50 | $3,782.50 | −$199.00 |

These figures are rate-schedule math only. A full Form IT-140 is **not certified**: personal exemptions,
the senior any-income / disability modification beyond the pack's retirement-bucket mapping, and
pension-subtype subtractions remain unmodeled.

## Simplifications / not modeled
- No standard deduction; **$2,000-per-person personal exemptions** not modeled (overstates tax).
- The **$8,000 senior deduction** applies to any income source (and disability), not just pension/IRA;
  mapping it to `retirement` is an approximation.
- Government/military pension subtractions and other listed modifications not separately modeled.
- Married-filing-separately §11-21-4j(b) schedule not modeled.
- Full IT-140 reconciliation not certified.

## Citations (primary only)
- brackets — https://code.wvlegislature.gov/11-21-4J/ — W. Va. Code §11-21-4j(a)/(e): 2026 rates
  2.11%–4.58% at $0/$10k/$25k/$40k/$60k; applies in lieu of §11-21-4i for TY beginning on/after 2026-01-01.
- brackets (Tax Division restatement) — https://tax.wv.gov/Individuals/Pages/PersonalIncomeTaxReductionBill.aspx
  — SB 392 signed 2026-03-31; effective 2026-06-12; retroactive to 2026-01-01; same non-MFS table.
- Social Security — https://code.wvlegislature.gov/11-21-12/ — §11-21-12(c)(8) full modification from 2026 (prior citation retained; not re-verified in this rate review).
- standard deduction — none published; personal exemptions under §11-21-16 are unmodeled (`standardDeduction: 0`).
- capital gains — **NOT SOURCED** for separate preferential-rate treatment in this bounded rate review — current ordinary-income treatment (`capitalGainsAsOrdinary: true`) remains an existing modeled assumption pending primary reconciliation.
- retirement exclusion — age-65/disability modification under §11-21-12(c)(9) (pack maps capped retirement; prior citation retained).

## Cross-checks (not authority)
Aggregators may be used only as change-detectors. **Do not cite Tax Foundation (or any aggregator) as
authority for the corrected 2026 rates** — those figures come from §11-21-4j and the Tax Division page above.
