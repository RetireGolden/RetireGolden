/**
 * What a projection run publishes: the composed annual `YearResult` and the
 * whole-run `ProjectionResult` around it.
 *
 * One slice of the projection type surface. `../../types.ts` re-exports every
 * slice, so `projection/types.js` stays the single public specifier for all of
 * them; the package export map blocks `projection/internal/*`, so this module
 * is not separately importable. Declarations and the commentary attached to
 * them were moved here verbatim, so a block that says "above" or "below" may
 * now point across a module boundary.
 */
import type {
  AnnualQcdExecutionPrerequisiteEvidence,
  AnnualRetirementActionPublication,
  ExecuteAnnualQcdsResult,
  ExecuteConversionLinkedWithdrawalGroupsResult,
  ExecuteOrdinaryWithdrawalsResult,
  ExecuteRothConversionsResult,
} from '../../../actions/index.js'
import type { FederalTaxDetail } from '../../../tax/federalTax.js'
import type { RmdShortfallExciseResult } from '../../../rmd/rmdShortfallExcise.js'
import type { YearAcaResult } from './aca.js'
import type {
  EmployerRothAccountActivity,
  InheritedAccountYearEvidence,
  OwnedRothIraPoolActivity,
  OwnedTraditionalIraAggregateActivity,
  QualifiedAnnuityPaymentActivity,
  SocialSecurityStreamActivity,
} from './accountActivity.js'
import type { YearCashFlow } from './cashFlow.js'
import type {
  SimulatorAnnualOwnedNonRothIraPostGrowthSource,
  SimulatorCommittedOwnedNonRothIraAnnualReplay,
} from './ownedIraReplay.js'
import type {
  SimulatorAnnualRetirementRuntimeApplicationSource,
  SimulatorAnnualRetirementRuntimeSource,
} from './retirementRuntime.js'
import type { ProjectedFilingStatus, TaxYearInput } from './tax.js'
import type {
  PersonYearState,
  YearExpenses,
  YearIncomes,
  YearWithdrawals,
} from './yearLedger.js'

export interface YearResult {
  year: number
  /**
   * Exact cumulative general-inflation factor used by this simulation year.
   * `simulatePlan` always publishes it; optionality preserves compatibility
   * for external consumers that construct partial YearResult fixtures.
   */
  inflationScale?: number
  people: PersonYearState[]
  /** Filing treatment used for federal/state thresholds in this projection year. */
  filingStatus: ProjectedFilingStatus
  incomes: YearIncomes
  expenses: YearExpenses
  /**
   * Optional identity-bearing annual cash-flow reporting detail. `simulatePlan`
   * publishes it only when the capture option defined by DOCS/features/year-cash-flow.md (landing with the capture workstream) is enabled;
   * optionality also preserves external fixture compatibility. Its presence
   * never changes this year's economic outputs. Absence means detail was not
   * captured, not that the year had no cash flow.
   */
  cashFlow?: Readonly<YearCashFlow>
  /** Contributions actually made this year (after IRS caps). */
  contributions: number
  /**
   * Employee contributions credited specifically to complete owner-wide
   * non-Roth IRA pools. Published independently from runtime occurrence
   * records so source replay can prove that no physical credit was omitted.
   */
  ownedNonRothIraContributions?: number
  /**
   * Independently published live owned-IRA balances after every annual
   * mutation and immediately before growth. This authoritative boundary lets
   * source replay bind per-account applications without inferring stochastic
   * or allocation returns from year-end balances.
   */
  ownedNonRothIraBalancesBeforeGrowth?:
    Readonly<Record<string, number>>
  /** Physical pre-growth owned-IRA rows used to validate positional events. */
  ownedNonRothIraPhysicalBalancesBeforeGrowth?: readonly Readonly<{
    sourceAccountId: string
    balanceIndex: number
    balancePlanDollars: number
  }>[]
  /** Physical owned-IRA openings, including rows newly entering via S2. */
  ownedNonRothIraPhysicalOpeningBalances?: readonly Readonly<{
    sourceAccountId: string
    balanceIndex: number
    balancePlanDollars: number
  }>[]
  /**
   * Per-owner owned Roth-IRA pool assumed-basis consequential verdicts this
   * year. Published fact from the ledger's own execution — the
   * one-source-of-truth channel for insight detectors. Consumers must not
   * re-derive free-cover arithmetic. `simulatePlan` always publishes it
   * (possibly empty); optionality preserves fixture compatibility.
   */
  ownedRothIraPoolActivity?: readonly Readonly<OwnedRothIraPoolActivity>[]
  /**
   * Per-account employer Roth activity this year. Published fact from the
   * ledger's own execution — detectors must not re-derive it. `simulatePlan`
   * always publishes it (possibly empty); optionality preserves fixtures.
   */
  employerRothAccountActivity?: readonly Readonly<EmployerRothAccountActivity>[]
  /**
   * Per-owner Form 8606 owned-traditional-IRA aggregate activity this year
   * (excludes inherited and employer sources by construction). Published fact
   * from the ledger's own execution — detectors must not re-derive attribution
   * from household withdrawal/conversion totals. `simulatePlan` always
   * publishes it (possibly empty); optionality preserves fixtures.
   */
  ownedTraditionalIraAggregateActivity?:
    readonly Readonly<OwnedTraditionalIraAggregateActivity>[]
  /**
   * Qualified annuity payments actually paid this year, keyed by contract.
   * Published fact from the ledger's own execution — detectors must not
   * re-derive payout-form gates. Zero-payment contracts are omitted.
   * `simulatePlan` always publishes the array (possibly empty).
   */
  qualifiedAnnuityPayments?: readonly Readonly<QualifiedAnnuityPaymentActivity>[]
  /**
   * Per-stream Social Security activity this year. Published fact from the
   * ledger's own execution — detectors must not re-derive stream precedence,
   * benefit source, claim-in-force, or paid amounts. One entry per
   * `socialSecurity` income stream (including not-yet-claimed streams).
   * `simulatePlan` always publishes the array (possibly empty); optionality
   * preserves fixtures.
   */
  socialSecurityStreams?: readonly Readonly<SocialSecurityStreamActivity>[]
  /** Employer match contributions made this year. */
  employerMatch: number
  /** Forced traditional-account distributions (included in withdrawals.traditional). */
  rmd: number
  /** IRC §4974 excise included in `penalties`, never in `tax`, AGI, or MAGI. */
  rmdShortfallExciseTax?: number
  /** Per-applicable-plan required, timely-paid, shortfall, rate, and tax evidence. */
  rmdShortfallExciseDetails?: readonly Readonly<RmdShortfallExciseResult>[]
  /** Penalty-free 72(t) SEPP distributions this year (included in withdrawals.traditional). */
  sepp: number
  /**
   * Forced inherited-IRA distributions this year (traditional + Roth character).
   * Equals the sum of each `inheritedAccounts[]` row's executed required amount
   * (annual/year-of-death) plus final-sweep amounts; voluntary draws are not
   * included. Traditional forced dollars also join `withdrawals.traditional`
   * and ordinary income; Roth forced dollars join `withdrawals.roth` only.
   */
  inheritedDistribution: number
  /**
   * Forced inherited amounts from TRADITIONAL accounts only (forced-only;
   * subset of `withdrawals.traditional`). Roth forced dollars are excluded —
   * they are not ordinary income and never join the traditional withdrawal
   * total. Equals the traditional share of `inheritedDistribution`.
   */
  inheritedTraditionalDistribution: number
  /**
   * Per-account inherited-IRA execution evidence for the year. Present whenever
   * the plan carries any inherited account; one row per inherited account whose
   * beneficiary is alive in the year (and a successor-scope flag row after a
   * beneficiary death).
   */
  inheritedAccounts?: InheritedAccountYearEvidence[]
  /**
   * Gross qualified charitable distributions for the year — the physical gift,
   * not the excludable portion after the 408(d)(8)(A) second-sentence offset.
   * Exclusion from income is a separate tax-character channel
   * (`qcdIncomeOffset` / MAGI), not a shrinkage of this total. The owned-IRA
   * source series reconciles this figure to the overlay plus every moving QCD
   * occurrence.
   */
  qcd: number
  /** Dollars moved traditional → Roth this year (taxed as ordinary income, no penalty). */
  rothConversion: number
  /**
   * The live balances the shared aggregate-conversion allocation policy
   * weighted this year's owners by, keyed by account ID.
   *
   * THE KEYS CARRY NO ORDER, and a consumer must not read one into them. This
   * is a plain object, so JavaScript enumerates any integer-like key first and
   * in numeric order regardless of insertion — an account whose ID is `"12"`
   * moves to the front — and nothing in the Plan schema forbids such an ID.
   * Plan order is real and load-bearing for this policy (it decides the owner
   * slices, the destination search, and the order sources are drawn from), but
   * it lives in `plan.accounts` and is recovered by joining on it, which is
   * exactly what `optimizerAggregateConversionPromotion.ts` does before it
   * allocates. A caller that iterates these keys instead is reading an order
   * this field never had.
   *
   * These are the exact figures
   * `actions/aggregateRothConversionOwnerAllocation.ts` read, captured at the
   * instant it read them: after the year's forced distributions (Treas. Reg.
   * 1.408A-4 A-6(b) puts the RMD first) and before anything below drains a
   * source. They are pre-drain by definition, so they are not the year's
   * closing balances and never agree with `balances` for a converting account.
   *
   * WHY IT IS PUBLISHED. The optimizer's promotion path has to name whose
   * dollars moved, out of which account, into which — and the owner weights
   * that decide it are a fact about this projection, not about the Plan. A
   * promotion that re-derived them from the Plan's opening balances, or from
   * any other year's, would put a second-source number on a schedule a person
   * is invited to act on. This field is what the ledger saw.
   *
   * THE SET IS EXACTLY `participatesInAggregateRothConversionAllocation`:
   * every owned non-inherited traditional account (employer plans included)
   * and every Roth account of both kinds. A designated Roth account is in it
   * although no conversion may land in one, because it is what tells an owner
   * who holds only that kind apart from an owner who holds no Roth at all.
   * Nothing else is: cash, taxable, equity compensation, HSA, inherited
   * traditional, property and debt are absent because the policy reads none of
   * them.
   *
   * WHY IT MIGHT BE ABSENT, in full. `simulatePlan` publishes it for exactly
   * the years in which the aggregate allocation policy ran, so absence means
   * one of:
   *
   * - the year had a named conversion request, which makes the named executor
   *   authoritative and forces the aggregate mode to `none`;
   * - the Plan's conversion strategy is `mode: 'none'`;
   * - nobody in the household was alive in the year;
   * - a `fillToTarget` strategy whose window does not cover the year;
   * - a `fillToTarget` sizing that produced nothing to convert — an invalid
   *   bracket target, non-actionable ACA evidence, a safety-net floor trim, or
   *   simply no headroom — or a `manual`/`optimized` schedule with no entry for
   *   the year; in every one of those the sized household amount failed the
   *   `> AGGREGATE_ROTH_CONVERSION_EPSILON_PLAN_DOLLARS` test
   *   (`projection/moneyTolerance.ts`) and the policy was never called;
   * - the `YearResult` was constructed by an external consumer rather than by
   *   `simulatePlan`, which is what the optionality is for.
   *
   * Presence says the policy was asked, and nothing more. It does not say the
   * household converted: the policy may have refused it for want of any Roth
   * IRA, or trimmed an owner who has none, and the year then publishes this
   * snapshot beside a `rothConversion` of zero.
   *
   * The amount it was asked FOR is the sibling field
   * `aggregateRothConversionAllocationDesired`, published from the same call.
   */
  aggregateRothConversionAllocationBalances?: Readonly<Record<string, number>>
  /**
   * The household conversion amount the aggregate allocation policy was asked
   * for this year, in Plan dollars, BEFORE the policy trimmed any owner.
   *
   * WHY IT IS PUBLISHED SEPARATELY FROM `rothConversion`. `rothConversion` is
   * what the ledger moved, which for a household with an owner who holds no
   * Roth IRA is strictly less than the figure the policy was handed: that
   * owner's slice is dropped, and the difference never converts. A promotion
   * path that re-allocated the executed total would slice the surviving
   * owners' figure across the whole household a second time and trim the same
   * absent owner again, converting less than the ledger did for no reason
   * anyone chose. This field is the figure the ledger's own allocation
   * answers, so re-running the policy on it reproduces that allocation exactly.
   *
   * It is the amount AFTER the sizing pass and after the safety-net floor trim
   * — both decide how much the household is asking to convert — and BEFORE the
   * identity trim, which decides how much of that request can lawfully land.
   *
   * PUBLISHED IN EXACTLY THE YEARS
   * `aggregateRothConversionAllocationBalances` is, at the same instant and
   * from the same call: presence on one is presence on the other, and every
   * cause of absence listed on that field is a cause of absence here. Two
   * fields rather than one nested object because the balances are a map and
   * this is a scalar, and each is read on its own.
   *
   * Presence says the policy was asked for this much. It does not say the
   * household converted it.
   */
  aggregateRothConversionAllocationDesired?: number
  /**
   * Projection-only raw source capture for legacy retirement-account
   * mutations. A later replay consumer owns journal validation, structural
   * identity derivation, and sealing; this field changes no legacy movement.
   * `simulatePlan` always publishes it, while optionality preserves source
   * compatibility for external consumers that construct `YearResult` values.
   */
  retirementRuntimeSource?:
    Readonly<SimulatorAnnualRetirementRuntimeSource>
  /**
   * Raw owned non-Roth IRA balance applications observed at their live ledger
   * mutation sites. Additive only; no validation, identity, or sealing has run.
   */
  retirementRuntimeApplicationSource?:
    Readonly<SimulatorAnnualRetirementRuntimeApplicationSource>
  /**
   * Projection-only raw post-growth balances for every complete owner-wide
   * owned non-Roth IRA pool. This additive source does not affect simulation
   * economics and is not itself a validated or sealed annual observation.
   * `simulatePlan` always publishes it, while optionality preserves source
   * compatibility for external consumers that construct `YearResult` values.
   */
  ownedNonRothIraPostGrowthSource?:
    Readonly<SimulatorAnnualOwnedNonRothIraPostGrowthSource>
  /**
   * Present only for a private annual-pass attempt whose complete contiguous
   * replay exactly matched the basis character used by simulator economics.
   * A blocked or rolled-back replay is represented by absence, never by an
   * empty substitute. A year without a settlement attempt is also absent.
   */
  ownedNonRothIraAnnualReplay?:
    Readonly<SimulatorCommittedOwnedNonRothIraAnnualReplay>
  /**
   * Exact-cent ordinary-executor evidence. Named conversions publish through
   * `rothConversionActionExecution` instead of this legacy mixed-kind result.
   */
  retirementActionExecution?: ExecuteOrdinaryWithdrawalsResult
  /**
   * Canonical identity-bearing publication across annual action executors.
   * Present when the ordinary executor result is publication-eligible: either
   * clean execution evidence or conflict-only schedule diagnostics. Omitted for
   * legacy-only action-year-mismatch or duplicate-action-ID schedule issues,
   * which remain on `retirementActionExecution`. Executor-specific artifacts
   * remain on their dedicated result fields.
   */
  retirementActionPublication?: AnnualRetirementActionPublication
  /**
   * The year's conversion-linked withdrawal groups, executed.
   *
   * Present only in a year that declares at least one linked group, because a
   * year with none has nothing to say about them and an empty result would be
   * indistinguishable from a year whose groups were all evaluated to nothing.
   *
   * Nothing here moves a dollar, and the type says so: every group carries
   * `movement: 'none'` and the result carries `status: 'refused'`. What it
   * carries that the publication's records cannot is the merged schedule the
   * group's two legs would occupy, and — when the funding evaluation was
   * refused rather than made — which of its inputs was missing.
   */
  conversionLinkedWithdrawalGroupExecution?:
    Readonly<ExecuteConversionLinkedWithdrawalGroupsResult>
  /**
   * Request-keyed named Roth-conversion movement evidence. A non-actionable
   * result is published when annual basis, RMD-reserve, or funding proof is
   * unavailable; absence means no named conversion request existed this year.
   */
  rothConversionActionExecution?: ExecuteRothConversionsResult
  /**
   * Planning-prerequisite evidence for the named QCD requests this year that
   * the QCD executor published: the donor's exact age 70½ threshold date, the
   * resolved source and copied charity designation, and the annual stages that
   * remain unestablished. It establishes what is proven before any gift moves,
   * never that one moved or became actionable.
   *
   * Neither absence nor a short array proves what the year requested. A single
   * QCD is omitted when it shares an execution slot with a non-QCD action and
   * so stayed with the ordinary-withdrawal executor — and a year whose every
   * QCD is routed away like that has no field at all. The whole field is also
   * absent when the prerequisite batch failed closed on malformed input or a
   * legacy diagnostics-only year published no executor sources at all.
   * `retirementActionPublication` remains the authority on which requests were
   * published and by which executor, and this field is never present without
   * it.
   */
  qcdActionPrerequisites?:
    readonly Readonly<AnnualQcdExecutionPrerequisiteEvidence>[]
  /**
   * Request-keyed named charitable-distribution movement evidence, and the sole
   * authority on whether a gift moved. A committed result carries each gift's
   * executed cents, its execution date and sequence, and the complete post-pass
   * derived facts behind them; a staged result carries the issue that stopped
   * the year and no derived facts at all. Absence means no named QCD reached
   * its own executor this year.
   *
   * It never replaces `qcdActionPrerequisites`, which keeps publishing what was
   * proven before any gift moved. The two are always present together.
   */
  qcdActionExecution?: ExecuteAnnualQcdsResult
  /** Early-withdrawal penalties plus IRC §4974 RMD-shortfall excise; not in `tax`. */
  penalties: number
  /** MAGI realized this year (drives IRMAA two years later and the ACA credit). */
  magi: number
  /** Present only in years with a credit-enabled Marketplace premium. */
  aca?: YearAcaResult
  /** Medicare premiums charged this year (Part B incl. IRMAA + Part D surcharge, all covered people; excludes the user's "extras"). */
  medicarePremiums: number
  /** IRMAA-only portion of medicarePremiums (Part B and Part D surcharges above standard Part B). */
  irmaaSurcharge: number
  /** IRMAA tier the year's Medicare premiums were priced at (0 = standard premium; 1–5 = surcharge tiers). */
  irmaaTier: number
  /**
   * MAGI figure the year's IRMAA tier decision actually read (SSA-44 / two-year
   * lookback), not the current-year MAGI on `magi`. `simulatePlan` always
   * publishes it; optionality preserves compatibility for external consumers
   * that construct partial `YearResult` fixtures. Absence is evidence-absent —
   * never approximate the lookback from `magi`.
   */
  irmaaLookbackMagi?: number
  /**
   * Which arm of the MAGI fallback chain
   * (`magiHistory` → `historicalAnnualMagiByYear` → `recentAnnualMagi`)
   * supplied the SELECTED lookback figure on `irmaaLookbackMagi`.
   * `'planFallback'` is the coarse `recentAnnualMagi` stand-in (often 0) — not
   * evidence for implementation claims. Published beside `irmaaLookbackMagi`
   * whenever that field is; absence is evidence-absent.
   */
  irmaaLookbackMagiSource?: 'projected' | 'historicalInput' | 'planFallback'
  /**
   * Calendar year whose MAGI was selected for `irmaaLookbackMagi`. Under SSA-44
   * `min(year-2, year-1)`, this is the year of the minimum (ties keep year-2).
   * Published beside `irmaaLookbackMagi` whenever that field is; absence is
   * evidence-absent.
   */
  irmaaLookbackMagiYear?: number
  /**
   * MAGI boundary the household would have to stay under to avoid the NEXT
   * surcharge tier, priced by the simulator with its own inflation path and
   * IRMAA filing status (POMS HI 01101.020 QSS-on-single mapping). `null` when
   * no alive person had Medicare months this year (pre-enrollment — do not
   * treat as a live boundary) OR at the frozen top tier. Gate is Medicare
   * activity, not `irmaaTier === 0` (a low-MAGI enrollee still gets distance
   * to the first surcharge). `simulatePlan` always publishes it; optionality
   * preserves compatibility for external consumers that construct partial
   * `YearResult` fixtures. Absence (`undefined`) is evidence-absent — never
   * reconstruct the threshold from `inflationScale` or pack tables.
   */
  irmaaNextTierThreshold?: number | null
  /**
   * Advisory recomputation for planning surfaces: the exact `TaxYearInput`
   * handed to `computeFederalTax` for the gain-harvesting headroom probe, and
   * the `FederalTaxDetail` it returned. `detail.totalTax` is NOT the year's
   * settled liability (`tax` is — the funding solves can differ). Consumers
   * must treat absence as evidence-absent, never approximate. `simulatePlan`
   * always publishes it; optionality preserves compatibility for external
   * consumers that construct partial `YearResult` fixtures.
   */
  advisoryFederalTax?: Readonly<{ input: TaxYearInput; detail: FederalTaxDetail }>
  /** Federal alternative minimum tax included in `tax` when the planning-grade AMT screen binds. */
  amt: number
  /** Additional long-term gains realizable this year still taxed at 0% (gain-harvesting advisory). */
  ltcgZeroHeadroom: number
  /** Benefits withheld by the retirement earnings test (working early claimants). */
  ssEarningsTestWithheld: number
  /** SSDI paid this year (included in `incomes.socialSecurity`; 0 when disability is off). */
  ssdiPaid: number
  tax: number
  withdrawals: YearWithdrawals
  /** Signed capital gain-or-loss embedded in taxable withdrawals and other legacy taxable sales. */
  realizedGains: number
  /** Taxable account interest + dividends generated this year. */
  taxableYield: number
  /** Tax-exempt interest characterized for this year's program bases: in a known ACA contract year, the greater of the attested household total and the plan-generated subset; otherwise the account-generated total. */
  taxExemptInterest: number
  /** Capital-loss carryforward applied against this year's realized gains. */
  capitalLossUsedAgainstGains: number
  /** Capital-loss carryforward applied against ordinary income (≤ annual limit). */
  capitalLossUsedAgainstOrdinary: number
  /** Capital-loss carryforward balance carried into next year. */
  capitalLossCarryforwardRemaining: number
  /** Surplus cashflow invested (into cash, else taxable, else unassigned). */
  surplusInvested: number
  /** Spending the portfolio could not cover this year. */
  shortfall: number
  /**
   * Required-floor spending the portfolio could not cover this year — the
   * serious failure signal (a portfolio shortfall is charged to the
   * discretionary layer first and only reaches the floor once it is exhausted).
   */
  requiredShortfall: number
  /**
   * Target-lifestyle miss this year: a guardrail's deliberate discretionary cut
   * plus any portfolio shortfall that ate into funded discretionary spending.
   * Not the same as running out of money for essentials (see requiredShortfall).
   */
  targetShortfall: number
  /** Ideal spending not funded this year. */
  idealShortfall: number
  /** Excess/opportunistic spending not funded this year. */
  excessShortfall: number
  /** Guardrail action taken this year under a withdrawal-rate policy ('hold' when inactive). */
  guardrailAction: 'hold' | 'cut' | 'raise'
  /** Flexible one-time-goal outcomes this year (all 0 outside guardrail mode). */
  flexibleGoals: {
    funded: number
    partiallyFunded: number
    deferred: number
    skipped: number
    fundedAmount: number
    unfundedAmount: number
  }
  /** End-of-year balance per account id (after flows and growth). */
  balances: Record<string, number>
  /** Cash + taxable + traditional + roth + hsa (+ unassigned). */
  investableTotal: number
  /** Permanent-life cash value at year end (an asset, but held out of withdrawals). */
  insuranceCashValue: number
  /**
   * Remaining TIPS-ladder principal at year end (nominal book value: unmatured
   * face × inflation to date, ignoring rate moves). A dedicated asset held out
   * of withdrawals — counted in netWorth, not investableTotal. 0 without ladders.
   */
  ladderValue: number
  /** Income-tax-free life death benefit paid into the estate/beneficiary this year. */
  deathBenefit: number
  /** Tax-free HECM line-of-credit loan proceeds drawn this year (0 without a HECM). */
  hecmDraw: number
  /** Total HECM loan balance at year end, before the non-recourse floor (0 without a HECM). */
  hecmLoanBalance: number
  /**
   * investableTotal + property + insuranceCashValue + ladderValue − debt −
   * HECM loans (each capped at its home's value: non-recourse).
   */
  netWorth: number
}

export interface ProjectionResult {
  startYear: number
  endYear: number
  years: YearResult[]
  /** First year with any shortfall, else null. */
  depletionYear: number | null
  endingInvestable: number
  endingNetWorth: number
  /**
   * Remaining nondeductible (after-tax) traditional-IRA basis at the horizon,
   * capped per owner at their ending aggregated-IRA balance. This is after-tax
   * money an heir inherits tax-free (they file a separate Form 8606), so the
   * after-tax estate metric excludes it from the traditional heir tax. 0 when
   * no IRA carries nondeductible basis.
   */
  endingNondeductibleIraBasis: number
  /** Modeling caveats hit during this run (e.g. SS stream without a PIA). */
  warnings: string[]
}
