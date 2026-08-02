import type { PersonId } from './identity.js'
import { asUsdCents, type UsdCents } from './money.js'
import {
  stageAnnualQcdResidualForm8606,
  type AnnualQcdResidualForm8606Staged,
} from './annualQcdResidualForm8606.js'
import type { StageAnnualQcdTaxCharacterPostPassInput } from './annualQcdTaxCharacterPostPass.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'
import { annualCharitableDeductionParameters } from '../tax/annualCharitableDeductionParameters.js'
import type { TaxableWithdrawalTaxUnitEvidence } from './taxableWithdrawalCharacter.js'
export type AnnualQcdSection170RunBinding =
  | { readonly liabilityRunKind: 'committedAnnual' | 'baselineT0'; readonly candidateFundingVectorEvidenceId: null }
  | { readonly liabilityRunKind: 'candidateT1'; readonly candidateFundingVectorEvidenceId: string }
export interface AnnualQcdFloorCarryforwardEligibilityInput {
  readonly actionId: string
  readonly eligible: boolean
  readonly evidenceId: string
}
export interface AnnualQcdItemizedSection170TaxUnitInput {
  readonly taxUnit: Readonly<TaxableWithdrawalTaxUnitEvidence>
  readonly annualTaxLiabilityEvidenceId: string
  readonly taxInputSnapshotId: string
  readonly liabilityRun: Readonly<AnnualQcdSection170RunBinding>
  readonly contributionBaseCents: number
  readonly priorItemizerFloorAppliedCents: number
  readonly priorCashPercentageLimitUsedCents: number
  readonly openingPostOtherLimitItemizedDeductionCents: number
  readonly floorCarryforwardEligibility:
    readonly Readonly<AnnualQcdFloorCarryforwardEligibilityInput>[]
}
export interface StageAnnualQcdItemizedSection170LedgerInput {
  readonly postPassInput: Readonly<StageAnnualQcdTaxCharacterPostPassInput>
  readonly taxUnits: readonly Readonly<AnnualQcdItemizedSection170TaxUnitInput>[]
}
export interface AnnualQcdItemizedSection170StateEvidence {
  readonly floorRemainingCents: UsdCents
  readonly cashPercentageLimitCapacityRemainingCents: UsdCents
  readonly postOtherLimitItemizedDeductionBeforeSection68Cents: UsdCents
}
export interface AnnualQcdItemizedSection170ActionEvidence {
  readonly treatment: 'notApplicable' | 'evaluated'
  readonly actionId: string
  readonly donorPersonId: PersonId
  readonly scheduledDate: string
  readonly scheduledSequence: number
  readonly postPassApplicationEvidenceId: string
  readonly eligibleContributionCents: UsdCents
  readonly floorAppliedCents: UsdCents
  readonly floorCarryforwardCents: UsdCents
  readonly floorPermanentlyDisallowedCents: UsdCents
  readonly postFloorContributionCents: UsdCents
  readonly cashPercentageLimitUsedByActionCents: UsdCents
  readonly percentageLimitCarryforwardCents: UsdCents
  readonly currentYearClaimedDeductionCents: UsdCents
  readonly limitationCarryforwardCents: UsdCents
  readonly unclaimedWithoutCarryforwardCents: UsdCents
  readonly floorCarryforwardEligible: boolean
  readonly floorCarryforwardEligibilityEvidenceId: string
  readonly beforeAction: Readonly<AnnualQcdItemizedSection170StateEvidence>
  readonly afterAction: Readonly<AnnualQcdItemizedSection170StateEvidence>
  readonly actionEvidenceId: string
}
export interface AnnualQcdItemizedSection170TaxUnitEvidence {
  readonly taxUnit: Readonly<TaxableWithdrawalTaxUnitEvidence & { readonly taxYear: 2026 }>
  readonly filingTreatment: 'itemized'
  readonly annualTaxLiabilityEvidenceId: string
  readonly taxInputSnapshotId: string
  readonly liabilityRun: Readonly<AnnualQcdSection170RunBinding>
  readonly contributionBaseCents: UsdCents
  readonly itemizerFloorRateNumerator: 1
  readonly itemizerFloorRateDenominator: 200
  readonly itemizerFloorRate: 0.005
  readonly itemizerFloorQuantization: 'nearestCentHalfUp'
  readonly itemizerFloorAmountCents: UsdCents
  readonly priorItemizerFloorAppliedCents: UsdCents
  readonly cashPercentageLimitRateNumerator: 3
  readonly cashPercentageLimitRateDenominator: 5
  readonly applicablePercentageLimit: 0.6
  readonly cashPercentageLimitQuantization: 'nearestCentHalfUp'
  readonly cashPercentageLimitAmountCents: UsdCents
  readonly priorCashPercentageLimitUsedCents: UsdCents
  readonly exactAmountAuthority: 'cents'
  readonly openingState: Readonly<AnnualQcdItemizedSection170StateEvidence>
  readonly finalState: Readonly<AnnualQcdItemizedSection170StateEvidence>
  readonly orderedActionEvidence: readonly Readonly<AnnualQcdItemizedSection170ActionEvidence>[]
  readonly parameterEvidenceId: string
  readonly residualEvidenceId: string
  readonly evidenceId: string
}
export interface AnnualQcdItemizedSection170Issue {
  readonly kind: 'hostileInput' | 'postPassInvalid' | 'taxUnitInvalid' | 'ledgerInvalid'
  readonly detail: string
}
interface LedgerBase {
  readonly committed: false
  readonly movement: 'notCommitted'
  readonly section68Status: 'awaitingSection68Reconciliation'
}
export interface AnnualQcdItemizedSection170Staged extends LedgerBase {
  readonly status: 'annualQcdItemizedSection170Staged'
  readonly taxYear: 2026
  readonly residualEvidenceId: string
  readonly taxUnits: readonly Readonly<AnnualQcdItemizedSection170TaxUnitEvidence>[]
  readonly issues: readonly []
}
export interface AnnualQcdItemizedSection170Blocked extends LedgerBase {
  readonly status: 'annualQcdItemizedSection170Blocked'
  readonly taxYear: null
  readonly residualEvidenceId: null
  readonly taxUnits: readonly []
  readonly issues: readonly [Readonly<AnnualQcdItemizedSection170Issue>]
}
export type StageAnnualQcdItemizedSection170LedgerResult =
  | AnnualQcdItemizedSection170Staged | AnnualQcdItemizedSection170Blocked
class LedgerError extends Error {
  readonly kind: AnnualQcdItemizedSection170Issue['kind']
  constructor(kind: AnnualQcdItemizedSection170Issue['kind'], detail: string) {
    super(detail); this.kind = kind
  }
}
function fail(kind: AnnualQcdItemizedSection170Issue['kind'], detail: string): never {
  throw new LedgerError(kind, detail)
}
function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}
function id(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail('taxUnitInvalid', `${label} is required.`)
  return value
}
function cents(value: unknown, label: string): UsdCents {
  try { return asUsdCents(value) } catch { return fail('taxUnitInvalid', `${label} must be exact cents.`) }
}
function fromBigInt(value: bigint, label: string): UsdCents {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) fail('ledgerInvalid', `${label} overflowed.`)
  return asUsdCents(Number(value))
}
function add(left: UsdCents, right: UsdCents, label: string): UsdCents {
  return fromBigInt(BigInt(left) + BigInt(right), label)
}
function subtract(left: UsdCents, right: UsdCents, label: string): UsdCents {
  return fromBigInt(BigInt(left) - BigInt(right), label)
}
function halfUp(base: UsdCents, numerator: bigint, denominator: bigint): UsdCents {
  const product = BigInt(base) * numerator
  const quotient = product / denominator
  const remainder = product % denominator
  return fromBigInt(quotient + (2n * remainder >= denominator ? 1n : 0n), 'Exact rate')
}
function state(floor: UsdCents, capacity: UsdCents, itemized: UsdCents): AnnualQcdItemizedSection170StateEvidence {
  return deepFreeze({
    floorRemainingCents: floor,
    cashPercentageLimitCapacityRemainingCents: capacity,
    postOtherLimitItemizedDeductionBeforeSection68Cents: itemized,
  })
}
function run(value: Readonly<AnnualQcdSection170RunBinding>): AnnualQcdSection170RunBinding {
  if (value.liabilityRunKind === 'candidateT1') return {
    liabilityRunKind: 'candidateT1',
    candidateFundingVectorEvidenceId: id(value.candidateFundingVectorEvidenceId, 'Funding vector'),
  }
  if ((value.liabilityRunKind !== 'committedAnnual' && value.liabilityRunKind !== 'baselineT0') ||
      value.candidateFundingVectorEvidenceId !== null) fail('taxUnitInvalid', 'Liability run is inconsistent.')
  return { liabilityRunKind: value.liabilityRunKind, candidateFundingVectorEvidenceId: null }
}
function blocked(error: unknown): AnnualQcdItemizedSection170Blocked {
  const issue = error instanceof LedgerError
    ? { kind: error.kind, detail: error.message }
    : { kind: 'hostileInput' as const, detail: 'Section 170 input must be detached canonical data.' }
  return deepFreeze({
    status: 'annualQcdItemizedSection170Blocked', committed: false, movement: 'notCommitted',
    section68Status: 'awaitingSection68Reconciliation', taxYear: null,
    residualEvidenceId: null, taxUnits: [], issues: [issue],
  })
}
function taxUnit(
  input: Readonly<AnnualQcdItemizedSection170TaxUnitInput>,
  residual: Readonly<AnnualQcdResidualForm8606Staged>,
  requestsByAction: ReadonlyMap<string, StageAnnualQcdTaxCharacterPostPassInput['physicalInput']['prerequisite']['requests'][number]>,
  claimedDonors: Set<PersonId>, claimedActions: Set<string>,
): Readonly<AnnualQcdItemizedSection170TaxUnitEvidence> {
  if (input.taxUnit.taxYear !== 2026 || residual.taxYear !== 2026) fail('taxUnitInvalid', 'Only tax year 2026 is supported.')
  const taxUnitId = id(input.taxUnit.taxUnitId, 'Tax unit ID')
  const membershipId = id(input.taxUnit.taxUnitEvidenceId, 'Membership evidence ID')
  id(input.taxUnit.stateFilingStatusId, 'State filing status ID')
  if (!['single', 'marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold', 'qualifyingSurvivingSpouse'].includes(input.taxUnit.federalFilingStatus)) fail('taxUnitInvalid', 'Federal filing status is unsupported.')
  const rawMembers = [...input.taxUnit.taxUnitMemberPersonIds]
  if (rawMembers.some((personId) => typeof personId !== 'string' || personId.trim().length === 0)) fail('taxUnitInvalid', 'Tax-unit members must be identifiers.')
  const members = rawMembers.sort(compareUtf16CodeUnits)
  if (members.length === 0 || new Set(members).size !== members.length ||
      JSON.stringify(members) !== JSON.stringify(input.taxUnit.taxUnitMemberPersonIds) ||
      members.some((personId) => claimedDonors.has(personId))) fail('taxUnitInvalid', 'Tax-unit membership must be unique.')
  const taxUnit = { taxUnitId, taxUnitMemberPersonIds: members as [PersonId, ...PersonId[]],
    federalFilingStatus: input.taxUnit.federalFilingStatus,
    stateFilingStatusId: input.taxUnit.stateFilingStatusId,
    taxUnitEvidenceId: membershipId, taxYear: 2026 as const }
  members.forEach((personId) => claimedDonors.add(personId))
  const applications = residual.postPass.applications.filter((entry) => members.includes(entry.donorPersonId))
  if (applications.length === 0) fail('taxUnitInvalid', 'Every tax unit must own at least one QCD action.')
  const requests = residual.postPass.applications.map((application) => {
    const request = requestsByAction.get(application.actionId)
    if (request === undefined || request.executionDate === null) fail('postPassInvalid', 'Post-pass action did not resolve to its request.')
    return { application, request }
  }).filter(({ application }) => members.includes(application.donorPersonId))
    .sort((left, right) => compareUtf16CodeUnits(left.request.executionDate!, right.request.executionDate!) ||
      left.request.executionSequence - right.request.executionSequence)
  const eligibility = new Map(input.floorCarryforwardEligibility.map((entry) => [entry.actionId, entry]))
  if (eligibility.size !== input.floorCarryforwardEligibility.length || eligibility.size !== requests.length ||
      requests.some(({ application }) => !eligibility.has(application.actionId))) fail('taxUnitInvalid', 'Floor eligibility must cover the exact tax-unit action set.')
  const parameters = annualCharitableDeductionParameters(2026)
  if (parameters.itemizerContributionFloorRate.numerator !== 1n ||
      parameters.itemizerContributionFloorRate.denominator !== 200n ||
      parameters.cashContributionPercentageLimitRate.numerator !== 3n ||
      parameters.cashContributionPercentageLimitRate.denominator !== 5n ||
      parameters.itemizerContributionFloorQuantization !== 'nearestCentHalfUp') fail('ledgerInvalid', 'Section 170 parameters are inconsistent.')
  const base = cents(input.contributionBaseCents, 'Contribution base')
  const floorAmount = halfUp(base, 1n, 200n)
  const percentageAmount = halfUp(base, 3n, 5n)
  const priorFloor = cents(input.priorItemizerFloorAppliedCents, 'Prior floor use')
  const priorPercentage = cents(input.priorCashPercentageLimitUsedCents, 'Prior cash-limit use')
  if (priorFloor > floorAmount || priorPercentage > percentageAmount) fail('ledgerInvalid', 'Prior Section 170 use exceeds its annual limit.')
  const opening = state(
    subtract(floorAmount, priorFloor, 'Opening floor'),
    subtract(percentageAmount, priorPercentage, 'Opening percentage capacity'),
    cents(input.openingPostOtherLimitItemizedDeductionCents, 'Opening itemized deduction'),
  )
  const liabilityRun = run(input.liabilityRun); const liabilityId = id(input.annualTaxLiabilityEvidenceId, 'Liability evidence ID'); const taxInputId = id(input.taxInputSnapshotId, 'Tax-input snapshot ID')
  let before = opening
  const actionEvidence = requests.map(({ application, request }) => {
    if (claimedActions.has(application.actionId)) fail('taxUnitInvalid', 'QCD actions may belong to only one tax unit.')
    claimedActions.add(application.actionId)
    const carry = eligibility.get(application.actionId)!
    const carryId = id(carry.evidenceId, 'Floor carryforward evidence ID')
    if (typeof carry.eligible !== 'boolean') fail('taxUnitInvalid', 'Floor carryforward eligibility must be Boolean.')
    const eligible = application.charitableDeductionEligibleAmount
    if (BigInt(eligible) !== BigInt(application.taxableQcdAmount) + BigInt(application.nonQcdCharitableRemainder) ||
        BigInt(eligible) !== BigInt(application.charitableDistributionAmount) - BigInt(application.excludableQcdAmount)) fail('postPassInvalid', 'Post-pass charitable amount did not reconcile.')
    const floorApplied = asUsdCents(Math.min(eligible, before.floorRemainingCents))
    const floorCarry = carry.eligible ? floorApplied : asUsdCents(0)
    const permanent = carry.eligible ? asUsdCents(0) : floorApplied
    const postFloor = subtract(eligible, floorApplied, 'Post-floor contribution')
    const claimed = asUsdCents(Math.min(postFloor, before.cashPercentageLimitCapacityRemainingCents))
    const percentageCarry = subtract(postFloor, claimed, 'Percentage carryforward')
    const after = state(
      subtract(before.floorRemainingCents, floorApplied, 'Remaining floor'),
      subtract(before.cashPercentageLimitCapacityRemainingCents, claimed, 'Remaining capacity'),
      add(before.postOtherLimitItemizedDeductionBeforeSection68Cents, claimed, 'Pre-Section 68 itemized deduction'),
    )
    const facts = {
      treatment: eligible === 0 ? 'notApplicable' as const : 'evaluated' as const,
      actionId: application.actionId, donorPersonId: application.donorPersonId,
      scheduledDate: request.executionDate!, scheduledSequence: request.executionSequence,
      postPassApplicationEvidenceId: application.evidenceId, eligibleContributionCents: eligible,
      floorAppliedCents: floorApplied, floorCarryforwardCents: floorCarry,
      floorPermanentlyDisallowedCents: permanent, postFloorContributionCents: postFloor,
      cashPercentageLimitUsedByActionCents: claimed,
      percentageLimitCarryforwardCents: percentageCarry,
      currentYearClaimedDeductionCents: claimed,
      limitationCarryforwardCents: add(floorCarry, percentageCarry, 'Limitation carryforward'),
      unclaimedWithoutCarryforwardCents: permanent, floorCarryforwardEligible: carry.eligible,
      floorCarryforwardEligibilityEvidenceId: carryId, beforeAction: before, afterAction: after,
    }
    const evidence = deepFreeze({ ...facts, actionEvidenceId: deriveActionStructuralId(
      'annual-qcd-itemized-section170-action', [taxUnit, liabilityId,
        taxInputId, liabilityRun, parameters.evidenceId,
        residual.evidenceId, facts],
    ) })
    before = after
    return evidence
  })
  const withoutId = {
    taxUnit, filingTreatment: 'itemized' as const,
    annualTaxLiabilityEvidenceId: liabilityId,
    taxInputSnapshotId: taxInputId, liabilityRun,
    contributionBaseCents: base, itemizerFloorRateNumerator: 1 as const,
    itemizerFloorRateDenominator: 200 as const, itemizerFloorRate: 0.005 as const,
    itemizerFloorQuantization: 'nearestCentHalfUp' as const,
    itemizerFloorAmountCents: floorAmount, priorItemizerFloorAppliedCents: priorFloor,
    cashPercentageLimitRateNumerator: 3 as const, cashPercentageLimitRateDenominator: 5 as const,
    applicablePercentageLimit: 0.6 as const,
    cashPercentageLimitQuantization: 'nearestCentHalfUp' as const,
    cashPercentageLimitAmountCents: percentageAmount,
    priorCashPercentageLimitUsedCents: priorPercentage, exactAmountAuthority: 'cents' as const,
    openingState: opening, finalState: before, orderedActionEvidence: actionEvidence,
    parameterEvidenceId: parameters.evidenceId, residualEvidenceId: residual.evidenceId,
  }
  return deepFreeze({ ...withoutId, evidenceId: deriveActionStructuralId(
    'annual-qcd-itemized-section170-tax-unit', [withoutId],
  ) })
}
function stageUnchecked(input: StageAnnualQcdItemizedSection170LedgerInput): AnnualQcdItemizedSection170Staged {
  const residual = stageAnnualQcdResidualForm8606({ postPassInput: input.postPassInput })
  if (residual.status !== 'annualQcdResidualForm8606Staged') fail('postPassInvalid', 'QCD residual/post-pass rebuilding failed.')
  const requests = new Map(input.postPassInput.physicalInput.prerequisite.requests.map((entry) => [entry.actionId, entry]))
  for (const application of residual.postPass.applications.filter((entry) => entry.nonQcdCharitableRemainder > 0)) {
    const bindings = residual.pools.flatMap((pool) => pool.qcdRemainderBindings).filter((entry) => entry.postPassApplicationEvidenceId === application.evidenceId)
    if (bindings.length !== 1 || bindings[0]!.allocation.actionId !== application.actionId ||
        bindings[0]!.allocation.allocationId !== application.allocationId ||
        bindings[0]!.allocation.sourceAccountId !== application.sourceAccountId ||
        bindings[0]!.allocation.grossAmount !== application.nonQcdCharitableRemainder ||
        bindings[0]!.allocation.allocatedBasisAmount !== application.nonQcdCharitableRemainder ||
        bindings[0]!.allocation.taxableAmount !== 0) fail('postPassInvalid', 'Residual QCD remainder binding is incomplete.')
  }
  const claimedDonors = new Set<PersonId>(); const claimedActions = new Set<string>()
  const taxUnits = [...input.taxUnits].sort((left, right) => compareUtf16CodeUnits(left.taxUnit.taxUnitId, right.taxUnit.taxUnitId))
  if (new Set(taxUnits.map((entry) => entry.taxUnit.taxUnitId)).size !== taxUnits.length ||
      new Set(taxUnits.map((entry) => entry.taxUnit.taxUnitEvidenceId)).size !== taxUnits.length) fail('taxUnitInvalid', 'Tax-unit evidence must be unique.')
  const evidence = taxUnits.map((entry) => taxUnit(entry, residual, requests, claimedDonors, claimedActions))
  if (claimedActions.size !== residual.postPass.applications.length) fail('taxUnitInvalid', 'Tax units must cover every QCD action exactly once.')
  return deepFreeze({
    status: 'annualQcdItemizedSection170Staged', committed: false, movement: 'notCommitted',
    section68Status: 'awaitingSection68Reconciliation', taxYear: 2026,
    residualEvidenceId: residual.evidenceId, taxUnits: evidence, issues: [],
  })
}
export function stageAnnualQcdItemizedSection170Ledger(
  input: Readonly<StageAnnualQcdItemizedSection170LedgerInput>,
): Readonly<StageAnnualQcdItemizedSection170LedgerResult> {
  try { return stageUnchecked(structuredClone(input) as StageAnnualQcdItemizedSection170LedgerInput) }
  catch (error) { return blocked(error) }
}
