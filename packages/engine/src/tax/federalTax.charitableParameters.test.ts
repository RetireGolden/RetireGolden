import { describe, expect, it, vi } from 'vitest'

import type { TaxYearInput } from '../projection/types.js'

const carrier = vi.hoisted(() => ({
  itemizerContributionFloorRate: { numerator: 1n, denominator: 100n },
  section68ThresholdByFilingStatusCents: {
    single: 70_000_000,
    headOfHousehold: 70_000_000,
    marriedFilingJointly: 90_000_000,
    marriedFilingSeparately: 45_000_000,
    qualifyingSurvivingSpouse: 90_000_000,
  },
  section68LimitationRate: { numerator: 1n, denominator: 10n },
}))

vi.mock('./annualCharitableDeductionParameters.js', () => ({
  annualCharitableDeductionParameters: (year: number) => {
    if (year !== 2026) throw new RangeError(`Unexpected carrier year ${year}`)
    return carrier
  },
}))

import { computeFederalTax } from './federalTax.js'

function input(partial: Partial<TaxYearInput>): TaxYearInput {
  return {
    year: 2026,
    filingStatus: 'single',
    ordinaryIncome: 0,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    ...partial,
  }
}

describe('federal tax charitable parameter carrier', () => {
  it('uses the carrier itemizer floor rate on the live 2026 path', () => {
    const detail = computeFederalTax(input({
      ordinaryIncome: 100_000,
      itemizedDeductions: {
        stateAndLocalTaxes: 10_000,
        mortgageInterest: 0,
        charitable: 20_000,
      },
    }))

    expect(detail.section68Limitation).toBe(0)
    expect(detail.itemized).toBe(true)
    expect(detail.deduction).toBe(29_000)
  })

  it('uses the carrier section 68 threshold and rate on the live 2026 path', () => {
    const detail = computeFederalTax(input({
      ordinaryIncome: 800_000,
      itemizedDeductions: {
        stateAndLocalTaxes: 40_000,
        mortgageInterest: 0,
        charitable: 0,
      },
    }))

    expect(detail.section68Limitation).toBe(4_000)
    expect(detail.itemized).toBe(true)
    expect(detail.deduction).toBe(36_000)
  })

  it('does not ask the 2026 carrier to stand in for a later projection year', () => {
    const detail = computeFederalTax(input({
      year: 2027,
      ordinaryIncome: 100_000,
      inflationScale: 1,
      itemizedDeductions: {
        stateAndLocalTaxes: 10_000,
        mortgageInterest: 0,
        charitable: 20_000,
      },
    }))

    expect(detail.usesStandInPack).toBe(true)
    expect(detail.deduction).toBe(29_500)
  })
})
