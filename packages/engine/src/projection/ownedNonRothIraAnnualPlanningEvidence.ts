import { planSchema, type Plan } from '../model/plan.js'
import { ordinaryFederalFilingDeadline } from '../model/retirementActionAnnualTaxFacts.js'
import {
  type PlanOwnedNonRothIraAnnualPhysicalTransactionPreparedResult,
} from '../actions/ownedNonRothIraAnnualPhysicalTransaction.js'
import { parseCivilIsoDate } from '../actions/civilDate.js'
import {
  accountIdSchema,
  personIdSchema,
  planIdSchema,
  type AccountId,
  type PersonId,
  type PlanId,
} from '../actions/identity.js'
import {
  asPositiveUsdCents,
  asUsdCents,
  type PositiveUsdCents,
  type UsdCents,
} from '../actions/money.js'
import { planDollarsToLedgerCents } from '../actions/planBalanceAdapter.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from '../actions/structuralId.js'
const MAX_SAFE_CENTS = BigInt(Number.MAX_SAFE_INTEGER)

export type SimulatorOwnedNonRothIraPlanningActivityKind =
  | 'distribution'
  | 'rothConversion'
  | 'ownedIraContribution'
  | 'ownedIraEmployerContribution'
  | 'qualifiedCharitableDistribution'
  | 'rollover'
  | 'repayment'
  | 'recharacterization'
  | 'oneTimeHsaFundingDistribution'
  | 'returnedContribution'
  | 'otherUnsupported'

export interface SimulatorOwnedNonRothIraSettledContributionDesignation {
  activityId: string
  designatedTaxYear: number
  /** Projection dollars; may be zero when the entire contribution is assumed deductible. */
  nondeductibleContributionAmount: number
}

export interface SimulatorOwnedNonRothIraPostYearContributionAssumption {
  sourceAccountId: string
  designatedTaxYear: number
  contributionDate: string
  /** Projection dollars. Zero assumptions are omitted rather than serialized. */
  nondeductibleContributionAmount: number
}

export type SimulatorOwnedNonRothIraOpeningBasisAssumption =
  | {
      source: 'planAccountPlanningSeed'
      asOfDate: string
      amount: number
    }
  | {
      source: 'priorProjectionCarryforward'
      asOfDate: string
      amount: number
      priorTaxYear: number
      priorCarryforwardEvidenceId: string
    }

export interface SimulatorOwnedNonRothIraAnnualPlanningAssumptions {
  predicate: 'explicitSimulatorOwnedNonRothIraAnnualPlanningAssumptions'
  poolScope: 'validatedPlanContainsCompleteOwnedNonRothIraPoolForProjection'
  realWorldAccountCompleteness: 'notEstablished'
  openingBasis: Readonly<SimulatorOwnedNonRothIraOpeningBasisAssumption>
  rolloverAssumption: Readonly<{
    status: 'assumedNoOutstandingRolloverOrRepaymentAdjustment'
    outstandingRolloverAmount: 0
    rolloverRepaymentAdjustmentAmount: 0
  }>
  settledContributionDesignations:
    readonly Readonly<SimulatorOwnedNonRothIraSettledContributionDesignation>[]
  postYearWindowStatus: 'completeExplicitProjectionAssumption'
  postYearPriorTaxYearContributions:
    readonly Readonly<SimulatorOwnedNonRothIraPostYearContributionAssumption>[]
}

export interface BuildSimulatorOwnedNonRothIraAnnualPlanningEvidenceInput {
  plan: unknown
  ownerPersonId: string
  taxYear: number
  projectionStartTaxYear: number
  ledgerRunId: string
  annualObservation: unknown
  annualPhysicalTransaction: unknown
  assumptions: unknown
  /** Required only when openingBasis.source is priorProjectionCarryforward. */
  priorCarryforwardEvidence?: unknown
  /** Required only when openingBasis.source is priorProjectionCarryforward. */
  priorPlanningEvidence?: unknown
}

export interface CompleteSimulatorOwnedNonRothIraPlanningCarryforwardEvidence {
  predicate: 'completeSimulatorOwnedNonRothIraPlanningCarryforwardEvidence'
  planId: PlanId
  ownerPersonId: PersonId
  projectionStartTaxYear: number
  fromTaxYear: number
  toTaxYear: number
  sourceLedgerRunId: string
  sourcePlanningEvidenceId: string
  accountIds: readonly [AccountId, ...AccountId[]]
  openingPlanningBasisAmount: UsdCents
  postYearPriorTaxYearContributionAssumptions: readonly Readonly<{
    sourceAccountId: AccountId
    designatedTaxYear: number
    contributionDate: string
    nondeductibleContributionAmount: PositiveUsdCents
  }>[]
  evidenceScope: 'projectionPlanningCarryforwardOnlyNotTaxReturnEvidence'
  taxReturnUse: 'prohibited'
  evidenceId: string
}

export type SimulatorOwnedNonRothIraAnnualPlanningEvidenceIssueKind =
  | 'inputInvalid'
  | 'planInvalid'
  | 'ownerInvalid'
  | 'ownerNotFound'
  | 'taxYearInvalid'
  | 'ledgerRunInvalid'
  | 'ownedIraPoolEmpty'
  | 'observationInvalid'
  | 'observationBindingMismatch'
  | 'activityInventoryInvalid'
  | 'activityInventoryBindingMismatch'
  | 'activityInventoryIncomplete'
  | 'activityUnsupported'
  | 'activityInvalid'
  | 'activityChronologyInvalid'
  | 'assumptionsInvalid'
  | 'openingBasisMismatch'
  | 'contributionDesignationIncomplete'
  | 'contributionAssumptionInvalid'
  | 'rolloverAssumptionUnsupported'
  | 'amountOverflow'
  | 'annualAllocationInvalid'
  | 'identifierCollision'
  | 'identifierDerivationFailed'

export interface SimulatorOwnedNonRothIraAnnualPlanningEvidenceIssue {
  kind: SimulatorOwnedNonRothIraAnnualPlanningEvidenceIssueKind
  detail: string
  sourceAccountId?: string
  activityId?: string
  identifier?: string
}

export interface SimulatorOwnedNonRothIraPlanningBasisRatio {
  representation: 'exactMinorUnitRational' | 'notApplicableZeroDenominator'
  numeratorMinorUnits: UsdCents
  denominatorMinorUnits: UsdCents
  intermediateArithmetic: 'bigintRational' | 'notApplicable'
}

export interface SimulatorOwnedNonRothIraPlanningAllocationEntry {
  activityId: string
  actionId: string
  sourceAccountId: AccountId
  executionDate: string
  executionSequence: number
  grossAmount: PositiveUsdCents
  allocatedBasisAmount: UsdCents
  ordinaryIncomeAmount: UsdCents
  residualCentAwarded: 0 | 1
}

export interface SimulatorOwnedNonRothIraPlanningAllocationEvidence {
  calculationScope:
    | 'projectionPlanningDistributions'
    | 'projectionPlanningNetConversions'
  annualGrossAmount: UsdCents
  annualBasisReturnAmount: UsdCents
  annualOrdinaryIncomeAmount: UsdCents
  annualBasisRatio: Readonly<SimulatorOwnedNonRothIraPlanningBasisRatio>
  residualAllocationOrder:
    'executionDateThenSequenceThenActivityId'
  allocations:
    readonly Readonly<SimulatorOwnedNonRothIraPlanningAllocationEntry>[]
  evidenceId: string
}

export interface CompleteSimulatorOwnedNonRothIraAnnualPlanningEvidence {
  predicate: 'completeSimulatorOwnedNonRothIraAnnualPlanningEvidence'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  projectionStartTaxYear: number
  ledgerRunId: string
  evidenceScope: 'projectionPlanningEstimateOnlyNotTaxReturnEvidence'
  filingCompleteness: 'notEstablished'
  realWorldAccountCompleteness: 'notEstablished'
  taxReturnUse: 'prohibited'
  assumptionStatus: 'explicitProjectionAssumptionsApplied'
  accountIds: readonly [AccountId, ...AccountId[]]
  observationEvidenceId: string
  activityInventoryEvidenceId: string
  assumptionsEvidenceId: string
  openingPlanningBasisAmount: UsdCents
  inYearNondeductibleContributionAmount: UsdCents
  postYearPriorTaxYearNondeductibleContributionAmount: UsdCents
  postYearPriorTaxYearContributionAssumptions: readonly Readonly<{
    sourceAccountId: AccountId
    designatedTaxYear: number
    contributionDate: string
    nondeductibleContributionAmount: PositiveUsdCents
  }>[]
  allocationBasisNumeratorAmount: UsdCents
  observedYearEndApplicablePoolBalanceAmount: UsdCents
  assumedOutstandingRolloverAmount: 0
  assumedRolloverRepaymentAdjustmentAmount: 0
  annualBasisDenominatorAmount: UsdCents
  annualBasisRatio: Readonly<SimulatorOwnedNonRothIraPlanningBasisRatio>
  distributionAllocation:
    Readonly<SimulatorOwnedNonRothIraPlanningAllocationEvidence>
  conversionAllocation:
    Readonly<SimulatorOwnedNonRothIraPlanningAllocationEvidence>
  nextYearOpeningPlanningBasisAmount: UsdCents
  displayCopy:
    'Projected IRA tax treatment uses complete simulated Plan activity and explicit basis, contribution, and no-rollover assumptions. It is not Form 8606 or tax-return evidence.'
  evidenceId: string
}

interface PlanningResultBase {
  movement: 'notCommitted'
  realWorldActionability: 'notEstablished'
}

export interface SimulatorOwnedNonRothIraAnnualPlanningEvidenceBlockedResult
  extends PlanningResultBase {
  status: 'annualPlanningEvidenceBlocked'
  simulationActionability: 'notEstablished'
  planningEvidence: null
  issues: readonly [
    Readonly<SimulatorOwnedNonRothIraAnnualPlanningEvidenceIssue>,
    ...Readonly<SimulatorOwnedNonRothIraAnnualPlanningEvidenceIssue>[],
  ]
}

export interface SimulatorOwnedNonRothIraAnnualPlanningEvidenceBuiltResult
  extends PlanningResultBase {
  status: 'annualPlanningEvidenceBuilt'
  simulationActionability: 'established'
  planningEvidence:
    Readonly<CompleteSimulatorOwnedNonRothIraAnnualPlanningEvidence>
  carryforwardEvidence:
    Readonly<CompleteSimulatorOwnedNonRothIraPlanningCarryforwardEvidence>
  issues: readonly []
}

export type BuildSimulatorOwnedNonRothIraAnnualPlanningEvidenceResult =
  | SimulatorOwnedNonRothIraAnnualPlanningEvidenceBlockedResult
  | SimulatorOwnedNonRothIraAnnualPlanningEvidenceBuiltResult

interface CanonicalActivity {
  activityId: string
  authorityKind:
    | 'planAction'
    | 'derivedRuntimeAction'
    | 'runtimeMovementAuthority'
  authorityId: string
  allocationActionId: string | null
  sourceAccountId: AccountId
  activityKind: SimulatorOwnedNonRothIraPlanningActivityKind
  executionDate: string
  executionSequence: number
  grossAmount: PositiveUsdCents
  upstreamEvidenceId: string
}

interface IdentifierClaim {
  role: string
  binding: string
  label: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function identifierValues(
  value: unknown,
  key = '',
  result = new Set<string>(),
  seen = new WeakSet<object>(),
): Set<string> {
  if (typeof value === 'string') {
    if (key === 'id' || key.endsWith('Id')) result.add(value)
    return result
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return result
  }
  seen.add(value)
  for (const [childKey, child] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (Array.isArray(child) && childKey.endsWith('Ids')) {
      for (const item of child) {
        if (typeof item === 'string') result.add(item)
      }
    }
    identifierValues(child, childKey, result, seen)
  }
  return result
}

function canonicalDate(value: unknown): string | null {
  return typeof value === 'string' && parseCivilIsoDate(value) !== null
    ? value
    : null
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function issue(
  kind: SimulatorOwnedNonRothIraAnnualPlanningEvidenceIssueKind,
  detail: string,
  bindings: Pick<
    SimulatorOwnedNonRothIraAnnualPlanningEvidenceIssue,
    'sourceAccountId' | 'activityId' | 'identifier'
  > = {},
): SimulatorOwnedNonRothIraAnnualPlanningEvidenceIssue {
  return { kind, detail, ...bindings }
}

function blocked(
  issues: readonly SimulatorOwnedNonRothIraAnnualPlanningEvidenceIssue[],
): Readonly<SimulatorOwnedNonRothIraAnnualPlanningEvidenceBlockedResult> {
  const nonempty = issues.length > 0
    ? issues
    : [issue('inputInvalid', 'Planning evidence failed closed')]
  return deepFreeze({
    status: 'annualPlanningEvidenceBlocked',
    movement: 'notCommitted',
    simulationActionability: 'notEstablished',
    realWorldActionability: 'notEstablished',
    planningEvidence: null,
    issues: nonempty as [
      SimulatorOwnedNonRothIraAnnualPlanningEvidenceIssue,
      ...SimulatorOwnedNonRothIraAnnualPlanningEvidenceIssue[],
    ],
  })
}

function safeError(error: unknown): string {
  try {
    if (error instanceof Error) {
      try {
        if (typeof error.message === 'string') return error.message
      } catch {
        // Fall through to the guarded generic formatter.
      }
    }
    try {
      return String(error)
    } catch {
      return 'unformattable error'
    }
  } catch {
    return 'unformattable error'
  }
}

function safeCents(value: bigint, label: string): UsdCents {
  if (value < 0n || value > MAX_SAFE_CENTS) {
    throw new RangeError(`${label} exceeds exact safe-integer cents`)
  }
  return asUsdCents(Number(value))
}

function exactHalfUp(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  return quotient + (remainder * 2n >= denominator ? 1n : 0n)
}

function derivedIdMatches(
  value: unknown,
  namespace: string,
  parts: readonly unknown[],
): boolean {
  return nonblank(value) && value === deriveActionStructuralId(namespace, parts)
}

function objectEvidenceIdMatches(
  value: Record<string, unknown>,
  namespace: string,
): boolean {
  const { evidenceId, ...body } = value
  return derivedIdMatches(evidenceId, namespace, [body])
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length &&
    left.every((value, index) => value === right[index])
}

function ownedIraPool(plan: Plan, ownerPersonId: PersonId): AccountId[] {
  return plan.accounts
    .filter((account) =>
      account.type === 'traditional' && account.kind === 'ira' &&
      account.inherited === undefined &&
      account.ownerPersonId === ownerPersonId)
    .map((account) => accountIdSchema.parse(account.id))
    .sort(compareUtf16CodeUnits)
}

function claimIdentifier(
  claims: Map<string, IdentifierClaim[]>,
  value: unknown,
  role: string,
  bindingParts: readonly unknown[],
  label: string,
  issues: SimulatorOwnedNonRothIraAnnualPlanningEvidenceIssue[],
  allowReference = false,
  allowSameRoleDifferentBinding = false,
): void {
  if (!nonblank(value)) {
    issues.push(issue('identifierCollision', `${label} must be nonblank`))
    return
  }
  let binding: string
  try {
    binding = deriveActionStructuralId(
      'simulator-owned-ira-planning-identifier-binding',
      bindingParts,
    )
  } catch (error) {
    issues.push(issue(
      'identifierDerivationFailed',
      `${label} binding failed: ${safeError(error)}`,
      { identifier: value },
    ))
    return
  }
  const existing = claims.get(value) ?? []
  const crossRole = existing.find((claim) => claim.role !== role)
  if (crossRole !== undefined) {
    issues.push(issue(
      'identifierCollision',
      `${label} collides with ${crossRole.label}`,
      { identifier: value },
    ))
    return
  }
  const sameBinding = existing.find((claim) => claim.binding === binding)
  if (sameBinding !== undefined) {
    if (allowReference) return
    issues.push(issue(
      'identifierCollision',
      `${label} collides with ${sameBinding.label}`,
      { identifier: value },
    ))
    return
  }
  if (allowReference) {
    issues.push(issue(
      'identifierCollision',
      `${label} does not match its declared ${role}`,
      { identifier: value },
    ))
    return
  }
  if (existing.length > 0 && !allowSameRoleDifferentBinding) {
    issues.push(issue(
      'identifierCollision',
      `${label} is rebound from ${existing[0]!.label}`,
      { identifier: value },
    ))
    return
  }
  claims.set(value, [...existing, { role, binding, label }])
}

function claimPlanIdentifiers(
  plan: Plan,
  planId: PlanId,
  claims: Map<string, IdentifierClaim[]>,
  issues: SimulatorOwnedNonRothIraAnnualPlanningEvidenceIssue[],
): void {
  claimIdentifier(claims, planId, 'planId', [planId], 'Plan ID', issues)
  for (const person of plan.household.people) {
    claimIdentifier(
      claims,
      person.id,
      'personId',
      [planId, person],
      `person ID ${person.id}`,
      issues,
    )
  }
  for (const account of plan.accounts) {
    claimIdentifier(
      claims,
      account.id,
      'accountId',
      [planId, account],
      `account ID ${account.id}`,
      issues,
    )
  }
  for (const action of plan.strategies.retirementActions) {
    claimIdentifier(
      claims,
      action.actionId,
      'actionId',
      [planId, action],
      `action ID ${action.actionId}`,
      issues,
    )
    const actionWithAllocations = action as unknown as {
      allocations?: readonly { allocationId: string }[]
      allocation?: { allocationId: string }
    }
    const allocations = actionWithAllocations.allocations ??
      (actionWithAllocations.allocation === undefined
        ? []
        : [actionWithAllocations.allocation])
    for (const allocation of allocations) {
      claimIdentifier(
        claims,
        allocation.allocationId,
        'allocationId',
        [action.actionId, allocation],
        `allocation ID ${allocation.allocationId}`,
        issues,
        false,
        true,
      )
    }
  }
  for (const classification of
    plan.retirementActionEligibilityFacts?.iraClassifications ?? []) {
    claimIdentifier(
      claims,
      classification.evidenceId,
      'iraClassificationEvidenceId',
      [classification],
      `IRA-classification evidence ID ${classification.evidenceId}`,
      issues,
    )
  }
  for (const activity of
    plan.retirementActionEligibilityFacts?.sepSimpleActivities ?? []) {
    claimIdentifier(
      claims,
      activity.evidenceId,
      'sepSimpleActivityEvidenceId',
      [activity],
      `SEP/SIMPLE activity evidence ID ${activity.evidenceId}`,
      issues,
    )
  }
  for (const contribution of
    plan.retirementActionEligibilityFacts?.deductibleIraContributions ?? []) {
    claimIdentifier(
      claims,
      contribution.evidenceId,
      'deductibleIraContributionEvidenceId',
      [contribution],
      `Deductible IRA contribution evidence ID ${contribution.evidenceId}`,
      issues,
    )
  }
  for (const value of identifierValues(plan)) {
    if (claims.has(value)) continue
    claimIdentifier(
      claims,
      value,
      'planNestedIdentifier',
      [planId, value],
      `nested Plan identifier ${value}`,
      issues,
    )
  }
}

function canonicalActivityOrder(
  left: CanonicalActivity,
  right: CanonicalActivity,
): number {
  return compareUtf16CodeUnits(left.executionDate, right.executionDate) ||
    left.executionSequence - right.executionSequence ||
    compareUtf16CodeUnits(left.activityId, right.activityId)
}

function ratio(
  numerator: UsdCents,
  denominator: UsdCents,
): SimulatorOwnedNonRothIraPlanningBasisRatio {
  return denominator === 0
    ? {
        representation: 'notApplicableZeroDenominator',
        numeratorMinorUnits: asUsdCents(0),
        denominatorMinorUnits: asUsdCents(0),
        intermediateArithmetic: 'notApplicable',
      }
    : {
        representation: 'exactMinorUnitRational',
        numeratorMinorUnits: asUsdCents(Math.min(numerator, denominator)),
        denominatorMinorUnits: denominator,
        intermediateArithmetic: 'bigintRational',
      }
}

function buildScopeAllocation(
  scope: SimulatorOwnedNonRothIraPlanningAllocationEvidence['calculationScope'],
  annualBasisRatio: Readonly<SimulatorOwnedNonRothIraPlanningBasisRatio>,
  activities: readonly CanonicalActivity[],
  annualAllocations: ReadonlyMap<string, Readonly<{
    basisAmount: bigint
    residualCentAwarded: 0 | 1
  }>>,
): SimulatorOwnedNonRothIraPlanningAllocationEvidence {
  const annualGross = safeCents(
    activities.reduce((sum, activity) => sum + BigInt(activity.grossAmount), 0n),
    `${scope} gross`,
  )
  const allocations = activities.map((activity) => {
    const allocation = annualAllocations.get(activity.activityId)
    if (allocation === undefined) {
      throw new Error('Annual planning allocation omitted a settled activity')
    }
    const { basisAmount, residualCentAwarded } = allocation
    if (activity.allocationActionId === null) {
      throw new Error('Only canonical line applications can receive basis allocation')
    }
    const ordinaryAmount = BigInt(activity.grossAmount) - basisAmount
    return {
      activityId: activity.activityId,
      actionId: activity.allocationActionId,
      sourceAccountId: activity.sourceAccountId,
      executionDate: activity.executionDate,
      executionSequence: activity.executionSequence,
      grossAmount: activity.grossAmount,
      allocatedBasisAmount: safeCents(basisAmount, `${scope} activity basis`),
      ordinaryIncomeAmount: safeCents(
        ordinaryAmount,
        `${scope} activity ordinary income`,
      ),
      residualCentAwarded,
    }
  })
  const annualBasisReturnAmount = safeCents(
    allocations.reduce(
      (sum, allocation) => sum + BigInt(allocation.allocatedBasisAmount),
      0n,
    ),
    `${scope} basis`,
  )
  const withoutId = {
    calculationScope: scope,
    annualGrossAmount: annualGross,
    annualBasisReturnAmount,
    annualOrdinaryIncomeAmount: safeCents(
      BigInt(annualGross) - BigInt(annualBasisReturnAmount),
      `${scope} ordinary income`,
    ),
    annualBasisRatio,
    residualAllocationOrder:
      'executionDateThenSequenceThenActivityId' as const,
    allocations,
  }
  return {
    ...withoutId,
    evidenceId: deriveActionStructuralId(
      'simulator-owned-ira-planning-allocation',
      [withoutId],
    ),
  }
}

/**
 * Form 8606 applies one annual pro-rata ratio across distributions and Roth
 * conversions. Round the combined annual basis return once, allocate every
 * residual cent across that combined set, and only then partition the evidence
 * into its deliberately distinct projection scopes.
 */
function allocateAnnualScopes(
  annualBasisRatio: Readonly<SimulatorOwnedNonRothIraPlanningBasisRatio>,
  distributions: readonly CanonicalActivity[],
  conversions: readonly CanonicalActivity[],
): Readonly<{
  distributionAllocation: SimulatorOwnedNonRothIraPlanningAllocationEvidence
  conversionAllocation: SimulatorOwnedNonRothIraPlanningAllocationEvidence
}> {
  const activities = [...distributions, ...conversions]
    .sort(canonicalActivityOrder)
  const annualGross = safeCents(
    activities.reduce((sum, activity) => sum + BigInt(activity.grossAmount), 0n),
    'Combined annual planning gross',
  )
  const allocations = new Map<string, {
    basisAmount: bigint
    residualCentAwarded: 0 | 1
  }>()
  if (annualGross > 0) {
    if (annualBasisRatio.representation !== 'exactMinorUnitRational') {
      throw new RangeError('Positive planning activity requires a positive denominator')
    }
    const numerator = BigInt(annualBasisRatio.numeratorMinorUnits)
    const denominator = BigInt(annualBasisRatio.denominatorMinorUnits)
    const annualBasis = exactHalfUp(BigInt(annualGross) * numerator, denominator)
    const floors = activities.map((activity) => {
      const product = BigInt(activity.grossAmount) * numerator
      return {
        activity,
        floor: product / denominator,
        remainder: product % denominator,
      }
    })
    const floorTotal = floors.reduce((sum, item) => sum + item.floor, 0n)
    const residualCount = annualBasis - floorTotal
    const eligible = floors.filter((item) => item.remainder > 0n)
    if (residualCount < 0n || residualCount > BigInt(eligible.length)) {
      throw new Error('Combined annual residual-cent allocation is inconsistent')
    }
    const awarded = new Set(
      eligible.slice(0, Number(residualCount))
        .map((item) => item.activity.activityId),
    )
    for (const { activity, floor } of floors) {
      const residualCentAwarded = awarded.has(activity.activityId) ? 1 : 0
      allocations.set(activity.activityId, {
        basisAmount: floor + BigInt(residualCentAwarded),
        residualCentAwarded,
      })
    }
  }
  return {
    distributionAllocation: buildScopeAllocation(
      'projectionPlanningDistributions',
      annualBasisRatio,
      distributions,
      allocations,
    ),
    conversionAllocation: buildScopeAllocation(
      'projectionPlanningNetConversions',
      annualBasisRatio,
      conversions,
      allocations,
    ),
  }
}

function priorPlanningArithmeticIsCanonical(
  value: Record<string, unknown>,
  accountSet: ReadonlySet<AccountId>,
): boolean {
  try {
    const cents = (raw: unknown): UsdCents => {
      if (typeof raw !== 'number') throw new TypeError('expected cents')
      return asUsdCents(raw)
    }
    const opening = cents(value.openingPlanningBasisAmount)
    const inYear = cents(value.inYearNondeductibleContributionAmount)
    const postYear = cents(
      value.postYearPriorTaxYearNondeductibleContributionAmount,
    )
    const numerator = cents(value.allocationBasisNumeratorAmount)
    const observedBalance = cents(
      value.observedYearEndApplicablePoolBalanceAmount,
    )
    const denominator = cents(value.annualBasisDenominatorAmount)
    const nextYear = cents(value.nextYearOpeningPlanningBasisAmount)
    if (!Array.isArray(value.postYearPriorTaxYearContributionAssumptions) ||
        !isRecord(value.distributionAllocation) ||
        !isRecord(value.conversionAllocation) ||
        !isRecord(value.annualBasisRatio)) return false

    const priorTaxYear = Number(value.taxYear)
    const priorDeadline = ordinaryFederalFilingDeadline(priorTaxYear)
    if (priorDeadline === null) return false
    let postYearSum = 0n
    const postYearKeys = new Set<string>()
    let priorPostYearOrder: readonly [string, string] | null = null
    for (const raw of value.postYearPriorTaxYearContributionAssumptions) {
      if (!isRecord(raw) ||
          raw.designatedTaxYear !== value.taxYear ||
          canonicalDate(raw.contributionDate) === null) return false
      const parsedSource = accountIdSchema.safeParse(raw.sourceAccountId)
      if (!parsedSource.success || !accountSet.has(parsedSource.data) ||
          typeof raw.nondeductibleContributionAmount !== 'number') return false
      const contributionDate = String(raw.contributionDate)
      const postYearStart = `${String(priorTaxYear + 1).padStart(4, '0')}-01-01`
      const key = JSON.stringify([
        parsedSource.data,
        raw.designatedTaxYear,
        contributionDate,
      ])
      const currentOrder = [contributionDate, parsedSource.data] as const
      if (contributionDate < postYearStart || contributionDate > priorDeadline ||
          postYearKeys.has(key) ||
          (priorPostYearOrder !== null &&
            (compareUtf16CodeUnits(priorPostYearOrder[0], currentOrder[0]) > 0 ||
              (priorPostYearOrder[0] === currentOrder[0] &&
                compareUtf16CodeUnits(
                  priorPostYearOrder[1],
                  currentOrder[1],
                ) >= 0)))) return false
      postYearKeys.add(key)
      priorPostYearOrder = currentOrder
      postYearSum += BigInt(asPositiveUsdCents(
        raw.nondeductibleContributionAmount,
      ))
    }
    if (safeCents(postYearSum, 'Prior post-year contribution sum') !== postYear ||
        safeCents(
          BigInt(opening) + BigInt(inYear),
          'Prior allocation numerator',
        ) !== numerator) return false

    const activityIds = new Set<string>()
    const canonicalScope = (
      rawScope: Record<string, unknown>,
      scope: SimulatorOwnedNonRothIraPlanningAllocationEvidence['calculationScope'],
      activityKind: 'distribution' | 'rothConversion',
    ): CanonicalActivity[] => {
      if (rawScope.calculationScope !== scope ||
          rawScope.residualAllocationOrder !==
            'executionDateThenSequenceThenActivityId' ||
          !Array.isArray(rawScope.allocations)) {
        throw new TypeError('invalid prior allocation scope')
      }
      const activities: CanonicalActivity[] = []
      let grossSum = 0n
      let basisSum = 0n
      let ordinarySum = 0n
      for (const raw of rawScope.allocations) {
        if (!isRecord(raw) || !nonblank(raw.activityId) ||
            activityIds.has(raw.activityId) || !nonblank(raw.actionId) ||
            canonicalDate(raw.executionDate) === null ||
            !Number.isSafeInteger(raw.executionSequence) ||
            Number(raw.executionSequence) <= 0) {
          throw new TypeError('invalid prior allocation entry')
        }
        const parsedSource = accountIdSchema.safeParse(raw.sourceAccountId)
        if (!parsedSource.success || !accountSet.has(parsedSource.data) ||
            typeof raw.grossAmount !== 'number' ||
            String(raw.executionDate) < `${priorTaxYear}-01-01` ||
            String(raw.executionDate) > `${priorTaxYear}-12-31`) {
          throw new TypeError('invalid prior allocation source')
        }
        const gross = asPositiveUsdCents(raw.grossAmount)
        const allocatedBasis = cents(raw.allocatedBasisAmount)
        const ordinaryIncome = cents(raw.ordinaryIncomeAmount)
        if (BigInt(allocatedBasis) + BigInt(ordinaryIncome) !== BigInt(gross) ||
            (raw.residualCentAwarded !== 0 &&
              raw.residualCentAwarded !== 1)) {
          throw new RangeError('invalid prior allocation arithmetic')
        }
        activityIds.add(raw.activityId)
        grossSum += BigInt(gross)
        basisSum += BigInt(allocatedBasis)
        ordinarySum += BigInt(ordinaryIncome)
        activities.push({
          activityId: raw.activityId,
          authorityKind: 'derivedRuntimeAction',
          authorityId: raw.actionId,
          allocationActionId: raw.actionId,
          sourceAccountId: parsedSource.data,
          activityKind,
          executionDate: String(raw.executionDate),
          executionSequence: Number(raw.executionSequence),
          grossAmount: gross,
          upstreamEvidenceId: raw.actionId,
        })
      }
      if (activities.some((activity, index) => index > 0 &&
          canonicalActivityOrder(activities[index - 1]!, activity) >= 0)) {
        throw new RangeError('noncanonical prior allocation order')
      }
      if (safeCents(grossSum, 'Prior scope gross') !==
            cents(rawScope.annualGrossAmount) ||
          safeCents(basisSum, 'Prior scope basis') !==
            cents(rawScope.annualBasisReturnAmount) ||
          safeCents(ordinarySum, 'Prior scope ordinary income') !==
            cents(rawScope.annualOrdinaryIncomeAmount)) {
        throw new RangeError('invalid prior allocation totals')
      }
      return activities
    }
    const distribution = value.distributionAllocation
    const conversion = value.conversionAllocation
    const distributions = canonicalScope(
      distribution,
      'projectionPlanningDistributions',
      'distribution',
    )
    const conversions = canonicalScope(
      conversion,
      'projectionPlanningNetConversions',
      'rothConversion',
    )
    const distributionGross = cents(distribution.annualGrossAmount)
    const conversionGross = cents(conversion.annualGrossAmount)
    const expectedDenominator = safeCents(
      BigInt(observedBalance) + BigInt(distributionGross) +
        BigInt(conversionGross),
      'Prior annual denominator',
    )
    if (expectedDenominator !== denominator) return false
    const expectedRatio = ratio(numerator, denominator)
    if (deriveActionStructuralId(
      'simulator-owned-ira-prior-ratio-rejoin',
      [value.annualBasisRatio],
    ) !== deriveActionStructuralId(
      'simulator-owned-ira-prior-ratio-rejoin',
      [expectedRatio],
    )) return false
    const expectedAllocations = allocateAnnualScopes(
      expectedRatio,
      distributions,
      conversions,
    )
    if (deriveActionStructuralId(
      'simulator-owned-ira-prior-allocation-rejoin',
      [distribution, conversion],
    ) !== deriveActionStructuralId(
      'simulator-owned-ira-prior-allocation-rejoin',
      [expectedAllocations.distributionAllocation,
        expectedAllocations.conversionAllocation],
    )) return false
    const recovered = BigInt(
      expectedAllocations.distributionAllocation.annualBasisReturnAmount,
    ) + BigInt(
      expectedAllocations.conversionAllocation.annualBasisReturnAmount,
    )
    if (recovered > BigInt(numerator)) return false
    return safeCents(
      BigInt(opening) + BigInt(inYear) + BigInt(postYear) - recovered,
      'Prior next-year opening basis',
    ) === nextYear
  } catch {
    return false
  }
}

function buildUnchecked(
  input: Readonly<BuildSimulatorOwnedNonRothIraAnnualPlanningEvidenceInput>,
): Readonly<BuildSimulatorOwnedNonRothIraAnnualPlanningEvidenceResult> {
  // Snapshot caller-controlled roots before validation. Stateful accessors may
  // not replace validated data before it is bound into planning evidence.
  const rawPlan = input.plan
  const rawOwnerPersonId = input.ownerPersonId
  const rawTaxYear = input.taxYear
  const rawProjectionStartTaxYear = input.projectionStartTaxYear
  const rawLedgerRunId = input.ledgerRunId
  const rawObservation = input.annualObservation
  const rawPhysicalTransaction = input.annualPhysicalTransaction
  const rawAssumptions = input.assumptions
  const rawPriorCarryforwardEvidence = input.priorCarryforwardEvidence
  const rawPriorPlanningEvidence = input.priorPlanningEvidence
  let snapshot: {
    plan: unknown
    observation: unknown
    physicalTransaction: unknown
    assumptions: unknown
    priorCarryforwardEvidence: unknown
    priorPlanningEvidence: unknown
  }
  try {
    snapshot = structuredClone({
      plan: rawPlan,
      observation: rawObservation,
      physicalTransaction: rawPhysicalTransaction,
      assumptions: rawAssumptions,
      priorCarryforwardEvidence: rawPriorCarryforwardEvidence,
      priorPlanningEvidence: rawPriorPlanningEvidence,
    })
  } catch (error) {
    return blocked([issue(
      'inputInvalid',
      `Planning inputs must be detached data: ${safeError(error)}`,
    )])
  }
  const parsedPlan = planSchema.safeParse(snapshot.plan)
  if (!parsedPlan.success) {
    return blocked([issue('planInvalid', 'Planning evidence requires a valid Plan')])
  }
  const parsedOwner = personIdSchema.safeParse(rawOwnerPersonId)
  if (!parsedOwner.success) {
    return blocked([issue('ownerInvalid', 'Planning owner ID must be nonblank')])
  }
  if (!Number.isInteger(rawTaxYear) || rawTaxYear < 1 || rawTaxYear > 9998) {
    return blocked([issue(
      'taxYearInvalid',
      'Planning tax year must be an integer from 1 through 9998',
    )])
  }
  if (!Number.isInteger(rawProjectionStartTaxYear) ||
      rawProjectionStartTaxYear < 1 ||
      rawProjectionStartTaxYear > rawTaxYear) {
    return blocked([issue(
      'taxYearInvalid',
      'Projection start tax year must be an integer no later than the planning tax year',
    )])
  }
  if (!nonblank(rawLedgerRunId)) {
    return blocked([issue('ledgerRunInvalid', 'Planning ledger-run ID must be nonblank')])
  }

  const plan = parsedPlan.data
  const ownerPersonId = parsedOwner.data
  const taxYear = rawTaxYear
  const projectionStartTaxYear = rawProjectionStartTaxYear
  const ledgerRunId = rawLedgerRunId
  let planId: PlanId
  try {
    planId = planIdSchema.parse(plan.id)
  } catch {
    return blocked([issue('planInvalid', 'Planning evidence requires a valid Plan ID')])
  }
  if (!plan.household.people.some((person) => person.id === ownerPersonId)) {
    return blocked([issue('ownerNotFound', 'Planning owner must belong to the Plan')])
  }
  const accountIds = ownedIraPool(plan, ownerPersonId)
  if (accountIds.length === 0) {
    return blocked([issue(
      'ownedIraPoolEmpty',
      'Planning evidence requires at least one Plan-owned non-inherited IRA',
    )])
  }
  const accountSet = new Set(accountIds)

  const observation = snapshot.observation
  if (!isRecord(observation)) {
    return blocked([issue('observationInvalid', 'Annual observation must be an object')])
  }
  const observationIssues: SimulatorOwnedNonRothIraAnnualPlanningEvidenceIssue[] = []
  const observationBalances = observation.yearEndApplicableBalances
  const basisObservation = observation.startOfTaxYearBasisObservation
  const projectionWindow = observation.projectionPostYearContributionWindow
  const evidenceScope = observation.evidenceScope
  if (
    observation.predicate !== 'completeSimulatorOwnedNonRothIraAnnualObservation' ||
    observation.planId !== planId || observation.ownerPersonId !== ownerPersonId ||
    observation.taxYear !== taxYear || observation.ledgerRunId !== ledgerRunId ||
    observation.observationBoundary !== 'sealedAfterAllAnnualTransactionsAndGrowth' ||
    observation.asOfDate !== `${String(taxYear).padStart(4, '0')}-12-31` ||
    !nonblank(observation.evidenceId) || !Array.isArray(observationBalances) ||
    !isRecord(basisObservation) || !isRecord(projectionWindow) ||
    !isRecord(evidenceScope)
  ) {
    observationIssues.push(issue(
      'observationBindingMismatch',
      'Annual observation must exactly bind the Plan, owner, year, ledger, and sealed post-growth boundary',
    ))
  }
  if (
    !isRecord(evidenceScope) ||
    evidenceScope.scope !== 'projectionModelOnlyNotRealWorldFilingCompleteness' ||
    evidenceScope.planId !== planId || evidenceScope.ownerPersonId !== ownerPersonId ||
    evidenceScope.taxYear !== taxYear || evidenceScope.ledgerRunId !== ledgerRunId ||
    !nonblank(evidenceScope.evidenceId)
  ) {
    observationIssues.push(issue(
      'observationInvalid',
      'Annual observation must retain its projection-only evidence scope',
    ))
  }
  let openingObserved: UsdCents | null = null
  if (isRecord(basisObservation)) {
    try {
      openingObserved = asUsdCents(basisObservation.startOfTaxYearIraBasisAmount)
    } catch {
      observationIssues.push(issue(
        'observationInvalid',
        'Observed opening basis must be exact nonnegative safe-integer cents',
      ))
    }
    if (
      basisObservation.predicate !==
        'simulatorOwnedNonRothIraStartOfTaxYearBasisObservation' ||
      basisObservation.planId !== planId ||
      basisObservation.ownerPersonId !== ownerPersonId ||
      basisObservation.taxYear !== taxYear || basisObservation.ledgerRunId !== ledgerRunId ||
      basisObservation.evidenceScope !==
        'projectionModelOnlyNotRealWorldFilingCompleteness' ||
      basisObservation.rolloverFactsStatus !== 'notRepresentedByProjection' ||
      !nonblank(basisObservation.evidenceId)
    ) observationIssues.push(issue('observationInvalid', 'Opening basis observation is incomplete'))
  }
  let deadlineDate: string | null = null
  const expectedDeadlineDate = ordinaryFederalFilingDeadline(taxYear)
  if (isRecord(projectionWindow)) {
    const deadline = projectionWindow.deadlineObservation
    if (
      projectionWindow.predicate !==
        'simulatorOwnedNonRothIraProjectionPostYearContributionWindow' ||
      projectionWindow.planId !== planId ||
      projectionWindow.ownerPersonId !== ownerPersonId ||
      projectionWindow.taxYear !== taxYear ||
      projectionWindow.ledgerRunId !== ledgerRunId ||
      projectionWindow.inventoryStatus !==
        'explicitlyEmptyWithinProjectionModelOnly' ||
      projectionWindow.realWorldFilingCompleteness !== 'notEstablished' ||
      !Array.isArray(projectionWindow.contributions) ||
      projectionWindow.contributions.length !== 0 || !isRecord(deadline)
    ) {
      observationIssues.push(issue(
        'observationInvalid',
        'Projection contribution-window observation is incomplete',
      ))
    } else {
      deadlineDate = canonicalDate(deadline.deadlineDate)
      if (
        deadline.predicate !==
          'simulatorOwnedNonRothIraOrdinaryDeadlineObservation' ||
        deadline.planId !== planId || deadline.ownerPersonId !== ownerPersonId ||
        deadline.designatedTaxYear !== taxYear ||
        deadline.ledgerRunId !== ledgerRunId ||
        deadline.evidenceScope !==
          'projectionModelOnlyNotAuthoritativeFilingEvidence' ||
        deadline.deadlineStatus !==
          'modeledOrdinaryFederalDeadlineCalculated' ||
        deadline.deadlineKind !==
          'ordinaryFederalFilingDeadlineExcludingDisasterRelief' ||
        deadline.calendarAdjustmentStatus !==
          'weekendAndDistrictOfColumbiaHolidayAdjustmentApplied' ||
        expectedDeadlineDate === null || deadlineDate !== expectedDeadlineDate ||
        !nonblank(deadline.evidenceId)
      ) observationIssues.push(issue('observationInvalid', 'Modeled deadline observation is incomplete'))
    }
  }
  let observedAggregate: UsdCents | null = null
  const observedByAccount = new Map<AccountId, UsdCents>()
  if (Array.isArray(observationBalances)) {
    for (const raw of observationBalances) {
      if (!isRecord(raw)) {
        observationIssues.push(issue('observationInvalid', 'Every observed balance must be an object'))
        continue
      }
      const parsedAccount = accountIdSchema.safeParse(raw.sourceAccountId)
      let amount: UsdCents | null = null
      try { amount = asUsdCents(raw.yearEndApplicableBalanceAmount) } catch {
        observationIssues.push(issue('observationInvalid', 'Observed balance must be exact cents'))
      }
      if (!parsedAccount.success || amount === null ||
          !accountSet.has(parsedAccount.success ? parsedAccount.data : '' as AccountId) ||
          observedByAccount.has(parsedAccount.success ? parsedAccount.data : '' as AccountId) ||
          raw.predicate !==
            'simulatorOwnedNonRothIraYearEndApplicableBalanceObservation' ||
          raw.planId !== planId || raw.ownerPersonId !== ownerPersonId ||
          raw.taxYear !== taxYear || raw.ledgerRunId !== ledgerRunId ||
          raw.asOfDate !== `${String(taxYear).padStart(4, '0')}-12-31` ||
          raw.ledgerPhase !==
            'projectionModelDecember31AfterAllAnnualTransactionsAndGrowth' ||
          !nonblank(raw.evidenceId)) {
        observationIssues.push(issue(
          'observationInvalid',
          'Every observed balance must uniquely bind a complete Plan-pool member and December 31',
          { sourceAccountId: typeof raw.sourceAccountId === 'string' ? raw.sourceAccountId : undefined },
        ))
        continue
      }
      observedByAccount.set(parsedAccount.data, amount)
    }
    if (!sameStrings([...observedByAccount.keys()].sort(compareUtf16CodeUnits), accountIds)) {
      observationIssues.push(issue(
        'observationInvalid',
        'Observed balances must include the exact Plan-owned IRA pool, including zero siblings',
      ))
    }
    try {
      observedAggregate = safeCents(
        [...observedByAccount.values()].reduce((sum, amount) => sum + BigInt(amount), 0n),
        'Observed year-end pool',
      )
      if (observation.aggregateYearEndApplicableBalanceAmount !== observedAggregate) {
        observationIssues.push(issue(
          'observationInvalid',
          'Observed year-end aggregate must equal all observed members',
        ))
      }
    } catch (error) {
      observationIssues.push(issue('amountOverflow', safeError(error)))
    }
  }
  if (observationIssues.length > 0 || openingObserved === null ||
      observedAggregate === null || deadlineDate === null) {
    return blocked(observationIssues.length > 0
      ? observationIssues
      : [issue('observationInvalid', 'Annual observation is incomplete')])
  }
  const scopeRecord = evidenceScope as Record<string, unknown>
  const basisRecord = basisObservation as Record<string, unknown>
  const balanceRecords = observationBalances as Record<string, unknown>[]
  const windowRecord = projectionWindow as Record<string, unknown>
  try {
    const deadline = windowRecord
      .deadlineObservation as Record<string, unknown>
    const expectedScopeUpstreamEvidenceId = deriveActionStructuralId(
      'simulator-owned-ira-annual-observation-scope-upstream',
      [planId, ownerPersonId, taxYear, ledgerRunId,
        observation.observationBoundary],
    )
    if (
      scopeRecord.upstreamEvidenceId !== expectedScopeUpstreamEvidenceId ||
      !objectEvidenceIdMatches(
        scopeRecord,
        'simulator-owned-ira-annual-observation-scope',
      ) ||
      basisRecord.upstreamEvidenceId !== deriveActionStructuralId(
        'simulator-owned-ira-annual-basis-upstream',
        [scopeRecord.evidenceId, openingObserved],
      ) ||
      !objectEvidenceIdMatches(
        basisRecord,
        'simulator-owned-ira-annual-basis',
      )
    ) {
      return blocked([issue(
        'observationInvalid',
        'Annual observation scope or opening-basis lineage is not canonical',
      )])
    }
    for (const raw of balanceRecords) {
      if (
        raw.upstreamEvidenceId !== deriveActionStructuralId(
          'simulator-owned-ira-year-end-balance-upstream',
          [scopeRecord.evidenceId, raw.sourceAccountId, observation.asOfDate,
            raw.yearEndApplicableBalanceAmount],
        ) ||
        !objectEvidenceIdMatches(
          raw,
          'simulator-owned-ira-year-end-balance',
        )
      ) {
        return blocked([issue(
          'observationInvalid',
          'A December 31 balance observation has noncanonical lineage',
          {
            sourceAccountId: typeof raw.sourceAccountId === 'string'
              ? raw.sourceAccountId
              : undefined,
          },
        )])
      }
    }
    if (
      deadline.upstreamEvidenceId !== deriveActionStructuralId(
        'simulator-owned-ira-contribution-deadline-upstream',
        [scopeRecord.evidenceId, taxYear, deadlineDate],
      ) ||
      !objectEvidenceIdMatches(
        deadline,
        'simulator-owned-ira-contribution-deadline',
      ) ||
      windowRecord.upstreamEvidenceId !== deriveActionStructuralId(
        'simulator-owned-ira-post-year-contribution-window-upstream',
        [scopeRecord.evidenceId, deadline],
      ) ||
      !objectEvidenceIdMatches(
        windowRecord,
        'simulator-owned-ira-post-year-contribution-window',
      )
    ) {
      return blocked([issue(
        'observationInvalid',
        'Contribution deadline or post-year window lineage is not canonical',
      )])
    }
    const { evidenceId: suppliedObservationEvidenceId, ...observationBody } =
      observation
    if (suppliedObservationEvidenceId !== deriveActionStructuralId(
      'simulator-owned-ira-annual-observation',
      [observationBody],
    )) {
      return blocked([issue(
        'observationInvalid',
        'Annual observation evidence ID must bind its canonical complete contents',
        {
          identifier: typeof suppliedObservationEvidenceId === 'string'
            ? suppliedObservationEvidenceId
            : undefined,
        },
      )])
    }
  } catch (error) {
    return blocked([issue(
      'observationInvalid',
      `Annual observation identity could not be verified: ${safeError(error)}`,
    )])
  }

  const transaction = snapshot.physicalTransaction
  if (!isRecord(transaction) || !isRecord(transaction.inventory) ||
      !Array.isArray(transaction.inventory.ownedIraPools) ||
      !Array.isArray(transaction.applications) ||
      !Array.isArray(transaction.settledContributionApplications) ||
      !Array.isArray(transaction.sourceBalanceTransitions) ||
      !Array.isArray(transaction.stagedDestinationCredits) ||
      !Array.isArray(transaction.line7Entries) ||
      !Array.isArray(transaction.line8Entries) ||
      !Array.isArray(transaction.issues) ||
      !isRecord(transaction.line8InventoryEvidence)) {
    return blocked([issue(
      'activityInventoryInvalid',
      'Planning evidence requires a complete prepared annual physical transaction',
    )])
  }
  if (
    transaction.status !== 'unifiedAnnualPhysicalTransactionPrepared' ||
    transaction.movement !== 'notCommitted' ||
    transaction.actionability !== 'notEstablished' ||
    transaction.transactionStatus !== 'appliedToDetachedSnapshotOnly' ||
    transaction.planId !== planId || transaction.ownerPersonId !== ownerPersonId ||
    transaction.taxYear !== taxYear || transaction.ledgerRunId !== ledgerRunId ||
    !nonblank(transaction.transactionEvidenceId) ||
    transaction.issues.length !== 0 ||
    transaction.inventory.planId !== planId ||
    transaction.inventory.taxYear !== taxYear ||
    transaction.inventory.ledgerRunId !== ledgerRunId ||
    !nonblank(transaction.inventory.inventoryEvidenceId)
  ) return blocked([issue(
    'activityInventoryBindingMismatch',
    'Prepared physical transaction must exactly bind the Plan, owner, year, ledger, detached status, and complete source inventory',
  )])
  const expectedLine7Entries: Array<Record<string, unknown>> = []
  const expectedLine8Entries: Array<Record<string, unknown>> = []
  const applicationIds = new Set<string>()
  const applicationsByEventId = new Map<string, Record<string, unknown>>()
  let expectedLine7Gross = 0n
  let expectedLine8Gross = 0n
  for (const raw of transaction.applications) {
    if (!isRecord(raw)) {
      return blocked([issue(
        'activityInventoryInvalid',
        'Every prepared physical application must be an object',
      )])
    }
    let requested: UsdCents
    let executed: UsdCents
    let unexecuted: UsdCents
    let before: UsdCents
    let after: UsdCents
    try {
      requested = asUsdCents(raw.requestedAmount)
      executed = asUsdCents(raw.executedAmount)
      unexecuted = asUsdCents(raw.unexecutedAmount)
      before = asUsdCents(raw.sourceBalanceBefore)
      after = asUsdCents(raw.sourceBalanceAfter)
    } catch {
      return blocked([issue(
        'activityInventoryInvalid',
        'Prepared application money must remain exact nonnegative safe-integer cents',
      )])
    }
    const parsedSource = accountIdSchema.safeParse(raw.sourceAccountId)
    if (
      raw.predicate !== 'ownedNonRothIraUnifiedAnnualPhysicalApplication' ||
      raw.planId !== planId || raw.ownerPersonId !== ownerPersonId ||
      raw.taxYear !== taxYear || raw.ledgerRunId !== ledgerRunId ||
      raw.inventoryEvidenceId !== transaction.inventory.inventoryEvidenceId ||
      !nonblank(raw.inventoryEventId) ||
      applicationIds.has(String(raw.inventoryEventId)) ||
      !nonblank(raw.actionId) || !nonblank(raw.allocationId) ||
      !parsedSource.success || !accountSet.has(parsedSource.data) ||
      canonicalDate(raw.scheduledDate) === null ||
      !Number.isSafeInteger(raw.scheduledSequence) ||
      Number(raw.scheduledSequence) <= 0 ||
      !nonblank(raw.stagingEvidenceId) ||
      !nonblank(raw.applicationEvidenceId) ||
      requested !== executed + unexecuted ||
      executed > before || after !== before - executed ||
      (raw.lineScope !== 'form8606Line7Distributions' &&
        raw.lineScope !== 'form8606Line8NetConversions')
    ) {
      return blocked([issue(
        'activityInventoryInvalid',
        'Prepared application must exactly bind one canonical owner-pool event and its before/executed/after arithmetic',
        {
          activityId: typeof raw.inventoryEventId === 'string'
            ? raw.inventoryEventId
            : undefined,
        },
      )])
    }
    applicationIds.add(raw.inventoryEventId)
    applicationsByEventId.set(raw.inventoryEventId, raw)
    const applicationWithoutEvidence = {
      predicate: raw.predicate,
      planId,
      ownerPersonId,
      taxYear,
      ledgerRunId,
      inventoryEvidenceId: raw.inventoryEvidenceId,
      inventoryEventId: raw.inventoryEventId,
      eventOrigin: raw.eventOrigin,
      eventKind: raw.eventKind,
      lineScope: raw.lineScope,
      actionId: raw.actionId,
      allocationId: raw.allocationId,
      sourceAccountId: parsedSource.data,
      scheduledDate: raw.scheduledDate,
      scheduledSequence: raw.scheduledSequence,
      requestedAmount: requested,
      sourceBalanceBefore: before,
      executedAmount: executed,
      unexecutedAmount: unexecuted,
      sourceBalanceAfter: after,
      stagingEvidenceId: raw.stagingEvidenceId,
    }
    if (!derivedIdMatches(
      raw.applicationEvidenceId,
      'owned-ira-unified-annual-physical-application',
      [applicationWithoutEvidence],
    )) {
      return blocked([issue(
        'activityInventoryInvalid',
        'Prepared application evidence ID must bind its canonical exact-cent contents',
        { activityId: raw.inventoryEventId },
      )])
    }
    if (executed > 0) {
      const entry = {
        actionId: raw.actionId,
        allocationId: raw.allocationId,
        sourceAccountId: parsedSource.data,
        scheduledDate: raw.scheduledDate,
        scheduledSequence: raw.scheduledSequence,
        grossAmount: executed,
      }
      if (raw.lineScope === 'form8606Line7Distributions') {
        expectedLine7Entries.push(entry)
        expectedLine7Gross += BigInt(executed)
      } else {
        expectedLine8Entries.push(entry)
        expectedLine8Gross += BigInt(executed)
      }
    }
  }
  const contributionApplicationIds = new Set<string>()
  const contributionApplicationsByEventId =
    new Map<string, Record<string, unknown>>()
  for (const raw of transaction.settledContributionApplications) {
    if (!isRecord(raw)) {
      return blocked([issue(
        'activityInventoryInvalid',
        'Every settled contribution application must be an object',
      )])
    }
    let inventoried: UsdCents
    let before: UsdCents
    let credited: UsdCents
    let after: UsdCents
    try {
      inventoried = asUsdCents(raw.inventoriedAmount)
      before = asUsdCents(raw.sourceBalanceBefore)
      credited = asUsdCents(raw.creditedAmount)
      after = asUsdCents(raw.sourceBalanceAfter)
    } catch {
      return blocked([issue(
        'activityInventoryInvalid',
        'Settled contribution application money must remain exact nonnegative safe-integer cents',
      )])
    }
    const parsedSource = accountIdSchema.safeParse(raw.sourceAccountId)
    if (raw.predicate !==
          'ownedNonRothIraSettledAnnualContributionApplication' ||
        raw.planId !== planId || raw.ownerPersonId !== ownerPersonId ||
        raw.taxYear !== taxYear || raw.ledgerRunId !== ledgerRunId ||
        raw.inventoryEvidenceId !== transaction.inventory.inventoryEvidenceId ||
        !nonblank(raw.inventoryEventId) ||
        contributionApplicationIds.has(String(raw.inventoryEventId)) ||
        raw.eventOrigin !== 'contributionLedger' ||
        (raw.eventKind !== 'ownedIraContribution' &&
          raw.eventKind !== 'ownedIraEmployerContribution') ||
        !nonblank(raw.movementAuthorityId) || !parsedSource.success ||
        !accountSet.has(parsedSource.success
          ? parsedSource.data
          : '' as AccountId) ||
        canonicalDate(raw.scheduledDate) === null ||
        !Number.isSafeInteger(raw.scheduledSequence) ||
        Number(raw.scheduledSequence) <= 0 ||
        !nonblank(raw.inventoryEventUpstreamEvidenceId) ||
        !nonblank(raw.stagingEvidenceId) ||
        !nonblank(raw.applicationEvidenceId) ||
        credited !== inventoried ||
        BigInt(before) + BigInt(credited) > MAX_SAFE_CENTS ||
        after !== before + credited) {
      return blocked([issue(
        'activityInventoryInvalid',
        'Settled contribution application must bind one canonical owner-pool inflow and exact before/credited/after arithmetic',
        {
          activityId: typeof raw.inventoryEventId === 'string'
            ? raw.inventoryEventId
            : undefined,
        },
      )])
    }
    const applicationWithoutEvidence = {
      predicate: raw.predicate,
      planId,
      ownerPersonId,
      taxYear,
      ledgerRunId,
      inventoryEvidenceId: raw.inventoryEvidenceId,
      inventoryEventId: raw.inventoryEventId,
      eventOrigin: raw.eventOrigin,
      eventKind: raw.eventKind,
      movementAuthorityId: raw.movementAuthorityId,
      sourceAccountId: parsedSource.data,
      scheduledDate: raw.scheduledDate,
      scheduledSequence: raw.scheduledSequence,
      inventoriedAmount: inventoried,
      sourceBalanceBefore: before,
      creditedAmount: credited,
      sourceBalanceAfter: after,
      inventoryEventUpstreamEvidenceId: raw.inventoryEventUpstreamEvidenceId,
      stagingEvidenceId: raw.stagingEvidenceId,
    }
    if (!derivedIdMatches(
      raw.applicationEvidenceId,
      'owned-ira-unified-annual-settled-contribution-application',
      [applicationWithoutEvidence],
    )) {
      return blocked([issue(
        'activityInventoryInvalid',
        'Settled contribution application evidence ID must bind its canonical exact-cent contents',
        { activityId: raw.inventoryEventId },
      )])
    }
    contributionApplicationIds.add(raw.inventoryEventId)
    contributionApplicationsByEventId.set(raw.inventoryEventId, raw)
  }
  const transactionInventory = transaction.inventory
  if (
    transactionInventory.status !== 'annualPhysicalEventInventoryBuilt' ||
    transactionInventory.movement !== 'notCommitted' ||
    transactionInventory.actionability !== 'notEstablished' ||
    !Array.isArray(transactionInventory.events) ||
    !Array.isArray(transactionInventory.planOwnedIraActionIds) ||
    !Array.isArray(transactionInventory.issues) ||
    transactionInventory.issues.length !== 0 ||
    !nonblank(transactionInventory.runtimeInventoryEvidenceId) ||
    !nonblank(transactionInventory.runtimeInventoryUpstreamEvidenceId) ||
    !isRecord(transactionInventory.compatibility)
  ) {
    return blocked([issue(
      'activityInventoryInvalid',
      'Prepared transaction must retain the complete canonical annual inventory result',
    )])
  }
  const inventoryEvents = transactionInventory.events as unknown[]
  const inventoryPools = transactionInventory.ownedIraPools as unknown[]
  try {
    const eventParts = inventoryEvents.map((raw) => {
      if (!isRecord(raw) || !nonblank(raw.eventId)) {
        throw new Error('Every annual inventory event needs a stable identity')
      }
      return raw.origin === 'planAction'
        ? [
            raw.eventId,
            raw.origin,
            raw.kind,
            raw.actionId,
            raw.allocationId,
            raw.sourceAccountKind,
            raw.sourceInheritanceStatus,
            raw.destinationRothAccountId,
            raw.charity,
            raw.ownerPersonId,
            raw.sourceAccountId,
            raw.grossAmount,
            raw.eventDate,
            raw.eventSequence,
            raw.form8606Category,
          ]
        : [
            raw.eventId,
            raw.origin,
            raw.kind,
            raw.movementAuthorityId,
            raw.ownerPersonId,
            raw.sourceAccountId,
            raw.grossAmount,
            raw.eventDate,
            raw.eventSequence,
            raw.upstreamEvidenceId,
            raw.form8606Category,
          ]
    })
    const poolParts = inventoryPools.map((raw) => {
      if (!isRecord(raw) || !Array.isArray(raw.sourceAccountIds)) {
        throw new Error('Every annual owner pool must be canonical')
      }
      return [raw.ownerPersonId, raw.sourceAccountIds, raw.grossAmount]
    })
    if (!derivedIdMatches(
      transactionInventory.inventoryEvidenceId,
      'annual-retirement-physical-event-inventory',
      [
        planId,
        taxYear,
        ledgerRunId,
        transactionInventory.runtimeInventoryEvidenceId,
        transactionInventory.runtimeInventoryUpstreamEvidenceId,
        eventParts,
        poolParts,
        transactionInventory.planOwnedIraActionIds,
        transactionInventory.compatibility,
      ],
    )) {
      return blocked([issue(
        'activityInventoryInvalid',
        'Prepared annual inventory evidence ID must bind its canonical events and owner pools',
      )])
    }
  } catch (error) {
    return blocked([issue(
      'activityInventoryInvalid',
      `Prepared annual inventory identity could not be verified: ${safeError(error)}`,
    )])
  }

  const ownerPools = inventoryPools.filter(
    (pool): pool is Record<string, unknown> =>
    isRecord(pool) && pool.ownerPersonId === ownerPersonId)
  if (ownerPools.length !== 1 || !Array.isArray(ownerPools[0]!.events)) {
    return blocked([issue(
      'activityInventoryIncomplete',
      'Prepared transaction inventory must contain exactly one complete selected-owner IRA pool',
    )])
  }
  const selectedPool = ownerPools[0]!
  if (!Array.isArray(selectedPool.sourceAccountIds) ||
      !sameStrings(
        [...selectedPool.sourceAccountIds]
          .filter((value): value is string => typeof value === 'string')
          .sort(compareUtf16CodeUnits),
        accountIds,
      )) {
    return blocked([issue(
      'activityInventoryIncomplete',
      'Prepared selected-owner pool must bind the exact validated Plan IRA account set',
    )])
  }
  const selectedPoolEvents = selectedPool.events as unknown[]
  const globalEventsById = new Map<string, Record<string, unknown>>()
  for (const raw of inventoryEvents) {
    if (!isRecord(raw) || !nonblank(raw.eventId) ||
        globalEventsById.has(raw.eventId)) {
      return blocked([issue(
        'activityInventoryInvalid',
        'Prepared annual inventory events must have unique stable identities',
      )])
    }
    globalEventsById.set(raw.eventId, raw)
  }
  for (let index = 0; index < inventoryEvents.length; index += 1) {
    const current = inventoryEvents[index]
    if (!isRecord(current) || canonicalDate(current.eventDate) === null ||
        !Number.isSafeInteger(current.eventSequence) ||
        Number(current.eventSequence) <= 0 || !nonblank(current.origin)) {
      return blocked([issue(
        'activityInventoryInvalid',
        'Prepared annual inventory events must retain canonical civil-date chronology fields',
      )])
    }
    if (index === 0) continue
    const previous = inventoryEvents[index - 1]!
    if (!isRecord(previous)) continue
    const order = compareUtf16CodeUnits(
      String(previous.eventDate),
      String(current.eventDate),
    ) || Number(previous.eventSequence) - Number(current.eventSequence) ||
      compareUtf16CodeUnits(String(previous.origin), String(current.origin)) ||
      compareUtf16CodeUnits(String(previous.eventId), String(current.eventId))
    if (order > 0) {
      return blocked([issue(
        'activityChronologyInvalid',
        'Prepared annual inventory events must remain in canonical date, sequence, origin, and event-ID order',
      )])
    }
  }
  const canonicalSelectedPoolEvents = inventoryEvents.filter(
    (raw): raw is Record<string, unknown> =>
      isRecord(raw) && raw.ownerPersonId === ownerPersonId &&
      accountSet.has(String(raw.sourceAccountId) as AccountId),
  )
  if (canonicalSelectedPoolEvents.length !== selectedPoolEvents.length ||
      canonicalSelectedPoolEvents.some((raw, index) =>
        JSON.stringify(raw) !== JSON.stringify(selectedPoolEvents[index]))) {
    return blocked([issue(
      'activityInventoryInvalid',
      'Selected-owner pool events must retain the canonical global annual chronology in exact order',
    )])
  }
  const authorityByChronologySlot = new Map<string, string>()
  const bindingByAuthority = new Map<string, string>()
  const authoritySourcePairs = new Set<string>()
  for (const raw of canonicalSelectedPoolEvents) {
    const authorityKey = raw.origin === 'planAction'
      ? `plan:${String(raw.actionId)}`
      : `runtime:${String(raw.movementAuthorityId)}`
    const slot = JSON.stringify([raw.eventDate, raw.eventSequence])
    const existingSlotAuthority = authorityByChronologySlot.get(slot)
    if (existingSlotAuthority !== undefined &&
        existingSlotAuthority !== authorityKey) {
      return blocked([issue(
        'activityChronologyInvalid',
        'Different annual event authorities cannot occupy one chronology slot, including zero executions',
        { activityId: String(raw.eventId) },
      )])
    }
    authorityByChronologySlot.set(slot, authorityKey)
    const binding = JSON.stringify([
      raw.ownerPersonId,
      raw.kind,
      raw.origin,
      raw.eventDate,
      raw.eventSequence,
    ])
    const existingBinding = bindingByAuthority.get(authorityKey)
    if (existingBinding !== undefined && existingBinding !== binding) {
      return blocked([issue(
        'activityChronologyInvalid',
        'Every annual event authority must retain one owner, kind, origin, and chronology slot',
        { activityId: String(raw.eventId) },
      )])
    }
    bindingByAuthority.set(authorityKey, binding)
    const authoritySourcePair = JSON.stringify([
      authorityKey,
      raw.sourceAccountId,
    ])
    if (authoritySourcePairs.has(authoritySourcePair)) {
      return blocked([issue(
        'activityInventoryInvalid',
        'One annual event authority cannot repeat a source account, including zero executions',
        { activityId: String(raw.eventId) },
      )])
    }
    authoritySourcePairs.add(authoritySourcePair)
  }
  const lineInventoryEventIds = new Set<string>()
  const contributionInventoryEventIds = new Set<string>()
  let selectedPoolGross = 0n
  const categoryEventIds = new Map<string, string[]>()
  for (const raw of selectedPoolEvents) {
    if (!isRecord(raw) || !nonblank(raw.eventId)) {
      return blocked([issue(
        'activityInventoryInvalid',
        'Every selected-owner physical inventory event needs a stable identity',
      )])
    }
    const globalEvent = globalEventsById.get(raw.eventId)
    if (globalEvent === undefined || JSON.stringify(globalEvent) !==
        JSON.stringify(raw) || raw.ownerPersonId !== ownerPersonId ||
        !accountSet.has(String(raw.sourceAccountId) as AccountId)) {
      return blocked([issue(
        'activityInventoryInvalid',
        'Every selected-owner pool event must exact-join one canonical global inventory event',
        { activityId: raw.eventId },
      )])
    }
    try {
      selectedPoolGross += BigInt(asPositiveUsdCents(raw.grossAmount))
    } catch {
      return blocked([issue(
        'activityInventoryInvalid',
        'Every selected-owner pool event requires a positive exact-cent gross amount',
        { activityId: raw.eventId },
      )])
    }
    const categoryIds = categoryEventIds.get(String(raw.form8606Category)) ?? []
    categoryIds.push(raw.eventId)
    categoryEventIds.set(String(raw.form8606Category), categoryIds)
    if (raw.origin !== 'planAction') {
      const expectedRuntimeOrigin = raw.kind === 'ownedIraRmd' ||
          raw.kind === 'employerPlanRmd' || raw.kind === 'inheritedIraRmd'
        ? 'rmdEngine'
        : raw.kind === 'automaticSeppDistribution'
          ? 'seppEngine'
          : raw.kind === 'legacyNeedBasedWithdrawal' ||
              raw.kind === 'legacyRothConversion' || raw.kind === 'legacyQcd'
            ? 'legacyProjection'
            : raw.kind === 'ownedIraContribution' ||
                raw.kind === 'ownedIraEmployerContribution' ||
                raw.kind === 'employerPlanEmployeeContribution' ||
                raw.kind === 'employerPlanEmployerMatch'
              ? 'contributionLedger'
              : 'transferLedger'
      const expectedRuntimeCategory = raw.kind === 'legacyRothConversion'
        ? 'line8ConversionCandidate'
        : raw.kind === 'ownedIraRmd' ||
            raw.kind === 'automaticSeppDistribution' ||
            raw.kind === 'legacyNeedBasedWithdrawal'
          ? 'line7DistributionCandidate'
          : 'nonForm8606OrForeignPoolEvent'
      if (raw.planId !== planId || raw.taxYear !== taxYear ||
          raw.ledgerRunId !== ledgerRunId ||
          raw.ownerPersonId !== ownerPersonId ||
          raw.origin !== expectedRuntimeOrigin ||
          raw.form8606Category !== expectedRuntimeCategory ||
          raw.executionDate !== raw.eventDate ||
          raw.executionSequence !== raw.eventSequence ||
          !nonblank(raw.movementAuthorityId) ||
          !nonblank(raw.upstreamEvidenceId)) {
        return blocked([issue(
          'activityInventoryInvalid',
          'A runtime owner-pool event must retain its canonical Plan/year/ledger, producer origin, category, chronology, and lineage bindings',
          { activityId: raw.eventId },
        )])
      }
    }
    if (raw.kind === 'ownedIraContribution' ||
        raw.kind === 'ownedIraEmployerContribution') {
      const contribution = contributionApplicationsByEventId.get(raw.eventId)
      if (contribution === undefined ||
          contribution.eventOrigin !== raw.origin ||
          contribution.eventKind !== raw.kind ||
          contribution.movementAuthorityId !== raw.movementAuthorityId ||
          contribution.sourceAccountId !== raw.sourceAccountId ||
          contribution.scheduledDate !== raw.eventDate ||
          contribution.scheduledSequence !== raw.eventSequence ||
          contribution.inventoriedAmount !== raw.grossAmount ||
          contribution.creditedAmount !== raw.grossAmount ||
          contribution.inventoryEventUpstreamEvidenceId !==
            raw.upstreamEvidenceId) {
        return blocked([issue(
          'activityInventoryInvalid',
          'Every settled contribution application must exact-join its canonical owner-pool event, authority, source, chronology, amount, and upstream lineage',
          { activityId: raw.eventId },
        )])
      }
      contributionInventoryEventIds.add(raw.eventId)
      continue
    }
    if (raw.form8606Category !== 'line7DistributionCandidate' &&
        raw.form8606Category !== 'line8ConversionCandidate') {
      return blocked([issue(
        'activityUnsupported',
        'Selected-pool physical activity outside line 7/line 8 requires a dedicated canonical planning stage',
        { activityId: raw.eventId },
      )])
    }
    lineInventoryEventIds.add(raw.eventId)

    const application = applicationsByEventId.get(raw.eventId)
    if (application === undefined) continue
    const expectedLineScope = raw.form8606Category ===
      'line8ConversionCandidate'
      ? 'form8606Line8NetConversions'
      : 'form8606Line7Distributions'
    const expectedActionId = raw.origin === 'planAction'
      ? raw.actionId
      : deriveActionStructuralId(
          'owned-ira-unified-runtime-action',
          [
            planId,
            taxYear,
            ledgerRunId,
            raw.movementAuthorityId,
            raw.ownerPersonId,
            raw.kind,
            raw.eventDate,
            raw.eventSequence,
          ],
        )
    const expectedAllocationId = raw.origin === 'planAction'
      ? raw.allocationId
      : deriveActionStructuralId(
          'owned-ira-unified-runtime-allocation',
          [planId, taxYear, ledgerRunId, raw.eventId, raw.sourceAccountId],
        )
    if (
      application.eventOrigin !== raw.origin ||
      application.eventKind !== raw.kind ||
      application.lineScope !== expectedLineScope ||
      application.actionId !== expectedActionId ||
      application.allocationId !== expectedAllocationId ||
      application.sourceAccountId !== raw.sourceAccountId ||
      application.scheduledDate !== raw.eventDate ||
      application.scheduledSequence !== raw.eventSequence ||
      application.requestedAmount !== raw.grossAmount ||
      (raw.origin !== 'planAction' &&
        application.executedAmount !== raw.grossAmount)
    ) {
      return blocked([issue(
        'activityInventoryInvalid',
        'Every prepared application must exact-join its canonical owner-pool event identity, scope, source, chronology, and request',
        { activityId: raw.eventId },
      )])
    }
    if (expectedLineScope === 'form8606Line7Distributions') {
      if (application.destinationRothAccountId !== null ||
          application.destinationCreditEvidenceId !== null) {
        return blocked([issue(
          'activityInventoryInvalid',
          'A line-7 application cannot claim Roth destination lineage',
          { activityId: raw.eventId },
        )])
      }
    } else if (raw.origin !== 'planAction' ||
        application.destinationRothAccountId !== raw.destinationRothAccountId ||
        !nonblank(application.destinationCreditEvidenceId)) {
      return blocked([issue(
        'activityInventoryInvalid',
        'A line-8 application must retain the canonical Plan Roth destination lineage',
        { activityId: raw.eventId },
      )])
    }

    if (raw.origin === 'planAction') {
      const action = plan.strategies.retirementActions.find(
        (candidate) => candidate.actionId === raw.actionId,
      )
      const actionRecord = action as unknown as Record<string, unknown> | undefined
      const allocations = actionRecord?.allocations
      const allocation = Array.isArray(allocations)
        ? allocations.find((candidate) => isRecord(candidate) &&
            candidate.allocationId === raw.allocationId)
        : undefined
      const account = plan.accounts.find(
        (candidate) => candidate.id === raw.sourceAccountId,
      )
      const expectedKind = raw.form8606Category === 'line8ConversionCandidate'
        ? 'rothConversion'
        : 'ordinaryWithdrawal'
      if (!isRecord(actionRecord) || !isRecord(allocation) ||
          actionRecord.kind !== expectedKind || raw.kind !== expectedKind ||
          actionRecord.year !== taxYear ||
          actionRecord.personId !== ownerPersonId ||
          actionRecord.executionDate !== raw.eventDate ||
          actionRecord.executionSequence !== raw.eventSequence ||
          allocation.sourceAccountId !== raw.sourceAccountId ||
          allocation.requestedAmount !== raw.grossAmount ||
          account?.type !== 'traditional' || account.ownerPersonId !== ownerPersonId ||
          account.kind !== 'ira' || account.inherited !== undefined ||
          (expectedKind === 'rothConversion' &&
            actionRecord.destinationRothAccountId !== raw.destinationRothAccountId) ||
          (expectedKind === 'ordinaryWithdrawal' &&
            raw.destinationRothAccountId !== null)) {
        return blocked([issue(
          'activityInventoryInvalid',
          'A Plan-origin owner-pool event must exact-join its validated Plan action and allocation',
          { activityId: raw.eventId },
        )])
      }
      const expectedEventId = deriveActionStructuralId(
        'annual-retirement-plan-event',
        [
          planId,
          taxYear,
          raw.actionId,
          raw.allocationId,
          raw.sourceAccountId,
          raw.grossAmount,
          raw.eventDate,
          raw.eventSequence,
          raw.kind,
          ownerPersonId,
          account.ownerPersonId,
          account.kind,
          'owned',
          raw.form8606Category,
          raw.destinationRothAccountId,
          raw.charity,
        ],
      )
      if (raw.eventId !== expectedEventId || raw.planId !== planId ||
          raw.taxYear !== taxYear || raw.sourceAccountKind !== 'ira' ||
          raw.sourceInheritanceStatus !== 'owned' || raw.charity !== null ||
          raw.scheduledDate !== raw.eventDate ||
          raw.scheduledSequence !== raw.eventSequence) {
        return blocked([issue(
          'activityInventoryInvalid',
          'A Plan-origin owner-pool event must retain its canonical derived identity and complete Plan facts',
          { activityId: raw.eventId },
        )])
      }
    }
  }
  if (selectedPoolGross > MAX_SAFE_CENTS ||
      selectedPool.grossAmount !== Number(selectedPoolGross)) {
    return blocked([issue(
      'activityInventoryInvalid',
      'Selected-owner pool gross amount must exactly equal its complete event set',
    )])
  }
  for (const category of [
    'line7DistributionCandidate',
    'line8ConversionCandidate',
    'qcdCandidateAwaitingAnnualQcdStage',
    'nonForm8606OrForeignPoolEvent',
  ] as const) {
    const view = selectedPool[category]
    if (!isRecord(view) || !Array.isArray(view.events)) {
      return blocked([issue(
        'activityInventoryInvalid',
        `Selected-owner ${category} view must be complete`,
      )])
    }
    const expectedIds = categoryEventIds.get(category) ?? []
    const actualIds = view.events.flatMap((raw) =>
      isRecord(raw) && nonblank(raw.eventId) ? [raw.eventId] : [])
    const expectedGross = selectedPoolEvents.reduce<bigint>((sum, raw) =>
      isRecord(raw) && raw.form8606Category === category
        ? sum + BigInt(asPositiveUsdCents(raw.grossAmount))
        : sum,
    0n)
    if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds) ||
      expectedGross > MAX_SAFE_CENTS || view.grossAmount !== Number(expectedGross)) {
      return blocked([issue(
        'activityInventoryInvalid',
        `Selected-owner ${category} view must exact-partition the canonical pool events`,
      )])
    }
  }
  if (!sameStrings(
    [...lineInventoryEventIds].sort(compareUtf16CodeUnits),
    [...applicationIds].sort(compareUtf16CodeUnits),
  )) {
    return blocked([issue(
      'activityInventoryIncomplete',
      'Prepared applications must exact-cover every selected-owner line-7/line-8 inventory event, including zero executions',
    )])
  }
  if (!sameStrings(
    [...contributionInventoryEventIds].sort(compareUtf16CodeUnits),
    [...contributionApplicationIds].sort(compareUtf16CodeUnits),
  )) {
    return blocked([issue(
      'activityInventoryIncomplete',
      'Settled contribution applications must exact-cover every selected-owner contribution event',
    )])
  }
  if (
    expectedLine7Gross > MAX_SAFE_CENTS || expectedLine8Gross > MAX_SAFE_CENTS ||
    JSON.stringify(expectedLine7Entries) !==
      JSON.stringify(transaction.line7Entries) ||
    JSON.stringify(expectedLine8Entries) !==
      JSON.stringify(transaction.line8Entries) ||
    transaction.line7GrossAmount !== Number(expectedLine7Gross) ||
    transaction.line8GrossAmount !== Number(expectedLine8Gross)
  ) {
    return blocked([issue(
      'activityInventoryInvalid',
      'Prepared transaction line entries and gross amounts must exact-reconcile every positive actual application once',
    )])
  }

  const transitionBySource = new Map<string, Record<string, unknown>>()
  for (const raw of transaction.sourceBalanceTransitions) {
    if (!isRecord(raw) || !nonblank(raw.sourceAccountId) ||
        transitionBySource.has(raw.sourceAccountId)) {
      return blocked([issue(
        'activityInventoryInvalid',
        'Prepared source-balance transitions must uniquely cover each owner-pool account',
      )])
    }
    transitionBySource.set(raw.sourceAccountId, raw)
  }
  if (!sameStrings(
    [...transitionBySource.keys()].sort(compareUtf16CodeUnits),
    accountIds,
  )) {
    return blocked([issue(
      'activityInventoryIncomplete',
      'Prepared source-balance transitions must exact-cover the complete owner pool, including unchanged accounts',
    )])
  }
  for (const sourceAccountId of accountIds) {
    const transition = transitionBySource.get(sourceAccountId)!
    const sourceEvents = canonicalSelectedPoolEvents.filter(
      (event) => event.sourceAccountId === sourceAccountId,
    )
    const sourceApplications: Record<string, unknown>[] = []
    const sourceContributions: Record<string, unknown>[] = []
    const sourceChainEntries: unknown[][] = []
    let opening: UsdCents
    let settledContribution: UsdCents
    let requested: UsdCents
    let executed: UsdCents
    let unexecuted: UsdCents
    let closing: UsdCents
    try {
      opening = asUsdCents(transition.openingBalance)
      settledContribution = asUsdCents(transition.settledContributionAmount)
      requested = asUsdCents(transition.requestedAmount)
      executed = asUsdCents(transition.executedAmount)
      unexecuted = asUsdCents(transition.unexecutedAmount)
      closing = asUsdCents(transition.detachedClosingBalance)
    } catch {
      return blocked([issue(
        'activityInventoryInvalid',
        'Prepared source-balance transitions must use exact nonnegative safe-integer cents',
        { sourceAccountId },
      )])
    }
    let expectedBefore = opening
    for (const event of sourceEvents) {
      const contribution = contributionApplicationsByEventId.get(
        String(event.eventId),
      )
      if (contribution !== undefined) {
        if (contribution.sourceBalanceBefore !== expectedBefore) {
          return blocked([issue(
            'activityInventoryInvalid',
            'Prepared contributions and debits must form one chronological detached balance chain per source',
            { sourceAccountId, activityId: String(event.eventId) },
          )])
        }
        sourceContributions.push(contribution)
        sourceChainEntries.push([
          contribution.inventoryEventId,
          contribution.inventoryEventUpstreamEvidenceId,
          contribution.stagingEvidenceId,
          contribution.applicationEvidenceId,
          contribution.sourceBalanceBefore,
          contribution.creditedAmount,
          contribution.sourceBalanceAfter,
        ])
        expectedBefore = asUsdCents(contribution.sourceBalanceAfter)
        continue
      }
      const application = applicationsByEventId.get(String(event.eventId))
      if (application === undefined ||
          application.sourceBalanceBefore !== expectedBefore) {
        return blocked([issue(
          'activityInventoryInvalid',
          'Prepared contributions and debits must form one chronological detached balance chain per source',
          { sourceAccountId, activityId: String(event.eventId) },
        )])
      }
      sourceApplications.push(application)
      sourceChainEntries.push([
        application.inventoryEventId,
        application.stagingEvidenceId,
        application.applicationEvidenceId,
        application.sourceBalanceBefore,
        application.executedAmount,
        application.sourceBalanceAfter,
      ])
      expectedBefore = asUsdCents(application.sourceBalanceAfter)
    }
    const expectedSettledContribution = sourceContributions.reduce(
      (sum, contribution) =>
        sum + BigInt(asUsdCents(contribution.creditedAmount)),
      0n,
    )
    const expectedRequested = sourceApplications.reduce(
      (sum, application) => sum + BigInt(asUsdCents(application.requestedAmount)),
      0n,
    )
    const expectedExecuted = sourceApplications.reduce(
      (sum, application) => sum + BigInt(asUsdCents(application.executedAmount)),
      0n,
    )
    const expectedUnexecuted = sourceApplications.reduce(
      (sum, application) => sum + BigInt(asUsdCents(application.unexecutedAmount)),
      0n,
    )
    if (expectedSettledContribution > MAX_SAFE_CENTS ||
        expectedRequested > MAX_SAFE_CENTS || expectedExecuted > MAX_SAFE_CENTS ||
        expectedUnexecuted > MAX_SAFE_CENTS ||
        settledContribution !== Number(expectedSettledContribution) ||
        requested !== Number(expectedRequested) ||
        executed !== Number(expectedExecuted) ||
        unexecuted !== Number(expectedUnexecuted) || closing !== expectedBefore ||
        transition.predicate !==
          'ownedNonRothIraDetachedAnnualSourceBalanceTransition' ||
        transition.planId !== planId ||
        transition.ownerPersonId !== ownerPersonId ||
        transition.taxYear !== taxYear || transition.ledgerRunId !== ledgerRunId ||
        transition.inventoryEvidenceId !== transactionInventory.inventoryEvidenceId ||
        !nonblank(transition.upstreamEvidenceId) || !nonblank(transition.evidenceId)) {
      return blocked([issue(
        'activityInventoryInvalid',
        'Prepared source transition must exact-reconcile its complete chronological application chain',
        { sourceAccountId },
      )])
    }
    const expectedUpstreamEvidenceId = deriveActionStructuralId(
      'owned-ira-unified-annual-source-balance-upstream',
      [
        transactionInventory.inventoryEvidenceId,
        sourceAccountId,
        opening,
        sourceChainEntries,
      ],
    )
    const transitionWithoutEvidence = {
      predicate: transition.predicate,
      planId,
      ownerPersonId,
      taxYear,
      ledgerRunId,
      inventoryEvidenceId: transactionInventory.inventoryEvidenceId,
      sourceAccountId,
      openingBalance: opening,
      settledContributionAmount: settledContribution,
      requestedAmount: requested,
      executedAmount: executed,
      unexecutedAmount: unexecuted,
      detachedClosingBalance: closing,
      upstreamEvidenceId: expectedUpstreamEvidenceId,
    }
    if (transition.upstreamEvidenceId !== expectedUpstreamEvidenceId ||
        !derivedIdMatches(
          transition.evidenceId,
          'owned-ira-unified-annual-source-balance-transition',
          [transitionWithoutEvidence],
        )) {
      return blocked([issue(
        'activityInventoryInvalid',
        'Prepared source transition must retain canonical application-chain lineage',
        { sourceAccountId },
      )])
    }
  }

  const destinationCreditsByEventId = new Map<string, Record<string, unknown>>()
  for (const raw of transaction.stagedDestinationCredits) {
    if (!isRecord(raw) || !nonblank(raw.inventoryEventId) ||
        destinationCreditsByEventId.has(raw.inventoryEventId)) {
      return blocked([issue(
        'activityInventoryInvalid',
        'Prepared Roth destination credits must uniquely bind conversion events',
      )])
    }
    destinationCreditsByEventId.set(raw.inventoryEventId, raw)
  }
  const expectedDestinationEventIds = transaction.applications.flatMap((raw) =>
    isRecord(raw) && raw.lineScope === 'form8606Line8NetConversions' &&
      nonblank(raw.inventoryEventId)
      ? [raw.inventoryEventId]
      : [])
  if (!sameStrings(
    [...destinationCreditsByEventId.keys()].sort(compareUtf16CodeUnits),
    [...expectedDestinationEventIds].sort(compareUtf16CodeUnits),
  )) {
    return blocked([issue(
      'activityInventoryIncomplete',
      'Prepared Roth destination credits must exact-cover every line-8 application, including zero executions',
    )])
  }
  for (const inventoryEventId of expectedDestinationEventIds) {
    const application = applicationsByEventId.get(inventoryEventId)!
    const credit = destinationCreditsByEventId.get(inventoryEventId)!
    const creditWithoutEvidence = {
      predicate: 'ownedNonRothIraDetachedAnnualRothDestinationCredit' as const,
      planId,
      ownerPersonId,
      taxYear,
      ledgerRunId,
      inventoryEvidenceId: transactionInventory.inventoryEvidenceId,
      inventoryEventId,
      actionId: application.actionId,
      allocationId: application.allocationId,
      sourceAccountId: application.sourceAccountId,
      destinationRothAccountId: application.destinationRothAccountId,
      stagedCreditAmount: application.executedAmount,
      creditStatus: 'detachedCandidateNotCommitted' as const,
      upstreamEvidenceId: application.stagingEvidenceId,
    }
    if (Object.entries(creditWithoutEvidence).some(
      ([key, value]) => credit[key] !== value,
    ) || credit.evidenceId !== application.destinationCreditEvidenceId ||
        !derivedIdMatches(
          credit.evidenceId,
          'owned-ira-unified-annual-roth-destination-credit',
          [creditWithoutEvidence],
        )) {
      return blocked([issue(
        'activityInventoryInvalid',
        'Prepared Roth destination credit must exact-join its canonical line-8 application',
        { activityId: inventoryEventId },
      )])
    }
  }

  const line8Inventory = transaction.line8InventoryEvidence
  const expectedLine8UpstreamEvidenceId = deriveActionStructuralId(
    'owned-ira-unified-line8-inventory-upstream',
    [
      transactionInventory.inventoryEvidenceId,
      ownerPersonId,
      transaction.applications.flatMap((raw) =>
        isRecord(raw) && raw.lineScope === 'form8606Line8NetConversions'
          ? [raw.applicationEvidenceId]
          : []),
    ],
  )
  const line8WithoutEvidence = {
    predicate: 'completePlanOwnedNonRothIraLine8ConversionInventory' as const,
    planId,
    ownerPersonId,
    taxYear,
    ledgerRunId,
    inventoryStatus: 'completeIncludingExplicitEmpty' as const,
    entries: transaction.line8Entries,
    upstreamEvidenceId: expectedLine8UpstreamEvidenceId,
  }
  if (Object.entries(line8WithoutEvidence).some(
    ([key, value]) => JSON.stringify(line8Inventory[key]) !== JSON.stringify(value),
  ) || !derivedIdMatches(
    line8Inventory.evidenceId,
    'owned-ira-unified-line8-inventory',
    [line8WithoutEvidence],
  )) {
    return blocked([issue(
      'activityInventoryInvalid',
      'Prepared line-8 inventory must retain canonical complete application lineage',
    )])
  }
  try {
    const transactionWithoutEvidence = {
      planId,
      ownerPersonId,
      taxYear,
      ledgerRunId,
      inventoryEvidenceId: transaction.inventory.inventoryEvidenceId,
      applications: transaction.applications,
      settledContributionApplications:
        transaction.settledContributionApplications,
      sourceBalanceTransitions: transaction.sourceBalanceTransitions,
      stagedDestinationCredits: transaction.stagedDestinationCredits,
      line7Entries: transaction.line7Entries,
      line8Entries: transaction.line8Entries,
      line7GrossAmount: transaction.line7GrossAmount,
      line8GrossAmount: transaction.line8GrossAmount,
      line8InventoryEvidence: transaction.line8InventoryEvidence,
    }
    if (!derivedIdMatches(
      transaction.transactionEvidenceId,
      'owned-ira-unified-annual-physical-transaction',
      [transactionWithoutEvidence],
    )) {
      return blocked([issue(
        'activityInventoryInvalid',
        'Prepared physical-transaction evidence ID must bind its canonical complete contents',
      )])
    }
  } catch (error) {
    return blocked([issue(
      'activityInventoryInvalid',
      `Prepared physical-transaction identity could not be verified: ${safeError(error)}`,
    )])
  }

  const physicalTransaction = transaction as unknown as
    PlanOwnedNonRothIraAnnualPhysicalTransactionPreparedResult
  const inventory = {
    predicate:
      'completeSimulatorOwnedNonRothIraSettledActivityInventory' as const,
    planId,
    ownerPersonId,
    taxYear,
    ledgerRunId,
    evidenceScope:
      'projectionSettledActivityOnlyNotTaxReturnEvidence' as const,
    inventoryStatus: 'completeIncludingExplicitEmpty' as const,
    events: [
      ...physicalTransaction.applications
        .filter((application) => application.executedAmount > 0)
        .map((application) => ({
        activityId: application.inventoryEventId,
        authorityKind: application.eventOrigin === 'planAction'
          ? 'planAction' as const
          : 'derivedRuntimeAction' as const,
        authorityId: application.actionId,
        allocationActionId: application.actionId,
        sourceAccountId: application.sourceAccountId,
        activityKind: application.lineScope === 'form8606Line7Distributions'
          ? 'distribution' as const
          : 'rothConversion' as const,
        executionDate: application.scheduledDate,
        executionSequence: application.scheduledSequence,
        grossAmount: application.executedAmount,
        upstreamEvidenceId: application.applicationEvidenceId,
        })),
      ...physicalTransaction.settledContributionApplications.map(
        (application) => ({
          activityId: application.inventoryEventId,
          authorityKind: 'runtimeMovementAuthority' as const,
          authorityId: application.movementAuthorityId,
          allocationActionId: null,
          sourceAccountId: application.sourceAccountId,
          activityKind: application.eventKind,
          executionDate: application.scheduledDate,
          executionSequence: application.scheduledSequence,
          grossAmount: application.creditedAmount,
          upstreamEvidenceId: application.applicationEvidenceId,
        }),
      ),
    ],
    unresolvedActivityIds: [] as const,
    upstreamEvidenceId: physicalTransaction.transactionEvidenceId,
    evidenceId: '',
  }

  const supportedKinds = new Set<SimulatorOwnedNonRothIraPlanningActivityKind>([
    'distribution',
    'rothConversion',
    'ownedIraContribution',
    'ownedIraEmployerContribution',
  ])
  const activities: CanonicalActivity[] = []
  const activityIds = new Set<string>()
  const sourceByAction = new Set<string>()
  const scopeByAction = new Map<string, string>()
  const slotByAction = new Map<string, string>()
  const actionBySlot = new Map<string, string>()
  const activityIssues: SimulatorOwnedNonRothIraAnnualPlanningEvidenceIssue[] = []
  for (const raw of inventory.events) {
    if (!isRecord(raw)) {
      activityIssues.push(issue('activityInvalid', 'Every settled activity must be an object'))
      continue
    }
    const activityId = raw.activityId
    const authorityKind = raw.authorityKind
    const authorityId = raw.authorityId
    const allocationActionId = raw.allocationActionId
    const parsedAccount = accountIdSchema.safeParse(raw.sourceAccountId)
    const activityKind = raw.activityKind
    const executionDate = canonicalDate(raw.executionDate)
    const executionSequence = raw.executionSequence
    if (!nonblank(activityId) ||
        (authorityKind !== 'planAction' &&
          authorityKind !== 'derivedRuntimeAction' &&
          authorityKind !== 'runtimeMovementAuthority') ||
        !nonblank(authorityId) ||
        !parsedAccount.success || !accountSet.has(parsedAccount.success ? parsedAccount.data : '' as AccountId) ||
        typeof activityKind !== 'string' || executionDate === null ||
        executionDate.slice(0, 4) !== String(taxYear).padStart(4, '0') ||
        !Number.isSafeInteger(executionSequence) || Number(executionSequence) <= 0 ||
        typeof raw.grossAmount !== 'number' ||
        !nonblank(raw.upstreamEvidenceId) ||
        ((activityKind === 'distribution' || activityKind === 'rothConversion')
          ? allocationActionId !== authorityId ||
            authorityKind === 'runtimeMovementAuthority'
          : allocationActionId !== null ||
            authorityKind !== 'runtimeMovementAuthority')) {
      activityIssues.push(issue(
        'activityInvalid',
        'Every settled activity must bind one pool account, tax-year date, positive sequence, and stable lineage',
        {
          activityId: typeof activityId === 'string' ? activityId : undefined,
          sourceAccountId: typeof raw.sourceAccountId === 'string' ? raw.sourceAccountId : undefined,
        },
      ))
      continue
    }
    if (!supportedKinds.has(activityKind as SimulatorOwnedNonRothIraPlanningActivityKind)) {
      activityIssues.push(issue(
        'activityUnsupported',
        `Settled ${activityKind} activity requires a dedicated annual tax stage`,
        { activityId, sourceAccountId: parsedAccount.data },
      ))
      continue
    }
    let grossAmount: PositiveUsdCents
    try {
      grossAmount = asPositiveUsdCents(raw.grossAmount)
    } catch (error) {
      activityIssues.push(issue(
        'activityInvalid',
        `Settled activity gross must cross to positive exact cents: ${safeError(error)}`,
        { activityId, sourceAccountId: parsedAccount.data },
      ))
      continue
    }
    if (activityIds.has(activityId)) {
      activityIssues.push(issue('activityInvalid', 'Settled activity IDs must be unique', { activityId }))
      continue
    }
    activityIds.add(activityId)
    const sourceKey = JSON.stringify([authorityId, parsedAccount.data])
    if (sourceByAction.has(sourceKey)) {
      activityIssues.push(issue(
        'activityInvalid',
        'One activity authority cannot settle the same source account twice',
        { activityId, sourceAccountId: parsedAccount.data },
      ))
    }
    sourceByAction.add(sourceKey)
    const scope = activityKind === 'distribution'
      ? 'distribution'
      : activityKind === 'rothConversion'
        ? 'conversion'
        : 'contribution'
    const existingScope = scopeByAction.get(authorityId)
    if (existingScope !== undefined && existingScope !== scope) {
      activityIssues.push(issue(
        'activityInvalid',
        'One activity authority cannot cross planning activity scopes',
        { activityId },
      ))
    }
    scopeByAction.set(authorityId, scope)
    const slot = JSON.stringify([executionDate, executionSequence])
    const existingSlotAction = actionBySlot.get(slot)
    if (existingSlotAction !== undefined &&
        existingSlotAction !== authorityId) {
      activityIssues.push(issue(
        'activityChronologyInvalid',
        'Different activity authorities cannot occupy one annual chronology slot',
        { activityId },
      ))
    }
    actionBySlot.set(slot, authorityId)
    const existingSlot = slotByAction.get(authorityId)
    if (existingSlot !== undefined && existingSlot !== slot) {
      activityIssues.push(issue(
        'activityChronologyInvalid',
        'Every allocation from one activity authority must share one chronology slot',
        { activityId },
      ))
    }
    slotByAction.set(authorityId, slot)
    activities.push({
      activityId,
      authorityKind,
      authorityId,
      allocationActionId: typeof allocationActionId === 'string'
        ? allocationActionId
        : null,
      sourceAccountId: parsedAccount.data,
      activityKind: activityKind as SimulatorOwnedNonRothIraPlanningActivityKind,
      executionDate,
      executionSequence: Number(executionSequence),
      grossAmount,
      upstreamEvidenceId: raw.upstreamEvidenceId,
    })
  }
  if (activityIssues.length > 0) return blocked(activityIssues)
  activities.sort(canonicalActivityOrder)
  let expectedInventoryUpstreamEvidenceId: string
  try {
    expectedInventoryUpstreamEvidenceId = deriveActionStructuralId(
      'simulator-owned-ira-settled-activity-inventory-upstream',
      [planId, ownerPersonId, taxYear, ledgerRunId,
        observation.evidenceId, activities],
    )
  } catch (error) {
    return blocked([issue('identifierDerivationFailed', safeError(error))])
  }
  inventory.upstreamEvidenceId = expectedInventoryUpstreamEvidenceId
  const canonicalInventoryBody = {
    predicate: inventory.predicate,
    planId,
    ownerPersonId,
    taxYear,
    ledgerRunId,
    evidenceScope: inventory.evidenceScope,
    inventoryStatus: inventory.inventoryStatus,
    events: activities,
    unresolvedActivityIds: [] as const,
    upstreamEvidenceId: expectedInventoryUpstreamEvidenceId,
  }
  let expectedInventoryEvidenceId: string
  try {
    expectedInventoryEvidenceId = deriveActionStructuralId(
      'simulator-owned-ira-settled-activity-inventory',
      [canonicalInventoryBody],
    )
  } catch (error) {
    return blocked([issue('identifierDerivationFailed', safeError(error))])
  }
  inventory.evidenceId = expectedInventoryEvidenceId

  const assumptions = snapshot.assumptions
  if (!isRecord(assumptions) || !isRecord(assumptions.openingBasis) ||
      !isRecord(assumptions.rolloverAssumption) ||
      !Array.isArray(assumptions.settledContributionDesignations) ||
      !Array.isArray(assumptions.postYearPriorTaxYearContributions)) {
    return blocked([issue('assumptionsInvalid', 'Planning assumptions must be a complete object')])
  }
  if (
    assumptions.predicate !==
      'explicitSimulatorOwnedNonRothIraAnnualPlanningAssumptions' ||
    assumptions.poolScope !==
      'validatedPlanContainsCompleteOwnedNonRothIraPoolForProjection' ||
    assumptions.realWorldAccountCompleteness !== 'notEstablished' ||
    assumptions.postYearWindowStatus !==
      'completeExplicitProjectionAssumption'
  ) return blocked([issue(
    'assumptionsInvalid',
    'Planning assumptions must explicitly disclaim real-world completeness',
  )])
  const rollover = assumptions.rolloverAssumption
  if (
    rollover.status !==
      'assumedNoOutstandingRolloverOrRepaymentAdjustment' ||
    rollover.outstandingRolloverAmount !== 0 ||
    rollover.rolloverRepaymentAdjustmentAmount !== 0 ||
    Object.is(rollover.outstandingRolloverAmount, -0) ||
    Object.is(rollover.rolloverRepaymentAdjustmentAmount, -0)
  ) return blocked([issue(
    'rolloverAssumptionUnsupported',
    'This planning slice supports only an explicit literal-zero rollover and repayment assumption',
  )])

  const opening = assumptions.openingBasis
  const expectedOpeningDate = `${String(taxYear).padStart(4, '0')}-01-01`
  let openingPlanningBasis: UsdCents
  if (typeof opening.amount !== 'number') {
    return blocked([issue('assumptionsInvalid', 'Opening basis must be a projection-dollar number')])
  }
  try {
    openingPlanningBasis = planDollarsToLedgerCents(opening.amount)
  } catch (error) {
    return blocked([issue('assumptionsInvalid', `Opening basis is invalid: ${safeError(error)}`)])
  }
  if (opening.asOfDate !== expectedOpeningDate ||
      openingPlanningBasis !== openingObserved) {
    return blocked([issue(
      'openingBasisMismatch',
      'Opening planning basis must exact-match the January 1 annual observation',
    )])
  }
  let priorCarryforwardEvidence: Record<string, unknown> | null = null
  let priorPlanningEvidence: Record<string, unknown> | null = null
  if (opening.source === 'planAccountPlanningSeed') {
    if (taxYear !== projectionStartTaxYear) {
      return blocked([issue(
        'openingBasisMismatch',
        'The Plan opening-basis seed is valid only in the first projection tax year',
      )])
    }
    let planSeed: UsdCents
    try {
      planSeed = safeCents(
        plan.accounts
          .filter((account) => accountIds.includes(account.id as AccountId))
          .reduce(
            (sum, account) => sum + BigInt(planDollarsToLedgerCents(
              account.type === 'traditional' ? account.nondeductibleBasis ?? 0 : 0,
            )),
            0n,
          ),
        'Plan opening-basis seed',
      )
    } catch (error) {
      return blocked([issue('amountOverflow', safeError(error))])
    }
    if (planSeed !== openingPlanningBasis) {
      return blocked([issue(
        'openingBasisMismatch',
        'Plan-seeded opening basis must equal the complete owner-wide Plan seed',
      )])
    }
    if (snapshot.priorCarryforwardEvidence !== undefined ||
        snapshot.priorPlanningEvidence !== undefined) {
      return blocked([issue(
        'openingBasisMismatch',
        'A current-Plan opening seed cannot also claim prior planning continuity evidence',
      )])
    }
  } else if (opening.source === 'priorProjectionCarryforward') {
    const prior = snapshot.priorCarryforwardEvidence
    const priorPlanning = snapshot.priorPlanningEvidence
    if (taxYear <= projectionStartTaxYear ||
        opening.priorTaxYear !== taxYear - 1 ||
        !nonblank(opening.priorCarryforwardEvidenceId) || !isRecord(prior) ||
        !isRecord(priorPlanning) ||
        prior.predicate !==
          'completeSimulatorOwnedNonRothIraPlanningCarryforwardEvidence' ||
        prior.planId !== planId || prior.ownerPersonId !== ownerPersonId ||
        prior.fromTaxYear !== taxYear - 1 || prior.toTaxYear !== taxYear ||
        prior.projectionStartTaxYear !== projectionStartTaxYear ||
        prior.evidenceScope !==
          'projectionPlanningCarryforwardOnlyNotTaxReturnEvidence' ||
        prior.taxReturnUse !== 'prohibited' ||
        prior.evidenceId !== opening.priorCarryforwardEvidenceId ||
        prior.openingPlanningBasisAmount !== openingPlanningBasis ||
        !nonblank(prior.sourceLedgerRunId) ||
        !nonblank(prior.sourcePlanningEvidenceId) ||
        !Array.isArray(prior.accountIds) ||
        prior.accountIds.length !== accountIds.length ||
        !sameStrings(
          [...prior.accountIds].filter((value): value is string =>
            typeof value === 'string').sort(compareUtf16CodeUnits),
          accountIds,
        ) ||
        !Array.isArray(prior.postYearPriorTaxYearContributionAssumptions)) {
      return blocked([issue(
        'openingBasisMismatch',
        'Prior carryforward must exact-rejoin complete planning evidence from the immediately preceding year',
      )])
    }
    if (
      priorPlanning.predicate !==
        'completeSimulatorOwnedNonRothIraAnnualPlanningEvidence' ||
      priorPlanning.planId !== planId ||
      priorPlanning.ownerPersonId !== ownerPersonId ||
      priorPlanning.taxYear !== taxYear - 1 ||
      priorPlanning.projectionStartTaxYear !== projectionStartTaxYear ||
      priorPlanning.ledgerRunId !== prior.sourceLedgerRunId ||
      priorPlanning.evidenceScope !==
        'projectionPlanningEstimateOnlyNotTaxReturnEvidence' ||
      priorPlanning.filingCompleteness !== 'notEstablished' ||
      priorPlanning.realWorldAccountCompleteness !== 'notEstablished' ||
      priorPlanning.taxReturnUse !== 'prohibited' ||
      priorPlanning.assumptionStatus !==
        'explicitProjectionAssumptionsApplied' ||
      priorPlanning.assumedOutstandingRolloverAmount !== 0 ||
      priorPlanning.assumedRolloverRepaymentAdjustmentAmount !== 0 ||
      Object.is(priorPlanning.assumedOutstandingRolloverAmount, -0) ||
      Object.is(
        priorPlanning.assumedRolloverRepaymentAdjustmentAmount,
        -0,
      ) ||
      priorPlanning.displayCopy !==
        'Projected IRA tax treatment uses complete simulated Plan activity and explicit basis, contribution, and no-rollover assumptions. It is not Form 8606 or tax-return evidence.' ||
      !nonblank(priorPlanning.observationEvidenceId) ||
      !nonblank(priorPlanning.activityInventoryEvidenceId) ||
      !nonblank(priorPlanning.assumptionsEvidenceId) ||
      priorPlanning.evidenceId !== prior.sourcePlanningEvidenceId ||
      priorPlanning.nextYearOpeningPlanningBasisAmount !==
        prior.openingPlanningBasisAmount ||
      !Array.isArray(priorPlanning.accountIds) ||
      priorPlanning.accountIds.length !== accountIds.length ||
      !sameStrings(
        [...priorPlanning.accountIds].filter((value): value is string =>
          typeof value === 'string'),
        accountIds,
      ) ||
      !Array.isArray(
        priorPlanning.postYearPriorTaxYearContributionAssumptions,
      ) || !priorPlanningArithmeticIsCanonical(priorPlanning, accountSet)
    ) {
      return blocked([issue(
        'openingBasisMismatch',
        'Supplied prior planning evidence must exactly define the predecessor carryforward source',
      )])
    }
    try {
      const { evidenceId, ...priorBody } = prior
      const { evidenceId: planningEvidenceId, ...priorPlanningBody } =
        priorPlanning
      const expectedPriorCarryforwardBody = {
        predicate:
          'completeSimulatorOwnedNonRothIraPlanningCarryforwardEvidence',
        planId: priorPlanning.planId,
        ownerPersonId: priorPlanning.ownerPersonId,
        projectionStartTaxYear: priorPlanning.projectionStartTaxYear,
        fromTaxYear: priorPlanning.taxYear,
        toTaxYear: Number(priorPlanning.taxYear) + 1,
        sourceLedgerRunId: priorPlanning.ledgerRunId,
        sourcePlanningEvidenceId: priorPlanning.evidenceId,
        accountIds: priorPlanning.accountIds,
        openingPlanningBasisAmount:
          priorPlanning.nextYearOpeningPlanningBasisAmount,
        postYearPriorTaxYearContributionAssumptions:
          priorPlanning.postYearPriorTaxYearContributionAssumptions,
        evidenceScope:
          'projectionPlanningCarryforwardOnlyNotTaxReturnEvidence',
        taxReturnUse: 'prohibited',
      }
      const expectedCarryforwardEvidenceId = deriveActionStructuralId(
        'simulator-owned-ira-planning-carryforward-evidence',
        [expectedPriorCarryforwardBody],
      )
      if (evidenceId !== expectedCarryforwardEvidenceId ||
        deriveActionStructuralId(
          'simulator-owned-ira-prior-carryforward-exact-rejoin',
          [priorBody],
        ) !== deriveActionStructuralId(
          'simulator-owned-ira-prior-carryforward-exact-rejoin',
          [expectedPriorCarryforwardBody],
        ) || !derivedIdMatches(
          planningEvidenceId,
          'simulator-owned-ira-annual-planning-evidence',
          [priorPlanningBody],
        )) {
        return blocked([issue(
          'openingBasisMismatch',
          'Prior planning and carryforward evidence must bind and exact-rejoin their complete contents',
        )])
      }
    } catch (error) {
      return blocked([issue(
        'openingBasisMismatch',
        `Prior carryforward identity could not be verified: ${safeError(error)}`,
      )])
    }
    priorCarryforwardEvidence = prior
    priorPlanningEvidence = priorPlanning
  } else {
    return blocked([issue('assumptionsInvalid', 'Opening-basis assumption source is unsupported')])
  }

  const classificationsBySource = new Map<AccountId, NonNullable<
    Plan['retirementActionEligibilityFacts']
  >['iraClassifications']>()
  for (const classification of
    plan.retirementActionEligibilityFacts?.iraClassifications ?? []) {
    const sourceAccountId = accountIdSchema.parse(classification.sourceAccountId)
    classificationsBySource.set(sourceAccountId, [
      ...(classificationsBySource.get(sourceAccountId) ?? []),
      classification,
    ])
  }
  const subtypeBySource = new Map<AccountId, 'traditional' | 'sep' | 'simple'>()
  const classificationIssues: SimulatorOwnedNonRothIraAnnualPlanningEvidenceIssue[] = []
  for (const sourceAccountId of accountIds) {
    const classifications = classificationsBySource.get(sourceAccountId) ?? []
    if (classifications.length !== 1) {
      classificationIssues.push(issue(
        'assumptionsInvalid',
        'Every Plan-owned IRA pool member needs exactly one Plan IRA classification',
        { sourceAccountId },
      ))
      continue
    }
    subtypeBySource.set(sourceAccountId, classifications[0]!.subtype)
  }
  const owner = plan.household.people.find(
    (person) => person.id === ownerPersonId,
  )!
  const ownerAge = taxYear - Number(owner.dob.slice(0, 4))
  const ownerModeledAlive = ownerAge <= owner.longevity.planningAge
  const ownerHasCurrentYearWages = plan.incomes.some((income) => {
    if (income.type !== 'wages' || income.personId !== ownerPersonId ||
        income.annualGross <= 0) return false
    const stopAge = income.endAge ?? owner.retirementAge
    return stopAge === null || ownerAge < stopAge
  })
  const personalContributionEligibleBySource = new Map<AccountId, boolean>()
  for (const sourceAccountId of accountIds) {
    const source = plan.accounts.find(
      (account) => account.id === sourceAccountId,
    )
    const contributionSchedule = source?.type === 'traditional'
      ? source.contributionSchedule
      : undefined
    const hasContributionSchedule = contributionSchedule !== undefined &&
      contributionSchedule.length > 0
    const hasPositiveCurrentYearContributionRequest = source?.type ===
        'traditional'
      ? hasContributionSchedule
        ? contributionSchedule.some((phase) =>
            ownerAge >= (phase.fromAge ?? 0) &&
            ownerAge <= (phase.toAge ?? 120) && phase.annualAmount > 0)
        : source.annualContribution > 0
      : false
    personalContributionEligibleBySource.set(
      sourceAccountId,
      subtypeBySource.get(sourceAccountId) !== 'simple' && ownerModeledAlive &&
        hasPositiveCurrentYearContributionRequest &&
        (hasContributionSchedule || ownerHasCurrentYearWages),
    )
  }
  for (const activity of activities) {
    const subtype = subtypeBySource.get(activity.sourceAccountId)
    if (activity.activityKind === 'ownedIraContribution' &&
        subtype === 'simple') {
      classificationIssues.push(issue(
        'activityUnsupported',
        'Personal IRA contribution activity is unsupported for a SIMPLE IRA source',
        { activityId: activity.activityId, sourceAccountId: activity.sourceAccountId },
      ))
    }
    if (activity.activityKind === 'ownedIraContribution' &&
        personalContributionEligibleBySource.get(activity.sourceAccountId) !==
          true) {
      classificationIssues.push(issue(
        'activityUnsupported',
        'Personal IRA contribution activity requires the same positive Plan contribution route accepted by the canonical inventory producer',
        { activityId: activity.activityId, sourceAccountId: activity.sourceAccountId },
      ))
    }
    if (activity.activityKind === 'ownedIraEmployerContribution' &&
        subtype !== 'sep' && subtype !== 'simple') {
      classificationIssues.push(issue(
        'activityUnsupported',
        'Employer IRA contribution activity requires a SEP or SIMPLE IRA source',
        { activityId: activity.activityId, sourceAccountId: activity.sourceAccountId },
      ))
    }
    const currentYearEmployerActivity =
      plan.retirementActionEligibilityFacts?.sepSimpleActivities.find(
        (item) => item.sourceAccountId === activity.sourceAccountId &&
          item.actionTaxYear === taxYear,
      )
    if (activity.activityKind === 'ownedIraEmployerContribution' &&
        (!ownerModeledAlive ||
          currentYearEmployerActivity?.employerContributionMadeForPlanYear !==
            true)) {
      classificationIssues.push(issue(
        'activityUnsupported',
        'Employer IRA contribution activity requires current-year SEP/SIMPLE Plan evidence that the contribution was made',
        { activityId: activity.activityId, sourceAccountId: activity.sourceAccountId },
      ))
    }
  }
  if (classificationIssues.length > 0) return blocked(classificationIssues)

  const contributionEvents = activities.filter(
    (activity) => activity.activityKind === 'ownedIraContribution',
  )
  const contributionById = new Map(
    contributionEvents.map((activity) => [activity.activityId, activity] as const),
  )
  const designationById = new Map<string, {
    designatedTaxYear: number
    nondeductibleContributionAmount: UsdCents
  }>()
  const contributionIssues: SimulatorOwnedNonRothIraAnnualPlanningEvidenceIssue[] = []
  for (const raw of assumptions.settledContributionDesignations) {
    if (!isRecord(raw) || !nonblank(raw.activityId) ||
        (raw.designatedTaxYear !== taxYear &&
          raw.designatedTaxYear !== taxYear - 1) ||
        designationById.has(raw.activityId)) {
      contributionIssues.push(issue(
        'contributionDesignationIncomplete',
        'Each in-year contribution needs one unique tax-year designation',
        { activityId: isRecord(raw) && typeof raw.activityId === 'string' ? raw.activityId : undefined },
      ))
      continue
    }
    const activity = contributionById.get(raw.activityId)
    if (typeof raw.nondeductibleContributionAmount !== 'number') {
      contributionIssues.push(issue(
        'contributionAssumptionInvalid',
        'Nondeductible contribution assumption must be a projection-dollar number',
        { activityId: raw.activityId },
      ))
      continue
    }
    let amount: UsdCents
    try { amount = planDollarsToLedgerCents(raw.nondeductibleContributionAmount) } catch (error) {
      contributionIssues.push(issue(
        'contributionAssumptionInvalid',
        `Nondeductible contribution assumption is invalid: ${safeError(error)}`,
        { activityId: raw.activityId },
      ))
      continue
    }
    if (activity === undefined || amount > activity.grossAmount) {
      contributionIssues.push(issue(
        'contributionAssumptionInvalid',
        'Nondeductible designation must reference one actual personal contribution and cannot exceed its gross',
        { activityId: raw.activityId },
      ))
      continue
    }
    designationById.set(raw.activityId, {
      designatedTaxYear: raw.designatedTaxYear,
      nondeductibleContributionAmount: amount,
    })
  }
  if (!sameStrings(
    [...designationById.keys()].sort(compareUtf16CodeUnits),
    [...contributionById.keys()].sort(compareUtf16CodeUnits),
  )) contributionIssues.push(issue(
    'contributionDesignationIncomplete',
    'Every settled personal IRA contribution, including a fully deductible one, needs exactly one designation',
  ))

  const postYearCanonical: Array<{
    sourceAccountId: AccountId
    designatedTaxYear: number
    contributionDate: string
    nondeductibleContributionAmount: PositiveUsdCents
  }> = []
  const postYearKeys = new Set<string>()
  const followingYearStart = `${String(taxYear + 1).padStart(4, '0')}-01-01`
  for (const raw of assumptions.postYearPriorTaxYearContributions) {
    if (!isRecord(raw)) {
      contributionIssues.push(issue('contributionAssumptionInvalid', 'Post-year contribution must be an object'))
      continue
    }
    const parsedAccount = accountIdSchema.safeParse(raw.sourceAccountId)
    const date = canonicalDate(raw.contributionDate)
    if (typeof raw.nondeductibleContributionAmount !== 'number') {
      contributionIssues.push(issue(
        'contributionAssumptionInvalid',
        'Post-year contribution assumption must be a projection-dollar number',
        { sourceAccountId: typeof raw.sourceAccountId === 'string' ? raw.sourceAccountId : undefined },
      ))
      continue
    }
    let amount: PositiveUsdCents
    try {
      amount = asPositiveUsdCents(
        planDollarsToLedgerCents(raw.nondeductibleContributionAmount),
      )
    } catch (error) {
      contributionIssues.push(issue(
        'contributionAssumptionInvalid',
        `Post-year contribution must cross to positive exact cents: ${safeError(error)}`,
        { sourceAccountId: typeof raw.sourceAccountId === 'string' ? raw.sourceAccountId : undefined },
      ))
      continue
    }
    const key = JSON.stringify([
      raw.sourceAccountId,
      raw.designatedTaxYear,
      raw.contributionDate,
    ])
    if (!parsedAccount.success || !accountSet.has(parsedAccount.success ? parsedAccount.data : '' as AccountId) ||
        raw.designatedTaxYear !== taxYear || date === null ||
        date < followingYearStart || date > deadlineDate || postYearKeys.has(key)) {
      contributionIssues.push(issue(
        'contributionAssumptionInvalid',
        'Post-year contribution must be unique, designate the tax year, belong to the pool, and occur by the modeled ordinary deadline',
        { sourceAccountId: typeof raw.sourceAccountId === 'string' ? raw.sourceAccountId : undefined },
      ))
      continue
    }
    if (personalContributionEligibleBySource.get(parsedAccount.data) !== true) {
      contributionIssues.push(issue(
        'contributionAssumptionInvalid',
        'Post-year personal IRA contribution assumptions require a non-SIMPLE source and the same positive Plan contribution route accepted by the canonical inventory producer',
        { sourceAccountId: parsedAccount.data },
      ))
      continue
    }
    postYearKeys.add(key)
    postYearCanonical.push({
      sourceAccountId: parsedAccount.data,
      designatedTaxYear: taxYear,
      contributionDate: date,
      nondeductibleContributionAmount: amount,
    })
  }
  if (contributionIssues.length > 0) return blocked(contributionIssues)
  postYearCanonical.sort((left, right) =>
    compareUtf16CodeUnits(left.contributionDate, right.contributionDate) ||
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId))
  const canonicalDesignations = [...designationById.entries()]
    .sort(([left], [right]) => compareUtf16CodeUnits(left, right))
    .map(([activityId, designation]) => ({
      activityId,
      designatedTaxYear: designation.designatedTaxYear,
      nondeductibleContributionAmount:
        designation.nondeductibleContributionAmount,
    }))

  const priorYearPhysicalContributions = canonicalDesignations
    .filter((designation) => designation.designatedTaxYear === taxYear - 1 &&
      designation.nondeductibleContributionAmount > 0)
    .map((designation) => {
      const activity = contributionById.get(designation.activityId)!
      return {
        sourceAccountId: activity.sourceAccountId,
        designatedTaxYear: taxYear - 1,
        contributionDate: activity.executionDate,
        nondeductibleContributionAmount:
          designation.nondeductibleContributionAmount,
      }
    })
    .sort((left, right) =>
      compareUtf16CodeUnits(left.contributionDate, right.contributionDate) ||
      compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId) ||
      left.nondeductibleContributionAmount -
        right.nondeductibleContributionAmount)
  const priorPostYearAssumptions = priorCarryforwardEvidence?.
    postYearPriorTaxYearContributionAssumptions
  if (priorYearPhysicalContributions.length > 0 &&
      !Array.isArray(priorPostYearAssumptions)) {
    return blocked([issue(
      'contributionDesignationIncomplete',
      'A prior-year-designated physical contribution requires exact prior planning evidence',
    )])
  }
  if (Array.isArray(priorPostYearAssumptions)) {
    const expectedPriorYearContributions: typeof priorYearPhysicalContributions = []
    for (const raw of priorPostYearAssumptions) {
      if (!isRecord(raw) || !accountIdSchema.safeParse(raw.sourceAccountId).success ||
          raw.designatedTaxYear !== taxYear - 1 ||
          canonicalDate(raw.contributionDate) === null ||
          !Number.isSafeInteger(raw.nondeductibleContributionAmount) ||
          Number(raw.nondeductibleContributionAmount) <= 0) {
        return blocked([issue(
          'openingBasisMismatch',
          'Prior planning evidence contains an invalid post-year contribution assumption',
        )])
      }
      expectedPriorYearContributions.push({
        sourceAccountId: accountIdSchema.parse(raw.sourceAccountId),
        designatedTaxYear: taxYear - 1,
        contributionDate: String(raw.contributionDate),
        nondeductibleContributionAmount: asUsdCents(
          Number(raw.nondeductibleContributionAmount),
        ),
      })
    }
    expectedPriorYearContributions.sort((left, right) =>
      compareUtf16CodeUnits(left.contributionDate, right.contributionDate) ||
      compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId) ||
      left.nondeductibleContributionAmount -
        right.nondeductibleContributionAmount)
    if (JSON.stringify(expectedPriorYearContributions) !==
        JSON.stringify(priorYearPhysicalContributions)) {
      return blocked([issue(
        'contributionDesignationIncomplete',
        'Prior-year-designated physical contributions must exact-match the predecessor carryforward assumptions',
      )])
    }
  }

  let inYearContribution: UsdCents
  let postYearContribution: UsdCents
  let allocationNumerator: UsdCents
  try {
    inYearContribution = safeCents(
      [...designationById.values()]
        .filter((designation) => designation.designatedTaxYear === taxYear)
        .reduce(
          (sum, designation) =>
            sum + BigInt(designation.nondeductibleContributionAmount),
          0n,
        ),
      'In-year nondeductible contributions',
    )
    postYearContribution = safeCents(
      postYearCanonical.reduce(
        (sum, item) => sum + BigInt(item.nondeductibleContributionAmount),
        0n,
      ),
      'Post-year nondeductible contributions',
    )
    allocationNumerator = safeCents(
      BigInt(openingPlanningBasis) + BigInt(inYearContribution),
      'Planning allocation numerator',
    )
  } catch (error) {
    return blocked([issue('amountOverflow', safeError(error))])
  }

  const distributions = activities.filter(
    (activity) => activity.activityKind === 'distribution',
  )
  const conversions = activities.filter(
    (activity) => activity.activityKind === 'rothConversion',
  )
  let distributionGross: UsdCents
  let conversionGross: UsdCents
  let denominator: UsdCents
  let annualBasisRatio: SimulatorOwnedNonRothIraPlanningBasisRatio
  let distributionAllocation: SimulatorOwnedNonRothIraPlanningAllocationEvidence
  let conversionAllocation: SimulatorOwnedNonRothIraPlanningAllocationEvidence
  try {
    distributionGross = safeCents(
      distributions.reduce((sum, item) => sum + BigInt(item.grossAmount), 0n),
      'Planning distributions',
    )
    conversionGross = safeCents(
      conversions.reduce((sum, item) => sum + BigInt(item.grossAmount), 0n),
      'Planning conversions',
    )
    denominator = safeCents(
      BigInt(observedAggregate) + BigInt(distributionGross) + BigInt(conversionGross),
      'Planning annual denominator',
    )
    annualBasisRatio = ratio(allocationNumerator, denominator)
    ;({ distributionAllocation, conversionAllocation } = allocateAnnualScopes(
      annualBasisRatio,
      distributions,
      conversions,
    ))
  } catch (error) {
    return blocked([issue('annualAllocationInvalid', safeError(error))])
  }
  const recovered = BigInt(distributionAllocation.annualBasisReturnAmount) +
    BigInt(conversionAllocation.annualBasisReturnAmount)
  if (recovered > BigInt(allocationNumerator)) {
    return blocked([issue(
      'annualAllocationInvalid',
      'Combined annual planning allocation cannot recover more than the current allocation basis',
    )])
  }
  let nextYearBasis: UsdCents
  try {
    nextYearBasis = safeCents(
      BigInt(openingPlanningBasis) + BigInt(inYearContribution) +
        BigInt(postYearContribution) - recovered,
      'Next-year opening planning basis',
    )
  } catch (error) {
    return blocked([issue('amountOverflow', safeError(error))])
  }

  const claims = new Map<string, IdentifierClaim[]>()
  const idIssues: SimulatorOwnedNonRothIraAnnualPlanningEvidenceIssue[] = []
  claimPlanIdentifiers(plan, planId, claims, idIssues)
  claimIdentifier(
    claims,
    ledgerRunId,
    'annualLedgerRunId',
    [planId, taxYear, ledgerRunId],
    'Planning ledger-run ID',
    idIssues,
  )
  claimIdentifier(
    claims,
    observation.evidenceId,
    'annualObservationEvidenceId',
    [observation],
    'Annual observation evidence ID',
    idIssues,
  )
  const observationLineageRecords = [
    scopeRecord,
    basisRecord,
    ...balanceRecords,
    windowRecord,
    windowRecord
      .deadlineObservation as Record<string, unknown>,
  ] as const
  for (const [index, record] of observationLineageRecords.entries()) {
    for (const key of ['upstreamEvidenceId', 'evidenceId'] as const) {
      claimIdentifier(
        claims,
        record[key],
        'annualObservationLineageId',
        [index, key, record],
        `Annual-observation lineage ${index} ${key}`,
        idIssues,
        false,
        true,
      )
    }
  }
  for (const [value, role, label] of [
    [transactionInventory.runtimeInventoryEvidenceId,
      'runtimeInventoryEvidenceId', 'Runtime inventory evidence ID'],
    [transactionInventory.runtimeInventoryUpstreamEvidenceId,
      'runtimeInventoryUpstreamEvidenceId',
      'Runtime inventory upstream evidence ID'],
    [transactionInventory.inventoryEvidenceId,
      'annualPhysicalInventoryEvidenceId',
      'Annual physical inventory evidence ID'],
    [transaction.transactionEvidenceId,
      'annualPhysicalTransactionEvidenceId',
      'Annual physical transaction evidence ID'],
  ] as const) {
    claimIdentifier(
      claims,
      value,
      role,
      [planId, ownerPersonId, taxYear, ledgerRunId, role, value],
      label,
      idIssues,
    )
  }
  const claimedRuntimeSourceAuthorities = new Set<string>()
  for (const event of canonicalSelectedPoolEvents) {
    claimIdentifier(
      claims,
      event.eventId,
      'annualPhysicalInventoryEventId',
      [event],
      `Annual physical event ID ${String(event.eventId)}`,
      idIssues,
    )
    if (event.origin !== 'planAction') {
      const movementAuthorityId = String(event.movementAuthorityId)
      if (!claimedRuntimeSourceAuthorities.has(movementAuthorityId)) {
        claimIdentifier(
          claims,
          movementAuthorityId,
          'runtimeMovementAuthorityId',
          [event.ownerPersonId, event.kind, event.origin, event.eventDate,
            event.eventSequence, movementAuthorityId],
          `Runtime movement authority ${movementAuthorityId}`,
          idIssues,
        )
        claimedRuntimeSourceAuthorities.add(movementAuthorityId)
      }
      claimIdentifier(
        claims,
        event.upstreamEvidenceId,
        'runtimeEventUpstreamEvidenceId',
        [event],
        `Runtime event upstream evidence ${String(event.eventId)}`,
        idIssues,
      )
    }
  }
  for (const value of identifierValues(transactionInventory)) {
    if (claims.has(value)) continue
    claimIdentifier(
      claims,
      value,
      'annualInventoryNestedIdentifier',
      [transactionInventory.inventoryEvidenceId, value],
      `annual inventory nested identifier ${value}`,
      idIssues,
    )
  }
  const claimedDerivedRuntimeActions = new Set<string>()
  for (const application of transaction.applications) {
    if (!isRecord(application)) continue
    if (application.eventOrigin !== 'planAction' &&
        nonblank(application.actionId) &&
        !claimedDerivedRuntimeActions.has(application.actionId)) {
      claimIdentifier(
        claims,
        application.actionId,
        'derivedRuntimeActionId',
        [application.eventOrigin, application.eventKind,
          application.scheduledDate, application.scheduledSequence,
          application.actionId],
        `Derived runtime action ${application.actionId}`,
        idIssues,
      )
      claimedDerivedRuntimeActions.add(application.actionId)
    }
    if (application.eventOrigin !== 'planAction') {
      claimIdentifier(
        claims,
        application.allocationId,
        'derivedRuntimeAllocationId',
        [application.inventoryEventId, application.sourceAccountId,
          application.allocationId],
        `Derived runtime allocation ${String(application.allocationId)}`,
        idIssues,
      )
    }
    for (const [value, role, label] of [
      [application.stagingEvidenceId,
        'physicalApplicationStagingEvidenceId',
        `Physical staging evidence ${String(application.inventoryEventId)}`],
      [application.applicationEvidenceId,
        'physicalApplicationEvidenceId',
        `Physical application evidence ${String(application.inventoryEventId)}`],
    ] as const) {
      claimIdentifier(
        claims,
        value,
        role,
        [application.inventoryEventId, role, application],
        label,
        idIssues,
      )
    }
  }
  for (const contribution of transaction.settledContributionApplications) {
    if (!isRecord(contribution)) continue
    for (const [value, role, label] of [
      [contribution.stagingEvidenceId,
        'settledContributionStagingEvidenceId',
        `Settled contribution staging evidence ${String(contribution.inventoryEventId)}`],
      [contribution.applicationEvidenceId,
        'settledContributionApplicationEvidenceId',
        `Settled contribution application evidence ${String(contribution.inventoryEventId)}`],
    ] as const) {
      claimIdentifier(
        claims,
        value,
        role,
        [contribution.inventoryEventId, role, contribution],
        label,
        idIssues,
      )
    }
  }
  for (const transition of transaction.sourceBalanceTransitions) {
    if (!isRecord(transition)) continue
    for (const [value, role, label] of [
      [transition.upstreamEvidenceId,
        'sourceBalanceTransitionUpstreamEvidenceId',
        `Source transition upstream evidence ${String(transition.sourceAccountId)}`],
      [transition.evidenceId,
        'sourceBalanceTransitionEvidenceId',
        `Source transition evidence ${String(transition.sourceAccountId)}`],
    ] as const) {
      claimIdentifier(
        claims,
        value,
        role,
        [transition.sourceAccountId, role, transition],
        label,
        idIssues,
      )
    }
  }
  for (const credit of transaction.stagedDestinationCredits) {
    if (!isRecord(credit)) continue
    claimIdentifier(
      claims,
      credit.evidenceId,
      'rothDestinationCreditEvidenceId',
      [credit],
      `Roth destination credit ${String(credit.inventoryEventId)}`,
      idIssues,
    )
  }
  for (const [value, role, label] of [
    [transaction.line8InventoryEvidence.upstreamEvidenceId,
      'line8InventoryUpstreamEvidenceId', 'Line-8 inventory upstream evidence'],
    [transaction.line8InventoryEvidence.evidenceId,
      'line8InventoryEvidenceId', 'Line-8 inventory evidence'],
  ] as const) {
    claimIdentifier(
      claims,
      value,
      role,
      [role, transaction.line8InventoryEvidence],
      label,
      idIssues,
    )
  }
  claimIdentifier(
    claims,
    inventory.upstreamEvidenceId,
    'activityInventoryUpstreamEvidenceId',
    [canonicalInventoryBody],
    'Activity-inventory upstream evidence ID',
    idIssues,
  )
  claimIdentifier(
    claims,
    inventory.evidenceId,
    'activityInventoryEvidenceId',
    [canonicalInventoryBody],
    'Activity-inventory evidence ID',
    idIssues,
  )
  if (opening.source === 'priorProjectionCarryforward') {
    const prior = priorCarryforwardEvidence!
    const priorPlanning = priorPlanningEvidence!
    claimIdentifier(
      claims,
      prior.evidenceId,
      'priorCarryforwardEvidenceId',
      [prior],
      'Prior carryforward evidence definition',
      idIssues,
    )
    claimIdentifier(
      claims,
      opening.priorCarryforwardEvidenceId,
      'priorCarryforwardEvidenceId',
      [prior],
      'Prior carryforward evidence reference',
      idIssues,
      true,
    )
    claimIdentifier(
      claims,
      priorPlanning.evidenceId,
      'priorSourcePlanningEvidenceId',
      [priorPlanning],
      'Prior source planning evidence definition',
      idIssues,
    )
    claimIdentifier(
      claims,
      prior.sourcePlanningEvidenceId,
      'priorSourcePlanningEvidenceId',
      [priorPlanning],
      'Prior source planning evidence reference',
      idIssues,
      true,
    )
    claimIdentifier(
      claims,
      prior.sourceLedgerRunId,
      'priorSourceLedgerRunId',
      [prior.sourceLedgerRunId, prior.fromTaxYear, prior.ownerPersonId],
      'Prior source ledger-run ID',
      idIssues,
    )
  }
  if (idIssues.length > 0) return blocked(idIssues)

  const assumptionsBinding = {
    predicate: assumptions.predicate,
    poolScope: assumptions.poolScope,
    realWorldAccountCompleteness: assumptions.realWorldAccountCompleteness,
    openingBasis: opening,
    rolloverAssumption: rollover,
    settledContributionDesignations: canonicalDesignations,
    postYearWindowStatus: assumptions.postYearWindowStatus,
    postYearPriorTaxYearContributions: postYearCanonical,
  }
  let assumptionsEvidenceId: string
  try {
    assumptionsEvidenceId = deriveActionStructuralId(
      'simulator-owned-ira-annual-planning-assumptions',
      [planId, ownerPersonId, taxYear, ledgerRunId, assumptionsBinding],
    )
  } catch (error) {
    return blocked([issue('identifierDerivationFailed', safeError(error))])
  }
  claimIdentifier(
    claims,
    assumptionsEvidenceId,
    'derivedPlanningAssumptionsEvidenceId',
    [planId, ownerPersonId, taxYear, ledgerRunId, assumptionsBinding],
    'Derived planning-assumptions evidence ID',
    idIssues,
  )
  claimIdentifier(
    claims,
    distributionAllocation.evidenceId,
    'derivedPlanningDistributionAllocationEvidenceId',
    [distributionAllocation],
    'Derived distribution-allocation evidence ID',
    idIssues,
  )
  claimIdentifier(
    claims,
    conversionAllocation.evidenceId,
    'derivedPlanningConversionAllocationEvidenceId',
    [conversionAllocation],
    'Derived conversion-allocation evidence ID',
    idIssues,
  )
  if (idIssues.length > 0) return blocked(idIssues)

  const withoutId = {
    predicate: 'completeSimulatorOwnedNonRothIraAnnualPlanningEvidence' as const,
    planId,
    ownerPersonId,
    taxYear,
    projectionStartTaxYear,
    ledgerRunId,
    evidenceScope:
      'projectionPlanningEstimateOnlyNotTaxReturnEvidence' as const,
    filingCompleteness: 'notEstablished' as const,
    realWorldAccountCompleteness: 'notEstablished' as const,
    taxReturnUse: 'prohibited' as const,
    assumptionStatus: 'explicitProjectionAssumptionsApplied' as const,
    accountIds: accountIds as [AccountId, ...AccountId[]],
    observationEvidenceId: observation.evidenceId as string,
    activityInventoryEvidenceId: inventory.evidenceId as string,
    assumptionsEvidenceId,
    openingPlanningBasisAmount: openingPlanningBasis,
    inYearNondeductibleContributionAmount: inYearContribution,
    postYearPriorTaxYearNondeductibleContributionAmount: postYearContribution,
    postYearPriorTaxYearContributionAssumptions: postYearCanonical,
    allocationBasisNumeratorAmount: allocationNumerator,
    observedYearEndApplicablePoolBalanceAmount: observedAggregate,
    assumedOutstandingRolloverAmount: 0 as const,
    assumedRolloverRepaymentAdjustmentAmount: 0 as const,
    annualBasisDenominatorAmount: denominator,
    annualBasisRatio,
    distributionAllocation,
    conversionAllocation,
    nextYearOpeningPlanningBasisAmount: nextYearBasis,
    displayCopy:
      'Projected IRA tax treatment uses complete simulated Plan activity and explicit basis, contribution, and no-rollover assumptions. It is not Form 8606 or tax-return evidence.' as const,
  }
  let evidenceId: string
  try {
    evidenceId = deriveActionStructuralId(
      'simulator-owned-ira-annual-planning-evidence',
      [withoutId],
    )
  } catch (error) {
    return blocked([issue('identifierDerivationFailed', safeError(error))])
  }
  claimIdentifier(
    claims,
    evidenceId,
    'derivedAnnualPlanningEvidenceId',
    [withoutId],
    'Derived annual planning evidence ID',
    idIssues,
  )
  if (idIssues.length > 0) return blocked(idIssues)
  const carryforwardWithoutId = {
    predicate:
      'completeSimulatorOwnedNonRothIraPlanningCarryforwardEvidence' as const,
    planId,
    ownerPersonId,
    projectionStartTaxYear,
    fromTaxYear: taxYear,
    toTaxYear: taxYear + 1,
    sourceLedgerRunId: ledgerRunId,
    sourcePlanningEvidenceId: evidenceId,
    accountIds: accountIds as [AccountId, ...AccountId[]],
    openingPlanningBasisAmount: nextYearBasis,
    postYearPriorTaxYearContributionAssumptions: postYearCanonical,
    evidenceScope:
      'projectionPlanningCarryforwardOnlyNotTaxReturnEvidence' as const,
    taxReturnUse: 'prohibited' as const,
  }
  let carryforwardEvidenceId: string
  try {
    carryforwardEvidenceId = deriveActionStructuralId(
      'simulator-owned-ira-planning-carryforward-evidence',
      [carryforwardWithoutId],
    )
  } catch (error) {
    return blocked([issue('identifierDerivationFailed', safeError(error))])
  }
  claimIdentifier(
    claims,
    carryforwardEvidenceId,
    'derivedPlanningCarryforwardEvidenceId',
    [carryforwardWithoutId],
    'Derived planning carryforward evidence ID',
    idIssues,
  )
  if (idIssues.length > 0) return blocked(idIssues)
  return deepFreeze({
    status: 'annualPlanningEvidenceBuilt',
    movement: 'notCommitted',
    simulationActionability: 'established',
    realWorldActionability: 'notEstablished',
    planningEvidence: { ...withoutId, evidenceId },
    carryforwardEvidence: {
      ...carryforwardWithoutId,
      evidenceId: carryforwardEvidenceId,
    },
    issues: [],
  })
}

/**
 * Builds projection-only annual owned-IRA tax-character evidence. It accepts
 * explicit planning assumptions where future filing facts cannot exist, and it
 * never establishes Form 8606 completeness or real-world movement authority.
 */
export function buildSimulatorOwnedNonRothIraAnnualPlanningEvidence(
  input: Readonly<BuildSimulatorOwnedNonRothIraAnnualPlanningEvidenceInput>,
): Readonly<BuildSimulatorOwnedNonRothIraAnnualPlanningEvidenceResult> {
  try {
    return buildUnchecked(input)
  } catch (error) {
    return blocked([issue(
      'inputInvalid',
      `Annual planning evidence failed closed: ${safeError(error)}`,
    )])
  }
}
