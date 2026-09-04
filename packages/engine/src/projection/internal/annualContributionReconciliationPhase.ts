/**
 * Reconcile this year's contributions and employer match against the physical
 * ledger, then apply them.
 *
 * The arithmetic lives in `annualContributionsAndEmployerMatch.ts`, which is a
 * pure planner: it reads positional balances and hands back operations,
 * identities and totals without touching anything. What moved here out of
 * `simulatePlan` is the half that makes those operations real -- the
 * caller-owned defensive snapshot of the planner's result, the reconciliation
 * that refuses a plan whose operations lost their cardinality, identity,
 * physical position or balance preimage, the seven exact-total assertions, and
 * the apply pass that commits balances, cost bases, Roth contribution basis,
 * section 219 QCD offsets, runtime-journal rows, warnings and cash-flow
 * records.
 *
 * Three properties the move had to keep, and now states out loud:
 *
 * - **Two passes, in this order.** The reconciliation pass mutates nothing: it
 *   walks a SHADOW copy of the balances and cost bases, so every check reads
 *   the planner's own preimage rather than a value an earlier operation in the
 *   same pass already moved. Only once all seven totals reconcile exactly does
 *   the second pass touch `balances`. A single fused pass would commit the
 *   operations it had already accepted before discovering a bad total.
 * - **Folded in operation order.** The seven reconciled accumulators start at
 *   zero here and are folded in the planner's operation order, which is the
 *   order `assertExactContributionTotal` compares them against with
 *   `Object.is`. IEEE-754 addition is not associative, so the order IS the
 *   assertion.
 * - **The snapshot is the boundary.** `snapshotAnnualContributionsAndEmployerMatchResult`
 *   severs every lazy or proxy-backed channel the planner could hand back, so
 *   the reconciliation cannot be shown one value and the apply pass another. It
 *   came across with this phase because it exists only for it.
 *
 * `yearSites` is narrowed to the two sinks this phase writes; the year keeps
 * the rest of the cash-flow capture surface.
 */
import type { Account } from '../../model/plan.js'
import type { ParameterPack } from '../../params/types.js'
import { isAggregatedIra } from '../../strategies/accountEligibility.js'
import type { RothBasisState } from '../../strategies/rothBasis.js'
import type {
  RecordedContribution,
  RecordedEmployerMatch,
} from '../annualCashFlowYearSites.js'
import type {
  SimulatorAnnualRetirementRuntimeOccurrence,
} from '../annualRetirementRuntimeJournal.js'
import type { EmployerElectiveAllocation } from '../employerRothCatchUp.js'
import type {
  ProjectedFilingStatus,
  SimulatorRetirementRuntimeApplication,
} from '../types.js'
import {
  annualContributionsAndEmployerMatch,
  type AnnualContributionAndMatchOperation,
  type AnnualContributionAndMatchOperationIdentity,
  type AnnualContributionOwnerState,
  type AnnualContributionsAndEmployerMatchResult,
} from './annualContributionsAndEmployerMatch.js'
import type { PhysicalBalanceState } from './annualLogicalBalanceLedger.js'

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

export type SimulatorRetirementRuntimeApplicationWithoutOrdinal =
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

/**
 * The two cash-flow sinks this phase writes. Narrower than the year's own
 * `SealableAnnualCashFlowYearSites` on purpose: nothing here can reach another
 * capture channel, and a null value means capture is off, exactly as inline.
 */
export interface AnnualContributionReconciliationCommitSites {
  recordContribution(row: RecordedContribution): void
  recordEmployerMatch(row: RecordedEmployerMatch): void
}

export interface AnnualContributionReconciliationPhaseInput {
  /**
   * The live physical rows, by identity. Read as the planner's positional view
   * and then mutated by the apply pass, so a copy would silently drop the
   * year's contributions.
   */
  readonly balances: readonly PhysicalBalanceState[]
  readonly year: number
  readonly startYear: number
  readonly inflFactor: number
  readonly limitGrowth: number
  readonly filingStatus: ProjectedFilingStatus
  readonly aliveCount: number
  readonly peopleCount: number
  readonly primaryPersonId: string
  readonly wagesByPerson: ReadonlyMap<string, number>
  readonly resolveOwnerState: (
    ownerPersonId: string,
  ) => AnnualContributionOwnerState
  readonly resolveOwnerBirthYear: (ownerPersonId: string) => number
  readonly resolveOwnerDob: (ownerPersonId: string) => string | null
  readonly resolveRothPoolKey: (
    account: Extract<Account, { type: 'roth' }>,
  ) => string
  readonly runtimeOccurrenceKey: (
    kind: SimulatorAnnualRetirementRuntimeOccurrence['kind'],
    ...binding: readonly unknown[]
  ) => string
  readonly indexWithStatutoryRounding: (base: number, growth: number) => number
  readonly pack: ParameterPack
  /** The year's warning set; a planner warning is inserted at its own row. */
  readonly warnings: Set<string>
  /** Live Roth basis pools, credited by identity as each contribution commits. */
  readonly rothBasis: ReadonlyMap<string, RothBasisState>
  /** Live section 219 offsets by donor, added to as each contribution commits. */
  readonly qcdSection219ByDonor: Map<string, number>
  readonly recordAnnualRetirementRuntimeOccurrence: (
    occurrence: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
  ) => void
  readonly recordAnnualRetirementRuntimeApplication: (
    application: SimulatorRetirementRuntimeApplicationWithoutOrdinal,
  ) => SimulatorRetirementRuntimeApplication
  /** Null when the projection captures no cash flow. */
  readonly yearSites: AnnualContributionReconciliationCommitSites | null
}

/** The eight channels the year reads back; nothing else survives the phase. */
export interface AnnualContributionReconciliationPhaseResult {
  readonly contributions: number
  readonly ownedNonRothIraContributions: number
  readonly employerMatch: number
  readonly preTaxContributions: number
  readonly traditionalInflow: number
  readonly otherInflow: number
  readonly taxableInflow: number
  readonly employerAllocationByOwner: ReadonlyMap<
    string,
    Readonly<EmployerElectiveAllocation>
  >
}

export function annualContributionReconciliationPhase(
  input: AnnualContributionReconciliationPhaseInput,
): AnnualContributionReconciliationPhaseResult {
  const {
    balances,
    year,
    startYear,
    inflFactor,
    limitGrowth,
    filingStatus,
    aliveCount,
    peopleCount,
    primaryPersonId,
    wagesByPerson,
    resolveOwnerState,
    resolveOwnerBirthYear,
    resolveOwnerDob,
    resolveRothPoolKey,
    runtimeOccurrenceKey,
    indexWithStatutoryRounding,
    pack,
    warnings,
    rothBasis,
    qcdSection219ByDonor,
    recordAnnualRetirementRuntimeOccurrence,
    recordAnnualRetirementRuntimeApplication,
    yearSites,
  } = input
  const contributionPlan = snapshotAnnualContributionsAndEmployerMatchResult(
    annualContributionsAndEmployerMatch({
      balances,
      year,
      startYear,
      inflFactor,
      limitGrowth,
      filingStatus,
      aliveCount,
      peopleCount,
      primaryPersonId,
      wagesByPerson,
      resolveOwnerState,
      resolveOwnerBirthYear,
      resolveOwnerDob,
      resolveRothPoolKey,
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
  return {
    contributions,
    ownedNonRothIraContributions,
    employerMatch,
    preTaxContributions,
    traditionalInflow,
    otherInflow,
    taxableInflow,
    employerAllocationByOwner,
  }
}
