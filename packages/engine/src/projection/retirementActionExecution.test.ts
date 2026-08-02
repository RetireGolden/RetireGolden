import { describe, expect, it } from 'vitest'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asPositiveUsdCents,
  ordinaryWithdrawalPublicationEligibility,
  parseRetirementActionRequest,
  type ExecuteOrdinaryWithdrawalsResult,
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

function equityComp(
  id: string,
  balance: number,
  costBasis: number,
  {
    ownerPersonId = 'p1',
    vestingMode = 'final',
    vestDate = null,
  }: {
    ownerPersonId?: string
    vestingMode?: 'final' | 'cliff'
    vestDate?: string | null
  } = {},
): Account {
  return {
    type: 'equityComp',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    balance,
    costBasis,
    annualContribution: 0,
    vestingMode,
    vestDate,
  }
}

function taxable(
  id: string,
  balance: number,
  costBasis: number,
  ownerPersonId: string | null = 'p1',
): Account {
  return {
    type: 'taxable',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    balance,
    costBasis,
    interestYieldPct: 0,
    dividendYieldPct: 0,
    qualifiedRatio: 0,
    reinvestDividends: true,
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

describe('retirement-action ordinary-withdrawal execution in the annual ledger', () => {
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
    expect(year.retirementActionPublication).toMatchObject({
      executorSources: ['ordinaryWithdrawalExecutor'],
      scheduleDiagnostics: [],
      records: [{ actionId: 'withdraw-50' }],
    })
    expect(year.retirementActionPublication?.records)
      .not.toBe(year.retirementActionExecution?.evidence)
    expect(year.retirementActionPublication?.records[0]?.request)
      .not.toBe(year.retirementActionExecution?.evidence[0]?.request)
  })

  it('publishes the executor-canonical request when Plan allocations are unsorted', () => {
    const plan = basePlan()
    plan.accounts = [cash('cash-z', 100), cash('cash-a', 100)]
    plan.expenses.baseAnnual = 20
    const action = withdrawal({
      actionId: 'unsorted-allocations',
      accountId: 'cash-z',
      dollars: 20,
    })
    action.allocations = [
      {
        allocationId: asAllocationId('allocation-z'),
        sourceAccountId: asAccountId('cash-z'),
        requestedAmount: asPositiveUsdCents(1_000),
      },
      {
        allocationId: asAllocationId('allocation-a'),
        sourceAccountId: asAccountId('cash-a'),
        requestedAmount: asPositiveUsdCents(1_000),
      },
    ]
    plan.strategies.retirementActions = [action]

    const year = run(plan).years[0]!

    expect(
      year.retirementActionPublication?.records[0]?.request.kind ===
        'ordinaryWithdrawal'
        ? year.retirementActionPublication.records[0].request.allocations.map(
          (allocation) => allocation.allocationId,
        )
        : [],
    ).toEqual(['allocation-a', 'allocation-z'])
  })

  it('prices final equity compensation once as ordinary income, never as gain', () => {
    const plan = basePlan()
    plan.accounts = [
      equityComp('equity', 100, 40),
      cash('cash', 0),
    ]
    plan.expenses.baseAnnual = 50
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'equity-income',
        accountId: 'equity',
        dollars: 100,
      }),
    ]

    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFlatTaxCalculator(10),
    }).years[0]!

    expect(year.retirementActionExecution?.evidence[0]).toMatchObject({
      disposition: { outcome: 'executed', executedAmount: 10_000 },
      acceptedSourceEligibility: [{
        sourceClass: 'equityCompensation',
        availabilityEvidence: { kind: 'alreadyVested' },
      }],
      taxCharacter: [{
        sourceClass: 'equityCompensation',
        kind: 'ordinaryIncome',
        amount: 10_000,
      }],
    })
    expect(year.tax).toBeCloseTo(10, 8)
    expect(year.magi).toBeCloseTo(100, 8)
    expect(year.realizedGains).toBe(0)
    expect(year.withdrawals).toMatchObject({
      cash: 0,
      taxable: 100,
      total: 100,
    })
    expect(year.balances).toMatchObject({ equity: 0, cash: 40 })
    expect(year.surplusInvested).toBeCloseTo(40, 8)
  })

  it('honors a dated equity cliff at the exact execution-date boundary', () => {
    const make = (executionDate: string): Plan => {
      const plan = basePlan()
      plan.accounts = [
        equityComp('equity', 100, 0, {
          vestingMode: 'cliff',
          vestDate: '2026-06-15',
        }),
      ]
      plan.strategies.retirementActions = [
        withdrawal({
          actionId: `equity-${executionDate}`,
          accountId: 'equity',
          dollars: 50,
          executionDate,
        }),
      ]
      return plan
    }

    const before = run(make('2026-06-14')).years[0]!
    const onDate = run(make('2026-06-15')).years[0]!

    expect(before.retirementActionExecution?.evidence[0]).toMatchObject({
      disposition: {
        outcome: 'refused',
        executedAmount: 0,
        reasons: [{ code: 'withdrawal-source-not-spendable' }],
      },
    })
    expect(before.balances.equity).toBe(100)
    expect(onDate.retirementActionExecution?.evidence[0]).toMatchObject({
      disposition: { outcome: 'executed', executedAmount: 5_000 },
      acceptedSourceEligibility: [{
        availabilityEvidence: {
          kind: 'vested',
          vestingDate: '2026-06-15',
        },
      }],
    })
    expect(onDate.balances.equity).toBe(50)
    expect(onDate.surplusInvested).toBe(50)
  })

  it('combines mixed cash and equity proceeds exactly once at cent precision', () => {
    const plan = basePlan()
    plan.accounts = [
      cash('cash', 1),
      equityComp('equity', 1, 0.4),
    ]
    plan.expenses.baseAnnual = 0.3
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'cash-ten-cents',
        accountId: 'cash',
        dollars: 0.1,
      }),
      withdrawal({
        actionId: 'equity-twenty-cents',
        accountId: 'equity',
        dollars: 0.2,
        sequence: 2,
      }),
    ]

    const year = run(plan).years[0]!

    expect(year.withdrawals).toMatchObject({
      cash: 0.1,
      taxable: 0.2,
      total: 0.3,
    })
    expect(year.balances).toMatchObject({ cash: 0.9, equity: 0.8 })
    expect(year.magi).toBeCloseTo(0.2, 8)
    expect(year.realizedGains).toBe(0)
  })

  it('preserves equity basis proportionally for later legacy sales', () => {
    const plan = basePlan()
    plan.accounts = [equityComp('equity', 100, 40)]
    plan.expenses.baseAnnual = 75
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'equity-first-half',
        accountId: 'equity',
        dollars: 50,
      }),
    ]

    const [first, second] = run(plan, 2027).years

    expect(first?.withdrawals).toMatchObject({ taxable: 75, total: 75 })
    expect(first?.realizedGains).toBeCloseTo(15, 8)
    expect(first?.balances.equity).toBeCloseTo(25, 8)
    expect(second?.withdrawals).toMatchObject({ taxable: 25, total: 25 })
    expect(second?.realizedGains).toBeCloseTo(15, 8)
    expect(second?.balances.equity).toBe(0)
  })

  it('includes equity action income when sizing a fill-to-target conversion', () => {
    const make = (withAction: boolean): Plan => {
      const plan = basePlan()
      plan.accounts = [
        cash('cash', 0),
        equityComp('equity', 20_000, 0),
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
            actionId: 'equity-headroom',
            accountId: 'equity',
            dollars: 10_000,
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

    expect(withAction.rothConversion).toBeCloseTo(
      withoutAction.rothConversion - 10_000,
      2,
    )
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

  it('executes an individually owned taxable source with aggregate-basis character', () => {
    const plan = basePlan()
    plan.accounts = [taxable('taxable-a', 100, 50)]
    plan.expenses.baseAnnual = 25
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'taxable-sale',
        accountId: 'taxable-a',
        dollars: 25,
      }),
    ]

    const year = run(plan).years[0]!

    expect(year.retirementActionExecution?.evidence[0]).toMatchObject({
      disposition: { outcome: 'executed', executedAmount: 2_500 },
      taxCharacter: [
        { sourceClass: 'taxable', kind: 'basisReturn', amount: 1_250 },
        { sourceClass: 'taxable', kind: 'capitalGain', amount: 1_250 },
      ],
    })
    expect(year.retirementActionExecution?.taxableBases[0]).toMatchObject({
      openingCostBasis: 5_000,
      closingCostBasis: 3_750,
    })
    expect(year.balances['taxable-a']).toBe(75)
    expect(year.withdrawals).toMatchObject({ taxable: 25, total: 25 })
    expect(year.realizedGains).toBe(12.5)
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

  it('uses stable account identity for surplus deposits across plan-order permutations', () => {
    const make = (reverseAccounts: boolean): Plan => {
      const plan = basePlan()
      const accounts = [
        cash('a-surplus-target', 0),
        cash('z-first-source', 50),
      ]
      plan.accounts = reverseAccounts ? accounts.reverse() : accounts
      plan.strategies.retirementActions = [
        withdrawal({
          actionId: 'create-surplus',
          accountId: 'z-first-source',
          dollars: 50,
        }),
        withdrawal({
          actionId: 'consume-surplus-next-year',
          accountId: 'a-surplus-target',
          dollars: 50,
          year: 2027,
        }),
      ]
      return plan
    }

    const forward = run(make(false), 2027)
    const reversed = run(make(true), 2027)
    const summarize = (result: ReturnType<typeof run>) =>
      result.years.map((year) => ({
        balances: year.balances,
        evidence: year.retirementActionExecution?.evidence.map((entry) => ({
          actionId: entry.actionId,
          disposition: entry.disposition,
        })),
      }))

    expect(summarize(reversed)).toEqual(summarize(forward))
    expect(forward.years[1]?.retirementActionExecution?.evidence[0]).toMatchObject({
      actionId: 'consume-surplus-next-year',
      disposition: { outcome: 'executed', executedAmount: 5_000 },
    })
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
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: 2026, amount: 20 }],
    }

    const year = run(plan).years[0]!
    const evidence = year.retirementActionExecution?.evidence

    expect(evidence).toHaveLength(1)
    expect(evidence?.find((entry) => entry.actionId === 'tax-funding')).toMatchObject({
      disposition: {
        outcome: 'unsupported',
        executedAmount: 0,
        reasons: [{ code: 'conversion-tax-funding-evidence-unsupported' }],
      },
    })
    expect(year.rothConversionActionExecution?.evidence).toEqual([
      expect.objectContaining({
        actionId: 'conversion',
        outcome: 'unsupported',
        readiness: 'nonActionable',
        executedAmount: 0,
      }),
    ])
    expect(year.rothConversionActionExecution).toMatchObject({
      committed: false,
    })
    expect(year.retirementActionPublication).toMatchObject({
      executorSources: [
        'ordinaryWithdrawalExecutor',
        'rothConversionExecutor',
      ],
    })
    expect(Object.fromEntries(year.retirementActionPublication!.records.map(
      (record) => [record.actionId, {
        executorSource: record.executorSource,
        executedAmount: record.executedAmount,
      }],
    ))).toEqual({
      'tax-funding': {
        executorSource: 'ordinaryWithdrawalExecutor',
        executedAmount: 0,
      },
      conversion: {
        executorSource: 'rothConversionExecutor',
        executedAmount: 0,
      },
    })
    expect(year.balances).toMatchObject({
      'cash-a': 100,
      traditional: 100,
      roth: 0,
    })
    expect(year.withdrawals.total).toBe(0)
  })

  it('rejects a source-aliased conversion destination before simulation', () => {
    const plan = basePlan()
    plan.accounts = [
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
    const conversion = parsedAction({
      actionId: 'aliased-conversion',
      kind: 'rothConversion',
      personId: 'p1',
      year: 2026,
      executionDate: '2026-12-31',
      executionSequence: 1,
      requestedAmount: 5_000,
      allocations: [{
        allocationId: 'aliased-conversion-allocation',
        sourceAccountId: 'traditional',
        requestedAmount: 5_000,
      }],
      destinationRothAccountId: 'roth',
      taxFunding: { kind: 'noneExpected' },
      provenance: { source: 'manual' },
    })
    if (conversion.kind !== 'rothConversion') throw new Error('fixture drift')
    conversion.destinationRothAccountId = conversion.allocations[0]!.sourceAccountId
    plan.strategies.retirementActions = [conversion]

    expect(() => run(plan)).toThrow(/destination aliases a source/i)
  })

  it('fails a mixed ordinary/conversion schedule collision as one annual batch', () => {
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
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'ordinary',
        accountId: 'cash-a',
        dollars: 10,
        executionDate: '2026-12-31',
        sequence: 1,
      }),
      parsedAction({
        actionId: 'conversion',
        kind: 'rothConversion',
        personId: 'p1',
        year: 2026,
        executionDate: '2026-12-31',
        executionSequence: 1,
        requestedAmount: 5_000,
        allocations: [{
          allocationId: 'conversion-allocation',
          sourceAccountId: 'traditional',
          requestedAmount: 5_000,
        }],
        destinationRothAccountId: 'roth',
        taxFunding: { kind: 'noneExpected' },
        provenance: { source: 'manual' },
      }),
    ]

    const year = run(plan).years[0]!

    expect(year.retirementActionExecution).toMatchObject({
      committed: false,
      evidence: [],
      scheduleIssues: [{
        kind: 'executionSequenceConflict',
        collidingActionIds: ['conversion', 'ordinary'],
      }],
    })
    expect(year.retirementActionExecution?.requests.map(
      (request) => request.actionId,
    )).toEqual(['conversion', 'ordinary'])
    expect(year).not.toHaveProperty('rothConversionActionExecution')
    expect(year.balances).toMatchObject({
      'cash-a': 100,
      traditional: 100,
      roth: 0,
    })
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
    expect(year.retirementActionPublication).toMatchObject({
      scheduleDiagnostics: [
        { actionId: 'conflict-a', kind: 'executionSequenceConflict' },
        { actionId: 'conflict-b', kind: 'executionSequenceConflict' },
      ],
    })
    expect(year.balances['cash-a']).toBe(80)
    expect(year.withdrawals).toMatchObject({ cash: 20, total: 20 })
  })

  it('publishes truthful batch-abort reasons for non-colliding mixed kinds', () => {
    const plan = basePlan()
    plan.accounts = [
      cash('cash-a', 100),
      {
        type: 'traditional',
        id: 'ira',
        name: 'IRA',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'ira',
        balance: 100,
        annualContribution: 0,
      },
      {
        type: 'roth',
        id: 'roth',
        name: 'Roth IRA',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'ira',
        balance: 0,
        annualContribution: 0,
      },
    ]
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
      parsedAction({
        actionId: 'conversion',
        kind: 'rothConversion',
        personId: 'p1',
        year: 2026,
        executionDate: '2026-07-01',
        executionSequence: 1,
        requestedAmount: 1_000,
        allocations: [{
          allocationId: 'conversion-allocation',
          sourceAccountId: 'ira',
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
        executionDate: '2026-08-01',
        executionSequence: 1,
        requestedAmount: 1_000,
        allocation: {
          allocationId: 'qcd-allocation',
          sourceAccountId: 'ira',
          requestedAmount: 1_000,
        },
        charity: {
          designationId: 'charity',
          name: 'Public Charity',
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
    ]

    const year = run(plan).years[0]!
    const publication = year.retirementActionPublication!

    expect(year.retirementActionExecution).toMatchObject({
      committed: false,
      evidence: [],
    })
    expect(publication.records).toHaveLength(5)
    expect(publication.records.every((record) =>
      record.outcome === 'refused' &&
      record.readiness === 'nonActionable' &&
      record.executedAmount === 0)).toBe(true)
    expect(Object.fromEntries(publication.records.map((record) => [
      record.actionId,
      record.reasons.map((reason) => reason.code),
    ]))).toEqual({
      'conflict-a': ['action-sequence-conflict'],
      'conflict-b': ['action-sequence-conflict'],
      conversion: ['action-batch-schedule-conflict'],
      qcd: ['action-batch-schedule-conflict'],
      'legacy-withdrawal': ['action-batch-schedule-conflict'],
    })
    expect(year.balances).toMatchObject({
      'cash-a': 100,
      ira: 100,
      roth: 0,
    })
  })

  it('keeps duplicate action IDs in the legacy executor diagnostics without publishing', () => {
    const plan = basePlan()
    plan.accounts = [cash('cash-a', 100)]
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'duplicate-action',
        accountId: 'cash-a',
        dollars: 10,
        sequence: 1,
      }),
      withdrawal({
        actionId: 'unique-before-mutation',
        accountId: 'cash-a',
        dollars: 10,
        sequence: 2,
      }),
    ]
    const executionPlan = validate(plan)
    executionPlan.strategies.retirementActions[1]!.actionId =
      asActionId('duplicate-action')

    const year = simulatePlan(executionPlan, {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!

    expect(year.retirementActionExecution).toMatchObject({
      committed: false,
      evidence: [],
      scheduleIssues: [{
        kind: 'duplicateActionId',
        actionId: 'duplicate-action',
        inputIndexes: [0, 1],
      }],
    })
    expect(year).not.toHaveProperty('retirementActionPublication')
  })

  it.each([
    {
      kind: 'actionYearMismatch' as const,
      actionId: asActionId('wrong-year'),
      expectedYear: 2026,
      actualYear: 2027,
    },
    {
      kind: 'duplicateActionId' as const,
      actionId: asActionId('duplicate'),
      inputIndexes: [0, 1] as [number, number],
    },
  ])('classifies $kind as legacy-only at the simulator publication boundary', (issue) => {
    const execution: ExecuteOrdinaryWithdrawalsResult = {
      committed: false,
      requests: [],
      scheduleIssues: [issue],
      balances: [],
      taxableBases: [],
      evidence: [],
    }

    expect(ordinaryWithdrawalPublicationEligibility(execution)).toEqual({
      kind: 'legacyScheduleDiagnosticsOnly',
      unsupportedIssueKinds: [issue.kind],
    })
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

  it('executes taxable while surfacing the remaining unsupported current and legacy kinds', () => {
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
    expect(year.retirementActionExecution?.evidence).toHaveLength(5)
    expect(year.rothConversionActionExecution?.evidence).toEqual([
      expect.objectContaining({
        actionId: 'conversion',
        outcome: 'unsupported',
        readiness: 'nonActionable',
        executedAmount: 0,
      }),
    ])
    expect(
      year.retirementActionExecution?.evidence.filter(
        (evidence) => evidence.disposition.executedAmount > 0,
      ),
    ).toHaveLength(1)
    expect(
      year.retirementActionExecution?.evidence.flatMap(
        (evidence) => evidence.taxCharacter,
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceClass: 'taxable' }),
      ]),
    )
    expect(year.withdrawals.total).toBe(10)
    expect(year.balances).toMatchObject({
      taxable: 100.01,
      'employer-traditional': 50,
      ira: 40,
      roth: 0,
    })
  })

  it('does not cent-convert an unrepresentable taxable action balance', () => {
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
        actionId: 'unrepresentable-taxable',
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
    ).toContain('required-facts-missing')
    expect(year.balances.taxable).toBe(90_071_992_547_410)
  })

  it('feeds taxable action gain through tax, MAGI, realized gains, and reporting once', () => {
    const plan = basePlan()
    plan.accounts = [
      cash('cash-for-tax', 100),
      taxable('taxable-gain', 100, 40),
    ]
    plan.expenses.baseAnnual = 50
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'gain-sale',
        accountId: 'taxable-gain',
        dollars: 50,
      }),
    ]

    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFlatTaxCalculator(10),
    }).years[0]!

    expect(year.retirementActionExecution?.evidence[0]).toMatchObject({
      disposition: { outcome: 'executed', executedAmount: 5_000 },
      taxCharacter: [
        { kind: 'basisReturn', amount: 2_000 },
        { kind: 'capitalGain', amount: 3_000 },
      ],
    })
    expect(year.retirementActionExecution?.taxableBases[0]).toMatchObject({
      openingCostBasis: 4_000,
      closingCostBasis: 2_000,
    })
    expect(year.tax).toBeCloseTo(3, 8)
    expect(year.magi).toBeCloseTo(30, 8)
    expect(year.realizedGains).toBeCloseTo(30, 8)
    expect(year.withdrawals).toMatchObject({
      cash: 3,
      taxable: 50,
      total: 53,
    })
    expect(year.balances).toMatchObject({
      'cash-for-tax': 97,
      'taxable-gain': 50,
    })
  })

  it('creates a carryforward from an action loss and uses it against later ordinary income', () => {
    const plan = basePlan()
    plan.accounts = [taxable('taxable-loss', 100, 10_100)]
    plan.expenses.baseAnnual = 100
    plan.incomes = [{
      type: 'recurring',
      id: 'later-income',
      label: 'Later income',
      annualAmount: 10_000,
      startYear: 2027,
      endYear: 2027,
      inflationAdjusted: false,
      taxTreatment: 'ordinary',
    }]
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'loss-sale',
        accountId: 'taxable-loss',
        dollars: 100,
      }),
    ]

    const rawCapitalInputs: Array<{
      year: number
      rawCapital: number | undefined
    }> = []
    const [lossYear, laterYear] = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2027,
      taxCalculator: {
        compute(input) {
          rawCapitalInputs.push({
            year: input.year,
            rawCapital: input.realizedCapitalGainsBeforeCarryforward,
          })
          return 0
        },
      },
    }).years

    expect(lossYear?.retirementActionExecution?.evidence[0]?.taxCharacter).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'capitalLoss', amount: 1_000_000 }),
      ]),
    )
    expect(lossYear).toMatchObject({
      realizedGains: -10_000,
      capitalLossUsedAgainstOrdinary: 3_000,
      capitalLossCarryforwardRemaining: 7_000,
      withdrawals: { taxable: 100, total: 100 },
    })
    expect(laterYear).toMatchObject({
      capitalLossUsedAgainstOrdinary: 3_000,
      capitalLossCarryforwardRemaining: 4_000,
    })
    expect(
      new Set(
        rawCapitalInputs
          .filter((input) => input.year === 2026)
          .map((input) => input.rawCapital),
      ),
    ).toEqual(new Set([-10_000]))
  })

  it('uses action-adjusted basis for a same-year residual legacy taxable sale', () => {
    const plan = basePlan()
    plan.accounts = [taxable('taxable-shared', 100, 40)]
    plan.expenses.baseAnnual = 75
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'action-first',
        accountId: 'taxable-shared',
        dollars: 50,
      }),
    ]

    const year = run(plan).years[0]!

    expect(year.retirementActionExecution?.taxableBases[0]).toMatchObject({
      openingCostBasis: 4_000,
      closingCostBasis: 2_000,
    })
    expect(year.withdrawals).toMatchObject({ taxable: 75, total: 75 })
    expect(year.realizedGains).toBeCloseTo(45, 8)
    expect(year.balances['taxable-shared']).toBeCloseTo(25, 8)
  })

  it('executes sequential taxable actions against the prior action closing basis', () => {
    const plan = basePlan()
    plan.accounts = [taxable('taxable-sequential', 100, 40)]
    plan.expenses.baseAnnual = 50
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'taxable-first',
        accountId: 'taxable-sequential',
        dollars: 25,
      }),
      withdrawal({
        actionId: 'taxable-second',
        accountId: 'taxable-sequential',
        dollars: 25,
        sequence: 2,
      }),
    ]

    const year = run(plan).years[0]!

    expect(
      year.retirementActionExecution?.evidence.map((evidence) =>
        evidence.taxCharacter
          .filter((character) => character.kind === 'capitalGain')
          .map((character) => character.amount),
      ),
    ).toEqual([[1_500], [1_500]])
    expect(year.retirementActionExecution?.taxableBases[0]).toMatchObject({
      openingCostBasis: 4_000,
      closingCostBasis: 2_000,
    })
    expect(year.withdrawals).toMatchObject({ taxable: 50, total: 50 })
    expect(year.realizedGains).toBe(30)
    expect(year.balances['taxable-sequential']).toBe(50)
  })

  it('refuses a mixed action atomically when taxable basis cannot cross the cent boundary', () => {
    const plan = basePlan()
    plan.accounts = [
      cash('cash-valid', 50),
      taxable('taxable-invalid-basis', 50, 90_071_992_547_410),
    ]
    plan.strategies.retirementActions = [parsedAction({
      actionId: 'mixed-invalid-basis',
      kind: 'ordinaryWithdrawal',
      personId: 'p1',
      year: 2026,
      executionSequence: 1,
      requestedAmount: 2_000,
      allocations: [
        {
          allocationId: 'mixed-cash',
          sourceAccountId: 'cash-valid',
          requestedAmount: 1_000,
        },
        {
          allocationId: 'mixed-taxable',
          sourceAccountId: 'taxable-invalid-basis',
          requestedAmount: 1_000,
        },
      ],
      purpose: { kind: 'spending' },
      provenance: { source: 'manual' },
    })]

    const year = run(plan).years[0]!

    expect(year.retirementActionExecution?.evidence[0]?.disposition).toMatchObject({
      outcome: 'unsupported',
      executedAmount: 0,
      reasons: [{ code: 'withdrawal-taxable-basis-unsupported' }],
    })
    expect(year.balances).toMatchObject({
      'cash-valid': 50,
      'taxable-invalid-basis': 50,
    })
  })

  it('fails closed for ambiguous and jointly owned taxable sources', () => {
    const ambiguous = basePlan()
    ambiguous.household.people.push({
      id: 'p2',
      name: 'Chris',
      dob: '1970-01-01',
      sex: 'average',
      retirementAge: 65,
      longevity: { planningAge: 90, source: 'manual' },
    })
    ambiguous.accounts = [
      cash('ambiguous-cash', 50),
      taxable('ambiguous-taxable', 100, 40),
    ]
    ambiguous.strategies.retirementActions = [parsedAction({
      actionId: 'ambiguous-unit',
      kind: 'ordinaryWithdrawal',
      personId: 'p1',
      year: 2026,
      executionSequence: 1,
      requestedAmount: 2_500,
      allocations: [
        {
          allocationId: 'ambiguous-cash-allocation',
          sourceAccountId: 'ambiguous-cash',
          requestedAmount: 1_000,
        },
        {
          allocationId: 'ambiguous-taxable-allocation',
          sourceAccountId: 'ambiguous-taxable',
          requestedAmount: 1_500,
        },
      ],
      purpose: { kind: 'spending' },
      provenance: { source: 'manual' },
    })]
    const ambiguousYear = run(ambiguous).years[0]!
    expect(
      ambiguousYear.retirementActionExecution?.evidence[0]?.disposition.reasons,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'withdrawal-taxable-basis-unsupported' }),
      ]),
    )
    expect(ambiguousYear.balances['ambiguous-cash']).toBe(50)
    expect(ambiguousYear.balances['ambiguous-taxable']).toBe(100)

    const joint = basePlan()
    joint.household.filingStatus = 'marriedFilingJointly'
    joint.household.people.push({
      id: 'p2',
      name: 'Chris',
      dob: '1970-01-01',
      sex: 'average',
      retirementAge: 65,
      longevity: { planningAge: 90, source: 'manual' },
    })
    joint.accounts = [taxable('joint-taxable', 100, 40, null)]
    joint.strategies.retirementActions = [
      withdrawal({
        actionId: 'joint-source',
        accountId: 'joint-taxable',
        dollars: 25,
      }),
    ]
    const jointYear = run(joint).years[0]!
    expect(
      jointYear.retirementActionExecution?.evidence[0]?.disposition.reasons,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'joint-source-acting-person-mismatch' }),
      ]),
    )
    expect(jointYear.balances['joint-taxable']).toBe(100)
  })

  it('keeps cash execution available when an unrelated living member has an invalid action identity', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people.push({
      id: ' ',
      name: 'Legacy whitespace identity',
      dob: '1970-01-01',
      sex: 'average',
      retirementAge: 65,
      longevity: { planningAge: 90, source: 'manual' },
    })
    plan.accounts = [
      cash('valid-cash', 50),
      taxable('taxable-without-valid-unit', 100, 40),
    ]
    plan.expenses.baseAnnual = 10
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'valid-cash-action',
        accountId: 'valid-cash',
        dollars: 10,
      }),
      withdrawal({
        actionId: 'taxable-invalid-unit',
        accountId: 'taxable-without-valid-unit',
        dollars: 10,
        sequence: 2,
      }),
    ]

    const year = run(plan).years[0]!

    expect(
      year.retirementActionExecution?.evidence.map(
        (evidence) => evidence.disposition.executedAmount,
      ),
    ).toEqual([1_000, 0])
    expect(
      year.retirementActionExecution?.evidence[1]?.disposition.reasons,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'withdrawal-taxable-basis-unsupported' }),
      ]),
    )
    expect(year.retirementActionExecution?.taxableBases).toEqual([])
    expect(year.withdrawals).toMatchObject({ cash: 10, taxable: 0, total: 10 })
    expect(year.balances).toMatchObject({
      'valid-cash': 40,
      'taxable-without-valid-unit': 100,
    })
  })

  it('keeps cash execution available when a named taxable source has a blank owner identity', () => {
    const plan = basePlan()
    plan.accounts = [
      cash('cash-valid-owner', 50),
      taxable('taxable-blank-owner', 100, 40),
    ]
    plan.expenses.baseAnnual = 10
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'cash-valid-owner-action',
        accountId: 'cash-valid-owner',
        dollars: 10,
      }),
      withdrawal({
        actionId: 'taxable-blank-owner-action',
        accountId: 'taxable-blank-owner',
        dollars: 10,
        sequence: 2,
      }),
    ]
    const executionPlan = validate(plan)
    const blankOwnerSource = executionPlan.accounts.find(
      (account) => account.id === 'taxable-blank-owner',
    )
    if (blankOwnerSource === undefined) throw new Error('test source missing')
    blankOwnerSource.ownerPersonId = ' '

    const year = simulatePlan(executionPlan, {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!

    expect(
      year.retirementActionExecution?.evidence.map(
        (evidence) => evidence.disposition.executedAmount,
      ),
    ).toEqual([1_000, 0])
    expect(
      year.retirementActionExecution?.evidence[1]?.disposition.reasons,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'source-owner-mismatch' }),
      ]),
    )
    expect(
      year.retirementActionExecution?.evidence[1]?.allocations[0]?.resolution,
    ).toBe('resolved')
    expect(year.retirementActionExecution?.taxableBases).toEqual([])
    expect(year.withdrawals).toMatchObject({ cash: 10, taxable: 0, total: 10 })
    expect(year.balances).toMatchObject({
      'cash-valid-owner': 40,
      'taxable-blank-owner': 100,
    })
  })

  it('shares one deterministic projected tax unit across individually owned MFJ sources', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people.push({
      id: 'p2',
      name: 'Chris',
      dob: '1970-01-01',
      sex: 'average',
      retirementAge: 65,
      longevity: { planningAge: 90, source: 'manual' },
    })
    plan.accounts = [
      taxable('taxable-p2', 50, 20, 'p2'),
      taxable('taxable-p1', 50, 20, 'p1'),
    ]
    plan.expenses.baseAnnual = 20
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'mfj-p1',
        accountId: 'taxable-p1',
        personId: 'p1',
        dollars: 10,
      }),
      withdrawal({
        actionId: 'mfj-p2',
        accountId: 'taxable-p2',
        personId: 'p2',
        dollars: 10,
        sequence: 2,
      }),
    ]

    const year = run(plan).years[0]!
    const bases = year.retirementActionExecution?.taxableBases ?? []

    expect(bases).toHaveLength(2)
    expect(new Set(bases.map((basis) => basis.taxUnit.taxUnitId)).size).toBe(1)
    expect(
      bases.map((basis) => basis.taxUnit.taxUnitMemberPersonIds),
    ).toEqual([['p1', 'p2'], ['p1', 'p2']])
    expect(year.withdrawals).toMatchObject({ taxable: 20, total: 20 })
    expect(year.balances).toMatchObject({ 'taxable-p1': 40, 'taxable-p2': 40 })
  })

  it('keeps taxable execution invariant under account order permutation', () => {
    const left = basePlan()
    left.accounts = [
      taxable('taxable-target', 100, 40),
      cash('cash-unrelated', 25),
      taxable('taxable-unrelated', 90_071_992_547_410, 0),
    ]
    left.strategies.retirementActions = [
      withdrawal({
        actionId: 'order-invariant-taxable',
        accountId: 'taxable-target',
        dollars: 25,
      }),
    ]
    const right = structuredClone(left)
    right.accounts.reverse()

    const leftYear = run(left).years[0]!
    const rightYear = run(right).years[0]!

    expect(leftYear.retirementActionExecution).toEqual(
      rightYear.retirementActionExecution,
    )
    expect(leftYear.balances).toEqual(rightYear.balances)
    expect(leftYear.realizedGains).toBe(rightYear.realizedGains)
  })

  it('includes fixed action gain in the conservative optimizer capital base', () => {
    const plan = basePlan()
    plan.accounts = [taxable('taxable-optimizer', 100, 40)]
    plan.expenses.baseAnnual = 50
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'optimizer-action-gain',
        accountId: 'taxable-optimizer',
        dollars: 50,
      }),
    ]
    const probes: Array<{ year: number; capitalGainsBase: number }> = []

    simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
      captureOptimizerInputs: (probe) => {
        probes.push({
          year: probe.year,
          capitalGainsBase: probe.capitalGainsBase,
        })
      },
    })

    expect(probes).toEqual([{ year: 2026, capitalGainsBase: 30 }])
  })

  it('fails closed when exact taxable proceeds cannot cross the Plan aggregate boundary', () => {
    const firstDollars = 90_071_992_547_409.9
    const secondDollars = 90_071_992_547_409.89
    const plan = basePlan()
    plan.accounts = [
      taxable('huge-taxable-a', firstDollars, firstDollars),
      taxable('huge-taxable-b', secondDollars, secondDollars),
    ]
    plan.strategies.retirementActions = [
      withdrawal({
        actionId: 'huge-taxable-a-sale',
        accountId: 'huge-taxable-a',
        dollars: firstDollars,
      }),
      withdrawal({
        actionId: 'huge-taxable-b-sale',
        accountId: 'huge-taxable-b',
        dollars: secondDollars,
        sequence: 2,
      }),
    ]

    const year = run(plan).years[0]!

    expect(
      year.retirementActionExecution?.evidence.map(
        (evidence) => evidence.disposition.executedAmount,
      ),
    ).toEqual([0, 0])
    expect(
      year.retirementActionExecution?.evidence.flatMap(
        (evidence) => evidence.disposition.reasons.map((reason) => reason.code),
      ),
    ).toEqual([
      'withdrawal-taxable-basis-unsupported',
      'required-facts-missing',
      'withdrawal-taxable-basis-unsupported',
      'required-facts-missing',
    ])
    expect(year.retirementActionExecution?.balances).toEqual([])
    expect(year.retirementActionExecution?.taxableBases).toEqual([])
    expect(year.withdrawals).toMatchObject({ taxable: 0, total: 0 })
    expect(year.realizedGains).toBe(0)
    expect(year.balances).toMatchObject({
      'huge-taxable-a': firstDollars,
      'huge-taxable-b': secondDollars,
    })
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
