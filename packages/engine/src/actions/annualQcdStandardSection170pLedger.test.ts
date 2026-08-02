import { describe, expect, it } from 'vitest'
import { parsePlan } from '../model/plan.js'
import { couplePlan, singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import type { RetirementActionEligibilityRuntimeEvidence } from '../strategies/accountEligibility.js'
import type { QualifiedCharitableDistributionRequest } from './contract.js'
import { asAccountId, asActionId, asAllocationId, asPersonId } from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { evaluateAnnualQcdExecutionPrerequisites } from './annualQcdExecutionPrerequisite.js'
import type { AnnualQcdRmdPoolOpeningSnapshot } from './annualQcdPhysicalExecution.js'
import type { ClassifyOwnedNonRothIraAnnualWithdrawalsInput } from './ownedNonRothIraWithdrawalCharacter.js'
import {
  stageAnnualQcdStandardSection170pLedger,
  type AnnualQcdStandardSection170pTaxUnitInput,
  type StageAnnualQcdStandardSection170pLedgerInput,
} from './annualQcdStandardSection170pLedger.js'

interface Spec { id: string; donor?: 'p1' | 'p2'; amount: number; date: string; sequence?: number }
interface Options {
  year?: number; joint?: boolean
  taxableCapacity?: Partial<Record<'p1' | 'p2', number>>
  base?: number; priorGift?: number; priorCash?: number; standard?: number
}
const charity = {
  designationId: 'public-charity', name: 'Public charity',
  designationKind: 'eligiblePublicCharity' as const,
  directFromCustodianAttested: true, eligibleOrganizationAttested: true,
  notDonorAdvisedFundOrSupportingOrganizationAttested: true,
  notSplitInterestEntityAttested: true, entireDistributionOtherwiseDeductibleAttested: true,
}
function request(spec: Spec, year: number): QualifiedCharitableDistributionRequest {
  const donor = spec.donor ?? 'p1'
  return {
    actionId: asActionId(spec.id), kind: 'qcd', year,
    executionDate: spec.date, executionSequence: spec.sequence ?? 1,
    requestedAmount: asPositiveUsdCents(spec.amount), provenance: { source: 'manual' },
    donorPersonId: asPersonId(donor),
    allocation: { allocationId: asAllocationId(`allocation-${spec.id}`),
      sourceAccountId: asAccountId(`ira-${donor}`),
      requestedAmount: asPositiveUsdCents(spec.amount) },
    charity: { ...charity, designationId: `charity-${spec.id}` },
  }
}
function fixture(
  specs: readonly Spec[] = [{ id: 'qcd-a', amount: 1_000, date: '2026-08-01' }],
  options: Options = {},
): StageAnnualQcdStandardSection170pLedgerInput {
  const year = options.year ?? 2026
  const requests = specs.map((spec) => request(spec, year))
  const donors = [...new Set(requests.map((entry) => entry.donorPersonId))].sort()
  const rawPlan = donors.includes(asPersonId('p2'))
    ? couplePlan({ p1Dob: '1955-01-31', p2Dob: '1955-01-31', p1PlanningAge: 90, p2PlanningAge: 90 })
    : singlePersonPlan({ dob: '1955-01-31', planningAge: 90 })
  rawPlan.accounts = donors.map((donor) => traditionalAccount(`ira-${donor}`, 1_000_000, donor))
  rawPlan.strategies.retirementActions = [...requests]
  rawPlan.retirementActionEligibilityFacts = {
    iraClassifications: donors.map((donor) => ({ sourceAccountId: asAccountId(`ira-${donor}`),
      subtype: 'traditional' as const, evidenceId: `classification-${donor}`,
      provenance: { source: 'manual' as const } })),
    sepSimpleActivities: [],
    deductibleIraContributions: donors.flatMap((donorPersonId) =>
      Array.from({ length: year - 2024 }, (_, index) => ({ donorPersonId,
        taxYear: 2025 + index, amountCents: asUsdCents(0),
        evidenceId: `contribution-${donorPersonId}-${2025 + index}`,
        provenance: { source: 'manual' as const, sourceId: `ledger-${donorPersonId}-${2025 + index}` } }))),
  }
  const parsed = parsePlan(rawPlan)
  if (!parsed.ok) throw new Error('invalid Plan fixture')
  const runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = {
    personAliveEvidence: requests.map((entry) => ({ evidenceId: `alive-${entry.actionId}`,
      actionId: entry.actionId, personId: entry.donorPersonId, actionYear: year,
      actionDate: entry.executionDate ?? null, alive: true })),
    priorQcdOffsetEvidence: requests.map((entry) => ({ evidenceId: `offset-${entry.actionId}`,
      actionId: entry.actionId, donorPersonId: entry.donorPersonId, actionYear: year,
      actionDate: entry.executionDate ?? null, priorOffsetApplied: asUsdCents(0) })),
  }
  const prerequisite = evaluateAnnualQcdExecutionPrerequisites({
    taxYear: year, plan: parsed.plan, requests, runtimeEvidence,
  })
  if (prerequisite.status !== 'evaluated') throw new Error('invalid prerequisite fixture')
  const rmdPools: AnnualQcdRmdPoolOpeningSnapshot[] = donors.map((donor) => ({
    predicate: 'annualQcdOwnedIraRmdPoolOpeningSnapshot', poolId: `rmd-${donor}-${year}`,
    taxYear: year, donorPersonId: donor, scope: 'ownedIra',
    sourceAccountIds: [asAccountId(`ira-${donor}`)], rmdRequiredAmount: asUsdCents(0),
    rmdSatisfiedBefore: asUsdCents(0), rmdRemainingBefore: asUsdCents(0),
    upstreamEvidenceId: `rmd-source-${donor}`,
  }))
  const openingBalances = donors.map((donor) => ({ accountId: asAccountId(`ira-${donor}`),
    openingBalance: asUsdCents(requests.filter((entry) => entry.donorPersonId === donor)
      .reduce((sum, entry) => sum + entry.requestedAmount, 0)) }))
  const poolCapacityInputs = donors.map((donor): ClassifyOwnedNonRothIraAnnualWithdrawalsInput => {
    const physical = requests.filter((entry) => entry.donorPersonId === donor)
      .reduce((sum, entry) => sum + entry.requestedAmount, 0)
    const capacity = options.taxableCapacity?.[donor as 'p1' | 'p2'] ?? 0
    const gross = Math.max(physical, capacity); const yearEnd = gross - physical
    return {
      ownerPersonId: donor, ownerWideNonRothIraPoolId: `pool-${donor}-${year}`,
      completePoolEvidence: { predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
        ownerPersonId: donor, ownerWideNonRothIraPoolId: `pool-${donor}-${year}`,
        taxYear: year, accountIds: [asAccountId(`ira-${donor}`)],
        yearEndApplicablePoolBalanceAmount: asUsdCents(yearEnd), evidenceId: `complete-pool-${donor}` },
      annualBasisRecordEvidenceId: `basis-record-${donor}`, taxYear: year,
      poolMembers: [{ sourceAccountId: asAccountId(`ira-${donor}`), ownerPersonId: donor,
        accountType: 'traditional', accountKind: 'ira', inheritanceStatus: 'owned', subtype: 'traditional',
        yearEndApplicableBalanceAmount: asUsdCents(yearEnd),
        iraClassificationEvidenceId: `tax-classification-${donor}`,
        accountOwnershipEvidenceId: `tax-ownership-${donor}` }],
      annualFacts: { openingBasisAmount: asUsdCents(gross - capacity),
        taxYearNondeductibleContributionAmount: asUsdCents(0),
        postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
        yearEndApplicablePoolBalanceAmount: asUsdCents(yearEnd), outstandingRolloverAmount: asUsdCents(0),
        rolloverRepaymentAdjustmentAmount: asUsdCents(0), form8606Line7DistributionAmount: asUsdCents(0),
        form8606Line8NetConversionAmount: asUsdCents(0) },
      line7Distributions: [], line8Conversions: [],
    }
  })
  const taxUnit = (members: readonly typeof donors[number][], suffix: string): AnnualQcdStandardSection170pTaxUnitInput => ({
    taxUnit: { taxUnitId: `tax-unit-${suffix}`,
      taxUnitMemberPersonIds: members as [typeof donors[number], ...typeof donors[number][]],
      federalFilingStatus: members.length === 2 ? 'marriedFilingJointly' : 'single',
      stateFilingStatusId: members.length === 2 ? 'state-joint' : 'state-single',
      taxUnitEvidenceId: `tax-unit-evidence-${suffix}`, taxYear: year },
    annualTaxLiabilityEvidenceId: `liability-${suffix}`, taxInputSnapshotId: `tax-input-${suffix}`,
    liabilityRun: { liabilityRunKind: 'committedAnnual', candidateFundingVectorEvidenceId: null },
    sourceTaxYears: { standardDeduction: year, priorQualifyingCashContributions: year,
      cashPercentageLimit: year },
    sourceTaxUnitIds: { standardDeduction: `tax-unit-${suffix}`,
      priorQualifyingCashContributions: `tax-unit-${suffix}`, cashPercentageLimit: `tax-unit-${suffix}` },
    adjustedGrossIncomeBeforeCharitableDeductionCents: 5_000_000,
    unchangedItemizedDeductionCents: 500_000,
    standardDeductionCents: options.standard ?? 1_500_000,
    selectedStandardDeductionEvidenceId: `standard-${suffix}`, contributionBaseCents: options.base ?? 10_000,
    contributionBaseEvidenceId: `contribution-base-${suffix}`,
    priorQualifyingCashContributionUsedCents: options.priorGift ?? 0,
    priorQualifyingCashContributionEvidenceId: `prior-gift-${suffix}`,
    priorCashPercentageLimitUsedCents: options.priorCash ?? 0,
    cashPercentageLimitEvidenceId: `cash-capacity-${suffix}`,
  })
  return { postPassInput: { physicalInput: { prerequisite, plan: parsed.plan, runtimeEvidence,
    openingBalances, rmdPools }, poolCapacityInputs },
    taxUnits: options.joint ? [taxUnit(donors, 'joint')] : donors.map((donor) => taxUnit([donor], donor)) }
}
function staged(input: StageAnnualQcdStandardSection170pLedgerInput) {
  const result = stageAnnualQcdStandardSection170pLedger(input)
  expect(result.status).toBe('annualQcdStandardSection170pStaged')
  if (result.status !== 'annualQcdStandardSection170pStaged') throw new Error(result.issues[0].detail)
  return result
}

describe('stageAnnualQcdStandardSection170pLedger', () => {
  it('applies prior gifts and cash-cap use to the exact nonjoint limit', () => {
    const result = staged(fixture(undefined, { priorGift: 99_500, priorCash: 100 }))
    const ledger = result.taxUnits[0]!
    expect(ledger).toMatchObject({ filingTreatment: 'standardDeduction',
      statutoryLimitCents: 100_000, cashPercentageLimitAmountCents: 6_000,
      openingState: { remainingStatutoryLimitCents: 500,
        cashPercentageLimitCapacityRemainingCents: 5_900 },
      finalState: { remainingStatutoryLimitCents: 0,
        cashPercentageLimitCapacityRemainingCents: 5_400 },
      annualClaimedDeductionCents: 500,
      finalTotalDeductionAppliedCents: 1_500_500, exactAmountAuthority: 'cents' })
    expect(ledger.orderedActionEvidence[0]).toMatchObject({ treatment: 'evaluated',
      eligibleContributionCents: 1_000,
      qualifyingCashContributionAmountUsedBeforeActionCents: 99_500,
      remainingLimitBeforeActionCents: 500, claimedByActionCents: 500,
      remainingLimitAfterActionCents: 0, cashPercentageLimitUsedByActionCents: 500,
      currentYearClaimedDeductionCents: 500, limitationCarryforwardCents: 0,
      unclaimedWithoutCarryforwardCents: 500,
      deductionAmountAppliedByTaxLedgerCents: 500,
      standardPlusClaimedByActionCents: 1_500_500, cashContributionQualified: true,
      adjustedGrossIncomeBeforeCharitableDeductionCents: 5_000_000,
      itemizedDeductionBeforeActionCents: 500_000, itemizedDeductionAfterActionCents: 500_000 })
  })

  it('shares the joint $2,000 cap and cash capacity in authored chronology', () => {
    const result = staged(fixture([
      { id: 'later-p1', donor: 'p1', amount: 150_000, date: '2026-09-01', sequence: 2 },
      { id: 'earlier-p2', donor: 'p2', amount: 100_000, date: '2026-03-01', sequence: 1 },
    ], { joint: true, base: 1_000_000, priorGift: 50_000, standard: 3_000_000 }))
    const ledger = result.taxUnits[0]!
    expect(ledger.statutoryLimitCents).toBe(200_000)
    expect(ledger.orderedActionEvidence.map((entry) => entry.actionId))
      .toEqual(['earlier-p2', 'later-p1'])
    expect(ledger.orderedActionEvidence).toMatchObject([
      { claimedByActionCents: 100_000, remainingLimitAfterActionCents: 50_000 },
      { qualifyingCashContributionAmountUsedBeforeActionCents: 150_000,
        claimedByActionCents: 50_000, remainingLimitAfterActionCents: 0,
        unclaimedWithoutCarryforwardCents: 100_000 },
    ])
    expect(ledger.finalTotalDeductionAppliedCents).toBe(3_150_000)
    expect(ledger.annualClaimedDeductionCents).toBe(150_000)
  })

  it('lets exhausted 60% capacity block claims without inventing carryover', () => {
    const result = staged(fixture(undefined, { base: 1_000, priorCash: 601 }))
    expect(result.taxUnits[0]!.orderedActionEvidence[0]).toMatchObject({
      remainingLimitBeforeActionCents: 100_000,
      cashPercentageLimitCapacityBeforeActionCents: 0,
      claimedByActionCents: 0, limitationCarryforwardCents: 0,
      unclaimedWithoutCarryforwardCents: 1_000,
      deductionAmountAppliedByTaxLedgerCents: 0,
    })
  })

  it('turns a zero contribution base into zero cash capacity', () => {
    const result = staged(fixture(undefined, { base: 0 }))
    expect(result.taxUnits[0]).toMatchObject({ cashPercentageLimitAmountCents: 0,
      annualClaimedDeductionCents: 0, finalTotalDeductionAppliedCents: 1_500_000,
      orderedActionEvidence: [{ claimedByActionCents: 0, unclaimedWithoutCarryforwardCents: 1_000 }] })
  })

  it.each([
    ['single', 100_000], ['marriedFilingJointly', 200_000], ['marriedFilingSeparately', 100_000],
    ['headOfHousehold', 100_000], ['qualifyingSurvivingSpouse', 100_000],
  ] as const)('sources the 2026 %s statutory limit', (status, expected) => {
    const input = fixture()
    Object.assign(input.taxUnits[0]!.taxUnit, { federalFilingStatus: status })
    expect(staged(input).taxUnits[0]!.statutoryLimitCents).toBe(expected)
  })

  it('orders same-day actions by sequence and rejects duplicate authored positions', () => {
    const specs = [{ id: 'second', amount: 1_000, date: '2026-08-01', sequence: 2 },
      { id: 'first', amount: 1_000, date: '2026-08-01', sequence: 1 }]
    expect(staged(fixture(specs)).taxUnits[0]!.orderedActionEvidence.map((entry) => entry.actionId))
      .toEqual(['first', 'second'])
    specs[0]!.sequence = 1
    expect(stageAnnualQcdStandardSection170pLedger(fixture(specs))).toMatchObject({
      status: 'annualQcdStandardSection170pBlocked', issues: [{ kind: 'postPassInvalid' }] })
  })

  it('emits literal not-applicable zeros when the QCD exclusion leaves no contribution', () => {
    const result = staged(fixture(undefined, { taxableCapacity: { p1: 1_000 } }))
    expect(result.taxUnits[0]!.orderedActionEvidence[0]).toMatchObject({ treatment: 'notApplicable',
      eligibleContributionCents: 0, claimedByActionCents: 0,
      unclaimedWithoutCarryforwardCents: 0, deductionAmountAppliedByTaxLedgerCents: 0 })
  })

  it('binds selected deduction, run, and tax-input identities and freezes evidence', () => {
    const input = fixture(); const before = structuredClone(input)
    const committed = staged(input); const changedInput = fixture()
    Object.assign(changedInput.taxUnits[0]!, { selectedStandardDeductionEvidenceId: 'standard-other',
      liabilityRun: { liabilityRunKind: 'candidateT1', candidateFundingVectorEvidenceId: 'funding-1' } })
    const changed = staged(changedInput)
    expect(input).toEqual(before)
    expect(changed.taxUnits[0]!.orderedActionEvidence[0]!.actionEvidenceId)
      .not.toBe(committed.taxUnits[0]!.orderedActionEvidence[0]!.actionEvidenceId)
    expect(Object.isFrozen(committed.taxUnits[0]!.orderedActionEvidence)).toBe(true)
  })

  it.each([
    ['taxUnitInvalid', (input: StageAnnualQcdStandardSection170pLedgerInput) => Object.assign(input.taxUnits[0]!.sourceTaxYears, { cashPercentageLimit: 2027 })],
    ['taxUnitInvalid', (input: StageAnnualQcdStandardSection170pLedgerInput) => Object.assign(input.taxUnits[0]!.sourceTaxUnitIds, { standardDeduction: 'other-unit' })],
    ['taxUnitInvalid', (input: StageAnnualQcdStandardSection170pLedgerInput) => Object.assign(input.taxUnits[0]!.taxUnit, { taxYear: 2027 })],
    ['taxUnitInvalid', (input: StageAnnualQcdStandardSection170pLedgerInput) => Object.assign(input.taxUnits[0]!, { selectedStandardDeductionEvidenceId: '' })],
    ['taxUnitInvalid', (input: StageAnnualQcdStandardSection170pLedgerInput) => Object.assign(input.taxUnits[0]!, { liabilityRun: { liabilityRunKind: 'candidateT1', candidateFundingVectorEvidenceId: '' } })],
    ['taxUnitInvalid', (input: StageAnnualQcdStandardSection170pLedgerInput) => Object.assign(input.taxUnits[0]!, { contributionBaseEvidenceId: '' })],
    ['taxUnitInvalid', (input: StageAnnualQcdStandardSection170pLedgerInput) => Object.assign(input.taxUnits[0]!, { adjustedGrossIncomeBeforeCharitableDeductionCents: 0.5 })],
  ] as const)('fails closed for %s source mismatch', (kind, mutate) => {
    const input = fixture(); mutate(input)
    expect(stageAnnualQcdStandardSection170pLedger(input)).toMatchObject({
      status: 'annualQcdStandardSection170pBlocked', taxUnits: [], issues: [{ kind }] })
  })

  it('rejects hostile input before publishing partial ledgers', () => {
    const result = stageAnnualQcdStandardSection170pLedger(
      new Proxy(fixture(), {}) as StageAnnualQcdStandardSection170pLedgerInput)
    expect(result).toMatchObject({ status: 'annualQcdStandardSection170pBlocked',
      taxUnits: [], issues: [{ kind: 'hostileInput' }] })
  })
})
