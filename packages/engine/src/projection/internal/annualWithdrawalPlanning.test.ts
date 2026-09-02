import { describe, expect, it } from 'vitest'

import { packForYear } from '../../params/index.js'
import {
  sizeRothConversion,
  type ConversionSizingInput,
} from '../../strategies/rothConversion.js'
import type { PhysicalBalanceState } from './annualLogicalBalanceLedger.js'
import {
  annualWithdrawalPlan,
  annualWithdrawalStrategy,
  type ResolvedAnnualWithdrawalStrategy,
} from './annualWithdrawalPlanning.js'

const YEAR = 2026

function cash(id: string, balance: number): PhysicalBalanceState {
  return {
    account: {
      type: 'cash',
      id,
      name: id,
      ownerPersonId: null,
      annualReturnPct: 0,
      balance,
      annualContribution: 0,
    },
    balance,
    costBasis: 0,
  }
}

function taxable(
  id: string,
  balance: number,
  costBasis: number,
): PhysicalBalanceState {
  return {
    account: {
      type: 'taxable',
      id,
      name: id,
      ownerPersonId: null,
      annualReturnPct: 0,
      balance,
      costBasis,
      interestYieldPct: 0,
      dividendYieldPct: 0,
      qualifiedRatio: 0,
      reinvestDividends: true,
      annualContribution: 0,
    },
    balance,
    costBasis,
  }
}

function traditional(id: string, balance: number): PhysicalBalanceState {
  return {
    account: {
      type: 'traditional',
      kind: 'ira',
      id,
      name: id,
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      balance,
      annualContribution: 0,
    },
    balance,
    costBasis: 0,
  }
}

function roth(id: string, balance: number): PhysicalBalanceState {
  return {
    account: {
      type: 'roth',
      kind: 'ira',
      id,
      name: id,
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      balance,
      annualContribution: 0,
    },
    balance,
    costBasis: 0,
  }
}

function equityComp(
  id: string,
  balance: number,
  costBasis: number,
  vestingMode: 'final' | 'cliff' = 'final',
  vestDate: string | null = null,
): PhysicalBalanceState {
  return {
    account: {
      type: 'equityComp',
      id,
      name: id,
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      balance,
      costBasis,
      annualContribution: 0,
      vestingMode,
      vestDate,
    },
    balance,
    costBasis,
  }
}

function hsa(id: string, balance: number): PhysicalBalanceState {
  return {
    account: {
      type: 'hsa',
      id,
      name: id,
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      balance,
      annualContribution: 0,
    },
    balance,
    costBasis: 0,
  }
}

function sizing(
  ordinaryIncomeBase = 0,
): Readonly<ConversionSizingInput> {
  return {
    year: YEAR,
    pack: packForYear(YEAR).pack,
    filingStatus: 'single',
    ordinaryIncomeBase,
    capitalGains: 0,
    qualifiedDividends: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    householdSize: 1,
    taxExemptInterest: 0,
    inflationScale: 1,
  }
}

function plan(
  needPlanDollars: number,
  states: readonly PhysicalBalanceState[],
  strategy: ResolvedAnnualWithdrawalStrategy = { mode: 'sequential' },
  liquidReservePlanDollars = 0,
) {
  return annualWithdrawalPlan({
    needPlanDollars,
    states,
    strategy,
    year: YEAR,
    liquidReservePlanDollars,
  })
}

describe('annualWithdrawalStrategy', () => {
  it('resolves sequential and proportional modes without reading tax sizing', () => {
    const unread = () => {
      throw new Error('non-bracket strategy read sizing')
    }

    expect(annualWithdrawalStrategy({
      withdrawalOrder: { mode: 'sequential' },
      year: YEAR,
      readSizing: unread,
    })).toEqual({ strategy: { mode: 'sequential' }, warning: null })
    expect(annualWithdrawalStrategy({
      withdrawalOrder: { mode: 'proportional' },
      year: YEAR,
      readSizing: unread,
    })).toEqual({ strategy: { mode: 'proportional' }, warning: null })
  })

  it('sizes a valid bracket target and fails closed above its ceiling', () => {
    const configured = {
      mode: 'bracketTargeted' as const,
      bracketPct: 10,
    }
    const sizingInput = sizing()
    const expected = sizeRothConversion(
      {
        mode: 'fillToTarget',
        target: 'topOfBracket',
        targetValue: configured.bracketPct,
        startYear: YEAR,
        endYear: YEAR,
      },
      sizingInput,
    )
    if (!expected.ok) throw new Error(`expected valid bracket sizing: ${expected.reason}`)

    const resolved = annualWithdrawalStrategy({
      withdrawalOrder: configured,
      year: YEAR,
      readSizing: () => sizingInput,
    })
    expect(resolved.warning).toBeNull()
    expect(resolved.strategy.mode).toBe('bracketTargeted')
    if (resolved.strategy.mode !== 'bracketTargeted') return
    expect(resolved.strategy.traditionalCap).toBe(expected.amount)

    expect(annualWithdrawalStrategy({
      withdrawalOrder: configured,
      year: YEAR,
      readSizing: () => sizing(1_000_000),
    })).toEqual({
      strategy: { mode: 'bracketTargeted', traditionalCap: 0 },
      warning: null,
    })
  })

  it('returns the established warning and sequential fallback for a bad bracket', () => {
    expect(annualWithdrawalStrategy({
      withdrawalOrder: { mode: 'bracketTargeted', bracketPct: 99 },
      year: YEAR,
      readSizing: () => sizing(),
    })).toEqual({
      strategy: { mode: 'sequential' },
      warning:
        'The bracket-targeted withdrawal strategy names an unknown bracket; sequential order was used.',
    })
  })
})

describe('annualWithdrawalPlan', () => {
  it('drains sequentially and characterizes taxable basis without mutation', () => {
    const states = [cash('cash', 100), taxable('taxable', 100, 25), traditional('ira', 100)]
    const opening = states.map((state) => ({
      balance: state.balance,
      costBasis: state.costBasis,
    }))

    const result = plan(250, states)

    expect(result.byCategory).toEqual({
      cash: 100,
      taxable: 100,
      traditional: 50,
      roth: 0,
      hsa: 0,
      total: 250,
    })
    expect([...result.byAccountId]).toEqual([
      ['cash', 100],
      ['taxable', 100],
      ['ira', 50],
    ])
    expect(result.realizedGains).toBe(75)
    expect(result.taxableSales.get('taxable')).toMatchObject({
      saleProceeds: 100,
      recoveredCostBasis: 25,
      remainingFairMarketValue: 0,
      remainingCostBasis: 0,
    })
    expect(states.map((state) => ({
      balance: state.balance,
      costBasis: state.costBasis,
    }))).toEqual(opening)
  })

  it('rebalances proportional shares across the eligible pool', () => {
    const result = plan(
      200,
      [cash('cash', 100), traditional('ira', 300)],
      { mode: 'proportional' },
    )

    expect(result.byCategory.cash).toBe(50)
    expect(result.byCategory.traditional).toBe(150)
    expect(result.byCategory.total).toBe(200)
    expect(result.shortfall).toBe(0)
  })

  it('skips unvested equity, characterizes vested gains, and drains HSA last', () => {
    const result = plan(
      150,
      [
        equityComp('unvested', 100, 20, 'cliff', '2027-03-15'),
        equityComp('vested', 100, 40),
        hsa('hsa', 100),
      ],
      { mode: 'proportional' },
    )

    expect(result.byCategory).toMatchObject({
      taxable: 100,
      hsa: 50,
      total: 150,
    })
    expect([...result.byAccountId]).toEqual([
      ['vested', 100],
      ['hsa', 50],
    ])
    expect(result.realizedGains).toBe(60)
  })

  it('honors the first traditional cap before later fallback sources', () => {
    const result = plan(
      150,
      [traditional('ira', 100), roth('roth', 100)],
      { mode: 'bracketTargeted', traditionalCap: 40 },
    )

    expect(result.byCategory).toMatchObject({
      traditional: 50,
      roth: 100,
      total: 150,
    })
  })

  it('holds the liquid floor until other sources run out, then releases it', () => {
    const result = plan(
      120,
      [cash('cash', 100), traditional('ira', 50)],
      { mode: 'sequential' },
      80,
    )

    expect(result.byCategory).toMatchObject({
      cash: 70,
      traditional: 50,
      total: 120,
    })
    expect(result.reserveUsed).toBe(50)
    expect(result.shortfall).toBe(0)
  })

  it('discharges an unrepresentable traditional quantum without publishing it', () => {
    const result = plan(1, [traditional('ira', 0.004)])

    expect(result.byCategory.total).toBe(0)
    expect(result.byAccountId.size).toBe(0)
    expect(result.shortfall).toBe(0.996)
  })
})
