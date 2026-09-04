/**
 * Hostile delegation proof for the named-QCD execution-input coordinator.
 *
 * Each seam mutation leaves the Plan unchanged and alters one coordinator-owned
 * input channel. The annual result must follow the hostile output; a simulator
 * that rebuilt source capacity or Form 8606 pool input inline would not.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualQcdExecutionInput,
  AnnualQcdExecutionInputResult,
} from './internal/annualQcdExecutionInput.js'

type InputMutation = 'none' | 'withholdExecution' | 'zeroSource' | 'dropPool'

const hostile = vi.hoisted(() => ({ mutation: 'none' as InputMutation }))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      Readonly<AnnualQcdExecutionInput>,
      Readonly<AnnualQcdExecutionInputResult>
    >(),
)

vi.mock('./internal/annualQcdExecutionInput.js', async (importOriginal) =>
  seam.through(
    await importOriginal<typeof import('./internal/annualQcdExecutionInput.js')>(),
    'annualQcdExecutionInput',
    (production): Readonly<AnnualQcdExecutionInputResult> => {
      if (production.status !== 'ready') return production
      switch (hostile.mutation) {
        case 'withholdExecution':
          return Object.freeze({
            status: 'notRequested' as const,
            prerequisite: undefined,
            executorInput: null,
          })
        case 'zeroSource':
          return Object.freeze({
            ...production,
            executorInput: Object.freeze({
              ...production.executorInput,
              physicalInput: Object.freeze({
                ...production.executorInput.physicalInput,
                openingBalances: Object.freeze(
                  production.executorInput.physicalInput.openingBalances.map(
                    (balance) => Object.freeze({
                      ...balance,
                      openingBalance: 0 as typeof balance.openingBalance,
                    }),
                  ),
                ),
              }),
            }),
          })
        case 'dropPool':
          return Object.freeze({
            ...production,
            executorInput: Object.freeze({
              ...production.executorInput,
              poolCapacityInputs: Object.freeze([]),
            }),
          })
        case 'none':
          return production
      }
    },
  ),
)

import { expectSeamRan } from './simulate.seamGuard.test-support.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asPositiveUsdCents,
  asUsdCents,
  type QualifiedCharitableDistributionRequest,
} from '../actions/index.js'
import type { Account, Plan } from '../model/plan.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'

const YEAR = 2026
const GIFT_DOLLARS = 20_000

function namedQcd(): QualifiedCharitableDistributionRequest {
  const requestedAmount = asPositiveUsdCents(GIFT_DOLLARS * 100)
  return {
    actionId: asActionId('delegated-qcd'),
    kind: 'qcd',
    year: YEAR,
    executionDate: `${YEAR}-08-01`,
    executionSequence: 1,
    requestedAmount,
    provenance: { source: 'manual' },
    donorPersonId: asPersonId('p1'),
    allocation: {
      allocationId: asAllocationId('delegated-qcd-allocation'),
      sourceAccountId: asAccountId('ira'),
      requestedAmount,
    },
    charity: {
      designationId: 'charity',
      name: 'Eligible public charity',
      designationKind: 'eligiblePublicCharity',
      directFromCustodianAttested: true,
      eligibleOrganizationAttested: true,
      notDonorAdvisedFundOrSupportingOrganizationAttested: true,
      notSplitInterestEntityAttested: true,
      entireDistributionOtherwiseDeductibleAttested: true,
    },
  }
}

function ira(): Account {
  const account = traditionalAccount('ira', 500_000, 'p1', 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return {
    ...account,
    annualReturnPct: 0,
    nondeductibleBasis: 10_000,
  }
}

function plan(): Plan {
  const target = singlePersonPlan({ dob: '1950-03-01', planningAge: 95 })
  target.id = 'annual-qcd-execution-input-delegation'
  target.assumptions.inflationPct = 0
  target.assumptions.defaultReturnPct = 0
  target.expenses.baseAnnual = 0
  target.accounts = [cashAccount('cash', 100_000), ira()]
  target.strategies.qcdAnnual = 0
  target.strategies.retirementActions = [namedQcd()]
  target.retirementActionEligibilityFacts = {
    iraClassifications: [{
      sourceAccountId: 'ira',
      subtype: 'traditional',
      evidenceId: 'classification-ira',
      provenance: { source: 'manual' },
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: Array.from(
      { length: YEAR - 2020 + 1 },
      (_, index) => ({
        donorPersonId: 'p1',
        taxYear: 2020 + index,
        amountCents: asUsdCents(0),
        evidenceId: `contribution-${2020 + index}`,
        provenance: { source: 'manual' as const },
      }),
    ),
  }
  return validatePlan(target)
}

function run() {
  const result = simulatePlan(plan(), {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: createFlatTaxCalculator(0),
  })
  const year = result.years[0]
  if (year === undefined) throw new Error('missing year')
  return year
}

describe('simulatePlan delegates named-QCD execution input', () => {
  beforeEach(() => {
    hostile.mutation = 'none'
    seam.reset()
  })

  it('hands the coordinator the live post-RMD balance and complete owner seeds', () => {
    const year = run()
    // Uniform Lifetime Table age-76 divisor: 23.7. With no growth, the forced
    // distribution is $500,000 / 23.7 and this QCD seam must see the remainder,
    // not the $500,000 pre-distribution snapshot it separately carries.
    const requiredRmd = 500_000 / 23.7
    const postRmdBalance = 500_000 - requiredRmd

    expect(year.qcd).toBe(GIFT_DOLLARS)
    // One discarded settlement counterfactual pass, then the committed pass.
    const call = expectSeamRan(seam, 2).at(-1)
    expect(call?.input.requests.map((request) => request.actionId))
      .toEqual(['delegated-qcd'])
    expect(call?.input.balances.find((balance) => balance.accountId === 'ira'))
      .toEqual(expect.objectContaining({
        ownerPersonId: 'p1',
        isAggregatedIra: true,
        balancePlanDollars: expect.closeTo(postRmdBalance, 8),
        preDistributionBalancePlanDollars: 500_000,
      }))
    expect(call?.input.ownerRmd).toEqual([expect.objectContaining({
      ownerPersonId: 'p1',
      requiredPlanDollars: expect.closeTo(requiredRmd, 8),
      unsatisfiedPlanDollars: 0,
    })])
    expect(call?.input.ownerBasis).toEqual([{
      ownerPersonId: 'p1',
      basisPlanDollars: 10_000,
    }])
  })

  it.each([
    ['withholdExecution', 'the prepared executor call'],
    ['zeroSource', 'the prepared source-capacity snapshot'],
    ['dropPool', 'the prepared complete-pool capacity'],
  ] as const)('consumes %s rather than rebuilding %s inline', (mutation, label) => {
    hostile.mutation = mutation

    const year = run()

    const calls = expectSeamRan(seam, 2)
    expect(calls.every((call) => call.natural.status === 'ready'), label).toBe(true)
    expect(year.qcd).toBe(0)
    expect(year.balances.ira).toBeGreaterThan(0)
  })
})
