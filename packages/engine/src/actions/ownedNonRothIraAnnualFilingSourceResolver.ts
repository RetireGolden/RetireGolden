import {
  planSchema,
  retirementActionPlanReservedIdentifiers,
  type Plan,
} from '../model/plan.js'
import {
  ownedNonRothIraAnnualFilingSourceKey,
  planOwnedNonRothIraAnnualFilingSourceIdentifierClaims,
  persistedPlanOwnedNonRothIraAnnualFilingSourceRecordSchema,
  type PlanOwnedNonRothIraAnnualFilingSourceRecord,
} from '../model/retirementActionAnnualTaxFacts.js'

export type OwnedNonRothIraAnnualFilingSourceOrigin = 'plan' | 'runtime'

export interface ResolvePlanOwnedNonRothIraAnnualFilingSourcesInput {
  plan: unknown
  /** Immutable call-boundary facts; callbacks are intentionally unsupported. */
  runtimeSourceRecords?:
    readonly Readonly<PlanOwnedNonRothIraAnnualFilingSourceRecord>[]
}

export type OwnedNonRothIraAnnualFilingSourceResolutionIssueKind =
  | 'planInvalid'
  | 'runtimeInputInvalid'
  | 'runtimeSourceRecordInvalid'
  | 'runtimeSourceBindingMismatch'
  | 'duplicateOwnerYearSource'
  | 'duplicateSourceIdentifier'

export interface OwnedNonRothIraAnnualFilingSourceResolutionIssue {
  kind: OwnedNonRothIraAnnualFilingSourceResolutionIssueKind
  detail: string
  sourceOrigin?: OwnedNonRothIraAnnualFilingSourceOrigin
  sourceIndex?: number
  sourceKey?: string
  identifier?: string
}

export interface ResolvedPlanOwnedNonRothIraAnnualFilingSource {
  sourceOrigin: OwnedNonRothIraAnnualFilingSourceOrigin
  sourceRecord: Readonly<PlanOwnedNonRothIraAnnualFilingSourceRecord>
}

export interface ResolvePlanOwnedNonRothIraAnnualFilingSourcesResult {
  status: 'resolved' | 'partiallyResolved' | 'blocked'
  sources: readonly Readonly<ResolvedPlanOwnedNonRothIraAnnualFilingSource>[]
  issues: readonly Readonly<OwnedNonRothIraAnnualFilingSourceResolutionIssue>[]
}

/**
 * The persisted filing-source root arbitrated for identity-namespace use only.
 * `rejected` means at least one persisted record lost the same no-precedence
 * arbitration the full resolver applies, so the identifiers that record claims
 * are not proven and no caller may treat the root as an authority.
 */
export interface PlanOwnedNonRothIraAnnualFilingSourceIdentityReservation {
  status: 'reserved' | 'rejected'
  /** Sorted identifier claims of the surviving sources; a rejected source claims nothing. */
  identifiers: readonly string[]
  issues: readonly Readonly<OwnedNonRothIraAnnualFilingSourceResolutionIssue>[]
}

interface Candidate extends ResolvedPlanOwnedNonRothIraAnnualFilingSource {
  sourceIndex: number
  sourceKey: string
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

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function exactOwnedIraPool(plan: Plan, ownerPersonId: string): string[] {
  return plan.accounts
    .filter((account) =>
      account.type === 'traditional' &&
      account.kind === 'ira' &&
      account.inherited === undefined &&
      account.ownerPersonId === ownerPersonId)
    .map((account) => account.id)
    .sort(compareText)
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length &&
    left.every((value, index) => value === right[index])
}

function canonicalSourceRecord(
  record: Readonly<PlanOwnedNonRothIraAnnualFilingSourceRecord>,
): PlanOwnedNonRothIraAnnualFilingSourceRecord {
  const snapshot = structuredClone(record)
  snapshot.reviewedSourceAccountIds.sort(compareText)
  snapshot.nondeductibleContributionFacts.contributions.sort((left, right) =>
    compareText(left.contributionDate, right.contributionDate) ||
    compareText(left.sourceRecordId, right.sourceRecordId) ||
    compareText(left.sourceEvidenceId, right.sourceEvidenceId) ||
    compareText(left.sourceAccountId, right.sourceAccountId) ||
    left.nondeductibleContributionAmount - right.nondeductibleContributionAmount)
  return snapshot
}

function runtimeBindingIssue(
  plan: Plan,
  record: Readonly<PlanOwnedNonRothIraAnnualFilingSourceRecord>,
): string | null {
  if (record.planId !== plan.id) return 'runtime source must bind the simulated Plan id'
  if (plan.household.people.filter((person) => person.id === record.ownerPersonId).length !== 1) {
    return 'runtime source owner must resolve uniquely in the simulated Plan'
  }
  const expectedPool = exactOwnedIraPool(plan, record.ownerPersonId)
  const reviewedPool = [...record.reviewedSourceAccountIds].sort(compareText)
  if (expectedPool.length === 0 || !sameStrings(expectedPool, reviewedPool)) {
    return 'runtime source must review the exact current owner-wide IRA pool'
  }
  const reserved = retirementActionPlanReservedIdentifiers(plan)
  const collision = planOwnedNonRothIraAnnualFilingSourceIdentifierClaims(record)
    .find((claim) => reserved.has(claim.value))
  return collision === undefined
    ? null
    : `runtime source identifier "${collision.value}" collides with the Plan identity namespace`
}

function planSourceCandidates(plan: Readonly<Plan>): Candidate[] {
  const planRecords =
    plan.retirementActionAnnualTaxFacts
      ?.ownedNonRothIraAnnualFilingSourceRecords ?? []
  return planRecords.map((sourceRecord, sourceIndex) => ({
    sourceOrigin: 'plan' as const,
    sourceIndex,
    sourceKey: ownedNonRothIraAnnualFilingSourceKey(sourceRecord),
    sourceRecord: canonicalSourceRecord(sourceRecord),
  }))
}

/**
 * The single no-precedence rule: every candidate sharing a Plan/owner/year key,
 * and every candidate sharing any stable identifier, is rejected in full.
 */
function arbitrateSourceCandidates(candidates: readonly Candidate[]): {
  resolved: Candidate[]
  issues: OwnedNonRothIraAnnualFilingSourceResolutionIssue[]
} {
  const issues: OwnedNonRothIraAnnualFilingSourceResolutionIssue[] = []
  const candidatesByKey = new Map<string, Candidate[]>()
  for (const candidate of candidates) {
    const matches = candidatesByKey.get(candidate.sourceKey)
    if (matches === undefined) candidatesByKey.set(candidate.sourceKey, [candidate])
    else matches.push(candidate)
  }
  const rejected = new Set<Candidate>()
  for (const [sourceKey, matches] of candidatesByKey) {
    if (matches.length === 1) continue
    matches.forEach((match) => issues.push({
      kind: 'duplicateOwnerYearSource',
      detail: 'duplicate annual filing source Plan, owner, and tax year is rejected without precedence',
      sourceOrigin: match.sourceOrigin,
      sourceIndex: match.sourceIndex,
      sourceKey,
    }))
    matches.forEach((match) => rejected.add(match))
  }

  const candidatesByIdentifier = new Map<string, Candidate[]>()
  for (const candidate of candidates) {
    for (const claim of planOwnedNonRothIraAnnualFilingSourceIdentifierClaims(
      candidate.sourceRecord,
    )) {
      const matches = candidatesByIdentifier.get(claim.value)
      if (matches === undefined) candidatesByIdentifier.set(claim.value, [candidate])
      else matches.push(candidate)
    }
  }
  for (const [identifier, matches] of candidatesByIdentifier) {
    if (matches.length === 1) continue
    matches.forEach((match) => {
      rejected.add(match)
      issues.push({
        kind: 'duplicateSourceIdentifier',
        detail: 'duplicate annual filing source identifier is rejected without precedence',
        sourceOrigin: match.sourceOrigin,
        sourceIndex: match.sourceIndex,
        sourceKey: match.sourceKey,
        identifier,
      })
    })
  }
  return {
    resolved: candidates.filter((candidate) => !rejected.has(candidate)),
    issues,
  }
}

function sortIssues(
  issues: OwnedNonRothIraAnnualFilingSourceResolutionIssue[],
): void {
  issues.sort((left, right) =>
    compareText(left.sourceKey ?? '', right.sourceKey ?? '') ||
    compareText(left.sourceOrigin ?? '', right.sourceOrigin ?? '') ||
    (left.sourceIndex ?? -1) - (right.sourceIndex ?? -1) ||
    compareText(left.kind, right.kind) ||
    compareText(left.identifier ?? '', right.identifier ?? ''))
}

/**
 * Arbitrates the persisted filing-source root alone, for callers that consult it
 * as an identity namespace rather than as annual evidence. Same rule, same
 * refusals: a caller that reads the root directly would reserve identifiers no
 * arbitration proved.
 */
export function reservePlanOwnedNonRothIraAnnualFilingSourceIdentifiers(
  plan: Readonly<Plan>,
): Readonly<PlanOwnedNonRothIraAnnualFilingSourceIdentityReservation> {
  const { resolved, issues } = arbitrateSourceCandidates(planSourceCandidates(plan))
  sortIssues(issues)
  const identifiers = new Set<string>()
  for (const candidate of resolved) {
    for (const claim of planOwnedNonRothIraAnnualFilingSourceIdentifierClaims(
      candidate.sourceRecord,
    )) {
      identifiers.add(claim.value)
    }
  }
  return deepFreeze({
    status: issues.length > 0 ? 'rejected' as const : 'reserved' as const,
    identifiers: [...identifiers].sort(compareText),
    issues,
  })
}

/**
 * Resolves persisted and call-boundary filing sources without precedence. Every
 * colliding Plan/owner/year key is removed in full; a Plan record never shadows
 * runtime evidence and a runtime record never shadows persisted evidence.
 */
export function resolvePlanOwnedNonRothIraAnnualFilingSources(
  input: Readonly<ResolvePlanOwnedNonRothIraAnnualFilingSourcesInput>,
): Readonly<ResolvePlanOwnedNonRothIraAnnualFilingSourcesResult> {
  const invalidPlan = () => deepFreeze({
    status: 'blocked' as const,
    sources: [],
    issues: [{
      kind: 'planInvalid' as const,
      detail: 'annual filing sources require a valid current Plan',
    }],
  })
  let plan: Plan
  try {
    const parsedPlan = planSchema.safeParse(input.plan)
    if (!parsedPlan.success) return invalidPlan()
    plan = parsedPlan.data
  } catch {
    return invalidPlan()
  }
  let runtimeSnapshots: unknown[]
  try {
    const supplied = input.runtimeSourceRecords ?? []
    if (!Array.isArray(supplied)) throw new TypeError('runtime source input must be an array')
    runtimeSnapshots = structuredClone(supplied) as unknown[]
  } catch {
    return deepFreeze({
      status: 'blocked',
      sources: [],
      issues: [{
        kind: 'runtimeInputInvalid',
        detail: 'runtime annual filing source input must be one cloneable immutable array',
      }],
    })
  }

  const issues: OwnedNonRothIraAnnualFilingSourceResolutionIssue[] = []
  const candidates: Candidate[] = planSourceCandidates(plan)
  runtimeSnapshots.forEach((snapshot, sourceIndex) => {
    const parsed = persistedPlanOwnedNonRothIraAnnualFilingSourceRecordSchema.safeParse(snapshot)
    if (!parsed.success) {
      issues.push({
        kind: 'runtimeSourceRecordInvalid',
        detail: 'runtime annual filing source record is structurally invalid',
        sourceOrigin: 'runtime',
        sourceIndex,
      })
      return
    }
    const bindingIssue = runtimeBindingIssue(plan, parsed.data)
    if (bindingIssue !== null) {
      issues.push({
        kind: 'runtimeSourceBindingMismatch',
        detail: bindingIssue,
        sourceOrigin: 'runtime',
        sourceIndex,
        sourceKey: ownedNonRothIraAnnualFilingSourceKey(parsed.data),
      })
      return
    }
    candidates.push({
      sourceOrigin: 'runtime',
      sourceIndex,
      sourceKey: ownedNonRothIraAnnualFilingSourceKey(parsed.data),
      sourceRecord: canonicalSourceRecord(parsed.data),
    })
  })

  const arbitration = arbitrateSourceCandidates(candidates)
  issues.push(...arbitration.issues)
  const resolved = arbitration.resolved
  resolved.sort((left, right) =>
    compareText(left.sourceKey, right.sourceKey) ||
    compareText(left.sourceOrigin, right.sourceOrigin) ||
    compareText(left.sourceRecord.sourceRecordId, right.sourceRecord.sourceRecordId))
  sortIssues(issues)

  const sources = resolved.map(({ sourceOrigin, sourceRecord }) => ({
    sourceOrigin,
    sourceRecord,
  }))
  return deepFreeze({
    status: sources.length === 0 && issues.length > 0
      ? 'blocked'
      : issues.length > 0
        ? 'partiallyResolved'
        : 'resolved',
    sources,
    issues,
  })
}
