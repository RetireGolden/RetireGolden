import { describe, expect, it } from 'vitest'

import { stateParamsFor } from '../params/state'
import type { TaxYearInput } from '../projection/types'
import { computeStateTax, computeStateTaxDetail, createStateTaxCalculator } from './stateTax'

function input(over: Partial<TaxYearInput> = {}): TaxYearInput {
  return {
    year: 2026,
    filingStatus: 'single',
    ordinaryIncome: 0,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    ...over,
  }
}

const pack = (code: string) => stateParamsFor(code, 2026)!

describe('computeStateTax — code paths', () => {
  it('no-income-tax state is always zero', () => {
    expect(computeStateTax(pack('FL'), input({ ordinaryIncome: 200_000, capitalGains: 50_000 }))).toBe(0)
  })

  it('flat state with a full retirement exclusion taxes only non-retirement income', () => {
    const pa = pack('PA')
    // 100k all retirement income, both age-eligible → fully excluded → $0.
    expect(computeStateTax(pa, input({ ordinaryIncome: 100_000, retirementIncome: 100_000, agesAlive: [68] }))).toBeCloseTo(0, 6)
    // 100k wages (no retirement) → 3.07% flat, no standard deduction.
    expect(computeStateTax(pa, input({ ordinaryIncome: 100_000, retirementIncome: 0, agesAlive: [68] }))).toBeCloseTo(3070, 6)
  })

  it('full exclusion respects the minimum age', () => {
    const pa = pack('PA') // minAge 60
    // Age 55 → not eligible → full 100k taxed at 3.07%.
    expect(computeStateTax(pa, input({ ordinaryIncome: 100_000, retirementIncome: 100_000, agesAlive: [55] }))).toBeCloseTo(3070, 6)
  })

  it('flat state with a capped per-person exclusion (KY)', () => {
    const ky = pack('KY') // 3.5%, std ded 3,360 single, cap 31,110/person
    // Single retiree, 50k retirement income: taxable = 50,000 - 31,110 - 3,360 = 15,530 -> 3.5%.
    const tax = computeStateTax(ky, input({ ordinaryIncome: 50_000, retirementIncome: 50_000, agesAlive: [70] }))
    expect(tax).toBeCloseTo((50_000 - 31_110 - 3360) * 0.035, 4)
  })

  it('caps scale with the number of eligible people (MFJ)', () => {
    const ky = pack('KY')
    // Couple, 50k retirement income, cap 31,110 each -> 62,220 > 50k -> fully excluded; std ded 6,720 -> taxable 0.
    const tax = computeStateTax(ky, input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 50_000, retirementIncome: 50_000, agesAlive: [70, 68] }))
    expect(tax).toBe(0)
  })

  it('applies a shared capped rule once to combined retirement income (KY)', () => {
    const ky = pack('KY') // no separate public-pension law → one cap on all retirement income
    // 40k private (IRA/RMD) + 40k public pension: the 31,110 cap applies once
    // to the combined 80k, never once per bucket.
    const tax = computeStateTax(
      ky,
      input({ ordinaryIncome: 80_000, privateRetirementIncome: 40_000, publicPensionIncome: 40_000, agesAlive: [70] }),
    )
    expect(tax).toBeCloseTo((80_000 - 31_110 - 3360) * 0.035, 4)
  })

  it('separates private retirement from fully exempt public pensions (KS)', () => {
    const ks = pack('KS')
    const privateTax = computeStateTax(
      ks,
      input({ ordinaryIncome: 80_000, privateRetirementIncome: 40_000, agesAlive: [68] }),
    )
    const publicTax = computeStateTax(
      ks,
      input({ ordinaryIncome: 80_000, publicPensionIncome: 40_000, agesAlive: [68] }),
    )
    expect(publicTax).toBeLessThan(privateTax)
    expect(publicTax).toBeCloseTo(computeStateTax(ks, input({ ordinaryIncome: 40_000, agesAlive: [68] })), 6)
  })

  it('graduated brackets with a capped exclusion and SS exempt (NY)', () => {
    const ny = pack('NY')
    // SS not taxed even though present; $20k retirement exclusion at 59½+.
    const taxable = 90_000 - 20_000 - 8000 // ordinary − exclusion − std ded = 62,000
    // Brackets: 4% to 8,500; 4.5% to 11,700; 5.25% to 13,900; 5.5% to 80,650; ...
    const expected =
      8500 * 0.04 +
      (11_700 - 8500) * 0.045 +
      (13_900 - 11_700) * 0.0525 +
      (taxable - 13_900) * 0.055
    const tax = computeStateTax(ny, input({ ordinaryIncome: 90_000, retirementIncome: 30_000, ssBenefits: 40_000, agesAlive: [66] }))
    expect(tax).toBeCloseTo(expected, 2)
  })

  it('exempts U.S. government interest (TIPS/Treasury) from the state base', () => {
    const pa = pack('PA')
    const withTreasury = computeStateTax(pa, input({ ordinaryIncome: 100_000, usGovernmentInterest: 20_000, agesAlive: [55] }))
    const without = computeStateTax(pa, input({ ordinaryIncome: 80_000, agesAlive: [55] }))
    expect(withTreasury).toBeCloseTo(without, 6)
    // The exemption never exceeds ordinary income.
    expect(computeStateTax(pa, input({ ordinaryIncome: 10_000, usGovernmentInterest: 50_000, agesAlive: [55] }))).toBe(0)
  })

  it('the flat effective-rate override also honors the U.S. government interest exemption', () => {
    const calc = createStateTaxCalculator({ overridePct: 5 })
    const tax = calc.compute(input({ ordinaryIncome: 60_000, usGovernmentInterest: 10_000 }))
    expect(tax).toBeCloseTo(50_000 * 0.05, 6)
  })

  it('a state that taxes Social Security adds the federally taxable amount (MN)', () => {
    const mn = pack('MN')
    const withoutSs = computeStateTax(mn, input({ ordinaryIncome: 60_000, agesAlive: [68] }))
    const withSs = computeStateTax(mn, input({ ordinaryIncome: 60_000, ssBenefits: 40_000, agesAlive: [68] }))
    expect(withSs).toBeGreaterThan(withoutSs)
  })

  it('taxes capital gains as ordinary income in CA, MN, and NJ spot fixtures', () => {
    for (const code of ['CA', 'MN', 'NJ']) {
      const params = pack(code)
      const withoutGain = computeStateTax(params, input({ ordinaryIncome: 80_000, agesAlive: [68] }))
      const withGain = computeStateTax(params, input({ ordinaryIncome: 80_000, capitalGains: 20_000, agesAlive: [68] }))
      expect(withGain, code).toBeGreaterThan(withoutGain)
    }
  })

  it('supports partial capital-gain inclusion for preferential state rules', () => {
    const params = { ...pack('PA'), capitalGainsAsOrdinary: false, capitalGainsTaxablePct: 50 }
    const tax = computeStateTax(params, input({ capitalGains: 20_000 }))
    expect(tax).toBeCloseTo(10_000 * 0.0307, 6)
  })

  it('does not let a federal capital-loss carryforward erase PA current-year gains', () => {
    const pa = pack('PA')
    const tax = computeStateTax(
      pa,
      input({
        ordinaryIncome: 0,
        capitalGains: 0,
        realizedCapitalGainsBeforeCarryforward: 20_000,
      }),
    )
    expect(tax).toBeCloseTo(20_000 * 0.0307, 6)
  })
})

describe('createStateTaxCalculator', () => {
  it('resolves the state from each input and handles a mid-plan move', () => {
    const calc = createStateTaxCalculator()
    const fl = calc.compute(input({ state: 'FL', ordinaryIncome: 100_000 }))
    const ky = calc.compute(input({ state: 'KY', ordinaryIncome: 100_000, agesAlive: [70] }))
    expect(fl).toBe(0)
    expect(ky).toBeGreaterThan(0)
  })

  it('prorates income, deductions, and brackets across a July CA-to-NV move year', () => {
    const calc = createStateTaxCalculator()
    const tax = calc.compute(
      input({
        ordinaryIncome: 120_000,
        state: 'NV',
        stateResidency: [
          { state: 'CA', months: 6 },
          { state: 'NV', months: 6 },
        ],
      }),
    )
    const taxable = 60_000 - 2770
    const expected =
      5539.5 * 0.01 +
      (13_132 - 5539.5) * 0.02 +
      (20_726 - 13_132) * 0.04 +
      (28_771 - 20_726) * 0.06 +
      (36_362 - 28_771) * 0.08 +
      (taxable - 36_362) * 0.093
    expect(tax).toBeCloseTo(expected, 2)
  })

  it('apportions the full-year taxable Social Security amount across a split year (MN)', () => {
    const calc = createStateTaxCalculator()
    const base = { ordinaryIncome: 60_000, ssBenefits: 40_000, agesAlive: [68] }
    const fullYear = calc.compute(input({ ...base, state: 'MN' }))
    const split = calc.compute(
      input({
        ...base,
        state: 'MN',
        stateResidency: [
          { state: 'MN', months: 6 },
          { state: 'MN', months: 6 },
        ],
      }),
    )
    // Every other component prorates linearly, so a 6/6 "move" within one state
    // must equal the full year exactly. Recomputing taxable SS per slice from
    // halved income against full-year federal thresholds (the old behavior)
    // understated it and made split < fullYear.
    expect(fullYear).toBeGreaterThan(0)
    expect(split).toBeCloseTo(fullYear, 6)
  })

  it('unmodeled state codes contribute zero (fallback to override handled upstream)', () => {
    const calc = createStateTaxCalculator()
    // All 50 states + DC are modeled; only unknown codes (territories, bad input) fall through.
    expect(calc.compute(input({ state: 'ZZ', ordinaryIncome: 100_000 }))).toBe(0)
    expect(calc.compute(input({ state: 'PR', ordinaryIncome: 100_000 }))).toBe(0)
  })

  it('the flat override takes precedence over modeled packs', () => {
    const calc = createStateTaxCalculator({ overridePct: 5 })
    // Even in no-tax FL, the explicit override applies.
    expect(calc.compute(input({ state: 'FL', ordinaryIncome: 100_000, capitalGains: 20_000 }))).toBeCloseTo(6000, 6)
  })

  it('adds local tax on state taxable income when modeled state packs are active', () => {
    const ky = pack('KY')
    const detail = computeStateTaxDetail(ky, input({ ordinaryIncome: 100_000, agesAlive: [70] }))
    const calc = createStateTaxCalculator({ localPct: 3 })
    const withLocal = calc.compute(input({ state: 'KY', ordinaryIncome: 100_000, agesAlive: [70] }))
    expect(withLocal).toBeCloseTo(detail.stateTax + detail.taxableIncome * 0.03, 6)
  })

  it('no override and no state → zero', () => {
    expect(createStateTaxCalculator().compute(input({ ordinaryIncome: 100_000 }))).toBe(0)
  })
})
