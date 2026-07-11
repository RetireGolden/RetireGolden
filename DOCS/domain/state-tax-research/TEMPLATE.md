# State income tax research — template

One file per state, named `<CODE>.md` (e.g. `CA.md`). These docs are the
**cited source of truth** that later gets transcribed into
`packages/engine/src/params/state/data/year2026.ts` (`StateTaxParams`). Keep every
number traceable to an authoritative source so the code transcription is a
mechanical, reviewable step.

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

## Citations
- <URL> — <what it supports (e.g. "2025 single brackets")>
- <URL> — <...>
```

---

## Sourcing rules

- Prefer the **state Department of Revenue** (official forms/instructions) and the **Tax Foundation** "State Individual Income Tax Rates and Brackets" as a cross-check. Avoid undated blog posts.
- If 2025 figures aren't published, use the latest available and say which year.
- Brackets must be **monotonic** (ascending `lowerBound`, generally non-decreasing `ratePct`) and identical in structure for single vs MFJ (MFJ thresholds are often 2× single — verify, don't assume).
- When unsure, write the value you found, cite it, and flag the uncertainty in "Simplifications" rather than guessing silently.

See the five completed examples in this folder (FL, PA, KY, NY, MN) for the
expected shape and level of detail.
