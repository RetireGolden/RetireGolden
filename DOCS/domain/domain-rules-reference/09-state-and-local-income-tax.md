## 9. State and local income tax

- State tax packs cover all 50 states plus DC using the big planning levers: income-tax presence, brackets,
  standard deduction, Social Security taxation, private/public retirement-income exclusions, and capital-gain
  inclusion. Values are transcribed from the per-state research files in
  [state-tax-research/](../state-tax-research/).
- Eight jurisdictions — CO, DC, IA, ID, MO, MT, ND, NM — define their standard deduction by reference to the
  federal one rather than publishing their own. Their packs carry a copy of the federal figure tagged
  `standardDeductionConformity: 'federal'`, and `indexConformedStateStandardDeduction` moves that copy by exactly
  the factor `indexFederalTaxPack` applied to the original, so one engine never holds two values for one statutory
  amount in a projected year (`irc-63-c-7-B-ii-conformed-state-deduction-tracks-federal`). Nothing else in the pack
  moves: brackets and retirement-exclusion caps are state figures under state law. ME and SC decoupled for 2026
  and are deliberately untagged; AZ left the list on 2026-08-05, because A.R.S. §43-1041(A) sets Arizona's own
  amounts and (H) borrows only the federal indexation *method*, and the tag was additionally attaching an IRC
  63(c)(3) age-65 addition Arizona does not grant (`ars-43-1041-standard-deduction-published-amount`; Arizona's
  own age-65 relief is the unmodelled $2,100 exemption of `ars-43-1023-e-age-65-exemption`).
- Capital gains default to federal conformity unless a state pack says otherwise. CA, MN, and NJ document
  ordinary state taxation of capital gains. PA uses current-year-only capital-loss conformity: federal
  prior-year carryforward losses do not offset PA-taxable current-year gains in the planning model. The raw
  current-year capital field remains signed, but PA floors that current-year-only input at zero. ND excludes
  40% of net long-term gain by statute and carries `capitalGainsTaxablePct: 60`
  (`ndcc-57-38-30-3-2-d-long-term-gain-exclusion`); the parallel 40% exclusion for qualified dividends has no
  field and is registered as a gap (`ndcc-57-38-30-3-2-d-2-qualified-dividend-exclusion`). AR excludes 50% of
  net capital gain and carries `capitalGainsTaxablePct: 50`
  (`aca-26-51-815-b-2-fifty-percent-capital-gain-exclusion`), with its full exemption of gain above $10,000,000
  registered as a gap (`aca-26-51-815-b-3-ten-million-dollar-gain-exemption`). AZ subtracts 25% and carries
  `capitalGainsTaxablePct: 75`, but only for an asset acquired after 2011 — a condition the engine cannot see
  and which is registered as a gap running toward the taxpayer
  (`ars-43-1022-22-long-term-capital-gain-subtraction`).
- ND and AR are the states whose figures are neither fixed by statute nor on a legislated ramp: N.D.C.C.
  §57-38-30.3(1)(g) makes the tax commissioner publish a cost-of-living-adjusted schedule that applies *in lieu
  of* the printed one every year, so the department's form — not the Century Code — carries the operative
  figures (`ndcc-57-38-30-3-1-g-commissioner-indexed-rate-schedule`), and A.C.A. §26-51-201(d)(1) and
  §26-51-430(c) say the same of Arkansas's brackets and of its standard deduction
  (`aca-26-51-201-published-indexed-rate-schedule`, `aca-26-51-430-c-published-indexed-standard-deduction`).
  Re-read all of them every autumn.
- ND, AR, AZ and IN are the cases where the public-pension bucket is coarser than the state's law, and the flag
  cannot be right for both populations in any of them. ND subtracts military and 20-year peace-officer
  retirement and no other public pension, so `{ kind: 'full' }` also exempts the CSRS, FERS and state PERS
  pensions ND taxes (`ndcc-57-38-30-3-2-closed-subtraction-list`). AZ subtracts uniformed-services retired pay
  in full and caps a civil-service pension at $2,500, and carries `full` for the same reason and with the same
  residual (`ars-43-1022-2-government-pension-exclusion`). AR is the mirror image: only uniformed-services
  retirement is fully exempt there and every other public pension gets the same $6,000 as a private one, so the
  bucket carries the cap and a military pension is over-charged instead
  (`aca-26-51-307-e-uniformed-services-full-exemption`). IN is the mirror image at its limit — military
  retirement is deducted in full and *every* other public pension, INPRS/PERF, TRF, municipal police and fire
  alike, gets nothing at all, so the bucket carries `none`
  (`ic-6-3-2-4-military-retirement-deduction`, with the capped and Social-Security-offset civil service annuity
  registered beside it as `ic-6-3-2-3-7-civil-service-annuity-age-62`). The first two **understate** tax, which
  is the dangerous direction; the last two overstate it.
- **Local income tax is a caller input, and Indiana is where that hurts.** `computeStateTaxDetail` applies a
  flat `localRatePct` to state taxable income, but no `StateTaxParams` field carries a per-state default and
  both `assumptions.localIncomeTaxPct` and a relocation candidate's `localRatePct` default to zero. All 92
  Indiana counties levy on the identical base — about $1,400 a year at a mid-range 2% on $70,000, against
  $2,065 of state tax — so an Indiana projection under-charges unless the rate is supplied by hand
  (`ic-6-3-6-2-2-county-income-tax-shares-the-state-base`). No default was invented: the published rates span
  sixfold and Indiana publishes no statewide figure to stand for them.
- **State personal exemptions are modelled nowhere.** The `standardDeduction` slot holds a state's *standard
  deduction*, or for CO and ND the federal-taxable-income converter, and no pack entry folds a separate
  per-person exemption into it. IN has no standard deduction at all and instead subtracts $1,000 per filer,
  $1,000 per person aged 65+, $1,000 per person blind and $500 more below $40,000 of AGI
  (`ic-6-3-1-3-5-exemptions-not-a-standard-deduction`); MS stacks $6,000/$12,000 plus $1,500 per person aged
  65+ on top of a standard deduction the pack does carry
  (`ms-27-7-21-personal-and-age-65-exemptions`). Both overstate tax, and both would turn into an
  *understatement* for a household under 65 if the age-conditioned half were folded into a per-filing-status
  field.
- **MS is the state where the sign of the error flips with the household's age**, so its records are never
  netted. The unmodelled exemptions and the unmodelled combined-return per-spouse schedule over-charge the
  modal Mississippi retiree, whose pension and Social Security are outside the base already
  (`ms-27-7-21-personal-and-age-65-exemptions`, `ms-combined-return-runs-the-schedule-per-spouse`). The
  unconditional `{ kind: 'full' }` exclusion under-charges the pre-59½ drawdown, because Mississippi does not
  exempt a distribution bearing the federal IRC 72(t) additional tax
  (`ms-early-or-excess-distribution-not-exempt`). `minAge` is deliberately refused as a proxy for that: the
  exclusion reads it against the whole household, and the statutory test is the federal additional tax rather
  than an age, so a substantially-equal-periodic-payment series would be denied an exemption it keeps.
- A current-year signed capital loss joins the opening carryforward pool before the annual ordinary-income
  deduction. Legacy taxable withdrawals, individually owned taxable ordinary-withdrawal actions, rebalances,
  and taxable annuity/TIPS funding share the same uncapped aggregate-basis economics; actions calculate it in
  exact cents while legacy paths use the planning-dollar helper. Basis above value therefore produces a loss
  instead of being silently capped at zero. Full sales explicitly exhaust both fair market value and remaining
  aggregate basis. Pennsylvania's current-year-only input receives this raw signed annual result before its
  state-specific zero floor.
- Mid-year state moves prorate state taxable income, deductions, brackets, and retirement caps by months in
  each state segment. Taxable Social Security is computed once on the full-year federal base and then
  apportioned by months.
- Optional local income tax is a user-entered flat percentage applied to computed state taxable income. This
  is planning support for common local layers, not a locality rule pack.
- Sources: the per-state research in [state-tax-research/](../state-tax-research/) and the own-state revenue,
  statute and forms sources cited in each file. Those are the authority.
  [Tax Foundation's state income-tax rates](https://taxfoundation.org/data/all/state/state-income-tax-rates/)
  is a cross-check and a change-detector only — `taxfoundation.org` is one of the hosts
  `taxRuleRegistry.conformance.test.ts` holds permanently inadmissible as authority, so a state figure whose
  only source is that page cannot be registered as a rule. See
  [state-tax-research/TEMPLATE.md](../state-tax-research/TEMPLATE.md) § Sourcing rules.
