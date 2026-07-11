import { describe, expect, it } from 'vitest'

import { packForYear } from '../params/index.js'
import { propertySaleTax } from './propertySale.js'

const pack = packForYear(2026).pack

describe('property disposition tax (§121 / recapture)', () => {
  it('taxes only the gain above basis, net of selling costs', () => {
    const r = propertySaleTax({ salePrice: 300_000, costBasis: 200_000, sellingCostPct: 6, filingStatus: 'single', pack })
    // Amount realized = 300k − 18k = 282k; gain = 82k, all capital.
    expect(r.sellingCosts).toBeCloseTo(18_000, 6)
    expect(r.netProceeds).toBeCloseTo(282_000, 6)
    expect(r.capitalGain).toBeCloseTo(82_000, 6)
    expect(r.ordinaryGain).toBe(0)
  })

  it('applies the §121 exclusion to a primary residence and taxes only the excess', () => {
    // MFJ home: basis 300k, sale 950k, 5% costs → realized 902.5k, gain 602.5k.
    // §500k excluded → 102.5k capital gain.
    const r = propertySaleTax({
      salePrice: 950_000,
      costBasis: 300_000,
      sellingCostPct: 5,
      primaryResidence: true,
      filingStatus: 'marriedFilingJointly',
      pack,
    })
    expect(r.excludedGain).toBeCloseTo(500_000, 6)
    expect(r.capitalGain).toBeCloseTo(102_500, 6)
  })

  it('fully excludes a primary-residence gain under the cap', () => {
    const r = propertySaleTax({
      salePrice: 400_000,
      costBasis: 250_000,
      primaryResidence: true,
      filingStatus: 'single',
      pack,
    })
    expect(r.capitalGain).toBe(0)
    expect(r.excludedGain).toBeCloseTo(150_000, 6)
  })

  it('recaptures depreciation as ordinary income, never shielded by §121', () => {
    // Rental converted to residence: basis 200k, sale 500k, gain 300k, 60k
    // depreciation. 60k ordinary; remaining 240k capital, §121 excluded to 0.
    const r = propertySaleTax({
      salePrice: 500_000,
      costBasis: 200_000,
      primaryResidence: true,
      depreciationRecapture: 60_000,
      filingStatus: 'single',
      pack,
    })
    expect(r.ordinaryGain).toBeCloseTo(60_000, 6)
    // 240k remaining gain, §250k single cap → fully excluded.
    expect(r.capitalGain).toBe(0)
    expect(r.excludedGain).toBeCloseTo(240_000, 6)
  })

  it('treats a sale at a loss as zero gain (personal-use loss nondeductible)', () => {
    const r = propertySaleTax({ salePrice: 180_000, costBasis: 250_000, filingStatus: 'single', pack })
    expect(r.capitalGain).toBe(0)
    expect(r.ordinaryGain).toBe(0)
  })
})
