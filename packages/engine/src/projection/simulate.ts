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
 *   (Uniform Lifetime Table; an opt-in April-1 first-year deferral is available
 *   to the exact ledger). QCDs route
 *   charitable dollars out of the RMD (age 70½ ≈ age attained 71).
 *   IRC §4974 prices any RMD shortfall at 25% by default, with explicit
 *   correction/waiver evidence seams. Early-withdrawal penalties: 10%
 *   traditional pre-59½ (≈ age < 60), 20% HSA non-medical pre-65. Healthcare expenses: ACA-credited marketplace
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
  stateForYear,
  stateResidencySegmentsForYear,
} from '../model/plan.js'
import {
  accountAllocation,
  resolveAssetClassParams,
  targetWeightsAt,
} from '../allocation/assetClasses.js'
import { packForYear, LATEST_PACK_YEAR, EMBEDDED_REAL_YIELD_CURVE } from '../params/index.js'
import { assembleYearCashFlow, type AnnualCashFlowPenaltySnapshot } from './annualCashFlowCapture.js'
import {
  collidingEncodedCashFlowSegments,
  collectPlanCashFlowProducerIds,
} from './annualCashFlowIds.js'
import { createAnnualCashFlowYearSites, type AnnualCashFlowYearSites } from './annualCashFlowYearSites.js'
import { buildLadder } from '../ladder/ladderMath.js'
import {
  annualCoordinatedHecmAllocations,
  annualCoordinatedHecmEligibility,
} from './internal/annualCoordinatedHecm.js'
import {
  annualOrdinaryWithdrawalBoundary,
  type AnnualOrdinaryWithdrawalBoundaryResult,
} from './internal/annualOrdinaryWithdrawalBoundary.js'
import { annualLegacyQcdGiftPlan } from './internal/annualLegacyQcdGiftPlan.js'
import {
  annualLegacyQcdOwnerCharacterPlan,
  materializeAnnualLegacyQcdOwnerCharacterPlanResult,
} from './internal/annualLegacyQcdOwnerCharacterPlan.js'
import { annualInsurancePremiumRows } from './internal/annualInsurancePremiumRows.js'
import { annualLifestyleLayers } from './internal/annualLifestyleLayers.js'
import {
  AnnualLogicalBalanceLedger,
  type PhysicalBalanceState,
} from './internal/annualLogicalBalanceLedger.js'
import { annualRebalanceToTarget } from './internal/annualRebalanceToTarget.js'
import { annualAnnuityPurchaseFunding } from './internal/annualAnnuityPurchaseFunding.js'
import { annualOwnerRmdPlan } from './internal/annualOwnerRmdPlan.js'
import { annualInheritedIraDistributions } from './internal/annualInheritedIraDistributions.js'
import { annualPermanentLifeTransitions } from './internal/annualPermanentLifeTransitions.js'
import { annualPropertyCarryingCosts } from './internal/annualPropertyCarryingCosts.js'
import { annualSeppDistributions } from './internal/annualSeppDistributions.js'
import { annualSocialSecurity } from './internal/annualSocialSecurity.js'
import { annualSnapshot } from './internal/annualSnapshot.js'
import { annualWithdrawalApplyFlowPlan } from './internal/annualWithdrawalApplyFlowPlan.js'
import { annualExpenseSummary } from './internal/annualExpenseSummary.js'
import {
  annualContributionsAndEmployerMatch,
  type AnnualContributionAndMatchOperation,
  type AnnualContributionAndMatchOperationIdentity,
  type AnnualContributionsAndEmployerMatchResult,
} from './internal/annualContributionsAndEmployerMatch.js'
import {
  annualAggregateRothConversionPlan,
  withAnnualAggregateRothConversionReservations,
} from './internal/annualAggregateRothConversionPlan.js'
import { annualIncomeSetup } from './internal/annualIncomeSetup.js'
import { annualPensionAndAnnuityIncome } from './internal/annualPensionAndAnnuityIncome.js'
import { annualPostSolveAccountGrowth } from './internal/annualPostSolveAccountGrowth.js'
import {
  annualDebtServiceRows,
  annualLongTermCarePlan,
} from './internal/annualDebtAndLongTermCare.js'
import { annualGuardrailFundingPlan } from './internal/annualGuardrailFunding.js'
import { annualHealthcareExpenses } from './internal/annualHealthcareExpenses.js'
import { hecmLineOpenings } from './internal/hecmLineOpenings.js'
import { propertyEventsAndGrowth } from './internal/propertyEventsAndGrowth.js'
import { publishedEntityFacts } from './internal/publishedEntityFacts.js'
import { pensionLumpSumRollovers } from './internal/pensionLumpSumRollovers.js'
import { tipsLadderAnnualCashFlows, type TipsLadderState } from './internal/tipsLadderAnnualCashFlow.js'
import { tipsLadderPurchaseFunding } from './internal/tipsLadderPurchaseFunding.js'
import { fixedAssetDispositions } from './internal/fixedAssetDispositions.js'
import { otherIncomeStreams } from './internal/otherIncomeStreams.js'
import { stateParamsFor } from '../params/state/index.js'
import type { ParameterPack } from '../params/types.js'
import {
  computeRmdShortfallExcise,
  type RmdApplicablePlan,
  type RmdShortfallExciseResult,
  type RmdShortfallReliefElection,
} from '../rmd/rmdShortfallExcise.js'
import {
  rmdApplicablePlanForAccount as identifyRmdApplicablePlan,
} from '../rmd/rmdApplicablePlanForAccount.js'
import { sizeRothConversion } from '../strategies/rothConversion.js'
import {
  ROTH_QUALIFIED_AGE,
  applyConversionPrincipalDebt,
  assumedSeedConsequentialSpill,
  splitRothWithdrawal,
  type RothBasisState,
} from '../strategies/rothBasis.js'
import {
  classifyInheritedRegime,
  type InheritedRegimeClassification,
  type InheritedRegimeResult,
} from '../strategies/inheritedIra.js'
import {
  hsaNonQualifiedPenaltyRate,
  isAggregatedIra,
  hasSpouseTreatAsOwnElection,
  isConvertibleToRoth,
  isSpendableInYear,
  isTreatAsOwnEffective,
  rothConversionSourceContextForPerson,
  traditionalWithdrawalPenaltyRate,
  type RothConversionSourceContext,
  type NonpersistedActionPersonAliveEvidence,
  type NonpersistedOwnerAggregatedIraBasisEvidence,
  type NonpersistedOwnerIraRmdSatisfactionEvidence,
} from '../strategies/accountEligibility.js'
import type { EmployerElectiveAllocation } from './employerRothCatchUp.js'
import { splitIraDistribution, type IraProRataYear } from '../strategies/iraBasis.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from './moneyTolerance.js'
import {
  aggregateBasisSale,
  type AggregateBasisSaleResult,
} from '../tax/aggregateBasisSale.js'
import {
  asAccountId,
  asPersonId,
  asUsdCents,
  assessConversionLinkedWithdrawalGroups,
  authorizeConversionLinkedWithdrawalGroups,
  evaluateAnnualQcdExecutionPrerequisites,
  evaluateRetirementActionSchedule,
  executeAnnualQcds,
  executeConversionLinkedWithdrawalGroups,
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
  type ExecuteRothConversionsResult,
  type PersonId,
  type QualifiedCharitableDistributionRequest,
  type RetirementActionRequest,
} from '../actions/index.js'
import { addCalendarMonths } from '../actions/civilDate.js'
import type { NonpersistedPriorQcdOffsetEvidence } from '../strategies/accountEligibility.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from '../actions/structuralId.js'
import { type SimulatorAnnualRetirementRuntimeOccurrence } from './annualRetirementRuntimeJournal.js'
import type { SimulatorAnnualPassDeferredFirstRmd, SimulatorAnnualPassStateBindings } from './annualPassTransaction.js'
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
import {
  computePiaFromEarnings,
  isPiaFromEarningsError,
  piaInputFromEarnings,
  resolveEarningsProjection,
} from '../socialSecurity/piaFromEarnings.js'
import { socialSecurityDobParts } from '../socialSecurity/annualTiming.js'
import { attributeShortfall } from '../spending/layers.js'
import { ABW_DEFAULTS, abwExpectedRealReturnPct } from '../spending/abw.js'
import { jointSurvivalPercentileAge, survivalPercentileAge } from '../montecarlo/survival.js'
import {
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
import {
  taxParameterFilingStatus,
  type MarketSeries,
  type OptimizerYearProbe,
  type PersonYearState,
  type ProjectedFilingStatus,
  type ProjectionResult,
  type SimulatorRetirementRuntimeApplication,
  type TaxCalculator,
  type TaxYearInput,
  type YearAcaResult,
  type AcaSupportCode,
  type YearResult,
  type YearWithdrawals,
  type InheritedAccountYearEvidence,
  type YearCashFlowTransferEndpoint,
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
  /**
   * When true, each YearResult includes identity-bearing cashFlow detail.
   * Default off. Intended only for the live deterministic Results projection.
   * Must not change any economic output.
   */
  captureAnnualCashFlow?: boolean
  /**
   * Opt-in first-RMD deferrals. The distribution-calendar-year amount is held
   * until April 1 of the following year; default projections continue to take
   * it in the attainment year. A missed April 1 amount is taxed under §4974 in
   * the following (RBD) year, never in the attainment year.
   */
  rmdFirstYearDeferrals?: readonly Readonly<{
    distributionCalendarYear: number
    applicablePlan: RmdApplicablePlan
  }>[]
  /**
   * Explicit §4974 relief evidence keyed to a computed obligation. A correction
   * must carry the same applicable-plan identity, its amount and both window
   * dates; a waiver request alone changes nothing. These facts price the excise
   * only and do not synthesize the corrective account movement or its income.
   */
  rmdShortfallReliefElections?: readonly RmdShortfallReliefElection[]
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

/**
 * Detach a planner result from helper-owned accessors before the annual pass
 * performs any irreversible write. `structuredClone` materializes every
 * enumerable channel as caller-owned data properties; the recursive freeze
 * makes later consumption a read of that snapshot rather than a second read
 * of the helper result.
 */
function immutablePlainSnapshot<T>(value: T): T {
  const snapshot = structuredClone(value)
  const freeze = (candidate: unknown): void => {
    if (
      candidate === null ||
      typeof candidate !== 'object' ||
      Object.isFrozen(candidate)
    ) return
    for (const child of Object.values(candidate as Record<string, unknown>)) {
      freeze(child)
    }
    Object.freeze(candidate)
  }
  freeze(snapshot)
  return snapshot
}

const EPSILON = ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS

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

function snapshotStringNumberMap(
  source: ReadonlyMap<string, number>,
): ReadonlyMap<string, number> {
  const snapshot = new Map<string, number>()
  for (const entry of source) {
    const key = entry[0]
    const value = entry[1]
    snapshot.set(key, value)
  }
  return snapshot
}

function snapshotEmployerElectiveAllocation(
  source: Readonly<EmployerElectiveAllocation>,
): Readonly<EmployerElectiveAllocation> {
  return {
    allowed: snapshotStringNumberMap(source.allowed),
    designatedRothCatchUp: source.designatedRothCatchUp,
    refusedCatchUp: source.refusedCatchUp,
    redirectedCatchUpBySource:
      snapshotStringNumberMap(source.redirectedCatchUpBySource),
    catchUpByAccount: snapshotStringNumberMap(source.catchUpByAccount),
    catchUpRothAccountId: source.catchUpRothAccountId,
  }
}

/**
 * Sever every lazy/proxy-backed channel returned by the contribution planner.
 * Nothing below this boundary retains a helper-owned operation, iterator,
 * nested payload, totals object, or allocation map.
 */
function snapshotAnnualContributionsAndEmployerMatchResult(
  source: AnnualContributionsAndEmployerMatchResult,
): AnnualContributionsAndEmployerMatchResult {
  const operations: AnnualContributionAndMatchOperation[] = []
  for (const operation of source.operations) {
    const kind = operation.kind
    if (kind === 'warning') {
      operations.push({ kind, message: operation.message })
      continue
    }
    const sourceRetirementOccurrence = operation.retirementOccurrence
    const retirementOccurrence = sourceRetirementOccurrence === null
      ? null
      : {
          producerOccurrenceKey:
            sourceRetirementOccurrence.producerOccurrenceKey,
          kind: sourceRetirementOccurrence.kind,
          grossAmountPlanDollars:
            sourceRetirementOccurrence.grossAmountPlanDollars,
          ownerPersonId: sourceRetirementOccurrence.ownerPersonId,
          sourceAccountId: sourceRetirementOccurrence.sourceAccountId,
          executionDate: sourceRetirementOccurrence.executionDate,
          executionSequence: sourceRetirementOccurrence.executionSequence,
          movementAuthorityId:
            sourceRetirementOccurrence.movementAuthorityId,
        }
    if (kind === 'employerMatch') {
      const record = operation.record
      operations.push({
        kind,
        balanceIndex: operation.balanceIndex,
        sourceAccount: operation.sourceAccount,
        balanceBefore: operation.balanceBefore,
        balanceAfter: operation.balanceAfter,
        retirementOccurrence,
        record: {
          destinationAccountId: record.destinationAccountId,
          ownerPersonId: record.ownerPersonId,
          amount: record.amount,
        },
      })
      continue
    }
    const sourceRetirementApplication = operation.retirementApplication
    let retirementApplication:
      SimulatorRetirementRuntimeApplicationWithoutOrdinal | null = null
    if (sourceRetirementApplication !== null) {
      const sourceApplicationKind =
        sourceRetirementApplication.applicationKind
      if (sourceApplicationKind !== 'credit') {
        throw new Error('Annual contribution plan returned a non-credit application')
      }
      retirementApplication = {
        applicationKind: sourceApplicationKind,
        producerOccurrenceKey:
          sourceRetirementApplication.producerOccurrenceKey,
        simulatorPhase: sourceRetirementApplication.simulatorPhase,
        ownerPersonId: sourceRetirementApplication.ownerPersonId,
        sourceAccountId: sourceRetirementApplication.sourceAccountId,
        balanceIndex: sourceRetirementApplication.balanceIndex,
        sourceBalanceBeforePlanDollars:
          sourceRetirementApplication.sourceBalanceBeforePlanDollars,
        creditedAmountPlanDollars:
          sourceRetirementApplication.creditedAmountPlanDollars,
        sourceBalanceAfterPlanDollars:
          sourceRetirementApplication.sourceBalanceAfterPlanDollars,
      }
    }
    const record = operation.record
    operations.push({
      kind,
      balanceIndex: operation.balanceIndex,
      sourceAccount: operation.sourceAccount,
      balanceBefore: operation.balanceBefore,
      balanceAfter: operation.balanceAfter,
      costBasisBefore: operation.costBasisBefore,
      costBasisAfter: operation.costBasisAfter,
      credited: operation.credited,
      retirementOccurrence,
      retirementApplication,
      rothContributionPoolKey: operation.rothContributionPoolKey,
      rothContributionBasisDelta: operation.rothContributionBasisDelta,
      qcdSection219OwnerPersonId: operation.qcdSection219OwnerPersonId,
      qcdSection219Amount: operation.qcdSection219Amount,
      record: {
        destinationAccountId: record.destinationAccountId,
        ownerPersonId: record.ownerPersonId,
        requested: record.requested,
        credited: record.credited,
      },
    })
  }

  const snapshotOperationIdentity = (
    identity: AnnualContributionAndMatchOperationIdentity,
  ): AnnualContributionAndMatchOperationIdentity => {
    const kind = identity.kind
    return kind === 'warning'
      ? { kind }
      : { kind, balanceIndex: identity.balanceIndex }
  }
  const operationIdentities = [...source.operationIdentities]
    .map(snapshotOperationIdentity)
  const expectedOperationIdentities = [...source.expectedOperationIdentities]
    .map(snapshotOperationIdentity)
  const expectedContributionBalanceIndices =
    [...source.expectedContributionBalanceIndices].map((balanceIndex) =>
      balanceIndex
    )
  const sourceTotals = source.totals
  const totals = {
    contributions: sourceTotals.contributions,
    ownedNonRothIraContributions:
      sourceTotals.ownedNonRothIraContributions,
    employerMatch: sourceTotals.employerMatch,
    preTaxContributions: sourceTotals.preTaxContributions,
    traditionalInflow: sourceTotals.traditionalInflow,
    otherInflow: sourceTotals.otherInflow,
    taxableInflow: sourceTotals.taxableInflow,
  }
  const employerAllocationByOwner = new Map<
    string,
    Readonly<EmployerElectiveAllocation>
  >()
  for (const entry of source.employerAllocationByOwner) {
    const ownerPersonId = entry[0]
    const allocation = entry[1]
    employerAllocationByOwner.set(
      ownerPersonId,
      snapshotEmployerElectiveAllocation(allocation),
    )
  }
  return {
    operations,
    operationIdentities,
    expectedOperationIdentities,
    expectedContributionBalanceIndices,
    totals,
    employerAllocationByOwner,
  }
}

function assertExactContributionTotal(
  label: string,
  actual: number,
  expected: number,
): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`Annual contribution plan has an inconsistent ${label}`)
  }
}

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

type BalanceState = PhysicalBalanceState

interface WithdrawalPlanResult {
  byCategory: YearWithdrawals
  byAccountId: Map<string, number>
  realizedGains: number
  taxableSales: ReadonlyMap<string, Readonly<AggregateBasisSaleResult>>
  shortfall: number
  /** Dollars taken out of the taxable safety-net reserve as a last resort. */
  reserveUsed: number
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
  const preHorizonFirstRmdDeferral = (opts.rmdFirstYearDeferrals ?? [])
    .find((election) => election.distributionCalendarYear < startYear)
  if (preHorizonFirstRmdDeferral !== undefined) {
    throw new RangeError(
      'An RMD first-year deferral cannot begin before the projection horizon; ' +
        'start the projection in the distribution calendar year so the April 1 amount can be computed.',
    )
  }
  const captureAnnualCashFlow = opts.captureAnnualCashFlow === true
  const collidingEncodedProducerSegments = captureAnnualCashFlow
    ? collidingEncodedCashFlowSegments(collectPlanCashFlowProducerIds(plan))
    : []
  const warnings = new Set<string>()
  const inflation = plan.assumptions.inflationPct / 100
  const people = plan.household.people
  const primary = people[0]!
  const personById = new Map(people.map((p) => [p.id, p]))
  const rmdApplicablePlanForAccount = (
    account: Extract<Account, { type: 'traditional' | 'roth' }>,
  ): RmdApplicablePlan => identifyRmdApplicablePlan(account, primary.id)
  const reliefCandidatesByObligationId = new Map<string, RmdShortfallReliefElection[]>()
  for (const election of opts.rmdShortfallReliefElections ?? []) {
    reliefCandidatesByObligationId.set(election.obligationId, [
      ...(reliefCandidatesByObligationId.get(election.obligationId) ?? []),
      election,
    ])
  }
  const rmdReliefElectionFor = (
    obligationId: string,
  ): RmdShortfallReliefElection | undefined => {
    const candidates = reliefCandidatesByObligationId.get(obligationId) ?? []
    if (candidates.length <= 1) return candidates[0]
    warnings.add(
      `Duplicate RMD-shortfall relief elections targeted ${obligationId}; the excise stayed at its default rate.`,
    )
    return undefined
  }
  // Clamped: the dob schema enforces YYYY-MM-DD shape but not month range, and
  // an out-of-range month must not produce negative or >12 coverage months.
  const birthMonthByPerson = new Map(people.map((person) => [
    person.id,
    Math.min(12, Math.max(1, socialSecurityDobParts(person).m || 1)),
  ]))
  const dobYear = (p: Person) => socialSecurityDobParts(p).y
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
  const ladderStates: TipsLadderState[] = []
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
  // Allocation state belongs to the physical balance row. Compatible duplicate
  // IDs may still carry different principal, and sharing one mutable track
  // would drift/rebalance that track once per alias.
  const allocationTrack = new Map<string, { policy: AssetAllocationPolicy; weights: number[] }>()
  for (const [balanceIndex, state] of balances.entries()) {
    const policy = accountAllocation(state.account)
    if (policy) allocationTrack.set(String(balanceIndex), { policy, weights: targetWeightsAt(policy, startYear) })
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
  /**
   * Observation-only: remaining contribution basis that exists only because
   * `contributionBasis` was omitted (seeded as the account balance). Depletes
   * after known (supplied + credited) contribution basis when a withdrawal
   * draws from contributions — never changes splitRothWithdrawal economics.
   */
  const rothAssumedContributionRemaining = new Map<string, number>()
  /**
   * Observation-only: conversion principal the assumed-zero counterfactual has
   * spent extra vs live (per pool) — seed re-homing into free-cover, unseasoned
   * taxable layers, and free layers behind a taxable blocker, net of later
   * live conversion that catches up on the same FIFO principal. Live residual
   * layers still show CF-extra dollars until live withdraws them, so later
   * draws apply this debt against live layers to recover the counterfactual's
   * remaining free cover. Reduced when live consumption overlaps that debt
   * (both worlds have then spent it); raised only by new CF-extra principal.
   * Stays live after the assumed seed is spent so post-exhaustion free-
   * conversion takes still evaluate against the correct CF layer state.
   * Per-attempt scoped with the other Roth observation maps.
   */
  const rothCounterfactualFreeCoverConsumed = new Map<string, number>()
  for (const account of plan.accounts) {
    if (account.type !== 'roth') continue
    // Seed only pure owned Roth; an inherited Roth (pre- or post-S2) stays out.
    if (isInheritedRothOutsideOwnedPool(account)) continue
    const key = rothPoolKey(account)
    const startBasis = account.contributionBasis ?? account.balance
    const assumedSeed = account.contributionBasis === undefined ? account.balance : 0
    const existing = rothBasis.get(key)
    if (existing) existing.contributionBasis += startBasis
    else rothBasis.set(key, { contributionBasis: startBasis, conversionLayers: [] })
    if (assumedSeed > 0) {
      rothAssumedContributionRemaining.set(
        key,
        (rothAssumedContributionRemaining.get(key) ?? 0) + assumedSeed,
      )
    }
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
  /**
   * Owners whose Form 8606 aggregate includes an IRA with omitted
   * `nondeductibleBasis` (assumed zero). Observation-only for assumed-basis
   * consequential publication. Rebuilt each projection year with the same
   * per-year aggregation gate as settlement (`isAggregatedIraThisYear`) so
   * spouse treat-as-own IRAs that join the owned pool mid-horizon are covered.
   */
  const ownersWithOmittedNondeductibleBasis = new Set<string>()
  // Compatible duplicate IRA rows are physical members of one logical ID.
  // Their basis is therefore an aggregate numerator, just like their grouped
  // balance is the Form 8606 denominator.
  for (const account of plan.accounts) {
    if (!isAggregatedIra(account)) continue
    const ownerId = account.ownerPersonId ?? primary.id
    const basis = account.nondeductibleBasis ?? 0
    if (basis <= 0) continue
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
  type IrmaaLookbackMagiSource = 'projected' | 'historicalInput' | 'planFallback'
  /**
   * Resolve the lookback MAGI for calendar year `y` and name which arm of the
   * fallback chain (`magiHistory` → `historicalAnnualMagiByYear` →
   * `recentAnnualMagi`) supplied it. `'planFallback'` is the coarse
   * `recentAnnualMagi` stand-in — not evidence.
   */
  const resolveMagiFor = (
    y: number,
  ): { magi: number; source: IrmaaLookbackMagiSource; year: number } => {
    if (magiHistory.has(y)) {
      return { magi: magiHistory.get(y)!, source: 'projected', year: y }
    }
    const historical = plan.assumptions.historicalAnnualMagiByYear?.[String(y)]
    if (historical !== undefined) {
      return { magi: historical, source: 'historicalInput', year: y }
    }
    return { magi: plan.assumptions.recentAnnualMagi, source: 'planFallback', year: y }
  }

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
    const { y, m, d } = socialSecurityDobParts(person)
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
  /** First-distribution-calendar-year amounts elected into the following RBD year. */
  const deferredFirstRmdByApplicablePlan =
    new Map<string, SimulatorAnnualPassDeferredFirstRmd>()
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
   * Each donor's deductible §219 total for years ending on or after age 70½,
   * in plan dollars. Seeded from Plan-declared contribution facts for years
   * before the projection starts that are themselves on or after the 70½
   * threshold year, then increased by this run's own traditional IRA
   * contributions for tax years `>=` that same threshold year (the contribution
   * loop is outside the annual-pass retry). A year that ends before the donor
   * attains 70½ is outside limb (i) of 408(d)(8)(A) and is not added. Roth
   * contributions, employer deferrals, and HSA deposits are not §219 and are
   * not added.
   */
  const qcdSection219ByDonor = new Map<string, number>()
  for (const person of people) {
    const thresholdDate = addCalendarMonths(person.dob, 846)
    if (thresholdDate === null) continue
    const thresholdYear = Number(thresholdDate.slice(0, 4))
    let total = 0
    for (const record of plan.retirementActionEligibilityFacts?.deductibleIraContributions ?? []) {
      if (record.donorPersonId !== person.id) continue
      if (record.taxYear < thresholdYear || record.taxYear >= startYear) continue
      total += record.amountCents / 100
    }
    if (total > 0) qcdSection219ByDonor.set(person.id, total)
  }
  /**
   * Donors whose prior offset consumption this run cannot state.
   *
   * The Plan carries the deductible-contribution history but records nothing
   * about how much of it earlier gifts already absorbed, so the only consumption
   * this engine can prove is the consumption it performed itself. A gift the
   * Plan declares for a year before the projection begins, and an aggregate
   * `qcdAnnual` gift in an earlier projected year, are both real gifts. Limb
   * (ii) of 408(d)(8)(A) is those already-taken reductions. Substituting zero
   * would treat unused deductions as still available. The named arm omits the
   * evidence and refuses the gift; the aggregate gift has already moved, so
   * this arm fails the exclusion closed (the qualified gift stays includible)
   * rather than applying the offset from an assumed-zero consumed start. A
   * scalar year still makes the named history unprovable as well, because the
   * two arms do not share one contribution ledger.
   */
  const namedQcdOffsetHistoryUnprovable = new Set<string>()
  /**
   * Pre-start named QCDs only. A scalar year also adds the donor to
   * `namedQcdOffsetHistoryUnprovable` (the named arm cannot share this
   * ledger), but that mark is written in the same year the aggregate offset
   * runs and is not a reason to invent limb (ii). This set is the one that
   * fails the aggregate exclusion closed.
   */
  const preProjectionQcdOffsetUnprovable = new Set<string>()
  for (const request of plan.strategies.retirementActions) {
    if (request.kind !== 'qcd' || request.year >= startYear) continue
    namedQcdOffsetHistoryUnprovable.add(request.donorPersonId)
    preProjectionQcdOffsetUnprovable.add(request.donorPersonId)
  }

  // Earnings-test FRA credit: months of benefit fully withheld before FRA are
  // credited back at FRA by recomputing the benefit as if claimed that many
  // months later. Accumulated across the pre-FRA years (persists across the loop).
  const withheldMonthsByPerson = new Map<string, number>()
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
     * first projection year's evidence only; no amount is forced. Applies on
     * both classified and legacy/refusal paths when decedentHadStartedRmds is
     * true and ownerYearOfDeathRmdSatisfied is not modeled as satisfied.
     */
    const preHorizonYearOfDeathRmdUnresolved =
      inherited.decedentHadStartedRmds === true &&
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
    // Physical rows remain positional. ID-keyed phases share live aggregate
    // states whose facts come from the last row and whose order comes from the
    // first; writes are committed pro rata back to every physical member.
    const annualLogicalBalanceLedger = new AnnualLogicalBalanceLedger(balances)
    const annualIdKeyedBalances = annualLogicalBalanceLedger.liveStates()
    const annualBalanceByAccountId = new Map(
      annualIdKeyedBalances.map((state) => [state.account.id, state] as const),
    )
    const startOfYearPositionalBalances = balances.map((state) => state.balance)
    const startOfYearBalance = new Map(
      annualIdKeyedBalances.map((state) => [state.account.id, state.balance]),
    )
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

    const yearSites: AnnualCashFlowYearSites | null = captureAnnualCashFlow
      ? createAnnualCashFlowYearSites()
      : null

    // --- annual rebalance to target (start-of-year trade) -------------------
    // Allocated accounts trade drifted weights back to this year's glidepath
    // target. Taxable sells realize gains pro-rata through the same basis-ratio
    // machinery as withdrawals (basis rises by the realized gain: sold basis
    // leaves, the reinvested proceeds enter at market); traditional/Roth/HSA
    // rebalances are tax-free. rebalancing: 'none' opts out — weights drift.
    // The phase itself lives in `internal/annualRebalanceToTarget.ts`; it
    // returns one row per `balances` entry, in `balances` order, and that order
    // is load-bearing twice — it is the fold order of `rebalanceRealizedGains`
    // and the published order of the rebalancing capital-gain metadata lines.
    let rebalanceRealizedGains = 0
    const rebalanceRows = annualRebalanceToTarget({ states: balances, allocationTrack, year, startYear })
    for (let i = 0; i < balances.length; i++) {
      const row = rebalanceRows[i]!
      if (row.kind === 'none') continue
      if (row.kind === 'sale') {
        rebalanceRealizedGains += row.realizedCapitalGainOrLoss
        yearSites?.recordRebalancingGain(row.record)
        balances[i]!.costBasis = row.closingCostBasis
      }
      allocationTrack.get(String(i))!.weights = row.targetWeights
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
    //
    // The late-start warning is a last line rather than the only one.
    // `parsePlan` refuses a qualified purchase that starts paying later than
    // its shape permits, but simulatePlan accepts an in-memory Plan by type.
    // The pure planner therefore preserves the warning for that reachable
    // shape alongside the statutory cap and available-funding warnings.
    const annuityPurchaseRows = annualAnnuityPurchaseFunding({
      accounts: plan.accounts,
      balances,
      peopleById: personById,
      primaryPerson: primary,
      year,
      qlacPremiumCap: pack.annuities.qlacPremiumCap,
      limitGrowth,
    })
    if (annuityPurchaseRows.length !== plan.accounts.length) {
      throw new Error('Annuity-purchase funding row count does not match Plan accounts')
    }
    for (let accountIndex = 0; accountIndex < plan.accounts.length; accountIndex++) {
      const row = annuityPurchaseRows[accountIndex]!
      if (row.accountIndex !== accountIndex) {
        throw new Error('Annuity-purchase funding row lost its Plan position')
      }
      if (row.kind === 'none') continue
      const account = plan.accounts[accountIndex]
      const funding = balances[row.fundingIndex]
      if (
        account?.type !== 'annuity' ||
        !account.purchase ||
        funding === undefined ||
        funding.account.id !== account.purchase.fundingAccountId
      ) {
        throw new Error('Annuity-purchase funding row does not resolve its funding account')
      }
      for (const warning of row.warnings) warnings.add(warning)
      const fundingBalanceBefore = funding.balance
      if (row.capitalGainOrLossDelta !== null) {
        rebalanceRealizedGains += row.capitalGainOrLossDelta
        funding.costBasis = row.closingCostBasis!
      }
      funding.balance = row.closingBalance
      yearSites?.recordAnnuityPurchase(row.record)
      // The premium leaves an LP bucket for a contract the LP does not carry.
      // Captured here rather than from the occurrence below, which is emitted
      // only for a traditional funding source — a cash- or brokerage-funded
      // premium moves exactly the same dollars and publishes nothing.
      if (row.debit !== null) exogenousStrategyDebits.push(row.debit)
      if (row.funded > 0 && funding.account.type === 'traditional') {
        const kind = 'annuityFundingTransfer' as const
        const producerOccurrenceKey = runtimeOccurrenceKey(
          kind,
          funding.account.id,
          account.id,
        )
        recordAnnualRetirementRuntimeOccurrence({
          producerOccurrenceKey,
          kind,
          grossAmountPlanDollars: row.funded,
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
            appliedAmountPlanDollars: row.funded,
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
            const contractValueAfter = contractValueBefore + row.funded
            annuityContractValue.set(account.id, contractValueAfter)
            pendingAnnuityContractCredits.push({
              producerOccurrenceKey,
              annuityAccountId: account.id,
              ownerPersonId: funding.account.ownerPersonId,
              creditedAmountPlanDollars: row.funded,
              contractValueBeforePlanDollars: contractValueBefore,
              contractValueAfterPlanDollars: contractValueAfter,
            })
          }
        }
      }
      annuityInvestmentInContract.set(
        account.id,
        (annuityInvestmentInContract.get(account.id) ?? 0) + row.funded,
      )
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
    // The phase itself lives in `internal/pensionLumpSumRollovers.ts`: it owns
    // the selection, the target resolution and its skip, the offer amount, the
    // occurrence key and both publication gates. The credit stays here, because
    // two pensions may elect into ONE account in the same year and the second
    // application's before-balance is the first one's after-balance — so the
    // running balance must be read and written by the loop that mutates it.
    //
    // The credit reaches the optimizer through the occurrence recorded below,
    // not through a mutation-site capture like the two purchases: the occurrence
    // covers every case this line can reach, because `rolloverAccountId` is
    // validated as an existing OWNED TRADITIONAL account (`model/plan.ts`, "a
    // pension lump sum must roll over into an existing traditional account you
    // own (not an inherited IRA)"), so `row.runtime` can never be null where the
    // balance moved, and the account it resolves is always an owned one. An
    // offer of zero moves nothing and reports nothing.
    for (const row of pensionLumpSumRollovers({ accounts: plan.accounts, year, balances, runtimeOccurrenceKey })) {
      const target = balances[row.destinationIndex]!
      const targetBalanceBefore = target.balance
      target.balance += row.amount
      yearSites?.recordPensionRollover(row.record)
      if (row.runtime !== null) {
        recordAnnualRetirementRuntimeOccurrence({
          producerOccurrenceKey: row.runtime.producerOccurrenceKey,
          kind: 'rolloverInflow',
          grossAmountPlanDollars: row.amount,
          ownerPersonId: row.ownerPersonId,
          sourceAccountId: row.destinationAccountId,
          executionDate: null,
          executionSequence: null,
          movementAuthorityId: null,
        })
        if (row.runtime.creditsAggregatedIra) {
          recordAnnualRetirementRuntimeApplication({
            applicationKind: 'credit',
            producerOccurrenceKey: row.runtime.producerOccurrenceKey,
            simulatorPhase: 'pensionLumpSumRollover',
            ownerPersonId: row.ownerPersonId,
            sourceAccountId: row.destinationAccountId,
            sourceBalanceBeforePlanDollars: targetBalanceBefore,
            creditedAmountPlanDollars: row.amount,
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
    // The phase itself lives in `internal/hecmLineOpenings.ts`; the warning and
    // the map write interleave in ONE loop here, exactly as they did inline,
    // because `warnings` is a Set spread into the result and `hecmStates` is
    // insertion-ordered, so both positions are observable.
    for (const row of hecmLineOpenings({
      accounts: plan.accounts,
      year,
      startYear,
      propertyValues,
      openHecmLines: hecmStates,
      people,
      dobYear,
      pack,
    })) {
      if (row.warning !== null) warnings.add(row.warning)
      hecmStates.set(row.propertyAccountId, row.state)
    }

    // --- TIPS-ladder purchase funding ---------------------------------------
    // Same transfer semantics as an annuity premium: the quoted real cost
    // (inflated to the purchase year) leaves the funding account at book value
    // for cash, realizing gains pro-rata for taxable/equity-comp. A partial
    // fill scales every rung down so the ladder delivers exactly what the
    // money bought.
    // The helper shadows balances by ARRAY POSITION. Applying every purchase
    // row in order retains first-match duplicate ids and shared-source
    // read-after-write behavior without letting the helper mutate annual state.
    for (const row of tipsLadderPurchaseFunding({
      ladderStates,
      balances,
      year,
      inflFactor,
    })) {
      if (row.kind === 'none') continue
      const ladder = ladderStates[row.ladderIndex]!
      const funding = balances[row.fundingIndex]!
      if (row.scale !== null) ladder.scale = row.scale
      if (row.warning !== null) warnings.add(row.warning)
      // The former inline phase folded a zero gain for taxable accounts, but
      // did not perform an addition for cash/traditional/Roth/HSA accounts.
      // Test the PRE-WRITE balance here to retain that exact signed-zero and
      // IEEE-754 behavior for equity-compensation accounts too.
      if (
        funding.account.type === 'taxable' ||
        (funding.account.type === 'equityComp' && funding.balance > 0)
      ) {
        rebalanceRealizedGains += row.capitalGainOrLoss
      }
      funding.costBasis = row.closingCostBasis
      funding.balance = row.closingBalance
      yearSites?.recordTipsLadderPurchase(row.record)
      // This purchase has no runtime occurrence to read back, so the mutation
      // site remains the only source for the optimizer's exogenous debit.
      if (row.debit !== null) exogenousStrategyDebits.push(row.debit)
    }

    const peopleStates: PersonYearState[] = people.map((p) => {
      const ageAttained = year - dobYear(p)
      const lifeAge = lifeAgeOf(p)
      return { personId: p.id, ageAttained, alive: ageAttained <= lifeAge, lifeAge }
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

    // --- income setup: distributed yield, then wages --------------------
    const incomeSetup = annualIncomeSetup({
      distributedYield: {
        states: balances,
        startOfYearBalances: startOfYearPositionalBalances,
        allocationTrack,
        classParams,
      },
      wages: {
        incomes: plan.incomes,
        personById,
        stateOf,
        year,
        startYear,
        inflFactor,
      },
      commitDistributedYield: yearSites === null
        ? undefined
        : (row) => yearSites.recordDistributedYield(row.record),
      commitWage: yearSites === null
        ? undefined
        : (row) => yearSites.recordWages(row.record),
    })
    const {
      incomes,
      taxableYieldReinvested,
      distributedYieldByAccountId,
      distributedYieldByBalanceIndex,
      wagesByPerson,
    } = incomeSetup
    let ordinaryIncome = incomeSetup.ordinaryIncome
    /** Subsets of income eligible for state retirement-income exclusions. */
    let privateRetirementOrdinary = 0
    let publicPensionOrdinary = 0
    let oneTimeGains = 0
    // Pass 2: other non-SS streams. The phase itself lives in
    // `internal/otherIncomeStreams.ts`; folding row by row, in row order, is
    // load-bearing here — recurring and one-time rows interleave in plan order,
    // both reach `ordinaryIncome`, and IEEE-754 addition is not associative.
    // That accumulator has exactly two earlier writers in the year, the
    // distributed-yield pass above and pass 1 wages, and BOTH ARE OPTIONAL: a
    // plan with neither enters this loop at zero. (Measured over the phase-3
    // differential corpus: zero at entry in 3990 of 6336 year-runs.) That base
    // is what makes the fold order observable, and the two hazards have
    // DIFFERENT thresholds. PRE-SUMMING is exact at a zero base — folding row
    // by row IS pre-summing there — and CAN move the number once the base is
    // non-zero: measured, it does in 41 of the 250 default-mode corpus
    // year-runs that fold two or more ordinary rows, and not in the other 209.
    // RE-ORDERING can move it from TWO addends up once the base is non-zero,
    // and from three up even at a zero base.
    for (const row of otherIncomeStreams({ incomes: plan.incomes, year, anyAlive, inflFactor })) {
      if (row.kind === 'recurring') {
        incomes.recurring += row.amount
        if (row.taxTreatment === 'ordinary') ordinaryIncome += row.amount
        yearSites?.recordRecurringIncome(row.record)
      } else if (row.kind === 'oneTime') {
        incomes.oneTime += row.amount
        if (row.taxTreatment === 'ordinary') ordinaryIncome += row.amount
        if (row.taxTreatment === 'capitalGain') oneTimeGains += row.amount
        yearSites?.recordOneTimeIncome(row.record)
      }
    }

    // Pass 3: Social Security. Benefits are computed for everyone (a deceased
    // spouse's hypothetical benefit drives the survivor step-up), survivors
    // step up to max(own, deceased's) under the v1 couples simplification, and
    // then the earnings test withholds from living workers' resulting benefit.
    const ssColaFactor =
      plan.assumptions.ssCola.mode === 'matchInflation'
        ? inflFactorFrom(startYear, year)
        : Math.pow(1 + plan.assumptions.ssCola.annualPct / 100, year - startYear)
    const ssHaircutFactor =
      plan.assumptions.ssHaircut && year >= plan.assumptions.ssHaircut.fromYear
        ? 1 - plan.assumptions.ssHaircut.cutPct / 100
        : 1
    const socialSecurity = annualSocialSecurity({
      incomes: plan.incomes,
      people,
      personById,
      stateOf,
      resolvedPiaByStreamId,
      wagesByPerson,
      withheldMonthsByPerson,
      year,
      ssColaFactor,
      ssHaircutFactor,
      pack,
      limitGrowth,
    })
    incomes.socialSecurity += socialSecurity.socialSecurity
    for (const write of socialSecurity.withheldMonthWrites) {
      withheldMonthsByPerson.set(write.personId, write.value)
    }
    for (const warning of socialSecurity.warnings) warnings.add(warning)
    const { socialSecurityStreams, ssEarningsTestWithheld, ssdiPaid } =
      socialSecurity

    const pensionAndAnnuity = annualPensionAndAnnuityIncome({
      accounts: plan.accounts,
      people,
      personById,
      peopleStates, anyAlive,
      primaryPersonId: primary.id,
      lifeAgeOf,
      runtimeOccurrenceKey,
      pack,
      year,
      recordCashFlow: yearSites !== null,
      opening: {
        annuityIncome: incomes.annuity,
        pensionIncome: incomes.pension,
        ordinaryIncome,
        privateRetirementOrdinary,
        publicPensionOrdinary,
      },
      annuityInvestmentInContract,
      annuityExclusionState,
      annuityContractValue,
      annuityContractPoolOwner,
    })

    incomes.annuity = pensionAndAnnuity.annuityIncome
    incomes.pension = pensionAndAnnuity.pensionIncome
    ordinaryIncome = pensionAndAnnuity.ordinaryIncome
    privateRetirementOrdinary = pensionAndAnnuity.privateRetirementOrdinary
    publicPensionOrdinary = pensionAndAnnuity.publicPensionOrdinary
    const qualifiedAnnuityPayments = pensionAndAnnuity.qualifiedAnnuityPayments
    for (const row of pensionAndAnnuity.rows) {
      if (row.kind === 'pension') {
        if (row.record !== null) yearSites?.recordPension(row.record)
        continue
      }
      if (row.exclusionStateWrite !== null) {
        annuityExclusionState.set(
          row.exclusionStateWrite.accountId,
          row.exclusionStateWrite.value,
        )
      }
      const distribution = row.contractDistribution
      if (distribution !== null) {
        recordAnnualRetirementRuntimeOccurrence(distribution.occurrence)
        annuityContractValue.set(
          distribution.annuityAccountId,
          distribution.contractValueAfter,
        )
        const recorded = recordAnnualRetirementRuntimeApplication(
          distribution.application,
        )
        annuityContractDistributions.push({
          producerOccurrenceKey:
            distribution.occurrence.producerOccurrenceKey,
          annuityAccountId: distribution.annuityAccountId,
          poolOwnerPersonId: distribution.poolOwnerPersonId,
          grossAmountPlanDollars: distribution.grossAmountPlanDollars,
          mutationOrdinal: recorded.mutationOrdinal,
        })
      }
      if (row.record !== null) yearSites?.recordAnnuityPayment(row.record)
    }
    // --- TIPS-ladder cash flows ---------------------------------------------
    // The arithmetic lives in `internal/tipsLadderAnnualCashFlow.ts`, which
    // returns one row per ladder and deliberately does not sum across them:
    // `ordinaryIncome` is already non-zero here and IEEE-754 addition is not
    // associative, so the folding order below is part of the ledger.
    let ladderTaxableInterest = 0
    let ladderValueTotal = 0
    for (const row of tipsLadderAnnualCashFlows({
      ladderStates,
      year,
      startYear,
      anyAlive,
      inflFactor,
      inflFactorFrom,
      ladderLastAliveYear,
    })) {
      if (row.kind === 'none') continue
      if (row.kind === 'flow') {
        incomes.tipsLadder += row.cash
        ordinaryIncome += row.taxable
        ladderTaxableInterest += row.taxable
        ladderValueTotal += row.ladderValue
        yearSites?.recordTipsLadderCash(row.record)
        continue
      }
      ladderValueTotal += row.ladderValue
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
    const {
      requiredLifestyle,
      targetLifestyle,
      idealLifestyle,
      excessLifestyle,
    } = annualLifestyleLayers({
      expenses: plan.expenses,
      primaryAge: stateOf(primary.id).ageAttained,
      peopleStateCount: peopleStates.length,
      aliveCount,
      anyAlive,
      inflFactor,
      abwActive,
      abwRealReturnPct,
      abwTiltPct,
      abwHorizonYear,
      year,
      balances,
      startOfYearBalances: startOfYearPositionalBalances,
    })
    let debtService = 0
    for (const row of annualDebtServiceRows({
      accounts: plan.accounts,
      balances: debtBalances,
      year,
    })) {
      debtBalances.set(row.accountId, row.nextBalance)
      debtService += row.amount
      yearSites?.recordDebtService({
        accountId: row.accountId,
        ownerPersonId: row.ownerPersonId,
        amount: row.amount,
      })
    }
    const healthcarePlan = annualHealthcareExpenses({
      plan,
      pack,
      year,
      startYear,
      peopleStates,
      birthMonthByPerson,
      resolveMagiFor,
      ssa44ActiveInYear,
      filingStatusForYear,
      taxFilingStatusForYear,
      inflFactorFrom,
      healthInflFactorFrom,
      isStandIn,
      hasModeledPerson: (personId) => personById.has(personId),
      resolvePerson: stateOf,
      planHasTaxExemptYieldAttestation,
      taxExemptInterest: incomes.taxExemptInterest,
    })
    let healthcare = healthcarePlan.healthcare
    const healthInflFactor = healthcarePlan.healthInflFactor
    const acaContractsForYear = healthcarePlan.acaContractsForYear
    const acaContract = healthcarePlan.acaContract
    const acaEnrollmentPremiums = healthcarePlan.acaEnrollmentPremiums
    const acaSlcspBenchmarkPremiums =
      healthcarePlan.acaSlcspBenchmarkPremiums
    const acaGrossEnrollmentPremium =
      healthcarePlan.acaGrossEnrollmentPremium
    const acaActive = healthcarePlan.acaActive
    const healthcareExcludingAcaEnrollment =
      healthcarePlan.healthcareExcludingAcaEnrollment
    const healthcareExcludingMarketplacePremium =
      healthcarePlan.healthcareExcludingMarketplacePremium
    const acaInitialSupportCodes = healthcarePlan.acaInitialSupportCodes
    const exampleContractInputMismatch =
      healthcarePlan.exampleContractInputMismatch
    const medicarePremiums = healthcarePlan.medicarePremiums
    const irmaaSurcharge = healthcarePlan.irmaaSurcharge
    const irmaaTier = healthcarePlan.irmaaTier
    const irmaaMagi = healthcarePlan.irmaaMagi
    const irmaaLookbackMagiSource =
      healthcarePlan.irmaaLookbackMagiSource
    const irmaaLookbackMagiYear = healthcarePlan.irmaaLookbackMagiYear
    const irmaaNextTierThreshold = healthcarePlan.irmaaNextTierThreshold
    const marketplaceMonthsByPersonPosition =
      healthcarePlan.marketplaceMonthsByPersonPosition
    if (marketplaceMonthsByPersonPosition.length !== peopleStates.length) throw new Error('Healthcare planner person-row mismatch')
    const pre65MonthlyPremiumPerPerson =
      healthcarePlan.pre65MonthlyPremiumPerPerson
    for (const warning of healthcarePlan.warnings) warnings.add(warning)
    // Insurance premiums: level (fixed nominal), charged while the insured/owner
    // is alive. paidUp charges nothing; untilAge stops at premiumEndAge.
    let insurancePremiums = 0
    for (const row of annualInsurancePremiumRows({
      policies: plan.insurance,
      resolveSubject: stateOf,
    })) {
      insurancePremiums += row.amount
      yearSites?.recordInsurancePremium(row.record)
    }

    // LTC care episodes: a deterministic late-life cost spike, additive to
    // baseline spending. An owned LTC policy offsets it up to its monthly cap
    // (grown by the inflation rider) after the elimination period, for at most
    // benefitPeriodYears. The net (careCost − ltcBenefit) is what hits spending.
    const longTermCare = annualLongTermCarePlan({
      careEvents: plan.careEvents,
      policies: plan.insurance,
      benefitYearsUsed: ltcBenefitYearsUsed,
      resolvePerson: stateOf,
      healthInflFactor,
      year,
      startYear,
      capturePersonRows: captureAnnualCashFlow,
    })
    const careCost = longTermCare.careCost
    const ltcBenefit = longTermCare.ltcBenefit
    for (const write of longTermCare.benefitYearWrites) {
      ltcBenefitYearsUsed.set(write.policyId, write.yearsUsed)
    }
    for (const row of longTermCare.personRows) {
      yearSites?.recordLongTermCare(row)
    }

    // Property carrying costs: tax + insurance charged while the property is
    // owned, continuing after any mortgage is paid off — the part of a PITI
    // payment the debt account deliberately excludes. Today's dollars, inflated;
    // skipped from the sale year on, and (like base spending) once nobody is alive.
    let propertyCosts = 0
    for (const row of annualPropertyCarryingCosts({
      accounts: plan.accounts,
      year,
      anyAlive,
      inflFactor,
    })) {
      propertyCosts += row.amount
      yearSites?.recordPropertyCosts(row.record)
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
    const guardrailFunding = annualGuardrailFundingPlan({
      guardrailsActive,
      riskBasedGuardrails,
      allowRaisesAboveTarget: spendingPolicy?.allowRaisesAboveTarget,
      guardrailPolicy,
      oneTimeGoals: plan.expenses.oneTimeGoals,
      isGoalResolved: (goalId) => goalScheduler?.isResolved(goalId) ?? false,
      year,
      inflFactor,
      anyAlive,
      balances,
      startOfYearBalances: startOfYearPositionalBalances,
      requiredLifestyle,
      targetLifestyle,
      idealLifestyle,
      excessLifestyle,
      systemRequired,
      discretionaryMultiplier,
      startingWithdrawalRate,
      startingRealPortfolio,
    })
    discretionaryMultiplier = guardrailFunding.discretionaryMultiplier
    startingWithdrawalRate = guardrailFunding.startingWithdrawalRate
    startingRealPortfolio = guardrailFunding.startingRealPortfolio
    const guardrailAction = guardrailFunding.guardrailAction
    const targetLifestyleFunded = guardrailFunding.targetLifestyleFunded
    const idealLifestyleFunded = guardrailFunding.idealLifestyleFunded
    const excessLifestyleFunded = guardrailFunding.excessLifestyleFunded
    const remainingUpsideBudget = guardrailFunding.remainingUpsideBudget
    const cutting = guardrailFunding.cutting
    const canPullForwardGoals = guardrailFunding.canPullForwardGoals

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
            yearSites?.recordGoalOutcome({
              goalId: r.id,
              classification: r.classification,
              outcome: r.outcome,
              requested: r.fundedNominal + r.unfundedNominal,
              fundedNominal: r.fundedNominal,
            })
          } else if (r.outcome === 'deferred') {
            goalOutcomeCounts.deferred++
          } else {
            if (r.classification === 'required') skippedRequiredNominal += r.amountNominal
            else if (r.classification === 'target') skippedTargetNominal += r.amountNominal
            else if (r.classification === 'ideal') skippedIdealNominal += r.amountNominal
            else skippedExcessNominal += r.amountNominal
            goalOutcomeCounts.unfundedAmount += r.amountNominal
            goalOutcomeCounts.skipped++
            yearSites?.recordGoalOutcome({
              goalId: r.id,
              classification: r.classification,
              outcome: 'skipped',
              requested: r.amountNominal,
              fundedNominal: 0,
            })
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
          yearSites?.recordGoalOutcome({
            goalId: goal.id,
            classification,
            outcome: 'funded',
            requested: amount,
            fundedNominal: amount,
          })
        }
      }
    }

    // Base layers are funding-consistent (they exclude skipped goals) so the
    // shortfall attribution below stays clean; skipped goals are folded back into
    // the *reported* required/target totals and the shortfalls as explicit deltas.
    const expenseSummary = annualExpenseSummary({
      requiredLifestyle,
      targetLifestyle,
      targetLifestyleFunded,
      idealLifestyle,
      idealLifestyleFunded,
      excessLifestyle,
      excessLifestyleFunded,
      systemRequired,
      oneTimeGoalsFunded,
      requiredGoalsFunded,
      targetGoalsFunded,
      idealGoalsFunded,
      excessGoalsFunded,
      skippedRequiredNominal,
      skippedTargetNominal,
      skippedIdealNominal,
      skippedExcessNominal,
      debtService,
      propertyCosts,
      healthcare,
      insurancePremiums,
      careCost,
      ltcBenefit,
      discretionaryMultiplier,
    })
    const expenses = expenseSummary.expenses
    let requiredSpendingBase = expenseSummary.requiredSpendingBase
    let targetSpendingBase = expenseSummary.targetSpendingBase
    const idealSpendingBase = expenseSummary.idealSpendingBase
    const excessSpendingBase = expenseSummary.excessSpendingBase

    // --- fixed-asset dispositions (step 6) ----------------------------------
    // The phase lives in `internal/fixedAssetDispositions.ts`, which says which
    // accounts sell and what each sale hands back. Folding row by row, in row
    // order, is load-bearing: `ordinaryIncome` and `oneTimeGains` are both
    // already non-zero here and IEEE-754 addition is not associative.
    let propertySaleProceedsTotal = 0
    for (const row of fixedAssetDispositions({
      accounts: plan.accounts,
      year,
      propertyValues,
      inflRateAt,
      filingStatus: taxFilingStatusForYear,
      pack,
      hecmStates,
    })) {
      ordinaryIncome += row.ordinaryGain
      oneTimeGains += row.capitalGain
      if (row.closesHecmForAccountId !== null) hecmStates.delete(row.closesHecmForAccountId)
      propertySaleProceedsTotal += row.netProceedsAfterHecm
      yearSites?.recordPropertySaleProceeds(row.record)
    }

    // --- contributions & employer match --------------------
    const contributionPlan = snapshotAnnualContributionsAndEmployerMatchResult(
      annualContributionsAndEmployerMatch({
        balances,
        year,
        startYear,
        inflFactor,
        limitGrowth,
        filingStatus: filingStatusForYear,
        aliveCount,
        peopleCount: people.length,
        primaryPersonId: primary.id,
        wagesByPerson,
        resolveOwnerState: stateOf,
        resolveOwnerBirthYear: (ownerPersonId) =>
          dobYear(personById.get(ownerPersonId)!),
        resolveOwnerDob: (ownerPersonId) =>
          personById.get(ownerPersonId)?.dob ?? null,
        resolveRothPoolKey: rothPoolKey,
        runtimeOccurrenceKey,
        iraHouseholdCompensationKey: IRA_HOUSEHOLD_COMPENSATION_KEY,
        indexWithStatutoryRounding,
        pack,
      }),
    )

    if (
      contributionPlan.operationIdentities.length !==
        contributionPlan.operations.length ||
      contributionPlan.expectedOperationIdentities.length !==
        contributionPlan.operations.length
    ) {
      throw new Error('Annual contribution operations lost cardinality')
    }
    const seenMatchBalanceIndices = new Set<number>()
    const expectedContributionBalanceIndices =
      new Set(contributionPlan.expectedContributionBalanceIndices)
    if (
      expectedContributionBalanceIndices.size !==
      contributionPlan.expectedContributionBalanceIndices.length
    ) {
      throw new Error('Annual contribution expectation has duplicate positions')
    }
    const seenContributionBalanceIndices = new Set<number>()
    const shadowContributionBalances = balances.map((state) => state.balance)
    const shadowContributionCostBases = balances.map((state) => state.costBasis)
    let reconciledContributions = 0
    let reconciledOwnedNonRothIraContributions = 0
    let reconciledEmployerMatch = 0
    let reconciledPreTaxContributions = 0
    let reconciledTraditionalInflow = 0
    let reconciledOtherInflow = 0
    let reconciledTaxableInflow = 0
    let reachedEmployerMatches = false
    for (let operationIndex = 0; operationIndex <
      contributionPlan.operations.length; operationIndex++) {
      const operation = contributionPlan.operations[operationIndex]!
      const identity = contributionPlan.operationIdentities[operationIndex]!
      const expectedIdentity =
        contributionPlan.expectedOperationIdentities[operationIndex]!
      if (
        identity.kind !== operation.kind ||
        expectedIdentity.kind !== operation.kind
      ) {
        throw new Error('Annual contribution operation lost its identity')
      }
      if (
        operation.kind !== 'warning' &&
        (identity.kind === 'warning' ||
          expectedIdentity.kind === 'warning' ||
          identity.balanceIndex !== operation.balanceIndex ||
          expectedIdentity.balanceIndex !== operation.balanceIndex)
      ) {
        throw new Error('Annual contribution operation lost its identity')
      }
      if (operation.kind === 'warning') {
        if (reachedEmployerMatches) {
          throw new Error('Annual contribution operation order is inconsistent')
        }
        continue
      }
      const state = balances[operation.balanceIndex]
      if (
        state === undefined ||
        state.account !== operation.sourceAccount ||
        !Object.is(
          shadowContributionBalances[operation.balanceIndex],
          operation.balanceBefore,
        )
      ) {
        throw new Error(
          'Annual contribution operation lost its live balance position',
        )
      }
      if (operation.kind === 'contribution') {
        if (reachedEmployerMatches) {
          throw new Error('Annual contribution operation order is inconsistent')
        }
        if (
          !expectedContributionBalanceIndices.has(operation.balanceIndex) ||
          seenContributionBalanceIndices.has(operation.balanceIndex)
        ) {
          throw new Error('Annual contribution operation duplicated a physical position')
        }
        seenContributionBalanceIndices.add(operation.balanceIndex)
        if (
          !Object.is(
            shadowContributionCostBases[operation.balanceIndex],
            operation.costBasisBefore,
          )
        ) {
          throw new Error(
            'Annual contribution operation has a stale live cost basis',
          )
        }
        if (!Object.is(operation.record.credited, operation.credited)) {
          throw new Error(
            'Annual contribution operation has an inconsistent cash-flow record',
          )
        }
        if (
          operation.credited < 0 ||
          !Number.isFinite(operation.credited) ||
          (operation.credited === 0
            ? !Object.is(operation.balanceAfter, operation.balanceBefore)
            : !Object.is(
                operation.balanceAfter,
                operation.balanceBefore + operation.credited,
              ))
        ) {
          throw new Error('Annual contribution operation has inconsistent balance math')
        }
        const expectsBasisCredit =
          operation.sourceAccount.type === 'taxable' ||
          operation.sourceAccount.type === 'equityComp'
        const expectedCostBasisAfter =
          operation.credited > 0 && expectsBasisCredit
            ? operation.costBasisBefore + operation.credited
            : operation.costBasisBefore
        if (!Object.is(operation.costBasisAfter, expectedCostBasisAfter)) {
          throw new Error('Annual contribution operation has inconsistent basis math')
        }
        if (operation.credited > 0) {
          shadowContributionBalances[operation.balanceIndex] =
            operation.balanceAfter
          if (!Object.is(operation.costBasisAfter, operation.costBasisBefore)) {
            shadowContributionCostBases[operation.balanceIndex] =
              operation.costBasisAfter
          }
        }
        reconciledContributions += operation.credited
        if (isAggregatedIra(operation.sourceAccount)) {
          reconciledOwnedNonRothIraContributions += operation.credited
        }
        if (
          operation.sourceAccount.type === 'traditional' ||
          operation.sourceAccount.type === 'hsa'
        ) {
          reconciledPreTaxContributions += operation.credited
        }
        if (operation.sourceAccount.type === 'traditional') {
          reconciledTraditionalInflow += operation.credited
        } else {
          reconciledOtherInflow += operation.credited
        }
        if (
          operation.sourceAccount.type === 'taxable' ||
          operation.sourceAccount.type === 'equityComp'
        ) {
          reconciledTaxableInflow += operation.credited
        }
        continue
      }
      reachedEmployerMatches = true
      if (
        seenMatchBalanceIndices.has(operation.balanceIndex) ||
        (operation.sourceAccount.type !== 'traditional' &&
          operation.sourceAccount.type !== 'roth') ||
        operation.sourceAccount.kind !== 'employer' ||
        operation.sourceAccount.employerMatch === null ||
        operation.sourceAccount.employerMatch === undefined
      ) {
        throw new Error('Annual employer-match operation lost its physical identity')
      }
      if (
        operation.record.amount <= 0 ||
        !Number.isFinite(operation.record.amount) ||
        !Object.is(
          operation.balanceAfter,
          operation.balanceBefore + operation.record.amount,
        )
      ) {
        throw new Error('Annual employer-match operation has inconsistent balance math')
      }
      seenMatchBalanceIndices.add(operation.balanceIndex)
      shadowContributionBalances[operation.balanceIndex] =
        operation.balanceAfter
      reconciledEmployerMatch += operation.record.amount
      if (operation.sourceAccount.type === 'traditional') {
        reconciledTraditionalInflow += operation.record.amount
      } else {
        reconciledOtherInflow += operation.record.amount
      }
    }
    if (
      seenContributionBalanceIndices.size !==
      expectedContributionBalanceIndices.size
    ) {
      throw new Error('Annual contribution operations lost expected positions')
    }
    assertExactContributionTotal(
      'contribution total',
      contributionPlan.totals.contributions,
      reconciledContributions,
    )
    assertExactContributionTotal(
      'owned-IRA contribution total',
      contributionPlan.totals.ownedNonRothIraContributions,
      reconciledOwnedNonRothIraContributions,
    )
    assertExactContributionTotal(
      'employer-match total',
      contributionPlan.totals.employerMatch,
      reconciledEmployerMatch,
    )
    assertExactContributionTotal(
      'pre-tax contribution total',
      contributionPlan.totals.preTaxContributions,
      reconciledPreTaxContributions,
    )
    assertExactContributionTotal(
      'traditional inflow total',
      contributionPlan.totals.traditionalInflow,
      reconciledTraditionalInflow,
    )
    assertExactContributionTotal(
      'other inflow total',
      contributionPlan.totals.otherInflow,
      reconciledOtherInflow,
    )
    assertExactContributionTotal(
      'taxable inflow total',
      contributionPlan.totals.taxableInflow,
      reconciledTaxableInflow,
    )
    for (const operation of contributionPlan.operations) {
      if (operation.kind === 'warning') {
        warnings.add(operation.message)
        continue
      }
      const state = balances[operation.balanceIndex]!
      if (operation.kind === 'contribution') {
        if (operation.credited > 0) {
          state.balance = operation.balanceAfter
          if (operation.retirementOccurrence !== null) {
            recordAnnualRetirementRuntimeOccurrence(
              operation.retirementOccurrence,
            )
          }
          if (operation.retirementApplication !== null) {
            recordAnnualRetirementRuntimeApplication(
              operation.retirementApplication,
            )
          }
          if (!Object.is(operation.costBasisAfter, operation.costBasisBefore)) {
            state.costBasis = operation.costBasisAfter
          }
          if (operation.rothContributionPoolKey !== null) {
            const rb = rothBasis.get(operation.rothContributionPoolKey)
            if (rb) {
              rb.contributionBasis += operation.rothContributionBasisDelta
            }
          }
          if (operation.qcdSection219OwnerPersonId !== null) {
            const ownerId = operation.qcdSection219OwnerPersonId
            qcdSection219ByDonor.set(
              ownerId,
              (qcdSection219ByDonor.get(ownerId) ?? 0) +
                operation.qcdSection219Amount,
            )
          }
        }
        yearSites?.recordContribution(operation.record)
        continue
      }

      // The cash-flow record originally preceded the match balance mutation.
      yearSites?.recordEmployerMatch(operation.record)
      state.balance = operation.balanceAfter
      if (operation.retirementOccurrence !== null) {
        recordAnnualRetirementRuntimeOccurrence(operation.retirementOccurrence)
      }
    }
    const {
      contributions,
      ownedNonRothIraContributions,
      employerMatch,
      preTaxContributions,
      traditionalInflow,
      otherInflow,
      taxableInflow,
    } = contributionPlan.totals
    const employerAllocationByOwner =
      contributionPlan.employerAllocationByOwner
    const iraProRata = new Map<string, IraProRataYear>()
    const qcdProRataIdentityByReadSnapshot =
      new WeakMap<IraProRataYear, IraProRataYear>()
    const splitAnnualIraDistribution = (
      readState: IraProRataYear,
      amount: number,
    ) => splitIraDistribution(
      qcdProRataIdentityByReadSnapshot.get(readState) ?? readState,
      amount,
      readState,
    )
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
      /**
       * When true, this committed pass publishes `YearResult.cashFlow`.
       * Default false so a forgotten T0, staging-probe, or option-counterfactual
       * call site cannot leak capture onto a published year. Only the three
       * committed call sites pass `captureAnnualCashFlow`.
       */
      publishCashFlow = false,
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

    // Reporting-only. Allocated only on the committed publish path so T0 /
    // staging / option-counterfactual re-entries construct nothing.
    let seppByAccountId: Map<string, { ownerPersonId: string | null; take: number }> | null = null
    let hecmCoordinatedByProperty: Map<string, number> | null = null
    let hecmBackstopByProperty: Map<string, number> | null = null
    let legacyPropertySaleDeposits: {
      propertyAccountId: string
      amount: number
      destination: YearCashFlowTransferEndpoint
    }[] | null = null
    let deathBenefits: {
      policyId: string
      insuredPersonId: string
      amount: number
      destination: YearCashFlowTransferEndpoint
    }[] | null = null
    let surplusDestination: YearCashFlowTransferEndpoint | null = null
    let cashFlowPenaltyLines: AnnualCashFlowPenaltySnapshot[] | null = null
    let rothPoolTaxableOrdinaryByPersonId: Map<string, number> | null = null
    let annuityBasisReturnByAccountId: Map<string, number> | null = null
    let rmdNontaxableByOwner: Map<string, number> | null = null
    let seppNontaxableByAccountId: Map<string, number> | null = null
    let aggregateConversionDraws: {
      sourceAccountId: string
      destinationAccountId: string
      ownerPersonId: string
      amount: number
      nontaxable: number
    }[] | null = null
    let qcdExclusionFromRmdByOwner: Map<string, number> | null = null
    let qcdExclusionBeyondRmdByOwner: Map<string, number> | null = null
    let qcdOrdinaryBeyondRmdByOwner: Map<string, number> | null = null
    let qcdBeyondRmdCharacterByOccurrence: {
      ownerId: string
      sourceAccountId: string
      exclusion: number
      ordinary: number
    }[] | null = null
    let qcdOrdinaryFromRmdByOwner: Map<string, number> | null = null
    let qcdBasisFromRmdByOwner: Map<string, number> | null = null
    let hsaNonqualifiedOrdinaryByAccountId: Map<string, number> | null = null
    let employerRothTaxableOrdinaryByAccountId: Map<string, number> | null = null
    if (publishCashFlow) {
      seppByAccountId = new Map()
      hecmCoordinatedByProperty = new Map()
      hecmBackstopByProperty = new Map()
      legacyPropertySaleDeposits = []
      deathBenefits = []
      surplusDestination = surplusDepositTarget
        ? { entityKind: 'account', accountId: asAccountId(surplusDepositTarget.account.id) }
        : { entityKind: 'unassignedCash' }
      cashFlowPenaltyLines = []
      rothPoolTaxableOrdinaryByPersonId = new Map()
      annuityBasisReturnByAccountId = new Map()
      rmdNontaxableByOwner = new Map()
      seppNontaxableByAccountId = new Map()
      aggregateConversionDraws = []
      qcdExclusionFromRmdByOwner = new Map()
      qcdExclusionBeyondRmdByOwner = new Map()
      qcdOrdinaryBeyondRmdByOwner = new Map()
      qcdBeyondRmdCharacterByOccurrence = []
      qcdOrdinaryFromRmdByOwner = new Map()
      qcdBasisFromRmdByOwner = new Map()
      hsaNonqualifiedOrdinaryByAccountId = new Map()
      employerRothTaxableOrdinaryByAccountId = new Map()
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
    /**
     * Observation-only: per-channel Form 8606 taxable ordinary income produced
     * this year for owners with omitted `nondeductibleBasis`. Per-attempt;
     * drives the assumed-basis consequential verdict. Each channel accumulates
     * only the taxable character that channel's binding transaction produced
     * under the assumption — never the year's full gross for that channel.
     */
    type Form8606ConsequentialChannel =
      | 'distributions'
      | 'conversions'
      | 'annuityPayments'
    const form8606ConsequentialByOwner = new Map<string, {
      distributions: number
      conversions: number
      annuityPayments: number
    }>()
    const noteForm8606Taxable = (
      ownerPersonId: string,
      taxable: number,
      channel: Form8606ConsequentialChannel,
    ): void => {
      if (taxable <= 0 || !ownersWithOmittedNondeductibleBasis.has(ownerPersonId)) return
      const entry = form8606ConsequentialByOwner.get(ownerPersonId) ?? {
        distributions: 0,
        conversions: 0,
        annuityPayments: 0,
      }
      entry[channel] += taxable
      form8606ConsequentialByOwner.set(ownerPersonId, entry)
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
      // Fallback path: settlement published no matching assumed effect, so this
      // draw is priced with the pre-distribution pro-rata state (or full ordinary
      // when that state cannot answer). That is the registered legacy tax path —
      // not an executed character under assumed-zero basis. Do not publish an
      // assumed-basis verdict here (same silence as the annuity refused-settlement
      // site): the settlement never priced this transaction over the assumption.
      if (assumed === null) {
        return splitAnnualIraDistribution(state, amount)
      }
      const split = {
        nontaxable: assumed.basisReturn,
        taxable: assumed.ordinaryIncome,
        next: {
          basis: Math.max(0, state.basis - assumed.basisReturn),
          nontaxableFraction: state.nontaxableFraction,
        },
      }
      const channel: Form8606ConsequentialChannel =
        input.calculationScope === 'form8606Line8NetConversions'
          ? 'conversions'
          : 'distributions'
      noteForm8606Taxable(input.ownerPersonId, split.taxable, channel)
      return split
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
    // ID-keyed forced-distribution, IRA-character, and optimizer evidence all
    // observe one aggregate live state per compatible logical account ID. The
    // selected facts come from the last physical row and ID order from the
    // first, while positional phases such as contributions retain every row.
    const rmdBalances = annualIdKeyedBalances
    // Year-scoped omitted-basis owners: same aggregation membership the
    // Form 8606 settlement uses this year (includes post-election treat-as-own).
    ownersWithOmittedNondeductibleBasis.clear()
    for (const { account } of balances) {
      if (!isAggregatedIraThisYear(account)) continue
      // isAggregatedIraThisYear is not a type predicate (S2 post-flip accounts
      // stay TraditionalAccount with inherited set); re-narrow for basis field.
      if (account.type !== 'traditional' || account.kind !== 'ira') continue
      const ownerPersonId = account.ownerPersonId ?? primary.id
      if (account.nondeductibleBasis === undefined) {
        ownersWithOmittedNondeductibleBasis.add(ownerPersonId)
      }
    }
    const followsOwnerRmdsThisYear = (account: Account): boolean => {
      if (account.type !== 'traditional') return false
      if (account.inherited === undefined) return true
      if (!isTreatAsOwnEffective(account, year)) return false
      if (year === account.inherited.ownerDeathYear) return false
      return true
    }
    const preDistributionAggregateIraBalance = new Map<string, number>()
    for (const state of rmdBalances) {
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
    for (const state of rmdBalances) {
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
    // annualOwnerRmdPlan decides the amounts in two steps — each logical
    // account's separately calculated share, then the owner's unmet remainder
    // swept across their other IRAs. The caller executes only the settled
    // takes, once per logical ID; executing while planning would record two
    // occurrences against one account under the same key.
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
    const ownerRmdPlan = annualOwnerRmdPlan({
      balances: rmdBalances,
      startOfYearBalance,
      people,
      personById,
      stateOf,
      primaryPersonId: primary.id,
      followsOwnerRmdsThisYear,
      applicablePlanForAccount: rmdApplicablePlanForAccount,
      deferredFirstRmdByApplicablePlan,
      firstYearDeferrals: opts.rmdFirstYearDeferrals ?? [],
      pack,
      year,
    })
    for (const operation of ownerRmdPlan.deferredFirstRmdOperations) {
      if (operation.kind === 'delete') {
        deferredFirstRmdByApplicablePlan.delete(operation.applicablePlanKey)
      } else {
        deferredFirstRmdByApplicablePlan.set(
          operation.applicablePlanKey,
          operation.value,
        )
      }
    }
    const {
      rmdTakeByAccount: plannedRmdTakeByAccount,
      rmdObligationByAccount,
      iraRmdRequiredByOwner,
      iraRmdUnsatisfiedByOwner,
      rmdShortfallObligations,
    } = ownerRmdPlan
    const rmdTakeByAccount = new Map(
      [...plannedRmdTakeByAccount].map(([accountId, take]) => [accountId, Number(take)]),
    )
    for (const state of rmdBalances) {
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
    const seppPlan = annualSeppDistributions({
      balances: rmdBalances,
      year,
      primaryPersonId: primary.id,
      resolveOwnerState: stateOf,
      resolveOwnerRetirementAge: (ownerPersonId) =>
        personById.get(ownerPersonId)!.retirementAge,
      startOfYearBalance,
      amortizationAmountByAccountId: seppAmortAmount,
      pack,
    })
    const seppTotal = seppPlan.total
    for (const operation of seppPlan.operations) {
      if (operation.kind === 'amortizationCacheWrite') {
        seppAmortAmount.set(operation.accountId, operation.amount)
        continue
      }

      const state = rmdBalances[operation.balanceIndex]!
      state.balance = operation.sourceBalanceAfter
      const kind = 'automaticSeppDistribution' as const
      const producerOccurrenceKey = runtimeOccurrenceKey(kind, operation.accountId)
      recordAnnualRetirementRuntimeOccurrence({
        producerOccurrenceKey,
        kind,
        grossAmountPlanDollars: operation.take,
        ownerPersonId: operation.ownerPersonId,
        sourceAccountId: operation.accountId,
        executionDate: null,
        executionSequence: null,
        movementAuthorityId: null,
      })
      let ownedIraApplication:
        SimulatorRetirementRuntimeApplication | null = null
      if (operation.recordsOwnedIraApplication) {
        ownedIraApplication = recordAnnualRetirementRuntimeApplication({
          applicationKind: 'debit',
          producerOccurrenceKey,
          simulatorPhase: 'automaticSeppDistribution',
          ownerPersonId: operation.ownerPersonId,
          sourceAccountId: operation.accountId,
          sourceBalanceBeforePlanDollars: operation.sourceBalanceBefore,
          appliedAmountPlanDollars: operation.take,
          sourceBalanceAfterPlanDollars: operation.sourceBalanceAfter,
        })
      }
      seppByAccountId?.set(operation.accountId, {
        ownerPersonId: operation.ownerPersonId,
        take: operation.take,
      })
      if (
        operation.defersIraCharacter &&
        ownedIraApplication?.applicationKind === 'debit'
      ) {
        deferredSeppDistributions.push({
          ownerId: operation.characterOwnerPersonId,
          amount: operation.take,
          occurrenceKind: kind,
          producerOccurrenceKey,
          sourceAccountId: operation.accountId,
          mutationOrdinal: ownedIraApplication.mutationOrdinal,
        })
      }
    }

    // --- Inherited IRA: exact-ledger execution (WS4) ------------------------
    // Classify and plan the whole logical-ID phase before touching any live
    // balance. This keeps compatible duplicate physical rows behind one
    // aggregate distribution, evidence row, runtime occurrence, and §4974
    // application while the logical ledger commits the debit pro rata.
    const inheritedPlan = immutablePlainSnapshot(
      annualInheritedIraDistributions({
        year,
        startYear,
        pack,
        primaryPersonId: primary.id,
        balances: rmdBalances,
        startOfYearBalance,
        classCache: inheritedClassCache,
        beneficiaryState: (personId) => stateOf(personId),
      }),
    )
    const inheritedOperations = inheritedPlan.rows.flatMap((row) =>
      row.distribution === null ? [] : [row.distribution])
    const inheritedTotal = inheritedPlan.totals.inherited
    const inheritedOrdinaryIncome = inheritedPlan.totals.ordinaryIncome
    const inheritedRothForced = inheritedPlan.totals.rothForced
    const inheritedYearEvidenceDraft: InheritedAccountYearEvidence[] =
      inheritedPlan.rows.map((row) => row.evidence)
    const inheritedRmdShortfallObligations =
      inheritedPlan.rmdShortfallObligations
    const inheritedOperationIndexes = new Set<number>()
    for (const operation of inheritedOperations) {
      const state = rmdBalances[operation.balanceIndex]
      if (state === undefined || state.account.id !== operation.accountId) {
        throw new Error(
          'Inherited-IRA distribution operation lost its balance position',
        )
      }
      if (
        inheritedOperationIndexes.has(operation.balanceIndex) ||
        (state.account.type !== 'traditional' &&
          state.account.type !== 'roth') ||
        state.account.inherited === undefined ||
        state.account.ownerPersonId !== operation.ownerPersonId ||
        state.balance !== operation.sourceBalanceBefore ||
        !Number.isFinite(operation.sourceBalanceAfter) ||
        operation.sourceBalanceAfter < 0 ||
        !Number.isFinite(operation.executed) ||
        operation.executed <= 0 ||
        operation.executed > operation.sourceBalanceBefore ||
        planDollarsMoveNoLedgerCent(operation.executed) ||
        operation.sourceBalanceBefore - operation.executed !==
          operation.sourceBalanceAfter
      ) {
        throw new Error(
          `invalid annual inherited-IRA distribution operation for account id "${operation.accountId}"`,
        )
      }
      inheritedOperationIndexes.add(operation.balanceIndex)
    }
    for (const operation of inheritedOperations) {
      const state = rmdBalances[operation.balanceIndex]!
      state.balance = operation.sourceBalanceAfter
      const kind = 'inheritedIraRmd' as const
      const producerOccurrenceKey = runtimeOccurrenceKey(kind, operation.accountId)
      recordAnnualRetirementRuntimeOccurrence({
        producerOccurrenceKey,
        kind,
        grossAmountPlanDollars: operation.executed,
        ownerPersonId: operation.ownerPersonId,
        sourceAccountId: operation.accountId,
        executionDate: null,
        executionSequence: null,
        movementAuthorityId: null,
      })
    }
    rmdShortfallObligations.push(...inheritedRmdShortfallObligations)
    const rmdShortfallExciseResults: RmdShortfallExciseResult[] =
      rmdShortfallObligations.map((obligation) =>
        computeRmdShortfallExcise(
          obligation,
          rmdReliefElectionFor(obligation.obligationId),
        ))
    const rmdShortfallExciseTax = rmdShortfallExciseResults.reduce(
      (total, result) => total + result.tax,
      0,
    )
    if (rmdShortfallExciseTax > 0) {
      warnings.add(
        'An IRC §4974 excise tax was charged on a required-minimum-distribution shortfall.',
      )
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
    let qcd: number
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
    const qcdGiftPlan = annualLegacyQcdGiftPlan({
      qcdAnnual: plan.strategies.qcdAnnual,
      inflFactor,
      perDonorLimit: pack.rmd.qcdAnnualLimit * limitGrowth,
      hasNamedQcdRequest,
      people: peopleStates.map((state) => ({
        personId: state.personId,
        alive: state.alive,
        ageAttained: state.ageAttained,
        birthMonth: birthMonthByPerson.get(state.personId) ?? 1,
      })),
      ownedIraRmdTotal,
      ownedIraRmdGrossByOwner,
      balances: rmdBalances.map((state, balanceIndex) => ({
        balanceIndex,
        accountId: state.account.id,
        ownerId: state.account.ownerPersonId ?? primary.id,
        isAggregatedIra: isAggregatedIra(state.account),
        balance: state.balance,
      })),
    })
    qcd = qcdGiftPlan.qcd
    // Gross dollars routed out of the owned-IRA RMD. That RMD already counted
    // these as a cash inflow, so this is what cash must give back. The cap is
    // the owned-IRA share of the forced total, not the whole of it:
    // 408(d)(8)(B) reaches only a distribution from an individual retirement
    // plan, so an employer-plan RMD cannot carry a gift out of income and a
    // donor with no IRA RMD at all has nothing here to route.
    const qcdFromRmd = qcdGiftPlan.qcdFromRmd
    const qcdGrossByOwner = qcdGiftPlan.qcdGrossByOwner
    /** The part of each owner's gift routed out of their required distribution. */
    const qcdFromRmdByOwner = qcdGiftPlan.qcdFromRmdByOwner

    // Validate the complete intent sequence before its first mutation or
    // runtime write. The shadow also makes repeated hostile intents validate
    // sequentially without partially applying an earlier one.
    const validatedQcdGiftDebitIntents: Array<{
      balanceIndex: number
      sourceAccountId: string
      ownerId: string
      runtimeOwnerPersonId: string | null
      sourceBalanceBefore: number
      sourceBalanceAfter: number
      amount: number
    }> = []
    const remainingQcdGiftBalanceByIndex = new Map<number, number>()
    for (const intent of qcdGiftPlan.debitIntents) {
      // Read every helper-owned property exactly once. Only these normalized
      // scalars cross into apply, so a getter-backed result cannot change
      // identity or throw after an earlier intent has already committed.
      const balanceIndex = intent.balanceIndex
      const sourceAccountId = intent.sourceAccountId
      const ownerId = intent.ownerId
      const sourceBalanceBefore = intent.sourceBalanceBefore
      const amount = intent.amount
      const state = rmdBalances[balanceIndex]
      const remainingBalance = remainingQcdGiftBalanceByIndex.get(
        balanceIndex,
      ) ?? state?.balance
      if (
        state === undefined ||
        !isAggregatedIra(state.account) ||
        state.account.id !== sourceAccountId ||
        (state.account.ownerPersonId ?? primary.id) !== ownerId ||
        remainingBalance !== sourceBalanceBefore ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        planDollarsMoveNoLedgerCent(amount) ||
        remainingBalance === undefined ||
        amount > remainingBalance
      ) {
        throw new Error(
          'Legacy scalar QCD debit intent lost its live source identity',
        )
      }
      const sourceBalanceAfter = remainingBalance - amount
      remainingQcdGiftBalanceByIndex.set(
        balanceIndex,
        sourceBalanceAfter,
      )
      validatedQcdGiftDebitIntents.push({
        balanceIndex,
        sourceAccountId,
        ownerId,
        runtimeOwnerPersonId: state.account.ownerPersonId,
        sourceBalanceBefore,
        sourceBalanceAfter,
        amount,
      })
    }
    const qcdGiftOffsetHistoryUnprovableDonorIds = [
      ...qcdGiftPlan.offsetHistoryUnprovableDonorIds,
    ]
    const qcdGiftPersonIds = new Set(
      peopleStates.map((person) => person.personId),
    )
    if (qcdGiftOffsetHistoryUnprovableDonorIds.some((donorId) =>
      !qcdGiftPersonIds.has(donorId))) {
      throw new Error(
        'Legacy scalar QCD history write lost its donor identity',
      )
    }

    for (const debit of validatedQcdGiftDebitIntents) {
      const state = rmdBalances[debit.balanceIndex]!
      // This logical setter commits the exact aggregate closing balance pro
      // rata across every compatible physical row for the account ID.
      state.balance = debit.sourceBalanceAfter
      const kind = 'legacyQcd' as const
      const producerOccurrenceKey = runtimeOccurrenceKey(
        kind,
        debit.sourceAccountId,
      )
      recordAnnualRetirementRuntimeOccurrence({
        producerOccurrenceKey,
        kind,
        grossAmountPlanDollars: debit.amount,
        ownerPersonId: debit.runtimeOwnerPersonId,
        sourceAccountId: debit.sourceAccountId,
        executionDate: null,
        executionSequence: null,
        movementAuthorityId: null,
      })
      const giftApplication = recordAnnualRetirementRuntimeApplication({
        applicationKind: 'debit',
        producerOccurrenceKey,
        simulatorPhase: 'legacyQcdDistribution',
        ownerPersonId: debit.runtimeOwnerPersonId,
        sourceBalanceBeforePlanDollars: debit.sourceBalanceBefore,
        sourceAccountId: debit.sourceAccountId,
        appliedAmountPlanDollars: debit.amount,
        sourceBalanceAfterPlanDollars: debit.sourceBalanceAfter,
      })
      if (giftApplication.applicationKind === 'debit') {
        deferredLegacyQcdDistributions.push({
          ownerId: debit.ownerId,
          amount: debit.amount,
          producerOccurrenceKey,
          sourceAccountId: debit.sourceAccountId,
          mutationOrdinal: giftApplication.mutationOrdinal,
        })
      }
    }
    for (const donorId of qcdGiftOffsetHistoryUnprovableDonorIds) {
      namedQcdOffsetHistoryUnprovable.add(donorId)
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
    // never exceed it and no second clamp is needed here. The (A) second
    // sentence then reduces that exclusion, but not below zero, by the excess
    // of deductible §219 contributions for years ending on or after 70½ over
    // reductions already taken — the same lifetime running total the named
    // arm settles in `applyIrc408d8AContributionOffset`. Leftover is ordinary
    // income and does not lower MAGI; a §170 itemized deduction for that
    // leftover is not booked here.
    const qcdQualifiedFromRmdByOwner = new Map<string, number>()
    const qcdNonQualifiedBeyondRmdByOwner = new Map<string, number>()
    const expectedQcdOwnerIds = new Set<string>(qcdGrossByOwner.keys())
    for (const [ownerId, basis] of iraBasisByOwner) {
      if (basis > 0) expectedQcdOwnerIds.add(ownerId)
    }
    const qcdOwnerCharacterPlan =
      materializeAnnualLegacyQcdOwnerCharacterPlanResult(
        annualLegacyQcdOwnerCharacterPlan({
          qcdGrossByOwner,
          qcdFromRmdByOwner,
          iraBasisByOwner,
          preDistributionAggregateIraBalance,
          qcdSection219ByDonor,
          qcdOffsetConsumedByDonor: namedQcdOffsetConsumedByDonor,
          preProjectionQcdOffsetUnprovable,
          publishCashFlow,
        }),
        [...expectedQcdOwnerIds],
      )
    for (const row of qcdOwnerCharacterPlan.rows) {
      if (row.contradictoryOffsetLedger) {
        const ownerName = personById.get(row.ownerId)?.name ?? row.ownerId
        warnings.add(
          `${ownerName}’s recurring QCD was treated as ordinary income because its recorded post-70½ deductible-contribution offset exceeds the deductible-contribution total. Review the contribution and QCD history.`,
        )
      }
      if (row.qcdOffsetConsumedWrite !== null) {
        namedQcdOffsetConsumedByDonor.set(
          row.ownerId,
          row.qcdOffsetConsumedWrite,
        )
      }
      qcdQualifiedFromRmdByOwner.set(row.ownerId, row.qualifiedFromRmd)
      qcdNonQualifiedBeyondRmdByOwner.set(
        row.ownerId,
        row.nonQualifiedBeyondRmd,
      )
      qcdIncomeOffset += row.incomeOffsetDelta
      if (row.nonQualifiedOrdinaryIncomeDelta > 0) {
        qcdNonQualifiedOrdinaryIncome +=
          row.nonQualifiedOrdinaryIncomeDelta
      }
      for (const write of row.cashFlowWrites) {
        switch (write.target) {
          case 'exclusionFromRmd':
            qcdExclusionFromRmdByOwner!.set(write.ownerId, write.value)
            break
          case 'ordinaryFromRmd':
            qcdOrdinaryFromRmdByOwner!.set(write.ownerId, write.value)
            break
          case 'exclusionBeyondRmd':
            qcdExclusionBeyondRmdByOwner!.set(write.ownerId, write.value)
            break
          case 'ordinaryBeyondRmd':
            qcdOrdinaryBeyondRmdByOwner!.set(write.ownerId, write.value)
            break
          default: {
            const exhaustive: never = write.target
            throw new Error(`Unknown legacy QCD cash-flow target: ${String(exhaustive)}`)
          }
        }
      }
      if (row.iraProRataWrite !== null) {
        const readSnapshot = row.iraProRataReadSnapshot!
        iraProRata.set(row.ownerId, readSnapshot)
        qcdProRataIdentityByReadSnapshot.set(
          readSnapshot,
          row.iraProRataWrite,
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
      if (assumed === null) {
        // No settlement character: payment stays fully ordinary (registered
        // ASSUMPTION-FREE legacy). Do not publish an assumed-basis verdict —
        // the settlement never priced this payment over assumed-zero basis.
        continue
      }
      // Settlement priced the payment: ordinary share under the year's fraction
      // (assumed-zero basis → full ordinary) is the consequential channel.
      noteForm8606Taxable(
        payment.poolOwnerPersonId,
        Math.max(0, payment.grossAmountPlanDollars - assumed.basisReturn),
        'annuityPayments',
      )
      if (assumed.basisReturn <= 0) continue
      annuityPaymentNontaxable += assumed.basisReturn
      if (publishCashFlow) {
        annuityBasisReturnByAccountId!.set(
          payment.annuityAccountId,
          (annuityBasisReturnByAccountId!.get(payment.annuityAccountId) ?? 0) +
            assumed.basisReturn,
        )
      }
      const proRata = iraProRata.get(payment.poolOwnerPersonId)
      if (proRata !== undefined) {
        iraProRata.set(payment.poolOwnerPersonId, {
          basis: Math.max(0, proRata.basis - assumed.basisReturn),
          nontaxableFraction: proRata.nontaxableFraction,
        })
      }
    }
    const qcdNonQualifiedFromRmdRemaining = new Map<string, number>()
    if (publishCashFlow) {
      for (const [ownerId, fromRmd] of qcdFromRmdByOwner) {
        if (fromRmd <= 0) continue
        const nq = Math.max(0, fromRmd - (qcdQualifiedFromRmdByOwner.get(ownerId) ?? 0))
        if (nq > 0) qcdNonQualifiedFromRmdRemaining.set(ownerId, nq)
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
        if (line7Gross <= 0) continue
        const nqThis = publishCashFlow && entry.occurrenceKind === 'ownedIraRmd'
          ? Math.min(qcdNonQualifiedFromRmdRemaining.get(entry.ownerId) ?? 0, line7Gross)
          : 0
        if (nqThis > 0) {
          qcdNonQualifiedFromRmdRemaining.set(
            entry.ownerId,
            (qcdNonQualifiedFromRmdRemaining.get(entry.ownerId) ?? 0) - nqThis,
          )
        }
        const nqShare = nqThis === 0 ? 0 : nqThis / line7Gross
        const snapshotFromRmdSplit = (taxable: number, nontaxable: number): void => {
          if (!publishCashFlow || entry.occurrenceKind !== 'ownedIraRmd') return
          const nqTaxable = taxable * nqShare
          const nqBasis = nontaxable * nqShare
          if (nqTaxable > 0) {
            qcdOrdinaryFromRmdByOwner!.set(
              entry.ownerId,
              (qcdOrdinaryFromRmdByOwner!.get(entry.ownerId) ?? 0) + nqTaxable,
            )
          }
          if (nqBasis > 0) {
            qcdBasisFromRmdByOwner!.set(
              entry.ownerId,
              (qcdBasisFromRmdByOwner!.get(entry.ownerId) ?? 0) + nqBasis,
            )
          }
          const netBasis = nontaxable - nqBasis
          if (netBasis > 0) {
            rmdNontaxableByOwner!.set(
              entry.ownerId,
              (rmdNontaxableByOwner!.get(entry.ownerId) ?? 0) + netBasis,
            )
          }
        }
        if (proRata === undefined) {
          // Zero aggregate basis: entire line-7 gross is ordinary income.
          noteForm8606Taxable(entry.ownerId, line7Gross, 'distributions')
          snapshotFromRmdSplit(line7Gross, 0)
          continue
        }
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
        if (publishCashFlow) {
          if (entry.occurrenceKind === 'ownedIraRmd') {
            snapshotFromRmdSplit(split.taxable, split.nontaxable)
          } else if (entry.occurrenceKind === 'automaticSeppDistribution') {
            seppNontaxableByAccountId!.set(
              entry.sourceAccountId,
              (seppNontaxableByAccountId!.get(entry.sourceAccountId) ?? 0) +
                split.nontaxable,
            )
          }
        }
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
    // Reporting copies taken before this walk adds Form 8606 taxable onto
    // the owner ordinary map. Leftover is already there; exclusion is the
    // post-offset remainder. Charged onto each draw after the statutory
    // excess, in this same order, so the cash-flow transfer matches the
    // ledger instead of re-deriving exclusion-first from owner totals.
    const legacyQcdLeftoverRemainingForCapture = publishCashFlow
      ? new Map(qcdOrdinaryBeyondRmdByOwner)
      : null
    const legacyQcdExclusionRemainingForCapture = publishCashFlow
      ? new Map(qcdExclusionBeyondRmdByOwner)
      : null
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
      let taxableFromExcess = 0
      if (nonQualified > 0) {
        legacyQcdExcessByOwner.set(entry.ownerId, remainingExcess - nonQualified)
        const proRata = iraProRata.get(entry.ownerId)
        if (proRata === undefined) {
          noteForm8606Taxable(entry.ownerId, nonQualified, 'distributions')
          qcdNonQualifiedOrdinaryIncome += nonQualified
          if (publishCashFlow) {
            qcdOrdinaryBeyondRmdByOwner!.set(
              entry.ownerId,
              (qcdOrdinaryBeyondRmdByOwner!.get(entry.ownerId) ?? 0) + nonQualified,
            )
          }
          taxableFromExcess = nonQualified
        } else {
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
          if (publishCashFlow && split.taxable > 0) {
            qcdOrdinaryBeyondRmdByOwner!.set(
              entry.ownerId,
              (qcdOrdinaryBeyondRmdByOwner!.get(entry.ownerId) ?? 0) + split.taxable,
            )
          }
          taxableFromExcess = split.taxable
        }
      }
      if (publishCashFlow && entry.amount > 0) {
        const leftoverRemaining = Math.max(
          0, legacyQcdLeftoverRemainingForCapture!.get(entry.ownerId) ?? 0,
        )
        const afterExcess = Math.max(0, entry.amount - nonQualified)
        const leftoverTake = Math.min(leftoverRemaining, afterExcess)
        legacyQcdLeftoverRemainingForCapture!.set(
          entry.ownerId, leftoverRemaining - leftoverTake,
        )
        const exclusionRemaining = Math.max(
          0, legacyQcdExclusionRemainingForCapture!.get(entry.ownerId) ?? 0,
        )
        const exclusionTake = Math.min(
          exclusionRemaining, afterExcess - leftoverTake,
        )
        legacyQcdExclusionRemainingForCapture!.set(
          entry.ownerId, exclusionRemaining - exclusionTake,
        )
        qcdBeyondRmdCharacterByOccurrence!.push({
          ownerId: entry.ownerId,
          sourceAccountId: entry.sourceAccountId,
          exclusion: exclusionTake,
          ordinary: leftoverTake + taxableFromExcess,
        })
      }
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
        const state = annualBalanceByAccountId.get(accountId)
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
      const openingBalances = rmdBalances
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
        const sourceAccountIds = rmdBalances
          .map((state) => state.account)
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
          const poolAccounts = rmdBalances
            .map((state) => state.account)
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
    /**
     * Observation-only: pre-60 Roth withdrawals that drew into assumed-seeded
     * contribution basis this attempt (owner pool key → withdrawal amount;
     * employer key → account withdrawal amount).
     */
    const ownedRothAssumedBasisConsequentialByOwner = new Map<string, number>()
    const employerRothAssumedBasisConsequentialByAccount = new Map<string, number>()
    let retirementActionExecution:
      AnnualOrdinaryWithdrawalBoundaryResult['execution']
    let retirementActionCash = 0
    let retirementActionEquityCompensation = 0
    let retirementActionProceeds = 0
    let retirementActionTaxableProceeds = 0
    let retirementActionCapitalGainOrLoss = 0
    if (currentYearOrdinaryExecutionActions.length > 0) {
      const ordinaryWithdrawalBoundary = annualOrdinaryWithdrawalBoundary({
        year,
        plan: passPlan,
        ordinaryActions: currentYearOrdinaryActions,
        executionRequests: currentYearOrdinaryExecutionActions,
        balances,
        taxUnit: annualActionTaxUnit,
        conversionLinkedWithdrawalGroups,
        actionPersonAliveEvidence,
      })
      retirementActionExecution = ordinaryWithdrawalBoundary.execution
      retirementActionCash = ordinaryWithdrawalBoundary.totals.cash
      retirementActionEquityCompensation =
        ordinaryWithdrawalBoundary.totals.equityCompensation
      retirementActionProceeds = ordinaryWithdrawalBoundary.totals.proceeds
      retirementActionTaxableProceeds =
        ordinaryWithdrawalBoundary.totals.taxableProceeds
      retirementActionCapitalGainOrLoss =
        ordinaryWithdrawalBoundary.totals.capitalGainOrLoss
      if (ordinaryWithdrawalBoundary.balanceOperations.length !== balances.length) {
        throw new Error('Ordinary-withdrawal balance operations lost cardinality')
      }
      for (const [index, operation] of
        ordinaryWithdrawalBoundary.balanceOperations.entries()) {
        if (operation.kind === 'none') continue
        const state = balances[index]
        if (state === undefined || state.account.id !== operation.accountId) {
          throw new Error('Ordinary-withdrawal balance operation lost its position')
        }
        if (operation.closingCostBasis !== null) {
          state.costBasis = operation.closingCostBasis
        }
        state.balance = operation.closingBalance
      }
    }
    const retirementActionOrdinaryIncome = retirementActionEquityCompensation

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
            if (ownedIraApplication.applicationKind === 'debit') {
              if (proRata !== undefined) {
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
              } else {
                noteForm8606Taxable(ownerId, move.amount, 'conversions')
              }
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
    const conversionSourceContextForOwner = (
      ownerPersonId: string,
    ): RothConversionSourceContext => {
      const person = personById.get(ownerPersonId)
      return {
        ownerAgeAttained: person !== undefined ? stateOf(ownerPersonId).ageAttained : 0,
        ownerRetirementAge: person?.retirementAge ?? null,
      }
    }
    const yearConvertibleToRoth = (
      account: Account,
    ): account is Extract<Account, { type: 'traditional' }> =>
      isConvertibleToRoth(
        account,
        conversionSourceContextForOwner(account.ownerPersonId ?? primary.id),
      )
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
      for (const state of rmdBalances) {
        if (!yearConvertibleToRoth(state.account) || remainingGross <= 0) continue
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
      for (const state of rmdBalances) {
        if (!yearConvertibleToRoth(state.account)) continue
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
        // the planner's private shadow of the aggregate ID-keyed balances,
        // after reserving any
        // deferred first-year RMD (Treas. Reg. 1.408A-4 A-6(b) requires that
        // amount to precede the conversion) and before anything below reduces
        // live `state.balance`.
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
        // Each selected ID retains its first Plan insertion position; that is
        // how this snapshot is built, but plain-object enumeration does not
        // promise that order for integer-like keys. Promotion reconstructs the
        // same selected-facts-per-ID view before joining. Consumers must not
        // join the raw Plan array, which can still contain physical aliases.
        aggregateRothConversionAllocationDesired = desired
        const plannedAllocation = annualAggregateRothConversionPlan({
          balances: annualIdKeyedBalances,
          iraRmdUnsatisfiedByOwner,
          desiredPlanDollars: desired,
          primaryPersonId: primary.id,
          fundingTolerancePlanDollars: EPSILON,
          sourceContextForOwner: conversionSourceContextForOwner,
        })
        aggregateRothConversionAllocationBalances =
          plannedAllocation.allocationBalances
        // Preserve the legacy temporary reservation's exact binary64
        // subtract/add round trip. The pure planner used private shadows, so
        // the caller alone mutates the live states, and restores them before
        // any conversion draw or publication below.
        const allocation = withAnnualAggregateRothConversionReservations(
          plannedAllocation.reservations,
          () => plannedAllocation.allocation,
        )
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
            let drawNontaxable = 0
            if (sourceAccount.kind === 'ira' &&
                ownedIraApplication?.applicationKind === 'debit') {
              const proRata = iraProRata.get(ownerId)
              if (proRata) {
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
                drawNontaxable = split.nontaxable
              } else {
                noteForm8606Taxable(ownerId, take, 'conversions')
              }
            }
            if (publishCashFlow) {
              aggregateConversionDraws!.push({
                sourceAccountId: sourceAccount.id,
                destinationAccountId: destinationAccount.id,
                ownerPersonId: ownerId,
                amount: take,
                nontaxable: drawNontaxable,
              })
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
            const gatedEmployerOwners = new Set<string>()
            for (const state of rmdBalances) {
              const account = state.account
              if (
                account.type !== 'traditional'
                || account.inherited !== undefined
                || account.kind !== 'employer'
                || state.balance <= 0
              ) continue
              const ownerId = account.ownerPersonId ?? primary.id
              if (yearConvertibleToRoth(account)) continue
              gatedEmployerOwners.add(personById.get(ownerId)?.name ?? ownerId)
            }
            if (gatedEmployerOwners.size > 0) {
              // Name the unused locked employer balance whenever it caused
              // the shortfall, including when an IRA filled only part of the
              // request. Silence on that unused balance reads as assent.
              for (const ownerName of gatedEmployerOwners) {
                warnings.add(
                  `${ownerName}’s employer-plan balance is not distributable this year ` +
                    `(no separation from service and under 59½), so that Roth conversion was skipped.`,
                )
              }
            } else {
              warnings.add('A requested Roth conversion exceeded the available traditional balance and was reduced.')
            }
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
    const coordinatedHecm = annualCoordinatedHecmEligibility({
      accounts: plan.accounts,
      hecmStates,
      anyAlive,
      year,
      startYear,
      priorYearPortfolioReturnPct,
    })

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
      for (const state of rmdBalances) {
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
          : splitAnnualIraDistribution(proRata, grossAmount)
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
      for (const state of rmdBalances) {
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
      for (const state of rmdBalances) {
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
      for (const state of rmdBalances) {
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
      const withdrawalPlan = planWithdrawals(
        need,
        rmdBalances,
        withdrawalStrategy,
        year,
        floorReserveNominal,
      )
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
      ) + rothEffect.penalty + hsaProbe.penalty + rmdShortfallExciseTax
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
    if (coordinatedHecm.capacity > EPSILON && spendingNeedBeforeTax > EPSILON) {
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
        const nextDraw = Math.min(coordinatedHecm.capacity, postCreditPreTaxNeed)
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
    for (const allocation of annualCoordinatedHecmAllocations({
      acceptedDraw: hecmDraw,
      propertyAccountIds: coordinatedHecm.propertyAccountIds,
      hecmStates,
    })) {
      const line = hecmStates.get(allocation.propertyAccountId)
      if (!line) continue
      line.loanBalance += allocation.amount
      hecmCoordinatedByProperty?.set(
        allocation.propertyAccountId,
        allocation.amount,
      )
    }
    // Any open HECM line backstops a true portfolio shortfall regardless of
    // draw policy — no borrower defaults on spending with credit available.
    // The policy only controls proactive (coordinated) draws above.
    let hecmShortfallDraw = 0
    if (withdrawalPlan.shortfall > EPSILON && anyAlive) {
      let remaining = withdrawalPlan.shortfall
      const visitedHecmLineIds = new Set<string>()
      for (const account of plan.accounts) {
        if (account.type !== 'property' || !account.hecm) continue
        if (visitedHecmLineIds.has(account.id)) continue
        visitedHecmLineIds.add(account.id)
        const line = hecmStates.get(account.id)
        if (!line) continue
        const draw = Math.min(remaining, Math.max(0, line.principalLimit - line.loanBalance))
        if (draw <= 0) continue
        line.loanBalance += draw
        hecmShortfallDraw += draw
        remaining -= draw
        hecmBackstopByProperty?.set(account.id, draw)
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
    if (publishCashFlow) {
      // Pass-local penalty snapshot at committed finals. Assemble does not
      // re-walk penaltiesFor / rothEarlyEffect / hsaEffect.
      for (const state of rmdBalances) {
        const taken = withdrawalPlan.byAccountId.get(state.account.id) ?? 0
        if (taken <= 0) continue
        const ownerId = state.account.ownerPersonId ?? primary.id
        const ownerAge = stateOf(ownerId).ageAttained
        if (state.account.type === 'traditional') {
          const penalizable = isAggregatedIraThisYear(state.account)
            ? iraCharacterFinal.taxableBySourceAccountId.get(state.account.id) ?? taken
            : taken
          const penaltyAccount =
            isTreatAsOwnEffective(state.account, year)
              ? { ...state.account, inherited: undefined }
              : state.account
          const amount =
            penalizable *
            traditionalWithdrawalPenaltyRate(penaltyAccount, {
              ownerAgeAttained: ownerAge,
              ownerRetirementAge: personById.get(ownerId)?.retirementAge ?? null,
            })
          if (amount > 0) {
            cashFlowPenaltyLines!.push({
              attribution: 'account',
              accountId: state.account.id,
              penaltyClass: 'traditionalEarly',
              amount,
            })
          }
        }
      }
      let hsaCapLeft = hsaQualifiedCap
      for (const state of rmdBalances) {
        if (state.account.type !== 'hsa') continue
        const taken = withdrawalPlan.byAccountId.get(state.account.id) ?? 0
        if (taken <= 0) continue
        const ownerAge = stateOf(state.account.ownerPersonId ?? primary.id).ageAttained
        const treatment = state.account.withdrawalTreatment
        let amount: number
        if (treatment === 'capByMedicalExpenses') {
          const qualified = Math.min(taken, hsaCapLeft)
          hsaCapLeft -= qualified
          const nonqualifiedOrdinary = taken - qualified
          if (nonqualifiedOrdinary > 0) {
            hsaNonqualifiedOrdinaryByAccountId!.set(state.account.id, nonqualifiedOrdinary)
          }
          amount = nonqualifiedOrdinary * hsaNonQualifiedPenaltyRate(ownerAge)
        } else if (treatment === 'assumeAllQualified') {
          amount = 0
        } else {
          amount = taken * hsaNonQualifiedPenaltyRate(ownerAge)
        }
        if (amount > 0) {
          cashFlowPenaltyLines!.push({
            attribution: 'account',
            accountId: state.account.id,
            penaltyClass: 'hsaNonMedical',
            amount,
          })
        }
      }
      for (const [key, { taken, age }] of rothPoolWithdrawals(withdrawalPlan.byAccountId)) {
        const rb = rothBasis.get(key)
        if (!rb) continue
        const split = splitRothWithdrawal(rb, taken, year, age)
        if (key.startsWith('rothira:')) {
          const personId = key.slice('rothira:'.length)
          if (split.penalty > 0) {
            cashFlowPenaltyLines!.push({
              attribution: 'rothPool',
              personId,
              penaltyClass: 'rothEarly',
              amount: split.penalty,
            })
          }
          if (split.taxableOrdinary > 0) {
            rothPoolTaxableOrdinaryByPersonId!.set(personId, split.taxableOrdinary)
          }
        } else if (key.startsWith('roth:')) {
          const accountId = key.slice('roth:'.length)
          if (split.penalty > 0) {
            cashFlowPenaltyLines!.push({
              attribution: 'account',
              accountId,
              penaltyClass: 'rothEarly',
              amount: split.penalty,
            })
          }
          if (split.taxableOrdinary > 0) {
            employerRothTaxableOrdinaryByAccountId!.set(accountId, split.taxableOrdinary)
          }
        }
      }
    }
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
    // Capture the input + detail for planning surfaces; do not recompute later.
    const advisoryFederalTaxInput: TaxYearInput = {
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
    }
    const federalDetail = computeFederalTax(advisoryFederalTaxInput)
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
            .map((person, position) => ({
              person,
              months: marketplaceMonthsByPersonPosition[position]!,
            }))
            .filter(({ person, months }) =>
              person.alive && months > 0 && pre65MonthlyPremiumPerPerson > 0)
            .map(({ person, months }) => {
              const premium = pre65MonthlyPremiumPerPerson * healthInflFactor
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
      // Bucket by inherited vs owned only (same rule as `optimizerOpeningBuckets`):
      // S2 treat-as-own stays inherited-traditional for the whole LP horizon.
      // Post-flip owner-RMD obligation shares remap into the inherited forced
      // flow below so the LP's static inheritedTraditional bucket sees
      // consistent floors; YearResult.rmd / inherited* fields are unchanged.
      let startTraditional = 0
      let startInheritedTraditional = 0
      for (const state of rmdBalances) {
        if (state.account.type !== 'traditional') continue
        const opening = startOfYearBalance.get(state.account.id) ?? 0
        if (!state.account.inherited) {
          startTraditional += opening
        } else {
          startInheritedTraditional += opening
        }
      }
      // S2 post-flip: accounts in the inheritedTraditional opening bucket
      // whose owner-RMD obligation executed this year after the flip. Remap the
      // obligation share — not the account-keyed executed debit, which can
      // include IRA sweep from another account — into the probe's inherited
      // forced flow only (ledger YearResult fields stay on the owner-RMD path).
      let s2FlipOwnerRmdObligationRemap = 0
      let s2FlipOwnerRmdObligationRemapTaxable = 0
      let s2FlipOwnerRmdObligationRemapNontaxable = 0
      const ownerRmdNontaxableFraction =
        rmdTotal > 0 ? rmdNontaxable / rmdTotal : 0
      for (const state of rmdBalances) {
        if (state.account.type !== 'traditional') continue
        if (!hasSpouseTreatAsOwnElection(state.account)) continue
        if (!isTreatAsOwnEffective(state.account, year)) continue
        const obligation = rmdObligationByAccount.get(state.account.id) ?? 0
        if (obligation <= 0 || planDollarsMoveNoLedgerCent(obligation)) continue
        // Pro-rata attribution: each remapped obligation dollar carries the
        // same nontaxable share as the year's aggregate owner-RMD gross.
        const shareNontaxable = obligation * ownerRmdNontaxableFraction
        s2FlipOwnerRmdObligationRemap += obligation
        s2FlipOwnerRmdObligationRemapTaxable += obligation - shareNontaxable
        s2FlipOwnerRmdObligationRemapNontaxable += shareNontaxable
      }
      const probeRmd = Math.max(0, rmdTotal - s2FlipOwnerRmdObligationRemap)
      // GROSS remapped obligation — the LP's `wi` is cash, bucket debit, and
      // income at coefficient 1 (optimizer.ts cash / inh recursion / tifloor),
      // so netting Form 8606 basis here understates spendable cash and
      // inherited-bucket depletion. Basis rides the income side only, through
      // `forcedDistributionOrdinaryIncomeExclusion` (S2 nontaxable share) and
      // the owned-RMD `probeRmdTaxable` pathway.
      const probeInheritedDistribution =
        inheritedOrdinaryIncome + s2FlipOwnerRmdObligationRemap
      const rmdTaxableTotal = Math.max(0, rmdTotal - rmdNontaxable)
      const probeRmdTaxable = Math.max(
        0,
        rmdTaxableTotal - s2FlipOwnerRmdObligationRemapTaxable,
      )
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
        ) + s2FlipOwnerRmdObligationRemapNontaxable,
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
            (probeRmdTaxable - optimizerForcedDistributionOrdinaryExclusion) -
            inheritedOrdinaryIncome -
            s2FlipOwnerRmdObligationRemap,
        ) + taxableSs
      // Deliberate conservative MILP boundary: the linear optimizer does not
      // model a signed capital-loss pool, so it never receives a negative base.
      // Candidate schedules are still repriced authoritatively by this exact
      // ledger, which preserves the signed result and carryforward.
      const optimizerCapitalGainsBase =
        Math.max(0, preWithdrawalCapitalResult) + incomes.qualifiedDividends
      let optimizerOwnerTraditionalWithdrawal = 0
      for (const state of rmdBalances) {
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
      for (const state of rmdBalances) {
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
        if (yearConvertibleToRoth(state.account)) {
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
        // Probe-only remap: post-flip S2 owner-RMD obligation shares ride the
        // inherited forced flow so the LP's static inheritedTraditional bucket
        // stays consistent (see comment at startTraditional). YearResult.rmd is
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
        // Includes post-flip S2 owner-RMD obligation shares remapped above at
        // GROSS (probe only); basis is netted on the income side via
        // `forcedDistributionOrdinaryIncomeExclusion`.
        inheritedDistribution: probeInheritedDistribution,
        startInheritedTraditional,
        peopleAged65Plus,
        ssa44IrmaaRedetermination: ssa44ActiveInYear(year),
      }
    }

    // --- apply flows -------------------------------------------------------
    // Publish replacement inherited-evidence rows with voluntary amounts
    // (planner draws beyond the forced requirement this year). The helper
    // snapshot and each replacement are frozen; this draft array changes only
    // by replacing a slot, never by mutating a published evidence object.
    // Forced already reduced the balance, so the need-based plan is
    // voluntary-only for each still-inherited account.
    // S2 POST-FLIP rows keep voluntaryAmount 0: owner-side draws are not
    // inherited voluntary draws (the flip already moved the account out of
    // the inherited schedule). The helper builds the last-wins account lookup
    // once per year so evidence rows do not scan every balance.
    const withdrawalApplyFlowPlan = annualWithdrawalApplyFlowPlan({
      year,
      balances: annualIdKeyedBalances,
      inheritedEvidence: inheritedYearEvidenceDraft,
      withdrawnByAccountId: withdrawalPlan.byAccountId,
      taxableSales: withdrawalPlan.taxableSales,
      recordsOwnedIraApplicationFor: isAggregatedIraThisYear,
    })
    for (const write of withdrawalApplyFlowPlan.evidenceWrites) {
      const evidence = inheritedYearEvidenceDraft[write.evidenceIndex]
      if (evidence === undefined || evidence.accountId !== write.accountId) {
        throw new Error(
          'Withdrawal apply-flow evidence operation lost its row position',
        )
      }
      inheritedYearEvidenceDraft[write.evidenceIndex] = Object.freeze({
        ...evidence,
        voluntaryAmount: write.voluntaryAmount,
      })
    }
    for (const operation of withdrawalApplyFlowPlan.balanceOperations) {
      const state = annualIdKeyedBalances[operation.balanceIndex]
      const group = annualLogicalBalanceLedger.groups[operation.balanceIndex]
      // Planning and commit are intentionally adjacent. Fail before applying a
      // stale operation if a future change breaks the logical group boundary.
      if (
        state === undefined ||
        group === undefined ||
        state.account.id !== operation.accountId ||
        group.id !== operation.accountId ||
        state.balance !== operation.sourceBalanceBefore
      ) {
        throw new Error(
          'Withdrawal apply-flow operation lost its balance position',
        )
      }
      const taken = operation.taken
      // No sub-cent discharge here. A traditional draw the exact-cent ledger
      // records as zero never reaches this loop: `planWithdrawals` refuses to
      // allocate one, so the year's published traditional total, its ordinary
      // income and this movement are all derived from the same plan and cannot
      // disagree about whether the draw happened. Discharging here instead
      // would move the balance and leave the total claiming a withdrawal with
      // no occurrence to explain it.
      const sourceBalanceBefore = state.balance
      let ownedIraProducerOccurrenceKey: string | null = null
      if (operation.recordsTraditionalRuntimeOccurrence) {
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
        if (operation.recordsOwnedIraApplication) {
          ownedIraProducerOccurrenceKey = producerOccurrenceKey
        }
      }
      if (operation.taxableSaleMissing) {
        throw new Error('Planned taxable sale disappeared before commit')
      }
      group.applyClosingSnapshot({
        balance: operation.sourceBalanceAfter,
        ...(operation.costBasisAfter === null
          ? {}
          : { costBasis: operation.costBasisAfter }),
      })
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
    // aggregated Roth IRAs. Also annotate assumed-seed consumption (observation
    // only — does not change the split economics). Flag only when the spill into
    // assumed seed exceeds free-cover capacity at this moment (FIFO prefix of
    // seasoned conversion principal + wholly nontaxable unseasoned principal;
    // stops at the first unseasoned taxable layer).
    for (const [key, { taken, age }] of rothPoolWithdrawals(withdrawalPlan.byAccountId)) {
      const rb = rothBasis.get(key)
      if (!rb) continue
      const split = splitRothWithdrawal(rb, taken, year, age)
      const assumedRemaining = rothAssumedContributionRemaining.get(key) ?? 0
      // Known contribution basis (supplied seed + credits) is consumed first;
      // only the residual draw into the assumed seed is a candidate spill.
      let fromAssumed = 0
      if (split.contributions > 0 && assumedRemaining > 0) {
        const knownContribution = Math.max(0, rb.contributionBasis - assumedRemaining)
        fromAssumed = Math.max(0, split.contributions - knownContribution)
        if (fromAssumed > 0) {
          rothAssumedContributionRemaining.set(
            key,
            Math.max(0, assumedRemaining - fromAssumed),
          )
        }
      }
      // Counterfactual conversion-principal tracker stays live for the pool's
      // remaining pre-60 draws even after the assumed seed is fully spent. An
      // early draw that re-homes assumed seed into free cover *or* unseasoned
      // taxable principal (and free layers behind it) consumes those layers in
      // the assumed-zero world; a later free-conversion take must evaluate
      // against that CF residual, not live free cover alone.
      if (age < ROTH_QUALIFIED_AGE && taken > 0) {
        const priorCfConversionExtra =
          rothCounterfactualFreeCoverConsumed.get(key) ?? 0
        if (fromAssumed > 0 || priorCfConversionExtra > 0) {
          // 1) Materialize CF layer state from PRE-DRAW layers with prior debt
          // applied first — never charge prior debt against split.next after the
          // live conversion take. Applying debt after can erase real CF
          // difference (e.g. $50 prior seed debt then $100 seasoned conversion
          // take: live residual is empty so post-draw debt is a no-op, hiding
          // that CF only had $50 principal for the shared conversion).
          // 2) Price fully ordered draws on BOTH sides with the same FIFO walk
          //    as splitRothWithdrawal — live conversion amount against live
          //    layers, CF amount (conversion + assumed seed, which is free
          //    contribution live) against debt-adjusted CF layers. Do NOT walk
          //    the live free-prefix length from the CF head (that misattributes
          //    free dollars onto CF mixed layers). Character-wise CF-vs-live
          //    gaps (earnings / unseasoned taxable) are tracked both ways: a
          //    consequence in either direction (supplying the omitted seed
          //    would CHANGE character up or down) is a verdict. One-way
          //    Math.max discarded the live-more path; L1 abs of both
          //    characters double-counts pure recharacterization.
          // 3) Reconcile the tracker: CF principal this walk consumed minus the
          //    live conversion take from the split (per-layer FIFO figures).
          //    Seed re-homing raises debt; live catch-up on principal CF already
          //    spent lowers it. Increment-only left stale debt after live
          //    consumed the same layers (e.g. $50 seed / $25 principal → $25
          //    debt, then live takes that $25 conversion: both worlds spent it).
          const cfLayers = applyConversionPrincipalDebt(
            rb.conversionLayers,
            priorCfConversionExtra,
          )
          // Shallow copy: the walk only reads layers; zero-debt returns the
          // live array itself, so the spread keeps the state type mutable
          // without per-object cloning on this hot path.
          const cfState = { contributionBasis: 0, conversionLayers: [...cfLayers] }
          const liveState = {
            contributionBasis: 0,
            conversionLayers: rb.conversionLayers,
          }
          // Mirror splitRothWithdrawal per-layer consumption on both sides.
          const liveWalk = assumedSeedConsequentialSpill(
            liveState,
            split.conversions,
            year,
            age,
            0,
          )
          const cfWalk = assumedSeedConsequentialSpill(
            cfState,
            split.conversions + fromAssumed,
            year,
            age,
            0,
          )
          // Both directions: CF-over-live and live-over-CF character gaps.
          // Verdict magnitude is the larger one-way gap (not L1 sum).
          const cfOverLive =
            Math.max(0, cfWalk.earningsSpill - liveWalk.earningsSpill) +
            Math.max(0, cfWalk.unseasonedTaxableSpill - liveWalk.unseasonedTaxableSpill)
          const liveOverCf =
            Math.max(0, liveWalk.earningsSpill - cfWalk.earningsSpill) +
            Math.max(
              0,
              liveWalk.unseasonedTaxableSpill - cfWalk.unseasonedTaxableSpill,
            )
          const consequentialSpill = Math.max(cfOverLive, liveOverCf)
          // CF-extra principal outstanding = prior extra + CF principal this
          // draw consumed − live conversion principal this draw (split figure).
          // Equivalent to seed-only debt when CF still has residual for the
          // shared conversion; reduces when live catch-up exceeds new CF spend.
          const nextCfConversionExtra = Math.max(
            0,
            priorCfConversionExtra +
              cfWalk.conversionPrincipalConsumed -
              split.conversions,
          )
          if (nextCfConversionExtra > 0) {
            rothCounterfactualFreeCoverConsumed.set(key, nextCfConversionExtra)
          } else {
            rothCounterfactualFreeCoverConsumed.delete(key)
          }
          if (consequentialSpill > 0) {
            if (key.startsWith('rothira:')) {
              const ownerPersonId = key.slice('rothira:'.length)
              ownedRothAssumedBasisConsequentialByOwner.set(
                ownerPersonId,
                (ownedRothAssumedBasisConsequentialByOwner.get(ownerPersonId) ?? 0) +
                  consequentialSpill,
              )
            } else if (key.startsWith('roth:')) {
              const accountId = key.slice('roth:'.length)
              employerRothAssumedBasisConsequentialByAccount.set(
                accountId,
                (employerRothAssumedBasisConsequentialByAccount.get(accountId) ?? 0) +
                  consequentialSpill,
              )
            }
          }
        }
      }
      rothBasis.set(key, split.next)
    }
    // Commit the year's Form-8606 IRA basis depletion from need-based draws
    // (RMD/SEPP/conversion basis already committed above as they happened).
    // The assumed-basis verdict reads the executed character that priced
    // tax/penalty (`iraCharacterFinal`); basis carryforward still depletes via
    // the same pro-rata state the year's forced draws already opened.
    {
      const needBasedTakenByOwner = new Map<string, number>()
      for (const state of rmdBalances) {
        if (!isAggregatedIraThisYear(state.account)) continue
        const taken = withdrawalPlan.byAccountId.get(state.account.id) ?? 0
        if (taken <= 0) continue
        const ownerId = state.account.ownerPersonId ?? primary.id
        needBasedTakenByOwner.set(
          ownerId,
          (needBasedTakenByOwner.get(ownerId) ?? 0) + taken,
        )
      }
      for (const [ownerId, taken] of needBasedTakenByOwner) {
        let executedTaxable = 0
        for (const state of rmdBalances) {
          if (!isAggregatedIraThisYear(state.account)) continue
          if ((state.account.ownerPersonId ?? primary.id) !== ownerId) continue
          const accountTaken = withdrawalPlan.byAccountId.get(state.account.id) ?? 0
          if (accountTaken <= 0) continue
          executedTaxable +=
            iraCharacterFinal.taxableBySourceAccountId.get(state.account.id) ??
            accountTaken
        }
        // Verdict: observe the character actually used for tax/penalty.
        noteForm8606Taxable(ownerId, executedTaxable, 'distributions')
        const proRata = iraProRata.get(ownerId)
        if (proRata === undefined) continue
        const split = splitAnnualIraDistribution(proRata, taken)
        iraBasisByOwner.set(ownerId, split.next.basis)
      }
      // Owners with open pro-rata but no need-based draw still need basis
      // carried forward (already in iraProRata / iraBasisByOwner from prior
      // commits). Sync remaining basis for pro-rata owners that had no need-
      // based take above.
      for (const [ownerId, proRata] of iraProRata) {
        if (needBasedTakenByOwner.has(ownerId)) continue
        iraBasisByOwner.set(ownerId, proRata.basis)
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
    // The phase itself lives in `internal/propertyEventsAndGrowth.ts`. It owns
    // the growth, the legacy tax-free sale and the line accrual; this loop owns
    // every write, applied per row in the same statement order the inlined
    // phase used (close the line, deposit, publish, write the value back, then
    // compound what is left open). `plan.accounts` order is load-bearing three
    // ways at once — deposit order, value compounding, and whether a same-id
    // line accrues before a later row closes it. The helper carries a private
    // numeric shadow of both maps, plus an accrued-id set so each actual HECM
    // line receives its annual multiplier exactly once.
    for (const row of propertyEventsAndGrowth({
      accounts: plan.accounts,
      year,
      propertyValues,
      inflRateAt,
      hecmStates,
      // Gated on the ARRAY this payload feeds, which is what the inlined phase
      // gated on: it built its literal inside `legacyPropertySaleDeposits?.push(
      // { … })`. Both are assigned in the same `if (publishCashFlow)` block, so
      // this is a no-op today; writing it this way makes the payload's laziness
      // hold by construction rather than by that coincidence.
      surplusDestination: legacyPropertySaleDeposits === null ? null : surplusDestination,
    })) {
      if (row.closesHecmForAccountId !== null) hecmStates.delete(row.closesHecmForAccountId)
      if (row.deposit !== null) deposit(row.deposit)
      if (row.record !== null) legacyPropertySaleDeposits?.push(row.record)
      propertyValues.set(row.propertyAccountId, row.value)
      if (row.hecmGrowth !== null) {
        const line = hecmStates.get(row.propertyAccountId)!
        line.principalLimit *= row.hecmGrowth
        line.loanBalance *= row.hecmGrowth
      }
    }

    // --- insurance: permanent-life cash value + death benefit --------------
    const permanentLife = annualPermanentLifeTransitions({
      policies: plan.insurance,
      insuranceCashValues,
      resolveInsured: (personId) => {
        const insured = personById.get(personId)
        return insured === undefined
          ? null
          : {
              deathAge: lifeAgeOf(insured),
              ageAttained: stateOf(personId).ageAttained,
            }
      },
    })
    const deathBenefitPaid = permanentLife.deathBenefitPaid
    for (const transition of permanentLife.transitions) {
      if (transition.payout !== null) {
        deposit(transition.payout)
        if (transition.payout > 0) {
          deathBenefits?.push({
            policyId: transition.policyId,
            insuredPersonId: transition.insuredPersonId,
            amount: transition.payout,
            destination: surplusDestination!,
          })
        }
      }
      insuranceCashValues.set(transition.policyId, transition.cashValue)
    }

    const ownedNonRothIraBalancesBeforeGrowth = Object.freeze(
      Object.fromEntries(
        annualIdKeyedBalances
          .filter((state) => isAggregatedIraThisYear(state.account))
          .map((state) => [state.account.id, state.balance]),
      ),
    )
    const ownedNonRothIraPhysicalBalancesBeforeGrowth = Object.freeze(
      balances.flatMap((state, balanceIndex) =>
        isAggregatedIraThisYear(state.account)
          ? [Object.freeze({
              sourceAccountId: state.account.id,
              balanceIndex,
              balancePlanDollars: state.balance,
            })]
          : []),
    )
    const ownedNonRothIraPhysicalOpeningBalances = Object.freeze(
      balances.flatMap((state, balanceIndex) =>
        isAggregatedIraThisYear(state.account)
          ? [Object.freeze({
              sourceAccountId: state.account.id,
              balanceIndex,
              balancePlanDollars: startOfYearPositionalBalances[balanceIndex]!,
            })]
          : []),
    )

    const accountGrowth = annualPostSolveAccountGrowth({
      states: balances,
      allocationTrack,
      distributedYieldByBalanceIndex,
      classParams,
      defaultReturnPct: plan.assumptions.defaultReturnPct,
      shockPct: returnShockAt(year),
      year,
      classShockAt,
    })
    // Wealth-weighted total return the ledger actually applies this year
    // (including distributed yield — interest, dividends, and tax-exempt
    // interest; a distribution, not a loss). Next year's coordinated HECM
    // check reads it, so the down-market signal is the realized portfolio
    // return, not the raw additive shock. The coordinator returns exactly one
    // positional row per physical balance; the caller commits every market
    // balance and drifted weight before publishing that signal, then commits
    // reinvestment in the original second pass below.
    for (let balanceIndex = 0; balanceIndex < balances.length; balanceIndex++) {
      const row = accountGrowth.rows[balanceIndex]!
      const state = balances[balanceIndex]!
      state.balance = row.marketClosingBalance
      if (row.kind === 'allocated') {
        allocationTrack.get(String(balanceIndex))!.weights = row.driftedWeights
      }
    }
    priorYearPortfolioReturnPct = accountGrowth.priorYearPortfolioReturnPct

    // Distributed yield is credited only after every account's market growth.
    // Reinvestment is not growth and adds basis only to the taxable physical
    // row whose earlier yield calculation produced it.
    for (let balanceIndex = 0; balanceIndex < balances.length; balanceIndex++) {
      const row = accountGrowth.rows[balanceIndex]!
      if (row.reinvestedYield <= 0) continue
      const state = balances[balanceIndex]!
      state.balance += row.reinvestedYield
      if (state.account.type === 'taxable') state.costBasis += row.reinvestedYield
    }

    const ownedNonRothIraBalancesByOwner = new Map<
      string | null,
      Array<{ sourceAccountId: string; balanceIndex: number; balancePlanDollars: number }>
    >()
    for (const [balanceIndex, state] of balances.entries()) {
      if (!isAggregatedIraThisYear(state.account)) continue
      // A validated Plan always supplies an owner here. Preserve null on a
      // malformed direct simulatePlan call so this raw, not-yet-validated
      // source never invents ownership that later replay could mistake as fact.
      const ownerPersonId = state.account.ownerPersonId
      const accountBalances = ownedNonRothIraBalancesByOwner.get(ownerPersonId) ?? []
      accountBalances.push({
        sourceAccountId: state.account.id,
        balanceIndex,
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
                  ) || left.balanceIndex - right.balanceIndex,
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
    const {
      balanceRecord,
      investableTotal,
      propertyTotal,
      debtTotal,
      hecmLoanTotal,
      hecmEffectiveDebt,
      insuranceCashValueTotal,
    } = annualSnapshot({
      balances,
      publishedBalances: annualIdKeyedBalances,
      unassignedCash,
      propertyValues,
      debtBalances,
      hecmStates,
      insuranceCashValues,
    })

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

    // --- per-entity published facts (insight one-source-of-truth channel) ---
    // Only assumed-basis consequential verdicts are published on these rows —
    // every remaining member has a production consumer (missingDataBasis).
    const {
      ownedRothIraPoolActivity,
      employerRothAccountActivity,
      ownedTraditionalIraAggregateActivity,
    } = publishedEntityFacts({
      accounts: plan.accounts,
      primaryPersonId: primary.id,
      ownedRothAssumedBasisConsequentialByOwner,
      employerRothAssumedBasisConsequentialByAccount,
      form8606ConsequentialByOwner,
    })

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
      ownedNonRothIraPhysicalBalancesBeforeGrowth,
      ownedNonRothIraPhysicalOpeningBalances,
      ownedRothIraPoolActivity,
      employerRothAccountActivity,
      ownedTraditionalIraAggregateActivity,
      qualifiedAnnuityPayments,
      socialSecurityStreams,
      employerMatch,
      rmd: rmdTotal,
      rmdShortfallExciseTax,
      rmdShortfallExciseDetails: rmdShortfallExciseResults,
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
      irmaaLookbackMagi: irmaaMagi,
      irmaaLookbackMagiSource,
      irmaaLookbackMagiYear,
      irmaaNextTierThreshold,
      advisoryFederalTax: { input: advisoryFederalTaxInput, detail: federalDetail },
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
      ...(publishCashFlow
        ? {
            cashFlow: assembleYearCashFlow({
              yearSites: yearSites!,
              passLocals: {
                seppByAccountId: seppByAccountId!,
                hecmCoordinatedByProperty: hecmCoordinatedByProperty!,
                hecmBackstopByProperty: hecmBackstopByProperty!,
                annuityBasisReturnByAccountId: annuityBasisReturnByAccountId!,
                rmdNontaxableByOwner: rmdNontaxableByOwner!,
                seppNontaxableByAccountId: seppNontaxableByAccountId!,
                penaltyLines: cashFlowPenaltyLines!,
                rothPoolTaxableOrdinaryByPersonId: rothPoolTaxableOrdinaryByPersonId!,
                legacyPropertySaleDeposits: legacyPropertySaleDeposits!,
                deathBenefits: deathBenefits!,
                surplusDestination: surplusDestination!,
                qcdExclusionFromRmdByOwner: qcdExclusionFromRmdByOwner!,
                qcdExclusionBeyondRmdByOwner: qcdExclusionBeyondRmdByOwner!,
                qcdOrdinaryBeyondRmdByOwner: qcdOrdinaryBeyondRmdByOwner!,
                qcdBeyondRmdCharacterByOccurrence: qcdBeyondRmdCharacterByOccurrence!,
                qcdOrdinaryFromRmdByOwner: qcdOrdinaryFromRmdByOwner!,
                qcdBasisFromRmdByOwner: qcdBasisFromRmdByOwner!,
                hsaNonqualifiedOrdinaryByAccountId: hsaNonqualifiedOrdinaryByAccountId!,
                employerRothTaxableOrdinaryByAccountId: employerRothTaxableOrdinaryByAccountId!,
              },
              socialSecurityStreams,
              rmdTakeByAccount,
              ownedIraRmdGrossByOwner,
              qcdFromRmdByOwner,
              qcdGrossByOwner,
              deferredLegacyQcdDistributions,
              employerPlanAccountIds: new Set(
                plan.accounts.flatMap((account) =>
                  account.type === 'traditional' && account.kind !== 'ira' ? [account.id] : [],
                ),
              ),
              inheritedTraditionalAccountIds: new Set(
                plan.accounts.flatMap((account) =>
                  account.type === 'traditional' && account.inherited !== undefined
                    ? [account.id]
                    : [],
                ),
              ),
              withdrawalPlanByAccountId: withdrawalPlan.byAccountId,
              withdrawalPlanTaxableSales: withdrawalPlan.taxableSales,
              iraCharacterFinal,
              inheritedYearEvidence: inheritedYearEvidenceDraft,
              retirementActionExecution,
              rothConversionActionExecution,
              qcdActionExecution,
              namedRothConversionExecuted,
              namedRothConversionNontaxable,
              conversionNontaxable,
              rothConversion,
              aggregateConversionDraws: aggregateConversionDraws!,
              distributedYieldByAccountId,
              ownerPersonIdByAccountId: new Map(
                plan.accounts.map((account) => [
                  account.id,
                  'ownerPersonId' in account ? account.ownerPersonId ?? null : null,
                ]),
              ),
              employerAllocationByOwner,
              yearTaxExemptInterest,
              generatedTaxExemptInterest,
              acaForeignExclusionAddback,
              incomesTotal: incomes.total,
              taxableYieldReinvested,
              propertySaleProceedsTotal,
              rmdTotal,
              seppTotal,
              inheritedTotal,
              needBasedWithdrawalTotal: withdrawalPlan.byCategory.total,
              retirementActionProceeds,
              hecmDraw,
              hecmShortfallDraw,
              tax,
              penalties,
              contributionsTotal: contributions,
              collidingEncodedProducerSegments,
              employerMatchTotal: employerMatch,
              surplus,
              requiredLifestyle,
              targetLifestyle,
              targetLifestyleFunded,
              idealLifestyle,
              idealLifestyleFunded,
              excessLifestyle,
              excessLifestyleFunded,
              healthcare,
              shortfallAfterHecm,
            }),
          }
        : {}),
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
      rothAssumedContributionRemaining,
      rothCounterfactualFreeCoverConsumed,
      propertyValues,
      hecmStates,
      insuranceCashValues,
      allocationTrack,
      seppAmortAmount,
      magiHistory,
      deferredFirstRmdByApplicablePlan,
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
    const settlementOpeningByAccount = new Map<Account, number>(
      balances.map((state, balanceIndex) => [
        state.account,
        startOfYearPositionalBalances[balanceIndex]!,
      ]),
    )
    // Seed nondeductible basis with the same year-aware aggregation the ledger
    // uses inside the pass (`isAggregatedIraThisYear`), so an S2-flipped
    // account is in the settlement pool the same way it is in the live
    // Form-8606 denominator. Inlined here because the helper is pass-scoped.
    const isAggregatedIraForSettlementYear = (
      account: Account,
    ): account is TraditionalAccount => {
      if (account.type !== 'traditional' || account.kind !== 'ira') return false
      if (account.inherited === undefined) return true
      if (!isTreatAsOwnEffective(account, year)) return false
      // §1.408-8(c)(3): same-year death flip — owner aggregation begins the
      // following year (mirrors pass-scoped `isAggregatedIraThisYear`).
      if (year === account.inherited.ownerDeathYear) return false
      return true
    }
    const annualSettlementPlan: Plan = {
      ...plan,
      accounts: plan.accounts.map((account): Account => {
        const openingBalance = settlementOpeningByAccount.get(account)
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
            captureAnnualCashFlow,
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
          const optimizerEvidenceAccountById = new Map(
            plan.accounts.map((account) => [account.id, account] as const),
          )
          const weightedTaxableFraction = (
            eligible: (account: Account) => boolean,
          ): number | null => {
            let gross = 0
            let taxable = 0
            for (const account of optimizerEvidenceAccountById.values()) {
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
          const conversionFraction = weightedTaxableFraction((account) =>
            isConvertibleToRoth(
              account,
              rothConversionSourceContextForPerson(
                personById.get(account.ownerPersonId ?? primary.id),
                year,
              ),
            ),
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
          captureAnnualCashFlow,
        )
      }
    } else {
      const permission = linkedGroupPermissionForAttempt([])
      settledAnnualPass = runPostContributionAnnualPass(
        [],
        undefined,
        permission.baseline,
        permission.release,
        captureAnnualCashFlow,
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
