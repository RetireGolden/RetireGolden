/**
 * Pins the optimizer's in-solve section 86 linearization against the statutory
 * two-tier formula. Production arithmetic is unchanged: this fixture records
 * the observed proxy, not a tax correction.
 *
 * One year plus irmaaLookback avoids IRMAA binaries; senior/state/taxable/RMD
 * features are inactive. Synthetic zero cash inflows/spending isolate tax paid
 * from openingOther. liquidationRate 1 makes leaving traditional assets
 * worthless to the objective, so all traditional funds are economically
 * liquidated. Conversion and withdrawal-to-save are nearly tied; production's
 * 1e-6 preference selected conversions in the observed runs. That tie-break is
 * not law.
 */
import { expect, it } from 'vitest'
import { packForYear } from '../../params/index.js'
import { describeRule } from '../describeRule.js'
import { buildOptimizerModel, optimizeSchedule, type OptimizerInput, type OptimizerYear } from '../../strategies/optimizer.js'

const PACK = packForYear(2026).pack
const STD = 16_100
const money = (n: number): number => Math.round(n * 100) / 100
function year(over: Partial<OptimizerYear> = {}): OptimizerYear {
  return {
    year: 2026, pack: PACK, filingStatus: 'single', ordinaryIncomeBase: 0,
    spendingNeed: 0, exogenousCash: 0, rmdDivisor: null,
    inheritedDistribution: 0, inheritedDistributionDivisor: null,
    peopleAged65Plus: 0, inflationScale: 1, growth: 0, stateRate: 0,
    tradInflow: 0, otherInflow: 0, ...over,
  }
}
function input(y: OptimizerYear, openingTrad = 0): OptimizerInput {
  return {
    years: [y], openingTrad, openingInheritedTrad: 0, openingOther: 1_000_000,
    openingTaxable: 0, taxableBasisRatio: 1, ltcgRate: 0,
    irmaaLookback: true, seniorDeduction: false,
    liquidationRate: 1, realDollarFactor: 1,
    options: { timeLimitSec: 5, maxConversionPerYear: openingTrad },
  }
}

describeRule('irc-86-a-optimizer-taxable-social-security-linearization', {
  readings: {
    statutoryCappedTwoTier: [500, 8_500, 8_500],
    uncappedAffineWithNearCapFreeze: [2_500, 81_850, 8_452.5],
    uncappedAffineWithoutFreeze: [2_500, 81_850, 8_537.5],
    flat85Percent: [850, 8_500, 8_500],
    alwaysFreezeBaseline: [0, 0, 8_452.5],
  },
  accepted: 'statutoryCappedTwoTier',
  produced: 'uncappedAffineWithNearCapFreeze',
}, ({ accepted, produced, readings }) => {
  it('prices the uncapped affine proxy, freezing a near-cap baseline', async () => {
    expect(PACK.federalTax.standardDeduction.single).toBe(STD)

    const cases = [
      // Plateau PI 30,000: min(500, 2,500) = 500. Accepted TI 13,900, tax 1,420
      // (1,240 + 0.12 × 1,500). Uncapped affine keeps 2,500.
      {
        benefits: 1_000,
        nonSsOrdinary: 20_000,
        baselineTaxableSs: 0,
        openingTrad: 9_500,
        activatesPwl: true,
      },
      // Upper PI 125,000: min(8,500, 0.85 × (125,000 − 34,000) + min(5,000, 4,500))
      // = 8,500. Accepted TI 112,400, tax 19,574 (17,966 + 0.24 × 6,700).
      // Uncapped affine keeps 81,850.
      {
        benefits: 10_000,
        nonSsOrdinary: 20_000,
        baselineTaxableSs: 0,
        openingTrad: 100_000,
        activatesPwl: true,
      },
      // Near baseline PI 38,650 → 4,500 + 0.85 × (38,650 − 34,000) = 8,452.5
      // = 84.525% of benefits; after 100 more income PI 38,750, statutory cap
      // 8,500. Accepted TI 26,150, tax 2,890 (1,240 + 0.12 × 13,750). Freeze
      // understates inclusion 47.5, tax 5.7.
      {
        benefits: 10_000,
        nonSsOrdinary: 33_650,
        baselineTaxableSs: 8_452.5,
        openingTrad: 100,
        activatesPwl: false,
      },
    ] as const

    const conversions: number[] = []
    const taxableOrdinary: number[] = []
    const taxableSS: number[] = []
    const lifetimeTax: number[] = []

    for (const rowSpec of cases) {
      const inpt = input(year({
        ordinaryIncomeBase: rowSpec.nonSsOrdinary + rowSpec.baselineTaxableSs,
        ssTaxability: {
          ssBenefits: rowSpec.benefits,
          taxableSsBase: rowSpec.baselineTaxableSs,
          provisionalIncomeAddbacks: 0,
        },
      }), rowSpec.openingTrad)

      const model = buildOptimizerModel(inpt)
      expect(model.binaryCount).toBe(0)
      if (rowSpec.activatesPwl) {
        expect(model.lp).toContain('taxss0a:')
        expect(model.lp).toContain('taxss0b:')
      } else {
        expect(model.lp).not.toContain('taxss0a:')
        expect(model.lp).not.toContain('taxss0b:')
      }

      const result = await optimizeSchedule(inpt)
      expect(result.status).toBe('optimal')
      expect(result.schedule).toHaveLength(1)
      const row = result.schedule[0]!
      const grossAdditional = money(
        row.conversion + row.withdrawTraditional + row.withdrawInheritedTraditional,
      )
      expect(grossAdditional).toBe(rowSpec.openingTrad)
      expect(row.endTrad).toBeCloseTo(0, 8)
      expect(row.withdrawTraditional).toBeCloseTo(0, 8)
      expect(row.withdrawInheritedTraditional).toBeCloseTo(0, 8)

      conversions.push(row.conversion)
      taxableOrdinary.push(row.taxableOrdinary)
      taxableSS.push(money(
        row.taxableOrdinary + STD - (rowSpec.nonSsOrdinary + grossAdditional),
      ))
      lifetimeTax.push(result.lifetimeTax)
    }

    expect(conversions).toEqual([9_500, 100_000, 100])
    expect(taxableOrdinary).toEqual([15_900, 185_750, 26_102.5])
    expect(taxableSS).toEqual(produced)
    expect(taxableSS).not.toEqual(accepted)
    expect(taxableSS).not.toEqual(readings.uncappedAffineWithoutFreeze)
    expect(taxableSS).not.toEqual(readings.flat85Percent)
    expect(taxableSS).not.toEqual(readings.alwaysFreezeBaseline)
    expect(lifetimeTax).toEqual([1_660, 37_178, 2_884.3])
  }, 60_000)
})
