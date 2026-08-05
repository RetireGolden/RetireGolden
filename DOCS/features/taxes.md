# Taxes (federal + state)

The tax engine is what separates RetireGolden from most free planners: it models the interacting cascade —
Social-Security taxation → IRMAA → ACA cliff → NIIT → senior-deduction phase-out — that is the whole point
of Roth-conversion and withdrawal planning. It targets **planning-grade**, not filing-grade, accuracy.
Current-year figures and citations live in [domain-rules-reference.md](../domain/domain-rules-reference.md);
all dollar values come from versioned parameter packs, never hardcoded.
The source-verified [tax-strategy coverage and claim-control inventory](../domain/tax-strategy-coverage-inventory.md)
states which modeled results can support cockpit-v1 comparisons or actions and which require narrower wording
or prerequisite engine work.
Statutory authority is not restated in these pages. It lives in the typed, frozen rule registry
([engine/rules/taxRuleRegistry.ts](../../packages/engine/src/rules/taxRuleRegistry.ts)) — one record per rule with
the operative language quoted rather than paraphrased, the reading taken, the jurisdiction, the date last verified,
the engine sources implementing it, and a classification: `settled` where the engine returns the authority's
figure, `approximated` where it returns a knowably-wrong one — with a required `errorDirection` saying which way it
errs — `outOfScope` where it refuses to answer, and `unsettled` where it is working without controlling
authority. Cite the record ID; do not paraphrase the statute here.

**Code:** [engine/tax/federalTax.ts](../../packages/engine/src/tax/federalTax.ts),
[engine/tax/stateTax.ts](../../packages/engine/src/tax/stateTax.ts),
[engine/tax/aca.ts](../../packages/engine/src/tax/aca.ts),
[engine/tax/medicare.ts](../../packages/engine/src/tax/medicare.ts); parameter packs in
[engine/params/](../../packages/engine/src/params/) (federal in `data/year2026.ts`, state in `params/state/`).
The projection runs federal and state as two calculators over one income input
([engine/projection/simulate.ts](../../packages/engine/src/projection/simulate.ts)).

## Federal engine

Computed each year inside the projection loop. The ledger is **nominal**, so for a year with no published
parameter pack the annually-indexed federal figures are carried forward at the plan's inflation rate before
income meets them (`indexFederalTaxPack`): rate-bracket bounds (IRC 1(j)(3)(B)), the standard deduction and
age-65 addition (63(c)(7)(B)(ii), 63(c)(4)), the 15%/20% capital-gain breakpoints (1(j)(5)(C)), and the AMT
exemption, phase-out threshold and 28%-rate threshold (55(d)(4)(B), 55(d)(3)(B)). The statutory rounding
steps and the C-CPI-U basis are not reproduced — the same two approximations `limitScale` makes for the
contribution limits. Figures with **no** indexing provision are deliberately left flat and creep by design:
the §86 provisional-income tiers, the §1411 NIIT thresholds, the §121 exclusion, the §1211(b) $3,000 offset
and the §151(d)(5)(C) senior deduction; the SALT cap follows its own §164(b)(7) schedule. The optimizer LP
reads the same projected pack, so it prices conversions on the thresholds the exact ledger will apply.
State brackets are a separate question and are still held nominal (see `params/state/index.ts`).

- **Ordinary income stack:** wages, interest, non-qualified dividends, traditional withdrawals/conversions,
  pension/annuity taxable parts, and **taxable Social Security** (provisional-income 0/50/85% tiers — the
  thresholds are statutorily unindexed, so more benefit becomes taxable over time; this is modeled, not
  indexed).
- **LTCG + qualified dividends** stack at 0/15/20% on top of ordinary income; the 0%-bracket headroom is
  surfaced as a gain-harvesting opportunity.
- **Deductions:** standard deduction + age-65 additions + the **$6,000/person senior deduction
  (2025–2028)** — a major Roth-conversion interaction for 65+ planners; itemized as a
  simple user-entered total (SALT cap, mortgage interest, charitable) where it beats the standard.
  IRC §151(d)(5)(C)(iii)(I) phases out the **per-person** $6,000 at 6% of MAGI over the threshold, so
  each qualifying person's share runs out separately and two people 65+ reach zero at the same MAGI as one.
- **MAGI:** AGI plus foreign income excluded under §§911/931/933. Both the NIIT (§1411(d)) and the senior
  deduction phase-out (§151(d)(5)(C)(iii)(II)) run off that figure rather than the AGI line.
- **NIIT** 3.8% over $200k/$250k MAGI (unindexed). **Early-withdrawal penalty** 10% pre-59½, with the
  Rule-of-55 / 72(t) **SEPP** exceptions ([strategies/sepp.ts](../../packages/engine/src/strategies/sepp.ts)).
  Both SEPP methods — required-minimum-distribution and amortization — divide by the IRS **Single Life Table**
  from the parameter pack, which is unisex and fixed by regulation, so nothing in the SEPP path takes a sex; a
  SEPP on an employer plan additionally requires separation from service, proved in the annual ledger from the
  owner's plan retirement age (domain rules §11).
- **QCD:** a modeled household QCD is excluded from ordinary income and counts toward an RMD when one is due. It
  is **not** conditional on an RMD: the pre-RMD window from 70½ (resolved from the birth month at annual
  granularity — attained 71, or attained 70 with a January–June birth month) to the applicable RMD age is open,
  and dollars requested beyond the owner's IRA RMD are debited straight from donor-owned aggregated IRAs, shrinking
  every later RMD base. Only the taxable share of the routed RMD dollars reduces income; the beyond-RMD dollars
  never entered it, so deducting them would be phantom. The annual ledger still applies eligibility and the annual
  limit to the household rather than to each donor, and still runs pro-rata basis recovery across the whole
  distribution before subtracting the gift — both are registered approximations (domain rules §6).
- **Planning-grade AMT screen:** AMTI starts from taxable income plus modeled AMT add-backs (the §63(c)
  standard deduction for non-itemizers, itemized SALT when itemizing, the §151 senior deduction on either
  branch per §56(b)(1)(D), and any advanced calculator-only
  preference items supplied by tests or future integrations). The engine applies the 2026 AMT exemption,
  exemption phase-out, and tentative minimum tax, preserving LTCG/qualified-dividend preferential rates, then
  adds the excess over regular tax when AMT binds. This is a conversion-risk screen, not a Form 6251
  substitute.
- **IRMAA:** Medicare Part B/D surcharges from **MAGI two years prior** (a conversion at 63+ hits Medicare
  pricing); the brackets are cliffs, so bracket-edge warnings show "$1 over costs $X/yr"
  ([medicare.ts](../../packages/engine/src/tax/medicare.ts)). The **top** tier ($500k/$750k) is frozen through
  premium year 2027 and then resumes indexing off an August 2026 base; the four tiers beneath it index without
  interruption (domain rules §7).
- **SSA-44 redetermination (opt-in, `expenses.healthcare.ssa44`):** after a qualifying life-changing event —
  a couple's first death, and optionally each person's retirement year — the two following premium years
  price IRMAA on **min(lookback MAGI, prior-year MAGI)**, the planning-grade stand-in for the current-year
  estimate Form SSA-44 lets a beneficiary submit (domain rules §7). The optimizer shifts those years'
  IRMAA-binary source to (t−1) in-solve. Off/absent = the plain lookback; the couples' **Survivor
  transition** view shows the with/without delta per death timing.
- **ACA planning-year premium tax credit** (pre-65): the exact ledger reconciles current-year healthcare
  cash need, withdrawals, tax, and ACA household MAGI before reporting a result
  ([aca.ts](../../packages/engine/src/tax/aca.ts)). ACA MAGI is final federal AGI plus nontaxable Social
  Security, characterized tax-exempt interest, explicit foreign-exclusion addbacks, and required-filer
  dependent MAGI. Addbacks affect ACA MAGI without becoming ordinary taxable income; the foreign-exclusion
  amount also participates in Social Security provisional income under §86. Signed federal AGI is preserved
  through ACA component assembly and only the final household total is floored at zero.
- An explicit per-year contract separates the tax family and required-filer dependents from covered members
  and months, carries the 48/DC versus Alaska/Hawaii poverty table, and supplies separate enrollment and
  SLCSP benchmark premiums. The result labels gross enrollment premium, applicable SLCSP, modeled allowable
  PTC, and economic net premium.
- The modeled 2026 schedule has the exact 133% step and treats exactly 400% FPL as eligible and above 400%
  as the cliff. Below 100%, missing/unknown material facts, unsupported filing/eligibility mechanics, and
  non-convergence fund gross premium with typed non-actionable evidence.
- **Age-65 transition:** Medicare eligibility starts in the birth month of the year a member turns 65, so
  that year is prorated — `birthMonth − 1` marketplace months feed the household ACA pool and the remaining
  months carry Part B/D (and Medicare extras). The credit itself is computed **monthly**
  (`acaEconomicPremiumByMonth`): each covered month compares its SLCSP with
  `expectedContribution/12`, capped by enrollment premium, so a
  five-month transition owes five-twelfths of the expected contribution, not a full year of it.
  Planning-grade: the born-on-the-1st prior-month rule is not modeled.
- This is not APTC cash timing and does not calculate a Form 8962 refund, repayment, or balance due. APTC
  transaction detail, Form 8814, special allocation/MFS exceptions, and self-employed deduction interactions
  remain outside the model and must be asserted not applicable or the result is non-actionable.
- The standard planner UI does not yet author the additive `expenses.healthcare.acaYears` contract; it can
  only set the legacy monthly-premium and credit toggle. Plans created or saved through that UI with the
  toggle enabled therefore intentionally fail closed to gross premium and `missing-year-contract` evidence.
  Actionable current-year ACA pricing currently requires a schema/API/import-authored contract.
- **Survivor filing status:** married-couple projections retain MFJ treatment in the year one spouse dies.
  After that, survivor years file single unless `household.hasQualifyingDependent` is enabled, in which case
  the next two years use qualifying-surviving-spouse treatment (MFJ brackets/deduction for tax parameters).
  IRMAA is the exception: SSA's threshold tables group QSS with single/HOH filers (POMS HI 01101.020), so
  QSS years price Medicare premiums at the single thresholds.

The engine emits full per-year tax detail (AGI, MAGI variants, taxable income, marginal + effective rates,
IRMAA tier) for the results table, charts, and CSV.

## Capital-loss carryforward

A starting net capital loss (e.g. an ESPP sold at a loss) is a common attribute a near-retiree brings to
the plan, and current-year aggregate-basis sales can add a new signed loss to the same pool. The rule
([`applyCapitalLossCarryforward`](../../packages/engine/src/tax/federalTax.ts)):

1. Net the opening carryforward against this year's realized gains, then add any current-year signed loss;
2. then up to **$3,000/yr** against ordinary income (a fixed, never-indexed pack constant,
   `capitalLossOrdinaryOffsetLimit`);
3. remainder carries forward indefinitely.

Crucially it applies **before AGI**, so the offset cascades: lower AGI → lower provisional income (less
taxable SS) → lower MAGI (IRMAA/ACA). The netting is a pure boundary helper applied to *both* the federal
and state calculators, and the depleting pool threads year-to-year through `simulate.ts` like the Roth
basis pools — so every withdrawal/conversion probe inherits the benefit. The results page shows it
deplete, with a first-year callout and a combined "you can realize ~$X in gains tax-free this year" figure
(remaining pool + 0%-bracket headroom). It is a **single pool** (no short/long-term split). Legacy taxable
withdrawals, individually owned taxable ordinary-withdrawal actions, annual rebalances, and taxable funding
of annuity or TIPS purchases use the same aggregate-basis economics. Action execution performs that
calculation in exact integer cents; the legacy paths use the shared planning-dollar helper. Basis above fair
market value is preserved rather than capped, so those paths can emit a negative signed result; a full sale
recovers all remaining aggregate basis.
This remains a planning aggregate, not tax-lot or wash-sale accounting. The optimizer conservatively floors
its MILP capital-gain base at zero; fixed action character is included in that conservative base, and every
candidate is repriced by the authoritative exact-ledger re-run.

## Taxable ordinary-withdrawal actions

The annual projection executes a named taxable brokerage source only when it can construct immutable,
exact-cent evidence for an individually owned account and one unambiguous projected annual tax unit. Supported
units are a single living member filing single or qualifying surviving spouse, or exactly two living members
filing jointly. The owner must belong to that unit and has an exact 1/1 beneficial share. Joint brokerage
ownership, married-filing-separately and other multiple-tax-unit attribution remain unsupported and fail
closed without moving the account.

Opening fair market value and aggregate basis cross into the action ledger independently. An invalid basis
therefore produces `withdrawal-taxable-basis-unsupported` without concealing a valid balance. Each sale
atomically commits its exact closing balance and closing basis; sequential actions use the prior action's
closing values, and a same-year residual legacy sale uses the action-adjusted balance and basis. Capital-gain
and capital-loss character is summed in integer cents and crosses back into the annual tax model once. The
signed result participates in conversion and bracket sizing, withdrawal tax probes, carryforward, federal and
state tax, MAGI/ACA/IRMAA, optimizer inputs, realized-gain results, and taxable-withdrawal reporting. Sale
proceeds enter liquidity once and are not also treated as income or as a second account debit.

This is still annual, planning-grade valuation: the account's current annual state is used for the action even
when the request has a civil execution date. Dated market valuation, tax lots, wash sales, joint attribution,
and filed-return state tax-unit reconstruction are not modeled.

## Named Roth-conversion actions

A `rothConversion` retirement action names an owner, its source accounts, and a destination Roth, and the annual
projection commits it: sources are debited and the Roth credited inside the year's ledger, outside the legacy
withdrawal map so no account is debited twice, with a conversion basis layer opened for the 5-year clock. Zero- and
nonzero-basis owners move identical dollars
([actions/rothConversionExecution.ts](../../packages/engine/src/actions/rothConversionExecution.ts)).

Admission turns on the Form 8606 basis **numerator being known**, not on its being zero. Reading `zeroBasis` as the
admission predicate would make admission depend on the settlement that admission governs, which is circular. At a
proven-zero numerator the executor states the whole gross as taxable. At a positive one it commits the dollars and
states **no** character — the taxable and nontaxable figures go null together, and half-stating the pair is
rejected — and the annual settlement supplies the Form 8606 line-10 ratio back through the assumption vector the
annual pass already iterates, so the year holds one answer to the owner's pro-rata question rather than a second
mid-year one. The conversion layer's recapture amount is then the credited dollars net of that basis return, per
§408A(d)(3)(F)(ii): at a positive numerator the basis rolled into the Roth was never included in income, so it
carries no recapture.

Still refused, with balances unchanged and an exact reason: a conversion whose tax is funded by a linked sibling
withdrawal (`conversion-tax-funding-evidence-unsupported` — the atomic annual group executor that would move both
together does not exist, and the sibling withdrawal is refused for the same reason), withholding from conversion
principal, and a request larger than the source. There is no partial-execution arm: a conversion that would be
trimmed blocks rather than converting what fits.

The optimizer cannot propose one. A plan that already carries retirement actions is refused up front by the typed
`optimizerUnsupportedRetirementActions` precondition, because the optimizer prices conversions against aggregate
account balances that do not reflect what a recorded action moves. And any schedule it would otherwise publish that
converts a positive amount is vetoed `identityIncomplete` — an aggregate schedule carries no owner, source, or
destination — so today the optimizer publishes a positive-conversion recommendation to nobody, and the tournament
falls back to whatever conversions the plan already carries. The LP does now net committed action movement into its
per-year balance recursion, so the arithmetic is in place ahead of the veto being liftable.

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
Source data comes from each state's own revenue department, statutes and forms, with PolicyEngine-US and the
Tax Foundation used only as cross-checks and change-detectors — never as the cited source
([TEMPLATE.md § Sourcing rules](../domain/state-tax-research/TEMPLATE.md)). The per-state research is captured
in [domain/state-tax-research/](../domain/state-tax-research/) and transcribed into dated packs under
`engine/params/state/`.

Each state pack (`StateTaxParams`) carries `hasIncomeTax`, `taxesSocialSecurity`, `standardDeduction`,
`brackets` (single / MFJ), separate `retirementPrivate` and `retirementPublic` exclusions (`none` / `full` /
`capped` with `capPerPerson` and `minAge`), and capital-gain treatment metadata. State taxable income =
ordinary + qualified dividends + taxable capital gains where the state includes them + (taxable SS if the
state taxes it) - private/public retirement exclusions - standard deduction, floored at 0, then bracketed.

Nine jurisdictions - AZ, CO, DC, IA, ID, MO, MT, ND, NM - do not publish a standard deduction of their own.
Their packs carry a copy of the **federal** figure, tagged `standardDeductionConformity: 'federal'` (for CO
and ND the brackets run on federal taxable income, so the field is what converts the engine's gross base into
that base). Because `indexFederalTaxPack` projects the federal original past the pack year under IRC
63(c)(7)(B)(ii), `indexConformedStateStandardDeduction` moves the copy by exactly the same factor - otherwise
one engine would hold two values for one statutory amount in a single projected year and tax the whole
widening gap at the state rate. This is not state indexing: nothing else in the pack moves, including the
brackets and the retirement-exclusion caps, which are state figures under state law. ME and SC decoupled from
the federal deduction for 2026 and are deliberately untagged.

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
  and required **no migration** for that field.)
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
  tax-free basis, pro-rata across the owner's aggregated IRAs. The actions package also exposes a pure
  annual exact-cent substrate for owned traditional/SEP/SIMPLE IRAs: it requires a prevalidated complete
  owner-wide pool and complete line 1-8 facts, builds separate once-rounded line-7/line-8 ledgers, and
  derives allocation-bound line-7 basis-return/ordinary-income character. A second pure prerequisite
  boundary binds that character to explicit owner, source, and civil-date evidence; excludes basis from
  penalty exposure; applies the exact 59½ and SIMPLE two-year thresholds; and calculates a provisional
  per-allocation exact-cent candidate before exceptions. Caller-explicit positive disability evidence
  can finalize zero penalty
  for matching under-59½ ordinary-income allocations when it proves the owner qualified on or before
  the exact distribution date; that result bypasses SIMPLE participation/rate evidence. Otherwise a
  `penaltyApplies` result requires explicit negative proof of age, death, IRA SEPP, disability, and
  other-exception scope. The no-SEPP record must say `none` with null election/schedule IDs, and the
  no-other-exception attestation is planning evidence rather than filing-grade legal adjudication.
  Complete penalty-applicable allocations are grouped by owner, year, and exact rational rate. The
  boundary sums each bucket's exposure with bigint arithmetic, rounds the bucket penalty once
  nearest-cent-half-up, then allocates cents by floor quotas and largest remainders with canonical
  identity tie-breaking; public immutable bucket evidence makes that conservation auditable. A
  non-circular applicability ID binds each member's character, rate, identity, and complete rejected-
  exception tuple into the shared bucket ID, so changing one member's exception evidence changes every
  member final ID in that bucket. Missing
  evidence on any same-rate member leaves the whole bucket `exceptionEvaluationRequired`, while a
  complete different-rate bucket may finalize; malformed or contradictory evidence fails closed. A
  public pure annual finalization gate composes both boundaries over
  staged executed-gross withdrawals and atomically publishes an owner/year evidence bundle only when
  every taxable allocation is final under the age-59½, disability zero-penalty, or fully evidenced
  penalty-applicable arms. Basis-only
  allocations require coverage but no evaluation; unresolved allocations instead return typed
  `withdrawal-penalty-evidence-missing` issues and suppress the whole bundle. The gate reports
  `movement: notCommitted`; it is not executor/simulator integration or action readiness and does not
  change the legacy projection path. A separate pure
  `stageOwnedNonRothIraOrdinaryWithdrawalMovements` API accepts one owner/year of dated IRA-only
  ordinary-withdrawal requests, exact-cent openings, and immutable owned traditional/SEP/SIMPLE
  source proofs. It stages canonical sequential physical candidates, including partial and
  unavailable outcomes, and emits only positive actually staged cents as line-7 inputs directly
  consumable by the annual gate. Its `movementCandidateId` binds all requests, source facts,
  before/after evidence, and line-7 entries. A pure
  `coordinateOwnedNonRothIraAnnualWithdrawalCandidate` API now owns that handoff: it exact-rejoins
  requested source facts to the annual pool, derives candidate-bound scheduled-date penalty evidence,
  and binds the movement, line-7 allocation, and finalization evidence IDs. That generated date
  evidence is not external actual-execution proof. All four result arms remain
  `movement: notCommitted` and `actionability: notEstablished`; the coordinator can bind a
  `penaltyApplies` evidence outcome but neither commits balances nor integrates with execution or simulation.
  The pure `coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate` boundary now adds
  Plan-identity-authoritative, runtime-snapshot-bound planning evidence: it derives the complete
  Plan owner/year ordinary-withdrawal batch and owned non-Roth IRA pool rather than accepting
  caller-authored requests or account identities. It requires a Plan classification for every pool
  member plus complete, common-ledger-run opening and Form 8606 year-end snapshots, annual basis and
  line-7 completeness (including an explicit no-omitted-activity attestation), complete line-8 inventory,
  and exact alive evidence before staging. The boundary derives annual totals internally, but every
  arm still reports `movement: notCommitted` and `actionability: notEstablished`; it neither commits
  movement nor supplies execution or simulation authority.
  The separate pure `executePlanOwnedNonRothIraAnnualWithdrawals` API reruns that complete Plan-owned
  coordinator input instead of accepting a forgeable coordinated result. Coordinator blocking arms remain
  unchanged. An all-zero batch becomes established, normative refusals with unchanged balances and null
  executed dates, while only a bound annual result can commit exact opening-to-closing cents and report
  `actionability: established`. The committed result rejoins every positive allocation to its annual tax
  character and penalty coverage, plus a final penalty evaluation only when its ordinary-income exposure
  is positive; preserves scheduled dates for all actions but
  reports executed dates only for positive movement; and publishes one collision-checked structural
  execution ID with the upstream Plan/coordinator IDs still visible. This standalone commit API is not
  integrated into projection simulation and does not prove custodian settlement or filing-grade treatment.
  The pure `buildAnnualRetirementPhysicalEventInventory` API now creates the complete chronology input
  required before that authority can be integrated. It derives Plan traditional-account allocations and
  combines them with an exact Plan/year/ledger-run runtime inventory for RMD, automatic SEPP, legacy
  withdrawal/conversion, in-year IRA and employer-plan account-balance contribution inflows,
  and configured employer match. Aggregate legacy QCD reclassification, annuity funding, rollover
  inflows, and other traditional transfers remain unresolved until a later contract binds their producer
  and physical endpoints. Following-year IRA
  contributions designated for the prior tax year remain separate annual-basis facts rather than events
  in this calendar-year chronology. A shared movement authority may cover multiple source members only
  under the same owner/kind/origin/date/sequence binding; upstream evidence stays member-specific and the
  attestation's upstream lineage is structurally bound. Missing identity or chronology remains a
  typed unresolved record and blocks the inventory; no December 31 date, source, or sequence is inferred.
  Successful output groups the globally ordered stream by owned-IRA pool and provisionally separates
  Form 8606 line 7, line 8, QCD-awaiting-stage, and non-Form-8606/foreign-pool activity. Those categories
  are routing inputs only: the API changes no balance or basis, calculates no character, tax, or penalty,
  and leaves movement uncommitted and actionability unestablished.
  The standalone-only `buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput` boundary now
  binds the canonical candidate, complete owner-wide December 31 pool, basis, and contribution-window
  evidence into a frozen classifier input without classifying or executing it; see
  [domain rules §16](../domain/domain-rules-reference.md#16-account-eligibility-hsa-nondeductible-basis-and-fixed-asset-disposition-opt-in).
  Separately, `validateOwnedNonRothIraSeppCurrentPaymentCandidate` validates one current named SEPP
  payment as a provisional schedule-state transition. Its raw payment record references the canonical
  distribution and prior terminal state rather than restating caller-computed actual gross, character,
  prior totals, or dates. It requires exact prior scheduled/actual-qualifying equality, rejects a reused
  distribution evidence ID from complete supplied history, derives current actual gross and taxable
  character from canonical coverage, and retains all-basis gross with zero prospective ordinary income.
  The first previous state is the annual opening; every later previous state is the predecessor's derived
  after state, and the structural history ID binds that terminal lineage. New history, after-state, and
  candidate IDs are fixed-width SHA-256 structural digests; legacy opening and canonical coverage IDs
  retain their existing formula. For public compatibility, an empty legacy history may omit terminal
  proof and infer the opening while retaining its opaque history ID; populated history without terminal
  proof is typed nonconforming.
  It always reports pending annual reconciliation and explicitly establishes no penalty treatment,
  movement, actionability, finalization, binding, readiness, execution, or simulation authority. It is
  not connected to the penalty evaluator, annual finalizer, or coordinator. The pure
  `reconcileOwnedNonRothIraSeppAnnualSchedule` API now revalidates a complete election/source/year tuple:
  it reconstructs histories and the predecessor chain internally, orders same-day stable identities by
  locale-independent UTF-16 code units, takes character coverage only from a
  structurally verified complete inventory, requires an exact inventory/payment bijection, rejects
  lifetime and current-year replay/forks/duplicates/omissions/extras, requires prior-election history to
  end exactly the day before the tax year, rejects lifetime distribution IDs reused by current
  non-distribution evidence, and requires scheduled and actual terminal gross to equal the annual
  schedule. Its new structural IDs are fixed-width digests. All-basis payments remain gross members but add zero
  prospective ordinary exposure. “Complete” is relative only to the supplied inventory. The penalty
  prerequisite now accepts routed raw annual inputs, derives all canonical character coverage first,
  builds the full source-account inventory internally, reconciles, and exact-rejoins payments. Only a
  complete `reconciled` route produces final `iraSeppQualified` zero-penalty evidence; every non-success
  route remains `exceptionEvaluationRequired` and supplies no negative-SEPP authority. Submitted routes
  cannot coexist with no-SEPP evidence. All-basis payments remain schedule members without evaluations;
  age and disability precede SEPP; qualified SIMPLE payments bypass participation/rate facts while fallback
  SIMPLE remains 25%/10%. The annual finalizer and coordinator now forward raw routes, consume complete
  qualified outcomes, preserve full route diagnostics when blocked, and transitively bind compact route
  results into finalization and candidate evidence. A public staged-date ID builder reproduces the
  coordinator's deterministic planning-evidence formula, but exact rejoin stays inside the coordinator.
  This establishes no actionability, movement, readiness, execution, or simulation.
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
[`packages/planner-ui/src/integration/incomeCoverage.test.ts`](../../packages/planner-ui/src/integration/incomeCoverage.test.ts) proves that
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
- **Charitable and NUA scope:** generic itemized-charitable, QCD, and charitable-estate fields do not model a
  donor-advised fund. There is no DAF contribution/bunching/grant workflow and no appreciated-property
  transfer or DAF-specific deduction treatment. Net unrealized appreciation (NUA) is also absent: equity-comp
  aggregate basis is not a qualified-plan employer-stock NUA election. Neither DAF nor NUA may be presented as
  a modeled opportunity or action.
- **Implementation actions:** annual ledger outputs are household planning estimates, not custodian-ready
  instructions. In particular, **aggregate** Roth-conversion schedules — manual, fill-to-target, and
  optimizer-produced — do not identify an owner, source account, or destination account; a named `rothConversion`
  action does, and is the only conversion path that commits to identified accounts. The QCD input does not identify
  the eligible person, IRA, charity, or direct transfer. Withdrawal-order results report account-category
  totals; sequential and bracket-targeted draws
  consume same-category accounts in plan-array order, so those totals do not identify an implementation-ready
  owner/account source either. The engine does not select security lots, establish deadlines or legal
  eligibility, populate tax forms, transmit an instruction, or record professional confirmation. See the
  [claim-control inventory](../domain/tax-strategy-coverage-inventory.md) before turning any result into cockpit
  copy or an implementation checklist.

## Related

[roth-and-withdrawals.md](roth-and-withdrawals.md) (conversions that drive most of the tax planning) ·
[optimizer.md](optimizer.md) (which co-optimizes against this engine) ·
[social-security.md](social-security.md) (benefit taxation).
