import { describe, expect, it, vi } from 'vitest'
import { parsePlan, type Plan } from '../model/plan.js'
import { couplePlan, singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import type { RetirementActionEligibilityRuntimeEvidence } from '../strategies/accountEligibility.js'
import type { AnnualQcdItemizedLiabilitySourceInput } from './annualQcdItemizedLiabilityReconciliation.js'
import type { AnnualQcdItemizedSection170TaxUnitInput } from './annualQcdItemizedSection170Ledger.js'
import type { QualifiedCharitableDistributionRequest } from './contract.js'
import { evaluateAnnualQcdExecutionPrerequisites } from './annualQcdExecutionPrerequisite.js'
import { stageAnnualQcdPhysicalExecution, type AnnualQcdRmdPoolOpeningSnapshot } from './annualQcdPhysicalExecution.js'
import {
  finalizeAnnualQcdUnifiedTransaction,
  type FinalizeAnnualQcdUnifiedTransactionInput,
} from './annualQcdUnifiedTransactionFinalization.js'
import { buildAnnualRetirementPhysicalEventInventory } from './annualRetirementPhysicalEventInventory.js'
import type { CoordinateAnnualQcdDeductionTreatmentInput } from './annualQcdDeductionTreatmentCoordinator.js'
import { asAccountId, asActionId, asAllocationId, asPersonId, asPlanId } from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import {
  preparePlanOwnedNonRothIraAnnualPhysicalTransaction,
  type PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput,
} from './ownedNonRothIraAnnualPhysicalTransaction.js'
import type { ClassifyOwnedNonRothIraAnnualWithdrawalsInput } from './ownedNonRothIraWithdrawalCharacter.js'
import * as structuralId from './structuralId.js'

const year = 2026; const owner = asPersonId('owner'); const source = asAccountId('traditional-a')
const sibling = asAccountId('traditional-b'); const roth = asAccountId('roth')
const charity = { designationId: 'charity', name: 'Public charity', designationKind: 'eligiblePublicCharity' as const,
  directFromCustodianAttested: true, eligibleOrganizationAttested: true,
  notDonorAdvisedFundOrSupportingOrganizationAttested: true, notSplitInterestEntityAttested: true,
  entireDistributionOtherwiseDeductibleAttested: true }
function qcd(id: string, date: string, sequence: number, donorPersonId = owner, sourceAccountId = source): QualifiedCharitableDistributionRequest {
  return { actionId: asActionId(id), kind: 'qcd', year, executionDate: date, executionSequence: sequence,
    requestedAmount: asPositiveUsdCents(5_000), provenance: { source: 'manual' }, donorPersonId,
    allocation: { allocationId: asAllocationId(`allocation-${id}`), sourceAccountId,
      requestedAmount: asPositiveUsdCents(5_000) }, charity: { ...charity, designationId: `charity-${id}` } }
}
function physicalFixture(): { input: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput; requests: readonly QualifiedCharitableDistributionRequest[];
  runtimeEvidence: RetirementActionEligibilityRuntimeEvidence } {
  const requests = [qcd('qcd-first', '2026-04-01', 20), qcd('qcd-second', '2026-08-01', 40)]
  const plan = singlePersonPlan({ dob: '1955-01-01', planningAge: 100 }); plan.id = asPlanId('qcd-finalization-plan'); plan.household.people[0]!.id = owner
  plan.accounts = [traditionalAccount(source, 300, owner), traditionalAccount(sibling, 200, owner),
    { type: 'roth', id: roth, name: 'Roth', ownerPersonId: owner, annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 }]
  plan.strategies.retirementActions = [
    { actionId: asActionId('withdrawal'), kind: 'ordinaryWithdrawal', year, executionDate: '2026-02-01', executionSequence: 10,
      requestedAmount: asPositiveUsdCents(4_000), provenance: { source: 'manual' }, personId: owner,
      allocations: [{ allocationId: asAllocationId('withdrawal-a'), sourceAccountId: source, requestedAmount: asPositiveUsdCents(4_000) }], purpose: { kind: 'spending' } },
    requests[0]!, { actionId: asActionId('conversion'), kind: 'rothConversion', year, executionDate: '2026-06-01', executionSequence: 30,
      requestedAmount: asPositiveUsdCents(3_000), provenance: { source: 'manual' }, personId: owner,
      allocations: [{ allocationId: asAllocationId('conversion-a'), sourceAccountId: source, requestedAmount: asPositiveUsdCents(3_000) }],
      destinationRothAccountId: roth, taxFunding: { kind: 'noneExpected' } }, requests[1]!,
  ]
  plan.retirementActionEligibilityFacts = { iraClassifications: [{ sourceAccountId: source, subtype: 'traditional', evidenceId: 'classification', provenance: { source: 'manual' } }],
    sepSimpleActivities: [], deductibleIraContributions: [
      { donorPersonId: owner, taxYear: 2025, amountCents: asUsdCents(0), evidenceId: 'contribution-2025', provenance: { source: 'manual', sourceId: 'contribution-ledger-2025' } },
      { donorPersonId: owner, taxYear: year, amountCents: asUsdCents(0), evidenceId: 'contribution-2026', provenance: { source: 'manual', sourceId: 'contribution-ledger-2026' } },
    ] }
  const runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = {
    personAliveEvidence: requests.map((request) => ({ evidenceId: `alive-${request.actionId}`, actionId: request.actionId, personId: owner,
      actionYear: year, actionDate: request.executionDate ?? null, alive: true })),
    priorQcdOffsetEvidence: requests.map((request) => ({ evidenceId: `offset-${request.actionId}`, actionId: request.actionId, donorPersonId: owner,
      actionYear: year, actionDate: request.executionDate ?? null, priorOffsetApplied: asUsdCents(0) })),
  }
  const base = { plan, taxYear: year, runtimeRecords: [], runtimeInventoryAttestation: { predicate: 'completeAnnualRetirementPhysicalEventInventory' as const,
    planId: asPlanId(plan.id), taxYear: year, ledgerRunId: 'ledger-2026', inventoryStatus: 'completeIncludingExplicitEmpty' as const,
    resolvedEventIds: [], unresolvedActivityIds: [], evidenceId: 'inventory-evidence', upstreamEvidenceId: 'inventory-upstream' } }
  const inventory = buildAnnualRetirementPhysicalEventInventory(base); if (inventory.status !== 'annualPhysicalEventInventoryBuilt') throw new Error('inventory fixture failed')
  const event = (id: string) => inventory.events.find((entry) => entry.origin === 'planAction' && entry.actionId === id)!
  return { requests, runtimeEvidence, input: { ...base, ownerPersonId: owner,
    openingBalances: [{ accountId: source, openingBalance: asUsdCents(30_000) }, { accountId: sibling, openingBalance: asUsdCents(20_000) }],
    actualApplications: [
      { inventoryEventId: event('withdrawal').eventId, sourceBalanceBefore: asUsdCents(30_000), executedAmount: asUsdCents(4_000), sourceBalanceAfter: asUsdCents(26_000), stagingEvidenceId: 'withdrawal-staging' },
      { inventoryEventId: event('conversion').eventId, sourceBalanceBefore: asUsdCents(21_000), executedAmount: asUsdCents(3_000), sourceBalanceAfter: asUsdCents(18_000), stagingEvidenceId: 'conversion-staging' },
    ], settledContributionApplications: [], qcdPrerequisiteInput: { taxYear: year, plan, requests, runtimeEvidence } } }
}
function fixture(): FinalizeAnnualQcdUnifiedTransactionInput {
  const physical = physicalFixture(); const prepared = preparePlanOwnedNonRothIraAnnualPhysicalTransaction(physical.input)
  if (prepared.status !== 'unifiedAnnualPhysicalTransactionPrepared') throw new Error(JSON.stringify(prepared.issues))
  const parsed = parsePlan(physical.input.plan); if (!parsed.ok) throw new Error('invalid Plan fixture')
  const plan = parsed.plan
  const prerequisite = evaluateAnnualQcdExecutionPrerequisites({ taxYear: year, plan, requests: physical.requests, runtimeEvidence: physical.runtimeEvidence })
  if (prerequisite.status !== 'evaluated') throw new Error('prerequisite fixture failed')
  const capacity: ClassifyOwnedNonRothIraAnnualWithdrawalsInput = { ownerPersonId: owner, ownerWideNonRothIraPoolId: 'pool-owner-2026',
    completePoolEvidence: { predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear', ownerPersonId: owner, ownerWideNonRothIraPoolId: 'pool-owner-2026', taxYear: year,
      accountIds: [source, sibling], yearEndApplicablePoolBalanceAmount: asUsdCents(33_000), evidenceId: 'complete-pool' }, annualBasisRecordEvidenceId: 'basis-record', taxYear: year,
    poolMembers: [source, sibling].map((sourceAccountId, index) => ({ sourceAccountId, ownerPersonId: owner, accountType: 'traditional' as const,
      accountKind: 'ira' as const, inheritanceStatus: 'owned' as const, subtype: 'traditional' as const,
      yearEndApplicableBalanceAmount: asUsdCents(index === 0 ? 13_000 : 20_000), iraClassificationEvidenceId: `tax-class-${index}`, accountOwnershipEvidenceId: `owner-${index}` })),
    annualFacts: { openingBasisAmount: asUsdCents(0), taxYearNondeductibleContributionAmount: asUsdCents(0), postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
      yearEndApplicablePoolBalanceAmount: asUsdCents(33_000), outstandingRolloverAmount: asUsdCents(0), rolloverRepaymentAdjustmentAmount: asUsdCents(0),
      form8606Line7DistributionAmount: prepared.line7GrossAmount, form8606Line8NetConversionAmount: prepared.line8GrossAmount },
    line7Distributions: prepared.line7Entries, line8Conversions: prepared.line8Entries }
  const rmdPools: AnnualQcdRmdPoolOpeningSnapshot[] = [{ predicate: 'annualQcdOwnedIraRmdPoolOpeningSnapshot', poolId: 'rmd-owner-2026', taxYear: year,
    donorPersonId: owner, scope: 'ownedIra', sourceAccountIds: [source, sibling], rmdRequiredAmount: asUsdCents(0), rmdSatisfiedBefore: asUsdCents(0),
    rmdRemainingBefore: asUsdCents(0), upstreamEvidenceId: 'rmd-source' }]
  const taxUnit: AnnualQcdItemizedSection170TaxUnitInput = { taxUnit: { taxUnitId: 'tax-unit', taxUnitMemberPersonIds: [owner], federalFilingStatus: 'single',
    stateFilingStatusId: 'state', taxUnitEvidenceId: 'tax-unit-evidence', taxYear: year }, annualTaxLiabilityEvidenceId: 'liability', taxInputSnapshotId: 'tax-input',
    liabilityRun: { liabilityRunKind: 'committedAnnual', candidateFundingVectorEvidenceId: null }, contributionBaseCents: 100_000_000,
    priorItemizerFloorAppliedCents: 0, priorCashPercentageLimitUsedCents: 0, openingPostOtherLimitItemizedDeductionCents: 500,
    floorCarryforwardEligibility: physical.requests.map((request) => ({ actionId: request.actionId, eligible: true, evidenceId: `carry-${request.actionId}` })) }
  const liability: AnnualQcdItemizedLiabilitySourceInput = { taxUnitId: 'tax-unit', taxYear: year, filingStatus: 'single', annualTaxLiabilityEvidenceId: 'liability',
    taxInputSnapshotId: 'tax-input', liabilityRun: taxUnit.liabilityRun, adjustedGrossIncomeBeforeCharitableDeductionCents: 100_000_000,
    qualifiedBusinessIncomeDeductionCents: 0, qualifiedBusinessIncomeComputedWithoutSection68: true, additionalSchedule1ADeductionCents: 0,
    standardDeductionCents: 1_500_000, selectedFilingTreatment: 'itemized', selectedItemizationEvidenceId: 'itemization', adjustedGrossIncomeEvidenceId: 'agi',
    qualifiedBusinessIncomeEvidenceId: 'qbi', additionalSchedule1AEvidenceId: 'schedule1a', standardDeductionEvidenceId: 'standard',
    section170SourceBindings: { contributionBaseEvidenceId: 'base', priorFloorUseEvidenceId: 'floor', priorCashPercentageUseEvidenceId: 'cash', openingItemizedDeductionEvidenceId: 'opening' } }
  const deductionTreatmentInput: CoordinateAnnualQcdDeductionTreatmentInput = { postPassInput: { physicalInput: { prerequisite, plan,
    runtimeEvidence: physical.runtimeEvidence, openingBalances: [{ accountId: source, openingBalance: asUsdCents(10_000) },
      { accountId: sibling, openingBalance: asUsdCents(20_000) }], rmdPools }, poolCapacityInputs: [capacity] },
    itemizedTaxUnits: [taxUnit], itemizedLiabilitySources: [liability], standardTaxUnits: [] }
  const staged = stageAnnualQcdPhysicalExecution(deductionTreatmentInput.postPassInput.physicalInput)
  if (staged.status !== 'annualQcdPhysicalExecutionStaged') throw new Error(JSON.stringify(staged.issues))
  return { physicalTransactionInput: physical.input, deductionTreatmentInput }
}
function twoOwnerFixture(): FinalizeAnnualQcdUnifiedTransactionInput {
  const p1 = asPersonId('p1'); const p2 = asPersonId('p2'); const ira1 = asAccountId('ira-p1'); const ira2 = asAccountId('ira-p2')
  const requests = [qcd('qcd-p1', '2026-04-01', 10, p1, ira1), qcd('qcd-p2', '2026-05-01', 20, p2, ira2)]
  const plan = couplePlan({ p1Dob: '1955-01-01', p2Dob: '1955-01-01', p1PlanningAge: 100, p2PlanningAge: 100 }); plan.id = asPlanId('joint-qcd-plan')
  plan.accounts = [traditionalAccount(ira1, 100, p1), traditionalAccount(ira2, 100, p2)]; plan.strategies.retirementActions = requests
  plan.retirementActionEligibilityFacts = { iraClassifications: [ira1, ira2].map((sourceAccountId, i) => ({ sourceAccountId, subtype: 'traditional' as const,
    evidenceId: `classification-p${i + 1}`, provenance: { source: 'manual' as const } })), sepSimpleActivities: [],
  deductibleIraContributions: [p1, p2].flatMap((donorPersonId, i) => [2025, 2026].map((taxYear) => ({ donorPersonId, taxYear,
    amountCents: asUsdCents(0), evidenceId: `contribution-p${i + 1}-${taxYear}`, provenance: { source: 'manual' as const, sourceId: `ledger-p${i + 1}-${taxYear}` } }))) }
  const runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = { personAliveEvidence: requests.map((request) => ({ evidenceId: `alive-${request.actionId}`,
    actionId: request.actionId, personId: request.donorPersonId, actionYear: year, actionDate: request.executionDate!, alive: true })),
  priorQcdOffsetEvidence: requests.map((request) => ({ evidenceId: `offset-${request.actionId}`, actionId: request.actionId, donorPersonId: request.donorPersonId,
    actionYear: year, actionDate: request.executionDate!, priorOffsetApplied: asUsdCents(0) })) }
  const base = { plan, taxYear: year, runtimeRecords: [], runtimeInventoryAttestation: { predicate: 'completeAnnualRetirementPhysicalEventInventory' as const,
    planId: asPlanId(plan.id), taxYear: year, ledgerRunId: 'joint-ledger', inventoryStatus: 'completeIncludingExplicitEmpty' as const,
    resolvedEventIds: [], unresolvedActivityIds: [], evidenceId: 'joint-inventory', upstreamEvidenceId: 'joint-inventory-upstream' } }
  const physicalTransactionInput: PreparePlanOwnedNonRothIraAnnualPhysicalTransactionInput = { ...base, ownerPersonId: p1,
    openingBalances: [{ accountId: ira1, openingBalance: asUsdCents(10_000) }], actualApplications: [], settledContributionApplications: [],
    qcdPrerequisiteInput: { taxYear: year, plan, requests, runtimeEvidence } }
  const parsed = parsePlan(plan); if (!parsed.ok) throw new Error('invalid joint Plan'); const prerequisite = evaluateAnnualQcdExecutionPrerequisites({ taxYear: year, plan: parsed.plan, requests, runtimeEvidence })
  if (prerequisite.status !== 'evaluated') throw new Error('invalid joint prerequisite')
  const capacity = (donorPersonId: typeof p1, sourceAccountId: typeof ira1, suffix: string): ClassifyOwnedNonRothIraAnnualWithdrawalsInput => ({ ownerPersonId: donorPersonId,
    ownerWideNonRothIraPoolId: `pool-${suffix}`, completePoolEvidence: { predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear', ownerPersonId: donorPersonId,
      ownerWideNonRothIraPoolId: `pool-${suffix}`, taxYear: year, accountIds: [sourceAccountId], yearEndApplicablePoolBalanceAmount: asUsdCents(5_000), evidenceId: `complete-${suffix}` },
    annualBasisRecordEvidenceId: `basis-${suffix}`, taxYear: year, poolMembers: [{ sourceAccountId, ownerPersonId: donorPersonId, accountType: 'traditional', accountKind: 'ira',
      inheritanceStatus: 'owned', subtype: 'traditional', yearEndApplicableBalanceAmount: asUsdCents(5_000), iraClassificationEvidenceId: `tax-class-${suffix}`, accountOwnershipEvidenceId: `owner-${suffix}` }],
    annualFacts: { openingBasisAmount: asUsdCents(0), taxYearNondeductibleContributionAmount: asUsdCents(0), postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
      yearEndApplicablePoolBalanceAmount: asUsdCents(5_000), outstandingRolloverAmount: asUsdCents(0), rolloverRepaymentAdjustmentAmount: asUsdCents(0),
      form8606Line7DistributionAmount: asUsdCents(0), form8606Line8NetConversionAmount: asUsdCents(0) }, line7Distributions: [], line8Conversions: [] })
  const taxUnit: AnnualQcdItemizedSection170TaxUnitInput = { taxUnit: { taxUnitId: 'joint-unit', taxUnitMemberPersonIds: [p1, p2], federalFilingStatus: 'marriedFilingJointly',
    stateFilingStatusId: 'joint-state', taxUnitEvidenceId: 'joint-unit-evidence', taxYear: year }, annualTaxLiabilityEvidenceId: 'joint-liability', taxInputSnapshotId: 'joint-tax-input',
    liabilityRun: { liabilityRunKind: 'committedAnnual', candidateFundingVectorEvidenceId: null }, contributionBaseCents: 100_000_000,
    priorItemizerFloorAppliedCents: 0, priorCashPercentageLimitUsedCents: 0, openingPostOtherLimitItemizedDeductionCents: 500,
    floorCarryforwardEligibility: requests.map((request) => ({ actionId: request.actionId, eligible: true, evidenceId: `carry-${request.actionId}` })) }
  const liability: AnnualQcdItemizedLiabilitySourceInput = { taxUnitId: 'joint-unit', taxYear: year, filingStatus: 'marriedFilingJointly', annualTaxLiabilityEvidenceId: 'joint-liability',
    taxInputSnapshotId: 'joint-tax-input', liabilityRun: taxUnit.liabilityRun, adjustedGrossIncomeBeforeCharitableDeductionCents: 100_000_000,
    qualifiedBusinessIncomeDeductionCents: 0, qualifiedBusinessIncomeComputedWithoutSection68: true, additionalSchedule1ADeductionCents: 0, standardDeductionCents: 3_000_000,
    selectedFilingTreatment: 'itemized', selectedItemizationEvidenceId: 'joint-itemization', adjustedGrossIncomeEvidenceId: 'joint-agi', qualifiedBusinessIncomeEvidenceId: 'joint-qbi',
    additionalSchedule1AEvidenceId: 'joint-schedule1a', standardDeductionEvidenceId: 'joint-standard', section170SourceBindings: { contributionBaseEvidenceId: 'joint-base',
      priorFloorUseEvidenceId: 'joint-floor', priorCashPercentageUseEvidenceId: 'joint-cash', openingItemizedDeductionEvidenceId: 'joint-opening' } }
  const rmdPools: AnnualQcdRmdPoolOpeningSnapshot[] = [[p1, ira1, 'p1'], [p2, ira2, 'p2']].map(([donorPersonId, sourceAccountId, suffix]) => ({
    predicate: 'annualQcdOwnedIraRmdPoolOpeningSnapshot', poolId: `rmd-${suffix}`, taxYear: year, donorPersonId: asPersonId(donorPersonId!), scope: 'ownedIra',
    sourceAccountIds: [asAccountId(sourceAccountId!)], rmdRequiredAmount: asUsdCents(0), rmdSatisfiedBefore: asUsdCents(0), rmdRemainingBefore: asUsdCents(0), upstreamEvidenceId: `rmd-source-${suffix}` }))
  return { physicalTransactionInput, deductionTreatmentInput: { postPassInput: { physicalInput: { prerequisite, plan: parsed.plan, runtimeEvidence,
    openingBalances: [{ accountId: ira1, openingBalance: asUsdCents(5_000) }, { accountId: ira2, openingBalance: asUsdCents(5_000) }], rmdPools },
    poolCapacityInputs: [capacity(p1, ira1, 'p1'), capacity(p2, ira2, 'p2')] }, itemizedTaxUnits: [taxUnit], itemizedLiabilitySources: [liability], standardTaxUnits: [] } }
}
function result(input: FinalizeAnnualQcdUnifiedTransactionInput) { return finalizeAnnualQcdUnifiedTransaction(input) }

describe('finalizeAnnualQcdUnifiedTransaction', () => {
  it('rejoins final character to each authoritative mixed-chronology QCD physical member', () => {
    const bridged = result(fixture()); if (bridged.status !== 'annualQcdUnifiedFinalizationBridged') throw new Error(bridged.issues[0].detail)
    expect(bridged.actions.map((entry) => [entry.actionId, entry.unifiedPhysicalApplication.sourceBalanceBefore,
      entry.unifiedPhysicalApplication.executedAmount, entry.unifiedPhysicalApplication.sourceBalanceAfter]))
      .toEqual([['qcd-first', 26_000, 5_000, 21_000], ['qcd-second', 18_000, 5_000, 13_000]])
    expect(bridged.actions.every((entry) => entry.unifiedPhysicalApplicationEvidenceId === entry.unifiedPhysicalApplication.applicationEvidenceId &&
      entry.derivedTaxCharacter.reduce((sum, segment) => sum + segment.amountCents, 0) === entry.unifiedPhysicalApplication.executedAmount &&
      entry.derivedTaxCharacter.every((segment) => segment.characterEvidence.unifiedPhysicalApplicationEvidenceId === entry.unifiedPhysicalApplicationEvidenceId &&
        segment.characterEvidence.acceptedSourcePrerequisiteEvidenceId === entry.unifiedPhysicalApplication.qcdPrerequisiteEvidenceId))).toBe(true)
    expect(bridged.actions.every((entry) => !('finalDerivedTaxCharacterEvidence' in entry) &&
      !/physicalStagingEvidenceId|finalActionEvidenceId|postPassApplicationEvidenceId|qcdCharacterCalculation/.test(JSON.stringify(entry)) &&
      (JSON.stringify(entry).match(/sourceBalanceBefore/g) ?? []).length === 1)).toBe(true)
    expect(bridged).toMatchObject({ committed: false, movement: 'notCommitted', actionability: 'notEstablished', publicationStatus: 'notOwnedByUnifiedFinalization' })
  })

  it('selects one spouse from a complete joint-return deduction chronology without exposing the other physical member', () => {
    const input = twoOwnerFixture(); const bridged = result(input); if (bridged.status !== 'annualQcdUnifiedFinalizationBridged') throw new Error(bridged.issues[0].detail)
    expect(bridged.actions.map((entry) => entry.actionId)).toEqual(['qcd-p1'])
    expect(JSON.stringify(bridged.actions)).not.toContain('ira-p2')
    expect(bridged.actions[0]!.taxCalculation.authorityEvidenceIds).toContain('joint-unit-evidence')
    const spouseAuthorityDrift = structuredClone(input); Object.assign(spouseAuthorityDrift.deductionTreatmentInput.postPassInput.poolCapacityInputs[1]!, { annualBasisRecordEvidenceId: 'basis-p2-v2' })
    const changed = result(spouseAuthorityDrift); expect(changed.status).toBe('annualQcdUnifiedFinalizationBridged')
    expect(changed.evidenceId).not.toBe(bridged.evidenceId); expect(changed.actions[0]?.taxCalculation.evidenceId).not.toBe(bridged.actions[0]?.taxCalculation.evidenceId)
  })

  it('rejects line/pool drift and a qcd-only physical amount that differs from unified chronology', () => {
    const lineDrift = structuredClone(fixture()); Object.assign(lineDrift.deductionTreatmentInput.postPassInput.poolCapacityInputs[0]!.line7Distributions[0]!, { grossAmount: asUsdCents(3_999) })
    expect(result(lineDrift)).toMatchObject({ status: 'annualQcdUnifiedFinalizationBlocked', issues: [{ kind: 'lineFactsInvalid' }] })
    const poolDrift = structuredClone(fixture()); Object.assign(poolDrift.deductionTreatmentInput.postPassInput.poolCapacityInputs[0]!.poolMembers[0]!, { yearEndApplicableBalanceAmount: asUsdCents(12_999) })
    expect(result(poolDrift)).toMatchObject({ status: 'annualQcdUnifiedFinalizationBlocked', issues: [{ kind: 'lineFactsInvalid' }] })
    const planDrift = structuredClone(fixture()); Object.assign(planDrift.deductionTreatmentInput.postPassInput.physicalInput.plan.household.people[0]!, { dob: '1954-01-01' })
    expect(result(planDrift)).toMatchObject({ status: 'annualQcdUnifiedFinalizationBlocked', issues: [{ kind: 'finalizationInvalid' }] })
    const collision = structuredClone(fixture()); Object.assign(collision.deductionTreatmentInput.postPassInput.poolCapacityInputs[0]!, { annualBasisRecordEvidenceId: 'tax-unit-evidence' })
    expect(result(collision)).toMatchObject({ status: 'annualQcdUnifiedFinalizationBlocked', issues: [{ kind: 'identifierCollision' }] })
    const snapshotCollision = structuredClone(fixture()); Object.assign(snapshotCollision.deductionTreatmentInput.postPassInput.poolCapacityInputs[0]!, { annualBasisRecordEvidenceId: 'tax-input' })
    expect(result(snapshotCollision)).toMatchObject({ status: 'annualQcdUnifiedFinalizationBlocked', issues: [{ kind: 'identifierCollision' }] })
    const authorityDrift = structuredClone(fixture()); Object.assign(authorityDrift.deductionTreatmentInput.postPassInput.poolCapacityInputs[0]!, { annualBasisRecordEvidenceId: 'basis-record-v2' })
    expect(result(authorityDrift).evidenceId).not.toBe(result(fixture()).evidenceId)
    const amountDrift = structuredClone(fixture()); Object.assign(amountDrift.deductionTreatmentInput.postPassInput.physicalInput.openingBalances[0]!, { openingBalance: asUsdCents(9_000) })
    expect(result(amountDrift)).toMatchObject({ status: 'annualQcdUnifiedFinalizationBlocked', issues: [{ kind: 'actionJoinInvalid' }] })
  })

  it('is input-order invariant, immutable, deeply frozen, and reserves nested evidence IDs', () => {
    const input = fixture(); const before = structuredClone(input); const first = result(input)
    const permuted = structuredClone(input); (permuted.physicalTransactionInput.plan as Plan).accounts.reverse()
    Object.assign(permuted.physicalTransactionInput, { openingBalances: [...permuted.physicalTransactionInput.openingBalances].reverse(),
      actualApplications: [...permuted.physicalTransactionInput.actualApplications].reverse() })
    expect(result(permuted)).toEqual(first); expect(input).toEqual(before); expect(Object.isFrozen(first)).toBe(true)
    const propertyOrder = structuredClone(input); const line7 = propertyOrder.deductionTreatmentInput.postPassInput.poolCapacityInputs[0]!.line7Distributions[0]!
    Object.assign(propertyOrder.deductionTreatmentInput.postPassInput.poolCapacityInputs[0]!, { line7Distributions: [{ grossAmount: line7.grossAmount,
      scheduledSequence: line7.scheduledSequence, scheduledDate: line7.scheduledDate, sourceAccountId: line7.sourceAccountId,
      allocationId: line7.allocationId, actionId: line7.actionId }] })
    expect(result(propertyOrder)).toEqual(first)
    const original = structuralId.deriveActionStructuralId
    const spy = vi.spyOn(structuralId, 'deriveActionStructuralId').mockImplementation((prefix, parts) =>
      prefix === 'annual-qcd-unified-tax-calculation' ? 'tax-input' : original(prefix, parts))
    try { expect(result(fixture())).toMatchObject({ status: 'annualQcdUnifiedFinalizationBlocked', issues: [{ kind: 'identifierCollision' }] }) }
    finally { spy.mockRestore() }
  })
})
