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
