# South Dakota (SD) — state income tax for retirement planning

Tax year: **2026** (the pack year; nothing below is a dated figure). Researched
2026-08-05 against primary sources only — the Department of Revenue via
`dor.sd.gov` and the South Dakota Constitution via `sdsos.gov`. The citation
this file previously carried was a bare bibliographic string, "Tax Foundation,
State Individual Income Tax Rates and Brackets 2025", with no URL at all.

## Summary
- Broad individual income tax: **no** — but by legislative choice, not by
  constitutional bar. Article XI, §2 expressly empowers the Legislature to
  impose one.
- Taxes Social Security benefits: no
- Long-term capital gains: not taxed
- Retirement income (pension, IRA, 401k): not taxed

## Proposed StateTaxParams (2026)
- code: "SD"
- name: "South Dakota"
- hasIncomeTax: false
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: false
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: []
- brackets.marriedFilingJointly: []
- retirement: { kind: "none" }

## What the negative rests on, and why it is the weaker kind
There is no prohibition to quote, and the constitution runs the other way.
S.D. Const. art. XI, §2:

> The Legislature is empowered to impose taxes upon incomes and occupations,
> and taxes upon incomes may be graduated and progressive and reasonable
> exemptions may be provided.

So South Dakota's negative is a pure policy fact: the Legislature has the
constitutional power and has never used it. That makes the Department of
Revenue's own sentence **load-bearing** rather than decorative — it is the only
affirmative text stating the negative at all:

> South Dakota is one of seven states that does not impose a state income tax.

One partial brake exists and is worth recording, but never as the authority for
the negative. Art. XI, §13 requires either an initiative or a two-thirds vote
of each house before "the rate of taxation imposed by the state of South Dakota
on personal or corporate income" may be increased. Whether imposing a tax where
the rate is currently zero counts as "increas[ing]" it is genuinely open on the
text and was not resolved; no construction of it was found.

South Dakota is therefore one ordinary session away from changing, and belongs
on the annual re-verification list for that reason rather than out of routine.

## Retirement-income detail
Nothing is taxed, so nothing is excluded. `retirement: { kind: 'none' }` says
the engine grants no exclusion, which is exact: there is nothing to exclude
from.

## Simplifications / not modeled
- **Sales/use and property taxes**, which is where South Dakota's revenue
  actually comes from, are out of scope for this doc.
- The **bank franchise tax** is not an individual income tax and was not
  investigated.
- **Not verified, and it cannot be**: that South Dakota Codified Laws title 10
  contains no individual income tax chapter. No `.gov` host serves SDCL text to
  a non-browser client — every `sdlegislature.gov` `/Statutes/*` path returns a
  Vue shell, and the API host 404s on every statutes route tried — so the code
  was never read section by section, and neither this file nor the registered
  record claims it was. The negative rests on the department's statement.
- **Not established**: when South Dakota last levied an individual income tax,
  or whether it ever did. The registered record uses the pack year as its
  `effectiveFrom` rather than asserting "never", which would be a guess.
- The department's business page separately states that "South Dakota does not
  impose a corporate income tax", which is a useful consistency check and is
  not evidence about individuals.

## Citations (primary only)
- individual income tax (the negative) — https://dor.sd.gov/individuals/taxes/
  — Department of Revenue, Individuals → Taxes, under its `Income Tax` heading:
  "South Dakota is one of seven states that does not impose a state income
  tax." Verified against the page's own markup, not a rendered summary.
- what the constitution actually says —
  https://sdsos.gov/general-information/about-state-south-dakota/docs/2024%20South%20Dakota%20Constitution.pdf
  — art. XI, §2 (the grant, quoted above) and art. XI, §13 (the
  supermajority/initiative condition on a rate increase).
- brackets, standard deduction, Social Security, capital gains, retirement
  exclusion — **not applicable.** Inert under `hasIncomeTax: false`, and South
  Dakota publishes no individual figures because it has no individual tax.

## Cross-checks (not authority)
- https://mylrc.sdlegislature.gov/api/Documents/IssueMemo/252628.pdf?Year=2023
  — S.D. Legislative Research Council, "Comparison of Neighboring State Tax
  Systems", p. 9: "Of the states that are examined in this document, South
  Dakota and Wyoming do not impose an individual income tax." Agrees, 2026-08-05.
  Listed here rather than under Citations because the department's own page
  already carries the claim and this adds corroboration, not authority. Note
  the host serves this **gzip-encoded under a `.pdf` name**; decompress before
  extracting text.

The previous citation, an undated "Tax Foundation, State Individual Income Tax
Rates and Brackets 2025" string with no URL, is recorded as provenance rather
than as a cross-check. `taxfoundation.org` is in the `SECONDARY_AGGREGATORS`
set the conformance suite holds permanently inadmissible.

## Registered rules
| Rule id | Classification |
|---|---|
| `sd-no-individual-income-tax` | settled |
