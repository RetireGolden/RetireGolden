import { describe, expect, it } from 'vitest'

import { parsePlan } from '../model/plan.js'
import { describeRule } from '../rules/describeRule.js'
import { singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import type { RetirementActionEligibilityRuntimeEvidence } from '../strategies/accountEligibility.js'
import type { QualifiedCharitableDistributionRequest } from './contract.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { evaluateAnnualQcdExecutionPrerequisites } from './annualQcdExecutionPrerequisite.js'
import type { AnnualQcdRmdPoolOpeningSnapshot } from './annualQcdPhysicalExecution.js'
import {
  stageAnnualQcdResidualForm8606,
  type StageAnnualQcdResidualForm8606Input,
} from './annualQcdResidualForm8606.js'
import type { ClassifyOwnedNonRothIraAnnualWithdrawalsInput } from './ownedNonRothIraWithdrawalCharacter.js'

interface Spec { id: string; amount: number; date: string; sequence?: number }
interface Options {
  basis?: number
  baseLine7?: number
  baseLine8?: number
  sourceBalance?: number
  year?: number
}

const charity = {
  designationId: 'public-charity',
  name: 'Public charity',
  designationKind: 'eligiblePublicCharity' as const,
  directFromCustodianAttested: true,
  eligibleOrganizationAttested: true,
  notDonorAdvisedFundOrSupportingOrganizationAttested: true,
  notSplitInterestEntityAttested: true,
  entireDistributionOtherwiseDeductibleAttested: true,
}

function request(spec: Spec, year: number): QualifiedCharitableDistributionRequest {
  return {
    actionId: asActionId(spec.id), kind: 'qcd', year,
    executionDate: spec.date, executionSequence: spec.sequence ?? 1,
    requestedAmount: asPositiveUsdCents(spec.amount), provenance: { source: 'manual' },
    donorPersonId: asPersonId('p1'),
    allocation: {
      allocationId: asAllocationId(`allocation-${spec.id}`),
      sourceAccountId: asAccountId('ira-p1'),
      requestedAmount: asPositiveUsdCents(spec.amount),
    },
    charity: { ...charity, designationId: `charity-${spec.id}` },
  }
}

function fixture(
  specs: readonly Spec[] = [{ id: 'qcd-a', amount: 1_000, date: '2026-08-01' }],
  options: Options = {},
): StageAnnualQcdResidualForm8606Input {
  const year = options.year ?? 2026
  const requests = specs.map((spec) => request(spec, year))
  const rawPlan = singlePersonPlan({ dob: '1955-01-31', planningAge: 90 })
  rawPlan.accounts = [traditionalAccount('ira-p1', 1_000_000, 'p1')]
  rawPlan.strategies.retirementActions = [...requests]
  rawPlan.retirementActionEligibilityFacts = {
    iraClassifications: [{
      sourceAccountId: asAccountId('ira-p1'), subtype: 'traditional',
      evidenceId: 'classification-p1', provenance: { source: 'manual' },
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: Array.from(
      { length: year - 2024 }, (_, index) => 2025 + index,
    ).map((taxYear) => ({
      donorPersonId: asPersonId('p1'), taxYear, amountCents: asUsdCents(0),
      evidenceId: `contribution-p1-${taxYear}`,
      provenance: { source: 'manual' as const, sourceId: `ledger-p1-${taxYear}` },
    })),
  }
  const parsed = parsePlan(rawPlan)
  if (!parsed.ok) throw new Error('invalid fixture Plan')
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
  if (prerequisite.status !== 'evaluated') throw new Error('invalid prerequisite')
  const requested = requests.reduce((sum, entry) => sum + entry.requestedAmount, 0)
  const rmdPools: AnnualQcdRmdPoolOpeningSnapshot[] = [{
    predicate: 'annualQcdOwnedIraRmdPoolOpeningSnapshot',
    poolId: `rmd-p1-${year}`, taxYear: year, donorPersonId: asPersonId('p1'),
    scope: 'ownedIra', sourceAccountIds: [asAccountId('ira-p1')],
    rmdRequiredAmount: asUsdCents(0), rmdSatisfiedBefore: asUsdCents(0),
    rmdRemainingBefore: asUsdCents(0), upstreamEvidenceId: 'rmd-upstream-p1',
  }]
  const line7 = options.baseLine7 ?? 0
  const line8 = options.baseLine8 ?? 0
  const line7Distributions = line7 === 0 ? [] : [{
    actionId: asActionId('base-distribution'), allocationId: asAllocationId('base-line7'),
    sourceAccountId: asAccountId('ira-p1'), scheduledDate: `${year}-04-01`,
    scheduledSequence: 10, grossAmount: asUsdCents(line7),
  }]
  const line8Conversions = line8 === 0 ? [] : [{
    actionId: asActionId('base-conversion'), allocationId: asAllocationId('base-line8'),
    sourceAccountId: asAccountId('ira-p1'), scheduledDate: `${year}-06-01`,
    scheduledSequence: 20, grossAmount: asUsdCents(line8),
  }]
  const poolCapacityInputs: ClassifyOwnedNonRothIraAnnualWithdrawalsInput[] = [{
    ownerPersonId: asPersonId('p1'), ownerWideNonRothIraPoolId: `pool-p1-${year}`,
    completePoolEvidence: {
      predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
      ownerPersonId: asPersonId('p1'), ownerWideNonRothIraPoolId: `pool-p1-${year}`,
      taxYear: year, accountIds: [asAccountId('ira-p1')],
      yearEndApplicablePoolBalanceAmount: asUsdCents(0), evidenceId: 'complete-pool-p1',
    },
    annualBasisRecordEvidenceId: 'basis-record-p1', taxYear: year,
    poolMembers: [{
      sourceAccountId: asAccountId('ira-p1'), ownerPersonId: asPersonId('p1'),
      accountType: 'traditional', accountKind: 'ira', inheritanceStatus: 'owned',
      subtype: 'traditional', yearEndApplicableBalanceAmount: asUsdCents(0),
      iraClassificationEvidenceId: 'tax-classification-p1',
      accountOwnershipEvidenceId: 'tax-ownership-p1',
    }],
    annualFacts: {
      openingBasisAmount: asUsdCents(options.basis ?? 0),
      taxYearNondeductibleContributionAmount: asUsdCents(0),
      postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
      yearEndApplicablePoolBalanceAmount: asUsdCents(0),
      outstandingRolloverAmount: asUsdCents(0),
      rolloverRepaymentAdjustmentAmount: asUsdCents(0),
      form8606Line7DistributionAmount: asUsdCents(line7),
      form8606Line8NetConversionAmount: asUsdCents(line8),
    },
    line7Distributions, line8Conversions,
  }]
  return { postPassInput: {
    physicalInput: {
      prerequisite, plan: parsed.plan, runtimeEvidence,
      openingBalances: [{
        accountId: asAccountId('ira-p1'),
        openingBalance: asUsdCents(options.sourceBalance ?? requested),
      }],
      rmdPools,
    },
    poolCapacityInputs,
  } }
}

function staged(input: StageAnnualQcdResidualForm8606Input) {
  const result = stageAnnualQcdResidualForm8606(input)
  expect(result.status).toBe('annualQcdResidualForm8606Staged')
  if (result.status !== 'annualQcdResidualForm8606Staged') throw new Error(result.issues[0].detail)
  return result
}

// Independent worksheet from IRC 408(d)(8)(B), Form 1040 line 4b Exception 3,
// and Form 8606 lines 7-8: the execution openingBalances default is a sole
// $10.00 IRA (the Plan account is 1,000,000 cents) with $4.00 of basis and
// $6.00 otherwise includible. Of a $10.00 charitable distribution, $6.00 can
// be a QCD and the $4.00 remainder is not a QCD. It is a distribution, not a
// Roth conversion, so the Form 8606 totals are line 7 = $4.00 and line 8 = $0.00.
describeRule('form-1040-line-4b-and-form-8606-line-7-qcd-remainder', {
  note: 'non-QCD remainder enters line 7 and cannot create line 8',
  readings: {
    formInstructions: { line7GrossAmount: 400, line8GrossAmount: 0 },
    rejectedTreatRemainderAsConversion: { line7GrossAmount: 0, line8GrossAmount: 400 },
  },
  accepted: 'formInstructions',
}, ({ accepted, readings }) => {
  it('rejoins the non-QCD remainder only with annual line-7 distributions', () => {
    const pool = staged(fixture(undefined, { basis: 400 })).pools[0]!
    const actual = {
      line7GrossAmount: pool.line7AllocationEvidence.annualGrossAmount,
      line8GrossAmount: pool.line8AllocationEvidence.annualGrossAmount,
    }

    expect(actual).toEqual(accepted)
    expect(actual).not.toEqual(readings.rejectedTreatRemainderAsConversion)
    expect(pool.qcdRemainderBindings[0]?.allocation).toMatchObject({
      grossAmount: 400,
      allocatedBasisAmount: 400,
      taxableAmount: 0,
    })
  })
})

describe('stageAnnualQcdResidualForm8606', () => {
  it('keeps qualified QCD dollars out of residual line 7 and preserves base lines', () => {
    const result = staged(fixture(undefined, { baseLine7: 100, baseLine8: 100 }))
    const pool = result.pools[0]!
    expect(pool).toMatchObject({
      adjustedResidualBasisDenominatorAmount: 200,
      adjustedResidualBasisNumeratorAmount: 0,
      qcdRemainderBindings: [],
      line7AllocationEvidence: { annualGrossAmount: 100, annualTaxableAmount: 100 },
      line8AllocationEvidence: { annualGrossAmount: 100, annualTaxableAmount: 100 },
    })
    expect(pool.line7AllocationEvidence.allocations.map((entry) => entry.actionId))
      .toEqual(['base-distribution'])
  })

  it('rebuilds both residual Form 8606 lines with the same adjusted annual ratio', () => {
    const result = staged(fixture(undefined, {
      basis: 100, baseLine7: 100, baseLine8: 100,
    }))
    expect(result.pools[0]).toMatchObject({
      annualBasisRatio: { numeratorMinorUnits: 100, denominatorMinorUnits: 200 },
      line7AllocationEvidence: {
        annualGrossAmount: 100,
        annualNontaxableBasisAmount: 50,
        annualTaxableAmount: 50,
      },
      line8AllocationEvidence: {
        annualGrossAmount: 100,
        annualNontaxableBasisAmount: 50,
        annualTaxableAmount: 50,
      },
    })
  })

  it('rejoins only non-QCD remainder and binds it as exact basis return', () => {
    const result = staged(fixture(undefined, { basis: 600, baseLine7: 100, baseLine8: 100 }))
    const pool = result.pools[0]!
    expect(pool).toMatchObject({
      adjustedResidualBasisDenominatorAmount: 600,
      adjustedResidualBasisNumeratorAmount: 600,
      annualBasisRatio: { numeratorMinorUnits: 600, denominatorMinorUnits: 600 },
      line7AllocationEvidence: { annualGrossAmount: 500, annualTaxableAmount: 0 },
      line8AllocationEvidence: { annualGrossAmount: 100, annualTaxableAmount: 0 },
      qcdRemainderBindings: [{ allocation: {
        actionId: 'qcd-a', grossAmount: 400, allocatedBasisAmount: 400, taxableAmount: 0,
      } }],
    })
  })

  it('allocates multiple remainders in canonical schedule order', () => {
    const result = staged(fixture([
      { id: 'later', amount: 400, date: '2026-09-01' },
      { id: 'earlier', amount: 600, date: '2026-03-01' },
    ], { basis: 1_000 }))
    expect(result.pools[0]?.qcdRemainderBindings.map((entry) => [
      entry.allocation.actionId, entry.allocation.allocatedBasisAmount,
    ])).toEqual([['earlier', 600], ['later', 400]])
  })

  it('uses the literal zero-denominator arm for zero physical movement', () => {
    const result = staged(fixture(undefined, { basis: 100, sourceBalance: 0 }))
    expect(result.pools[0]).toMatchObject({
      annualBasisRatio: { representation: 'notApplicableZeroDenominator' },
      line7AllocationEvidence: { annualGrossAmount: 0, allocations: [] },
      line8AllocationEvidence: { annualGrossAmount: 0, allocations: [] },
      qcdRemainderBindings: [],
    })
  })

  it('fails closed when a physical QCD leaks into base Form 8606 input', () => {
    const input = fixture()
    const request = input.postPassInput.physicalInput.prerequisite.requests[0]!
    const capacity = input.postPassInput.poolCapacityInputs[0]!
    const line7Distributions = [{
      actionId: request.actionId, allocationId: request.allocation.allocationId,
      sourceAccountId: request.allocation.sourceAccountId,
      scheduledDate: request.executionDate ?? null,
      scheduledSequence: request.executionSequence, grossAmount: asUsdCents(1_000),
    }]
    const forged = { postPassInput: {
      ...input.postPassInput,
      poolCapacityInputs: [{
        ...capacity, line7Distributions,
        annualFacts: {
          ...capacity.annualFacts,
          form8606Line7DistributionAmount: asUsdCents(1_000),
        },
      }],
    } }
    expect(stageAnnualQcdResidualForm8606(forged)).toMatchObject({
      status: 'annualQcdResidualForm8606Blocked', issues: [{ kind: 'postPassInvalid' }],
    })
  })

  it('fails closed when the exact-year post-pass is unavailable', () => {
    expect(stageAnnualQcdResidualForm8606(fixture(undefined, { year: 2027 })))
      .toMatchObject({
        status: 'annualQcdResidualForm8606Blocked',
        issues: [{ kind: 'postPassInvalid' }],
      })
  })

  it('is deterministic, recursively frozen, and does not mutate input', () => {
    const input = fixture([
      { id: 'later', amount: 400, date: '2026-09-01' },
      { id: 'earlier', amount: 600, date: '2026-03-01' },
    ], { basis: 1_000 })
    const before = structuredClone(input)
    const first = staged(input)
    const second = staged({ postPassInput: {
      ...input.postPassInput,
      physicalInput: { ...input.postPassInput.physicalInput, plan: {
        ...input.postPassInput.physicalInput.plan,
        strategies: {
          ...input.postPassInput.physicalInput.plan.strategies,
          retirementActions: [
            ...input.postPassInput.physicalInput.plan.strategies.retirementActions,
          ].reverse(),
        },
      } },
    } })
    expect(input).toEqual(before)
    expect(second).toEqual(first)
    expect(Object.isFrozen(first.pools[0]?.qcdRemainderBindings)).toBe(true)
    expect(Object.isFrozen(first.postPass)).toBe(true)
  })
})
