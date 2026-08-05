import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import { conformStateStandardDeduction, stateParamsFor } from '../params/state/index.js'
import { packForYear } from '../params/index.js'
import type { TaxYearInput } from '../projection/types.js'
import { computeFederalTax } from './federalTax.js'
import { computeStateTax, computeStateTaxDetail, createStateTaxCalculator } from './stateTax.js'

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
const FEDERAL_AGE65_ADDITION = packForYear(2026).pack.federalTax.age65Addition

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
    // 2026 brackets: 3.9% to 8,500; 4.4% to 11,700; 5.15% to 13,900; 5.4% to 80,650; ...
    const expected =
      8500 * 0.039 +
      (11_700 - 8500) * 0.044 +
      (13_900 - 11_700) * 0.0515 +
      (taxable - 13_900) * 0.054
    const tax = computeStateTax(ny, input({ ordinaryIncome: 90_000, retirementIncome: 30_000, ssBenefits: 40_000, agesAlive: [66] }))
    expect(tax).toBeCloseTo(expected, 2)
  })

  // 31 U.S.C. 3124(a) is federal law binding every state, and it reaches "each
  // form of taxation that would require the obligation, the interest on the
  // obligation, or both, to be considered in computing a tax". The only
  // exceptions are a corporate franchise tax and an estate or inheritance tax,
  // so no state income tax on an individual can reach it -- which is why the
  // exemption is uniform rather than a per-state flag.
  //
  // Pennsylvania flat rate on 100,000 of ordinary income including 20,000 of
  // Treasury interest:
  //   exempt:        taxed as though the base were 80,000
  //   taxed anyway:  taxed on the full 100,000
  describeRule('usc-31-3124-a-federal-obligations-state-exempt', {
    readings: { outsideEveryStateBase: 80_000, insideTheStateBase: 100_000 },
    accepted: 'outsideEveryStateBase',
  }, ({ accepted, readings }) => {
    it('keeps federal obligation interest out of the state base', () => {
      const pa = pack('PA')
      const withTreasury = computeStateTax(pa, input({
        ordinaryIncome: 100_000, usGovernmentInterest: 20_000, agesAlive: [55],
      }))

      expect(withTreasury)
        .toBeCloseTo(computeStateTax(pa, input({ ordinaryIncome: accepted, agesAlive: [55] })), 6)
      expect(withTreasury)
        .not.toBeCloseTo(computeStateTax(pa, input({ ordinaryIncome: readings.insideTheStateBase, agesAlive: [55] })), 6)
    })
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

  it('threads foreign-exclusion provisional income into a state federal-SS base', () => {
    const mn = pack('MN')
    const without = computeStateTaxDetail(
      mn,
      input({ ordinaryIncome: 20_000, ssBenefits: 20_000, agesAlive: [68] }),
    )
    const withForeignExclusion = computeStateTaxDetail(
      mn,
      input({
        ordinaryIncome: 20_000,
        ssBenefits: 20_000,
        foreignExclusionAddback: 10_000,
        agesAlive: [68],
      }),
    )
    expect(withForeignExclusion.taxableIncome).toBeGreaterThan(without.taxableIncome)
    expect(withForeignExclusion.totalTax).toBeGreaterThan(without.totalTax)
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

  it('MO fully exempts individual capital gains (HB 594, from TY2025)', () => {
    // Missouri's pack sets capitalGainsAsOrdinary: false with no partial
    // inclusion, so growing gains must leave MO tax unchanged while ordinary
    // income stays taxed.
    const mo = pack('MO')
    const withoutGain = computeStateTax(mo, input({ ordinaryIncome: 80_000, agesAlive: [68] }))
    const withGain = computeStateTax(mo, input({ ordinaryIncome: 80_000, capitalGains: 250_000, agesAlive: [68] }))
    expect(withoutGain).toBeGreaterThan(0)
    expect(withGain).toBe(withoutGain)
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

  it('keeps PA current-year-only treatment floored when the raw result is a loss', () => {
    const tax = computeStateTax(
      pack('PA'),
      input({
        ordinaryIncome: 0,
        capitalGains: -3_000,
        realizedCapitalGainsBeforeCarryforward: -20_000,
      }),
    )

    expect(tax).toBe(0)
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

// The projection runs in nominal dollars, so a 2046 withdrawal arrives inflated.
// A state pack tagged `standardDeductionConformity: 'federal'` carries no state
// standard deduction at all: it carries a copy of the FEDERAL one. IRC
// 63(c)(7)(B)(ii) increases the federal amount for every taxable year beginning
// after 2025 and the federal engine projects that increase forward, so the copy
// has to travel with it. North Dakota is used below because its brackets run on
// federal taxable income, which makes the identity assertion at the end of this
// block exact.
//
// WHICH packs may carry that tag is a question of each state's own law and is
// not settled here or in the registry record this fixture covers -- two of the
// nine currently tagged (AZ, DC) are under separate correction. Nothing in this
// block depends on the roster being right: it exercises the tag, not the list.
//
// `inflationScale: 2` stands for a doubling of the price level. It is chosen so
// the statutory rounding is a no-op and cannot be quietly wrong: the increase is
// 16,100 dollars, already a multiple of 50, so rounding it to the next lowest
// multiple of 50 leaves 32,200 either way.
describe('a conformed state standard deduction in a stand-in year', () => {
  const PROJECTED_YEAR = 2046
  const DOUBLED = 2
  const calc = createStateTaxCalculator()

  // North Dakota, single: 16,100 conformed deduction, then the commissioner's
  // published 2026 schedule — 0% to 49,575, 1.95% to 250,400. 180,675 of
  // ordinary income:
  //   tracks federal   taxable 148,475 -> 1.95% x  98,900            = 1,928.5500
  //   frozen at pack   taxable 164,575 -> 1.95% x 115,000            = 2,242.5000
  //   deduction and    taxable 148,475, 0% band doubled to 99,150
  //     brackets both  -> 1.95% x 49,325                             =   961.8375
  // The third reading is the one worth naming. Indexing the brackets alongside
  // the deduction is the plausible over-correction, and it is wrong for a reason
  // the deduction case does not share: a state bracket is a state dollar figure
  // under state law, and the per-state research to move any of them does not
  // exist yet (see params/state/index.ts). North Dakota's own thresholds DO move
  // annually, but by the commissioner's published schedule under N.D.C.C.
  // 57-38-30.3(1)(g) rather than by the engine's inflation scale — which is why
  // they are a pack-refresh figure and not something to index here.
  describeRule('irc-63-c-7-B-ii-conformed-state-deduction-tracks-federal', {
    readings: { statute: 1_928.55, frozenAtThePackYear: 2_242.5, bracketsIndexedToo: 961.8375 },
    accepted: 'statute',
  }, ({ accepted, readings }) => {
    it('measures nominal income against the federal deduction prescribed for that year', () => {
      const tax = calc.compute(input({
        state: 'ND',
        year: PROJECTED_YEAR,
        ordinaryIncome: 180_675,
        inflationScale: DOUBLED,
      }))

      expect(tax).toBeCloseTo(accepted, 6)
      expect(tax).not.toBeCloseTo(readings.frozenAtThePackYear, 6)
      expect(tax).not.toBeCloseTo(readings.bracketsIndexedToo, 6)
    })

    it('leaves a published year exactly as published', () => {
      // The default scale is 1 and 2026 has its own pack, so the same income
      // must still produce the frozen-reading figure -- for 2026 that reading
      // IS the statute.
      const tax = calc.compute(input({ state: 'ND', year: 2026, ordinaryIncome: 180_675 }))
      expect(tax).toBeCloseTo(readings.frozenAtThePackYear, 6)
    })
  })

  it('agrees with the federal engine on the deduction, which is the whole point', () => {
    // The defect this guards against is not a wrong number in isolation: it is
    // ONE engine holding TWO values for one statutory amount in one year, with
    // the gap taxed at the state rate. Assert the identity directly.
    const federal = computeFederalTax({
      year: PROJECTED_YEAR,
      filingStatus: 'single',
      ordinaryIncome: 180_675,
      capitalGains: 0,
      ssBenefits: 0,
      peopleAged65Plus: 0,
      inflationScale: DOUBLED,
    })
    const nd = computeStateTaxDetail(
      conformStateStandardDeduction(pack('ND'), FEDERAL_AGE65_ADDITION, DOUBLED),
      input({ state: 'ND', year: PROJECTED_YEAR, ordinaryIncome: 180_675, inflationScale: DOUBLED }),
    )

    expect(federal.deduction).toBeCloseTo(32_200, 6)
    expect(180_675 - nd.taxableIncome).toBeCloseTo(federal.deduction, 6)
  })

  it('carries the conformed deduction DOWN when the plan assumes deflation', () => {
    // 1(f)(3)(A) floors the adjustment against the BASE year only, so an indexed
    // amount can fall below the prior year's. The federal figure comes down; a
    // copy of it that refused to would under-tax the household at the state
    // rate. At half the price level Colorado's conformed deduction is 8,050:
    // 60,000 of income -> 51,950 taxable -> 4.4% = 2,285.80.
    const tax = calc.compute(input({
      state: 'CO', year: PROJECTED_YEAR, ordinaryIncome: 60_000, inflationScale: 0.5,
    }))
    expect(tax).toBeCloseTo((60_000 - 8_050) * 0.044, 6)
    expect(tax).not.toBeCloseTo((60_000 - 16_100) * 0.044, 6)
  })

  it('leaves a state that publishes its own deduction where its legislature left it', () => {
    // North Carolina's 12,750 is a North Carolina figure on a legislated ramp;
    // no federal provision reaches it, and ME and SC decoupled from the federal
    // amount for 2026 precisely so theirs would not move with it either.
    const tax = calc.compute(input({
      state: 'NC', year: PROJECTED_YEAR, ordinaryIncome: 100_000, inflationScale: DOUBLED,
    }))
    expect(tax).toBeCloseTo((100_000 - 12_750) * 0.0399, 6)
    expect(tax).not.toBeCloseTo((100_000 - 25_500) * 0.0399, 6)
  })

  it('does not sweep the state retirement-exclusion cap along with the deduction', () => {
    // Colorado's 24,000 pension subtraction is a Colorado dollar amount that
    // Colorado does not index. Only the borrowed federal deduction moves:
    // 100,000 - 24,000 - 32,200 = 43,800 at 4.4%.
    const tax = calc.compute(input({
      state: 'CO',
      year: PROJECTED_YEAR,
      ordinaryIncome: 100_000,
      retirementIncome: 100_000,
      agesAlive: [70],
      inflationScale: DOUBLED,
    }))
    expect(tax).toBeCloseTo((100_000 - 24_000 - 32_200) * 0.044, 6)
    expect(tax).not.toBeCloseTo((100_000 - 48_000 - 32_200) * 0.044, 6)
  })
})

// IRC 63(c)(1): "the standard deduction" is the BASIC standard deduction plus
// the ADDITIONAL standard deduction, and 63(c)(3)/63(f)(1) is where the
// additional amount for a taxpayer who has attained age 65 comes from. A state
// that defines its deduction by reference to the federal one has therefore
// referenced both halves — five of the nine (CO, IA, ID, MT, ND) start from
// federal taxable income, which is already net of the whole thing; MO adopts
// the allowable federal standard deduction by name; NM excludes an amount equal
// to the deduction allowed by Section 63.
//
// 2026 federal figures: basic 16,100 single / 32,200 joint; additional 2,050
// single / 1,650 per person joint. Colorado is the cleanest arithmetic — a flat
// 4.4% on a base that is federal taxable income — so the whole effect of the
// addition is visible as `addition x 4.4%`.
describe('the age-65 additional standard deduction in a conformed state', () => {
  const calc = createStateTaxCalculator()
  const CO_RATE = 0.044

  it('taxes a 65-year-old single filer less than the same filer at 64', () => {
    const at64 = calc.compute(input({ state: 'CO', ordinaryIncome: 60_000, peopleAged65Plus: 0 }))
    const at65 = calc.compute(input({ state: 'CO', ordinaryIncome: 60_000, peopleAged65Plus: 1 }))

    expect(at64).toBeCloseTo((60_000 - 16_100) * CO_RATE, 6)
    expect(at65).toBeCloseTo((60_000 - 16_100 - 2_050) * CO_RATE, 6)
    expect(at65).toBeLessThan(at64)
    expect(at64 - at65).toBeCloseTo(2_050 * CO_RATE, 6)
  })

  it('gives the joint addition once per person who has reached 65, not once per return', () => {
    const neither = calc.compute(input({ state: 'CO', filingStatus: 'marriedFilingJointly', ordinaryIncome: 100_000, peopleAged65Plus: 0 }))
    const one = calc.compute(input({ state: 'CO', filingStatus: 'marriedFilingJointly', ordinaryIncome: 100_000, peopleAged65Plus: 1 }))
    const both = calc.compute(input({ state: 'CO', filingStatus: 'marriedFilingJointly', ordinaryIncome: 100_000, peopleAged65Plus: 2 }))

    expect(neither).toBeCloseTo((100_000 - 32_200) * CO_RATE, 6)
    expect(one).toBeCloseTo((100_000 - 32_200 - 1_650) * CO_RATE, 6)
    expect(both).toBeCloseTo((100_000 - 32_200 - 3_300) * CO_RATE, 6)
    // The second spouse is worth exactly as much as the first.
    expect(neither - one).toBeCloseTo(one - both, 6)
  })

  it('travels with the conformed deduction into a stand-in year', () => {
    // At a doubled price level the addition is 4,100, not 2,050: it is one of
    // the federal figures `indexFederalTaxPack` moves, so a copy that moved the
    // basic amount alone would drift apart from the original all over again.
    const tax = calc.compute(input({
      state: 'CO', year: 2046, ordinaryIncome: 100_000, peopleAged65Plus: 1, inflationScale: 2,
    }))
    expect(tax).toBeCloseTo((100_000 - 32_200 - 4_100) * CO_RATE, 6)
    expect(tax).not.toBeCloseTo((100_000 - 32_200 - 2_050) * CO_RATE, 6)
  })

  it('gives a part-year resident a prorated addition, not a full one', () => {
    // Five months in Colorado, seven in no-tax Florida. Residency scales the
    // income, the basic deduction AND the addition by 5/12, so the Colorado
    // slice is exactly five twelfths of the full-year Colorado bill:
    //   income     60,000 x 5/12 = 25,000.0000
    //   basic      16,100 x 5/12 =  6,708.3333
    //   addition    2,050 x 5/12 =    854.1667
    //   taxable                   = 17,437.5000 -> 4.4% = 767.25
    const tax = calc.compute(input({
      ordinaryIncome: 60_000,
      peopleAged65Plus: 1,
      stateResidency: [{ state: 'CO', months: 5 }, { state: 'FL', months: 7 }],
    }))

    const fullYearCo = (60_000 - 16_100 - 2_050) * CO_RATE
    expect(tax).toBeCloseTo(767.25, 6)
    expect(tax).toBeCloseTo(fullYearCo * (5 / 12), 6)
    // The failure mode this pins: a full-year addition against a five-month
    // income slice, which would under-tax the Colorado months.
    expect(tax).not.toBeCloseTo((25_000 - 16_100 * (5 / 12) - 2_050) * CO_RATE, 6)
    // ...and the defect itself: no addition at all.
    expect(tax).not.toBeCloseTo((25_000 - 16_100 * (5 / 12)) * CO_RATE, 6)
  })

  it('gives nothing to a state that publishes its own deduction', () => {
    // North Carolina's 12,750 is a North Carolina figure. No federal provision
    // reaches it, and the age-65 addition must not generalise to it: whatever
    // age relief NC gives is already inside its own deduction and brackets.
    const at64 = calc.compute(input({ state: 'NC', ordinaryIncome: 60_000, peopleAged65Plus: 0 }))
    const at65 = calc.compute(input({ state: 'NC', ordinaryIncome: 60_000, peopleAged65Plus: 2 }))
    expect(at65).toBeCloseTo(at64, 6)
    expect(at65).toBeCloseTo((60_000 - 12_750) * 0.0399, 6)
  })

  it('agrees with the federal engine on the whole IRC 63(c)(1) deduction', () => {
    // Same identity the basic-amount test asserts, now for a 65+ household:
    // one engine, one statutory amount. North Dakota's base IS federal taxable
    // income, so gross less the state base must equal the federal standard
    // deduction — the federal `deduction` field less the OBBBA senior
    // deduction, which is IRC 151(d)(5)(C) and not part of section 63 at all.
    const federal = computeFederalTax({
      year: 2026,
      filingStatus: 'marriedFilingJointly',
      ordinaryIncome: 300_000,
      capitalGains: 0,
      ssBenefits: 0,
      peopleAged65Plus: 2,
    })
    const nd = computeStateTaxDetail(
      conformStateStandardDeduction(pack('ND'), FEDERAL_AGE65_ADDITION, 1),
      input({ state: 'ND', filingStatus: 'marriedFilingJointly', ordinaryIncome: 300_000, peopleAged65Plus: 2 }),
    )

    // 300,000 of MAGI is far above the senior-deduction phase-out, so it is 0
    // here and `deduction` is the section 63 amount alone: 32,200 + 2 x 1,650.
    expect(federal.seniorDeduction).toBe(0)
    expect(federal.deduction).toBeCloseTo(35_500, 6)
    expect(300_000 - nd.taxableIncome).toBeCloseTo(federal.deduction, 6)
  })
})
