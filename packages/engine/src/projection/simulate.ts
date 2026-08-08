/**
 * Deterministic annual-ledger simulation (roadmap V1).
 *
 * Year ordering: ages → income → expenses (incl. debt service) → capped
 * contributions → fixed-point tax/withdrawal iteration → apply flows →
 * property events → growth → snapshot. All amounts are nominal dollars;
 * today's-dollar display is a render-time transform.
 *
 * V1 simplifications (each lifts in a later roadmap phase):
 * - Wages, contributions, base spending, and goals inflate at the general rate;
 *   wages are paid while the person's attained age is BELOW their retirement
 *   age and stop from the first year it is not. A whole retirement age of 65 is
 *   therefore last paid at attained 64; a fractional 65.5 is last paid at
 *   attained 65 and first unpaid at attained 66.
 * - SS COLA compounds from the projection start, and first-year benefits are
 *   prorated by claim months only (no birthday-month precision). PIA comes
 *   from the stream directly or from its earnings history (AIME → bend
 *   points). The earnings test withholds own, spousal, and survivor benefits
 *   annually ($1/$2 below FRA, $1/$3 in the FRA year) and credits the withheld
 *   months back at FRA (ARF, annual approximation). Spousal benefits apply the
 *   retirement/survivor family maximum; survivors step up to the deceased's
 *   benefit with the early-claim widow(er) reduction and RIB-LIM widow's-limit cap.
 * - RMDs are forced from traditional accounts at SECURE 2.0 start ages
 *   (Uniform Lifetime Table; no April-1 first-year deferral). QCDs route
 *   charitable dollars out of the RMD (age 70½ ≈ age attained 71).
 *   Early-withdrawal penalties: 10% traditional pre-59½ (≈ age < 60), 20%
 *   HSA non-medical pre-65. Healthcare expenses: ACA-credited marketplace
 *   premiums pre-65 (credit vs prior-year MAGI; 400% FPL cliff), Medicare
 *   Part B + IRMAA (MAGI 2-year lookback) + Part D surcharge + extras from
 *   65. Roth conversions run after RMDs (manual amounts or fill-to-target
 *   sized against the federal engine; conversion taxes ride the normal
 *   withdrawal flow, so they come from cash/taxable first and are never
 *   penalized). Annuities end at owner death; pensions pay survivorPct to a
 *   surviving spouse once payments have started.
 * - Contribution limits beyond the latest parameter pack are indexed forward
 *   at the assumed inflation rate (statutory limits are inflation-indexed).
 */

import type { Account, AssetAllocationPolicy, Person, Plan } from '../model/plan.js'
import type { TraditionalAccount } from '../strategies/accountEligibility.js'
import {
  ASSET_CLASS_IDS,
  latestNonQlacQualifiedAnnuityStartAge,
  latestQlacAnnuityStartAge,
  stateForYear,
  stateResidencySegmentsForYear,
} from '../model/plan.js'
import {
  accountAllocation,
  blendedTaxableYield,
  driftWeights,
  rebalanceTurnoverFraction,
  resolveAssetClassParams,
  targetWeightsAt,
} from '../allocation/assetClasses.js'
import { packForYear, LATEST_PACK_YEAR, hecmPrincipalLimitFactorPct, EMBEDDED_REAL_YIELD_CURVE } from '../params/index.js'
import { annuityExclusionMultiple, annuityPayoutForm, annuityPayoutFraction } from './annuityForms.js'
import { buildLadder, ladderRealFlowsAtOffset, ladderRemainingFace, type LadderRung } from '../ladder/ladderMath.js'
import { stateParamsFor } from '../params/state/index.js'
import type { ParameterPack } from '../params/types.js'
import { requiredMinimumDistribution } from '../rmd/rmd.js'
import { claimFactor, spousalBenefitFactor, type ClaimAge } from '../socialSecurity/claimFactor.js'
import { bestMaritalBenefit } from '../socialSecurity/maritalBenefits.js'
import { capAuxiliaryForFamilyMaximum, claimAgeTotalMonths } from '../socialSecurity/familyMaximum.js'
import { sizeRothConversion } from '../strategies/rothConversion.js'
import { splitRothWithdrawal, type RothBasisState } from '../strategies/rothBasis.js'
import { seppActive, seppAnnualAmount } from '../strategies/sepp.js'
import {
  classifyInheritedRegime,
  inheritedForcedAmount,
  inheritedRequirementForYear,
  type InheritedRegimeClassification,
  type InheritedRegimeResult,
} from '../strategies/inheritedIra.js'
import {
  acceptsContributions,
  hsaNonQualifiedPenaltyRate,
  isAggregatedIra,
  isConvertibleToRoth,
  isSpendableInYear,
  isTreatAsOwnEffective,
  traditionalWithdrawalPenaltyRate,
  type NonpersistedActionPersonAliveEvidence,
  type NonpersistedOwnerAggregatedIraBasisEvidence,
  type NonpersistedOwnerIraRmdSatisfactionEvidence,
} from '../strategies/accountEligibility.js'
import { openIraProRataYear, splitIraDistribution, type IraProRataYear } from '../strategies/iraBasis.js'
import { propertySaleTax } from '../tax/propertySale.js'
import {
  aggregateBasisSale,
  type AggregateBasisSaleResult,
} from '../tax/aggregateBasisSale.js'
import {
  asAccountId,
  asPersonId,
  asUsdCents,
  assessConversionLinkedWithdrawalGroups,
  assessOrdinaryWithdrawalPlanBoundary,
  authorizeConversionLinkedWithdrawalGroups,
  evaluateAnnualQcdExecutionPrerequisites,
  evaluateRetirementActionSchedule,
  executeAnnualQcds,
  executeConversionLinkedWithdrawalGroups,
  executeOrdinaryWithdrawals,
  executeRothConversions,
  ledgerCentsToPlanDollars,
  ordinaryWithdrawalPublicationEligibility,
  ordinaryWithdrawalPublicationSource,
  planDollarsMoveNoLedgerCent,
  planDollarsToFlooredLedgerCents,
  planDollarsToLedgerCents,
  publishAnnualRetirementActions,
  rothConversionPublicationEligibility,
  rothConversionPublicationSource,
  signedLedgerCentTotalToPlanDollars,
  stageAnnualQcdPhysicalExecution,
  type ActionId,
  type AnnualQcdRmdPoolOpeningSnapshot,
  type ClassifyOwnedNonRothIraAnnualWithdrawalsInput,
  type ConversionLinkedWithdrawalGroupAuthorization,
  type ConversionLinkedWithdrawalGroupLiabilityRun,
  type ConversionLinkedWithdrawalGroupMemberInput,
  type ConversionLinkedWithdrawalGroupMovementInput,
  type ExecuteAnnualQcdsResult,
  type ExecuteConversionLinkedWithdrawalGroupsResult,
  type ExecuteOrdinaryWithdrawalsResult,
  type ExecuteRothConversionsResult,
  type PersonId,
  type QualifiedCharitableDistributionRequest,
  type RetirementActionRequest,
  type TaxableAccountOpeningSnapshot,
} from '../actions/index.js'
import {
  allocateAggregateRothConversionByOwner,
  participatesInAggregateRothConversionAllocation,
} from '../actions/aggregateRothConversionOwnerAllocation.js'
import { addCalendarMonths } from '../actions/civilDate.js'
import type { NonpersistedPriorQcdOffsetEvidence } from '../strategies/accountEligibility.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from '../actions/structuralId.js'
import { seppSeriesBeginsAfterSeparation } from '../actions/traditionalEmployerPlanPenaltyPrerequisite.js'
import { type SimulatorAnnualRetirementRuntimeOccurrence } from './annualRetirementRuntimeJournal.js'
import type { SimulatorAnnualPassStateBindings } from './annualPassTransaction.js'
import {
  captureOwnedNonRothIraAnnualAttemptStateEvidence,
  ownedNonRothIraAnnualSettlementRollbackDisqualification,
  runOwnedNonRothIraAnnualSettlementAttempts,
  type OwnedNonRothIraAnnualSettlementEffect,
} from '../internal/ownedNonRothIraAnnualAttemptSettlement.js'
import {
  committedOwnedNonRothIraAnnualReplayPublication,
} from
  '../internal/ownedNonRothIraAnnualReplayPublication.js'
import {
  openingAnnuityContractValuePlanDollars,
  ownedIraFundedAnnuityContracts,
} from '../internal/iraAnnuityContractValue.js'
import {
  COUNTERFACTUAL_OMISSION_TAX_INPUT_ID,
  exactAnnualLiabilityFromPlanDollars,
  probeAnnualPassUnderTransaction,
  runCounterfactualAnnualLiability,
  type CounterfactualAnnualLiabilityResult,
} from '../internal/counterfactualAnnualLiability.js'
import {
  mintAnnualLiabilityRunIdentity,
  type AnnualLiabilityRunTaxInput,
} from '../actions/annualLiabilityRunIdentity.js'
import type {
  ConversionTaxFundingTaxUnitEvidence,
} from '../actions/conversionTaxFundingEvidence.js'
import { deriveOwnedNonRothIraReplayAllocationIdentity } from
  '../internal/ownedNonRothIraReplayIdentity.js'
import { effectiveBirthYear, fraForBirthYear, fraTotalMonths, survivorFraForBirthYear } from '../socialSecurity/nra.js'
import {
  computePiaFromEarnings,
  isPiaFromEarningsError,
  piaInputFromEarnings,
  resolveEarningsProjection,
} from '../socialSecurity/piaFromEarnings.js'
import { survivorBenefitMonthly } from '../socialSecurity/survivorBenefit.js'
import { inSsdiWindow, ssdiMonthlyBenefit, ssdiSuspendedBySga } from '../socialSecurity/disability.js'
import { attributeShortfall, splitAnnualSpendingLayers } from '../spending/layers.js'
import { ABW_DEFAULTS, abwAnnualPayment, abwExpectedRealReturnPct } from '../spending/abw.js'
import { jointSurvivalPercentileAge, survivalPercentileAge } from '../montecarlo/survival.js'
import {
  nextBalanceGuardrailMultiplier,
  nextGuardrailMultiplier,
  type GuardrailAction,
  type GuardrailPolicy,
} from '../spending/guardrails.js'
import { createGoalScheduler, toSchedulableGoal, type GoalScheduler } from '../spending/flexibleGoals.js'
import {
  acaEconomicPremiumByMonth,
  acaFederalPovertyLine,
  buildAcaHouseholdMagi,
  type AcaHouseholdMagiResult,
  type AcaResult,
} from '../tax/aca.js'
import { applyCapitalLossCarryforward, computeFederalTax, taxableSocialSecurity } from '../tax/federalTax.js'
import { medicareAnnualPremiumPerPerson } from '../tax/medicare.js'
import {
  taxParameterFilingStatus,
  type MarketSeries,
  type OptimizerYearProbe,
  type PersonYearState,
  type ProjectedFilingStatus,
  type ProjectionResult,
  type SimulatorRetirementRuntimeApplication,
  type TaxCalculator,
  type YearExpenses,
  type YearAcaResult,
  type AcaSupportCode,
  type YearIncomes,
  type YearResult,
  type YearWithdrawals,
  type InheritedAccountYearEvidence,
} from './types.js'

export interface SimulateOptions {
  startYear: number
  taxCalculator: TaxCalculator
  /**
   * Per-year stochastic returns/inflation (Monte Carlo, roadmap V4). Omitted =
   * deterministic run using the plan's assumptions every year.
   */
  market?: MarketSeries
  /**
   * Per-person age at death (last full year alive), overriding longevity.planningAge.
   * Used by stochastic-longevity Monte Carlo (roadmap V6); omitted = use planningAge.
   */
  deathAgeByPersonId?: Record<string, number>
  /**
   * Force the projection's end year, independent of lifespans, so every Monte
   * Carlo path shares a year grid even when sampled death ages differ.
   */
  horizonEndYear?: number
  /**
   * Optional sink for the V8 optimizer's per-year linearization inputs. A no-op
   * when omitted, so a normal projection is unaffected. @see OptimizerYearProbe
   */
  captureOptimizerInputs?: (probe: OptimizerYearProbe) => void
  /**
   * Opt-in seam for the counterfactual (`T0`) annual pass. A no-op when
   * omitted, which is every product call.
   *
   * The capability it drives — running one year's annual pass again over a
   * modified request set, reading the liability, and rolling the run back — has
   * no consumer yet; the group-executor slice is the consumer, and it will call
   * it from inside the bounded attempt driver's per-attempt scope rather than
   * through this option. It is reachable here because the capability's
   * invariants are claims about the *real* pass over a real multi-year
   * projection: that an empty omission set leaves the committed year byte for
   * byte unchanged, that the rollback restores the whole checkpoint, and that a
   * named omission actually removes that request's movement and income. None of
   * those can be proved against a stand-in pass.
   *
   * @see internal/counterfactualAnnualLiability.ts
   */
  annualCounterfactual?: Readonly<SimulateAnnualCounterfactualRequest>
}

/**
 * One year-by-year request for a counterfactual annual pass, plus the sink its
 * readings go to.
 *
 * `taxUnitId` and `nonGroupTaxInputs` are supplied rather than derived because
 * the filing unit's identity and its non-group tax inputs are what bind a
 * baseline run to the candidate it will be subtracted from, and nothing in the
 * engine produces either yet — the tax-unit snapshot the ordinary executor
 * receives is built inside the pass, below the point a pre-pass has to run.
 * Deriving them is the consumer slice's work.
 */
/**
 * What one run of the annual pass may do with the year's linked funding groups.
 *
 * Module-scope rather than inline so that `REFUSE_LINKED_GROUPS` below can be
 * the shared default: a run that says nothing about its groups refuses them,
 * and there is one object every such run points at rather than a fresh literal
 * per call site that could drift.
 */
type LinkedGroupRelease =
  | Readonly<{ kind: 'refuseAll' }>
  | Readonly<{ kind: 'stageProvisionally' }>
  | Readonly<{
      kind: 'proven'
      authorizations:
        readonly Readonly<ConversionLinkedWithdrawalGroupAuthorization>[]
    }>

/** The permission every run has until a staging run earns it one. */
const REFUSE_LINKED_GROUPS: Readonly<LinkedGroupRelease> = Object.freeze({
  kind: 'refuseAll' as const,
})

export interface SimulateAnnualCounterfactualRequest {
  /** Retirement-action IDs every year's counterfactual run omits. */
  readonly omitActionIds: readonly ActionId[]
  readonly taxUnitId: string
  readonly nonGroupTaxInputs: readonly Readonly<AnnualLiabilityRunTaxInput>[]
  /** Receives one result per projected year, in year order. */
  readonly capture: (
    result: Readonly<CounterfactualAnnualLiabilityResult>,
  ) => void
}

/**
 * The counterfactual option's own vocabulary, republished from the module that
 * owns it.
 *
 * A published option that hands a caller a value it cannot name is only half a
 * surface. `SimulateOptions` reaches consumers through the package root and
 * through `@retiregolden/engine/projection/simulate`, while the definitions
 * below sit in `internal/` and in two `actions/` modules that are deliberately
 * not package subpaths — so without this a consumer could receive a reading and
 * still have no way to declare a variable for it, short of a deep import the
 * exports map refuses. Re-exporting is the answer rather than opening those
 * subpaths: what the option promises is nameable, and nothing else about the
 * modules behind it becomes reachable. The counterfactual driver itself, the
 * liability-run identity minter, and the conversion tax-funding evidence
 * builder all stay where they are, unreachable, until the slice that writes
 * their first consumer publishes them.
 *
 * Types only, and deliberately: a re-exported constructor would be a capability
 * escaping ahead of its consumer.
 */
export type {
  CounterfactualAnnualLiabilityComponents,
  CounterfactualAnnualLiabilityRead,
  CounterfactualAnnualLiabilityRefusalKind,
  CounterfactualAnnualLiabilityRefused,
  CounterfactualAnnualLiabilityResult,
} from '../internal/counterfactualAnnualLiability.js'
export type {
  AnnualLiabilityRunBinding,
  AnnualLiabilityRunIdentity,
  AnnualLiabilityRunTaxInput,
  AnnualLiabilityRunTaxInputValue,
} from '../actions/annualLiabilityRunIdentity.js'
export type { ConversionTaxFundingExactCentAmount } from
  '../actions/conversionTaxFundingEvidence.js'

/**
 * The omission an ordinary annual pass makes: none.
 *
 * Module-level and shared so an ordinary pass allocates no set, and frozen at
 * the type level so no pass can quietly add to the omission of the next one.
 */
const NO_OMITTED_RETIREMENT_ACTION_IDS: ReadonlySet<ActionId> = new Set<ActionId>()

function annualPassValueBinding<T>(
  read: () => T,
  write: (value: T) => void,
): { read(): T; write(value: T): void } {
  return { read, write }
}

const EPSILON = 0.005

/**
 * Statutory rounding step for the cost-of-living adjustments under IRC 415(d),
 * which IRC 414(v)(2)(C)(i) borrows for the catch-up amounts.
 */
const COLA_ROUNDING_STEP = 500

/**
 * Slack in step counts, absorbing the floating-point error in a cumulative
 * growth factor so an increase of exactly one step is not floored to zero.
 * Far below the precision any real cost-of-living figure carries.
 */
const STEP_BOUNDARY_TOLERANCE = 1e-9

/**
 * Apply a cost-of-living factor the way IRC 414(v)(2)(C)(i) does: the *increase*
 * is rounded down to the next lower multiple of 500, not the adjusted amount.
 *
 * This is why the ages 60-63 amount held at 11,250 for 2026 even though it is
 * indexed -- the published 1.0288 factor produced a 324 dollar increase, which
 * floors to zero. Reading that non-movement as evidence of a pinned amount is
 * the mistake this replaces. That figure is the statutory adjustment off the
 * July 2024 base period, quoted to show the arithmetic; the `growth` argument
 * here is the engine's own pack-year-to-projected-year factor, which is the
 * same shape of quantity measured from a different origin.
 *
 * `growth` is the CUMULATIVE factor from the pack year to the projected year,
 * and rounding once at the end is the point rather than an approximation. The
 * adjustment is measured from a fixed origin rather than year over year. 26 CFR
 * 1.414(v)-1(c)(2)(iii)(B) sets the ages 60-63 limit as "the initial amount
 * ($11,250) ... increased for changes in the cost of living" off the calendar
 * quarter beginning July 1 2024. The engine does not model that base period --
 * `growth` is `limitGrowth`, measured from the pack year -- but it reproduces
 * the structural property that matters here: one rounding applied to a
 * cumulative increase, never compounded off a previously rounded figure.
 * Cost-of-living below
 * a 500 step therefore accumulates and eventually carries the amount up a full
 * step. That is the shape of the published 415(d)-indexed tables, where a limit
 * holds for a year or two and then moves a full 500 at once. Note the engine
 * does not reproduce that shape for the limits it projects smoothly through
 * `limitGrowth`; this helper is the only place the statutory step is modelled.
 * Rounding per year and compounding would discard the sub-step remainder every
 * year and understate the limit forever.
 */
function indexWithStatutoryRounding(base: number, growth: number): number {
  // `base * (growth - 1)` rather than `base * growth - base`: the latter
  // subtracts two nearby large numbers and loses precision in the difference,
  // which is the quantity being stepped.
  const increase = base * (growth - 1)
  if (increase <= 0) return base
  // An increase that is exactly one step can land a few ulps low, which would
  // floor to the step below and hold the limit flat for a whole year.
  const steps = Math.floor(increase / COLA_ROUNDING_STEP + STEP_BOUNDARY_TOLERANCE)
  return base + steps * COLA_ROUNDING_STEP
}

/**
 * Bucket that a jointly-filing couple's IRA compensation ceiling lives in.
 *
 * A person id is validated only as a non-empty string, so no literal value can
 * be made collision-proof by choice alone. Safety comes from the two branches
 * being mutually exclusive: in a shared year the map is keyed by this constant
 * and nothing else, and in an unshared year it is keyed by person ids and this
 * constant is never read. The namespaced spelling is a signpost for that
 * invariant, not the thing that enforces it.
 */
const IRA_HOUSEHOLD_COMPENSATION_KEY = 'ira:household-compensation'

type SimulatorRetirementRuntimeApplicationWithoutOrdinal =
  SimulatorRetirementRuntimeApplication extends infer Application
    ? Application extends SimulatorRetirementRuntimeApplication
      ? Omit<Application, 'mutationOrdinal'>
      : never
    : never

function compareNullableUtf16(
  left: string | null,
  right: string | null,
): number {
  if (left === right) return 0
  if (left === null) return -1
  if (right === null) return 1
  return compareUtf16CodeUnits(left, right)
}

function compareNullableNumber(
  left: number | null,
  right: number | null,
): number {
  if (left === right) return 0
  if (left === null) return -1
  if (right === null) return 1
  return left - right
}

function canonicalRuntimeOccurrenceOrder(
  left: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
  right: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
): number {
  return compareUtf16CodeUnits(
    left.producerOccurrenceKey,
    right.producerOccurrenceKey,
  ) || compareUtf16CodeUnits(left.kind, right.kind)
    || left.grossAmountPlanDollars - right.grossAmountPlanDollars
    || compareNullableUtf16(left.ownerPersonId, right.ownerPersonId)
    || compareNullableUtf16(left.sourceAccountId, right.sourceAccountId)
    || compareNullableUtf16(left.executionDate, right.executionDate)
    || compareNullableNumber(left.executionSequence, right.executionSequence)
    || compareNullableUtf16(left.movementAuthorityId, right.movementAuthorityId)
}
const MAX_TAX_ITERATIONS = 8
const MAX_ACA_FIXED_POINT_EVALUATIONS = 160

interface BalanceState {
  account: Extract<Account, { type: 'cash' | 'taxable' | 'equityComp' | 'traditional' | 'roth' | 'hsa' }>
  balance: number
  costBasis: number // meaningful for taxable only
}

interface WithdrawalPlanResult {
  byCategory: YearWithdrawals
  byAccountId: Map<string, number>
  realizedGains: number
  taxableSales: ReadonlyMap<string, Readonly<AggregateBasisSaleResult>>
  shortfall: number
  /** Dollars taken out of the taxable safety-net reserve as a last resort. */
  reserveUsed: number
}

function dobParts(person: Person): { y: number; m: number; d: number } {
  return {
    y: Number(person.dob.slice(0, 4)),
    m: Number(person.dob.slice(5, 7)),
    d: Number(person.dob.slice(8, 10)),
  }
}

function claimAgeFromTotalMonths(totalMonths: number): ClaimAge {
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 }
}

/** Annual-ledger approximation: a same-year claim pays only months after the claim month. */
function payableMonthsAtAge(ageAttained: number, claimAge: ClaimAge): number {
  if (ageAttained < claimAge.years) return 0
  if (ageAttained > claimAge.years) return 12
  return Math.max(0, 12 - claimAge.months)
}

/**
 * Linear interpolation of an illustration cash-value table by age. Clamps to the
 * endpoints outside the table's range (front-loaded-poor / back-loaded-rich whole-
 * life cash value is exactly why a schedule beats a flat rate).
 */
function interpolateByAge(schedule: { age: number; value: number }[], age: number): number {
  if (schedule.length === 0) return 0
  const sorted = [...schedule].sort((a, b) => a.age - b.age)
  if (age <= sorted[0]!.age) return sorted[0]!.value
  if (age >= sorted[sorted.length - 1]!.age) return sorted[sorted.length - 1]!.value
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i]!
    const hi = sorted[i + 1]!
    if (age >= lo.age && age <= hi.age) {
      const t = (age - lo.age) / (hi.age - lo.age)
      return lo.value + t * (hi.value - lo.value)
    }
  }
  return sorted[sorted.length - 1]!.value
}

const SEQUENTIAL_ORDER = ['cash', 'taxable', 'equityComp', 'traditional', 'roth', 'hsa'] as const
const PROPORTIONAL_POOL = ['cash', 'taxable', 'equityComp', 'traditional', 'roth'] as const

function spendableBalance(state: BalanceState, year: number): number {
  return isSpendableInYear(state.account, year) ? state.balance : 0
}

/** Strategy with year-specific parameters resolved (bracket headroom in dollars). */
type ResolvedWithdrawalStrategy =
  | { mode: 'sequential' }
  | { mode: 'proportional' }
  | { mode: 'bracketTargeted'; traditionalCap: number }

/** Drain plan over a copy of balances; pure with respect to engine state. */
function planWithdrawals(
  amount: number,
  states: BalanceState[],
  strategy: ResolvedWithdrawalStrategy = { mode: 'sequential' },
  year = 0,
  liquidReserve = 0,
): WithdrawalPlanResult {
  const byCategory: YearWithdrawals = { cash: 0, taxable: 0, traditional: 0, roth: 0, hsa: 0, total: 0 }
  const byAccountId = new Map<string, number>()
  const taxableSales = new Map<
    string,
    Readonly<AggregateBasisSaleResult>
  >()
  const available = new Map(states.map((s) => [s.account.id, spendableBalance(s, year)]))
  let realizedGains = 0
  let remaining = amount

  // Taxable safety-net floor (step 7): hold `liquidReserve` back from the
  // liquid (cash/taxable/vested equity-comp) accounts so other account types
  // fund spending first. Protection is allocated to the last-drained accounts
  // first, and released below only when everything else still falls short —
  // the floor is a preference, never a manufactured shortfall.
  const reservedByAccount = new Map<string, number>()
  if (liquidReserve > 0) {
    let toReserve = liquidReserve
    for (const type of ['equityComp', 'taxable', 'cash'] as const) {
      for (let i = states.length - 1; i >= 0 && toReserve > EPSILON; i--) {
        const s = states[i]!
        if (s.account.type !== type) continue
        const avail = available.get(s.account.id) ?? 0
        const hold = Math.min(avail, toReserve)
        if (hold <= 0) continue
        available.set(s.account.id, avail - hold)
        reservedByAccount.set(s.account.id, hold)
        toReserve -= hold
      }
    }
  }

  const takeFrom = (state: BalanceState, want: number): number => {
    const take = Math.min(available.get(state.account.id) ?? 0, want, remaining)
    if (take <= 0) return 0
    // A traditional draw the exact-cent ledger records as zero is discharged
    // here rather than at the apply loop below, and the difference is the whole
    // year's consistency. The apply loop only moves balances; this function is
    // where `byCategory`, `byAccountId` and `remaining` are decided together,
    // and every downstream figure -- the published traditional withdrawal
    // total, the ordinary income it produces, the tax on that income, and the
    // shortfall -- is read from what it returns. Skipping the movement alone
    // would leave the year publishing a withdrawal the runtime journal has no
    // occurrence for, which the source series refuses outright: the draw would
    // no longer happen and the total would still claim it did.
    //
    // Confined to traditional accounts because they are the ones under the
    // journal's explains-every-movement contract. Nothing else drained here
    // publishes a runtime occurrence, and a taxable account additionally
    // carries planned cost-basis state that this plan settles, so widening the
    // condition would be a different change with a different blast radius.
    if (state.account.type === 'traditional' && planDollarsMoveNoLedgerCent(take)) {
      // Discharged, not deferred, on the same terms as a sub-cent required
      // distribution: the quantum comes off both the account's availability and
      // the outstanding need, and no plan entry records it. The alternative is
      // to leave the need standing and send the household to another account
      // for a fraction of a cent, which would change which balances fund a real
      // need over a quantity no ledger can express.
      available.set(state.account.id, (available.get(state.account.id) ?? 0) - take)
      remaining -= take
      return 0
    }
    if (state.account.type === 'equityComp' && state.balance > 0) {
      const basisRatio = Math.min(1, state.costBasis / state.balance)
      realizedGains += take * (1 - basisRatio)
    }
    const category = state.account.type === 'equityComp' ? 'taxable' : state.account.type
    byCategory[category as keyof Omit<YearWithdrawals, 'total'>] += take
    byAccountId.set(state.account.id, (byAccountId.get(state.account.id) ?? 0) + take)
    available.set(state.account.id, (available.get(state.account.id) ?? 0) - take)
    remaining -= take
    return take
  }

  const drainCategory = (category: BalanceState['account']['type'], cap = Infinity): void => {
    let capLeft = cap
    for (const state of states) {
      if (state.account.type !== category) continue
      if (remaining <= EPSILON || capLeft <= EPSILON) break
      capLeft -= takeFrom(state, capLeft)
    }
  }

  if (strategy.mode === 'proportional') {
    // Pro-rata passes; accounts that empty shift their share to the rest.
    for (let pass = 0; pass < 6 && remaining > EPSILON; pass++) {
      const poolStates = states.filter(
        (s) => (PROPORTIONAL_POOL as readonly string[]).includes(s.account.type) && (available.get(s.account.id) ?? 0) > 0,
      )
      const poolTotal = poolStates.reduce((sum, s) => sum + (available.get(s.account.id) ?? 0), 0)
      if (poolTotal <= 0) break
      const target = remaining
      for (const state of poolStates) {
        takeFrom(state, (target * (available.get(state.account.id) ?? 0)) / poolTotal)
      }
    }
    for (const category of PROPORTIONAL_POOL) drainCategory(category) // numerical cleanup
    drainCategory('hsa')
  } else if (strategy.mode === 'bracketTargeted') {
    drainCategory('traditional', strategy.traditionalCap)
    drainCategory('cash')
    drainCategory('taxable')
    drainCategory('equityComp')
    drainCategory('roth')
    drainCategory('traditional')
    drainCategory('hsa')
  } else {
    for (const category of SEQUENTIAL_ORDER) drainCategory(category)
  }

  // Release the safety-net reserve as a last resort.
  let reserveUsed = 0
  if (remaining > EPSILON && reservedByAccount.size > 0) {
    const before = remaining
    for (const [id, hold] of reservedByAccount) {
      available.set(id, (available.get(id) ?? 0) + hold)
    }
    for (const category of ['cash', 'taxable', 'equityComp'] as const) drainCategory(category)
    reserveUsed = before - remaining
  }

  // Proportional planning may visit one account more than once. Characterize
  // each taxable account's final aggregate sale once so planning and commit
  // share identical signed basis math.
  for (const state of states) {
    if (state.account.type !== 'taxable') continue
    // A protected balance can be visited once before, then once after, reserve
    // release. Clamp the summed floating-point proceeds at the account boundary
    // while keeping the shared sale helper's validation strict.
    const saleProceeds = Math.min(
      state.balance,
      Math.max(0, byAccountId.get(state.account.id) ?? 0),
    )
    const sale = aggregateBasisSale({
      openingFairMarketValue: state.balance,
      openingCostBasis: state.costBasis,
      saleProceeds,
    })
    taxableSales.set(state.account.id, sale)
    realizedGains += sale.realizedCapitalGainOrLoss
  }

  byCategory.total = byCategory.cash + byCategory.taxable + byCategory.traditional + byCategory.roth + byCategory.hsa
  return {
    byCategory,
    byAccountId,
    realizedGains,
    taxableSales,
    shortfall: Math.max(0, remaining),
    reserveUsed,
  }
}

export function simulatePlan(plan: Plan, opts: SimulateOptions): ProjectionResult {
  const { startYear, taxCalculator, market } = opts
  const warnings = new Set<string>()
  const inflation = plan.assumptions.inflationPct / 100
  const people = plan.household.people
  const primary = people[0]!
  const personById = new Map(people.map((p) => [p.id, p]))
  // Clamped: the dob schema enforces YYYY-MM-DD shape but not month range, and
  // an out-of-range month must not produce negative or >12 coverage months.
  const birthMonthByPerson = new Map(people.map((p) => [p.id, Math.min(12, Math.max(1, dobParts(p).m || 1))]))
  const dobYear = (p: Person) => dobParts(p).y
  /** Last full year alive: a stochastic-longevity override if given, else the plan's planning age. */
  const lifeAgeOf = (p: Person) => opts.deathAgeByPersonId?.[p.id] ?? p.longevity.planningAge
  const lastAliveYearOf = (p: Person) => dobYear(p) + lifeAgeOf(p)

  const filingStatusFor = (year: number, aliveCount: number): ProjectedFilingStatus => {
    if (plan.household.filingStatus !== 'marriedFilingJointly') return plan.household.filingStatus
    if (aliveCount >= 2) return 'marriedFilingJointly'
    if (aliveCount === 1 && people.length === 2 && plan.household.hasQualifyingDependent) {
      const firstDeathYear = Math.min(...people.map(lastAliveYearOf))
      if (year > firstDeathYear && year <= firstDeathYear + 2) return 'qualifyingSurvivingSpouse'
    }
    return 'single'
  }

  // SSA-44 IRMAA redetermination (opt-in; domain rules §7). A qualifying
  // life-changing event — death of spouse, and optionally each person's work
  // stoppage — lets the beneficiary ask SSA to price IRMAA on the current
  // year's estimated MAGI instead of the two-year lookback. Planning-grade: in
  // the two years after an event, the premium MAGI is min(lookback, prior
  // year). The prior year stands in for the current-year estimate (current-year
  // MAGI would be circular with withdrawals — same convention as the ACA
  // credit), and the min reflects that a redetermination is only filed when it
  // helps. Two documented under-modelings of the real form follow from that
  // stand-in: (a) the event year itself stays on the plain lookback — a real
  // filing can re-price it, but the prior-year estimate there is pre-event
  // income, so modeling it would show no relief anyway; (b) in the first
  // post-event year the estimate is the event year's MAGI (a death year is
  // still a full joint year), so year-one relief is understated when income
  // runs high through the event. Off/absent = the plain two-year lookback.
  const ssa44 = plan.expenses.healthcare.ssa44
  const ssa44EventYears: number[] = []
  if (ssa44?.survivorYears && plan.household.filingStatus === 'marriedFilingJointly' && people.length === 2) {
    ssa44EventYears.push(Math.min(...people.map(lastAliveYearOf)))
  }
  if (ssa44?.retirementYears) {
    for (const p of people) {
      // Only a retirement that actually happens: someone who dies (planning
      // age or a stochastic/scenario override) before reaching retirementAge
      // never has a work-stoppage event to report.
      if (typeof p.retirementAge === 'number' && p.retirementAge <= lifeAgeOf(p)) {
        ssa44EventYears.push(dobYear(p) + p.retirementAge)
      }
    }
  }
  const ssa44ActiveInYear = (y: number) => ssa44EventYears.some((e) => y > e && y <= e + 2)
  const planHasTaxExemptYieldAttestation = plan.accounts.some(
    (account) =>
      account.type === 'taxable' && account.taxExemptInterestYieldPct !== undefined,
  )

  const endYear = opts.horizonEndYear ?? Math.max(...people.map((p) => dobYear(p) + lifeAgeOf(p)))

  // --- per-year market series (deterministic assumptions unless overridden) --
  const horizon = endYear - startYear + 1
  const inflRateAt = (year: number): number => {
    const series = market?.inflationPct
    if (year < startYear || !series || series.length === 0) return inflation
    return (series[Math.min(year - startYear, series.length - 1)] ?? plan.assumptions.inflationPct) / 100
  }
  const returnShockAt = (year: number): number => {
    const series = market?.returnShockPct
    if (!series || series.length === 0) return 0
    return series[Math.min(year - startYear, series.length - 1)] ?? 0
  }
  /**
   * Additive shock for one asset class: its own series when supplied, else the
   * single-factor market shock for non-cash classes (cash is stable value).
   */
  const classShockAt = (year: number, classIndex: number): number => {
    const id = ASSET_CLASS_IDS[classIndex]!
    const series = market?.classReturnShockPct?.[id]
    if (series && series.length > 0) return series[Math.min(year - startYear, series.length - 1)] ?? 0
    return id === 'cash' ? 0 : returnShockAt(year)
  }
  const healthExtra = plan.assumptions.healthcareExtraInflationPct / 100
  // cum*[i] = cumulative factor from startYear through startYear + i (exclusive).
  const cumInfl: number[] = [1]
  const cumHealthInfl: number[] = [1]
  for (let i = 0; i < horizon; i++) {
    const r = inflRateAt(startYear + i)
    cumInfl.push(cumInfl[i]! * (1 + r))
    cumHealthInfl.push(cumHealthInfl[i]! * (1 + r + healthExtra))
  }
  const factorFrom = (cum: number[], preStartRate: number, fromYear: number, toYear: number): number => {
    if (toYear <= fromYear) return 1
    let f = 1
    if (fromYear < startYear) f = Math.pow(1 + preStartRate, Math.min(toYear, startYear) - fromYear)
    const a = Math.min(Math.max(fromYear, startYear) - startYear, horizon)
    const b = Math.min(Math.max(toYear, startYear) - startYear, horizon)
    return f * (cum[b]! / cum[a]!)
  }
  /** Cumulative general-inflation factor between two years (per-year series from startYear on). */
  const inflFactorFrom = (fromYear: number, toYear: number) => factorFrom(cumInfl, inflation, fromYear, toYear)
  /** Same for healthcare (general inflation + the healthcare premium). */
  const healthInflFactorFrom = (fromYear: number, toYear: number) =>
    factorFrom(cumHealthInfl, inflation + healthExtra, fromYear, toYear)
  /** Statutory limits are indexed; project them past the latest pack at the inflation path. */
  const limitScale = (pack: ParameterPack, isStandIn: boolean, year: number): number =>
    !isStandIn || year <= LATEST_PACK_YEAR ? 1 : inflFactorFrom(pack.year, year)

  // --- mutable engine state ---------------------------------------------
  const balances: BalanceState[] = []
  const propertyValues = new Map<string, number>()
  const debtBalances = new Map<string, number>()
  for (const account of plan.accounts) {
    if (
      account.type === 'cash' ||
      account.type === 'taxable' ||
      account.type === 'equityComp' ||
      account.type === 'traditional' ||
      account.type === 'roth' ||
      account.type === 'hsa'
    ) {
      balances.push({
        account,
        balance: account.balance,
        costBasis: account.type === 'taxable' || account.type === 'equityComp' ? account.costBasis : 0,
      })
    } else if (account.type === 'property') {
      propertyValues.set(account.id, account.value)
    } else if (account.type === 'debt') {
      debtBalances.set(account.id, account.balance)
    }
  }
  let unassignedCash = 0
  // Annuity purchases (guaranteed-income-and-estate-depth). The premium actually
  // funded becomes the contract's investment for the non-qualified exclusion
  // ratio; the ratio and remaining excludable investment are memoized on first
  // payout. Both persist across years (funding and payout can be years apart for
  // a QLAC), so they live at engine-state scope.
  const annuityInvestmentInContract = new Map<string, number>()
  const annuityExclusionState = new Map<string, { ratio: number; remaining: number }>()
  // A non-qualified purchase dated before the projection start already funded the
  // contract in the past — its premium is assumed already out of the funding
  // account — so the per-year funding transfer below never runs for it. Seed the
  // investment-in-contract directly so exclusion-ratio taxation still recovers the
  // premium instead of treating every payout as fully taxable. (Qualified/QLAC
  // purchases are fully ordinary regardless, so they need no seeding.)
  for (const account of plan.accounts) {
    if (account.type !== 'annuity' || account.purchase?.taxQualification !== 'nonQualified') continue
    if (account.purchase.year >= startYear) continue
    annuityInvestmentInContract.set(account.id, account.purchase.premium)
  }
  /**
   * The December 31 value of each IRA-funded annuity contract, by contract id.
   *
   * The Form 8606 line-6 aggregate has to carry it -- 408(d)(2)(A) with
   * 7701(a)(37)(B), or line 6 read against a trust that still holds the contract
   * -- and nothing else in the projection does, because a Plan annuity account
   * has no balance and is not in `balances` at all. This channel is that
   * carrier: credited with each premium, debited by each payment, floored at
   * zero, and published with the post-growth pool so the replay measures it at
   * the same instant it measures everything else on line 6.
   *
   * It is a convention, not a valuation, and it is registered as one:
   * `irc-408-d-2-C-annuity-contract-close-of-year-value`.
   * @see internal/iraAnnuityContractValue.ts
   */
  const annuityContractValue = new Map<string, number>()
  /**
   * Contract id to the owner whose section 408(d)(2) aggregate holds it, which
   * is the funding IRA's owner and not the annuity account's own.
   * @see annuityContractDistributions
   */
  const annuityContractPoolOwner = new Map<string, string>()
  const annuityStagingCandidates = ownedIraFundedAnnuityContracts(plan)
    .filter(({ contract, ownerPersonId }) => {
      // The PAYMENT owner, not the pool owner: `startAge` is measured against
      // whoever the income block below measures it against, so the pre-start
      // payments this seeds with are the same payments a projection that had
      // started earlier would have made.
      const owner = personById.get(contract.ownerPersonId ?? primary.id)
      if (owner === undefined) return false
      // THE CAP BINDS THE SEED TOO. A purchase inside the projection is held to
      // the QLAC premium ceiling at the purchase pass, and a purchase before it
      // was held to the same ceiling in the year it happened -- Treas. Reg.
      // 1.401(a)(9)-6(q)(2) is a rule about the contract, not about which year
      // a projection starts in. Left unapplied, one contract had two values
      // decided by nothing but the start year: a 400,000 dollar QLAC seeded at
      // 400,000 pre-start where the same purchase inside the projection was
      // reduced to the cap.
      const { pack: purchasePack, isStandIn: purchaseStandIn } =
        packForYear(contract.purchase!.year)
      const cappedPremium = contract.purchase!.qlac === true
        ? Math.min(
          contract.purchase!.premium,
          purchasePack.annuities.qlacPremiumCap *
            limitScale(purchasePack, purchaseStandIn, contract.purchase!.year),
        )
        : contract.purchase!.premium
      annuityContractValue.set(
        contract.id,
        openingAnnuityContractValuePlanDollars(
          contract, owner, startYear, cappedPremium,
        ),
      )
      annuityContractPoolOwner.set(contract.id, ownerPersonId)
      return true
    })
  // The same pre-start reading, said out loud for the one event that cannot
  // apply it silently. An elected pension lump sum dated before the projection
  // start is a shape `parsePlan` now refuses ("an elected pension lump sum
  // cannot have an election year in the past"), but a plan saved under an
  // earlier build, or reopened in a later calendar year without being edited,
  // still reaches the ledger carrying it. The ledger cannot tell whether the
  // rollover already happened: it skips the pension for every
  // `year >= electionYear` and credits the offer in no projected year, which is
  // the right answer only when the household already folded those dollars into
  // the receiving account's entered balance. Naming it is the whole fix here;
  // moving money on a guess is not available to this engine.
  for (const account of plan.accounts) {
    if (account.type !== 'pension' || !account.lumpSumOffer) continue
    if (account.lumpSumOffer.electionYear >= startYear) continue
    if (account.lumpSumElection) {
      warnings.add(
        'A pension lump-sum election is dated before this projection starts, so the pension pays nothing and no rollover is credited. Update the election year, or clear the election and add the rolled-over dollars to the receiving account balance.',
      )
      continue
    }
    // The visible trace for the load-time repair in `model/migrations.ts`. A
    // stored document whose election could not be modelled comes back undecided
    // with its offer intact, so the pension pays again; this says why, in the
    // same breath as the identical state a household reaches by simply letting
    // an offer's deadline go by.
    warnings.add(
      'A pension lump-sum offer on record has an election year that has already passed, so no rollover is modeled and the pension pays its annuity. Update the election year to compare taking the lump sum again.',
    )
  }
  // HECM lines of credit (annuity-pension-and-home-equity, step 4), keyed by
  // property id. The principal limit and the loan balance both compound at the
  // line's growth rate; available credit is their difference. A sold property
  // repays the loan non-recourse (never more than the proceeds) and closes the
  // line, so a deleted entry means "closed", not "never opened".
  const hecmStates = new Map<string, { principalLimit: number; loanBalance: number }>()
  // Realized wealth-weighted portfolio return applied by the previous year's
  // growth pass (percent). The coordinated HECM draw policy triggers on an
  // actual portfolio loss — not on the raw additive shock, which can be
  // negative in a year the portfolio still gained. 0 before the first year.
  let priorYearPortfolioReturnPct = 0
  // TIPS income-floor ladders (social-security-bridge-and-tips-ladder). Rungs
  // are solved once from the embedded real-yield curve; per-year cash flows
  // scale with the path's inflation factors — exactly the TIPS indexation
  // (principal and coupons both track CPI). `scale` < 1 when a purchase-year
  // funding account couldn't cover the full quoted cost. A purchase dated
  // before the projection start is assumed already funded (like a seeded
  // annuity premium), so no transfer runs for it.
  const ladderStates: Array<{
    id: string
    anchorYear: number
    rungs: LadderRung[]
    costReal: number
    purchase: { year: number; fundingAccountId: string } | undefined
    scale: number
  }> = []
  // Last calendar year anyone is alive: after it, rungs stop maturing and the
  // remaining face is frozen as an estate asset (MC horizons run well past
  // death, and offset-space maturation must not evaporate unmatured principal).
  const ladderLastAliveYear = Math.max(...people.map((p) => dobYear(p) + lifeAgeOf(p)))
  for (const ladder of plan.incomeFloor?.ladders ?? []) {
    // Anchor = the year the rungs exist from: the purchase year, or (already
    // owned) the year before the projection so coupons pay from year one.
    const anchorYear = ladder.purchase ? ladder.purchase.year : startYear - 1
    const effectiveStartYear = Math.max(ladder.startYear, anchorYear + 1)
    if (ladder.endYear < effectiveStartYear || ladder.annualRealAmount <= 0) continue
    const build = buildLadder({
      annualRealIncome: ladder.annualRealAmount,
      firstPayoutOffset: effectiveStartYear - anchorYear,
      payoutYears: ladder.endYear - effectiveStartYear + 1,
      curve: EMBEDDED_REAL_YIELD_CURVE,
    })
    ladderStates.push({
      id: ladder.id,
      anchorYear,
      rungs: build.rungs,
      costReal: build.totalCost,
      purchase: ladder.purchase,
      scale: 1,
    })
  }

  // Opt-in asset allocation (asset-allocation-and-return-model-v2). Withdrawals
  // and deposits are assumed pro-rata across classes, so only differential class
  // growth moves an account's weights — tracking the weight vector (not class
  // dollars) is exact under that assumption. Accounts without an allocation are
  // untouched (feature-off is unchanged).
  const classParams = resolveAssetClassParams(plan.assumptions.assetClassParams)
  const allocationTrack = new Map<string, { policy: AssetAllocationPolicy; weights: number[] }>()
  for (const state of balances) {
    const policy = accountAllocation(state.account)
    if (policy) allocationTrack.set(state.account.id, { policy, weights: targetWeightsAt(policy, startYear) })
  }
  // Permanent-life cash values, grown/interpolated each year; an asset on the
  // balance sheet but held out of withdrawals (no surrender/loan in v1).
  const insuranceCashValues = new Map<string, number>()
  for (const policy of plan.insurance) {
    if (policy.kind === 'permanentLife') insuranceCashValues.set(policy.id, policy.cashValue)
  }
  // Years each LTC policy has paid a benefit, to enforce benefitPeriodYears.
  const ltcBenefitYearsUsed = new Map<string, number>()
  /** First-year (fixed) 72(t) amortization payment per account id, cached for the series. */
  const seppAmortAmount = new Map<string, number>()
  // Capital-loss carryforward pool, depleting across years: nets against realized
  // gains first, then up to the annual limit against ordinary income. Entered in
  // today's $ but treated as flat nominal (capital losses never index), so it's
  // not inflation-scaled. @see DOCS/features/taxes.md
  let capitalLossPool = plan.household.capitalLossCarryforward
  // Roth basis pools (contributions + conversion 5-year clocks) driving the Roth
  // ordering rules. The IRS aggregates an owner's Roth IRAs for ordering, so all
  // of one owner's Roth IRAs share a single pool; employer Roth (401k) accounts
  // stay separate. An omitted contributionBasis means "treat the whole starting
  // balance as seasoned basis" — the penalty-free default.
  //
  // Inherited Roth does NOT join the owned Roth basis pool — including after an
  // S2 treat-as-own flip. The inherited account's contribution basis was never
  // seeded into the owner pool, and post-flip draws keep the inherited-Roth
  // non-taxed / non-penalized path (IRC §72(t)(2)(A)(ii); K3 taxability is
  // disclosure-only). Documented v1 residual: basis migration into the owned
  // Roth pool after the flip is future work (matrix §7 WS4 residuals).
  const rothPoolKey = (account: Extract<Account, { type: 'roth' }>): string =>
    account.kind === 'ira' ? `rothira:${account.ownerPersonId ?? primary.id}` : `roth:${account.id}`
  /** True when this Roth still carries an inherited block (never joins owned pool in v1). */
  const isInheritedRothOutsideOwnedPool = (
    account: Extract<Account, { type: 'roth' }>,
  ): boolean => account.inherited !== undefined
  const rothBasis = new Map<string, RothBasisState>()
  for (const account of plan.accounts) {
    if (account.type !== 'roth') continue
    // Seed only pure owned Roth; an inherited Roth (pre- or post-S2) stays out.
    if (isInheritedRothOutsideOwnedPool(account)) continue
    const key = rothPoolKey(account)
    const startBasis = account.contributionBasis ?? account.balance
    const existing = rothBasis.get(key)
    if (existing) existing.contributionBasis += startBasis
    else rothBasis.set(key, { contributionBasis: startBasis, conversionLayers: [] })
  }
  // HSA medical-expense subledger (account/HSA/fixed-asset depth plan, steps
  // 2–3). Qualified withdrawals from cap-mode HSAs are limited to the
  // household's modeled medical costs each year; with reimburse-later enabled,
  // unreimbursed expenses accumulate in this pool (nominal $) and lift the cap
  // in later years — the "pay out of pocket now, reimburse yourself later"
  // strategy. Legacy HSAs (no withdrawalTreatment) keep v1 behavior exactly.
  const hsaReimburseLaterActive = plan.accounts.some(
    (a) => a.type === 'hsa' && a.withdrawalTreatment === 'capByMedicalExpenses' && a.reimburseLater === true,
  )
  let hsaReimbursablePool = 0
  // Nondeductible traditional-IRA basis pools (Form 8606 pro-rata, step 5),
  // aggregated per owner across their own (non-inherited) IRAs. Depletes as
  // distributions/conversions return basis.
  const iraBasisByOwner = new Map<string, number>()
  for (const account of plan.accounts) {
    if (!isAggregatedIra(account)) continue
    const basis = account.nondeductibleBasis ?? 0
    if (basis <= 0) continue
    const ownerId = account.ownerPersonId ?? primary.id
    iraBasisByOwner.set(ownerId, (iraBasisByOwner.get(ownerId) ?? 0) + basis)
  }
  // Taxable safety-net floor (step 7): a minimum liquid (cash/taxable/vested
  // equity-comp) reserve, in today's dollars, that withdrawals preserve and
  // fill-to-target conversions respect. 0 = off (today's behavior).
  const safetyNetFloorToday = plan.strategies.taxableSafetyNetFloor ?? 0
  /**
   * Realized MAGI by year. Before the projection, prefer an exact tax-year
   * history entry and retain recentAnnualMagi as the legacy fallback.
   */
  const magiHistory = new Map<number, number>()
  const magiFor = (y: number) =>
    magiHistory.get(y) ??
    plan.assumptions.historicalAnnualMagiByYear?.[String(y)] ??
    plan.assumptions.recentAnnualMagi

  const stableDepositTarget = (
    type: 'cash' | 'taxable',
  ): BalanceState | undefined =>
    balances
      .filter((state) => state.account.type === type)
      .sort((left, right) =>
        left.account.id < right.account.id
          ? -1
          : left.account.id > right.account.id
            ? 1
            : 0,
      )[0]

  // Preserve cash-before-taxable legacy priority while removing plan-array
  // order as the tie-breaker within either category.
  const surplusDepositTarget =
    stableDepositTarget('cash') ?? stableDepositTarget('taxable')

  const deposit = (amount: number) => {
    if (amount <= 0) return
    const target = surplusDepositTarget
    if (!target) {
      warnings.add('Surplus cash had no cash/taxable account to land in; tracked as unassigned (0% growth).')
      unassignedCash += amount
      return
    }
    target.balance += amount
    if (target.account.type === 'taxable' || target.account.type === 'equityComp') target.costBasis += amount
  }

  // Resolve each SS stream's PIA once: entered directly, or derived from the
  // earnings history via the AIME → bend-point engine.
  const resolvedPiaByStreamId = new Map<string, number>()
  for (const stream of plan.incomes) {
    if (stream.type !== 'socialSecurity') continue
    if (stream.piaMonthly !== null) {
      resolvedPiaByStreamId.set(stream.id, stream.piaMonthly)
      continue
    }
    if (!stream.earnings || stream.earnings.length === 0) {
      warnings.add('A Social Security stream has no PIA amount and no earnings history; it was skipped.')
      continue
    }
    const person = personById.get(stream.personId)!
    const { y, m, d } = dobParts(person)
    const projection = resolveEarningsProjection(stream.earningsProjection, person.retirementAge)
    const result = computePiaFromEarnings(piaInputFromEarnings(y, m, d, stream.earnings, projection))
    if (isPiaFromEarningsError(result)) {
      warnings.add(`A Social Security earnings history could not be used (${result.code}); the stream was skipped.`)
      continue
    }
    if (result.usesStandInForFutureTables) {
      warnings.add('PIA from earnings uses stand-in SSA tables for years beyond the published data.')
    }
    resolvedPiaByStreamId.set(stream.id, result.piaMonthly)
  }

  const years: YearResult[] = []
  // Owned-IRA annual settlement disposition. A rolled-back year commits no
  // carryforward, so the exact-cent figure the replay derived for that owner is
  // discarded and the owner keeps whatever the legacy fallback pass wrote. When
  // the rollback is evidence that the owner's numerator itself is wrong, that
  // owner's figure is untrustworthy from then on, and permanently ceasing to
  // claim or publish a settled figure for them is the right fail-closed
  // disposition.
  //
  // The failure is per owner, though, and so is the remedy. `iraBasisByOwner`,
  // the committed carryforwards, and the replay issues are all owner-keyed, so
  // a rollback that names an owner disqualifies only that owner. A rollback
  // that names nobody is not evidence about any one owner and must stay
  // household-wide fail-closed, exactly as it was before.
  //
  // The HORIZON is a second axis, and it is not the owner's. A stage-required
  // refusal -- an annuity premium leaving the pool, an exact action the replay
  // does not characterize, a charitable overlay it cannot attribute -- is a
  // statement about ONE YEAR'S event inventory, raised before the replay
  // computes any basis figure at all. It disqualifies that year, which then
  // falls back to the legacy ledger, and the next year retries clean. What
  // makes the chain coherent across that seam is that the fallback pass commits
  // its own basis for the year through the same `iraBasisByOwner` the settled
  // path writes, and that every year's replay opens on that map as a plan seed
  // (`openingBasisSource` is `planSeed` in every annual replay, because each
  // year settles a one-year window). A fallback year's committed write-back is
  // therefore the next year's opening basis on exactly the terms the projection
  // start's own seed is -- neither is itself a settled figure, and the
  // publication never claimed otherwise.
  //
  // `ownedNonRothIraAnnualSettlementRollbackDisqualification` is what draws that
  // line, and it draws it by an allow-list of three issue kinds rather than by
  // provenance: everything else stays permanent.
  const ownedNonRothIraSettlementRolledBackOwners = new Set<string>()
  let ownedNonRothIraSettlementRolledBackHousehold = false
  const ownedNonRothIraSettlementOwnerEnabled = (ownerId: string): boolean =>
    !ownedNonRothIraSettlementRolledBackHousehold &&
    !ownedNonRothIraSettlementRolledBackOwners.has(ownerId)
  // Settle while at least one owner still has a basis pool this projection is
  // allowed to settle. With no rollback recorded this is the historical
  // `iraBasisByOwner.size > 0`.
  const ownedNonRothIraSettlementEnabled = (): boolean =>
    !ownedNonRothIraSettlementRolledBackHousehold &&
    [...iraBasisByOwner.keys()].some(ownedNonRothIraSettlementOwnerEnabled)
  let depletionYear: number | null = null

  // Spending policy (planning-depth roadmap §4). Under withdrawal-rate or
  // risk-based guardrails the ledger rations the discretionary spending layer
  // path by path and routes flexible goals through a scheduler; fixed-target (or
  // absent) keeps today's behavior. The two modes share the rationing machinery
  // and differ only in the trigger signal: withdrawal-rate compares the current
  // withdrawal rate to the starting rate; risk-based compares the real balance
  // to solver-derived probability-band thresholds (% of the starting portfolio).
  // The running multiplier and starting signal persist across the year loop
  // (path state), so this is set up once per simulation.
  const spendingPolicy = plan.expenses.spendingPolicy
  const riskBasedGuardrails = spendingPolicy?.mode === 'riskBasedGuardrails'
  const guardrailsActive = spendingPolicy?.mode === 'withdrawalRateGuardrails' || riskBasedGuardrails
  const guardrailPolicy: GuardrailPolicy = {
    mode: riskBasedGuardrails ? 'risk-based' : 'withdrawal-rate',
    upperGuardrailPct: spendingPolicy?.upperGuardrailPct,
    lowerGuardrailPct: spendingPolicy?.lowerGuardrailPct,
    lowerBalanceThresholdPct: spendingPolicy?.lowerBalanceThresholdPct,
    upperBalanceThresholdPct: spendingPolicy?.upperBalanceThresholdPct,
    adjustmentPct: spendingPolicy?.adjustmentPct,
    allowRaisesAboveTarget: spendingPolicy?.allowRaisesAboveTarget,
  }
  // Amortization-based withdrawal (spending-paths & SWR-lenses plan, Goal 2).
  // Under 'abw' the year's lifestyle target is the actual start-of-year
  // portfolio re-amortized over the remaining horizon (engine/spending/abw.ts)
  // instead of baseAnnual × phases; the payment funds through the same
  // tax/withdrawal cascade as every other expense. The horizon and expected
  // real return are resolved once here — presets-don't-drift style — so every
  // year of one simulation amortizes toward the same end age.
  const abwActive = spendingPolicy?.mode === 'abw'
  const abwRealReturnPct = abwActive ? abwExpectedRealReturnPct(spendingPolicy?.abw) : 0
  const abwTiltPct = abwActive ? (spendingPolicy?.abw?.tiltPct ?? ABW_DEFAULTS.tiltPct) : 0
  let abwHorizonYear = endYear
  if (abwActive) {
    const horizonMode = spendingPolicy?.abw?.horizon ?? ABW_DEFAULTS.horizon
    if (horizonMode === 'survival25' || horizonMode === 'survival10') {
      // Deliberately the unadjusted SSA table (hazard = 1): the ledger never
      // reads questionnaire state, and a health-adjusted percentile pick on
      // Household is provenance on that person's planning age, not a plan-wide
      // mortality override. The UI labels this horizon "unadjusted SSA".
      const pct = horizonMode === 'survival25' ? 25 : 10
      const partner = people[1]
      const primaryAgeNow = startYear - dobYear(primary)
      const horizonAge = partner
        ? jointSurvivalPercentileAge(
            { age: primaryAgeNow, sex: primary.sex },
            { age: startYear - dobYear(partner), sex: partner.sex },
            pct,
          )
        : survivalPercentileAge(primaryAgeNow, primary.sex, pct)
      abwHorizonYear = dobYear(primary) + horizonAge
    }
  }

  const goalScheduler: GoalScheduler | null = guardrailsActive
    ? createGoalScheduler(plan.expenses.oneTimeGoals.map((g, i) => toSchedulableGoal(g, i)))
    : null
  let discretionaryMultiplier = 1
  let startingWithdrawalRate: number | null = null
  let startingRealPortfolio: number | null = null

  /**
   * Each donor's post-70½ deductible-contribution offset already consumed by
   * this run's own committed gifts, in exact cents. It is state across the year
   * loop because Notice 2020-68 makes the offset cumulative over the donor's
   * lifetime, not annual: a dollar of post-70½ deductible contribution reduces
   * one QCD and is then spent.
   */
  const namedQcdOffsetConsumedByDonor = new Map<string, number>()
  /**
   * Donors whose prior offset consumption this run cannot state.
   *
   * The Plan carries the deductible-contribution history but records nothing
   * about how much of it earlier gifts already absorbed, so the only consumption
   * this engine can prove is the consumption it performed itself. A gift the
   * Plan declares for a year before the projection begins, and an aggregate
   * `qcdAnnual` gift in an earlier projected year, are both real gifts whose
   * offset application is unknown here. Either one makes the donor's history
   * unprovable and the named gift non-actionable, which is the fail-closed
   * answer the contract requires: zero is never substituted for an unknown.
   */
  const namedQcdOffsetHistoryUnprovable = new Set<string>()
  for (const request of plan.strategies.retirementActions) {
    if (request.kind !== 'qcd' || request.year >= startYear) continue
    namedQcdOffsetHistoryUnprovable.add(request.donorPersonId)
  }

  // Earnings-test FRA credit: months of benefit fully withheld before FRA are
  // credited back at FRA by recomputing the benefit as if claimed that many
  // months later. Accumulated across the pre-FRA years (persists across the loop).
  const withheldMonthsByPerson = new Map<string, number>()
  const creditedClaimAgeFor = (person: Person, claimAge: ClaimAge, ageAttained: number, capMonths: number): ClaimAge => {
    const originalMonths = claimAgeTotalMonths(claimAge)
    if (originalMonths >= capMonths || ageAttained < Math.floor(capMonths / 12)) return claimAge
    const credited = Math.min(capMonths, originalMonths + (withheldMonthsByPerson.get(person.id) ?? 0))
    return claimAgeFromTotalMonths(credited)
  }

  // WS4 inherited-IRA regime cache: classify each inherited account ONCE per
  // simulation. Regime law lives only in strategies/inheritedIra.ts — simulate
  // never re-derives a divisor, deadline, or row. Path:
  //   - legacy (X1 / missing beneficiary / non-X1 refusal fallback) →
  //     inheritedForcedAmount, byte-identical to pre-WS4 for two-field accounts;
  //   - classified → inheritedRequirementForYear on the real prior-Dec-31 base.
  // S2 also caches a synthetic S0 classification (election overridden to 'none')
  // for the pre-treatAsOwnElectionYear window.
  type InheritedClassCacheEntry = {
    accountId: string
    accountType: 'traditional' | 'roth'
    ownerPersonId: string
    path: 'legacy' | 'classified'
    refusalReason?: string
    /** Primary classifier result (regime or refusal). */
    primary: InheritedRegimeResult
    /**
     * Classification used for the annual schedule. For S2 this is the synthetic
     * S0 (election 'none'); otherwise the primary regime classification.
     */
    schedule?: InheritedRegimeClassification
    /** True when primary classified as spouse-treat-as-own-transition. */
    isS2: boolean
    treatAsOwnElectionYear?: number
    /**
     * Year-of-death RMD obligation predates the projection start and is not
     * modeled as satisfied (Treas. Reg. §1.408-8(e)(4)(i)). First-year evidence
     * only; no amount is forced.
     */
    preHorizonYearOfDeathRmdUnresolved?: boolean
  }
  const inheritedClassCache = new Map<string, InheritedClassCacheEntry>()
  for (const account of plan.accounts) {
    if (account.type !== 'traditional' && account.type !== 'roth') continue
    if (account.inherited === undefined) continue
    const accountType = account.type
    const inherited = account.inherited
    const regimeResult = classifyInheritedRegime({
      accountType,
      accountKind: account.kind,
      inherited,
    })
    const ownerPersonId = account.ownerPersonId ?? primary.id
    /**
     * Year-of-death RMD obligation predates the projection horizon and is not
     * modeled as satisfied (Treas. Reg. §1.408-8(e)(4)(i)). Stamped on the
     * first projection year's evidence only; no amount is forced.
     */
    const preHorizonYearOfDeathRmdUnresolved =
      regimeResult.kind === 'regime' &&
      regimeResult.rbdComparison === 'on-or-after-rbd' &&
      inherited.beneficiary?.ownerYearOfDeathRmdSatisfied !== true &&
      inherited.ownerDeathYear < startYear
    if (regimeResult.kind === 'refusal') {
      // X1 and every other refusal fall back to the legacy forced-amount path
      // so a plan that parsed still projects; non-X1 refusals carry the reason
      // on the evidence row so no consumer can call the schedule compliant.
      // Pre-horizon year-of-death limitation applies uniformly on the refusal
      // path too (same fact test as the classified path).
      inheritedClassCache.set(account.id, {
        accountId: account.id,
        accountType,
        ownerPersonId,
        path: 'legacy',
        refusalReason:
          regimeResult.refusal === 'legacy-planning-approximation'
            ? undefined
            : regimeResult.reason,
        primary: regimeResult,
        isS2: false,
        preHorizonYearOfDeathRmdUnresolved,
      })
      continue
    }
    let schedule: InheritedRegimeClassification = regimeResult
    let isS2 = false
    let treatAsOwnElectionYear: number | undefined
    if (regimeResult.regime === 'spouse-treat-as-own-transition') {
      isS2 = true
      treatAsOwnElectionYear = inherited.beneficiary?.treatAsOwnElectionYear
      // Synthetic S0: before the election year the spouse IS the default
      // remain-beneficiary (election 'none', no election year). Keep the WS3
      // calculator unchanged.
      const syntheticInherited = {
        ...inherited,
        beneficiary: inherited.beneficiary
          ? {
              ...inherited.beneficiary,
              election: 'none' as const,
              treatAsOwnElectionYear: undefined,
            }
          : undefined,
      }
      const synthetic = classifyInheritedRegime({
        accountType,
        accountKind: account.kind,
        inherited: syntheticInherited,
      })
      if (synthetic.kind === 'regime') {
        schedule = synthetic
      } else {
        // The pre-election window's schedule is the S0 default; if that
        // classification refuses (contested born-1959 deferral, missing owner
        // birth year), the schedule cannot be placed and the whole account
        // fails closed onto the labeled legacy path, carrying the refusal on
        // its evidence rows. The S2 identity flip still applies from the
        // election year — the refusal is about the beneficiary-window amounts,
        // not the election itself.
        //
        // Flip agreement: primary here is a valid S2 classification (the
        // classifier's structural gate already held), so isTreatAsOwnEffective
        // — which mirrors that gate — also returns true from the election year.
        // A fact set the classifier would refuse never reaches isS2: true; the
        // cache-driven flip path and the helper therefore agree.
        inheritedClassCache.set(account.id, {
          accountId: account.id,
          accountType,
          ownerPersonId,
          path: 'legacy',
          refusalReason: synthetic.reason,
          primary: regimeResult,
          isS2: true,
          treatAsOwnElectionYear,
          preHorizonYearOfDeathRmdUnresolved,
        })
        continue
      }
    }
    inheritedClassCache.set(account.id, {
      accountId: account.id,
      accountType,
      ownerPersonId,
      path: 'classified',
      primary: regimeResult,
      schedule,
      isS2,
      treatAsOwnElectionYear,
      preHorizonYearOfDeathRmdUnresolved,
    })
  }
  const planHasInheritedAccounts = inheritedClassCache.size > 0

  for (let year = startYear; year <= endYear; year++) {
    const inflFactor = inflFactorFrom(startYear, year)
    const { pack, isStandIn } = packForYear(year)
    const limitGrowth = limitScale(pack, isStandIn, year)
    const annualRetirementRuntimeOccurrences:
      SimulatorAnnualRetirementRuntimeOccurrence[] = []
    const recordAnnualRetirementRuntimeOccurrence = (
      occurrence: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
    ): void => {
      annualRetirementRuntimeOccurrences.push({ ...occurrence })
    }
    const runtimeOccurrenceKey = (
      kind: SimulatorAnnualRetirementRuntimeOccurrence['kind'],
      ...binding: readonly unknown[]
    ): string => JSON.stringify([kind, ...binding])
    const annualRetirementRuntimeApplications:
      SimulatorRetirementRuntimeApplication[] = []
    let nextRetirementRuntimeMutationOrdinal = 1
    const recordAnnualRetirementRuntimeApplication = (
      application: SimulatorRetirementRuntimeApplicationWithoutOrdinal,
    ): SimulatorRetirementRuntimeApplication => {
      const recorded = {
        ...application,
        mutationOrdinal: nextRetirementRuntimeMutationOrdinal++,
      } as SimulatorRetirementRuntimeApplication
      annualRetirementRuntimeApplications.push(recorded)
      return recorded
    }
    /**
     * Strategy balance debits captured at their mutation site because they
     * publish no complete runtime record of their own.
     *
     * The optimizer probe prefers a published record and uses one wherever it
     * exists — the 72(t) series, the aggregate QCD and the pension lump-sum
     * rollover all emit a runtime OCCURRENCE that covers every account shape
     * their own block can reach, and the probe reads those. Two purchases do
     * not. The annuity purchase's occurrence is emitted only when the funding
     * account is traditional (see the purchase block below), so a cash- or
     * brokerage-funded premium would be invisible; the TIPS-ladder purchase
     * publishes no runtime record at all. This is that gap, filled at the same
     * line the balance actually moves, which is the only place the fact exists
     * for those sources.
     */
    const exogenousStrategyDebits: {
      accountId: string
      amountPlanDollars: number
    }[] = []
    /**
     * This year's annuity-contract payments, kept so the annual pass can ask
     * the settlement what share of each was a return of basis.
     *
     * They are minted in the income block, which runs BEFORE the pass and is
     * therefore outside it: the payment's size is fixed by the Plan's monthly
     * amount, COLA and payout form and does not depend on anything the pass
     * decides, so it is identical in every attempt. What the pass decides is the
     * CHARACTER, and to ask for it the pass needs the mutation ordinal the
     * application was recorded with -- the same ordinal the replay derives its
     * allocation identity from. That is what this carries.
     */
    const annuityContractDistributions: {
      producerOccurrenceKey: string
      annuityAccountId: string
      /**
       * WHOSE FORM 8606 THIS LANDS ON, which is not whose contract it is.
       *
       * Two owners travel with an annuity payment and they answer different
       * questions. The PAYMENT owner -- the annuity account's own
       * `ownerPersonId`, or the household's first person when it names nobody
       * -- decides whose age starts the payments, how the payout form treats a
       * death, and which estate rules apply; it is what the runtime occurrence
       * records, because that is the physical fact observed at the mutation
       * site. The POOL owner is the funding IRA's, and it decides which
       * individual's section 408(d)(2) aggregate the contract sits in, which
       * Form 8606 line 7 its gross joins, and therefore which owner's basis
       * allocation prices it. The settlement publishes its effect under the
       * pool owner, so the character lookup has to ask under the pool owner
       * too. Asking under the payment owner is what this field is named for: on
       * a contract where the two differ, the lookup missed, the payment kept
       * its full face amount in income, and the settlement spent the basis
       * anyway -- tax charged and basis gone, permanently, every paying year.
       */
      poolOwnerPersonId: string
      grossAmountPlanDollars: number
      mutationOrdinal: number
    }[] = []

    // Prior Dec 31 balances (RMD base) — captured before this year's flows.
    const startOfYearBalance = new Map(balances.map((b) => [b.account.id, b.balance]))
    /**
     * The contract-value channel as this year opened, captured beside those
     * balances and for the same consumer.
     *
     * The settlement replays one year at a time against a Plan snapshot whose
     * account balances have been rewritten to this year's openings; an annuity
     * account has no balance field to rewrite, so the channel's opening travels
     * with the post-growth source instead. Without it a mid-projection replay
     * would have to guess where a multi-year channel had got to, and the guess
     * is wrong for every contract whose premium the funding account could not
     * pay in full.
     */
    const startOfYearAnnuityContractValue = new Map(annuityContractValue)

    // --- annual rebalance to target (start-of-year trade) -------------------
    // Allocated accounts trade drifted weights back to this year's glidepath
    // target. Taxable sells realize gains pro-rata through the same basis-ratio
    // machinery as withdrawals (basis rises by the realized gain: sold basis
    // leaves, the reinvested proceeds enter at market); traditional/Roth/HSA
    // rebalances are tax-free. rebalancing: 'none' opts out — weights drift.
    let rebalanceRealizedGains = 0
    if (year > startYear) {
      for (const state of balances) {
        const track = allocationTrack.get(state.account.id)
        if (!track || track.policy.rebalancing === 'none') continue
        const target = targetWeightsAt(track.policy, year)
        const turnover = rebalanceTurnoverFraction(track.weights, target)
        if (turnover > 1e-9 && state.account.type === 'taxable' && state.balance > 0) {
          // Normalized floating-point weights can sum a few ulps above 1.
          // Keep the strict sale helper strict and contain that noise here.
          const sellAmount = Math.min(state.balance, Math.max(0, turnover * state.balance))
          const sale = aggregateBasisSale({
            openingFairMarketValue: state.balance,
            openingCostBasis: state.costBasis,
            saleProceeds: sellAmount,
          })
          rebalanceRealizedGains += sale.realizedCapitalGainOrLoss
          state.costBasis = sale.remainingCostBasis + sellAmount
        }
        track.weights = target
      }
    }

    /** Contract-value credits, held back so the phase runs contiguously. */
    const pendingAnnuityContractCredits: {
      producerOccurrenceKey: string
      annuityAccountId: string
      ownerPersonId: string | null
      creditedAmountPlanDollars: number
      contractValueBeforePlanDollars: number
      contractValueAfterPlanDollars: number
    }[] = []
    // --- annuity purchase funding (guaranteed-income-and-estate-depth) -------
    // A purchased annuity trades a premium out of a funding account in its
    // purchase year. The move is a transfer, not spending: cash and qualified
    // (traditional) sources move at book value; a taxable/equity-comp source
    // realizes gains pro-rata like any sale, folded into this year's realized
    // gains, and the premium leaves the account. A qualified premium leaving a
    // traditional balance shrinks future RMDs automatically. A QLAC premium is
    // held to the statutory cap. The premium actually funded becomes the
    // contract's investment for the non-qualified exclusion ratio.
    for (const account of plan.accounts) {
      if (account.type !== 'annuity' || !account.purchase || account.purchase.year !== year) continue
      const funding = balances.find((b) => b.account.id === account.purchase!.fundingAccountId)
      if (!funding) continue
      let premium = account.purchase.premium
      // Last line rather than the only one. `parsePlan` refuses a qualified
      // purchase that starts paying later than its shape permits — past the
      // owner's required beginning date when it is not a QLAC (Treas. Reg.
      // 1.401(a)(9)-6(a)(3)(i), excused by (q)(1)(iii) for a QLAC alone), and
      // past the first of the month after the owner's 85th birthday when it is
      // one ((q)(1)(ii)) — and a stored document carrying either shape is stood
      // down at load. `simulatePlan` still takes a `Plan` by type rather than by
      // parse, so a caller that built one in memory can reach this pass with the
      // shape intact — and when it does, the premium below leaves the
      // traditional balance for a contract that holds no balance, which is the
      // required-distribution exclusion 1.401(a)(9)-5(b)(4) reserves for a QLAC.
      // Say so rather than let it pass silently, the same way the statutory
      // premium cap is enforced here and not only at parse.
      if (account.purchase.taxQualification === 'qualified') {
        const owner = personById.get(account.ownerPersonId ?? primary.id) ?? primary
        if (account.purchase.qlac === true) {
          if (account.startAge > latestQlacAnnuityStartAge(dobParts(owner).m)) {
            warnings.add(
              'A QLAC that starts paying later than the first of the month after its owner\'s 85th birthday is not a QLAC; its premium still left the required-distribution base, which only a QLAC may do.',
            )
          }
        } else if (
          account.startAge >
          latestNonQlacQualifiedAnnuityStartAge(dobYear(owner), account.purchase.year)
        ) {
          warnings.add(
            'A qualified annuity that starts paying after its owner\'s required beginning date was not marked a QLAC; its premium still left the required-distribution base, which only a QLAC may do.',
          )
        }
      }
      const qlacCap = pack.annuities.qlacPremiumCap * limitGrowth
      if (account.purchase.qlac && premium > qlacCap) {
        premium = qlacCap
        warnings.add(
          `A QLAC premium above the $${Math.round(qlacCap).toLocaleString()} cap was reduced to the cap (the excess is not QLAC-eligible).`,
        )
      }
      // Only spendable funds can pay the premium: cliff-vesting equity comp with
      // a future vest date is not liquidatable yet, so it cannot fund a purchase
      // (mirrors the withdrawal planner's isSpendableInYear gate).
      const funded = Math.min(premium, spendableBalance(funding, year))
      if (funded < premium - EPSILON) {
        warnings.add('An annuity premium exceeded its funding account balance and was reduced to the available amount.')
      }
      const fundingBalanceBefore = funding.balance
      if (funding.account.type === 'taxable') {
        const sale = aggregateBasisSale({
          openingFairMarketValue: funding.balance,
          openingCostBasis: funding.costBasis,
          saleProceeds: funded,
        })
        rebalanceRealizedGains += sale.realizedCapitalGainOrLoss
        funding.costBasis = sale.remainingCostBasis
      } else if (funding.account.type === 'equityComp' && funding.balance > 0) {
        const basisRatio = Math.min(1, funding.costBasis / funding.balance)
        rebalanceRealizedGains += funded * (1 - basisRatio)
        funding.costBasis = Math.max(0, funding.costBasis - funded * basisRatio)
      }
      funding.balance -= funded
      // The premium leaves an LP bucket for a contract the LP does not carry.
      // Captured here rather than from the occurrence below, which is emitted
      // only for a traditional funding source — a cash- or brokerage-funded
      // premium moves exactly the same dollars and publishes nothing.
      if (funded > 0) {
        exogenousStrategyDebits.push({
          accountId: funding.account.id,
          amountPlanDollars: funded,
        })
      }
      if (funded > 0 && funding.account.type === 'traditional') {
        const kind = 'annuityFundingTransfer' as const
        const producerOccurrenceKey = runtimeOccurrenceKey(
          kind,
          funding.account.id,
          account.id,
        )
        recordAnnualRetirementRuntimeOccurrence({
          producerOccurrenceKey,
          kind,
          grossAmountPlanDollars: funded,
          ownerPersonId: funding.account.ownerPersonId,
          sourceAccountId: funding.account.id,
          executionDate: null,
          executionSequence: null,
          movementAuthorityId: null,
        })
        if (isAggregatedIra(funding.account)) {
          recordAnnualRetirementRuntimeApplication({
            applicationKind: 'debit',
            producerOccurrenceKey,
            simulatorPhase: 'annuityPurchaseFunding',
            ownerPersonId: funding.account.ownerPersonId,
            sourceAccountId: funding.account.id,
            sourceBalanceBeforePlanDollars: fundingBalanceBefore,
            appliedAmountPlanDollars: funded,
            sourceBalanceAfterPlanDollars: funding.balance,
          })
          // THE CREDIT BESIDE THE DEBIT. The premium is not a distribution --
          // IRC 408(d)(1) reaches only what is paid or distributed OUT, and
          // Publication 590-B says the owner is not taxed on receiving the
          // contract -- so the value did not leave the section 408(d)(2)
          // aggregate, it changed which asset holds it. Recording only the debit
          // asserted the opposite by omission: the line-6 denominator lost the
          // premium and nothing gained it. Withheld where the contract has no
          // channel at all, so the year refuses in the source series rather
          // than crediting one that cannot say whose aggregate it belongs to.
          //
          // DEFERRED PAST THE LOOP rather than recorded in place, and a
          // household that buys two contracts in one year is the whole reason.
          // The replay requires application phases to be non-decreasing across
          // the year, so debit-credit-debit-credit would refuse an ordinary
          // Plan on an ordering rule that is about the simulator's own passes
          // and not about anything the statute cares about. Every debit first,
          // then every credit, keeps each phase to one contiguous run.
          if (annuityContractValue.has(account.id)) {
            const contractValueBefore = annuityContractValue.get(account.id)!
            const contractValueAfter = contractValueBefore + funded
            annuityContractValue.set(account.id, contractValueAfter)
            pendingAnnuityContractCredits.push({
              producerOccurrenceKey,
              annuityAccountId: account.id,
              ownerPersonId: funding.account.ownerPersonId,
              creditedAmountPlanDollars: funded,
              contractValueBeforePlanDollars: contractValueBefore,
              contractValueAfterPlanDollars: contractValueAfter,
            })
          }
        }
      }
      annuityInvestmentInContract.set(account.id, (annuityInvestmentInContract.get(account.id) ?? 0) + funded)
    }
    for (const credit of pendingAnnuityContractCredits) {
      recordAnnualRetirementRuntimeApplication({
        applicationKind: 'annuityContractPremiumCredit',
        simulatorPhase: 'annuityPurchaseContractCredit',
        producerOccurrenceKey: null,
        ownerPersonId: null,
        sourceAccountId: null,
        sourceBalanceBeforePlanDollars: null,
        sourceBalanceAfterPlanDollars: null,
        producerOccurrenceKeys: [credit.producerOccurrenceKey],
        sourceOwnerPersonIds: [credit.ownerPersonId],
        destinationAnnuityAccountId: credit.annuityAccountId,
        destinationOwnerPersonId: credit.ownerPersonId,
        destinationContractValueBeforePlanDollars:
          credit.contractValueBeforePlanDollars,
        destinationCreditedAmountPlanDollars: credit.creditedAmountPlanDollars,
        destinationContractValueAfterPlanDollars:
          credit.contractValueAfterPlanDollars,
      })
    }

    // --- pension lump-sum rollover (annuity-pension-and-home-equity, step 3) -
    // An elected lump sum commutes the pension: the offer amount arrives as a
    // tax-free direct rollover into the named traditional account in the
    // election year (external plan money — nothing leaves another account),
    // and the pension income stream never pays (skipped in the income block).
    for (const account of plan.accounts) {
      if (account.type !== 'pension' || !account.lumpSumElection || !account.lumpSumOffer) continue
      if (account.lumpSumOffer.electionYear !== year) continue
      const target = balances.find((b) => b.account.id === account.lumpSumElection!.rolloverAccountId)
      if (!target) continue
      const targetBalanceBefore = target.balance
      target.balance += account.lumpSumOffer.amount
      // This credit reaches the optimizer through the occurrence recorded just
      // below, not through a mutation-site capture like the two purchases: the
      // occurrence covers every case this line can reach, because
      // `rolloverAccountId` is validated as an existing OWNED TRADITIONAL
      // account (`model/plan.ts`, "a pension lump sum must roll over into an
      // existing traditional account you own (not an inherited IRA)"), so the
      // `type === 'traditional'` gate below can never be false where the balance
      // moved, and the account it resolves is always an owned one. An offer of
      // zero moves nothing and reports nothing.
      if (account.lumpSumOffer.amount > 0 && target.account.type === 'traditional') {
        const kind = 'rolloverInflow' as const
        const producerOccurrenceKey = runtimeOccurrenceKey(
          kind,
          account.id,
          target.account.id,
        )
        recordAnnualRetirementRuntimeOccurrence({
          producerOccurrenceKey,
          kind,
          grossAmountPlanDollars: account.lumpSumOffer.amount,
          ownerPersonId: target.account.ownerPersonId,
          sourceAccountId: target.account.id,
          executionDate: null,
          executionSequence: null,
          movementAuthorityId: null,
        })
        if (isAggregatedIra(target.account)) {
          recordAnnualRetirementRuntimeApplication({
            applicationKind: 'credit',
            producerOccurrenceKey,
            simulatorPhase: 'pensionLumpSumRollover',
            ownerPersonId: target.account.ownerPersonId,
            sourceAccountId: target.account.id,
            sourceBalanceBeforePlanDollars: targetBalanceBefore,
            creditedAmountPlanDollars: account.lumpSumOffer.amount,
            sourceBalanceAfterPlanDollars: target.balance,
          })
        }
      }
    }

    // --- HECM line open (annuity-pension-and-home-equity, step 4) -----------
    // The initial principal limit is the user's quoted percent of the home's
    // value at open (or the pack's published PLF approximation by the youngest
    // borrower's age); financed upfront costs start the loan balance. A line
    // dated before the projection opens in the first projection year at
    // today's value (its pre-projection growth is not reconstructed).
    for (const account of plan.accounts) {
      if (account.type !== 'property' || !account.hecm) continue
      if (year !== Math.max(account.hecm.openYear, startYear)) continue
      if (hecmStates.has(account.id)) continue
      const value = propertyValues.get(account.id) ?? 0
      if (value <= 0) continue
      const youngestAge = Math.min(...people.map((p) => year - dobYear(p)))
      if (youngestAge < 62) {
        warnings.add('A HECM line of credit was modeled before the youngest borrower turns 62 (real HECMs require age 62+).')
      }
      const plfPct = account.hecm.principalLimitPct ?? hecmPrincipalLimitFactorPct(pack, youngestAge)
      hecmStates.set(account.id, {
        principalLimit: (plfPct / 100) * value,
        loanBalance: ((account.hecm.upfrontCostPct ?? 0) / 100) * value,
      })
    }

    // --- TIPS-ladder purchase funding ---------------------------------------
    // Same transfer semantics as an annuity premium: the quoted real cost
    // (inflated to the purchase year) leaves the funding account at book value
    // for cash, realizing gains pro-rata for taxable/equity-comp. A partial
    // fill scales every rung down so the ladder delivers exactly what the
    // money bought.
    for (const ls of ladderStates) {
      if (!ls.purchase || ls.purchase.year !== year) continue
      const funding = balances.find((b) => b.account.id === ls.purchase!.fundingAccountId)
      if (!funding) continue
      const cost = ls.costReal * inflFactor
      const funded = Math.min(cost, spendableBalance(funding, year))
      if (funded < cost - EPSILON) {
        ls.scale = cost > 0 ? funded / cost : 0
        warnings.add(
          'A TIPS ladder purchase exceeded its funding account balance; the ladder was scaled down to what the available money buys.',
        )
      }
      if (funding.account.type === 'taxable') {
        const sale = aggregateBasisSale({
          openingFairMarketValue: funding.balance,
          openingCostBasis: funding.costBasis,
          saleProceeds: funded,
        })
        rebalanceRealizedGains += sale.realizedCapitalGainOrLoss
        funding.costBasis = sale.remainingCostBasis
      } else if (funding.account.type === 'equityComp' && funding.balance > 0) {
        const basisRatio = Math.min(1, funding.costBasis / funding.balance)
        rebalanceRealizedGains += funded * (1 - basisRatio)
        funding.costBasis = Math.max(0, funding.costBasis - funded * basisRatio)
      }
      funding.balance -= funded
      // The same booking the annuity premium above gets, for the reason this
      // block's own opening sentence gives: these ARE the same transfer
      // semantics. The purchase price leaves an LP bucket for a ladder the LP
      // carries in no bucket, and the ladder pays back later through
      // `incomes.tipsLadder`, which is already inside `exogenousCash`. Captured
      // here because this block publishes no runtime record whatsoever — there
      // is no occurrence to read back off, so the mutation site is the only
      // place the fact exists for any funding account type.
      if (funded > 0) {
        exogenousStrategyDebits.push({
          accountId: funding.account.id,
          amountPlanDollars: funded,
        })
      }
    }

    const peopleStates: PersonYearState[] = people.map((p) => {
      const ageAttained = year - dobYear(p)
      return { personId: p.id, ageAttained, alive: ageAttained <= lifeAgeOf(p) }
    })
    const stateOf = (personId: string) => peopleStates.find((s) => s.personId === personId)!
    const anyAlive = peopleStates.some((s) => s.alive)
    const aliveCount = peopleStates.filter((s) => s.alive).length
    const filingStatusForYear = filingStatusFor(year, aliveCount)
    const taxFilingStatusForYear = taxParameterFilingStatus(filingStatusForYear)

    /**
     * The filing unit every exact-cent action evidence in this year answers to,
     * or null when the projection cannot name one unambiguously.
     *
     * Derived once at year scope rather than inside the annual pass. Nothing in
     * it depends on the pass — `peopleStates` fixes each person's survival for
     * the whole year before the pass opens, the filing status follows from
     * that, and the state-filing inputs are read off the household — so
     * computing it per pass produced the same four values every time. What
     * moving it buys is that the annual liability runs can name their filing
     * unit: a counterfactual pass runs *around* the pass rather than inside it,
     * and a tax unit that only existed within one could not be the unit both
     * runs answer for.
     *
     * Null is a real answer and not a fallback. A year where three people are
     * alive under a joint status, or where a person's identity does not satisfy
     * the action layer's nonblank contract, has no unambiguous unit, and
     * inventing one would attribute a liability to a filing unit that never
     * filed.
     */
    const annualActionTaxUnit = ((): Readonly<{
      taxUnitId: string
      taxUnitEvidenceId: string
      stateFilingStatusId: string
      federalFilingStatus: 'single' | 'marriedFilingJointly' | 'qualifyingSurvivingSpouse'
      members: readonly [
        ReturnType<typeof asPersonId>,
        ...ReturnType<typeof asPersonId>[],
      ]
    }> | null => {
      let aliveTaxUnitMemberIds: ReturnType<typeof asPersonId>[]
      try {
        aliveTaxUnitMemberIds = peopleStates
          .filter((state) => state.alive)
          .map((state) => asPersonId(state.personId))
          .sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
      } catch {
        // A persisted household ID can satisfy the Plan's legacy string
        // schema without satisfying action identity's nonblank contract.
        // Omit tax-unit evidence rather than letting unrelated cash/equity
        // action execution fail with a validation exception.
        return null
      }
      const federalFilingStatus =
        filingStatusForYear === 'marriedFilingJointly' &&
          aliveTaxUnitMemberIds.length === 2
          ? 'marriedFilingJointly' as const
          : (filingStatusForYear === 'single' ||
              filingStatusForYear === 'qualifyingSurvivingSpouse') &&
            aliveTaxUnitMemberIds.length === 1
            ? filingStatusForYear
            : null
      if (federalFilingStatus === null) return null
      const members = aliveTaxUnitMemberIds as [
        ReturnType<typeof asPersonId>,
        ...ReturnType<typeof asPersonId>[],
      ]
      const annualStateFilingInputs = [
        stateForYear(plan.household, year),
        stateResidencySegmentsForYear(plan.household, year),
      ] as const
      return {
        taxUnitId: `projection-tax-unit:${JSON.stringify([
          year,
          filingStatusForYear,
          members,
        ])}`,
        taxUnitEvidenceId: `projection-tax-unit-evidence:${JSON.stringify([
          year,
          filingStatusForYear,
          members,
          annualStateFilingInputs,
        ])}`,
        stateFilingStatusId: `projection-state-filing-status:${JSON.stringify([
          year,
          filingStatusForYear,
          members,
          annualStateFilingInputs,
        ])}`,
        federalFilingStatus,
        members,
      }
    })()

    /** The same unit, in the shape the conversion funding contract names it. */
    const conversionFundingTaxUnitEvidence:
      Readonly<ConversionTaxFundingTaxUnitEvidence> | null =
      annualActionTaxUnit === null
        ? null
        : {
          taxUnitId: annualActionTaxUnit.taxUnitId,
          taxYear: year,
          federalFilingStatus: annualActionTaxUnit.federalFilingStatus,
          stateFilingStatusId: annualActionTaxUnit.stateFilingStatusId,
          taxUnitEvidenceId: annualActionTaxUnit.taxUnitEvidenceId,
          taxUnitMemberPersonIds: annualActionTaxUnit.members,
        }

    /**
     * What the year's two annual liability runs were computed from, other than
     * which requests each of them ran.
     *
     * The baseline and the candidate must agree about every one of these or
     * their difference is not the group's tax effect but the difference between
     * two unrelated calculations. They are stated as the filing unit's own
     * evidence identifiers rather than re-enumerated as figures: the tax-unit
     * evidence ID is already derived from the year, the filing status, the
     * exact member set and the state-filing inputs, so it is the compact,
     * already-canonical name for the run's non-group inputs. Both runs read the
     * same one because it is computed once, at year scope, above.
     */
    const annualLiabilityNonGroupTaxInputs:
      readonly Readonly<AnnualLiabilityRunTaxInput>[] =
      annualActionTaxUnit === null
        ? []
        : [
          {
            inputId: 'taxUnitEvidenceId',
            value: {
              representation: 'declaredTerm',
              term: annualActionTaxUnit.taxUnitEvidenceId,
            },
          },
          {
            inputId: 'federalFilingStatus',
            value: {
              representation: 'declaredTerm',
              term: annualActionTaxUnit.federalFilingStatus,
            },
          },
          {
            inputId: 'stateFilingStatusId',
            value: {
              representation: 'declaredTerm',
              term: annualActionTaxUnit.stateFilingStatusId,
            },
          },
          {
            inputId: 'taxUnitMemberPersonIds',
            value: {
              representation: 'declaredTerm',
              term: JSON.stringify(annualActionTaxUnit.members),
            },
          },
        ]

    /**
     * Both legs of every conversion-linked withdrawal group this year declares.
     *
     * This is the counterfactual's omission set, and it is read off the Plan
     * rather than off the assessment inside the pass, because the counterfactual
     * has to be launched before any pass runs. The two agree by construction:
     * the assessment reads the same conversions out of the same array.
     *
     * Both legs, not just the conversion. `T0` is the unit's liability with
     * "every conversion in this annual group and every dedicated linked
     * withdrawal omitted", and a baseline that removed the conversion while
     * leaving its funding withdrawal to draw down a taxable account would
     * measure the withdrawal's own tax as part of the group's cost.
     */
    const annualLinkedGroupOmissionIds: readonly ActionId[] = (() => {
      const ids = new Set<ActionId>()
      for (const request of plan.strategies.retirementActions) {
        if (
          request.kind !== 'rothConversion' ||
          request.year !== year ||
          request.taxFunding.kind !== 'linkedWithdrawal'
        ) continue
        ids.add(request.actionId)
        ids.add(request.taxFunding.withdrawalActionId)
      }
      return [...ids]
    })()

    // --- income ----------------------------------------------------------
    const incomes: YearIncomes = {
      wages: 0,
      socialSecurity: 0,
      pension: 0,
      annuity: 0,
      tipsLadder: 0,
      recurring: 0,
      oneTime: 0,
      taxableInterest: 0,
      ordinaryDividends: 0,
      qualifiedDividends: 0,
      taxableYield: 0,
      taxExemptInterest: 0,
      total: 0,
    }
    let ordinaryIncome = 0
    /** Subsets of income eligible for state retirement-income exclusions. */
    let privateRetirementOrdinary = 0
    let publicPensionOrdinary = 0
    let oneTimeGains = 0
    let taxableYieldReinvested = 0
    const distributedYieldByAccountId = new Map<string, { gross: number; distributedYieldPct: number; reinvest: boolean }>()
    const wagesByPerson = new Map<string, number>()

    for (const state of balances) {
      if (state.account.type !== 'taxable') continue
      const startBalance = Math.max(0, startOfYearBalance.get(state.account.id) ?? state.balance)
      if (startBalance <= 0) continue
      // An allocated brokerage account derives its yield fields from the class
      // blend at this year's weights (step 2 of the allocation plan); explicit
      // account-level fields still override the blend.
      const track = allocationTrack.get(state.account.id)
      const blendedYield = track ? blendedTaxableYield(track.weights, classParams) : null
      const interestYieldPct = Math.max(0, state.account.interestYieldPct ?? blendedYield?.interestYieldPct ?? 0)
      const dividendYieldPct = Math.max(0, state.account.dividendYieldPct ?? blendedYield?.dividendYieldPct ?? 0)
      const taxExemptYieldPct = Math.max(0, state.account.taxExemptInterestYieldPct ?? 0)
      const totalTaxableYieldPct = interestYieldPct + dividendYieldPct
      const totalDistributedYieldPct = totalTaxableYieldPct + taxExemptYieldPct
      if (totalDistributedYieldPct <= 0) continue
      const interest = startBalance * (interestYieldPct / 100)
      const dividends = startBalance * (dividendYieldPct / 100)
      const exempt = startBalance * (taxExemptYieldPct / 100)
      const qualified = dividends * Math.min(1, Math.max(0, state.account.qualifiedRatio ?? blendedYield?.qualifiedRatio ?? 0.85))
      const ordinaryDividends = dividends - qualified
      const taxableGross = interest + dividends
      const gross = taxableGross + exempt

      incomes.taxableInterest += interest
      incomes.ordinaryDividends += ordinaryDividends
      incomes.qualifiedDividends += qualified
      incomes.taxableYield += taxableGross
      incomes.taxExemptInterest += exempt
      ordinaryIncome += interest + ordinaryDividends

      const reinvest = state.account.reinvestDividends ?? true
      if (reinvest) taxableYieldReinvested += gross
      distributedYieldByAccountId.set(state.account.id, { gross, distributedYieldPct: totalDistributedYieldPct, reinvest })
    }

    // Pass 1: wages (must precede Social Security for the earnings test).
    for (const stream of plan.incomes) {
      if (stream.type !== 'wages') continue
      const person = personById.get(stream.personId)!
      const s = stateOf(stream.personId)
      const stopAge = stream.endAge ?? person.retirementAge
      if (!s.alive || (stopAge !== null && s.ageAttained >= stopAge)) continue
      const raiseFactor = Math.pow(1 + (stream.realGrowthPct ?? 0) / 100, year - startYear)
      const amount = stream.annualGross * raiseFactor * inflFactor
      incomes.wages += amount
      ordinaryIncome += amount
      wagesByPerson.set(stream.personId, (wagesByPerson.get(stream.personId) ?? 0) + amount)
    }

    // Pass 2: other non-SS streams.
    for (const stream of plan.incomes) {
      if (stream.type === 'recurring') {
        if ((stream.startYear !== null && year < stream.startYear) || (stream.endYear !== null && year > stream.endYear)) continue
        if (!anyAlive) continue
        const amount = stream.annualAmount * (stream.inflationAdjusted ? inflFactor : 1)
        incomes.recurring += amount
        if (stream.taxTreatment === 'ordinary') ordinaryIncome += amount
      } else if (stream.type === 'oneTime') {
        if (stream.year !== year) continue
        incomes.oneTime += stream.amount
        if (stream.taxTreatment === 'ordinary') ordinaryIncome += stream.amount
        if (stream.taxTreatment === 'capitalGain') oneTimeGains += stream.amount
      }
    }

    // Pass 3: Social Security. Benefits are computed for everyone (a deceased
    // spouse's hypothetical benefit drives the survivor step-up), then the
    // earnings test withholds from living workers, then survivors step up to
    // max(own, deceased's) — the v1 couples simplification of survivor rules.
    const ssColaFactor =
      plan.assumptions.ssCola.mode === 'matchInflation'
        ? inflFactorFrom(startYear, year)
        : Math.pow(1 + plan.assumptions.ssCola.annualPct / 100, year - startYear)
    const ssHaircutFactor =
      plan.assumptions.ssHaircut && year >= plan.assumptions.ssHaircut.fromYear
        ? 1 - plan.assumptions.ssHaircut.cutPct / 100
        : 1
    const ssOwnByPerson = new Map<string, number>()
    const ssActualMonthlyByPerson = new Map<string, number>()
    /** PIA + claim age per SS-claiming person, for the spousal top-up below. */
    const ssStreamByPerson = new Map<string, { pia: number; claimAge: { years: number; months: number } }>()
    /** Per-person SSDI info this year (onset age + the pre-SGA annual benefit), for SGA gating + reporting. */
    const ssdiByPerson = new Map<string, { onsetAge: number; benefit: number; fraYears: number }>()
    for (const stream of plan.incomes) {
      if (stream.type !== 'socialSecurity') continue
      const pia = resolvedPiaByStreamId.get(stream.id)
      if (pia === undefined) continue // warned during resolution
      ssStreamByPerson.set(stream.personId, { pia, claimAge: stream.claimAge })
      const person = personById.get(stream.personId)!
      const s = stateOf(stream.personId)
      const { y, m, d } = dobParts(person)
      const fra = fraForBirthYear(effectiveBirthYear(y, m, d))

      // SSDI path: a disabled worker receives their full PIA (no early-retirement
      // reduction) from the onset age, gated by SGA pre-FRA, converting to the
      // retirement benefit at FRA at the same dollar amount (no delayed credits).
      // SSDI cannot start at/after FRA (it would have already converted), so an
      // onsetAge >= FRA is treated as invalid — fall through to normal retirement.
      const onsetAge = stream.disability?.onsetAge
      if (onsetAge !== undefined && onsetAge < fra.years) {
        if (s.ageAttained >= onsetAge) {
          const monthly = ssdiMonthlyBenefit(pia)
          const annual = monthly * 12 * ssColaFactor * ssHaircutFactor
          ssOwnByPerson.set(stream.personId, (ssOwnByPerson.get(stream.personId) ?? 0) + annual)
          ssActualMonthlyByPerson.set(stream.personId, (ssActualMonthlyByPerson.get(stream.personId) ?? 0) + monthly)
          ssdiByPerson.set(stream.personId, { onsetAge, benefit: annual, fraYears: fra.years })
        }
        continue // SSDI replaces the retirement-claim path for this stream
      }

      const payableMonths = payableMonthsAtAge(s.ageAttained, stream.claimAge)
      if (payableMonths <= 0) continue
      // From FRA on, credit any months the earnings test withheld earlier by
      // treating the benefit as if claimed that many months later (capped at FRA).
      const fraMonths = fraTotalMonths(fra)
      const claimForFactor = creditedClaimAgeFor(person, stream.claimAge, s.ageAttained, fraMonths)
      const factor = claimFactor(y, m, d, claimForFactor)
      const monthly = pia * factor
      let annual = monthly * payableMonths * ssColaFactor
      annual *= ssHaircutFactor
      ssOwnByPerson.set(stream.personId, (ssOwnByPerson.get(stream.personId) ?? 0) + annual)
      ssActualMonthlyByPerson.set(stream.personId, (ssActualMonthlyByPerson.get(stream.personId) ?? 0) + monthly)
    }

    // Marital-history menu: a divorced-spousal or survivor benefit on a *former*
    // spouse's record. A person receives the larger of their own benefit and the
    // best eligible such benefit, at their claim age. Divorced-spousal needs a
    // currently-unmarried claimant; survivor is governed by remarriage rules.
    // Runs before the earnings test so that benefit is withheld too (SSA applies
    // the earnings test to dependent/survivor benefits, not just retirement).
    const householdIsSingle = people.length === 1
    for (const stream of plan.incomes) {
      if (stream.type !== 'socialSecurity') continue
      if (!stream.formerSpouses || stream.formerSpouses.length === 0) continue
      const s = stateOf(stream.personId)
      const payableMonths = payableMonthsAtAge(s.ageAttained, stream.claimAge)
      if (!s.alive || payableMonths <= 0) continue
      const claimant = personById.get(stream.personId)!
      const { y, m, d } = dobParts(claimant)
      const retirementFraMonths = fraTotalMonths(fraForBirthYear(effectiveBirthYear(y, m, d)))
      const survivorFraMonths = fraTotalMonths(survivorFraForBirthYear(effectiveBirthYear(y, m, d)))
      const best = bestMaritalBenefit(stream.formerSpouses, {
        claimantDob: { year: y, month: m, day: d },
        claimantClaimAge: creditedClaimAgeFor(claimant, stream.claimAge, s.ageAttained, retirementFraMonths),
        claimantSurvivorClaimAge: creditedClaimAgeFor(claimant, stream.claimAge, s.ageAttained, survivorFraMonths),
        claimantAge: s.ageAttained,
        year,
        claimantIsSingle: householdIsSingle,
      })
      if (best) {
        const annual = best.monthly * payableMonths * ssColaFactor * ssHaircutFactor
        if (annual > (ssOwnByPerson.get(stream.personId) ?? 0)) ssOwnByPerson.set(stream.personId, annual)
      }
    }

    // Spousal top-up: while both spouses are alive and both have claimed, the
    // lower earner receives max(own, 50% of the higher earner's PIA reduced for
    // the lower earner's claim age). Runs before the earnings test so auxiliary
    // benefits can be withheld, and caps the current-spouse auxiliary to the room
    // left under the worker's retirement/survivor family maximum.
    if (people.length === 2) {
      const [a, b] = people
      const aSs = ssStreamByPerson.get(a!.id)
      const bSs = ssStreamByPerson.get(b!.id)
      if (aSs && bSs) {
        const higher = aSs.pia >= bSs.pia ? { p: a!, ss: aSs } : { p: b!, ss: bSs }
        const lower = aSs.pia >= bSs.pia ? { p: b!, ss: bSs } : { p: a!, ss: aSs }
        const lowerState = stateOf(lower.p.id)
        const higherState = stateOf(higher.p.id)
        const lowerPayableMonths = payableMonthsAtAge(lowerState.ageAttained, lower.ss.claimAge)
        const higherPayableMonths = payableMonthsAtAge(higherState.ageAttained, higher.ss.claimAge)
        const spousalPayableMonths = Math.min(lowerPayableMonths, higherPayableMonths)
        if (lowerState.alive && higherState.alive && spousalPayableMonths > 0) {
          const { y, m, d } = dobParts(lower.p)
          const lowerFraMonths = fraTotalMonths(fraForBirthYear(effectiveBirthYear(y, m, d)))
          const spousalClaimAge = creditedClaimAgeFor(lower.p, lower.ss.claimAge, lowerState.ageAttained, lowerFraMonths)
          const rawSpousalMonthly = 0.5 * higher.ss.pia * spousalBenefitFactor(y, m, d, spousalClaimAge)

          const higherDob = dobParts(higher.p)
          const workerActualMonthly =
            ssActualMonthlyByPerson.get(higher.p.id) ??
            higher.ss.pia *
              claimFactor(
                higherDob.y,
                higherDob.m,
                higherDob.d,
                creditedClaimAgeFor(
                  higher.p,
                  higher.ss.claimAge,
                  higherState.ageAttained,
                  fraTotalMonths(fraForBirthYear(effectiveBirthYear(higherDob.y, higherDob.m, higherDob.d))),
                ),
              )
          // Only the auxiliary excess (spousal rate above the lower earner's own
          // benefit) is paid on the higher earner's record, so only that excess is
          // subject to the worker's family maximum. The lower earner's own benefit
          // is on their own record and is preserved, then the capped excess is added.
          const lowerOwnMonthly = ssActualMonthlyByPerson.get(lower.p.id) ?? 0
          const excessSpousalMonthly = Math.max(0, rawSpousalMonthly - lowerOwnMonthly)
          const cappedExcessMonthly = capAuxiliaryForFamilyMaximum({
            workerPiaMonthly: higher.ss.pia,
            workerActualMonthly,
            workerDob: { year: higherDob.y, month: higherDob.m, day: higherDob.d },
            auxiliaryMonthly: excessSpousalMonthly,
          })
          const spousalTotalMonthly = lowerOwnMonthly + cappedExcessMonthly
          const spousalAnnual = spousalTotalMonthly * spousalPayableMonths * ssColaFactor * ssHaircutFactor
          const own = ssOwnByPerson.get(lower.p.id) ?? 0
          if (spousalAnnual > own) ssOwnByPerson.set(lower.p.id, spousalAnnual)
        }
      }
    }

    // Survivor step-up before the earnings test, then the withholding pass below
    // can reduce survivor benefits for a working survivor before FRA. The
    // survivor keeps the larger of their own benefit and the deceased's benefit,
    // computed with full precision: the survivor base is the deceased's actual
    // monthly benefit, RIB-LIM floors it at 82.5% of the deceased's PIA when the
    // deceased claimed early, and the early-claim widow(er) reduction applies to
    // the survivor's credited claim age.
    if (people.length === 2) {
      const [a, b] = people
      for (const [deceased, survivor] of [
        [a!, b!],
        [b!, a!],
      ] as const) {
        const survivorState = stateOf(survivor.id)
        if (stateOf(deceased.id).alive || !survivorState.alive) continue
        const survivorStream = ssStreamByPerson.get(survivor.id)
        const deceasedPia = ssStreamByPerson.get(deceased.id)?.pia
        const deceasedActualMonthly = ssActualMonthlyByPerson.get(deceased.id) ?? 0
        if (!survivorStream || deceasedPia === undefined || deceasedActualMonthly <= 0) continue
        const payableMonths = payableMonthsAtAge(survivorState.ageAttained, survivorStream.claimAge)
        if (payableMonths <= 0) continue
        const ownBenefit = ssOwnByPerson.get(survivor.id) ?? 0
        const { y, m, d } = dobParts(survivor)
        const survivorFraMonths = fraTotalMonths(survivorFraForBirthYear(effectiveBirthYear(y, m, d)))
        const survivorClaimAge = creditedClaimAgeFor(survivor, survivorStream.claimAge, survivorState.ageAttained, survivorFraMonths)
        const survivorAnnual =
          survivorBenefitMonthly({
            deceasedPiaMonthly: deceasedPia,
            deceasedActualMonthly,
            survivorClaimAge,
            survivorFraMonths,
          }) *
          payableMonths *
          ssColaFactor *
          ssHaircutFactor
        if (survivorAnnual > ownBenefit) ssOwnByPerson.set(survivor.id, survivorAnnual)
      }
    }

    // Earnings test: claiming before FRA while working withholds benefits
    // ($1 per $2 below FRA; $1 per $3 in the FRA calendar year — annual
    // approximation). Withheld whole months accumulate and are credited back at
    // FRA above (the benefit is recomputed as if claimed that many months later).
    // SSDI recipients are gated by Substantial Gainful Activity instead (SSA
    // replaces the retirement earnings test with SGA for disabled workers).
    let ssEarningsTestWithheld = 0
    let ssdiPaid = 0
    for (const [personId, benefit] of ssOwnByPerson) {
      const s = stateOf(personId)
      if (!s.alive || benefit <= 0) continue
      const ssdi = ssdiByPerson.get(personId)
      if (ssdi) {
        // SSDI recipient: SGA gates the pre-FRA window only (post-FRA it has
        // converted to retirement; before onset no benefit is paid). No ARF.
        let paid = benefit
        if (inSsdiWindow(s.ageAttained, ssdi.onsetAge, ssdi.fraYears)) {
          const wages = wagesByPerson.get(personId) ?? 0
          const annualSga = pack.socialSecurity.sgaMonthlyNonBlind * 12 * limitGrowth
          if (wages > 0 && ssdiSuspendedBySga(wages, annualSga)) {
            paid = 0
            ssOwnByPerson.set(personId, 0)
            warnings.add(
              'Earnings above Substantial Gainful Activity (SGA) suspended Social Security disability (SSDI) for a working year.',
            )
          }
        }
        ssdiPaid += paid
        continue // no retirement earnings test for SSDI recipients
      }
      const wages = wagesByPerson.get(personId) ?? 0
      if (wages <= 0) continue
      const person = personById.get(personId)!
      const { y, m, d } = dobParts(person)
      const fraYears = fraForBirthYear(effectiveBirthYear(y, m, d)).years
      let withheld = 0
      if (s.ageAttained < fraYears) {
        withheld = Math.max(0, (wages - pack.socialSecurity.earningsTestBelowFraAnnual * limitGrowth) / 2)
      } else if (s.ageAttained === fraYears) {
        withheld = Math.max(0, (wages - pack.socialSecurity.earningsTestFraYearAnnual * limitGrowth) / 3)
      }
      withheld = Math.min(withheld, benefit)
      if (withheld > 0) {
        ssOwnByPerson.set(personId, benefit - withheld)
        ssEarningsTestWithheld += withheld
        // Whole months of benefit withheld this year (annual approximation),
        // credited back at FRA. COLA cancels in the ratio. Capped at the months
        // actually payable this year — the first claim year is prorated when the
        // claim starts mid-year, so it has fewer than 12 payable months.
        const claimAge = ssStreamByPerson.get(personId)?.claimAge
        const payableMonths = claimAge ? payableMonthsAtAge(s.ageAttained, claimAge) : 12
        const monthsWithheld = Math.min(payableMonths, Math.round((withheld / benefit) * payableMonths))
        withheldMonthsByPerson.set(personId, (withheldMonthsByPerson.get(personId) ?? 0) + monthsWithheld)
        warnings.add(
          'The earnings test withheld benefits for working early claimants; withheld months are credited back at full retirement age (annual approximation).',
        )
      }
    }

    // Sum the living household's post-withholding Social Security benefits.
    for (const [personId, benefit] of ssOwnByPerson) {
      if (stateOf(personId).alive) incomes.socialSecurity += benefit
    }

    for (const account of plan.accounts) {
      if (account.type === 'pension' || account.type === 'annuity') {
        // A commuted pension (lump-sum election) stops paying once the
        // election takes effect — the offer amount rolls over in the election
        // year instead. A pension already in pay before a later election year
        // keeps its normal payments until then.
        if (
          account.type === 'pension' &&
          account.lumpSumElection &&
          account.lumpSumOffer &&
          year >= account.lumpSumOffer.electionYear
        ) {
          continue
        }
        const ownerId = account.ownerPersonId ?? primary.id
        const owner = personById.get(ownerId)!
        const ownerState = stateOf(ownerId)
        const startCalendarYear = dobYear(owner) + account.startAge
        if (year < startCalendarYear) continue
        // A purchased annuity cannot pay before its premium is funded — the
        // contract begins in the purchase year. Guard against a startAge that
        // would otherwise pay (and cache an investment=0 exclusion state that
        // stays fully taxable) in years before the premium is withdrawn.
        if (account.type === 'annuity' && account.purchase && year < account.purchase.year) continue
        const yearsSinceStart = year - startCalendarYear
        const grown = account.monthlyAmount * 12 * Math.pow(1 + account.colaPct / 100, yearsSinceStart)
        if (account.type === 'annuity') {
          // Payout form (life-only / period-certain / joint & survivor) sets
          // how much of the full payment is paid this year; life-only (the
          // default) pays only while the owner is alive, exactly as before.
          const otherState = peopleStates.find((s) => s.personId !== ownerId)
          const paidFraction = annuityPayoutFraction(annuityPayoutForm(account), {
            ownerAlive: ownerState.alive,
            otherAlive: otherState?.alive ?? false,
            anyAlive,
            yearsSinceStart,
          })
          if (paidFraction <= 0) continue
          const paid = grown * paidFraction
          incomes.annuity += paid
          // Taxable portion of the payment:
          //  - qualified purchase  → fully ordinary (pre-tax dollars funded it);
          //  - non-qualified purchase → IRS Pub 939 exclusion ratio, so a fixed
          //    share of each payment is a tax-free return of the premium until
          //    the whole investment has been recovered, then fully taxable
          //    (the ratio reflects the payout form; a survivor/beneficiary
          //    continues the same excludable share);
          //  - no purchase (already-owned stream) → the entered taxablePct.
          let annuityTaxable: number
          if (account.purchase?.taxQualification === 'qualified') {
            // FULLY ORDINARY IS THE GROSS, NOT THE ANSWER. Section 408(d)(2)(B)
            // treats all distributions during a taxable year as one
            // distribution, and Publication 590-B says in terms that where the
            // traditional IRAs hold both deductible and nondeductible
            // contributions "the annuity payments are taxed as explained
            // earlier under Distributions Fully or Partly Taxable" -- so this
            // payment takes the same share of basis as everything else the
            // aggregate pays out this year. It cannot take it here: the year's
            // fraction is not known until the December 31 pool and the year's
            // other distributions are, both of which are decided in the annual
            // pass below. So the whole payment enters income here and the
            // settled basis share is subtracted there, exactly as a required
            // distribution's is.
            //
            // A CONTRACT WITH NO CHANNEL keeps the whole amount, and the only
            // contract without one is a contract this pool never bought: a
            // non-qualified purchase, or a purchase from something that is not
            // an owned non-inherited IRA. A CROSS-OWNER purchase is not on that
            // list and never was -- the aggregate a contract belongs to is read
            // off the funding account, so a contract naming the other spouse
            // has a channel, an occurrence, and a settled character like any
            // other. The two owners it carries are `ownerId` here, who receives
            // the payment and whose age started it, and `poolOwnerPersonId`
            // below, whose Form 8606 the gross lands on; the character is
            // looked up under the second, because the settlement publishes it
            // under the owner whose aggregate allocated the basis.
            annuityTaxable = paid
            const contractValueBefore = annuityContractValue.get(account.id)
            const poolOwnerPersonId = annuityContractPoolOwner.get(account.id)
            if (contractValueBefore !== undefined &&
                poolOwnerPersonId !== undefined && paid > 0) {
              const kind = 'annuityContractDistribution' as const
              const producerOccurrenceKey = runtimeOccurrenceKey(kind, account.id)
              recordAnnualRetirementRuntimeOccurrence({
                producerOccurrenceKey,
                kind,
                grossAmountPlanDollars: paid,
                ownerPersonId: ownerId,
                sourceAccountId: account.id,
                executionDate: null,
                executionSequence: null,
                movementAuthorityId: null,
              })
              // The channel is floored at zero, so a contract that has paid out
              // more than its premium debits only what it still carries while
              // the whole payment stays on line 7. The two figures answer
              // different questions: line 7 is what the return reports, and the
              // channel is what line 6 still holds.
              const applied = Math.min(paid, contractValueBefore)
              const contractValueAfter = contractValueBefore - applied
              annuityContractValue.set(account.id, contractValueAfter)
              const recorded = recordAnnualRetirementRuntimeApplication({
                applicationKind: 'debit',
                producerOccurrenceKey,
                simulatorPhase: 'annuityContractDistribution',
                ownerPersonId: ownerId,
                sourceAccountId: account.id,
                sourceBalanceBeforePlanDollars: contractValueBefore,
                appliedAmountPlanDollars: applied,
                sourceBalanceAfterPlanDollars: contractValueAfter,
              })
              annuityContractDistributions.push({
                producerOccurrenceKey,
                annuityAccountId: account.id,
                poolOwnerPersonId,
                grossAmountPlanDollars: paid,
                mutationOrdinal: recorded.mutationOrdinal,
              })
            }
          } else if (account.purchase) {
            let ex = annuityExclusionState.get(account.id)
            if (!ex) {
              const investment = annuityInvestmentInContract.get(account.id) ?? 0
              const jointAnnuitant = plan.household.people.find((p) => p.id !== ownerId)
              // Expected return = full annual payment × the form's multiple
              // (the multiple already weights any reduced survivor share).
              const expectedReturn = grown * annuityExclusionMultiple(pack, account, owner, jointAnnuitant)
              const ratio = expectedReturn > 0 ? Math.min(1, investment / expectedReturn) : 0
              ex = { ratio, remaining: investment }
              annuityExclusionState.set(account.id, ex)
            }
            const excludable = Math.min(paid * ex.ratio, ex.remaining)
            ex.remaining -= excludable
            annuityTaxable = paid - excludable
          } else {
            annuityTaxable = paid * (account.taxablePct / 100)
          }
          ordinaryIncome += annuityTaxable
          privateRetirementOrdinary += annuityTaxable
        } else {
          const survivor = peopleStates.find((s) => s.personId !== ownerId && s.alive)
          // Survivor benefit requires payments to have started before the owner died.
          const ownerStartedBeforeDeath = lifeAgeOf(owner) >= account.startAge
          if (ownerState.alive) {
            incomes.pension += grown
            ordinaryIncome += grown
            if ((account.source ?? 'private') === 'public') publicPensionOrdinary += grown
            else privateRetirementOrdinary += grown
          } else if (survivor && ownerStartedBeforeDeath) {
            const amount = grown * (account.survivorPct / 100)
            incomes.pension += amount
            ordinaryIncome += amount
            if ((account.source ?? 'private') === 'public') publicPensionOrdinary += amount
            else privateRetirementOrdinary += amount
          }
        }
      }
    }
    // --- TIPS-ladder cash flows ---------------------------------------------
    // Coupons + maturing principal are cash income; the taxable amount is the
    // coupons plus this year's inflation accretion on the outstanding face
    // (the phantom-income OID a taxable TIPS holder reports) — maturing
    // principal itself is a tax-free return of already-taxed dollars. Federal
    // ordinary income (incl. NIIT); state-exempt as U.S. government interest.
    let ladderTaxableInterest = 0
    let ladderValueTotal = 0
    for (const ls of ladderStates) {
      const offset = year - ls.anchorYear
      if (offset < 1) {
        // Purchase year (offset 0): the rungs are owned — no flows yet, but
        // their full face rides in net worth so the transfer is value-neutral.
        if (ls.purchase && year >= ls.purchase.year) {
          ladderValueTotal += ladderRemainingFace(ls.rungs, 0) * ls.scale * inflFactor
        }
        continue
      }
      if (anyAlive) {
        const flows = ladderRealFlowsAtOffset(ls.rungs, offset)
        const cash = (flows.coupons + flows.maturingPrincipal) * ls.scale * inflFactor
        const prevInflFactor = inflFactorFrom(startYear, year - 1)
        const accretion = flows.outstandingFace * ls.scale * Math.max(0, inflFactor - prevInflFactor)
        const taxable = flows.coupons * ls.scale * inflFactor + accretion
        incomes.tipsLadder += cash
        ordinaryIncome += taxable
        ladderTaxableInterest += taxable
        ladderValueTotal += ladderRemainingFace(ls.rungs, offset) * ls.scale * inflFactor
      } else {
        // No one alive: rungs stop maturing — freeze the remaining face as of
        // the last living year (the rung maturing that year already paid cash)
        // so unmatured principal rides in the estate at its inflation-indexed
        // book value instead of shrinking as offset-space maturities pass.
        const lastAliveOffset = Math.max(0, ladderLastAliveYear - ls.anchorYear)
        ladderValueTotal += ladderRemainingFace(ls.rungs, lastAliveOffset) * ls.scale * inflFactor
      }
    }

    incomes.total =
      incomes.wages +
      incomes.socialSecurity +
      incomes.pension +
      incomes.annuity +
      incomes.tipsLadder +
      incomes.recurring +
      incomes.oneTime +
      incomes.taxableYield +
      incomes.taxExemptInterest

    // --- expenses ---------------------------------------------------------
    const primaryAge = stateOf(primary.id).ageAttained
    let phaseMultiplier = 1
    for (const phase of [...plan.expenses.phases].sort((a, b) => a.fromAge - b.fromAge)) {
      if (primaryAge >= phase.fromAge) phaseMultiplier = phase.multiplier
    }
    // Survivor years (exactly one member of a multi-person household alive)
    // scale base + phase spending by the plan's survivor percentage. One-time
    // goals and the separately-modeled healthcare/debt/property costs are not
    // scaled — they carry their own person- or account-level lifecycles.
    const survivorSpendingFactor =
      peopleStates.length > 1 && aliveCount === 1 ? (plan.expenses.survivorSpendingPct ?? 100) / 100 : 1
    // Split the annual lifestyle target into required, target, ideal, and excess
    // layers. Absent optional fields keep older plans on the exact old shape:
    // baseAnnual is the target lifestyle, with no annual upside layers.
    const lifestyleScale = anyAlive ? inflFactor * phaseMultiplier * survivorSpendingFactor : 0
    let scaledTargetLifestyle = plan.expenses.baseAnnual * lifestyleScale
    const requiredAnnualToday = Math.min(
      plan.expenses.requiredAnnual ?? plan.expenses.baseAnnual,
      plan.expenses.baseAnnual,
    )
    let requiredLifestyleNominal = requiredAnnualToday * lifestyleScale
    let idealLifestyleNominal = (plan.expenses.idealAnnual ?? 0) * lifestyleScale
    let excessLifestyleNominal = (plan.expenses.excessAnnual ?? 0) * lifestyleScale
    if (abwActive) {
      // ABW replaces the whole recurring lifestyle stack: baseAnnual, phases,
      // survivor scaling, and the required/ideal/excess layers are ignored and
      // the target is the amortized payment from the actual start-of-year
      // portfolio (nominal — the payment ratio is inflation-invariant, see
      // engine/spending/abw.ts). Healthcare, debt, property, insurance, and
      // one-time goals stay separately modeled on top.
      let startPortfolio = 0
      for (const b of balances) startPortfolio += startOfYearBalance.get(b.account.id) ?? 0
      scaledTargetLifestyle = anyAlive
        ? abwAnnualPayment(startPortfolio, abwRealReturnPct, abwTiltPct, abwHorizonYear - year + 1)
        : 0
      requiredLifestyleNominal = 0
      idealLifestyleNominal = 0
      excessLifestyleNominal = 0
    }
    const {
      requiredLifestyle,
      targetLifestyle,
      idealLifestyle,
      excessLifestyle,
    } = splitAnnualSpendingLayers({
      baseAnnualNominal: scaledTargetLifestyle,
      requiredAnnualNominal: requiredLifestyleNominal,
      idealAnnualNominal: idealLifestyleNominal,
      excessAnnualNominal: excessLifestyleNominal,
    })
    let debtService = 0
    for (const account of plan.accounts) {
      if (account.type !== 'debt') continue
      let bal = debtBalances.get(account.id) ?? 0
      if (bal <= 0) continue
      bal *= 1 + account.interestPct / 100
      // A scheduled payoff year clears the whole remaining balance at once
      // (funded by the withdrawal waterfall below); otherwise pay the level
      // annual amount, capped at the balance so the loan self-terminates.
      const payoff = typeof account.payoffYear === 'number' && year >= account.payoffYear
      const payment = payoff ? bal : Math.min(bal, account.monthlyPayment * 12)
      bal -= payment
      debtBalances.set(account.id, bal)
      debtService += payment
    }
    // Healthcare: ACA-credited marketplace pre-65, Medicare + IRMAA from 65.
    // Medicare eligibility begins in the birth month of the year a member
    // turns 65 (planning-grade: the born-on-the-1st prior-month rule is not
    // modeled), so the transition year splits into birthMonth − 1 months of
    // marketplace coverage and the remainder on Medicare instead of flipping
    // the whole year at once.
    const hc = plan.expenses.healthcare
    const healthInflFactor = healthInflFactorFrom(startYear, year)
    let healthcare = 0
    // The ACA credit is a household calculation and a MONTHLY one: covered
    // members' premiums pool per calendar month, and each covered month earns
    // max(0, premium − expectedContribution/12) — so a transition-year member
    // covered five months owes 5/12 of the household expected contribution,
    // not all of it, and the contribution is never subtracted per person.
    const legacyAcaMonthlyPremiums: number[] = new Array<number>(12).fill(0)
    const acaEnrollmentPremiums: number[] = new Array<number>(12).fill(0)
    const acaSlcspBenchmarkPremiums: number[] = new Array<number>(12).fill(0)
    let legacyMarketplacePremiumPaidDirectly = 0
    const acaContractsForYear = hc.acaYears?.filter((contract) => contract.year === year) ?? []
    const acaContract = acaContractsForYear.length === 1 ? acaContractsForYear[0] : undefined
    // SSA-44 (see setup above): in the two years after a qualifying event, the
    // premium MAGI is the lower of the lookback and the prior-year stand-in.
    const irmaaMagi = ssa44ActiveInYear(year)
      ? Math.min(magiFor(year - 2), magiFor(year - 1))
      : magiFor(year - 2)
    // IRMAA's filing categories differ from the income-tax tables: SSA groups
    // qualifying-surviving-spouse filers with single/HOH on the individual
    // threshold table (POMS HI 01101.020), so QSS years price premiums at the
    // single thresholds even though their income tax uses the joint tables.
    const irmaaFilingStatus = filingStatusForYear === 'qualifyingSurvivingSpouse' ? 'single' : taxFilingStatusForYear
    let medicarePremiums = 0
    let irmaaSurcharge = 0
    let irmaaTier = 0
    const marketplaceMonthsBeforeMedicare = (person: PersonYearState): number =>
      !person.alive
        ? 0
        : person.ageAttained < 65
          ? 12
          : person.ageAttained === 65
            ? (birthMonthByPerson.get(person.personId) ?? 1) - 1
            : 0
    for (const s of peopleStates) {
      if (!s.alive) continue
      const acaMonths = marketplaceMonthsBeforeMedicare(s)
      const medicareMonths = 12 - acaMonths
      if (acaMonths > 0 && hc.pre65MonthlyPremiumPerPerson > 0) {
        if (hc.applyAcaCredit) {
          for (let m = 0; m < acaMonths; m++) {
            legacyAcaMonthlyPremiums[m]! += hc.pre65MonthlyPremiumPerPerson * healthInflFactor
          }
        } else {
          if (!hc.applyAcaCredit) {
            const premium = hc.pre65MonthlyPremiumPerPerson * acaMonths * healthInflFactor
            healthcare += premium
            legacyMarketplacePremiumPaidDirectly += premium
          }
        }
      }
      if (medicareMonths > 0) {
        const med = medicareAnnualPremiumPerPerson(
          pack,
          irmaaMagi,
          irmaaFilingStatus,
          // The premium year goes with the inflation path rather than a single
          // pre-multiplied factor: the top IRMAA row is frozen through 2027 and
          // then indexed from an August 2026 base, one year behind the rows
          // beneath it, so the threshold helper has to pick its own year.
          {
            premiumYear: year,
            inflationFactorToYear: (toYear: number) => inflFactorFrom(pack.year, toYear),
          },
          healthInflFactorFrom(pack.year, year),
        )
        if (med.partDSurchargeUnverified) {
          warnings.add('An IRMAA tier with an unverified Part D surcharge was hit; Part D surcharge omitted for that tier.')
        }
        const premium = (med.partBAnnual + med.partDSurchargeAnnual) * (medicareMonths / 12)
        medicarePremiums += premium
        irmaaSurcharge += med.irmaaSurchargeAnnual * (medicareMonths / 12)
        irmaaTier = med.irmaaTier
        healthcare += premium + hc.medicareExtrasMonthlyPerPerson * medicareMonths * healthInflFactor
      }
    }
    const exampleContractInputMismatch =
      plan.exampleSourceId !== undefined &&
      acaContract !== undefined &&
      (() => {
        const exampleResidenceState = stateForYear(plan.household, year)
        const expectedRegion =
          exampleResidenceState === 'AK' ? 'alaska' : exampleResidenceState === 'HI' ? 'hawaii' : 'contiguous'
        const expectedMonthlyPremium = hc.pre65MonthlyPremiumPerPerson * healthInflFactor
        return (
          acaContract.fplRegion !== expectedRegion ||
          acaContract.coveredMembers.some((member) => {
            const person = peopleStates.find((state) => state.personId === member.personId)
            const expectedMonths = person === undefined ? 0 : marketplaceMonthsBeforeMedicare(person)
            return member.enrollmentPremiumByMonth.some((premium, month) => {
              const expected = month < expectedMonths ? expectedMonthlyPremium : 0
              return Math.abs(premium - expected) > EPSILON
            })
          })
        )
      })()
    if (hc.applyAcaCredit && acaContract && !exampleContractInputMismatch) {
      for (const member of acaContract.coveredMembers) {
        for (let month = 0; month < 12; month++) {
          const enrollmentPremium = member.enrollmentPremiumByMonth[month] ?? 0
          acaEnrollmentPremiums[month]! += enrollmentPremium
          if (enrollmentPremium > 0) {
            acaSlcspBenchmarkPremiums[month]! += member.slcspBenchmarkPremiumByMonth[month] ?? 0
          }
        }
      }
    } else if (hc.applyAcaCredit && acaContractsForYear.length > 1) {
      // Duplicate contracts are not reconcilable evidence, but their known
      // enrollment premiums must not disappear. Fund the largest monthly
      // aggregate across the conflicting contracts (never a hidden zero and
      // never double-counting an accidental duplicate).
      for (let month = 0; month < 12; month++) {
        acaEnrollmentPremiums[month] = Math.max(
          ...acaContractsForYear.map((contract) =>
            contract.coveredMembers.reduce(
              (sum, member) => sum + (member.enrollmentPremiumByMonth[month] ?? 0),
              0,
            ),
          ),
        )
      }
    } else if (hc.applyAcaCredit) {
      for (let month = 0; month < 12; month++) {
        acaEnrollmentPremiums[month] = legacyAcaMonthlyPremiums[month]!
        acaSlcspBenchmarkPremiums[month] = legacyAcaMonthlyPremiums[month]!
      }
    }
    const acaGrossEnrollmentPremium = acaEnrollmentPremiums.reduce((sum, premium) => sum + premium, 0)
    const acaActive = hc.applyAcaCredit && acaGrossEnrollmentPremium > 0
    // Begin conservatively at gross premium. A supported current-year result
    // can reduce this only inside the exact tax/withdrawal fixed point below.
    healthcare += acaGrossEnrollmentPremium
    const healthcareExcludingAcaEnrollment = healthcare - acaGrossEnrollmentPremium
    const healthcareExcludingMarketplacePremium =
      healthcareExcludingAcaEnrollment - legacyMarketplacePremiumPaidDirectly
    const acaInitialSupportCodes: AcaSupportCode[] = []
    if (acaActive) {
      if (isStandIn) acaInitialSupportCodes.push('tax-year-parameters-unsupported')
      if (spendingPolicy !== undefined && spendingPolicy.mode !== 'fixedTarget') {
        acaInitialSupportCodes.push('guardrail-interaction-unsupported')
      }
      if (acaContractsForYear.length === 0) acaInitialSupportCodes.push('missing-year-contract')
      if (acaContractsForYear.length > 1) acaInitialSupportCodes.push('duplicate-year-contract')
      if (acaContract) {
        const taxFamilyIds = new Set(acaContract.taxFamilyMembers.map((member) => member.personId))
        const coveredIds = new Set(acaContract.coveredMembers.map((member) => member.personId))
        const primaryCount = acaContract.taxFamilyMembers.filter(
          (member) => member.relationship === 'primary',
        ).length
        const spouseCount = acaContract.taxFamilyMembers.filter(
          (member) => member.relationship === 'spouse',
        ).length
        const expectedSpouseCount = filingStatusForYear === 'marriedFilingJointly' ? 1 : 0
        const omitsLivingModeledPerson = peopleStates.some(
          (person) => person.alive && !taxFamilyIds.has(person.personId),
        )
        if (
          primaryCount !== 1 ||
          spouseCount !== expectedSpouseCount ||
          omitsLivingModeledPerson ||
          (
            filingStatusForYear === 'qualifyingSurvivingSpouse' &&
            !acaContract.taxFamilyMembers.some((member) => member.relationship === 'dependent')
          ) ||
          taxFamilyIds.size !== acaContract.taxFamilyMembers.length
        ) {
          acaInitialSupportCodes.push('tax-family-structure-unsupported')
        }
        if (coveredIds.size !== acaContract.coveredMembers.length) {
          acaInitialSupportCodes.push('covered-member-duplicate')
        }
        if (
          acaContract.coveredMembers.some((member) => {
            const person = peopleStates.find((state) => state.personId === member.personId)
            if (person === undefined || !person.alive) return false
            const marketplaceMonths = marketplaceMonthsBeforeMedicare(person)
            return member.enrollmentPremiumByMonth.some(
              (premium, month) => premium > 0 && month >= marketplaceMonths,
            )
          })
        ) {
          acaInitialSupportCodes.push('medicare-overlap-unsupported')
        }
        if (
          acaContract.taxFamilyMembers.some(
            (member) =>
              member.relationship !== 'dependent' &&
              (
                !personById.has(member.personId) ||
                !stateOf(member.personId).alive ||
                member.requiredToFile === 'unknown'
              ),
          )
          || acaContract.coveredMembers.some((member) => !taxFamilyIds.has(member.personId))
        ) {
          acaInitialSupportCodes.push('tax-family-member-unknown')
        }
        if (
          acaContract.taxFamilyMembers.some(
            (member) =>
              member.relationship === 'dependent' &&
              member.requiredToFile === 'unknown',
          )
        ) {
          acaInitialSupportCodes.push('dependent-filing-status-unknown')
        }
        if (
          acaContract.taxFamilyMembers.some(
            (member) =>
              member.relationship === 'dependent' &&
              personById.has(member.personId),
          )
        ) {
          acaInitialSupportCodes.push('dependent-modeled-person-overlap')
        }
        if (
          acaContract.taxExemptInterest.state === 'unknown' &&
          !(planHasTaxExemptYieldAttestation && incomes.taxExemptInterest > 0)
        ) {
          acaInitialSupportCodes.push('tax-exempt-interest-unknown')
        }
        if (acaContract.foreignExclusionAddback.state === 'unknown') {
          acaInitialSupportCodes.push('foreign-exclusion-addback-unknown')
        }
        if (
          acaContract.coveredMembers.some((member) =>
            member.enrollmentPremiumByMonth.some(
              (premium, month) =>
                premium > 0 && (member.slcspBenchmarkPremiumByMonth[month] ?? 0) <= 0,
            ),
          )
        ) {
          acaInitialSupportCodes.push('slcsp-benchmark-missing')
        }
        if (
          acaContract.coveredMembers.some((member) =>
            member.slcspBenchmarkPremiumByMonth.some(
              (benchmark, month) =>
                benchmark > 0 && (member.enrollmentPremiumByMonth[month] ?? 0) <= 0,
            ),
          )
        ) {
          acaInitialSupportCodes.push('benchmark-only-coverage-unsupported')
        }
        if (exampleContractInputMismatch) acaInitialSupportCodes.push('example-contract-input-mismatch')
        if (acaContract.assertions.coverageEligibility !== 'supported') {
          acaInitialSupportCodes.push('coverage-eligibility-unsupported')
        }
        if (acaContract.assertions.form8814 !== 'notApplicable') acaInitialSupportCodes.push('form-8814-unsupported')
        if (acaContract.assertions.specialAllocation !== 'notApplicable') {
          acaInitialSupportCodes.push('special-allocation-unsupported')
        }
        if (acaContract.assertions.marriedFilingSeparatelyException !== 'notApplicable') {
          acaInitialSupportCodes.push('mfs-exception-unsupported')
        }
        if (acaContract.assertions.selfEmployedHealthInsuranceDeduction !== 'notApplicable') {
          acaInitialSupportCodes.push('self-employed-deduction-unsupported')
        }
        if (acaContract.assertions.otherMaterialFacts !== 'none') {
          acaInitialSupportCodes.push('other-material-facts-unsupported')
        }
      }
    }

    // Insurance premiums: level (fixed nominal), charged while the insured/owner
    // is alive. paidUp charges nothing; untilAge stops at premiumEndAge.
    let insurancePremiums = 0
    for (const policy of plan.insurance) {
      if (policy.premiumMode === 'paidUp') continue
      const subjectId = policy.kind === 'ltc' ? policy.owner : policy.insured
      const s = stateOf(subjectId)
      if (!s.alive) continue
      if (policy.premiumMode === 'untilAge' && policy.premiumEndAge !== undefined && s.ageAttained >= policy.premiumEndAge) {
        continue
      }
      insurancePremiums += policy.annualPremium
    }

    // LTC care episodes: a deterministic late-life cost spike, additive to
    // baseline spending. An owned LTC policy offsets it up to its monthly cap
    // (grown by the inflation rider) after the elimination period, for at most
    // benefitPeriodYears. The net (careCost − ltcBenefit) is what hits spending.
    let careCost = 0
    let ltcBenefit = 0
    for (const event of plan.careEvents) {
      const s = stateOf(event.personId)
      if (!s.alive) continue
      const yearsIntoEpisode = s.ageAttained - event.startAge
      if (yearsIntoEpisode < 0 || yearsIntoEpisode >= event.durationYears) continue
      const gross = event.annualCost * healthInflFactor
      careCost += gross
      let remaining = gross
      for (const policy of plan.insurance) {
        if (policy.kind !== 'ltc' || policy.owner !== event.personId || remaining <= 0) continue
        const used = ltcBenefitYearsUsed.get(policy.id) ?? 0
        if (policy.benefitPeriodYears !== 'lifetime' && used >= policy.benefitPeriodYears) continue
        const rider = (policy.inflationRiderPct ?? 0) / 100
        let cap = policy.benefitMonthly * 12 * Math.pow(1 + rider, year - startYear)
        // Elimination period: the first eliminationPeriodDays of the episode are
        // out of pocket, so the episode's first year is prorated.
        if (yearsIntoEpisode === 0) cap *= Math.max(0, 1 - policy.eliminationPeriodDays / 365)
        const pay = Math.min(remaining, cap)
        if (pay > 0) {
          ltcBenefit += pay
          remaining -= pay
          ltcBenefitYearsUsed.set(policy.id, used + 1)
        }
      }
    }

    // Property carrying costs: tax + insurance charged while the property is
    // owned, continuing after any mortgage is paid off — the part of a PITI
    // payment the debt account deliberately excludes. Today's dollars, inflated;
    // skipped from the sale year on, and (like base spending) once nobody is alive.
    let propertyCosts = 0
    if (anyAlive) {
      for (const account of plan.accounts) {
        if (account.type !== 'property') continue
        if (account.plannedSaleYear !== null && year >= account.plannedSaleYear) continue
        propertyCosts += ((account.propertyTaxAnnual ?? 0) + (account.insuranceAnnual ?? 0)) * inflFactor
      }
    }

    // System-computed costs are required by default: a plan must never report
    // "floor success" after silently cutting healthcare, housing, debt, or care.
    const netCare = careCost - ltcBenefit // ltcBenefit is capped at careCost above
    const systemRequired = debtService + propertyCosts + healthcare + insurancePremiums + netCare

    // HSA qualified-withdrawal cap (steps 2–3): the household's modeled medical
    // costs this year (healthcare premiums + net care costs), plus the
    // accumulated reimburse-later pool when any HSA opts in. Cap-mode HSA
    // withdrawals are tax- and penalty-free only up to this.
    // Ordinary Marketplace premiums are not HSA-qualified medical expenses
    // under Pub. 969's general rule. (The narrow COBRA, unemployment, Medicare,
    // and qualified-LTC exceptions are not represented by an ACA contract.)
    let qualifiedMedicalThisYear = healthcareExcludingMarketplacePremium + netCare
    let hsaQualifiedCap = qualifiedMedicalThisYear + (hsaReimburseLaterActive ? hsaReimbursablePool : 0)

    // Withdrawal-rate guardrail decision (before funding). The signal is this
    // year's recurring target spending over the start-of-year portfolio, compared
    // to the same ratio in the first solvent year. Cutting/raising moves the
    // discretionary multiplier; the required floor is never touched.
    let guardrailAction: GuardrailAction = 'hold'
    const earlyPullGoalBudget = guardrailsActive
      ? plan.expenses.oneTimeGoals.reduce((sum, goal) => {
          if (goalScheduler?.isResolved(goal.id)) return sum
          const flexibility = goal.flexibility ?? 'fixed'
          if (flexibility === 'fixed') return sum
          const earliestYear = Math.min(goal.earliestYear ?? goal.year, goal.year)
          if (year >= earliestYear && year < goal.year) return sum + goal.amount * inflFactor
          return sum
        }, 0)
      : 0
    const annualUpsideLifestyle = idealLifestyle + excessLifestyle
    const guardrailStepBasis = Math.max(targetLifestyle, annualUpsideLifestyle, 1)
    const allowRaisesAboveTarget = spendingPolicy?.allowRaisesAboveTarget ?? annualUpsideLifestyle + earlyPullGoalBudget > 0
    const maxGuardrailMultiplier =
      guardrailsActive && allowRaisesAboveTarget
        ? 1 + (annualUpsideLifestyle + earlyPullGoalBudget) / guardrailStepBasis
        : 1
    if (guardrailsActive && anyAlive) {
      let startPortfolio = 0
      for (const b of balances) startPortfolio += startOfYearBalance.get(b.account.id) ?? 0
      if (riskBasedGuardrails) {
        // Risk-based signal: the real (deflated) balance against dollar
        // thresholds expressed as a percent of the starting portfolio. The
        // thresholds come from the shared-path probability solver; when they
        // have not been solved the decision holds every year (mode is inert).
        const realBalance = startPortfolio / inflFactor
        if (startingRealPortfolio === null && startPortfolio > 0) startingRealPortfolio = realBalance
        if (startingRealPortfolio !== null) {
          const decision = nextBalanceGuardrailMultiplier(
            discretionaryMultiplier,
            realBalance,
            startingRealPortfolio,
            guardrailPolicy,
            maxGuardrailMultiplier,
          )
          discretionaryMultiplier = decision.multiplier
          guardrailAction = decision.action
        }
      } else {
        const targetRecurring = systemRequired + requiredLifestyle + targetLifestyle
        const currentRate = startPortfolio > 0 ? targetRecurring / startPortfolio : NaN
        if (startingWithdrawalRate === null && Number.isFinite(currentRate)) startingWithdrawalRate = currentRate
        if (startingWithdrawalRate !== null) {
          const decision = nextGuardrailMultiplier(
            discretionaryMultiplier,
            currentRate,
            startingWithdrawalRate,
            guardrailPolicy,
            maxGuardrailMultiplier,
          )
          discretionaryMultiplier = decision.multiplier
          guardrailAction = decision.action
        }
      }
    }
    const targetLifestyleFunded = guardrailsActive
      ? targetLifestyle * Math.min(1, discretionaryMultiplier)
      : targetLifestyle
    const upsideBudget = guardrailsActive
      ? Math.max(0, discretionaryMultiplier - 1) * guardrailStepBasis
      : annualUpsideLifestyle
    const idealLifestyleFunded = Math.min(idealLifestyle, upsideBudget)
    const excessLifestyleFunded = Math.min(excessLifestyle, Math.max(0, upsideBudget - idealLifestyleFunded))
    const remainingUpsideBudget = Math.max(0, upsideBudget - idealLifestyleFunded - excessLifestyleFunded)
    const cutting = guardrailsActive && discretionaryMultiplier < 1 - 1e-9
    const canPullForwardGoals = guardrailsActive && !cutting && (guardrailAction === 'raise' || discretionaryMultiplier > 1 + 1e-9)

    // One-time goals. Under guardrails they route through the scheduler (which
    // may delay/skip flexible goals when cutting); otherwise every goal funds in
    // its target year exactly, as it always has. A *skipped* goal is intended
    // spending that never happens, so its amount is tracked as a target miss (a
    // required-classified skip is also a required miss) rather than silently
    // vanishing from both sides of the ledger.
    let oneTimeGoalsFunded = 0
    let requiredGoalsFunded = 0
    let targetGoalsFunded = 0
    let idealGoalsFunded = 0
    let excessGoalsFunded = 0
    let skippedTargetNominal = 0
    let skippedIdealNominal = 0
    let skippedExcessNominal = 0
    let skippedRequiredNominal = 0
    const goalOutcomeCounts = { funded: 0, partiallyFunded: 0, deferred: 0, skipped: 0, fundedAmount: 0, unfundedAmount: 0 }
    if (anyAlive) {
      if (goalScheduler) {
        const plannedGoals = goalScheduler.planYear(year, {
          inflFactor,
          cutting,
          canPullForward: canPullForwardGoals,
          availableBudget: cutting ? 0 : canPullForwardGoals ? remainingUpsideBudget : null,
        })
        for (const r of plannedGoals.results) {
          if (r.outcome === 'funded' || r.outcome === 'partiallyFunded') {
            oneTimeGoalsFunded += r.fundedNominal
            if (r.classification === 'required') requiredGoalsFunded += r.fundedNominal
            else if (r.classification === 'target') targetGoalsFunded += r.fundedNominal
            else if (r.classification === 'ideal') idealGoalsFunded += r.fundedNominal
            else excessGoalsFunded += r.fundedNominal
            if (r.outcome === 'funded') goalOutcomeCounts.funded++
            else goalOutcomeCounts.partiallyFunded++
            goalOutcomeCounts.fundedAmount += r.fundedNominal
            goalOutcomeCounts.unfundedAmount += r.unfundedNominal
            if (r.unfundedNominal > 0) {
              if (r.classification === 'required') skippedRequiredNominal += r.unfundedNominal
              else if (r.classification === 'target') skippedTargetNominal += r.unfundedNominal
              else if (r.classification === 'ideal') skippedIdealNominal += r.unfundedNominal
              else skippedExcessNominal += r.unfundedNominal
            }
          } else if (r.outcome === 'deferred') {
            goalOutcomeCounts.deferred++
          } else {
            if (r.classification === 'required') skippedRequiredNominal += r.amountNominal
            else if (r.classification === 'target') skippedTargetNominal += r.amountNominal
            else if (r.classification === 'ideal') skippedIdealNominal += r.amountNominal
            else skippedExcessNominal += r.amountNominal
            goalOutcomeCounts.unfundedAmount += r.amountNominal
            goalOutcomeCounts.skipped++
          }
        }
      } else {
        for (const goal of plan.expenses.oneTimeGoals) {
          if (goal.year !== year) continue
          const amount = goal.amount * inflFactor
          oneTimeGoalsFunded += amount
          const classification = goal.classification ?? 'target'
          if (classification === 'required') requiredGoalsFunded += amount
          else if (classification === 'target') targetGoalsFunded += amount
          else if (classification === 'ideal') idealGoalsFunded += amount
          else excessGoalsFunded += amount
        }
      }
    }

    const baseSpending = requiredLifestyle + targetLifestyleFunded + idealLifestyleFunded + excessLifestyleFunded
    // Base layers are funding-consistent (they exclude skipped goals) so the
    // shortfall attribution below stays clean; skipped goals are folded back into
    // the *reported* required/target totals and the shortfalls as explicit deltas.
    let requiredSpendingBase = systemRequired + requiredLifestyle + requiredGoalsFunded
    let targetSpendingBase = systemRequired + requiredLifestyle + targetLifestyle + targetGoalsFunded + requiredGoalsFunded
    const idealSpendingBase = idealLifestyle + idealGoalsFunded
    const excessSpendingBase = excessLifestyle + excessGoalsFunded

    const expenses: YearExpenses = {
      baseSpending,
      oneTimeGoals: oneTimeGoalsFunded,
      debtService,
      propertyCosts,
      healthcare,
      insurancePremiums,
      careCost,
      ltcBenefit,
      requiredSpending: requiredSpendingBase + skippedRequiredNominal,
      targetSpending: targetSpendingBase + skippedTargetNominal + skippedRequiredNominal,
      idealSpending: idealSpendingBase + skippedIdealNominal,
      excessSpending: excessSpendingBase + skippedExcessNominal,
      intendedSpending:
        targetSpendingBase +
        idealSpendingBase +
        excessSpendingBase +
        skippedTargetNominal +
        skippedRequiredNominal +
        skippedIdealNominal +
        skippedExcessNominal,
      guardrailFactor: discretionaryMultiplier,
      total:
        baseSpending + oneTimeGoalsFunded + debtService + propertyCosts + healthcare + insurancePremiums + careCost - ltcBenefit,
    }

    // --- fixed-asset dispositions (step 6) ----------------------------------
    // With a cost basis on a property account, this year's planned sale is
    // priced exactly — selling costs, §121 primary-residence exclusion, and
    // depreciation recapture — and its gains join the year's tax base up
    // front. Net proceeds enter the cash flow (so the sale can fund its own
    // tax), and the property-events block below zeroes the value without the
    // legacy tax-free deposit. Without a cost basis the legacy
    // expectedNetProceeds path is untouched.
    let propertySaleProceedsTotal = 0
    for (const account of plan.accounts) {
      if (account.type !== 'property' || account.plannedSaleYear !== year || account.costBasis === undefined) continue
      const value = propertyValues.get(account.id) ?? 0
      if (value <= 0) continue
      // Match the property-events block: the sale year's inflation growth
      // accrues before the sale.
      const sale = propertySaleTax({
        salePrice: value * (1 + inflRateAt(year)),
        costBasis: account.costBasis,
        sellingCostPct: account.sellingCostPct,
        primaryResidence: account.primaryResidence,
        depreciationRecapture: account.depreciationRecapture,
        filingStatus: taxFilingStatusForYear,
        pack,
      })
      ordinaryIncome += sale.ordinaryGain
      oneTimeGains += sale.capitalGain
      // A HECM on the sold home is repaid from the proceeds, non-recourse:
      // the payoff never exceeds what the sale nets, and the line closes.
      // (Loan repayment does not change the taxable gain computed above.)
      const hecmState = hecmStates.get(account.id)
      let hecmPayoff = 0
      if (hecmState) {
        hecmPayoff = Math.min(hecmState.loanBalance, Math.max(0, sale.netProceeds))
        hecmStates.delete(account.id)
      }
      propertySaleProceedsTotal += sale.netProceeds - hecmPayoff
    }

    // --- contributions & employer match --------------------
    let contributions = 0
    let ownedNonRothIraContributions = 0
    let employerMatch = 0
    let preTaxContributions = 0
    // Deposit destinations for the optimizer probe: the LP models balances as
    // owner-traditional vs everything-else buckets, so contributions and match
    // must arrive in the matching compressed bucket, not vanish as spending.
    let traditionalInflow = 0
    let otherInflow = 0
    let taxableInflow = 0
    const groupUsed = new Map<string, number>()
    const addition415cUsed = new Map<string, number>()
    // IRC 219(b)(1) caps an IRA contribution at the lesser of the deductible
    // amount and compensation includible in gross income, and 219(c) lets a
    // couple filing jointly reach the other spouse's compensation. So the
    // ceiling is a single household pool on a joint return with both spouses
    // living, and each person's own wages otherwise. Wages are the engine's
    // only compensation source; see the 219(f)(1) registry record.
    const iraCompensationIsShared =
      filingStatusForYear === 'marriedFilingJointly' && aliveCount === 2
    const iraCompensationRemaining = new Map<string, number>()
    if (iraCompensationIsShared) {
      let combined = 0
      for (const wages of wagesByPerson.values()) combined += wages
      iraCompensationRemaining.set(IRA_HOUSEHOLD_COMPENSATION_KEY, combined)
    } else {
      for (const [personId, wages] of wagesByPerson) {
        iraCompensationRemaining.set(personId, wages)
      }
    }

    for (const state of balances) {
      const account = state.account
      const hasSchedule = 'contributionSchedule' in account && account.contributionSchedule && account.contributionSchedule.length > 0
      if (account.annualContribution <= 0 && !hasSchedule) continue
      if (!acceptsContributions(account)) continue // inherited accounts can't receive contributions
      const ownerId = account.ownerPersonId ?? primary.id
      const ownerState = stateOf(ownerId)
      if (!ownerState.alive) continue

      let desired = 0
      if (hasSchedule) {
        const owner = personById.get(ownerId)!
        const ownerBirthYear = dobYear(owner)
        const ownerAgeAtStartYear = startYear - ownerBirthYear
        for (const phase of account.contributionSchedule!) {
          const fromAge = phase.fromAge ?? 0
          const toAge = phase.toAge ?? 120
          const age = ownerState.ageAttained
          if (age >= fromAge && age <= toAge) {
            const phaseStartYear = phase.fromAge !== null
              ? startYear + (phase.fromAge - ownerAgeAtStartYear)
              : startYear
            const yearsElapsed = Math.max(0, year - phaseStartYear)
            desired += phase.annualAmount * Math.pow(1 + phase.escalationPct / 100, yearsElapsed) * inflFactor
          }
        }
        // Employer accounts require wages even with a schedule
        const isEmployer = (account.type === 'traditional' || account.type === 'roth') && account.kind === 'employer'
        if (isEmployer && (wagesByPerson.get(ownerId) ?? 0) <= 0) {
          desired = 0
        }
      } else {
        // Legacy behavior: must have wages
        if ((wagesByPerson.get(ownerId) ?? 0) <= 0) {
          desired = 0
        } else {
          desired = account.annualContribution * inflFactor
        }
      }

      if (desired <= 0) continue

      let allowed = desired
      let groupKey: string | null = null
      let compensationKey: string | null = null
      let limit = Infinity
      const age = ownerState.ageAttained
      if ((account.type === 'traditional' || account.type === 'roth') && account.kind === 'employer') {
        groupKey = `${ownerId}:employer`
        // IRC 414(v)(2)(C)(i) sentence two indexes "the adjusted dollar amounts
        // applicable under clauses (i) and (ii) of subparagraph (E)" -- the
        // greater-of OUTPUT, not the 10,000 dollar leg inside it. Congress used
        // figure-specific wording one sentence earlier ("the $5,000 amount in
        // subparagraph (B)(i)") and switched deliberately here. Treasury settles
        // it outright: 26 CFR 1.414(v)-1(c)(2)(iii)(B) indexes "the initial
        // amount ($11,250 ...)", so it is the operative figure that moves and
        // the 10,000 leg never governs. That provision governs taxable years
        // beginning after 2025 by its own terms, which covers 2027 -- the first
        // year in which the candidate readings produce different amounts.
        const catchUp =
          age >= 60 && age <= 63
            ? indexWithStatutoryRounding(pack.contributionLimits.superCatchUp60to63, limitGrowth)
            : age >= 50
              // The (B)(i)/(C)(i) first-sentence catch-up does index normally.
              ? pack.contributionLimits.catchUp50 * limitGrowth
              : 0
        limit = pack.contributionLimits.employee401k * limitGrowth + catchUp
      } else if ((account.type === 'traditional' || account.type === 'roth') && account.kind === 'ira') {
        // One group for traditional and Roth together: IRC 408A(c)(2) makes the
        // Roth limit the 219(b)(1) amount reduced by traditional contributions,
        // so the pair share a single annual ceiling.
        groupKey = `${ownerId}:ira`
        // IRC 219(b)(5)(C)(iii) indexes the (b)(5)(B) catch-up as well as the
        // deductible amount, so unlike the HSA catch-up this one is projected.
        const catchUp = age >= 50 ? pack.contributionLimits.iraCatchUp50 : 0
        limit = (pack.contributionLimits.ira + catchUp) * limitGrowth
        compensationKey = iraCompensationIsShared ? IRA_HOUSEHOLD_COMPENSATION_KEY : ownerId
      } else if (account.type === 'hsa') {
        // The group key stays per person, but a couple does NOT get one family
        // limit each. IRC 223(b)(5) says that where either spouse has family
        // coverage, "both spouses shall be treated as having only such family
        // coverage" and the paragraph (1) limitation "shall be divided equally
        // between them unless they agree on a different division". One family
        // limit, split. A plan carries no coverage election and no division
        // agreement, so the two-person household stands in for family coverage
        // (as it already did in selecting the base) and the equal division the
        // statute applies by default stands in for the agreement.
        groupKey = `${ownerId}:hsa`
        const hasFamilyCoverage = people.length === 2
        // (b)(5) opens on "individuals who are married to each other", so the
        // division reaches a two-person household only while it is a married
        // one and both spouses are living. Household size alone will not do:
        // the schema requires two people for a joint return but does not
        // require a joint return of a two-person household, so unmarried pairs
        // are representable — and two unmarried individuals covered by a
        // family plan are each an eligible individual with family coverage
        // under (b)(2)(B) with no paragraph (5) to divide anything, so they
        // keep a whole family limit each. A sole survivor likewise has nobody
        // left to divide with. Same married-and-both-living test as the 219(c)
        // shared compensation pool above.
        const dividesFamilyLimit =
          hasFamilyCoverage && filingStatusForYear === 'marriedFilingJointly' && aliveCount === 2
        const base = hasFamilyCoverage
          ? pack.contributionLimits.hsaFamily / (dividesFamilyLimit ? 2 : 1)
          : pack.contributionLimits.hsaSelfOnly
        // IRC 223(g)(1) indexes only the subsection (b)(2) limits. The
        // (b)(3) catch-up has been a flat 1,000 dollars since 2009 and is
        // absent from the indexing list, so it must not carry limitGrowth.
        // It is also outside the division: 223(b)(5)(B) divides the limitation
        // "without regard to any additional contribution amount under
        // paragraph (3)", so each spouse adds a whole catch-up of their own on
        // top of half the base rather than half of one.
        const catchUp = age >= 55 ? pack.contributionLimits.hsaCatchUp55 : 0
        limit = base * limitGrowth + catchUp
      }
      const isEmployerAccount = (account.type === 'traditional' || account.type === 'roth') && account.kind === 'employer'
      if (groupKey !== null) {
        const used = groupUsed.get(groupKey) ?? 0
        allowed = Math.max(0, Math.min(desired, limit - used))
      }

      // §415(c)(1) caps annual additions — and §415(c)(2) counts the employee's
      // own contributions among them, not just the employer's — at the lesser
      // of the indexed dollar amount and 100 percent of compensation. Deferrals
      // are the first addition to land, so the cap has to bind them here.
      // Capping only the match leaves a participant paid less than the §402(g)
      // limit deferring more than they earned, and zeroing the match cannot
      // bring that back under the pay prong.
      const used415c = addition415cUsed.get(ownerId) ?? 0
      if (isEmployerAccount) {
        const limit415c = Math.min(
          pack.contributionLimits.section415cLimit * limitGrowth,
          wagesByPerson.get(ownerId) ?? 0,
        )
        allowed = Math.max(0, Math.min(allowed, limit415c - used415c))
      }

      if (groupKey !== null) {
        // §219(b)(1)(B) for IRAs, the counterpart of the §415(c) pay prong
        // above. It lands here rather than with the dollar limit because the
        // §219(c) household pool spans both spouses' limit groups, so it has
        // to draw down once the amount is otherwise final.
        if (compensationKey !== null) {
          const compensation = iraCompensationRemaining.get(compensationKey) ?? 0
          allowed = Math.max(0, Math.min(allowed, compensation))
          iraCompensationRemaining.set(compensationKey, compensation - allowed)
        }
        if (allowed < desired - EPSILON) {
          warnings.add('Some contributions were reduced to stay within IRS annual limits.')
        }
        groupUsed.set(groupKey, (groupUsed.get(groupKey) ?? 0) + allowed)
      }
      if (allowed <= 0) continue

      // Update employee contribution inside 415(c) tracker
      if (isEmployerAccount) {
        addition415cUsed.set(ownerId, used415c + allowed)
      }

      const contributionBalanceBefore = state.balance
      state.balance += allowed
      const contributionKind = account.type === 'traditional'
        ? account.kind === 'employer'
          ? 'employerPlanEmployeeContribution' as const
          : 'ownedIraContribution' as const
        : null
      if (contributionKind !== null) {
        const producerOccurrenceKey = runtimeOccurrenceKey(
          contributionKind,
          account.id,
        )
        recordAnnualRetirementRuntimeOccurrence({
          producerOccurrenceKey,
          kind: contributionKind,
          grossAmountPlanDollars: allowed,
          ownerPersonId: account.ownerPersonId,
          sourceAccountId: account.id,
          executionDate: null,
          executionSequence: null,
          movementAuthorityId: null,
        })
        if (isAggregatedIra(account)) {
          recordAnnualRetirementRuntimeApplication({
            applicationKind: 'credit',
            producerOccurrenceKey,
            simulatorPhase: 'employeeContribution',
            ownerPersonId: account.ownerPersonId,
            sourceAccountId: account.id,
            sourceBalanceBeforePlanDollars: contributionBalanceBefore,
            creditedAmountPlanDollars: allowed,
            sourceBalanceAfterPlanDollars: state.balance,
          })
        }
      }
      if (account.type === 'taxable' || account.type === 'equityComp') state.costBasis += allowed
      // Direct Roth contributions add to the always-accessible basis (employer
      // Roth contributions are treated the same here, a planning simplification).
      if (account.type === 'roth') {
        const rb = rothBasis.get(rothPoolKey(account))
        if (rb) rb.contributionBasis += allowed
      }
      contributions += allowed
      if (isAggregatedIra(account)) ownedNonRothIraContributions += allowed
      if (account.type === 'traditional' || account.type === 'hsa') preTaxContributions += allowed
      if (account.type === 'traditional') traditionalInflow += allowed
      else otherInflow += allowed
      if (account.type === 'taxable' || account.type === 'equityComp') taxableInflow += allowed

      // Employer match calculation
      if (isEmployerAccount && 'employerMatch' in account && account.employerMatch) {
        const matchInfo = account.employerMatch
        const ownerWages = wagesByPerson.get(ownerId) ?? 0
        if (ownerWages > 0) {
          const matchCap = (matchInfo.capPctOfPay / 100) * ownerWages
          const baseMatch = Math.min(allowed, matchCap)
          let matchVal = baseMatch * (matchInfo.matchPct / 100)

          // Capped by §415(c) total additions limit, which is the LESSER of the
          // indexed dollar amount and 100 percent of compensation — a low-paid
          // participant with a generous match is bound by pay, not the dollar
          // figure. Wages stand in for section 415(c)(3) compensation here.
          const limit415c = Math.min(
            pack.contributionLimits.section415cLimit * limitGrowth,
            ownerWages,
          )
          const usedSoFar = addition415cUsed.get(ownerId) ?? 0
          const remaining415cLimit = Math.max(0, limit415c - usedSoFar)
          matchVal = Math.min(matchVal, remaining415cLimit)

          if (matchVal > 0) {
            state.balance += matchVal
            if (account.type === 'traditional') {
              const kind = 'employerPlanEmployerMatch' as const
              recordAnnualRetirementRuntimeOccurrence({
                producerOccurrenceKey: runtimeOccurrenceKey(kind, account.id),
                kind,
                grossAmountPlanDollars: matchVal,
                ownerPersonId: account.ownerPersonId,
                sourceAccountId: account.id,
                executionDate: null,
                executionSequence: null,
                movementAuthorityId: null,
              })
            }
            employerMatch += matchVal
            // Employer match only lands in traditional or Roth employer accounts,
            // never a taxable brokerage, so taxableInflow is unaffected here.
            if (account.type === 'traditional') traditionalInflow += matchVal
            else otherInflow += matchVal
            addition415cUsed.set(ownerId, usedSoFar + matchVal)
          }
        }
      }
    }

    const iraProRata = new Map<string, IraProRataYear>()
    let conversionNontaxable = 0

    const runPostContributionAnnualPass = (
      assumedEffects:
        readonly Readonly<OwnedNonRothIraAnnualSettlementEffect>[],
      omittedRetirementActionIds:
        ReadonlySet<ActionId> = NO_OMITTED_RETIREMENT_ACTION_IDS,
      /**
       * `T0` for this run's conversion-linked withdrawal groups, when the
       * caller ran a counterfactual for them.
       *
       * Handed in rather than computed here, and that is not a convenience.
       * The counterfactual is a second whole run of this same closure, so a run
       * that computed its own baseline would recurse; the caller runs it
       * outside, before this one commits anything, and passes the reading down.
       * A run that has no baseline — the counterfactual itself, and the two
       * fallback runs after a rolled-back settlement — is not a broken run: it
       * says so, its groups keep the `unsupported` funding reason, and the
       * annual funding evaluation is refused rather than invented.
       */
      annualLiabilityBaseline:
        Readonly<ConversionLinkedWithdrawalGroupLiabilityRun> | null = null,
      /**
       * What this run of the pass is allowed to do with its linked groups.
       *
       * Three modes and they are not three degrees of the same permission.
       *
       * `refuseAll` is every run that has nothing to release: the
       * counterfactual, the staging run of a year that could read no `T0` or
       * whose staging did not prove out, and any caller that says nothing at
       * all. It is the default, so a new call site refuses by omission rather
       * than by remembering to.
       *
       * Note which runs are *not* on that list. The two settlement fallbacks —
       * after a rolled-back settlement, and when the settlement feature is off
       * — both go through `linkedGroupPermissionForAttempt([])` like every
       * other committed run, so each stages under the empty assumption vector
       * and can be handed `proven`. A fallback is a different assumption
       * vector, not a lesser permission: the group either proved out under the
       * vector the run actually used or it did not.
       *
       * `stageProvisionally` belongs to the discarded staging run alone. It
       * releases the year's groups so the run can discover what the year
       * costs when they move — which is the only way `T1(F)` exists at all —
       * and the release is all-or-nothing across the year's assessment: one
       * contested pair, or one leg unfundable from the balances standing at
       * the seam, and nothing stages. Nothing it publishes is kept.
       *
       * `proven` is the committed run of a year whose staging proved out, and
       * the authorizations it carries were minted by
       * `authorizeConversionLinkedWithdrawalGroups` from that run's own facts.
       */
      linkedGroupRelease: Readonly<LinkedGroupRelease> = REFUSE_LINKED_GROUPS,
    ): { yearResult: YearResult; optimizerProbe: OptimizerYearProbe | null } => {
    /**
     * The Plan's retirement actions as *this* run of the pass sees them.
     *
     * A counterfactual run of the annual pass has to remove a named set of
     * requests and change nothing else. The alternative — handing the pass a
     * substituted Plan with those requests stripped out — would silently change
     * every one of the pass's several thousand other reads of `plan`, which are
     * about accounts, household, expenses, strategies and assumptions rather
     * than about requests. So the modification is an omission set, and it
     * narrows exactly here: every derivation of the year's request set below
     * reads this array instead of the Plan's.
     *
     * With nothing omitted this *is* the Plan's array, by reference, so an
     * ordinary pass performs no filter and allocates nothing.
     *
     * @see internal/counterfactualAnnualLiability.ts
     */
    const passRetirementActions = omittedRetirementActionIds.size === 0
      ? plan.strategies.retirementActions
      : plan.strategies.retirementActions.filter(
        (request) => !omittedRetirementActionIds.has(request.actionId),
      )
    /**
     * The Plan as this run of the pass hands it to the action executors — the
     * same Plan in every respect except which requests it declares.
     *
     * Narrowing the derivations above is not enough on its own, and the reason
     * is a check that exists for good cause. `executeOrdinaryWithdrawals`
     * re-derives the conversion linked-withdrawal groups it can see for itself
     * from `input.plan.strategies.retirementActions`, and throws when the
     * verdict it was handed omits one of them: an assessment that leaves out a
     * linked group sitting in the Plan is not a decision to release that
     * withdrawal. Under a counterfactual, though, the request genuinely is not
     * in this run, so the executor's own view has to be narrowed with
     * everything else's — otherwise the very case `T0` exists for, a conversion
     * and its dedicated linked withdrawal removed together, could never run.
     *
     * This is the one place a substituted Plan is right rather than dangerous:
     * one shallow copy replacing one array, handed only to the executors, whose
     * contract is already stated in terms of the requests the run declares. The
     * pass's own thousands of other `plan` reads — accounts, household,
     * expenses, strategies, assumptions — go on reading the real Plan. With
     * nothing omitted this *is* the real Plan, by reference.
     */
    const passPlan: Plan = omittedRetirementActionIds.size === 0
      ? plan
      : {
        ...plan,
        strategies: {
          ...plan.strategies,
          retirementActions: passRetirementActions,
        },
      }
    let rmdNontaxable = 0
    let seppNontaxable = 0
    const assumedEffectByIdentity = new Map(
      assumedEffects
        .filter((effect) => effect.taxYear === year)
        .map((effect) => [
          JSON.stringify([effect.actionId, effect.allocationId]),
          effect,
        ]),
    )
    const resolveAssumedCharacter = (input: {
      ownerPersonId: string
      calculationScope:
        'form8606Line7Distributions' | 'form8606Line8NetConversions'
      occurrenceKind:
        | 'ownedIraRmd'
        | 'annuityContractDistribution'
        | 'automaticSeppDistribution'
        | 'legacyNeedBasedWithdrawal'
        | 'legacyQcd'
        | 'legacyRothConversion'
        | 'namedRothConversion'
      producerOccurrenceKey: string
      sourceAccountId: string
      mutationOrdinal: number
      grossAmountPlanDollars: number
      remainingBasisPlanDollars?: number
    }): { basisReturn: number; ordinaryIncome: number } | null => {
      let grossAmount: ReturnType<typeof planDollarsToLedgerCents>
      let remainingBasis:
        ReturnType<typeof planDollarsToLedgerCents> | null = null
      try {
        grossAmount = planDollarsToLedgerCents(input.grossAmountPlanDollars)
        if (input.remainingBasisPlanDollars !== undefined) {
          remainingBasis = planDollarsToLedgerCents(
            input.remainingBasisPlanDollars,
          )
        }
      } catch {
        return null
      }
      const identity = deriveOwnedNonRothIraReplayAllocationIdentity({
        planId: plan.id,
        taxYear: year,
        producerOccurrenceKey: input.producerOccurrenceKey,
        occurrenceKind: input.occurrenceKind,
        sourceAccountId: input.sourceAccountId,
        mutationOrdinal: input.mutationOrdinal,
      })
      const effect = assumedEffectByIdentity.get(JSON.stringify([
        identity.actionId,
        identity.allocationId,
      ]))
      if (effect === undefined ||
          effect.ownerPersonId !== input.ownerPersonId ||
          effect.calculationScope !== input.calculationScope ||
          effect.actionId !== identity.actionId ||
          effect.allocationId !== identity.allocationId ||
          effect.sourceAccountId !== input.sourceAccountId ||
          effect.grossAmount !== grossAmount ||
          (remainingBasis !== null && effect.basisReturnAmount > remainingBasis)) {
        return null
      }
      return {
        basisReturn: ledgerCentsToPlanDollars(effect.basisReturnAmount),
        ordinaryIncome: ledgerCentsToPlanDollars(effect.ordinaryIncomeAmount),
      }
    }
    const splitWithAssumedCharacter = (
      state: IraProRataYear,
      amount: number,
      input: Omit<Parameters<typeof resolveAssumedCharacter>[0],
        'grossAmountPlanDollars' | 'remainingBasisPlanDollars'>,
    ) => {
      const assumed = resolveAssumedCharacter({
        ...input,
        grossAmountPlanDollars: amount,
        remainingBasisPlanDollars: state.basis,
      })
      if (assumed === null) return splitIraDistribution(state, amount)
      return {
        nontaxable: assumed.basisReturn,
        taxable: assumed.ordinaryIncome,
        next: {
          basis: Math.max(0, state.basis - assumed.basisReturn),
          nontaxableFraction: state.nontaxableFraction,
        },
      }
    }

    // This year's FALLBACK Form-8606 pro-rata denominator per owner (step 5):
    // the aggregated pre-distribution IRA balance — after contributions, before
    // any RMD/SEPP/conversion/withdrawal depletes it. Fallback because the
    // owned-non-Roth-IRA annual settlement below measures the same denominator
    // at the close of the year, as §408(d)(2)(C) requires, and the characters it
    // settles come back through `resolveAssumedCharacter` and supersede every
    // split this opens. What is opened here is what the year keeps only when the
    // settlement publishes nothing usable for it. Registered as
    // `irc-408-d-2-C-projection-pro-rata-measurement-instant`.
    //
    // OBSERVED HERE, OPENED LATER. The fraction cannot be fixed yet, because
    // IRC 408(d)(8)(D) takes the year's qualified charitable distribution out of
    // the section 72 computation entirely and the gift is not sized until the
    // forced distributions it may be routed out of are known. So the forced
    // distributions below RECORD their Form 8606 line-7 gross instead of
    // splitting it, and the 408(d)(8)(D) block immediately after the QCD block
    // opens the year against the reduced denominator and commits them in the
    // order they moved. Conversions and need-based withdrawals are sized after
    // that point and are unaffected by the deferral.
    // S2 treat-as-own year-scoped gates (projection only; conversion/contribution
    // validators stay static — WS5 residual). Defined once per year so RMD
    // aggregation, penalty, Form 8606 denominator, and post-growth sources agree.
    // Written without `isAggregatedIra`/`followsOwnerRmds` type predicates: those
    // return `account is TraditionalAccount`, so a false result wrongly excludes
    // every traditional account (including post-election S2).
    //
    // §1.408-8(c)(3): when the treat-as-own election year equals ownerDeathYear,
    // the spouse takes no owner RMD that year (owner-side aggregation begins the
    // following year) but must still take the decedent's unsatisfied year-of-
    // death RMD on the inherited path below.
    const isAggregatedIraThisYear = (account: Account): boolean => {
      if (account.type !== 'traditional' || account.kind !== 'ira') return false
      if (account.inherited === undefined) return true
      if (!isTreatAsOwnEffective(account, year)) return false
      if (year === account.inherited.ownerDeathYear) return false
      return true
    }
    const followsOwnerRmdsThisYear = (account: Account): boolean => {
      if (account.type !== 'traditional') return false
      if (account.inherited === undefined) return true
      if (!isTreatAsOwnEffective(account, year)) return false
      if (year === account.inherited.ownerDeathYear) return false
      return true
    }
    const preDistributionAggregateIraBalance = new Map<string, number>()
    for (const state of balances) {
      if (!isAggregatedIraThisYear(state.account)) continue
      const ownerId = state.account.ownerPersonId ?? primary.id
      preDistributionAggregateIraBalance.set(
        ownerId,
        (preDistributionAggregateIraBalance.get(ownerId) ?? 0) + state.balance,
      )
    }
    /**
     * One owned-IRA forced distribution, held back from the Form 8606 pro-rata
     * split until the year's charitable gift is known.
     *
     * Everything the split needs travels with it — the identity the exact-cent
     * settlement replay is keyed on, and the gross — so committing later
     * reproduces exactly what committing in place would have, for any gift of
     * zero.
     */
    interface DeferredForcedIraDistribution {
      readonly ownerId: string
      readonly amount: number
      readonly occurrenceKind: 'ownedIraRmd' | 'automaticSeppDistribution'
      readonly producerOccurrenceKey: string
      readonly sourceAccountId: string
      readonly mutationOrdinal: number
    }
    const deferredRmdDistributions: DeferredForcedIraDistribution[] = []
    const deferredSeppDistributions: DeferredForcedIraDistribution[] = []
    /**
     * One beyond-requirement charitable draw, held back for the same reason and
     * carrying the same identity.
     *
     * Its own kind, because what is deferred about it is the opposite question.
     * A forced distribution is deferred to learn how much of it LEFT section 72
     * as a gift; this draw is deferred to learn how much of it never became one.
     * IRC 408(d)(8)(B)'s closing sentence treats a distribution as a qualified
     * charitable distribution "only to the extent that the distribution would be
     * includible in gross income", and (D) caps that at the owner's aggregate
     * includible amount, so a gift past the cap is an ordinary distribution: it
     * belongs on Form 8606 line 7, in the line-9 denominator, and it recovers
     * basis pro rata.
     */
    interface DeferredLegacyQcdDistribution {
      readonly ownerId: string
      readonly amount: number
      readonly producerOccurrenceKey: string
      readonly sourceAccountId: string
      readonly mutationOrdinal: number
    }
    const deferredLegacyQcdDistributions: DeferredLegacyQcdDistribution[] = []
    /**
     * Per-occurrence characterization of the moving half of the gift, published
     * with the year so the replay never has to re-derive it.
     *
     * The routed half rides the nonmoving overlay because it moves no dollars of
     * its own and has no occurrence to ride. This half does have one, so the
     * split travels on it and the replay reads rather than reconstructs — which
     * is what keeps the two arms' Form 8606 line-7 grosses identical to the cent
     * instead of merely convergent.
     */
    const legacyQcdCharacterizations: {
      producerOccurrenceKey: string
      ownerPersonId: string
      grossAmountPlanDollars: number
      nonQualifiedLine7GrossPlanDollars: number
    }[] = []
    /** Owned-IRA required-distribution gross by owner, for gift attribution. */
    const ownedIraRmdGrossByOwner = new Map<string, number>()
    /**
     * The same pre-distribution observation, kept per account and for every
     * owner rather than only the ones carrying basis.
     *
     * A named QCD's exclusion is capped by its donor's otherwise-taxable pool,
     * and this measure is invariant ACROSS THE YEAR'S DEBITS: the ledger credits
     * growth after distributions, so every later debit moves a dollar out of the
     * balance and into the annual line it belongs to, leaving
     * `balance + distributions` unchanged. That is what makes measuring here
     * safe against the ordering of the distributions, and here is the only point
     * at which it is available -- the gift settles before the conversions and
     * withdrawals that finish consuming the pool.
     *
     * IT IS NOT INVARIANT ACROSS THE GROWTH CREDIT, and an earlier version of
     * this note overreached by saying it was "the same number the year end would
     * produce". `balance + distributions` is year-end-BEFORE-growth plus
     * distributions. Form 8606 line 9 is line 6 plus distributions, and line 6
     * is the December 31 value after the year's return on the retained balance
     * -- the instant §408(d)(2)(C) fixes the §72 contract value at. The two
     * differ by that growth. Registered as
     * `irc-408-d-2-C-projection-pro-rata-measurement-instant`; it is a
     * pre-existing departure of THIS LEDGER'S pro-rata denominator, not of the
     * engine's -- the owned-non-Roth-IRA annual settlement measures at the
     * close of the year and supersedes what is computed here wherever it
     * publishes -- and not of this pool measure's use as a 408(d)(8)(D)
     * ceiling. It is not corrected here.
     */
    const preDistributionOwnedIraBalance = new Map<string, number>()
    for (const state of balances) {
      if (!isAggregatedIraThisYear(state.account)) continue
      preDistributionOwnedIraBalance.set(state.account.id, state.balance)
    }
    // --- RMDs: forced traditional distributions (SECURE 2.0) ---------------
    // Treas. Reg. 1.408-8(e)(1)(i) requires that "the required minimum
    // distribution must be calculated separately for each IRA and the sum of
    // those separately calculated required minimum distributions may be
    // distributed from any one or more of the IRAs". Flooring each account at
    // its own balance and moving on drops the difference rather than moving
    // it, and the difference is reachable: the rebalance, annuity-purchase and
    // TIPS-ladder passes all run before this block and can empty an account
    // whose RMD base was already fixed at the prior Dec 31 balance. So the
    // amounts are decided in two steps below — each account's own separately
    // calculated share, then the owner's unmet remainder swept across their
    // other IRAs — and only executed once settled. Executing as we go would
    // record two occurrences against one account under the same key.
    //
    // The sweep is IRA-only and owner-only. Under (e)(2)(i) "only amounts in
    // IRAs that an individual holds as the IRA owner are aggregated", which
    // excludes an inherited IRA and a spouse's IRA alike, and an employer plan
    // is outside section 408 entirely, so it must still distribute its own
    // amount and can neither absorb nor supply a shortfall. `isAggregatedIra`
    // already draws exactly that line for the Form 8606 pro-rata rule.
    //
    // S2 treat-as-own: from treatAsOwnElectionYear the spouse's account joins
    // this owner aggregation (Treas. Reg. §1.408-8(c)(1)); before that year it
    // stays on the inherited schedule below. Contribution/conversion validators
    // stay static (WS5 residual). Helpers `isAggregatedIraThisYear` /
    // `followsOwnerRmdsThisYear` are defined just above the pre-distribution
    // Form 8606 denominator so every owner-side gate in the year agrees.
    //
    // Satisfying the sum here is also what keeps the Roth conversion pass that
    // follows lawful: 1.408A-4 A-6(b) bars converting "to the extent that the
    // required minimum distribution for the traditional IRA for the year has
    // not been distributed", and after the sweep an owner's IRA RMD can only
    // remain unsatisfied when every one of their IRAs is empty — leaving
    // nothing for that pass to convert.
    let rmdTotal = 0
    /**
     * The owned-IRA share of `rmdTotal`. A QCD may only come out of an
     * individual retirement plan (408(d)(8)(B)), so employer-plan RMD dollars
     * -- which `rmdTotal` also carries -- can never back one, and the QCD
     * routing below caps against this rather than the whole forced total.
     */
    let ownedIraRmdTotal = 0
    /** Dollars this account must distribute, own share plus any swept share. */
    const rmdTakeByAccount = new Map<string, number>()
    const unmetIraRmdByOwner = new Map<string, number>()
    /**
     * The owner's (e)(1)(i) sum: the separately calculated amounts of the IRAs
     * they hold as owner, and nothing else. An employer plan's amount and an
     * inherited IRA's forced distribution are outside the section 408
     * aggregation and never join this figure, so they can never make the sum
     * look distributed.
     */
    const iraRmdRequiredByOwner = new Map<string, number>()
    /** The part of that sum still undistributed once the sweep has finished. */
    const iraRmdUnsatisfiedByOwner = new Map<string, number>()
    for (const state of balances) {
      if (state.account.type !== 'traditional') continue
      if (!followsOwnerRmdsThisYear(state.account)) continue // inherited (pre-S2) follows the beneficiary schedule below
      const ownerId = state.account.ownerPersonId ?? primary.id
      const owner = personById.get(ownerId)!
      const ownerState = stateOf(ownerId)
      if (!ownerState.alive) continue // a deceased owner's own account stops RMDs (no estate modeling)
      // Joint Life divisor only when the user marked the spouse the account's
      // sole beneficiary (the rule's precondition; the schema can't infer it) and
      // they're alive. Otherwise the Uniform Lifetime Table applies.
      const spousePerson = state.account.spouseSoleBeneficiary ? people.find((p) => p.id !== ownerId) : undefined
      const spouseState = spousePerson ? stateOf(spousePerson.id) : undefined
      const spouse =
        spousePerson && spouseState?.alive ? { ageAttained: spouseState.ageAttained, sex: spousePerson.sex } : undefined
      const rmd = requiredMinimumDistribution(
        pack,
        dobYear(owner),
        ownerState.ageAttained,
        startOfYearBalance.get(state.account.id) ?? 0,
        { ownerSex: owner.sex, spouse },
      )
      if (rmd <= 0) continue
      if (isAggregatedIraThisYear(state.account)) {
        iraRmdRequiredByOwner.set(ownerId, (iraRmdRequiredByOwner.get(ownerId) ?? 0) + rmd)
      }
      const take = Math.min(rmd, state.balance)
      if (take > 0) rmdTakeByAccount.set(state.account.id, take)
      // Only an IRA share can be satisfied elsewhere. An employer plan short
      // of its own amount stays short: it is outside the section 408
      // aggregation, so no other account may distribute on its behalf.
      if (rmd - take > EPSILON && isAggregatedIraThisYear(state.account)) {
        unmetIraRmdByOwner.set(ownerId, (unmetIraRmdByOwner.get(ownerId) ?? 0) + (rmd - take))
      }
    }
    // (e)(1)(i) lets a living owner take the sum "from any one or more of the
    // IRAs", so the order below is a permitted choice rather than a required
    // one; plan account order is used because it is deterministic and no
    // ordering changes the total distributed or its character.
    for (const [ownerId, unmet] of unmetIraRmdByOwner) {
      let remaining = unmet
      for (const state of balances) {
        if (remaining <= EPSILON) break
        if (!isAggregatedIraThisYear(state.account)) continue
        if ((state.account.ownerPersonId ?? primary.id) !== ownerId) continue
        const ownShare = rmdTakeByAccount.get(state.account.id) ?? 0
        const capacity = state.balance - ownShare
        if (capacity <= EPSILON) continue
        const swept = Math.min(capacity, remaining)
        rmdTakeByAccount.set(state.account.id, ownShare + swept)
        remaining -= swept
      }
      // After the sweep an owner's IRA RMD can only remain unsatisfied when
      // every one of their aggregated IRAs is empty. EPSILON is half a cent,
      // so a residue that survives this test is at least one cent short in the
      // exact-cent ledger the conversion executor reads.
      if (remaining > EPSILON) iraRmdUnsatisfiedByOwner.set(ownerId, remaining)
    }
    for (const state of balances) {
      // Only traditional accounts were ever entered above; the guard is here
      // so the account narrows for `kind` rather than being asserted.
      if (state.account.type !== 'traditional') continue
      const take = rmdTakeByAccount.get(state.account.id) ?? 0
      // A draw the exact-cent ledger records as zero is not a small
      // distribution, it is no distribution: a fraction of a cent is not
      // transferable in currency, and the runtime journal -- which must be able
      // to explain every movement -- admits no occurrence for a gross that
      // rounds to nothing. So the draw is skipped whole: no balance change, no
      // occurrence, no income, and nothing added to `rmdTotal`, which is what
      // the year publishes as its required distribution.
      //
      // The remainder is DISCHARGED here, not left unsatisfied, and that is the
      // half with teeth. `iraRmdUnsatisfiedByOwner` is settled above from
      // `rmd - take` and the sweep, so a quantum skipped here never reaches it
      // -- and it must not, because Treas. Reg. 1.408-8(e)(1)(i) shortfall is
      // read downstream (the conversion executor's 1.408A-4 A-6(b) reserve, and
      // the named gift's RMD coordination) as proof that every one of the
      // owner's IRAs was exhausted. A residue too small to move is not that
      // proof, and reporting it as a shortfall would block lawful conversions
      // and gifts for as long as the residue survived, which is forever. What
      // is genuinely undistributed is a knowable sub-cent-per-account-per-year
      // deviation from the computed requirement and nothing more.
      if (take <= 0 || planDollarsMoveNoLedgerCent(take)) continue
      const ownerId = state.account.ownerPersonId ?? primary.id
      const sourceBalanceBefore = state.balance
      state.balance -= take
      const kind = state.account.kind === 'ira' ? 'ownedIraRmd' as const : 'employerPlanRmd' as const
      const producerOccurrenceKey = runtimeOccurrenceKey(kind, state.account.id)
      recordAnnualRetirementRuntimeOccurrence({
        producerOccurrenceKey,
        kind,
        grossAmountPlanDollars: take,
        ownerPersonId: state.account.ownerPersonId,
        sourceAccountId: state.account.id,
        executionDate: null,
        executionSequence: null,
        movementAuthorityId: null,
      })
      let ownedIraApplication:
        SimulatorRetirementRuntimeApplication | null = null
      if (isAggregatedIraThisYear(state.account)) {
        ownedIraApplication = recordAnnualRetirementRuntimeApplication({
          applicationKind: 'debit',
          producerOccurrenceKey,
          simulatorPhase: 'ownerRmdDistribution',
          ownerPersonId: state.account.ownerPersonId,
          sourceAccountId: state.account.id,
          sourceBalanceBeforePlanDollars: sourceBalanceBefore,
          appliedAmountPlanDollars: take,
          sourceBalanceAfterPlanDollars: state.balance,
        })
      }
      rmdTotal += take
      if (isAggregatedIraThisYear(state.account)) {
        ownedIraRmdTotal += take
        ownedIraRmdGrossByOwner.set(
          ownerId,
          (ownedIraRmdGrossByOwner.get(ownerId) ?? 0) + take,
        )
      }
      // Pro-rata return of basis on IRA RMDs (step 5), RECORDED here and
      // committed after the QCD block: 408(d)(8)(D) deems whatever share of this
      // requirement is routed to charity to consist of includible dollars, and
      // that share is not known until the gift is sized.
      if (
        state.account.kind === 'ira' &&
        ownedIraApplication?.applicationKind === 'debit'
      ) {
        deferredRmdDistributions.push({
          ownerId,
          amount: take,
          occurrenceKind: 'ownedIraRmd',
          producerOccurrenceKey,
          sourceAccountId: state.account.id,
          mutationOrdinal: ownedIraApplication.mutationOrdinal,
        })
      }
    }

    // --- 72(t) SEPP: forced penalty-free early distributions (roadmap V8) ----
    // A substantially-equal periodic payment is taken like an RMD — outside the
    // need-based withdrawal flow, so it never attracts the early-withdrawal
    // penalty — and is taxable ordinary income that also supplies spending cash.
    let seppTotal = 0
    for (const state of balances) {
      if (state.account.type !== 'traditional' || !state.account.sepp || state.account.inherited) continue
      const ownerId = state.account.ownerPersonId ?? primary.id
      const ownerState = stateOf(ownerId)
      if (!ownerState.alive) continue
      const election = state.account.sepp
      if (!seppActive(election.startAge, ownerState.ageAttained)) continue
      // IRC 72(t)(3)(B): from an employer plan the series is excepted only if it
      // BEGINS AFTER the participant separates from service; the requirement
      // pointedly does not reach IRAs, so an IRA series may begin during
      // employment. The projection has no separation date and no employer
      // identity, so it orders calendar years rather than days, using the same
      // retirement-age proxy for separation that the Rule of 55 test below
      // uses: the participant is modelled as separated for the whole of the
      // FIRST YEAR THE WAGE MODEL STOPS PAYING THEM, so the separation ordinal
      // is that year's first day and the series ordinal is the last day of the
      // year it begins. That year is the attained age Math.ceil rounds the
      // retirement age up to, because wages run while attained age is below the
      // retirement age (Pass 1 above) and the Rule of 55 waives from the first
      // attained age that is not: for a retirement age of 65.5 the plan pays
      // them for the year they attain 65 and separates them in the year they
      // attain 66. Reading the fraction DOWN would separate them in a year they
      // are still paid. A plan with no retirement age states no separation at
      // all, so no employer-plan series can begin after one. Residual error
      // both ways: irc-72-t-3-B-sepp-separation-annual-proxy.
      if (state.account.kind === 'employer') {
        const ownerRetirementAge = personById.get(ownerId)!.retirementAge
        if (ownerRetirementAge === null) continue
        const birthYear = year - ownerState.ageAttained
        const separatedFrom = `${birthYear + Math.ceil(ownerRetirementAge)}-01-01`
        const seriesBegunBy = `${birthYear + election.startAge}-12-31`
        if (!seppSeriesBeginsAfterSeparation(seriesBegunBy, separatedFrom)) continue
      }
      const startBalance = startOfYearBalance.get(state.account.id) ?? 0
      let amount: number
      if (election.method === 'amortization') {
        // Fixed for the series: compute once from the first SEPP year's balance.
        // Notice 2022-6 section 3.02(d) treats the account balance as reasonably
        // determined if it is the balance on any date from December 31 of the
        // year before the first distribution through the date of that
        // distribution, and the start-of-year balance opens exactly that window.
        let fixed = seppAmortAmount.get(state.account.id)
        if (fixed === undefined) {
          fixed = seppAnnualAmount(pack, 'amortization', startBalance, ownerState.ageAttained)
          seppAmortAmount.set(state.account.id, fixed)
        }
        amount = fixed
      } else {
        amount = seppAnnualAmount(pack, 'rmd', startBalance, ownerState.ageAttained)
      }
      const take = Math.min(amount, state.balance)
      // The same discharge the required-distribution block above applies, for
      // the same reason: a series payment the exact-cent ledger records as zero
      // moves nothing, so it publishes no occurrence and adds nothing to
      // `seppTotal`. A 72(t) series against a sub-cent balance is reachable by
      // exactly the route the RMD one is -- any earlier movement that drained
      // the account to a residue the ledger cannot express.
      if (take <= 0 || planDollarsMoveNoLedgerCent(take)) continue
      const sourceBalanceBefore = state.balance
      state.balance -= take
      const kind = 'automaticSeppDistribution' as const
      const producerOccurrenceKey = runtimeOccurrenceKey(kind, state.account.id)
      recordAnnualRetirementRuntimeOccurrence({
        producerOccurrenceKey,
        kind,
        grossAmountPlanDollars: take,
        ownerPersonId: state.account.ownerPersonId,
        sourceAccountId: state.account.id,
        executionDate: null,
        executionSequence: null,
        movementAuthorityId: null,
      })
      let ownedIraApplication:
        SimulatorRetirementRuntimeApplication | null = null
      if (isAggregatedIra(state.account)) {
        ownedIraApplication = recordAnnualRetirementRuntimeApplication({
          applicationKind: 'debit',
          producerOccurrenceKey,
          simulatorPhase: 'automaticSeppDistribution',
          ownerPersonId: state.account.ownerPersonId,
          sourceAccountId: state.account.id,
          sourceBalanceBeforePlanDollars: sourceBalanceBefore,
          appliedAmountPlanDollars: take,
          sourceBalanceAfterPlanDollars: state.balance,
        })
      }
      seppTotal += take
      // Pro-rata return of basis on IRA SEPP distributions (step 5), deferred
      // for the same reason the required distribution above is: the year's
      // pro-rata denominator is not settled until the charitable gift is.
      if (
        state.account.kind === 'ira' &&
        ownedIraApplication?.applicationKind === 'debit'
      ) {
        deferredSeppDistributions.push({
          ownerId,
          amount: take,
          occurrenceKind: kind,
          producerOccurrenceKey,
          sourceAccountId: state.account.id,
          mutationOrdinal: ownedIraApplication.mutationOrdinal,
        })
      }
    }

    // --- Inherited IRA: exact-ledger execution (WS4) ------------------------
    // Two paths, chosen once from the per-simulation classification cache:
    //   1. Legacy (X1 / no-beneficiary / non-X1 refusal fallback): the prior
    //      inheritedForcedAmount behavior — byte-identical for two-field
    //      traditional accounts.
    //   2. Classified: inheritedRequirementForYear on the real prior-Dec-31
    //      balance. year-of-death-rmd / annual-rmd force min(required, balance)
    //      (noticeWaived amounts still execute); final-sweep takes the ENTIRE
    //      current balance; none forces 0. Regime law is never re-derived here.
    // S2: years before treatAsOwnElectionYear run the synthetic S0 schedule;
    // from the election year the account left this loop for owner RMD above.
    // K1/K2 (Roth): forced dollars are Roth-character — no ordinary income, no
    // penalty — and join the Roth withdrawal category; traditional forced still
    // supplies ordinary income. Evidence distinguishes required vs voluntary.
    let inheritedTotal = 0
    /** Traditional-character forced amount (ordinary income + traditional withdrawals). */
    let inheritedOrdinaryIncome = 0
    /** Roth-character forced amount (Roth withdrawals only; never ordinary income). */
    let inheritedRothForced = 0
    const inheritedYearEvidenceDraft: InheritedAccountYearEvidence[] = []
    for (const state of balances) {
      if (state.account.type !== 'traditional' && state.account.type !== 'roth') continue
      if (state.account.inherited === undefined) continue
      const cache = inheritedClassCache.get(state.account.id)
      if (cache === undefined) continue
      const beneficiary = personById.get(state.account.ownerPersonId ?? primary.id)!
      const beneficiaryState = stateOf(beneficiary.id)
      // Dead beneficiary: do not silently drop the schedule. Successor rules
      // after an EDB/spouse death are out of scope (matrix X2); emit a flag
      // row every post-death year. Checked before the S2 post-flip arm so a
      // dead beneficiary gets the successor row, never an owner-side row.
      if (!beneficiaryState.alive) {
        const primaryClass =
          cache.primary.kind === 'regime' ? cache.primary : undefined
        inheritedYearEvidenceDraft.push({
          accountId: state.account.id,
          ownerPersonId: cache.ownerPersonId,
          regime: primaryClass?.regime ??
            (cache.primary.kind === 'refusal' ? cache.primary.refusal : 'unsupported'),
          matrixRow: primaryClass?.row ??
            (cache.primary.kind === 'refusal' ? cache.primary.row : 'X2'),
          ...(primaryClass !== undefined
            ? { classification: primaryClass.classification }
            : {}),
          refusalReason:
            'beneficiary death starts the successor 10-year clock (IRC §401(a)(9)(H)(iii); Treas. Reg. §1.401(a)(9)-5(e)(3); matrix X2); successor schedules are out of scope',
          requirementKind: 'none',
          requiredAmount: 0,
          executedRequiredAmount: 0,
          voluntaryAmount: 0,
          disclosures: ['successor-clock-out-of-scope'],
          citations: primaryClass?.citations ??
            (cache.primary.kind === 'refusal'
              ? cache.primary.citations
              : [
                  'IRC §401(a)(9)(H)(iii)',
                  'Treas. Reg. §1.401(a)(9)-5(e)(3)',
                ]),
        })
        continue
      }
      // S2 post-election: owned-side bookkeeping owns the account this year
      // (except the same-year-flip death-year arm immediately below).
      if (isTreatAsOwnEffective(state.account, year)) {
        const primaryClass =
          cache.primary.kind === 'regime' ? cache.primary : undefined
        const preHorizonLimitation =
          year === startYear && cache.preHorizonYearOfDeathRmdUnresolved === true
            ? 'pre-horizon-year-of-death-rmd-unresolved' as const
            : undefined
        // §1.408-8(c)(3): when the treat-as-own election year equals the
        // owner's death year, the spouse takes no owner RMD that year but MUST
        // take the decedent's unsatisfied year-of-death RMD. Owner-side
        // treatment (followsOwnerRmdsThisYear / isAggregatedIraThisYear) is
        // already suppressed for this death year above; execute and evidence
        // the YOD requirement here before owner-side treatment begins the
        // following year.
        const sameYearFlipYodDue =
          year === state.account.inherited.ownerDeathYear &&
          primaryClass !== undefined &&
          primaryClass.rbdComparison === 'on-or-after-rbd' &&
          state.account.inherited.beneficiary?.ownerYearOfDeathRmdSatisfied !== true
        if (sameYearFlipYodDue) {
          const priorYearEndBalance = startOfYearBalance.get(state.account.id) ?? 0
          const req = inheritedRequirementForYear({
            pack,
            classification: primaryClass,
            inherited: state.account.inherited,
            year,
            priorYearEndBalance,
          })
          const requiredAmount = req.requiredAmount
          const take =
            req.kind === 'year-of-death-rmd'
              ? Math.min(req.requiredAmount, state.balance)
              : 0
          const executed =
            take > 0 && !planDollarsMoveNoLedgerCent(take) ? take : 0
          if (executed > 0) {
            state.balance -= executed
            const kind = 'inheritedIraRmd' as const
            const producerOccurrenceKey = runtimeOccurrenceKey(kind, state.account.id)
            recordAnnualRetirementRuntimeOccurrence({
              producerOccurrenceKey,
              kind,
              grossAmountPlanDollars: executed,
              ownerPersonId: state.account.ownerPersonId,
              sourceAccountId: state.account.id,
              executionDate: null,
              executionSequence: null,
              movementAuthorityId: null,
            })
            if (state.account.type === 'roth') {
              inheritedRothForced += executed
            } else {
              inheritedOrdinaryIncome += executed
            }
            inheritedTotal += executed
          }
          let limitation = req.limitation
          if (
            year === startYear &&
            cache.preHorizonYearOfDeathRmdUnresolved === true
          ) {
            limitation = 'pre-horizon-year-of-death-rmd-unresolved'
          }
          inheritedYearEvidenceDraft.push({
            accountId: state.account.id,
            ownerPersonId: cache.ownerPersonId,
            regime: primaryClass.regime,
            matrixRow: primaryClass.row,
            classification: primaryClass.classification,
            requirementKind: req.kind,
            requiredAmount,
            executedRequiredAmount: executed,
            // Owner-side draws after the flip are not inherited voluntary draws.
            voluntaryAmount: 0,
            ...(req.divisor !== undefined ? { divisor: req.divisor } : {}),
            ...(req.divisorArm !== undefined ? { divisorArm: req.divisorArm } : {}),
            ...(limitation !== undefined ? { limitation } : {}),
            disclosures: [...primaryClass.disclosures],
            citations: [...req.citations],
          })
          continue
        }
        inheritedYearEvidenceDraft.push({
          accountId: state.account.id,
          ownerPersonId: cache.ownerPersonId,
          regime: primaryClass?.regime ??
            (cache.primary.kind === 'refusal' ? cache.primary.refusal : 'spouse-treat-as-own-transition'),
          matrixRow: primaryClass?.row ??
            (cache.primary.kind === 'refusal' ? cache.primary.row : 'S2'),
          ...(primaryClass !== undefined
            ? { classification: primaryClass.classification }
            : {}),
          requirementKind: 'none',
          requiredAmount: 0,
          executedRequiredAmount: 0,
          // Owner-side draws after the flip are not inherited voluntary draws.
          voluntaryAmount: 0,
          ...(preHorizonLimitation !== undefined
            ? { limitation: preHorizonLimitation }
            : {}),
          disclosures: primaryClass?.disclosures ?? [],
          citations: primaryClass?.citations ??
            (cache.primary.kind === 'refusal' ? cache.primary.citations : []),
        })
        continue
      }

      const priorYearEndBalance = startOfYearBalance.get(state.account.id) ?? 0
      let take: number
      let requirementKind: InheritedAccountYearEvidence['requirementKind']
      let requiredAmount: number
      let divisor: number | undefined
      let divisorArm: string | undefined
      let noticeWaived: boolean | undefined
      let limitation: string | undefined
      let regime: string
      let matrixRow: string
      let classification: 'settled' | 'unsettled' | undefined
      let disclosures: string[]
      let citations: string[]
      let finalDeadlineYear: number | undefined
      const refusalReason = cache.refusalReason

      if (cache.path === 'legacy' || cache.schedule === undefined) {
        // Legacy path — byte-identical forced amount for two-field accounts.
        take = inheritedForcedAmount({
          pack,
          year,
          ownerDeathYear: state.account.inherited.ownerDeathYear,
          decedentHadStartedRmds: state.account.inherited.decedentHadStartedRmds,
          balance: state.balance,
          startBalance: priorYearEndBalance,
          beneficiaryAge: beneficiaryState.ageAttained,
        })
        requiredAmount = take
        requirementKind = 'legacy'
        if (cache.primary.kind === 'refusal') {
          regime = cache.primary.refusal
          matrixRow = cache.primary.row
          citations = cache.primary.citations
          disclosures = []
        } else {
          // S2 synthetic-S0 refusal fallback: primary remains the S2 regime
          // classification while the pre-election schedule refused. Label
          // needs-review / X5 with the cached reason (path is legacy only when
          // primary is refusal or this synthetic-refusal case).
          regime = 'needs-review'
          matrixRow = 'X5'
          citations = cache.primary.citations
          disclosures = []
        }
      } else {
        // Classified path — schedule from the cache (synthetic S0 for S2 pre-year).
        // For S2 pre-election the schedule class is S0; primary remains S2 for
        // matrix identity on post-election rows only (handled above).
        const scheduleClass = cache.schedule
        // S2 pre-election: the inherited facts for the calculator use election
        // 'none' so the S0 schedule is honest (WS3 S2 calculator still returns
        // treat-as-own-election-year-not-carried and is not consulted here).
        const inheritedForReq =
          cache.isS2 && state.account.inherited.beneficiary
            ? {
                ...state.account.inherited,
                beneficiary: {
                  ...state.account.inherited.beneficiary,
                  election: 'none' as const,
                },
              }
            : state.account.inherited
        const req = inheritedRequirementForYear({
          pack,
          classification: scheduleClass,
          inherited: inheritedForReq,
          year,
          priorYearEndBalance,
        })
        requirementKind = req.kind
        requiredAmount = req.requiredAmount
        divisor = req.divisor
        divisorArm = req.divisorArm
        noticeWaived = req.noticeWaived
        limitation = req.limitation
        if (req.kind === 'final-sweep') {
          // Ledger reconciles the live balance, not the prior-year-end figure.
          take = state.balance
        } else if (req.kind === 'none') {
          take = 0
        } else if (req.noticeWaived === true) {
          // Matrix §4 (relief years): notices make those annual amounts not
          // required. Evidence still publishes the computed amount with
          // noticeWaived true; executedRequiredAmount stays 0.
          // Unreachable at currently supported projection start years (notices
          // cover distribution years 2021–2024 for deaths 2020–2023); implement
          // per the matrix regardless so a pre-2025 start never forces them.
          take = 0
        } else {
          // year-of-death-rmd / annual-rmd
          take = Math.min(req.requiredAmount, state.balance)
        }
        regime = scheduleClass.regime
        matrixRow = scheduleClass.row
        classification = scheduleClass.classification
        disclosures = [...scheduleClass.disclosures]
        citations = [...req.citations]
        finalDeadlineYear = scheduleClass.finalDeadlineYear
      }

      // Pre-horizon year-of-death RMD: obligation predates startYear and is not
      // modeled as satisfied (§1.408-8(e)(4)(i)). First projection year only;
      // no amount is forced beyond the year's ordinary schedule.
      if (
        year === startYear &&
        cache.preHorizonYearOfDeathRmdUnresolved === true
      ) {
        limitation = 'pre-horizon-year-of-death-rmd-unresolved'
      }

      // Discharged on the same terms as the owner's own forced distribution.
      // A zero-cent inherited distribution must not journal: the runtime source
      // series reads every occurrence, and a sub-cent gross refuses the year.
      const executed =
        take > 0 && !planDollarsMoveNoLedgerCent(take) ? take : 0
      if (executed > 0) {
        state.balance -= executed
        // Distinct forced kind from voluntary need-based draws
        // (`legacyNeedBasedWithdrawal`) and from owned RMD (`ownedIraRmd`).
        // Required and final-sweep share this kind (mutually exclusive per year);
        // the evidence row's requirementKind separates them.
        const kind = 'inheritedIraRmd' as const
        const producerOccurrenceKey = runtimeOccurrenceKey(kind, state.account.id)
        recordAnnualRetirementRuntimeOccurrence({
          producerOccurrenceKey,
          kind,
          grossAmountPlanDollars: executed,
          ownerPersonId: state.account.ownerPersonId,
          sourceAccountId: state.account.id,
          executionDate: null,
          executionSequence: null,
          movementAuthorityId: null,
        })
        if (state.account.type === 'roth') {
          // Roth character: non-taxable and penalty-free (K1/K2). Outside the
          // beneficiary's owned-Roth basis/ordering pool — do not deplete
          // owned basis. K3 non-qualified earnings tax is disclosure-only.
          inheritedRothForced += executed
        } else {
          inheritedOrdinaryIncome += executed
        }
        inheritedTotal += executed
      }

      inheritedYearEvidenceDraft.push({
        accountId: state.account.id,
        ownerPersonId: cache.ownerPersonId,
        regime,
        matrixRow,
        ...(classification !== undefined ? { classification } : {}),
        ...(refusalReason !== undefined ? { refusalReason } : {}),
        requirementKind,
        requiredAmount,
        executedRequiredAmount: executed,
        voluntaryAmount: 0, // filled after need-based withdrawals
        ...(divisor !== undefined ? { divisor } : {}),
        ...(divisorArm !== undefined ? { divisorArm } : {}),
        ...(noticeWaived !== undefined ? { noticeWaived } : {}),
        ...(limitation !== undefined ? { limitation } : {}),
        ...(finalDeadlineYear !== undefined ? { finalDeadlineYear } : {}),
        disclosures,
        citations,
      })
    }

    // QCD: charitable dollars distributed from an IRA and excluded from income.
    //
    // IRC 408(d)(8) turns on the donor having attained age 70½ and does not
    // require an RMD, so this is not "dollars routed out of the RMD". Gating on
    // rmdTotal > 0 removed the entire pre-RMD window -- ages 70½ to the
    // applicable age, which is 75 for the 1960-and-later cohort, about four and
    // a half years -- and that window is where a QCD is most valuable, because
    // there is no RMD to carry the gift out of income.
    //
    // Age 70½ is resolved from the birth month rather than approximated: a
    // person born in months 1-6 reaches 70½ inside the year they attain 70.
    // Within-year timing is not modelled, so a gift dated before the
    // half-birthday counts; that is the annual-granularity convention.
    let qcd = 0
    // Gross dollars routed out of the owned-IRA RMD. That RMD already counted
    // these as a cash inflow, so this is what cash must give back. The cap is
    // the owned-IRA share of the forced total, not the whole of it:
    // 408(d)(8)(B) reaches only a distribution from an individual retirement
    // plan, so an employer-plan RMD cannot carry a gift out of income and a
    // donor with no IRA RMD at all has nothing here to route.
    let qcdFromRmd = 0
    // Income reduction. Only the RMD entered income, so this is the routed
    // owned-IRA GROSS that qualified under 408(d)(8)(D) -- never the part taken
    // beyond the RMD, which never entered income at all and would be a phantom
    // deduction, and never a share of the routed dollars, because (D) deems the
    // gift to consist of includible dollars and it therefore returns no basis.
    // Its ceiling is the statute's aggregate measure, settled per owner below.
    let qcdIncomeOffset = 0
    /**
     * Charitable dollars that could NOT be a QCD, because the gift ran past the
     * owner's whole 408(d)(8)(D) aggregate includible amount, and that were
     * taken beyond the required distribution rather than out of it.
     *
     * They are an ordinary distribution: they belong on Form 8606 line 7, they
     * recover basis pro-rata, and their taxable share is income the required
     * distribution never booked for them. The from-RMD half of the same excess
     * needs no term of its own -- those dollars are already inside `rmdTotal`,
     * and leaving them out of `qcdIncomeOffset` is the whole of their treatment.
     */
    let qcdNonQualifiedOrdinaryIncome = 0
    // A named QCD request is authoritative for the year, exactly as a named
    // conversion is at the aggregate conversion gate below: "an aggregate
    // fallback would debit different sources and hide that result". Without
    // this the two arms both run and the household gives twice — once from the
    // scalar and once from the action. Nothing in the suite combined the two
    // arms before this guard, which is why the defect could have shipped
    // unnoticed; simulate.qcdNamedSuppression.test.ts now does, and fails
    // without the condition below.
    //
    // Counted here from the Plan rather than reusing `currentYearActions`,
    // which is not filtered until well below this block. Moving this block down
    // to reach it would reorder the balance mutations that the owned-IRA
    // runtime source series validates in mutation order, which is a much larger
    // change than the guard is worth.
    //
    // This suppressed nothing when it was written — the QCD executor published
    // a named request's prerequisite and nothing else — and it is load-bearing
    // now: PR #213 made a committed named QCD debit its source below, so
    // without this gate the scalar arm would give a second time from the same
    // IRAs in the same year.
    const hasNamedQcdRequest = passRetirementActions.some(
      (request) => request.year === year && request.kind === 'qcd',
    )
    /**
     * The scalar gift, charged to the owners whose IRAs actually funded it.
     *
     * 408(d)(8)(D) measures the gift against ONE owner's individual retirement
     * plans treated as one contract, and every owner has their own Form 8606
     * denominator, so an unattributed household scalar cannot be measured at
     * all. The from-RMD half is attributed in proportion to each owner's share
     * of the owned-IRA required distribution the gift is capped against; the
     * beyond-RMD half is attributed exactly, at the account it drains.
     */
    const qcdGrossByOwner = new Map<string, number>()
    /** The part of each owner's gift routed out of their required distribution. */
    const qcdFromRmdByOwner = new Map<string, number>()
    const addGiftGross = (
      target: Map<string, number>, ownerId: string, amount: number,
    ) => { target.set(ownerId, (target.get(ownerId) ?? 0) + amount) }
    if (plan.strategies.qcdAnnual > 0 && !hasNamedQcdRequest) {
      const donorIds = new Set(peopleStates
        .filter((s) => s.alive && (s.ageAttained >= 71 ||
          (s.ageAttained === 70 && (birthMonthByPerson.get(s.personId) ?? 1) <= 6)))
        .map((s) => s.personId))
      if (donorIds.size > 0) {
        /**
         * IRC 408(d)(8)(A) excludes qualified charitable distributions "with
         * respect to a taxpayer" up to a dollar amount that (G) indexes, so the
         * limit is one PERSON'S and a married couple filing jointly has two of
         * them. The household ask is therefore capped at the sum of the living
         * donors' own limits and each donor is separately held to theirs below;
         * capping the household scalar at a single limit, which is what this
         * arm did until 2026-08-07, understated a couple giving more than one
         * limit out of genuinely separate IRAs.
         *
         * Every donor takes the same indexed figure because (A) states one
         * amount and (G) indexes that one amount; nothing in the section makes
         * it depend on the donor's age, filing status, or which IRA gave.
         */
        const perDonorLimit = pack.rmd.qcdAnnualLimit * limitGrowth
        /** What each donor may still exclude this year, spent down as the gift is charged. */
        const donorCapacity = new Map<string, number>(
          [...donorIds].map((donorId) => [donorId, perDonorLimit]),
        )
        const requested = Math.min(
          plan.strategies.qcdAnnual * inflFactor,
          perDonorLimit * donorIds.size,
        )
        qcdFromRmd = Math.min(requested, ownedIraRmdTotal)
        // Charged to owners in proportion to the owned-IRA requirement it is
        // capped against. Every owner carrying such a requirement has reached
        // the applicable age, which is above 70½ in every year the pack covers,
        // so each of them is already a donor and none of this gift lands on an
        // IRA that could not lawfully have funded it under 408(d)(8)(B)(ii).
        // The last owner takes the rounding residue so the shares sum exactly,
        // and the owners iterate in sorted id order so the residue's home does
        // not depend on plan account ordering.
        if (qcdFromRmd > 0 && ownedIraRmdTotal > 0) {
          const owners = [...ownedIraRmdGrossByOwner.keys()].sort()
          /**
           * The most this owner may route out of a required distribution: their
           * own requirement, because 1.408-8(e)(2)(i) aggregates only one
           * individual's own IRAs and no proportional share may reach past it,
           * and their own remaining (A) limit. An owner who is somehow not a
           * donor routes nothing rather than defaulting to a whole limit.
           */
          const routable = (ownerId: string): number => Math.min(
            ownedIraRmdGrossByOwner.get(ownerId) ?? 0,
            donorCapacity.get(ownerId) ?? 0,
          )
          const shares = new Map<string, number>()
          let assigned = 0
          owners.forEach((ownerId, index) => {
            // Each share is clamped to what is left, and the last owner's
            // residue to zero: floating error in the proportional shares can
            // push `assigned` a hair past the gift, and a negative share would
            // leak into the 408(d)(8)(D) ceiling and denominator arithmetic.
            const remaining = Math.max(0, qcdFromRmd - assigned)
            const proportional = index === owners.length - 1
              ? remaining
              : Math.min(
                  remaining,
                  qcdFromRmd * (ownedIraRmdGrossByOwner.get(ownerId)! / ownedIraRmdTotal),
                )
            const share = Math.min(proportional, routable(ownerId))
            assigned += share
            shares.set(ownerId, share)
          })
          // REALLOCATION CONVENTION. What one donor's own limit refused is
          // offered to the other donors, in sorted owner id order, up to what
          // each of them may still route — their unrouted requirement and their
          // unspent limit. Sorted order rather than proportional a second time
          // because the household scalar carries no donor intent to honour: the
          // statute says nothing about whose gift it is, so the tie is broken by
          // the same stable key the residue rule above already uses rather than
          // by plan account ordering. Whatever no donor can route falls through
          // to the beyond-requirement arm below, which charges it against the
          // same capacities; whatever that arm cannot place either is not given.
          let unassigned = Math.max(0, qcdFromRmd - assigned)
          for (const ownerId of owners) {
            if (unassigned <= 0) break
            const slack = routable(ownerId) - (shares.get(ownerId) ?? 0)
            if (slack <= 0) continue
            const extra = Math.min(unassigned, slack)
            shares.set(ownerId, (shares.get(ownerId) ?? 0) + extra)
            unassigned -= extra
            assigned += extra
          }
          // The routed total is what the owners could actually carry, not what
          // the household asked for. `qcdFromRmd` is the cash the year gives
          // back out of the required distribution and the gross the nonmoving
          // overlay publishes, so both follow the attribution rather than the
          // request.
          qcdFromRmd = assigned
          for (const [ownerId, share] of shares) {
            if (share <= 0) continue
            addGiftGross(qcdFromRmdByOwner, ownerId, share)
            addGiftGross(qcdGrossByOwner, ownerId, share)
            donorCapacity.set(
              ownerId, Math.max(0, (donorCapacity.get(ownerId) ?? 0) - share),
            )
          }
        }
        const beyondRmd = requested - qcdFromRmd
        if (beyondRmd > 0) {
          const sources = balances.filter((state) =>
            isAggregatedIra(state.account) && state.balance > 0 &&
            donorIds.has(state.account.ownerPersonId ?? primary.id))
          const available = sources.reduce((sum, state) => sum + state.balance, 0)
          let remaining = Math.min(beyondRmd, available)
          for (const state of sources) {
            if (remaining <= 0) break
            // The donor's own 408(d)(8)(A) limit binds these dollars exactly as
            // it binds the routed half: this account belongs to one taxpayer, so
            // what it may give is what that taxpayer has left to exclude. An
            // owner already at their limit is passed over rather than drained,
            // and the ungiven remainder is offered to the next donor's accounts.
            const beyondRmdOwnerId = state.account.ownerPersonId ?? primary.id
            const ownerCapacity = donorCapacity.get(beyondRmdOwnerId) ?? 0
            if (ownerCapacity <= 0) continue
            const allowance = Math.min(remaining, ownerCapacity)
            // A gift that drains its source takes every whole cent the account
            // can fund and not the fraction it cannot. That is the same
            // truncation the named arm applies to its opening snapshot, reached
            // here through the drain instead of through a snapshot: the whole
            // float balance includes a fraction of a cent that no custodian can
            // transfer, and publishing an occurrence for it asks the exact-cent
            // journal to hold a gross it has no way to express.
            //
            // The exact-cent conversion is unconditional inside this branch
            // rather than guarded, because the branch is reached only where the
            // allowance meets or exceeds the balance, and that allowance is
            // capped above at one donor's sourced annual QCD limit -- so the
            // balance crossing the boundary here is bounded by that limit and
            // cannot leave the safe-integer cent range.
            const take = allowance >= state.balance
              ? ledgerCentsToPlanDollars(planDollarsToFlooredLedgerCents(state.balance))
              : allowance
            // And a draw the ledger records as zero gives nothing: the residue
            // left by a drain, or an ungiven remainder that has fallen below a
            // cent, is skipped whole rather than moved and journalled as a
            // gift of nothing.
            if (planDollarsMoveNoLedgerCent(take)) continue
            const sourceBalanceBefore = state.balance
            state.balance -= take
            remaining -= take
            qcd += take
            donorCapacity.set(
              beyondRmdOwnerId, Math.max(0, ownerCapacity - take),
            )
            addGiftGross(qcdGrossByOwner, beyondRmdOwnerId, take)
            // These dollars leave the owned IRA on their own account, with no
            // RMD debit to explain them. Owned-IRA balance re-join validation
            // requires every such change to be captured here, at the mutation
            // site, exactly as the RMD and SEPP distributions above are.
            const kind = 'legacyQcd' as const
            const producerOccurrenceKey =
              runtimeOccurrenceKey(kind, state.account.id)
            recordAnnualRetirementRuntimeOccurrence({
              producerOccurrenceKey,
              kind,
              grossAmountPlanDollars: take,
              ownerPersonId: state.account.ownerPersonId,
              sourceAccountId: state.account.id,
              executionDate: null,
              executionSequence: null,
              movementAuthorityId: null,
            })
            const giftApplication = recordAnnualRetirementRuntimeApplication({
              applicationKind: 'debit',
              producerOccurrenceKey,
              simulatorPhase: 'legacyQcdDistribution',
              ownerPersonId: state.account.ownerPersonId,
              sourceBalanceBeforePlanDollars: sourceBalanceBefore,
              sourceAccountId: state.account.id,
              appliedAmountPlanDollars: take,
              sourceBalanceAfterPlanDollars: state.balance,
            })
            // Held back for the 408(d)(8)(D) block below, exactly as the forced
            // distributions above are and for the same reason: how much of this
            // draw is a QUALIFIED charitable distribution is not knowable until
            // the whole gift has been measured against the owner's aggregate
            // includible amount, and (B)'s closing sentence makes the unqualified
            // part an ordinary distribution rather than a gift.
            if (giftApplication.applicationKind === 'debit') {
              deferredLegacyQcdDistributions.push({
                ownerId: beyondRmdOwnerId,
                amount: take,
                producerOccurrenceKey,
                sourceAccountId: state.account.id,
                mutationOrdinal: giftApplication.mutationOrdinal,
              })
            }
          }
        }
        qcd += qcdFromRmd
        // The scalar gift has no donor, so it is charged to every eligible one.
        // It is a real post-70½ charitable distribution whose share of the
        // deductible-contribution offset this engine does not compute, so from
        // this year on no named gift by these donors can state its own prior
        // offset consumption. Recorded here rather than inferred later: the
        // named arm stands the scalar down, so a year that reaches this line is
        // the only place the fact exists.
        if (qcd > 0) for (const donorId of donorIds) {
          namedQcdOffsetHistoryUnprovable.add(donorId)
        }
      }
    }

    // --- IRC 408(d)(8)(D): the gift first, then this year's section 72 -------
    //
    // "Notwithstanding section 72, in determining the extent to which a
    // distribution is a qualified charitable distribution, the entire amount of
    // the distribution shall be treated as includible in gross income ... to the
    // extent that such amount does not exceed the aggregate amount which would
    // have been so includible if all amounts in all individual retirement plans
    // of the individual were distributed during such taxable year and all such
    // plans were treated as 1 contract ... Proper adjustments shall be made in
    // applying section 72 to other distributions in such taxable year".
    //
    // Three things follow, and this block is all three:
    //
    // 1. THE CEILING is the owner's whole aggregate includible amount --
    //    pre-distribution aggregated owned-IRA balance minus aggregate basis --
    //    and not the taxable share of this year's requirement. A required
    //    distribution is a small fraction of a balance, so the statutory ceiling
    //    is normally far higher and simply does not bind.
    // 2. THE GIFT RETURNS NO BASIS, because (D) deems it to consist of
    //    includible dollars. So `qcdIncomeOffset` is the routed GROSS.
    // 3. THE PROPER ADJUSTMENT for the year's other distributions is the one the
    //    Form 8606 line-7 instructions spell out -- "Don't include any of the
    //    following on line 7 ... Qualified charitable distributions (QCDs)" --
    //    so the gift leaves the line-7 numerator AND the annual denominator,
    //    while the whole of the year's basis survives as the numerator of the
    //    ratio. Line 6 is already net of the gift and line 7 never gains it, so
    //    the denominator is the pre-distribution pool less the qualified gift.
    //
    // This is the same arithmetic the named arm settles in exact cents --
    // `annualQcdTaxCharacterPostPass.ts`, registered as
    // `irc-408-d-8-D-qcd-taxable-first`, where the residual denominator is
    // likewise `taxablePoolGrossBalanceBefore − qualifiedCharitableDistribution`
    // against an unreduced basis numerator. Reaching it here required deferring
    // the forced distributions' splits past the gift, not a second derivation.
    //
    // A gift that runs past the aggregate includible amount is NOT a QCD in the
    // excess, under (D) read with (B)'s closing sentence ("A distribution shall
    // be treated as a qualified charitable distribution only to the extent that
    // the distribution would be includible in gross income"). The excess is an
    // ordinary distribution: it stays in the denominator, stays on line 7, and
    // recovers basis. It is charged against the from-RMD half of the gift first,
    // where those dollars are already inside `rmdTotal` and inside the line-7
    // gross, so no term has to be invented for them; only what is left over is
    // carried on `qcdNonQualifiedOrdinaryIncome` below.
    //
    // (d)(8)(A)'s own limit is separate and applies earlier: `requested` is
    // already capped at the year's sourced annual limit, so the exclusion can
    // never exceed it and no second clamp is needed here. The (A) reduction for
    // post-70½ deductible contributions is not modelled in this arm at all --
    // that is what `namedQcdOffsetHistoryUnprovable` above records.
    const qcdQualifiedFromRmdByOwner = new Map<string, number>()
    const qcdNonQualifiedBeyondRmdByOwner = new Map<string, number>()
    const proRataOwnerIds = new Set<string>([...qcdGrossByOwner.keys()])
    for (const [ownerId, basis] of iraBasisByOwner) {
      if (basis > 0) proRataOwnerIds.add(ownerId)
    }
    for (const ownerId of proRataOwnerIds) {
      const basis = Math.max(0, iraBasisByOwner.get(ownerId) ?? 0)
      const preDistribution =
        preDistributionAggregateIraBalance.get(ownerId) ?? 0
      const gift = qcdGrossByOwner.get(ownerId) ?? 0
      const fromRmd = Math.min(gift, qcdFromRmdByOwner.get(ownerId) ?? 0)
      const aggregateIncludible = Math.max(0, preDistribution - basis)
      const qualified = Math.min(gift, aggregateIncludible)
      const nonQualified = gift - qualified
      // The excess lands on the from-RMD dollars first; whatever it cannot
      // absorb there is beyond-RMD gift that has to be booked as income.
      const nonQualifiedFromRmd = Math.min(fromRmd, nonQualified)
      qcdQualifiedFromRmdByOwner.set(ownerId, fromRmd - nonQualifiedFromRmd)
      qcdNonQualifiedBeyondRmdByOwner.set(
        ownerId, nonQualified - nonQualifiedFromRmd,
      )
      qcdIncomeOffset += fromRmd - nonQualifiedFromRmd
      if (basis > 0) {
        iraProRata.set(
          ownerId, openIraProRataYear(basis, preDistribution - qualified),
        )
      }
    }
    /**
     * Commit the forced distributions held back above, in the order they moved,
     * carving each owner's qualified gift out of the line-7 gross first.
     *
     * The carve is greedy across an owner's entries rather than spread over
     * them, and the owner's TOTAL basis recovery is the same either way: the
     * year's fraction is owner-wide and `splitIraDistribution` caps every draw
     * at the basis that is left.
     *
     * A CARVE YEAR SETTLES, and the carve is half of what makes it settle. This
     * note said the opposite until 2026-08-07: a carve existed only where the
     * gift was routed out of a required distribution, that was exactly the shape
     * `ownedNonRothIraRuntimeSourceSeries.ts` refused with `qcdStageRequired`,
     * and `assumedEffects` was empty for the whole year. The refusal is gone.
     * The nonmoving overlay now carries the per-owner attribution settled just
     * above -- the routed gross, and the qualified part of it -- and the source
     * series carves that qualified amount out of the owner's line-7 gross by
     * walking the same applications in the same mutation order this loop walks
     * its entries in.
     *
     * SO THE ORDER HERE IS LOAD-BEARING, where it used to be arbitrary. The
     * settlement matches an assumed effect only when its gross agrees to the
     * cent, so an entry whose carve the replay placed differently would find no
     * effect and fall back to the pro-rata computation -- correct, but not
     * settled. Greedy-in-mutation-order on both sides is what makes the two
     * agree; the owner's TOTAL basis recovery would be the same either way,
     * which is why the choice is free and why it has to be the same choice.
     *
     * `splitWithAssumedCharacter` is therefore what is called, and its fallback
     * is the honest one for an entry no effect describes: a settlement effect
     * computed for a whole distribution does not describe the part that went to
     * charity.
     */
    /**
     * The basis share this year's annuity-contract payments recovered.
     *
     * IRC 408(d)(2)(B) treats all distributions during a taxable year as one
     * distribution, so a payment out of a contract an owned IRA bought takes
     * the same fraction of basis as every other distribution the aggregate
     * makes -- Publication 590-B says so in terms for an IRA holding both
     * deductible and nondeductible contributions. The income block already
     * added the whole payment to `ordinaryIncome`, because the year's fraction
     * is not knowable there; this takes the settled basis part back out, in
     * exactly the way `rmdNontaxable` does for a required distribution.
     *
     * IT DRAWS ON NO FALLBACK, and that is deliberate. Where the settlement
     * publishes nothing for a payment, the payment stays fully ordinary rather
     * than being split against the legacy pro-rata state. That state is opened
     * on a pre-distribution pool the contract is NOT in, so splitting against
     * it would hand the payment a share of a fraction computed as though the
     * contract did not exist -- a second approximation invented to paper over
     * the first. Fully ordinary is the registered legacy treatment; a year that
     * cannot settle keeps it and says so.
     *
     * ASKED UNDER THE POOL OWNER, which is the funding IRA's and not the
     * contract's. The settlement allocates the year's basis one owner-wide
     * aggregate at a time and publishes each effect under that owner, so a
     * lookup keyed on the contract's own `ownerPersonId` finds nothing whenever
     * a Plan names one spouse's contract against the other's IRA -- and finding
     * nothing here is silent, because the settlement has already spent the
     * basis on the allocation it published. The recovery is charged to the same
     * owner's pro-rata basis so the year's other distributions cannot recover
     * it a second time.
     */
    let annuityPaymentNontaxable = 0
    for (const payment of annuityContractDistributions) {
      const assumed = resolveAssumedCharacter({
        ownerPersonId: payment.poolOwnerPersonId,
        calculationScope: 'form8606Line7Distributions',
        occurrenceKind: 'annuityContractDistribution',
        producerOccurrenceKey: payment.producerOccurrenceKey,
        sourceAccountId: payment.annuityAccountId,
        mutationOrdinal: payment.mutationOrdinal,
        grossAmountPlanDollars: payment.grossAmountPlanDollars,
      })
      if (assumed === null || assumed.basisReturn <= 0) continue
      annuityPaymentNontaxable += assumed.basisReturn
      const proRata = iraProRata.get(payment.poolOwnerPersonId)
      if (proRata !== undefined) {
        iraProRata.set(payment.poolOwnerPersonId, {
          basis: Math.max(0, proRata.basis - assumed.basisReturn),
          nontaxableFraction: proRata.nontaxableFraction,
        })
      }
    }
    const commitDeferredForcedDistributions = (
      entries: readonly DeferredForcedIraDistribution[],
      carveByOwner: Map<string, number>,
      credit: (nontaxable: number) => void,
    ) => {
      for (const entry of entries) {
        const carve = Math.min(carveByOwner.get(entry.ownerId) ?? 0, entry.amount)
        if (carve > 0) {
          carveByOwner.set(entry.ownerId, (carveByOwner.get(entry.ownerId) ?? 0) - carve)
        }
        const line7Gross = entry.amount - carve
        const proRata = iraProRata.get(entry.ownerId)
        if (proRata === undefined || line7Gross <= 0) continue
        const split = splitWithAssumedCharacter(proRata, line7Gross, {
          ownerPersonId: entry.ownerId,
          calculationScope: 'form8606Line7Distributions',
          occurrenceKind: entry.occurrenceKind,
          producerOccurrenceKey: entry.producerOccurrenceKey,
          sourceAccountId: entry.sourceAccountId,
          mutationOrdinal: entry.mutationOrdinal,
        })
        iraProRata.set(entry.ownerId, split.next)
        credit(split.nontaxable)
      }
    }
    commitDeferredForcedDistributions(
      deferredRmdDistributions,
      new Map(qcdQualifiedFromRmdByOwner),
      (nontaxable) => { rmdNontaxable += nontaxable },
    )
    commitDeferredForcedDistributions(
      deferredSeppDistributions,
      new Map<string, number>(),
      (nontaxable) => { seppNontaxable += nontaxable },
    )
    // The beyond-RMD excess, last, because the gift moves after both forced
    // distributions.
    //
    // CHARGED TO THE OCCURRENCES THAT MOVED IT, one draw at a time, rather than
    // as one lump per owner. IRC 408(d)(8)(B)'s closing sentence treats a
    // distribution as a qualified charitable distribution "only to the extent
    // that the distribution would be includible in gross income", so the part of
    // this gift past the (D) aggregate cap was never a QCD at all: it is an
    // ordinary distribution belonging on Form 8606 line 7, inside the line-9
    // denominator, recovering basis pro rata. The Form 8606 line-7 instructions
    // exclude "Qualified charitable distributions (QCDs)" by name and nothing
    // else, which is the whole of the authority for keeping the qualified part
    // off the line and none at all for keeping the rest off it.
    //
    // A LUMP CANNOT SAY WHICH ACCOUNT'S DRAW IT WAS, and the replay needs that:
    // it prices Form 8606 line by line, per occurrence. So the owner's excess is
    // charged greedily across their own draws in mutation order -- the same
    // convention, and the same order, the drain above created them in -- and the
    // per-occurrence result is published on the year so the replay reads it
    // instead of reconstructing it.
    //
    // ITS TAXABLE SHARE IS PROVABLY ZERO ON THIS LEDGER, and the term is here
    // anyway because the proof is what makes the surrounding arithmetic safe to
    // change. Any excess at all means the qualified amount took the owner's
    // WHOLE aggregate includible amount, so this ledger's residual denominator
    // is the basis itself, its fraction is exactly 1, and every dollar the pool
    // still holds is basis. The excess could only be taxed if the forced
    // distributions had already spent that basis — and they cannot have, because
    // the dollars available to fund a beyond-requirement gift are what survives
    // them. The proof is about THIS ledger's pre-distribution denominator and
    // not about the settlement's close-of-year one, which is why the split now
    // asks for the assumed character first: where the settlement priced the
    // year, its figure supersedes, and it is not required to agree that the
    // fraction was 1.
    const legacyQcdExcessByOwner = new Map(qcdNonQualifiedBeyondRmdByOwner)
    for (const entry of deferredLegacyQcdDistributions) {
      const remainingExcess = Math.max(
        0, legacyQcdExcessByOwner.get(entry.ownerId) ?? 0,
      )
      const nonQualified = Math.min(remainingExcess, entry.amount)
      legacyQcdCharacterizations.push({
        producerOccurrenceKey: entry.producerOccurrenceKey,
        ownerPersonId: entry.ownerId,
        grossAmountPlanDollars: entry.amount,
        nonQualifiedLine7GrossPlanDollars: nonQualified,
      })
      if (nonQualified <= 0) continue
      legacyQcdExcessByOwner.set(entry.ownerId, remainingExcess - nonQualified)
      const proRata = iraProRata.get(entry.ownerId)
      if (proRata === undefined) continue
      const split = splitWithAssumedCharacter(proRata, nonQualified, {
        ownerPersonId: entry.ownerId,
        calculationScope: 'form8606Line7Distributions',
        occurrenceKind: 'legacyQcd',
        producerOccurrenceKey: entry.producerOccurrenceKey,
        sourceAccountId: entry.sourceAccountId,
        mutationOrdinal: entry.mutationOrdinal,
      })
      iraProRata.set(entry.ownerId, split.next)
      qcdNonQualifiedOrdinaryIncome += split.taxable
    }

    // --- exact-cent identity-bearing ordinary withdrawals ------------------
    // The exact-cent executor owns current-year action ordering and debits named
    // sources here. Its movement remains outside the legacy withdrawal map so
    // the final legacy apply loop cannot debit an action source a second time.
    const currentYearActions = passRetirementActions.filter(
      (request) => request.year === year,
    )
    const currentYearOrdinaryActions = currentYearActions.filter(
      (request) => request.kind === 'ordinaryWithdrawal',
    )
    const currentYearConversionActions = currentYearActions.filter(
      (request) => request.kind === 'rothConversion',
    )
    const currentYearNonConversionActions = currentYearActions.filter(
      (request) => request.kind !== 'rothConversion',
    )
    const currentYearSchedule = evaluateRetirementActionSchedule(
      year,
      currentYearActions,
    )
    const mixedKindScheduleBlocked =
      currentYearSchedule.scheduleIssues.length > 0 &&
      currentYearNonConversionActions.length > 0 &&
      currentYearConversionActions.length > 0
    const currentYearQcdActions = currentYearActions.filter(
      (request): request is QualifiedCharitableDistributionRequest =>
        request.kind === 'qcd',
    )
    // The annual publication coordinator excuses a schedule collision only
    // between records of the same executor source
    // (`annualRetirementActionPublication.ts` `diagnosedWithinSource`), so a QCD
    // sharing a slot with a non-QCD action has to stay with the ordinary
    // executor: split across two sources the same collision would abort the
    // whole publication instead of being reported. This is decided per action,
    // not per year -- the whole colliding slot moves, and a QCD scheduled
    // elsewhere is untouched by someone else's collision. A QCD-only slot needs
    // no exception, because both sides of it publish through the qcdExecutor,
    // which reports the collision through its own schedule diagnostics.
    const currentYearQcdActionIds = new Set(
      currentYearQcdActions.map((request) => request.actionId),
    )
    const crossKindCollidingQcdActionIds = new Set(
      currentYearSchedule.scheduleIssues.flatMap((issue) =>
        issue.kind === 'executionSequenceConflict' &&
        issue.collidingActionIds.some((actionId) =>
          !currentYearQcdActionIds.has(actionId))
          ? issue.collidingActionIds.filter((actionId) =>
              currentYearQcdActionIds.has(actionId))
          : []),
    )
    const currentYearQcdExecutionActions = currentYearQcdActions.filter(
      (request) => !crossKindCollidingQcdActionIds.has(request.actionId),
    )
    // A named QCD leaves the ordinary executor's scope because its own executor
    // publishes it, and `publishAnnualRetirementActions` throws when two
    // executors publish the same action.
    const currentYearOrdinaryExecutionActions = (mixedKindScheduleBlocked
      ? currentYearActions
      : currentYearNonConversionActions
    ).filter((request) =>
      request.kind !== 'qcd' ||
      crossKindCollidingQcdActionIds.has(request.actionId))
    // One conversion-linked withdrawal group decision for the whole annual
    // pass, taken here because this is the only place every request set is
    // visible at once. Neither executor sees the same set: the conversion
    // executor is handed conversions alone, and the withdrawal executor is
    // handed non-conversion actions -- except when `mixedKindScheduleBlocked`,
    // where it receives the whole schedule including conversions. So neither
    // can derive the same groups the other would, and a group spanning a Plan
    // action and an in-flight one is visible to neither. Both are given this
    // one verdict so the pair cannot be answered two ways within a year.
    // The Plan half of this set is `currentYearActions` — `passRetirementActions`
    // narrowed to this year — and both halves of that matter.
    //
    // It is `passRetirementActions` rather than the Plan's own array because a
    // counterfactual that removed a conversion from the executors but left it
    // visible here would still have its group assessed, and the group verdict
    // is what both executors answer to.
    //
    // It is narrowed to this year because a pass may only answer for the year
    // it is running. `assessConversionLinkedWithdrawalGroups` has no year
    // predicate of its own — membership is read off the conversion side alone —
    // so handing it the Plan's whole multi-year array made every year's groups
    // a member of every year's annual group. Two independent consequences
    // followed and either alone was fatal: another year's conversion has no
    // execution evidence in this one, so its `allocationWeight` is null and the
    // whole annual evaluation refuses `allocationWeightUnavailable`; and the
    // release is all-or-nothing across the candidate set, so the other year's
    // pair had to be authorized too, whereupon `withdrawalLegsMovedWhole` found
    // no withdrawal evidence for it and revoked every release. A plan holding
    // one self-funding pair in each of two years could therefore never move
    // either of them. The all-or-nothing rule is right and stays; it is a rule
    // about one filing unit in one year, and the set was what was wrong.
    //
    // This is also what makes the omission set above honest. It is already
    // keyed on `request.year === year`, and its docblock claims the assessment
    // "reads the same conversions out of the same array" — a claim that was
    // false for exactly as long as this set was unscoped.
    //
    // The baseline's availability is what decides between the two funding
    // reason codes. A run that read a `T0` held the inputs the funding question
    // needs, so a group it refuses is refused on the merits; a run that did not
    // is declining to answer, which is what `unsupported` says.
    const linkedGroupAssessmentRequests = [
      ...currentYearActions,
      ...currentYearOrdinaryExecutionActions,
      ...currentYearConversionActions,
    ]
    const observedLinkedWithdrawalGroups = assessConversionLinkedWithdrawalGroups(
      linkedGroupAssessmentRequests,
      {
        annualLiabilityBaseline:
          annualLiabilityBaseline === null ? 'unavailable' : 'read',
      },
    )
    /**
     * Can this action's every allocation be funded from the balances standing
     * here, in whole cents the ledger can actually move?
     *
     * Floored rather than rounded, which is the discipline every capacity read
     * in this engine answers to: half-up rounding can report up to half a cent
     * more than an account holds, and a leg released against that figure would
     * be released against a cent the balance cannot cover. Truncating cannot,
     * so a movement sized against this is always fundable.
     *
     * Read at the seam and not at each executor's own call site, because the
     * question a staging release has to answer is about *both* legs before
     * *either* moves.
     *
     * Be precise about what this read is and is not. It is **per action**, and
     * it is **not aggregated** — not across a group's two legs, and not across
     * groups. Disjointness holds between one group's own two legs, because a
     * conversion may only source an owned non-inherited traditional IRA and an
     * ordinary withdrawal may only source cash, equity compensation or taxable;
     * that is what makes each leg's answer independent of the other's movement.
     * It does not extend to a year holding two groups whose withdrawals draw on
     * one cash account: each can be individually fundable while their sum is
     * not, and this read will say yes to both.
     *
     * So this is a *precondition for staging*, never a proof of movement. What
     * actually makes the release safe is that the staging run then moves the
     * legs for real and is read for what happened: a withdrawal the account
     * could not cover comes back short or refused,
     * `withdrawalLegsMovedWhole` revokes, `movementCoherent` goes false, and
     * `authorizeConversionLinkedWithdrawalGroups` withholds. The seam read
     * earns its place by turning the common case into a clean refusal instead
     * of a staging run that has to be discarded through a throw — not by
     * deciding anything on its own.
     */
    const legFundableFromCurrentBalances = (
      request: Readonly<RetirementActionRequest>,
    ): boolean => {
      if (request.kind !== 'rothConversion' &&
          request.kind !== 'ordinaryWithdrawal') return false
      const requestedBySourceAccountId = new Map<string, number>()
      for (const allocation of request.allocations) {
        requestedBySourceAccountId.set(
          allocation.sourceAccountId,
          (requestedBySourceAccountId.get(allocation.sourceAccountId) ?? 0) +
            allocation.requestedAmount,
        )
      }
      for (const [accountId, requested] of requestedBySourceAccountId) {
        const state = balances.find((entry) => entry.account.id === accountId)
        if (state === undefined) return false
        try {
          if (planDollarsToFlooredLedgerCents(state.balance) < requested) {
            return false
          }
        } catch {
          // A Plan balance outside the exact-cent safe range is a capacity
          // nobody here can state, and an unstateable capacity is not a proof
          // of fundability.
          return false
        }
      }
      return true
    }
    /**
     * The groups a staging run provisionally releases, with the hypothesis it
     * is testing written into their figures.
     *
     * The required and funded amounts are both the withdrawal's own authored
     * cents, which is exactly the claim under test: *this* withdrawal, moving
     * whole, funds *this* conversion's share of the unit's annual liability.
     * The staging run then computes the real allocation from two real
     * liabilities and either agrees with the claim or does not. Nothing else in
     * the run reads these two figures — the conversion executor republishes
     * them and the run is discarded — so the hypothesis is stated where it can
     * be read rather than left implicit in a placeholder.
     */
    const provisionalLinkedGroupAuthorizations = ():
      readonly Readonly<ConversionLinkedWithdrawalGroupAuthorization>[] => {
      const requestByActionId = new Map(
        linkedGroupAssessmentRequests.map((request) =>
          [request.actionId, request] as const),
      )
      const authorizations: ConversionLinkedWithdrawalGroupAuthorization[] = []
      for (const group of observedLinkedWithdrawalGroups.groups) {
        if (group.refusalKind === 'sharedFundingWithdrawal') continue
        const conversion = requestByActionId.get(group.conversionActionId)
        const withdrawal = requestByActionId.get(group.withdrawalActionId)
        if (
          conversion?.kind !== 'rothConversion' ||
          withdrawal?.kind !== 'ordinaryWithdrawal' ||
          !legFundableFromCurrentBalances(conversion) ||
          !legFundableFromCurrentBalances(withdrawal)
        ) continue
        authorizations.push({
          conversionActionId: group.conversionActionId,
          withdrawalActionId: group.withdrawalActionId,
          funding: {
            requiredFundingAmount: asUsdCents(withdrawal.requestedAmount),
            fundedAmount: asUsdCents(withdrawal.requestedAmount),
          },
        })
      }
      return authorizations
    }
    const linkedGroupAuthorizations = linkedGroupRelease.kind === 'proven'
      ? linkedGroupRelease.authorizations
      : linkedGroupRelease.kind === 'stageProvisionally'
        ? provisionalLinkedGroupAuthorizations()
        : []
    const conversionLinkedWithdrawalGroups = linkedGroupAuthorizations.length === 0
      ? observedLinkedWithdrawalGroups
      : assessConversionLinkedWithdrawalGroups(linkedGroupAssessmentRequests, {
        annualLiabilityBaseline:
          annualLiabilityBaseline === null ? 'unavailable' : 'read',
        authorizedGroups: linkedGroupAuthorizations,
      })
    /**
     * The verdict as the rest of the year reads it, which is the released one
     * until the withdrawal leg fails to arrive.
     *
     * Separate from `conversionLinkedWithdrawalGroups` because the withdrawal
     * executor has already run against that one by the time the revocation is
     * knowable, and rewriting the verdict it answered to would make the year
     * report a decision no executor was given. This is the decision every
     * *later* reader is given: the conversion executor, the candidate funding
     * vector, and the group executor that publishes the year's answer.
     */
    let effectiveLinkedWithdrawalGroups = conversionLinkedWithdrawalGroups
    // The ordinary and QCD executors are handed disjoint request sets, so the
    // one alive fact a request carries is minted here rather than per executor:
    // a request must not change identity by moving between the two.
    const actionPersonAliveEvidence = (
      actionId: ActionId,
      personId: PersonId,
      actionDate: string | null,
    ): NonpersistedActionPersonAliveEvidence => ({
      evidenceId: `projection-alive:${JSON.stringify([
        actionId,
        personId,
        year,
        actionDate,
      ])}`,
      actionId,
      personId,
      actionYear: year,
      actionDate,
      alive: stateOf(personId).alive,
    })
    /**
     * The donor's own prior consumption of the post-70½ deductible-contribution
     * offset, or nothing when this run cannot state it.
     *
     * Two routes reach a provable answer, and neither invents a zero. When the
     * donor made no deductible IRA contribution at or after 70½ there is no
     * offset in existence, so no earlier gift can have consumed one and the
     * figure is zero by arithmetic. Otherwise the figure is what this run's own
     * committed gifts consumed, which is only the whole answer when no gift
     * outside the run could have consumed any -- the condition
     * `namedQcdOffsetHistoryUnprovable` records. Omitting the evidence is what
     * fails the action closed: the eligibility predicate then refuses
     * `qcd-contribution-history-unknown` and no dollar moves.
     */
    const priorQcdOffsetEvidenceFor = (
      request: QualifiedCharitableDistributionRequest,
    ): NonpersistedPriorQcdOffsetEvidence | null => {
      const donor = people.find((person) => person.id === request.donorPersonId)
      const thresholdDate = donor === undefined
        ? null
        : addCalendarMonths(donor.dob, 846)
      if (thresholdDate === null) return null
      const thresholdYear = Number(thresholdDate.slice(0, 4))
      const offsetTotalCents = (
        plan.retirementActionEligibilityFacts?.deductibleIraContributions ?? []
      ).filter((record) =>
        record.donorPersonId === request.donorPersonId &&
        record.taxYear >= thresholdYear && record.taxYear <= request.year)
        .reduce((sum, record) => sum + BigInt(record.amountCents), 0n)
      const consumed = namedQcdOffsetConsumedByDonor.get(request.donorPersonId) ?? 0
      if (offsetTotalCents > 0n &&
          namedQcdOffsetHistoryUnprovable.has(request.donorPersonId)) {
        return null
      }
      const actionDate = request.executionDate ?? null
      return {
        evidenceId: `projection-prior-qcd-offset:${JSON.stringify([
          request.actionId,
          request.donorPersonId,
          year,
          actionDate,
        ])}`,
        actionId: request.actionId,
        donorPersonId: request.donorPersonId,
        actionYear: year,
        actionDate,
        priorOffsetApplied: asUsdCents(offsetTotalCents === 0n ? 0 : consumed),
      }
    }
    // Identity and legal preflight for every named QCD, published as its own
    // executor source. Nothing here settles a balance, satisfies an RMD, or
    // derives an exclusion; the annual QCD executor below reads this batch and
    // decides whether any of it may move.
    const qcdActionPrerequisiteResult =
      currentYearQcdExecutionActions.length === 0
        ? undefined
        : evaluateAnnualQcdExecutionPrerequisites({
            taxYear: year,
            plan: passPlan,
            requests: currentYearQcdExecutionActions,
            runtimeEvidence: {
              personAliveEvidence: currentYearQcdExecutionActions.map((request) =>
                actionPersonAliveEvidence(
                  request.actionId,
                  request.donorPersonId,
                  request.executionDate ?? null,
                )),
              priorQcdOffsetEvidence: currentYearQcdExecutionActions
                .flatMap((request) => {
                  const evidence = priorQcdOffsetEvidenceFor(request)
                  return evidence === null ? [] : [evidence]
                }),
            },
          })
    /**
     * The named charitable gift, settled and committed at phase rank 6.
     *
     * Position is the statute's, not convenience: Treas. Reg. 1.408-8(g)(1)
     * counts every IRA distribution against section 401(a)(9) and names a
     * qualified charitable distribution as its example, so the gift belongs
     * after the forced distributions it may count against; and Treas. Reg.
     * 1.408A-4 A-6(b) forbids a conversion from absorbing an unsatisfied RMD,
     * so it belongs before the conversions. The aggregate arm has already stood
     * down for this year, so the two can never sum.
     */
    let qcdActionExecution: ExecuteAnnualQcdsResult | undefined
    /** Gross dollars a named gift moved out of an owned IRA this year. */
    let namedQcdExecuted = 0
    /**
     * The share of that gift that satisfied a still-unmet owned-IRA RMD, and
     * the income reduction riding on it.
     *
     * Both are structurally zero today, not merely usually zero, and the proof
     * is worth writing down because it is also the warning. `rmdSatisfiedByAction`
     * is `min(executed, rmdRemainingBefore)`, and `rmdRemainingBefore` is this
     * owner's unmet IRA requirement after the sweep above -- which can only be
     * positive when every one of the owner's aggregated IRAs is empty. An empty
     * IRA is also an empty gift source, so `executed` is zero whenever
     * `rmdRemainingBefore` is not, and the product is zero either way. Dollars
     * taken beyond the RMD never entered income or cash, so offsetting them
     * would be a phantom deduction; the exclusion shows up instead as a
     * distribution that produced no income at all.
     *
     * The seams are wired anyway because the RMD-reserve slice named in
     * `treas-reg-1-408-8-g-projection-named-qcd-beyond-rmd` makes them
     * reachable. When it lands, DO NOT trust the two lines below: a reserve
     * holds gift dollars out of the forced distribution, so those dollars never
     * become cash and never enter income in the first place, and giving them
     * back here would subtract them a second time. The give-back arithmetic has
     * to be re-derived against whatever the reserve actually leaves in
     * `rmdTotal` and `rmdNontaxable`, not carried forward from this shape.
     */
    let namedQcdRmdSatisfied = 0
    let namedQcdIncomeOffset = 0
    if (qcdActionPrerequisiteResult?.status === 'evaluated') {
      const qcdRequests = qcdActionPrerequisiteResult.requests
      const qcdDonorIds = [...new Set(qcdRequests.map((request) =>
        String(request.donorPersonId)))].sort(compareUtf16CodeUnits)
      const qcdSourceIds = new Set(qcdRequests.map((request) =>
        String(request.allocation.sourceAccountId)))
      // Truncated, not rounded. This snapshot is a spending capacity: the
      // executor sizes the gift as `min(requested, openingBalance)`, and the
      // commit below subtracts the result from the live balance, which the
      // runtime journal then validates as an exact before/amount/after chain.
      // Half-up rounding can report up to half a cent more than the account
      // holds, so a gift that drains its source would authorise a cent that is
      // not there and drive the balance negative -- permanently, since nothing
      // downstream rebuilds it. Truncating makes the overdraw unreachable
      // instead of detecting it afterwards.
      const openingBalances = balances
        .filter((state) => qcdSourceIds.has(state.account.id))
        .map((state) => ({
          accountId: asAccountId(state.account.id),
          openingBalance: planDollarsToFlooredLedgerCents(state.balance),
        }))
      // The owner's Treas. Reg. 1.408-8(e)(1)(i) sum and how much of it the
      // owner's own IRAs have already distributed by the time the gift is
      // sized. Read from the same two maps the conversion executor reads, so
      // the two executors cannot disagree about one owner's year.
      const rmdPools: AnnualQcdRmdPoolOpeningSnapshot[] = qcdDonorIds.map((donorId) => {
        const required = planDollarsToLedgerCents(iraRmdRequiredByOwner.get(donorId) ?? 0)
        const remaining = planDollarsToLedgerCents(
          Math.min(iraRmdUnsatisfiedByOwner.get(donorId) ?? 0, iraRmdRequiredByOwner.get(donorId) ?? 0),
        )
        const sourceAccountIds = plan.accounts
          .filter((account) => isAggregatedIra(account) &&
            (account.ownerPersonId ?? primary.id) === donorId)
          .map((account) => asAccountId(account.id))
          .sort(compareUtf16CodeUnits)
        return {
          predicate: 'annualQcdOwnedIraRmdPoolOpeningSnapshot' as const,
          poolId: `projection-owned-ira-rmd-pool:${JSON.stringify([plan.id, donorId, year])}`,
          taxYear: year,
          donorPersonId: asPersonId(donorId),
          scope: 'ownedIra' as const,
          sourceAccountIds: sourceAccountIds as [ReturnType<typeof asAccountId>, ...ReturnType<typeof asAccountId>[]],
          rmdRequiredAmount: required,
          rmdSatisfiedBefore: asUsdCents(Number(BigInt(required) - BigInt(remaining))),
          rmdRemainingBefore: remaining,
          upstreamEvidenceId:
            `projection-owner-ira-rmd-satisfaction:${JSON.stringify([plan.id, donorId, year])}`,
        }
      })
      const physicalInput = {
        prerequisite: qcdActionPrerequisiteResult,
        plan: passPlan,
        runtimeEvidence: {
          personAliveEvidence: qcdRequests.map((request) =>
            actionPersonAliveEvidence(
              request.actionId,
              request.donorPersonId,
              request.executionDate ?? null,
            )),
          priorQcdOffsetEvidence: qcdRequests.flatMap((request) => {
            const evidence = priorQcdOffsetEvidenceFor(request)
            return evidence === null ? [] : [evidence]
          }),
        },
        openingBalances,
        rmdPools,
      }
      // Staged once here only to learn what each source can actually cover, so
      // the pool statement below can name the gift it is about. The executor
      // rebuilds the same staging from the same input, so the two agree by
      // construction rather than by being passed along.
      const staging = stageAnnualQcdPhysicalExecution(physicalInput)
      const stagedGiftByAccount = new Map<string, number>()
      if (staging.status === 'annualQcdPhysicalExecutionStaged') {
        for (const application of staging.applications) {
          const accountId = String(application.request.allocation.sourceAccountId)
          stagedGiftByAccount.set(
            accountId,
            (stagedGiftByAccount.get(accountId) ?? 0) + application.executedAmount,
          )
        }
      }
      // One complete owned-IRA pool per donor, stated as of the year's Form
      // 8606 seed and net of the gift the post-pass adds back. Lines 7 and 8
      // are empty because this stage inventories the gift alone: the year's
      // other IRA activity is still ahead of it, and the denominator does not
      // care -- every later distribution moves a dollar from the balance to a
      // line and leaves the sum where it is. What reaches published evidence is
      // that invariant sum and the basis numerator, never these two components.
      const poolCapacityInputs: ClassifyOwnedNonRothIraAnnualWithdrawalsInput[] =
        qcdDonorIds.map((donorId) => {
          const poolAccounts = plan.accounts
            .filter((account) => isAggregatedIra(account) &&
              (account.ownerPersonId ?? primary.id) === donorId)
            .sort((left, right) => compareUtf16CodeUnits(left.id, right.id))
          const subtypeById = new Map(
            (plan.retirementActionEligibilityFacts?.iraClassifications ?? [])
              .map((record) => [String(record.sourceAccountId), record.subtype] as const),
          )
          const poolMembers = poolAccounts.map((account) => {
            const preDistribution = planDollarsToLedgerCents(
              preDistributionOwnedIraBalance.get(account.id) ?? 0,
            )
            const gift = stagedGiftByAccount.get(account.id) ?? 0
            return {
              sourceAccountId: asAccountId(account.id),
              ownerPersonId: asPersonId(donorId),
              accountType: 'traditional' as const,
              accountKind: 'ira' as const,
              inheritanceStatus: 'owned' as const,
              // The Plan types every owned IRA as `traditional` and carries a
              // SEP/SIMPLE subtype only where the household attested one, so
              // the attestation is authoritative where it exists and the
              // Plan's own classification stands where it does not.
              subtype: subtypeById.get(account.id) ?? 'traditional' as const,
              yearEndApplicableBalanceAmount: asUsdCents(
                Number(BigInt(preDistribution) - BigInt(Math.min(gift, preDistribution))),
              ),
              iraClassificationEvidenceId:
                `projection-owned-ira-classification:${JSON.stringify([plan.id, account.id, year])}`,
              accountOwnershipEvidenceId:
                `projection-owned-ira-ownership:${JSON.stringify([plan.id, account.id, year])}`,
            }
          })
          const poolBalance = asUsdCents(Number(poolMembers.reduce(
            (sum, member) => sum + BigInt(member.yearEndApplicableBalanceAmount), 0n)))
          const poolId = `projection-owned-ira-pool:${JSON.stringify([plan.id, donorId, year])}`
          return {
            ownerPersonId: asPersonId(donorId),
            ownerWideNonRothIraPoolId: poolId,
            completePoolEvidence: {
              predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear' as const,
              ownerPersonId: asPersonId(donorId),
              ownerWideNonRothIraPoolId: poolId,
              taxYear: year,
              accountIds: poolMembers.map((member) => member.sourceAccountId) as
                [ReturnType<typeof asAccountId>, ...ReturnType<typeof asAccountId>[]],
              yearEndApplicablePoolBalanceAmount: poolBalance,
              evidenceId:
                `projection-owned-ira-pool-evidence:${JSON.stringify([plan.id, donorId, year])}`,
            },
            annualBasisRecordEvidenceId:
              `projection-owned-ira-annual-basis:${JSON.stringify([plan.id, donorId, year])}`,
            taxYear: year,
            poolMembers,
            annualFacts: {
              openingBasisAmount: planDollarsToLedgerCents(iraBasisByOwner.get(donorId) ?? 0),
              taxYearNondeductibleContributionAmount: asUsdCents(0),
              postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
              yearEndApplicablePoolBalanceAmount: poolBalance,
              outstandingRolloverAmount: asUsdCents(0),
              rolloverRepaymentAdjustmentAmount: asUsdCents(0),
              form8606Line7DistributionAmount: asUsdCents(0),
              form8606Line8NetConversionAmount: asUsdCents(0),
            },
            line7Distributions: [],
            line8Conversions: [],
          }
        })
      qcdActionExecution = executeAnnualQcds({ physicalInput, poolCapacityInputs })
      if (qcdActionExecution.committed) {
        const accountOrder = new Map(
          plan.accounts.map((account, index) => [account.id, index] as const),
        )
        const balanceByAccountId = new Map(
          balances.map((state) => [state.account.id, state] as const),
        )
        const committedGifts = qcdActionExecution.evidence
          .filter((entry) => entry.executedAmount > 0)
          .map((entry, index) => ({ entry, index }))
          .sort((left, right) =>
            (accountOrder.get(String(left.entry.sourceAccountId)) ?? Number.MAX_SAFE_INTEGER) -
              (accountOrder.get(String(right.entry.sourceAccountId)) ?? Number.MAX_SAFE_INTEGER) ||
            left.index - right.index)
        for (const { entry } of committedGifts) {
          const state = balanceByAccountId.get(String(entry.sourceAccountId))
          if (state === undefined) {
            throw new Error('Committed QCD source left the balance ledger')
          }
          const amount = ledgerCentsToPlanDollars(entry.executedAmount)
          if (amount > state.balance) {
            // Unreachable while the opening snapshot above is truncated, and
            // asserted rather than assumed because the consequence of it being
            // wrong is a negative balance that survives every later year and
            // silently rolls back the year's exact-basis settlement.
            throw new Error('Committed QCD exceeds its live source balance')
          }
          const kind = 'namedQcd' as const
          // Four members. A gift names no destination -- it leaves the
          // household -- so the action and the allocation are the only two
          // members beyond the aggregate key, and they are what tell one
          // donor's two gifts from the same IRA in the same year apart.
          const producerOccurrenceKey = runtimeOccurrenceKey(
            kind,
            String(entry.sourceAccountId),
            String(entry.actionId),
            String(entry.allocationId),
          )
          const sourceBalanceBefore = state.balance
          state.balance = sourceBalanceBefore - amount
          recordAnnualRetirementRuntimeOccurrence({
            producerOccurrenceKey,
            kind,
            grossAmountPlanDollars: amount,
            ownerPersonId: state.account.ownerPersonId,
            sourceAccountId: state.account.id,
            executionDate: null,
            executionSequence: null,
            movementAuthorityId: null,
          })
          recordAnnualRetirementRuntimeApplication({
            applicationKind: 'debit',
            producerOccurrenceKey,
            simulatorPhase: 'namedQcdDistribution',
            ownerPersonId: state.account.ownerPersonId,
            sourceAccountId: state.account.id,
            sourceBalanceBeforePlanDollars: sourceBalanceBefore,
            appliedAmountPlanDollars: amount,
            sourceBalanceAfterPlanDollars: state.balance,
          })
          // No pro-rata split rides on this debit. IRC 408(d)(8)(D) deems the
          // gift to consist of otherwise-includible dollars notwithstanding
          // section 72, so it returns no basis and leaves the year's Form 8606
          // ratio for the other distributions -- which is exactly why the
          // commit gate only admits gifts that stayed inside the pool.
          namedQcdExecuted += amount
        }
        for (const entry of qcdActionExecution.evidence) {
          const donorId = String(entry.donorPersonId)
          namedQcdOffsetConsumedByDonor.set(
            donorId,
            (namedQcdOffsetConsumedByDonor.get(donorId) ?? 0) +
              entry.derivedFacts.deductibleContributionOffsetApplied,
          )
        }
        namedQcdRmdSatisfied = ledgerCentsToPlanDollars(
          qcdActionExecution.totalRmdSatisfiedAmount,
        )
        // Structurally zero today: the annual pass distributes the whole
        // required amount in cash before any named gift is sized, so the
        // executor publishes totalRmdSatisfiedAmount of zero on every current
        // shape (treas-reg-1-408-8-g-projection-named-qcd-beyond-rmd). A cap
        // of `ownedIraRmdTotal - rmdNontaxable` used to sit here; that is the
        // requirement's taxable share, the pre-408(d)(8)(D) ceiling the
        // aggregate arm no longer uses, and it was removed so it cannot go
        // live wrong. The day the RMD-reserve slice makes this positive, the
        // offset must be capped by the donor's aggregate includible amount,
        // the measure the aggregate arm computes, not by the requirement's
        // taxable share. A checkpoint pin holds this equal to the executor's
        // published figure so that day forces the statutory-cap decision.
        namedQcdIncomeOffset = namedQcdRmdSatisfied
        qcd += namedQcdExecuted
      } else if (isStandIn && qcdActionExecution.issues.some((issue) =>
        issue.kind === 'postPassBlocked')) {
        // Keyed off the structural condition rather than the refusal's message
        // text: in a stand-in year the post-pass refuses before any other
        // question is reached, so `isStandIn` plus a post-pass block IS the
        // missing-limit case, and a wording change in the executor cannot
        // silently drop the warning.
        // The QCD block's first user-visible warning. The aggregate arm may
        // extrapolate its limit because it never claims an action executed;
        // the named arm claims exactly that, and the contract forbids general
        // plan inflation from turning a prior year's figure into legal
        // evidence. Naming the year matters because the household also loses
        // its scalar gift that year: a named request stands the aggregate arm
        // down whether or not the named gift can move.
        warnings.add(
          `A named QCD is scheduled for ${year}, but RetireGolden has no sourced QCD limit for that tax year yet, ` +
            'so the gift was not executed and the recurring QCD amount stood down for the year. ' +
            'Plan the gift in a year whose limit is published, or model it with the recurring QCD amount instead.',
        )
      }
    }
    let retirementActionExecution: ExecuteOrdinaryWithdrawalsResult | undefined
    let rothConversionActionExecution: ExecuteRothConversionsResult | undefined
    /**
     * Dollars a named request actually converted this year. Held apart from
     * the aggregate strategy's `rothConversion` because the two are produced by
     * different authorities and reconciled against different evidence; they are
     * summed only where the year publishes one conversion figure.
     */
    let namedRothConversionExecuted = 0
    /**
     * The Form 8606 line-8 basis return riding on those dollars. It is the
     * settlement's figure whenever the assumption vector carries one for the
     * allocation, and the plan-dollar pro-rata approximation only on the seed
     * attempt that has no assumption to read — the same two-stage disposition
     * the aggregate conversion pass already uses for `conversionNontaxable`.
     */
    let namedRothConversionNontaxable = 0
    let retirementActionCash = 0
    let retirementActionEquityCompensation = 0
    let retirementActionOrdinaryIncome = 0
    let retirementActionProceeds = 0
    let retirementActionTaxableProceeds = 0
    let retirementActionCapitalGainOrLoss = 0
    if (currentYearOrdinaryExecutionActions.length > 0) {
      const ordinarySourceAccountIds = new Set<string>(
        currentYearOrdinaryActions.flatMap((request) =>
          request.allocations.map((allocation) => allocation.sourceAccountId),
        ),
      )
      let openingBalances = [...balances]
        .filter((state) => ordinarySourceAccountIds.has(state.account.id))
        .sort((left, right) =>
          left.account.id < right.account.id ? -1 : left.account.id > right.account.id ? 1 : 0,
        )
        .flatMap((state) => {
          try {
            return [{
              accountId: asAccountId(state.account.id),
              openingBalance: planDollarsToLedgerCents(state.balance),
            }]
          } catch {
            // A schema-valid Plan balance can exceed the exact-cent ledger's
            // safe range. Omit it so the executor reports required facts
            // missing instead of aborting the whole projection.
            return []
          }
        })
      const taxUnitMembers = annualActionTaxUnit?.members ?? null
      const taxUnitId = annualActionTaxUnit?.taxUnitId ?? null
      const taxUnitEvidenceId = annualActionTaxUnit?.taxUnitEvidenceId ?? null
      const stateFilingStatusId = annualActionTaxUnit?.stateFilingStatusId ?? null
      let taxableAccountSnapshots: TaxableAccountOpeningSnapshot[] =
        taxUnitMembers === null ||
        taxUnitId === null ||
        taxUnitEvidenceId === null ||
        stateFilingStatusId === null
          ? []
          : [...balances]
            .filter(
              (state): state is BalanceState & {
                account: Extract<Account, { type: 'taxable' }> & {
                  ownerPersonId: string
                }
              } =>
                ordinarySourceAccountIds.has(state.account.id) &&
                state.account.type === 'taxable' &&
                state.account.ownerPersonId !== null,
            )
            .sort((left, right) =>
              left.account.id < right.account.id
                ? -1
                : left.account.id > right.account.id
                  ? 1
                  : 0,
            )
            .flatMap((state) => {
              try {
                const accountId = asAccountId(state.account.id)
                const ownerPersonId = asPersonId(state.account.ownerPersonId)
                if (!taxUnitMembers.includes(ownerPersonId)) return []
                return [{
                  accountId,
                  openingCostBasis: planDollarsToLedgerCents(state.costBasis),
                  ownership: {
                    accountOwnerPersonIds: [ownerPersonId],
                    accountOwnershipEvidenceId:
                      `projection-account-ownership:${JSON.stringify([
                        accountId,
                        ownerPersonId,
                        year,
                        filingStatusForYear,
                        taxUnitMembers,
                      ])}`,
                    beneficialOwnershipShare: {
                      representation: 'exactRational',
                      numerator: 1,
                      denominator: 1,
                      intermediateArithmetic: 'bigintRational',
                    },
                    attributionEvidenceId:
                      `projection-taxable-attribution:${JSON.stringify([
                        accountId,
                        ownerPersonId,
                        year,
                        filingStatusForYear,
                        taxUnitMembers,
                      ])}`,
                  },
                  taxUnit: {
                    taxUnitId,
                    taxUnitMemberPersonIds: taxUnitMembers,
                    federalFilingStatus: filingStatusForYear,
                    stateFilingStatusId,
                    taxUnitEvidenceId,
                    taxYear: year,
                  },
                }]
              } catch {
                // Keep a valid balance visible while omitting invalid basis
                // evidence so taxable movement fails closed and explains why.
                return []
              }
            })
      const personAliveEvidence = currentYearOrdinaryExecutionActions.flatMap(
        (request): NonpersistedActionPersonAliveEvidence[] => {
          if (
            request.kind === 'legacyAggregateWithdrawal' ||
            request.kind === 'legacyAggregateRothConversion' ||
            request.kind === 'legacyAggregateQcd'
          ) {
            return []
          }
          const personId =
            request.kind === 'qcd' ? request.donorPersonId : request.personId
          return [actionPersonAliveEvidence(
            request.actionId,
            personId,
            request.executionDate ?? null,
          )]
        },
      )
      while (true) {
        retirementActionExecution = executeOrdinaryWithdrawals({
          year,
          plan: passPlan,
          requests: currentYearOrdinaryExecutionActions,
          openingBalances,
          taxableAccountSnapshots,
          runtimeEvidence: {
            personAliveEvidence,
            conversionLinkedWithdrawalGroups,
          },
        })
        const boundary = assessOrdinaryWithdrawalPlanBoundary(
          retirementActionExecution,
        )
        const unrepresentableClosingBalanceAccountIds = new Set(
          boundary.unrepresentableClosingBalanceAccountIds.map(String),
        )
        const unrepresentableClosingBasisAccountIds = new Set(
          boundary.unrepresentableClosingBasisAccountIds.map(String),
        )
        const aggregateFailureSourceAccountIds = new Set(
          boundary.aggregateFailureSourceAccountIds.map(String),
        )
        if (boundary.totals.cash !== null) {
          retirementActionCash = boundary.totals.cash
        }
        if (boundary.totals.equityCompensation !== null) {
          retirementActionEquityCompensation =
            boundary.totals.equityCompensation
        }
        if (boundary.totals.taxableProceeds !== null) {
          retirementActionTaxableProceeds = boundary.totals.taxableProceeds
        }
        if (boundary.totals.proceeds !== null) {
          retirementActionProceeds = boundary.totals.proceeds
        }
        if (boundary.totals.capitalGainOrLoss !== null) {
          retirementActionCapitalGainOrLoss =
            boundary.totals.capitalGainOrLoss
        }
        if (
          unrepresentableClosingBalanceAccountIds.size === 0 &&
          unrepresentableClosingBasisAccountIds.size === 0 &&
          aggregateFailureSourceAccountIds.size === 0
        ) {
          break
        }

        // The action ledger is exact-cent while Plan balances are numbers. If
        // a closing value or annual aggregate cannot cross that boundary
        // losslessly, rerun without the affected fact source. Independent
        // actions whose sources remain available may still execute.
        const unavailableBalanceAccountIds = new Set([
          ...unrepresentableClosingBalanceAccountIds,
          ...aggregateFailureSourceAccountIds,
        ])
        openingBalances = openingBalances.filter(
          (snapshot) =>
            !unavailableBalanceAccountIds.has(String(snapshot.accountId)),
        )
        taxableAccountSnapshots = taxableAccountSnapshots.filter(
          (snapshot) =>
            !unavailableBalanceAccountIds.has(String(snapshot.accountId)) &&
            !unrepresentableClosingBasisAccountIds.has(
              String(snapshot.accountId),
            ),
        )
      }

      if (retirementActionExecution.committed) {
        const closingCentsByAccountId = new Map(
          retirementActionExecution.balances
            .filter((snapshot) => snapshot.closingBalance !== snapshot.openingBalance)
            .map((snapshot) => [String(snapshot.accountId), snapshot.closingBalance]),
        )
        const closingTaxableBasisCentsByAccountId = new Map(
          retirementActionExecution.taxableBases.map((snapshot) => [
            String(snapshot.accountId),
            snapshot.closingCostBasis,
          ]),
        )
        for (const state of balances) {
          const closingCents = closingCentsByAccountId.get(state.account.id)
          if (closingCents !== undefined) {
            const closingBalance = ledgerCentsToPlanDollars(closingCents)
            if (state.account.type === 'taxable') {
              const closingBasisCents =
                closingTaxableBasisCentsByAccountId.get(state.account.id)
              if (closingBasisCents === undefined) {
                throw new Error(
                  'Committed taxable closing balance lost its paired basis',
                )
              }
              state.costBasis = ledgerCentsToPlanDollars(closingBasisCents)
            } else if (state.account.type === 'equityComp' && state.balance > 0) {
              const executed = state.balance - closingBalance
              const basisRatio = Math.min(1, state.costBasis / state.balance)
              state.costBasis = Math.max(
                0,
                state.costBasis - executed * basisRatio,
              )
            }
            state.balance = closingBalance
          }
        }
      }
      retirementActionOrdinaryIncome = retirementActionEquityCompensation
    }

    // Named conversions do not inherit the legacy aggregate strategy's
    // first-source/first-Roth movement authority. Publish request-keyed,
    // fail-closed evidence from balances after forced distributions and named
    // ordinary withdrawals, immediately before aggregate conversion sizing.
    // Complete annual Form-8606 line-8, RMD-reserve, and tax-liability funding
    // evidence do not exist at this simulator boundary, so none is invented.
    if (currentYearConversionActions.length > 0 && !mixedKindScheduleBlocked) {
      const conversionAccountIds = new Set<string>(
        currentYearConversionActions.flatMap((request) => [
          request.destinationRothAccountId,
          ...request.allocations.map((allocation) => allocation.sourceAccountId),
        ]),
      )
      const conversionSourceAccountIds = new Set<string>(
        currentYearConversionActions.flatMap((request) =>
          request.allocations.map((allocation) => allocation.sourceAccountId)),
      )
      const openingBalances = [...balances]
        .filter((state) => conversionAccountIds.has(state.account.id))
        .sort((left, right) => compareUtf16CodeUnits(left.account.id, right.account.id))
        .flatMap((state) => {
          try {
            return [{
              accountId: asAccountId(state.account.id),
              // A source snapshot is a spending capacity and is truncated; a
              // destination snapshot is a measurement and is not. The executor
              // admits an allocation only where the source's reported opening
              // covers the requested cents, and the commit below subtracts
              // those exact cents from the live float, so half-up rounding on a
              // source could report up to half a cent more than the account
              // holds and authorise a request the balance cannot fund -- which
              // drove the balance negative, permanently, and only after the
              // dollars had moved. Truncating makes that unreachable rather
              // than detectable afterwards. Nothing is ever drawn against the
              // destination figure, so rounding it down would understate a
              // published balance to buy protection it does not need.
              openingBalance: conversionSourceAccountIds.has(state.account.id)
                ? planDollarsToFlooredLedgerCents(state.balance)
                : planDollarsToLedgerCents(state.balance),
            }]
          } catch {
            return []
          }
        })
      const personAliveEvidence = currentYearConversionActions.map((request) => ({
        evidenceId: `projection-alive:${JSON.stringify([
          request.actionId,
          request.personId,
          year,
          request.executionDate ?? null,
        ])}`,
        actionId: request.actionId,
        personId: request.personId,
        actionYear: year,
        actionDate: request.executionDate ?? null,
        alive: peopleStates.find((state) => state.personId === request.personId)?.alive ?? false,
      }))
      // Treas. Reg. 1.408A-4 A-6(b) bars converting while the year's required
      // minimum distribution is undistributed, and the two-pass RMD block
      // above is where that question was actually settled for each owner. It
      // is published here as request-keyed evidence rather than left implicit
      // in the order of these statements: being downstream of the RMD block is
      // not evidence that the RMD came out, and the executor must be able to
      // tell an owner whose sum was distributed from one whose IRAs were all
      // emptied before the sum could be taken.
      //
      // Both figures cross into exact cents, and an owner whose evidence
      // cannot be represented there is omitted entirely — the executor then
      // reads no evidence and keeps the blocking reason.
      const ownerIraRmdSatisfactionEvidence = currentYearConversionActions
        .flatMap((request): NonpersistedOwnerIraRmdSatisfactionEvidence[] => {
          const required = iraRmdRequiredByOwner.get(request.personId) ?? 0
          const unsatisfied = iraRmdUnsatisfiedByOwner.get(request.personId) ?? 0
          try {
            const requiredAmount = planDollarsToLedgerCents(required)
            const shortfall = planDollarsToLedgerCents(Math.max(0, unsatisfied))
            return [{
              evidenceId: `projection-owner-ira-rmd-satisfaction:${JSON.stringify([
                request.actionId,
                request.personId,
                year,
                request.executionDate ?? null,
              ])}`,
              actionId: request.actionId,
              personId: request.personId,
              actionYear: year,
              actionDate: request.executionDate ?? null,
              requiredAmount,
              distributedAmount: asUsdCents(Math.max(0, requiredAmount - shortfall)),
            }]
          } catch {
            return []
          }
        })
      // The owner's aggregated-IRA nondeductible basis, published the same way
      // and for the same reason as the RMD outcome above: being downstream of
      // the statement that seeded `iraBasisByOwner` is not evidence about the
      // owner's basis, and the executor must be able to tell an owner whose
      // numerator is genuinely zero from one whose basis it simply cannot see.
      // `iraBasisByOwner` holds only owners with a positive figure, so an
      // absent entry is the zero this is allowed to prove.
      const ownerAggregatedIraBasisEvidence = currentYearConversionActions
        .flatMap((request): NonpersistedOwnerAggregatedIraBasisEvidence[] => {
          try {
            return [{
              evidenceId: `projection-owner-aggregated-ira-basis:${JSON.stringify([
                request.actionId,
                request.personId,
                year,
                request.executionDate ?? null,
              ])}`,
              actionId: request.actionId,
              personId: request.personId,
              actionYear: year,
              actionDate: request.executionDate ?? null,
              basisAmount: planDollarsToLedgerCents(
                iraBasisByOwner.get(request.personId) ?? 0,
              ),
            }]
          } catch {
            return []
          }
        })
      /**
       * The group verdict the conversion leg answers to, narrowed by what the
       * withdrawal leg actually did.
       *
       * The two legs move in different phases and the withdrawal moves first,
       * so this is the one place in the year where "did the funding actually
       * arrive" is a fact rather than a forecast. A release that survives to
       * here and whose withdrawal did not move its whole authored amount is
       * revoked, and revoking one revokes all: the assessment's own release
       * rule is all-or-nothing across the annual group, so handing it a
       * shortened authorization list releases nothing.
       *
       * This closes the direction of the atomicity hazard that ordering alone
       * cannot: a conversion that converted on funding its withdrawal never
       * took. The other direction — a withdrawal that moved for a conversion
       * that then refused — is closed before either leg moves, by the seam's
       * floored-capacity read of both legs, and backstopped by publication's
       * `assertLinkedWithdrawalRecordAtomicity` for any refusal that read
       * cannot see.
       */
      const withdrawalLegsMovedWhole = conversionLinkedWithdrawalGroups.groups
        .filter((group) => group.disposition === 'executedAsAtomicGroup')
        .every((group) => {
          const evidence = retirementActionExecution?.evidence.find(
            (entry) => entry.actionId === group.withdrawalActionId,
          )
          return evidence !== undefined &&
            evidence.readiness === 'actionable' &&
            evidence.disposition.outcome === 'executed' &&
            evidence.disposition.executedAmount === evidence.requestedAmount
        })
      if (!withdrawalLegsMovedWhole) {
        effectiveLinkedWithdrawalGroups = observedLinkedWithdrawalGroups
      }
      rothConversionActionExecution = executeRothConversions({
        year,
        plan: passPlan,
        requests: currentYearConversionActions,
        openingBalances,
        runtimeEvidence: {
          personAliveEvidence,
          ownerIraRmdSatisfactionEvidence,
          ownerAggregatedIraBasisEvidence,
          conversionLinkedWithdrawalGroups: effectiveLinkedWithdrawalGroups,
        },
      })

      if (rothConversionActionExecution.committed) {
        // Debits for every committed request first, then the destination
        // credits. The two simulator phases are ordered that way, and within
        // the debit phase the applications must retain controlling Plan
        // account order, so the moves are sorted rather than left in whichever
        // order the requests happened to arrive.
        const balanceByAccountId = new Map(
          balances.map((state) => [state.account.id, state] as const),
        )
        const accountOrder = new Map(
          plan.accounts.map((account, index) => [account.id, index] as const),
        )
        const committedConversions = rothConversionActionExecution.evidence
          .flatMap((evidence) => evidence.outcome === 'executed'
            ? evidence.allocations.map((allocation) => ({
              actionId: evidence.actionId,
              allocationId: allocation.allocationId,
              sourceAccountId: allocation.sourceAccountId,
              destinationRothAccountId: evidence.destinationRothAccountId,
              amount: ledgerCentsToPlanDollars(asUsdCents(allocation.executedAmount)),
            }))
            : [])
          .sort((left, right) =>
            (accountOrder.get(left.sourceAccountId) ?? Number.MAX_SAFE_INTEGER) -
              (accountOrder.get(right.sourceAccountId) ?? Number.MAX_SAFE_INTEGER) ||
            compareUtf16CodeUnits(left.allocationId, right.allocationId))
        // One accumulator per action, appended to in the sorted debit pass, so
        // the credit pass reads each action's moves in the same controlling
        // order the debits were emitted in without re-scanning the batch.
        interface CommittedConversionAction {
          readonly destinationRothAccountId: string
          readonly debitKeys: string[]
          readonly debitOwners: (string | null)[]
          creditedAmountPlanDollars: number
          /** This action's own share of `namedRothConversionNontaxable`. */
          nontaxableAmountPlanDollars: number
        }
        const committedByActionId = new Map<string, CommittedConversionAction>()
        for (const move of committedConversions) {
          const state = balanceByAccountId.get(move.sourceAccountId)
          if (state === undefined) {
            throw new Error('Committed conversion source left the balance ledger')
          }
          const kind = 'namedRothConversion' as const
          // Five members. The action and allocation are what make this key
          // incapable of colliding with an aggregate conversion that merely
          // shares a source and a destination.
          const producerOccurrenceKey = runtimeOccurrenceKey(
            kind,
            move.sourceAccountId,
            move.destinationRothAccountId,
            move.actionId,
            move.allocationId,
          )
          let committedAction = committedByActionId.get(move.actionId)
          if (committedAction === undefined) {
            committedAction = {
              destinationRothAccountId: move.destinationRothAccountId,
              debitKeys: [],
              debitOwners: [],
              creditedAmountPlanDollars: 0,
              nontaxableAmountPlanDollars: 0,
            }
            committedByActionId.set(move.actionId, committedAction)
          }
          if (committedAction.destinationRothAccountId !== move.destinationRothAccountId) {
            throw new Error('Committed conversion allocations disagree about their destination')
          }
          committedAction.debitKeys.push(producerOccurrenceKey)
          committedAction.debitOwners.push(state.account.ownerPersonId)
          committedAction.creditedAmountPlanDollars += move.amount
          const sourceBalanceBefore = state.balance
          if (move.amount > sourceBalanceBefore) {
            // Unreachable while the opening snapshot above is truncated, and
            // asserted rather than assumed because the consequence of it being
            // wrong is a negative balance that survives every later year and
            // silently rolls back the year's exact-basis settlement.
            throw new Error('Committed conversion exceeds its live source balance')
          }
          state.balance = sourceBalanceBefore - move.amount
          recordAnnualRetirementRuntimeOccurrence({
            producerOccurrenceKey,
            kind,
            grossAmountPlanDollars: move.amount,
            ownerPersonId: state.account.ownerPersonId,
            sourceAccountId: state.account.id,
            executionDate: null,
            executionSequence: null,
            movementAuthorityId: null,
          })
          if (isAggregatedIra(state.account)) {
            const ownedIraApplication = recordAnnualRetirementRuntimeApplication({
              applicationKind: 'debit',
              producerOccurrenceKey,
              simulatorPhase: 'namedRothConversionDebit',
              ownerPersonId: state.account.ownerPersonId,
              sourceAccountId: state.account.id,
              sourceBalanceBeforePlanDollars: sourceBalanceBefore,
              appliedAmountPlanDollars: move.amount,
              sourceBalanceAfterPlanDollars: state.balance,
            })
            // The executor authorised the movement without stating its
            // character; IRC 408(d)(2)/408A(d)(3)(A) apportion it by the
            // year's Form 8606 line-10 ratio, and the settlement is the only
            // place that ratio exists. Reading it back through the assumption
            // vector is what makes this the settlement's own figure rather
            // than a second, mid-year answer to the same owner-year question.
            //
            // `mutationOrdinal` is the load-bearing member: the replay derives
            // each line-8 allocation identity from the ordinal of this very
            // application, so it is taken from the recorded application rather
            // than predicted. A mismatched ordinal does not raise — it makes
            // `resolveAssumedCharacter` return null and silently fall back,
            // which is why the tests assert the nontaxable figure and not
            // merely that the conversion happened.
            const ownerId = state.account.ownerPersonId ?? primary.id
            const proRata = iraProRata.get(ownerId)
            if (proRata !== undefined &&
                ownedIraApplication.applicationKind === 'debit') {
              const split = splitWithAssumedCharacter(proRata, move.amount, {
                ownerPersonId: ownerId,
                calculationScope: 'form8606Line8NetConversions',
                occurrenceKind: kind,
                producerOccurrenceKey,
                sourceAccountId: state.account.id,
                mutationOrdinal: ownedIraApplication.mutationOrdinal,
              })
              iraProRata.set(ownerId, split.next)
              committedAction.nontaxableAmountPlanDollars += split.nontaxable
              namedRothConversionNontaxable += split.nontaxable
            }
          }
        }
        for (const actionId of [...committedByActionId.keys()].sort(compareUtf16CodeUnits)) {
          const committedAction = committedByActionId.get(actionId)!
          const destinationId = committedAction.destinationRothAccountId
          const destination = balanceByAccountId.get(destinationId)
          if (destination === undefined || destination.account.type !== 'roth') {
            throw new Error('Committed conversion destination is not a Roth account')
          }
          const credited = committedAction.creditedAmountPlanDollars
          const destinationBalanceBefore = destination.balance
          destination.balance = destinationBalanceBefore + credited
          recordAnnualRetirementRuntimeApplication({
            applicationKind: 'namedRothDestinationCredit',
            simulatorPhase: 'namedRothConversionDestinationCredit',
            producerOccurrenceKey: null,
            ownerPersonId: null,
            sourceAccountId: null,
            sourceBalanceBeforePlanDollars: null,
            sourceBalanceAfterPlanDollars: null,
            actionId,
            producerOccurrenceKeys: committedAction.debitKeys,
            sourceOwnerPersonIds: committedAction.debitOwners,
            destinationRothAccountId: destination.account.id,
            destinationOwnerPersonId: destination.account.ownerPersonId,
            destinationBalanceBeforePlanDollars: destinationBalanceBefore,
            destinationCreditedAmountPlanDollars: credited,
            destinationBalanceAfterPlanDollars: destination.balance,
          })
          // IRC 408A(d)(3)(F) runs a 5-taxable-year clock from the year of
          // this conversion, and (F)(ii) limits the recapture to the portion
          // that was includible. At a proven-zero basis numerator that is the
          // whole layer; at a positive one the basis return rolled into the
          // Roth was never included in income, so it carries no recapture and
          // `taxableAmount` is strictly less than `amount`.
          const rb = rothBasis.get(rothPoolKey(destination.account))
          if (rb) {
            rb.conversionLayers.push({
              year,
              amount: credited,
              taxableAmount: Math.max(
                0,
                credited - committedAction.nontaxableAmountPlanDollars,
              ),
            })
          }
          namedRothConversionExecuted += credited
        }
      }
    }

    // --- Roth conversions (after RMDs — RMDs must be satisfied first) -------
    const peopleAged65Plus = peopleStates.filter((s) => s.alive && s.ageAttained >= 65).length
    // Forced IRA distributions count only their taxable (post-pro-rata) part as
    // ordinary income. The QCD subtraction is qcdIncomeOffset, not the whole
    // gift: 408(d)(8)(D) treats a distribution as a QCD only to the extent it
    // would otherwise be includible, so the offset carries only the routed
    // dollars that qualified — the beyond-RMD part never entered income at all,
    // and an excess over the owner's aggregate includible amount is not a QCD
    // and arrives on `qcdNonQualifiedOrdinaryIncome` instead.
    const incomeBeforeConversion =
      ordinaryIncome -
      preTaxContributions +
      rmdTotal -
      rmdNontaxable -
      // The annuity payment entered `ordinaryIncome` at its full face amount in
      // the income block, which had no year fraction to price it with. This is
      // the basis share 408(d)(2)(B) gives it, coming back out.
      annuityPaymentNontaxable -
      qcdIncomeOffset -
      namedQcdIncomeOffset +
      qcdNonQualifiedOrdinaryIncome +
      seppTotal -
      seppNontaxable +
      inheritedOrdinaryIncome +
      retirementActionOrdinaryIncome

    // Itemized deductions (today's $ → nominal). The user's SALT estimate grows
    // with general inflation, like spending; federal tax takes the greater of
    // this and the standard deduction. Built here so the conversion/bracket
    // sizers below target the same deduction the tax engine will use.
    const itm = plan.strategies.itemizedDeductions
    const itemizedDeductions = itm
      ? {
          stateAndLocalTaxes: itm.stateAndLocalTaxes * inflFactor,
          mortgageInterest: itm.mortgageInterest * inflFactor,
          charitable: itm.charitable * inflFactor,
        }
      : undefined

    // State-tax inputs (resolved once per year, before conversions so the
    // safety-net trim below can price a conversion's full tax bill).
    // Retirement-income base = pension/annuity + taxable RMD/SEPP/inherited −
    // QCD; traditional spending withdrawals are added per iteration below.
    // Roth conversions are excluded (not exclusion-eligible).
    const residenceState = stateForYear(plan.household, year)
    const stateResidency = stateResidencySegmentsForYear(plan.household, year)
    const agesAlive = peopleStates.filter((s) => s.alive).map((s) => s.ageAttained)
    const privateRetirementBase = Math.max(
      0,
      privateRetirementOrdinary + rmdTotal - rmdNontaxable -
        annuityPaymentNontaxable - qcdIncomeOffset -
        namedQcdIncomeOffset + qcdNonQualifiedOrdinaryIncome +
        seppTotal - seppNontaxable + inheritedOrdinaryIncome,
    )
    const publicPensionBase = Math.max(0, publicPensionOrdinary)
    if (plan.assumptions.stateEffectiveTaxPct <= 0) {
      for (const segment of stateResidency) {
        if (stateParamsFor(segment.state, year)) continue
        warnings.add(
          `State "${segment.state}" isn't modeled for per-state tax yet, so state income tax was treated as $0. ` +
            'If it taxes income, set a flat effective rate under Assumptions to approximate it.',
        )
      }
    }
    const generatedTaxExemptInterest = incomes.taxExemptInterest
    const planDerivedTaxExemptInterest =
      planHasTaxExemptYieldAttestation && generatedTaxExemptInterest > 0
    // Characterization takes the max of the attested household total and the
    // plan-generated subset — never the sum (generated dollars sit inside the
    // attested total when the attestation is current), and never the attested
    // figure alone (a stale attestation must not hide income the plan produces).
    // Cash and balances always follow generated only.
    const yearTaxExemptInterest =
      acaActive && acaContract?.taxExemptInterest.state === 'known'
        ? Math.max(
            Math.max(0, acaContract.taxExemptInterest.amount ?? 0),
            generatedTaxExemptInterest,
          )
        : generatedTaxExemptInterest
    const acaForeignExclusionAddback =
      acaActive && acaContract?.foreignExclusionAddback.state === 'known'
        ? Math.max(0, acaContract.foreignExclusionAddback.amount ?? 0)
        : 0
    // Canonical signed current-year capital before any residual legacy
    // withdrawal sale. Exact-cent action character crosses into Plan dollars
    // once above; proceeds remain liquidity and are not income a second time.
    const preWithdrawalCapitalResult =
      oneTimeGains +
      rebalanceRealizedGains +
      retirementActionCapitalGainOrLoss
    const netCapitalForPreWithdrawalSizing =
      applyCapitalLossCarryforward(
        capitalLossPool,
        incomeBeforeConversion,
        preWithdrawalCapitalResult,
        pack.federalTax.capitalLossOrdinaryOffsetLimit,
      ).netCapitalGain

    const assumedLine8ByOwner = new Map<string, {
      gross: number
      taxable: number
    }>()
    for (const effect of assumedEffects) {
      if (effect.taxYear !== year ||
          effect.calculationScope !== 'form8606Line8NetConversions') continue
      const current = assumedLine8ByOwner.get(effect.ownerPersonId) ?? {
        gross: 0,
        taxable: 0,
      }
      current.gross += ledgerCentsToPlanDollars(effect.grossAmount)
      current.taxable += ledgerCentsToPlanDollars(
        effect.ordinaryIncomeAmount,
      )
      assumedLine8ByOwner.set(effect.ownerPersonId, current)
    }
    const ownedIraConversionTaxableFraction = (ownerPersonId: string) => {
      const assumed = assumedLine8ByOwner.get(ownerPersonId)
      if (assumed !== undefined && assumed.gross > 0) {
        return Math.min(1, Math.max(0, assumed.taxable / assumed.gross))
      }
      return Math.min(
        1,
        Math.max(
          0,
          1 - (iraProRata.get(ownerPersonId)?.nontaxableFraction ?? 0),
        ),
      )
    }
    const conversionTaxableAmountForGross = (grossTarget: number): number => {
      let remainingGross = Math.max(0, grossTarget)
      let taxable = 0
      for (const state of balances) {
        if (!isConvertibleToRoth(state.account) || remainingGross <= 0) continue
        const gross = Math.min(state.balance, remainingGross)
        const fraction = isAggregatedIra(state.account)
          ? ownedIraConversionTaxableFraction(
            state.account.ownerPersonId ?? primary.id,
          )
          : 1
        taxable += gross * fraction
        remainingGross -= gross
      }
      return taxable
    }
    const conversionGrossAmountForTaxable = (
      taxableTarget: number,
    ): number => {
      let remainingTaxable = Math.max(0, taxableTarget)
      let gross = 0
      for (const state of balances) {
        if (!isConvertibleToRoth(state.account)) continue
        const fraction = isAggregatedIra(state.account)
          ? ownedIraConversionTaxableFraction(
            state.account.ownerPersonId ?? primary.id,
          )
          : 1
        if (fraction <= 0) {
          gross += state.balance
          continue
        }
        const take = Math.min(state.balance, remainingTaxable / fraction)
        gross += take
        remainingTaxable -= take * fraction
        if (remainingTaxable <= EPSILON) break
      }
      // Preserve the requested-above-capacity signal so the execution path can
      // retain its existing reduced-conversion warning.
      return remainingTaxable > EPSILON ? gross + remainingTaxable : gross
    }

    // Taxable safety-net floor, conversion side (step 7): trim a fill-to-target
    // conversion so its estimated tax bill stays payable from liquid dollars
    // above the floor after this year's pre-tax cash need. Manual/optimized
    // schedules are executed as requested (the user typed them); generated
    // fill-to-target candidates — including every decision-engine conversion
    // candidate — respect the floor here.
    const trimConversionForFloor = (desired: number): number => {
      const floorNominal = safetyNetFloorToday * inflFactor
      let liquid = 0
      for (const b of balances) {
        if (b.account.type === 'cash' || b.account.type === 'taxable' || b.account.type === 'equityComp') {
          liquid += spendableBalance(b, year)
        }
      }
      const preConversionInflows =
        incomes.total -
        taxableYieldReinvested +
        rmdTotal -
        qcdFromRmd -
        namedQcdRmdSatisfied +
        seppTotal +
        inheritedTotal +
        propertySaleProceedsTotal +
        retirementActionProceeds
      // Liquid dollars available above the floor to pay a conversion's tax:
      // existing spendable liquid plus this year's surplus inflows, net of the
      // pre-tax cash need. Surplus inflows (inflows above expenses+contributions)
      // are real available cash — they land in liquid accounts at year end — so
      // they raise the headroom rather than being clamped away.
      const netLiquid = liquid + preConversionInflows - expenses.total - contributions
      const headroom = Math.max(0, netLiquid - floorNominal)
      const taxOf = (grossConversion: number): number => {
        const extraOrdinary = conversionTaxableAmountForGross(
          grossConversion,
        )
        const netted = applyCapitalLossCarryforward(
          capitalLossPool,
          Math.max(0, incomeBeforeConversion + extraOrdinary),
          preWithdrawalCapitalResult,
          pack.federalTax.capitalLossOrdinaryOffsetLimit,
        )
        return taxCalculator.compute({
          year,
          filingStatus: filingStatusForYear,
          ordinaryIncome: netted.ordinaryAfter,
          capitalGains: netted.netCapitalGain,
          realizedCapitalGainsBeforeCarryforward:
            preWithdrawalCapitalResult,
          taxableInterestIncome: incomes.taxableInterest + ladderTaxableInterest,
          taxExemptInterest: yearTaxExemptInterest,
          foreignExclusionAddback: acaForeignExclusionAddback,
          usGovernmentInterest: ladderTaxableInterest,
          ordinaryDividends: incomes.ordinaryDividends,
          qualifiedDividends: incomes.qualifiedDividends,
          ssBenefits: incomes.socialSecurity,
          peopleAged65Plus,
          inflationScale: limitGrowth,
          state: residenceState,
          stateResidency,
          privateRetirementIncome: privateRetirementBase,
          publicPensionIncome: publicPensionBase,
          agesAlive,
          itemizedDeductions,
        })
      }
      const baseTax = taxOf(0)
      let trimmed = desired
      for (let i = 0; i < 3; i++) {
        const conversionTax = Math.max(0, taxOf(trimmed) - baseTax)
        if (conversionTax <= headroom + EPSILON) break
        trimmed = conversionTax > 0 ? Math.max(0, trimmed * (headroom / conversionTax)) : 0
        if (trimmed <= 0.01) {
          trimmed = 0
          break
        }
      }
      if (trimmed < desired - 0.01) {
        warnings.add('Roth conversions were trimmed so their tax bill stays payable without breaching the taxable safety-net floor.')
      }
      return trimmed
    }

    let rothConversion = 0
    /**
     * The snapshot the allocation policy weighted this year's owners by,
     * published on the year so the optimizer's promotion path can name the
     * same sources and the same cents the ledger moved instead of re-deriving
     * them. Set at the call below and nowhere else, which is what makes its
     * absence mean "the policy was never asked" -- see the field's own
     * contract on `YearResult`.
     */
    let aggregateRothConversionAllocationBalances:
      Readonly<Record<string, number>> | undefined
    /**
     * The household amount that policy was asked for, before it trimmed an
     * owner who has nowhere to convert to. Set at the same call as the
     * snapshot above and nowhere else, so the two are present together or
     * absent together. A promotion that re-allocated the EXECUTED total would
     * trim the absent owner a second time; this is the figure that reproduces
     * what the ledger did.
     */
    let aggregateRothConversionAllocationDesired: number | undefined
    // A named request is authoritative for this year even when blocked. An
    // aggregate fallback would debit different sources and hide that result.
    const rc = currentYearConversionActions.length > 0
      ? { mode: 'none' as const }
      : plan.strategies.rothConversion
    const acaSizingInput = acaActive
      ? acaContract
        ? {
          actionable: acaActive && acaInitialSupportCodes.length === 0,
          taxFamilySize: acaContract.taxFamilyMembers.length,
          fplRegion: acaContract.fplRegion,
          fixedMagiAddbacks:
            (acaContract.foreignExclusionAddback.state === 'known'
              ? (acaContract.foreignExclusionAddback.amount ?? 0)
              : 0) +
            acaContract.taxFamilyMembers
              .filter(
                (member) =>
                  member.relationship === 'dependent' &&
                  member.requiredToFile === 'required',
              )
              .reduce((sum, member) => sum + member.magi, 0),
          taxExemptInterest:
            acaContract.taxExemptInterest.state === 'known'
              ? Math.max(
                  Math.max(0, acaContract.taxExemptInterest.amount ?? 0),
                  generatedTaxExemptInterest,
                )
              : planDerivedTaxExemptInterest
                ? generatedTaxExemptInterest
                : 0,
          foreignExclusionAddback:
            acaContract.foreignExclusionAddback.state === 'known'
              ? (acaContract.foreignExclusionAddback.amount ?? 0)
              : 0,
          }
        : {
            actionable: false,
            taxFamilySize: aliveCount,
            fplRegion: 'contiguous' as const,
            fixedMagiAddbacks: 0,
            taxExemptInterest: 0,
            foreignExclusionAddback: 0,
          }
      : undefined
    if (rc.mode !== 'none' && anyAlive) {
      let desired = 0
      if (rc.mode === 'manual' || rc.mode === 'optimized') {
        // `optimized` is an optimizer-produced schedule; identical to manual in
        // the ledger (the distinct mode only preserves provenance for the UI).
        for (const c of rc.conversions) if (c.year === year) desired += c.amount
      } else if (year >= rc.startYear && year <= rc.endYear) {
        const sized = sizeRothConversion(rc, {
          year,
          pack,
          filingStatus: taxFilingStatusForYear,
          ordinaryIncomeBase: incomeBeforeConversion,
          capitalGains: netCapitalForPreWithdrawalSizing,
          qualifiedDividends: incomes.qualifiedDividends,
          ssBenefits: incomes.socialSecurity,
          peopleAged65Plus,
          householdSize: aliveCount,
          taxExemptInterest: yearTaxExemptInterest,
          aca: acaSizingInput,
          inflationScale: inflFactorFrom(pack.year, year),
          itemizedDeductions,
        })
        if (sized.ok) {
          desired = conversionGrossAmountForTaxable(sized.amount)
          if (desired > 0.01 && safetyNetFloorToday > 0) desired = trimConversionForFloor(desired)
        } else if (sized.reason === 'bad_target') {
          warnings.add('The Roth-conversion target is invalid for this plan (unknown bracket or tier); no conversion made.')
        } else if (sized.reason === 'aca_nonactionable') {
          warnings.add('The ACA-cliff Roth-conversion target was skipped because current-year ACA evidence is non-actionable.')
        }
      }
      if (desired > 0.01) {
        // A conversion is a rollover inside one individual's own accounts:
        // IRC 408(d)(3)(A)(i) admits it only where the amount is paid out of
        // the account maintained for an individual and paid into an account
        // for the benefit of that same individual, and 408A(d)(3)(B) imposes
        // the same identity requirement on conversions directly. Who converts
        // how much, out of which account and into which, is decided by one
        // shared policy module -- the same one the optimizer's promotion
        // chooser reads, so a promoted schedule cannot allocate by a different
        // rule than the ledger executes. The snapshot it weights owners by is
        // `balances` as they stand here: after the RMD block (Treas. Reg.
        // 1.408A-4 A-6(b) requires the forced distribution to precede the
        // conversion) and before anything below reduces `state.balance`.
        //
        // That snapshot is published on the year, at the instant the policy
        // reads it and over exactly the accounts the policy reads. A promotion
        // that weighted owners by any other figures -- the Plan's opening
        // balances, a neighbouring year's, a reconstruction from the closing
        // ones -- would name sources and cents this projection never moved, on
        // a schedule a person is invited to act on. Publishing here is the
        // only way the two can be the same numbers rather than two numbers
        // that agree today.
        //
        // The Plan order this walks in is how the entries are built and not
        // something the published field promises: a plain object enumerates
        // integer-like keys first whatever order they went in, so a consumer
        // recovers Plan order by joining on `plan.accounts`. Stated on the
        // field itself.
        aggregateRothConversionAllocationBalances = Object.freeze(
          Object.fromEntries(
            balances
              .filter((state) =>
                participatesInAggregateRothConversionAllocation(state.account))
              .map((state) => [state.account.id, state.balance]),
          ),
        )
        aggregateRothConversionAllocationDesired = desired
        const allocation = allocateAggregateRothConversionByOwner({
          balances,
          desiredPlanDollars: desired,
          primaryPersonId: primary.id,
        })
        if (allocation.status === 'refused') {
          warnings.add(allocation.reason === 'householdHoldsNoRothAccount'
            ? 'Roth conversions were requested but the plan has no Roth account; conversions skipped.'
            : 'Roth conversions were requested but every Roth account in the plan sits inside an employer plan, ' +
              'and a Roth conversion here can land only in a Roth IRA; conversions skipped.')
        } else {
          // An owner the policy trimmed converts nothing, and the two reasons
          // it can trim for read differently to the person: no Roth at all,
          // against a Roth that sits where this conversion cannot go.
          for (const trim of allocation.trims) {
            const ownerName = personById.get(trim.ownerPersonId)?.name ?? trim.ownerPersonId
            warnings.add(trim.reason === 'ownerHoldsOnlyEmployerDesignatedRoth'
              ? `${ownerName}’s only Roth account is inside an employer plan, and this Roth ` +
                `conversion can land only in ${ownerName}’s own Roth IRA, so ${ownerName}’s share ` +
                'was skipped. ' +
                `Opening a Roth IRA for ${ownerName} would let that share convert.`
              : `${ownerName} has no Roth account, so ${ownerName}’s share of the Roth conversion was skipped — ` +
                'a conversion has to land in the same person’s own Roth. ' +
                `Opening a Roth IRA for ${ownerName} would let that share convert.`)
          }
          interface OwnerConversionCredit {
            readonly producerOccurrenceKeys: string[]
            readonly sourceOwnerPersonIds: Array<string | null>
            convertedPlanDollars: number
            /** This owner's own share of `conversionNontaxable`. */
            nontaxablePlanDollars: number
          }
          const creditByOwner = new Map<string, OwnerConversionCredit>()
          let ownedIraConversionCaptured = false
          // The policy decided every one of these movements, in Plan account
          // order -- a single pass, not grouped by owner, because that is the
          // order the ledger has always visited its balances in and the order
          // the runtime journal records them in.
          for (const draw of allocation.draws) {
            const state = draw.sourceState
            const sourceAccount = draw.sourceAccount
            const destinationAccount = draw.destination.destinationAccount
            const ownerId = draw.ownerPersonId
            const take = draw.amountPlanDollars
            const sourceBalanceBefore = state.balance
            state.balance -= take
            const kind = 'legacyRothConversion' as const
            const producerOccurrenceKey = runtimeOccurrenceKey(
              kind,
              sourceAccount.id,
              destinationAccount.id,
            )
            const credit = creditByOwner.get(ownerId) ?? {
              producerOccurrenceKeys: [],
              sourceOwnerPersonIds: [],
              convertedPlanDollars: 0,
              nontaxablePlanDollars: 0,
            }
            credit.producerOccurrenceKeys.push(producerOccurrenceKey)
            credit.sourceOwnerPersonIds.push(sourceAccount.ownerPersonId)
            credit.convertedPlanDollars += take
            creditByOwner.set(ownerId, credit)
            recordAnnualRetirementRuntimeOccurrence({
              producerOccurrenceKey,
              kind,
              grossAmountPlanDollars: take,
              ownerPersonId: sourceAccount.ownerPersonId,
              sourceAccountId: sourceAccount.id,
              executionDate: null,
              executionSequence: null,
              movementAuthorityId: null,
            })
            let ownedIraApplication:
              SimulatorRetirementRuntimeApplication | null = null
            if (isAggregatedIra(sourceAccount)) {
              ownedIraConversionCaptured = true
              ownedIraApplication = recordAnnualRetirementRuntimeApplication({
                applicationKind: 'debit',
                producerOccurrenceKey,
                simulatorPhase: 'legacyRothConversion',
                ownerPersonId: sourceAccount.ownerPersonId,
                sourceAccountId: sourceAccount.id,
                sourceBalanceBeforePlanDollars: sourceBalanceBefore,
                appliedAmountPlanDollars: take,
                sourceBalanceAfterPlanDollars: state.balance,
              })
            }
            // Pro-rata return of basis on converted IRA dollars (step 5): the
            // basis portion moves to Roth without creating ordinary income.
            if (sourceAccount.kind === 'ira') {
              const proRata = iraProRata.get(ownerId)
              if (proRata &&
                  ownedIraApplication?.applicationKind === 'debit') {
                const split = splitWithAssumedCharacter(proRata, take, {
                  ownerPersonId: ownerId,
                  calculationScope: 'form8606Line8NetConversions',
                  occurrenceKind: 'legacyRothConversion',
                  producerOccurrenceKey,
                  sourceAccountId: sourceAccount.id,
                  mutationOrdinal: ownedIraApplication.mutationOrdinal,
                })
                iraProRata.set(ownerId, split.next)
                // The household scalar still drives the year's ordinary
                // income; the per-owner figure drives that owner's own
                // recapture layer below, which one scalar cannot do once the
                // destinations are per owner.
                conversionNontaxable += split.nontaxable
                credit.nontaxablePlanDollars += split.nontaxable
              }
            }
          }
          rothConversion = [...creditByOwner.values()]
            .reduce((total, credit) => total + credit.convertedPlanDollars, 0)
          // Destination credits follow every debit, in Plan account order of
          // the destinations. Only an owner's own first Plan Roth IRA is
          // credited, so a second Roth IRA belonging to the same owner is
          // skipped here rather than credited twice.
          for (const destination of allocation.destinations) {
            const destinationState = destination.destinationState
            const destinationAccount = destination.destinationAccount
            const credit = creditByOwner.get(destination.ownerPersonId)
            if (credit === undefined || credit.convertedPlanDollars <= 0) continue
            const destinationBalanceBefore = destinationState.balance
            destinationState.balance += credit.convertedPlanDollars
            if (ownedIraConversionCaptured) {
              recordAnnualRetirementRuntimeApplication({
                applicationKind: 'aggregateRothDestinationCredit',
                simulatorPhase:
                  'legacyRothConversionAggregateDestinationCredit',
                producerOccurrenceKey: null,
                ownerPersonId: null,
                sourceAccountId: null,
                sourceBalanceBeforePlanDollars: null,
                sourceBalanceAfterPlanDollars: null,
                producerOccurrenceKeys: credit.producerOccurrenceKeys,
                sourceOwnerPersonIds: credit.sourceOwnerPersonIds,
                destinationRothAccountId: destinationAccount.id,
                destinationOwnerPersonId: destinationAccount.ownerPersonId,
                destinationBalanceBeforePlanDollars: destinationBalanceBefore,
                destinationCreditedAmountPlanDollars:
                  credit.convertedPlanDollars,
                destinationBalanceAfterPlanDollars: destinationState.balance,
              })
            }
            // Converted principal starts its own 5-year recapture clock (the
            // rule that gates an early-retirement conversion ladder). The full
            // amount returns tax-free before earnings, but only the taxable
            // portion is subject to the 10% recapture penalty — nondeductible
            // basis rolled in was never included in income (IRS Pub 590-B).
            // The layer is pushed per owner because the clock runs on the
            // person whose Roth holds it.
            if (credit.convertedPlanDollars > 0.01) {
              const rb = rothBasis.get(rothPoolKey(destinationAccount))
              if (rb) {
                rb.conversionLayers.push({
                  year,
                  amount: credit.convertedPlanDollars,
                  taxableAmount: Math.max(
                    0,
                    credit.convertedPlanDollars - credit.nontaxablePlanDollars,
                  ),
                })
              }
            }
          }
          // One cent, unchanged and still the right tolerance. Both sides are
          // now cent-quantized rather than raw floats -- each slice crosses the
          // exact-cent ledger and the takes are drawn from it -- so the only
          // sub-cent gaps left are float noise and a source balance that ran
          // out within a cent of its slice, neither of which is worth telling
          // anyone about. Above it, the enclosing `desired > 0.01` guarantees
          // the no-balance case clears the threshold and speaks.
          if (rothConversion < allocation.convertibleTargetPlanDollars - 0.01) {
            warnings.add('A requested Roth conversion exceeded the available traditional balance and was reduced.')
          }
        }
      }
    }

    // The year converts by at most one authority: `rc.mode` is forced to
    // 'none' above whenever a named request exists, so the aggregate strategy
    // never sizes a second conversion on top of a committed one. These sum the
    // two anyway rather than assuming that, because the published figure has to
    // be the year's conversions and not whichever route happened to run.
    const totalRothConversion = rothConversion + namedRothConversionExecuted
    // Each authority nets its own basis return. The two are kept apart rather
    // than pooled because they are apportioned against different Form 8606
    // line-8 entry sets and reconciled against different evidence, even though
    // only one of them can have run this year.
    const totalRothConversionTaxable =
      (rothConversion - conversionNontaxable) +
      (namedRothConversionExecuted - namedRothConversionNontaxable)

    // --- fixed-point tax / withdrawal iteration ----------------------------
    // Only the taxable (post-pro-rata) part of a conversion is ordinary income.
    const ordinaryBase = incomeBeforeConversion + totalRothConversionTaxable

    // --- HECM coordinated draws (annuity-pension-and-home-equity, step 4) ---
    // Pfau's coordinated strategy: in the year after the portfolio actually
    // lost money (the realized wealth-weighted return the growth pass applied,
    // covering allocated and single-return accounts alike — not the raw
    // additive shock, which can be negative in a year the portfolio still
    // gained), fund spending from the line's tax-free loan proceeds instead of
    // selling depressed assets. Eligibility and capacity are established here;
    // the ACA/tax fixed point below sizes and commits the draw against the
    // post-credit pre-tax need. The year's taxes still ride the normal
    // withdrawal flow. Deterministic runs (no market series) never have a
    // losing year, so coordinated draws are Monte Carlo / scenario behavior;
    // the last-resort backstop below works everywhere.
    let hecmDraw = 0
    const coordinatedHecmAccounts: Extract<Account, { type: 'property' }>[] = []
    let coordinatedHecmCapacity = 0
    if (anyAlive && year > startYear && priorYearPortfolioReturnPct < 0) {
      for (const account of plan.accounts) {
        if (account.type !== 'property' || account.hecm?.drawPolicy !== 'coordinated') continue
        const line = hecmStates.get(account.id)
        if (!line) continue
        const available = Math.max(0, line.principalLimit - line.loanBalance)
        if (available <= 0) continue
        coordinatedHecmAccounts.push(account)
        coordinatedHecmCapacity += available
      }
    }

    // Exact-taxed property sale proceeds enter the cash flow here (their gains
    // are already in the tax base above), so a sale can fund its own tax bill.
    // HECM draws are loan proceeds — cash in, never income.
    const baseCashInflows =
      incomes.total -
      taxableYieldReinvested +
      rmdTotal -
      qcdFromRmd -
      namedQcdRmdSatisfied +
      seppTotal +
      inheritedTotal +
      propertySaleProceedsTotal +
      retirementActionProceeds
    let cashInflows = baseCashInflows

    // Resolve the year's withdrawal strategy. Bracket targeting reuses the
    // conversion solver to size remaining ordinary-income headroom.
    let withdrawalStrategy: ResolvedWithdrawalStrategy = { mode: 'sequential' }
    const ws = plan.strategies.withdrawalOrder
    if (ws.mode === 'proportional') {
      withdrawalStrategy = { mode: 'proportional' }
    } else if (ws.mode === 'bracketTargeted') {
      const sized = sizeRothConversion(
        { mode: 'fillToTarget', target: 'topOfBracket', targetValue: ws.bracketPct, startYear: year, endYear: year },
        {
          year,
          pack,
          filingStatus: taxFilingStatusForYear,
          ordinaryIncomeBase: ordinaryBase,
          capitalGains: netCapitalForPreWithdrawalSizing,
          qualifiedDividends: incomes.qualifiedDividends,
          ssBenefits: incomes.socialSecurity,
          peopleAged65Plus,
          householdSize: aliveCount,
          taxExemptInterest: yearTaxExemptInterest,
          aca: acaSizingInput,
          inflationScale: inflFactorFrom(pack.year, year),
          itemizedDeductions,
        },
      )
      if (!sized.ok && sized.reason === 'bad_target') {
        warnings.add('The bracket-targeted withdrawal strategy names an unknown bracket; sequential order was used.')
      } else {
        withdrawalStrategy = { mode: 'bracketTargeted', traditionalCap: sized.ok ? sized.amount : 0 }
      }
    }

    // Early-withdrawal penalties: 10% traditional pre-59½ (approximated as
    // age < 60), 20% HSA non-medical pre-65 (v1 treats HSA spending as
    // non-medical; HSA sits last in the drain order). The Rule of 55 waives the
    // traditional penalty for an EMPLOYER plan the owner separated from in/after
    // the year they turned 55 (IRAs never qualify); "separation" is approximated
    // by the owner's retirement age. 72(t) SEPP distributions are taken outside
    // this need-based flow (above), so they're already penalty-free.
    interface NeedBasedOwnedIraCharacter {
      readonly nontaxable: number
      readonly taxableBySourceAccountId: ReadonlyMap<string, number>
    }
    const needBasedOwnedIraCharacter = (
      byAccountId: ReadonlyMap<string, number>,
    ): NeedBasedOwnedIraCharacter => {
      const entriesByOwner = new Map<string, Array<{
        sourceAccountId: string
        grossAmount: number
        assumed: { basisReturn: number; ordinaryIncome: number } | null
      }>>()
      let predictedOrdinal = nextRetirementRuntimeMutationOrdinal
      for (const state of balances) {
        if (!isAggregatedIraThisYear(state.account)) continue
        const grossAmount = byAccountId.get(state.account.id) ?? 0
        if (grossAmount <= 0) continue
        const ownerPersonId = state.account.ownerPersonId ?? primary.id
        const producerOccurrenceKey = runtimeOccurrenceKey(
          'legacyNeedBasedWithdrawal',
          state.account.id,
        )
        const assumed = resolveAssumedCharacter({
          ownerPersonId,
          calculationScope: 'form8606Line7Distributions',
          occurrenceKind: 'legacyNeedBasedWithdrawal',
          producerOccurrenceKey,
          sourceAccountId: state.account.id,
          mutationOrdinal: predictedOrdinal,
          grossAmountPlanDollars: grossAmount,
        })
        predictedOrdinal += 1
        entriesByOwner.set(ownerPersonId, [
          ...(entriesByOwner.get(ownerPersonId) ?? []),
          { sourceAccountId: state.account.id, grossAmount, assumed },
        ])
      }
      let nontaxable = 0
      const taxableBySourceAccountId = new Map<string, number>()
      for (const [ownerPersonId, entries] of entriesByOwner) {
        if (entries.every((entry) => entry.assumed !== null)) {
          for (const entry of entries) {
            const assumed = entry.assumed!
            nontaxable += assumed.basisReturn
            taxableBySourceAccountId.set(
              entry.sourceAccountId,
              (taxableBySourceAccountId.get(entry.sourceAccountId) ?? 0) +
                assumed.ordinaryIncome,
            )
          }
          continue
        }
        const grossAmount = entries.reduce(
          (total, entry) => total + entry.grossAmount,
          0,
        )
        const proRata = iraProRata.get(ownerPersonId)
        const split = proRata === undefined
          ? { nontaxable: 0, taxable: grossAmount }
          : splitIraDistribution(proRata, grossAmount)
        nontaxable += split.nontaxable
        const taxableFraction = grossAmount > 0
          ? split.taxable / grossAmount
          : 1
        for (const entry of entries) {
          taxableBySourceAccountId.set(
            entry.sourceAccountId,
            (taxableBySourceAccountId.get(entry.sourceAccountId) ?? 0) +
              entry.grossAmount * taxableFraction,
          )
        }
      }
      return { nontaxable, taxableBySourceAccountId }
    }

    const penaltiesFor = (
      byAccountId: Map<string, number>,
      iraCharacter = needBasedOwnedIraCharacter(byAccountId),
    ): number => {
      let total = 0
      for (const state of balances) {
        const taken = byAccountId.get(state.account.id) ?? 0
        if (taken <= 0) continue
        const ownerId = state.account.ownerPersonId ?? primary.id
        const ownerAge = stateOf(ownerId).ageAttained
        if (state.account.type === 'traditional') {
          // Return-of-basis is excluded from gross income, so penalize only the
          // taxable portion of an IRA with nondeductible basis; other
          // traditional accounts (employer plans, no basis) penalize in full.
          const penalizable = isAggregatedIraThisYear(state.account)
            ? iraCharacter.taxableBySourceAccountId.get(state.account.id) ??
              taken
            : taken
          // S2 post-election: account is the spouse's own for penalty purposes
          // even though the plan still carries the inherited block (static
          // validators stay pre-transition — WS5 residual).
          const penaltyAccount =
            state.account.type === 'traditional' &&
            isTreatAsOwnEffective(state.account, year)
              ? { ...state.account, inherited: undefined }
              : state.account
          total +=
            penalizable *
            traditionalWithdrawalPenaltyRate(penaltyAccount, {
              ownerAgeAttained: ownerAge,
              ownerRetirementAge: personById.get(ownerId)?.retirementAge ?? null,
            })
        }
        // HSA penalties are computed by the subledger probe (hsaEffect below),
        // which knows how much of a withdrawal is qualified.
      }
      if (total > 0) warnings.add('Early-withdrawal penalties were charged (pre-59½ traditional or pre-65 HSA).')
      return total
    }

    // Roth withdrawals aggregated into their basis pools (an owner's Roth IRAs
    // share one pool per IRS aggregation; employer Roth stays per-account), so a
    // draw is ordered against the owner's whole Roth-IRA basis, not one account's.
    // Inherited Roth (including post-S2) is excluded: voluntary and forced draws
    // are non-taxable and penalty-free in v1 and must not touch the owned pool
    // (basis migration after the flip is a documented residual).
    const rothPoolWithdrawals = (byAccountId: Map<string, number>): Map<string, { taken: number; age: number }> => {
      const byPool = new Map<string, { taken: number; age: number }>()
      for (const state of balances) {
        if (state.account.type !== 'roth') continue
        if (isInheritedRothOutsideOwnedPool(state.account)) continue
        const taken = byAccountId.get(state.account.id) ?? 0
        if (taken <= 0) continue
        const key = rothPoolKey(state.account)
        const age = stateOf(state.account.ownerPersonId ?? primary.id).ageAttained
        const entry = byPool.get(key)
        if (entry) entry.taken += taken
        else byPool.set(key, { taken, age })
      }
      return byPool
    }

    // Roth ordering effect of a candidate Roth draw: the 10% penalty on pre-59½
    // earnings and unseasoned conversions, plus the earnings taxed as ordinary
    // income. Pure (probed against the uncommitted basis pools every iteration);
    // the pools are only mutated once, when the final plan is applied.
    const rothEarlyEffect = (byAccountId: Map<string, number>): { penalty: number; taxableOrdinary: number } => {
      let penalty = 0
      let taxableOrdinary = 0
      for (const [key, { taken, age }] of rothPoolWithdrawals(byAccountId)) {
        const rb = rothBasis.get(key)
        if (!rb) continue
        const split = splitRothWithdrawal(rb, taken, year, age)
        penalty += split.penalty
        taxableOrdinary += split.taxableOrdinary
      }
      return { penalty, taxableOrdinary }
    }

    // HSA subledger effect of a candidate HSA draw (steps 2–3): how much is a
    // qualified medical reimbursement (tax- and penalty-free) vs. non-qualified
    // (ordinary income, 20% penalty pre-65). Pure — probed against the year's
    // fixed qualified cap every iteration; the reimburse-later pool commits
    // once, after the final plan. Cap consumption runs in balances order.
    const hsaEffect = (
      byAccountId: Map<string, number>,
      qualifiedCap = hsaQualifiedCap,
    ): { taxableOrdinary: number; penalty: number; qualified: number; nonQualified: number; capConsumed: number } => {
      let taxableOrdinary = 0
      let penalty = 0
      let qualified = 0
      let nonQualified = 0
      let capLeft = qualifiedCap
      for (const state of balances) {
        if (state.account.type !== 'hsa') continue
        const taken = byAccountId.get(state.account.id) ?? 0
        if (taken <= 0) continue
        const ownerAge = stateOf(state.account.ownerPersonId ?? primary.id).ageAttained
        const treatment = state.account.withdrawalTreatment
        if (treatment === 'capByMedicalExpenses') {
          const q = Math.min(taken, capLeft)
          capLeft -= q
          qualified += q
          const nq = taken - q
          nonQualified += nq
          taxableOrdinary += nq
          penalty += nq * hsaNonQualifiedPenaltyRate(ownerAge)
        } else if (treatment === 'assumeAllQualified') {
          // Explicit simplification: every withdrawal is qualified.
          qualified += taken
        } else {
          // Legacy v1 treatment: tax-free but conservatively penalized pre-65.
          qualified += taken
          penalty += taken * hsaNonQualifiedPenaltyRate(ownerAge)
        }
      }
      return { taxableOrdinary, penalty, qualified, nonQualified, capConsumed: qualifiedCap - capLeft }
    }

    // Pro-rata (Form 8606) return-of-basis in a candidate's need-based IRA
    // draws (step 5). Pure — probed against the uncommitted per-owner year
    // state; the pools commit once, after the final plan.
    // Withdrawals hold the safety-net floor (nominal) back from liquid accounts.
    const floorReserveNominal = safetyNetFloorToday > 0 ? safetyNetFloorToday * inflFactor : 0

    // Capital-loss carryforward (today's start-of-year pool, constant across the
    // iteration); netting reduces ordinary + gains before both federal and state
    // tax so the AGI cascade (taxable SS, IRMAA, ACA, state) falls out for free.
    const lossOffsetLimit = pack.federalTax.capitalLossOrdinaryOffsetLimit
    let spendingNeedBeforeTax = Math.max(0, expenses.total + contributions - cashInflows)
    let acaEvaluationCount = 0
    const evaluateWithdrawalNeed = (need: number, forceGrossAca = false) => {
      acaEvaluationCount++
      const withdrawalPlan = planWithdrawals(need, balances, withdrawalStrategy, year, floorReserveNominal)
      const rothEffect = rothEarlyEffect(withdrawalPlan.byAccountId)
      const iraCharacterProbe = needBasedOwnedIraCharacter(
        withdrawalPlan.byAccountId,
      )
      const iraNontaxableProbe = iraCharacterProbe.nontaxable
      let candidateHsaCap = hsaQualifiedCap
      let hsaProbe = hsaEffect(withdrawalPlan.byAccountId, candidateHsaCap)
      let nettedProbe!: ReturnType<typeof applyCapitalLossCarryforward>
      let tax = 0
      let acaMagiProbe: AcaHouseholdMagiResult | null = null
      let acaQuote: AcaResult | null = null
      let acaSupportCodes: AcaSupportCode[] = [...acaInitialSupportCodes]
      let candidateHealthcare = healthcare
      let hsaCapConverged = false
      // Reconcile HSA taxability explicitly. ACA enrollment premiums are
      // excluded from the qualified-expense cap, so the supported model is
      // normally stable immediately; the bound remains defensive.
      for (let hsaPass = 0; hsaPass < 16; hsaPass++) {
        nettedProbe = applyCapitalLossCarryforward(
          capitalLossPool,
          ordinaryBase +
            withdrawalPlan.byCategory.traditional -
            iraNontaxableProbe +
            rothEffect.taxableOrdinary +
            hsaProbe.taxableOrdinary,
          preWithdrawalCapitalResult + withdrawalPlan.realizedGains,
          lossOffsetLimit,
        )
        const taxInput = {
          year,
          filingStatus: filingStatusForYear,
          ordinaryIncome: nettedProbe.ordinaryAfter,
          capitalGains: nettedProbe.netCapitalGain,
          realizedCapitalGainsBeforeCarryforward:
            preWithdrawalCapitalResult + withdrawalPlan.realizedGains,
          taxableInterestIncome: incomes.taxableInterest + ladderTaxableInterest,
          taxExemptInterest: yearTaxExemptInterest,
          foreignExclusionAddback: acaForeignExclusionAddback,
          usGovernmentInterest: ladderTaxableInterest,
          ordinaryDividends: incomes.ordinaryDividends,
          qualifiedDividends: incomes.qualifiedDividends,
          ssBenefits: incomes.socialSecurity,
          peopleAged65Plus,
          inflationScale: limitGrowth,
          state: residenceState,
          stateResidency,
          privateRetirementIncome:
            privateRetirementBase + withdrawalPlan.byCategory.traditional - iraNontaxableProbe,
          publicPensionIncome: publicPensionBase,
          agesAlive,
          itemizedDeductions,
        }
        tax = taxCalculator.compute(taxInput)
        acaMagiProbe = null
        acaQuote = null
        acaSupportCodes = [...acaInitialSupportCodes]
        candidateHealthcare = healthcareExcludingAcaEnrollment + acaGrossEnrollmentPremium
        if (acaActive && acaContract) {
          const federalProbe = computeFederalTax(taxInput)
          let acaMagiTaxExemptInterest = acaContract.taxExemptInterest
          if (acaContract.taxExemptInterest.state === 'known') {
            acaMagiTaxExemptInterest = {
              state: 'known',
              amount: Math.max(
                Math.max(0, acaContract.taxExemptInterest.amount ?? 0),
                generatedTaxExemptInterest,
              ),
            }
          } else if (planDerivedTaxExemptInterest) {
            if (acaContract.taxExemptInterest.state === 'unknown') {
              acaMagiTaxExemptInterest = {
                state: 'known',
                amount: generatedTaxExemptInterest,
              }
              acaSupportCodes.push('tax-exempt-interest-plan-derived')
            } else if (acaContract.taxExemptInterest.state === 'notApplicable') {
              acaMagiTaxExemptInterest = {
                state: 'known',
                amount: generatedTaxExemptInterest,
              }
              acaSupportCodes.push('tax-exempt-interest-contract-contradicted')
            }
          }
          acaMagiProbe = buildAcaHouseholdMagi({
            federalAgi: federalProbe.agiBeforeFloor,
            grossSocialSecurity: incomes.socialSecurity,
            taxableSocialSecurity: federalProbe.taxableSocialSecurity,
            taxExemptInterest: acaMagiTaxExemptInterest,
            foreignExclusionAddback: acaContract.foreignExclusionAddback,
            dependents: acaContract.taxFamilyMembers
              .filter((member) => member.relationship === 'dependent')
              .map((member) => ({
                personId: member.personId,
                requiredToFile: member.requiredToFile,
                magi: member.magi,
              })),
          })
          acaSupportCodes.push(...acaMagiProbe.blockers)
          // Informational provenance codes (plan-derived, contract-contradicted)
          // annotate the MAGI component's source; they are not blockers and must
          // not stop the quote from pricing.
          const blockingAcaCodes = acaSupportCodes.filter(
            (code) =>
              code !== 'tax-exempt-interest-plan-derived' &&
              code !== 'tax-exempt-interest-contract-contradicted',
          )
          if (blockingAcaCodes.length === 0 && acaMagiProbe.magi !== null && !forceGrossAca) {
            const priced = acaEconomicPremiumByMonth(
              pack,
              acaContract.taxFamilyMembers.length,
              acaMagiProbe.magi,
              acaEnrollmentPremiums,
              acaSlcspBenchmarkPremiums,
              acaContract.fplRegion,
              inflFactorFrom(pack.year, year),
            )
            if (priced.belowEligibilityFloor) {
              acaQuote = priced
              acaSupportCodes.push('below-100-fpl-exception-unsupported')
            } else {
              acaQuote = priced
              candidateHealthcare = healthcareExcludingAcaEnrollment + priced.economicNetPremium
            }
          }
        }
        const nextHsaCap =
          healthcareExcludingMarketplacePremium +
          netCare +
          (hsaReimburseLaterActive ? hsaReimbursablePool : 0)
        if (Math.abs(nextHsaCap - candidateHsaCap) <= EPSILON) {
          hsaCapConverged = true
          break
        }
        candidateHsaCap = nextHsaCap
        hsaProbe = hsaEffect(withdrawalPlan.byAccountId, candidateHsaCap)
      }
      if (!hsaCapConverged && acaActive) {
        acaSupportCodes.push('hsa-cap-fixed-point-nonconvergent')
        candidateHealthcare = healthcareExcludingAcaEnrollment + acaGrossEnrollmentPremium
      }
      const penalties = penaltiesFor(
        withdrawalPlan.byAccountId,
        iraCharacterProbe,
      ) + rothEffect.penalty + hsaProbe.penalty
      return {
        withdrawalPlan,
        tax,
        penalties,
        requiredNeed: Math.max(
          0,
          expenses.total +
            (candidateHealthcare - healthcare) +
            contributions +
            tax +
            penalties -
            cashInflows,
        ),
        acaMagiProbe,
        acaQuote,
        acaSupportCodes: [...new Set(acaSupportCodes)],
        healthcare: candidateHealthcare,
        hsaQualifiedCap: candidateHsaCap,
      }
    }

    // Fully solve the one-dimensional funding equation. The quick pass handles
    // ordinary cases; bracket expansion and bisection cover slower tax feedback
    // without allowing a provisional withdrawal plan to escape into the ledger.
    const solveFundingRoot = (
      initialNeed: number,
      forceGrossAca = false,
      maxEvaluations = MAX_ACA_FIXED_POINT_EVALUATIONS,
      directIterationLimit = MAX_TAX_ITERATIONS,
    ) => {
      const evaluationLimit = acaEvaluationCount + maxEvaluations
      let need = initialNeed
      let evaluation = evaluateWithdrawalNeed(need, forceGrossAca)
      let converged = Math.abs(evaluation.requiredNeed - need) <= EPSILON
      for (
        let i = 1;
        i < directIterationLimit && !converged && acaEvaluationCount < evaluationLimit;
        i++
      ) {
        need = evaluation.requiredNeed
        evaluation = evaluateWithdrawalNeed(need, forceGrossAca)
        converged = Math.abs(evaluation.requiredNeed - need) <= EPSILON
      }
      if (converged) {
        return { evaluation, need, converged, closestResidual: 0 }
      }

      // A finite portfolio brackets the root: once all spendable balances are
      // exhausted, requiredNeed is bounded while the candidate keeps growing.
      let lowerNeed = 0
      let lower = evaluateWithdrawalNeed(lowerNeed, forceGrossAca)
      let upperNeed = Math.max(1, need, evaluation.requiredNeed)
      let upper = evaluateWithdrawalNeed(upperNeed, forceGrossAca)
      let upperResidual = upper.requiredNeed - upperNeed
      for (
        let i = 0;
        i < 64 &&
        upperResidual > EPSILON &&
        upper.withdrawalPlan.shortfall <= EPSILON &&
        acaEvaluationCount < evaluationLimit;
        i++
      ) {
        upperNeed *= 2
        upper = evaluateWithdrawalNeed(upperNeed, forceGrossAca)
        upperResidual = upper.requiredNeed - upperNeed
      }

      // Once withdrawals are exhausted, jump to the bounded requirement rather
      // than doubling through inputs that cannot change the withdrawal mix.
      if (
        upperResidual > EPSILON &&
        upper.withdrawalPlan.shortfall > EPSILON &&
        acaEvaluationCount < evaluationLimit
      ) {
        upperNeed = Math.max(upperNeed, upper.requiredNeed)
        upper = evaluateWithdrawalNeed(upperNeed, forceGrossAca)
        upperResidual = upper.requiredNeed - upperNeed
      }

      if (Math.abs(upperResidual) <= EPSILON) {
        return { evaluation: upper, need: upperNeed, converged: true, closestResidual: 0 }
      }

      // Tax rules can contain hard steps. Bisection therefore requires a true
      // sign-change bracket and retains the closest endpoint if none is exact.
      for (
        let i = 0;
        i < 64 &&
        upperResidual <= 0 &&
        acaEvaluationCount < evaluationLimit;
        i++
      ) {
        const midpointNeed = (lowerNeed + upperNeed) / 2
        const midpoint = evaluateWithdrawalNeed(midpointNeed, forceGrossAca)
        const residual = midpoint.requiredNeed - midpointNeed
        if (Math.abs(residual) <= EPSILON) {
          return { evaluation: midpoint, need: midpointNeed, converged: true, closestResidual: 0 }
        }
        if (residual > 0) {
          lowerNeed = midpointNeed
          lower = midpoint
        } else {
          upperNeed = midpointNeed
          upper = midpoint
          upperResidual = residual
        }
        if (upperNeed - lowerNeed <= EPSILON) break
      }

      const lowerResidual = Math.abs(lower.requiredNeed - lowerNeed)
      const closestResidual = Math.min(lowerResidual, Math.abs(upperResidual))
      return {
        evaluation: lowerResidual <= Math.abs(upperResidual) ? lower : upper,
        need: lowerResidual <= Math.abs(upperResidual) ? lowerNeed : upperNeed,
        converged: false,
        closestResidual,
      }
    }

    // A coordinated HECM draw changes withdrawals, withdrawals change ACA
    // MAGI, and the reconciled premium changes the pre-tax cash need the draw
    // is intended to cover. Solve that small outer fixed point with the same
    // evaluator used by the final ledger. The line itself remains untouched
    // during probing, so failed or oscillating probes cannot create debt.
    if (coordinatedHecmCapacity > EPSILON && spendingNeedBeforeTax > EPSILON) {
      let candidateDraw = 0
      let coordinatedDrawConverged = false
      for (let drawPass = 0; drawPass < 16; drawPass++) {
        cashInflows = baseCashInflows + candidateDraw
        const probe = solveFundingRoot(
          Math.max(0, expenses.total + contributions - cashInflows),
        )
        if (!probe.converged) break

        const postCreditPreTaxNeed = Math.max(
          0,
          expenses.total +
            (probe.evaluation.healthcare - healthcare) +
            contributions -
            baseCashInflows,
        )
        const nextDraw = Math.min(coordinatedHecmCapacity, postCreditPreTaxNeed)
        if (Math.abs(nextDraw - candidateDraw) <= EPSILON) {
          hecmDraw = nextDraw
          coordinatedDrawConverged = true
          break
        }
        candidateDraw = nextDraw
      }
      if (!coordinatedDrawConverged) hecmDraw = 0
      cashInflows = baseCashInflows + hecmDraw
      spendingNeedBeforeTax = Math.max(0, expenses.total + contributions - cashInflows)
      // Probes are implementation detail; convergence diagnostics describe the
      // accepted final funding solve only.
      acaEvaluationCount = 0
    }

    // Keep the accepted withdrawal plan paired with the tax and premium result
    // that produced it.
    const fundingRoot = solveFundingRoot(spendingNeedBeforeTax)
    let evaluation = fundingRoot.evaluation
    let converged = fundingRoot.converged
    let acaFixedPointFailed = false

    if (!converged) {
      if (acaActive) {
        // A discontinuous cliff can leave no subsidized fixed point. Never
        // retain the cheaper provisional credit: restart from gross premium
        // with the same bounded solver and make the ACA result non-actionable.
        acaFixedPointFailed = true
        const grossRoot = solveFundingRoot(Math.max(0, evaluation.requiredNeed), true)
        evaluation = grossRoot.evaluation
        converged = grossRoot.converged
        warnings.add(
          `ACA premium, tax, and withdrawals did not reach a stable subsidized fixed point for ${year}; gross enrollment premium was funded.`,
        )
      } else {
        warnings.add(
          `Tax and withdrawal funding could not reconcile within half a cent for ${year}; the closest result differs by $${fundingRoot.closestResidual.toFixed(2)}.`,
        )
      }
    }

    // The ACA cliff can create two self-consistent funding basins: a gross
    // premium draw that pushes MAGI over the cliff, and a subsidized draw that
    // remains below it. A single locally stable root is not enough evidence to
    // choose between them. Probe the opposite basin deterministically and fail
    // closed to the gross result when both roots exist.
    let acaConflictingCliffBasins = false
    if (
      acaActive &&
      converged &&
      !acaFixedPointFailed &&
      acaInitialSupportCodes.length === 0 &&
      evaluation.acaQuote !== null
    ) {
      if (evaluation.acaQuote.overCliff) {
        const lowRoot = solveFundingRoot(
          Math.max(0, spendingNeedBeforeTax - acaGrossEnrollmentPremium),
          false,
          MAX_ACA_FIXED_POINT_EVALUATIONS,
          MAX_ACA_FIXED_POINT_EVALUATIONS,
        )
        const lowEvaluation = lowRoot.evaluation
        if (
          lowRoot.converged &&
          lowEvaluation.acaSupportCodes.length === 0 &&
          lowEvaluation.acaQuote !== null &&
          !lowEvaluation.acaQuote.overCliff &&
          lowEvaluation.healthcare + EPSILON < evaluation.healthcare
        ) {
          acaConflictingCliffBasins = true
        }
      } else {
        // A forced-gross solve locates the high-premium candidate without
        // letting the provisional credit pull it back into the subsidized
        // basin. Re-evaluate the exact same candidate need under normal ACA
        // pricing before accepting it: only a state-paired, independently
        // self-consistent over-cliff result proves the second basin exists.
        const grossRoot = solveFundingRoot(
          spendingNeedBeforeTax,
          true,
          MAX_ACA_FIXED_POINT_EVALUATIONS,
          MAX_ACA_FIXED_POINT_EVALUATIONS,
        )
        if (grossRoot.converged) {
          const grossEvaluation = evaluateWithdrawalNeed(grossRoot.need)
          if (
            Math.abs(grossEvaluation.requiredNeed - grossRoot.need) <= EPSILON &&
            grossEvaluation.acaSupportCodes.length === 0 &&
            grossEvaluation.acaQuote?.overCliff &&
            grossEvaluation.healthcare > evaluation.healthcare + EPSILON
          ) {
            evaluation = grossEvaluation
            converged = true
            acaConflictingCliffBasins = true
          }
        }
      }
      if (acaConflictingCliffBasins) {
        warnings.add(
          `ACA funding has conflicting subsidized and gross-premium fixed points for ${year}; gross enrollment premium was funded.`,
        )
      }
    }

    const healthcareDelta = evaluation.healthcare - healthcare
    if (Math.abs(healthcareDelta) > 0) {
      healthcare = evaluation.healthcare
      qualifiedMedicalThisYear = healthcareExcludingMarketplacePremium + netCare
      hsaQualifiedCap = evaluation.hsaQualifiedCap
      requiredSpendingBase += healthcareDelta
      targetSpendingBase += healthcareDelta
      expenses.healthcare = healthcare
      expenses.requiredSpending += healthcareDelta
      expenses.targetSpending += healthcareDelta
      expenses.intendedSpending += healthcareDelta
      expenses.total += healthcareDelta
    }
    const { withdrawalPlan, tax, penalties } = evaluation
    // Commit only the coordinated draw accepted by the converged ACA/tax
    // funding solve. Capacity was measured before probing and no line balance
    // has changed since, so allocation is deterministic across multiple lines.
    let remainingCoordinatedDraw = hecmDraw
    for (const account of coordinatedHecmAccounts) {
      if (remainingCoordinatedDraw <= EPSILON) break
      const line = hecmStates.get(account.id)
      if (!line) continue
      const draw = Math.min(remainingCoordinatedDraw, Math.max(0, line.principalLimit - line.loanBalance))
      if (draw <= 0) continue
      line.loanBalance += draw
      remainingCoordinatedDraw -= draw
    }
    // Any open HECM line backstops a true portfolio shortfall regardless of
    // draw policy — no borrower defaults on spending with credit available.
    // The policy only controls proactive (coordinated) draws above.
    let hecmShortfallDraw = 0
    if (withdrawalPlan.shortfall > EPSILON && anyAlive) {
      let remaining = withdrawalPlan.shortfall
      for (const account of plan.accounts) {
        if (account.type !== 'property' || !account.hecm) continue
        const line = hecmStates.get(account.id)
        if (!line) continue
        const draw = Math.min(remaining, Math.max(0, line.principalLimit - line.loanBalance))
        if (draw <= 0) continue
        line.loanBalance += draw
        hecmShortfallDraw += draw
        remaining -= draw
        if (remaining <= EPSILON) break
      }
      hecmDraw += hecmShortfallDraw
    }
    const shortfallAfterHecm = Math.max(0, withdrawalPlan.shortfall - hecmShortfallDraw)
    const surplus = Math.max(0, cashInflows - expenses.total - contributions - tax - penalties)
    const rothEffectFinal = rothEarlyEffect(withdrawalPlan.byAccountId)
    const hsaEffectFinal = hsaEffect(withdrawalPlan.byAccountId)
    const iraCharacterFinal = needBasedOwnedIraCharacter(
      withdrawalPlan.byAccountId,
    )
    const iraNontaxableFinal = iraCharacterFinal.nontaxable
    if (withdrawalPlan.reserveUsed > EPSILON) {
      warnings.add('Spending needs dipped into the taxable safety-net floor after all other accounts were exhausted.')
    }
    if (hsaEffectFinal.taxableOrdinary > EPSILON) {
      warnings.add(
        'Some HSA withdrawals exceeded modeled qualified medical expenses; the excess was taxed as ordinary income (and penalized before 65).',
      )
    }
    if (rothEffectFinal.penalty > 0) {
      warnings.add(
        'Early Roth distributions were penalized: earnings before 59½, or converted amounts tapped within 5 years (the conversion-ladder seasoning rule).',
      )
    }

    if (rc.mode === 'fillToTarget' && rothConversion > 0 && withdrawalPlan.byCategory.traditional > 0.01) {
      warnings.add(
        'Spending withdrawals from traditional accounts pushed income above the Roth-conversion target in some years.',
      )
    }

    // Apply the carryforward to the final realized figures, then commit the
    // depleted pool to next year. Netted ordinary/gains feed MAGI, taxable SS,
    // and the gain-harvesting headroom below, so the AGI cascade is consistent.
    // IRA pro-rata basis reduces the taxable traditional draw; non-qualified
    // HSA withdrawals add ordinary income.
    const lossNetting = applyCapitalLossCarryforward(
      capitalLossPool,
      Math.max(
        0,
        ordinaryBase +
          withdrawalPlan.byCategory.traditional -
          iraNontaxableFinal +
          rothEffectFinal.taxableOrdinary +
          hsaEffectFinal.taxableOrdinary,
      ),
      preWithdrawalCapitalResult + withdrawalPlan.realizedGains,
      lossOffsetLimit,
    )
    capitalLossPool = lossNetting.remaining

    // Record realized MAGI (≈ AGI) for IRMAA's 2-year lookback and ACA. Non-
    // qualified Roth earnings are ordinary income, so they lift MAGI too.
    // gainsRealized is signed (a net capital loss is negative); floor MAGI at 0.
    const ordinaryRealized = lossNetting.ordinaryAfter
    const gainsRealized = lossNetting.netCapitalGain
    const realizedCapitalGainsBeforeCarryforward =
      preWithdrawalCapitalResult + withdrawalPlan.realizedGains
    const taxableSs = taxableSocialSecurity(
      pack,
      taxFilingStatusForYear,
      ordinaryRealized + gainsRealized + incomes.qualifiedDividends,
      incomes.socialSecurity,
      yearTaxExemptInterest,
      acaForeignExclusionAddback,
    )
    magiHistory.set(
      year,
      Math.max(
        0,
        ordinaryRealized +
          gainsRealized +
          incomes.qualifiedDividends +
          taxableSs +
          yearTaxExemptInterest,
      ),
    )

    // Gain-harvesting advisory: room left in the 0% LTCG bracket this year, given
    // the realized income and deductions (roadmap V8 §4). Advisory only — the
    // engine doesn't auto-harvest. Federal-law boundary, so computed federally.
    const federalDetail = computeFederalTax({
      year,
      filingStatus: filingStatusForYear,
      ordinaryIncome: ordinaryRealized,
      capitalGains: gainsRealized,
      realizedCapitalGainsBeforeCarryforward,
      taxableInterestIncome: incomes.taxableInterest + ladderTaxableInterest,
      taxExemptInterest: yearTaxExemptInterest,
      foreignExclusionAddback: acaForeignExclusionAddback,
      usGovernmentInterest: ladderTaxableInterest,
      ordinaryDividends: incomes.ordinaryDividends,
      qualifiedDividends: incomes.qualifiedDividends,
      ssBenefits: incomes.socialSecurity,
      peopleAged65Plus,
      inflationScale: limitGrowth,
      itemizedDeductions,
    })
    const ltcgZeroHeadroom = federalDetail.zeroRateLtcgHeadroom
    if (federalDetail.alternativeMinimumTax > EPSILON) {
      warnings.add('The planning-grade AMT screen bound in at least one year; tax includes the AMT excess.')
    }

    let yearAcaResult: YearAcaResult | undefined
    if (acaActive) {
      const supportCodes = [...evaluation.acaSupportCodes]
      if (acaFixedPointFailed || !converged) supportCodes.push('fixed-point-nonconvergent')
      if (acaConflictingCliffBasins) supportCodes.push('conflicting-cliff-fixed-points')
      const uniqueSupportCodes = [...new Set(supportCodes)]
      const informationalAcaCodes = uniqueSupportCodes.filter(
        (code) =>
          code === 'tax-exempt-interest-plan-derived' ||
          code === 'tax-exempt-interest-contract-contradicted',
      )
      const actionable =
        uniqueSupportCodes.filter(
          (code) =>
            code !== 'tax-exempt-interest-plan-derived' &&
            code !== 'tax-exempt-interest-contract-contradicted',
        ).length === 0 &&
        evaluation.acaQuote !== null
      const pricedQuote = evaluation.acaQuote
      const quote = actionable ? pricedQuote : null
      if (quote?.overCliff) {
        warnings.add('Some pre-65 years exceed 400% of the federal poverty line: no ACA credit (the cliff).')
      }
      const dependentEvidence = new Map(
        (evaluation.acaMagiProbe?.dependents ?? []).map((dependent) => [dependent.personId, dependent]),
      )
      const taxFamilyMembers =
        acaContract?.taxFamilyMembers.map((member) => ({
          ...member,
          includedMagi:
            member.relationship === 'dependent'
              ? (dependentEvidence.get(member.personId)?.includedMagi ?? 0)
              : 0,
        })) ?? []
      const coveredMembers = acaContract && !exampleContractInputMismatch
        ? acaContract.coveredMembers.map((member) => ({
            personId: member.personId,
            coveredMonths: member.enrollmentPremiumByMonth
              .map((premium, month) => (premium > 0 ? month + 1 : 0))
              .filter((month) => month > 0),
            grossEnrollmentPremium: member.enrollmentPremiumByMonth.reduce((sum, premium) => sum + premium, 0),
            applicableSlcspPremium: member.slcspBenchmarkPremiumByMonth.reduce(
              (sum, premium, month) =>
                sum + ((member.enrollmentPremiumByMonth[month] ?? 0) > 0 ? premium : 0),
              0,
            ),
          }))
        : acaContractsForYear.length > 1
          ? []
          : peopleStates
            .filter((person) => {
              const months = marketplaceMonthsBeforeMedicare(person)
              return person.alive && months > 0 && hc.pre65MonthlyPremiumPerPerson > 0
            })
            .map((person) => {
              const months = marketplaceMonthsBeforeMedicare(person)
              const premium = hc.pre65MonthlyPremiumPerPerson * healthInflFactor
              return {
                personId: person.personId,
                coveredMonths: Array.from({ length: months }, (_, month) => month + 1),
                grossEnrollmentPremium: premium * months,
                applicableSlcspPremium: premium * months,
              }
            })
      const fpl =
        acaContract && !isStandIn && acaContract.taxFamilyMembers.length > 0
          ? acaFederalPovertyLine(
              pack,
              acaContract.taxFamilyMembers.length,
              acaContract.fplRegion,
              inflFactorFrom(pack.year, year),
            )
          : null
      const fplPct = pricedQuote?.fplPct ?? null
      const cliffState: YearAcaResult['cliffState'] =
        uniqueSupportCodes.includes('below-100-fpl-exception-unsupported')
          ? 'below-eligibility-floor'
          : !actionable || fplPct === null
            ? 'unsupported'
            : quote!.overCliff
              ? 'above-cliff'
              : Math.abs(fplPct - pack.aca.maxFplPctForCredit) <= 1e-9
                ? 'at-cliff'
                : 'below-cliff'
      yearAcaResult = {
        readiness: actionable ? 'actionable' : 'nonActionable',
        supportCodes: actionable
          ? ['actionable', ...informationalAcaCodes]
          : uniqueSupportCodes,
        householdMagi: actionable ? evaluation.acaMagiProbe?.magi ?? null : null,
        magiComponents: evaluation.acaMagiProbe?.components ?? {
          federalAgi: federalDetail.agiBeforeFloor,
          nontaxableSocialSecurity: Math.max(0, incomes.socialSecurity - federalDetail.taxableSocialSecurity),
          taxExemptInterest: yearTaxExemptInterest,
          foreignExclusionAddback: acaForeignExclusionAddback,
          requiredFilerDependentMagi: 0,
        },
        fplRegion: acaContract?.fplRegion ?? null,
        federalPovertyLine: fpl,
        fplPct,
        taxFamilySize: acaContract?.taxFamilyMembers.length ?? null,
        taxFamilyMembers,
        coveredMembers,
        grossEnrollmentPremium: acaGrossEnrollmentPremium,
        applicableSlcspPremium: acaContract && !exampleContractInputMismatch
          ? acaSlcspBenchmarkPremiums.reduce((sum, premium) => sum + premium, 0)
          : null,
        modeledAllowablePtc: quote?.modeledAllowablePtc ?? null,
        economicNetPremium: healthcare - healthcareExcludingAcaEnrollment,
        aptcModeled: false,
        form8962ReconciliationSupported: false,
        cliffState,
        convergence: {
          converged: actionable && converged && !acaFixedPointFailed,
          iterations: Math.min(acaEvaluationCount, MAX_ACA_FIXED_POINT_EVALUATIONS),
          maxIterations: MAX_ACA_FIXED_POINT_EVALUATIONS,
          residualDollars: Math.abs(
            evaluation.requiredNeed -
              (evaluation.withdrawalPlan.byCategory.total + evaluation.withdrawalPlan.shortfall),
          ),
          grossPremiumFallback: !actionable,
        },
      }
      if (!actionable) {
        warnings.add(
          'Some Marketplace years use gross enrollment premium because required ACA reconciliation facts are missing or unsupported.',
        )
      }
    }

    // V8 optimizer linearization probe (no-op unless a sink is supplied). The
    // ordinary base excludes all traditional distributions and conversions —
    // `incomeBeforeConversion` already nets out preTaxContributions and QCD and
    // includes RMD, so subtracting RMD leaves the non-traditional ordinary
    // income; the baseline taxable-SS portion is folded in as a constant.
    let optimizerProbe: OptimizerYearProbe | null = null
    if (opts.captureOptimizerInputs) {
      // Bucket by status AT PROJECTION START only (same rule as
      // `optimizerOpeningBuckets`): electionYear <= startYear → owned for the
      // whole LP horizon; else inherited. Mid-horizon S2 flips are a documented
      // LP granularity approximation — the exact ledger flips year-by-year, but
      // the LP holds one static bucket so rmdDivisor's numerator and the opening
      // bucket stay consistent. Probe remapping below publishes a mid-horizon-
      // flipped account's post-flip owner RMD as part of the inherited-
      // traditional forced flow (added to probe `inheritedDistribution`,
      // excluded from probe `rmd`) so the LP's static inheritedTraditional
      // bucket sees consistent floors; YearResult.rmd / inherited* fields are
      // unchanged.
      let startTraditional = 0
      let startInheritedTraditional = 0
      for (const state of balances) {
        if (state.account.type !== 'traditional') continue
        const opening = startOfYearBalance.get(state.account.id) ?? 0
        if (
          !state.account.inherited ||
          isTreatAsOwnEffective(state.account, startYear)
        ) {
          startTraditional += opening
        } else {
          startInheritedTraditional += opening
        }
      }
      // Mid-horizon S2 flip: accounts still in the inheritedTraditional opening
      // bucket whose owner RMD executed this year after the flip. Remap those
      // dollars into the probe's inherited forced flow only (ledger YearResult
      // fields stay on the owner-RMD path).
      let midHorizonFlipOwnerRmd = 0
      for (const state of balances) {
        if (state.account.type !== 'traditional') continue
        if (state.account.inherited === undefined) continue
        if (isTreatAsOwnEffective(state.account, startYear)) continue
        if (!isTreatAsOwnEffective(state.account, year)) continue
        const take = rmdTakeByAccount.get(state.account.id) ?? 0
        if (take > 0 && !planDollarsMoveNoLedgerCent(take)) {
          midHorizonFlipOwnerRmd += take
        }
      }
      const probeRmd = Math.max(0, rmdTotal - midHorizonFlipOwnerRmd)
      const probeInheritedDistribution =
        inheritedOrdinaryIncome + midHorizonFlipOwnerRmd
      const rmdTaxableTotal = Math.max(0, rmdTotal - rmdNontaxable)
      const probeRmdTaxable =
        rmdTotal > 0
          ? rmdTaxableTotal * (probeRmd / rmdTotal)
          : 0
      // The charitable exclusion riding on this year's forced owned-IRA
      // distribution, carried on its own term instead of inside the base.
      //
      // WHY IT CANNOT STAY IN THE BASE. `incomeBeforeConversion` books the
      // forced distribution NET of the gifts routed out of it (it carries
      // `− qcdIncomeOffset − namedQcdIncomeOffset`), so subtracting the WHOLE
      // `rmdTotal − rmdNontaxable` below removes more than the RMD ever
      // contributed and leaves the exclusion behind as a negative residue. The
      // `Math.max(0, …)` guard exists for a different shape — non-forced income
      // that goes negative under pre-tax contributions — and it deleted that
      // residue outright whenever non-forced income was smaller than the gift,
      // which is the ordinary retiree whose income IS the RMD. The LP then
      // charged full ordinary income on the RMD it re-decides as `wt`, saw its
      // low brackets already full, and under-recommended the year's conversion
      // by the whole gift, every year the gift ran.
      //
      // Netting the RMD's NET contribution leaves the clamp guarding exactly
      // the non-forced income it was written for, and the exclusion reaches the
      // LP as a term the bracket model applies against the forced dollars it
      // books itself.
      //
      // `Math.min` against the taxable forced total is still true by
      // construction, but NOT for the reason it used to be. The aggregate arm no
      // longer caps itself at the requirement's taxable share — under
      // §408(d)(8)(D) the qualified gift is the routed GROSS — so the guarantee
      // now comes from the other side: `rmdNontaxable` is basis recovered on the
      // requirement AFTER the gift was carved out of its line-7 gross, so it can
      // never exceed `ownedIraRmdTotal − qcdIncomeOffset`, which leaves
      // `rmdTotal − rmdNontaxable ≥ qcdIncomeOffset`. The named arm still caps
      // at the requirement's taxable share and stands the aggregate one down, so
      // the two never sum. The `Math.min` is written down so the LP's term can
      // promise it never exceeds the income it excludes without depending on
      // which arm produced it.
      //
      // The exclusion GREW for every basis-holding household when the aggregate
      // arm was corrected, and that is the point: the term now carries the whole
      // gift the statute excludes instead of the clamped share the old ceiling
      // left behind.
      const optimizerForcedDistributionOrdinaryExclusion = Math.max(
        0,
        Math.min(
          qcdIncomeOffset + namedQcdIncomeOffset,
          rmdTotal - rmdNontaxable,
        ),
      )
      // The CASH side of the same gift, which the exclusion above does not
      // touch and cannot: one is dollars taken out of the year's INCOME, the
      // other is dollars taken out of the year's SPENDABLE MONEY, and a QCD
      // routed out of an RMD does both.
      //
      // `baseCashInflows` below books the forced distribution and then nets
      // these dollars straight back out (`+ rmdTotal − qcdFromRmd −
      // namedQcdRmdSatisfied`), because a distribution paid to a charity is
      // never in the household's hand. The LP has no such netting: it
      // re-decides the whole forced distribution as its own `wt` and the cash
      // constraint credits `wt` at 1.0, so the solve funds spending from
      // dollars the household gave away and never has to raise them anywhere
      // real. The gift is free money to the solver and the error compounds:
      // every gifted dollar it spends is a dollar it never withdrew, so the
      // buckets it carries forward are too big as well.
      //
      // THE GROSS, NOT THE TAXABLE SHARE, and still deliberately a different
      // figure from the exclusion above. What left the cash flow is every routed
      // dollar; what left income is only the part of them that qualified. There
      // is no double adjustment between them: they are subtracted from different
      // constants on different sides of the model.
      //
      // THE TWO NOW COINCIDE ON THE ORDINARY HOUSEHOLD, and that is a result
      // rather than a coincidence. §408(d)(8)(D) deems the gift to consist of
      // otherwise-includible dollars up to the owner's AGGREGATE includible
      // amount — the whole of their individual retirement plans treated as one
      // contract, less basis — so on any household whose IRAs hold more pre-tax
      // dollars than the gift, the qualified amount IS the gross and the two
      // terms carry the same number. They separate only where the gift runs past
      // that aggregate amount, on a near-all-basis IRA: there part of the gift is
      // not a QCD, the cash still left the household, and the income term
      // legitimately falls short of the gross.
      //
      // This used to be the site of a registered defect — `qcdIncomeOffset`
      // capped at `ownedIraRmdTotal − rmdNontaxable`, the required
      // distribution's own taxable share, which is a far smaller ceiling than
      // the statute's on every shape where the owner's IRAs hold more includible
      // dollars than one year's RMD. That is fixed above and the record on
      // `taxRuleRegistry.ts`, `irc-408-d-8-D-projection-qcd-after-pro-rata`, is
      // settled. The CASH term never moved: it is the gross, and the gross was
      // never in dispute.
      //
      // The BEYOND-RMD arm is deliberately not here, on the same reasoning that
      // keeps it off `exogenousStrategyAccountMovement`'s exclusion list and
      // ON its debit list: those dollars never entered `baseCashInflows` at all
      // — they leave the IRA directly, with no distribution to route — so the
      // LP never credited cash for them, and giving cash back for them would
      // charge the solve twice for one gift.
      //
      // `Math.min` against the forced total is true by construction (the
      // aggregate arm caps at `ownedIraRmdTotal`, the named arm at the owner's
      // still-unmet requirement, and a named request stands the aggregate one
      // down so the two never sum) and is written down so the LP's term can
      // promise it never exceeds the forced draw whose cash it takes back.
      const optimizerForcedDistributionCashDiversion = Math.max(
        0,
        Math.min(qcdFromRmd + namedQcdRmdSatisfied, rmdTotal),
      )
      const optimizerOrdinaryIncomeBase =
        Math.max(
          0,
          incomeBeforeConversion -
            (rmdTotal - rmdNontaxable - optimizerForcedDistributionOrdinaryExclusion) -
            inheritedOrdinaryIncome,
        ) + taxableSs
      // Deliberate conservative MILP boundary: the linear optimizer does not
      // model a signed capital-loss pool, so it never receives a negative base.
      // Candidate schedules are still repriced authoritatively by this exact
      // ledger, which preserves the signed result and carryforward.
      const optimizerCapitalGainsBase =
        Math.max(0, preWithdrawalCapitalResult) + incomes.qualifiedDividends
      let optimizerOwnerTraditionalWithdrawal = 0
      for (const state of balances) {
        if (state.account.type !== 'traditional') continue
        // S2 post-election is owner-side; pre-transition inherited stays out.
        if (
          state.account.inherited &&
          !isTreatAsOwnEffective(state.account, year)
        ) continue
        optimizerOwnerTraditionalWithdrawal +=
          withdrawalPlan.byAccountId.get(state.account.id) ?? 0
      }
      const optimizerTraditionalGross =
        rmdTotal + optimizerOwnerTraditionalWithdrawal
      const optimizerTraditionalTaxable =
        (rmdTotal - rmdNontaxable) +
        (optimizerOwnerTraditionalWithdrawal - iraNontaxableFinal)
      let remainingTraditionalGross = 0
      let remainingTraditionalTaxable = 0
      let remainingConvertibleGross = 0
      for (const state of balances) {
        if (
          state.account.type === 'traditional' &&
          (!state.account.inherited || isTreatAsOwnEffective(state.account, year))
        ) {
          const gross = Math.max(0, state.balance)
          const fraction = isAggregatedIraThisYear(state.account)
            ? ownedIraConversionTaxableFraction(
              state.account.ownerPersonId ?? primary.id,
            )
            : 1
          remainingTraditionalGross += gross
          remainingTraditionalTaxable += gross * fraction
        }
        if (isConvertibleToRoth(state.account)) {
          remainingConvertibleGross += Math.max(0, state.balance)
        }
      }
      // Committed action movement for the LP's balance recursion. Every
      // exact-cent executor that moved an account this year reports here,
      // each behind the same `committed` gate its own apply loop above ran
      // on — so the solver's buckets move by the dollars this ledger actually
      // moved, not by the dollars the requests asked for. A refused or
      // partially executed request therefore reports what executed and
      // nothing more.
      //
      // THREE executors move balances, and this reads all three:
      //   - ordinary withdrawals, whose result carries opening/closing
      //     snapshots, so the movement is their difference;
      //   - named Roth conversions, a debit per executed allocation and one
      //     credit to the destination the action named (PR #182);
      //   - named QCDs, a debit only — the gift leaves the household (#213).
      // The last two are recent. The netting this feeds (PR #177) was built
      // when `executeRothConversions` and `executeAnnualQcds` published
      // evidence and moved nothing, and the sentence recording that outlived
      // the fact: from #182 the LP carried a traditional bucket the ledger
      // had already debited, growing it for every remaining year.
      //
      // Cash is `committedActionProceeds` and remains the ordinary
      // withdrawal's alone. Neither of the other two delivers spendable cash:
      // a conversion reallocates between buckets, and a gift leaves.
      //
      // Absent here, and still deliberately so: a committed conversion's
      // ORDINARY INCOME, and the aggregate QCD strategy's balance debit.
      // Neither is a retirement action, or is one this field may carry:
      //   - the conversion's income is income, not movement, and the LP takes
      //     it as a forced floor (`committedConversionOrdinaryIncome` below,
      //     read by `OptimizerYear.committedOrdinaryIncome`);
      //   - the aggregate `strategies.qcdAnnual` gift is a strategy, not a
      //     recorded action, so it reports through
      //     `exogenousStrategyAccountMovement` below — putting it here would
      //     make this field's name a lie.
      //
      // The deltas are accumulated and converted in CENTS, once per account.
      // `ledgerCentsToPlanDollars` guarantees each endpoint round-trips, not
      // that their difference does: subtracting two separately-rounded dollar
      // numbers routinely lands a ULP off an exact cent (100000.02 − 50000.02
      // is 50000.00000000001), and that residue would ride into the LP's
      // coefficients. One conversion of the exact-cent total keeps the amount
      // exactly the cents that moved, which is also why an account named by
      // two executors is summed here rather than reported twice.
      const committedActionCentsByAccountId = new Map<string, bigint>()
      const addCommittedActionCents = (accountId: string, cents: bigint): void => {
        committedActionCentsByAccountId.set(
          accountId,
          (committedActionCentsByAccountId.get(accountId) ?? 0n) + cents,
        )
      }
      if (retirementActionExecution?.committed) {
        for (const snapshot of retirementActionExecution.balances) {
          addCommittedActionCents(
            String(snapshot.accountId),
            BigInt(snapshot.closingBalance) - BigInt(snapshot.openingBalance),
          )
        }
      }
      if (rothConversionActionExecution?.committed) {
        for (const evidence of rothConversionActionExecution.evidence) {
          if (evidence.outcome !== 'executed') continue
          // The destination credit is the sum of this action's executed
          // allocations, which is what the credit pass above adds — not the
          // requested amount, and not a figure read from a second field that
          // could disagree with the debits.
          let creditedCents = 0n
          for (const allocation of evidence.allocations) {
            const movedCents = BigInt(allocation.executedAmount)
            creditedCents += movedCents
            addCommittedActionCents(String(allocation.sourceAccountId), -movedCents)
          }
          addCommittedActionCents(
            String(evidence.destinationRothAccountId),
            creditedCents,
          )
        }
      }
      if (qcdActionExecution?.committed) {
        for (const evidence of qcdActionExecution.evidence) {
          if (evidence.executedAmount <= 0) continue
          addCommittedActionCents(
            String(evidence.sourceAccountId),
            -BigInt(evidence.executedAmount),
          )
        }
      }
      const optimizerCommittedActionAccountMovement =
        [...committedActionCentsByAccountId]
          .filter(([, cents]) => cents !== 0n)
          .map(([accountId, cents]) => ({
            accountId,
            amount: signedLedgerCentTotalToPlanDollars(cents),
          }))
          .sort((left, right) => compareUtf16CodeUnits(left.accountId, right.accountId))
      // Strategy movement for the same balance recursion, on its own channel.
      //
      // FIVE producers, each a balance the exact ledger has already moved and
      // the LP re-decides no part of:
      //   - the aggregate `strategies.qcdAnnual` gift taken BEYOND the year's
      //     owned-IRA RMD, which debits its source IRAs directly. The dollars
      //     leave the household, so there is no cash side to book — the whole
      //     point of a gift — while its charitable exclusion reaches the LP
      //     through `forcedDistributionOrdinaryIncomeExclusion` above.
      //   - a 72(t) SEPP series payment, which debits its account every series
      //     year. Its ORDINARY INCOME is already booked (`incomeBeforeConversion`
      //     carries `+ seppTotal − seppNontaxable`, so it survives into
      //     `ordinaryIncomeBase`), and the LP re-decides none of the movement:
      //     `incumbentTraditionalDistribution` below is the RMD plus
      //     discretionary owner draws and excludes `seppTotal` entirely. Income
      //     charged with no debit is the same one-sided booking as the gift,
      //     with the sides swapped. Unlike the gift it DOES deliver cash — the
      //     ledger's `baseCashInflows` carries `+ seppTotal` — so it reports
      //     proceeds and the gift does not.
      //   - an annuity purchase premium, which leaves an LP bucket for a
      //     contract the LP does not carry. No proceeds: the premium buys the
      //     contract, and the contract pays back later through
      //     `incomes.annuity`, which is already inside `exogenousCash`.
      //   - a TIPS-ladder purchase, which is the same transfer in the same
      //     direction — its own block says so — leaving an LP bucket for a
      //     ladder the LP carries in no bucket, and paying back later through
      //     `incomes.tipsLadder`, also already inside `exogenousCash`. No
      //     proceeds, for the premium's reason.
      //   - an elected pension lump sum, the one producer that CREDITS. It
      //     rolls the commuted offer into the named traditional account while
      //     the pension stream stops paying, so the LP already sees half the
      //     fact: the income vanishes out of `exogenousCash` in that year and
      //     every year after. Booking only that half made the solve poorer than
      //     the household by the whole offer, compounding for the rest of the
      //     horizon. No proceeds either, and for a reason the other four do not
      //     share: nothing arrives in hand. It is a DIRECT rollover — the money
      //     goes plan-to-IRA, never through the year's cash flow, which is also
      //     why it puts no income on the return for the bracket terms to price.
      //
      // Read back off what each producer published, never re-derived from the
      // strategy or election that asked for it. The QCD arm caps its request at
      // the year's annual limit, truncates a draining take to whole cents,
      // skips a take the ledger records as zero, and gives nothing at all when
      // a named QCD stands it down; the SEPP arm skips a sub-cent payment and
      // clamps to the remaining balance; a purchase is clamped to what the
      // funding account could actually spend. Every one of those is a place a
      // parallel recomputation would drift, and a published movement cannot.
      // The runtime OCCURRENCE is the record used rather than the runtime
      // application, because the application is gated on `isAggregatedIra` — a
      // SEPP may run on an employer plan, and a lump sum may roll into one —
      // while the occurrence is emitted at the mutation site for every account
      // shape its own block can reach. Two producers publish no occurrence that
      // covers their whole reach: the annuity premium emits one only for a
      // traditional source, and the TIPS-ladder purchase emits none at all, so
      // both arrive through `exogenousStrategyDebits`, captured at their own
      // mutation sites.
      //
      // The QCD's RMD-routed part (`qcdFromRmd`) is deliberately NOT here:
      // those dollars leave the IRA through the RMD, which the LP re-decides as
      // its own `wt`, so booking them would debit the bucket twice. `legacyQcd`
      // occurrences are the arm's beyond-RMD takes alone. Their CASH side is a
      // separate term (`forcedDistributionCashDiversion` above), because that
      // is a credit the LP made on its own `wt` rather than a movement this
      // channel could take back.
      //
      // KNOWN AND ABSENT, so this channel's contract is not read as a universal
      // claim. What remains is one class, not a list of unrelated holes: cash
      // and value that cross between the household and an asset the LP carries
      // in NO bucket, where the LP has no way to book the far side.
      //   - a planned property sale's net proceeds join `baseCashInflows`
      //     (`propertySaleProceedsTotal`, the exact-taxed path) or land
      //     straight in a cash/taxable account (the legacy `expectedNetProceeds`
      //     path, in the property-events block below), and the LP sees neither
      //     — though it is already charged the sale's gain, which rides into
      //     `capitalGainsBase` through `preWithdrawalCapitalResult`. That is
      //     tax with no cash, the SEPP's defect shape.
      //   - a coordinated or backstop HECM draw adds `hecmDraw` to the year's
      //     cash and the same dollars to a loan balance that accrues.
      //   - a permanent-life death benefit is deposited into a cash/taxable
      //     account (the insurance block below) from a policy the LP does not
      //     carry.
      // ALL FOUR — the two property-sale paths, the HECM draw, and the death
      // benefit — RUN THE SAME WAY: they make the solve POORER than the
      // household, which is why omitting them is the conservative answer while
      // the shape that would fix them — a channel for assets outside the four
      // buckets, and a bucket for the debt — is designed. The HECM draw is
      // measured rather than assumed: it funds the ledger's own spending while
      // this probe reports `exogenousCash` of 0 and the whole `spendingNeed`,
      // so the LP pays for the year out of buckets the household never touched.
      // What sets it apart is its FIX, not its direction — booking the draw's
      // cash ALONE, with no bucket for the loan it creates, would flip the
      // solve from poorer to richer and hand it a line of free money it never
      // repays. That is a separate slice, and a debt bucket is part of it.
      //
      // Cents per account, converted once, for the reason spelled out above:
      // differencing or summing separately-rounded dollar figures leaves a
      // sub-cent residue that would ride into the LP's coefficients. Signed at
      // the boundary rather than inside: the magnitude is what rounds to cents,
      // and the sign is applied to the rounded figure, so a credit and a debit
      // of the same dollars cancel exactly.
      const exogenousStrategyCentsByAccountId = new Map<string, bigint>()
      const addExogenousStrategyMovementCents = (
        accountId: string,
        signedAmountPlanDollars: number,
      ): void => {
        const magnitude = BigInt(
          planDollarsToLedgerCents(Math.abs(signedAmountPlanDollars)),
        )
        const cents = signedAmountPlanDollars < 0 ? -magnitude : magnitude
        exogenousStrategyCentsByAccountId.set(
          accountId,
          (exogenousStrategyCentsByAccountId.get(accountId) ?? 0n) + cents,
        )
      }
      for (const occurrence of annualRetirementRuntimeOccurrences) {
        if (occurrence.sourceAccountId === null) continue
        // A gift and a series payment DEBIT; a lump-sum rollover CREDITS the
        // account its occurrence names (the block sets `sourceAccountId` to the
        // rollover TARGET, which is the account whose balance moved).
        const signedAmountPlanDollars =
          occurrence.kind === 'legacyQcd' ||
          occurrence.kind === 'automaticSeppDistribution'
            ? -occurrence.grossAmountPlanDollars
            : occurrence.kind === 'rolloverInflow'
              ? occurrence.grossAmountPlanDollars
              : 0
        if (signedAmountPlanDollars === 0) continue
        addExogenousStrategyMovementCents(
          String(occurrence.sourceAccountId),
          signedAmountPlanDollars,
        )
      }
      for (const debit of exogenousStrategyDebits) {
        addExogenousStrategyMovementCents(debit.accountId, -debit.amountPlanDollars)
      }
      // The SEPP's cash side. Taken from the year's own `seppTotal` — the same
      // figure `baseCashInflows` adds and the same one the
      // `automaticSeppDistribution` occurrences above sum to — rather than
      // re-derived from the series schedule. The other
      // four producers contribute nothing: a gift leaves, the two purchases buy
      // instruments that pay back later through `exogenousCash`, and a direct
      // rollover never passes through the household's hands at all.
      const optimizerExogenousStrategyProceeds = seppTotal
      const optimizerExogenousStrategyAccountMovement =
        [...exogenousStrategyCentsByAccountId]
          .filter(([, cents]) => cents !== 0n)
          .map(([accountId, cents]) => ({
            accountId,
            amount: signedLedgerCentTotalToPlanDollars(cents),
          }))
          .sort((left, right) => compareUtf16CodeUnits(left.accountId, right.accountId))
      optimizerProbe = {
        year,
        committedActionAccountMovement: optimizerCommittedActionAccountMovement,
        exogenousStrategyAccountMovement: optimizerExogenousStrategyAccountMovement,
        exogenousStrategyProceeds: optimizerExogenousStrategyProceeds,
        forcedDistributionOrdinaryIncomeExclusion:
          optimizerForcedDistributionOrdinaryExclusion,
        forcedDistributionCashDiversion:
          optimizerForcedDistributionCashDiversion,
        // The taxable half of what the named conversion executor committed,
        // built from the two figures the year's own published
        // `totalRothConversionTaxable` is built from — the named authority's
        // credited dollars less the Form 8606 line-8 basis return the
        // settlement apportioned against them — restricted to that authority.
        // The aggregate strategy's share of the same published figure is
        // excluded: it is precisely what the LP re-decides as `conv`.
        //
        // Both accumulators are only ever incremented inside the executor's
        // own `committed` gate, so a refused or uncommitted conversion action
        // reports zero here without a second gate to keep in step.
        committedConversionOrdinaryIncome: Math.max(
          0,
          namedRothConversionExecuted - namedRothConversionNontaxable,
        ),
        committedActionProceeds: retirementActionProceeds,
        ordinaryIncomeBase: optimizerOrdinaryIncomeBase,
        spendingNeed: expenses.total + contributions,
        exogenousCash: incomes.total - taxableYieldReinvested,
        traditionalInflow,
        otherInflow,
        taxableInflow,
        ssBenefits: incomes.socialSecurity,
        taxableSsBase: taxableSs,
        ssProvisionalIncomeAddbacks: yearTaxExemptInterest + acaForeignExclusionAddback,
        magiTaxExemptInterest: yearTaxExemptInterest,
        // Includes fixed taxable-action character, but excludes residual legacy
        // taxable-withdrawal realizations: the optimizer re-decides those draws
        // as its own `wtax` variable and adds their gain share itself.
        // (Pre-netting components; carryforward refinement is left to the exact
        // ledger, and the MILP boundary stays conservatively nonnegative.)
        capitalGainsBase: optimizerCapitalGainsBase,
        acaConversionMagiHeadroom:
          yearAcaResult?.readiness === 'actionable' &&
          yearAcaResult.federalPovertyLine !== null &&
          yearAcaResult.householdMagi !== null
            ? Math.max(
                0,
                yearAcaResult.federalPovertyLine * (pack.aca.maxFplPctForCredit / 100) -
                  yearAcaResult.householdMagi,
              )
            : null,
        // The exclusion is subtracted here for the same reason the LP subtracts
        // it from its own MAGI base: the exact ledger's MAGI is net of the
        // gift, which is most of what a QCD is for. This line adds the forced
        // distribution back at its GROSS taxable figure, so without the
        // subtraction the reconstructed incumbent — and the ACA ceiling built
        // from it — would overstate MAGI by the whole gift.
        incumbentModeledMagiBeforeTaxableWithdrawalGains:
          optimizerOrdinaryIncomeBase +
          optimizerCapitalGainsBase +
          (rmdTotal - rmdNontaxable) -
          optimizerForcedDistributionOrdinaryExclusion +
          inheritedOrdinaryIncome +
          totalRothConversionTaxable +
          withdrawalPlan.byCategory.traditional -
          iraNontaxableFinal,
        incumbentTaxableWithdrawal: withdrawalPlan.byCategory.taxable,
        acaModeledAllowablePtc: yearAcaResult?.modeledAllowablePtc ?? null,
        acaCliffState: yearAcaResult?.cliffState ?? null,
        incumbentRothConversion: totalRothConversion,
        rothConversionTaxableFraction:
          totalRothConversion > 0
            ? Math.min(
              1,
              Math.max(
                0,
                totalRothConversionTaxable / totalRothConversion,
              ),
            )
            : remainingConvertibleGross > 0
              ? conversionTaxableAmountForGross(remainingConvertibleGross) /
                remainingConvertibleGross
              : 1,
        // Probe-only remap: mid-horizon S2 flip owner RMDs ride the inherited
        // forced flow so the LP's static inheritedTraditional bucket stays
        // consistent (see comment at startTraditional). YearResult.rmd is
        // unchanged.
        rmd: probeRmd,
        rmdTaxable: probeRmdTaxable,
        incumbentTraditionalDistribution: optimizerTraditionalGross,
        traditionalWithdrawalTaxableFraction:
          optimizerTraditionalGross > 0
            ? Math.min(
              1,
              Math.max(
                0,
                optimizerTraditionalTaxable / optimizerTraditionalGross,
              ),
            )
            : remainingTraditionalGross > 0
              ? remainingTraditionalTaxable / remainingTraditionalGross
              : 1,
        startTraditional,
        // Traditional forced only — matches OptimizerYearProbe / LP ordinary base.
        // Includes mid-horizon-flip owner RMDs remapped above (probe only).
        inheritedDistribution: probeInheritedDistribution,
        startInheritedTraditional,
        peopleAged65Plus,
        ssa44IrmaaRedetermination: ssa44ActiveInYear(year),
      }
    }

    // --- apply flows -------------------------------------------------------
    // Fill voluntary amounts on inherited evidence (planner draws beyond the
    // forced requirement this year). Forced already reduced the balance, so
    // the need-based plan is voluntary-only for each still-inherited account.
    // S2 POST-FLIP rows keep voluntaryAmount 0: owner-side draws are not
    // inherited voluntary draws (the flip already moved the account out of
    // the inherited schedule). Map built once per year — avoid per-row find.
    const balanceStateByAccountId = new Map(
      balances.map((state) => [state.account.id, state] as const),
    )
    for (const row of inheritedYearEvidenceDraft) {
      const evidenceState = balanceStateByAccountId.get(row.accountId)
      // Only traditional/roth accounts carry an inherited block; narrowing here
      // keeps the helper's structural parameter honest for the full union.
      const evidenceAccount = evidenceState?.account
      if (
        evidenceAccount !== undefined &&
        (evidenceAccount.type === 'traditional' || evidenceAccount.type === 'roth') &&
        isTreatAsOwnEffective(evidenceAccount, year)
      ) continue
      row.voluntaryAmount = withdrawalPlan.byAccountId.get(row.accountId) ?? 0
    }
    for (const state of balances) {
      const taken = withdrawalPlan.byAccountId.get(state.account.id) ?? 0
      // No sub-cent discharge here. A traditional draw the exact-cent ledger
      // records as zero never reaches this loop: `planWithdrawals` refuses to
      // allocate one, so the year's published traditional total, its ordinary
      // income and this movement are all derived from the same plan and cannot
      // disagree about whether the draw happened. Discharging here instead
      // would move the balance and leave the total claiming a withdrawal with
      // no occurrence to explain it.
      if (taken <= 0) continue
      const sourceBalanceBefore = state.balance
      let ownedIraProducerOccurrenceKey: string | null = null
      if (state.account.type === 'traditional') {
        // Voluntary inherited traditional draws use this kind — distinct from
        // forced `inheritedIraRmd` (required / final-sweep) recorded above.
        const kind = 'legacyNeedBasedWithdrawal' as const
        const producerOccurrenceKey = runtimeOccurrenceKey(kind, state.account.id)
        recordAnnualRetirementRuntimeOccurrence({
          producerOccurrenceKey,
          kind,
          grossAmountPlanDollars: taken,
          ownerPersonId: state.account.ownerPersonId,
          sourceAccountId: state.account.id,
          executionDate: null,
          executionSequence: null,
          movementAuthorityId: null,
        })
        if (isAggregatedIraThisYear(state.account)) {
          ownedIraProducerOccurrenceKey = producerOccurrenceKey
        }
      }
      if (state.account.type === 'taxable') {
        const sale = withdrawalPlan.taxableSales.get(state.account.id)
        if (sale === undefined) {
          throw new Error('Planned taxable sale disappeared before commit')
        }
        state.costBasis = sale.remainingCostBasis
        state.balance = sale.remainingFairMarketValue
      } else if (state.account.type === 'equityComp' && state.balance > 0) {
        const basisRatio = Math.min(1, state.costBasis / state.balance)
        state.costBasis = Math.max(0, state.costBasis - taken * basisRatio)
        state.balance -= taken
      } else {
        state.balance -= taken
      }
      if (ownedIraProducerOccurrenceKey !== null) {
        recordAnnualRetirementRuntimeApplication({
          applicationKind: 'debit',
          producerOccurrenceKey: ownedIraProducerOccurrenceKey,
          simulatorPhase: 'legacyNeedBasedWithdrawal',
          ownerPersonId: state.account.ownerPersonId,
          sourceAccountId: state.account.id,
          sourceBalanceBeforePlanDollars: sourceBalanceBefore,
          appliedAmountPlanDollars: taken,
          sourceBalanceAfterPlanDollars: state.balance,
        })
      }
    }
    // Commit the Roth basis ordering (contributions → conversions → earnings) once
    // per pool, so next year's seasoning + earnings are correct across the owner's
    // aggregated Roth IRAs.
    for (const [key, { taken, age }] of rothPoolWithdrawals(withdrawalPlan.byAccountId)) {
      const rb = rothBasis.get(key)
      if (rb) rothBasis.set(key, splitRothWithdrawal(rb, taken, year, age).next)
    }
    // Commit the year's Form-8606 IRA basis depletion from need-based draws
    // (RMD/SEPP/conversion basis already committed above as they happened).
    if (iraProRata.size > 0) {
      for (const [ownerId, proRata] of iraProRata) {
        let taken = 0
        for (const state of balances) {
          if (!isAggregatedIraThisYear(state.account)) continue
          if ((state.account.ownerPersonId ?? primary.id) !== ownerId) continue
          taken += withdrawalPlan.byAccountId.get(state.account.id) ?? 0
        }
        const next = splitIraDistribution(proRata, taken).next
        iraBasisByOwner.set(ownerId, next.basis)
      }
    }
    // Reimburse-later accumulation (step 3): out-of-pocket qualified medical
    // expenses this year (modeled costs the cap-mode HSAs did NOT reimburse)
    // grow the pool; qualified HSA reimbursements draw it down. Grows in
    // nominal dollars alongside the expenses it defers. Only cap-mode
    // consumption (`capConsumed`) touches the pool — qualified draws from
    // `assumeAllQualified`/legacy HSAs are not measured against modeled
    // expenses and must not draw the pool down.
    if (hsaReimburseLaterActive) {
      const qualifiedDrawn = hsaEffectFinal.capConsumed
      const reimbursedFromCurrentYear = Math.min(qualifiedDrawn, qualifiedMedicalThisYear)
      const drawnFromPool = qualifiedDrawn - reimbursedFromCurrentYear
      const outOfPocketThisYear = Math.max(0, qualifiedMedicalThisYear - reimbursedFromCurrentYear)
      hsaReimbursablePool = Math.max(0, hsaReimbursablePool - drawnFromPool) + outOfPocketThisYear
    }
    deposit(surplus)

    if (shortfallAfterHecm > EPSILON && depletionYear === null) depletionYear = year

    // --- property events + growth ------------------------------------------
    for (const account of plan.accounts) {
      if (account.type !== 'property') continue
      let value = propertyValues.get(account.id) ?? 0
      value *= 1 + inflRateAt(year)
      if (account.plannedSaleYear === year && value > 0) {
        // Exact-taxed sales (costBasis set) already deposited their net
        // proceeds through the year's cash flow above; the legacy tax-free
        // expectedNetProceeds path deposits here — net of any HECM payoff,
        // which is non-recourse (never more than the sale nets).
        if (account.costBasis === undefined) {
          const proceeds = account.expectedNetProceeds ?? value
          const line = hecmStates.get(account.id)
          const hecmPayoff = line ? Math.min(line.loanBalance, Math.max(0, proceeds)) : 0
          if (line) hecmStates.delete(account.id)
          deposit(proceeds - hecmPayoff)
        }
        value = 0
      }
      propertyValues.set(account.id, value)
      // An open line compounds at the line's growth rate on both sides: the
      // unused principal limit grows regardless of home value (the buffer-
      // asset property), and the loan balance accrues rate + MIP.
      const line = hecmStates.get(account.id)
      if (line && account.hecm) {
        const growth = 1 + account.hecm.growthRatePct / 100
        line.principalLimit *= growth
        line.loanBalance *= growth
      }
    }

    // --- insurance: permanent-life cash value + death benefit --------------
    let deathBenefitPaid = 0
    for (const policy of plan.insurance) {
      if (policy.kind !== 'permanentLife') continue
      const insured = personById.get(policy.insured)
      const deathAge = insured ? lifeAgeOf(insured) : Infinity
      const ageAttained = insured ? stateOf(policy.insured).ageAttained : -Infinity
      if (ageAttained < deathAge) {
        // Alive, before the settlement year: cash value tracks the illustration
        // (schedule) or compounds (flatRate).
        if (policy.cashValueMode === 'schedule' && policy.cashValueSchedule) {
          insuranceCashValues.set(policy.id, interpolateByAge(policy.cashValueSchedule, ageAttained))
        } else {
          const prev = insuranceCashValues.get(policy.id) ?? 0
          insuranceCashValues.set(policy.id, prev * (1 + (policy.cashValueGrowthPct ?? 0) / 100))
        }
      } else if (ageAttained === deathAge) {
        // Final alive year = death settlement. Pay here (not at deathAge + 1,
        // which is past endYear for the last survivor — exactly the estate case
        // the policy models) so the benefit always lands in the projection. The
        // cash value rolls into the benefit and is zeroed so it isn't double-
        // counted in net worth; a real death benefit is never less than the cash
        // value, so max() also guards the flat-rate model drifting above face.
        const cashValue = insuranceCashValues.get(policy.id) ?? 0
        const payout = Math.max(policy.deathBenefit, cashValue)
        deposit(payout)
        deathBenefitPaid += payout
        insuranceCashValues.set(policy.id, 0)
      } else {
        insuranceCashValues.set(policy.id, 0)
      }
    }

    const ownedNonRothIraBalanceBeforeGrowthByState =
      new Map<BalanceState, number>()
    for (const state of balances) {
      // S2 post-election joins owner-side post-growth / application sources.
      if (isAggregatedIraThisYear(state.account)) {
        ownedNonRothIraBalanceBeforeGrowthByState.set(state, state.balance)
      }
    }
    const ownedNonRothIraBalancesBeforeGrowth = Object.freeze(
      Object.fromEntries(
        balances
          .filter((state) => isAggregatedIraThisYear(state.account))
          .map((state) => [
            state.account.id,
            ownedNonRothIraBalanceBeforeGrowthByState.get(state)!,
          ]),
      ),
    )

    const shockPct = returnShockAt(year)
    // Wealth-weighted total return the ledger actually applies this year
    // (including distributed yield — interest, dividends, and tax-exempt interest; a distribution, not a loss).
    // Next year's coordinated HECM check reads it, so the down-market signal
    // is the realized portfolio return, not the raw additive shock.
    let returnWeightedSum = 0
    let returnWeightBase = 0
    for (const state of balances) {
      const distributedYieldPct = state.account.type === 'taxable' ? (distributedYieldByAccountId.get(state.account.id)?.distributedYieldPct ?? 0) : 0
      const track = allocationTrack.get(state.account.id)
      if (track) {
        // Allocated account: growth is the class blend at this year's weights
        // (superseding annualReturnPct); distributed yield is carved
        // out of price growth exactly like the single-return path. Weights
        // then drift with the differential class returns until the next
        // rebalance (or forever, when rebalancing is 'none').
        const classRates = ASSET_CLASS_IDS.map((id, i) => classParams[id].returnPct + classShockAt(year, i))
        const blendedPct = classRates.reduce((sum, r, i) => sum + r * (track.weights[i] ?? 0), 0)
        returnWeightedSum += state.balance * blendedPct
        returnWeightBase += state.balance
        state.balance *= Math.max(0, 1 + (blendedPct - distributedYieldPct) / 100)
        track.weights = driftWeights(track.weights, classRates)
        continue
      }
      const expectedPct = state.account.annualReturnPct ?? plan.assumptions.defaultReturnPct
      // Cash is a stable-value bucket: the market shock hits invested accounts only.
      const ratePct = state.account.type === 'cash' ? expectedPct : expectedPct + shockPct - distributedYieldPct
      returnWeightedSum += state.balance * (state.account.type === 'cash' ? expectedPct : expectedPct + shockPct)
      returnWeightBase += state.balance
      state.balance *= Math.max(0, 1 + ratePct / 100)
    }
    priorYearPortfolioReturnPct = returnWeightBase > 0 ? returnWeightedSum / returnWeightBase : 0
    for (const state of balances) {
      const distributedYield = distributedYieldByAccountId.get(state.account.id)
      if (!distributedYield?.reinvest || distributedYield.gross <= 0) continue
      state.balance += distributedYield.gross
      if (state.account.type === 'taxable') state.costBasis += distributedYield.gross
    }

    const ownedNonRothIraBalancesByOwner = new Map<
      string | null,
      Array<{ sourceAccountId: string; balancePlanDollars: number }>
    >()
    for (const state of balances) {
      if (!isAggregatedIraThisYear(state.account)) continue
      // A validated Plan always supplies an owner here. Preserve null on a
      // malformed direct simulatePlan call so this raw, not-yet-validated
      // source never invents ownership that later replay could mistake as fact.
      const ownerPersonId = state.account.ownerPersonId
      const accountBalances = ownedNonRothIraBalancesByOwner.get(ownerPersonId) ?? []
      accountBalances.push({
        sourceAccountId: state.account.id,
        balancePlanDollars: state.balance,
      })
      ownedNonRothIraBalancesByOwner.set(ownerPersonId, accountBalances)
    }
    // The contract values that belong on line 6 beside those balances, read at
    // the same instant. Annuity accounts take no growth -- they hold no balance
    // the ledger could grow -- so reading the channel here rather than before
    // the growth loop changes no figure; it is read here so the two halves of
    // line 6 are captured at one boundary and the replay can say so.
    const annuityContractValuesByOwner = new Map<
      string | null,
      Array<{
        annuityAccountId: string
        fundingAccountId: string
        contractValueOpeningPlanDollars: number
        contractValuePlanDollars: number
      }>
    >()
    for (const { contract, funding, ownerPersonId } of annuityStagingCandidates) {
      const contractValuePlanDollars = annuityContractValue.get(contract.id)
      if (contractValuePlanDollars === undefined) continue
      const entries = annuityContractValuesByOwner.get(ownerPersonId) ?? []
      entries.push({
        annuityAccountId: contract.id,
        fundingAccountId: funding.id,
        contractValueOpeningPlanDollars:
          startOfYearAnnuityContractValue.get(contract.id) ?? 0,
        contractValuePlanDollars,
      })
      annuityContractValuesByOwner.set(ownerPersonId, entries)
    }
    const ownedNonRothIraPostGrowthSource = Object.freeze({
      status: 'postGrowthOwnedNonRothIraBalancesCaptured' as const,
      captureBoundary:
        'afterAllAnnualTransactionsAndGrowthBeforeYearResultPublication' as const,
      annualObservationValidation: 'notRun' as const,
      planId: plan.id,
      taxYear: year,
      ownerPools: Object.freeze(
        [...ownedNonRothIraBalancesByOwner]
          .sort(([leftOwner], [rightOwner]) => {
            if (leftOwner === null) return rightOwner === null ? 0 : -1
            if (rightOwner === null) return 1
            return compareUtf16CodeUnits(leftOwner, rightOwner)
          })
          .map(([ownerPersonId, accountBalances]) => Object.freeze({
            ownerPersonId,
            accountBalances: Object.freeze(
              accountBalances
                .sort((left, right) =>
                  compareUtf16CodeUnits(
                    left.sourceAccountId,
                    right.sourceAccountId,
                  ) || left.balancePlanDollars - right.balancePlanDollars,
                )
                .map((balance) => Object.freeze({ ...balance })),
            ),
            annuityContractValues: Object.freeze(
              (annuityContractValuesByOwner.get(ownerPersonId) ?? [])
                .sort((left, right) => compareUtf16CodeUnits(
                  left.annuityAccountId, right.annuityAccountId,
                ))
                .map((value) => Object.freeze({ ...value })),
            ),
          })),
      ),
    })

    // --- snapshot ------------------------------------------------------------
    const balanceEntries: [string, number][] = []
    let investableTotal = unassignedCash
    for (const state of balances) {
      balanceEntries.push([state.account.id, state.balance])
      investableTotal += state.balance
    }
    let propertyTotal = 0
    for (const [id, value] of propertyValues) {
      balanceEntries.push([id, value])
      propertyTotal += value
    }
    let debtTotal = 0
    for (const [id, value] of debtBalances) {
      balanceEntries.push([id, value])
      debtTotal += value
    }
    // HECM loans net against net worth with the non-recourse floor honored:
    // the lender's claim never exceeds the home's value, so heirs are never
    // charged for a loan that outgrew the house.
    let hecmLoanTotal = 0
    let hecmEffectiveDebt = 0
    for (const [id, line] of hecmStates) {
      hecmLoanTotal += line.loanBalance
      hecmEffectiveDebt += Math.min(line.loanBalance, propertyValues.get(id) ?? 0)
    }
    let insuranceCashValueTotal = 0
    for (const [id, value] of insuranceCashValues) {
      balanceEntries.push([id, value])
      insuranceCashValueTotal += value
    }
    const balanceRecord = Object.fromEntries(balanceEntries)

    const reportedWithdrawals = {
      ...withdrawalPlan.byCategory,
      cash: withdrawalPlan.byCategory.cash + retirementActionCash,
      taxable:
        withdrawalPlan.byCategory.taxable +
        retirementActionEquityCompensation +
        retirementActionTaxableProceeds,
      // Traditional forced only: Roth forced is Roth-character (K1/K2).
      traditional:
        withdrawalPlan.byCategory.traditional +
        rmdTotal +
        seppTotal +
        inheritedOrdinaryIncome,
      roth: withdrawalPlan.byCategory.roth + inheritedRothForced,
      total:
        withdrawalPlan.byCategory.total +
        rmdTotal +
        seppTotal +
        inheritedTotal +
        retirementActionProceeds,
    }
    // Attribute any portfolio shortfall across the spending layers: a deliberate
    // guardrail cut is a target-lifestyle miss, a genuine shortfall reaches the
    // required floor only after exhausting discretionary. Skipped goals are added
    // on top (a skipped goal is spending that never happened). Legacy `shortfall`
    // (and depletion-year logic) are left exactly as they were.
    const shortfallAttribution = attributeShortfall({
      requiredSpending: requiredSpendingBase,
      targetSpending: targetSpendingBase,
      idealSpending: idealSpendingBase,
      excessSpending: excessSpendingBase,
      fundedSpending: expenses.total,
      withdrawalShortfall: shortfallAfterHecm,
    })
    const requiredShortfall = shortfallAttribution.requiredShortfall + skippedRequiredNominal
    const targetShortfall = shortfallAttribution.targetShortfall + skippedTargetNominal + skippedRequiredNominal
    const idealShortfall = shortfallAttribution.idealShortfall + skippedIdealNominal
    const excessShortfall = shortfallAttribution.excessShortfall + skippedExcessNominal
    const retirementRuntimeSource = Object.freeze({
      status: 'runtimeOccurrenceSourcesCaptured' as const,
      captureBoundary:
        'legacyAnnualPassCommittedBeforeYearResultPublication' as const,
      journalValidation: 'notRun' as const,
      planId: plan.id,
      taxYear: year,
      runtimeOccurrences: Object.freeze(
        [...annualRetirementRuntimeOccurrences]
          .sort(canonicalRuntimeOccurrenceOrder)
          .map((occurrence) => Object.freeze({ ...occurrence })),
      ),
      // Only the routed share belongs in the nonmoving overlay. The rest of the
      // annual total left an owned IRA under its own occurrences above, and
      // publishing it here as well would double-count the gift.
      //
      // The attribution travels with it, which is what lets the owned-IRA
      // runtime source series characterize a gift year instead of refusing it.
      // Both figures are the ones the 408(d)(8)(D) block settled above:
      // `qcdFromRmdByOwner` is the routed gross the published annual total is
      // made of, and `qcdQualifiedFromRmdByOwner` is the carve the deferred
      // forced distributions were committed against, so the replay reproduces
      // the ledger's own line-7 grosses rather than deriving rival ones.
      nonmovingLegacyQcdOverlay: qcdFromRmd > 0
        ? Object.freeze({
          status: 'nonmovingLegacyQcdCaptured' as const,
          kind: 'legacyQcd' as const,
          taxYear: year,
          grossAmountPlanDollars: qcdFromRmd,
          ownerAttributions: Object.freeze(
            [...qcdFromRmdByOwner.entries()]
              .filter(([, routed]) => routed > 0)
              .sort(([left], [right]) => compareUtf16CodeUnits(left, right))
              .map(([ownerPersonId, routedGrossPlanDollars]) => Object.freeze({
                ownerPersonId,
                routedGrossPlanDollars,
                qualifiedLine7ExclusionPlanDollars: Math.min(
                  routedGrossPlanDollars,
                  qcdQualifiedFromRmdByOwner.get(ownerPersonId) ?? 0,
                ),
              })),
          ),
          physicalMovement: 'notAdditionalMovement' as const,
          inventoryReplay:
            'attributedToOwnedIraRequiredDistributionGrosses' as const,
        })
        : null,
      // The moving half's characterization, in the order the draws moved. The
      // 408(d)(8)(D) block sized each one against the owner's aggregate
      // includible amount, so the replay reads which part of each draw was a
      // gift and which part was an ordinary distribution rather than assuming
      // the whole of it was the former.
      legacyQcdCharacterizations: Object.freeze(
        legacyQcdCharacterizations.map((entry) => Object.freeze({ ...entry })),
      ),
    })
    const retirementRuntimeApplicationSource = Object.freeze({
      status: 'runtimeApplicationSourcesCaptured' as const,
      captureBoundary:
        'atOwnedNonRothIraMutationSitesBeforeAnnualGrowth' as const,
      applicationValidation: 'notRun' as const,
      planId: plan.id,
      taxYear: year,
      // Mutation order is evidence. Do not sort this array: account-order
      // dependent legacy commits must remain visible to later replay.
      applications: Object.freeze(
        annualRetirementRuntimeApplications.map((application) =>
          application.applicationKind === 'aggregateRothDestinationCredit' ||
            application.applicationKind === 'namedRothDestinationCredit'
            ? Object.freeze({
              ...application,
              producerOccurrenceKeys: Object.freeze([
                ...application.producerOccurrenceKeys,
              ]),
              sourceOwnerPersonIds: Object.freeze([
                ...application.sourceOwnerPersonIds,
              ]),
            })
            : Object.freeze({ ...application }),
        ),
      ),
    })
    const ordinaryPublicationEligibility = retirementActionExecution === undefined
      ? undefined
      : ordinaryWithdrawalPublicationEligibility(retirementActionExecution)
    const conversionPublicationEligibility =
      rothConversionActionExecution === undefined
        ? undefined
        : rothConversionPublicationEligibility(rothConversionActionExecution)
    const retirementActionPublicationEligible =
      ordinaryPublicationEligibility?.kind !== 'legacyScheduleDiagnosticsOnly' &&
      conversionPublicationEligibility?.kind !== 'legacyScheduleDiagnosticsOnly'
    // A blocked prerequisite batch has no publication source and no canonical
    // requests, so the year publishes neither rather than half of either. The
    // evidence also follows the publication boundary: in a legacy
    // diagnostics-only year no executor source publishes, and prerequisite
    // evidence with no publication record behind it would orphan the JSDoc's
    // claim that the publication says which executor published what.
    const qcdActionPrerequisites =
      retirementActionPublicationEligible &&
      qcdActionPrerequisiteResult?.status === 'evaluated'
        ? qcdActionPrerequisiteResult
        : undefined
    const retirementActionPublicationSources = retirementActionPublicationEligible
      ? [
          ...(retirementActionExecution === undefined
            ? []
            : [ordinaryWithdrawalPublicationSource(retirementActionExecution)]),
          ...(rothConversionActionExecution === undefined
            ? []
            : [rothConversionPublicationSource(rothConversionActionExecution)]),
          // The executor's own source when it settled the year, and the
          // prerequisite's otherwise. They are the same shape and never both
          // publish: `publishAnnualRetirementActions` throws on two records for
          // one action, and the committed source is the one carrying the
          // executed dates and amounts the executor is the authority on.
          ...(qcdActionPrerequisites === undefined
            ? []
            : [qcdActionExecution?.committed === true
                ? qcdActionExecution.publicationSource
                : qcdActionPrerequisites.publicationSource]),
        ]
      : []
    const retirementActionPublicationRequests = [
      ...(retirementActionExecution?.requests ?? []),
      ...(rothConversionActionExecution?.requests ?? []),
      ...(qcdActionPrerequisites?.requests ?? []),
    ]
    /**
     * The committed run — `T1(F)` — named as a liability run of its own.
     *
     * `T1` is not a third pass. It is this one: the run that commits is the run
     * with the group's requests present, so its final post-pass tax and
     * penalties are the candidate liability, read through the same exact-cent
     * conversion the counterfactual reads its own through.
     *
     * The funding vector it names is the year's actual one: for each group, the
     * withdrawal and the cents it executed. That is what makes it a
     * `candidateT1` rather than an ordinary committed run — a candidate that
     * did not name the vector it was run against cannot honestly be subtracted
     * from a baseline, because a different vector is a different candidate. The
     * vector is all zeros today, and stating it is what will make the slice
     * that funds a conversion mint a visibly different run.
     */
    const committedAnnualLiabilityRun = (
      taxPlanDollars: number,
      penaltiesPlanDollars: number,
    ): Readonly<ConversionLinkedWithdrawalGroupLiabilityRun> | null => {
      const unit = conversionFundingTaxUnitEvidence
      if (unit === null) return null
      const liability = exactAnnualLiabilityFromPlanDollars(
        taxPlanDollars,
        penaltiesPlanDollars,
      )
      if (liability === null) return null
      const executedByActionId = new Map(
        (retirementActionExecution?.evidence ?? []).map((evidence) =>
          [evidence.actionId, evidence.disposition.executedAmount] as const),
      )
      const fundingVector = effectiveLinkedWithdrawalGroups.groups
        .map((group) => [
          group.conversionActionId,
          group.withdrawalActionId,
          executedByActionId.get(group.withdrawalActionId) ?? 0,
        ])
      const minted = mintAnnualLiabilityRunIdentity({
        planId: plan.id,
        taxUnitId: unit.taxUnitId,
        taxYear: year,
        liabilityRun: {
          liabilityRunKind: 'candidateT1',
          candidateFundingVectorEvidenceId: deriveActionStructuralId(
            'retirement-action-conversion-tax-funding-vector',
            [unit.taxUnitId, year, fundingVector],
          ),
        },
        taxInputs: [
          ...annualLiabilityNonGroupTaxInputs,
          {
            inputId: COUNTERFACTUAL_OMISSION_TAX_INPUT_ID,
            // Stated, not omitted. "This run removed nothing" is a fact about
            // the run, and it is the fact that makes the two snapshot IDs
            // comparable: the baseline's spells what it removed, and a
            // candidate that said nothing at all would be claiming a different
            // kind of input set rather than a different value of the same one.
            value: { representation: 'declaredTerm', term: JSON.stringify([]) },
          },
        ],
      })
      return minted.status === 'annualLiabilityRunIdentityMinted'
        ? { liability, identity: minted.identity }
        : null
    }

    /**
     * The year's conversion-linked withdrawal groups, executed — which is to
     * say staged, evidenced, and refused.
     *
     * It runs here and not at the phase where the group was assessed, because
     * `T1(F)` is this run's own final liability and does not exist until the
     * funding solve has converged. The verdict the executors answered to was
     * taken much earlier and is unchanged by anything below; what is added here
     * is the evidence that accompanies the refusal, and evidence cannot precede
     * the figure it is evidence of.
     *
     * Every input it needs is read off what already happened. The weights are
     * committed taxable conversion principal, which is zero for a refused
     * conversion; the funded amounts are the linked withdrawals' committed
     * executed cents, zero for the same reason. That degeneracy is the honest
     * shape of a group that refused, and it is not what the evaluation is for:
     * what it carries that nothing carried before is two real annual liability
     * runs, distinctly identified, whose difference is the group's tax effect.
     */
    const conversionLinkedWithdrawalGroupExecution:
      Readonly<ExecuteConversionLinkedWithdrawalGroupsResult> | undefined =
      effectiveLinkedWithdrawalGroups.groups.length === 0
        ? undefined
        : executeConversionLinkedWithdrawalGroups({
            taxYear: year,
            requests: linkedGroupAssessmentRequests,
            assessment: effectiveLinkedWithdrawalGroups,
            taxUnit: conversionFundingTaxUnitEvidence,
            baseline: annualLiabilityBaseline,
            candidate: committedAnnualLiabilityRun(tax, penalties),
            movements: effectiveLinkedWithdrawalGroups.groups.map(
              (group): ConversionLinkedWithdrawalGroupMovementInput => {
                const conversionEvidence = rothConversionActionExecution?.evidence
                  .find((evidence) => evidence.actionId === group.conversionActionId)
                const withdrawalEvidence = retirementActionExecution?.evidence
                  .find((evidence) => evidence.actionId === group.withdrawalActionId)
                return {
                  conversionActionId: group.conversionActionId,
                  withdrawalActionId: group.withdrawalActionId,
                  conversion: {
                    authoredAmount: asUsdCents(
                      conversionEvidence?.requestedAmount ?? 0,
                    ),
                    executedAmount: asUsdCents(
                      conversionEvidence?.executedAmount ?? 0,
                    ),
                  },
                  withdrawal: {
                    authoredAmount: asUsdCents(
                      withdrawalEvidence?.requestedAmount ?? 0,
                    ),
                    executedAmount: asUsdCents(
                      withdrawalEvidence?.disposition.executedAmount ?? 0,
                    ),
                  },
                }
              },
            ),
            members: effectiveLinkedWithdrawalGroups.groups.map(
              (group): ConversionLinkedWithdrawalGroupMemberInput => {
                const conversionEvidence = rothConversionActionExecution?.evidence
                  .find((evidence) => evidence.actionId === group.conversionActionId)
                const withdrawalEvidence = retirementActionExecution?.evidence
                  .find((evidence) => evidence.actionId === group.withdrawalActionId)
                return {
                  conversionActionId: group.conversionActionId,
                  conversionPersonId: group.personId,
                  // A conversion this run never executed has no taxable
                  // principal; one that executed while leaving its Form 8606
                  // character to the annual settlement has one nobody can state
                  // yet, and null is how the evaluation refuses rather than
                  // reading the unknown as zero.
                  allocationWeight: conversionEvidence === undefined
                    ? null
                    : conversionEvidence.outcome === 'executed'
                      ? (conversionEvidence.taxableConvertedAmount === null
                          ? null
                          : asUsdCents(conversionEvidence.taxableConvertedAmount))
                      : asUsdCents(0),
                  // A withdrawal that never reached the executor funded
                  // nothing, which is a zero this run can state.
                  fundedAmount: asUsdCents(
                    withdrawalEvidence?.disposition.executedAmount ?? 0,
                  ),
                }
              },
            ),
          })
    const retirementActionPublication =
      retirementActionPublicationSources.length > 0 &&
      retirementActionPublicationEligible
        ? publishAnnualRetirementActions({
            taxYear: year,
            requests: retirementActionPublicationRequests,
            sources: retirementActionPublicationSources,
            ...(conversionLinkedWithdrawalGroupExecution === undefined
              ? {}
              : {
                conversionLinkedWithdrawalGroups:
                  conversionLinkedWithdrawalGroupExecution,
              }),
          })
        : undefined
    const yearResult: YearResult = {
      year,
      inflationScale: inflFactor,
      people: peopleStates,
      filingStatus: filingStatusForYear,
      incomes,
      expenses,
      contributions,
      ownedNonRothIraContributions,
      ownedNonRothIraBalancesBeforeGrowth,
      employerMatch,
      rmd: rmdTotal,
      sepp: seppTotal,
      inheritedDistribution: inheritedTotal,
      inheritedTraditionalDistribution: inheritedOrdinaryIncome,
      ...(planHasInheritedAccounts
        ? { inheritedAccounts: inheritedYearEvidenceDraft }
        : {}),
      qcd,
      rothConversion: totalRothConversion,
      ...(aggregateRothConversionAllocationBalances === undefined
        ? {}
        : { aggregateRothConversionAllocationBalances }),
      ...(aggregateRothConversionAllocationDesired === undefined
        ? {}
        : { aggregateRothConversionAllocationDesired }),
      retirementRuntimeSource,
      retirementRuntimeApplicationSource,
      ownedNonRothIraPostGrowthSource,
      ...(retirementActionExecution ? { retirementActionExecution } : {}),
      ...(retirementActionPublication === undefined
        ? {}
        : { retirementActionPublication }),
      ...(conversionLinkedWithdrawalGroupExecution === undefined
        ? {}
        : {
          conversionLinkedWithdrawalGroupExecution:
            conversionLinkedWithdrawalGroupExecution,
        }),
      ...(rothConversionActionExecution ? { rothConversionActionExecution } : {}),
      ...(qcdActionPrerequisites === undefined
        ? {}
        : { qcdActionPrerequisites: qcdActionPrerequisites.evidence }),
      ...(qcdActionPrerequisites === undefined || qcdActionExecution === undefined
        ? {}
        : { qcdActionExecution }),
      penalties,
      magi: magiHistory.get(year)!,
      ...(yearAcaResult ? { aca: yearAcaResult } : {}),
      medicarePremiums,
      irmaaSurcharge,
      irmaaTier,
      amt: federalDetail.alternativeMinimumTax,
      ltcgZeroHeadroom,
      ssEarningsTestWithheld,
      ssdiPaid,
      tax,
      withdrawals: reportedWithdrawals,
      realizedGains:
        withdrawalPlan.realizedGains +
        rebalanceRealizedGains +
        retirementActionCapitalGainOrLoss,
      taxableYield: incomes.taxableYield,
      taxExemptInterest: yearTaxExemptInterest,
      capitalLossUsedAgainstGains: lossNetting.usedAgainstGains,
      capitalLossUsedAgainstOrdinary: lossNetting.usedAgainstOrdinary,
      capitalLossCarryforwardRemaining: lossNetting.remaining,
      surplusInvested: surplus,
      shortfall: shortfallAfterHecm,
      requiredShortfall,
      targetShortfall,
      idealShortfall,
      excessShortfall,
      guardrailAction,
      flexibleGoals: goalOutcomeCounts,
      balances: balanceRecord,
      investableTotal,
      insuranceCashValue: insuranceCashValueTotal,
      ladderValue: ladderValueTotal,
      deathBenefit: deathBenefitPaid,
      hecmDraw,
      hecmLoanBalance: hecmLoanTotal,
      netWorth: investableTotal + propertyTotal - debtTotal + insuranceCashValueTotal + ladderValueTotal - hecmEffectiveDebt,
    }
    return { yearResult, optimizerProbe }
    }

    const annualPassState: SimulatorAnnualPassStateBindings = {
      balances,
      retirementRuntimeOccurrences: annualRetirementRuntimeOccurrences,
      retirementRuntimeApplications: annualRetirementRuntimeApplications,
      nextRetirementRuntimeMutationOrdinal: annualPassValueBinding(
        () => nextRetirementRuntimeMutationOrdinal,
        (value) => { nextRetirementRuntimeMutationOrdinal = value },
      ),
      iraProRata,
      iraBasisByOwner,
      rothBasis,
      propertyValues,
      hecmStates,
      insuranceCashValues,
      allocationTrack,
      seppAmortAmount,
      magiHistory,
      namedQcdOffsetConsumedByDonor,
      namedQcdOffsetHistoryUnprovable,
      warnings,
      unassignedCash: annualPassValueBinding(
        () => unassignedCash,
        (value) => { unassignedCash = value },
      ),
      priorYearPortfolioReturnPct: annualPassValueBinding(
        () => priorYearPortfolioReturnPct,
        (value) => { priorYearPortfolioReturnPct = value },
      ),
      capitalLossPool: annualPassValueBinding(
        () => capitalLossPool,
        (value) => { capitalLossPool = value },
      ),
      hsaReimbursablePool: annualPassValueBinding(
        () => hsaReimbursablePool,
        (value) => { hsaReimbursablePool = value },
      ),
      depletionYear: annualPassValueBinding(
        () => depletionYear,
        (value) => { depletionYear = value },
      ),
      conversionNontaxable: annualPassValueBinding(
        () => conversionNontaxable,
        (value) => { conversionNontaxable = value },
      ),
      healthcare: annualPassValueBinding(
        () => healthcare,
        (value) => { healthcare = value },
      ),
      qualifiedMedicalThisYear: annualPassValueBinding(
        () => qualifiedMedicalThisYear,
        (value) => { qualifiedMedicalThisYear = value },
      ),
      hsaQualifiedCap: annualPassValueBinding(
        () => hsaQualifiedCap,
        (value) => { hsaQualifiedCap = value },
      ),
      requiredSpendingBase: annualPassValueBinding(
        () => requiredSpendingBase,
        (value) => { requiredSpendingBase = value },
      ),
      targetSpendingBase: annualPassValueBinding(
        () => targetSpendingBase,
        (value) => { targetSpendingBase = value },
      ),
      expenses,
    }

    /**
     * `T0` for this year's conversion-linked withdrawal groups: one
     * counterfactual pass with both legs of every group removed.
     *
     * Called from inside the attempt driver's per-attempt scope rather than
     * once before it, which is the placement the counterfactual driver reserved
     * for its consumer. It matters: the settlement loop runs the annual pass
     * repeatedly under different assumed Form 8606 effects, and a baseline
     * taken under one assumption vector is not a counterfactual of a run taken
     * under another. Sharing the vector is what makes the difference of the two
     * liabilities the group's tax effect and not the settlement's.
     *
     * The cost is real and bounded: a year with no linked group runs nothing
     * extra, and a year with one doubles that year's passes.
     *
     * Every refusal returns null, and null is not a failure the year has to
     * survive — it is the ordinary answer for a year with no group, no
     * unambiguous filing unit, or a counterfactual that could not be restored.
     * The pass then keeps the `unsupported` funding reason it had before any of
     * this existed.
     */
    const runLinkedGroupCounterfactualBaseline = (
      assumedEffects:
        readonly Readonly<OwnedNonRothIraAnnualSettlementEffect>[],
    ): Readonly<ConversionLinkedWithdrawalGroupLiabilityRun> | null => {
      const unit = conversionFundingTaxUnitEvidence
      if (unit === null || annualLinkedGroupOmissionIds.length === 0) return null
      const read = runCounterfactualAnnualLiability({
        state: annualPassState,
        request: {
          planId: plan.id,
          taxUnitId: unit.taxUnitId,
          taxYear: year,
          omitActionIds: annualLinkedGroupOmissionIds,
          nonGroupTaxInputs: annualLiabilityNonGroupTaxInputs,
        },
        // No baseline of its own: a counterfactual that ran a counterfactual
        // would not terminate, and it has nothing to evidence anyway — the
        // group whose funding is in question is exactly what it removed.
        runPass: (omittedRetirementActionIds) =>
          runPostContributionAnnualPass(assumedEffects, omittedRetirementActionIds),
      })
      return read.status === 'counterfactualAnnualLiabilityRead'
        ? { liability: read.liability, identity: read.identity }
        : null
    }

    /**
     * `T0`, then the staging run, then the permission the committed run gets.
     *
     * Three passes for a year with a linked group, one for a year without, and
     * the middle one is the one that could not be avoided. `T1(F)` is the
     * unit's annual liability *with the conversions present and funded as
     * stated*, so it exists only in a run where the group already moved — a
     * gate that demanded the fixed point before letting anything move would be
     * asking for a figure that only movement produces. So the year runs itself
     * once with the groups provisionally released, reads what that cost and
     * what the legs actually moved, checks the arithmetic, and throws the run
     * away. What survives is a permission the committed run can be handed.
     *
     * All three share one assumption vector, which is what makes the baseline a
     * counterfactual of *this* attempt and the staging run a rehearsal of it
     * rather than of a different one.
     *
     * The staging run is discarded through the same transaction the
     * counterfactual uses, and for the same reason: the pass mints runtime
     * occurrences with a bare push and no dedupe, so a staging run that leaked
     * one would not crash the year — it would silently disqualify an owner from
     * the exact-cent replay and fall the year back to legacy pro-rata
     * economics. Every refusal below therefore returns the committed run's
     * default, which is to refuse the groups exactly as they refused before any
     * of this existed. A staging run that threw is included in that: the throw
     * is the fail-closed backstop for a conversion-side refusal the seam's
     * capacity read could not see.
     */
    const linkedGroupPermissionForAttempt = (
      assumedEffects:
        readonly Readonly<OwnedNonRothIraAnnualSettlementEffect>[],
    ): {
      baseline: Readonly<ConversionLinkedWithdrawalGroupLiabilityRun> | null
      release: Readonly<LinkedGroupRelease>
    } => {
      const baseline = runLinkedGroupCounterfactualBaseline(assumedEffects)
      if (baseline === null) {
        return { baseline: null, release: REFUSE_LINKED_GROUPS }
      }
      const staged = probeAnnualPassUnderTransaction({
        state: annualPassState,
        runProbe: () => runPostContributionAnnualPass(
          assumedEffects,
          undefined,
          baseline,
          { kind: 'stageProvisionally' as const },
        ).yearResult.conversionLinkedWithdrawalGroupExecution ?? null,
      })
      if (staged.status !== 'annualPassProbeRead' || staged.observation === null) {
        return { baseline, release: REFUSE_LINKED_GROUPS }
      }
      const authorized = authorizeConversionLinkedWithdrawalGroups(
        staged.observation,
      )
      return {
        baseline,
        release:
          authorized.status === 'conversionLinkedWithdrawalGroupsAuthorized'
            ? { kind: 'proven' as const, authorizations: authorized.authorizations }
            : REFUSE_LINKED_GROUPS,
      }
    }

    // The counterfactual pre-pass, before anything commits this year.
    //
    // It has to precede the run that commits, not follow it: the pass writes the
    // year's mutable state directly, so the only run that can be discarded
    // wholesale is one that nothing downstream has read yet. The transaction
    // inside the helper is what makes discarding it safe, and it is
    // unconditional.
    //
    // The assumption vector here is empty — the same vector the two fallback
    // call sites below use. That is the honest choice for a pre-pass that sits
    // outside the attempt driver, and it is also why this is not yet the
    // wiring: the consumer slice moves this call inside `runAttempt`, where the
    // counterfactual and the committed run share one vector and the
    // counterfactual is a counterfactual of *this* attempt.
    if (opts.annualCounterfactual !== undefined) {
      const counterfactual = opts.annualCounterfactual
      counterfactual.capture(runCounterfactualAnnualLiability({
        state: annualPassState,
        request: {
          planId: plan.id,
          taxUnitId: counterfactual.taxUnitId,
          taxYear: year,
          omitActionIds: counterfactual.omitActionIds,
          nonGroupTaxInputs: counterfactual.nonGroupTaxInputs,
        },
        runPass: (omittedRetirementActionIds) =>
          runPostContributionAnnualPass([], omittedRetirementActionIds),
      }))
    }

    const basisSeededOwners = new Set<string>()
    // Seed nondeductible basis with the same year-aware aggregation the ledger
    // uses inside the pass (`isAggregatedIraThisYear`), so an S2-flipped
    // account is in the settlement pool the same way it is in the live
    // Form-8606 denominator. Inlined here because the helper is pass-scoped.
    const isAggregatedIraForSettlementYear = (
      account: Account,
    ): account is TraditionalAccount => {
      if (account.type !== 'traditional' || account.kind !== 'ira') return false
      if (account.inherited === undefined) return true
      return isTreatAsOwnEffective(account, year)
    }
    const annualSettlementPlan: Plan = {
      ...plan,
      accounts: plan.accounts.map((account): Account => {
        const openingBalance = startOfYearBalance.get(account.id)
        const annualAccount = openingBalance === undefined
          ? account
          : { ...account, balance: openingBalance }
        if (!isAggregatedIraForSettlementYear(annualAccount)) return annualAccount
        const ownerPersonId = annualAccount.ownerPersonId ?? primary.id
        const nondeductibleBasis = basisSeededOwners.has(ownerPersonId)
          ? 0
          : iraBasisByOwner.get(ownerPersonId) ?? 0
        basisSeededOwners.add(ownerPersonId)
        return { ...annualAccount, nondeductibleBasis }
      }),
    }

    let settledAnnualPass: ReturnType<typeof runPostContributionAnnualPass>
    if (ownedNonRothIraSettlementEnabled()) {
      let finalAttempt:
        ReturnType<typeof runPostContributionAnnualPass> | null = null
      const settlement = runOwnedNonRothIraAnnualSettlementAttempts({
        state: annualPassState,
        plan: annualSettlementPlan,
        projectionStartTaxYear: year,
        initialAssumedEffects: [],
        runAttempt: (context) => {
          const permission = linkedGroupPermissionForAttempt(
            context.assumedEffects,
          )
          const attempt = runPostContributionAnnualPass(
            context.assumedEffects,
            undefined,
            permission.baseline,
            permission.release,
          )
          finalAttempt = attempt
          return [attempt.yearResult]
        },
        captureAttemptStateEvidence: (context, yearResult) =>
          captureOwnedNonRothIraAnnualAttemptStateEvidence({
            state: annualPassState,
            planId: context.stable.planId,
            taxYear: yearResult.year,
            attemptNumber: context.attemptNumber,
          }),
      })
      if (settlement.status === 'committed' && finalAttempt !== null) {
        settledAnnualPass = finalAttempt
        if (settledAnnualPass.optimizerProbe !== null) {
          const annualReplay = settlement.pendingSettlement.replay
            .annualReplays[0]!
          const taxableFractionByOwner = new Map<string, number>(
            annualReplay.ownerReplays.map((owner) => {
              const ratio = owner.annualBasisRatio
              const nontaxableFraction =
                ratio.representation === 'exactMinorUnitRational'
                  ? ratio.numeratorMinorUnits / ratio.denominatorMinorUnits
                  : 0
              return [
                owner.ownerPersonId,
                Math.min(1, Math.max(0, 1 - nontaxableFraction)),
              ] as const
            }),
          )
          const weightedTaxableFraction = (
            eligible: (account: Account) => boolean,
          ): number | null => {
            let gross = 0
            let taxable = 0
            for (const account of plan.accounts) {
              if (!eligible(account)) continue
              const balance = Math.max(
                0,
                settledAnnualPass.yearResult.balances[account.id] ?? 0,
              )
              if (balance <= 0) continue
              const fraction = isAggregatedIra(account)
                ? taxableFractionByOwner.get(
                  account.ownerPersonId ?? primary.id,
                ) ?? 1
                : 1
              gross += balance
              taxable += balance * fraction
            }
            return gross > 0 ? taxable / gross : null
          }
          const traditionalFraction = weightedTaxableFraction((account) =>
            account.type === 'traditional' && !account.inherited)
          const conversionFraction = weightedTaxableFraction(
            isConvertibleToRoth,
          )
          settledAnnualPass = {
            ...settledAnnualPass,
            optimizerProbe: {
              ...settledAnnualPass.optimizerProbe,
              traditionalWithdrawalTaxableFraction:
                settledAnnualPass.optimizerProbe
                  .incumbentTraditionalDistribution > 0
                  ? settledAnnualPass.optimizerProbe
                    .traditionalWithdrawalTaxableFraction
                  : traditionalFraction ?? settledAnnualPass.optimizerProbe
                    .traditionalWithdrawalTaxableFraction,
              rothConversionTaxableFraction:
                settledAnnualPass.optimizerProbe.incumbentRothConversion > 0
                  ? settledAnnualPass.optimizerProbe
                    .rothConversionTaxableFraction
                  : conversionFraction ?? settledAnnualPass.optimizerProbe
                    .rothConversionTaxableFraction,
            },
          }
        }
        for (const carryforward of settlement.committedCarryforwards) {
          // A disqualified owner keeps the legacy figure this year's pass
          // already committed. Re-seeding them from a replay that opened on
          // their stale basis would republish the very numerator the earlier
          // rollback disqualified.
          if (!ownedNonRothIraSettlementOwnerEnabled(
            carryforward.ownerPersonId,
          )) continue
          const openingBasis = ledgerCentsToPlanDollars(
            carryforward.openingBasisAmount,
          )
          if (openingBasis > 0) {
            iraBasisByOwner.set(carryforward.ownerPersonId, openingBasis)
          } else {
            iraBasisByOwner.delete(carryforward.ownerPersonId)
          }
        }
        // The publication is one joined household replay, and the module
        // refuses to emit a partial one. When a disqualified owner appears in
        // it the whole publication is withheld: an unaffected owner keeps the
        // settled economics that drive their conversions, but nothing states a
        // disqualified owner's basis as settled.
        const publishableOwners = settlement.pendingSettlement.replay
          .annualReplays.every((annual) => annual.ownerReplays.every((owner) =>
            ownedNonRothIraSettlementOwnerEnabled(owner.ownerPersonId)))
        const publication = publishableOwners
          ? committedOwnedNonRothIraAnnualReplayPublication(
            settlement,
            settledAnnualPass.yearResult,
          )
          : null
        if (publication !== null) {
          settledAnnualPass = {
            ...settledAnnualPass,
            yearResult: {
              ...settledAnnualPass.yearResult,
              ownedNonRothIraAnnualReplay: publication,
            },
          }
        }
      } else {
        const disqualification =
          ownedNonRothIraAnnualSettlementRollbackDisqualification(
            settlement,
            new Set(iraBasisByOwner.keys()),
          )
        // A year-scoped disqualification writes no latch at all. The year it
        // names is already falling back below -- that IS the disqualification --
        // and leaving both latches untouched is what lets the next year attempt
        // settlement again. The withheld-publication window is one year wide
        // rather than the rest of the horizon.
        if (disqualification.horizon === 'remainingProjection') {
          if (disqualification.ownerPersonId === null) {
            ownedNonRothIraSettlementRolledBackHousehold = true
          } else {
            ownedNonRothIraSettlementRolledBackOwners.add(
              disqualification.ownerPersonId,
            )
          }
        }
        const permission = linkedGroupPermissionForAttempt([])
        settledAnnualPass = runPostContributionAnnualPass(
          [],
          undefined,
          permission.baseline,
          permission.release,
        )
      }
    } else {
      const permission = linkedGroupPermissionForAttempt([])
      settledAnnualPass = runPostContributionAnnualPass(
        [],
        undefined,
        permission.baseline,
        permission.release,
      )
    }
    years.push(settledAnnualPass.yearResult)
    if (settledAnnualPass.optimizerProbe !== null) {
      opts.captureOptimizerInputs?.(settledAnnualPass.optimizerProbe)
    }
  }

  const last = years[years.length - 1]
  // Remaining nondeductible IRA basis at the horizon, capped per owner at their
  // ending aggregated-IRA balance (basis can exceed the balance after market
  // losses, but only balance-worth of dollars actually pass to the heir).
  let endingNondeductibleIraBasis = 0
  for (const [ownerId, basis] of iraBasisByOwner) {
    if (basis <= 0) continue
    let ownerIraBalance = 0
    for (const state of balances) {
      // Horizon bookkeeping: a still-marked inherited account whose treat-as-own
      // election took effect in a prior year is the spouse's own IRA.
      if (state.account.type !== 'traditional' || state.account.kind !== 'ira') continue
      if (
        state.account.inherited !== undefined &&
        !isTreatAsOwnEffective(state.account, endYear)
      ) continue
      if ((state.account.ownerPersonId ?? primary.id) !== ownerId) continue
      ownerIraBalance += state.balance
    }
    endingNondeductibleIraBasis += Math.min(basis, ownerIraBalance)
  }
  return {
    startYear,
    endYear,
    years,
    depletionYear,
    endingInvestable: last?.investableTotal ?? 0,
    endingNetWorth: last?.netWorth ?? 0,
    endingNondeductibleIraBasis,
    warnings: [...warnings],
  }
}
