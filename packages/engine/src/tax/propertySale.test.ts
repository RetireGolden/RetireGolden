import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import { packForYear } from '../params/index.js'
import { propertySaleTax } from './propertySale.js'

const pack = packForYear(2026).pack

describe('property disposition tax (§121 / recapture)', () => {
  // IRC 121(d)(6) removes the depreciation portion from the exclusion's reach
  // BEFORE the cap applies. Running the cap against the whole gain instead
  // lets the exclusion swallow recapture that the statute says it cannot
  // touch, and the error only shows when the post-recapture gain is below the
  // cap while the whole gain is above it.
  //
  // Sale 660,000, basis 400,000, no selling costs -> gain 260,000, of which
  // 50,000 is post-1997 depreciation. Single, so the cap is 250,000:
  //   recapture carved out first:  exclusion reaches 210,000
  //   cap against the whole gain:  exclusion reaches 250,000
  describeRule('irc-121-d-6-exclusion-cannot-reach-recapture', {
    readings: { exclusionAppliesAfterRecapture: 210_000, exclusionAppliesToWholeGain: 250_000 },
    accepted: 'exclusionAppliesAfterRecapture',
  }, ({ accepted, readings }) => {
    it('carves recapture out before applying the exclusion cap', () => {
      const r = propertySaleTax({
        salePrice: 660_000,
        costBasis: 400_000,
        sellingCostPct: 0,
        depreciationRecapture: 50_000,
        primaryResidence: true,
        filingStatus: 'single',
        pack,
      })

      expect(r.excludedGain).toBeCloseTo(accepted, 6)
      expect(r.excludedGain).not.toBeCloseTo(readings.exclusionAppliesToWholeGain, 6)
      expect(r.ordinaryGain).toBeCloseTo(50_000, 6)
    })
  })

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

describe('personal-use sale at a loss (§165(c))', () => {
  // Sale 300,000 against basis 400,000. Section 165(c) does not reach a loss
  // on personal-use property, so no negative gain may leave this function to
  // offset other income; the reading that lets it through would carry
  // -100,000 of capital gain.
  describeRule('irc-165-c-personal-use-sale-loss-nondeductible', {
    readings: { lossNondeductibleGainFloorsAtZero: 0, personalLossFlowsThroughAsNegativeGain: -100_000 },
    accepted: 'lossNondeductibleGainFloorsAtZero',
  }, ({ accepted }) => {
    it('floors the disposition gain at zero on a below-basis sale', () => {
      const r = propertySaleTax({
        salePrice: 300_000,
        costBasis: 400_000,
        sellingCostPct: 0,
        depreciationRecapture: 0,
        primaryResidence: false,
        filingStatus: 'single',
        pack,
      })
      expect(r.capitalGain).toBe(accepted)
      expect(r.ordinaryGain).toBe(accepted)
      expect(r.excludedGain).toBe(accepted)
    })
  })
})
