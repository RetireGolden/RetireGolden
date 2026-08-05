# Texas (TX) — state income tax for retirement planning

Tax year: **2026** (the pack year; nothing below is a dated figure). Researched
2026-08-05 against primary sources only — the Texas Constitution as published
by the Texas Legislative Council via `tlc.texas.gov`, and enrolled resolutions
via `capitol.texas.gov`. The citation this file previously carried was a bare
bibliographic string with no URL, and its description of the mechanism was
loose: it never named §24-a, never noted that the old §24 was repealed, and
predates §24-b entirely.

## Summary
- Broad individual income tax: **no** — constitutionally prohibited twice over,
  and this is the most durable of the nine
- Taxes Social Security benefits: no
- Long-term capital gains: not taxed, and since November 2025 a tax on them is
  constitutionally prohibited in its own right
- Retirement income (pension, IRA, 401k): not taxed

## Proposed StateTaxParams (2026)
- code: "TX"
- name: "Texas"
- hasIncomeTax: false
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: false
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: []
- brackets.marriedFilingJointly: []
- retirement: { kind: "none" }

## What the negative rests on
Two independent prohibitions, adopted six years apart.

**Art. VIII, §24-a** (added November 5, 2019): "INDIVIDUAL INCOME TAX
PROHIBITED. The legislature may not impose a tax on the net incomes of
individuals, including an individual's share of partnership and unincorporated
association income."

**Art. VIII, §24-b** (added November 4, 2025): "CAPITAL GAINS TAX PROHIBITED.
(a) Subject to Subsection (b) of this section, the legislature may not impose a
tax on the realized or unrealized capital gains of an individual, family,
estate, or trust, including a tax on the sale or transfer of a capital asset
that is payable by the individual, family, estate, or trust selling or
transferring the asset." Subsection (b) preserves ad valorem, sales and use
taxes.

§24-b closes the one gap a lawyer might have probed in §24-a — whether a
realization-based gains tax is a tax on *net income*. The surrounding
architecture is consistently prohibitive: §25 bars a wealth tax (added November
7, 2023) and §26 bars death, estate, inheritance and gift taxes.

### Two corrections to what was previously written here
1. **§24-a is not "referendum-locked", and the referendum provision is gone.**
   The referendum requirement was the *old* §24, and H.J.R. 38 §3 repealed it
   outright: "SECTION 3. Section 24, Article VIII, Texas Constitution, is
   repealed." The current constitution prints `Sec.24.(Repealed Nov. 5,
   2019.)`. What replaced it is a flat prohibition, which is strictly stronger
   than a referendum lock. The same resolution struck the Legislature's power
   to tax natural persons' income out of art. VIII §1(c), which now leaves only
   "…may also tax incomes of … corporations other than municipal."
2. **A capital-gains prohibition now exists** and post-dates every research file
   in this folder and the pack's own refresh note. It changes no computed
   number — the pack already returns zero — but it is the direct answer to
   "verify no gain excise is creeping in": Texas has moved the other way and
   foreclosed one.

## Retirement-income detail
Nothing is taxed, so nothing is excluded, and the Legislature could not tax it
without amending the constitution twice. `retirement: { kind: 'none' }` says
the engine grants no exclusion, which is exact: there is nothing to exclude
from.

## Simplifications / not modeled
- The **franchise tax** falls on business entities, not on an individual's
  income, and is not modeled or investigated.
- **Sales/use and (notably high) property taxes** are out of scope for this doc.

## Citations (primary only)
- individual income tax (the negative) —
  https://tlc.texas.gov/docs/legref/TxConst.pdf — Tex. Const. art. VIII, §24-a
  and §24-b, quoted above. Texas Legislative Council edition, whose cover page
  reads "Includes Amendments Through the November 4, 2025, Constitutional
  Amendment Election".
- the repeal of the old §24 —
  https://capitol.texas.gov/tlodocs/86R/billtext/html/HJ00038F.htm — H.J.R. 38,
  86th Leg. R.S. (2019), enrolled, §§1–3.
- §24-b's carve-outs, and its submission to the voters —
  https://capitol.texas.gov/tlodocs/89R/billtext/html/SJ00018F.htm — S.J.R. 18,
  89th Leg. R.S. (2025), enrolled. The registered record quotes subsection (b)
  from here rather than from the compilation, because a running page header
  falls between subdivisions (1) and (2) of that subsection in the PDF and
  every extraction of the page interleaves it into the middle of the text.
- brackets, standard deduction, Social Security, capital gains, retirement
  exclusion — **not applicable.** Inert under `hasIncomeTax: false`, and Texas
  publishes no individual figures because it may not have an individual tax.

**Do not cite `statutes.capitol.texas.gov`.** It is now a JavaScript
application: `Docs/CN/htm/CN.8.htm` and `Docs/CN/pdf/CN.8.pdf` both return HTTP
200 with a 1,354-character shell — the `.pdf` path returns HTML — so a citation
to it can never be checked against the text it claims to quote. All three
registry citations were pointed there and all three were failing verification;
they now point at the Legislative Council PDF above.

## Cross-checks (not authority)
None. Every citation above was read out of the constitution or an enrolled
resolution.

The previous citation, an undated "Tax Foundation, State Individual Income Tax
Rates and Brackets 2025" string with no URL, is recorded as provenance rather
than as a cross-check. `taxfoundation.org` is in the `SECONDARY_AGGREGATORS`
set the conformance suite holds permanently inadmissible.

## Registered rules
Two, because the two prohibitions have different start years. A single record
would have to carry one `effectiveFrom` and would lie about half its range.

| Rule id | Classification |
|---|---|
| `tx-const-8-24-a-individual-income-tax-prohibited` | settled |
| `tx-const-8-24-b-capital-gains-tax-prohibited` | settled |
