import { parsePlan } from '../model/plan.js'
import { addCalendarMonths, parseCivilIsoDate } from './civilDate.js'
import { actionExecutionDispositionSchema, type ActionExecutionDisposition, type QualifiedCharitableDistributionRequest } from './contract.js'
import { evaluateRetirementActionSchedule } from './execution.js'
import type { AnnualQcdEligibilitySnapshot } from './annualQcdExecutionPrerequisite.js'
import type { AnnualQcdRmdPoolOpeningSnapshot } from './annualQcdPhysicalExecution.js'
import { stageAnnualQcdTaxCharacterPostPass, type AnnualQcdPostPassApplication,
  type AnnualQcdPostPassPoolTransition } from './annualQcdTaxCharacterPostPass.js'
import type { AnnualQcdUnifiedDerivedTaxCharacter, AnnualQcdUnifiedFinalizationActionEvidence,
  FinalizeAnnualQcdUnifiedTransactionInput } from './annualQcdUnifiedTransactionFinalization.js'
import { finalizeAnnualQcdUnifiedTransaction } from './annualQcdUnifiedTransactionFinalization.js'
import type { AnnualRetirementActionPublicationSource } from './annualRetirementActionPublication.js'
import type { AccountId, ActionId, AllocationId, PersonId, PlanId } from './identity.js'
import { asUsdCents, type PositiveUsdCents, type UsdCents } from './money.js'
import { createActionReason, type ActionReason } from './reasons.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'

export interface PublishAnnualQcdActionExecutionEvidenceInput {
  readonly ownerFinalizationInputs: readonly Readonly<FinalizeAnnualQcdUnifiedTransactionInput>[]
}
export type AnnualQcdActionExecutionDisposition = Exclude<ActionExecutionDisposition, Readonly<{ readonly outcome: 'unsupported' }>>
export interface AnnualQcdActionExecutionAllocationEvidence {
  readonly allocationId: AllocationId; readonly sourceAccountId: AccountId; readonly resolution: 'resolved'
  readonly requestedAmount: PositiveUsdCents; readonly balanceBefore: UsdCents; readonly executedAmount: UsdCents
  readonly unexecutedAmount: UsdCents; readonly balanceAfter: UsdCents; readonly unifiedPhysicalApplicationEvidenceId: string
  readonly charityCreditEvidenceId: string
}
export interface AnnualQcdExactAgeEligibilityEvidence {
  readonly predicate: 'qcdEligibilityDate'; readonly dateRole: 'scheduled' | 'executed'; readonly donorPersonId: PersonId
  readonly birthDate: string; readonly evaluationDate: string; readonly thresholdMonthCount: 846; readonly age70HalfThresholdDate: string
  /**
   * Names the arithmetic that produced `age70HalfThresholdDate`, because the
   * date rests on an unsettled convention rather than on authority. Nothing
   * addressed to IRC 408(d)(8)(B)(ii) says what "six calendar months after"
   * means when the target day does not exist, and the one-step 846-month form
   * this field names disagrees with a two-step reading by a day for a
   * 29 February birth. The 714-month and 780-month thresholds already publish
   * the same disclosure; this one did not, so a consumer could read the
   * threshold date off a QCD record with nothing telling it the date was
   * chosen. See the registry record irc-408-d-8-B-ii-age-70-half.
   */
  readonly calculation: 'addCalendarMonths846WithMonthEndClamp'
  readonly exactAgeOnEvaluationDate: number; readonly reachedAge70Half: true; readonly aliveEvidenceId: string; readonly ageEvidenceId: string
}
export interface AnnualQcdActionRmdPoolEvidence {
  readonly poolId: string; readonly scope: 'donorOwnedIraRmdPool'; readonly donorPersonId: PersonId; readonly inheritedFromPersonId: null
  readonly accountIds: readonly AccountId[]; readonly taxYear: number; readonly rmdRequiredAmount: UsdCents; readonly rmdSatisfiedBefore: UsdCents
  readonly rmdRemainingBefore: UsdCents; readonly rmdSatisfiedByAction: UsdCents; readonly rmdRemainingAfter: UsdCents; readonly upstreamEvidenceId: string
}
export interface AnnualQcdActionTaxablePoolEvidence {
  readonly scope: 'donorOwnedNonRothIras'; readonly inheritedFromPersonId: null; readonly accountIds: readonly AccountId[]
  readonly taxablePoolGrossBalanceBefore: UsdCents; readonly taxablePoolBasisBefore: UsdCents; readonly capacityEvidenceId: string
}
export interface AnnualQcdActionCharitableDeductionEvidence {
  readonly treatment: 'notApplicable' | 'evaluated'; readonly filingTreatment: 'itemized' | 'standardDeduction'
  readonly eligibleContributionAmount: UsdCents; readonly currentYearClaimedDeductionAmount: UsdCents
  readonly limitationCarryforwardAmount: UsdCents; readonly unclaimedWithoutCarryforwardAmount: UsdCents; readonly authorityEvidenceIds: readonly string[]
}
export interface AnnualQcdActionExecutionEvidence {
  readonly predicate: 'annualQcdActionExecutionEvidence'; readonly request: Readonly<QualifiedCharitableDistributionRequest>
  readonly actionId: ActionId; readonly kind: 'qcd'; readonly personId: PersonId; readonly donorPersonId: PersonId; readonly sourceIraAccountId: AccountId
  readonly provenance: QualifiedCharitableDistributionRequest['provenance']; readonly charity: QualifiedCharitableDistributionRequest['charity']
  readonly year: number; readonly taxYear: number; readonly ledgerRunId: string
  readonly scheduledDate: string; readonly scheduledSequence: number; readonly executedDate: string | null; readonly executedSequence: number | null
  readonly requestedAmount: PositiveUsdCents; readonly executedAmount: UsdCents; readonly unexecutedAmount: UsdCents
  readonly disposition: Readonly<AnnualQcdActionExecutionDisposition>
  readonly allocation: Readonly<AnnualQcdActionExecutionAllocationEvidence>
  readonly allocations: readonly [Readonly<AnnualQcdActionExecutionAllocationEvidence>]
  readonly eligibilityEvidence: Readonly<AnnualQcdEligibilitySnapshot>
  readonly scheduledAgeEligibilityEvidence: Readonly<AnnualQcdExactAgeEligibilityEvidence>
  readonly executedAgeEligibilityEvidence: Readonly<AnnualQcdExactAgeEligibilityEvidence> | null
  readonly exactAgeOnScheduledDate: number; readonly exactAgeOnExecutedDate: number | null
  readonly acceptedSourceEligibility: AnnualQcdUnifiedFinalizationActionEvidence['acceptedSourceEligibility']
  readonly derivedFactsStatus: 'complete'; readonly charitableDistributionAmount: UsdCents; readonly qualifiedCharitableDistributionAmount: UsdCents
  readonly excludableQcdAmount: UsdCents; readonly taxableQcdAmount: UsdCents; readonly nonQcdCharitableRemainder: UsdCents
  readonly charitableDeductionEligibleAmount: UsdCents; readonly rmdSatisfiedAmount: UsdCents; readonly rmdPool: Readonly<AnnualQcdActionRmdPoolEvidence>
  readonly taxablePool: Readonly<AnnualQcdActionTaxablePoolEvidence>; readonly charitableDeductionTreatment: Readonly<AnnualQcdActionCharitableDeductionEvidence>
  readonly otherwiseTaxableAmountBefore: UsdCents; readonly otherwiseTaxableAmountUsed: UsdCents; readonly otherwiseTaxableAmountAfter: UsdCents
  readonly personalLimitBefore: UsdCents; readonly personalLimitUsed: UsdCents; readonly personalLimitAfter: UsdCents
  readonly deductibleContributionOffsetBefore: UsdCents; readonly deductibleContributionOffsetApplied: UsdCents; readonly deductibleContributionOffsetAfter: UsdCents
  readonly taxCalculation: AnnualQcdUnifiedFinalizationActionEvidence['taxCalculation']
  readonly taxCharacter: readonly Readonly<AnnualQcdUnifiedDerivedTaxCharacter>[]
  readonly penalty: readonly []; readonly penaltyCoverage: readonly Readonly<{ readonly applicability: 'notApplicable'; readonly reason: 'qcdDirectTransfer'
    readonly allocationId: AllocationId; readonly sourceAccountId: AccountId; readonly executedAmount: UsdCents }>[]
  readonly qcdPrerequisiteEvidenceId: string; readonly unifiedPhysicalApplicationEvidenceId: string; readonly unifiedTransactionEvidenceId: string
  readonly unifiedFinalizationActionEvidenceId: string; readonly evidenceId: string
}
export interface AnnualQcdActionExecutionEvidencePublished {
  readonly status: 'annualQcdActionExecutionEvidencePublished'; readonly committed: false; readonly movement: 'notCommitted'
  readonly actionability: 'established'; readonly publicationStatus: 'qcdExecutorSourceReady'; readonly planId: PlanId
  readonly taxYear: number; readonly ledgerRunId: string; readonly inventoryEvidenceId: string
  readonly actions: readonly Readonly<AnnualQcdActionExecutionEvidence>[]
  readonly publicationSource: Readonly<AnnualRetirementActionPublicationSource>; readonly evidenceId: string; readonly issues: readonly []
}
export interface AnnualQcdActionExecutionEvidenceIssue { readonly kind: 'hostileInput' | 'finalizationInvalid' | 'batchInvalid' | 'actionInvalid' | 'identifierCollision'; readonly detail: string }
export interface AnnualQcdActionExecutionEvidenceBlocked {
  readonly status: 'annualQcdActionExecutionEvidenceBlocked'; readonly committed: false; readonly movement: 'notCommitted'
  readonly actionability: 'notEstablished'; readonly publicationStatus: 'notEstablished'; readonly planId: null; readonly taxYear: null
  readonly ledgerRunId: null; readonly inventoryEvidenceId: null; readonly actions: readonly []; readonly publicationSource: null
  readonly evidenceId: null; readonly issues: readonly [Readonly<AnnualQcdActionExecutionEvidenceIssue>]
}
export type PublishAnnualQcdActionExecutionEvidenceResult = AnnualQcdActionExecutionEvidencePublished | AnnualQcdActionExecutionEvidenceBlocked
class PublishError extends Error { readonly kind: AnnualQcdActionExecutionEvidenceIssue['kind']; constructor(kind: AnnualQcdActionExecutionEvidenceIssue['kind'], detail: string) { super(detail); this.kind = kind } }
function fail(kind: AnnualQcdActionExecutionEvidenceIssue['kind'], detail: string): never { throw new PublishError(kind, detail) }
function deepFreeze<T>(value: T): Readonly<T> { if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); Object.freeze(value) } return value as Readonly<T> }
function blocked(error: unknown): AnnualQcdActionExecutionEvidenceBlocked {
  const issue = error instanceof PublishError ? { kind: error.kind, detail: error.message } : { kind: 'hostileInput' as const, detail: 'QCD action-execution publication input must be detached canonical data.' }
  return deepFreeze({ status: 'annualQcdActionExecutionEvidenceBlocked', committed: false, movement: 'notCommitted', actionability: 'notEstablished',
    publicationStatus: 'notEstablished', planId: null, taxYear: null, ledgerRunId: null, inventoryEvidenceId: null, actions: [], publicationSource: null,
    evidenceId: null, issues: [issue] })
}
function evidenceIds(value: unknown, ids = new Set<string>()): Set<string> {
  if (value === null || typeof value !== 'object') return ids
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((key === 'evidenceId' || key.endsWith('EvidenceId') || key === 'taxInputSnapshotId') && typeof child === 'string') ids.add(child)
    else evidenceIds(child, ids)
  } return ids
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => compareUtf16CodeUnits(left, right)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`
  return JSON.stringify(value)
}
function requireDistinctOwnerPhysicalAuthorities(inputs: readonly Readonly<FinalizeAnnualQcdUnifiedTransactionInput>[]): void {
  const bindings = new Map<string, string>()
  const claim = (evidenceId: string, binding: unknown) => {
    const semantic = canonical(binding); const prior = bindings.get(evidenceId)
    if (prior !== undefined && prior !== semantic) fail('identifierCollision', 'Owner physical-application evidence ID is reused across different annual bindings.')
    bindings.set(evidenceId, semantic)
  }
  for (const entry of inputs) {
    const ownerPersonId = entry.physicalTransactionInput.ownerPersonId
    for (const application of entry.physicalTransactionInput.actualApplications)
      claim(application.stagingEvidenceId, { role: 'actualApplication', ownerPersonId, application })
    for (const application of entry.physicalTransactionInput.settledContributionApplications)
      claim(application.stagingEvidenceId, { role: 'settledContributionApplication', ownerPersonId, application })
  }
}
function reason(action: Readonly<AnnualQcdUnifiedFinalizationActionEvidence>): readonly Readonly<ActionReason>[] {
  const physical = action.unifiedPhysicalApplication; const calculation = action.taxCalculation; const reasons: ActionReason[] = []
  if (physical.unexecutedAmount > 0) reasons.push(createActionReason(physical.executedAmount === 0 ? 'qcd-balance-unavailable' : 'qcd-balance-trimmed',
    { accountId: physical.sourceAccountId, allocationId: physical.allocationId }))
  if (calculation.excludableQcdAmount + calculation.taxableQcdAmount > calculation.personalLimitUsed) reasons.push(createActionReason('qcd-person-limit-trimmed'))
  if (calculation.deductibleContributionOffsetApplied > 0) reasons.push(createActionReason('qcd-contribution-offset-applied'))
  if (calculation.nonQcdCharitableRemainder > 0) reasons.push(createActionReason('qcd-taxable-amount-trimmed'))
  return reasons
}
interface RichContext { readonly application: Readonly<AnnualQcdPostPassApplication>; readonly pool: Readonly<AnnualQcdPostPassPoolTransition>
  readonly basisBefore: UsdCents; readonly rmdPool: Readonly<AnnualQcdRmdPoolOpeningSnapshot> }
function completedCalendarMonthAge(birthDate: string, evaluationDate: string): number {
  const birth = parseCivilIsoDate(birthDate); const evaluation = parseCivilIsoDate(evaluationDate)
  if (birth === null || evaluation === null) fail('actionInvalid', 'QCD exact age requires canonical civil dates.')
  let months = (evaluation.year - birth.year) * 12 + evaluation.month - birth.month
  const anniversary = addCalendarMonths(birthDate, months)
  if (anniversary === null) fail('actionInvalid', 'QCD exact age calendar arithmetic failed.')
  if (anniversary > evaluationDate) months -= 1
  if (!Number.isSafeInteger(months) || months < 846) fail('actionInvalid', 'QCD exact age is below 70 1/2 on the evaluation date.')
  return months / 12
}
function exactAgeEvidence(donorPersonId: PersonId, birthDate: string, evaluationDate: string, age70HalfThresholdDate: string,
  dateRole: 'scheduled' | 'executed', aliveEvidenceId: string, claimed: Set<string>): AnnualQcdExactAgeEligibilityEvidence {
  const base = { predicate: 'qcdEligibilityDate' as const, dateRole, donorPersonId, birthDate, evaluationDate, thresholdMonthCount: 846 as const,
    age70HalfThresholdDate, calculation: 'addCalendarMonths846WithMonthEndClamp' as const,
    exactAgeOnEvaluationDate: completedCalendarMonthAge(birthDate, evaluationDate), reachedAge70Half: true as const, aliveEvidenceId }
  const ageEvidenceId = deriveActionStructuralId('qcd-exact-age-eligibility-evidence', [base])
  if (claimed.has(ageEvidenceId)) fail('identifierCollision', 'QCD exact-age evidence ID collides with upstream evidence.')
  claimed.add(ageEvidenceId); return deepFreeze({ ...base, ageEvidenceId })
}
function actionEvidence(action: Readonly<AnnualQcdUnifiedFinalizationActionEvidence>, context: Readonly<RichContext>, claimed: Set<string>): AnnualQcdActionExecutionEvidence {
  const physical = action.unifiedPhysicalApplication; const request = physical.qcdPrerequisiteEvidence.request
  const eligibility = physical.qcdPrerequisiteEvidence.eligibility; const schedule = eligibility.schedule; const donor = eligibility.donor
  if (donor.birthDate === null || donor.age70HalfThresholdDate === null || donor.aliveEvidence === null || !donor.aliveEvidence.alive ||
    schedule.parsedScheduledDate === null || schedule.reachedAge70HalfOnScheduledDate !== true) fail('actionInvalid', 'Executed QCD lost exact scheduled age eligibility.')
  const qualifiedAmount = asUsdCents(action.taxCalculation.excludableQcdAmount + action.taxCalculation.taxableQcdAmount)
  if (context.application.actionId !== physical.actionId || context.application.qualifiedCharitableDistributionAmount !== qualifiedAmount ||
    context.application.nonQcdCharitableRemainder !== action.taxCalculation.nonQcdCharitableRemainder ||
    qualifiedAmount + action.taxCalculation.nonQcdCharitableRemainder !== physical.executedAmount ||
    !context.pool.baseForm8606Facts.accountIds.includes(physical.sourceAccountId) || !context.rmdPool.sourceAccountIds.includes(physical.sourceAccountId))
    fail('actionInvalid', 'Rich QCD derived facts do not reconcile to unified execution.')
  const reasons = reason(action); const disposition = actionExecutionDispositionSchema.parse({ outcome: physical.executedAmount === 0 ? 'refused' :
    physical.unexecutedAmount === 0 ? 'executed' : 'partial', readiness: physical.executedAmount === 0 ? 'nonActionable' : 'actionable',
  requestedAmount: request.requestedAmount, executedAmount: physical.executedAmount, unexecutedAmount: physical.unexecutedAmount, reasons })
  if (disposition.outcome === 'unsupported') fail('actionInvalid', 'A rebuilt unified QCD cannot publish an unsupported disposition.')
  const allocation = { allocationId: physical.allocationId, sourceAccountId: physical.sourceAccountId, resolution: 'resolved' as const,
    requestedAmount: request.allocation.requestedAmount, balanceBefore: physical.sourceBalanceBefore, executedAmount: physical.executedAmount,
    unexecutedAmount: physical.unexecutedAmount, balanceAfter: physical.sourceBalanceAfter,
    unifiedPhysicalApplicationEvidenceId: physical.applicationEvidenceId, charityCreditEvidenceId: physical.charityCreditEvidenceId }
  const scheduledAge = exactAgeEvidence(physical.ownerPersonId, donor.birthDate, schedule.parsedScheduledDate,
    donor.age70HalfThresholdDate, 'scheduled', donor.aliveEvidence.evidenceId, claimed)
  const executedAge = physical.executedAmount > 0 ? exactAgeEvidence(physical.ownerPersonId, donor.birthDate, physical.scheduledDate,
    donor.age70HalfThresholdDate, 'executed', donor.aliveEvidence.evidenceId, claimed) : null
  const rmdSatisfiedBefore = asUsdCents(context.rmdPool.rmdRequiredAmount - context.application.rmdRemainingBefore)
  const rmdPool = { poolId: context.rmdPool.poolId, scope: 'donorOwnedIraRmdPool' as const, donorPersonId: physical.ownerPersonId,
    // Canonical order: the staged pool identity is derived from a sorted copy,
    // so publishing the caller's array order would make this record — and the
    // execution and publication digests built from it — depend on caller input
    // ordering for otherwise byte-identical annual QCD runs.
    inheritedFromPersonId: null, accountIds: [...context.rmdPool.sourceAccountIds].sort(compareUtf16CodeUnits), taxYear: physical.taxYear, rmdRequiredAmount: context.rmdPool.rmdRequiredAmount,
    rmdSatisfiedBefore, rmdRemainingBefore: context.application.rmdRemainingBefore, rmdSatisfiedByAction: context.application.rmdSatisfiedByAction,
    rmdRemainingAfter: context.application.rmdRemainingAfter, upstreamEvidenceId: context.rmdPool.upstreamEvidenceId }
  const taxablePool = { scope: 'donorOwnedNonRothIras' as const, inheritedFromPersonId: null, accountIds: context.pool.baseForm8606Facts.accountIds,
    taxablePoolGrossBalanceBefore: asUsdCents(context.application.otherwiseTaxableAmountBefore + context.basisBefore), taxablePoolBasisBefore: context.basisBefore,
    capacityEvidenceId: context.pool.baseForm8606Facts.capacityEvidenceId }
  const penaltyCoverage = physical.executedAmount === 0 ? [] : [{ applicability: 'notApplicable' as const, reason: 'qcdDirectTransfer' as const,
    allocationId: physical.allocationId, sourceAccountId: physical.sourceAccountId, executedAmount: physical.executedAmount }]
  const charitableDeductionTreatment = { treatment: action.taxCalculation.deductionTreatment, filingTreatment: action.taxCalculation.filingTreatment,
    eligibleContributionAmount: action.taxCalculation.charitableDeductionEligibleAmount,
    currentYearClaimedDeductionAmount: action.taxCalculation.currentYearClaimedDeductionCents,
    limitationCarryforwardAmount: action.taxCalculation.limitationCarryforwardCents,
    unclaimedWithoutCarryforwardAmount: action.taxCalculation.unclaimedWithoutCarryforwardCents,
    authorityEvidenceIds: action.taxCalculation.authorityEvidenceIds }
  const base = { predicate: 'annualQcdActionExecutionEvidence' as const, request, actionId: physical.actionId, kind: 'qcd' as const,
    personId: physical.ownerPersonId, donorPersonId: physical.ownerPersonId, sourceIraAccountId: physical.sourceAccountId,
    provenance: request.provenance, charity: request.charity,
    year: physical.taxYear, taxYear: physical.taxYear, ledgerRunId: physical.ledgerRunId, scheduledDate: physical.scheduledDate, scheduledSequence: physical.scheduledSequence,
    executedDate: physical.executedAmount > 0 ? physical.scheduledDate : null, executedSequence: physical.executedAmount > 0 ? physical.scheduledSequence : null,
    requestedAmount: request.requestedAmount, executedAmount: physical.executedAmount, unexecutedAmount: physical.unexecutedAmount,
    disposition, allocation, allocations: [allocation] as const, eligibilityEvidence: eligibility, scheduledAgeEligibilityEvidence: scheduledAge,
    executedAgeEligibilityEvidence: executedAge, exactAgeOnScheduledDate: scheduledAge.exactAgeOnEvaluationDate,
    exactAgeOnExecutedDate: executedAge?.exactAgeOnEvaluationDate ?? null,
    acceptedSourceEligibility: action.acceptedSourceEligibility,
    derivedFactsStatus: 'complete' as const, charitableDistributionAmount: physical.executedAmount, qualifiedCharitableDistributionAmount: qualifiedAmount,
    excludableQcdAmount: action.taxCalculation.excludableQcdAmount, taxableQcdAmount: action.taxCalculation.taxableQcdAmount,
    nonQcdCharitableRemainder: action.taxCalculation.nonQcdCharitableRemainder,
    charitableDeductionEligibleAmount: action.taxCalculation.charitableDeductionEligibleAmount, rmdSatisfiedAmount: context.application.rmdSatisfiedByAction,
    rmdPool, taxablePool, charitableDeductionTreatment, otherwiseTaxableAmountBefore: action.taxCalculation.otherwiseTaxableAmountBefore,
    otherwiseTaxableAmountUsed: action.taxCalculation.otherwiseTaxableAmountUsed, otherwiseTaxableAmountAfter: action.taxCalculation.otherwiseTaxableAmountAfter,
    personalLimitBefore: action.taxCalculation.personalLimitBefore, personalLimitUsed: action.taxCalculation.personalLimitUsed,
    personalLimitAfter: action.taxCalculation.personalLimitAfter, deductibleContributionOffsetBefore: action.taxCalculation.deductibleContributionOffsetBefore,
    deductibleContributionOffsetApplied: action.taxCalculation.deductibleContributionOffsetApplied,
    deductibleContributionOffsetAfter: action.taxCalculation.deductibleContributionOffsetAfter,
    taxCalculation: action.taxCalculation, taxCharacter: action.derivedTaxCharacter, penalty: [] as const, penaltyCoverage,
    qcdPrerequisiteEvidenceId: physical.qcdPrerequisiteEvidenceId, unifiedPhysicalApplicationEvidenceId: physical.applicationEvidenceId,
    unifiedTransactionEvidenceId: action.unifiedTransactionEvidenceId, unifiedFinalizationActionEvidenceId: action.evidenceId }
  const evidenceId = deriveActionStructuralId('annual-qcd-action-execution-evidence', [base])
  if (claimed.has(evidenceId)) fail('identifierCollision', 'QCD action-execution evidence ID collides with upstream evidence.')
  claimed.add(evidenceId); return deepFreeze({ ...base, evidenceId })
}
function richContexts(postPass: ReturnType<typeof stageAnnualQcdTaxCharacterPostPass>, rmdPools: readonly Readonly<AnnualQcdRmdPoolOpeningSnapshot>[]): Map<ActionId, RichContext> {
  if (postPass.status !== 'annualQcdTaxCharacterPostPassStaged') fail('finalizationInvalid', 'Canonical global QCD post-pass must rebuild for rich publication.')
  const pools = new Map(postPass.pools.map((pool) => [pool.baseForm8606Facts.ownerPersonId, pool])); const rmdById = new Map(rmdPools.map((pool) => [pool.poolId, pool]))
  const basis = new Map(postPass.pools.map((pool) => [pool.baseForm8606Facts.ownerPersonId, pool.taxablePoolBasisBefore])); const result = new Map<ActionId, RichContext>()
  for (const application of postPass.applications) {
    const pool = pools.get(application.donorPersonId); const rmdPool = rmdById.get(application.rmdPoolId); const basisBefore = basis.get(application.donorPersonId)
    if (pool === undefined || rmdPool === undefined || basisBefore === undefined || result.has(application.actionId))
      fail('actionInvalid', 'Rich QCD pool/application lineage is incomplete or duplicated.')
    result.set(application.actionId, { application, pool, basisBefore, rmdPool })
    basis.set(application.donorPersonId, asUsdCents(basisBefore - application.nonQcdCharitableRemainder))
  }
  return result
}
function publish(input: PublishAnnualQcdActionExecutionEvidenceInput): AnnualQcdActionExecutionEvidencePublished {
  if (input.ownerFinalizationInputs.length === 0) fail('batchInvalid', 'QCD action-execution publication requires at least one owner finalization input.')
  const firstInput = input.ownerFinalizationInputs[0]!
  if (input.ownerFinalizationInputs.some((entry) => canonical(entry.deductionTreatmentInput) !== canonical(firstInput.deductionTreatmentInput)))
    fail('batchInvalid', 'QCD owner bridges must share one exact global deduction/tax/basis chronology.')
  const annualInventoryScope = (entry: Readonly<FinalizeAnnualQcdUnifiedTransactionInput>) => ({
    runtimeInventoryAttestation: entry.physicalTransactionInput.runtimeInventoryAttestation,
    runtimeRecords: entry.physicalTransactionInput.runtimeRecords })
  if (input.ownerFinalizationInputs.some((entry) => canonical(annualInventoryScope(entry)) !== canonical(annualInventoryScope(firstInput))))
    fail('batchInvalid', 'QCD owner bridges must share one exact annual physical-inventory authority and runtime scope.')
  requireDistinctOwnerPhysicalAuthorities(input.ownerFinalizationInputs)
  const bridges = input.ownerFinalizationInputs.map((entry) => finalizeAnnualQcdUnifiedTransaction(entry))
  if (bridges.some((entry) => entry.status !== 'annualQcdUnifiedFinalizationBridged')) fail('finalizationInvalid', 'Every QCD owner finalization bridge must rebuild before publication.')
  const finalized = bridges.filter((entry) => entry.status === 'annualQcdUnifiedFinalizationBridged')
  if (finalized.some((entry) => entry.actions.length === 0)) fail('batchInvalid', 'Every QCD owner bridge must contribute at least one annual Plan QCD action.')
  const parsedPlans = input.ownerFinalizationInputs.map((entry) => parsePlan(entry.physicalTransactionInput.plan))
  const firstPlan = parsedPlans[0]
  if (firstPlan === undefined || !firstPlan.ok || parsedPlans.some((entry) => !entry.ok || canonical(entry.plan) !== canonical(firstPlan.plan)))
    fail('batchInvalid', 'QCD publication requires one shared valid authoritative Plan.')
  const schedule = evaluateRetirementActionSchedule(firstInput.physicalTransactionInput.taxYear,
    firstPlan.plan.strategies.retirementActions.filter((entry) => entry.kind === 'qcd' && entry.year === firstInput.physicalTransactionInput.taxYear))
  if (schedule.scheduleIssues.length > 0) fail('batchInvalid', 'Executed QCD publication cannot contain a same-slot schedule conflict.')
  const requests = schedule.requests
  if (requests.length === 0 || requests.some((entry) => entry.kind !== 'qcd')) fail('batchInvalid', 'QCD publication requires a complete canonical annual QCD request batch.')
  const allActions = finalized.flatMap((entry) => entry.actions); const byAction = new Map(allActions.map((entry) => [entry.actionId, entry]))
  const scope = finalized.flatMap((entry) => entry.actions.map((action) => ({ planId: action.unifiedPhysicalApplication.planId,
    taxYear: action.unifiedPhysicalApplication.taxYear, ledgerRunId: action.unifiedPhysicalApplication.ledgerRunId,
    inventoryEvidenceId: action.unifiedPhysicalApplication.inventoryEvidenceId })))
  const firstScope = scope[0]
  if (firstScope === undefined || allActions.length !== requests.length || byAction.size !== allActions.length || scope.some((entry) =>
    entry.planId !== firstScope.planId || entry.taxYear !== firstScope.taxYear || entry.ledgerRunId !== firstScope.ledgerRunId || entry.inventoryEvidenceId !== firstScope.inventoryEvidenceId))
    fail('batchInvalid', 'QCD owner bridges must form one complete Plan/year/ledger/inventory batch.')
  const globalPostPass = stageAnnualQcdTaxCharacterPostPass(firstInput.deductionTreatmentInput.postPassInput)
  const contexts = richContexts(globalPostPass, firstInput.deductionTreatmentInput.postPassInput.physicalInput.rmdPools)
  if (contexts.size !== requests.length) fail('actionInvalid', 'Rich QCD post-pass/action union is incomplete.')
  const claimed = evidenceIds({ input, finalized, globalPostPass }); const actions = requests.map((request) => {
    const action = byAction.get(request.actionId)
    if (action === undefined || request.kind !== 'qcd' || canonical(action.unifiedPhysicalApplication.qcdPrerequisiteEvidence.request) !== canonical(request))
      fail('actionInvalid', 'QCD publication action/request union is incomplete or foreign.')
    const context = contexts.get(request.actionId); if (context === undefined) fail('actionInvalid', 'QCD publication action lost rich global context.')
    return actionEvidence(action, context, claimed)
  })
  const publicationSource: AnnualRetirementActionPublicationSource = { executorSource: 'qcdExecutor', records: actions.map((action) => ({ request: action.request,
    actionId: action.actionId, kind: 'qcd', personId: action.donorPersonId, year: action.taxYear, scheduledDate: action.scheduledDate,
    scheduledSequence: action.scheduledSequence, executedDate: action.executedDate, executedSequence: action.executedSequence,
    requestedAmount: action.requestedAmount, executedAmount: action.executedAmount, unexecutedAmount: action.unexecutedAmount,
    readiness: action.disposition.readiness, outcome: action.disposition.outcome, allocations: [{ allocationId: action.allocation.allocationId,
      sourceAccountId: action.allocation.sourceAccountId, resolution: 'resolved', requestedAmount: action.allocation.requestedAmount,
      executedAmount: action.allocation.executedAmount, unexecutedAmount: action.allocation.unexecutedAmount }], reasons: action.disposition.reasons })), scheduleDiagnostics: [] }
  const base = { status: 'annualQcdActionExecutionEvidencePublished' as const, committed: false as const, movement: 'notCommitted' as const,
    actionability: 'established' as const, publicationStatus: 'qcdExecutorSourceReady' as const, planId: firstScope.planId, taxYear: firstScope.taxYear,
    ledgerRunId: firstScope.ledgerRunId, inventoryEvidenceId: firstScope.inventoryEvidenceId, actions, publicationSource, issues: [] as const }
  const evidenceId = deriveActionStructuralId('annual-qcd-action-execution-publication', [base])
  if (claimed.has(evidenceId)) fail('identifierCollision', 'QCD action-execution publication ID collides with nested evidence.')
  return deepFreeze({ ...base, evidenceId })
}
/** Publishes rich QCD action evidence and one source for the existing common year-end composer; it does not commit movement. */
export function publishAnnualQcdActionExecutionEvidence(input: Readonly<PublishAnnualQcdActionExecutionEvidenceInput>): Readonly<PublishAnnualQcdActionExecutionEvidenceResult> {
  try { return publish(structuredClone(input) as PublishAnnualQcdActionExecutionEvidenceInput) } catch (error) { return blocked(error) }
}
