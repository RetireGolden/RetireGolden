import { describe, expect, it, vi } from 'vitest'
import { describeRule } from '../rules/describeRule.js'
import { parsePlan, type Plan } from '../model/plan.js'
import { couplePlan, traditionalAccount } from '../testing/planFixtures.js'
import type { RetirementActionEligibilityRuntimeEvidence } from '../strategies/accountEligibility.js'
import type { AnnualQcdItemizedLiabilitySourceInput } from './annualQcdItemizedLiabilityReconciliation.js'
import type { AnnualQcdItemizedSection170TaxUnitInput } from './annualQcdItemizedSection170Ledger.js'
import type { AnnualQcdRmdPoolOpeningSnapshot } from './annualQcdPhysicalExecution.js'
import { publishAnnualQcdActionExecutionEvidence } from './annualQcdActionExecutionEvidence.js'
import { evaluateAnnualQcdExecutionPrerequisites } from './annualQcdExecutionPrerequisite.js'
import type { CoordinateAnnualQcdDeductionTreatmentInput } from './annualQcdDeductionTreatmentCoordinator.js'
import { publishAnnualRetirementActions } from './annualRetirementActionPublication.js'
import type { QualifiedCharitableDistributionRequest } from './contract.js'
import type { FinalizeAnnualQcdUnifiedTransactionInput } from './annualQcdUnifiedTransactionFinalization.js'
import type { ClassifyOwnedNonRothIraAnnualWithdrawalsInput } from './ownedNonRothIraWithdrawalCharacter.js'
import { asAccountId, asActionId, asAllocationId, asPersonId, asPlanId } from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import type { PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput } from './ownedNonRothIraAnnualPhysicalTransaction.js'
import * as structuralId from './structuralId.js'

const year = 2026; const p1 = asPersonId('p1'); const p2 = asPersonId('p2')
const ira1 = asAccountId('ira-p1'); const ira2 = asAccountId('ira-p2')
const charity = { name: 'Public charity', designationKind: 'eligiblePublicCharity' as const, directFromCustodianAttested: true,
  eligibleOrganizationAttested: true, notDonorAdvisedFundOrSupportingOrganizationAttested: true,
  notSplitInterestEntityAttested: true, entireDistributionOtherwiseDeductibleAttested: true }
function qcd(id: string, donorPersonId: typeof p1, sourceAccountId: typeof ira1, date: string, sequence: number): QualifiedCharitableDistributionRequest {
  return { actionId: asActionId(id), kind: 'qcd', year, executionDate: date, executionSequence: sequence,
    requestedAmount: asPositiveUsdCents(5_000), provenance: { source: 'manual' }, donorPersonId,
    allocation: { allocationId: asAllocationId(`allocation-${id}`), sourceAccountId, requestedAmount: asPositiveUsdCents(5_000) },
    charity: { ...charity, designationId: `charity-${id}` } }
}
interface FixtureOptions { readonly scheduleConflict?: boolean; readonly p1Contribution?: number; readonly p1Dob?: string }
function fixture(p1Opening = 10_000, options: FixtureOptions = {}): { inputs: FinalizeAnnualQcdUnifiedTransactionInput[]; requests: QualifiedCharitableDistributionRequest[] } {
  const requests = [qcd('qcd-p1', p1, ira1, '2026-04-01', 10), qcd('qcd-p2', p2, ira2,
    options.scheduleConflict ? '2026-04-01' : '2026-05-01', options.scheduleConflict ? 10 : 20)]
  const plan = couplePlan({ p1Dob: options.p1Dob ?? '1955-01-01', p2Dob: '1955-01-01', p1PlanningAge: 100, p2PlanningAge: 100 })
  plan.id = asPlanId('joint-qcd-plan'); plan.accounts = [traditionalAccount(ira1, 100, p1), traditionalAccount(ira2, 100, p2)]
  plan.strategies.retirementActions = requests
  plan.retirementActionEligibilityFacts = { iraClassifications: [ira1, ira2].map((sourceAccountId, index) => ({ sourceAccountId,
    subtype: 'traditional' as const, evidenceId: `classification-p${index + 1}`, provenance: { source: 'manual' as const } })), sepSimpleActivities: [],
  deductibleIraContributions: [p1, p2].flatMap((donorPersonId, index) =>
    (donorPersonId === p1 && options.p1Dob !== undefined ? [year] : [2025, year]).map((taxYear) => ({ donorPersonId, taxYear,
    amountCents: asUsdCents(donorPersonId === p1 && taxYear === year ? options.p1Contribution ?? 0 : 0),
    evidenceId: `contribution-p${index + 1}-${taxYear}`, provenance: { source: 'manual' as const, sourceId: `ledger-p${index + 1}-${taxYear}` } }))) }
  const runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = { personAliveEvidence: requests.map((request) => ({ evidenceId: `alive-${request.actionId}`,
    actionId: request.actionId, personId: request.donorPersonId, actionYear: year, actionDate: request.executionDate!, alive: true })),
  priorQcdOffsetEvidence: requests.map((request) => ({ evidenceId: `offset-${request.actionId}`, actionId: request.actionId,
    donorPersonId: request.donorPersonId, actionYear: year, actionDate: request.executionDate!, priorOffsetApplied: asUsdCents(0) })) }
  const parsed = parsePlan(plan); if (!parsed.ok) throw new Error('invalid Plan fixture')
  const prerequisite = evaluateAnnualQcdExecutionPrerequisites({ taxYear: year, plan: parsed.plan, requests, runtimeEvidence })
  if (prerequisite.status !== 'evaluated') throw new Error('invalid prerequisite fixture')
  const remaining = (opening: number) => Math.max(opening - 5_000, 0)
  const capacity = (ownerPersonId: typeof p1, sourceAccountId: typeof ira1, suffix: string, opening: number): ClassifyOwnedNonRothIraAnnualWithdrawalsInput => ({
    ownerPersonId, ownerWideNonRothIraPoolId: `pool-${suffix}`, completePoolEvidence: { predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
      ownerPersonId, ownerWideNonRothIraPoolId: `pool-${suffix}`, taxYear: year, accountIds: [sourceAccountId],
      yearEndApplicablePoolBalanceAmount: asUsdCents(remaining(opening)), evidenceId: `complete-${suffix}` }, annualBasisRecordEvidenceId: `basis-${suffix}`, taxYear: year,
    poolMembers: [{ sourceAccountId, ownerPersonId, accountType: 'traditional', accountKind: 'ira', inheritanceStatus: 'owned', subtype: 'traditional',
      yearEndApplicableBalanceAmount: asUsdCents(remaining(opening)), iraClassificationEvidenceId: `tax-class-${suffix}`, accountOwnershipEvidenceId: `owner-${suffix}` }],
    annualFacts: { openingBasisAmount: asUsdCents(0), taxYearNondeductibleContributionAmount: asUsdCents(0), postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
      yearEndApplicablePoolBalanceAmount: asUsdCents(remaining(opening)), outstandingRolloverAmount: asUsdCents(0), rolloverRepaymentAdjustmentAmount: asUsdCents(0),
      form8606Line7DistributionAmount: asUsdCents(0), form8606Line8NetConversionAmount: asUsdCents(0) }, line7Distributions: [], line8Conversions: [] })
  const taxUnit: AnnualQcdItemizedSection170TaxUnitInput = { taxUnit: { taxUnitId: 'joint-unit', taxUnitMemberPersonIds: [p1, p2],
    federalFilingStatus: 'marriedFilingJointly', stateFilingStatusId: 'joint-state', taxUnitEvidenceId: 'joint-unit-evidence', taxYear: year },
    annualTaxLiabilityEvidenceId: 'joint-liability', taxInputSnapshotId: 'joint-tax-input', liabilityRun: { liabilityRunKind: 'committedAnnual', candidateFundingVectorEvidenceId: null },
    contributionBaseCents: 100_000_000, priorItemizerFloorAppliedCents: 0, priorCashPercentageLimitUsedCents: 0, openingPostOtherLimitItemizedDeductionCents: 500,
    floorCarryforwardEligibility: requests.map((request) => ({ actionId: request.actionId, eligible: true, evidenceId: `carry-${request.actionId}` })) }
  const liability: AnnualQcdItemizedLiabilitySourceInput = { taxUnitId: 'joint-unit', taxYear: year, filingStatus: 'marriedFilingJointly',
    annualTaxLiabilityEvidenceId: 'joint-liability', taxInputSnapshotId: 'joint-tax-input', liabilityRun: taxUnit.liabilityRun,
    adjustedGrossIncomeBeforeCharitableDeductionCents: 100_000_000, qualifiedBusinessIncomeDeductionCents: 0,
    qualifiedBusinessIncomeComputedWithoutSection68: true, additionalSchedule1ADeductionCents: 0, standardDeductionCents: 3_000_000,
    selectedFilingTreatment: 'itemized', selectedItemizationEvidenceId: 'joint-itemization', adjustedGrossIncomeEvidenceId: 'joint-agi',
    qualifiedBusinessIncomeEvidenceId: 'joint-qbi', additionalSchedule1AEvidenceId: 'joint-schedule1a', standardDeductionEvidenceId: 'joint-standard',
    section170SourceBindings: { contributionBaseEvidenceId: 'joint-base', priorFloorUseEvidenceId: 'joint-floor',
      priorCashPercentageUseEvidenceId: 'joint-cash', openingItemizedDeductionEvidenceId: 'joint-opening' } }
  const owners = [[p1, ira1, 'p1', p1Opening], [p2, ira2, 'p2', 10_000]] as const
  const rmdPools: AnnualQcdRmdPoolOpeningSnapshot[] = owners.map(([donorPersonId, sourceAccountId, suffix]) => ({
    predicate: 'annualQcdOwnedIraRmdPoolOpeningSnapshot', poolId: `rmd-${suffix}`, taxYear: year, donorPersonId, scope: 'ownedIra', sourceAccountIds: [sourceAccountId],
    rmdRequiredAmount: asUsdCents(0), rmdSatisfiedBefore: asUsdCents(0), rmdRemainingBefore: asUsdCents(0), upstreamEvidenceId: `rmd-source-${suffix}` }))
  const deductionTreatmentInput: CoordinateAnnualQcdDeductionTreatmentInput = { postPassInput: { physicalInput: { prerequisite, plan: parsed.plan, runtimeEvidence,
    openingBalances: owners.map(([, accountId, , opening]) => ({ accountId, openingBalance: asUsdCents(Math.min(opening, 5_000)) })), rmdPools },
    poolCapacityInputs: owners.map(([personId, accountId, suffix, opening]) => capacity(personId, accountId, suffix, opening)) },
    itemizedTaxUnits: [taxUnit], itemizedLiabilitySources: [liability], standardTaxUnits: [] }
  const common = { plan, taxYear: year, runtimeRecords: [], runtimeInventoryAttestation: { predicate: 'completeAnnualRetirementPhysicalEventInventory' as const,
    planId: asPlanId(plan.id), taxYear: year, ledgerRunId: 'joint-ledger', inventoryStatus: 'completeIncludingExplicitEmpty' as const,
    resolvedEventIds: [], unresolvedActivityIds: [], evidenceId: 'joint-inventory', upstreamEvidenceId: 'joint-inventory-upstream' } }
  const inputs = owners.map(([ownerPersonId, accountId, , opening]) => ({ physicalTransactionInput: { ...common, ownerPersonId,
    openingBalances: [{ accountId, openingBalance: asUsdCents(opening) }], actualApplications: [], settledContributionApplications: [],
    qcdPrerequisiteInput: { taxYear: year, plan, requests, runtimeEvidence } } satisfies PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput,
    deductionTreatmentInput }))
  return { inputs, requests }
}

describe('publishAnnualQcdActionExecutionEvidence', () => {
  it('publishes the exact multi-owner Plan QCD union as a rich canonical qcdExecutor source', () => {
    const { inputs, requests } = fixture(); const before = structuredClone(inputs)
    const result = publishAnnualQcdActionExecutionEvidence({ ownerFinalizationInputs: inputs })
    if (result.status !== 'annualQcdActionExecutionEvidencePublished') throw new Error(result.issues[0].detail)
    expect(result.actions.map((action) => [action.actionId, action.executedAmount, action.disposition.outcome])).toEqual([
      ['qcd-p1', 5_000, 'executed'], ['qcd-p2', 5_000, 'executed']])
    expect(result.actions.every((action) => action.taxCharacter.reduce((sum, segment) => sum + segment.amountCents, 0) === action.executedAmount &&
      action.taxCharacter.every((segment) => segment.characterEvidence.unifiedPhysicalApplicationEvidenceId === action.allocation.unifiedPhysicalApplicationEvidenceId) &&
      action.taxCalculation.authorityEvidenceIds.includes('joint-unit-evidence') && action.acceptedSourceEligibility.donorPersonId === action.donorPersonId &&
      action.acceptedSourceEligibility.sourceIraAccountId === action.allocation.sourceAccountId)).toBe(true)
    expect(result.actions[0]).toMatchObject({ kind: 'qcd', personId: 'p1', donorPersonId: 'p1', sourceIraAccountId: 'ira-p1', year: 2026,
      derivedFactsStatus: 'complete', charitableDistributionAmount: 5_000, qualifiedCharitableDistributionAmount: 5_000,
      exactAgeOnScheduledDate: 71.25, exactAgeOnExecutedDate: 71.25,
      scheduledAgeEligibilityEvidence: { predicate: 'qcdEligibilityDate', dateRole: 'scheduled', birthDate: '1955-01-01',
        evaluationDate: '2026-04-01', thresholdMonthCount: 846, exactAgeOnEvaluationDate: 71.25, reachedAge70Half: true },
      executedAgeEligibilityEvidence: { dateRole: 'executed', evaluationDate: '2026-04-01' }, rmdSatisfiedAmount: 0,
      rmdPool: { scope: 'donorOwnedIraRmdPool', accountIds: ['ira-p1'] }, taxablePool: { scope: 'donorOwnedNonRothIras', accountIds: ['ira-p1'] },
      charitableDeductionTreatment: { treatment: 'notApplicable', eligibleContributionAmount: 0 },
      penalty: [], penaltyCoverage: [{ reason: 'qcdDirectTransfer', executedAmount: 5_000 }] })
    expect(result.actions[0]!.qcdPrerequisiteEvidenceId).not.toBe(result.actions[0]!.unifiedPhysicalApplicationEvidenceId)
    expect(result).toMatchObject({ committed: false, movement: 'notCommitted', actionability: 'established', publicationStatus: 'qcdExecutorSourceReady',
      publicationSource: { executorSource: 'qcdExecutor', scheduleDiagnostics: [] } })
    expect(publishAnnualRetirementActions({ taxYear: year, requests, sources: [result.publicationSource] })!.records.map((record) => record.actionId))
      .toEqual(['qcd-p1', 'qcd-p2'])
    expect(result).not.toHaveProperty('records'); expect(inputs).toEqual(before); expect(Object.isFrozen(result.actions[0]!.taxCalculation)).toBe(true)
  })

  it('publishes balance-trimmed and unavailable dispositions without inventing movement', () => {
    const partial = publishAnnualQcdActionExecutionEvidence({ ownerFinalizationInputs: fixture(3_000).inputs })
    expect(partial.status).toBe('annualQcdActionExecutionEvidencePublished'); expect(partial.actions[0]).toMatchObject({ actionId: 'qcd-p1', executedAmount: 3_000,
      unexecutedAmount: 2_000, disposition: { outcome: 'partial', readiness: 'actionable', reasons: [{ code: 'qcd-balance-trimmed' }] },
      allocation: { balanceBefore: 3_000, balanceAfter: 0 } })
    const refused = publishAnnualQcdActionExecutionEvidence({ ownerFinalizationInputs: fixture(0).inputs })
    expect(refused.status).toBe('annualQcdActionExecutionEvidencePublished'); expect(refused.actions[0]).toMatchObject({ actionId: 'qcd-p1', executedAmount: 0,
      disposition: { outcome: 'refused', readiness: 'nonActionable', reasons: [{ code: 'qcd-balance-unavailable' }] }, taxCharacter: [],
      exactAgeOnScheduledDate: 71.25, exactAgeOnExecutedDate: null, executedAgeEligibilityEvidence: null, rmdSatisfiedAmount: 0, penaltyCoverage: [] })
    const adjusted = publishAnnualQcdActionExecutionEvidence({ ownerFinalizationInputs: fixture(10_000, { p1Contribution: 1_000 }).inputs })
    expect(adjusted.status).toBe('annualQcdActionExecutionEvidencePublished'); expect(adjusted.actions[0]).toMatchObject({
      deductibleContributionOffsetApplied: 1_000, disposition: { outcome: 'executed', reasons: [{ code: 'qcd-contribution-offset-applied' }] } })
  })

  it('rejects incomplete/duplicate owner unions and reserves every upstream identity role', () => {
    const { inputs } = fixture()
    expect(publishAnnualQcdActionExecutionEvidence({ ownerFinalizationInputs: [inputs[0]!] })).toMatchObject({
      status: 'annualQcdActionExecutionEvidenceBlocked', issues: [{ kind: 'batchInvalid' }] })
    expect(publishAnnualQcdActionExecutionEvidence({ ownerFinalizationInputs: [inputs[0]!, inputs[0]!] })).toMatchObject({
      status: 'annualQcdActionExecutionEvidenceBlocked', issues: [{ kind: 'batchInvalid' }] })
    const mixedPlans = structuredClone(inputs); mixedPlans[1] = structuredClone(mixedPlans[1]!); const mixedPlan = mixedPlans[1]!.physicalTransactionInput.plan as Plan
    mixedPlan.accounts[0]!.name = 'Foreign Plan account'
    mixedPlans[1]!.deductionTreatmentInput.postPassInput.physicalInput.plan.accounts[0]!.name = 'Foreign Plan account'
    expect(publishAnnualQcdActionExecutionEvidence({ ownerFinalizationInputs: mixedPlans })).toMatchObject({
      status: 'annualQcdActionExecutionEvidenceBlocked', issues: [{ kind: 'batchInvalid' }] })
    const globalDrift = structuredClone(inputs); globalDrift[1] = structuredClone(globalDrift[1]!)
    Object.assign(globalDrift[1]!.deductionTreatmentInput.postPassInput.poolCapacityInputs[1]!, { annualBasisRecordEvidenceId: 'basis-p2-foreign' })
    expect(publishAnnualQcdActionExecutionEvidence({ ownerFinalizationInputs: globalDrift })).toMatchObject({
      status: 'annualQcdActionExecutionEvidenceBlocked', issues: [{ kind: 'batchInvalid' }] })
    const inventoryDrift = structuredClone(inputs); inventoryDrift[1] = structuredClone(inventoryDrift[1]!)
    Object.assign(inventoryDrift[1]!.physicalTransactionInput.runtimeInventoryAttestation, { upstreamEvidenceId: 'foreign-inventory-upstream' })
    expect(publishAnnualQcdActionExecutionEvidence({ ownerFinalizationInputs: inventoryDrift })).toMatchObject({
      status: 'annualQcdActionExecutionEvidenceBlocked', issues: [{ kind: 'batchInvalid' }] })
    const stagingCollision = structuredClone(inputs)
    Object.assign(stagingCollision[0]!.physicalTransactionInput, { actualApplications: [{ inventoryEventId: 'event-p1', sourceBalanceBefore: asUsdCents(10_000),
      executedAmount: asUsdCents(1_000), sourceBalanceAfter: asUsdCents(9_000), stagingEvidenceId: 'shared-owner-staging' }] })
    Object.assign(stagingCollision[1]!.physicalTransactionInput, { actualApplications: [{ inventoryEventId: 'event-p2', sourceBalanceBefore: asUsdCents(20_000),
      executedAmount: asUsdCents(2_000), sourceBalanceAfter: asUsdCents(18_000), stagingEvidenceId: 'shared-owner-staging' }] })
    expect(publishAnnualQcdActionExecutionEvidence({ ownerFinalizationInputs: stagingCollision })).toMatchObject({
      status: 'annualQcdActionExecutionEvidenceBlocked', issues: [{ kind: 'identifierCollision' }] })
    expect(publishAnnualQcdActionExecutionEvidence({ ownerFinalizationInputs: fixture(10_000, { scheduleConflict: true }).inputs })).toMatchObject({
      status: 'annualQcdActionExecutionEvidenceBlocked' })
    const original = structuralId.deriveActionStructuralId
    const spy = vi.spyOn(structuralId, 'deriveActionStructuralId').mockImplementation((prefix, parts) =>
      prefix === 'annual-qcd-action-execution-evidence' ? 'joint-tax-input' : original(prefix, parts))
    try { expect(publishAnnualQcdActionExecutionEvidence({ ownerFinalizationInputs: fixture().inputs })).toMatchObject({
      status: 'annualQcdActionExecutionEvidenceBlocked', issues: [{ kind: 'identifierCollision' }] }) } finally { spy.mockRestore() }
  })

  it('is owner-input and request-property-order invariant', () => {
    const { inputs } = fixture(); const forward = publishAnnualQcdActionExecutionEvidence({ ownerFinalizationInputs: inputs })
    const reversed = structuredClone(inputs).reverse(); const first = reversed[0]!
    const prerequisiteInput = first.physicalTransactionInput.qcdPrerequisiteInput
    if (prerequisiteInput === undefined) throw new Error('missing fixture prerequisite input')
    const request = prerequisiteInput.requests[0]!
    const reordered = { charity: request.charity, allocation: request.allocation,
      donorPersonId: request.donorPersonId, provenance: request.provenance, requestedAmount: request.requestedAmount,
      executionSequence: request.executionSequence, executionDate: request.executionDate, year: request.year, kind: request.kind, actionId: request.actionId }
    reversed[0] = { ...first, physicalTransactionInput: { ...first.physicalTransactionInput,
      qcdPrerequisiteInput: { ...prerequisiteInput, requests: [reordered, ...prerequisiteInput.requests.slice(1)] } } }
    expect(publishAnnualQcdActionExecutionEvidence({ ownerFinalizationInputs: reversed })).toEqual(forward)
    const threshold = publishAnnualQcdActionExecutionEvidence({ ownerFinalizationInputs: fixture(10_000, { p1Dob: '1955-10-01' }).inputs })
    expect(threshold.status).toBe('annualQcdActionExecutionEvidencePublished'); expect(threshold.actions[0]).toMatchObject({ actionId: 'qcd-p1',
      exactAgeOnScheduledDate: 70.5, scheduledAgeEligibilityEvidence: { age70HalfThresholdDate: '2026-04-01' } })
    expect(publishAnnualQcdActionExecutionEvidence({ ownerFinalizationInputs: fixture(10_000, { p1Dob: '1955-10-02' }).inputs }))
      .toMatchObject({ status: 'annualQcdActionExecutionEvidenceBlocked' })
  })

  // No authority resolves what "six calendar months after" means when the
  // target day does not exist, and the regulation that once defined attainment
  // was withdrawn in 2025. A 31 August birth is the widest case: clamping to
  // the last day of February lands three days before a roll-forward reading,
  // and a QCD taken inside that window would not be a QCD at all. The clamp is
  // an engineering convention — see the registry record's conventionRationale —
  // not a legal conclusion.
  describeRule('irc-408-d-8-B-ii-age-70-half', {
    readings: { monthEndClamp: '2026-02-28', rollForwardIntoMarch: '2026-03-03' },
    accepted: 'monthEndClamp',
  }, ({ accepted, readings }) => {
    it('clamps a nonexistent target day to the last day of that month', () => {
      const result = publishAnnualQcdActionExecutionEvidence({
        ownerFinalizationInputs: fixture(10_000, { p1Dob: '1955-08-31' }).inputs,
      })
      expect(result.status).toBe('annualQcdActionExecutionEvidencePublished')
      if (result.status !== 'annualQcdActionExecutionEvidencePublished') return
      const threshold = result.actions[0]!.scheduledAgeEligibilityEvidence.age70HalfThresholdDate
      expect(threshold).toBe(accepted)
      expect(threshold).not.toBe(readings.rollForwardIntoMarch)
    })
  })
})
