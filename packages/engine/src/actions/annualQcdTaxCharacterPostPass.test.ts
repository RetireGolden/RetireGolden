import { describe, expect, it } from 'vitest'
import { parsePlan, type Plan } from '../model/plan.js'
import { couplePlan, singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import type { RetirementActionEligibilityRuntimeEvidence } from '../strategies/accountEligibility.js'
import type { QualifiedCharitableDistributionRequest } from './contract.js'
import { asAccountId, asActionId, asAllocationId, asPersonId } from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { evaluateAnnualQcdExecutionPrerequisites } from './annualQcdExecutionPrerequisite.js'
import {
  stageAnnualQcdPhysicalExecution,
  type AnnualQcdRmdPoolOpeningSnapshot,
  type StageAnnualQcdPhysicalExecutionInput,
} from './annualQcdPhysicalExecution.js'
import {
  stageAnnualQcdTaxCharacterPostPass,
  type StageAnnualQcdTaxCharacterPostPassInput,
} from './annualQcdTaxCharacterPostPass.js'
import type { ClassifyOwnedNonRothIraAnnualWithdrawalsInput } from './ownedNonRothIraWithdrawalCharacter.js'
interface ActionSpec {
  id: string
  donor?: 'p1' | 'p2'
  source?: string
  amount: number
  date?: string
  sequence?: number
}
interface FixtureOptions {
  year?: number
  capacity?: Partial<Record<'p1' | 'p2', number>>
  contribution?: Partial<Record<'p1' | 'p2', number>>
  priorOffset?: Record<string, number>
  balance?: Record<string, number>
  rmdRemaining?: number
}
const charity = {
  designationId: 'charity-a', name: 'Public charity',
  designationKind: 'eligiblePublicCharity' as const,
  directFromCustodianAttested: true, eligibleOrganizationAttested: true,
  notDonorAdvisedFundOrSupportingOrganizationAttested: true,
  notSplitInterestEntityAttested: true,
  entireDistributionOtherwiseDeductibleAttested: true,
}
function request(spec: ActionSpec, year: number): QualifiedCharitableDistributionRequest {
  const donor = spec.donor ?? 'p1'
  const source = spec.source ?? `ira-${donor}`
  const amount = asPositiveUsdCents(spec.amount)
  return {
    actionId: asActionId(spec.id), kind: 'qcd', year,
    executionDate: spec.date ?? `${year}-08-01`,
    executionSequence: spec.sequence ?? 1, requestedAmount: amount,
    provenance: { source: 'manual' }, donorPersonId: asPersonId(donor),
    allocation: {
      allocationId: asAllocationId(`allocation-${spec.id}`),
      sourceAccountId: asAccountId(source), requestedAmount: amount,
    },
    charity: { ...charity, designationId: `charity-${spec.id}` },
  }
}
function fixture(
  specs: readonly ActionSpec[] = [{ id: 'qcd-a', amount: 1_000 }],
  options: FixtureOptions = {},
): StageAnnualQcdTaxCharacterPostPassInput {
  const year = options.year ?? 2026
  const requests = specs.map((spec) => request(spec, year))
  const donors = [...new Set(requests.map((entry) => entry.donorPersonId))]
  const rawPlan = donors.includes(asPersonId('p2'))
    ? couplePlan({ p1Dob: '1955-01-31', p2Dob: '1955-01-31', p1PlanningAge: 90, p2PlanningAge: 90 })
    : singlePersonPlan({ dob: '1955-01-31', planningAge: 90 })
  const sourceIds = [...new Set(requests.map((entry) => entry.allocation.sourceAccountId))]
  rawPlan.accounts = sourceIds.map((sourceId) => {
    const owner = requests.find((entry) => entry.allocation.sourceAccountId === sourceId)!.donorPersonId
    return traditionalAccount(sourceId, 1_000_000, owner)
  })
  rawPlan.strategies.retirementActions = [...requests]
  rawPlan.retirementActionEligibilityFacts = {
    iraClassifications: sourceIds.map((sourceAccountId) => ({
      sourceAccountId, subtype: 'traditional' as const,
      evidenceId: `classification-${sourceAccountId}`, provenance: { source: 'manual' as const },
    })),
    sepSimpleActivities: [],
    deductibleIraContributions: donors.flatMap((donorPersonId) =>
      Array.from({ length: year - 2024 }, (_, index) => 2025 + index).map((taxYear) => ({
        donorPersonId, taxYear,
        amountCents: asUsdCents(taxYear === year
          ? options.contribution?.[donorPersonId as 'p1' | 'p2'] ?? 0
          : 0),
        evidenceId: `contribution-${donorPersonId}-${taxYear}`,
        provenance: { source: 'manual' as const, sourceId: `ledger-${donorPersonId}-${taxYear}` },
      }))),
  }
  const parsed = parsePlan(rawPlan)
  if (!parsed.ok) throw new Error('invalid fixture Plan')
  const plan = parsed.plan
  const runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = {
    personAliveEvidence: requests.map((entry) => ({
      evidenceId: `alive-${entry.actionId}`, actionId: entry.actionId,
      personId: entry.donorPersonId, actionYear: year,
      actionDate: entry.executionDate ?? null, alive: true,
    })),
    priorQcdOffsetEvidence: requests.map((entry) => ({
      evidenceId: `offset-${entry.actionId}`, actionId: entry.actionId,
      donorPersonId: entry.donorPersonId, actionYear: year,
      actionDate: entry.executionDate ?? null,
      priorOffsetApplied: asUsdCents(options.priorOffset?.[entry.actionId] ?? 0),
    })),
  }
  const prerequisite = evaluateAnnualQcdExecutionPrerequisites({
    taxYear: year, plan, requests, runtimeEvidence,
  })
  if (prerequisite.status !== 'evaluated') throw new Error('invalid fixture prerequisite')
  const openingBalances = sourceIds.map((accountId) => ({
    accountId,
    openingBalance: asUsdCents(options.balance?.[accountId] ?? requests
      .filter((entry) => entry.allocation.sourceAccountId === accountId)
      .reduce((sum, entry) => sum + entry.requestedAmount, 0)),
  }))
  const rmdPools: AnnualQcdRmdPoolOpeningSnapshot[] = donors.map((donorPersonId) => ({
    predicate: 'annualQcdOwnedIraRmdPoolOpeningSnapshot',
    poolId: `rmd-${donorPersonId}-${year}`, taxYear: year, donorPersonId,
    scope: 'ownedIra',
    sourceAccountIds: sourceIds.filter((sourceId) =>
      requests.some((entry) => entry.donorPersonId === donorPersonId &&
        entry.allocation.sourceAccountId === sourceId)) as [ReturnType<typeof asAccountId>, ...ReturnType<typeof asAccountId>[]],
    rmdRequiredAmount: asUsdCents(options.rmdRemaining ?? 500),
    rmdSatisfiedBefore: asUsdCents(0),
    rmdRemainingBefore: asUsdCents(options.rmdRemaining ?? 500),
    upstreamEvidenceId: `rmd-upstream-${donorPersonId}`,
  }))
  const physicalInput: StageAnnualQcdPhysicalExecutionInput = {
    prerequisite, plan, runtimeEvidence, openingBalances, rmdPools,
  }
  const physical = stageAnnualQcdPhysicalExecution(physicalInput)
  if (physical.status !== 'annualQcdPhysicalExecutionStaged') throw new Error('invalid fixture physical stage')
  const poolCapacityInputs = donors.map((donorPersonId): ClassifyOwnedNonRothIraAnnualWithdrawalsInput => {
    const donorApps = physical.applications.filter((entry) => entry.request.donorPersonId === donorPersonId)
    const physicalQcdTotal = donorApps.reduce(
      (sum, entry) => sum + entry.charitableDistributionAmount, 0,
    )
    const desiredCapacity = options.capacity?.[donorPersonId as 'p1' | 'p2'] ?? physicalQcdTotal + 1_000
    const gross = Math.max(physicalQcdTotal, desiredCapacity)
    const yearEnd = gross - physicalQcdTotal
    const accountIds = rmdPools.find((entry) => entry.donorPersonId === donorPersonId)!.sourceAccountIds
    return {
      ownerPersonId: donorPersonId,
      ownerWideNonRothIraPoolId: `tax-pool-${donorPersonId}-${year}`,
      completePoolEvidence: {
        predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
        ownerPersonId: donorPersonId,
        ownerWideNonRothIraPoolId: `tax-pool-${donorPersonId}-${year}`,
        taxYear: year, accountIds,
        yearEndApplicablePoolBalanceAmount: asUsdCents(yearEnd),
        evidenceId: `complete-pool-${donorPersonId}-${year}`,
      },
      annualBasisRecordEvidenceId: `basis-record-${donorPersonId}-${year}`,
      taxYear: year,
      poolMembers: accountIds.map((sourceAccountId, index) => ({
        sourceAccountId, ownerPersonId: donorPersonId,
        accountType: 'traditional', accountKind: 'ira', inheritanceStatus: 'owned',
        subtype: 'traditional',
        yearEndApplicableBalanceAmount: asUsdCents(index === 0 ? yearEnd : 0),
        iraClassificationEvidenceId: `tax-classification-${sourceAccountId}`,
        accountOwnershipEvidenceId: `tax-ownership-${sourceAccountId}`,
      })),
      annualFacts: {
        openingBasisAmount: asUsdCents(gross - desiredCapacity),
        taxYearNondeductibleContributionAmount: asUsdCents(0),
        postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
        yearEndApplicablePoolBalanceAmount: asUsdCents(yearEnd),
        outstandingRolloverAmount: asUsdCents(0),
        rolloverRepaymentAdjustmentAmount: asUsdCents(0),
        form8606Line7DistributionAmount: asUsdCents(0),
        form8606Line8NetConversionAmount: asUsdCents(0),
      },
      line7Distributions: [], line8Conversions: [],
    }
  })
  return { physicalInput, poolCapacityInputs }
}
function staged(input: StageAnnualQcdTaxCharacterPostPassInput) {
  const result = stageAnnualQcdTaxCharacterPostPass(input)
  expect(result.status).toBe('annualQcdTaxCharacterPostPassStaged')
  if (result.status !== 'annualQcdTaxCharacterPostPassStaged') throw new Error(result.issues[0].detail)
  return result
}
describe('stageAnnualQcdTaxCharacterPostPass', () => {
  it('stages a fully excludable provisional partition without final authority', () => {
    const input = fixture()
    const snapshot = structuredClone(input)
    const result = staged(input)
    expect(input).toEqual(snapshot)
    expect(result).toMatchObject({
      committed: false, movement: 'notCommitted',
      taxCharacterStatus: 'awaitingResidualAndSection170Reconciliation',
      personalLimitEvidence: {
        taxYear: 2026, personalLimitAmount: 11_100_000,
        parameterPackYear: 2026, parameterSource: { id: 'rmd-qcd' },
      },
      applications: [{
        charitableDistributionAmount: 1_000,
        qualifiedCharitableDistributionAmount: 1_000,
        excludableQcdAmount: 1_000, taxableQcdAmount: 0,
        nonQcdCharitableRemainder: 0, charitableDeductionEligibleAmount: 0,
        charitableDeductionRequirement: 'notApplicableZeroEligibleAmount',
        provisionalCharacter: {
          status: 'provisionalAwaitingResidualAndSection170Reconciliation',
          qcdIncomeExclusionAmount: 1_000, ordinaryIncomeAmount: 0, basisReturnAmount: 0,
        },
      }],
    })
    expect(Object.isFrozen(result.applications[0]?.provisionalCharacter)).toBe(true)
    expect(result.applications[0]).not.toHaveProperty('taxCharacter')
  })

  it('uses taxable capacity first and sends the excess to basis remainder', () => {
    const result = staged(fixture(undefined, { capacity: { p1: 600 } }))
    expect(result.applications[0]).toMatchObject({
      otherwiseTaxableAmountUsed: 600, qualifiedCharitableDistributionAmount: 600,
      nonQcdCharitableRemainder: 400, excludableQcdAmount: 600,
      taxableQcdAmount: 0, charitableDeductionEligibleAmount: 400,
    })
    expect(result.pools[0]).toMatchObject({
      physicalQcdGrossAmount: 1_000, taxablePoolGrossBalanceBefore: 1_000,
      taxablePoolBasisBefore: 400, otherwiseTaxableAmountBefore: 600,
      qualifiedCharitableDistributionAmount: 600, nonQcdCharitableRemainder: 400,
      adjustedResidualBasisDenominatorAmount: 400,
      adjustedResidualBasisNumeratorAmount: 400, otherwiseTaxableAmountAfter: 0,
    })
  })

  it('applies deductible-contribution offset before exclusion', () => {
    const result = staged(fixture(undefined, { contribution: { p1: 300 } }))
    expect(result.applications[0]).toMatchObject({
      deductibleContributionOffsetBefore: 300,
      deductibleContributionOffsetApplied: 300,
      excludableQcdAmount: 700, taxableQcdAmount: 300,
      charitableDeductionEligibleAmount: 300,
    })
  })

  it('opens lifetime offset state from prior-year QCD consumption', () => {
    const result = staged(fixture(undefined, {
      contribution: { p1: 500 }, priorOffset: { 'qcd-a': 200 },
    }))
    expect(result.applications[0]).toMatchObject({
      deductibleContributionOffsetBefore: 300,
      deductibleContributionOffsetApplied: 300,
      deductibleContributionOffsetAfter: 0,
      excludableQcdAmount: 700,
    })
  })

  it('applies the exact-year personal limit per donor', () => {
    const result = staged(fixture([{ id: 'large', amount: 12_000_000 }]))
    expect(result.applications[0]).toMatchObject({
      personalLimitBefore: 11_100_000, personalLimitUsed: 11_100_000,
      excludableQcdAmount: 11_100_000, taxableQcdAmount: 900_000,
    })
  })

  it('produces the exact three-way partition', () => {
    const result = staged(fixture(undefined, {
      capacity: { p1: 800 }, contribution: { p1: 300 },
    }))
    expect(result.applications[0]).toMatchObject({
      excludableQcdAmount: 500, taxableQcdAmount: 300,
      nonQcdCharitableRemainder: 200, charitableDeductionEligibleAmount: 500,
      provisionalCharacter: {
        qcdIncomeExclusionAmount: 500, ordinaryIncomeAmount: 300, basisReturnAmount: 200,
      },
    })
  })

  it('exhausts one donor pool in canonical schedule order', () => {
    const result = staged(fixture([
      { id: 'later', amount: 700, date: '2026-09-01' },
      { id: 'earlier', amount: 700, date: '2026-03-01' },
    ], { capacity: { p1: 1_000 } }))
    expect(result.applications.map((entry) => [
      entry.actionId, entry.otherwiseTaxableAmountBefore,
      entry.otherwiseTaxableAmountUsed, entry.otherwiseTaxableAmountAfter,
    ])).toEqual([
      ['earlier', 1_000, 700, 300], ['later', 300, 300, 0],
    ])
  })

  it('keeps spouse capacity, personal limits, and offsets separate', () => {
    const result = staged(fixture([
      { id: 'p1-qcd', donor: 'p1', amount: 1_000 },
      { id: 'p2-qcd', donor: 'p2', amount: 1_000, sequence: 2 },
    ], { contribution: { p1: 300 }, capacity: { p1: 600, p2: 1_000 } }))
    expect(result.applications.map((entry) => [
      entry.donorPersonId, entry.personalLimitBefore,
      entry.deductibleContributionOffsetBefore, entry.excludableQcdAmount,
    ])).toEqual([
      ['p1', 11_100_000, 300, 300], ['p2', 11_100_000, 0, 1_000],
    ])
  })

  it('does not let RMD remaining cap QCD character', () => {
    const none = staged(fixture(undefined, { rmdRemaining: 0 }))
    const full = staged(fixture(undefined, { rmdRemaining: 1_000 }))
    expect(none.applications[0]?.excludableQcdAmount).toBe(1_000)
    expect(full.applications[0]?.excludableQcdAmount).toBe(1_000)
    expect([none.applications[0]?.rmdSatisfiedByAction,
      full.applications[0]?.rmdSatisfiedByAction]).toEqual([0, 1_000])
  })

  it('does not consume annual state for a zero physical movement', () => {
    const result = staged(fixture(undefined, { balance: { 'ira-p1': 0 } }))
    expect(result.applications[0]).toMatchObject({
      charitableDistributionAmount: 0, otherwiseTaxableAmountUsed: 0,
      personalLimitUsed: 0, deductibleContributionOffsetApplied: 0,
      excludableQcdAmount: 0, charitableDeductionEligibleAmount: 0,
    })
  })

  it('fails closed for a future-year stand-in parameter pack', () => {
    const result = stageAnnualQcdTaxCharacterPostPass(fixture(undefined, { year: 2027 }))
    expect(result).toMatchObject({
      status: 'annualQcdTaxCharacterPostPassBlocked',
      issues: [{ kind: 'taxParameterUnavailable' }], applications: [], pools: [],
    })
  })

  it('rejects an incomplete Plan QCD batch', () => {
    const input = fixture()
    ;(input.physicalInput.plan as Plan).strategies.retirementActions.push(
      request({ id: 'omitted', amount: 1_000, date: '2026-10-01' }, 2026),
    )
    expect(stageAnnualQcdTaxCharacterPostPass(input)).toMatchObject({
      status: 'annualQcdTaxCharacterPostPassBlocked',
      issues: [{ kind: 'incompletePlanBatch' }],
    })
  })

  it('rejects forged physical prerequisite evidence atomically', () => {
    const input = structuredClone(fixture()) as StageAnnualQcdTaxCharacterPostPassInput
    const evidence = input.physicalInput.prerequisite.evidence[0]!
    ;(evidence as { actionId: string }).actionId = 'forged'
    expect(stageAnnualQcdTaxCharacterPostPass(input)).toMatchObject({
      status: 'annualQcdTaxCharacterPostPassBlocked', applications: [], pools: [],
      issues: [{ kind: 'physicalInvalid' }],
    })
  })

  it.each(['line7Distributions', 'line8Conversions'] as const)(
    'rejects physical QCD leakage into base %s', (ledger) => {
      const input = fixture()
      const leaked = [{
        actionId: asActionId('qcd-a'), allocationId: asAllocationId('allocation-qcd-a'),
        sourceAccountId: asAccountId('ira-p1'), scheduledDate: '2026-08-01',
        scheduledSequence: 1, grossAmount: asUsdCents(1_000),
      }]
      const capacity = input.poolCapacityInputs[0]!
      expect(stageAnnualQcdTaxCharacterPostPass({
        ...input, poolCapacityInputs: [{ ...capacity, [ledger]: leaked }],
      })).toMatchObject({
        status: 'annualQcdTaxCharacterPostPassBlocked',
        issues: [{ kind: 'poolCapacityInvalid' }],
      })
    },
  )

  it('rejects donor offset chronology that reuses an earlier offset', () => {
    const input = fixture([
      { id: 'first', amount: 200, date: '2026-03-01' },
      { id: 'second', amount: 200, date: '2026-06-01' },
    ], { contribution: { p1: 300 }, priorOffset: { first: 0, second: 0 } })
    expect(stageAnnualQcdTaxCharacterPostPass(input)).toMatchObject({
      status: 'annualQcdTaxCharacterPostPassBlocked',
      issues: [{ kind: 'contributionOffsetInvalid' }],
    })
  })
})
