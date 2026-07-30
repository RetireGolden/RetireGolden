import { describe, expect, it } from 'vitest'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asPositiveUsdCents,
  parseRetirementActionRequest,
  type OrdinaryWithdrawalRequest,
  type RetirementActionRequest,
} from '../actions/index.js'
import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'

const noTax = createFlatTaxCalculator(0)

function basePlan(): Plan {
  let id = 0
  const plan = createEmptyPlan({
    newId: () => `action-sim-${++id}`,
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1970-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 90, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  return plan
}

function cash(id: string, balance: number, ownerPersonId = 'p1'): Account {
  return {
    type: 'cash',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    balance,
    annualContribution: 0,
  }
}

function parsedAction(input: unknown): RetirementActionRequest {
  const parsed = parseRetirementActionRequest(input)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

function withdrawal({
  actionId,
  accountId,
  dollars,
  year = 2026,
  sequence = 1,
  executionDate,
  personId = 'p1',
}: {
  actionId: string
  accountId: string
  dollars: number
  year?: number
  sequence?: number
  executionDate?: string
  personId?: string
}): OrdinaryWithdrawalRequest {
  const cents = asPositiveUsdCents(dollars * 100)
  return {
    actionId: asActionId(actionId),
    kind: 'ordinaryWithdrawal',
    personId: asPersonId(personId),
    year,
    ...(executionDate === undefined ? {} : { executionDate }),
    executionSequence: sequence,
    requestedAmount: cents,
    allocations: [{
      allocationId: asAllocationId(`allocation-${actionId}`),
      sourceAccountId: asAccountId(accountId),
      requestedAmount: cents,
    }],
    purpose: { kind: 'spending' },
    provenance: { source: 'manual' },
  }
}

function validate(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function run(plan: Plan, endYear = 2026) {
  return simulatePlan(validate(plan), {
    startYear: 2026,
    horizonEndYear: endYear,
    taxCalculator: noTax,
  })
}

describe('retirement-action cash execution in the annual ledger', () => {
  it('funds spending without double-debiting the named action source', () => {
    const plan = basePlan()
    plan.accounts = [cash('cash-a', 100)]
    plan.expenses.baseAnnual = 50
    plan.strategies.retirementActions = [
      withdrawal({ actionId: 'withdraw-50', accountId: 'cash-a', dollars: 50 }),
    ]

    const year = run(plan).years[0]!

    expect(year.balances['cash-a']).toBe(50)
    expect(year.withdrawals).toMatchObject({ cash: 50, total: 50 })
    expect(year.retirementActionExecution?.evidence[0]?.disposition).toMatchObject({
      outcome: 'executed',
      executedAmount: 5_000,
    })
  })

  it('does not quantize or brand unrelated balances outside the exact-cent boundary', () => {
    const plan = basePlan()
    plan.accounts = [
      cash('cash-a', 100),
      cash('   ', 25),
      {
        type: 'taxable',
        id: 'unrelated',
        name: 'Unrelated',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        balance: 90_071_992_547_410,
        costBasis: 0,
        interestYieldPct: 0,
        dividendYieldPct: 0,
        qualifiedRatio: 0,
        reinvestDividends: true,
        annualContribution: 0,
      },
    ]
    plan.expenses.baseAnnual = 50
    plan.strategies.retirementActions = [
      withdrawal({ actionId: 'withdraw-50', accountId: 'cash-a', dollars: 50 }),
    ]

    const year = run(plan).years[0]!

    expect(year.balances['cash-a']).toBe(50)
    expect(year.balances['   ']).toBe(25)
    expect(year.balances.unrelated).toBe(90_071_992_547_410)
  })

  it('uses only a partial action execution and lets legacy planning fund the residual', () => {
    const plan = basePlan()
    plan.accounts = [cash('action-source', 20), cash('residual-source', 100)]
    plan.expenses.baseAnnual = 50
    plan.strategies.retirementActions = [
      withdrawal({ actionId: 'partial', accountId: 'action-source', dollars: 50 }),
    ]

    const year = run(plan).years[0]!

    expect(year.retirementActionExecution?.evidence[0]?.disposition).toMatchObject({
      outcome: 'partial',
      executedAmount: 2_000,
      unexecutedAmount: 3_000,
    })
    expect(year.balances).toMatchObject({
      'action-source': 0,
      'residual-source': 70,
    })
    expect(year.withdrawals).toMatchObject({ cash: 50, total: 50 })
  })

  it('routes excess action proceeds through the existing surplus deposit flow', () => {
    const plan = basePlan()
    plan.accounts = [cash('cash-a', 100)]
    plan.expenses.baseAnnual = 20
    plan.strategies.retirementActions = [
      withdrawal({ actionId: 'excess', accountId: 'cash-a', dollars: 50 }),
    ]

    const year = run(plan).years[0]!

    expect(year.surplusInvested).toBe(30)
    expect(year.balances['cash-a']).toBe(80)
    expect(year.withdrawals).toMatchObject({ cash: 50, total: 50 })
  })

  it('sums executed proceeds as cents before crossing back to Plan dollars', () => {
    const plan = basePlan()
    plan.accounts = [cash('cash-a', 1)]
    plan.expenses.baseAnnual = 0.3
    plan.strategies.retirementActions = [
      withdrawal({ actionId: 'ten-cents', accountId: 'cash-a', dollars: 0.1 }),
      withdrawal({
        actionId: 'twenty-cents',
        accountId: 'cash-a',
        dollars: 0.2,
        sequence: 2,
      }),
    ]

    const year = run(plan).years[0]!

    expect(year.withdrawals).toMatchObject({ cash: 0.3, total: 0.3 })
    expect(year.balances['cash-a']).toBe(0.7)
  })

  it('allows the annual executed-cent sum to exceed one safe cent value', () => {
    const plan = basePlan()
    plan.accounts = [
      cash('cash-a', 50_000_000_000_000),
      cash('cash-b', 50_000_000_000_000),
    ]
    plan.expenses.baseAnnual = 100_000_000_000_000
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'first-fifty-trillion',
        accountId: 'cash-a',
        dollars: 50_000_000_000_000,
      }),
      withdrawal({
        actionId: 'second-fifty-trillion',
        accountId: 'cash-b',
        dollars: 50_000_000_000_000,
        sequence: 2,
      }),
    ]

    const year = run(plan).years[0]!

    expect(year.withdrawals).toMatchObject({
      cash: 100_000_000_000_000,
      total: 100_000_000_000_000,
    })
    expect(year.balances).toMatchObject({ 'cash-a': 0, 'cash-b': 0 })
  })

  it('returns non-actionable evidence when exact closing cents cannot be Plan dollars', () => {
    const plan = basePlan()
    plan.accounts = [cash('cash-a', 90_071_992_547_409.9)]
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'unrepresentable-closing',
        accountId: 'cash-a',
        dollars: 0.03,
      }),
    ]

    const year = run(plan).years[0]!

    expect(year.retirementActionExecution?.evidence[0]?.disposition).toMatchObject({
      outcome: 'unsupported',
      executedAmount: 0,
    })
    expect(
      year.retirementActionExecution?.evidence[0]?.disposition.reasons.map(
        (reason) => reason.code,
      ),
    ).toContain('required-facts-missing')
    expect(year.balances['cash-a']).toBe(90_071_992_547_409.9)
    expect(year.withdrawals.total).toBe(0)
  })

  it('returns non-actionable evidence when opening cash exceeds the cent ledger', () => {
    const plan = basePlan()
    plan.accounts = [cash('cash-a', 90_071_992_547_410)]
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'out-of-range-opening',
        accountId: 'cash-a',
        dollars: 1,
      }),
    ]

    const year = run(plan).years[0]!

    expect(year.retirementActionExecution?.evidence[0]?.disposition).toMatchObject({
      outcome: 'unsupported',
      executedAmount: 0,
    })
    expect(
      year.retirementActionExecution?.evidence[0]?.disposition.reasons.map(
        (reason) => reason.code,
      ),
    ).toContain('required-facts-missing')
    expect(year.balances['cash-a']).toBe(90_071_992_547_410)
    expect(year.withdrawals.total).toBe(0)
  })

  it('keeps explicit cash proceeds available when sizing a floor-limited conversion', () => {
    const make = (withAction: boolean): Plan => {
      const plan = basePlan()
      plan.accounts = [
        cash('cash-a', 70_000),
        {
          type: 'traditional',
          id: 'traditional',
          name: 'Traditional',
          ownerPersonId: 'p1',
          annualReturnPct: 0,
          kind: 'ira',
          balance: 1_000_000,
          annualContribution: 0,
        },
        {
          type: 'roth',
          id: 'roth',
          name: 'Roth',
          ownerPersonId: 'p1',
          annualReturnPct: 0,
          kind: 'ira',
          balance: 0,
          annualContribution: 0,
        },
      ]
      plan.expenses.baseAnnual = 10_000
      plan.strategies.taxableSafetyNetFloor = 50_000
      plan.strategies.rothConversion = {
        mode: 'fillToTarget',
        target: 'topOfBracket',
        targetValue: 24,
        startYear: 2026,
        endYear: 2026,
      }
      if (withAction) {
        plan.strategies.retirementActions = [
          withdrawal({
            actionId: 'explicit-liquidity',
            accountId: 'cash-a',
            dollars: 20_000,
          }),
        ]
      }
      return plan
    }

    const withoutAction = simulatePlan(validate(make(false)), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!
    const withAction = simulatePlan(validate(make(true)), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!

    expect(withoutAction.rothConversion).toBeGreaterThan(1_000)
    expect(withAction.rothConversion).toBeCloseTo(
      withoutAction.rothConversion,
      8,
    )
  })

  it('does not execute conversion-linked tax funding without its atomic group', () => {
    const plan = basePlan()
    plan.accounts = [
      cash('cash-a', 100),
      {
        type: 'traditional',
        id: 'traditional',
        name: 'Traditional',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'ira',
        balance: 100,
        annualContribution: 0,
      },
      {
        type: 'roth',
        id: 'roth',
        name: 'Roth',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'ira',
        balance: 0,
        annualContribution: 0,
      },
    ]
    const funding = withdrawal({
      actionId: 'tax-funding',
      accountId: 'cash-a',
      dollars: 10,
    })
    funding.purpose = { kind: 'taxPayment', referenceId: 'conversion' }
    plan.strategies.retirementActions = [
      funding,
      parsedAction({
        actionId: 'conversion',
        kind: 'rothConversion',
        personId: 'p1',
        year: 2026,
        executionDate: '2026-12-31',
        executionSequence: 2,
        requestedAmount: 5_000,
        allocations: [{
          allocationId: 'conversion-allocation',
          sourceAccountId: 'traditional',
          requestedAmount: 5_000,
        }],
        destinationRothAccountId: 'roth',
        taxFunding: {
          kind: 'linkedWithdrawal',
          withdrawalActionId: 'tax-funding',
        },
        provenance: { source: 'manual' },
      }),
    ]

    const year = run(plan).years[0]!
    const evidence = year.retirementActionExecution?.evidence

    expect(evidence).toHaveLength(2)
    expect(evidence?.find((entry) => entry.actionId === 'tax-funding')).toMatchObject({
      disposition: {
        outcome: 'unsupported',
        executedAmount: 0,
        reasons: [{ code: 'conversion-tax-funding-evidence-unsupported' }],
      },
    })
    expect(evidence?.find((entry) => entry.actionId === 'conversion')).toMatchObject({
      disposition: { outcome: 'unsupported', executedAmount: 0 },
    })
    expect(year.balances).toMatchObject({
      'cash-a': 100,
      traditional: 100,
      roth: 0,
    })
    expect(year.withdrawals.total).toBe(0)
  })

  it('executes an action only in its requested year and omits evidence otherwise', () => {
    const plan = basePlan()
    plan.accounts = [cash('cash-a', 100)]
    plan.strategies.retirementActions = [
      withdrawal({ actionId: 'once', accountId: 'cash-a', dollars: 25 }),
    ]

    const [first, second] = run(plan, 2027).years

    expect(first?.retirementActionExecution?.evidence).toHaveLength(1)
    expect(second).not.toHaveProperty('retirementActionExecution')
    expect(first?.balances['cash-a']).toBe(100)
    expect(second?.balances['cash-a']).toBe(100)
  })

  it('retains deterministic dated-before-undated evidence independent of plan order', () => {
    const plan = basePlan()
    plan.accounts = [cash('cash-a', 100)]
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'undated',
        accountId: 'cash-a',
        dollars: 10,
        sequence: 1,
      }),
      withdrawal({
        actionId: 'dated',
        accountId: 'cash-a',
        dollars: 10,
        sequence: 2,
        executionDate: '2026-06-01',
      }),
    ]

    expect(
      run(plan).years[0]?.retirementActionExecution?.evidence.map(
        (evidence) => evidence.actionId,
      ),
    ).toEqual(['dated', 'undated'])
  })

  it('keeps schedule conflicts atomic and leaves residual funding to the legacy path', () => {
    const plan = basePlan()
    plan.accounts = [cash('cash-a', 100)]
    plan.expenses.baseAnnual = 20
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'conflict-a',
        accountId: 'cash-a',
        dollars: 10,
        executionDate: '2026-06-01',
      }),
      withdrawal({
        actionId: 'conflict-b',
        accountId: 'cash-a',
        dollars: 10,
        executionDate: '2026-06-01',
      }),
    ]

    const year = run(plan).years[0]!

    expect(year.retirementActionExecution).toMatchObject({
      committed: false,
      evidence: [],
    })
    expect(year.balances['cash-a']).toBe(80)
    expect(year.withdrawals).toMatchObject({ cash: 20, total: 20 })
  })

  it('binds annual alive evidence and owner identity before movement', () => {
    const ownerMismatch = basePlan()
    ownerMismatch.accounts = [cash('cash-a', 100, 'p1')]
    ownerMismatch.household.people.push({
      id: 'p2',
      name: 'Chris',
      dob: '1970-01-01',
      sex: 'average',
      retirementAge: 65,
      longevity: { planningAge: 90, source: 'manual' },
    })
    ownerMismatch.strategies.retirementActions = [
      withdrawal({
        actionId: 'wrong-owner',
        accountId: 'cash-a',
        dollars: 10,
        personId: 'p2',
      }),
    ]
    const invalidMismatch = parsePlan(ownerMismatch)
    expect(invalidMismatch.ok).toBe(false)
    if (!invalidMismatch.ok) {
      expect(invalidMismatch.issues.join(' ')).toContain('owned by a different person')
    }

    const afterDeath = basePlan()
    afterDeath.household.people[0]!.longevity = { planningAge: 60, source: 'manual' }
    afterDeath.accounts = [cash('cash-a', 100)]
    afterDeath.strategies.retirementActions = [
      withdrawal({
        actionId: 'after-death',
        accountId: 'cash-a',
        dollars: 10,
        year: 2031,
      }),
    ]
    const deathYear = run(afterDeath, 2031).years.find((year) => year.year === 2031)!
    expect(deathYear.people[0]?.alive).toBe(false)
    expect(deathYear.retirementActionExecution?.evidence[0]?.disposition.outcome).toBe(
      'refused',
    )
    expect(deathYear.balances['cash-a']).toBe(100)
  })

  it('surfaces unsupported current and legacy kinds without changing scalar balances', () => {
    const plan = basePlan()
    plan.accounts = [
      {
        type: 'taxable',
        id: 'taxable',
        name: 'Taxable',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        balance: 100.005,
        costBasis: 80,
        interestYieldPct: 0,
        dividendYieldPct: 0,
        qualifiedRatio: 0,
        reinvestDividends: true,
        annualContribution: 0,
      },
      {
        type: 'traditional',
        id: 'employer-traditional',
        name: '401k',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'employer',
        balance: 50,
        annualContribution: 0,
      },
      {
        type: 'traditional',
        id: 'ira',
        name: 'IRA',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'ira',
        balance: 40,
        annualContribution: 0,
      },
      {
        type: 'roth',
        id: 'roth',
        name: 'Roth',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'ira',
        balance: 0,
        annualContribution: 0,
      },
    ]
    plan.strategies.retirementActions = [
      parsedAction({
        actionId: 'noncash',
        kind: 'ordinaryWithdrawal',
        personId: 'p1',
        year: 2026,
        executionSequence: 1,
        requestedAmount: 1_000,
        allocations: [{
          allocationId: 'noncash-allocation',
          sourceAccountId: 'taxable',
          requestedAmount: 1_000,
        }],
        purpose: { kind: 'spending' },
        provenance: { source: 'manual' },
      }),
      parsedAction({
        actionId: 'conversion',
        kind: 'rothConversion',
        personId: 'p1',
        year: 2026,
        executionSequence: 2,
        requestedAmount: 1_000,
        allocations: [{
          allocationId: 'conversion-allocation',
          sourceAccountId: 'employer-traditional',
          requestedAmount: 1_000,
        }],
        destinationRothAccountId: 'roth',
        taxFunding: { kind: 'noneExpected' },
        provenance: { source: 'manual' },
      }),
      parsedAction({
        actionId: 'qcd',
        kind: 'qcd',
        donorPersonId: 'p1',
        year: 2026,
        executionDate: '2026-12-31',
        executionSequence: 3,
        requestedAmount: 1_000,
        allocation: {
          allocationId: 'qcd-allocation',
          sourceAccountId: 'ira',
          requestedAmount: 1_000,
        },
        charity: {
          designationId: 'charity',
          name: 'Charity',
          designationKind: 'eligiblePublicCharity',
          directFromCustodianAttested: true,
          eligibleOrganizationAttested: true,
          notDonorAdvisedFundOrSupportingOrganizationAttested: true,
          notSplitInterestEntityAttested: true,
          entireDistributionOtherwiseDeductibleAttested: true,
        },
        provenance: { source: 'manual' },
      }),
      parsedAction({
        actionId: 'legacy-withdrawal',
        kind: 'legacyAggregateWithdrawal',
        year: 2026,
        requestedAmount: 1_000,
        legacyCategory: 'cash',
        provenance: { source: 'migration' },
      }),
      parsedAction({
        actionId: 'legacy-conversion',
        kind: 'legacyAggregateRothConversion',
        year: 2026,
        requestedAmount: 1_000,
        provenance: { source: 'migration' },
      }),
      parsedAction({
        actionId: 'legacy-qcd',
        kind: 'legacyAggregateQcd',
        year: 2026,
        requestedAmount: 1_000,
        legacyField: 'qcdAnnual',
        provenance: { source: 'migration' },
      }),
    ]

    const year = run(plan).years[0]!

    expect(year.retirementActionExecution).toMatchObject({ committed: true })
    expect(year.retirementActionExecution?.evidence).toHaveLength(6)
    expect(
      year.retirementActionExecution?.evidence.map(
        (evidence) => evidence.disposition.executedAmount,
      ),
    ).toEqual([0, 0, 0, 0, 0, 0])
    expect(year.withdrawals.total).toBe(0)
    expect(year.balances).toMatchObject({
      taxable: 100.005,
      'employer-traditional': 50,
      ira: 40,
      roth: 0,
    })
  })

  it('does not cent-convert an unsupported noncash action source', () => {
    const plan = basePlan()
    plan.accounts = [{
      type: 'taxable',
      id: 'taxable',
      name: 'Taxable',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      balance: 90_071_992_547_410,
      costBasis: 0,
      interestYieldPct: 0,
      dividendYieldPct: 0,
      qualifiedRatio: 0,
      reinvestDividends: true,
      annualContribution: 0,
    }]
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'unsupported-noncash',
        accountId: 'taxable',
        dollars: 10,
      }),
    ]

    const year = run(plan).years[0]!

    expect(year.retirementActionExecution?.evidence[0]?.disposition).toMatchObject({
      outcome: 'unsupported',
      executedAmount: 0,
    })
    expect(
      year.retirementActionExecution?.evidence[0]?.disposition.reasons.map(
        (reason) => reason.code,
      ),
    ).toContain('withdrawal-source-type-unsupported')
    expect(year.balances.taxable).toBe(90_071_992_547_410)
  })

  it('preserves empty-schedule projection bytes and account-ID behavior', () => {
    const left = basePlan()
    left.accounts = [cash('cash-a', 40), cash('cash-b', 60)]
    const right = structuredClone(left)
    right.accounts.reverse()

    expect(JSON.stringify(run(left))).toBe(JSON.stringify(run(structuredClone(left))))

    left.strategies.retirementActions = [
      withdrawal({ actionId: 'stable-source', accountId: 'cash-b', dollars: 20 }),
    ]
    left.expenses.baseAnnual = 20
    right.expenses.baseAnnual = 20
    right.strategies.retirementActions = structuredClone(
      left.strategies.retirementActions,
    )
    const leftYear = run(left).years[0]!
    const rightYear = run(right).years[0]!
    expect(leftYear.retirementActionExecution).toEqual(rightYear.retirementActionExecution)
    expect(leftYear.balances).toEqual(rightYear.balances)
  })
})
