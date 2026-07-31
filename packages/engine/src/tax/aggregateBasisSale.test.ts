import { describe, expect, it } from 'vitest'

import { aggregateBasisSale } from './aggregateBasisSale.js'

describe('aggregateBasisSale', () => {
  it.each([
    {
      openingFairMarketValue: 100,
      openingCostBasis: 40,
      saleProceeds: 25,
      recoveredCostBasis: 10,
      realizedCapitalGainOrLoss: 15,
      remainingFairMarketValue: 75,
      remainingCostBasis: 30,
    },
    {
      openingFairMarketValue: 100,
      openingCostBasis: 200,
      saleProceeds: 25,
      recoveredCostBasis: 50,
      realizedCapitalGainOrLoss: -25,
      remainingFairMarketValue: 75,
      remainingCostBasis: 150,
    },
    {
      openingFairMarketValue: 100,
      openingCostBasis: 200,
      saleProceeds: 100,
      recoveredCostBasis: 200,
      realizedCapitalGainOrLoss: -100,
      remainingFairMarketValue: 0,
      remainingCostBasis: 0,
    },
    {
      openingFairMarketValue: 100,
      openingCostBasis: 0,
      saleProceeds: 25,
      recoveredCostBasis: 0,
      realizedCapitalGainOrLoss: 25,
      remainingFairMarketValue: 75,
      remainingCostBasis: 0,
    },
    {
      openingFairMarketValue: 100,
      openingCostBasis: 200,
      saleProceeds: 0,
      recoveredCostBasis: 0,
      realizedCapitalGainOrLoss: 0,
      remainingFairMarketValue: 100,
      remainingCostBasis: 200,
    },
    {
      openingFairMarketValue: 0,
      openingCostBasis: 200,
      saleProceeds: 0,
      recoveredCostBasis: 0,
      realizedCapitalGainOrLoss: 0,
      remainingFairMarketValue: 0,
      remainingCostBasis: 200,
    },
  ])('returns the structured sale result for %#', (expected) => {
    expect(aggregateBasisSale(expected)).toEqual(expected)
  })

  it('computes repeating fractions without cent rounding', () => {
    const result = aggregateBasisSale({
      openingFairMarketValue: 3,
      openingCostBasis: 1,
      saleProceeds: 1,
    })

    expect(result.recoveredCostBasis).toBeCloseTo(1 / 3, 15)
    expect(result.realizedCapitalGainOrLoss).toBeCloseTo(2 / 3, 15)
    expect(result.remainingCostBasis).toBeCloseTo(2 / 3, 15)
  })

  it.each([
    { openingFairMarketValue: -1, openingCostBasis: 0, saleProceeds: 0 },
    { openingFairMarketValue: 1, openingCostBasis: -1, saleProceeds: 0 },
    { openingFairMarketValue: 1, openingCostBasis: 0, saleProceeds: -1 },
    { openingFairMarketValue: 1, openingCostBasis: 0, saleProceeds: 2 },
    { openingFairMarketValue: Number.NaN, openingCostBasis: 0, saleProceeds: 0 },
    { openingFairMarketValue: 1, openingCostBasis: Infinity, saleProceeds: 0 },
    { openingFairMarketValue: 1, openingCostBasis: 0, saleProceeds: Infinity },
  ])('rejects invalid input %#', (input) => {
    expect(() => aggregateBasisSale(input)).toThrow(RangeError)
  })

  it('does not mutate input, freezes output, and normalizes negative zero', () => {
    const input = {
      openingFairMarketValue: 100,
      openingCostBasis: -0,
      saleProceeds: 25,
    }
    const before = { ...input }
    const result = aggregateBasisSale(input)

    expect(input).toEqual(before)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.is(result.openingCostBasis, -0)).toBe(false)
    expect(Object.is(result.recoveredCostBasis, -0)).toBe(false)
    expect(Object.is(result.realizedCapitalGainOrLoss, -0)).toBe(false)
    expect(Object.is(result.remainingCostBasis, -0)).toBe(false)
  })
})
