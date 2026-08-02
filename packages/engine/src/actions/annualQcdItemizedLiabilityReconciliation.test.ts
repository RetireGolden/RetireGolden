import { describe, expect, it } from 'vitest'
import { parsePlan } from '../model/plan.js'
import { couplePlan, singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import type { RetirementActionEligibilityRuntimeEvidence } from '../strategies/accountEligibility.js'
import type { QualifiedCharitableDistributionRequest } from './contract.js'
import { asAccountId, asActionId, asAllocationId, asPersonId } from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { evaluateAnnualQcdExecutionPrerequisites } from './annualQcdExecutionPrerequisite.js'
import type { AnnualQcdRmdPoolOpeningSnapshot } from './annualQcdPhysicalExecution.js'
import type { AnnualQcdItemizedSection170TaxUnitInput, StageAnnualQcdItemizedSection170LedgerInput } from './annualQcdItemizedSection170Ledger.js'
import {
  reconcileAnnualQcdItemizedLiability,
  type AnnualQcdItemizedLiabilitySourceInput,
  type ReconcileAnnualQcdItemizedLiabilityInput,
} from './annualQcdItemizedLiabilityReconciliation.js'
import type { ClassifyOwnedNonRothIraAnnualWithdrawalsInput } from './ownedNonRothIraWithdrawalCharacter.js'

interface Spec { id: string; donor?: 'p1' | 'p2'; amount: number; date: string; sequence?: number }
interface Options { year?: number; taxableCapacity?: Partial<Record<'p1' | 'p2', number>>; joint?: boolean; base?: number; priorFloor?: number; priorCash?: number; opening?: number; carry?: Record<string, boolean> }
const charity = { designationId: 'public-charity', name: 'Public charity', designationKind: 'eligiblePublicCharity' as const,
  directFromCustodianAttested: true, eligibleOrganizationAttested: true,
  notDonorAdvisedFundOrSupportingOrganizationAttested: true, notSplitInterestEntityAttested: true,
  entireDistributionOtherwiseDeductibleAttested: true }
function request(spec: Spec, year: number): QualifiedCharitableDistributionRequest {
  const donor = spec.donor ?? 'p1'
  return { actionId: asActionId(spec.id), kind: 'qcd', year, executionDate: spec.date,
    executionSequence: spec.sequence ?? 1, requestedAmount: asPositiveUsdCents(spec.amount),
    provenance: { source: 'manual' }, donorPersonId: asPersonId(donor),
    allocation: { allocationId: asAllocationId(`allocation-${spec.id}`), sourceAccountId: asAccountId(`ira-${donor}`), requestedAmount: asPositiveUsdCents(spec.amount) },
    charity: { ...charity, designationId: `charity-${spec.id}` } }
}
function ledgerFixture(specs: readonly Spec[], options: Options): StageAnnualQcdItemizedSection170LedgerInput {
  const year = options.year ?? 2026; const requests = specs.map((spec) => request(spec, year))
  const donors = [...new Set(requests.map((entry) => entry.donorPersonId))].sort()
  const rawPlan = options.joint || donors.includes(asPersonId('p2'))
    ? couplePlan({ p1Dob: '1955-01-31', p2Dob: '1955-01-31', p1PlanningAge: 90, p2PlanningAge: 90 })
    : singlePersonPlan({ dob: '1955-01-31', planningAge: 90 })
  rawPlan.accounts = donors.map((donor) => traditionalAccount(`ira-${donor}`, 1_000_000, donor))
  rawPlan.strategies.retirementActions = [...requests]
  rawPlan.retirementActionEligibilityFacts = { iraClassifications: donors.map((donor) => ({
    sourceAccountId: asAccountId(`ira-${donor}`), subtype: 'traditional' as const,
    evidenceId: `classification-${donor}`, provenance: { source: 'manual' as const } })),
  sepSimpleActivities: [], deductibleIraContributions: donors.flatMap((donorPersonId) =>
    Array.from({ length: year - 2024 }, (_, index) => ({ donorPersonId, taxYear: 2025 + index,
      amountCents: asUsdCents(0), evidenceId: `contribution-${donorPersonId}-${2025 + index}`,
      provenance: { source: 'manual' as const, sourceId: `ledger-${donorPersonId}-${2025 + index}` } }))) }
  const parsed = parsePlan(rawPlan); if (!parsed.ok) throw new Error('invalid Plan fixture')
  const runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = {
    personAliveEvidence: requests.map((entry) => ({ evidenceId: `alive-${entry.actionId}`, actionId: entry.actionId,
      personId: entry.donorPersonId, actionYear: year, actionDate: entry.executionDate ?? null, alive: true })),
    priorQcdOffsetEvidence: requests.map((entry) => ({ evidenceId: `offset-${entry.actionId}`, actionId: entry.actionId,
      donorPersonId: entry.donorPersonId, actionYear: year, actionDate: entry.executionDate ?? null, priorOffsetApplied: asUsdCents(0) })) }
  const prerequisite = evaluateAnnualQcdExecutionPrerequisites({ taxYear: year, plan: parsed.plan, requests, runtimeEvidence })
  if (prerequisite.status !== 'evaluated') throw new Error('invalid prerequisite fixture')
  const rmdPools: AnnualQcdRmdPoolOpeningSnapshot[] = donors.map((donor) => ({
    predicate: 'annualQcdOwnedIraRmdPoolOpeningSnapshot', poolId: `rmd-${donor}-${year}`, taxYear: year,
    donorPersonId: donor, scope: 'ownedIra', sourceAccountIds: [asAccountId(`ira-${donor}`)],
    rmdRequiredAmount: asUsdCents(0), rmdSatisfiedBefore: asUsdCents(0), rmdRemainingBefore: asUsdCents(0), upstreamEvidenceId: `rmd-source-${donor}` }))
  const openingBalances = donors.map((donor) => ({ accountId: asAccountId(`ira-${donor}`),
    openingBalance: asUsdCents(requests.filter((entry) => entry.donorPersonId === donor).reduce((sum, entry) => sum + entry.requestedAmount, 0)) }))
  const poolCapacityInputs = donors.map((donor): ClassifyOwnedNonRothIraAnnualWithdrawalsInput => {
    const physical = requests.filter((entry) => entry.donorPersonId === donor).reduce((sum, entry) => sum + entry.requestedAmount, 0)
    const capacity = options.taxableCapacity?.[donor as 'p1' | 'p2'] ?? 0; const gross = Math.max(physical, capacity); const yearEnd = gross - physical
    return { ownerPersonId: donor, ownerWideNonRothIraPoolId: `pool-${donor}-${year}`,
      completePoolEvidence: { predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear', ownerPersonId: donor,
        ownerWideNonRothIraPoolId: `pool-${donor}-${year}`, taxYear: year, accountIds: [asAccountId(`ira-${donor}`)],
        yearEndApplicablePoolBalanceAmount: asUsdCents(yearEnd), evidenceId: `complete-pool-${donor}` },
      annualBasisRecordEvidenceId: `basis-record-${donor}`, taxYear: year,
      poolMembers: [{ sourceAccountId: asAccountId(`ira-${donor}`), ownerPersonId: donor, accountType: 'traditional', accountKind: 'ira',
        inheritanceStatus: 'owned', subtype: 'traditional', yearEndApplicableBalanceAmount: asUsdCents(yearEnd),
        iraClassificationEvidenceId: `tax-classification-${donor}`, accountOwnershipEvidenceId: `tax-ownership-${donor}` }],
      annualFacts: { openingBasisAmount: asUsdCents(gross - capacity), taxYearNondeductibleContributionAmount: asUsdCents(0),
        postYearNondeductibleContributionExcludedAmount: asUsdCents(0), yearEndApplicablePoolBalanceAmount: asUsdCents(yearEnd),
        outstandingRolloverAmount: asUsdCents(0), rolloverRepaymentAdjustmentAmount: asUsdCents(0),
        form8606Line7DistributionAmount: asUsdCents(0), form8606Line8NetConversionAmount: asUsdCents(0) }, line7Distributions: [], line8Conversions: [] }
  })
  const taxUnit = (members: readonly typeof donors[number][], suffix: string): AnnualQcdItemizedSection170TaxUnitInput => ({
    taxUnit: { taxUnitId: `tax-unit-${suffix}`, taxUnitMemberPersonIds: members as [typeof donors[number], ...typeof donors[number][]],
      federalFilingStatus: members.length === 2 ? 'marriedFilingJointly' : 'single', stateFilingStatusId: `state-${suffix}`,
      taxUnitEvidenceId: `tax-unit-evidence-${suffix}`, taxYear: year }, annualTaxLiabilityEvidenceId: `liability-${suffix}`,
    taxInputSnapshotId: `tax-input-${suffix}`, liabilityRun: { liabilityRunKind: 'committedAnnual', candidateFundingVectorEvidenceId: null },
    contributionBaseCents: options.base ?? 10_000, priorItemizerFloorAppliedCents: options.priorFloor ?? 0,
    priorCashPercentageLimitUsedCents: options.priorCash ?? 0, openingPostOtherLimitItemizedDeductionCents: options.opening ?? 500,
    floorCarryforwardEligibility: requests.filter((entry) => members.includes(entry.donorPersonId)).map((entry) => ({
      actionId: entry.actionId, eligible: options.carry?.[entry.actionId] ?? true, evidenceId: `carry-${entry.actionId}` })) })
  const members = options.joint ? parsed.plan.household.people.map((person) => asPersonId(person.id)) : donors
  return { postPassInput: { physicalInput: { prerequisite, plan: parsed.plan, runtimeEvidence, openingBalances, rmdPools }, poolCapacityInputs },
    taxUnits: options.joint ? [taxUnit(members, 'joint')] : donors.map((donor) => taxUnit([donor], donor)) }
}
function fixture(specs: readonly Spec[] = [{ id: 'qcd-a', amount: 1_000, date: '2026-08-01' }], options: Options = {}, agi = 1_000_000): ReconcileAnnualQcdItemizedLiabilityInput {
  const itemizedLedgerInput = ledgerFixture(specs, options)
  const liabilitySources: AnnualQcdItemizedLiabilitySourceInput[] = itemizedLedgerInput.taxUnits.map((unit) => ({
    taxUnitId: unit.taxUnit.taxUnitId, taxYear: options.year ?? 2026, filingStatus: unit.taxUnit.federalFilingStatus,
    annualTaxLiabilityEvidenceId: unit.annualTaxLiabilityEvidenceId, taxInputSnapshotId: unit.taxInputSnapshotId,
    liabilityRun: unit.liabilityRun, adjustedGrossIncomeBeforeCharitableDeductionCents: agi,
    qualifiedBusinessIncomeDeductionCents: 0, qualifiedBusinessIncomeComputedWithoutSection68: true,
    additionalSchedule1ADeductionCents: 0, standardDeductionCents: 1_500_000, selectedFilingTreatment: 'itemized',
    selectedItemizationEvidenceId: `itemization-${unit.taxUnit.taxUnitId}`, adjustedGrossIncomeEvidenceId: `agi-${unit.taxUnit.taxUnitId}`,
    qualifiedBusinessIncomeEvidenceId: `qbi-${unit.taxUnit.taxUnitId}`, additionalSchedule1AEvidenceId: `schedule1a-${unit.taxUnit.taxUnitId}`,
    standardDeductionEvidenceId: `standard-${unit.taxUnit.taxUnitId}`, section170SourceBindings: {
      contributionBaseEvidenceId: `base-${unit.taxUnit.taxUnitId}`, priorFloorUseEvidenceId: `floor-${unit.taxUnit.taxUnitId}`,
      priorCashPercentageUseEvidenceId: `cash-${unit.taxUnit.taxUnitId}`, openingItemizedDeductionEvidenceId: `opening-${unit.taxUnit.taxUnitId}` } }))
  return { itemizedLedgerInput, liabilitySources }
}
function reconciled(input: ReconcileAnnualQcdItemizedLiabilityInput) {
  const result = reconcileAnnualQcdItemizedLiability(input)
  expect(result.status).toBe('annualQcdItemizedLiabilityReconciled')
  if (result.status !== 'annualQcdItemizedLiabilityReconciled') throw new Error(result.issues[0].detail)
  return result
}

describe('reconcileAnnualQcdItemizedLiability', () => {
  it('feeds only the exact Section 68 marginal and final allowed amounts to liability', () => {
    const result = reconciled(fixture([{ id: 'qcd-a', amount: 200_000, date: '2026-08-01' }], { base: 20_000_000, opening: 9_900_000 }, 67_760_000))
    const unit = result.taxUnits[0]!; const action = unit.orderedActionEvidence[0]!
    expect(unit.annualSection68Evidence).toMatchObject({ thresholdCents: 64_060_000,
      finalState: { totalItemizedDeductionsBeforeOverallLimitCents: 10_000_000,
        overallLimitationCents: 200_000, allowedItemizedDeductionCents: 9_800_000 } })
    expect(action).toMatchObject({ treatment: 'evaluated', eligibleContributionCents: 200_000,
      currentYearClaimedDeductionCents: 100_000, itemizedDeductionBeforeSection68Cents: 9_900_000,
      itemizedDeductionAfterSection68Cents: 10_000_000, deductionAmountAppliedByTaxLedgerCents: 100_000,
      totalDeductionAmountAppliedByTaxLedgerCents: 9_800_000 })
  })

  it('reconciles a threshold-crossing action chain with nonzero QBI and Schedule 1-A', () => {
    const input = fixture([{ id: 'later', amount: 2_000, date: '2026-09-01' },
      { id: 'earlier', amount: 2_000, date: '2026-03-01' }], { base: 10_000, opening: 1_000 }, 64_063_000)
    Object.assign(input.liabilitySources[0]!, { qualifiedBusinessIncomeDeductionCents: 500,
      additionalSchedule1ADeductionCents: 500 })
    const unit = reconciled(input).taxUnits[0]!
    expect(unit.orderedActionEvidence.map((entry) => entry.actionId)).toEqual(['earlier', 'later'])
    expect(unit.annualSection68Evidence.orderedActionAttributions).toHaveLength(2)
    expect(unit.annualSection68Evidence.initialState.limitationBaseCents).toBe(1_000)
    expect(unit.annualSection68Evidence.orderedActionAttributions[0]!.afterAction.limitationBaseCents).toBe(2_000)
    expect(unit.annualSection68Evidence.qualifiedBusinessIncomeComputedWithoutSection68).toBe(true)
  })

  it('keeps positive fully limited contributions evaluated and zero-eligible actions not applicable', () => {
    const limited = reconciled(fixture(undefined, { base: 1_000, priorCash: 600 })).taxUnits[0]!.orderedActionEvidence[0]!
    expect(limited).toMatchObject({ treatment: 'evaluated', currentYearClaimedDeductionCents: 0,
      deductionAmountAppliedByTaxLedgerCents: 0 })
    expect(limited.section68ActionAttributionEvidenceId).not.toBeNull()
    const zero = reconciled(fixture(undefined, { taxableCapacity: { p1: 1_000 } })).taxUnits[0]!.orderedActionEvidence[0]!
    expect(zero).toMatchObject({ treatment: 'notApplicable', eligibleContributionCents: 0,
      section68ActionAttributionEvidenceId: null, deductionAmountAppliedByTaxLedgerCents: 0 })
  })

  it('accepts negative AGI, is deterministic, immutable, recursively frozen, and run-bound', () => {
    const input = fixture(undefined, {}, -1); const before = structuredClone(input)
    const first = reconciled(input); const repeat = reconciled(input); const t1 = fixture(undefined, {}, -1)
    Object.assign(t1.itemizedLedgerInput.taxUnits[0]!, { liabilityRun: { liabilityRunKind: 'candidateT1', candidateFundingVectorEvidenceId: 'funding-1' } })
    Object.assign(t1.liabilitySources[0]!, { liabilityRun: { liabilityRunKind: 'candidateT1', candidateFundingVectorEvidenceId: 'funding-1' } })
    expect(input).toEqual(before); expect(repeat.taxUnits[0]!.evidenceId).toBe(first.taxUnits[0]!.evidenceId)
    expect(reconciled(t1).taxUnits[0]!.evidenceId).not.toBe(first.taxUnits[0]!.evidenceId)
    expect(Object.isFrozen(first.taxUnits[0]!.annualSection68Evidence.orderedActionAttributions)).toBe(true)
  })

  it.each([
    ['liabilitySourceInvalid', (input: ReconcileAnnualQcdItemizedLiabilityInput) => Object.assign(input.liabilitySources[0]!, { taxYear: 2027 })],
    ['liabilitySourceInvalid', (input: ReconcileAnnualQcdItemizedLiabilityInput) => Object.assign(input.liabilitySources[0]!, { taxUnitId: 'foreign' })],
    ['liabilitySourceInvalid', (input: ReconcileAnnualQcdItemizedLiabilityInput) => Object.assign(input.liabilitySources[0]!, { filingStatus: 'headOfHousehold' })],
    ['liabilitySourceInvalid', (input: ReconcileAnnualQcdItemizedLiabilityInput) => Object.assign(input.liabilitySources[0]!, { selectedFilingTreatment: 'standardDeduction' })],
    ['liabilitySourceInvalid', (input: ReconcileAnnualQcdItemizedLiabilityInput) => Object.assign(input.liabilitySources[0]!, { taxInputSnapshotId: 'other-input' })],
    ['section68Invalid', (input: ReconcileAnnualQcdItemizedLiabilityInput) => Object.assign(input.liabilitySources[0]!, { qualifiedBusinessIncomeComputedWithoutSection68: false })],
    ['liabilitySourceInvalid', (input: ReconcileAnnualQcdItemizedLiabilityInput) => Object.assign(input.liabilitySources[0]!, { standardDeductionCents: 0.5 })],
    ['liabilitySourceInvalid', (input: ReconcileAnnualQcdItemizedLiabilityInput) => Object.assign(input.liabilitySources[0]!, { section170SourceBindings: { contributionBaseEvidenceId: 'base-only' } })],
  ] as const)('fails closed with %s on mismatched evidence', (kind, mutate) => {
    const input = fixture(); mutate(input)
    expect(reconcileAnnualQcdItemizedLiability(input)).toMatchObject({
      status: 'annualQcdItemizedLiabilityBlocked', taxUnits: [], issues: [{ kind }] })
  })

  it('rejects hostile input without publishing partial evidence', () => {
    expect(reconcileAnnualQcdItemizedLiability(new Proxy(fixture(), {}) as ReconcileAnnualQcdItemizedLiabilityInput))
      .toMatchObject({ status: 'annualQcdItemizedLiabilityBlocked', taxUnits: [], issues: [{ kind: 'hostileInput' }] })
  })
})
