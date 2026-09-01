import { describe, expect, it } from 'vitest'

import type { Account } from '../../model/plan.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from '../moneyTolerance.js'
import {
  annualCoordinatedHecmAllocations,
  annualCoordinatedHecmEligibility,
  type AnnualCoordinatedHecmEligibilityInput,
  type CoordinatedHecmLine,
} from './annualCoordinatedHecm.js'

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

function eligibilityInput(
  overrides: Partial<AnnualCoordinatedHecmEligibilityInput> = {},
): AnnualCoordinatedHecmEligibilityInput {
  return {
    accounts: [property('home')],
    hecmStates: new Map([[
      'home',
      { principalLimit: 40_000, loanBalance: 5_000 },
    ]]),
    anyAlive: true,
    year: 2027,
    startYear: 2026,
    priorYearPortfolioReturnPct: -1,
    ...overrides,
  }
}

describe('annualCoordinatedHecmEligibility', () => {
  it.each([
    ['the household is dead', { anyAlive: false }],
    ['the projection is in its first year', { year: 2026 }],
    ['the prior return is zero', { priorYearPortfolioReturnPct: 0 }],
    ['the prior return is positive', { priorYearPortfolioReturnPct: 0.01 }],
  ] as const)('returns no eligible line when %s', (_label, override) => {
    expect(annualCoordinatedHecmEligibility(eligibilityInput(override))).toEqual({
      propertyAccountIds: [],
      capacity: 0,
    })
  })

  it('filters ineligible rows and admits each positive actual line once', () => {
    const accounts: Account[] = [
      cash,
      property('last-resort', 'lastResort'),
      property('missing'),
      property('exhausted'),
      property('shared'),
      { ...property('shared'), name: 'duplicate coordinated row' },
      property('distinct'),
    ]
    const states = new Map<string, CoordinatedHecmLine>([
      ['last-resort', { principalLimit: 99, loanBalance: 0 }],
      ['exhausted', { principalLimit: 12, loanBalance: 12 }],
      ['shared', { principalLimit: 40, loanBalance: 5 }],
      ['distinct', { principalLimit: 20, loanBalance: 4 }],
    ])

    expect(annualCoordinatedHecmEligibility(eligibilityInput({
      accounts,
      hecmStates: states,
    }))).toEqual({
      propertyAccountIds: ['shared', 'distinct'],
      capacity: 51,
    })
  })

  it('uses the first HECM-bearing duplicate row as the shared-line policy owner', () => {
    const states = new Map([[
      'shared',
      { principalLimit: 100, loanBalance: 25 },
    ]])
    expect(annualCoordinatedHecmEligibility(eligibilityInput({
      accounts: [
        { ...property('shared'), hecm: undefined },
        property('shared', 'lastResort'),
        { ...property('shared'), name: 'coordinated duplicate' },
      ],
      hecmStates: states,
    }))).toEqual({ propertyAccountIds: [], capacity: 0 })

    expect(annualCoordinatedHecmEligibility(eligibilityInput({
      accounts: [
        { ...property('shared'), hecm: undefined },
        property('shared'),
        { ...property('shared', 'lastResort'), name: 'later last-resort alias' },
      ],
      hecmStates: states,
    }))).toEqual({ propertyAccountIds: ['shared'], capacity: 75 })
  })

  it('folds capacity in source order without regrouping', () => {
    const ids = ['huge', 'one-a', 'one-b']
    const states = new Map<string, CoordinatedHecmLine>([
      ['huge', { principalLimit: 1e16, loanBalance: 0 }],
      ['one-a', { principalLimit: 1, loanBalance: 0 }],
      ['one-b', { principalLimit: 1, loanBalance: 0 }],
    ])
    const inOrder = annualCoordinatedHecmEligibility(eligibilityInput({
      accounts: ids.map((id) => property(id)),
      hecmStates: states,
    }))
    const reversed = annualCoordinatedHecmEligibility(eligibilityInput({
      accounts: [...ids].reverse().map((id) => property(id)),
      hecmStates: states,
    }))

    expect(inOrder.propertyAccountIds).toEqual(ids)
    expect(inOrder.capacity).toBe(1e16)
    expect(reversed.capacity).toBe(10_000_000_000_000_002)
    expect(Object.is(inOrder.capacity, reversed.capacity)).toBe(false)
  })

  it('is stateless, does not mutate inputs, and returns fresh materialized arrays', () => {
    const accounts = Object.freeze([property('home')])
    const line = Object.freeze({ principalLimit: 40, loanBalance: 5 })
    const hecmStates = new Map([['home', line]])
    const input = eligibilityInput({ accounts, hecmStates })
    const first = annualCoordinatedHecmEligibility(input)
    const second = annualCoordinatedHecmEligibility(input)

    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first.propertyAccountIds).not.toBe(second.propertyAccountIds)
    expect(Array.isArray(first.propertyAccountIds)).toBe(true)
    expect(hecmStates.get('home')).toBe(line)
    expect(line).toEqual({ principalLimit: 40, loanBalance: 5 })
  })
})

describe('annualCoordinatedHecmAllocations', () => {
  it('allocates a partial accepted draw in eligible-line order', () => {
    const lines = new Map<string, CoordinatedHecmLine>([
      ['first', { principalLimit: 50, loanBalance: 10 }],
      ['second', { principalLimit: 20, loanBalance: 10 }],
    ])
    expect(annualCoordinatedHecmAllocations({
      acceptedDraw: 45,
      propertyAccountIds: ['first', 'second'],
      hecmStates: lines,
    })).toEqual([
      { propertyAccountId: 'first', amount: 40 },
      { propertyAccountId: 'second', amount: 5 },
    ])
  })

  it('preserves the caller epsilon gate and does not replace the accepted scalar', () => {
    const acceptedDraw = ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS
    expect(annualCoordinatedHecmAllocations({
      acceptedDraw,
      propertyAccountIds: ['home'],
      hecmStates: new Map([['home', { principalLimit: 100, loanBalance: 0 }]]),
    })).toEqual([])
    expect(acceptedDraw).toBe(ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS)
  })

  it('skips missing/exhausted lines and never double-spends a duplicate id', () => {
    const line = { principalLimit: 40, loanBalance: 5 }
    const lines = new Map<string, CoordinatedHecmLine>([
      ['exhausted', { principalLimit: 4, loanBalance: 4 }],
      ['shared', line],
      ['tail', { principalLimit: 20, loanBalance: 0 }],
    ])
    expect(annualCoordinatedHecmAllocations({
      acceptedDraw: 50,
      propertyAccountIds: ['missing', 'exhausted', 'shared', 'shared', 'tail'],
      hecmStates: lines,
    })).toEqual([
      { propertyAccountId: 'shared', amount: 35 },
      { propertyAccountId: 'tail', amount: 15 },
    ])
    expect(line).toEqual({ principalLimit: 40, loanBalance: 5 })
  })

  it('is stateless and returns fresh rows without mutating line state', () => {
    const line = Object.freeze({ principalLimit: 40, loanBalance: 5 })
    const input = {
      acceptedDraw: 20,
      propertyAccountIds: Object.freeze(['home']),
      hecmStates: new Map([['home', line]]),
    }
    const first = annualCoordinatedHecmAllocations(input)
    const second = annualCoordinatedHecmAllocations(input)

    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first[0]).not.toBe(second[0])
    expect(Array.isArray(first)).toBe(true)
    expect(line).toEqual({ principalLimit: 40, loanBalance: 5 })
  })
})
