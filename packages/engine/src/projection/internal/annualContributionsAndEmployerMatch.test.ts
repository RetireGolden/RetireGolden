/**
 * Characterization guard for extracting the annual contribution/match phase.
 * Formula-level statutory behavior remains covered by the existing IRA, HSA,
 * 401(k), and Roth-catch-up tests. These cases pin the extraction hazards:
 * positional duplicate ids, operation order, exact folds, raw identities,
 * basis effects, routing, and purity/re-entry.
 */
import { describe, expect, it } from 'vitest'

import type { Account } from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import {
  annualContributionsAndEmployerMatch,
  type AnnualContributionBalanceView,
  type AnnualContributionCreditOperation,
  type AnnualContributionsAndEmployerMatchInput,
  type AnnualEmployerMatchOperation,
} from './annualContributionsAndEmployerMatch.js'

const YEAR = 2026
const { pack } = packForYear(YEAR)

function balance(
  account: Account,
  amount = 'balance' in account ? account.balance : 0,
  costBasis = account.type === 'taxable' || account.type === 'equityComp'
    ? account.costBasis
    : 0,
): AnnualContributionBalanceView {
  return {
    account: account as AnnualContributionBalanceView['account'],
    balance: amount,
    costBasis,
  }
}

function account(
  type: AnnualContributionBalanceView['account']['type'],
  id: string,
  annualContribution: number,
  overrides: Record<string, unknown> = {},
): Account {
  const common = {
    type,
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    balance: 100,
    annualContribution,
    ...overrides,
  }
  if (type === 'traditional' || type === 'roth') {
    return { ...common, kind: 'ira', ...overrides } as Account
  }
  if (type === 'taxable' || type === 'equityComp') {
    return { ...common, costBasis: 40 } as Account
  }
  return common as Account
}

function call(
  balances: readonly AnnualContributionBalanceView[],
  overrides: Partial<AnnualContributionsAndEmployerMatchInput> = {},
) {
  return annualContributionsAndEmployerMatch({
    balances,
    year: YEAR,
    startYear: YEAR,
    inflFactor: 1,
    limitGrowth: 1,
    filingStatus: 'single',
    aliveCount: 1,
    peopleCount: 1,
    primaryPersonId: 'p1',
    wagesByPerson: new Map([['p1', 100_000]]),
    resolveOwnerState: () => ({ alive: true, ageAttained: 40 }),
    resolveOwnerBirthYear: () => 1986,
    resolveOwnerDob: () => '1986-01-01',
    resolveRothPoolKey: (row) =>
      row.kind === 'ira'
        ? `rothira:${row.ownerPersonId ?? 'p1'}`
        : `roth:${row.id}`,
    runtimeOccurrenceKey: (kind, ...binding) =>
      JSON.stringify([kind, ...binding]),
    iraHouseholdCompensationKey: 'ira:household-compensation',
    indexWithStatutoryRounding: (base, growth) => base * growth,
    pack,
    ...overrides,
  })
}

function contributions(
  result: ReturnType<typeof annualContributionsAndEmployerMatch>,
): readonly AnnualContributionCreditOperation[] {
  return result.operations.filter(
    (operation): operation is AnnualContributionCreditOperation =>
      operation.kind === 'contribution',
  )
}

function matches(
  result: ReturnType<typeof annualContributionsAndEmployerMatch>,
): readonly AnnualEmployerMatchOperation[] {
  return result.operations.filter(
    (operation): operation is AnnualEmployerMatchOperation =>
      operation.kind === 'employerMatch',
  )
}

describe('annualContributionsAndEmployerMatch — positional planning', () => {
  it('keeps compatible duplicate-id requests positional with indexed runtime identity', () => {
    const rows = [
      balance(account('traditional', 'duplicate', 1, {
        ownerPersonId: 'p1',
      })),
      balance(account('traditional', 'duplicate', 4, {
        ownerPersonId: 'p1',
      })),
    ]
    const result = call(rows, {
      wagesByPerson: new Map([['p1', 6]]),
    })

    // Each planner row retains its own authored request: 1 for row 0 and 4 for
    // row 1. No public-id lookup is allowed to overwrite either position.
    expect(result.operations.map((operation) => operation.kind)).toEqual([
      'contribution', 'contribution',
    ])
    const credits = contributions(result)
    expect(credits.map((row) => [
      row.balanceIndex,
      row.balanceBefore,
      row.balanceAfter,
      row.credited,
      row.record.ownerPersonId,
    ])).toEqual([
      [0, 100, 101, 1, 'p1'],
      [1, 100, 104, 4, 'p1'],
    ])
    expect(credits[0]!.sourceAccount).toBe(rows[0]!.account)
    expect(credits[1]!.sourceAccount).toBe(rows[1]!.account)
    expect(credits[0]!.retirementOccurrence).toEqual(expect.objectContaining({
      producerOccurrenceKey: JSON.stringify([
        'ownedIraContribution', 'duplicate', 0,
      ]),
      kind: 'ownedIraContribution',
      ownerPersonId: 'p1',
      sourceAccountId: 'duplicate',
      grossAmountPlanDollars: 1,
    }))
    expect(credits[0]!.retirementApplication).toEqual(expect.objectContaining({
      balanceIndex: 0,
      sourceBalanceBeforePlanDollars: 100,
      creditedAmountPlanDollars: 1,
      sourceBalanceAfterPlanDollars: 101,
    }))
    expect(credits[1]!.retirementOccurrence).toEqual(expect.objectContaining({
      producerOccurrenceKey: JSON.stringify([
        'ownedIraContribution', 'duplicate', 1,
      ]),
    }))
    expect(credits[1]!.retirementApplication).toEqual(expect.objectContaining({
      balanceIndex: 1,
      producerOccurrenceKey: JSON.stringify([
        'ownedIraContribution', 'duplicate', 1,
      ]),
    }))
    expect(credits[1]!.rothContributionPoolKey).toBeNull()
    expect(credits[1]!.rothContributionBasisDelta).toBe(0)
    expect(result.totals).toEqual({
      contributions: 5,
      ownedNonRothIraContributions: 5,
      employerMatch: 0,
      preTaxContributions: 5,
      traditionalInflow: 5,
      otherInflow: 0,
      taxableInflow: 0,
    })
  })

  it('preserves exact row order and left-associated cancellation-sensitive folds', () => {
    const amounts = [1e13, 0.011, 0.011] as const
    const rows = amounts.map((amount, index) =>
      balance(account('cash', `cash-${index}`, amount)))
    const result = call(rows, {
      wagesByPerson: new Map([['p1', 2e13]]),
    })
    let exact = 0
    for (const amount of amounts) exact += amount

    expect(contributions(result).map((row) => row.balanceIndex)).toEqual([
      0, 1, 2,
    ])
    expect(result.totals.contributions).toBe(exact)
    expect(result.totals.otherInflow).toBe(exact)
    expect(result.totals.contributions)
      .not.toBe(amounts[0] + (amounts[1] + amounts[2]))
  })

  it.each([
    ['traditional' as const, pack.contributionLimits.ira],
    ['roth' as const, pack.contributionLimits.ira],
    ['hsa' as const, pack.contributionLimits.hsaSelfOnly],
  ])('keeps same-owner %s limit and basis rows in exact left-fold order', (
    type,
    limit,
  ) => {
    const amounts = [limit - 1e-12, 4e-13, 4e-13] as const
    const rows = amounts.map((amount, index) =>
      balance(account(type, `${type}-${index}`, amount)))
    const result = call(rows, {
      wagesByPerson: new Map([['p1', 20_000]]),
    })
    const credits = contributions(result)
    let exact = 0
    for (const amount of amounts) exact += amount

    expect(credits.map((row) => row.credited)).toEqual(amounts)
    for (const [index, credit] of credits.entries()) {
      expect(credit.sourceAccount).toBe(rows[index]!.account)
    }
    expect(result.totals.contributions).toBe(exact)
    expect(result.totals.contributions)
      .not.toBe(amounts[0] + (amounts[1] + amounts[2]))
    if (type === 'roth') {
      expect(credits.map((row) => row.rothContributionPoolKey))
        .toEqual(['rothira:p1', 'rothira:p1', 'rothira:p1'])
      expect(credits.map((row) => row.rothContributionBasisDelta))
        .toEqual(amounts)
    } else {
      expect(result.totals.preTaxContributions).toBe(exact)
    }
  })

  it('returns taxable basis and aged-IRA section-219 effects explicitly', () => {
    const result = call([
      balance(account('taxable', 'brokerage', 25)),
      balance(account('traditional', 'aged-ira', 30)),
    ], {
      year: 2026,
      resolveOwnerState: () => ({ alive: true, ageAttained: 71 }),
      resolveOwnerBirthYear: () => 1955,
      resolveOwnerDob: () => '1955-01-01',
    })
    const credits = contributions(result)
    expect(credits[0]).toEqual(expect.objectContaining({
      balanceIndex: 0,
      costBasisBefore: 40,
      costBasisAfter: 65,
    }))
    expect(credits[1]).toEqual(expect.objectContaining({
      balanceIndex: 1,
      qcdSection219OwnerPersonId: 'p1',
      qcdSection219Amount: 30,
    }))
    expect(result.totals.taxableInflow).toBe(25)
  })
})

describe('annualContributionsAndEmployerMatch — employer routing and re-entry', () => {
  it('routes high-earner catch-up, keeps it in the source match base, and orders match last', () => {
    const baseLimit = pack.contributionLimits.employee401k
    const catchUp = pack.contributionLimits.superCatchUp60to63
    const requested = baseLimit + catchUp
    const traditional = account('traditional', 'pre-tax-plan', requested, {
      kind: 'employer',
      priorCalendarYearFicaWages:
        pack.contributionLimits.rothCatchUpWageThreshold + 1,
      employerMatch: { matchPct: 50, capPctOfPay: 100 },
    })
    const roth = account('roth', 'roth-plan', 0, {
      kind: 'employer',
    })
    const result = call([balance(traditional), balance(roth)], {
      wagesByPerson: new Map([['p1', 100_000]]),
      resolveOwnerState: () => ({ alive: true, ageAttained: 60 }),
      resolveOwnerBirthYear: () => 1966,
      resolveOwnerDob: () => '1966-01-01',
    })
    const credits = contributions(result)
    const matchRows = matches(result)
    expect(result.operations.map((operation) => operation.kind)).toEqual([
      'contribution', 'contribution', 'employerMatch',
    ])
    expect(credits.map((row) => [
      row.balanceIndex,
      row.credited,
      row.record.requested,
    ])).toEqual([
      [0, baseLimit, baseLimit],
      [1, catchUp, catchUp],
    ])
    expect(credits[0]!.retirementOccurrence?.kind)
      .toBe('employerPlanEmployeeContribution')
    expect(credits[0]!.retirementOccurrence?.producerOccurrenceKey).toBe(
      JSON.stringify(['employerPlanEmployeeContribution', 'pre-tax-plan', 0]),
    )
    expect(credits[1]!.rothContributionPoolKey).toBe('roth:roth-plan')
    expect(matchRows).toHaveLength(1)
    expect(matchRows[0]).toEqual(expect.objectContaining({
      balanceIndex: 0,
      balanceBefore: 100 + baseLimit,
      balanceAfter: 100 + baseLimit + requested * 0.5,
      retirementOccurrence: expect.objectContaining({
        kind: 'employerPlanEmployerMatch',
        producerOccurrenceKey: JSON.stringify([
          'employerPlanEmployerMatch', 'pre-tax-plan', 0,
        ]),
        grossAmountPlanDollars: requested * 0.5,
      }),
      record: {
        destinationAccountId: 'pre-tax-plan',
        ownerPersonId: 'p1',
        amount: requested * 0.5,
      },
    }))
    expect(result.totals.employerMatch).toBe(requested * 0.5)
    expect(result.totals.traditionalInflow)
      .toBe(baseLimit + requested * 0.5)
    expect(result.totals.otherInflow).toBe(catchUp)
  })

  it('caps employer match at the exact remaining 415(c) room', () => {
    const baseLimit = pack.contributionLimits.employee401k
    const wages = 30_000
    const traditional = account('traditional', 'binding-415c', baseLimit, {
      kind: 'employer',
      employerMatch: { matchPct: 100, capPctOfPay: 100 },
    })
    const result = call([balance(traditional)], {
      wagesByPerson: new Map([['p1', wages]]),
    })
    const [match] = matches(result)
    const remaining415c = wages - baseLimit

    expect(match).toEqual(expect.objectContaining({
      sourceAccount: traditional,
      balanceBefore: 100 + baseLimit,
      balanceAfter: 100 + baseLimit + remaining415c,
      record: expect.objectContaining({ amount: remaining415c }),
    }))
    expect(result.totals.employerMatch).toBe(remaining415c)
  })

  it('mutates no inputs and holds no state across repeated planning', () => {
    const rows = [
      balance(account('traditional', 'ira', 1_000)),
      balance(account('taxable', 'taxable', 2_000)),
    ]
    const wages = new Map([['p1', 10_000]])
    const first = call(rows, { wagesByPerson: wages })
    const second = call(rows, { wagesByPerson: wages })
    expect(second).toStrictEqual(first)
    expect(rows.map((row) => [row.balance, row.costBasis])).toEqual([
      [100, 0], [100, 40],
    ])
    expect([...wages]).toEqual([['p1', 10_000]])
  })
})
