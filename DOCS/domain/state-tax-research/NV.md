# Nevada (NV) — state income tax for retirement planning

Tax year: **2026** (the pack year; nothing below is a dated figure). Researched
2026-08-05 against primary sources only — the Nevada Constitution via
`leg.state.nv.us`. The two URLs this file previously carried were Tax
Foundation pages. Its prose was accurate; nothing in it was authority.

## Summary
- Broad individual income tax: **no** — expressly prohibited by the
  constitution, and the prohibition reaches every kind of personal income
- Taxes Social Security benefits: no
- Long-term capital gains: not taxed
- Retirement income (pension, IRA, 401k): not taxed

## Proposed StateTaxParams (2026)
- code: "NV"
- name: "Nevada"
- hasIncomeTax: false
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: false
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: []
- brackets.marriedFilingJointly: []
- retirement: { kind: "none" }

## What the negative rests on
This is the cleanest of the nine. Nev. Const. art. 10, §1(9):

> No income tax shall be levied upon the wages or personal income of natural
> persons. Notwithstanding the foregoing provision, and except as otherwise
> provided in subsection 1 of this Section, taxes may be levied upon the income
> or revenue of any business in whatever form it may be conducted for profit in
> the State.

Two things make it carry the whole claim. It is a prohibition rather than a
ceiling or a condition, so the Legislature cannot levy at all; and it reaches
"wages **or personal income**", so the second limb covers capital gains,
pension and IRA/401(k) distributions and Social Security alike. A bar written
for wages only would leave every dollar a retiree lives on inside a Nevada
base. The section heading in the same source reads "…inheritance and personal
income taxes prohibited."

The business carve-out in the second sentence is what lets Nevada run its
Commerce Tax on the gross revenue of business entities without touching this.

## Retirement-income detail
Nothing is taxed, so nothing is excluded, and the prohibition is what does it
rather than any exemption. `retirement: { kind: 'none' }` says the engine
grants no exclusion — exact, because there is nothing to exclude from.

## Simplifications / not modeled
- The **Commerce Tax** (NRS ch. 363C) and the **Modified Business Tax** fall on
  businesses, not on an individual's income, and are not modeled. Neither was
  investigated further.
- **Sales tax** (6.85% state rate) and property taxes are out of scope.
- **Not established**: which amendment added subsection 9. The constitution's
  history block lists twelve amendments to art. 10 §1 without mapping them to
  subsections, so attributing subsection 9 to the initiative-petition amendment
  ratified at the 1988 and 1990 general elections is an inference, not
  something the source says. The registered record takes the pack year as its
  `effectiveFrom` rather than resting a date on that inference.

## Citations (primary only)
- individual income tax (the negative) —
  https://www.leg.state.nv.us/const/nvconst.html — art. 10, §1(9), quoted in
  full above.
- brackets, standard deduction, Social Security, capital gains, retirement
  exclusion — **not applicable.** Inert under `hasIncomeTax: false`, and Nevada
  publishes no individual figures because it may not have an individual tax.

## Cross-checks (not authority)
None. The citation above was read out of the constitution.

The two URLs this file previously carried, `taxfoundation.org/location/nevada/`
and `taxfoundation.org/statetaxindex/states/nevada/`, are recorded here as
provenance rather than as cross-checks. `taxfoundation.org` is in the
`SECONDARY_AGGREGATORS` set the conformance suite holds permanently
inadmissible.

## Registered rules
| Rule id | Classification |
|---|---|
| `nv-const-10-1-9-no-personal-income-tax` | settled |
