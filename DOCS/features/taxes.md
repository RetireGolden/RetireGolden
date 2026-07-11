# Taxes (federal + state)

The tax engine is what separates RetireGolden from most free planners: it models the interacting cascade —
Social-Security taxation → IRMAA → ACA cliff → NIIT → senior-deduction phase-out — that is the whole point
of Roth-conversion and withdrawal planning. It targets **planning-grade**, not filing-grade, accuracy.
Current-year figures and citations live in [domain-rules-reference.md](../domain/domain-rules-reference.md);
all dollar values come from versioned parameter packs, never hardcoded.

**Code:** [engine/tax/federalTax.ts](../../packages/engine/src/tax/federalTax.ts),
[engine/tax/stateTax.ts](../../packages/engine/src/tax/stateTax.ts),
[engine/tax/aca.ts](../../packages/engine/src/tax/aca.ts),
[engine/tax/medicare.ts](../../packages/engine/src/tax/medicare.ts); parameter packs in
[engine/params/](../../packages/engine/src/params/) (federal in `data/year2026.ts`, state in `params/state/`).
The projection runs federal and state as two calculators over one income input
([engine/projection/simulate.ts](../../packages/engine/src/projection/simulate.ts)).

## Federal engine

Computed each year inside the projection loop:

- **Ordinary income stack:** wages, interest, non-qualified dividends, traditional withdrawals/conversions,
  pension/annuity taxable parts, and **taxable Social Security** (provisional-income 0/50/85% tiers — the
  thresholds are statutorily unindexed, so more benefit becomes taxable over time; this is modeled, not
  indexed).
- **LTCG + qualified dividends** stack at 0/15/20% on top of ordinary income; the 0%-bracket headroom is
  surfaced as a gain-harvesting opportunity.
- **Deductions:** standard deduction + age-65 additions + the **$6,000/person senior deduction
  (2025–2028, 6% MAGI phase-out)** — a major Roth-conversion interaction for 65+ planners; itemized as a
  simple user-entered total (SALT cap, mortgage interest, charitable) where it beats the standard.
- **NIIT** 3.8% over $200k/$250k MAGI (unindexed). **Early-withdrawal penalty** 10% pre-59½, with the
  Rule-of-55 / 72(t) **SEPP** exceptions ([strategies/sepp.ts](../../packages/engine/src/strategies/sepp.ts)).
- **Planning-grade AMT screen:** AMTI starts from taxable income plus modeled AMT add-backs (the regular
  standard/senior deduction for non-itemizers, itemized SALT when itemizing, and any advanced calculator-only
  preference items supplied by tests or future integrations). The engine applies the 2026 AMT exemption,
  exemption phase-out, and tentative minimum tax, preserving LTCG/qualified-dividend preferential rates, then
  adds the excess over regular tax when AMT binds. This is a conversion-risk screen, not a Form 6251
  substitute.
- **IRMAA:** Medicare Part B/D surcharges from **MAGI two years prior** (a conversion at 63+ hits Medicare
  pricing); the brackets are cliffs, so bracket-edge warnings show "$1 over costs $X/yr"
  ([medicare.ts](../../packages/engine/src/tax/medicare.ts)).
- **SSA-44 redetermination (opt-in, `expenses.healthcare.ssa44`):** after a qualifying life-changing event —
  a couple's first death, and optionally each person's retirement year — the two following premium years
  price IRMAA on **min(lookback MAGI, prior-year MAGI)**, the planning-grade stand-in for the current-year
  estimate Form SSA-44 lets a beneficiary submit (domain rules §7). The optimizer shifts those years'
  IRMAA-binary source to (t−1) in-solve. Off/absent = the plain lookback; the couples' **Survivor
  transition** view shows the with/without delta per death timing.
- **ACA premium tax credit** (pre-65): computed from MAGI vs FPL with the restored **400% FPL cliff** — a
  first-class constraint for early retirees managing MAGI ([aca.ts](../../packages/engine/src/tax/aca.ts)). The
  credit is a **household** calculation: covered members' premiums pool and the MAGI-based expected
  contribution is subtracted once per household, not per person.
- **Age-65 transition:** Medicare eligibility starts in the birth month of the year a member turns 65, so
  that year is prorated — `birthMonth − 1` marketplace months feed the household ACA pool and the remaining
  months carry Part B/D (and Medicare extras). The credit itself is computed **monthly**
  (`acaNetAnnualPremiumByMonth`): each covered month earns `max(0, premium − expectedContribution/12)`, so a
  five-month transition owes five-twelfths of the expected contribution, not a full year of it.
  Planning-grade: the born-on-the-1st prior-month rule is not modeled.
- **Survivor filing status:** married-couple projections retain MFJ treatment in the year one spouse dies.
  After that, survivor years file single unless `household.hasQualifyingDependent` is enabled, in which case
  the next two years use qualifying-surviving-spouse treatment (MFJ brackets/deduction for tax parameters).
  IRMAA is the exception: SSA's threshold tables group QSS with single/HOH filers (POMS HI 01101.020), so
  QSS years price Medicare premiums at the single thresholds.

The engine emits full per-year tax detail (AGI, MAGI variants, taxable income, marginal + effective rates,
IRMAA tier) for the results table, charts, and CSV.

## Capital-loss carryforward

A starting net capital loss (e.g. an ESPP sold at a loss) is a common attribute a near-retiree brings to
the plan, and it matters most in early-retirement brokerage-drawdown years. The rule
([`applyCapitalLossCarryforward`](../../packages/engine/src/tax/federalTax.ts)):

1. Net against this year's realized gains first;
2. then up to **$3,000/yr** against ordinary income (a fixed, never-indexed pack constant,
   `capitalLossOrdinaryOffsetLimit`);
3. remainder carries forward indefinitely.

Crucially it applies **before AGI**, so the offset cascades: lower AGI → lower provisional income (less
taxable SS) → lower MAGI (IRMAA/ACA). The netting is a pure boundary helper applied to *both* the federal
and state calculators, and the depleting pool threads year-to-year through `simulate.ts` like the Roth
basis pools — so every withdrawal/conversion probe inherits the benefit. The results page shows it
deplete, with a first-year callout and a combined "you can realize ~$X in gains tax-free this year" figure
(remaining pool + 0%-bracket headroom). It is a **single pool** (no short/long-term split), models only a
user-entered opening balance (no in-plan loss harvesting), and the optimizer is aware of it only via the
exact ledger re-run, not inside the LP.

## Taxable brokerage yield

Taxable brokerage accounts can model annual tax drag before withdrawals. Each taxable account may specify:

- `interestYieldPct`: taxable interest generated from the start-of-year balance.
- `dividendYieldPct`: dividends generated from the start-of-year balance.
- `qualifiedRatio`: share of dividends taxed federally at qualified-dividend / long-term capital-gain rates.
- `reinvestDividends`: whether generated yield is reinvested into the account or paid into annual cash flow.

Interest and non-qualified dividends are ordinary income. Qualified dividends are **not** treated as realized
capital gains: capital-loss carryforwards apply on the capital-gain line, so a net loss still reduces AGI and
taxable income (which can indirectly lower the tax on a year's income, qualified dividends included), but the
qualified-dividend amount itself always enters the preferential-rate stack in full — it is never directly
reduced by the carryforward. Qualified dividends count in AGI/MAGI, Social-Security provisional income, ACA,
IRMAA, NIIT, and state taxable-income bases.

When yield is reinvested, the gross generated amount is added back to the taxable account after price growth and
also increases cost basis, so later pro-rata withdrawals do not overstate capital gains. The account's expected
return remains a total-return assumption: the engine subtracts the modeled interest/dividend yield from end-of-year
price growth to avoid counting the same return twice.

## State income tax

Per-state income tax for **all 50 states + DC**, modeling the "big levers" (~90% of real-world impact):
graduated/flat brackets, standard deduction, whether the state taxes Social Security (~9 do; the rest
exempt), and the major **age-based retirement-income exclusions** (private retirement and public pension buckets).
Source data is PolicyEngine-cited with a Tax Foundation cross-check; the per-state research is captured in
[domain/state-tax-research/](../domain/state-tax-research/) and transcribed into dated packs under
`engine/params/state/`.

Each state pack (`StateTaxParams`) carries `hasIncomeTax`, `taxesSocialSecurity`, `standardDeduction`,
`brackets` (single / MFJ), separate `retirementPrivate` and `retirementPublic` exclusions (`none` / `full` /
`capped` with `capPerPerson` and `minAge`), and capital-gain treatment metadata. State taxable income =
ordinary + qualified dividends + taxable capital gains where the state includes them + (taxable SS if the
state taxes it) - private/public retirement exclusions - standard deduction, floored at 0, then bracketed.

Capital-loss carryforward conformity is state-aware where it changes decisions. The default conforms to the
federal net capital-gain line. Pennsylvania uses current-year-only conformity, so a federal prior-year loss
carryforward does not erase PA-taxable current-year gains. CA/MN/NJ source metadata documents their ordinary
capital-gain treatment in the 2026 pack.

Private retirement income includes private pensions, annuities, traditional IRA/401(k) withdrawals, RMDs, SEPP,
and inherited-traditional distributions. Pension accounts can be marked as private or public / military; public
pension income flows through the public-pension bucket for states whose research notes a separate exemption.
States **without** a separate public-pension law carry one all-retirement rule (`retirementRuleShared`): a
capped exclusion there applies once to the combined private + public retirement income, never once per bucket.

- **Mid-plan moves:** `household.state` is the starting residence; an optional `household.stateMoves`
  list switches the rules from a given year onward. Each move has a `fromMonth` (older plans default to July),
  so the move year is split between prior/new state by month. The state calculator prorates income, standard
  deductions, bracket thresholds, and per-person retirement caps for each state segment, then sums the state
  tax. Taxable Social Security is the exception: it is computed **once** from full-year income against
  full-year federal thresholds and then apportioned to each segment by months (recomputing it per slice would
  understate it). Future years use the new state for all 12 months. (`stateMoves` was added with Zod defaults
  and **no migration** - the plan schema version stays 1.)
- **Flat-rate override:** `assumptions.stateEffectiveTaxPct` remains a per-plan manual override; when a
  real pack exists and the override is 0, the pack is used. A results warning shows when a state falls back
  to the flat override.
- **Local income tax:** `assumptions.localIncomeTaxPct` is an optional flat percentage applied to computed
  state taxable income. It is intended for planning common local layers (for example Maryland counties,
  NYC/Yonkers, Michigan cities, and Ohio municipalities) without maintaining a locality-specific tax pack.
  Local tax is a tax output only; it does not feed MAGI, ACA, IRMAA, or Social Security taxation.
- **Relocation Compare** (`/plan/:id/relocation`, Explore rail;
  [engine/projection/relocation.ts](../../packages/engine/src/projection/relocation.ts)): runs the user's actual
  plan once per candidate state (≤5, each expressed as a scenario patch over the existing state/`stateMoves`
  fields — no new persistence) in a Web Worker, ranked by lifetime state+local tax, lifetime taxes &
  penalties, ending after-tax estate, and a shared-path Monte Carlo success rate. A per-state drill-down
  attributes the ledger's recorded state-tax lines to the pack's big levers (SS treatment,
  retirement-income exclusions incl. the separate public-pension bucket, capital-gain treatment) by
  re-pricing each recorded year with one rule neutralized through the identical calculator path
  (`computeStateTaxYearTotal`). Candidates clear a flat-rate override (it would mask the packs) and can
  carry a local-rate and a flat spending-delta knob; "Add as scenario" round-trips to exactly the row the
  sweep ran. Income tax only — property/sales/COL are named as out of model in the UI. The
  `state-relocation` Insights detector's `evaluate()` runs the same sweep over a zero-income-tax shortlist
  and quantifies the lifetime state-tax drag in today's dollars, framed neutrally.

## Account depth (HSA, nondeductible basis, property sales)

Opt-in account-level tax depth (all additive with no-op defaults, so pre-existing plans are unchanged). Full
rules and citations: [domain rules §16](../domain/domain-rules-reference.md#16-account-eligibility-hsa-nondeductible-basis-and-fixed-asset-disposition-opt-in).

- **Account eligibility service** (`engine/strategies/accountEligibility.ts`) centralizes the
  withdraw / convert / RMD / spendable / penalty rules so every consumer (ledger, optimizer input, decision
  generators) shares one implementation — e.g. the inherited-IRA "not convertible, never penalized" rule.
- **HSA medical-expense subledger.** An HSA can cap qualified (tax- and penalty-free) withdrawals at the
  household's modeled medical costs (`capByMedicalExpenses`), assume every withdrawal qualifies
  (`assumeAllQualified`), or keep the legacy behavior; `reimburseLater` accumulates unreimbursed out-of-pocket
  medical costs as a carryover future withdrawals can draw tax-free. A non-spouse HSA `beneficiary` makes the
  ending balance taxable to the heir in the after-tax estate.
- **Nondeductible IRA basis.** `nondeductibleBasis` (Form 8606) makes withdrawals and conversions part
  tax-free basis, pro-rata across the owner's aggregated IRAs.
- **Property disposition.** Setting `costBasis` on a property replaces the tax-free `expectedNetProceeds`
  estimate with exact treatment: capital gain above basis net of `sellingCostPct`, the §121 primary-residence
  exclusion, and ordinary-income depreciation recapture. Gains flow through the capital-gains stack.
- **Taxable safety-net floor.** `strategies.taxableSafetyNetFloor` keeps a minimum liquid reserve intact —
  spending draws other accounts first and fill-to-target conversions are trimmed to respect it.

## Guaranteed income and estate depth

Opt-in tax treatment for annuity purchases and the after-tax estate (all additive with no-op defaults). Full
rules and citations: [domain rules §17](../domain/domain-rules-reference.md#17-guaranteed-income-annuity-purchases-and-estate--beneficiary-depth-opt-in).

- **Annuity purchase taxation.** A purchased **non-qualified** annuity (cash/taxable-funded) taxes each
  payout by the **IRS Pub 939 exclusion ratio** — the premium is recovered tax-free over the expected-return
  period, so only the earnings portion is ordinary income; the account's `taxablePct` is derived from the
  ratio. A **qualified** (traditional-funded) purchase is fully ordinary income, and its premium leaving the
  traditional balance shrinks future RMDs; a **QLAC** additionally defers the premium out of the RMD base
  until payouts begin (capped at the SECURE 2.0 statutory limit).
- **Estate beneficiary + heir tax by class.** The after-tax estate no longer applies one flat traditional
  haircut: each account's `estateBeneficiary` routes its ending balance to a spouse (rollover, untaxed), a
  non-spouse heir (pre-tax classes taxed at the class heir rate; Roth/taxable-stepped-up/cash untaxed), or
  charity (`charityPct` untaxed). `assumptions.heirTaxByClass` can price the `traditional` and `hsa` classes
  at different heir brackets; an omitted class falls back to the flat `heirTaxRatePct`.

## Recommendation income coverage

Every recommendation surface — candidate generators, scenario patches, Insights detectors, optimizer
approximations, and preview cards — must price the same ledger-known income and cash-flow sources that the
projection ledger prices. Do not rebuild a simplified income model inside a recommendation path.

The developer checklist lives in [standards.md](../standards.md#recommendation-income-coverage-checklist). The
named fixture suite
[`engine/decisions/incomeCoverage.test.ts`](../../packages/engine/src/decisions/incomeCoverage.test.ts) proves that
candidate generators and detectors preserve one-time income, contributions and employer match, taxable gains
and qualified dividends, and Social Security taxability when those sources change the recommendation. Add or
update a fixture whenever a new recommendation path touches AGI, MAGI, taxable income, balances, or spending
need.

## Documented simplifications

- **Big levers only:** no state-specific credits, jurisdiction-specific local tax packs, AMT-likes, or
  income-phaseout of exclusions (caps are modeled as hard caps); public-pension treatment follows the local
  state-research notes and does not model every small, service-date-specific, or income-limited
  government-pension rule. High-income state investment surtaxes and many preferential state CG rules remain
  noted rather than fully modeled unless a state pack explicitly encodes them.
- **Federal:** planning-grade - the AMT screen includes known preference items but not every Form 6251
  adjustment; per-lot basis and every minor phase-out are simplified by design. Nondeductible IRA basis and the
  Form 8606 pro-rata rule are modeled when the optional `nondeductibleBasis` field is set (see
  [Account depth](#account-depth-hsa-nondeductible-basis-property-sales) above); absent the field, IRAs are
  treated as fully pre-tax.
- Capital-loss: single pool, opening balance only, no wash-sale / section 1256 / section 1212-worksheet preservation;
  state conformity is modeled only for the encoded high-impact cases, not every per-state worksheet nuance.

## Related

[roth-and-withdrawals.md](roth-and-withdrawals.md) (conversions that drive most of the tax planning) ·
[optimizer.md](optimizer.md) (which co-optimizes against this engine) ·
[social-security.md](social-security.md) (benefit taxation).
