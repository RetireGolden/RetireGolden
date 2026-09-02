import { describe, expect, it } from 'vitest'

import type { Account } from '../../model/plan.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from '../moneyTolerance.js'
import {
  annualHecmBackstopPlan,
  type AnnualHecmBackstopInput,
} from './annualHecmBackstop.js'

function property(
  id: string,
  drawPolicy: 'coordinated' | 'lastResort' = 'coordinated',
): Extract<Account, { type: 'property' }> {
  return {
    type: 'property',
    id,
    name: id,
    ownerPersonId: null,
    annualReturnPct: null,
    value: 100_000,
    plannedSaleYear: null,
    expectedNetProceeds: null,
    primaryResidence: true,
    hecm: {
      openYear: 2025,
      growthRatePct: 0,
      drawPolicy,
    },
  }
}

const cash: Extract<Account, { type: 'cash' }> = {
  type: 'cash',
  id: 'cash',
  name: 'cash',
  ownerPersonId: null,
  annualReturnPct: null,
  balance: 1,
  annualContribution: 0,
}

function input(
  overrides: Partial<AnnualHecmBackstopInput> = {},
): AnnualHecmBackstopInput {
  return {
    accounts: [property('home')],
    hecmStates: new Map([['home', { principalLimit: 100, loanBalance: 0 }]]),
    portfolioShortfall: 50,
    anyAlive: true,
    ...overrides,
  }
}

describe('annualHecmBackstopPlan', () => {
  it.each([
    ['the household is dead', { anyAlive: false }],
    [
      'the shortfall is exactly the annual funding tolerance',
      { portfolioShortfall: ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS },
    ],
  ] as const)('returns no allocation when %s', (_label, override) => {
    const request = input(override)
    expect(annualHecmBackstopPlan(request)).toEqual({
      allocations: [],
      draw: 0,
      shortfallAfterHecm: request.portfolioShortfall,
    })
  })

  it('uses every open line regardless of policy and allocates in source order', () => {
    // Product authority: DOCS/domain/domain-rules-reference/
    // 19-annuity-payout-forms-the-annuitization-sweep.md, "Draw policies":
    // either policy leaves an open line available to backstop a true shortfall.
    expect(annualHecmBackstopPlan(input({
      accounts: [
        cash,
        property('coordinated'),
        property('last-resort', 'lastResort'),
      ],
      hecmStates: new Map([
        ['coordinated', { principalLimit: 40, loanBalance: 10 }],
        ['last-resort', { principalLimit: 30, loanBalance: 5 }],
      ]),
      portfolioShortfall: 45,
    }))).toEqual({
      allocations: [
        { propertyAccountId: 'coordinated', amount: 30 },
        { propertyAccountId: 'last-resort', amount: 15 },
      ],
      draw: 45,
      shortfallAfterHecm: 0,
    })
  })

  it('skips missing and exhausted lines and never double-spends a duplicate id', () => {
    expect(annualHecmBackstopPlan(input({
      accounts: [
        property('missing'),
        property('exhausted'),
        property('shared'),
        { ...property('shared'), name: 'duplicate shared row' },
        property('tail'),
      ],
      hecmStates: new Map([
        ['exhausted', { principalLimit: 5, loanBalance: 5 }],
        ['shared', { principalLimit: 25, loanBalance: 5 }],
        ['tail', { principalLimit: 10, loanBalance: 0 }],
      ]),
      portfolioShortfall: 40,
    }))).toEqual({
      allocations: [
        { propertyAccountId: 'shared', amount: 20 },
        { propertyAccountId: 'tail', amount: 10 },
      ],
      draw: 30,
      shortfallAfterHecm: 10,
    })
  })

  it('lets the first HECM-bearing alias claim a shared line id', () => {
    expect(annualHecmBackstopPlan(input({
      accounts: [
        { ...property('shared'), hecm: undefined },
        property('shared', 'lastResort'),
      ],
      hecmStates: new Map([
        ['shared', { principalLimit: 25, loanBalance: 5 }],
      ]),
      portfolioShortfall: 10,
    }))).toEqual({
      allocations: [{ propertyAccountId: 'shared', amount: 10 }],
      draw: 10,
      shortfallAfterHecm: 0,
    })
  })

  it('lets a missing first HECM-bearing alias suppress the duplicate id', () => {
    expect(annualHecmBackstopPlan(input({
      accounts: [
        property('missing'),
        { ...property('missing'), name: 'duplicate missing row' },
        property('tail'),
      ],
      hecmStates: new Map([
        ['tail', { principalLimit: 10, loanBalance: 0 }],
      ]),
      portfolioShortfall: 20,
    }))).toEqual({
      allocations: [{ propertyAccountId: 'tail', amount: 10 }],
      draw: 10,
      shortfallAfterHecm: 10,
    })
  })

  it('folds the draw in source order without regrouping', () => {
    const lines = new Map([
      ['huge', { principalLimit: 1e16, loanBalance: 0 }],
      ['one-a', { principalLimit: 1, loanBalance: 0 }],
      ['one-b', { principalLimit: 1, loanBalance: 0 }],
    ])
    const plan = (ids: readonly string[]) => annualHecmBackstopPlan(input({
      accounts: ids.map((id) => property(id)),
      hecmStates: lines,
      portfolioShortfall: 1e16 + 100,
    }))

    expect(plan(['huge', 'one-a', 'one-b']).draw).toBe(1e16)
    expect(plan(['one-a', 'one-b', 'huge']).draw).toBe(
      10_000_000_000_000_002,
    )
  })

  it('preserves the half-cent break after an allocation', () => {
    const result = annualHecmBackstopPlan(input({
      accounts: [property('first'), property('tail')],
      hecmStates: new Map([
        ['first', { principalLimit: 100, loanBalance: 0 }],
        ['tail', { principalLimit: 1, loanBalance: 0 }],
      ]),
      portfolioShortfall: 100.004,
    }))

    expect(result.allocations).toEqual([
      { propertyAccountId: 'first', amount: 100 },
    ])
    expect(result.draw).toBe(100)
    const exactBinary64Residual = Math.max(0, 100.004 - 100)
    expect(result.shortfallAfterHecm).toBe(exactBinary64Residual)
    expect(result.shortfallAfterHecm).not.toBe(0.004)
  })

  it('is stateless and never mutates accounts or line state', () => {
    const accounts = Object.freeze([property('home')])
    const line = Object.freeze({ principalLimit: 40, loanBalance: 5 })
    const request = input({
      accounts,
      hecmStates: new Map([['home', line]]),
      portfolioShortfall: 20,
    })
    const first = annualHecmBackstopPlan(request)
    const second = annualHecmBackstopPlan(request)

    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first.allocations).not.toBe(second.allocations)
    expect(first.allocations[0]).not.toBe(second.allocations[0])
    expect(line).toEqual({ principalLimit: 40, loanBalance: 5 })
  })
})
