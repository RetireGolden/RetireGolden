import type { AssetClassId } from '../model/plan.js'
import type { FilingStatus } from '../params/types.js'
import type {
  AccountId,
  AnnualIraBasisAllocationEvidence,
  AnnualIraBasisRatio,
  AnnualQcdExecutionPrerequisiteEvidence,
  AnnualRetirementActionPublication,
  ExecuteAnnualQcdsResult,
  ExecuteOrdinaryWithdrawalsResult,
  ExecuteRothConversionsResult,
  PersonId,
  PlanId,
  UsdCents,
} from '../actions/index.js'
import type { SimulatorAnnualRetirementRuntimeOccurrence } from './annualRetirementRuntimeJournal.js'
import type { CompleteSimulatorOwnedNonRothIraAnnualObservation } from
  './ownedNonRothIraAnnualObservation.js'

/**
 * Projection engine types. The deterministic annual ledger is the core v2
 * artifact: Monte Carlo (roadmap V4) drives this same simulation with
 * stochastic inputs, never a separate model.
 *
 * @see DOCS/architecture.md (simulation core)
 */

/**
 * Per-year stochastic market conditions for one simulation path (roadmap V4).
 * Index 0 = the projection's startYear. Years past the end of a series fall
 * back to the deterministic assumptions, so a short series degrades gracefully.
 */
export interface MarketSeries {
  /**
   * Additive percentage-point shock applied each year to every non-cash
   * investable account's expected return (single-factor market model). For
   * allocated accounts it applies to the non-cash share of the blend unless
   * per-class shocks are supplied below.
   */
  returnShockPct?: number[]
  /** Realized inflation rate (percent) per year, replacing assumptions.inflationPct from startYear on. */
  inflationPct?: number[]
  /**
   * Per-class additive shocks for accounts with an opt-in allocation
   * (asset-allocation-and-return-model-v2, step 6). A class without a series
   * falls back to `returnShockPct` (cash: no shock). Unallocated accounts
   * always use `returnShockPct`, so single-return plans are unaffected.
   */
  classReturnShockPct?: Partial<Record<AssetClassId, number[]>>
}

export type ProjectedFilingStatus = FilingStatus | 'qualifyingSurvivingSpouse'

/**
 * QSS uses the joint tax tables, deduction, and AMT exemption. IRMAA is the
 * exception: SSA's threshold tables group qualifying surviving spouses with
 * single/HOH filers (POMS HI 01101.020), so the Medicare premium calculation
 * maps QSS to `single` instead of using this helper.
 */
export function taxParameterFilingStatus(status: ProjectedFilingStatus): FilingStatus {
  return status === 'single' ? 'single' : 'marriedFilingJointly'
}

export interface TaxYearInput {
  year: number
  filingStatus: ProjectedFilingStatus
  /** Wages, traditional withdrawals, pension/annuity taxable parts, taxable recurring/one-time income. */
  ordinaryIncome: number
  /** Signed realized long-term capital result; losses are negative. */
  capitalGains: number
  /** Raw signed capital result before federal carryforward netting; used by nonconforming states. */
  realizedCapitalGainsBeforeCarryforward?: number
  /** Taxable interest generated in taxable brokerage accounts (already included in ordinaryIncome). */
  taxableInterestIncome?: number
  /**
   * Federally tax-exempt interest. Not ordinary income, but included in Social
   * Security provisional income and program-specific ACA household MAGI.
   */
  taxExemptInterest?: number
  /**
   * Income excluded from AGI under the foreign and possessions exclusions —
   * §911 foreign earned income and housing, and §931/§933 possessions income
   * (American Samoa, Guam, the Northern Marianas, Puerto Rico), which is not
   * "foreign earned" in the §911 sense but is excluded all the same. The engine
   * carries one figure for all of them.
   *
   * It is not ordinary taxable income and never enters the AGI line, but three
   * separate definitions reach past AGI to pick it back up: IRC §86 puts it
   * into Social Security provisional income, §1411(d) and
   * §151(d)(5)(C)(iii)(II) put it into the modified AGI that prices the NIIT
   * threshold and the senior-deduction phase-out, and ACA household MAGI
   * carries it too. Omitting it therefore understates tax and overstates the
   * senior deduction at once — supply it whenever the household claims any of
   * those exclusions, not only when Social Security is in play.
   */
  foreignExclusionAddback?: number
  /**
   * Interest on U.S. government obligations (TIPS ladder coupons + inflation
   * accretion), already included in ordinaryIncome AND taxableInterestIncome.
   * Federal tax applies in full (incl. NIIT); every state exempts it, so the
   * state calculator subtracts it from state taxable income.
   */
  usGovernmentInterest?: number
  /** Non-qualified dividends generated in taxable brokerage accounts (already included in ordinaryIncome). */
  ordinaryDividends?: number
  /** Qualified dividends taxed at preferential federal rates but included in AGI/MAGI. */
  qualifiedDividends?: number
  /** Gross Social Security benefits received. */
  ssBenefits: number
  /** Living household members aged 65+ this year (drives age-based deductions). */
  peopleAged65Plus: number
  /** State of residence this year (two-letter code); drives state tax. */
  state?: string
  /** Part-year state residency allocation for the tax year. */
  stateResidency?: { state: string; months: number }[]
  /**
   * Portion of ordinaryIncome that is retirement income (pension + annuity
   * taxable part + traditional/RMD distributions, excluding Roth conversions),
   * for state retirement-income exclusions. Federal tax ignores this.
   */
  retirementIncome?: number
  /**
   * Private retirement income eligible for the state's private retirement rule.
   * Replaces retirementIncome; the legacy field remains accepted by calculators.
   */
  privateRetirementIncome?: number
  /** Public civil/military pension income eligible for the state's public pension rule. */
  publicPensionIncome?: number
  /** Ages of living household members this year, for age-based state exclusions. */
  agesAlive?: number[]
  /**
   * Itemized-deduction components in nominal dollars (roadmap V8). When present,
   * federal tax uses the greater of the standard deduction and the itemized
   * total. SALT is the user's estimated deductible state/local/property tax
   * (kept as an input to avoid a circular dependency on the computed state tax).
   */
  itemizedDeductions?: {
    stateAndLocalTaxes: number
    mortgageInterest: number
    charitable: number
  }
  /**
   * Advanced calculator-only AMT preference/adjustment items. Projection does
   * not populate this from Plan fields today; the federal tax calculator already
   * derives standard-deduction and itemized-SALT add-backs from normal inputs.
   */
  amtPreferenceItems?: number
  /**
   * Cumulative general-inflation factor from the parameter pack's year to this
   * one, used to project the annually-indexed federal figures (rate brackets,
   * standard deduction, capital-gain breakpoints, AMT amounts) onto a year the
   * pack only stands in for. 1 -- the default -- means "use the pack as
   * published", which is right for a year that has its own pack.
   *
   * The projection is nominal, so omitting this measures inflated income
   * against frozen thresholds and invents bracket creep the statute does not
   * create. Unindexed figures (sections 86, 1411, 121, 1211(b), 151(d)(5)(C),
   * and the 164(b)(7) SALT schedule) ignore it by construction.
   */
  inflationScale?: number
}

/**
 * Pluggable tax computation. V1 ships a flat placeholder; the real federal
 * engine (roadmap V2) implements the same interface.
 */
export interface TaxCalculator {
  compute(input: TaxYearInput): number
}

export interface PersonYearState {
  personId: string
  /** Age attained during this calendar year (year − birth year). */
  ageAttained: number
  /** Alive while ageAttained ≤ longevity planning age. */
  alive: boolean
}

/**
 * Per-year linearization inputs the V8 optimizer needs from a baseline ledger
 * run (roadmap V8). Emitted via `SimulateOptions.captureOptimizerInputs`; a
 * no-op unless that sink is supplied, so the normal projection is unaffected.
 * The optimizer's MILP carries balances forward itself, so only these exogenous
 * quantities (not per-year balances) are probed. @see strategies/optimizer.ts
 */
/**
 * One account's committed retirement-action balance movement in a probe year.
 *
 * The exact-cent action executor debits and credits NAMED accounts, while the
 * optimizer collapses the portfolio into four bucket scalars. Reporting the
 * movement per account — rather than pre-bucketed — keeps the bucket taxonomy
 * in the one place that already owns it (`buildOptimizerInput`), so the two
 * cannot drift into disagreeing about which bucket an account belongs to.
 */
export interface OptimizerCommittedActionAccountMovement {
  accountId: string
  /**
   * Signed plan dollars, closing − opening: a withdrawal from this account is
   * NEGATIVE. Zero-movement accounts are omitted entirely.
   */
  amount: number
}

export interface OptimizerYearProbe {
  year: number
  /**
   * Balance movement the exact-cent retirement-action executor COMMITTED this
   * year, per account, sorted by account id; empty in a year with no committed
   * action movement (which is every year of an action-free plan).
   *
   * Without this the LP's balance recursion carries a portfolio the exact
   * ledger never holds: the executor debits the named source inside `simulate`
   * while the solver evolves opening buckets that never saw the debit. Worse
   * than fully blind — `capitalGainsBase` below already picks up the action's
   * realized gain, so the solve prices the action's tax and keeps its dollars.
   */
  committedActionAccountMovement: readonly OptimizerCommittedActionAccountMovement[]
  /**
   * Gross cash those committed actions delivered into this year's cash flow —
   * the ledger's own `retirementActionProceeds` term, which sits alongside RMDs
   * and property-sale proceeds in `baseCashInflows` and is NOT part of
   * `exogenousCash` below.
   *
   * The pair matters: an ordinary withdrawal REALLOCATES between buckets rather
   * than destroying net worth, so a debit booked without its matching cash
   * credit would make the solver poorer than the household actually is.
   */
  committedActionProceeds: number
  /**
   * Ordinary taxable income EXCLUDING any traditional-account distribution or
   * Roth conversion, plus the baseline taxable Social-Security portion (which
   * the LP holds fixed rather than re-deriving as conversions change).
   */
  ordinaryIncomeBase: number
  /** Total cash uses besides tax/penalties this year (expenses + contributions). */
  spendingNeed: number
  /** Non-account cash inflows this year (income streams: SS, pensions, etc.). */
  exogenousCash: number
  /** Forced RMD this year in the baseline (0 when not age-eligible). */
  rmd: number
  /** Taxable part of `rmd` after exact owned-IRA basis character. */
  rmdTaxable?: number
  /**
   * Gross incumbent owner-traditional distributions (forced plus
   * discretionary). Settlement uses this to distinguish an exact realized-flow
   * fraction from a no-flow marginal balance fraction.
   */
  incumbentTraditionalDistribution: number
  /**
   * Incumbent taxable share of gross owner-traditional withdrawals. The LP
   * applies this exact-ledger linearization to both forced and discretionary
   * dollars; absent preserves the historical all-taxable assumption.
   */
  traditionalWithdrawalTaxableFraction?: number
  /** Start-of-year owner-convertible traditional balance, used to recover the owner RMD divisor ratio. */
  startTraditional: number
  /** Forced inherited-traditional distribution this year in the baseline. */
  inheritedDistribution: number
  /** Start-of-year inherited traditional balance, used to recover the inherited distribution divisor ratio. */
  startInheritedTraditional: number
  /** Living people aged 65+ (drives the standard-deduction age addition). */
  peopleAged65Plus: number
  /**
   * Deposits landing in owner-traditional accounts this year: scheduled
   * employee contributions plus employer match into traditional. The cash cost
   * of employee contributions is already inside `spendingNeed`; this is the
   * asset side, so the optimizer's compressed balances receive the same money
   * the exact ledger does.
   */
  traditionalInflow: number
  /** Deposits landing in Roth/taxable/cash/equity-comp/HSA accounts this year (contributions + any Roth-employer match). */
  otherInflow: number
  /**
   * Subset of `otherInflow` that lands specifically in taxable brokerage /
   * equity-comp accounts this year. The optimizer (Step 2, taxable-gain
   * realization) splits the lumped "other" bucket into a taxable bucket — whose
   * withdrawals realize LTCG — and a tax-free bucket (Roth/cash/HSA); this is
   * the taxable side of the split. `otherInflow − taxableInflow` is the tax-free
   * side.
   */
  taxableInflow: number
  /**
   * Gross Social Security benefits received this year. Powers the optimizer's
   * in-solve taxable-SS PWL (Step 3): with it, the LP re-derives the 0/50/85%
   * provisional-income phase-in as conversions change instead of holding the
   * probe-time taxable portion fixed.
   */
  ssBenefits: number
  /**
   * The taxable-SS portion folded into `ordinaryIncomeBase` at the probe run
   * (the amount the in-solve PWL replaces with its own variable).
   */
  taxableSsBase: number
  /**
   * Fixed non-taxable amounts included in §86 provisional income: characterized
   * ACA tax-exempt interest plus foreign earned-income/housing exclusions.
   */
  ssProvisionalIncomeAddbacks: number
  /**
   * Realized capital gains + qualified dividends at the probe run, EXCLUDING
   * gains from taxable-account withdrawals (the optimizer re-decides those as
   * its own variable, so including them would double-count). Counts toward the
   * SS phase-in's provisional income and IRMAA MAGI but is not in
   * `ordinaryIncomeBase`.
   */
  capitalGainsBase: number
  /**
   * Remaining actionable ACA MAGI room at the exact-ledger probe. Null when
   * no supported current-year ACA ceiling exists.
   */
  acaConversionMagiHeadroom: number | null
  /**
   * Incumbent value of the optimizer's modeled MAGI expression before the
   * gain-weighted taxable-withdrawal term. `buildOptimizerInput` applies the
   * same aggregate opening-basis coefficient used by the LP, rather than the
   * exact ledger's account-order-dependent realized gain.
   */
  incumbentModeledMagiBeforeTaxableWithdrawalGains: number
  /** Incumbent taxable/equity-comp withdrawal dollars (`wtax` in the LP). */
  incumbentTaxableWithdrawal: number
  /** Allowable PTC actually preserved by the exact-ledger probe, if modeled. */
  acaModeledAllowablePtc: number | null
  /** Exact-ledger cliff position used to decide whether a preservation bound is meaningful. */
  acaCliffState: YearAcaResult['cliffState'] | null
  /** Conversion already executed in the probe schedule for absolute-bound reconstruction. */
  incumbentRothConversion: number
  /**
   * Incumbent taxable share of gross Roth conversions after exact line-8 basis
   * character; absent preserves the historical all-taxable assumption.
   */
  rothConversionTaxableFraction?: number
  /**
   * True when the ledger priced this premium year's IRMAA under an SSA-44
   * redetermination (the two years after a qualifying life-changing event, see
   * `healthcareConfigSchema.ssa44`). The optimizer's lookback treatment shifts
   * this year's IRMAA MAGI source from year (t−2) to year (t−1) — the in-solve
   * stand-in for the ledger's min(lookback, prior year).
   */
  ssa44IrmaaRedetermination: boolean
}

export interface YearIncomes {
  wages: number
  socialSecurity: number
  pension: number
  annuity: number
  /** TIPS-ladder cash flows (coupons + maturing principal); 0 when the plan has no ladders. */
  tipsLadder: number
  recurring: number
  oneTime: number
  taxableInterest: number
  ordinaryDividends: number
  qualifiedDividends: number
  taxableYield: number
  total: number
}

export interface YearExpenses {
  baseSpending: number
  oneTimeGoals: number
  /** Debt principal & interest (incl. any scheduled lump-sum payoff this year). */
  debtService: number
  /** Property tax + homeowner's insurance on owned properties (continues after mortgage payoff). */
  propertyCosts: number
  /** Pre-65 marketplace premiums net of ACA credit + Medicare (Part B incl. IRMAA, Part D surcharge, extras). */
  healthcare: number
  /** Level (fixed-nominal) insurance premiums charged this year (LTC + permanent life). */
  insurancePremiums: number
  /** Gross LTC care-episode cost this year (additive spending spike, before any policy offset). */
  careCost: number
  /** LTC policy benefit applied against careCost this year (income-tax-free; reduces net spending). */
  ltcBenefit: number
  /**
   * Must-fund spending this year: system-computed costs (healthcare, debt,
   * property, insurance, net LTC) + the required-floor lifestyle layer +
   * required-classified funded goals. A guardrail policy never cuts below this.
   */
  requiredSpending: number
  /**
   * Full intended spending with no guardrail cut: requiredSpending + the full
   * target lifestyle layer + target-classified goals. Equals `total` for older
   * fixed-target plans without ideal/excess layers.
   */
  targetSpending: number
  /** Incremental ideal spending intended this year above the target lifestyle. */
  idealSpending: number
  /** Incremental excess/opportunistic spending intended this year above ideal. */
  excessSpending: number
  /** Full intended spending with no guardrail cut across required/target/ideal/excess. */
  intendedSpending: number
  /** Discretionary multiplier the guardrail policy applied this year (1 = no cut). */
  guardrailFactor: number
  total: number
}

/** Withdrawal totals by account category (sequential order: cash → taxable → traditional → roth → hsa). */
export interface YearWithdrawals {
  cash: number
  taxable: number
  traditional: number
  roth: number
  hsa: number
  total: number
}

export type AcaSupportCode =
  | 'actionable'
  | 'missing-year-contract'
  | 'duplicate-year-contract'
  | 'tax-family-member-unknown'
  | 'tax-family-structure-unsupported'
  | 'covered-member-duplicate'
  | 'medicare-overlap-unsupported'
  | 'slcsp-benchmark-missing'
  | 'benchmark-only-coverage-unsupported'
  | 'example-contract-input-mismatch'
  | 'dependent-filing-status-unknown'
  | 'dependent-modeled-person-overlap'
  | 'tax-exempt-interest-unknown'
  | 'foreign-exclusion-addback-unknown'
  | 'coverage-eligibility-unsupported'
  | 'form-8814-unsupported'
  | 'special-allocation-unsupported'
  | 'mfs-exception-unsupported'
  | 'self-employed-deduction-unsupported'
  | 'other-material-facts-unsupported'
  | 'below-100-fpl-exception-unsupported'
  | 'tax-year-parameters-unsupported'
  | 'guardrail-interaction-unsupported'
  | 'hsa-cap-fixed-point-nonconvergent'
  | 'conflicting-cliff-fixed-points'
  | 'fixed-point-nonconvergent'

export interface YearAcaResult {
  readiness: 'actionable' | 'nonActionable'
  supportCodes: AcaSupportCode[]
  /** Final return-year ACA household MAGI; null when material facts are unsupported. */
  householdMagi: number | null
  magiComponents: {
    federalAgi: number
    nontaxableSocialSecurity: number
    taxExemptInterest: number
    foreignExclusionAddback: number
    requiredFilerDependentMagi: number
  }
  fplRegion: 'contiguous' | 'alaska' | 'hawaii' | null
  federalPovertyLine: number | null
  fplPct: number | null
  taxFamilySize: number | null
  taxFamilyMembers: Array<{
    personId: string
    relationship: 'primary' | 'spouse' | 'dependent'
    requiredToFile: 'required' | 'notRequired' | 'unknown'
    magi: number
    includedMagi: number
  }>
  coveredMembers: Array<{
    personId: string
    coveredMonths: number[]
    grossEnrollmentPremium: number
    applicableSlcspPremium: number
  }>
  grossEnrollmentPremium: number
  applicableSlcspPremium: number | null
  /** Current-year planning result; not actual APTC cash/refund/balance-due reconciliation. */
  modeledAllowablePtc: number | null
  economicNetPremium: number
  aptcModeled: false
  form8962ReconciliationSupported: false
  cliffState: 'below-eligibility-floor' | 'below-cliff' | 'at-cliff' | 'above-cliff' | 'unsupported'
  convergence: {
    converged: boolean
    iterations: number
    maxIterations: number
    residualDollars: number
    grossPremiumFallback: boolean
  }
}

/**
 * The share of the published annual QCD total that moved no additional dollars
 * because an RMD debit already carried it out of the owned IRA. A gift taken
 * with no RMD behind it is not in here: it physically leaves an account and is
 * published as a `legacyQcd` runtime occurrence with its own application.
 */
export interface SimulatorAnnualRetirementNonmovingLegacyQcdOverlay {
  readonly status: 'nonmovingLegacyQcdCaptured'
  readonly kind: 'legacyQcd'
  readonly taxYear: number
  readonly grossAmountPlanDollars: number
  readonly ownerPersonId: null
  readonly sourceAccountId: null
  readonly physicalMovement: 'notAdditionalMovement'
  readonly inventoryReplay: 'requiresSeparateQcdCharacterizationStage'
}

export interface SimulatorAnnualRetirementRuntimeSource {
  readonly status: 'runtimeOccurrenceSourcesCaptured'
  readonly captureBoundary:
    'legacyAnnualPassCommittedBeforeYearResultPublication'
  readonly journalValidation: 'notRun'
  readonly planId: string
  readonly taxYear: number
  readonly runtimeOccurrences:
    readonly Readonly<SimulatorAnnualRetirementRuntimeOccurrence>[]
  readonly nonmovingLegacyQcdOverlay:
    Readonly<SimulatorAnnualRetirementNonmovingLegacyQcdOverlay> | null
}

export type SimulatorRetirementRuntimeApplicationPhase =
  | 'annuityPurchaseFunding'
  | 'pensionLumpSumRollover'
  | 'employeeContribution'
  | 'ownerRmdDistribution'
  | 'automaticSeppDistribution'
  | 'legacyQcdDistribution'
  | 'namedQcdDistribution'
  | 'namedRothConversionDebit'
  | 'namedRothConversionDestinationCredit'
  | 'legacyRothConversion'
  | 'legacyRothConversionAggregateDestinationCredit'
  | 'legacyNeedBasedWithdrawal'

interface SimulatorRetirementRuntimeApplicationBase {
  /** Exact key of the raw runtime occurrence that this mutation applied. */
  readonly producerOccurrenceKey: string
  /** Truthful simulator pass; not a civil date or authoritative schedule. */
  readonly simulatorPhase: SimulatorRetirementRuntimeApplicationPhase
  /** One-based order of captured retirement applications in this annual pass. */
  readonly mutationOrdinal: number
  /** Raw Plan identity is preserved; later replay rejects missing/invalid facts. */
  readonly ownerPersonId: string | null
  readonly sourceAccountId: string | null
  readonly sourceBalanceBeforePlanDollars: number
  readonly sourceBalanceAfterPlanDollars: number
}

export interface SimulatorRetirementRuntimeDebitApplication
  extends SimulatorRetirementRuntimeApplicationBase {
  readonly applicationKind: 'debit'
  readonly appliedAmountPlanDollars: number
}

export interface SimulatorRetirementRuntimeCreditApplication
  extends SimulatorRetirementRuntimeApplicationBase {
  readonly applicationKind: 'credit'
  readonly creditedAmountPlanDollars: number
}

export interface SimulatorRetirementRuntimeAggregateRothDestinationCredit {
  readonly applicationKind: 'aggregateRothDestinationCredit'
  readonly simulatorPhase: 'legacyRothConversionAggregateDestinationCredit'
  readonly mutationOrdinal: number
  readonly producerOccurrenceKey: null
  readonly ownerPersonId: null
  readonly sourceAccountId: null
  readonly sourceBalanceBeforePlanDollars: null
  readonly sourceBalanceAfterPlanDollars: null
  /** Exact runtime occurrence keys whose debits produced this one legacy credit. */
  readonly producerOccurrenceKeys: readonly string[]
  readonly sourceOwnerPersonIds: readonly (string | null)[]
  readonly destinationRothAccountId: string | null
  readonly destinationOwnerPersonId: string | null
  readonly destinationBalanceBeforePlanDollars: number
  readonly destinationCreditedAmountPlanDollars: number
  readonly destinationBalanceAfterPlanDollars: number
}

/**
 * One named conversion's own destination credit.
 *
 * This is deliberately not the aggregate shape above. That one exists because
 * the legacy strategy has a single household destination and picks it by Plan
 * array position; a named request states its destination, so this credit
 * carries the `actionId` that chose it and is validated against that request's
 * `destinationRothAccountId` alone. Two requests in the same year therefore
 * produce two credits to two different Roth accounts, which the aggregate
 * shape cannot express.
 */
export interface SimulatorRetirementRuntimeNamedRothDestinationCredit {
  readonly applicationKind: 'namedRothDestinationCredit'
  readonly simulatorPhase: 'namedRothConversionDestinationCredit'
  readonly mutationOrdinal: number
  readonly producerOccurrenceKey: null
  readonly ownerPersonId: null
  readonly sourceAccountId: null
  readonly sourceBalanceBeforePlanDollars: null
  readonly sourceBalanceAfterPlanDollars: null
  /** The named request whose committed movement produced this credit. */
  readonly actionId: string
  /** Exact runtime occurrence keys whose debits produced this one credit. */
  readonly producerOccurrenceKeys: readonly string[]
  readonly sourceOwnerPersonIds: readonly (string | null)[]
  readonly destinationRothAccountId: string | null
  readonly destinationOwnerPersonId: string | null
  readonly destinationBalanceBeforePlanDollars: number
  readonly destinationCreditedAmountPlanDollars: number
  readonly destinationBalanceAfterPlanDollars: number
}

export type SimulatorRetirementRuntimeApplication =
  | Readonly<SimulatorRetirementRuntimeDebitApplication>
  | Readonly<SimulatorRetirementRuntimeCreditApplication>
  | Readonly<SimulatorRetirementRuntimeNamedRothDestinationCredit>
  | Readonly<SimulatorRetirementRuntimeAggregateRothDestinationCredit>

/**
 * Cheap simulator-owned balance transitions captured at the actual owned,
 * non-inherited traditional-IRA mutation sites, plus the one unchanged legacy
 * aggregate Roth destination credit when those sources fund a conversion. A
 * later internal replay owns exact-cent conversion, occurrence/inventory
 * rejoining, validation, identity, and sealing.
 */
export interface SimulatorAnnualRetirementRuntimeApplicationSource {
  readonly status: 'runtimeApplicationSourcesCaptured'
  readonly captureBoundary:
    'atOwnedNonRothIraMutationSitesBeforeAnnualGrowth'
  readonly applicationValidation: 'notRun'
  readonly planId: string
  readonly taxYear: number
  readonly applications:
    readonly Readonly<SimulatorRetirementRuntimeApplication>[]
}

export interface SimulatorOwnedNonRothIraPostGrowthAccountBalanceSource {
  readonly sourceAccountId: string
  readonly balancePlanDollars: number
}

export interface SimulatorOwnedNonRothIraPostGrowthOwnerPoolSource {
  /** Null is preserved only for an unvalidated malformed Plan; replay must reject it. */
  readonly ownerPersonId: string | null
  readonly accountBalances:
    readonly Readonly<SimulatorOwnedNonRothIraPostGrowthAccountBalanceSource>[]
}

/**
 * Cheap simulator-owned source facts captured from the live balance ledger
 * after every annual mutation and growth pass. A later internal replay owns
 * exact-cent conversion, pool validation, structural identity, and sealing.
 */
export interface SimulatorAnnualOwnedNonRothIraPostGrowthSource {
  readonly status: 'postGrowthOwnedNonRothIraBalancesCaptured'
  readonly captureBoundary:
    'afterAllAnnualTransactionsAndGrowthBeforeYearResultPublication'
  readonly annualObservationValidation: 'notRun'
  readonly planId: string
  readonly taxYear: number
  readonly ownerPools:
    readonly Readonly<SimulatorOwnedNonRothIraPostGrowthOwnerPoolSource>[]
}

export interface SimulatorOwnedNonRothIraAggregateRothDestinationReplay {
  readonly status: 'aggregateDestinationCreditSourceReconciled'
  readonly destinationAttribution: 'aggregateOnlyNotSourceAllocated'
  readonly actionability: 'notEstablished'
  readonly destinationRothAccountId: AccountId
  readonly destinationOwnerPersonId: PersonId
  readonly destinationCreditedAmount: UsdCents
  readonly producerOccurrenceKeys: readonly string[]
  readonly sourceOwnerPersonIds: readonly PersonId[]
  readonly evidenceId: string
}

export interface SimulatorOwnedNonRothIraAnnualOwnerReplay {
  readonly ownerPersonId: PersonId
  readonly taxYear: number
  readonly openingBasisSource: 'planSeed' | 'priorYearCarryforward'
  readonly openingBasisAmount: UsdCents
  readonly taxYearNondeductibleContributionAmount: 0
  readonly postYearNondeductibleContributionExcludedAmount: 0
  readonly outstandingRolloverAmount: 0
  readonly rolloverRepaymentAdjustmentAmount: 0
  readonly annualObservation:
    Readonly<CompleteSimulatorOwnedNonRothIraAnnualObservation>
  readonly annualBasisRatio: Readonly<AnnualIraBasisRatio>
  readonly line7AllocationEvidence: Readonly<AnnualIraBasisAllocationEvidence>
  readonly line8AllocationEvidence: Readonly<AnnualIraBasisAllocationEvidence>
  readonly nextYearOpeningBasisAmount: UsdCents
  readonly sourceChainEvidenceId: string
  readonly replayEvidenceId: string
}

export interface SimulatorOwnedNonRothIraAnnualReplay {
  readonly taxYear: number
  readonly ownerReplays:
    readonly Readonly<SimulatorOwnedNonRothIraAnnualOwnerReplay>[]
  /**
   * One credit per converting owner, not one per year. IRC 408(d)(3)(A)(i)
   * admits a conversion only between accounts held by the same individual, so
   * the aggregate strategy's household target is sliced by owner and each
   * slice lands in that owner's own Roth. The array is empty in a year with no
   * owned-IRA conversion.
   */
  readonly aggregateRothDestinationCredits:
    readonly Readonly<SimulatorOwnedNonRothIraAggregateRothDestinationReplay>[]
  readonly evidenceId: string
}

/**
 * Exact basis-character evidence published only after the private bounded
 * annual-pass controller commits an observed-versus-assumed exact match.
 * Commit here settles a simulator attempt; it does not establish legal
 * movement, filing completeness, or implementation actionability.
 */
export interface SimulatorCommittedOwnedNonRothIraAnnualReplay {
  readonly status: 'committedOwnedNonRothIraAnnualReplay'
  readonly settlement: 'exactReplayEffectsMatched'
  readonly evidenceScope: 'projectionModelOnlyNotRealWorldFilingCompleteness'
  readonly movement: 'notCommitted'
  readonly actionability: 'notEstablished'
  readonly filingCompleteness: 'notEstablished'
  readonly planId: PlanId
  readonly projectionStartTaxYear: number
  readonly taxYear: number
  readonly sourceSeriesEvidenceId: string
  readonly contiguousReplayEvidenceId: string
  readonly annualReplay: Readonly<SimulatorOwnedNonRothIraAnnualReplay>
}

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
  /** Employer match contributions made this year. */
  employerMatch: number
  /** Forced traditional-account distributions (included in withdrawals.traditional). */
  rmd: number
  /** Penalty-free 72(t) SEPP distributions this year (included in withdrawals.traditional). */
  sepp: number
  /** Forced inherited-IRA distributions this year under the 10-year rule (included in withdrawals.traditional). */
  inheritedDistribution: number
  /** Qualified charitable distributions routed out of the RMD (excluded from income). */
  qcd: number
  /** Dollars moved traditional → Roth this year (taxed as ordinary income, no penalty). */
  rothConversion: number
  /**
   * The live balances the shared aggregate-conversion allocation policy
   * weighted this year's owners by, per account ID, in Plan order.
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
   *   `> 0.01` test and the policy was never called;
   * - the `YearResult` was constructed by an external consumer rather than by
   *   `simulatePlan`, which is what the optionality is for.
   *
   * Presence says the policy was asked, and nothing more. It does not say the
   * household converted: the policy may have refused it for want of any Roth
   * IRA, or trimmed an owner who has none, and the year then publishes this
   * snapshot beside a `rothConversion` of zero.
   */
  aggregateRothConversionAllocationBalances?: Readonly<Record<string, number>>
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
  /** Early-withdrawal penalties (10% traditional pre-59½, 20% HSA non-medical pre-65); not in `tax`. */
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
