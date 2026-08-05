# Wyoming (WY) — state income tax for retirement planning

Tax year: **2026** (the pack year; nothing below is a dated figure). Researched
2026-08-05 against primary sources only — Wyoming Statutes title 39 via
`wyoleg.gov` and the Wyoming Constitution via `sos.wyo.gov`. The two URLs this
file previously carried were a Tax Foundation page and a TurboTax blog post,
the weakest citation among the nine no-tax states.

## Summary
- Broad individual income tax: **no** — by statutory absence, not by
  constitutional bar. Art. 15 §18 is a credit *condition*, and it presupposes
  that an income tax may be imposed.
- **No local income tax is possible.** Wyo. Stat. §39-12-101 preempts the field
  from every county, city, town and other political subdivision. This is the
  one affirmative, quotable thing Wyoming's income tax law says.
- Taxes Social Security benefits: no
- Long-term capital gains: not taxed
- Retirement income (pension, IRA, 401k): not taxed

## Proposed StateTaxParams (2026)
- code: "WY"
- name: "Wyoming"
- hasIncomeTax: false
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: false
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: []
- brackets.marriedFilingJointly: []
- retirement: { kind: "none" }

Earlier versions of this file proposed `retirement: { kind: "full" }` "for
consistency". That has been corrected to match the pack, which ships
`{ kind: 'none' }` as it does for the other eight no-tax states. Both are inert
under `hasIncomeTax: false`, but `none` is the honest shape: the field means
"how much retirement income does the engine subtract from a base", and `full`
describes an exemption Wyoming does not grant because Wyoming has nothing to
exempt from. A doc is the artefact a reviewer reads to check the pack, so it
should not propose fields the pack rightly omits.

## What the negative rests on, and the correction it needs
**Title 39's entire income tax chapter is one section, and it imposes nothing.**
Quoted in full:

> CHAPTER 12 - INCOME TAX
> 39-12-101. Preemption by state.
> The state of Wyoming does hereby preempt for itself the field of imposing and
> levying income taxes, earning taxes, or any other form of tax based on wages
> or other income and no county, city, town or other political subdivision
> shall have the right to impose, levy or collect such taxes.

The next line in the title is `CHAPTER 13 - AD VALOREM TAXATION`. The former
income tax chapter is printed as `39-7-101. Repealed By Laws 1998, ch. 5, § 4.`

So the *state-level* negative is a statutory absence: the field is reserved and
empty. The *local* negative is affirmative and stronger — no Wyoming local
income tax can exist, whatever rate anyone supplies. That sub-claim is what the
engine's `localRatePct` gate implements.

**Art. 15, §18 is not a prohibition.** This is the correction the file needed:

> Sec. 18. Full tax credit allowed against any liability arising from a tax on
> income. No tax shall be imposed upon income without allowing full credit
> against such tax liability for all sales, use, and ad valorem taxes paid in
> the taxable year by the same taxpayer to any taxing authority in Wyoming.

Its structure is "No tax shall be imposed *without* allowing full credit" — a
condition on imposition, not a bar. In practice it is a severe deterrent, since
a Wyoming income tax would have to refund every dollar of sales, use and
property tax the same taxpayer paid that year, which for most households would
zero out the liability. That is an economic conclusion, not a legal one, and it
must not be presented as a prohibition. Wyoming, like South Dakota, is one
ordinary session away from changing.

## Retirement-income detail
Nothing is taxed, so nothing is excluded. `retirement: { kind: 'none' }` says
the engine grants no exclusion, which is exact: there is nothing to exclude
from.

## Simplifications / not modeled
- **Mineral severance taxes**, sales tax (4% state) and property taxes are out
  of scope for this doc.
- **Not established**: when Wyoming last levied an individual income tax, or
  whether it ever did. The repealed `39-7-101` heading shows a chapter existed
  and was repealed in 1998, but the repealed text is not printed and the
  session law was not retrieved. The registered record uses the pack year as
  its `effectiveFrom` rather than guessing.
- **The Department of Revenue cannot be cited.** `revenue.wyo.gov` is a Google
  Sites page whose annual reports are Google Drive links, so Wyoming's tax
  agency publishes nothing at a citable `wyo.gov` URL. The Legislature's own
  service office does — see Cross-checks.

## Citations (primary only)
- individual income tax (the negative), and the local-tax preemption —
  https://www.wyoleg.gov/statutes/compress/title39.pdf — Wyo. Stat.
  §39-12-101, quoted in full above. Title 39 as a whole; chapter 12 is that one
  section.
- what the constitution actually says —
  https://sos.wyo.gov/Forms/Publications/WYConstitution.pdf — Wyo. Const. art.
  15, §18, quoted above. The same source's history note records that the
  section "was amended by a resolution adopted by the 1973 legislature,
  ratified by a vote of the people at the general election held on November 5,
  1974".
- brackets, standard deduction, Social Security, capital gains, retirement
  exclusion — **not applicable.** Inert under `hasIncomeTax: false`, and
  Wyoming publishes no individual figures because it has no individual tax.

## Cross-checks (not authority)
- https://wyoleg.gov/InterimCommittee/2025/03-202506032-01WyomingtaxstructureratesandcollectionsJune32025.pdf
  — Wyoming Legislative Service Office, "Wyoming Statutory Tax Structure: Title
  39" (June 3, 2025). Its rates-and-collections table lists Individual Income
  Tax at 0% with $0 collected, and cross-references art. 15 §18. Agrees,
  2026-08-05. Listed here rather than under Citations because it is a table
  row, not a quotable sentence: reflowing a two-dimensional layout into one
  string would be a rendering of the document rather than a quotation of it.

The two URLs this file previously carried, `taxfoundation.org/location/wyoming/`
and a TurboTax blog post, are recorded as provenance rather than as
cross-checks. `taxfoundation.org` is in the `SECONDARY_AGGREGATORS` set the
conformance suite holds permanently inadmissible, and an undated commercial
blog post is not a source this folder should ever have carried.

## Registered rules
| Rule id | Classification |
|---|---|
| `wy-stat-39-12-101-no-state-or-local-income-tax` | settled |
