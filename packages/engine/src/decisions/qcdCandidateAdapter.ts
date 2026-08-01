import {
  allocateRetirementActionCandidateIdentity,
  type QcdCandidateIdentityIntent,
  type RetirementActionCandidateIdentityEvidence,
  type RetirementActionCandidateIdentityIssue,
} from '../actions/retirementActionCandidateIdentityAllocator.js'
import type {
  QualifiedCharitableDistributionRequest,
} from '../actions/contract.js'
import {
  asActionId,
  type AccountId,
  type PersonId,
} from '../actions/identity.js'
import type { UsdCents } from '../actions/money.js'
import { compareUtf16CodeUnits } from '../actions/structuralId.js'
import { createActionReason, type ActionReason } from '../actions/reasons.js'
import type { Plan } from '../model/plan.js'
import type { ProjectionResult } from '../projection/types.js'
import { applyScenarioPatch } from '../scenarios/scenarios.js'
import {
  evaluateRetirementActionEligibilityFromPlan,
  type RetirementActionEligibilityDecision,
} from '../strategies/accountEligibility.js'
import {
  QCD_EFFICIENCY_EXPLORATORY_REASON,
  qcdEfficiencyAnnualTargets,
  qcdEfficiencyRationale,
  type QcdEfficiencyAnnualTarget,
} from '../insights/detectors/qcdEfficiency.js'
import type { DecisionCandidate } from './types.js'
import {
  inspectCompleteRetirementActionCandidateSchedule,
  type RetirementActionCandidateScheduleIssue,
} from './retirementActionCandidateSchedule.js'

export interface QcdEfficiencyCandidateRuntimeFacts {
  personAliveEvidenceId: string
  donorAlive: true
  priorQcdOffsetEvidenceId: string
  priorQcdOffsetApplied: UsdCents
}

export interface QcdEfficiencyCandidateAlternative {
  alternativeId: string
  intent: QcdCandidateIdentityIntent
  runtimeFacts: QcdEfficiencyCandidateRuntimeFacts
}

export type QcdEfficiencyCandidateIssue =
  | RetirementActionCandidateIdentityIssue
  | RetirementActionCandidateScheduleIssue
  | Readonly<{
      kind:
        | 'invalidExploratoryCandidate'
        | 'invalidAlternative'
        | 'ineligibleAlternative'
        | 'ambiguousAlternative'
      field: string
      reason: ActionReason | null
      detail: string
    }>

type LocalQcdEfficiencyCandidateIssueKind =
  | 'invalidExploratoryCandidate'
  | 'invalidAlternative'
  | 'ineligibleAlternative'
  | 'ambiguousAlternative'

export interface QcdEfficiencyAlternativeEvidence {
  alternativeId: string
  donorPersonId: PersonId | null
  sourceAccountId: AccountId | null
  year: number | null
  executionDate: string | null
  executionSequence: number | null
  requestedAmount: number | null
  charityDesignationId: string | null
  personAliveEvidenceId: string | null
  priorQcdOffsetEvidenceId: string | null
  priorQcdOffsetApplied: number | null
  disposition: 'eligible' | 'blocked'
  reasonCodes: readonly string[]
}

export type AdaptedQcdEfficiencyCandidate = Readonly<{
  status: 'adapted'
  candidate: DecisionCandidate
  selectedAlternativeIds: readonly string[]
  requests: readonly QualifiedCharitableDistributionRequest[]
  identityEvidence: readonly RetirementActionCandidateIdentityEvidence[]
  allocationEvidence: Readonly<{
    policy: 'eligibleAlternativeCanonicalIdentityTuple'
    selectedAlternativeIds: readonly string[]
    alternatives: readonly QcdEfficiencyAlternativeEvidence[]
  }>
}>

export type BlockedQcdEfficiencyCandidate = Readonly<{
  status: 'blocked'
  candidate: null
  issues: readonly [QcdEfficiencyCandidateIssue, ...QcdEfficiencyCandidateIssue[]]
  allocationEvidence: Readonly<{
    policy: 'eligibleAlternativeCanonicalIdentityTuple'
    selectedAlternativeIds: readonly []
    alternatives: readonly QcdEfficiencyAlternativeEvidence[]
  }>
}>

export type QcdEfficiencyCandidateAdaptationResult =
  | AdaptedQcdEfficiencyCandidate
  | BlockedQcdEfficiencyCandidate

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

function keysExactly(value: UnknownRecord, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort(compareUtf16CodeUnits)
  const canonical = [...expected].sort(compareUtf16CodeUnits)
  return actual.length === canonical.length && actual.every((key, index) => key === canonical[index])
}

function localIssue(
  kind: LocalQcdEfficiencyCandidateIssueKind,
  field: string,
  detail: string,
  reason: ActionReason | null = null,
): QcdEfficiencyCandidateIssue {
  return { kind, field, reason, detail }
}

function blocked(
  issues: QcdEfficiencyCandidateIssue[],
  alternatives: readonly QcdEfficiencyAlternativeEvidence[] = [],
): BlockedQcdEfficiencyCandidate {
  return {
    status: 'blocked',
    candidate: null,
    issues: issues as [QcdEfficiencyCandidateIssue, ...QcdEfficiencyCandidateIssue[]],
    allocationEvidence: {
      policy: 'eligibleAlternativeCanonicalIdentityTuple',
      selectedAlternativeIds: [],
      alternatives,
    },
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function alternativeEvidence(
  alternative: unknown,
  disposition: 'eligible' | 'blocked',
  reasonCodes: readonly string[],
): QcdEfficiencyAlternativeEvidence {
  const outer = record(alternative)
  const intent = record(outer?.['intent'])
  const source = record(intent?.['sourceAllocation'])
  const charity = record(intent?.['charity'])
  const runtimeFacts = record(outer?.['runtimeFacts'])
  return {
    alternativeId: stringOrNull(outer?.['alternativeId']) ?? '',
    donorPersonId: stringOrNull(intent?.['donorPersonId']) as PersonId | null,
    sourceAccountId: stringOrNull(source?.['sourceAccountId']) as AccountId | null,
    year: Number.isSafeInteger(intent?.['year']) ? intent?.['year'] as number : null,
    executionDate: stringOrNull(intent?.['executionDate']),
    executionSequence: Number.isSafeInteger(intent?.['executionSequence'])
      ? intent?.['executionSequence'] as number
      : null,
    requestedAmount: Number.isSafeInteger(intent?.['requestedAmount'])
      ? intent?.['requestedAmount'] as number
      : null,
    charityDesignationId: stringOrNull(charity?.['designationId']),
    personAliveEvidenceId: stringOrNull(runtimeFacts?.['personAliveEvidenceId']),
    priorQcdOffsetEvidenceId: stringOrNull(runtimeFacts?.['priorQcdOffsetEvidenceId']),
    priorQcdOffsetApplied: Number.isSafeInteger(runtimeFacts?.['priorQcdOffsetApplied'])
      ? runtimeFacts?.['priorQcdOffsetApplied'] as number
      : null,
    disposition,
    reasonCodes,
  }
}

function exactExploratoryCandidate(
  plan: Readonly<Plan>,
  candidate: Readonly<DecisionCandidate>,
  expectedTargets: readonly QcdEfficiencyAnnualTarget[],
): QcdEfficiencyCandidateIssue | null {
  try {
    const outer = record(candidate)
    const readiness = record(outer?.['retirementActionReadiness'])
    const metadata = record(outer?.['metadata'])
    const patch = record(outer?.['planPatch'])
    const strategies = record(patch?.['strategies'])
    const itemized = record(strategies?.['itemizedDeductions'])
    const planItemized = plan.strategies.itemizedDeductions
    const charitable = planItemized?.charitable ?? 0
    if (
      outer === null ||
      !keysExactly(outer, [
        'id',
        'source',
        'category',
        'label',
        'explanation',
        'planPatch',
        'retirementActionReadiness',
        'metadata',
      ]) ||
      outer['id'] !== 'insight-qcd-efficiency' ||
      outer['source'] !== 'detector' ||
      outer['category'] !== 'withdrawal' ||
      outer['label'] !== 'Donations routed as QCDs' ||
      outer['explanation'] !== qcdEfficiencyRationale(charitable) ||
      patch === null ||
      !keysExactly(patch, ['strategies']) ||
      strategies === null ||
      !keysExactly(strategies, ['qcdAnnual', 'itemizedDeductions']) ||
      strategies['qcdAnnual'] !== charitable ||
      itemized === null ||
      !keysExactly(itemized, [
        'stateAndLocalTaxes',
        'mortgageInterest',
        'charitable',
      ]) ||
      itemized['charitable'] !== 0 ||
      itemized['stateAndLocalTaxes'] !== planItemized?.stateAndLocalTaxes ||
      itemized['mortgageInterest'] !== planItemized?.mortgageInterest ||
      readiness === null ||
      !keysExactly(readiness, ['state', 'reason']) ||
      readiness['state'] !== 'exploratoryNonActionable' ||
      readiness['reason'] !== QCD_EFFICIENCY_EXPLORATORY_REASON ||
      metadata === null ||
      !keysExactly(metadata, ['qcdAnnualTargets']) ||
      !Array.isArray(metadata['qcdAnnualTargets']) ||
      metadata['qcdAnnualTargets'].length !== expectedTargets.length ||
      metadata['qcdAnnualTargets'].some((target, index) => {
        const targetRecord = record(target)
        const expected = expectedTargets[index]
        return targetRecord === null ||
          expected === undefined ||
          !keysExactly(targetRecord, ['year', 'requestedAmount']) ||
          targetRecord['year'] !== expected.year ||
          targetRecord['requestedAmount'] !== expected.requestedAmount
      })
    ) {
      return localIssue(
        'invalidExploratoryCandidate',
        '$',
        'Only the exact calculation-only QCD efficiency detector candidate can be adapted.',
      )
    }
    if (!(charitable > 0) || plan.strategies.qcdAnnual !== 0) {
      return localIssue(
        'invalidExploratoryCandidate',
        'plan.strategies.qcdAnnual',
        'Identity adaptation requires a positive charitable target and no pre-existing aggregate QCD amount; mixed aggregate and sourced QCD schedules remain exploratory.',
      )
    }
    return null
  } catch {
    return localIssue(
      'invalidExploratoryCandidate',
      '$',
      'The exploratory QCD candidate could not be inspected losslessly.',
    )
  }
}

function canonicalAlternativeKey(evidence: QcdEfficiencyAlternativeEvidence): string {
  return JSON.stringify([
    evidence.donorPersonId,
    evidence.sourceAccountId,
    evidence.year,
    evidence.executionDate,
    evidence.executionSequence,
    evidence.requestedAmount,
    evidence.charityDesignationId,
    evidence.alternativeId,
  ])
}

function eligibilityReasons(decision: RetirementActionEligibilityDecision): readonly ActionReason[] {
  return decision.status === 'accepted' ? [] : decision.reasons
}

/**
 * Replace the detector's aggregate calculation preview with a complete explicit
 * per-year QCD schedule.
 * Every donor/source/date/charity alternative is caller-authored and evaluated
 * through the shared eligibility service. Eligible alternatives are selected
 * by stable identity, never Plan or caller array position; all alternatives
 * and their blocking reason codes remain attached as provenance evidence.
 */
export function adaptQcdEfficiencyDetectorCandidate(
  plan: Readonly<Plan>,
  exploratoryCandidate: Readonly<DecisionCandidate>,
  alternatives: readonly [
    QcdEfficiencyCandidateAlternative,
    ...QcdEfficiencyCandidateAlternative[],
  ],
  detectorProjection: Readonly<ProjectionResult>,
): QcdEfficiencyCandidateAdaptationResult {
  let planSnapshot: Plan
  let candidateSnapshot: DecisionCandidate
  let projectionSnapshot: ProjectionResult
  let alternativeSnapshots: readonly QcdEfficiencyCandidateAlternative[]
  try {
    planSnapshot = structuredClone(plan)
    candidateSnapshot = structuredClone(exploratoryCandidate)
    projectionSnapshot = structuredClone(detectorProjection)
    const clonedAlternatives: unknown = structuredClone(alternatives)
    if (!Array.isArray(clonedAlternatives) || clonedAlternatives.length === 0) {
      return blocked([localIssue(
        'invalidAlternative',
        'alternatives',
        'QCD alternatives must be a nonempty plain-data array.',
      )])
    }
    alternativeSnapshots = clonedAlternatives as QcdEfficiencyCandidateAlternative[]
  } catch {
    return blocked([localIssue(
      'invalidAlternative',
      '$',
      'The Plan, detector candidate, projection, or QCD alternatives could not be snapshotted into stable plain data.',
    )])
  }

  const expectedTargets = qcdEfficiencyAnnualTargets(planSnapshot, projectionSnapshot)
  if (expectedTargets === null) {
    return blocked([localIssue(
      'invalidExploratoryCandidate',
      'detectorProjection',
      'The detector projection does not provide one contiguous, Plan-bound annual QCD target schedule.',
    )])
  }
  const invalidCandidate = exactExploratoryCandidate(
    planSnapshot,
    candidateSnapshot,
    expectedTargets,
  )
  if (invalidCandidate !== null) return blocked([invalidCandidate])
  const targetYears = expectedTargets.map((target) => target.year)
  const targetYearSet = new Set(targetYears)
  const targetAmountByYear = new Map(expectedTargets.map((target) => [
    target.year,
    target.requestedAmount,
  ]))

  const schedule = inspectCompleteRetirementActionCandidateSchedule(
    planSnapshot.strategies.retirementActions,
  )
  if (!schedule.ok) return blocked([schedule.issue])

  const seenAlternativeIds = new Set<string>()
  const seenRuntimeEvidenceIds = new Set<string>()
  const seenAlternativeIdentityKeys = new Set<string>()
  const issues: QcdEfficiencyCandidateIssue[] = []
  const evidence: QcdEfficiencyAlternativeEvidence[] = []
  const eligible: Array<{
    alternative: QcdEfficiencyCandidateAlternative
    request: QualifiedCharitableDistributionRequest
    identityEvidence: RetirementActionCandidateIdentityEvidence
    evidence: QcdEfficiencyAlternativeEvidence
  }> = []

  for (const [index, alternative] of alternativeSnapshots.entries()) {
    const outer = record(alternative)
    const runtimeFacts = record(outer?.['runtimeFacts'])
    const alternativeId = stringOrNull(outer?.['alternativeId'])
    if (
      outer === null ||
      !keysExactly(outer, ['alternativeId', 'intent', 'runtimeFacts']) ||
      alternativeId === null ||
      runtimeFacts === null ||
      !keysExactly(runtimeFacts, [
        'personAliveEvidenceId',
        'donorAlive',
        'priorQcdOffsetEvidenceId',
        'priorQcdOffsetApplied',
      ]) ||
      stringOrNull(runtimeFacts['personAliveEvidenceId']) === null ||
      runtimeFacts['donorAlive'] !== true ||
      stringOrNull(runtimeFacts['priorQcdOffsetEvidenceId']) === null ||
      !Number.isSafeInteger(runtimeFacts['priorQcdOffsetApplied']) ||
      (runtimeFacts['priorQcdOffsetApplied'] as number) < 0 ||
      Object.is(runtimeFacts['priorQcdOffsetApplied'], -0)
    ) {
      const entry = alternativeEvidence(alternative, 'blocked', ['required-facts-missing'])
      evidence.push(entry)
      issues.push(localIssue(
        'invalidAlternative',
        `alternatives.${index}`,
        'Each alternative requires one stable ID plus explicit alive and prior-QCD-offset runtime evidence.',
      ))
      continue
    }
    if (seenAlternativeIds.has(alternativeId)) {
      const entry = alternativeEvidence(alternative, 'blocked', ['duplicate-allocation-id'])
      evidence.push(entry)
      issues.push(localIssue(
        'ambiguousAlternative',
        `alternatives.${index}.alternativeId`,
        `Alternative ID "${alternativeId}" is duplicated; alternatives must retain distinct provenance.`,
      ))
      continue
    }
    seenAlternativeIds.add(alternativeId)

    const personAliveEvidenceId = runtimeFacts['personAliveEvidenceId'] as string
    const priorQcdOffsetEvidenceId = runtimeFacts['priorQcdOffsetEvidenceId'] as string
    if (
      personAliveEvidenceId === priorQcdOffsetEvidenceId ||
      seenRuntimeEvidenceIds.has(personAliveEvidenceId) ||
      seenRuntimeEvidenceIds.has(priorQcdOffsetEvidenceId)
    ) {
      evidence.push(alternativeEvidence(alternative, 'blocked', ['required-facts-missing']))
      issues.push(localIssue(
        'ambiguousAlternative',
        `alternatives.${index}.runtimeFacts`,
        'Alive and prior-offset evidence IDs must be nonempty, role-distinct, and unique across alternatives.',
      ))
      continue
    }
    seenRuntimeEvidenceIds.add(personAliveEvidenceId)
    seenRuntimeEvidenceIds.add(priorQcdOffsetEvidenceId)

    const intentRecord = record(outer['intent'])
    const provenanceRecord = record(intentRecord?.['provenance'])
    const sourceAllocationRecord = record(intentRecord?.['sourceAllocation'])
    const charityRecord = record(intentRecord?.['charity'])
    if (
      intentRecord === null ||
      provenanceRecord === null ||
      sourceAllocationRecord === null ||
      charityRecord === null
    ) {
      evidence.push(alternativeEvidence(alternative, 'blocked', ['required-facts-missing']))
      issues.push(localIssue(
        'invalidAlternative',
        `alternatives.${index}.intent`,
        'Every alternative requires an inspectable QCD intent, provenance, source allocation, and charity designation.',
      ))
      continue
    }

    const intent = alternative.intent
    const intentYear = Number.isSafeInteger(intentRecord['year'])
      ? intentRecord['year'] as number
      : null
    const annualTargetAmount = intentYear === null
      ? undefined
      : targetAmountByYear.get(intentYear)
    if (
      intentRecord['kind'] !== 'qcd' ||
      provenanceRecord['source'] !== 'generator' ||
      provenanceRecord['sourceId'] !== 'qcd-efficiency' ||
      intentYear === null ||
      !targetYearSet.has(intentYear) ||
      annualTargetAmount === undefined ||
      intentRecord['requestedAmount'] !== annualTargetAmount ||
      sourceAllocationRecord['requestedAmount'] !== annualTargetAmount
    ) {
      const entry = alternativeEvidence(alternative, 'blocked', ['allocation-total-mismatch'])
      evidence.push(entry)
      issues.push(localIssue(
        'invalidAlternative',
        `alternatives.${index}.intent`,
        'Every alternative must preserve qcd-efficiency generator provenance, target one detector projection year, and allocate the annual charitable target exactly once.',
      ))
      continue
    }
    const alternativeIdentityKey = JSON.stringify([
      intent.donorPersonId,
      intent.sourceAllocation.sourceAccountId,
      intent.year,
      intent.executionDate,
      intent.executionSequence,
      intent.requestedAmount,
      intent.charity.designationId,
    ])
    if (seenAlternativeIdentityKeys.has(alternativeIdentityKey)) {
      evidence.push(alternativeEvidence(alternative, 'blocked', ['duplicate-allocation-id']))
      issues.push(localIssue(
        'ambiguousAlternative',
        `alternatives.${index}.intent`,
        'Two alternatives repeat the same donor, source, schedule, amount, and charity identity.',
      ))
      continue
    }
    seenAlternativeIdentityKeys.add(alternativeIdentityKey)

    const allocated = allocateRetirementActionCandidateIdentity(planSnapshot, intent)
    if (allocated.status === 'blocked') {
      evidence.push(alternativeEvidence(
        alternative,
        'blocked',
        allocated.issues.flatMap((entry) => entry.reason === null ? [] : [entry.reason.code]),
      ))
      issues.push(...allocated.issues.map((entry) => ({
        ...entry,
        field: `alternatives.${index}.intent.${entry.field}`,
      })))
      continue
    }
    if (allocated.request.kind !== 'qcd') {
      evidence.push(alternativeEvidence(alternative, 'blocked', ['required-facts-missing']))
      issues.push(localIssue(
        'invalidAlternative',
        `alternatives.${index}.intent.kind`,
        'The QCD adapter received a non-QCD allocator result.',
      ))
      continue
    }

    const request = allocated.request
    const decision = evaluateRetirementActionEligibilityFromPlan(request, planSnapshot, {
      personAliveEvidence: [{
        evidenceId: alternative.runtimeFacts.personAliveEvidenceId,
        actionId: asActionId(request.actionId),
        personId: request.donorPersonId,
        actionYear: request.year,
        actionDate: request.executionDate ?? null,
        alive: true,
      }],
      priorQcdOffsetEvidence: [{
        evidenceId: alternative.runtimeFacts.priorQcdOffsetEvidenceId,
        actionId: asActionId(request.actionId),
        donorPersonId: request.donorPersonId,
        actionYear: request.year,
        actionDate: request.executionDate ?? null,
        priorOffsetApplied: alternative.runtimeFacts.priorQcdOffsetApplied,
      }],
    })
    if (decision.status !== 'accepted') {
      const reasons = eligibilityReasons(decision)
      const entry = alternativeEvidence(
        alternative,
        'blocked',
        reasons.map((reason) => reason.code),
      )
      evidence.push(entry)
      issues.push(localIssue(
        'ineligibleAlternative',
        `alternatives.${index}.intent`,
        'The shared QCD eligibility service did not accept this donor/source/date/charity alternative.',
        reasons[0] ?? null,
      ))
      continue
    }

    const selectedGroup = request.executionDate === undefined
      ? `undated:${request.year}`
      : `dated:${request.executionDate}`
    const conflictingScheduleIndex = schedule.actions.findIndex((action) => {
      const group = action.executionDate === undefined
        ? `undated:${action.year}`
        : `dated:${action.executionDate}`
      return group === selectedGroup &&
        action.executionSequence === request.executionSequence
    })
    if (conflictingScheduleIndex !== -1) {
      const scheduleReason = createActionReason('action-sequence-conflict')
      evidence.push(alternativeEvidence(
        alternative,
        'blocked',
        [scheduleReason.code],
      ))
      issues.push(localIssue(
        'ineligibleAlternative',
        `alternatives.${index}.intent.executionSequence`,
        `The QCD execution slot is already used by Plan action index ${conflictingScheduleIndex}; the adapter will not invent a replacement sequence.`,
        scheduleReason,
      ))
      continue
    }

    const entry = alternativeEvidence(alternative, 'eligible', [])
    evidence.push(entry)
    eligible.push({
      alternative,
      request,
      identityEvidence: allocated.evidence,
      evidence: entry,
    })
  }

  if (issues.some((entry) => entry.kind === 'invalidAlternative' || entry.kind === 'ambiguousAlternative')) {
    return blocked(issues, evidence)
  }
  const eligibleByYear = new Map<number, typeof eligible>()
  for (const entry of eligible) {
    const group = eligibleByYear.get(entry.request.year) ?? []
    group.push(entry)
    eligibleByYear.set(entry.request.year, group)
  }
  const missingTargetYears = targetYears.filter((year) =>
    (eligibleByYear.get(year)?.length ?? 0) === 0,
  )
  if (missingTargetYears.length > 0) {
    return blocked(
      [
        ...issues,
        ...missingTargetYears.map((year) => localIssue(
          'ineligibleAlternative',
          'alternatives',
          `No supplied QCD alternative is eligible and identity-complete for detector target year ${year}.`,
        )),
      ],
      evidence,
    )
  }

  const selected = targetYears.map((year) => {
    const options = eligibleByYear.get(year)!
    options.sort((left, right) => compareUtf16CodeUnits(
      canonicalAlternativeKey(left.evidence),
      canonicalAlternativeKey(right.evidence),
    ))
    return options[0]!
  })
  const retirementActions = [
    ...schedule.actions,
    ...selected.map((entry) => entry.request),
  ]
  const positions = new Map<string, number>()
  for (const [index, action] of retirementActions.entries()) {
    const group = action.executionDate === undefined
      ? `undated:${action.year}`
      : `dated:${action.executionDate}`
    const key = JSON.stringify([group, action.executionSequence])
    const first = positions.get(key)
    if (first !== undefined) {
      return blocked([localIssue(
        'invalidAlternative',
        `plan.strategies.retirementActions.${index}.executionSequence`,
        `The selected QCD execution slot is already used by action index ${first}; the adapter will not invent a replacement sequence.`,
      )], evidence)
    }
    positions.set(key, index)
  }

  const canonicalAlternativeEvidence = [...evidence].sort((left, right) =>
    compareUtf16CodeUnits(
      canonicalAlternativeKey(left),
      canonicalAlternativeKey(right),
    ),
  )

  const candidate: DecisionCandidate = {
    id: candidateSnapshot.id,
    source: candidateSnapshot.source,
    category: candidateSnapshot.category,
    label: candidateSnapshot.label,
    explanation: candidateSnapshot.explanation,
    planPatch: {
      strategies: {
        qcdAnnual: 0,
        itemizedDeductions: {
          ...planSnapshot.strategies.itemizedDeductions,
          charitable: 0,
        },
        retirementActions,
      },
    },
    retirementActionReadiness: {
      state: 'identityComplete',
      actionRequestIds: retirementActions.map((action) => action.actionId),
    },
    metadata: {
      qcdAllocationPolicy: 'eligibleAlternativeCanonicalIdentityTuple',
      qcdAnnualTargets: expectedTargets,
      qcdSelectedAlternativeIds: selected.map((entry) => entry.alternative.alternativeId),
      qcdAlternatives: canonicalAlternativeEvidence,
    },
  }

  const materialized = applyScenarioPatch(planSnapshot, candidate.planPatch!)
  if (!materialized.ok) {
    return blocked([localIssue(
      'invalidAlternative',
      'planPatch',
      `The selected explicit QCD schedule does not materialize as a valid Plan: ${materialized.issues.join('; ')}`,
    )], evidence)
  }

  return {
    status: 'adapted',
    candidate,
    selectedAlternativeIds: selected.map((entry) => entry.alternative.alternativeId),
    requests: selected.map((entry) => entry.request),
    identityEvidence: selected.map((entry) => entry.identityEvidence),
    allocationEvidence: {
      policy: 'eligibleAlternativeCanonicalIdentityTuple',
      selectedAlternativeIds: selected.map((entry) => entry.alternative.alternativeId),
      alternatives: canonicalAlternativeEvidence,
    },
  }
}
