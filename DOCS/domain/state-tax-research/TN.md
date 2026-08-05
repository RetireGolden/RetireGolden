# Tennessee (TN) — state income tax for retirement planning

Tax year: **2026** (the pack year; nothing below is a dated figure). Researched
2026-08-05 against primary sources only — the Tennessee Constitution via the
Secretary of State's `publications.tnsosfiles.com`, and the Department of
Revenue via `tn.gov/revenue`. The citation this file previously carried was a
bare bibliographic string with no URL. Its conclusion and its date were both
right, and it was the only one of the seven no-tax files that showed any
awareness of the legal history.

## Summary
- Broad individual income tax: **no**, and the two halves of that answer do not
  rest on the same thing:
  - **Earned income** — constitutionally prohibited, state and local alike,
    by art. II §28.
  - **Everything a retiree lives on** — untaxed because the Hall income tax was
    repealed beginning January 1, 2021. That is a statute, and art. II §28
    still grants the Legislature express power to tax stock and bond income.
- Taxes Social Security benefits: no
- Long-term capital gains: not taxed
- Retirement income (pension, IRA, 401k): not taxed

## Proposed StateTaxParams (2026)
- code: "TN"
- name: "Tennessee"
- hasIncomeTax: false
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: false
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: []
- brackets.marriedFilingJointly: []
- retirement: { kind: "none" }

## What the negative rests on — and why it takes two answers
This is the state where "how far does the quotation carry" actually bites, and
a one-line summary hides it.

**The constitutional bar reaches earned income only.** Art. II, §28:

> Notwithstanding the authority to tax privileges or any other authority set
> forth in this Constitution, the Legislature shall not levy, authorize or
> otherwise permit any state or local tax upon payroll or earned personal
> income or any state or local tax measured by payroll or earned personal
> income; however, nothing contained herein shall be construed as prohibiting
> any tax in effect on January 1, 2011, or adjustment of the rate of such tax.

A pension, an IRA or 401(k) withdrawal, a capital gain, and interest and
dividends are none of them earned personal income. The "state or local" limb is
worth noticing separately: no Tennessee county or city may reach earned income
either.

**The same section still grants the power the Hall tax used.** The 2014
amendment did not repeal it:

> The Legislature shall have power to levy a tax upon incomes derived from
> stocks and bonds that are not taxed ad valorem.

Nor did the amendment kill the Hall tax — it expressly carved out "any tax in
effect on January 1, 2011", which the Hall tax was.

**The Hall repeal carries the rest, and its date is 2021.** The Department of
Revenue: "The Hall income tax has been repealed, and the applicable tax rate
for each year leading up to the repeal is as follows:" — 4% for 2017, 3% for
2018, 2% for 2019, 1% for 2020 — "Repeal beginning January 1, 2021."

The two-act path behind that: 2016 Pub. Ch. 1064 §3 added T.C.A. §67-2-124(c)
eliminating the tax from 2022, and the 2017 IMPROVE Act (Pub. Ch. 181) §13
replaced the flat rate with the ramp above and §15 moved the elimination
forward to 2021.

So for exactly the income a retiree has, Tennessee's negative is statutory, and
a simple majority could restore a tax on stock and bond income. Tennessee
belongs on the annual re-verification list for that reason.

## Retirement-income detail
Nothing is taxed, so nothing is excluded. `retirement: { kind: 'none' }` says
the engine grants no exclusion, which is exact: there is nothing to exclude
from.

## Simplifications / not modeled
- **The legacy Hall tax is not modeled**, and correctly so — it is repealed.
  Nothing in the engine carries a Hall rate; the only mentions of it anywhere
  in `packages/engine/src` or `DOCS/domain` are in this file.
- **Sales/use taxes**, which is where Tennessee's revenue comes from, and the
  business and excise taxes, are out of scope for this doc.
- **Not retrieved**: the current codified text of T.C.A. §67-2-102 or
  §67-2-124. Tennessee Code Unannotated is published through LexisNexis, which
  is not a state host, and `publications.tnsosfiles.com` carries acts rather
  than the code. The date rests on the department's own statement, which
  carries it exactly.
- **The two enrolled acts are not quotable.** 2016 Pub. Ch. 1064 and 2017 Pub.
  Ch. 181 are on the Secretary of State's site as **scanned** PDFs, and their
  OCR layer is visibly corrupt — `four percent (4o/o)`, `January 1,2021`
  without the space. Their URLs are given under Cross-checks so a reader can
  find them; nothing may be quoted from either.

## Citations (primary only)
- earned income (the constitutional bar), and the retained grant that limits it
  — https://publications.tnsosfiles.com/pub/2023%20TN%20Constitution.pdf —
  Tenn. Const. art. II, §28. Secretary of State edition, updated 1/11/2023,
  clean text layer.
- unearned income (the Hall repeal and its date) —
  https://www.tn.gov/revenue/taxes/hall-income-tax/due-date-and-tax-rates.html
  — Department of Revenue, Hall Income Tax → Due Date and Tax Rates: the repeal
  sentence, the 2017–2020 rate ramp, and "Repeal beginning January 1, 2021".
  The department's Hall landing page,
  `https://www.tn.gov/revenue/taxes/hall-income-tax.html`, states the same
  thing in plainer words ("The Hall Income tax was repealed for tax periods
  that begin on January 1, 2021, or later") and is the more obvious citation —
  but stripped of markup it yields under 2,000 characters, which
  `verify-quotes` cannot distinguish from a shell or a bot challenge. Cite the
  rates page.
- brackets, standard deduction, Social Security, capital gains, retirement
  exclusion — **not applicable.** Inert under `hasIncomeTax: false`, and
  Tennessee publishes no individual figures because it has no individual tax.

## Cross-checks (not authority)
- https://publications.tnsosfiles.com/acts/109/pub/pc1064.pdf — 2016 Pub.
  Ch. 1064 (S.B. 47), which created T.C.A. §67-2-124 with a 2022 elimination
  date. Scanned; **not quotable**.
- https://publications.tnsosfiles.com/acts/110/pub/pc0181.pdf — 2017 Pub.
  Ch. 181 (H.B. 534, the IMPROVE Act), §13 (the rate ramp) and §15 (moving the
  elimination to 2021). Scanned; **not quotable**.

The previous citation, an undated "Tax Foundation, State Individual Income Tax
Rates and Brackets 2025" string with no URL, is recorded as provenance rather
than as a cross-check. `taxfoundation.org` is in the `SECONDARY_AGGREGATORS`
set the conformance suite holds permanently inadmissible.

## Registered rules
Two, because the two halves rest on different authority with different
durability. Collapsing them would let the constitution's weight vouch for a
statutory repeal it says nothing about.

| Rule id | Classification |
|---|---|
| `tn-const-2-28-earned-income-tax-prohibited` | settled |
| `tn-hall-income-tax-repealed-from-2021` | settled |
