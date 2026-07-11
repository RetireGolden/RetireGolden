import { describe, expect, it } from 'vitest'

import { packForYear } from '../params/index.js'
import type { TaxCalculator, TaxYearInput } from '../projection/types.js'
import {
  applyCapitalLossCarryforward,
  combineTaxCalculators,
  computeFederalTax,
  createFederalTaxCalculator,
  taxableSocialSecurity,
} from './federalTax.js'

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

describe('ordinary brackets and standard deduction (2026)', () => {
  it('MFJ, $100k wages: 10% and 12% brackets after the standard deduction', () => {
    const d = computeFederalTax(input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 100_000 }))
    expect(d.deduction).toBe(32_200)
    expect(d.taxableIncome).toBe(67_800)
    // 10%×24,800 + 12%×43,000
    expect(d.ordinaryTax).toBeCloseTo(7_640, 6)
    expect(d.totalTax).toBeCloseTo(7_640, 6)
  })

  it('single, $250k wages: climbs through the 32% bracket', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 250_000 }))
    expect(d.taxableIncome).toBe(233_900)
    // 1,240 + 4,560 + 12,166 + 23,058 + 10,280
    expect(d.ordinaryTax).toBeCloseTo(51_304, 6)
  })

  it('zero income is zero tax', () => {
    const d = computeFederalTax(input({}))
    expect(d.totalTax).toBe(0)
    expect(d.taxableIncome).toBe(0)
  })
})

describe('Social Security taxation (provisional income)', () => {
  const pack = packForYear(2026).pack

  it('is zero below the first threshold', () => {
    expect(taxableSocialSecurity(pack, 'single', 10_000, 20_000)).toBe(0)
  })

  it('phases in at 50% between thresholds', () => {
    // provisional = 20,000 + 12,000 = 32,000 -> min(12,000, 0.5×7,000)
    expect(taxableSocialSecurity(pack, 'single', 20_000, 24_000)).toBeCloseTo(3_500, 6)
  })

  it('caps at 85% of benefits above the second threshold', () => {
    // provisional = 75,000 -> 0.85×41,000 + 4,500 = 39,350, capped at 25,500
    expect(taxableSocialSecurity(pack, 'single', 60_000, 30_000)).toBeCloseTo(25_500, 6)
  })

  it('flows into AGI in the full computation', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 20_000, ssBenefits: 24_000 }))
    expect(d.taxableSocialSecurity).toBeCloseTo(3_500, 6)
    expect(d.agi).toBeCloseTo(23_500, 6)
  })
})

describe('capital gains stacking', () => {
  it('keeps gains in the 0% bracket when ordinary income is low (MFJ)', () => {
    const d = computeFederalTax(
      input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 50_000, capitalGains: 80_000 }),
    )
    expect(d.ordinaryTaxable).toBe(17_800)
    expect(d.preferentialIncome).toBe(80_000)
    expect(d.capitalGainsTax).toBe(0) // stack tops out at 97,800 < 98,900
    expect(d.ordinaryTax).toBeCloseTo(1_780, 6)
  })

  it('taxes only the portion stacked above the 0% threshold at 15%', () => {
    const d = computeFederalTax(
      input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 50_000, capitalGains: 100_000 }),
    )
    // Stack runs 17,800 -> 117,800; 0% to 98,900, then 15% on 18,900.
    expect(d.capitalGainsTax).toBeCloseTo(2_835, 6)
  })

  it('stacks qualified dividends at preferential rates while including them in AGI', () => {
    const d = computeFederalTax(
      input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 50_000, qualifiedDividends: 100_000 }),
    )
    expect(d.agi).toBe(150_000)
    expect(d.preferentialIncome).toBe(100_000)
    expect(d.capitalGainsTax).toBeCloseTo(2_835, 6)
  })

  it('does not let capital losses offset qualified dividends', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 100_000, capitalGains: -3_000, qualifiedDividends: 50_000 }))
    expect(d.agi).toBe(147_000)
    expect(d.preferentialIncome).toBe(50_000)
  })

  it('applies NIIT over the MAGI threshold', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 150_000, capitalGains: 100_000 }))
    expect(d.magi).toBe(250_000)
    expect(d.niit).toBeCloseTo(1_900, 6) // 3.8% × min(100k, 50k over 200k)
    expect(d.capitalGainsTax).toBeCloseTo(15_000, 6) // all gains in the 15% layer
    expect(d.ordinaryTax).toBeCloseTo(24_734, 6)
    expect(d.totalTax).toBeCloseTo(41_634, 6)
  })

  it('includes taxable interest and dividends in NIIT investment income', () => {
    const d = computeFederalTax(
      input({
        ordinaryIncome: 250_000,
        capitalGains: 30_000,
        qualifiedDividends: 20_000,
        taxableInterestIncome: 10_000,
        ordinaryDividends: 5_000,
      }),
    )
    expect(d.magi).toBe(300_000)
    expect(d.niit).toBeCloseTo(65_000 * 0.038, 6)
  })
})

describe('age-based deductions', () => {
  it('adds 65+ amounts and the OBBBA senior deduction (MFJ, both 65+)', () => {
    const d = computeFederalTax(
      input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 100_000, peopleAged65Plus: 2 }),
    )
    expect(d.seniorDeduction).toBe(12_000)
    expect(d.deduction).toBe(32_200 + 2 * 1_650 + 12_000)
    expect(d.ordinaryTax).toBeCloseTo(5_804, 6)
  })

  it('phases out the senior deduction at 6% of MAGI over the threshold', () => {
    const d = computeFederalTax(
      input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 200_000, peopleAged65Plus: 2 }),
    )
    expect(d.seniorDeduction).toBeCloseTo(9_000, 6) // 12,000 − 6%×50,000
  })

  it('drops the senior deduction after its statutory last year', () => {
    const d = computeFederalTax(input({ year: 2030, ordinaryIncome: 100_000, peopleAged65Plus: 1 }))
    expect(d.seniorDeduction).toBe(0)
    expect(d.usesStandInPack).toBe(true) // 2030 rides the 2026 pack
  })
})

describe('calculators', () => {
  it('federal calculator matches the detailed computation', () => {
    const calc = createFederalTaxCalculator()
    const i = input({ ordinaryIncome: 80_000, capitalGains: 10_000, ssBenefits: 20_000 })
    expect(calc.compute(i)).toBe(computeFederalTax(i).totalTax)
  })

  it('combined calculator sums its parts', () => {
    const flat: TaxCalculator = { compute: (i) => Math.max(0, i.ordinaryIncome) * 0.05 }
    const combined = combineTaxCalculators(createFederalTaxCalculator(), flat)
    const i = input({ ordinaryIncome: 100_000 })
    expect(combined.compute(i)).toBeCloseTo(computeFederalTax(i).totalTax + 5_000, 6)
  })
})

describe('itemized deductions (2026)', () => {
  it('uses the standard deduction when itemized is smaller', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 100_000, itemizedDeductions: { stateAndLocalTaxes: 3_000, mortgageInterest: 2_000, charitable: 1_000 } }))
    expect(d.itemized).toBe(false)
    expect(d.deduction).toBe(16_100) // standard, single
  })

  it('uses itemized when it beats the standard deduction', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 100_000, itemizedDeductions: { stateAndLocalTaxes: 8_000, mortgageInterest: 12_000, charitable: 5_000 } }))
    expect(d.itemized).toBe(true)
    expect(d.deduction).toBe(25_000) // 8k + 12k + 5k
    expect(d.taxableIncome).toBe(75_000)
  })

  it('caps the SALT component at the pack saltCap', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 200_000, itemizedDeductions: { stateAndLocalTaxes: 60_000, mortgageInterest: 0, charitable: 0 } }))
    expect(d.deduction).toBe(40_400) // SALT capped, beats standard
    expect(d.itemized).toBe(true)
  })

  it('adds the OBBBA senior deduction on top of itemized', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 60_000, peopleAged65Plus: 1, itemizedDeductions: { stateAndLocalTaxes: 20_000, mortgageInterest: 5_000, charitable: 0 } }))
    // itemized 25,000 > standard(16,100+2,050); senior 6,000 (MAGI 60k < 75k phase-out) on top.
    expect(d.itemized).toBe(true)
    expect(d.deduction).toBe(31_000)
  })
})

describe('AMT screen (2026)', () => {
  it('is zero when tentative minimum tax does not exceed regular tax', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 100_000 }))
    expect(d.alternativeMinimumTaxableIncome).toBeCloseTo(100_000, 6)
    expect(d.alternativeMinimumTax).toBe(0)
    expect(d.totalTax).toBeCloseTo(d.ordinaryTax + d.capitalGainsTax + d.niit, 6)
  })

  it('adds only the tentative-minimum-tax excess over regular income tax', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 100_000, amtPreferenceItems: 300_000 }))
    expect(d.amtPreferenceItems).toBeCloseTo(300_000 + d.deduction, 6)
    expect(d.alternativeMinimumTaxableIncome).toBeCloseTo(400_000, 6)
    expect(d.tentativeMinimumTax).toBeGreaterThan(d.ordinaryTax + d.capitalGainsTax)
    expect(d.alternativeMinimumTax).toBeCloseTo(d.tentativeMinimumTax - d.ordinaryTax - d.capitalGainsTax, 6)
    expect(d.totalTax).toBeCloseTo(d.ordinaryTax + d.capitalGainsTax + d.alternativeMinimumTax + d.niit, 6)
  })

  it('preserves preferential rates for LTCG and qualified dividends in tentative minimum tax', () => {
    const d = computeFederalTax(input({ capitalGains: 800_000 }))
    const expectedPreferentialTmt = (545_500 - 49_450) * 0.15 + (800_000 - 545_500) * 0.2
    const naiveAmtRateTax = 244_500 * 0.26 + (800_000 - 244_500) * 0.28
    expect(d.alternativeMinimumTaxableIncome).toBeCloseTo(800_000, 6)
    expect(d.tentativeMinimumTax).toBeCloseTo(expectedPreferentialTmt, 6)
    expect(d.tentativeMinimumTax).toBeLessThan(naiveAmtRateTax - 90_000)
  })

  it('treats qualifying surviving spouse as the joint AMT and regular-tax table', () => {
    const qss = computeFederalTax(input({ filingStatus: 'qualifyingSurvivingSpouse', ordinaryIncome: 120_000 }))
    const mfj = computeFederalTax(input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 120_000 }))
    expect(qss.deduction).toBe(mfj.deduction)
    expect(qss.ordinaryTax).toBe(mfj.ordinaryTax)
    expect(qss.amtExemption).toBe(mfj.amtExemption)
  })
})

describe('zeroRateLtcgHeadroom (gain-harvesting advisory)', () => {
  it('reports room up to the 15% threshold when taxable income is low (no SS)', () => {
    // Single, $30k ordinary − $16,100 standard = $13,900 taxable; 0% LTCG to $49,450.
    const d = computeFederalTax(input({ ordinaryIncome: 30_000 }))
    expect(d.zeroRateLtcgHeadroom).toBeCloseTo(49_450 - 13_900, 0)
  })

  it('is zero once taxable income is above the 15% threshold', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 120_000 }))
    expect(d.zeroRateLtcgHeadroom).toBe(0)
  })

  it('shrinks as realized gains fill the 0% bracket (no SS)', () => {
    const noGains = computeFederalTax(input({ ordinaryIncome: 30_000 })).zeroRateLtcgHeadroom
    const withGains = computeFederalTax(input({ ordinaryIncome: 30_000, capitalGains: 10_000 })).zeroRateLtcgHeadroom
    expect(withGains).toBeCloseTo(noGains - 10_000, 0)
  })

  it('accounts for Social Security phase-in (less than the naive estimate)', () => {
    // Single, $40k SS, no other income. Naively the whole $49,450 looks free, but
    // realizing gains makes more SS taxable, so the safe 0% harvest is smaller.
    const d = computeFederalTax(input({ ordinaryIncome: 0, ssBenefits: 40_000 }))
    expect(d.zeroRateLtcgHeadroom).toBeGreaterThan(0)
    expect(d.zeroRateLtcgHeadroom).toBeLessThan(45_000)
    // Realized gains stay below the threshold: confirm taxable income holds at it.
    const realized = computeFederalTax(input({ ordinaryIncome: 0, ssBenefits: 40_000, capitalGains: d.zeroRateLtcgHeadroom }))
    expect(realized.taxableIncome).toBeLessThanOrEqual(49_450 + 1)
  })
})

describe('applyCapitalLossCarryforward', () => {
  const LIMIT = 3_000

  it('absorbs realized gains first, then deducts $3k as a net loss, carrying the rest', () => {
    // $50k pool, $2k gain, $40k income: gain absorbed, $3k net-loss deduction, $45k carries.
    const r = applyCapitalLossCarryforward(50_000, 40_000, 2_000, LIMIT)
    expect(r.usedAgainstGains).toBe(2_000)
    expect(r.usedAgainstOrdinary).toBe(3_000)
    expect(r.netCapitalGain).toBe(-3_000) // gains absorbed, then a $3k deductible net loss
    expect(r.ordinaryAfter).toBe(40_000) // ordinary income itself is unchanged
    expect(r.remaining).toBe(45_000)
  })

  it('still deducts $3k in a year with no realized gains', () => {
    const r = applyCapitalLossCarryforward(50_000, 40_000, 0, LIMIT)
    expect(r.usedAgainstGains).toBe(0)
    expect(r.usedAgainstOrdinary).toBe(3_000)
    expect(r.netCapitalGain).toBe(-3_000)
    expect(r.remaining).toBe(47_000)
  })

  it('only offsets the gains it can when the pool is smaller than the gains', () => {
    const r = applyCapitalLossCarryforward(1_000, 40_000, 5_000, LIMIT)
    expect(r.usedAgainstGains).toBe(1_000)
    expect(r.netCapitalGain).toBe(4_000) // gains remain, taxed
    expect(r.usedAgainstOrdinary).toBe(0) // pool exhausted by gains
    expect(r.remaining).toBe(0)
  })

  it('a large gain can consume the whole pool, leaving nothing to deduct', () => {
    const r = applyCapitalLossCarryforward(50_000, 40_000, 50_000, LIMIT)
    expect(r.netCapitalGain).toBe(0)
    expect(r.usedAgainstOrdinary).toBe(0)
    expect(r.remaining).toBe(0)
  })

  it('deducts the full $3k even when other income is below $3k (the loss is a capital line, not an ordinary offset)', () => {
    // Regression for the SS/AGI cascade: the deduction is NOT capped at other income.
    const r = applyCapitalLossCarryforward(50_000, 1_000, 0, LIMIT)
    expect(r.usedAgainstOrdinary).toBe(3_000)
    expect(r.netCapitalGain).toBe(-3_000)
    expect(r.ordinaryAfter).toBe(1_000)
    expect(r.remaining).toBe(47_000)
  })

  it('depletes over multiple years until exhausted', () => {
    let pool = 8_000
    const used: number[] = []
    for (let y = 0; y < 4; y++) {
      const r = applyCapitalLossCarryforward(pool, 40_000, 0, LIMIT)
      used.push(r.usedAgainstOrdinary)
      pool = r.remaining
    }
    expect(used).toEqual([3_000, 3_000, 2_000, 0]) // $8k drains in 3 years
    expect(pool).toBe(0)
  })

  it('is a no-op when the pool is zero', () => {
    const r = applyCapitalLossCarryforward(0, 40_000, 10_000, LIMIT)
    expect(r.ordinaryAfter).toBe(40_000)
    expect(r.netCapitalGain).toBe(10_000)
    expect(r.remaining).toBe(0)
  })

  it('reduces taxable Social Security even with little other income (bot-flagged case)', () => {
    // $60k SS, $1k other income, $3k net loss from the carryforward and no gains:
    // the loss lowers provisional income, so less SS is taxable and MAGI drops.
    const loss = applyCapitalLossCarryforward(50_000, 1_000, 0, LIMIT)
    const base = computeFederalTax(input({ ordinaryIncome: 1_000, ssBenefits: 60_000 }))
    const withLoss = computeFederalTax(
      input({ ordinaryIncome: loss.ordinaryAfter, capitalGains: loss.netCapitalGain, ssBenefits: 60_000 }),
    )
    expect(base.taxableSocialSecurity).toBeCloseTo(3_000, 0)
    expect(withLoss.taxableSocialSecurity).toBeCloseTo(1_500, 0) // $3k loss → $1.5k less taxable SS
    expect(withLoss.magi).toBeLessThan(base.magi)
  })

  it('floors AGI/MAGI at zero when a net capital loss exceeds other income', () => {
    const d = computeFederalTax(input({ ordinaryIncome: 1_000, capitalGains: -3_000 }))
    expect(d.agi).toBe(0)
    expect(d.taxableIncome).toBe(0)
    expect(d.totalTax).toBe(0)
  })
})
