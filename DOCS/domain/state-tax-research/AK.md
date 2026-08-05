# Alaska (AK) — state income tax for retirement planning

Tax year: **2026** (the pack year; nothing below is a dated figure). Researched
2026-08-05 against primary sources only — Alaska Statutes chapter 43.20 via
`akleg.gov`. The previous version of this file rested on a single Tax Foundation
page. Its conclusion was right and nothing in it was authority.

## Summary
- Broad individual income tax: **no** — and not by absence. Alaska Stat.
  §43.20.012(a) expressly excludes an individual and a fiduciary from the only
  income tax Alaska has.
- Taxes Social Security benefits: no
- Long-term capital gains: not taxed
- Retirement income (pension, IRA, 401k): not taxed

## Proposed StateTaxParams (2026)
- code: "AK"
- name: "Alaska"
- hasIncomeTax: false
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: false
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: []
- brackets.marriedFilingJointly: []
- retirement: { kind: "none" }

## What the negative rests on
Alaska levies an income tax. Chapter 43.20 is captioned "Alaska Net Income Tax
Act", and §43.20.011(e) imposes a tax "upon the entire taxable income of every
corporation derived from sources within the state". What §43.20.012(a) then
does is take individuals out of it: "The tax imposed by this chapter does not
apply to (1) an individual; (2) a fiduciary".

That enumeration is worth more than an absence would be. Where a state's
negative rests on no chapter existing, a reader has to be persuaded that a list
of impositions is exhaustive; here the exclusion is written down. It is the
strongest footing available short of a constitutional prohibition.

What it does not carry is permanence. Alaska has no constitutional bar on an
individual income tax, so §43.20.012(a) can be amended by simple majority.
Alaska belongs on the annual re-verification list for that reason.

## Retirement-income detail
Nothing is taxed, so nothing is excluded. Wages, capital gains, Social
Security, private pensions and traditional IRA/401(k) distributions are all
outside chapter 43.20 by §43.20.012(a), whatever their amount and whatever the
recipient's age. `retirement: { kind: 'none' }` is the right shape: it says the
engine grants no exclusion, which is exactly true, because there is nothing to
exclude from.

## Simplifications / not modeled
- The **Permanent Fund Dividend** is not modeled. It is state-paid income and
  federally taxable, but the engine has no input for it, and it is not an
  Alaska income tax in either direction.
- **Local sales taxes** (borough and municipal) and property taxes are out of
  scope for this doc, which covers individual income tax only.
- Alaska's **corporate** income tax under §43.20.011(e) is real, is not an
  individual tax, and is not modeled.
- **Not established from primary sources**: when the individual tax ended. The
  current statute's codifier notes attribute the repeal of §43.20.010 to
  § 13 ch 70 SLA 1975 and the repeal of §43.20.011(a)–(d) to § 10 ch 1 SSSLA
  1980, but neither session law is published on `akleg.gov` in any form found,
  and those notes are the codifier's rather than enacted text. The registered
  record therefore takes the pack year as its `effectiveFrom` rather than
  inferring 1981.

## Citations (primary only)
- individual income tax (the negative) —
  https://www.akleg.gov/basis/statutes.asp?media=print&type=fetch&secEnd=43.20.030
  — Alaska Stat. §43.20.012(a): "The tax imposed by this chapter does not apply
  to (1) an individual; (2) a fiduciary;". The imposition it excludes them from
  is §43.20.011(e), on the same page.
- brackets, standard deduction, Social Security, capital gains, retirement
  exclusion — **not applicable.** Every one of these fields is inert under
  `hasIncomeTax: false`, and Alaska publishes no individual figures because it
  has no individual tax.

A note on the URL. The practitioner address is
`https://www.akleg.gov/basis/statutes.asp#43.20.012`, which resolves in a
browser and returns a 14 kB shell to everything else — `akleg.gov` serves its
statutes through an AJAX endpoint. The print-fetch URL above is the same
publisher serving the same chapter, and it is the one that actually contains
the words quoted. Cite it, or the quotation cannot be checked against the
document it claims to come from.

## Cross-checks (not authority)
None. The citation above was read out of the statute.

The URL this file previously carried,
`taxfoundation.org/data/all/state/state-income-tax-rates/`, is recorded here as
provenance rather than as a cross-check. It is in the `SECONDARY_AGGREGATORS`
set the conformance suite holds permanently inadmissible.

## Registered rules
| Rule id | Classification |
|---|---|
| `ak-stat-43-20-012-a-tax-does-not-apply-to-individuals` | settled |
