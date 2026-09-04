import {
  planSchema,
  selectedLogicalAccounts,
  selectedLogicalBalanceAccounts,
  type Plan,
} from '../model/plan.js'
import {
  accountIdSchema,
  personIdSchema,
  planIdSchema,
  type AccountId,
  type PersonId,
  type PlanId,
} from '../actions/identity.js'
import { planDollarsToLedgerCents } from '../actions/planBalanceAdapter.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from '../actions/structuralId.js'
import { asUsdCents, type UsdCents } from '../actions/money.js'
import { isTreatAsOwnEffective } from '../strategies/accountEligibility.js'
import { deepFreeze } from '../actions/freeze.js'
import { ordinaryFederalFilingDeadline } from '../tax/ordinaryFederalFilingDeadline.js'

const MAX_SAFE_CENTS = BigInt(Number.MAX_SAFE_INTEGER)

export interface SimulatorOwnedNonRothIraYearEndBalanceObservation {
  sourceAccountId: string
  balance: number
}

export interface BuildSimulatorOwnedNonRothIraAnnualObservationInput {
  plan: unknown
  ownerPersonId: string
  taxYear: number
  ledgerRunId: string
  observationBoundary: 'sealedAfterAllAnnualTransactionsAndGrowth'
  startOfTaxYearIraBasis: number
  /**
   * Preserves an already-normalized simulator aggregate that cannot make an
   * exact cents -> Plan dollars -> cents round trip.
   *
   * @internal
   */
  startOfTaxYearIraBasisAmount?: UsdCents
  yearEndBalances:
    readonly Readonly<SimulatorOwnedNonRothIraYearEndBalanceObservation>[]
}

export type SimulatorOwnedNonRothIraAnnualObservationIssueKind =
  | 'planInvalid'
  | 'ownerInvalid'
  | 'ownerNotFound'
  | 'taxYearInvalid'
  | 'ledgerRunInvalid'
  | 'observationBoundaryInvalid'
  | 'ownedIraPoolEmpty'
  | 'startOfTaxYearBasisInvalid'
  | 'yearEndBalanceInvalid'
  | 'yearEndBalanceDuplicate'
  | 'yearEndBalanceMissing'
  | 'yearEndBalanceForeign'
  | 'yearEndBalanceAggregateOverflow'
  | 'filingDeadlineUnsupported'
  | 'identifierCollision'
  | 'observationConstructionInvalid'

export interface SimulatorOwnedNonRothIraAnnualObservationIssue {
  kind: SimulatorOwnedNonRothIraAnnualObservationIssueKind
  detail: string
  sourceAccountId?: string
  identifier?: string
}

export interface ProjectionModelOwnedIraEvidenceScope {
  predicate: 'projectionModelOwnedIraAnnualEvidenceScope'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  scope: 'projectionModelOnlyNotRealWorldFilingCompleteness'
  postYearContributionBoundary:
    'projectionModelHasNoPostDecember31PriorYearContributionDesignation'
  rolloverBoundary:
    'projectionModelDoesNotRepresentOutstandingRolloverOrRepaymentAdjustment'
  upstreamEvidenceId: string
  evidenceId: string
}

/**
 * A simulator observation of the caller-supplied opening basis. It deliberately
 * does not satisfy the filing-grade annual-basis record consumed by the Form
 * 8606 classifier because rollover facts are outside the projection model.
 */
export interface SimulatorOwnedNonRothIraStartOfTaxYearBasisObservation {
  predicate: 'simulatorOwnedNonRothIraStartOfTaxYearBasisObservation'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  evidenceScope: 'projectionModelOnlyNotRealWorldFilingCompleteness'
  basisStatus: 'callerSuppliedStartOfTaxYearBasisObserved'
  startOfTaxYearIraBasisAmount: UsdCents
  rolloverFactsStatus: 'notRepresentedByProjection'
  upstreamEvidenceId: string
  evidenceId: string
}

export interface SimulatorOwnedNonRothIraOrdinaryDeadlineObservation {
  predicate: 'simulatorOwnedNonRothIraOrdinaryDeadlineObservation'
  planId: PlanId
  ownerPersonId: PersonId
  designatedTaxYear: number
  ledgerRunId: string
  evidenceScope: 'projectionModelOnlyNotAuthoritativeFilingEvidence'
  deadlineStatus: 'modeledOrdinaryFederalDeadlineCalculated'
  deadlineKind: 'ordinaryFederalFilingDeadlineExcludingDisasterRelief'
  calendarAdjustmentStatus:
    'weekendAndDistrictOfColumbiaHolidayAdjustmentApplied'
  deadlineDate: string
  upstreamEvidenceId: string
  evidenceId: string
}

/**
 * Explicitly empty only within the projection model. It cannot be passed as a
 * complete real-world post-year contribution inventory to the classifier.
 */
export interface SimulatorOwnedNonRothIraProjectionPostYearContributionWindow {
  predicate: 'simulatorOwnedNonRothIraProjectionPostYearContributionWindow'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  evidenceScope: 'projectionModelOnlyNotRealWorldFilingCompleteness'
  inventoryStatus: 'explicitlyEmptyWithinProjectionModelOnly'
  realWorldFilingCompleteness: 'notEstablished'
  deadlineObservation:
    Readonly<SimulatorOwnedNonRothIraOrdinaryDeadlineObservation>
  contributions: readonly []
  upstreamEvidenceId: string
  evidenceId: string
}

/**
 * A complete December 31 balance observation only within the projection
 * model. Its distinct predicate and phase prevent structural assignment to
 * the filing-grade Form 8606 balance contract.
 */
export interface SimulatorOwnedNonRothIraYearEndApplicableBalanceObservation {
  predicate: 'simulatorOwnedNonRothIraYearEndApplicableBalanceObservation'
  planId: PlanId
  ownerPersonId: PersonId
  sourceAccountId: AccountId
  taxYear: number
  ledgerRunId: string
  evidenceScope: 'projectionModelOnlyNotRealWorldFilingCompleteness'
  ledgerPhase: 'projectionModelDecember31AfterAllAnnualTransactionsAndGrowth'
  asOfDate: string
  yearEndApplicableBalanceAmount: UsdCents
  evidenceId: string
  upstreamEvidenceId: string
}

interface ObservationResultBase {
  movement: 'notCommitted'
  actionability: 'notEstablished'
}

export interface SimulatorOwnedNonRothIraAnnualObservationBlockedResult
  extends ObservationResultBase {
  status: 'annualObservationBlocked'
  observation: null
  issues: readonly [
    Readonly<SimulatorOwnedNonRothIraAnnualObservationIssue>,
    ...Readonly<SimulatorOwnedNonRothIraAnnualObservationIssue>[],
  ]
}

export interface CompleteSimulatorOwnedNonRothIraAnnualObservation {
  predicate: 'completeSimulatorOwnedNonRothIraAnnualObservation'
  planId: PlanId
  ownerPersonId: PersonId
  taxYear: number
  ledgerRunId: string
  observationBoundary: 'sealedAfterAllAnnualTransactionsAndGrowth'
  asOfDate: string
  evidenceScope: Readonly<ProjectionModelOwnedIraEvidenceScope>
  yearEndApplicableBalances:
    readonly Readonly<SimulatorOwnedNonRothIraYearEndApplicableBalanceObservation>[]
  aggregateYearEndApplicableBalanceAmount: UsdCents
  startOfTaxYearBasisObservation:
    Readonly<SimulatorOwnedNonRothIraStartOfTaxYearBasisObservation>
  projectionPostYearContributionWindow:
    Readonly<SimulatorOwnedNonRothIraProjectionPostYearContributionWindow>
  evidenceId: string
}

export interface SimulatorOwnedNonRothIraAnnualObservationBuiltResult
  extends ObservationResultBase {
  status: 'annualObservationBuilt'
  observation: Readonly<CompleteSimulatorOwnedNonRothIraAnnualObservation>
  issues: readonly []
}

export type BuildSimulatorOwnedNonRothIraAnnualObservationResult =
  | SimulatorOwnedNonRothIraAnnualObservationBlockedResult
  | SimulatorOwnedNonRothIraAnnualObservationBuiltResult

function blocked(
  issues: readonly SimulatorOwnedNonRothIraAnnualObservationIssue[],
): Readonly<SimulatorOwnedNonRothIraAnnualObservationBlockedResult> {
  return deepFreeze({
    status: 'annualObservationBlocked',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    observation: null,
    issues: issues as [
      SimulatorOwnedNonRothIraAnnualObservationIssue,
      ...SimulatorOwnedNonRothIraAnnualObservationIssue[],
    ],
  })
}

interface IdentifierClaim {
  role: string
  binding: string
  label: string
}

function claimIdentifier(
  claimed: Map<string, IdentifierClaim[]>,
  identifier: unknown,
  role: string,
  bindingParts: readonly unknown[],
  label: string,
  allowSameRoleDifferentBinding = false,
): SimulatorOwnedNonRothIraAnnualObservationIssue | null {
  if (typeof identifier !== 'string' || identifier.trim().length === 0) {
    return {
      kind: 'identifierCollision',
      detail: `${label} must be a nonblank stable identifier`,
      identifier: typeof identifier === 'string' ? identifier : undefined,
    }
  }
  const existing = claimed.get(identifier) ?? []
  const crossRole = existing.find((claim) => claim.role !== role)
  if (crossRole !== undefined) {
    return {
      kind: 'identifierCollision',
      detail: `${label} collides with ${crossRole.label}`,
      identifier,
    }
  }
  const binding = deriveActionStructuralId(
    'simulator-owned-ira-annual-identifier-binding',
    bindingParts,
  )
  const sameBinding = existing.find((claim) => claim.binding === binding)
  if (sameBinding !== undefined ||
      (existing.length > 0 && !allowSameRoleDifferentBinding)) {
    return {
      kind: 'identifierCollision',
      detail: `${label} is rebound from ${
        (sameBinding ?? existing[0])!.label}`,
      identifier,
    }
  }
  claimed.set(identifier, [...existing, {
    role,
    binding,
    label,
  }])
  return null
}

function claimPlanIdentifiers(
  plan: Plan,
  planId: PlanId,
): {
  claimed: Map<string, IdentifierClaim[]>
  issues: SimulatorOwnedNonRothIraAnnualObservationIssue[]
} {
  const claimed = new Map<string, IdentifierClaim[]>()
  const issues: SimulatorOwnedNonRothIraAnnualObservationIssue[] = []
  const claim = (
    identifier: unknown,
    role: string,
    binding: readonly unknown[],
    label: string,
    allowSameRoleDifferentBinding = false,
  ): void => {
    const collision = claimIdentifier(
      claimed,
      identifier,
      role,
      binding,
      label,
      allowSameRoleDifferentBinding,
    )
    if (collision !== null) issues.push(collision)
  }

  claim(planId, 'planId', [planId], 'Plan ID')
  for (const person of plan.household.people) {
    claim(person.id, 'personId', [planId, person], `person ID ${person.id}`)
  }
  for (const account of selectedLogicalAccounts(plan.accounts)) {
    claim(account.id, 'accountId', [planId, account], `account ID ${account.id}`)
  }
  for (const action of plan.strategies.retirementActions) {
    claim(
      action.actionId,
      'actionId',
      [planId, action],
      `action ID ${action.actionId}`,
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
      claim(
        allocation.allocationId,
        'allocationId',
        [action.actionId, allocation],
        `allocation ID ${allocation.allocationId}`,
        true,
      )
    }
  }
  const eligibility = plan.retirementActionEligibilityFacts
  for (const record of eligibility?.iraClassifications ?? []) {
    claim(
      record.evidenceId,
      'iraClassificationEvidenceId',
      [record],
      `IRA classification evidence ID ${record.evidenceId}`,
    )
  }
  for (const record of eligibility?.sepSimpleActivities ?? []) {
    claim(
      record.evidenceId,
      'sepSimpleActivityEvidenceId',
      [record],
      `SEP/SIMPLE activity evidence ID ${record.evidenceId}`,
    )
  }
  for (const record of eligibility?.deductibleIraContributions ?? []) {
    claim(
      record.evidenceId,
      'deductibleIraContributionEvidenceId',
      [record],
      `deductible IRA contribution evidence ID ${record.evidenceId}`,
    )
  }
  return { claimed, issues }
}

function safeErrorDetail(error: unknown): string {
  try {
    if (error instanceof Error) {
      try {
        const message = error.message
        return typeof message === 'string' ? message : 'uninspectable error'
      } catch {
        return 'uninspectable error'
      }
    }
    try {
      return String(error)
    } catch {
      return 'uninspectable error'
    }
  } catch {
    return 'uninspectable error'
  }
}

function ownedIraSourceIds(
  plan: Plan,
  ownerPersonId: PersonId,
  taxYear: number,
): AccountId[] {
  return selectedLogicalBalanceAccounts(plan.accounts)
    .filter((account) =>
      account.type === 'traditional' &&
      account.kind === 'ira' &&
      (account.inherited === undefined || isTreatAsOwnEffective(account, taxYear)) &&
      account.ownerPersonId === ownerPersonId)
    .map((account) => accountIdSchema.parse(account.id))
    .sort(compareUtf16CodeUnits)
}

/**
 * Builds the post-growth, December 31 evidence needed by the owned-IRA annual
 * pass probe. The explicit-empty contribution window describes only the
 * projection model's supported state; rollover facts are explicitly outside
 * that model and neither observation is filing-grade evidence.
 */
function buildSimulatorOwnedNonRothIraAnnualObservationUnchecked(
  input: Readonly<BuildSimulatorOwnedNonRothIraAnnualObservationInput>,
): Readonly<BuildSimulatorOwnedNonRothIraAnnualObservationResult> {
  // Read each caller-controlled property exactly once. A stateful getter must
  // not be able to replace a value after validation but before evidence is
  // bound to it.
  const rawPlan = input.plan
  const rawOwnerPersonId = input.ownerPersonId
  const taxYear = input.taxYear
  const ledgerRunId = input.ledgerRunId
  const observationBoundary = input.observationBoundary
  const startOfTaxYearIraBasis = input.startOfTaxYearIraBasis
  const startOfTaxYearIraBasisAmount = input.startOfTaxYearIraBasisAmount
  const rawYearEndBalances = input.yearEndBalances
  const issues: SimulatorOwnedNonRothIraAnnualObservationIssue[] = []
  const parsedPlan = planSchema.safeParse(rawPlan)
  if (!parsedPlan.success) {
    return blocked([{
      kind: 'planInvalid',
      detail: 'Annual observation requires a valid Plan',
    }])
  }
  const plan = parsedPlan.data
  const parsedOwner = personIdSchema.safeParse(rawOwnerPersonId)
  if (!parsedOwner.success) {
    return blocked([{
      kind: 'ownerInvalid',
      detail: 'Annual observation owner ID must be nonblank',
    }])
  }
  const ownerPersonId = parsedOwner.data
  if (!plan.household.people.some((person) => person.id === ownerPersonId)) {
    issues.push({
      kind: 'ownerNotFound',
      detail: 'Annual observation owner must belong to the Plan household',
    })
  }
  if (!Number.isInteger(taxYear) || taxYear < 1 || taxYear > 9999) {
    issues.push({
      kind: 'taxYearInvalid',
      detail: 'Annual observation tax year must be an integer from 1 through 9999',
    })
  }
  if (typeof ledgerRunId !== 'string' || ledgerRunId.trim().length === 0) {
    issues.push({
      kind: 'ledgerRunInvalid',
      detail: 'Annual observation ledger-run ID must be nonblank',
    })
  }
  if (observationBoundary !== 'sealedAfterAllAnnualTransactionsAndGrowth') {
    issues.push({
      kind: 'observationBoundaryInvalid',
      detail: 'December 31 balances may be observed only after the annual pass is sealed post-growth',
    })
  }
  const deadlineDate = ordinaryFederalFilingDeadline(taxYear)
  if (deadlineDate === null) {
    issues.push({
      kind: 'filingDeadlineUnsupported',
      detail: 'The following-year ordinary filing deadline cannot be represented by the supported modern calendar for this tax year',
    })
  }

  let planId: PlanId
  try {
    planId = planIdSchema.parse(plan.id)
  } catch {
    return blocked([{
      kind: 'planInvalid',
      detail: 'Annual observation requires a Plan with a valid stable ID',
    }])
  }
  const sourceAccountIds = ownedIraSourceIds(plan, ownerPersonId, taxYear)
  if (sourceAccountIds.length === 0) {
    issues.push({
      kind: 'ownedIraPoolEmpty',
      detail: 'Annual observation requires at least one explicitly owned non-inherited IRA for the owner',
    })
  }
  if (issues.length > 0) return blocked(issues)

  let openingBasisAmount: UsdCents
  try {
    openingBasisAmount = startOfTaxYearIraBasisAmount === undefined
      ? planDollarsToLedgerCents(startOfTaxYearIraBasis)
      : asUsdCents(startOfTaxYearIraBasisAmount)
  } catch (error) {
    return blocked([{
      kind: 'startOfTaxYearBasisInvalid',
      detail: `Start-of-tax-year IRA basis cannot cross the exact-cent boundary: ${safeErrorDetail(error)}`,
    }])
  }

  const expectedSources = new Set(sourceAccountIds)
  const observedBySource = new Map<AccountId, UsdCents>()
  for (const raw of rawYearEndBalances) {
    const rawSourceAccountId = raw.sourceAccountId
    const rawBalance = raw.balance
    const parsedSource = accountIdSchema.safeParse(rawSourceAccountId)
    if (!parsedSource.success) {
      issues.push({
        kind: 'yearEndBalanceInvalid',
        detail: 'Every December 31 observation requires a valid source-account ID',
        sourceAccountId: rawSourceAccountId,
      })
      continue
    }
    const sourceAccountId = parsedSource.data
    if (observedBySource.has(sourceAccountId)) {
      issues.push({
        kind: 'yearEndBalanceDuplicate',
        detail: 'December 31 observations must be unique per source account',
        sourceAccountId,
      })
      continue
    }
    if (!expectedSources.has(sourceAccountId)) {
      issues.push({
        kind: 'yearEndBalanceForeign',
        detail: 'December 31 observation contains an employer, inherited, other-owner, or foreign account',
        sourceAccountId,
      })
      continue
    }
    try {
      observedBySource.set(
        sourceAccountId,
        planDollarsToLedgerCents(rawBalance),
      )
    } catch (error) {
      issues.push({
        kind: 'yearEndBalanceInvalid',
        detail: `December 31 balance cannot cross the exact-cent boundary: ${safeErrorDetail(error)}`,
        sourceAccountId,
      })
    }
  }
  for (const sourceAccountId of sourceAccountIds) {
    if (!observedBySource.has(sourceAccountId)) {
      issues.push({
        kind: 'yearEndBalanceMissing',
        detail: 'December 31 observation must include every owned non-Roth IRA sibling, including zero and unrequested accounts',
        sourceAccountId,
      })
    }
  }
  if (issues.length > 0) return blocked(issues)

  const aggregateBalance = sourceAccountIds.reduce(
    (total, sourceAccountId) =>
      total + BigInt(observedBySource.get(sourceAccountId)!),
    0n,
  )
  if (aggregateBalance > MAX_SAFE_CENTS) {
    return blocked([{
      kind: 'yearEndBalanceAggregateOverflow',
      detail: 'Aggregate December 31 owned-IRA balance exceeds the exact-cent safe-integer range',
    }])
  }

  const planIdentifierClaims = claimPlanIdentifiers(plan, planId)
  if (planIdentifierClaims.issues.length > 0) {
    return blocked(planIdentifierClaims.issues)
  }
  const claimed = planIdentifierClaims.claimed
  const ledgerIssue = claimIdentifier(
    claimed,
    ledgerRunId,
    'annualLedgerRunId',
    [planId, taxYear, ledgerRunId],
    'Annual observation ledger-run ID',
  )
  if (ledgerIssue !== null) return blocked([ledgerIssue])
  const derivedIssues: SimulatorOwnedNonRothIraAnnualObservationIssue[] = []
  const deriveAndClaim = (
    namespace: string,
    parts: readonly unknown[],
    label: string,
  ): string => {
    const identifier = deriveActionStructuralId(namespace, parts)
    const collision = claimIdentifier(
      claimed,
      identifier,
      namespace,
      parts,
      label,
    )
    if (collision !== null) derivedIssues.push(collision)
    return identifier
  }

  const scopeUpstreamEvidenceId = deriveAndClaim(
    'simulator-owned-ira-annual-observation-scope-upstream',
    [
      planId,
      ownerPersonId,
      taxYear,
      ledgerRunId,
      observationBoundary,
    ],
    'Projection-model evidence-scope upstream ID',
  )
  const scopeWithoutId = {
    predicate: 'projectionModelOwnedIraAnnualEvidenceScope' as const,
    planId,
    ownerPersonId,
    taxYear,
    ledgerRunId,
    scope: 'projectionModelOnlyNotRealWorldFilingCompleteness' as const,
    postYearContributionBoundary:
      'projectionModelHasNoPostDecember31PriorYearContributionDesignation' as const,
    rolloverBoundary:
      'projectionModelDoesNotRepresentOutstandingRolloverOrRepaymentAdjustment' as const,
    upstreamEvidenceId: scopeUpstreamEvidenceId,
  }
  const scopeEvidenceId = deriveAndClaim(
    'simulator-owned-ira-annual-observation-scope',
    [scopeWithoutId],
    'Projection-model evidence-scope ID',
  )
  const evidenceScope: ProjectionModelOwnedIraEvidenceScope = {
    ...scopeWithoutId,
    evidenceId: scopeEvidenceId,
  }

  const basisUpstreamEvidenceId = deriveAndClaim(
    'simulator-owned-ira-annual-basis-upstream',
    [scopeEvidenceId, openingBasisAmount],
    'Annual-basis upstream evidence ID',
  )
  const basisWithoutId = {
    predicate: 'simulatorOwnedNonRothIraStartOfTaxYearBasisObservation' as const,
    planId,
    ownerPersonId,
    taxYear,
    ledgerRunId,
    evidenceScope:
      'projectionModelOnlyNotRealWorldFilingCompleteness' as const,
    basisStatus: 'callerSuppliedStartOfTaxYearBasisObserved' as const,
    startOfTaxYearIraBasisAmount: openingBasisAmount,
    rolloverFactsStatus: 'notRepresentedByProjection' as const,
    upstreamEvidenceId: basisUpstreamEvidenceId,
  }
  const basisEvidenceId = deriveAndClaim(
    'simulator-owned-ira-annual-basis',
    [basisWithoutId],
    'Annual-basis evidence ID',
  )
  const startOfTaxYearBasisObservation:
    SimulatorOwnedNonRothIraStartOfTaxYearBasisObservation = {
    ...basisWithoutId,
    evidenceId: basisEvidenceId,
  }

  const asOfDate = `${String(taxYear).padStart(4, '0')}-12-31`
  const yearEndApplicableBalances = sourceAccountIds.map((sourceAccountId) => {
    const amount = observedBySource.get(sourceAccountId)!
    const upstreamEvidenceId = deriveAndClaim(
      'simulator-owned-ira-year-end-balance-upstream',
      [
        scopeEvidenceId,
        sourceAccountId,
        asOfDate,
        amount,
      ],
      `December 31 balance upstream evidence ID for ${sourceAccountId}`,
    )
    const withoutId = {
      predicate:
        'simulatorOwnedNonRothIraYearEndApplicableBalanceObservation' as const,
      planId,
      ownerPersonId,
      sourceAccountId,
      taxYear,
      ledgerRunId,
      evidenceScope:
        'projectionModelOnlyNotRealWorldFilingCompleteness' as const,
      ledgerPhase:
        'projectionModelDecember31AfterAllAnnualTransactionsAndGrowth' as const,
      asOfDate,
      yearEndApplicableBalanceAmount: amount,
      upstreamEvidenceId,
    }
    const evidenceId = deriveAndClaim(
      'simulator-owned-ira-year-end-balance',
      [withoutId],
      `December 31 balance evidence ID for ${sourceAccountId}`,
    )
    return { ...withoutId, evidenceId }
  })

  const deadlineUpstreamEvidenceId = deriveAndClaim(
    'simulator-owned-ira-contribution-deadline-upstream',
    [scopeEvidenceId, taxYear, deadlineDate],
    'IRA contribution-deadline upstream evidence ID',
  )
  const deadlineWithoutId = {
    predicate: 'simulatorOwnedNonRothIraOrdinaryDeadlineObservation' as const,
    planId,
    ownerPersonId,
    designatedTaxYear: taxYear,
    ledgerRunId,
    evidenceScope:
      'projectionModelOnlyNotAuthoritativeFilingEvidence' as const,
    deadlineStatus: 'modeledOrdinaryFederalDeadlineCalculated' as const,
    deadlineKind:
      'ordinaryFederalFilingDeadlineExcludingDisasterRelief' as const,
    calendarAdjustmentStatus:
      'weekendAndDistrictOfColumbiaHolidayAdjustmentApplied' as const,
    deadlineDate: deadlineDate!,
    upstreamEvidenceId: deadlineUpstreamEvidenceId,
  }
  const deadlineEvidenceId = deriveAndClaim(
    'simulator-owned-ira-contribution-deadline',
    [deadlineWithoutId],
    'IRA contribution-deadline evidence ID',
  )
  const deadlineObservation:
    SimulatorOwnedNonRothIraOrdinaryDeadlineObservation = {
    ...deadlineWithoutId,
    evidenceId: deadlineEvidenceId,
  }
  const windowUpstreamEvidenceId = deriveAndClaim(
    'simulator-owned-ira-post-year-contribution-window-upstream',
    [scopeEvidenceId, deadlineObservation],
    'Post-year contribution-window upstream evidence ID',
  )
  const windowWithoutId = {
    predicate:
      'simulatorOwnedNonRothIraProjectionPostYearContributionWindow' as const,
    planId,
    ownerPersonId,
    taxYear,
    ledgerRunId,
    evidenceScope:
      'projectionModelOnlyNotRealWorldFilingCompleteness' as const,
    inventoryStatus: 'explicitlyEmptyWithinProjectionModelOnly' as const,
    realWorldFilingCompleteness: 'notEstablished' as const,
    deadlineObservation,
    contributions: [] as const,
    upstreamEvidenceId: windowUpstreamEvidenceId,
  }
  const windowEvidenceId = deriveAndClaim(
    'simulator-owned-ira-post-year-contribution-window',
    [windowWithoutId],
    'Post-year contribution-window evidence ID',
  )
  const projectionPostYearContributionWindow:
    SimulatorOwnedNonRothIraProjectionPostYearContributionWindow = {
      ...windowWithoutId,
      evidenceId: windowEvidenceId,
    }

  if (derivedIssues.length > 0) return blocked(derivedIssues)
  const observationWithoutId = {
    predicate: 'completeSimulatorOwnedNonRothIraAnnualObservation' as const,
    planId,
    ownerPersonId,
    taxYear,
    ledgerRunId,
    observationBoundary,
    asOfDate,
    evidenceScope,
    yearEndApplicableBalances,
    aggregateYearEndApplicableBalanceAmount:
      asUsdCents(Number(aggregateBalance)),
    startOfTaxYearBasisObservation,
    projectionPostYearContributionWindow,
  }
  const observationEvidenceId = deriveAndClaim(
    'simulator-owned-ira-annual-observation',
    [observationWithoutId],
    'Complete annual-observation evidence ID',
  )
  if (derivedIssues.length > 0) return blocked(derivedIssues)
  return deepFreeze({
    status: 'annualObservationBuilt',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    observation: {
      ...observationWithoutId,
      evidenceId: observationEvidenceId,
    },
    issues: [],
  })
}

export function buildSimulatorOwnedNonRothIraAnnualObservation(
  input: Readonly<BuildSimulatorOwnedNonRothIraAnnualObservationInput>,
): Readonly<BuildSimulatorOwnedNonRothIraAnnualObservationResult> {
  try {
    return buildSimulatorOwnedNonRothIraAnnualObservationUnchecked(input)
  } catch (error) {
    return blocked([{
      kind: 'observationConstructionInvalid',
      detail: `Annual observation construction failed closed: ${safeErrorDetail(error)}`,
    }])
  }
}
