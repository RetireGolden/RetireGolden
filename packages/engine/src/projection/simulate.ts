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
import { packForYear, EMBEDDED_REAL_YIELD_CURVE } from '../params/index.js'
import { indexingScaleFor } from '../params/indexingScale.js'
import type { AnnualCashFlowPenaltySnapshot } from './annualCashFlowCapture.js'
import {
  collidingEncodedCashFlowSegments,
  collectPlanCashFlowProducerIds,
} from './annualCashFlowIds.js'
import {
  createAnnualCashFlowYearSites,
  type SealableAnnualCashFlowYearSites,
} from './annualCashFlowYearSites.js'
import { buildLadder } from '../ladder/ladderMath.js'
import { annualInsurancePremiumRows } from './internal/annualInsurancePremiumRows.js'
import { annualLifestyleLayers } from './internal/annualLifestyleLayers.js'
import {
  AnnualLogicalBalanceLedger,
  type PhysicalBalanceState,
} from './internal/annualLogicalBalanceLedger.js'
import { annualRebalanceToTarget } from './internal/annualRebalanceToTarget.js'
import { annualAnnuityPurchaseFunding } from './internal/annualAnnuityPurchaseFunding.js'
import { annualPropertyCarryingCosts } from './internal/annualPropertyCarryingCosts.js'
import { annualSocialSecurity } from './internal/annualSocialSecurity.js'
import { annualExpenseSummary } from './internal/annualExpenseSummary.js'
import {
  annualContributionsAndEmployerMatch,
  type AnnualContributionAndMatchOperation,
  type AnnualContributionAndMatchOperationIdentity,
  type AnnualContributionsAndEmployerMatchResult,
} from './internal/annualContributionsAndEmployerMatch.js'
import { annualForcedDistributionQcdAndRetirementActionsPhase } from
  './internal/annualForcedDistributionQcdAndRetirementActionsPhase.js'
import { annualAggregateRothConversionPhase } from './internal/annualAggregateRothConversionPhase.js'
import { annualRothBasisPoolKey } from './internal/annualRothBasisPoolKey.js'
import {
  annualFundingApplicationAndClosePhase,
  type AnnualFundingApplicationAndClosePhaseScalars,
} from './internal/annualFundingApplicationAndClosePhase.js'
import {
  annualOwnedNonRothIraSettlementPhase,
  type AnnualOwnedNonRothIraSettlementPhaseLedger,
  type AnnualOwnedNonRothIraSettlementPhaseScalars,
} from './internal/annualOwnedNonRothIraSettlementPhase.js'
import type { PhaseLedgerScalarBindings } from './internal/phaseLedgerScalars.js'
import { annualIncomeSetup } from './internal/annualIncomeSetup.js'
import { annualPensionAndAnnuityIncome } from './internal/annualPensionAndAnnuityIncome.js'
import {
  annualDebtServiceRows,
  annualLongTermCarePlan,
} from './internal/annualDebtAndLongTermCare.js'
import { annualGuardrailFundingPlan } from './internal/annualGuardrailFunding.js'
import { annualHealthcareExpenses } from './internal/annualHealthcareExpenses.js'
import { hecmLineOpenings } from './internal/hecmLineOpenings.js'
import { pensionLumpSumRollovers } from './internal/pensionLumpSumRollovers.js'
import { tipsLadderAnnualCashFlows, type TipsLadderState } from './internal/tipsLadderAnnualCashFlow.js'
import { tipsLadderPurchaseFunding } from './internal/tipsLadderPurchaseFunding.js'
import { fixedAssetDispositions } from './internal/fixedAssetDispositions.js'
import { otherIncomeStreams } from './internal/otherIncomeStreams.js'
import type { ParameterPack } from '../params/types.js'
import {
  type RmdApplicablePlan,
  type RmdShortfallReliefElection,
} from '../rmd/rmdShortfallExcise.js'
import {
  rmdApplicablePlanForAccount as identifyRmdApplicablePlan,
} from '../rmd/rmdApplicablePlanForAccount.js'
import { type RothBasisState } from '../strategies/rothBasis.js'
import {
  classifyInheritedRegime,
  inheritedIraRefusalCode,
  type InheritedIraRefusalCode,
  type InheritedRegimeClassification,
  type InheritedRegimeResult,
} from '../strategies/inheritedIra.js'
import {
  isAggregatedIra,
  isTreatAsOwnEffective,
} from '../strategies/accountEligibility.js'
import type { EmployerElectiveAllocation } from './employerRothCatchUp.js'
import { splitIraDistribution, type IraProRataYear } from '../strategies/iraBasis.js'
import {
  asAccountId,
  asPersonId,
  ledgerCentsToPlanDollars,
  planDollarsToLedgerCents,
  type ActionId,
  type ConversionLinkedWithdrawalGroupLiabilityRun,
} from '../actions/index.js'
import { addCalendarMonths } from '../actions/civilDate.js'
import {
  compareUtf16CodeUnits, deriveActionStructuralId,
} from '../actions/structuralId.js'
import { type SimulatorAnnualRetirementRuntimeOccurrence } from './annualRetirementRuntimeJournal.js'
import type { SimulatorAnnualPassDeferredFirstRmd, SimulatorAnnualPassStateBindings } from './annualPassTransaction.js'
import {
  type OwnedNonRothIraAnnualSettlementEffect,
} from '../internal/ownedNonRothIraAnnualAttemptSettlement.js'
import {
  openingAnnuityContractValuePlanDollars,
  ownedIraFundedAnnuityContracts,
} from '../internal/iraAnnuityContractValue.js'
import {
  type SimulateAnnualCounterfactualRequest,
} from '../internal/counterfactualAnnualLiability.js'
import {
  REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
  type AnnualConversionLinkedWithdrawalRelease,
} from './internal/annualConversionLinkedWithdrawalFunding.js'
import type { AnnualLiabilityRunTaxInput } from '../actions/annualLiabilityRunIdentity.js'
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
import { ABW_DEFAULTS, abwExpectedRealReturnPct } from '../spending/abw.js'
import { jointSurvivalPercentileAge, survivalPercentileAge } from '../montecarlo/survival.js'
import {
  type GuardrailPolicy,
} from '../spending/guardrails.js'
import { createGoalScheduler, toSchedulableGoal, type GoalScheduler } from '../spending/flexibleGoals.js'
import {
  taxParameterFilingStatus,
  type MarketSeries,
  type OptimizerYearProbe,
  type PersonYearState,
  type ProjectedFilingStatus,
  type ProjectionResult,
  type SimulatorRetirementRuntimeApplication,
  type TaxCalculator,
  type YearResult,
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
  SimulateAnnualCounterfactualRequest,
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
type BalanceState = PhysicalBalanceState

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
  /**
   * Statutory limits are indexed; project them past the latest pack at the
   * inflation path. The rule lives in `params/indexingScale.ts`, shared with the
   * optimizer's LP and the widow's-penalty detector; the ledger's contribution
   * is the path, which follows a Monte Carlo `market.inflationPct` series where
   * one is supplied. A year the pack prices exactly needs no projection at all.
   */
  const limitScale = (pack: ParameterPack, isStandIn: boolean, year: number): number =>
    !isStandIn ? 1 : indexingScaleFor(pack.year, year, inflFactorFrom)

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
    annualRothBasisPoolKey(account, primary.id)
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
    /** The discriminated cause for `refusalReason`; the two travel together. */
    refusalCode?: InheritedIraRefusalCode
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
      //
      // The code decides whether there is a refusal to publish at all: it is
      // undefined for exactly the legacy-planning-approximation arm, so prose
      // and code are set from one test and cannot disagree.
      const refusalCode = inheritedIraRefusalCode(regimeResult)
      inheritedClassCache.set(account.id, {
        accountId: account.id,
        accountType,
        ownerPersonId,
        path: 'legacy',
        refusalReason: refusalCode === undefined ? undefined : regimeResult.reason,
        refusalCode,
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
          // This arm publishes the synthetic reason unconditionally, so it
          // needs a code unconditionally. The synthetic S0 cannot refuse as
          // the legacy planning approximation (its X1 arms were already
          // cleared by the primary classification that reached S2), but if a
          // future one did, the generic cause is the fail-closed answer
          // rather than a row-specific claim the classifier never made.
          refusalCode: inheritedIraRefusalCode(synthetic) ?? 'needs-review',
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

    const yearSites: SealableAnnualCashFlowYearSites | null = captureAnnualCashFlow
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
        taxUnitId: deriveActionStructuralId('projection-tax-unit', [
          year,
          filingStatusForYear,
          members,
        ]),
        taxUnitEvidenceId: deriveActionStructuralId('projection-tax-unit-evidence', [
          year,
          filingStatusForYear,
          members,
          annualStateFilingInputs,
        ]),
        stateFilingStatusId: deriveActionStructuralId('projection-state-filing-status', [
          year,
          filingStatusForYear,
          members,
          annualStateFilingInputs,
        ]),
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

    /**
     * The money-bearing scalars the grouped phases mutate, bound once over the
     * simulator's own locals.
     *
     * One record shared by the funding-and-close phase's ledger and by
     * `annualPassState`, so the two seams cannot drift apart and neither one
     * needs a copy-back block at the call site. A phase's `.write` lands on the
     * local here directly; adding an eleventh scalar is a compile error at the
     * funding interface end (this record must list it) and, via the trailing
     * `satisfies`, at the rollback-registry end too: `annualPassState` spreads
     * this record in below, and a spread's members are not excess-checked
     * against `SimulatorAnnualPassStateBindings`, so without the `satisfies`
     * clause a scalar named here but not on that interface would compile,
     * write through, and never be captured or restored by
     * `SIMULATOR_ANNUAL_PASS_STATE_REGISTRY` — silently surviving a
     * rolled-back attempt into the committed year.
     */
    const annualPassScalarBindings:
      PhaseLedgerScalarBindings<AnnualFundingApplicationAndClosePhaseScalars> = {
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
        priorYearPortfolioReturnPct: annualPassValueBinding(
          () => priorYearPortfolioReturnPct,
          (value) => { priorYearPortfolioReturnPct = value },
        ),
      } satisfies Pick<
        SimulatorAnnualPassStateBindings,
        keyof AnnualFundingApplicationAndClosePhaseScalars
      >

    /** The one scalar latch the owned-IRA settlement phase sets for the year. */
    const settlementScalarBindings:
      PhaseLedgerScalarBindings<AnnualOwnedNonRothIraSettlementPhaseScalars> = {
        ownedNonRothIraSettlementRolledBackHousehold: annualPassValueBinding(
          () => ownedNonRothIraSettlementRolledBackHousehold,
          (value) => { ownedNonRothIraSettlementRolledBackHousehold = value },
        ),
      }

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
       * — both go through `linkedGroupFundingForAttempt([])` like every
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
      linkedGroupRelease: Readonly<AnnualConversionLinkedWithdrawalRelease> =
        REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
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

    const rmdNontaxable = 0
    const seppNontaxable = 0
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

    const forcedDistributionPhase =
      annualForcedDistributionQcdAndRetirementActionsPhase(Object.freeze({
        facts: Object.freeze({
          year,
          startYear,
          pack,
          plan,
          passPlan,
          passRetirementActions,
          primary,
          people,
          personById,
          peopleStates,
          inflFactor,
          limitGrowth,
          birthMonthByPerson,
          rmdFirstYearDeferrals: opts.rmdFirstYearDeferrals ?? [],
          isStandIn,
          qcdSection219ByDonor,
          preProjectionQcdOffsetUnprovable,
        }),
        ledger: {
          balances,
          annualIdKeyedBalances,
          ownersWithOmittedNondeductibleBasis,
          iraProRata,
          qcdProRataIdentityByReadSnapshot,
          iraBasisByOwner,
          deferredFirstRmdByApplicablePlan,
          seppAmortAmount,
          namedQcdOffsetConsumedByDonor,
          namedQcdOffsetHistoryUnprovable,
          rothBasis,
          warnings,
          annuityContractDistributions,
          initialRmdNontaxable: rmdNontaxable,
          initialSeppNontaxable: seppNontaxable,
        },
        callbacks: Object.freeze({
          stateOf,
          isTreatAsOwnEffective,
          rmdApplicablePlanForAccount,
          startOfYearBalance,
          inheritedClassCache,
          rmdReliefElectionFor,
          splitWithAssumedCharacter,
          resolveAssumedCharacter,
          noteForm8606Taxable,
          recordAnnualRetirementRuntimeOccurrence,
          recordAnnualRetirementRuntimeApplication,
          runtimeOccurrenceKey,
          annualActionTaxUnit,
          linkedGroupRelease,
          annualLiabilityBaseline,
        }),
        capture: publishCashFlow
          ? {
              seppByAccountId: seppByAccountId!,
              rmdNontaxableByOwner: rmdNontaxableByOwner!,
              seppNontaxableByAccountId: seppNontaxableByAccountId!,
              qcdExclusionFromRmdByOwner: qcdExclusionFromRmdByOwner!,
              qcdExclusionBeyondRmdByOwner: qcdExclusionBeyondRmdByOwner!,
              qcdOrdinaryBeyondRmdByOwner: qcdOrdinaryBeyondRmdByOwner!,
              qcdBeyondRmdCharacterByOccurrence: qcdBeyondRmdCharacterByOccurrence!,
              qcdOrdinaryFromRmdByOwner: qcdOrdinaryFromRmdByOwner!,
              qcdBasisFromRmdByOwner: qcdBasisFromRmdByOwner!,
              annuityBasisReturnByAccountId: annuityBasisReturnByAccountId!,
            }
          : null,
      }))
    const aggregateRothPhase = annualAggregateRothConversionPhase(Object.freeze({
      facts: Object.freeze({
        year,
        pack,
        plan,
        primary,
        personById,
        peopleStates,
        anyAlive,
        aliveCount,
        inflFactor,
        limitGrowth,
        taxFilingStatusForYear,
        filingStatusForYear,
        safetyNetFloorToday,
        taxCalculator,
        ordinaryIncome,
        preTaxContributions,
        oneTimeGains,
        rebalanceRealizedGains,
        privateRetirementOrdinary,
        publicPensionOrdinary,
        propertySaleProceedsTotal,
        contributions,
        expensesTotal: expenses.total,
        incomes,
        taxableYieldReinvested,
        ladderTaxableInterest,
        capitalLossPool,
        acaActive,
        acaContract,
        acaInitialSupportCodes,
        planHasTaxExemptYieldAttestation,
        assumedEffects,
        inflFactorFrom,
      }),
      prior: forcedDistributionPhase,
      ledger: {
        balances,
        annualIdKeyedBalances,
        iraProRata,
        rothBasis,
        warnings,
      },
      callbacks: Object.freeze({
        stateOf,
        splitWithAssumedCharacter,
        noteForm8606Taxable,
        recordAnnualRetirementRuntimeOccurrence,
        recordAnnualRetirementRuntimeApplication,
        runtimeOccurrenceKey,
      }),
      capture: publishCashFlow
        ? { aggregateConversionDraws: aggregateConversionDraws! }
        : null,
    }))
    conversionNontaxable = aggregateRothPhase.conversionNontaxable

    const fundingCloseLedger = {
      balances,
      annualIdKeyedBalances,
      annualLogicalBalanceLedger,
      iraProRata,
      iraBasisByOwner,
      rothBasis,
      rothAssumedContributionRemaining,
      rothCounterfactualFreeCoverConsumed,
      form8606ConsequentialByOwner,
      warnings,
      hecmStates,
      propertyValues,
      debtBalances,
      insuranceCashValues,
      magiHistory,
      inheritedYearEvidenceDraft: forcedDistributionPhase.inheritedYearEvidenceDraft,
      annualRetirementRuntimeOccurrences,
      annualRetirementRuntimeApplications,
      annuityContractValue,
      expenses,
      scalars: annualPassScalarBindings,
      ownedRothAssumedBasisConsequentialByOwner:
        forcedDistributionPhase.ownedRothAssumedBasisConsequentialByOwner,
      employerRothAssumedBasisConsequentialByAccount:
        forcedDistributionPhase.employerRothAssumedBasisConsequentialByAccount,
    }
    const fundingCloseResult = annualFundingApplicationAndClosePhase(Object.freeze({
      facts: Object.freeze({
        year,
        startYear,
        pack,
        plan,
        primary,
        personById,
        peopleStates,
        anyAlive,
        aliveCount,
        inflFactor,
        limitGrowth,
        taxFilingStatusForYear,
        filingStatusForYear,
        safetyNetFloorToday,
        taxCalculator,
        contributions,
        traditionalInflow,
        otherInflow,
        taxableInflow,
        incomes,
        taxableYieldReinvested,
        ladderTaxableInterest,
        rebalanceRealizedGains,
        propertySaleProceedsTotal,
        acaActive,
        acaContract,
        acaInitialSupportCodes,
        acaGrossEnrollmentPremium,
        acaEnrollmentPremiums,
        acaSlcspBenchmarkPremiums,
        healthcareExcludingAcaEnrollment,
        healthcareExcludingMarketplacePremium,
        netCare,
        hsaReimburseLaterActive,
        exampleContractInputMismatch,
        acaContractsForYear,
        marketplaceMonthsByPersonPosition,
        pre65MonthlyPremiumPerPerson,
        healthInflFactor,
        isStandIn,
        planHasInheritedAccounts,
        ownedNonRothIraContributions,
        socialSecurityStreams,
        qualifiedAnnuityPayments,
        employerMatch,
        employerAllocationByOwner,
        ladderValueTotal,
        medicarePremiums,
        irmaaSurcharge,
        irmaaTier,
        irmaaMagi,
        irmaaLookbackMagiSource,
        irmaaLookbackMagiYear,
        irmaaNextTierThreshold,
        ssEarningsTestWithheld,
        ssdiPaid,
        skippedRequiredNominal,
        skippedTargetNominal,
        skippedIdealNominal,
        skippedExcessNominal,
        guardrailAction,
        goalOutcomeCounts,
        requiredLifestyle,
        targetLifestyle,
        targetLifestyleFunded,
        idealLifestyle,
        idealLifestyleFunded,
        excessLifestyle,
        excessLifestyleFunded,
        idealSpendingBase,
        excessSpendingBase,
        inflFactorFrom,
        returnShockAt,
        classShockAt,
        classParams,
        allocationTrack,
        distributedYieldByBalanceIndex,
        annuityStagingCandidates,
        startOfYearAnnuityContractValue,
        startOfYearPositionalBalances,
        startOfYearBalance,
        conversionFundingTaxUnitEvidence,
        annualLiabilityBaseline,
        annualLiabilityNonGroupTaxInputs,
        exogenousStrategyDebits,
        collidingEncodedProducerSegments,
        publishCashFlow,
        captureOptimizerInputs: opts.captureOptimizerInputs,
        lifeAgeOf,
        ssa44ActiveInYear,
        canonicalRuntimeOccurrenceOrder,
      }),
      prior: Object.freeze({
        forcedDistribution: forcedDistributionPhase,
        aggregateRoth: aggregateRothPhase,
      }),
      ledger: fundingCloseLedger,
      callbacks: Object.freeze({
        stateOf,
        isTreatAsOwnEffective,
        isInheritedRothOutsideOwnedPool,
        rothPoolKey,
        splitAnnualIraDistribution,
        resolveAssumedCharacter,
        noteForm8606Taxable,
        recordAnnualRetirementRuntimeOccurrence,
        recordAnnualRetirementRuntimeApplication,
        runtimeOccurrenceKey,
        deposit,
        inflRateAt,
        readUnassignedCash: () => unassignedCash,
        readNextRetirementRuntimeMutationOrdinal: () =>
          nextRetirementRuntimeMutationOrdinal,
      }),
      capture: publishCashFlow
        ? Object.freeze({
            yearSites: yearSites!,
            seppByAccountId: seppByAccountId!,
            hecmCoordinatedByProperty: hecmCoordinatedByProperty!,
            hecmBackstopByProperty: hecmBackstopByProperty!,
            legacyPropertySaleDeposits: legacyPropertySaleDeposits!,
            deathBenefits: deathBenefits!,
            surplusDestination: surplusDestination!,
            cashFlowPenaltyLines: cashFlowPenaltyLines!,
            rothPoolTaxableOrdinaryByPersonId: rothPoolTaxableOrdinaryByPersonId!,
            annuityBasisReturnByAccountId: annuityBasisReturnByAccountId!,
            rmdNontaxableByOwner: rmdNontaxableByOwner!,
            seppNontaxableByAccountId: seppNontaxableByAccountId!,
            aggregateConversionDraws: aggregateConversionDraws!,
            qcdExclusionFromRmdByOwner: qcdExclusionFromRmdByOwner!,
            qcdExclusionBeyondRmdByOwner: qcdExclusionBeyondRmdByOwner!,
            qcdOrdinaryBeyondRmdByOwner: qcdOrdinaryBeyondRmdByOwner!,
            qcdBeyondRmdCharacterByOccurrence: qcdBeyondRmdCharacterByOccurrence!,
            qcdOrdinaryFromRmdByOwner: qcdOrdinaryFromRmdByOwner!,
            qcdBasisFromRmdByOwner: qcdBasisFromRmdByOwner!,
            hsaNonqualifiedOrdinaryByAccountId: hsaNonqualifiedOrdinaryByAccountId!,
            employerRothTaxableOrdinaryByAccountId: employerRothTaxableOrdinaryByAccountId!,
            distributedYieldByAccountId,
          })
        : null,
    }))
    // No copy-out block: `fundingCloseLedger.scalars` binds these locals, so
    // the phase has already written through to them.
    return fundingCloseResult
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
      // The same ten adapters the funding-and-close phase's ledger carries.
      // Shared rather than redefined: the two seams bind one set of locals, so
      // a rollback and a phase write can never disagree about which cell they
      // are talking about.
      ...annualPassScalarBindings,
      expenses,
    }

    // Every pre-pass cash-flow site for this year has now run, and the only
    // entry into the annual pass is the settlement phase below. Sealing here
    // turns "record only before the pass" from a header comment into a throw:
    // the buffer survives T0, staging and settlement re-entries without being
    // rolled back, so a `record*` that drifted inside the pass would append
    // once per re-entry.
    yearSites?.seal()

    const settlementLedger: AnnualOwnedNonRothIraSettlementPhaseLedger = {
      iraBasisByOwner,
      ownedNonRothIraSettlementRolledBackOwners,
      scalars: settlementScalarBindings,
    }
    const settledAnnualPass = annualOwnedNonRothIraSettlementPhase(Object.freeze({
      facts: Object.freeze({
        year,
        plan,
        primary,
        personById,
        balances,
        startOfYearPositionalBalances,
        annualLinkedGroupOmissionIds,
        conversionFundingTaxUnitEvidence,
        annualLiabilityNonGroupTaxInputs,
        captureAnnualCashFlow,
        annualCounterfactual: opts.annualCounterfactual,
      }),
      state: annualPassState,
      ledger: settlementLedger,
      callbacks: Object.freeze({
        isTreatAsOwnEffective,
        ownedNonRothIraSettlementEnabled,
        ownedNonRothIraSettlementOwnerEnabled,
        runPostContributionAnnualPass,
      }),
    }))
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
