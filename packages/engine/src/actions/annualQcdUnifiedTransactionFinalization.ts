import { parsePlan, type Plan } from '../model/plan.js'
import { finalizeAnnualQcdDerivedTaxCharacter, type AcceptedQcdSourceEligibilityEvidence, type QcdFinalDerivedTaxCharacter } from './annualQcdDerivedTaxCharacter.js'
import type { CoordinateAnnualQcdDeductionTreatmentInput } from './annualQcdDeductionTreatmentCoordinator.js'
import type { AnnualIraBasisAllocationEntryInput } from './annualIraBasisAllocation.js'
import type { AccountId, ActionId, AllocationId } from './identity.js'
import { asUsdCents, type UsdCents } from './money.js'
import { preparePlanOwnedNonRothIraAnnualPhysicalTransaction, type OwnedNonRothIraAnnualQcdPhysicalApplication,
  type PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput } from './ownedNonRothIraAnnualPhysicalTransaction.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'

export interface FinalizeAnnualQcdUnifiedTransactionInput {
  readonly physicalTransactionInput: Readonly<PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput>
  readonly deductionTreatmentInput: Readonly<CoordinateAnnualQcdDeductionTreatmentInput>
}
export interface AnnualQcdUnifiedTaxCalculation {
  readonly otherwiseTaxableAmountBefore: UsdCents; readonly otherwiseTaxableAmountUsed: UsdCents; readonly otherwiseTaxableAmountAfter: UsdCents
  readonly personalLimitBefore: UsdCents; readonly personalLimitUsed: UsdCents; readonly personalLimitAfter: UsdCents
  readonly deductibleContributionOffsetBefore: UsdCents; readonly deductibleContributionOffsetApplied: UsdCents; readonly deductibleContributionOffsetAfter: UsdCents
  readonly excludableQcdAmount: UsdCents; readonly taxableQcdAmount: UsdCents; readonly nonQcdCharitableRemainder: UsdCents
  readonly charitableDeductionEligibleAmount: UsdCents; readonly filingTreatment: 'itemized' | 'standardDeduction'
  readonly deductionTreatment: 'notApplicable' | 'evaluated'; readonly currentYearClaimedDeductionCents: UsdCents
  readonly limitationCarryforwardCents: UsdCents; readonly unclaimedWithoutCarryforwardCents: UsdCents
  readonly authorityEvidenceIds: readonly string[]; readonly evidenceId: string
}
export interface AnnualQcdUnifiedDerivedTaxCharacter {
  readonly sourceClass: 'qcd'; readonly kind: QcdFinalDerivedTaxCharacter['kind']; readonly sourceAccountId: AccountId
  readonly amountCents: UsdCents; readonly exactAmountAuthority: 'cents'
  readonly characterEvidence: Readonly<{ readonly rule: 'qcdUnifiedAnnualPostPass'
    readonly component: QcdFinalDerivedTaxCharacter['characterEvidence']['component']; readonly qcdActionId: ActionId
    readonly allocationId: AllocationId; readonly acceptedSourcePrerequisiteEvidenceId: string
    readonly unifiedPhysicalApplicationEvidenceId: string; readonly taxCalculationEvidenceId: string
    readonly segmentAmountCents: UsdCents; readonly evidenceId: string }>
}
export interface AnnualQcdUnifiedFinalizationActionEvidence {
  readonly predicate: 'annualQcdUnifiedFinalizationAction'; readonly actionId: ActionId
  readonly unifiedPhysicalApplicationEvidenceId: string; readonly unifiedTransactionEvidenceId: string
  readonly unifiedPhysicalApplication: Readonly<OwnedNonRothIraAnnualQcdPhysicalApplication>
  readonly acceptedSourceEligibility: Readonly<AcceptedQcdSourceEligibilityEvidence>
  readonly taxCalculation: Readonly<AnnualQcdUnifiedTaxCalculation>
  readonly derivedTaxCharacter: readonly Readonly<AnnualQcdUnifiedDerivedTaxCharacter>[]; readonly evidenceId: string
}
export interface AnnualQcdUnifiedFinalizationIssue {
  readonly kind: 'hostileInput' | 'unifiedPhysicalInvalid' | 'lineFactsInvalid' | 'finalizationInvalid' | 'actionJoinInvalid' | 'identifierCollision'
  readonly detail: string
}
interface ResultBase { readonly committed: false; readonly movement: 'notCommitted'; readonly actionability: 'notEstablished'; readonly publicationStatus: 'notOwnedByUnifiedFinalization' }
export interface AnnualQcdUnifiedFinalizationBridged extends ResultBase {
  readonly status: 'annualQcdUnifiedFinalizationBridged'; readonly taxYear: number; readonly transactionEvidenceId: string
  readonly actions: readonly Readonly<AnnualQcdUnifiedFinalizationActionEvidence>[]; readonly evidenceId: string; readonly issues: readonly []
}
export interface AnnualQcdUnifiedFinalizationBlocked extends ResultBase {
  readonly status: 'annualQcdUnifiedFinalizationBlocked'; readonly taxYear: null; readonly transactionEvidenceId: null
  readonly actions: readonly []; readonly evidenceId: null; readonly issues: readonly [Readonly<AnnualQcdUnifiedFinalizationIssue>]
}
export type FinalizeAnnualQcdUnifiedTransactionResult = AnnualQcdUnifiedFinalizationBridged | AnnualQcdUnifiedFinalizationBlocked
class BridgeError extends Error { readonly kind: AnnualQcdUnifiedFinalizationIssue['kind']; constructor(kind: AnnualQcdUnifiedFinalizationIssue['kind'], detail: string) { super(detail); this.kind = kind } }
function fail(kind: AnnualQcdUnifiedFinalizationIssue['kind'], detail: string): never { throw new BridgeError(kind, detail) }
function deepFreeze<T>(value: T): Readonly<T> { if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); Object.freeze(value) } return value as Readonly<T> }
function blocked(error: unknown): AnnualQcdUnifiedFinalizationBlocked {
  const issue = error instanceof BridgeError ? { kind: error.kind, detail: error.message } : { kind: 'hostileInput' as const, detail: 'Unified QCD finalization input must be detached canonical data.' }
  return deepFreeze({ status: 'annualQcdUnifiedFinalizationBlocked', committed: false, movement: 'notCommitted', actionability: 'notEstablished',
    publicationStatus: 'notOwnedByUnifiedFinalization', taxYear: null, transactionEvidenceId: null, actions: [], evidenceId: null, issues: [issue] })
}
function sameEntries(left: readonly Readonly<AnnualIraBasisAllocationEntryInput>[], right: readonly Readonly<AnnualIraBasisAllocationEntryInput>[]): boolean {
  return left.length === right.length && left.every((entry, index) => { const expected = right[index]; return expected !== undefined &&
    entry.actionId === expected.actionId && entry.allocationId === expected.allocationId && entry.sourceAccountId === expected.sourceAccountId &&
    entry.scheduledDate === expected.scheduledDate && entry.scheduledSequence === expected.scheduledSequence && entry.grossAmount === expected.grossAmount })
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => compareUtf16CodeUnits(a, b))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`
  return JSON.stringify(value)
}
function evidenceRole(record: Record<string, unknown>): string {
  if (record.predicate === 'completeOwnedNonRothIraPoolForOwnerAndTaxYear') return 'completePoolEvidenceId'
  if (record.subtype !== undefined && record.sourceAccountId !== undefined) return 'iraClassificationEvidenceId'
  if ('alive' in record) return 'personAliveEvidenceId'
  if ('priorOffsetApplied' in record) return 'priorQcdOffsetEvidenceId'
  if (record.planYearEndDate !== undefined) return 'sepSimpleActivityEvidenceId'
  if (record.donorPersonId !== undefined && record.taxYear !== undefined && record.amountCents !== undefined) return 'deductibleContributionEvidenceId'
  return `evidenceId:${String(record.predicate ?? 'untyped')}`
}
// One SEP/SIMPLE activity fact is reachable in two legitimate shapes: the Plan's
// persisted `sepSimpleActivities` record (carrying `sourceAccountId` and
// `provenance`) and the eligibility context's `qcdActivity` reprojection of the
// same fact (carrying `kind`). Comparing whole records would reject every
// accepted SEP/SIMPLE QCD as an identifier collision, so this role is compared
// on the fields that actually carry its meaning. Two genuinely different
// activity facts sharing one evidence ID still collide.
const SEP_SIMPLE_SEMANTIC_KEYS = ['actionTaxYear', 'planYearEndDate', 'employerContributionMadeForPlanYear'] as const
function semanticProjection(role: string, record: Record<string, unknown>): unknown {
  if (role !== 'sepSimpleActivityEvidenceId') return record
  return Object.fromEntries(SEP_SIMPLE_SEMANTIC_KEYS.map((key) => [key, record[key]]))
}
function validateEvidenceRoles(value: unknown, roles = new Map<string, string>(), semantics = new Map<string, string>()): void {
  if (value === null || typeof value !== 'object') return
  const record = value as Record<string, unknown>
  for (const [key, child] of Object.entries(record)) {
    if ((key === 'evidenceId' || key.endsWith('EvidenceId') || key === 'taxInputSnapshotId') && typeof child === 'string') {
      const role = key === 'evidenceId' ? evidenceRole(record) : key; const priorRole = roles.get(child)
      if (priorRole !== undefined && priorRole !== role) fail('identifierCollision', 'One evidence ID claims incompatible upstream evidence roles.')
      roles.set(child, role)
      if (key === 'evidenceId') { const semantic = canonical(semanticProjection(role, record)); const prior = semantics.get(child)
        if (prior !== undefined && prior !== semantic) fail('identifierCollision', 'One evidence ID claims incompatible upstream evidence facts.')
        semantics.set(child, semantic) }
    } else validateEvidenceRoles(child, roles, semantics)
  }
}
function collectEvidenceIds(value: unknown, ids = new Set<string>()): Set<string> {
  if (value === null || typeof value !== 'object') return ids
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((key === 'evidenceId' || key.endsWith('EvidenceId') || key === 'taxInputSnapshotId') && typeof child === 'string') ids.add(child); else collectEvidenceIds(child, ids)
  } return ids
}
function calculationAuthorityIds(value: unknown, ids = new Set<string>()): string[] {
  if (value === null || typeof value !== 'object') return [...ids].sort(compareUtf16CodeUnits)
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((key === 'evidenceId' || key.endsWith('EvidenceId') || key === 'taxInputSnapshotId') && typeof child === 'string') ids.add(child)
    else calculationAuthorityIds(child, ids)
  }
  return [...ids].sort(compareUtf16CodeUnits)
}
function planScope(plan: Readonly<Plan>, taxYear: number, sourceIds: readonly AccountId[]): string {
  const selected = new Set(sourceIds); const facts = plan.retirementActionEligibilityFacts
  const requests = plan.strategies.retirementActions.filter((entry) => entry.kind === 'qcd' && entry.year === taxYear).sort((a, b) => compareUtf16CodeUnits(a.actionId, b.actionId))
  const donors = new Set<string>(requests.flatMap((entry) => entry.kind === 'qcd' ? [entry.donorPersonId] : []))
  return canonical({ planId: plan.id, taxYear, people: plan.household.people.filter((entry) => donors.has(entry.id)).sort((a, b) => compareUtf16CodeUnits(a.id, b.id)),
    accounts: plan.accounts.filter((entry) => selected.has(entry.id as AccountId)).sort((a, b) => compareUtf16CodeUnits(a.id, b.id)),
    requests,
    iraClassifications: facts?.iraClassifications.filter((entry) => selected.has(entry.sourceAccountId as AccountId)).sort((a, b) => compareUtf16CodeUnits(a.sourceAccountId, b.sourceAccountId)) ?? [],
    sepSimpleActivities: facts?.sepSimpleActivities.filter((entry) => selected.has(entry.sourceAccountId as AccountId) && entry.actionTaxYear === taxYear)
      .sort((a, b) => compareUtf16CodeUnits(a.sourceAccountId, b.sourceAccountId)) ?? [],
    deductibleIraContributions: facts?.deductibleIraContributions.filter((entry) => donors.has(entry.donorPersonId) && entry.taxYear <= taxYear)
      .sort((a, b) => compareUtf16CodeUnits(a.donorPersonId, b.donorPersonId) || a.taxYear - b.taxYear || compareUtf16CodeUnits(a.evidenceId, b.evidenceId)) ?? [] })
}
function bridgedCharacter(character: Readonly<QcdFinalDerivedTaxCharacter>, physical: Readonly<OwnedNonRothIraAnnualQcdPhysicalApplication>, taxCalculationEvidenceId: string): Readonly<AnnualQcdUnifiedDerivedTaxCharacter> {
  const source = character.characterEvidence; const base = { rule: 'qcdUnifiedAnnualPostPass' as const, component: source.component,
    qcdActionId: physical.actionId, allocationId: physical.allocationId, acceptedSourcePrerequisiteEvidenceId: physical.qcdPrerequisiteEvidenceId,
    unifiedPhysicalApplicationEvidenceId: physical.applicationEvidenceId, taxCalculationEvidenceId, segmentAmountCents: character.amountCents }
  const characterEvidence = { ...base, evidenceId: deriveActionStructuralId('annual-qcd-unified-derived-character-segment', [character.kind, physical.sourceAccountId, base]) }
  return deepFreeze({ sourceClass: 'qcd', kind: character.kind, sourceAccountId: physical.sourceAccountId, amountCents: character.amountCents, exactAmountAuthority: 'cents', characterEvidence })
}

function bridge(input: FinalizeAnnualQcdUnifiedTransactionInput): AnnualQcdUnifiedFinalizationBridged {
  const transaction = preparePlanOwnedNonRothIraAnnualPhysicalTransaction(input.physicalTransactionInput)
  if (transaction.status !== 'unifiedAnnualPhysicalTransactionPrepared') fail('unifiedPhysicalInvalid', 'The authoritative unified annual physical transaction did not rebuild.')
  validateEvidenceRoles(input)
  const owner = transaction.ownerPersonId; const capacityAll = input.deductionTreatmentInput.postPassInput.poolCapacityInputs
  const capacityInputs = capacityAll.filter((entry) => entry.ownerPersonId === owner)
  if (capacityInputs.length !== 1) fail('lineFactsInvalid', 'Unified QCD finalization requires exactly one selected-owner Form 8606 pool input.')
  const capacityInput = capacityInputs[0]!; const sourceIds = transaction.sourceBalanceTransitions.map((entry) => entry.sourceAccountId).sort(compareUtf16CodeUnits)
  const globalSourceIds = [...new Set(capacityAll.flatMap((entry) => entry.completePoolEvidence.accountIds))].sort(compareUtf16CodeUnits)
  const transactionPlan = parsePlan(input.physicalTransactionInput.plan); const characterPlan = parsePlan(input.deductionTreatmentInput.postPassInput.physicalInput.plan)
  if (!transactionPlan.ok || !characterPlan.ok || transactionPlan.plan.id !== transaction.planId ||
      planScope(characterPlan.plan, transaction.taxYear, globalSourceIds) !== planScope(transactionPlan.plan, transaction.taxYear, globalSourceIds))
    fail('finalizationInvalid', 'QCD character rebuilding must use the unified transaction\'s canonical calculation-relevant Plan scope.')
  const closingBySource = new Map(transaction.sourceBalanceTransitions.map((entry) => [entry.sourceAccountId, entry.detachedClosingBalance]))
  const closingTotal = transaction.sourceBalanceTransitions.reduce((total, entry) => total + BigInt(entry.detachedClosingBalance), 0n)
  const poolIds = [...capacityInput.completePoolEvidence.accountIds].sort(compareUtf16CodeUnits)
  const poolMembersMatch = capacityInput.poolMembers.length === sourceIds.length && new Set(capacityInput.poolMembers.map((entry) => entry.sourceAccountId)).size === sourceIds.length &&
    capacityInput.poolMembers.every((entry) => entry.ownerPersonId === owner && closingBySource.get(entry.sourceAccountId) === entry.yearEndApplicableBalanceAmount)
  if (!sameEntries(capacityInput.line7Distributions, transaction.line7Entries) || !sameEntries(capacityInput.line8Conversions, transaction.line8Entries) ||
      capacityInput.annualFacts.form8606Line7DistributionAmount !== transaction.line7GrossAmount || capacityInput.annualFacts.form8606Line8NetConversionAmount !== transaction.line8GrossAmount ||
      BigInt(capacityInput.completePoolEvidence.yearEndApplicablePoolBalanceAmount) !== closingTotal || BigInt(capacityInput.annualFacts.yearEndApplicablePoolBalanceAmount) !== closingTotal ||
      canonical(poolIds) !== canonical(sourceIds) || !poolMembersMatch) fail('lineFactsInvalid', 'QCD finalization must consume exact unified owner-pool closing balances and line 7/line 8 facts.')
  const finalized = finalizeAnnualQcdDerivedTaxCharacter(input.deductionTreatmentInput)
  if (finalized.status !== 'annualQcdDerivedTaxCharacterFinal' || finalized.taxYear !== transaction.taxYear)
    fail('finalizationInvalid', `The QCD tax calculation chain did not rebuild: ${finalized.issues[0]?.detail ?? 'tax year mismatch'}`)
  const authoritySet = new Set(calculationAuthorityIds({ capacityAll, itemizedTaxUnits: input.deductionTreatmentInput.itemizedTaxUnits,
    itemizedLiabilitySources: input.deductionTreatmentInput.itemizedLiabilitySources, standardTaxUnits: input.deductionTreatmentInput.standardTaxUnits }))
  for (const action of finalized.actions) {
    const prerequisiteEvidenceId = deriveActionStructuralId('annual-qcd-execution-prerequisite', [action.prerequisiteEvidence])
    const post = action.postPassApplication; const deduction = action.deductionTreatmentEvidence.deductionTreatment
    const residualFacts = { actionId: action.actionId, allocationId: action.allocationId, donorPersonId: action.donorPersonId,
      sourceAccountId: action.sourceAccountId, charitableDistributionAmount: post.charitableDistributionAmount,
      otherwiseTaxableAmountBefore: post.otherwiseTaxableAmountBefore, otherwiseTaxableAmountUsed: post.otherwiseTaxableAmountUsed,
      otherwiseTaxableAmountAfter: post.otherwiseTaxableAmountAfter, excludableQcdAmount: post.excludableQcdAmount,
      taxableQcdAmount: post.taxableQcdAmount, nonQcdCharitableRemainder: post.nonQcdCharitableRemainder,
      residualAllocation: action.residualRemainderBinding === null ? null : { grossAmount: action.residualRemainderBinding.allocation.grossAmount,
        allocatedBasisAmount: action.residualRemainderBinding.allocation.allocatedBasisAmount, taxableAmount: action.residualRemainderBinding.allocation.taxableAmount } }
    const residualAuthorityId = deriveActionStructuralId('annual-qcd-unified-residual-calculation-authority', [prerequisiteEvidenceId, post.capacityEvidenceId,
      post.personalLimitEvidenceId, residualFacts])
    const deductionFacts = { actionId: action.actionId, filingTreatment: action.deductionTreatmentEvidence.filingTreatment,
      treatment: deduction.treatment, taxUnitId: 'taxUnitId' in deduction ? deduction.taxUnitId : null,
      eligibleContributionCents: deduction.eligibleContributionCents, currentYearClaimedDeductionCents: deduction.currentYearClaimedDeductionCents,
      limitationCarryforwardCents: deduction.limitationCarryforwardCents, unclaimedWithoutCarryforwardCents: deduction.unclaimedWithoutCarryforwardCents }
    const deductionAuthorityId = deriveActionStructuralId('annual-qcd-unified-deduction-calculation-authority', [residualAuthorityId,
      [...authoritySet].sort(compareUtf16CodeUnits), deductionFacts])
    for (const id of [prerequisiteEvidenceId, post.capacityEvidenceId, post.personalLimitEvidenceId, residualAuthorityId, deductionAuthorityId]) authoritySet.add(id)
  }
  const globalAuthorityEvidenceIds = [...authoritySet].sort(compareUtf16CodeUnits)
  const unified = transaction.applications.filter((entry): entry is Readonly<OwnedNonRothIraAnnualQcdPhysicalApplication> => entry.lineScope === 'qcdCharitableDistributions')
  const finalForOwner = finalized.actions.filter((entry) => entry.donorPersonId === owner)
  if (unified.length === 0) fail('actionJoinInvalid', 'Unified QCD finalization requires selected-owner QCD physical members.')
  const finalByAction = new Map(finalForOwner.map((entry) => [entry.actionId, entry])); const credits = new Map(transaction.stagedQcdCharityCredits.map((entry) => [entry.actionId, entry]))
  if (unified.length !== finalForOwner.length || finalByAction.size !== finalForOwner.length || credits.size !== unified.length)
    fail('actionJoinInvalid', 'Every selected-owner QCD must have one unified debit, charity credit, and tax calculation member.')
  const claimed = collectEvidenceIds({ input, transaction, finalized }); const generated = new Set<string>()
  const actions = unified.map((physical) => {
    const final = finalByAction.get(physical.actionId); const credit = credits.get(physical.actionId); const request = final?.physicalApplication.request
    if (final === undefined || credit === undefined || request === undefined || final.allocationId !== physical.allocationId || final.sourceAccountId !== physical.sourceAccountId ||
        request.executionDate !== physical.scheduledDate || request.executionSequence !== physical.scheduledSequence || request.requestedAmount !== physical.requestedAmount ||
        final.physicalApplication.executedAmount !== physical.executedAmount || final.postPassApplication.charitableDistributionAmount !== physical.executedAmount ||
        final.physicalApplication.prerequisiteEvidenceId !== physical.qcdPrerequisiteEvidenceId || canonical(final.prerequisiteEvidence) !== canonical(physical.qcdPrerequisiteEvidence) ||
        credit.inventoryEventId !== physical.inventoryEventId || credit.allocationId !== physical.allocationId || credit.sourceAccountId !== physical.sourceAccountId ||
        credit.stagedCreditAmount !== physical.executedAmount || credit.evidenceId !== physical.charityCreditEvidenceId)
      fail('actionJoinInvalid', 'Final QCD calculation does not exactly rejoin the unified action, allocation, source, date, sequence, amount, prerequisite, and charity credit.')
    const post = final.postPassApplication; const deduction = final.deductionTreatmentEvidence.deductionTreatment
    const calculation = { otherwiseTaxableAmountBefore: post.otherwiseTaxableAmountBefore, otherwiseTaxableAmountUsed: post.otherwiseTaxableAmountUsed,
      otherwiseTaxableAmountAfter: post.otherwiseTaxableAmountAfter, personalLimitBefore: post.personalLimitBefore, personalLimitUsed: post.personalLimitUsed,
      personalLimitAfter: post.personalLimitAfter, deductibleContributionOffsetBefore: post.deductibleContributionOffsetBefore,
      deductibleContributionOffsetApplied: post.deductibleContributionOffsetApplied, deductibleContributionOffsetAfter: post.deductibleContributionOffsetAfter,
      excludableQcdAmount: post.excludableQcdAmount, taxableQcdAmount: post.taxableQcdAmount, nonQcdCharitableRemainder: post.nonQcdCharitableRemainder,
      charitableDeductionEligibleAmount: post.charitableDeductionEligibleAmount, filingTreatment: final.deductionTreatmentEvidence.filingTreatment,
      deductionTreatment: deduction.treatment, currentYearClaimedDeductionCents: asUsdCents(deduction.currentYearClaimedDeductionCents),
      limitationCarryforwardCents: asUsdCents(deduction.limitationCarryforwardCents), unclaimedWithoutCarryforwardCents: asUsdCents(deduction.unclaimedWithoutCarryforwardCents),
      authorityEvidenceIds: globalAuthorityEvidenceIds }
    const taxCalculation = deepFreeze({ ...calculation, evidenceId: deriveActionStructuralId('annual-qcd-unified-tax-calculation', [physical.applicationEvidenceId, calculation]) })
    const derivedTaxCharacter = final.derivedTaxCharacter.map((entry) => bridgedCharacter(entry, physical, taxCalculation.evidenceId))
    for (const id of [taxCalculation.evidenceId, ...derivedTaxCharacter.map((entry) => entry.characterEvidence.evidenceId)]) {
      if (claimed.has(id) || generated.has(id)) fail('identifierCollision', 'Unified QCD calculation evidence ID collides with nested evidence.'); generated.add(id)
    }
    const base = { predicate: 'annualQcdUnifiedFinalizationAction' as const, actionId: physical.actionId, unifiedPhysicalApplicationEvidenceId: physical.applicationEvidenceId,
      unifiedTransactionEvidenceId: transaction.transactionEvidenceId, unifiedPhysicalApplication: physical, acceptedSourceEligibility: final.acceptedSourceEligibility,
      taxCalculation, derivedTaxCharacter }
    const evidenceId = deriveActionStructuralId('annual-qcd-unified-finalization-action', [base])
    if (claimed.has(evidenceId) || generated.has(evidenceId)) fail('identifierCollision', 'Unified QCD action evidence ID collides with nested evidence.'); generated.add(evidenceId)
    return deepFreeze({ ...base, evidenceId })
  })
  const base = { status: 'annualQcdUnifiedFinalizationBridged' as const, committed: false as const, movement: 'notCommitted' as const,
    actionability: 'notEstablished' as const, publicationStatus: 'notOwnedByUnifiedFinalization' as const, taxYear: transaction.taxYear,
    transactionEvidenceId: transaction.transactionEvidenceId, actions, issues: [] as const }
  const evidenceId = deriveActionStructuralId('annual-qcd-unified-finalization', [base])
  if (claimed.has(evidenceId) || generated.has(evidenceId)) fail('identifierCollision', 'Unified QCD finalization evidence ID collides with nested evidence.')
  return deepFreeze({ ...base, evidenceId })
}
/** Rebuilds QCD tax character against the unified physical chronology without publishing or committing it. */
export function finalizeAnnualQcdUnifiedTransaction(input: Readonly<FinalizeAnnualQcdUnifiedTransactionInput>): Readonly<FinalizeAnnualQcdUnifiedTransactionResult> {
  try { return bridge(structuredClone(input) as FinalizeAnnualQcdUnifiedTransactionInput) } catch (error) { return blocked(error) }
}
