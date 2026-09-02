/**
 * Hostile delegation proof for named Roth-conversion input preparation.
 *
 * Each mutation changes one coordinator-owned output channel without changing
 * the Plan. The annual ledger must follow the hostile output rather than
 * rebuilding opening capacity or eligibility evidence inline.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualRothConversionExecutionInput,
  AnnualRothConversionExecutionInputResult,
} from './internal/annualRothConversionExecutionInput.js'

type InputMutation = 'none' | 'withholdExecution' | 'zeroSource' | 'dropRmd'

interface InputCall {
  readonly input: Readonly<AnnualRothConversionExecutionInput>
  readonly original: Readonly<AnnualRothConversionExecutionInputResult>
  readonly output: Readonly<AnnualRothConversionExecutionInputResult>
}

const seam = vi.hoisted(() => ({
  mutation: 'none' as InputMutation,
  calls: [] as InputCall[],
}))

vi.mock(
  './internal/annualRothConversionExecutionInput.js',
  async (importOriginal) => {
    const original = await importOriginal<
      typeof import('./internal/annualRothConversionExecutionInput.js')
    >()
    return {
      ...original,
      annualRothConversionExecutionInput: (
        input: Readonly<AnnualRothConversionExecutionInput>,
      ): Readonly<AnnualRothConversionExecutionInputResult> => {
        const production = original.annualRothConversionExecutionInput(input)
        const output: Readonly<AnnualRothConversionExecutionInputResult> = (() => {
          if (production.status !== 'ready') return production
          switch (seam.mutation) {
            case 'withholdExecution':
              return Object.freeze({
                status: 'notRequested' as const,
                executorInput: null,
                effectiveLinkedWithdrawalGroups:
                  production.effectiveLinkedWithdrawalGroups,
              })
            case 'zeroSource':
              return Object.freeze({
                ...production,
                executorInput: Object.freeze({
                  ...production.executorInput,
                  openingBalances: Object.freeze(
                    production.executorInput.openingBalances.map((balance) =>
                      Object.freeze({
                        ...balance,
                        openingBalance: balance.accountId === 'ira-a'
                          ? 0 as typeof balance.openingBalance
                          : balance.openingBalance,
                      })),
                  ),
                }),
              })
            case 'dropRmd':
              return Object.freeze({
                ...production,
                executorInput: Object.freeze({
                  ...production.executorInput,
                  runtimeEvidence: Object.freeze({
                    ...production.executorInput.runtimeEvidence,
                    ownerIraRmdSatisfactionEvidence: Object.freeze([]),
                  }),
                }),
              })
            case 'none':
              return production
          }
        })()
        seam.calls.push({ input, original: production, output })
        return output
      },
    }
  },
)

import {
  parseRetirementActionRequest,
  type RothConversionRequest,
} from '../actions/index.js'
import type { Account, Plan } from '../model/plan.js'
import {
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'

const TAX_YEAR = 2026
const CONVERSION_DOLLARS = 10_000

function cash(id: string, balance: number): Account {
  return {
    type: 'cash',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    balance,
    annualContribution: 0,
  }
}

function traditionalIra(id: string, balance: number): Account {
  return {
    type: 'traditional',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
  }
}

function rothIra(id: string): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance: 0,
    annualContribution: 0,
  }
}

function namedConversion(): RothConversionRequest {
  const parsed = parseRetirementActionRequest({
    actionId: 'named-conversion',
    kind: 'rothConversion',
    personId: 'p1',
    year: TAX_YEAR,
    executionDate: `${TAX_YEAR}-06-15`,
    executionSequence: 1,
    requestedAmount: CONVERSION_DOLLARS * 100,
    allocations: [{
      allocationId: 'named-conversion-allocation',
      sourceAccountId: 'ira-a',
      requestedAmount: CONVERSION_DOLLARS * 100,
    }],
    destinationRothAccountId: 'roth-a',
    taxFunding: { kind: 'noneExpected' },
    provenance: { source: 'manual' },
  })
  if (!parsed.ok || parsed.request.kind !== 'rothConversion') {
    throw new Error('invalid named-conversion fixture')
  }
  return parsed.request
}

function plan(): Plan {
  const target = singlePersonPlan({ planningAge: 60, dob: '1970-01-01' })
  target.id = 'annual-roth-conversion-execution-input-delegation'
  target.assumptions.inflationPct = 0
  target.assumptions.defaultReturnPct = 0
  target.expenses.baseAnnual = 0
  target.accounts = [
    cash('cash-a', 1_000_000),
    traditionalIra('ira-a', 100_000),
    rothIra('roth-a'),
  ]
  target.retirementActionEligibilityFacts = {
    iraClassifications: [{
      evidenceId: 'ira-a-classification',
      provenance: { source: 'manual' },
      sourceAccountId: 'ira-a',
      subtype: 'traditional',
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  target.strategies.retirementActions = [namedConversion()]
  return validatePlan(target)
}

function run() {
  const result = simulatePlan(plan(), {
    startYear: TAX_YEAR,
    horizonEndYear: TAX_YEAR,
    taxCalculator: createFlatTaxCalculator(0),
  })
  const year = result.years[0]
  if (year === undefined) throw new Error('missing year')
  return year
}

describe('simulatePlan delegates named Roth-conversion execution input', () => {
  beforeEach(() => {
    seam.mutation = 'none'
    seam.calls.length = 0
  })

  it('hands the coordinator post-withdrawal balances and owner facts', () => {
    const year = run()
    const call = seam.calls.at(-1)

    expect(year.rothConversionActionExecution?.committed).toBe(true)
    expect(call?.input.requests.map((request) => request.actionId))
      .toEqual(['named-conversion'])
    expect(call?.input.balances.find((balance) =>
      balance.accountId === 'ira-a')).toEqual({
      accountId: 'ira-a',
      balancePlanDollars: 100_000,
    })
    expect(call?.input.ownerRmd).toEqual([{
      ownerPersonId: 'p1',
      requiredPlanDollars: 0,
      unsatisfiedPlanDollars: 0,
    }])
    expect(call?.input.ownerBasis).toEqual([])
  })

  it.each([
    ['withholdExecution', 'the prepared executor call'],
    ['zeroSource', 'the prepared source-capacity snapshot'],
    ['dropRmd', 'the prepared owner-RMD evidence'],
  ] as const)('consumes %s rather than rebuilding %s inline', (mutation, label) => {
    seam.mutation = mutation

    const year = run()

    expect(seam.calls.length, label).toBeGreaterThan(0)
    expect(seam.calls.every((call) => call.original.status === 'ready')).toBe(true)
    expect(year.rothConversionActionExecution?.committed ?? false).toBe(false)
    expect(year.balances['ira-a']).toBeCloseTo(100_000, 6)
    expect(year.balances['roth-a']).toBeCloseTo(0, 6)
  })
})
