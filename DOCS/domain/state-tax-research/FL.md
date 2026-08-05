# Florida (FL) — state income tax for retirement planning

Tax year: **2026** (the pack year; nothing below is a dated figure). Researched
2026-08-05 against primary sources only — the Florida Constitution and the
Florida Statutes via `flsenate.gov`, and the Legislature's Office of Economic
and Demographic Research via `edr.state.fl.us`. The URL this file previously
carried, `floridarevenue.com/taxes/taxesfees/Pages/default.htm`, returns 404;
the live path uses `.aspx`, and that page does not state the negative anyway.

## Summary
- Broad individual income tax: **no** — a constitutional ceiling above and an
  imposition that stops at the corporate boundary below
- Taxes Social Security benefits: no
- Long-term capital gains: not taxed
- Retirement income (pension, IRA, 401k): not taxed

## Proposed StateTaxParams (2026)
- code: "FL"
- name: "Florida"
- hasIncomeTax: false
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: false
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: []
- brackets.marriedFilingJointly: []
- retirement: { kind: "none" }

## What the negative rests on, and the qualifier in it
Article VII, §5(a) is the provision everyone cites, and it is worth reading
before leaning on it. It is **not a flat prohibition**. It is a ceiling, and
the ceiling is defined by reference to federal law: no tax on the income of
natural persons "in excess of the aggregate of amounts which may be allowed to
be credited upon or **deducted from** any similar tax levied by the United
States or any state."

Two readings of that are available on the text. Under the credit reading,
federal law allows no credit against federal income tax for a state income tax,
so the ceiling is zero and §5(a) operates as an absolute bar. Under the
deduction reading, "deducted from" could reach the federal deduction for state
taxes, which would make the ceiling non-zero and §5(a) a limit rather than a
bar. No Florida judicial or Attorney General construction resolving this was
found, and none was searched for — it is out of scope.

For the engine it does not matter, because two other sources state the
operative fact directly:

- **Chapter 220 stops at corporations.** §220.11(1) imposes the tax "on every
  taxpayer", and §220.03(1)(z) defines "taxpayer" as "any corporation subject
  to the tax imposed by this code". A natural person is not in it.
- **The Legislature says so.** The Office of Economic and Demographic Research
  — the Legislature's own research office — writes in the Florida Tax Handbook
  2025, under "Personal Income Tax": "SUMMARY: Florida currently does not levy
  a personal income tax."

A record that presented §5(a) alone as a prohibition would overclaim. The
registered record carries all four citations for that reason.

## Retirement-income detail
Nothing is taxed, so nothing is excluded. Wages, capital gains, Social
Security, private pensions and traditional IRA/401(k) distributions are all
beyond both the constitutional ceiling and chapter 220's corporate boundary.
`retirement: { kind: 'none' }` says the engine grants no exclusion, which is
exact: there is nothing to exclude from.

## Simplifications / not modeled
- Florida's **corporate** income tax under Fla. Stat. ch. 220 is real, is not
  an individual tax, and is not modeled.
- **Sales and property taxes** are out of scope for this doc.
- **Not resolved**: whether "deducted from" in art. VII §5(a) makes the
  ceiling non-zero. Immaterial here because the Handbook states the operative
  fact, but a reader who needs §5(a) to be a bar rather than a ceiling should
  know the text does not settle it on its own.
- **No capital-gains excise** is creeping in. §5(a) reaches "the income of
  natural persons" generally, which a gains tax would be, and the Tax Handbook
  lists no such levy.

## Citations (primary only)
- individual income tax (the negative) —
  https://www.flsenate.gov/Laws/Constitution/Article7 — art. VII §5(a),
  "NATURAL PERSONS. No tax upon estates or inheritances or upon the income of
  natural persons … in excess of the aggregate of amounts which may be allowed
  to be credited upon or deducted from any similar tax levied by the United
  States or any state." History line in the Senate's compilation: `Am. H.J.R.
  7-B, 1971; adopted 1971.`
- who chapter 220 reaches — https://www.flsenate.gov/Laws/Statutes/2025/220.11
  (§220.11(1), the imposition on "every taxpayer") and
  https://www.flsenate.gov/Laws/Statutes/2025/220.03 (§220.03(1)(z), defining
  "taxpayer" as a corporation).
- the operative fact, stated by the Legislature —
  https://edr.state.fl.us/Content/revenues/reports/tax-handbook/taxhandbook2025.pdf
  — Florida Tax Handbook 2025, "ALTERNATIVE SOURCES / PERSONAL INCOME TAX",
  p. 333. The same page reproduces art. VII §5(a) under the heading "FLORIDA
  CONSTITUTION", which independently confirms the transcription above.
- brackets, standard deduction, Social Security, capital gains, retirement
  exclusion — **not applicable.** Inert under `hasIncomeTax: false`, and
  Florida publishes no individual figures because it has no individual tax.

## Cross-checks (not authority)
None. Every citation above was read out of the constitution, the statutes, or
the Legislature's own handbook.

## Registered rules
| Rule id | Classification |
|---|---|
| `fl-const-7-5-a-income-tax-prohibited` | settled |
