/**
 * Hostile seam proof for conversion-linked withdrawal funding coordination.
 *
 * The wrapper first runs production, then replaces an earned authorization with
 * the fail-closed permission. Both authored legs must stop moving; merely calling
 * the coordinator while rebuilding its decision locally fails this test.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualConversionLinkedWithdrawalFundingInput,
  AnnualConversionLinkedWithdrawalFundingResult,
} from './internal/annualConversionLinkedWithdrawalFunding.js'

interface FundingCall {
  readonly input: AnnualConversionLinkedWithdrawalFundingInput
  readonly original: Readonly<AnnualConversionLinkedWithdrawalFundingResult>
  readonly output: Readonly<AnnualConversionLinkedWithdrawalFundingResult>
}

const seam = vi.hoisted(() => ({
  injectRefusal: false,
  calls: [] as FundingCall[],
}))

vi.mock(
  './internal/annualConversionLinkedWithdrawalFunding.js',
  async (importOriginal) => {
    const original = await importOriginal<
      typeof import('./internal/annualConversionLinkedWithdrawalFunding.js')
    >()
    return {
      ...original,
      annualConversionLinkedWithdrawalFunding: (
        input: AnnualConversionLinkedWithdrawalFundingInput,
      ) => {
        const production = original.annualConversionLinkedWithdrawalFunding(input)
        const output = seam.injectRefusal && production.release.kind === 'proven'
          ? {
              ...production,
              release: original.REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
            }
          : production
        seam.calls.push({ input, original: production, output })
        return output
      },
    }
  },
)

import { parseRetirementActionRequest } from '../actions/index.js'
import type { Account, Plan } from '../model/plan.js'
import {
  recurringOrdinaryIncome,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'

const YEAR = 2026
const CONVERSION_ACTION_ID = 'delegated-funded-conversion'
const WITHDRAWAL_ACTION_ID = 'delegated-tax-withdrawal'
const CONVERSION_CENTS = 40_000_00
const WITHDRAWAL_CENTS = 8_800_00

function request(input: Record<string, unknown>) {
  const parsed = parseRetirementActionRequest(input)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

function plan(): Plan {
  const target = singlePersonPlan({ planningAge: 60, dob: '1970-01-01' })
  target.id = 'linked-funding-delegation'
  const accounts: Account[] = [
    {
      type: 'cash',
      id: 'cash-a',
      name: 'cash-a',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      balance: 1_000_000,
      annualContribution: 0,
    },
    {
      type: 'traditional',
      id: 'ira-a',
      name: 'ira-a',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      kind: 'ira',
      balance: 400_000,
      annualContribution: 0,
      nondeductibleBasis: 0,
    },
    {
      type: 'roth',
      id: 'roth-a',
      name: 'roth-a',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      kind: 'ira',
      balance: 0,
      annualContribution: 0,
    },
  ]
  target.accounts = accounts
  target.incomes = [recurringOrdinaryIncome('pension', 90_000)]
  target.expenses.baseAnnual = 50_000
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
  target.strategies.retirementActions = [
    request({
      actionId: WITHDRAWAL_ACTION_ID,
      kind: 'ordinaryWithdrawal',
      personId: 'p1',
      year: YEAR,
      executionDate: `${YEAR}-06-14`,
      executionSequence: 1,
      requestedAmount: WITHDRAWAL_CENTS,
      allocations: [{
        allocationId: `${WITHDRAWAL_ACTION_ID}-allocation`,
        sourceAccountId: 'cash-a',
        requestedAmount: WITHDRAWAL_CENTS,
      }],
      purpose: { kind: 'taxPayment', referenceId: CONVERSION_ACTION_ID },
      provenance: { source: 'manual' },
    }),
    request({
      actionId: CONVERSION_ACTION_ID,
      kind: 'rothConversion',
      personId: 'p1',
      year: YEAR,
      executionDate: `${YEAR}-06-15`,
      executionSequence: 2,
      requestedAmount: CONVERSION_CENTS,
      allocations: [{
        allocationId: `${CONVERSION_ACTION_ID}-allocation`,
        sourceAccountId: 'ira-a',
        requestedAmount: CONVERSION_CENTS,
      }],
      destinationRothAccountId: 'roth-a',
      taxFunding: {
        kind: 'linkedWithdrawal',
        withdrawalActionId: WITHDRAWAL_ACTION_ID,
      },
      provenance: { source: 'manual' },
    }),
  ]
  return validatePlan(target)
}

function actionYear() {
  return simulatePlan(plan(), {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: createFlatTaxCalculator(22),
  }).years[0]!
}

beforeEach(() => {
  seam.injectRefusal = false
  seam.calls.length = 0
})

describe('simulatePlan conversion-linked withdrawal funding delegation', () => {
  it('uses the coordinator permission as the sole commit authority', () => {
    const production = actionYear()
    expect(production.conversionLinkedWithdrawalGroupExecution).toMatchObject({
      status: 'executed',
      movement: 'bothLegs',
    })
    expect(seam.calls.length).toBeGreaterThan(0)
    expect(seam.calls.every((call) =>
      Object.isFrozen(call.input) &&
      call.input.taxUnitId !== null &&
      new Set(call.input.omitActionIds).size === 2 &&
      call.input.omitActionIds.some((actionId) =>
        actionId === CONVERSION_ACTION_ID) &&
      call.input.omitActionIds.some((actionId) =>
        actionId === WITHDRAWAL_ACTION_ID)
    )).toBe(true)
    expect(seam.calls.some((call) => call.original.release.kind === 'proven'))
      .toBe(true)

    seam.injectRefusal = true
    seam.calls.length = 0
    const refused = actionYear()

    expect(seam.calls.some((call) => call.output !== call.original)).toBe(true)
    expect(refused.conversionLinkedWithdrawalGroupExecution).toMatchObject({
      status: 'refused',
      movement: 'none',
    })
    const records = refused.retirementActionPublication?.records ?? []
    expect(records.find((record) =>
      record.actionId === CONVERSION_ACTION_ID)).not.toMatchObject({
      outcome: 'executed',
    })
    expect(records.find((record) =>
      record.actionId === WITHDRAWAL_ACTION_ID)).not.toMatchObject({
      outcome: 'executed',
    })
  })
})
