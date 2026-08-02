import {
  coordinateAnnualQcdDeductionTreatment,
  type AnnualQcdDeductionTreatmentActionEvidence,
  type CoordinateAnnualQcdDeductionTreatmentInput,
} from './annualQcdDeductionTreatmentCoordinator.js'
import type { AnnualQcdExecutionPrerequisiteEvidence } from './annualQcdExecutionPrerequisite.js'
import { stageAnnualQcdPhysicalExecution, type AnnualQcdPhysicalApplication } from './annualQcdPhysicalExecution.js'
import { stageAnnualQcdResidualForm8606, type AnnualQcdResidualRemainderBinding } from './annualQcdResidualForm8606.js'
import type { AnnualQcdPostPassApplication } from './annualQcdTaxCharacterPostPass.js'
import type { AccountId, ActionId, AllocationId, PersonId } from './identity.js'
import type { UsdCents } from './money.js'
import { deriveActionStructuralId } from './structuralId.js'

export type QcdFinalDerivedTaxCharacter = {
  readonly sourceClass: 'qcd'
  readonly sourceAccountId: AccountId
  readonly amountCents: UsdCents
  readonly exactAmountAuthority: 'cents'
  readonly characterEvidence: Readonly<{
    readonly rule: 'qcdAnnualPostPass'
    readonly qcdActionId: ActionId
    readonly allocationId: AllocationId
    readonly acceptedSourcePrerequisiteEvidenceId: string
    readonly physicalStagingEvidenceId: string
    readonly postPassApplicationEvidenceId: string
    readonly residualRemainderBindingEvidenceId: string | null
    readonly deductionTreatmentEvidenceId: string
    readonly segmentAmountCents: UsdCents
    readonly evidenceId: string
  }>
} & (
  | { readonly kind: 'qcdIncomeExclusion'; readonly characterEvidence: { readonly component: 'excludableQcdAmount' } }
  | { readonly kind: 'ordinaryIncome'; readonly characterEvidence: { readonly component: 'taxableQcdAmount' } }
  | { readonly kind: 'basisReturn'; readonly characterEvidence: { readonly component: 'nonQcdCharitableRemainder' } }
)
export type AcceptedQcdSourceEligibilityEvidence =
  | { readonly sourceIraAccountId: AccountId; readonly donorPersonId: PersonId; readonly ownershipKind: 'owned'; readonly iraSubtype: 'traditional'; readonly sepSimpleActivity: { readonly applicability: 'notApplicable' } }
  | { readonly sourceIraAccountId: AccountId; readonly donorPersonId: PersonId; readonly ownershipKind: 'owned'; readonly iraSubtype: 'sep' | 'simple'; readonly sepSimpleActivity: { readonly applicability: 'evaluated'; readonly taxYear: 2026; readonly planYearEndDate: string; readonly employerContributionMadeForPlanYear: false; readonly evidenceId: string } }
export interface AnnualQcdFinalDerivedTaxCharacterActionEvidence {
  readonly actionId: ActionId
  readonly donorPersonId: PersonId
  readonly allocationId: AllocationId
  readonly sourceAccountId: AccountId
  readonly status: 'final' | 'notApplicableZeroMovement'
  readonly acceptedSourceEligibility: Readonly<AcceptedQcdSourceEligibilityEvidence>
  readonly prerequisiteEvidence: Readonly<AnnualQcdExecutionPrerequisiteEvidence>
  readonly physicalApplication: Readonly<AnnualQcdPhysicalApplication>
  readonly postPassApplication: Readonly<AnnualQcdPostPassApplication>
  readonly residualRemainderBinding: Readonly<AnnualQcdResidualRemainderBinding> | null
  readonly deductionTreatmentEvidence: Readonly<AnnualQcdDeductionTreatmentActionEvidence>
  readonly derivedTaxCharacter: readonly Readonly<QcdFinalDerivedTaxCharacter>[]
  readonly evidenceId: string
}
export interface AnnualQcdDerivedTaxCharacterIssue {
  readonly kind: 'hostileInput' | 'physicalInvalid' | 'residualInvalid' | 'deductionInvalid' | 'sourceInvalid' | 'characterInvalid'
  readonly detail: string
}
interface ResultBase { readonly committed: false; readonly movement: 'notCommitted'; readonly publicationStatus: 'notOwnedByDerivedTaxCharacter' }
export interface AnnualQcdDerivedTaxCharacterFinal extends ResultBase {
  readonly status: 'annualQcdDerivedTaxCharacterFinal'; readonly taxYear: 2026
  readonly residualEvidenceId: string; readonly deductionTreatmentEvidenceId: string
  readonly actions: readonly Readonly<AnnualQcdFinalDerivedTaxCharacterActionEvidence>[]
  readonly exactAmountAuthority: 'cents'; readonly evidenceId: string; readonly issues: readonly []
}
export interface AnnualQcdDerivedTaxCharacterBlocked extends ResultBase {
  readonly status: 'annualQcdDerivedTaxCharacterBlocked'; readonly taxYear: null
  readonly residualEvidenceId: null; readonly deductionTreatmentEvidenceId: null; readonly actions: readonly []
  readonly exactAmountAuthority: 'cents'; readonly evidenceId: null
  readonly issues: readonly [Readonly<AnnualQcdDerivedTaxCharacterIssue>]
}
export type FinalizeAnnualQcdDerivedTaxCharacterResult = AnnualQcdDerivedTaxCharacterFinal | AnnualQcdDerivedTaxCharacterBlocked
class CharacterError extends Error {
  readonly kind: AnnualQcdDerivedTaxCharacterIssue['kind']
  constructor(kind: AnnualQcdDerivedTaxCharacterIssue['kind'], detail: string) { super(detail); this.kind = kind }
}
function fail(kind: AnnualQcdDerivedTaxCharacterIssue['kind'], detail: string): never { throw new CharacterError(kind, detail) }
function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}
function blocked(error: unknown): AnnualQcdDerivedTaxCharacterBlocked {
  const issue = error instanceof CharacterError ? { kind: error.kind, detail: error.message }
    : { kind: 'hostileInput' as const, detail: 'QCD tax-character inputs must be detached canonical data.' }
  return deepFreeze({ status: 'annualQcdDerivedTaxCharacterBlocked', committed: false, movement: 'notCommitted',
    publicationStatus: 'notOwnedByDerivedTaxCharacter', taxYear: null, residualEvidenceId: null,
    deductionTreatmentEvidenceId: null, actions: [], exactAmountAuthority: 'cents', evidenceId: null, issues: [issue] })
}
function segment(kind: QcdFinalDerivedTaxCharacter['kind'], amountCents: UsdCents, postPass: Readonly<AnnualQcdPostPassApplication>, prerequisiteId: string, deductionId: string, remainder: Readonly<AnnualQcdResidualRemainderBinding> | null): Readonly<QcdFinalDerivedTaxCharacter> {
  const component = kind === 'qcdIncomeExclusion' ? 'excludableQcdAmount' as const
    : kind === 'ordinaryIncome' ? 'taxableQcdAmount' as const : 'nonQcdCharitableRemainder' as const
  const base = { rule: 'qcdAnnualPostPass' as const, component, qcdActionId: postPass.actionId,
    allocationId: postPass.allocationId, acceptedSourcePrerequisiteEvidenceId: prerequisiteId,
    physicalStagingEvidenceId: postPass.physicalStagingEvidenceId,
    postPassApplicationEvidenceId: postPass.evidenceId,
    residualRemainderBindingEvidenceId: remainder?.bindingEvidenceId ?? null,
    deductionTreatmentEvidenceId: deductionId, segmentAmountCents: amountCents }
  const characterEvidence = deepFreeze({ ...base, evidenceId: deriveActionStructuralId('annual-qcd-derived-character-segment', [kind, postPass.sourceAccountId, base]) })
  return deepFreeze({ sourceClass: 'qcd', kind, sourceAccountId: postPass.sourceAccountId,
    amountCents, exactAmountAuthority: 'cents', characterEvidence }) as Readonly<QcdFinalDerivedTaxCharacter>
}
type QcdIraEligibilityFact = Readonly<AnnualQcdExecutionPrerequisiteEvidence>['eligibility']['source']['iraEligibilityFact']
// An ongoing or unproven SEP/SIMPLE plan is a *source* refusal in the frozen
// registry (`qcd-ongoing-sep-simple`, `qcd-sep-simple-activity-unknown`), not a
// physical trim. Shared with `finalize` so the source diagnosis survives even
// when the upstream prerequisite rejects the action before physical staging.
function sepSimpleActivityAccepted(fact: QcdIraEligibilityFact): boolean {
  return fact?.subtype === 'traditional' ? fact.qcdActivity.kind === 'notApplicable'
    : fact?.qcdActivity?.kind === 'employerContribution' && fact.qcdActivity.actionTaxYear === 2026 &&
      fact.qcdActivity.planYearEndDate.trim().length > 0 && fact.qcdActivity.evidenceId.trim().length > 0 &&
      fact.qcdActivity.employerContributionMadeForPlanYear === false
}
function acceptedSource(prerequisite: Readonly<AnnualQcdExecutionPrerequisiteEvidence>, postPass: Readonly<AnnualQcdPostPassApplication>): Readonly<AcceptedQcdSourceEligibilityEvidence> {
  const source = prerequisite.eligibility.source; const fact = source.iraEligibilityFact
  const request = prerequisite.request
  const exactRequest = prerequisite.actionId === postPass.actionId && request.actionId === postPass.actionId &&
    request.donorPersonId === postPass.donorPersonId && request.allocation.allocationId === postPass.allocationId &&
    request.allocation.sourceAccountId === postPass.sourceAccountId
  const exactOwnedTraditionalIra = prerequisite.eligibility.decision.status === 'accepted' && source.resolution === 'resolved' &&
    source.allocationId === postPass.allocationId && source.sourceAccountId === postPass.sourceAccountId &&
    source.ownerPersonId === postPass.donorPersonId && source.accountType === 'traditional' &&
    source.retirementAccountKind === 'ira' && source.inheritance === 'owned' && fact?.sourceAccountId === postPass.sourceAccountId
  const activityAccepted = sepSimpleActivityAccepted(fact)
  if (!exactRequest || !exactOwnedTraditionalIra || !activityAccepted) fail('sourceInvalid', 'QCD character source/action evidence is not an accepted owned traditional IRA source.')
  if (fact === null) fail('sourceInvalid', 'QCD accepted source requires exact IRA classification evidence.')
  if (fact.subtype === 'traditional') return deepFreeze({ sourceIraAccountId: postPass.sourceAccountId, donorPersonId: postPass.donorPersonId,
    ownershipKind: 'owned', iraSubtype: 'traditional', sepSimpleActivity: { applicability: 'notApplicable' } })
  return deepFreeze({ sourceIraAccountId: postPass.sourceAccountId, donorPersonId: postPass.donorPersonId, ownershipKind: 'owned', iraSubtype: fact.subtype,
    sepSimpleActivity: { applicability: 'evaluated', taxYear: 2026, planYearEndDate: fact.qcdActivity!.planYearEndDate,
      employerContributionMadeForPlanYear: false, evidenceId: fact.qcdActivity!.evidenceId } })
}
function finalize(input: CoordinateAnnualQcdDeductionTreatmentInput): AnnualQcdDerivedTaxCharacterFinal {
  const physical = stageAnnualQcdPhysicalExecution(input.postPassInput.physicalInput)
  if (physical.status !== 'annualQcdPhysicalExecutionStaged' || physical.taxYear !== 2026) {
    // The prerequisite rejects an ineligible SEP/SIMPLE source before physical
    // staging can succeed. Diagnose that as the source refusal the registry
    // names rather than reporting a generic physical failure.
    if (input.postPassInput.physicalInput.prerequisite.evidence.some((entry) => !sepSimpleActivityAccepted(entry.eligibility.source.iraEligibilityFact))) {
      fail('sourceInvalid', 'QCD character source/action evidence is not an accepted owned traditional IRA source.')
    }
    fail('physicalInvalid', 'Canonical 2026 QCD physical rebuilding failed.')
  }
  const residual = stageAnnualQcdResidualForm8606({ postPassInput: input.postPassInput })
  if (residual.status !== 'annualQcdResidualForm8606Staged' || residual.taxYear !== 2026) fail('residualInvalid', 'Canonical 2026 QCD residual rebuilding failed.')
  const deduction = coordinateAnnualQcdDeductionTreatment(input)
  if (deduction.status !== 'annualQcdDeductionTreatmentCoordinated' || deduction.residualEvidenceId !== residual.evidenceId) fail('deductionInvalid', 'Final QCD deduction rebuilding failed.')
  const prerequisites = new Map(input.postPassInput.physicalInput.prerequisite.evidence.map((entry) => [entry.actionId, entry]))
  const physicalById = new Map(physical.applications.map((entry) => [entry.request.actionId, entry]))
  const deductionById = new Map(deduction.orderedActionEvidence.map((entry) => [entry.actionId, entry]))
  if (prerequisites.size !== input.postPassInput.physicalInput.prerequisite.evidence.length || physicalById.size !== physical.applications.length || deductionById.size !== deduction.orderedActionEvidence.length) fail('characterInvalid', 'QCD action evidence identifiers must be globally unique.')
  const actions = residual.postPass.applications.map((postPass) => {
    const prerequisite = prerequisites.get(postPass.actionId); const physicalApplication = physicalById.get(postPass.actionId)
    const deductionTreatmentEvidence = deductionById.get(postPass.actionId)
    if (prerequisite === undefined || physicalApplication === undefined || deductionTreatmentEvidence === undefined) fail('characterInvalid', 'QCD action evidence join is incomplete.')
    const acceptedSourceEligibility = acceptedSource(prerequisite, postPass)
    if (physicalApplication.stagingEvidenceId !== postPass.physicalStagingEvidenceId || physicalApplication.prerequisiteEvidenceId !== postPass.prerequisiteEvidenceId || physicalApplication.request.actionId !== postPass.actionId || physicalApplication.request.donorPersonId !== postPass.donorPersonId || physicalApplication.request.allocation.allocationId !== postPass.allocationId || physicalApplication.request.allocation.sourceAccountId !== postPass.sourceAccountId || physicalApplication.executedAmount !== postPass.charitableDistributionAmount || physicalApplication.charitableDistributionAmount !== postPass.charitableDistributionAmount || deductionTreatmentEvidence.postPassApplicationEvidenceId !== postPass.evidenceId || deductionTreatmentEvidence.scheduledDate !== physicalApplication.request.executionDate || deductionTreatmentEvidence.scheduledSequence !== physicalApplication.request.executionSequence) fail('sourceInvalid', 'QCD character physical, schedule, or deduction evidence does not reconcile.')
    const bindings = residual.pools.flatMap((pool) => pool.qcdRemainderBindings).filter((entry) => entry.postPassApplicationEvidenceId === postPass.evidenceId)
    if ((postPass.nonQcdCharitableRemainder > 0 && bindings.length !== 1) || (postPass.nonQcdCharitableRemainder === 0 && bindings.length !== 0)) fail('characterInvalid', 'QCD basis remainder binding does not match the post-pass amount.')
    const remainder = bindings[0] ?? null
    if (remainder !== null && (remainder.allocation.actionId !== postPass.actionId || remainder.allocation.allocationId !== postPass.allocationId || remainder.allocation.sourceAccountId !== postPass.sourceAccountId || remainder.allocation.grossAmount !== postPass.nonQcdCharitableRemainder || remainder.allocation.allocatedBasisAmount !== postPass.nonQcdCharitableRemainder || remainder.allocation.taxableAmount !== 0)) fail('characterInvalid', 'QCD basis remainder evidence is inconsistent.')
    const characters = [
      ...(postPass.excludableQcdAmount > 0 ? [segment('qcdIncomeExclusion', postPass.excludableQcdAmount, postPass, postPass.prerequisiteEvidenceId, deductionTreatmentEvidence.evidenceId, null)] : []),
      ...(postPass.taxableQcdAmount > 0 ? [segment('ordinaryIncome', postPass.taxableQcdAmount, postPass, postPass.prerequisiteEvidenceId, deductionTreatmentEvidence.evidenceId, null)] : []),
      ...(postPass.nonQcdCharitableRemainder > 0 ? [segment('basisReturn', postPass.nonQcdCharitableRemainder, postPass, postPass.prerequisiteEvidenceId, deductionTreatmentEvidence.evidenceId, remainder)] : []),
    ]
    const sum = characters.reduce((total, entry) => total + BigInt(entry.amountCents), 0n)
    if (sum !== BigInt(postPass.charitableDistributionAmount) || BigInt(postPass.qualifiedCharitableDistributionAmount) !== BigInt(postPass.excludableQcdAmount) + BigInt(postPass.taxableQcdAmount) || BigInt(postPass.charitableDistributionAmount) !== BigInt(postPass.qualifiedCharitableDistributionAmount) + BigInt(postPass.nonQcdCharitableRemainder) || BigInt(postPass.charitableDeductionEligibleAmount) !== BigInt(postPass.taxableQcdAmount) + BigInt(postPass.nonQcdCharitableRemainder) || postPass.provisionalCharacter.qcdIncomeExclusionAmount !== postPass.excludableQcdAmount || postPass.provisionalCharacter.ordinaryIncomeAmount !== postPass.taxableQcdAmount || postPass.provisionalCharacter.basisReturnAmount !== postPass.nonQcdCharitableRemainder) fail('characterInvalid', 'Final QCD character does not partition executed principal and deduction-eligible amount.')
    const withoutId = { actionId: postPass.actionId, donorPersonId: postPass.donorPersonId,
      allocationId: postPass.allocationId, sourceAccountId: postPass.sourceAccountId,
      status: characters.length === 0 ? 'notApplicableZeroMovement' as const : 'final' as const,
      acceptedSourceEligibility, prerequisiteEvidence: prerequisite, physicalApplication, postPassApplication: postPass,
      residualRemainderBinding: remainder, deductionTreatmentEvidence, derivedTaxCharacter: characters }
    return deepFreeze({ ...withoutId, evidenceId: deriveActionStructuralId('annual-qcd-derived-character-action', [residual.evidenceId, deduction.evidenceId, withoutId]) })
  })
  if (actions.length !== physical.applications.length || actions.length !== deduction.orderedActionEvidence.length) fail('characterInvalid', 'Final QCD character must cover every canonical action exactly once.')
  const withoutId = { status: 'annualQcdDerivedTaxCharacterFinal' as const, committed: false as const,
    movement: 'notCommitted' as const, publicationStatus: 'notOwnedByDerivedTaxCharacter' as const,
    taxYear: 2026 as const, residualEvidenceId: residual.evidenceId, deductionTreatmentEvidenceId: deduction.evidenceId,
    actions, exactAmountAuthority: 'cents' as const, issues: [] as const }
  return deepFreeze({ ...withoutId, evidenceId: deriveActionStructuralId('annual-qcd-derived-character-final', [withoutId]) })
}
export function finalizeAnnualQcdDerivedTaxCharacter(input: Readonly<CoordinateAnnualQcdDeductionTreatmentInput>): Readonly<FinalizeAnnualQcdDerivedTaxCharacterResult> {
  try { return finalize(structuredClone(input) as CoordinateAnnualQcdDeductionTreatmentInput) }
  catch (error) { return blocked(error) }
}
