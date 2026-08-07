/**
 * Golden tests for the V8 multi-year optimizer (roadmap V8, PR 1).
 *
 * Two kinds of check, per V8 spec §1.1:
 *   1. Hand-computed economic cases — the haircut-vs-bracket logic and the RMD
 *      floor have closed-form optima we can assert exactly.
 *   2. Cross-checks against the real engine — the optimizer's schedule is fed to
 *      `simulate`, and `optimized` mode must behave identically to `manual`.
 */

import { describe, expect, it } from 'vitest'

import { packForYear } from '../params/index.js'
import type { FilingStatus } from '../params/types.js'
import { describeRule } from '../rules/describeRule.js'
import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../projection/flatTax.js'
import { simulatePlan } from '../projection/simulate.js'
import {
  buildOptimizerModel,
  optimizeSchedule,
  type OptimizerInput,
  type OptimizerYear,
} from './optimizer.js'

const PACK = packForYear(2025).pack

function year(over: Partial<OptimizerYear> = {}): OptimizerYear {
  return {
    year: 2030,
    pack: PACK,
    filingStatus: 'single' as FilingStatus,
    ordinaryIncomeBase: 0,
    spendingNeed: 0,
    exogenousCash: 0,
    rmdDivisor: null,
    inheritedDistribution: 0,
    inheritedDistributionDivisor: null,
    peopleAged65Plus: 0,
    inflationScale: 1,
    growth: 0,
    stateRate: 0,
    tradInflow: 0,
    otherInflow: 0,
    ...over,
  }
}

describe('optimizer model builder', () => {
  it('prices exact-ledger IRA character in every ordinary-income coefficient', () => {
    const input: OptimizerInput = {
      years: [year({
        traditionalWithdrawalTaxableFraction: 0.75,
        rothConversionTaxableFraction: 0.5,
        acaMagiMax: 5_000,
      })],
      openingTrad: 100_000,
      openingInheritedTrad: 0,
      openingOther: 0,
      liquidationRate: 0.5,
    }

    const lp = buildOptimizerModel(input).lp

    expect(lp).toContain(
      ' tifloor0: + 1 ti0 - 0.5 conv0 - 0.75 wt0 - 1 wi0',
    )
    expect(lp).toContain(
      ' acamagi0: + 0.5 conv0 + 0.75 wt0 + 1 wi0 <= 5000',
    )
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'falls back to all-taxable coefficients for non-finite fraction %s',
    (invalidFraction) => {
      const lp = buildOptimizerModel({
        years: [year({
          traditionalWithdrawalTaxableFraction: invalidFraction,
          rothConversionTaxableFraction: invalidFraction,
          acaMagiMax: 5_000,
        })],
        openingTrad: 100_000,
        openingInheritedTrad: 0,
        openingOther: 0,
        liquidationRate: 0.5,
      }).lp

      expect(lp).toContain(
        ' tifloor0: + 1 ti0 - 1 conv0 - 1 wt0 - 1 wi0',
      )
      expect(lp).toContain(
        ' acamagi0: + 1 conv0 + 1 wt0 + 1 wi0 <= 5000',
      )
      expect(lp).not.toMatch(/NaN|Infinity/)
    },
  )

  it('changes the raw compressed schedule when actionable ACA MAGI binds', async () => {
    const base: OptimizerInput = {
      years: [year()],
      openingTrad: 100_000,
      openingInheritedTrad: 0,
      openingOther: 0,
      liquidationRate: 0.5,
    }
    const unconstrained = await optimizeSchedule(base)
    const acaBounded = await optimizeSchedule({
      ...base,
      years: [year({ acaMagiMax: 5_000 })],
    })

    expect(unconstrained.schedule[0]!.conversion).toBeGreaterThan(5_000)
    expect(acaBounded.schedule[0]!.conversion).toBeCloseTo(5_000, 0)
    expect(buildOptimizerModel(base).lp).not.toContain(' acamagi0:')
    expect(buildOptimizerModel(acaBounded.status ? {
      ...base,
      years: [year({ acaMagiMax: 5_000 })],
    } : base).lp).toContain(' acamagi0: + 1 conv0 + 1 wt0 + 1 wi0 <= 5000')
  })

  it('constrains total modeled ACA MAGI when Social Security phases in', async () => {
    const base: OptimizerInput = {
      years: [year({
        ordinaryIncomeBase: 10_000,
        ssTaxability: { ssBenefits: 30_000, taxableSsBase: 0 },
        acaMagiMax: 30_000,
      })],
      openingTrad: 100_000,
      openingInheritedTrad: 0,
      openingOther: 0,
      liquidationRate: 0.5,
    }
    const result = await optimizeSchedule(base)
    const conversion = result.schedule[0]!.conversion
    const lp = buildOptimizerModel(base).lp

    expect(conversion).toBeLessThan(20_000)
    expect(lp).toContain(' acamagi0: + 1 conv0 + 1 wt0 + 1 wi0 + 1 taxss0 <= 20000')
  })

  it('includes fixed §86 addbacks in the taxable-Social-Security intercept', () => {
    const model = buildOptimizerModel({
      years: [year({
        ordinaryIncomeBase: 9_602.04,
        ssTaxability: {
          ssBenefits: 30_004.8,
          taxableSsBase: 9_602.04,
          provisionalIncomeAddbacks: 25_000,
        },
        acaMagiMax: 17_197.24,
      })],
      openingTrad: 100_000,
      openingInheritedTrad: 0,
      openingOther: 100_000,
      liquidationRate: 0.5,
    })
    const upperPhaseIn = model.lp.split('\n').find((line) => line.includes(' taxss0b:'))

    expect(upperPhaseIn).toContain('>= 9602.04')
    expect(model.lp).toContain(
      ' acamagi0: + 1 conv0 + 1 wt0 + 1 wi0 + 1 taxss0 <= 17197.24',
    )
  })

  it('emits a well-formed LP with one binary per IRMAA tier per year', () => {
    const input: OptimizerInput = {
      years: [year(), year()],
      openingTrad: 100_000,
      openingInheritedTrad: 0,
      openingOther: 100_000,
      liquidationRate: 0.24,
    }
    const { lp, binaryCount } = buildOptimizerModel(input)
    expect(lp.startsWith('Maximize')).toBe(true)
    expect(lp).toContain('Binaries')
    expect(lp.trimEnd().endsWith('End')).toBe(true)
    expect(binaryCount).toBe(2 * PACK.medicare.irmaaTiers.length)
  })

  it('models inherited traditional assets as liquid but non-convertible', () => {
    const input: OptimizerInput = {
      years: [year({ inheritedDistribution: 10_000, inheritedDistributionDivisor: 30 })],
      openingTrad: 50_000,
      openingInheritedTrad: 300_000,
      openingOther: 100_000,
      liquidationRate: 0.24,
    }
    const { lp } = buildOptimizerModel(input)

    expect(lp).toContain(' inh0 = 300000')
    expect(lp).toContain(' inhrmd0:')
    expect(lp).toContain(' wi0')
    expect(lp).toContain(' inh0:')
    expect(lp).toContain('conv0')
  })
})

describe('taxable-gain realization in the solve (Step 2)', () => {
  it('prices taxable-account capital gains inside the solve', async () => {
    // 1 year, fund $50k of spending purely from a $100k all-gain taxable bucket
    // at a 15% LTCG rate. Net cash per withdrawn dollar is 1 − 0.15 = 0.85, so
    // funding $50k needs $50k/0.85 ≈ $58,823.53 gross, leaving ≈ $41,176.47.
    const lowBasis = await optimizeSchedule({
      years: [year({ spendingNeed: 50_000 })],
      openingTrad: 0,
      openingInheritedTrad: 0,
      openingOther: 0,
      openingTaxable: 100_000,
      taxableBasisRatio: 0, // all gain
      ltcgRate: 0.15,
      liquidationRate: 0,
    })
    expect(lowBasis.status).toBe('optimal')
    expect(lowBasis.schedule[0]!.withdrawTaxable).toBeCloseTo(58_823.53, 0)
    expect(lowBasis.schedule[0]!.taxableGainRealized).toBeCloseTo(58_823.53, 0)
    expect(lowBasis.endingAfterTax).toBeCloseTo(41_176.47, 0)

    // Control: identical bucket but all basis (no gain) funds $50k with exactly
    // $50k gross and ends higher — so the gain, not the draw, is what costs.
    const allBasis = await optimizeSchedule({
      years: [year({ spendingNeed: 50_000 })],
      openingTrad: 0,
      openingInheritedTrad: 0,
      openingOther: 0,
      openingTaxable: 100_000,
      taxableBasisRatio: 1, // no gain
      ltcgRate: 0.15,
      liquidationRate: 0,
    })
    expect(allBasis.schedule[0]!.withdrawTaxable).toBeCloseTo(50_000, 0)
    expect(allBasis.schedule[0]!.taxableGainRealized).toBeCloseTo(0, 0)
    expect(allBasis.endingAfterTax).toBeCloseTo(50_000, 0)
    expect(allBasis.endingAfterTax).toBeGreaterThan(lowBasis.endingAfterTax)
  })

  it('prefers the tax-free bucket over an equal-size all-gain taxable bucket', async () => {
    // Both buckets can fund the spend; the LP should drain the tax-free one
    // first because the taxable one leaks 15% of every gain dollar.
    const sol = await optimizeSchedule({
      years: [year({ spendingNeed: 40_000 })],
      openingTrad: 0,
      openingInheritedTrad: 0,
      openingOther: 100_000, // tax-free (roth/cash)
      openingTaxable: 100_000, // all gain
      taxableBasisRatio: 0,
      ltcgRate: 0.15,
      liquidationRate: 0,
    })
    expect(sol.status).toBe('optimal')
    expect(sol.schedule[0]!.withdrawTaxable).toBeCloseTo(0, 0)
    expect(sol.schedule[0]!.withdrawOther).toBeCloseTo(40_000, 0)
  })

  it('emits the identical LP (no taxable bucket) when there is no taxable balance', () => {
    const base = { years: [year(), year()], openingTrad: 100_000, openingInheritedTrad: 0, openingOther: 100_000, liquidationRate: 0.24 }
    const withoutTaxable = buildOptimizerModel(base)
    // No taxable/wtax variables appear, and the LP matches an explicit-zero input.
    expect(withoutTaxable.lp).not.toContain('wtax')
    expect(withoutTaxable.lp).not.toContain('taxable0')
    const explicitZero = buildOptimizerModel({ ...base, openingTaxable: 0, ltcgRate: 0.15 })
    expect(explicitZero.lp).toBe(withoutTaxable.lp)
  })
})

describe('bracketed state tax in the solve (Step 3)', () => {
  const stateBrackets = [
    { width: 20_000, rate: 0.02 },
    { width: 30_000, rate: 0.05 },
    { width: null, rate: 0.09 },
  ]

  it('adds a convex state PWL partition of taxable ordinary income', () => {
    const withState = buildOptimizerModel({
      years: [year({ ordinaryIncomeBase: 80_000, stateBrackets })],
      openingTrad: 200_000,
      openingInheritedTrad: 0,
      openingOther: 100_000,
      liquidationRate: 0.24,
    })
    expect(withState.lp).toContain(' ssplit0:')
    expect(withState.lp).toContain('sseg0_0')
    // Bounded to the bracket widths (scaled by the year's inflationScale = 1).
    expect(withState.lp).toContain(' 0 <= sseg0_0 <= 20000')
    expect(withState.lp).toContain(' 0 <= sseg0_1 <= 30000')
  })

  it('omits the state PWL and keeps the flat term when no brackets are supplied', () => {
    const flat = buildOptimizerModel({
      years: [year({ ordinaryIncomeBase: 80_000, stateRate: 0.05 })],
      openingTrad: 200_000,
      openingInheritedTrad: 0,
      openingOther: 100_000,
      liquidationRate: 0.24,
    })
    expect(flat.lp).not.toContain('ssplit')
    expect(flat.lp).not.toContain('sseg')
  })

  it('taxes conversions more heavily under progressive brackets, so it converts less', async () => {
    const base = { years: [year({ peopleAged65Plus: 1 })], openingTrad: 400_000, openingInheritedTrad: 0, openingOther: 400_000, liquidationRate: 0.24 }
    const flat = await optimizeSchedule({ ...base, years: [year({ peopleAged65Plus: 1, stateRate: 0.02 })] })
    const progressive = await optimizeSchedule({ ...base, years: [year({ peopleAged65Plus: 1, stateBrackets })] })
    expect(flat.status).toBe('optimal')
    expect(progressive.status).toBe('optimal')
    // The 9% top state bracket makes high conversions costlier than a flat 2%.
    expect(progressive.schedule[0]!.conversion).toBeLessThan(flat.schedule[0]!.conversion)
  })
})

describe('OBBBA senior deduction in the solve (ground-truth 2026 law sync, Step 2)', () => {
  // Pack rule (2026): $6k/person 65+, 6% phase-out above $75k single / $150k
  // MFJ MAGI, last applicable year 2028. Test years must sit ≤ 2028.
  const RULE = PACK.federalTax.seniorDeduction!

  it('adds the deduction and a phase-out floor for eligible years, and only then', () => {
    const base = {
      openingTrad: 400_000,
      openingInheritedTrad: 0,
      openingOther: 200_000,
      liquidationRate: 0.24,
    }
    const eligible = buildOptimizerModel({
      ...base,
      years: [year({ year: 2027, peopleAged65Plus: 1, ordinaryIncomeBase: 80_000 })],
      seniorDeduction: true,
    })
    expect(eligible.lp).toContain(' srd0:')
    // tifloor RHS reflects the extra per-person deduction on top of the
    // standard deduction + age-65 addition (computed from the pack so the
    // assertion survives parameter-pack refreshes).
    expect(eligible.lp).toContain(' tifloor0:')
    const tifloor = eligible.lp.split('\n').find((l) => l.includes(' tifloor0:'))!
    expect(tifloor).toContain('srd0')
    const expectedRhs =
      80_000 -
      (PACK.federalTax.standardDeduction.single + PACK.federalTax.age65Addition.single + RULE.amountPerPerson)
    expect(tifloor).toContain(String(expectedRhs))

    // Past the last applicable year: no deduction, no phase-out variable, and
    // the LP is byte-identical to the flag-off model.
    const expired = buildOptimizerModel({
      ...base,
      years: [year({ year: 2030, peopleAged65Plus: 1, ordinaryIncomeBase: 80_000 })],
      seniorDeduction: true,
    })
    expect(expired.lp).not.toContain('srd')
    const expiredOff = buildOptimizerModel({
      ...base,
      years: [year({ year: 2030, peopleAged65Plus: 1, ordinaryIncomeBase: 80_000 })],
    })
    expect(expired.lp).toBe(expiredOff.lp)

    // Under 65: ineligible even in-window.
    const under65 = buildOptimizerModel({
      ...base,
      years: [year({ year: 2027, peopleAged65Plus: 0, ordinaryIncomeBase: 80_000 })],
      seniorDeduction: true,
    })
    expect(under65.lp).not.toContain('srd')
  })

  it('skips years already past full phase-out at baseline (byte-identical LP)', () => {
    // Full phase-out for one single filer: $75k + $6k/0.06 = $175k MAGI.
    // Conversions only raise MAGI, so the deduction stays zero exactly.
    const base = {
      years: [year({ year: 2027, peopleAged65Plus: 1, ordinaryIncomeBase: 200_000 })],
      openingTrad: 400_000,
      openingInheritedTrad: 0,
      openingOther: 200_000,
      liquidationRate: 0.24,
    }
    const on = buildOptimizerModel({ ...base, seniorDeduction: true })
    const off = buildOptimizerModel(base)
    expect(on.lp).not.toContain('srd')
    expect(on.lp).toBe(off.lp)
  })

  it('counts baseline forced distributions toward the full-phase-out skip', () => {
    // The LP re-decides RMDs as `wt`, so `ordinaryIncomeBase` excludes them —
    // but the ledger's MAGI counts them, and a high-RMD 65+ year can be fully
    // phased out on forced income alone. $50k base + $150k baseline RMD sits
    // past the $175k single full-phase-out point ⇒ the deduction is zero at
    // baseline and stays zero, so the year must skip the PWL exactly instead
    // of overtaxing every forced dollar past the cap.
    const forcedOut = buildOptimizerModel({
      years: [
        year({
          year: 2027,
          peopleAged65Plus: 1,
          ordinaryIncomeBase: 50_000,
          rmdDivisor: 4,
          baselineRmd: 150_000,
        }),
      ],
      openingTrad: 600_000,
      openingInheritedTrad: 0,
      openingOther: 200_000,
      liquidationRate: 0.24,
      seniorDeduction: true,
    })
    expect(forcedOut.lp).not.toContain('srd')

    // Same year with a modest forced inherited distribution stays active.
    const inBand = buildOptimizerModel({
      years: [
        year({
          year: 2027,
          peopleAged65Plus: 1,
          ordinaryIncomeBase: 50_000,
          inheritedDistribution: 20_000,
          inheritedDistributionDivisor: 20,
        }),
      ],
      openingTrad: 200_000,
      openingInheritedTrad: 400_000,
      openingOther: 200_000,
      liquidationRate: 0.24,
      seniorDeduction: true,
    })
    expect(inBand.lp).toContain(' srd0:')
  })

  it('prices the phase-out spike: a conversion worth making blind to it is declined with it', async () => {
    // Single 65+ filer, baseline MAGI parked at the $75k phase-out start, all
    // income in the 22% band (ti well above $50,400 either way). Liquidation
    // rate 22.5% sits between the blind marginal rate (22%) and the phase-out
    // band's true marginal rate (22% × 1.06 = 23.32%): blind to the phase-out
    // every band dollar converted nets 0.5¢, with it every dollar loses 0.82¢.
    const fixtureYear = year({
      year: 2027,
      peopleAged65Plus: 1,
      ordinaryIncomeBase: RULE.magiPhaseOutStart.single,
    })
    const base = {
      years: [fixtureYear],
      openingTrad: 400_000,
      openingInheritedTrad: 0,
      openingOther: 200_000,
      liquidationRate: 0.225,
    }
    const blind = await optimizeSchedule(base)
    const priced = await optimizeSchedule({ ...base, seniorDeduction: true })
    expect(blind.status).toBe('optimal')
    expect(priced.status).toBe('optimal')
    // Blind solve converts through the 22% band (up to the IRMAA tier-1
    // threshold); the phase-out-aware solve declines the conversion.
    expect(blind.schedule[0]!.conversion).toBeGreaterThan(20_000)
    expect(priced.schedule[0]!.conversion).toBeLessThan(1_000)
  })
})

// IRC 151(d)(5)(C)(iii)(I) reduces "the $6,000 amount in clause (i)", and clause
// (i) allows that amount "for each qualified individual". The household total is
// n x max(0, 6,000 - 6% x excess), so it sheds 6% x n per dollar of modified AGI
// and reaches zero at 150,000 + 6,000/0.06 = 250,000 on a joint return however
// many qualified individuals the return carries. The LP models the claw-back as
// a floor variable, so its slope is what has to carry the n: at the bare 6% --
// the combined-base misreading -- the exhaustion point stretches to
// 150,000 + 2 x 6,000/0.06 = 350,000, and the solve prices a phase-out spike
// across a 100,000 band where the exact ledger has no deduction left to lose.
describeRule('irc-151-d-5-C-iii-I-senior-deduction-per-individual-phase-out', {
  readings: { reducedPerQualifiedIndividual: 250_000, reducedOnTheCombinedBase: 350_000 },
  accepted: 'reducedPerQualifiedIndividual',
  note: 'the slope the optimizer prices the clawback at',
}, ({ accepted, readings }) => {
  const RULE = PACK.federalTax.seniorDeduction!
  const RATE = RULE.phaseOutRatePct / 100
  /** Modified AGI at which `n` qualified individuals run out, under each reading. */
  const perIndividualExhaustion = RULE.magiPhaseOutStart.marriedFilingJointly + RULE.amountPerPerson / RATE
  const combinedBaseExhaustion = (n: number) =>
    RULE.magiPhaseOutStart.marriedFilingJointly + (RULE.amountPerPerson * n) / RATE

  const couple = (ordinaryIncomeBase: number) => ({
    years: [year({
      year: 2027,
      filingStatus: 'marriedFilingJointly' as FilingStatus,
      peopleAged65Plus: 2,
      ordinaryIncomeBase,
    })],
    openingTrad: 400_000,
    openingInheritedTrad: 0,
    openingOther: 200_000,
    liquidationRate: 0.24,
  })

  it('puts the two readings 100,000 dollars apart for a couple', () => {
    expect(perIndividualExhaustion).toBe(accepted)
    expect(combinedBaseExhaustion(2)).toBe(readings.reducedOnTheCombinedBase)
    // One qualified individual is where the readings agree, which is why a
    // one-person fixture cannot tell them apart.
    expect(combinedBaseExhaustion(1)).toBe(accepted)
  })

  it('skips a couple already past the per-individual exhaustion point', () => {
    // 300,000 sits between the readings: the exact ledger has nothing left to
    // claw back, while the combined-base model still believes the couple holds
    // 12,000 - 6% x 150,000 = 3,000. Skipping is exact, so the LP must be
    // byte-identical to the flag-off model.
    const past = couple(300_000)
    expect(past.years[0]!.ordinaryIncomeBase).toBeGreaterThan(accepted)
    expect(past.years[0]!.ordinaryIncomeBase).toBeLessThan(readings.reducedOnTheCombinedBase)

    const on = buildOptimizerModel({ ...past, seniorDeduction: true })
    expect(on.lp).not.toContain('srd')
    expect(on.lp).toBe(buildOptimizerModel(past).lp)
  })

  it('claws back 6% for each qualified individual, not 6% for the return', () => {
    // 200,000 is inside the band under either reading, so the fixture turns on
    // the slope rather than on whether the variable exists at all.
    const on = buildOptimizerModel({ ...couple(200_000), seniorDeduction: true })
    const srd = on.lp.split('\n').find((l) => l.includes(' srd0:'))!

    // Conversions enter modified AGI at their full taxable fraction (1 here),
    // so the conversion coefficient is the slope itself: 6% x 2 = 12%.
    expect(srd).toContain(`- ${2 * RATE} conv0`)
    expect(srd).not.toContain(`- ${RATE} conv0`)
    // ... and the constant side is that same slope on the baseline excess.
    expect(srd).toContain(String(2 * RATE * (200_000 - RULE.magiPhaseOutStart.marriedFilingJointly)))
  })
})

describe('committed retirement-action movement in the LP', () => {
  /** Growth 0 keeps the recursion right-hand sides readable: RHS = inflow + movement. */
  const acted = (): OptimizerInput => ({
    years: [year({
      growth: 0,
      spendingNeed: 10_000,
      exogenousCash: 1_000,
      tradInflow: 1_000,
      otherInflow: 500,
      taxableInflow: 200,
      committedActionMovement: {
        trad: -3_000,
        inheritedTrad: -1_000,
        other: -500,
        taxable: -2_000,
        proceeds: 6_500,
      },
    })],
    openingTrad: 100_000,
    openingInheritedTrad: 50_000,
    openingOther: 20_000,
    openingTaxable: 30_000,
    liquidationRate: 0.25,
  })

  it('debits every bucket the executor touched and credits the cash it delivered', () => {
    const lp = buildOptimizerModel(acted()).lp

    // Movement rides the same constant right-hand side as an inflow, so the
    // solver cannot re-decide dollars the exact ledger has already moved.
    expect(lp).toContain(' trad0: + 1 trad1 - 1 trad0 + 1 conv0 + 1 wt0 = -2000')
    expect(lp).toContain(' inh0: + 1 inh1 - 1 inh0 + 1 wi0 = -1000')
    expect(lp).toContain(' other0: + 1 other1 - 1 other0 - 1 conv0 + 1 wo0 - 1 save0 = -200')
    expect(lp).toContain(' taxable0: + 1 taxable1 - 1 taxable0 + 1 wtax0 = -1800')
    // spendingNeed 10,000 less 1,000 exogenous less 6,500 of action proceeds.
    expect(lp).toMatch(/^ cash0: .* = 2500$/m)
  })

  it('emits the identical LP when no action committed anything', () => {
    const withoutMovement = { ...acted().years[0]! }
    delete withoutMovement.committedActionMovement

    expect(buildOptimizerModel({ ...acted(), years: [withoutMovement] }).lp).toBe(
      buildOptimizerModel({
        ...acted(),
        years: [{ ...withoutMovement, committedActionMovement: undefined }],
      }).lp,
    )
  })

  it('materializes the taxable bucket when only committed movement touches it', () => {
    const lp = buildOptimizerModel({
      years: [year({
        growth: 0,
        committedActionMovement: { trad: 0, inheritedTrad: 0, other: 0, taxable: -1_000, proceeds: 1_000 },
      })],
      openingTrad: 100_000,
      openingInheritedTrad: 0,
      openingOther: 0,
      liquidationRate: 0.25,
    }).lp

    // Without this the debit would have no bucket to land in and would be
    // silently dropped — the solver would keep dollars the ledger already
    // moved. Materialized, the model instead says what is true: a bucket with
    // nothing in it cannot fund a $1,000 debit, and the LP is infeasible.
    expect(lp).toContain(' taxable0: + 1 taxable1 - 1 taxable0 + 1 wtax0 = -1000')
    expect(lp).toContain(' taxable0 = 0')
  })

  it('carries the committed debit through the solve rather than optimizing it away', async () => {
    const base: OptimizerInput = {
      years: [year({ growth: 0, spendingNeed: 0 })],
      openingTrad: 0,
      openingInheritedTrad: 0,
      openingOther: 10_000,
      openingTaxable: 100_000,
      // A real gain fraction, so a taxable draw is strictly worse than
      // leaving the bucket alone and the untouched solve has no tie to break.
      taxableBasisRatio: 0.5,
      ltcgRate: 0.15,
      liquidationRate: 0,
    }
    const committed: OptimizerInput = {
      ...base,
      years: [{
        ...base.years[0]!,
        committedActionMovement: {
          trad: 0,
          inheritedTrad: 0,
          other: 0,
          taxable: -40_000,
          proceeds: 40_000,
        },
      }],
    }

    const untouched = await optimizeSchedule(base)
    const acted = await optimizeSchedule(committed)

    // The objective rewards keeping the taxable bucket whole, so a solver free
    // to ignore the movement would end the year at 100,000. It is not free.
    expect(untouched.schedule[0]!.endTaxable).toBeCloseTo(100_000, 2)
    expect(acted.schedule[0]!.endTaxable).toBeCloseTo(60_000, 2)
    // The proceeds are not destroyed: they route through `save` into the
    // tax-free bucket, exactly as the exact ledger's surplus does.
    expect(acted.schedule[0]!.endOther).toBeCloseTo(50_000, 2)
  })
})

describe('exogenous strategy movement in the LP', () => {
  /** Growth 0 keeps the recursion right-hand sides readable: RHS = inflow + movement. */
  const gifted = (): OptimizerInput => ({
    years: [year({
      growth: 0,
      tradInflow: 1_000,
      exogenousStrategyMovement: {
        trad: -3_000, inheritedTrad: 0, other: 0, taxable: 0, proceeds: 0,
      },
    })],
    openingTrad: 100_000,
    openingInheritedTrad: 50_000,
    openingOther: 20_000,
    liquidationRate: 0.25,
  })

  it('debits the bucket the strategy gave from, with no cash credit', () => {
    const lp = buildOptimizerModel(gifted()).lp

    // The debit rides the same constant right-hand side as an inflow: 1,000 in,
    // 3,000 given away. The solver cannot re-decide a gift already made.
    expect(lp).toContain(' trad0: + 1 trad1 - 1 trad0 + 1 conv0 + 1 wt0 = -2000')
    // And no proceeds. A committed WITHDRAWAL reallocates, so its debit is
    // paired with cash; a gift leaves, so the cash constraint is untouched.
    expect(lp).toMatch(/^ cash0: .* = 0$/m)
  })

  it('credits the cash a 72(t) series delivered, unlike a gift', () => {
    const series = buildOptimizerModel({
      ...gifted(),
      years: [{
        ...gifted().years[0]!,
        spendingNeed: 10_000,
        exogenousStrategyMovement: {
          trad: -3_000, inheritedTrad: 0, other: 0, taxable: 0, proceeds: 3_000,
        },
      }],
    }).lp

    // Same debit, opposite cash story. A series payment REALLOCATES — the exact
    // ledger's `baseCashInflows` carries `+ seppTotal` — so debiting it without
    // this credit would make the solver poorer than the household every year.
    expect(series).toContain(' trad0: + 1 trad1 - 1 trad0 + 1 conv0 + 1 wt0 = -2000')
    expect(series).toMatch(/^ cash0: .* = 7000$/m)
  })

  it('sums with committed action movement rather than replacing it', () => {
    const both = buildOptimizerModel({
      ...gifted(),
      years: [{
        ...gifted().years[0]!,
        committedActionMovement: {
          trad: -5_000,
          inheritedTrad: 0,
          other: 0,
          taxable: 0,
          proceeds: 5_000,
        },
      }],
    }).lp

    // Both authorities moved the same bucket in the same year, and the
    // recursion books both: 1,000 inflow − 5,000 withdrawn − 3,000 given.
    expect(both).toContain(' trad0: + 1 trad1 - 1 trad0 + 1 conv0 + 1 wt0 = -7000')
    // Only the withdrawal delivered cash.
    expect(both).toMatch(/^ cash0: .* = -5000$/m)
  })

  it('emits the identical LP when no strategy moved anything', () => {
    const withoutMovement = { ...gifted().years[0]! }
    delete withoutMovement.exogenousStrategyMovement

    expect(buildOptimizerModel({ ...gifted(), years: [withoutMovement] }).lp).toBe(
      buildOptimizerModel({
        ...gifted(),
        years: [{ ...withoutMovement, exogenousStrategyMovement: undefined }],
      }).lp,
    )
  })

  it('materializes the taxable bucket when only strategy movement touches it', () => {
    // No producer routes a gift to this bucket today. The guard exists because
    // a dropped debit is silent, and silence is exactly what a future producer
    // would inherit.
    const lp = buildOptimizerModel({
      years: [year({
        growth: 0,
        exogenousStrategyMovement: {
          trad: 0, inheritedTrad: 0, other: 0, taxable: -1_000, proceeds: 0,
        },
      })],
      openingTrad: 100_000,
      openingInheritedTrad: 0,
      openingOther: 0,
      liquidationRate: 0.25,
    }).lp

    expect(lp).toContain(' taxable0: + 1 taxable1 - 1 taxable0 + 1 wtax0 = -1000')
    expect(lp).toContain(' taxable0 = 0')
  })
})

describe('committed ordinary income as a floor in the LP', () => {
  /** The right-hand-side constant of a named constraint. */
  function rhs(lp: string, name: string): number {
    const line = lp.split('\n').find((row) => row.startsWith(` ${name}:`))
    if (line === undefined) throw new Error(`LP has no ${name} constraint`)
    const parsed = /(?:>=|<=|=) (-?[\d.]+)$/.exec(line)
    if (parsed === null) throw new Error(`Cannot read a right-hand side from "${line}"`)
    return Number(parsed[1])
  }

  const COMMITTED = 20_000
  const base = (over: Partial<OptimizerYear> = {}): OptimizerInput => ({
    // 2027 so the OBBBA senior deduction is still applicable (the pack's rule
    // runs through 2028) and its phase-out floor is actually emitted.
    years: [year({
      year: 2027,
      growth: 0,
      peopleAged65Plus: 1,
      ordinaryIncomeBase: 10_000,
      acaMagiMax: 60_000,
      ssTaxability: { ssBenefits: 30_000, taxableSsBase: 0 },
      ...over,
    })],
    openingTrad: 400_000,
    openingInheritedTrad: 0,
    openingOther: 100_000,
    seniorDeduction: true,
    liquidationRate: 0.25,
  })

  it('raises the bracket floor by the committed amount and nothing else', () => {
    const without = buildOptimizerModel(base()).lp
    const withCommitted = buildOptimizerModel(base({ committedOrdinaryIncome: COMMITTED })).lp

    // The floor. `ti0 − conv0 − wt0 − wi0 − taxss0 (− srd0) >= constant`: the
    // committed income is on the constant side, so no decision variable can
    // reduce it, and the solver's own dollars are priced by the ascending
    // bracket segments ABOVE it. That is the whole of the floor semantics —
    // inherited from how `ordinaryIncomeBase` was already priced, not rebuilt.
    expect(rhs(withCommitted, 'tifloor0') - rhs(without, 'tifloor0')).toBeCloseTo(COMMITTED, 6)
    // Coefficients untouched: only the constant moved.
    const floorTerms = (lp: string) =>
      lp.split('\n').find((row) => row.startsWith(' tifloor0:'))!.replace(/>= -?[\d.]+$/, '')
    expect(floorTerms(withCommitted)).toBe(floorTerms(without))
  })

  it('flows into every side channel the ordinary base already feeds', () => {
    const without = buildOptimizerModel(base()).lp
    const withCommitted = buildOptimizerModel(base({ committedOrdinaryIncome: COMMITTED })).lp

    // IRMAA / ACA MAGI. The exact ledger counts a committed conversion in MAGI,
    // so a solve that left it out would read tier-safe and ACA-safe in-solve
    // while the ledger charged the surcharge and clawed back the credit. Both
    // ceilings tighten by exactly the committed amount.
    expect(rhs(without, 'acamagi0') - rhs(withCommitted, 'acamagi0')).toBeCloseTo(COMMITTED, 6)
    expect(rhs(without, 'irmaa0_0') - rhs(withCommitted, 'irmaa0_0')).toBeCloseTo(COMMITTED, 6)

    // Taxable-SS phase-in. Provisional income rises by the committed amount, so
    // the 50% piece's constant rises by half of it and the 85% piece's by 0.85
    // — the marginal torpedo the household is already standing in.
    expect(rhs(withCommitted, 'taxss0a') - rhs(without, 'taxss0a')).toBeCloseTo(0.5 * COMMITTED, 6)
    expect(rhs(withCommitted, 'taxss0b') - rhs(without, 'taxss0b')).toBeCloseTo(0.85 * COMMITTED, 6)

    // Senior-deduction phase-out. Its floor is `srd ≥ rate·(MAGI − start)`, and
    // the committed income is part of that MAGI.
    const srdRule = PACK.federalTax.seniorDeduction!
    const srdRate = srdRule.phaseOutRatePct / 100
    expect(rhs(withCommitted, 'srd0') - rhs(without, 'srd0')).toBeCloseTo(srdRate * COMMITTED, 6)
  })

  it('emits the identical LP at zero, absent, or negative', () => {
    const absent = buildOptimizerModel(base()).lp

    expect(buildOptimizerModel(base({ committedOrdinaryIncome: 0 })).lp).toBe(absent)
    // Clamped rather than trusted. A negative would be a deduction, and the LP
    // has no authority to grant one off a probe field.
    expect(buildOptimizerModel(base({ committedOrdinaryIncome: -5_000 })).lp).toBe(absent)
  })

  it('takes the forced-distribution exclusion back off the same constant', () => {
    const EXCLUSION = 12_000
    const without = buildOptimizerModel(base()).lp
    const excluded = buildOptimizerModel(
      base({ forcedDistributionOrdinaryIncomeExclusion: EXCLUSION }),
    ).lp

    // The mirror of the committed floor, and deliberately on the same constant.
    // The LP charges `traditionalWithdrawalTaxableFraction × wt` on the forced
    // distribution it re-decides; §408(d)(8) takes the gifted part back out, and
    // `ordinaryIncomeBase` cannot carry it because that field is what remains
    // AFTER the forced distributions are netted out at their gross figure.
    expect(rhs(without, 'tifloor0') - rhs(excluded, 'tifloor0')).toBeCloseTo(EXCLUSION, 6)
    const floorTerms = (lp: string) =>
      lp.split('\n').find((row) => row.startsWith(' tifloor0:'))!.replace(/>= -?[\d.]+$/, '')
    expect(floorTerms(excluded)).toBe(floorTerms(without))

    // And out of MAGI with it, which is most of what a QCD is for: an excluded
    // distribution is out of gross income, so it never reaches IRMAA, the ACA
    // ceiling, provisional income, or the senior-deduction phase-out.
    expect(rhs(excluded, 'acamagi0') - rhs(without, 'acamagi0')).toBeCloseTo(EXCLUSION, 6)
    expect(rhs(excluded, 'irmaa0_0') - rhs(without, 'irmaa0_0')).toBeCloseTo(EXCLUSION, 6)
    expect(rhs(without, 'taxss0a') - rhs(excluded, 'taxss0a')).toBeCloseTo(0.5 * EXCLUSION, 6)
    expect(rhs(without, 'taxss0b') - rhs(excluded, 'taxss0b')).toBeCloseTo(0.85 * EXCLUSION, 6)
    const srdRule = PACK.federalTax.seniorDeduction!
    expect(rhs(without, 'srd0') - rhs(excluded, 'srd0'))
      .toBeCloseTo((srdRule.phaseOutRatePct / 100) * EXCLUSION, 6)
  })

  it('nets the two terms against each other on the one constant', () => {
    // A year can carry both — a committed conversion and a gift routed out of
    // the same year's RMD. They are opposite signs on one constant, so the
    // bracket model sees the net and neither term has its own pricing path to
    // disagree from.
    const netted = buildOptimizerModel(base({
      committedOrdinaryIncome: 30_000,
      forcedDistributionOrdinaryIncomeExclusion: 12_000,
    })).lp
    const equivalent = buildOptimizerModel(base({ committedOrdinaryIncome: 18_000 })).lp

    expect(rhs(netted, 'tifloor0')).toBeCloseTo(rhs(equivalent, 'tifloor0'), 6)
    expect(rhs(netted, 'acamagi0')).toBeCloseTo(rhs(equivalent, 'acamagi0'), 6)
  })

  it('emits the identical LP for an exclusion at zero, absent, or negative', () => {
    const absent = buildOptimizerModel(base()).lp

    expect(buildOptimizerModel(base({ forcedDistributionOrdinaryIncomeExclusion: 0 })).lp)
      .toBe(absent)
    // Clamped rather than trusted, for the mirror-image reason the committed
    // floor is: a negative exclusion would be income the LP has no authority to
    // invent off a probe field.
    expect(buildOptimizerModel(base({ forcedDistributionOrdinaryIncomeExclusion: -5_000 })).lp)
      .toBe(absent)
  })

  it('is not a variable the solver can convert instead of', async () => {
    // One year, no spending, a 25% heir haircut: the solver converts while the
    // bracket is cheap and stops when it is not. The committed floor eats the
    // cheap bands, so what it proposes on top is the REMAINING room — the same
    // total, not the same proposal.
    const solo = (committedOrdinaryIncome: number): OptimizerInput => ({
      years: [year({ growth: 0, committedOrdinaryIncome })],
      openingTrad: 500_000,
      openingInheritedTrad: 0,
      openingOther: 50_000,
      liquidationRate: 0.25,
    })

    const empty = await optimizeSchedule(solo(0))
    const floored = await optimizeSchedule(solo(COMMITTED))
    const target = empty.conversions[0]!.amount

    expect(target).toBeGreaterThan(COMMITTED)
    expect((floored.conversions[0]?.amount ?? 0) + COMMITTED).toBeCloseTo(target, 2)
  })
})

describe('IRMAA two-year lookback in the solve (Step 4)', () => {
  it('drives each premium year off year (t−2) MAGI and omits the first two years', () => {
    const y = year({ peopleAged65Plus: 1 })
    const tiers = PACK.medicare.irmaaTiers.length
    const base = { years: [y, y, y], openingTrad: 500_000, openingInheritedTrad: 0, openingOther: 500_000, liquidationRate: 0.5 }

    const lookback = buildOptimizerModel({ ...base, irmaaLookback: true })
    // Only the third year (t=2) has an in-horizon source (year 0); years 0 and 1
    // carry exogenous premiums, so no binary is modeled for them.
    expect(lookback.binaryCount).toBe(tiers)
    expect(lookback.lp).toContain(' irmaa2_0:')
    expect(lookback.lp).not.toContain(' irmaa0_0:')
    expect(lookback.lp).not.toContain(' irmaa1_0:')
    // Year 2's premium binary is triggered by year 0's MAGI (conv0), not conv2.
    const line = lookback.lp.split('\n').find((l) => l.includes(' irmaa2_0:'))!
    expect(line).toContain('conv0')
    expect(line).not.toContain('conv2')

    // Default same-year model: year 0's own MAGI drives year 0's premium.
    const sameYear = buildOptimizerModel(base)
    expect(sameYear.binaryCount).toBe(3 * tiers)
    expect(sameYear.lp).toContain(' irmaa0_0:')
    expect(sameYear.lp.split('\n').find((l) => l.includes(' irmaa0_0:'))!).toContain('conv0')
  })

  it('shifts an SSA-44 premium year onto year (t−1) MAGI', () => {
    const y = year({ peopleAged65Plus: 1 })
    const m = buildOptimizerModel({
      years: [y, y, { ...y, ssa44Redetermination: true }],
      openingTrad: 500_000,
      openingInheritedTrad: 0,
      openingOther: 500_000,
      liquidationRate: 0.5,
      irmaaLookback: true,
    })
    // Year 2's premium binary is now triggered by year 1's MAGI (conv1) — the
    // in-solve stand-in for the ledger's min(t−2, t−1) redetermination.
    expect(m.binaryCount).toBe(PACK.medicare.irmaaTiers.length)
    const line = m.lp.split('\n').find((l) => l.includes(' irmaa2_0:'))!
    expect(line).toContain('conv1')
    expect(line).not.toContain('conv0')
    expect(line).not.toContain('conv2')
  })

  it('prices the SSA-44 estimate-year conversion into the premium (the solve sees the relief)', async () => {
    // Two years under the lookback: neither has an in-horizon (t−2) MAGI
    // source, so the unflagged solve fills the 22% bracket premium-free and
    // sails past the tier-1 threshold. Flagging year 1 as an SSA-44 year makes
    // year 0's conversion the premium trigger: the last ~$9k above the
    // threshold gains only (24% haircut − 22% bracket) ≈ $180 but costs the
    // ~$1.1k tier-1 surcharge, so the aware solve stops at the threshold.
    // Year 1's own income is set punitively high so conversions cannot simply
    // migrate there.
    const y0 = year({ peopleAged65Plus: 1 })
    const y1 = year({ peopleAged65Plus: 1, ordinaryIncomeBase: 500_000 })
    const base = {
      openingTrad: 500_000,
      openingInheritedTrad: 0,
      openingOther: 500_000,
      liquidationRate: 0.24,
      irmaaLookback: true,
    }
    const threshold = PACK.medicare.irmaaTiers[0]!.magiOver.single
    const blind = await optimizeSchedule({ ...base, years: [y0, y1] })
    const aware = await optimizeSchedule({ ...base, years: [y0, { ...y1, ssa44Redetermination: true }] })
    expect(blind.status).toBe('optimal')
    expect(aware.status).toBe('optimal')
    expect(blind.schedule[0]!.conversion).toBeGreaterThan(threshold)
    expect(aware.schedule[0]!.conversion).toBeLessThanOrEqual(threshold + 1)
    expect(aware.schedule[1]!.irmaaTier).toBe(0)
  })
})

describe('hand-computed economic optima', () => {
  it('drains traditional when the terminal haircut exceeds every bracket', async () => {
    // 1 year, no growth/spending/income. Converting moves trad -> Roth and incurs
    // only federal tax (<37%). With a 50% haircut, marginal value of converting is
    // 0.5 − marginalRate > 0 at every bracket, so the optimum converts ALL of it.
    const sol = await optimizeSchedule({
      years: [year({ peopleAged65Plus: 0 })],
      openingTrad: 100_000,
      openingInheritedTrad: 0,
      openingOther: 100_000,
      liquidationRate: 0.5,
    })
    expect(sol.status).toBe('optimal')
    expect(sol.schedule[0]!.conversion).toBeCloseTo(100_000, 0)
    expect(sol.schedule[0]!.endTrad).toBeCloseTo(0, 0)
  })

  it('converts nothing when there is no haircut to arbitrage', async () => {
    // With liquidationRate 0, traditional and "other" are valued equally at the
    // end, so a TAXED conversion only burns tax for no gain. Base income is set
    // above the standard deduction so every converted dollar is taxed (otherwise
    // filling the deduction is genuinely free and worth doing) -> optimum is 0.
    const sol = await optimizeSchedule({
      years: [year({ ordinaryIncomeBase: 50_000 })],
      openingTrad: 100_000,
      openingInheritedTrad: 0,
      openingOther: 100_000,
      liquidationRate: 0,
    })
    expect(sol.status).toBe('optimal')
    expect(sol.schedule[0]!.conversion).toBeCloseTo(0, 0)
  })

  it('forces at least the RMD floor out of traditional', async () => {
    // divisor 25 on a $100k opening traditional => $4,000 forced taxable draw.
    const sol = await optimizeSchedule({
      years: [year({ rmdDivisor: 25 })],
      openingTrad: 100_000,
      openingInheritedTrad: 0,
      openingOther: 100_000,
      liquidationRate: 0, // no conversion incentive, so wt is driven only by the floor
    })
    expect(sol.status).toBe('optimal')
    expect(sol.schedule[0]!.withdrawTraditional).toBeGreaterThanOrEqual(4_000 - 1)
  })

  it('can fund spending from inherited traditional assets without conversions', async () => {
    const sol = await optimizeSchedule({
      years: [year({ spendingNeed: 20_000 })],
      openingTrad: 0,
      openingInheritedTrad: 100_000,
      openingOther: 0,
      liquidationRate: 0,
    })

    expect(sol.status).toBe('optimal')
    expect(sol.conversions).toEqual([])
    expect(sol.schedule[0]!.conversion).toBe(0)
    expect(sol.schedule[0]!.withdrawInheritedTraditional).toBeGreaterThanOrEqual(20_000)
  })

  it('keeps income under the first IRMAA tier when income is modest', async () => {
    const sol = await optimizeSchedule({
      years: [year({ peopleAged65Plus: 1 })],
      openingTrad: 100_000,
      openingInheritedTrad: 0,
      openingOther: 100_000,
      liquidationRate: 0.24,
    })
    expect(sol.status).toBe('optimal')
    // First-tier threshold is well above a tax-efficient conversion, so no tier.
    expect(sol.schedule[0]!.irmaaTier).toBe(0)
  })

  it('intentionally crosses an IRMAA tier when the terminal haircut dominates the surcharge', async () => {
    const sol = await optimizeSchedule({
      years: [year({ peopleAged65Plus: 1 })],
      openingTrad: 500_000,
      openingInheritedTrad: 0,
      openingOther: 500_000,
      liquidationRate: 0.5,
    })
    expect(sol.status).toBe('optimal')
    expect(sol.schedule[0]!.conversion).toBeGreaterThan(PACK.medicare.irmaaTiers[0]!.magiOver.single)
    expect(sol.schedule[0]!.irmaaTier).toBeGreaterThan(0)
  })

  it('reports infeasible when required spending cannot be funded by any bucket', async () => {
    const sol = await optimizeSchedule({
      years: [year({ spendingNeed: 100_000 })],
      openingTrad: 0,
      openingInheritedTrad: 0,
      openingOther: 0,
      liquidationRate: 0,
    })
    expect(sol.status).toBe('infeasible')
    expect(sol.conversions).toEqual([])
  })

  it('treats scheduled contribution inflows as bucket assets, not vanished cash', async () => {
    // Working year: 80k wages cover 60k of cash uses (10k expenses + a 50k
    // contribution that lands in traditional). Retirement year: 60k spending
    // must come from the contributed dollars — feasible only if the LP's
    // traditional bucket actually received them.
    const workingYear = year({ year: 2030, spendingNeed: 60_000, exogenousCash: 80_000, tradInflow: 50_000 })
    const retiredYear = year({ year: 2031, spendingNeed: 60_000 })
    const base = {
      openingTrad: 0,
      openingInheritedTrad: 0,
      openingOther: 5_000,
      liquidationRate: 0.25,
    }

    const withInflow = await optimizeSchedule({ ...base, years: [workingYear, retiredYear] })
    expect(withInflow.status).toBe('optimal')
    // The retirement year draws on the contributed traditional dollars.
    expect(withInflow.schedule[1]!.withdrawTraditional + withInflow.schedule[1]!.conversion).toBeGreaterThan(0)

    // Control: the identical plan minus the inflow is genuinely unfundable, so
    // the feasibility above is attributable to the inflow, not slack elsewhere.
    const withoutInflow = await optimizeSchedule({
      ...base,
      years: [year({ year: 2030, spendingNeed: 60_000, exogenousCash: 80_000 }), retiredYear],
    })
    expect(withoutInflow.status).toBe('infeasible')
  })

  it('reports timeout without inventing conversions when the solver has no incumbent', async () => {
    const sol = await optimizeSchedule({
      years: [year()],
      openingTrad: 100_000,
      openingInheritedTrad: 0,
      openingOther: 100_000,
      liquidationRate: 0.24,
      options: {
        solve: () => ({ Status: 'Time limit reached' }),
      },
    })

    expect(sol.status).toBe('timeout')
    expect(sol.endingAfterTax).toBe(0)
    expect(sol.conversions).toEqual([])
    expect(sol.schedule).toHaveLength(1)
    expect(sol.schedule[0]!.conversion).toBe(0)
    expect(sol.schedule[0]!.withdrawTraditional).toBe(0)
  })
})

describe('multi-year value', () => {
  it('does at least as well with conversions allowed as when they are forbidden', async () => {
    const years = [year({ year: 2030 }), year({ year: 2031 }), year({ year: 2032, rmdDivisor: 24 })]
    const base = { years, openingTrad: 500_000, openingInheritedTrad: 0, openingOther: 200_000, liquidationRate: 0.24 }
    const free = await optimizeSchedule(base)
    const forbidden = await optimizeSchedule({ ...base, options: { maxConversionPerYear: 0 } })
    expect(free.status).toBe('optimal')
    expect(forbidden.status).toBe('optimal')
    expect(free.endingAfterTax).toBeGreaterThanOrEqual(forbidden.endingAfterTax - 1)
    // The lever should actually be used here (haircut 24% beats the low brackets).
    expect(free.conversions.reduce((a, c) => a + c.amount, 0)).toBeGreaterThan(0)
  })
})

// --- simulate wiring cross-check -------------------------------------------

let counter = 0
const testIds = () => `opt-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

function planWithConversions(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1958-06-15', // already retired, RMD-age within horizon
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 80, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  const trad: Account = { type: 'traditional', id: testIds(), name: '401k', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 400_000, annualContribution: 0 }
  const roth: Account = { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 }
  const cash: Account = { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 100_000, annualContribution: 0 }
  plan.accounts = [trad, roth, cash]
  return plan
}

function validate(plan: Plan): Plan {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

describe('simulate consumes the optimized schedule', () => {
  const conversions = [
    { year: 2027, amount: 20_000 },
    { year: 2028, amount: 15_000 },
  ]
  const noTax = createFlatTaxCalculator(0)

  it('treats `optimized` identically to `manual`', () => {
    const manual = planWithConversions()
    manual.strategies.rothConversion = { mode: 'manual', conversions }
    const optimized = planWithConversions()
    optimized.strategies.rothConversion = { mode: 'optimized', conversions, optimizedAtIso: '2026-06-17T00:00:00.000Z' }

    const a = simulatePlan(validate(manual), { startYear: 2026, taxCalculator: noTax })
    const b = simulatePlan(validate(optimized), { startYear: 2026, taxCalculator: noTax })

    expect(b.endingNetWorth).toBeCloseTo(a.endingNetWorth, 2)
    const convA = a.years.reduce((s, y) => s + y.rothConversion, 0)
    const convB = b.years.reduce((s, y) => s + y.rothConversion, 0)
    expect(convB).toBeCloseTo(convA, 2)
    expect(convB).toBeCloseTo(35_000, 2)
  })
})
