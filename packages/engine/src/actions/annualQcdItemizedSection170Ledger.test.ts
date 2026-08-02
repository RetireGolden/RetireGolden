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
  stageAnnualQcdItemizedSection170Ledger,
  type AnnualQcdItemizedSection170TaxUnitInput,
  type StageAnnualQcdItemizedSection170LedgerInput,
} from './annualQcdItemizedSection170Ledger.js'

interface Spec { id: string; donor?: 'p1' | 'p2'; amount: number; date: string; sequence?: number }
interface Options {
  year?: number
  taxableCapacity?: Partial<Record<'p1' | 'p2', number>>
  joint?: boolean
  contributionBase?: number
  priorFloor?: number
  priorPercentage?: number
  openingItemized?: number
  carry?: Record<string, boolean>
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
    allocation: {
      allocationId: asAllocationId(`allocation-${spec.id}`),
      sourceAccountId: asAccountId(`ira-${donor}`),
      requestedAmount: asPositiveUsdCents(spec.amount),
    },
    charity: { ...charity, designationId: `charity-${spec.id}` },
  }
}
function fixture(
  specs: readonly Spec[] = [{ id: 'qcd-a', amount: 1_000, date: '2026-08-01' }],
  options: Options = {},
): StageAnnualQcdItemizedSection170LedgerInput {
  const year = options.year ?? 2026
  const requests = specs.map((spec) => request(spec, year))
  const donors = [...new Set(requests.map((entry) => entry.donorPersonId))].sort()
  const rawPlan = donors.includes(asPersonId('p2'))
    ? couplePlan({ p1Dob: '1955-01-31', p2Dob: '1955-01-31', p1PlanningAge: 90, p2PlanningAge: 90 })
    : singlePersonPlan({ dob: '1955-01-31', planningAge: 90 })
  rawPlan.accounts = donors.map((donor) => traditionalAccount(`ira-${donor}`, 1_000_000, donor))
  rawPlan.strategies.retirementActions = [...requests]
  rawPlan.retirementActionEligibilityFacts = {
    iraClassifications: donors.map((donor) => ({
      sourceAccountId: asAccountId(`ira-${donor}`), subtype: 'traditional' as const,
      evidenceId: `classification-${donor}`, provenance: { source: 'manual' as const },
    })),
    sepSimpleActivities: [],
    deductibleIraContributions: donors.flatMap((donorPersonId) =>
      Array.from({ length: year - 2024 }, (_, index) => ({
        donorPersonId, taxYear: 2025 + index, amountCents: asUsdCents(0),
        evidenceId: `contribution-${donorPersonId}-${2025 + index}`,
        provenance: { source: 'manual' as const, sourceId: `ledger-${donorPersonId}-${2025 + index}` },
      }))),
  }
  const parsed = parsePlan(rawPlan)
  if (!parsed.ok) throw new Error('invalid Plan fixture')
  const runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = {
    personAliveEvidence: requests.map((entry) => ({
      evidenceId: `alive-${entry.actionId}`, actionId: entry.actionId,
      personId: entry.donorPersonId, actionYear: year,
      actionDate: entry.executionDate ?? null, alive: true,
    })),
    priorQcdOffsetEvidence: requests.map((entry) => ({
      evidenceId: `offset-${entry.actionId}`, actionId: entry.actionId,
      donorPersonId: entry.donorPersonId, actionYear: year,
      actionDate: entry.executionDate ?? null, priorOffsetApplied: asUsdCents(0),
    })),
  }
  const prerequisite = evaluateAnnualQcdExecutionPrerequisites({
    taxYear: year, plan: parsed.plan, requests, runtimeEvidence,
  })
  if (prerequisite.status !== 'evaluated') throw new Error('invalid prerequisite fixture')
  const rmdPools: AnnualQcdRmdPoolOpeningSnapshot[] = donors.map((donor) => ({
    predicate: 'annualQcdOwnedIraRmdPoolOpeningSnapshot', poolId: `rmd-${donor}-${year}`,
    taxYear: year, donorPersonId: donor, scope: 'ownedIra',
    sourceAccountIds: [asAccountId(`ira-${donor}`)],
    rmdRequiredAmount: asUsdCents(0), rmdSatisfiedBefore: asUsdCents(0),
    rmdRemainingBefore: asUsdCents(0), upstreamEvidenceId: `rmd-source-${donor}`,
  }))
  const openingBalances = donors.map((donor) => ({
    accountId: asAccountId(`ira-${donor}`), openingBalance: asUsdCents(requests
      .filter((entry) => entry.donorPersonId === donor)
      .reduce((sum, entry) => sum + entry.requestedAmount, 0)),
  }))
  const poolCapacityInputs = donors.map((donor): ClassifyOwnedNonRothIraAnnualWithdrawalsInput => {
    const physical = requests.filter((entry) => entry.donorPersonId === donor)
      .reduce((sum, entry) => sum + entry.requestedAmount, 0)
    const capacity = options.taxableCapacity?.[donor as 'p1' | 'p2'] ?? 0
    const gross = Math.max(physical, capacity)
    const yearEnd = gross - physical
    return {
      ownerPersonId: donor, ownerWideNonRothIraPoolId: `pool-${donor}-${year}`,
      completePoolEvidence: {
        predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear', ownerPersonId: donor,
        ownerWideNonRothIraPoolId: `pool-${donor}-${year}`, taxYear: year,
        accountIds: [asAccountId(`ira-${donor}`)],
        yearEndApplicablePoolBalanceAmount: asUsdCents(yearEnd),
        evidenceId: `complete-pool-${donor}`,
      },
      annualBasisRecordEvidenceId: `basis-record-${donor}`, taxYear: year,
      poolMembers: [{
        sourceAccountId: asAccountId(`ira-${donor}`), ownerPersonId: donor,
        accountType: 'traditional', accountKind: 'ira', inheritanceStatus: 'owned',
        subtype: 'traditional', yearEndApplicableBalanceAmount: asUsdCents(yearEnd),
        iraClassificationEvidenceId: `tax-classification-${donor}`,
        accountOwnershipEvidenceId: `tax-ownership-${donor}`,
      }],
      annualFacts: {
        openingBasisAmount: asUsdCents(gross - capacity),
        taxYearNondeductibleContributionAmount: asUsdCents(0),
        postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
        yearEndApplicablePoolBalanceAmount: asUsdCents(yearEnd),
        outstandingRolloverAmount: asUsdCents(0), rolloverRepaymentAdjustmentAmount: asUsdCents(0),
        form8606Line7DistributionAmount: asUsdCents(0), form8606Line8NetConversionAmount: asUsdCents(0),
      },
      line7Distributions: [], line8Conversions: [],
    }
  })
  const taxUnit = (members: readonly typeof donors[number][], suffix: string): AnnualQcdItemizedSection170TaxUnitInput => ({
    taxUnit: {
      taxUnitId: `tax-unit-${suffix}`,
      taxUnitMemberPersonIds: members as [typeof donors[number], ...typeof donors[number][]],
      federalFilingStatus: members.length === 2 ? 'marriedFilingJointly' : 'single',
      stateFilingStatusId: members.length === 2 ? 'state-joint' : 'state-single',
      taxUnitEvidenceId: `tax-unit-evidence-${suffix}`, taxYear: year,
    },
    annualTaxLiabilityEvidenceId: `liability-${suffix}`,
    taxInputSnapshotId: `tax-input-${suffix}`,
    liabilityRun: { liabilityRunKind: 'committedAnnual', candidateFundingVectorEvidenceId: null },
    contributionBaseCents: options.contributionBase ?? 10_000,
    priorItemizerFloorAppliedCents: options.priorFloor ?? 0,
    priorCashPercentageLimitUsedCents: options.priorPercentage ?? 0,
    openingPostOtherLimitItemizedDeductionCents: options.openingItemized ?? 500,
    floorCarryforwardEligibility: requests.filter((entry) => members.includes(entry.donorPersonId))
      .map((entry) => ({ actionId: entry.actionId,
        eligible: options.carry?.[entry.actionId] ?? true,
        evidenceId: `carry-${entry.actionId}` })),
  })
  const taxUnits = options.joint
    ? [taxUnit(donors, 'joint')]
    : donors.map((donor) => taxUnit([donor], donor))
  return {
    postPassInput: {
      physicalInput: { prerequisite, plan: parsed.plan, runtimeEvidence, openingBalances, rmdPools },
      poolCapacityInputs,
    },
    taxUnits,
  }
}
function staged(input: StageAnnualQcdItemizedSection170LedgerInput) {
  const result = stageAnnualQcdItemizedSection170Ledger(input)
  expect(result.status).toBe('annualQcdItemizedSection170Staged')
  if (result.status !== 'annualQcdItemizedSection170Staged') throw new Error(result.issues[0].detail)
  return result
}

describe('stageAnnualQcdItemizedSection170Ledger', () => {
  it('applies the exact itemizer floor before the sourced cash percentage capacity', () => {
    const result = staged(fixture(undefined, { priorPercentage: 100 }))
    const ledger = result.taxUnits[0]!
    expect(ledger).toMatchObject({
      filingTreatment: 'itemized', contributionBaseCents: 10_000,
      itemizerFloorRateNumerator: 1, itemizerFloorRateDenominator: 200,
      itemizerFloorAmountCents: 50, cashPercentageLimitRateNumerator: 3,
      cashPercentageLimitRateDenominator: 5, cashPercentageLimitAmountCents: 6_000,
      exactAmountAuthority: 'cents', residualEvidenceId: result.residualEvidenceId,
    })
    expect(ledger.orderedActionEvidence[0]).toMatchObject({
      treatment: 'evaluated', eligibleContributionCents: 1_000,
      floorAppliedCents: 50, floorCarryforwardCents: 50,
      floorPermanentlyDisallowedCents: 0, postFloorContributionCents: 950,
      currentYearClaimedDeductionCents: 950, limitationCarryforwardCents: 50,
      unclaimedWithoutCarryforwardCents: 0,
      beforeAction: { cashPercentageLimitCapacityRemainingCents: 5_900,
        postOtherLimitItemizedDeductionBeforeSection68Cents: 500 },
      afterAction: { cashPercentageLimitCapacityRemainingCents: 4_950,
        postOtherLimitItemizedDeductionBeforeSection68Cents: 1_450 },
    })
    expect(result.section68Status).toBe('awaitingSection68Reconciliation')
  })

  it('rounds the half-cent floor once and partitions ineligible floor loss permanently', () => {
    const result = staged(fixture(undefined, {
      contributionBase: 100, carry: { 'qcd-a': false },
    }))
    expect(result.taxUnits[0]).toMatchObject({
      itemizerFloorAmountCents: 1, cashPercentageLimitAmountCents: 60,
      orderedActionEvidence: [{
        floorAppliedCents: 1, floorCarryforwardCents: 0,
        floorPermanentlyDisallowedCents: 1,
        currentYearClaimedDeductionCents: 60,
        percentageLimitCarryforwardCents: 939,
        limitationCarryforwardCents: 939, unclaimedWithoutCarryforwardCents: 1,
      }],
    })
  })

  it('shares floor and cash-cap state across joint spouses in canonical chronology', () => {
    const result = staged(fixture([
      { id: 'later-p1', donor: 'p1', amount: 500, date: '2026-09-01', sequence: 2 },
      { id: 'earlier-p2', donor: 'p2', amount: 500, date: '2026-03-01', sequence: 1 },
    ], { joint: true, contributionBase: 1_000, priorFloor: 5 }))
    const actions = result.taxUnits[0]!.orderedActionEvidence
    expect(actions.map((entry) => entry.actionId)).toEqual(['earlier-p2', 'later-p1'])
    expect(actions[0]).toMatchObject({
      currentYearClaimedDeductionCents: 500,
      afterAction: { cashPercentageLimitCapacityRemainingCents: 100 },
    })
    expect(actions[1]).toMatchObject({
      beforeAction: { cashPercentageLimitCapacityRemainingCents: 100 },
      currentYearClaimedDeductionCents: 100, percentageLimitCarryforwardCents: 400,
      afterAction: { cashPercentageLimitCapacityRemainingCents: 0 },
    })
    expect(actions[1]!.beforeAction).toBe(actions[0]!.afterAction)
  })

  it('emits a literal zero treatment while preserving the authoritative source run', () => {
    const result = staged(fixture(undefined, { taxableCapacity: { p1: 1_000 } }))
    expect(result.taxUnits[0]!.orderedActionEvidence[0]).toMatchObject({
      treatment: 'notApplicable', eligibleContributionCents: 0,
      floorAppliedCents: 0, currentYearClaimedDeductionCents: 0,
      limitationCarryforwardCents: 0, unclaimedWithoutCarryforwardCents: 0,
    })
  })

  it('binds run and tax-input identities deterministically and freezes the result', () => {
    const input = fixture()
    const before = structuredClone(input)
    const committed = staged(input)
    const repeat = staged(input)
    const t1Input = fixture()
    Object.assign(t1Input.taxUnits[0]!, { liabilityRun: {
      liabilityRunKind: 'candidateT1', candidateFundingVectorEvidenceId: 'funding-1',
    } })
    const t1 = staged(t1Input)
    const liabilityInput = fixture()
    Object.assign(liabilityInput.taxUnits[0]!, { annualTaxLiabilityEvidenceId: 'liability-other' })
    const liability = staged(liabilityInput)
    expect(input).toEqual(before)
    expect(repeat.taxUnits[0]!.evidenceId).toBe(committed.taxUnits[0]!.evidenceId)
    expect(t1.taxUnits[0]!.evidenceId).not.toBe(committed.taxUnits[0]!.evidenceId)
    expect(liability.taxUnits[0]!.orderedActionEvidence[0]!.actionEvidenceId)
      .not.toBe(committed.taxUnits[0]!.orderedActionEvidence[0]!.actionEvidenceId)
    expect(Object.isFrozen(committed)).toBe(true)
    expect(Object.isFrozen(committed.taxUnits[0]!.orderedActionEvidence[0]!.beforeAction)).toBe(true)
  })

  it.each([
    ['taxUnitInvalid', (input: StageAnnualQcdItemizedSection170LedgerInput) => { Object.assign(input.taxUnits[0]!, { floorCarryforwardEligibility: [] }) }],
    ['taxUnitInvalid', (input: StageAnnualQcdItemizedSection170LedgerInput) => { Object.assign(input.taxUnits[0]!, { contributionBaseCents: -1 }) }],
    ['taxUnitInvalid', (input: StageAnnualQcdItemizedSection170LedgerInput) => { Object.assign(input.taxUnits[0]!.taxUnit, { taxYear: 2027 }) }],
    ['taxUnitInvalid', (input: StageAnnualQcdItemizedSection170LedgerInput) => { Object.assign(input.taxUnits[0]!, { liabilityRun: { liabilityRunKind: 'candidateT1', candidateFundingVectorEvidenceId: '' } }) }],
    ['ledgerInvalid', (input: StageAnnualQcdItemizedSection170LedgerInput) => { Object.assign(input.taxUnits[0]!, { priorCashPercentageLimitUsedCents: 6_001 }) }],
  ] as const)('fails closed with %s evidence', (kind, mutate) => {
    const input = fixture() as unknown as StageAnnualQcdItemizedSection170LedgerInput
    mutate(input)
    expect(stageAnnualQcdItemizedSection170Ledger(input)).toMatchObject({
      status: 'annualQcdItemizedSection170Blocked', issues: [{ kind }],
    })
  })

  it('fails closed on hostile input without publishing partial ledgers', () => {
    const result = stageAnnualQcdItemizedSection170Ledger(
      new Proxy(fixture(), {}) as StageAnnualQcdItemizedSection170LedgerInput,
    )
    expect(result).toMatchObject({
      status: 'annualQcdItemizedSection170Blocked', taxUnits: [],
      issues: [{ kind: 'hostileInput' }],
    })
  })
})
