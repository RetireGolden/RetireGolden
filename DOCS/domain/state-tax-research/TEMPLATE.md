# State income tax research — template

One file per state, named `<CODE>.md` (e.g. `CA.md`). These docs are the
**cited source of truth** that later gets transcribed into
`packages/engine/src/params/state/data/year2026.ts` (`StateTaxParams`). Keep every
number traceable to an **own-state primary source** (§ Sourcing rules below — this
is stricter than it used to be, and it is what decides whether the figure can ever
be registered as a rule) so the code transcription is a mechanical, reviewable step.

Goal fidelity = the "big levers" (see [DOCS/features/taxes.md](../../features/taxes.md)):
brackets, standard deduction, whether the state taxes Social Security, capital-
gains treatment, and the major age-based retirement-income exclusion. Note
anything finer under "Simplifications" so we know what we're leaving out.

Tax year: **2025** (latest published individual-income-tax figures). If a state
has no income tax, fill the Summary and stop.

---

## `StateTaxParams` field reference (what each value means)

| Field | Type | Meaning |
|-------|------|---------|
| `hasIncomeTax` | boolean | `false` for the 9 no-broad-income-tax states (AK, FL, NV, NH*, SD, TN, TX, WA*, WY). *NH taxes interest/dividends (phasing out); WA has a capital-gains tax only — note under Simplifications and set `false` unless it materially affects retirees. |
| `taxesSocialSecurity` | boolean | `true` only if the state taxes Social Security benefits (model as the federally taxable amount). ~9 states; most exempt SS entirely. |
| `capitalGainsAsOrdinary` | boolean | `true` if long-term gains are taxed at ordinary rates (most states). If the state has a preferential CG rate/exclusion, set `true` and describe it under Simplifications. |
| `standardDeduction` | `{ single, marriedFilingJointly }` | State standard deduction (not personal exemptions/credits). Use 0 if the state has none. If the state only offers a personal exemption/credit instead, put 0 and note it. |
| `brackets` | `{ single: [...], marriedFilingJointly: [...] }` | Ascending marginal brackets. Each entry `{ lowerBound, ratePct }`: `ratePct` applies to taxable income **above** `lowerBound`. First entry's `lowerBound` is 0. A flat tax is a single entry `[{ lowerBound: 0, ratePct: X }]`. |
| `retirement` | `{ kind, capPerPerson?, minAge? }` | How pension + traditional IRA/401(k) distributions are excluded. `none` = taxed like ordinary income. `full` = entirely exempt (set `minAge` if age-gated). `capped` = each eligible person excludes up to `capPerPerson` (set `minAge` if age-gated). Model the common private-pension/IRA case; note government-pension or income-phaseout nuances under Simplifications. |

---

## Copy this body into `<CODE>.md`

```markdown
# <State Name> (<CODE>) — state income tax for retirement planning

Tax year: 2025. Researched <date>.

## Summary
- Broad individual income tax: <yes / no>
- Taxes Social Security benefits: <no / yes — nuance>
- Long-term capital gains: <taxed as ordinary / preferential — nuance>
- Retirement income (pension, IRA, 401k): <one-line how it's treated>

## Proposed StateTaxParams (2025)
- code: "<CODE>"
- name: "<State Name>"
- hasIncomeTax: <true|false>
- taxesSocialSecurity: <true|false>
- capitalGainsAsOrdinary: <true|false>
- standardDeduction: { single: <num>, marriedFilingJointly: <num> }
- brackets.single:
  - { lowerBound: 0, ratePct: <r> }
  - { lowerBound: <n>, ratePct: <r> }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: <r> }
- retirement: { kind: "<none|full|capped>", capPerPerson: <num?>, minAge: <num?> }

## Retirement-income detail
<How the state treats Social Security, private pensions, IRA/401(k)
distributions, and any age thresholds or dollar caps. Explain exactly how you
mapped this to the retirement.kind / capPerPerson / minAge above.>

## Simplifications / not modeled
<Credits, personal exemptions, local/city income taxes, income phase-outs of
exclusions, preferential capital-gains rates, government- vs private-pension
distinctions, AMT-likes — anything the big-levers model omits.>

## Citations (primary only)
One line per big lever. Every URL here must be an **own-state primary source** —
this state's Department of Revenue, its statutes or code, or its published forms
and instructions. If a lever has no primary source, write `NOT SOURCED` on its
line rather than filling it with an aggregator, and repeat the gap under
"Simplifications". A `NOT SOURCED` lever cannot be registered in the tax rule
registry.
- brackets — <state URL> — <what it says>
- standard deduction — <state URL> — <...>
- Social Security — <state URL> — <...>
- capital gains — <state URL> — <...>
- retirement exclusion — <state URL> — <...>

## Cross-checks (not authority)
Where an aggregator or secondary summary was used to find or sanity-check a
figure. Never the source of a value — see "Sourcing rules". Record what it
agreed or disagreed with, and the date.
- <URL> — <figure checked, agreed/disagreed, date>
```

---

## Sourcing rules

**Only an own-state primary source is authority.** The state's Department of Revenue, the state's code or
statutes, and the state's published forms and instructions. State income tax is created by a state code and
administered by a state revenue department, so those are the only bodies that publish its operative language.
Every value under "Proposed StateTaxParams" has to trace to one of them.

**An aggregator is a finding aid, never authority.** The Tax Foundation's "State Individual Income Tax Rates
and Brackets" and its "State Tax Changes Taking Effect January 1" are genuinely useful, and this rule does
not tell you to stop opening them. Use them to *locate* a figure quickly, and to *notice* that a state has
moved since the last refresh — that second use is exactly what the January staleness sweep in
[maintenance-schedule.md](../../maintenance-schedule.md) is for. Then go to the state and cite the state.
The aggregator's URL goes under "Cross-checks", not under "Citations".

This is not a preference, and it is not negotiable downstream:
`packages/engine/src/rules/taxRuleRegistry.conformance.test.ts` holds a `SECONDARY_AGGREGATORS` set —
`taxfoundation.org`, `kiplinger.com`, `learn.valur.com` — that is asserted to be **permanently inadmissible
in both the federal and the state publisher tiers**, and a test fails if any of them is ever admitted. A
figure whose only source is one of those hosts is a figure that can be transcribed into a pack but can never
be registered as a rule. Research that ends at an aggregator produces a pack entry nobody can justify.

**If there is no primary source, say so.** Write `NOT SOURCED` on that lever's citation line and repeat it
under "Simplifications". An honest gap is a work item; an aggregator standing in for a primary source looks
like the work is finished. Avoid undated blog posts entirely.

**A state with no income tax still needs a citation.** "Fill the Summary and stop" above is about the
`StateTaxParams` fields, not about sourcing. The absence has to rest on something the state published — see
`fl-const-7-5-a-income-tax-prohibited` in the registry, and
[operations/authority-sufficiency.md § 2](../../operations/authority-sufficiency.md) on how far a quotation
can carry a negative.

### Other rules

- If 2025 figures aren't published, use the latest available and say which year.
- Brackets must be **monotonic** (ascending `lowerBound`, generally non-decreasing `ratePct`) and identical in structure for single vs MFJ (MFJ thresholds are often 2× single — verify, don't assume).
- When unsure, write the value you found, cite the primary source you found it in, and flag the uncertainty in "Simplifications" rather than guessing silently. Uncertainty about what a figure *means* is a note; uncertainty about where it *came from* is `NOT SOURCED`.

### Why these rules exist

The earlier version of this page told researchers to prefer the state DOR "and the Tax Foundation … as a
cross-check", which reads as a blessing on citing either. An audit of what that produced: of the nine
jurisdictions whose pack is tagged `standardDeductionConformity: 'federal'` — AZ, CO, DC, IA, ID, MO, MT, NM,
ND — only **two** (ID and MO) cite an own-state source for the standard-deduction figure that tag depends on.
Three of the nine — AZ, MT, ND — cite no own-state host anywhere in their citation block at all. Of the
remaining four that do cite their state somewhere, the deduction line specifically points at the Tax
Foundation, at SmartAsset, at a commercial tax-guide site, or at nothing.

None of those figures is necessarily wrong. All of them are unregistrable, and none of them can be shown to a
user as the reason a number came out the way it did.

For the expected level of detail, and for citations done right, see **KY**: every
lever deep-links to a Kentucky source — a DOR announcement, the withholding
formula PDF, the enacting bill — rather than to a department landing page.

The other completed examples in this folder (FL, PA, NY, MN) predate the sourcing
rules above and do not follow them: several cite a bare department home page for
several levers at once, and PA, NY and MN carry the Tax Foundation under
"Citations" where it now belongs under "Cross-checks". Copy the body block above,
not those files. Bringing the existing 51 docs onto this shape is a separate pass.
