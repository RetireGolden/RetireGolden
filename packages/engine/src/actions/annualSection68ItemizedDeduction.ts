import {
  annualCharitableDeductionParameters,
  type CharitableDeductionFilingStatus,
} from '../tax/annualCharitableDeductionParameters.js'
import { parseCivilIsoDate } from './civilDate.js'
import type { AnnualLiabilityRunBinding } from './annualLiabilityRunIdentity.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'
import { deepFreeze } from './freeze.js'
/**
 * The canonical liability-run binding, under the name this module publishes.
 *
 * Three modules declared this union independently and a fourth was about to.
 * The shape is unchanged — the alias is the same type, so every record already
 * serialised under it round-trips byte for byte — and the declaration now lives
 * beside the minter that produces the identities it binds.
 */
export type AnnualSection68LiabilityRunBinding = AnnualLiabilityRunBinding
export interface AnnualSection68ItemizedActionInput {
  readonly actionKind: 'qcd'
  readonly actionId: string
  readonly scheduledDate: string
  readonly scheduledSequence: number
  readonly itemizedDeductionIncreaseCents: number
}
export interface BuildAnnualSection68ItemizedDeductionEvidenceInput {
  readonly taxUnitId: string
  readonly taxYear: number
  readonly annualTaxLiabilityEvidenceId: string
  readonly taxInputSnapshotId: string
  readonly liabilityRun: Readonly<AnnualSection68LiabilityRunBinding>
  readonly filingStatus: CharitableDeductionFilingStatus
  readonly adjustedGrossIncomeBeforeItemizedDeductionCents: number
  readonly qualifiedBusinessIncomeDeductionCents: number
  readonly qualifiedBusinessIncomeComputedWithoutSection68: true
  readonly additionalSchedule1ADeductionCents: number
  readonly nonActionItemizedDeductionCents: number
  readonly actions: readonly Readonly<AnnualSection68ItemizedActionInput>[]
}
export interface Section68ItemizedDeductionStateEvidence {
  readonly totalItemizedDeductionsBeforeOverallLimit: number
  readonly totalItemizedDeductionsBeforeOverallLimitCents: number
  readonly limitationBaseAmount: number
  readonly limitationBaseCents: number
  readonly limitationFloorQuotientCents: number
  readonly limitationRemainderNumerator: number
  readonly limitationRoundedUpOneCent: boolean
  readonly overallLimitationAmount: number
  readonly overallLimitationCents: number
  readonly allowedItemizedDeductionAmount: number
  readonly allowedItemizedDeductionCents: number
}
export interface Section68ItemizedActionAttributionEvidence {
  readonly actionKind: 'qcd'
  readonly actionId: string
  readonly scheduledDate: string
  readonly scheduledSequence: number
  readonly itemizedDeductionIncreaseAmount: number
  readonly itemizedDeductionIncreaseCents: number
  readonly allowedItemizedDeductionDeltaAmount: number
  readonly allowedItemizedDeductionDeltaCents: number
  readonly beforeAction: Readonly<Section68ItemizedDeductionStateEvidence>
  readonly afterAction: Readonly<Section68ItemizedDeductionStateEvidence>
  readonly actionAttributionEvidenceId: string
}
export type Section68ThresholdBinding =
  | { readonly filingStatus: 'marriedFilingJointly' | 'qualifyingSurvivingSpouse'; readonly thresholdAmount: 768700; readonly thresholdCents: 76870000 }
  | { readonly filingStatus: 'headOfHousehold' | 'single'; readonly thresholdAmount: 640600; readonly thresholdCents: 64060000 }
  | { readonly filingStatus: 'marriedFilingSeparately'; readonly thresholdAmount: 384350; readonly thresholdCents: 38435000 }
export type AnnualSection68ItemizedDeductionEvidence = AnnualSection68LiabilityRunBinding & Section68ThresholdBinding & {
  readonly taxUnitId: string
  readonly taxYear: 2026
  readonly annualTaxLiabilityEvidenceId: string
  readonly taxInputSnapshotId: string
  readonly adjustedGrossIncomeBeforeItemizedDeduction: number
  readonly adjustedGrossIncomeBeforeItemizedDeductionCents: number
  readonly qualifiedBusinessIncomeDeductionAmount: number
  readonly qualifiedBusinessIncomeDeductionCents: number
  readonly qualifiedBusinessIncomeComputedWithoutSection68: true
  readonly additionalSchedule1ADeductionAmount: number
  readonly additionalSchedule1ADeductionCents: number
  readonly taxableIncomeForOverallLimitation: number
  readonly taxableIncomeForOverallLimitationCents: number
  readonly thresholdExcessAmount: number
  readonly thresholdExcessCents: number
  readonly limitationRateNumerator: 2
  readonly limitationRateDenominator: 37
  readonly intermediateArithmetic: 'bigintRational'
  readonly limitationQuantization: 'nearestCentHalfUp'
  readonly initialState: Readonly<Section68ItemizedDeductionStateEvidence>
  readonly finalState: Readonly<Section68ItemizedDeductionStateEvidence>
  readonly orderedActionAttributions: readonly Readonly<Section68ItemizedActionAttributionEvidence>[]
  readonly thresholdSourceId: string
  readonly section68EvidenceId: string
}
export type AnnualSection68ItemizedDeductionIssueKind =
  | 'invalidInput'
  | 'unsupportedTaxYear'
  | 'duplicateActionId'
  | 'duplicateSchedulePosition'
  | 'arithmeticOverflow'
export interface AnnualSection68ItemizedDeductionIssue {
  readonly kind: AnnualSection68ItemizedDeductionIssueKind
  readonly path: string
  readonly message: string
}
export type BuildAnnualSection68ItemizedDeductionEvidenceResult =
  | {
      readonly status: 'built'
      readonly evidence: Readonly<AnnualSection68ItemizedDeductionEvidence>
    }
  | {
      readonly status: 'blocked'
      readonly issues: readonly [Readonly<AnnualSection68ItemizedDeductionIssue>]
    }
interface ValidatedInput {
  taxUnitId: string
  annualTaxLiabilityEvidenceId: string
  taxInputSnapshotId: string
  liabilityRun: AnnualSection68LiabilityRunBinding
  filingStatus: CharitableDeductionFilingStatus
  agi: number
  qbi: number
  schedule1A: number
  initialItemized: number
  actions: AnnualSection68ItemizedActionInput[]
}
class Section68InputError extends Error {
  readonly kind: AnnualSection68ItemizedDeductionIssueKind
  readonly path: string
  constructor(
    kind: AnnualSection68ItemizedDeductionIssueKind,
    path: string,
    message: string,
  ) {
    super(message)
    this.kind = kind
    this.path = path
  }
}
/** Returns `value` when it is a nonblank string, and throws this module's
 * typed Section68InputError otherwise. Distinct from the shared `nonblank`
 * predicate, which is a boolean type guard and never throws, and from
 * `requireNonblankId`, which throws a plain `TypeError`. Named for this
 * module rather than `requireNonblankField`, because
 * `annualQcdPhysicalExecution.ts` and `describeRefusal.ts` each have their
 * own nonblank-field helper with its own throw contract; a shared name across
 * three incompatible signatures is the same drift the shared-guard lint rule
 * exists to prevent, one level down. */
function requireNonblankSection68Field(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Section68InputError('invalidInput', path, `${path} must be a nonblank identifier`)
  }
  return value
}
function safeCents(value: unknown, path: string, signed = false): number {
  if (
    typeof value !== 'number' || !Number.isSafeInteger(value) || Object.is(value, -0) ||
    (!signed && value < 0)
  ) {
    throw new Section68InputError(
      'invalidInput', path, `${path} must be ${signed ? 'a signed' : 'a nonnegative'} safe cent integer`,
    )
  }
  return value
}
function safeNumber(value: bigint, path: string): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Section68InputError('arithmeticOverflow', path, `${path} exceeded safe-integer bounds`)
  }
  return Number(value)
}

const dollars = (cents: number): number => cents / 100
function state(totalCents: number, thresholdExcessCents: number): Section68ItemizedDeductionStateEvidence {
  const baseCents = Math.min(totalCents, thresholdExcessCents)
  const numerator = 2n * BigInt(baseCents)
  const floor = numerator / 37n
  const remainder = numerator % 37n
  const roundedUp = 2n * remainder >= 37n
  const limitation = floor + (roundedUp ? 1n : 0n)
  const allowed = BigInt(totalCents) - limitation
  const floorCents = safeNumber(floor, 'limitationFloorQuotientCents')
  const remainderNumerator = safeNumber(remainder, 'limitationRemainderNumerator')
  const limitationCents = safeNumber(limitation, 'overallLimitationCents')
  const allowedCents = safeNumber(allowed, 'allowedItemizedDeductionCents')
  return deepFreeze({
    totalItemizedDeductionsBeforeOverallLimit: dollars(totalCents),
    totalItemizedDeductionsBeforeOverallLimitCents: totalCents,
    limitationBaseAmount: dollars(baseCents), limitationBaseCents: baseCents,
    limitationFloorQuotientCents: floorCents,
    limitationRemainderNumerator: remainderNumerator,
    limitationRoundedUpOneCent: roundedUp,
    overallLimitationAmount: dollars(limitationCents), overallLimitationCents: limitationCents,
    allowedItemizedDeductionAmount: dollars(allowedCents),
    allowedItemizedDeductionCents: allowedCents,
  })
}

function validate(input: Readonly<BuildAnnualSection68ItemizedDeductionEvidenceInput>): ValidatedInput {
  if (input.taxYear !== 2026) {
    throw new Section68InputError('unsupportedTaxYear', 'taxYear', 'Section 68 parameters are unavailable')
  }
  const statuses: readonly string[] = [
    'single', 'headOfHousehold', 'marriedFilingJointly',
    'marriedFilingSeparately', 'qualifyingSurvivingSpouse',
  ]
  if (!statuses.includes(input.filingStatus)) {
    throw new Section68InputError('invalidInput', 'filingStatus', 'filingStatus is unsupported')
  }
  if (input.qualifiedBusinessIncomeComputedWithoutSection68 !== true) {
    throw new Section68InputError(
      'invalidInput', 'qualifiedBusinessIncomeComputedWithoutSection68',
      'QBI must be computed without regard to Section 68',
    )
  }
  const run = input.liabilityRun
  if (run === null || typeof run !== 'object') {
    throw new Section68InputError('invalidInput', 'liabilityRun', 'liabilityRun is required')
  }
  if (run.liabilityRunKind === 'candidateT1') {
    requireNonblankSection68Field(run.candidateFundingVectorEvidenceId, 'candidateFundingVectorEvidenceId')
  } else if (
    (run.liabilityRunKind !== 'committedAnnual' && run.liabilityRunKind !== 'baselineT0') ||
    run.candidateFundingVectorEvidenceId !== null
  ) {
    throw new Section68InputError('invalidInput', 'liabilityRun', 'liabilityRun binding is inconsistent')
  }
  if (!Array.isArray(input.actions)) {
    throw new Section68InputError('invalidInput', 'actions', 'actions must be an array')
  }
  const actionIds = new Set<string>()
  const positions = new Set<string>()
  const actions = input.actions.map((action, index) => {
    const path = `actions[${index}]`
    if (action.actionKind !== 'qcd') {
      throw new Section68InputError('invalidInput', `${path}.actionKind`, 'Only QCD actions are supported')
    }
    const actionId = requireNonblankSection68Field(action.actionId, `${path}.actionId`)
    if (actionIds.has(actionId)) {
      throw new Section68InputError('duplicateActionId', `${path}.actionId`, 'actionId must be unique')
    }
    actionIds.add(actionId)
    const date = typeof action.scheduledDate === 'string'
      ? parseCivilIsoDate(action.scheduledDate) : null
    if (date === null || date.year !== 2026) {
      throw new Section68InputError('invalidInput', `${path}.scheduledDate`, 'scheduledDate must be canonical')
    }
    if (!Number.isSafeInteger(action.scheduledSequence) || action.scheduledSequence <= 0) {
      throw new Section68InputError('invalidInput', `${path}.scheduledSequence`, 'sequence must be positive')
    }
    const position = `${action.scheduledDate}:${action.scheduledSequence}`
    if (positions.has(position)) {
      throw new Section68InputError('duplicateSchedulePosition', path, 'schedule position must be unique')
    }
    positions.add(position)
    return {
      actionKind: 'qcd' as const, actionId, scheduledDate: action.scheduledDate,
      scheduledSequence: action.scheduledSequence,
      itemizedDeductionIncreaseCents: safeCents(
        action.itemizedDeductionIncreaseCents, `${path}.itemizedDeductionIncreaseCents`,
      ),
    }
  })
  actions.sort((left, right) =>
    compareUtf16CodeUnits(left.scheduledDate, right.scheduledDate) ||
    left.scheduledSequence - right.scheduledSequence ||
    compareUtf16CodeUnits(left.actionId, right.actionId))
  return {
    taxUnitId: requireNonblankSection68Field(input.taxUnitId, 'taxUnitId'),
    annualTaxLiabilityEvidenceId: requireNonblankSection68Field(
      input.annualTaxLiabilityEvidenceId, 'annualTaxLiabilityEvidenceId',
    ),
    taxInputSnapshotId: requireNonblankSection68Field(input.taxInputSnapshotId, 'taxInputSnapshotId'),
    liabilityRun: run.liabilityRunKind === 'candidateT1'
      ? { liabilityRunKind: 'candidateT1', candidateFundingVectorEvidenceId: requireNonblankSection68Field(run.candidateFundingVectorEvidenceId, 'candidateFundingVectorEvidenceId') }
      : { liabilityRunKind: run.liabilityRunKind, candidateFundingVectorEvidenceId: null }, filingStatus: input.filingStatus,
    agi: safeCents(input.adjustedGrossIncomeBeforeItemizedDeductionCents, 'adjustedGrossIncomeBeforeItemizedDeductionCents', true),
    qbi: safeCents(input.qualifiedBusinessIncomeDeductionCents, 'qualifiedBusinessIncomeDeductionCents'),
    schedule1A: safeCents(input.additionalSchedule1ADeductionCents, 'additionalSchedule1ADeductionCents'),
    initialItemized: safeCents(input.nonActionItemizedDeductionCents, 'nonActionItemizedDeductionCents'),
    actions,
  }
}

export function buildAnnualSection68ItemizedDeductionEvidence(
  input: Readonly<BuildAnnualSection68ItemizedDeductionEvidenceInput>,
): Readonly<BuildAnnualSection68ItemizedDeductionEvidenceResult> {
  try {
    const valid = validate(structuredClone(input))
    const parameters = annualCharitableDeductionParameters(2026)
    const thresholdCents = parameters.section68ThresholdByFilingStatusCents[valid.filingStatus]
    const expectedThreshold = valid.filingStatus === 'marriedFilingSeparately' ? 38_435_000 : valid.filingStatus === 'marriedFilingJointly' || valid.filingStatus === 'qualifyingSurvivingSpouse' ? 76_870_000 : 64_060_000
    if (thresholdCents !== expectedThreshold || parameters.section68LimitationRate.numerator !== 2n || parameters.section68LimitationRate.denominator !== 37n || parameters.section68IntermediateArithmetic !== 'bigintRational' || parameters.section68Quantization !== 'nearestCentHalfUp') throw new Section68InputError('invalidInput', 'parameters', 'Section 68 parameters are inconsistent')
    const taxableBig = BigInt(valid.agi) - BigInt(valid.qbi) - BigInt(valid.schedule1A)
    const taxableCents = taxableBig > 0n ? safeNumber(taxableBig, 'taxableIncomeForOverallLimitationCents') : 0
    const thresholdExcessCents = Math.max(0, taxableCents - thresholdCents)
    const thresholdSourceId = deriveActionStructuralId('annual-section68-threshold-source', [
      parameters.evidenceId, valid.filingStatus, thresholdCents,
    ])
    const thresholdBinding = { filingStatus: valid.filingStatus, thresholdAmount: dollars(thresholdCents), thresholdCents } as Section68ThresholdBinding
    const initialState = state(valid.initialItemized, thresholdExcessCents)
    let before = initialState
    const attributions = valid.actions.map((action) => {
      const total = safeNumber(
        BigInt(before.totalItemizedDeductionsBeforeOverallLimitCents) +
          BigInt(action.itemizedDeductionIncreaseCents),
        'totalItemizedDeductionsBeforeOverallLimitCents',
      )
      const after = state(total, thresholdExcessCents)
      const delta = after.allowedItemizedDeductionCents - before.allowedItemizedDeductionCents
      const facts = { ...action, beforeAction: before, afterAction: after,
        itemizedDeductionIncreaseAmount: dollars(action.itemizedDeductionIncreaseCents),
        allowedItemizedDeductionDeltaAmount: dollars(delta), allowedItemizedDeductionDeltaCents: delta }
      const attribution = deepFreeze({ ...facts, actionAttributionEvidenceId: deriveActionStructuralId(
        'annual-section68-itemized-action-attribution', [valid.taxUnitId, 2026,
          valid.annualTaxLiabilityEvidenceId, valid.taxInputSnapshotId, valid.liabilityRun,
          parameters.evidenceId, facts],
      ) })
      before = after
      return attribution
    })
    const marginalTotal = attributions.reduce((sum, item) => sum + item.allowedItemizedDeductionDeltaCents, 0)
    if (marginalTotal !== before.allowedItemizedDeductionCents - initialState.allowedItemizedDeductionCents) throw new Section68InputError('invalidInput', 'orderedActionAttributions', 'action deltas do not reconcile')
    const withoutId = {
      taxUnitId: valid.taxUnitId, taxYear: 2026 as const,
      annualTaxLiabilityEvidenceId: valid.annualTaxLiabilityEvidenceId,
      taxInputSnapshotId: valid.taxInputSnapshotId,
      ...valid.liabilityRun, ...thresholdBinding,
      adjustedGrossIncomeBeforeItemizedDeduction: dollars(valid.agi),
      adjustedGrossIncomeBeforeItemizedDeductionCents: valid.agi,
      qualifiedBusinessIncomeDeductionAmount: dollars(valid.qbi),
      qualifiedBusinessIncomeDeductionCents: valid.qbi,
      qualifiedBusinessIncomeComputedWithoutSection68: true as const,
      additionalSchedule1ADeductionAmount: dollars(valid.schedule1A),
      additionalSchedule1ADeductionCents: valid.schedule1A,
      taxableIncomeForOverallLimitation: dollars(taxableCents),
      taxableIncomeForOverallLimitationCents: taxableCents,
      thresholdExcessAmount: dollars(thresholdExcessCents), thresholdExcessCents,
      limitationRateNumerator: 2 as const, limitationRateDenominator: 37 as const,
      intermediateArithmetic: parameters.section68IntermediateArithmetic,
      limitationQuantization: parameters.section68Quantization,
      initialState, finalState: before, orderedActionAttributions: attributions,
      thresholdSourceId,
    }
    return deepFreeze({ status: 'built', evidence: { ...withoutId,
      section68EvidenceId: deriveActionStructuralId('annual-section68-itemized-deduction', [withoutId]),
    } })
  } catch (error) {
    const issue = error instanceof Section68InputError
      ? { kind: error.kind, path: error.path, message: error.message }
      : { kind: 'invalidInput' as const, path: 'input', message: 'Section 68 input could not be validated' }
    return deepFreeze({ status: 'blocked', issues: [issue] })
  }
}
