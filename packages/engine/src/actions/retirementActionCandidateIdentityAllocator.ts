import type {
  ActionProvenance,
  ConversionTaxFunding,
  OrdinaryWithdrawalRequest,
  RothConversionRequest,
  WithdrawalPurpose,
} from './contract.js'
import {
  retirementActionRequestSchema,
} from './contract.js'
import {
  accountIdSchema,
  actionIdSchema,
  allocationIdSchema,
  personIdSchema,
  planIdSchema,
  type AccountId,
  type PersonId,
  type PlanId,
} from './identity.js'
import {
  positiveUsdCentsSchema,
  type PositiveUsdCents,
} from './money.js'
import {
  createActionReason,
  type ActionReason,
  type BlockingActionReasonCode,
} from './reasons.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'
import {
  retirementActionPlanReservedIdentifiers,
  type Account,
  type Plan,
} from '../model/plan.js'
import {
  planOwnedNonRothIraAnnualFilingSourceIdentifierClaims,
} from '../model/retirementActionAnnualTaxFacts.js'

export interface RetirementActionCandidateSourceIntent {
  /** Existing stable Plan account identity; categories and display names are not accepted. */
  sourceAccountId: AccountId
  /** Positive exact USD cents assigned explicitly to this source. */
  requestedAmount: PositiveUsdCents
}

interface RetirementActionCandidateIdentityIntentBase {
  year: number
  executionDate?: string
  executionSequence: number
  requestedAmount: PositiveUsdCents
  personId: PersonId
  provenance: ActionProvenance
  sourceAllocations: readonly RetirementActionCandidateSourceIntent[]
}

export interface OrdinaryWithdrawalCandidateIdentityIntent
  extends RetirementActionCandidateIdentityIntentBase {
  kind: 'ordinaryWithdrawal'
  purpose: WithdrawalPurpose
}

export interface RothConversionCandidateIdentityIntent
  extends RetirementActionCandidateIdentityIntentBase {
  kind: 'rothConversion'
  destinationRothAccountId: AccountId
  taxFunding: ConversionTaxFunding
}

/**
 * Identity-bearing candidate input accepted by this narrow allocator.
 *
 * QCD, legacy aggregate strategies, account categories, withdrawal-order
 * labels, and aggregate conversion schedules deliberately have no arm here.
 */
export type RetirementActionCandidateIdentityIntent =
  | OrdinaryWithdrawalCandidateIdentityIntent
  | RothConversionCandidateIdentityIntent

export type RetirementActionCandidateIdentityIssueKind =
  | 'invalidIntent'
  | 'missingIdentity'
  | 'ambiguousIdentity'
  | 'duplicateIdentity'
  | 'ineligibleIdentity'
  | 'amountMismatch'
  | 'generatedIdentityCollision'

export interface RetirementActionCandidateIdentityIssue {
  kind: RetirementActionCandidateIdentityIssueKind
  field: string
  /** Existing stable action-reason semantics when one honestly applies. */
  reason: ActionReason<BlockingActionReasonCode> | null
  detail: string
}

export interface RetirementActionCandidateIdentityEvidence {
  policy: 'explicitStablePlanIdsOnly'
  planId: PlanId
  personId: PersonId
  sourceAccountIds: readonly AccountId[]
  destinationRothAccountId: AccountId | null
  sourceCanonicalOrder: 'utf16AccountId'
  generatedAllocationOrder: 'utf16AllocationId'
}

export type AllocatedRetirementActionCandidateIdentity = Readonly<{
  status: 'allocated'
  request: OrdinaryWithdrawalRequest | RothConversionRequest
  evidence: RetirementActionCandidateIdentityEvidence
}>

export type BlockedRetirementActionCandidateIdentity = Readonly<{
  status: 'blocked'
  request: null
  issues: readonly [
    RetirementActionCandidateIdentityIssue,
    ...RetirementActionCandidateIdentityIssue[],
  ]
}>

export type RetirementActionCandidateIdentityAllocationResult =
  | AllocatedRetirementActionCandidateIdentity
  | BlockedRetirementActionCandidateIdentity

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

function issue(
  kind: RetirementActionCandidateIdentityIssueKind,
  field: string,
  detail: string,
  reasonCode: BlockingActionReasonCode | null,
  identifiers: Parameters<typeof createActionReason>[1] = {},
): RetirementActionCandidateIdentityIssue {
  return {
    kind,
    field,
    reason: reasonCode === null ? null : createActionReason(reasonCode, identifiers),
    detail,
  }
}

function blocked(
  issues: RetirementActionCandidateIdentityIssue[],
): BlockedRetirementActionCandidateIdentity {
  return {
    status: 'blocked',
    request: null,
    issues: issues as [
      RetirementActionCandidateIdentityIssue,
      ...RetirementActionCandidateIdentityIssue[],
    ],
  }
}

function stableNonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function exactPositiveCents(value: unknown): value is PositiveUsdCents {
  return positiveUsdCentsSchema.safeParse(value).success
}

function canonicalSourceIntents(value: unknown): UnknownRecord[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  return [...value]
    .map(record)
    .filter((item): item is UnknownRecord => item !== null)
    .sort((left, right) => {
      const leftId = typeof left['sourceAccountId'] === 'string'
        ? left['sourceAccountId']
        : ''
      const rightId = typeof right['sourceAccountId'] === 'string'
        ? right['sourceAccountId']
        : ''
      return compareUtf16CodeUnits(leftId, rightId)
    })
}

function matchingPeople(plan: Readonly<Plan>, personId: string): readonly Plan['household']['people'][number][] {
  return plan.household.people.filter((person) => person.id === personId)
}

function matchingAccounts(plan: Readonly<Plan>, accountId: string): readonly Account[] {
  return plan.accounts.filter((account) => account.id === accountId)
}

function completePlanReservedIdentifiers(plan: Readonly<Plan>): Set<string> {
  const reserved = new Set(retirementActionPlanReservedIdentifiers(plan))
  for (const record of (
    plan.retirementActionAnnualTaxFacts?.ownedNonRothIraAnnualFilingSourceRecords ?? []
  )) {
    for (const claim of planOwnedNonRothIraAnnualFilingSourceIdentifierClaims(record)) {
      reserved.add(claim.value)
    }
  }
  return reserved
}

function ordinarySourceIssue(
  account: Account,
  personId: PersonId,
  sourceAccountId: AccountId,
): RetirementActionCandidateIdentityIssue | null {
  if (account.ownerPersonId === null) {
    return issue(
      'ambiguousIdentity',
      'sourceAllocations.sourceAccountId',
      'The Plan records this source as joint but does not record the individual acting-owner identity.',
      'joint-source-acting-person-mismatch',
      { personId, accountId: sourceAccountId },
    )
  }
  if (account.ownerPersonId !== personId) {
    return issue(
      'ineligibleIdentity',
      'sourceAllocations.sourceAccountId',
      'The selected source is owned by a different person.',
      'source-owner-mismatch',
      { personId, accountId: sourceAccountId },
    )
  }
  if (!['cash', 'taxable', 'equityComp', 'traditional', 'roth', 'hsa'].includes(account.type)) {
    return issue(
      'ineligibleIdentity',
      'sourceAllocations.sourceAccountId',
      'The selected Plan account is not an ordinary-withdrawal source supported by the action contract.',
      'withdrawal-source-type-unsupported',
      { accountId: sourceAccountId },
    )
  }
  return null
}

function conversionSourceIssue(
  account: Account,
  personId: PersonId,
  sourceAccountId: AccountId,
): RetirementActionCandidateIdentityIssue | null {
  if (account.ownerPersonId === null) {
    return issue(
      'ambiguousIdentity',
      'sourceAllocations.sourceAccountId',
      'The Plan records this conversion source as joint and cannot prove one conversion owner.',
      'conversion-source-owner-mismatch',
      { personId, accountId: sourceAccountId },
    )
  }
  if (account.ownerPersonId !== personId) {
    return issue(
      'ineligibleIdentity',
      'sourceAllocations.sourceAccountId',
      'The selected conversion source is not individually owned by the conversion person.',
      'conversion-source-owner-mismatch',
      { personId, accountId: sourceAccountId },
    )
  }
  if (account.type !== 'traditional') {
    return issue(
      'ineligibleIdentity',
      'sourceAllocations.sourceAccountId',
      'The selected source is not a convertible traditional account.',
      'conversion-source-not-convertible',
      { accountId: sourceAccountId },
    )
  }
  if (account.inherited !== undefined) {
    return issue(
      'ineligibleIdentity',
      'sourceAllocations.sourceAccountId',
      'Inherited sources are outside the supported conversion contract.',
      'conversion-inherited-source',
      { accountId: sourceAccountId },
    )
  }
  return null
}

function conversionDestinationIssue(
  account: Account,
  personId: PersonId,
  destinationAccountId: AccountId,
): RetirementActionCandidateIdentityIssue | null {
  if (account.ownerPersonId === null) {
    return issue(
      'ambiguousIdentity',
      'destinationRothAccountId',
      'The Plan records this Roth destination as joint and cannot prove one conversion owner.',
      'conversion-destination-owner-mismatch',
      { personId, accountId: destinationAccountId },
    )
  }
  if (account.ownerPersonId !== personId) {
    return issue(
      'ineligibleIdentity',
      'destinationRothAccountId',
      'The selected Roth destination is not individually owned by the conversion person.',
      'conversion-destination-owner-mismatch',
      { personId, accountId: destinationAccountId },
    )
  }
  if (account.type !== 'roth') {
    return issue(
      'ineligibleIdentity',
      'destinationRothAccountId',
      'The selected destination is not a Roth account.',
      'conversion-destination-incompatible',
      { accountId: destinationAccountId },
    )
  }
  if (account.kind !== 'ira') {
    return issue(
      'ineligibleIdentity',
      'destinationRothAccountId',
      'An employer Roth destination requires same-plan evidence that this identity-only slice cannot infer.',
      'conversion-employer-destination-unsupported',
      { accountId: destinationAccountId },
    )
  }
  return null
}

/**
 * Materialize explicit stable Plan identities into an ordinary-withdrawal or
 * Roth-conversion request. This function never chooses identities from account
 * category, balance, display order, or household position. A successful result
 * proves identity allocation only; the eligibility service and WS4 readiness
 * gate remain authoritative for actionability.
 */
function allocateRetirementActionCandidateIdentityUnchecked(
  plan: Readonly<Plan>,
  intent: RetirementActionCandidateIdentityIntent,
): RetirementActionCandidateIdentityAllocationResult {
  const candidate = record(intent)
  if (candidate === null) {
    return blocked([issue(
      'invalidIntent',
      '$',
      'Candidate intent must be an identity-bearing object.',
      'required-facts-missing',
    )])
  }

  const issues: RetirementActionCandidateIdentityIssue[] = []
  const parsedPlanId = planIdSchema.safeParse(plan.id)
  if (!parsedPlanId.success) {
    issues.push(issue(
      'missingIdentity',
      'plan.id',
      'The Plan requires a nonblank stable ID before candidate identities can be allocated.',
      'required-facts-missing',
    ))
  }
  const kind = candidate['kind']
  if (kind !== 'ordinaryWithdrawal' && kind !== 'rothConversion') {
    return blocked([issue(
      'invalidIntent',
      'kind',
      'Only explicit ordinary-withdrawal and Roth-conversion candidates are supported; aggregate and QCD shapes are not allocated.',
      'required-facts-missing',
    )])
  }
  const allowedCandidateKeys = new Set([
    'kind',
    'year',
    'executionDate',
    'executionSequence',
    'requestedAmount',
    'personId',
    'provenance',
    'sourceAllocations',
    ...(kind === 'ordinaryWithdrawal'
      ? ['purpose']
      : ['destinationRothAccountId', 'taxFunding']),
  ])
  for (const key of Object.keys(candidate).sort(compareUtf16CodeUnits)) {
    if (!allowedCandidateKeys.has(key)) {
      issues.push(issue(
        'invalidIntent',
        key,
        `Unexpected candidate field "${key}" is not part of the explicit identity-allocation contract.`,
        'required-facts-missing',
      ))
    }
  }

  const rawPersonId = candidate['personId']
  let personId: PersonId | null = null
  if (!stableNonblank(rawPersonId)) {
    issues.push(issue(
      'missingIdentity',
      'personId',
      'An explicit stable Plan person ID is required.',
      'person-not-found',
    ))
  } else {
    const matches = matchingPeople(plan, rawPersonId)
    if (matches.length === 0) {
      issues.push(issue(
        'missingIdentity',
        'personId',
        'The selected person ID does not exist in the Plan.',
        'person-not-found',
      ))
    } else if (matches.length !== 1) {
      issues.push(issue(
        'ambiguousIdentity',
        'personId',
        'The selected person ID is duplicated in the Plan.',
        'person-not-found',
      ))
    } else {
      personId = personIdSchema.parse(rawPersonId)
    }
  }

  const requestedAmount = candidate['requestedAmount']
  if (!exactPositiveCents(requestedAmount)) {
    issues.push(issue(
      'amountMismatch',
      'requestedAmount',
      'The requested amount must be a positive safe-integer USD cent count.',
      'allocation-total-mismatch',
    ))
  }

  const rawSources = candidate['sourceAllocations']
  const sources = canonicalSourceIntents(rawSources)
  if (sources === null || !Array.isArray(rawSources) || sources.length !== rawSources.length) {
    issues.push(issue(
      'missingIdentity',
      'sourceAllocations',
      'At least one explicit source-account allocation is required.',
      'source-account-not-found',
    ))
  }

  const validSources: Array<{
    sourceAccountId: AccountId
    requestedAmount: PositiveUsdCents
  }> = []
  const seenSourceIds = new Set<string>()
  let allocationTotal = 0n
  let allocationAmountsValid = sources !== null
  for (const [index, source] of (sources ?? []).entries()) {
    for (const key of Object.keys(source).sort(compareUtf16CodeUnits)) {
      if (key !== 'sourceAccountId' && key !== 'requestedAmount') {
        issues.push(issue(
          'invalidIntent',
          `sourceAllocations.${index}.${key}`,
          `Unexpected source-allocation field "${key}" will not be overwritten or treated as identity evidence.`,
          'required-facts-missing',
        ))
      }
    }
    const rawSourceAmount = source['requestedAmount']
    const sourceAmountValid = exactPositiveCents(rawSourceAmount)
    if (!sourceAmountValid) {
      allocationAmountsValid = false
      issues.push(issue(
        'amountMismatch',
        `sourceAllocations.${index}.requestedAmount`,
        'Every source amount must be a positive safe-integer USD cent count.',
        'allocation-total-mismatch',
      ))
    } else {
      allocationTotal += BigInt(rawSourceAmount)
    }
    const rawSourceId = source['sourceAccountId']
    const field = `sourceAllocations.${index}.sourceAccountId`
    if (!stableNonblank(rawSourceId)) {
      issues.push(issue(
        'missingIdentity',
        field,
        'Every allocation requires an explicit stable Plan account ID.',
        'source-account-not-found',
      ))
      continue
    }
    if (seenSourceIds.has(rawSourceId)) {
      issues.push(issue(
        'duplicateIdentity',
        field,
        'A source account may appear at most once in one candidate.',
        'duplicate-source-account',
      ))
      continue
    }
    seenSourceIds.add(rawSourceId)
    const accountMatches = matchingAccounts(plan, rawSourceId)
    if (accountMatches.length === 0) {
      issues.push(issue(
        'missingIdentity',
        field,
        'The selected source account ID does not exist in the Plan.',
        'source-account-not-found',
      ))
      continue
    }
    if (accountMatches.length !== 1) {
      issues.push(issue(
        'ambiguousIdentity',
        field,
        'The selected source account ID is duplicated in the Plan.',
        'source-account-not-found',
      ))
      continue
    }
    const sourceAccountId = accountIdSchema.parse(rawSourceId)
    if (personId !== null) {
      const eligibilityIssue = kind === 'ordinaryWithdrawal'
        ? ordinarySourceIssue(accountMatches[0]!, personId, sourceAccountId)
        : conversionSourceIssue(accountMatches[0]!, personId, sourceAccountId)
      if (eligibilityIssue !== null) {
        issues.push({ ...eligibilityIssue, field })
        continue
      }
    }
    if (!sourceAmountValid) continue
    validSources.push({ sourceAccountId, requestedAmount: rawSourceAmount })
  }

  if (
    exactPositiveCents(requestedAmount) &&
    allocationAmountsValid &&
    allocationTotal !== BigInt(requestedAmount)
  ) {
    issues.push(issue(
      'amountMismatch',
      'sourceAllocations',
      'The exact source-allocation cent sum must equal the requested amount.',
      'allocation-total-mismatch',
    ))
  }

  let destinationRothAccountId: AccountId | null = null
  if (kind === 'rothConversion') {
    const rawDestinationId = candidate['destinationRothAccountId']
    if (!stableNonblank(rawDestinationId)) {
      issues.push(issue(
        'missingIdentity',
        'destinationRothAccountId',
        'An explicit stable Plan Roth destination account ID is required.',
        'conversion-destination-not-found',
      ))
    } else {
      const destinationMatches = matchingAccounts(plan, rawDestinationId)
      if (destinationMatches.length === 0) {
        issues.push(issue(
          'missingIdentity',
          'destinationRothAccountId',
          'The selected Roth destination account ID does not exist in the Plan.',
          'conversion-destination-not-found',
        ))
      } else if (destinationMatches.length !== 1) {
        issues.push(issue(
          'ambiguousIdentity',
          'destinationRothAccountId',
          'The selected Roth destination account ID is duplicated in the Plan.',
          'conversion-destination-not-found',
        ))
      } else if (personId !== null) {
        destinationRothAccountId = accountIdSchema.parse(rawDestinationId)
        const eligibilityIssue = conversionDestinationIssue(
          destinationMatches[0]!,
          personId,
          destinationRothAccountId,
        )
        if (eligibilityIssue !== null) {
          issues.push(eligibilityIssue)
          destinationRothAccountId = null
        }
      }
    }
  }

  if (
    issues.length > 0 ||
    !parsedPlanId.success ||
    personId === null ||
    !exactPositiveCents(requestedAmount)
  ) {
    return blocked(issues)
  }

  const purposeIdentityFacts = kind === 'ordinaryWithdrawal'
    ? {
        kind: record(candidate['purpose'])?.['kind'] ?? null,
        referenceId: record(candidate['purpose'])?.['referenceId'] ?? null,
      }
    : null
  const funding = kind === 'rothConversion' ? record(candidate['taxFunding']) : null
  const taxFundingIdentityFacts = funding === null
    ? null
    : funding['kind'] === 'linkedWithdrawal'
      ? { kind: funding['kind'], withdrawalActionId: funding['withdrawalActionId'] ?? null }
      : funding['kind'] === 'externalCash'
        ? {
            kind: funding['kind'],
            amount: funding['amount'] ?? null,
            attested: funding['attested'] ?? null,
          }
        : funding['kind'] === 'conversionPrincipalWithholding'
          ? { kind: funding['kind'], amount: funding['amount'] ?? null }
          : { kind: funding['kind'] ?? null }
  const identityFacts = {
    planId: parsedPlanId.data,
    kind,
    year: candidate['year'],
    executionDate: candidate['executionDate'] ?? null,
    executionSequence: candidate['executionSequence'],
    requestedAmount,
    personId,
    sourceAllocations: validSources,
    destinationRothAccountId,
    purpose: purposeIdentityFacts,
    taxFunding: taxFundingIdentityFacts,
  }
  let rawActionId: string
  try {
    rawActionId = deriveActionStructuralId('retirement-action-candidate', [identityFacts])
  } catch {
    return blocked([issue(
      'invalidIntent',
      '$',
      'Candidate facts are not losslessly serializable for stable identity.',
      'required-facts-missing',
    )])
  }
  const actionId = actionIdSchema.parse(rawActionId)
  const allocations = validSources
    .map((source) => ({
      allocationId: allocationIdSchema.parse(deriveActionStructuralId(
        'retirement-action-allocation',
        [actionId, source.sourceAccountId, source.requestedAmount],
      )),
      ...source,
    }))
    .sort((left, right) => compareUtf16CodeUnits(left.allocationId, right.allocationId))

  const reserved = completePlanReservedIdentifiers(plan)
  const collisionIssues: RetirementActionCandidateIdentityIssue[] = []
  for (const claim of [
    { field: 'actionId', value: actionId },
    ...allocations.map((allocation) => ({
      field: 'allocationId',
      value: allocation.allocationId,
    })),
  ]) {
    if (reserved.has(claim.value)) {
      collisionIssues.push(issue(
        'generatedIdentityCollision',
        claim.field,
        `The deterministic ${claim.field} ${claim.value} is already reserved by this Plan; the allocator will not suffix or replace it.`,
        null,
      ))
    } else {
      reserved.add(claim.value)
    }
  }
  if (collisionIssues.length > 0) return blocked(collisionIssues)

  const rawRequest = kind === 'ordinaryWithdrawal'
    ? {
        actionId,
        kind,
        year: candidate['year'],
        ...(candidate['executionDate'] === undefined
          ? {}
          : { executionDate: candidate['executionDate'] }),
        executionSequence: candidate['executionSequence'],
        requestedAmount,
        provenance: candidate['provenance'],
        personId,
        allocations,
        purpose: candidate['purpose'],
      }
    : {
        actionId,
        kind,
        year: candidate['year'],
        ...(candidate['executionDate'] === undefined
          ? {}
          : { executionDate: candidate['executionDate'] }),
        executionSequence: candidate['executionSequence'],
        requestedAmount,
        provenance: candidate['provenance'],
        personId,
        allocations,
        destinationRothAccountId,
        taxFunding: candidate['taxFunding'],
      }
  const parsed = retirementActionRequestSchema.safeParse(rawRequest)
  if (!parsed.success || (
    parsed.data.kind !== 'ordinaryWithdrawal' && parsed.data.kind !== 'rothConversion'
  )) {
    const detail = parsed.success
      ? 'Candidate did not produce a supported identity-bearing request.'
      : parsed.error.issues
        .map((entry) => `${entry.path.join('.') || '$'}: ${entry.message}`)
        .join('; ')
    return blocked([issue(
      'invalidIntent',
      '$',
      detail,
      'required-facts-missing',
    )])
  }

  return {
    status: 'allocated',
    request: parsed.data,
    evidence: {
      policy: 'explicitStablePlanIdsOnly',
      planId: parsedPlanId.data,
      personId,
      sourceAccountIds: validSources.map((source) => source.sourceAccountId),
      destinationRothAccountId,
      sourceCanonicalOrder: 'utf16AccountId',
      generatedAllocationOrder: 'utf16AllocationId',
    },
  }
}

export function allocateRetirementActionCandidateIdentity(
  plan: Readonly<Plan>,
  intent: RetirementActionCandidateIdentityIntent,
): RetirementActionCandidateIdentityAllocationResult {
  try {
    return allocateRetirementActionCandidateIdentityUnchecked(plan, intent)
  } catch {
    return blocked([issue(
      'invalidIntent',
      '$',
      'Candidate and Plan facts could not be inspected losslessly for stable identity allocation.',
      'required-facts-missing',
    )])
  }
}
