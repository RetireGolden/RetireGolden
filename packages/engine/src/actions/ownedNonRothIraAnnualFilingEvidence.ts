import { z } from 'zod'

import { planSchema, type Plan } from '../model/plan.js'
import { formatCivilDate, parseCivilIsoDate } from './civilDate.js'
import {
  accountIdSchema,
  personIdSchema,
  planIdSchema,
  type AccountId,
  type PersonId,
  type PlanId,
} from './identity.js'
import {
  positiveUsdCentsSchema,
  usdCentsSchema,
  type PositiveUsdCents,
} from './money.js'
import type {
  CompletePlanOwnedNonRothIraAnnualBasisRecord,
  CompletePlanOwnedNonRothIraPostYearContributionWindow,
  PlanOwnedNonRothIraContributionDeadlineEvidence,
  PlanOwnedNonRothIraPostYearNondeductibleContribution,
} from './ownedNonRothIraAnnualPostCandidateEvidence.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'

const nonblankIdSchema = z.string().refine(
  (value) => value.trim().length > 0,
  { message: 'identifier must not be blank' },
)

const exactZeroSchema = z.literal(0).refine(
  (value) => !Object.is(value, -0),
  { message: 'expected canonical literal zero' },
)

const filingSourceAuthoritySchema = z.object({
  acquisition: z.enum(['manual', 'import']),
  recordKind: z.enum([
    'filedForm8606',
    'taxProfessionalWorkpaper',
    'completeAccountRecordReconstruction',
  ]),
  sourceId: nonblankIdSchema,
  finalizedDate: z.string(),
}).strict()

const filingDeadlineAuthoritySchema = z.object({
  authoritySourceId: nonblankIdSchema,
  designatedTaxYear: z.number().int().min(2006).max(9998),
  deadlineStatus: z.literal('authoritativeFederalDeadlineEstablished'),
  deadlineKind: z.literal(
    'ordinaryFederalFilingDeadlineExcludingDisasterRelief',
  ),
  calendarAdjustmentStatus: z.literal(
    'weekendAndDistrictOfColumbiaHolidayAdjustmentApplied',
  ),
  disasterReliefContributionStatus: z.literal(
    'noPostOrdinaryDeadlineContributionClaimed',
  ),
  deadlineDate: z.string(),
}).strict()

const postYearContributionSourceSchema = z.object({
  sourceRecordId: nonblankIdSchema,
  sourceEvidenceId: nonblankIdSchema,
  sourceAccountId: accountIdSchema,
  designatedTaxYear: z.number().int().min(2006).max(9998),
  contributionDate: z.string(),
  nondeductibleContributionAmount: positiveUsdCentsSchema,
}).strict()

export const planOwnedNonRothIraAnnualFilingSourceRecordSchema = z.object({
  predicate: z.literal('completePlanOwnedNonRothIraAnnualFilingSourceRecord'),
  planId: planIdSchema,
  ownerPersonId: personIdSchema,
  taxYear: z.number().int().min(2006).max(9998),
  evidenceScope: z.literal('realWorldTaxRecordNotProjection'),
  sourceRecordId: nonblankIdSchema,
  sourceEvidenceId: nonblankIdSchema,
  authority: filingSourceAuthoritySchema,
  reviewedSourceAccountIds: z.array(accountIdSchema),
  openingBasis: z.object({
    asOfDate: z.string(),
    openingBasisAmount: usdCentsSchema,
    sourceEvidenceId: nonblankIdSchema,
  }).strict(),
  rolloverFacts: z.object({
    inventoryStatus: z.literal('completeIncludingExplicitEmpty'),
    outstandingRolloverAmount: exactZeroSchema,
    rolloverRepaymentAdjustmentAmount: exactZeroSchema,
    sourceEvidenceId: nonblankIdSchema,
  }).strict(),
  nondeductibleContributionFacts: z.object({
    inYearInventoryStatus: z.literal('completeExplicitEmpty'),
    inYearContributions: z.tuple([]),
    postYearWindowStatus: z.literal('completeThroughOrdinaryDeadline'),
    completedThroughDate: z.string(),
    deadlineAuthority: filingDeadlineAuthoritySchema,
    contributions: z.array(postYearContributionSourceSchema),
  }).strict(),
}).strict()

export type PlanOwnedNonRothIraAnnualFilingSourceRecord = z.infer<
  typeof planOwnedNonRothIraAnnualFilingSourceRecordSchema
>

export interface BuildPlanOwnedNonRothIraAnnualFilingEvidenceInput {
  plan: unknown
  ownerPersonId: string
  taxYear: number
  ledgerRunId: string
  /** External knowledge boundary; never read from the wall clock. */
  knowledgeAsOfDate: string
  sourceRecord: unknown
}

export type PlanOwnedNonRothIraAnnualFilingEvidenceIssueKind =
  | 'inputInvalid'
  | 'planInvalid'
  | 'ownerInvalid'
  | 'ownerNotFound'
  | 'taxYearInvalid'
  | 'ledgerRunInvalid'
  | 'knowledgeDateInvalid'
  | 'projectionEvidenceRejected'
  | 'sourceRecordInvalid'
  | 'sourceBindingMismatch'
  | 'sourceNotFinal'
  | 'ownedIraPoolEmpty'
  | 'reviewedPoolMismatch'
  | 'annualBasisIncomplete'
  | 'rolloverFactsIncomplete'
  | 'contributionInventoryIncomplete'
  | 'deadlineAuthorityInvalid'
  | 'postYearContributionInvalid'
  | 'amountOverflow'
  | 'identifierCollision'
  | 'identifierDerivationFailed'

export interface PlanOwnedNonRothIraAnnualFilingEvidenceIssue {
  kind: PlanOwnedNonRothIraAnnualFilingEvidenceIssueKind
  detail: string
  sourceAccountId?: string
  identifier?: string
}

interface FilingEvidenceResultBase {
  movement: 'notCommitted'
  actionability: 'notEstablished'
}

export interface PlanOwnedNonRothIraAnnualFilingEvidenceBlockedResult
  extends FilingEvidenceResultBase {
  status: 'annualFilingEvidenceBlocked'
  annualBasisRecord: null
  postYearContributionWindow: null
  issues: readonly [
    Readonly<PlanOwnedNonRothIraAnnualFilingEvidenceIssue>,
    ...Readonly<PlanOwnedNonRothIraAnnualFilingEvidenceIssue>[],
  ]
}

export interface PlanOwnedNonRothIraAnnualFilingEvidenceBuiltResult
  extends FilingEvidenceResultBase {
  status: 'annualFilingEvidenceBuilt'
  annualBasisRecord:
    Readonly<CompletePlanOwnedNonRothIraAnnualBasisRecord>
  postYearContributionWindow:
    Readonly<CompletePlanOwnedNonRothIraPostYearContributionWindow>
  issues: readonly []
}

export type BuildPlanOwnedNonRothIraAnnualFilingEvidenceResult =
  | PlanOwnedNonRothIraAnnualFilingEvidenceBlockedResult
  | PlanOwnedNonRothIraAnnualFilingEvidenceBuiltResult

interface IdentifierClaim {
  role: string
  binding: string
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
  kind: PlanOwnedNonRothIraAnnualFilingEvidenceIssueKind,
  detail: string,
  bindings: Pick<
    PlanOwnedNonRothIraAnnualFilingEvidenceIssue,
    'sourceAccountId' | 'identifier'
  > = {},
): PlanOwnedNonRothIraAnnualFilingEvidenceIssue {
  return { kind, detail, ...bindings }
}

function blocked(
  issues: readonly PlanOwnedNonRothIraAnnualFilingEvidenceIssue[],
): Readonly<PlanOwnedNonRothIraAnnualFilingEvidenceBlockedResult> {
  const nonempty = issues.length > 0
    ? issues
    : [issue('inputInvalid', 'Annual filing evidence could not be constructed')]
  return deepFreeze({
    status: 'annualFilingEvidenceBlocked',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    annualBasisRecord: null,
    postYearContributionWindow: null,
    issues: nonempty as [
      PlanOwnedNonRothIraAnnualFilingEvidenceIssue,
      ...PlanOwnedNonRothIraAnnualFilingEvidenceIssue[],
    ],
  })
}

function canonicalDate(value: string): string | null {
  const parsed = parseCivilIsoDate(value)
  return parsed !== null && formatCivilDate(parsed) === value ? value : null
}

function dayOfWeek(year: number, month: number, day: number): number {
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
  const adjustedYear = month < 3 ? year - 1 : year
  return (
    adjustedYear +
    Math.floor(adjustedYear / 4) -
    Math.floor(adjustedYear / 100) +
    Math.floor(adjustedYear / 400) +
    offsets[month - 1]! +
    day
  ) % 7
}

function ordinaryFederalFilingDeadline(taxYear: number): string | null {
  // The District of Columbia holiday began affecting the nationwide federal
  // deadline in filing season 2007. Older years need historical calendars.
  if (!Number.isInteger(taxYear) || taxYear < 2006 || taxYear >= 9999) {
    return null
  }
  const deadlineYear = taxYear + 1
  const april16Weekday = dayOfWeek(deadlineYear, 4, 16)
  const observedEmancipationDay = april16Weekday === 6
    ? 15
    : april16Weekday === 0
      ? 17
      : 16
  let day = 15
  while (
    dayOfWeek(deadlineYear, 4, day) === 0 ||
    dayOfWeek(deadlineYear, 4, day) === 6 ||
    day === observedEmancipationDay
  ) day++
  return `${String(deadlineYear).padStart(4, '0')}-04-${String(day).padStart(2, '0')}`
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every(
    (value, index) => value === right[index],
  )
}

function projectionEvidenceSupplied(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(projectionEvidenceSupplied)
  }
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const predicate = typeof record['predicate'] === 'string'
    ? record['predicate'].toLowerCase()
    : ''
  const scope = typeof record['evidenceScope'] === 'string'
    ? record['evidenceScope'].toLowerCase()
    : ''
  if (predicate.includes('simulator') || predicate.startsWith('projection') ||
      scope.startsWith('projection')) return true
  return Object.values(record).some(projectionEvidenceSupplied)
}

function ownedIraPool(
  plan: Plan,
  ownerPersonId: PersonId,
): AccountId[] {
  return plan.accounts
    .filter((account) =>
      account.type === 'traditional' &&
      account.kind === 'ira' &&
      account.inherited === undefined &&
      account.ownerPersonId === ownerPersonId)
    .map((account) => accountIdSchema.parse(account.id))
    .sort(compareUtf16CodeUnits)
}

function claimIdentifier(
  claimed: Map<string, IdentifierClaim>,
  value: string,
  role: string,
  binding: unknown,
  issues: PlanOwnedNonRothIraAnnualFilingEvidenceIssue[],
  allowSameRoleDifferentBinding = false,
): void {
  const serializedBinding = JSON.stringify(binding)
  const existing = claimed.get(value)
  if (existing === undefined) {
    claimed.set(value, { role, binding: serializedBinding })
    return
  }
  if (existing.role === role &&
      (existing.binding === serializedBinding || allowSameRoleDifferentBinding)) {
    return
  }
  issues.push(issue(
    'identifierCollision',
    `${role} collides with ${existing.role}`,
    { identifier: value },
  ))
}

function claimPlanIdentifiers(
  plan: Plan,
  planId: PlanId,
  issues: PlanOwnedNonRothIraAnnualFilingEvidenceIssue[],
): Map<string, IdentifierClaim> {
  const claimed = new Map<string, IdentifierClaim>()
  claimIdentifier(claimed, planId, 'planId', [planId], issues)
  for (const person of plan.household.people) {
    claimIdentifier(claimed, person.id, 'personId', [planId, person], issues)
  }
  for (const account of plan.accounts) {
    claimIdentifier(claimed, account.id, 'accountId', [planId, account], issues)
  }
  for (const policy of plan.insurance) {
    claimIdentifier(claimed, policy.id, 'insurancePolicyId', [planId, policy], issues)
  }
  for (const careEvent of plan.careEvents) {
    claimIdentifier(claimed, careEvent.id, 'careEventId', [planId, careEvent], issues)
  }
  for (const ladder of plan.incomeFloor?.ladders ?? []) {
    claimIdentifier(claimed, ladder.id, 'tipsLadderId', [planId, ladder], issues)
  }
  for (const income of plan.incomes) {
    claimIdentifier(claimed, income.id, 'incomeStreamId', [planId, income], issues)
    if (income.type !== 'socialSecurity') continue
    for (const formerSpouse of income.formerSpouses ?? []) {
      claimIdentifier(
        claimed,
        formerSpouse.id,
        'formerSpouseId',
        [planId, income.id, formerSpouse],
        issues,
      )
    }
  }
  for (const goal of plan.expenses.oneTimeGoals) {
    claimIdentifier(claimed, goal.id, 'oneTimeGoalId', [planId, goal], issues)
  }
  for (const action of plan.strategies.retirementActions) {
    claimIdentifier(claimed, action.actionId, 'actionId', [planId, action], issues)
    if (action.kind === 'qcd') {
      claimIdentifier(
        claimed,
        action.charity.designationId,
        'qcdCharityDesignationId',
        [planId, action.actionId, action.charity],
        issues,
      )
    }
    const withAllocations = action as unknown as {
      allocations?: readonly { allocationId: string }[]
      allocation?: { allocationId: string }
    }
    const allocations = withAllocations.allocations ??
      (withAllocations.allocation === undefined
        ? []
        : [withAllocations.allocation])
    for (const allocation of allocations) {
      claimIdentifier(
        claimed,
        allocation.allocationId,
        'allocationId',
        [action.actionId, allocation],
        issues,
        true,
      )
    }
  }
  const eligibility = plan.retirementActionEligibilityFacts
  for (const record of eligibility?.iraClassifications ?? []) {
    claimIdentifier(
      claimed,
      record.evidenceId,
      'iraClassificationEvidenceId',
      [record],
      issues,
    )
  }
  for (const record of eligibility?.sepSimpleActivities ?? []) {
    claimIdentifier(
      claimed,
      record.evidenceId,
      'sepSimpleActivityEvidenceId',
      [record],
      issues,
    )
  }
  for (const record of eligibility?.deductibleIraContributions ?? []) {
    claimIdentifier(
      claimed,
      record.evidenceId,
      'deductibleIraContributionEvidenceId',
      [record],
      issues,
    )
  }
  for (const scenario of plan.scenarios) {
    claimIdentifier(claimed, scenario.id, 'scenarioId', [planId, scenario], issues)
  }
  return claimed
}

function safeError(error: unknown): string {
  try {
    if (error instanceof Error) {
      try {
        if (typeof error.message === 'string') return error.message
      } catch {
        // Fall through to the guarded string conversion.
      }
    }
    try {
      return String(error)
    } catch {
      return 'unreadable caller-controlled error'
    }
  } catch {
    return 'unreadable caller-controlled error'
  }
}

function buildUnchecked(
  input: Readonly<BuildPlanOwnedNonRothIraAnnualFilingEvidenceInput>,
): Readonly<BuildPlanOwnedNonRothIraAnnualFilingEvidenceResult> {
  // Snapshot every caller-controlled root exactly once before validation.
  const rawPlan = input.plan
  const rawOwnerPersonId = input.ownerPersonId
  const rawTaxYear = input.taxYear
  const rawLedgerRunId = input.ledgerRunId
  const rawKnowledgeAsOfDate = input.knowledgeAsOfDate
  const rawSourceRecord = input.sourceRecord

  let planSnapshot: unknown
  let sourceSnapshot: unknown
  try {
    planSnapshot = structuredClone(rawPlan)
    sourceSnapshot = structuredClone(rawSourceRecord)
  } catch (error) {
    return blocked([issue(
      'inputInvalid',
      `Annual filing evidence inputs must be detached data: ${safeError(error)}`,
    )])
  }

  const parsedPlan = planSchema.safeParse(planSnapshot)
  if (!parsedPlan.success) {
    return blocked([issue('planInvalid', 'Annual filing evidence requires a valid Plan')])
  }
  const parsedOwner = personIdSchema.safeParse(rawOwnerPersonId)
  if (!parsedOwner.success) {
    return blocked([issue('ownerInvalid', 'Owner person ID must be nonblank')])
  }
  if (!Number.isInteger(rawTaxYear) || rawTaxYear < 2006 ||
      rawTaxYear > 9998) {
    return blocked([issue(
      'taxYearInvalid',
      'Tax year must be an integer from 2006 through 9998',
    )])
  }
  if (typeof rawLedgerRunId !== 'string' || rawLedgerRunId.trim().length === 0) {
    return blocked([issue('ledgerRunInvalid', 'Ledger-run ID must be nonblank')])
  }
  if (typeof rawKnowledgeAsOfDate !== 'string' ||
      canonicalDate(rawKnowledgeAsOfDate) === null) {
    return blocked([issue(
      'knowledgeDateInvalid',
      'Knowledge-as-of date must be a real canonical civil date',
    )])
  }
  if (projectionEvidenceSupplied(sourceSnapshot)) {
    return blocked([issue(
      'projectionEvidenceRejected',
      'Projection observations cannot establish real-world annual filing completeness',
    )])
  }
  const parsedSource =
    planOwnedNonRothIraAnnualFilingSourceRecordSchema.safeParse(sourceSnapshot)
  if (!parsedSource.success) {
    return blocked(parsedSource.error.issues.map((sourceIssue) => issue(
      'sourceRecordInvalid',
      `${sourceIssue.path.join('.') || '(root)'}: ${sourceIssue.message}`,
    )))
  }

  const plan = parsedPlan.data
  const ownerPersonId = parsedOwner.data
  const taxYear = rawTaxYear
  const ledgerRunId = rawLedgerRunId
  const knowledgeAsOfDate = rawKnowledgeAsOfDate
  const source = parsedSource.data
  const bindingIssues: PlanOwnedNonRothIraAnnualFilingEvidenceIssue[] = []
  let planId: PlanId
  try {
    planId = planIdSchema.parse(plan.id)
  } catch {
    return blocked([issue('planInvalid', 'Plan must have a valid stable ID')])
  }
  const matchingPeople = plan.household.people.filter(
    (person) => person.id === ownerPersonId,
  )
  if (matchingPeople.length !== 1) {
    bindingIssues.push(issue(
      'ownerNotFound',
      'Annual filing evidence owner must resolve uniquely in the Plan',
    ))
  }
  if (source.planId !== planId || source.ownerPersonId !== ownerPersonId ||
      source.taxYear !== taxYear) {
    bindingIssues.push(issue(
      'sourceBindingMismatch',
      'Source record must bind the requested Plan, owner, and tax year',
    ))
  }
  const expectedPool = ownedIraPool(plan, ownerPersonId)
  if (expectedPool.length === 0) {
    bindingIssues.push(issue(
      'ownedIraPoolEmpty',
      'Owner must have at least one owned, non-inherited traditional IRA',
    ))
  }
  const reviewedPool = [...source.reviewedSourceAccountIds]
    .sort(compareUtf16CodeUnits)
  if (reviewedPool.length !== new Set(reviewedPool).size ||
      !sameStrings(reviewedPool, expectedPool)) {
    bindingIssues.push(issue(
      'reviewedPoolMismatch',
      'Source record must review the exact current owner-wide IRA pool',
    ))
  }
  if (bindingIssues.length > 0) return blocked(bindingIssues)

  const expectedOpeningDate = `${String(taxYear).padStart(4, '0')}-01-01`
  if (canonicalDate(source.openingBasis.asOfDate) === null ||
      source.openingBasis.asOfDate !== expectedOpeningDate) {
    return blocked([issue(
      'annualBasisIncomplete',
      'Opening basis must be evidenced as of January 1 of the tax year',
    )])
  }
  if (source.rolloverFacts.inventoryStatus !==
      'completeIncludingExplicitEmpty' ||
      source.rolloverFacts.outstandingRolloverAmount !== 0 ||
      source.rolloverFacts.rolloverRepaymentAdjustmentAmount !== 0) {
    return blocked([issue(
      'rolloverFactsIncomplete',
      'Standalone filing evidence requires a complete literal-zero rollover inventory',
    )])
  }
  if (source.nondeductibleContributionFacts.inYearInventoryStatus !==
      'completeExplicitEmpty' ||
      source.nondeductibleContributionFacts.inYearContributions.length !== 0) {
    return blocked([issue(
      'contributionInventoryIncomplete',
      'Standalone filing evidence supports only an explicitly empty in-year nondeductible contribution inventory',
    )])
  }

  const deadline = source.nondeductibleContributionFacts.deadlineAuthority
  const deadlineDate = deadline.deadlineDate
  const expectedDeadline = ordinaryFederalFilingDeadline(taxYear)
  if (deadline.designatedTaxYear !== taxYear ||
      canonicalDate(deadlineDate) === null ||
      expectedDeadline === null || deadlineDate !== expectedDeadline) {
    return blocked([issue(
      'deadlineAuthorityInvalid',
      'Authoritative ordinary contribution deadline must exact-match the supported federal calendar',
    )])
  }
  const contributionFacts = source.nondeductibleContributionFacts
  if (contributionFacts.postYearWindowStatus !==
      'completeThroughOrdinaryDeadline' ||
      contributionFacts.completedThroughDate !== deadlineDate ||
      canonicalDate(contributionFacts.completedThroughDate) === null) {
    return blocked([issue(
      'contributionInventoryIncomplete',
      'Post-year contribution inventory must be complete through the authoritative ordinary deadline',
    )])
  }
  if (canonicalDate(source.authority.finalizedDate) === null) {
    return blocked([issue(
      'sourceRecordInvalid',
      'Real-world source authority finalized date must be a real canonical civil date',
    )])
  }
  if (source.authority.finalizedDate < deadlineDate ||
      source.authority.finalizedDate > knowledgeAsOfDate ||
      contributionFacts.completedThroughDate > knowledgeAsOfDate) {
    return blocked([issue(
      'sourceNotFinal',
      'Real-world source record must be finalized after the complete window and on or before the knowledge date',
    )])
  }

  const contributions = [...contributionFacts.contributions].sort(
    (left, right) =>
      compareUtf16CodeUnits(left.contributionDate, right.contributionDate) ||
      compareUtf16CodeUnits(left.sourceRecordId, right.sourceRecordId),
  )
  const contributionIds = new Set<string>()
  const normalizedContributions: typeof contributions = []
  let contributionTotal = 0n
  const expectedYearEnd = `${String(taxYear).padStart(4, '0')}-12-31`
  const poolSet = new Set(expectedPool)
  const contributionIssues: PlanOwnedNonRothIraAnnualFilingEvidenceIssue[] = []
  for (const contribution of contributions) {
    if (contributionIds.has(contribution.sourceRecordId)) {
      contributionIssues.push(issue(
        'postYearContributionInvalid',
        'Post-year contribution source-record IDs must be unique',
        { identifier: contribution.sourceRecordId },
      ))
      continue
    }
    contributionIds.add(contribution.sourceRecordId)
    if (contribution.designatedTaxYear !== taxYear ||
        !poolSet.has(contribution.sourceAccountId) ||
        canonicalDate(contribution.contributionDate) === null ||
        contribution.contributionDate <= expectedYearEnd ||
        contribution.contributionDate > deadlineDate) {
      contributionIssues.push(issue(
        'postYearContributionInvalid',
        'Every contribution must designate the tax year, belong to the reviewed pool, and occur after December 31 through the deadline',
        { sourceAccountId: contribution.sourceAccountId },
      ))
      continue
    }
    contributionTotal += BigInt(contribution.nondeductibleContributionAmount)
    normalizedContributions.push(contribution)
  }
  if (contributionIssues.length > 0) return blocked(contributionIssues)
  if (contributionTotal > BigInt(Number.MAX_SAFE_INTEGER)) {
    return blocked([issue(
      'amountOverflow',
      'Post-year nondeductible contribution total exceeds exact safe-integer cents',
    )])
  }

  const idIssues: PlanOwnedNonRothIraAnnualFilingEvidenceIssue[] = []
  const claimed = claimPlanIdentifiers(plan, planId, idIssues)
  claimIdentifier(
    claimed,
    ledgerRunId,
    'annualLedgerRunId',
    [planId, taxYear, ledgerRunId],
    idIssues,
  )
  const sourceIdentifiers: readonly [string, string, unknown][] = [
    [source.sourceRecordId, 'filingSourceRecordId', [source]],
    [source.sourceEvidenceId, 'filingSourceEvidenceId', [source]],
    [source.authority.sourceId, 'filingAuthoritySourceId', [source.authority]],
    [source.openingBasis.sourceEvidenceId, 'openingBasisSourceEvidenceId', [source.openingBasis]],
    [source.rolloverFacts.sourceEvidenceId, 'rolloverSourceEvidenceId', [source.rolloverFacts]],
    [deadline.authoritySourceId, 'deadlineAuthoritySourceId', [deadline]],
  ]
  for (const [identifier, role, binding] of sourceIdentifiers) {
    claimIdentifier(claimed, identifier, role, binding, idIssues)
  }
  for (const contribution of normalizedContributions) {
    claimIdentifier(
      claimed,
      contribution.sourceRecordId,
      'postYearContributionSourceRecordId',
      [contribution],
      idIssues,
    )
    claimIdentifier(
      claimed,
      contribution.sourceEvidenceId,
      'postYearContributionSourceEvidenceId',
      [contribution],
      idIssues,
    )
  }
  if (idIssues.length > 0) return blocked(idIssues)

  const canonicalSource = {
    ...source,
    reviewedSourceAccountIds: reviewedPool,
    nondeductibleContributionFacts: {
      ...source.nondeductibleContributionFacts,
      contributions: normalizedContributions,
    },
  }
  const deriveAndClaim = (
    namespace: string,
    parts: readonly unknown[],
    label: string,
  ): string | null => {
    let identifier: string
    try {
      identifier = deriveActionStructuralId(namespace, parts)
    } catch (error) {
      idIssues.push(issue(
        'identifierDerivationFailed',
        `${label} could not be derived: ${safeError(error)}`,
      ))
      return null
    }
    if (identifier.trim().length === 0) {
      idIssues.push(issue(
        'identifierDerivationFailed',
        `${label} derived a blank identifier`,
      ))
      return null
    }
    claimIdentifier(claimed, identifier, namespace, parts, idIssues)
    return identifier
  }

  const sourceBindingId = deriveAndClaim(
    'owned-ira-annual-filing-source-binding',
    [planId, ownerPersonId, taxYear, canonicalSource],
    'Annual filing source binding',
  )
  if (sourceBindingId === null || idIssues.length > 0) return blocked(idIssues)

  const basisUpstreamEvidenceId = deriveAndClaim(
    'owned-ira-annual-filing-basis-upstream',
    [sourceBindingId, source.openingBasis, source.rolloverFacts],
    'Annual basis upstream evidence ID',
  )
  if (basisUpstreamEvidenceId === null) return blocked(idIssues)
  const basisWithoutId = {
    predicate: 'completePlanOwnedNonRothIraAnnualBasisRecord' as const,
    planId,
    ownerPersonId,
    taxYear,
    ledgerRunId,
    recordStatus:
      'openingBasisAndExplicitZeroRolloverFactsComplete' as const,
    openingBasisAmount: source.openingBasis.openingBasisAmount,
    outstandingRolloverAmount: 0 as const,
    rolloverRepaymentAdjustmentAmount: 0 as const,
    upstreamEvidenceId: basisUpstreamEvidenceId,
  }
  const basisEvidenceId = deriveAndClaim(
    'owned-ira-annual-filing-basis',
    [basisWithoutId],
    'Annual basis evidence ID',
  )
  if (basisEvidenceId === null) return blocked(idIssues)
  const annualBasisRecord: CompletePlanOwnedNonRothIraAnnualBasisRecord = {
    ...basisWithoutId,
    evidenceId: basisEvidenceId,
  }

  const deadlineUpstreamEvidenceId = deriveAndClaim(
    'owned-ira-annual-filing-deadline-upstream',
    [sourceBindingId, deadline],
    'Contribution deadline upstream evidence ID',
  )
  if (deadlineUpstreamEvidenceId === null) return blocked(idIssues)
  const deadlineWithoutId = {
    predicate: 'federalIraContributionDeadlineForTaxYear' as const,
    designatedTaxYear: taxYear,
    deadlineStatus: 'authoritativeFederalDeadlineEstablished' as const,
    deadlineKind:
      'ordinaryFederalFilingDeadlineExcludingDisasterRelief' as const,
    calendarAdjustmentStatus:
      'weekendAndDistrictOfColumbiaHolidayAdjustmentApplied' as const,
    deadlineDate,
    upstreamEvidenceId: deadlineUpstreamEvidenceId,
  }
  const deadlineEvidenceId = deriveAndClaim(
    'owned-ira-annual-filing-deadline',
    [deadlineWithoutId],
    'Contribution deadline evidence ID',
  )
  if (deadlineEvidenceId === null) return blocked(idIssues)
  const deadlineEvidence: PlanOwnedNonRothIraContributionDeadlineEvidence = {
    ...deadlineWithoutId,
    evidenceId: deadlineEvidenceId,
  }

  const outputContributions:
    PlanOwnedNonRothIraPostYearNondeductibleContribution[] = []
  for (const contribution of normalizedContributions) {
    const contributionId = deriveAndClaim(
      'owned-ira-annual-filing-contribution-id',
      [sourceBindingId, contribution],
      'Post-year contribution ID',
    )
    if (contributionId === null) continue
    const upstreamEvidenceId = deriveAndClaim(
      'owned-ira-annual-filing-contribution-upstream',
      [sourceBindingId, contribution, contributionId],
      'Post-year contribution upstream evidence ID',
    )
    if (upstreamEvidenceId === null) continue
    const withoutId = {
      contributionId,
      planId,
      ownerPersonId,
      sourceAccountId: contribution.sourceAccountId,
      designatedTaxYear: taxYear,
      contributionDate: contribution.contributionDate,
      nondeductibleContributionAmount:
        contribution.nondeductibleContributionAmount as PositiveUsdCents,
      upstreamEvidenceId,
    }
    const evidenceId = deriveAndClaim(
      'owned-ira-annual-filing-contribution',
      [withoutId],
      'Post-year contribution evidence ID',
    )
    if (evidenceId === null) continue
    outputContributions.push({ ...withoutId, evidenceId })
  }
  if (idIssues.length > 0) return blocked(idIssues)

  const windowUpstreamEvidenceId = deriveAndClaim(
    'owned-ira-annual-filing-contribution-window-upstream',
    [sourceBindingId, deadlineEvidence, outputContributions],
    'Post-year contribution-window upstream evidence ID',
  )
  if (windowUpstreamEvidenceId === null) return blocked(idIssues)
  const windowWithoutId = {
    predicate:
      'completePlanOwnedNonRothIraPostYearNondeductibleContributionWindow' as const,
    planId,
    ownerPersonId,
    taxYear,
    ledgerRunId,
    inventoryStatus: 'completeIncludingExplicitEmpty' as const,
    deadlineEvidence,
    contributions: outputContributions,
    upstreamEvidenceId: windowUpstreamEvidenceId,
  }
  const windowEvidenceId = deriveAndClaim(
    'owned-ira-annual-filing-contribution-window',
    [windowWithoutId],
    'Post-year contribution-window evidence ID',
  )
  if (windowEvidenceId === null || idIssues.length > 0) {
    return blocked(idIssues)
  }
  const postYearContributionWindow:
    CompletePlanOwnedNonRothIraPostYearContributionWindow = {
      ...windowWithoutId,
      evidenceId: windowEvidenceId,
    }

  return deepFreeze({
    status: 'annualFilingEvidenceBuilt',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    annualBasisRecord,
    postYearContributionWindow,
    issues: [],
  })
}

/**
 * Builds the two PR105 filing-fact inputs from one complete real-world source.
 * Projection observations and partial owner/year records are never promoted.
 */
export function buildPlanOwnedNonRothIraAnnualFilingEvidence(
  input: Readonly<BuildPlanOwnedNonRothIraAnnualFilingEvidenceInput>,
): Readonly<BuildPlanOwnedNonRothIraAnnualFilingEvidenceResult> {
  try {
    return buildUnchecked(input)
  } catch (error) {
    return blocked([issue(
      'inputInvalid',
      `Annual filing evidence failed closed: ${safeError(error)}`,
    )])
  }
}
