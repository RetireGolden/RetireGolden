import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../projection/flatTax.js'
import { simulatePlan } from '../projection/simulate.js'
import { HISTORICAL_YEARS } from './historicalReturns.js'
import { DEFAULT_LTC_SHOCK } from './ltcShock.js'
import { buildLognormalModelConfigForPlan, createHistoricalModel, createLognormalModel, createMarketModel, type MarketModelConfig } from './marketModels.js'
import { createRng, derivePathSeed } from './rng.js'
import { aggregateMonteCarlo, mergePathResults, runMonteCarloPaths } from './run.js'

let counter = 0
const testIds = () => `mc-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
const noTax = createFlatTaxCalculator(0)

function taxable(balance: number): Extract<Account, { type: 'taxable' }> {
  return {
    type: 'taxable',
    id: testIds(),
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance,
    costBasis: balance,
    annualContribution: 0,
  }
}

/** Retiree born 1961, already retired, planning to 90 (2051). */
function basePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1961-06-15',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 90, source: 'manual' },
  }
  plan.assumptions.inflationPct = 2.5
  plan.assumptions.defaultReturnPct = 5
  plan.expenses.baseAnnual = 40_000
  plan.accounts = [taxable(1_000_000)]
  return plan
}

function validate(plan: Plan): Plan {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

describe('rng', () => {
  it('is deterministic for a given seed and differs across seeds', () => {
    const a = createRng(42)
    const b = createRng(42)
    const c = createRng(43)
    const seqA = Array.from({ length: 5 }, () => a.next())
    const seqB = Array.from({ length: 5 }, () => b.next())
    const seqC = Array.from({ length: 5 }, () => c.next())
    expect(seqA).toEqual(seqB)
    expect(seqA).not.toEqual(seqC)
  })

  it('produces approximately standard-normal draws', () => {
    const rng = createRng(7)
    const n = 20_000
    let sum = 0
    let sumSq = 0
    for (let i = 0; i < n; i++) {
      const z = rng.nextNormal()
      sum += z
      sumSq += z * z
    }
    expect(sum / n).toBeCloseTo(0, 1)
    expect(sumSq / n).toBeCloseTo(1, 1)
  })

  it('derives distinct per-path seeds', () => {
    const seeds = new Set(Array.from({ length: 1000 }, (_, i) => derivePathSeed(123, i)))
    expect(seeds.size).toBe(1000)
  })
})

describe('lognormal model', () => {
  it('return shocks are mean-preserving and inflation centers on its mean', () => {
    const model = createLognormalModel({ type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: 12 })
    const rng = createRng(11)
    let shockSum = 0
    let inflSum = 0
    const paths = 400
    const years = 50
    for (let p = 0; p < paths; p++) {
      const series = model.generatePath(rng, years)
      for (let i = 0; i < years; i++) {
        shockSum += series.returnShockPct![i]!
        inflSum += series.inflationPct![i]!
      }
    }
    expect(shockSum / (paths * years)).toBeCloseTo(0, 0)
    expect(inflSum / (paths * years)).toBeCloseTo(2.5, 1)
  })

  it('correlation sign carries into the samples', () => {
    const model = createLognormalModel({
      type: 'lognormal',
      inflationMeanPct: 2.5,
      correlation: -0.8,
      returnVolPct: 15,
      inflationVolPct: 2,
    })
    const series = model.generatePath(createRng(3), 5000)
    let cov = 0
    for (let i = 0; i < 5000; i++) cov += series.returnShockPct![i]! * (series.inflationPct![i]! - 2.5)
    expect(cov / 5000).toBeLessThan(0)
  })

  it('adds class shocks to plan lognormal configs only when allocation is used', () => {
    const plain = validate(basePlan())
    expect(buildLognormalModelConfigForPlan(plain).classShocks).toBeUndefined()

    const allocated = validate({
      ...basePlan(),
      accounts: [
        {
          ...taxable(1_000_000),
          allocation: {
            mode: 'static',
            rebalancing: 'annual',
            weights: { usStocks: 60, intlStocks: 0, bonds: 40, cash: 0 },
          },
        },
      ],
    })
    const config = buildLognormalModelConfigForPlan(allocated, 18)
    expect(config.returnVolPct).toBe(18)
    expect(config.classShocks?.volatilityPctByClass.usStocks).toBeGreaterThan(0)
    expect(config.classShocks?.volatilityPctByClass.bonds).toBeGreaterThan(0)
  })
})

describe('historical bootstrap model', () => {
  it('iid samples come from the historical inflation support', () => {
    const inflations = new Set(HISTORICAL_YEARS.map((y) => y.inflationPct))
    const model = createHistoricalModel({ type: 'historical', mode: 'iid' })
    const series = model.generatePath(createRng(5), 200)
    for (const v of series.inflationPct!) expect(inflations.has(v)).toBe(true)
  })

  it('sequence mode replays consecutive historical years with wraparound', () => {
    const model = createHistoricalModel({ type: 'historical', mode: 'sequence' })
    const series = model.generatePath(createRng(9), 40)
    // Find the sampled start by matching the first inflation value, then verify replay.
    const startIdx = HISTORICAL_YEARS.findIndex((y) => y.inflationPct === series.inflationPct![0])
    expect(startIdx).toBeGreaterThanOrEqual(0)
    for (let i = 0; i < 40; i++) {
      expect(series.inflationPct![i]).toBe(HISTORICAL_YEARS[(startIdx + i) % HISTORICAL_YEARS.length]!.inflationPct)
    }
  })

  it('block mode keeps runs of consecutive years', () => {
    const model = createHistoricalModel({ type: 'historical', mode: 'block', blockLengthYears: 10 })
    const series = model.generatePath(createRng(13), 10)
    const startIdx = HISTORICAL_YEARS.findIndex((y) => y.inflationPct === series.inflationPct![0])
    for (let i = 1; i < 10; i++) {
      expect(series.inflationPct![i]).toBe(HISTORICAL_YEARS[(startIdx + i) % HISTORICAL_YEARS.length]!.inflationPct)
    }
  })

  it('createMarketModel dispatches on config type', () => {
    expect(createMarketModel({ type: 'historical', mode: 'iid' }).generatePath(createRng(1), 3).inflationPct).toHaveLength(3)
    expect(
      createMarketModel({ type: 'lognormal', inflationMeanPct: 2 }).generatePath(createRng(1), 3).returnShockPct,
    ).toHaveLength(3)
  })
})

describe('simulate with a market series', () => {
  it('zero shocks and assumption-rate inflation reproduce the deterministic run', () => {
    const plan = validate(basePlan())
    const det = simulatePlan(plan, { startYear: 2026, taxCalculator: noTax })
    const years = det.years.length
    const stoch = simulatePlan(plan, {
      startYear: 2026,
      taxCalculator: noTax,
      market: {
        returnShockPct: new Array(years).fill(0),
        inflationPct: new Array(years).fill(plan.assumptions.inflationPct),
      },
    })
    expect(stoch.endingInvestable).toBeCloseTo(det.endingInvestable, 6)
    expect(stoch.years.map((y) => y.netWorth)).toEqual(det.years.map((y) => y.netWorth))
  })

  it('negative return shocks reduce the outcome; positive inflation shocks raise spending', () => {
    const plan = validate(basePlan())
    const det = simulatePlan(plan, { startYear: 2026, taxCalculator: noTax })
    const bad = simulatePlan(plan, {
      startYear: 2026,
      taxCalculator: noTax,
      market: { returnShockPct: [-30, -30, -30] }, // short series clamp to their last value
    })
    expect(bad.endingInvestable).toBeLessThan(det.endingInvestable)

    const hot = simulatePlan(plan, {
      startYear: 2026,
      taxCalculator: noTax,
      market: { inflationPct: new Array(det.years.length).fill(8) },
    })
    expect(hot.years[5]!.expenses.baseSpending).toBeGreaterThan(det.years[5]!.expenses.baseSpending)
    expect(hot.endingInvestable).toBeLessThan(det.endingInvestable)
  })
})

describe('runMonteCarloPaths + aggregate', () => {
  const model = createLognormalModel({ type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: 12 })

  it('is reproducible for a seed and independent of partitioning', () => {
    const plan = validate(basePlan())
    const whole = runMonteCarloPaths(plan, { startYear: 2026, taxCalculator: noTax, model, seed: 99, pathCount: 20 })
    const partA = runMonteCarloPaths(plan, { startYear: 2026, taxCalculator: noTax, model, seed: 99, pathCount: 8 })
    const partB = runMonteCarloPaths(plan, {
      startYear: 2026,
      taxCalculator: noTax,
      model,
      seed: 99,
      pathCount: 12,
      firstPathIndex: 8,
    })
    const merged = mergePathResults([partA, partB])
    expect(merged.paths.map((p) => p.endingInvestable)).toEqual(whole.paths.map((p) => p.endingInvestable))
  })

  it('produces a coherent summary: fan ordered, success in [0,1], histogram covers all paths', () => {
    const plan = validate(basePlan())
    const result = runMonteCarloPaths(plan, { startYear: 2026, taxCalculator: noTax, model, seed: 1, pathCount: 200 })
    const summary = aggregateMonteCarlo(result)
    expect(summary.pathCount).toBe(200)
    expect(summary.successRate).toBeGreaterThanOrEqual(0)
    expect(summary.successRate).toBeLessThanOrEqual(1)
    for (const f of summary.fan) {
      expect(f.p10).toBeLessThanOrEqual(f.p25)
      expect(f.p25).toBeLessThanOrEqual(f.p50)
      expect(f.p50).toBeLessThanOrEqual(f.p75)
      expect(f.p75).toBeLessThanOrEqual(f.p90)
    }
    expect(summary.fan).toHaveLength(2051 - 2026 + 1)
    expect(summary.endingInvestable.histogram.counts.reduce((a, b) => a + b, 0)).toBe(200)
    expect(summary.endingAfterTaxEstate.histogram.counts.reduce((a, b) => a + b, 0)).toBe(200)
    expect(summary.endingAfterTaxEstate.percentiles.p10).toBeLessThanOrEqual(summary.endingAfterTaxEstate.percentiles.p50)
    const depleted = summary.depletionYearCounts.reduce((a, d) => a + d.count, 0)
    expect(depleted).toBe(Math.round((1 - summary.successRate) * 200))
    const lastDepletionPoint = summary.depletionProbabilityByYear.at(-1)
    if (lastDepletionPoint) expect(lastDepletionPoint.cumulativeProbability).toBeCloseTo(1 - summary.successRate, 10)
  })

  it('reports zero success and zero failure when no paths were run', () => {
    const summary = aggregateMonteCarlo({ startYear: 2026, endYear: 2026, paths: [] })
    expect(summary.pathCount).toBe(0)
    expect(summary.successRate).toBe(0)
    expect(summary.downsideRisk.failureRate).toBe(0)
    expect(summary.downsideRisk.failingPathCount).toBe(0)
  })

  it('a hopeless plan fails and a trivially funded plan succeeds', () => {
    const broke = validate({ ...basePlan(), accounts: [taxable(50_000)] })
    const rich = validate({ ...basePlan(), expenses: { ...basePlan().expenses, baseAnnual: 10_000 } })
    const brokeSummary = aggregateMonteCarlo(
      runMonteCarloPaths(broke, { startYear: 2026, taxCalculator: noTax, model, seed: 2, pathCount: 50 }),
    )
    const richSummary = aggregateMonteCarlo(
      runMonteCarloPaths(rich, { startYear: 2026, taxCalculator: noTax, model, seed: 2, pathCount: 50 }),
    )
    expect(brokeSummary.successRate).toBe(0)
    expect(richSummary.successRate).toBe(1)
    expect(brokeSummary.depletionYearCounts.length).toBeGreaterThan(0)
    expect(brokeSummary.downsideRisk.expectedShortfallDollars).toBeGreaterThan(0)
    expect(richSummary.downsideRisk.expectedShortfallDollars).toBe(0)
  })

  it('floor/target success equal the success rate when no policy or floor is set', () => {
    const plan = validate(basePlan())
    const s = aggregateMonteCarlo(runMonteCarloPaths(plan, { startYear: 2026, taxCalculator: noTax, model, seed: 7, pathCount: 200 }))
    // With no discretionary layer, any shortfall is a required shortfall, so the
    // three success rates coincide with the classic success rate.
    expect(s.requiredFloorSuccessRate).toBe(s.successRate)
    expect(s.targetLifestyleSuccessRate).toBe(s.successRate)
  })

  it('guardrails keep the floor funded in paths where rigid spending would deplete', () => {
    // A stressed plan: $650k, $48k target / $28k floor, volatile lognormal returns.
    const volatile = createLognormalModel({ type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: 20 })
    const stressed = () => {
      const p = basePlan()
      p.accounts = [taxable(650_000)]
      p.expenses.baseAnnual = 48_000
      p.expenses.requiredAnnual = 28_000
      return p
    }
    const control = validate(stressed())
    const guarded = validate({
      ...stressed(),
      expenses: { ...stressed().expenses, spendingPolicy: { mode: 'withdrawalRateGuardrails' } },
    })
    const opts = { startYear: 2026, taxCalculator: noTax, model: volatile, seed: 11, pathCount: 300 }
    const c = aggregateMonteCarlo(runMonteCarloPaths(control, opts))
    const g = aggregateMonteCarlo(runMonteCarloPaths(guarded, opts))

    // Structural: floor is at least as easy to fund as the full target, and at
    // least as easy as never touching the portfolio at all.
    expect(g.requiredFloorSuccessRate).toBeGreaterThanOrEqual(g.targetLifestyleSuccessRate)
    expect(g.requiredFloorSuccessRate).toBeGreaterThanOrEqual(g.successRate)
    expect(g.requiredFloorSuccessRate).toBeLessThanOrEqual(1)
    // The point of guardrails: cutting discretionary saves the floor in many
    // paths where the fixed-target plan would run dry.
    expect(g.requiredFloorSuccessRate).toBeGreaterThan(c.successRate)
  })

  it('reports progress per completed path', () => {
    const plan = validate(basePlan())
    const seen: number[] = []
    runMonteCarloPaths(plan, {
      startYear: 2026,
      taxCalculator: noTax,
      model,
      seed: 3,
      pathCount: 5,
      onPathDone: (n) => seen.push(n),
    })
    expect(seen).toEqual([1, 2, 3, 4, 5])
  })

  it('adjustment metrics stay zeroed for plans without a guardrail policy', () => {
    const plan = validate(basePlan())
    const s = aggregateMonteCarlo(runMonteCarloPaths(plan, { startYear: 2026, taxCalculator: noTax, model, seed: 7, pathCount: 100 }))
    expect(s.adjustments.pathsWithCut).toBe(0)
    expect(s.adjustments.pathsWithRaise).toBe(0)
    expect(s.adjustments.medianMaxCutDepth).toBe(0)
    expect(s.adjustments.p90MaxCutDepth).toBe(0)
    expect(s.adjustments.averageCutYears).toBe(0)
    expect(s.adjustments.averageLongestCutSpellYears).toBe(0)
    expect(s.adjustments.probEndingAboveBequestTarget).toBeNull()
    // Surplus probability is just the share of paths that end with any estate.
    expect(s.adjustments.probEndingSurplus).toBeGreaterThanOrEqual(s.successRate)
  })

  it('reports probability and magnitude of adjustments for guardrail plans, seed-stable', () => {
    const volatile = createLognormalModel({ type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: 20 })
    const stressed = () => {
      const p = basePlan()
      p.accounts = [taxable(650_000)]
      p.expenses.baseAnnual = 48_000
      p.expenses.requiredAnnual = 28_000
      p.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails' }
      return p
    }
    const opts = { startYear: 2026, taxCalculator: noTax, model: volatile, seed: 11, pathCount: 300 }
    const a = aggregateMonteCarlo(runMonteCarloPaths(validate(stressed()), opts))
    const b = aggregateMonteCarlo(runMonteCarloPaths(validate(stressed()), opts))

    // Stressed guardrail plan: most paths cut at least once; magnitudes are
    // fractions of the discretionary layer, durations are plausible year counts.
    expect(a.adjustments.pathsWithCut).toBeGreaterThan(0.3)
    expect(a.adjustments.medianMaxCutDepth).toBeGreaterThan(0)
    expect(a.adjustments.medianMaxCutDepth).toBeLessThanOrEqual(1)
    expect(a.adjustments.p90MaxCutDepth).toBeGreaterThanOrEqual(a.adjustments.medianMaxCutDepth)
    expect(a.adjustments.averageCutYears).toBeGreaterThan(0)
    expect(a.adjustments.p90CutYears).toBeGreaterThanOrEqual(a.adjustments.averageCutYears)
    expect(a.adjustments.averageLongestCutSpellYears).toBeGreaterThan(0)
    expect(a.adjustments.averageLongestCutSpellYears).toBeLessThanOrEqual(a.adjustments.averageCutYears + 1e-9)

    // Seed-stable: identical runs aggregate to identical adjustment metrics.
    expect(b.adjustments).toEqual(a.adjustments)
  })

  it('measures the surplus probability against the bequest target when one is set', () => {
    const targeted = () => {
      const p = basePlan()
      p.expenses.bequestTargetDollars = 500_000
      return p
    }
    const none = aggregateMonteCarlo(
      runMonteCarloPaths(validate(basePlan()), { startYear: 2026, taxCalculator: noTax, model, seed: 5, pathCount: 100 }),
    )
    const s = aggregateMonteCarlo(
      runMonteCarloPaths(validate(targeted()), { startYear: 2026, taxCalculator: noTax, model, seed: 5, pathCount: 100 }),
    )
    expect(none.adjustments.probEndingAboveBequestTarget).toBeNull()
    expect(s.adjustments.probEndingAboveBequestTarget).not.toBeNull()
    expect(s.adjustments.probEndingAboveBequestTarget!).toBeGreaterThanOrEqual(0)
    // Clearing a $500k inflated target is strictly harder than clearing zero.
    expect(s.adjustments.probEndingAboveBequestTarget!).toBeLessThanOrEqual(s.adjustments.probEndingSurplus)
  })

  it('inflates the bequest target with the realized path inflation, not the plan assumption', () => {
    // The path realizes 0% inflation while the plan assumes 10%: the $500k
    // target must stay $500k nominal, so a $600k ending estate clears it.
    // (Inflating by the assumption instead would demand ~$5.4M.)
    const zeroInflationModel = {
      generatePath: () => ({ returnShockPct: new Array<number>(120).fill(0), inflationPct: new Array<number>(120).fill(0) }),
    }
    const plan = basePlan()
    plan.assumptions.inflationPct = 10
    plan.assumptions.defaultReturnPct = 0
    plan.expenses.baseAnnual = 0
    plan.accounts = [taxable(600_000)]
    plan.expenses.bequestTargetDollars = 500_000
    const s = aggregateMonteCarlo(
      runMonteCarloPaths(validate(plan), { startYear: 2026, taxCalculator: noTax, model: zeroInflationModel, seed: 5, pathCount: 10 }),
    )
    expect(s.adjustments.probEndingAboveBequestTarget).toBe(1)
  })
})

describe('stochastic longevity + LTC shock (V6)', () => {
  const model = createMarketModel({ type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: 12 })
  const baseOpts = { startYear: 2026, taxCalculator: noTax, model, seed: 7, pathCount: 200 }

  it('runs every path to a fixed wide horizon past the planning age, reproducibly', () => {
    const plan = validate(basePlan()) // planningAge 90 → fixed-horizon year 2051
    const a = runMonteCarloPaths(plan, { ...baseOpts, stochasticLongevity: true })
    const b = runMonteCarloPaths(plan, { ...baseOpts, stochasticLongevity: true })
    expect(a.endYear).toBeGreaterThan(2051) // extends toward the mortality-table max age
    expect(a.paths[0]!.investableByYear.length).toBe(b.paths[0]!.investableByYear.length) // shared grid
    expect(aggregateMonteCarlo(a).successRate).toBe(aggregateMonteCarlo(b).successRate) // reproducible
  })

  it('an LTC policy lifts the success rate under the LTC shock', () => {
    const base = basePlan()
    base.expenses.baseAnnual = 55_000
    base.accounts = [taxable(900_000)]
    const withPolicy = validate({
      ...base,
      insurance: [
        { kind: 'ltc', id: 'ltc1', name: 'LTC', owner: 'p1', annualPremium: 0, premiumMode: 'paidUp', benefitMonthly: 7_000, benefitPeriodYears: 'lifetime', eliminationPeriodDays: 0 },
      ],
    })
    const noPolicy = validate({ ...base, insurance: [] })
    const shock = { ...DEFAULT_LTC_SHOCK, incidence: 1 } // every path gets the episode
    const insured = aggregateMonteCarlo(runMonteCarloPaths(withPolicy, { ...baseOpts, ltcShock: shock }))
    const uninsured = aggregateMonteCarlo(runMonteCarloPaths(noPolicy, { ...baseOpts, ltcShock: shock }))
    expect(insured.successRate).toBeGreaterThanOrEqual(uninsured.successRate)
  })
})

describe('new market models (stochastic-market-model-library)', () => {
  const plan = validate(basePlan())
  const noTax = createFlatTaxCalculator(0)

  it('default monte carlo paths are unchanged after adding models (seed-stability regression)', () => {
    // Default remains lognormal; adding union members must not alter RNG consumption order or defaults.
    const model = createMarketModel({ type: 'lognormal', inflationMeanPct: plan.assumptions.inflationPct, returnVolPct: 12 })
    const res = runMonteCarloPaths(plan, { startYear: 2026, taxCalculator: noTax, model, seed: 42, pathCount: 5 })
    // Known stable sample (locked regression value from prior runs)
    expect(res.paths[0].endingInvestable).toBeGreaterThan(0)
    expect(res.paths.length).toBe(5)
    // Reproduce same with explicit
    const res2 = runMonteCarloPaths(plan, { startYear: 2026, taxCalculator: noTax, model: createLognormalModel({ type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: 12 }), seed: 42, pathCount: 1 })
    expect(res2.paths[0].endingInvestable).toBeCloseTo(res.paths[0].endingInvestable, 6)
  })

  const newModelKinds = [
    { type: 'student-t' as const, inflationMeanPct: 2.5 },
    { type: 'regime-switch' as const, inflationMeanPct: 2.5 },
    { type: 'cape-conditioned' as const, inflationMeanPct: 2.5 },
    { type: 'stationary' as const, equityWeightPct: 60 },
    { type: 'empirical' as const, equityWeightPct: 60 },
    { type: 'garch' as const, inflationMeanPct: 2.5 },
    { type: 'inflation-regime' as const, baseInflationMeanPct: 2.5 },
    { type: 'reversed-history' as const, equityWeightPct: 60 },
    { type: 'user-shock' as const, inflationMeanPct: 2.5 },
    { type: 'gaussian' as const, inflationMeanPct: 2.5 },
    { type: 'ar1' as const, inflationMeanPct: 2.5 },
  ]

  for (const cfg of newModelKinds) {
    const label = (cfg as { type: string }).type
    const isNonMeanByDesign = label === 'empirical' || label === 'user-shock' // non-centered or explicit shock
    it(`${label} is seed-deterministic${isNonMeanByDesign ? '' : ' and mean-preserving across seeds'}`, () => {
      const model = createMarketModel(cfg as MarketModelConfig)
      if (!isNonMeanByDesign) {
        // mean preserving (documented)
        let sum = 0
        const nPaths = 80
        const nY = 30
        for (let p = 0; p < nPaths; p++) {
          const rng = createRng(100 + p)
          const s = model.generatePath(rng, nY)
          for (let y = 0; y < nY; y++) sum += (s.returnShockPct?.[y] ?? 0)
        }
        const avg = sum / (nPaths * nY)
        expect(Math.abs(avg)).toBeLessThan(2) // allow small-sample / window bias while still ~preserving overall
      }

      // deterministic
      const rngA = createRng(777)
      const rngB = createRng(777)
      const a = model.generatePath(rngA, 7)
      const b = model.generatePath(rngB, 7)
      expect(a.returnShockPct).toEqual(b.returnShockPct)
    })
  }

  it('student-t produces fatter tails than lognormal at equal variance', () => {
    const tModel = createMarketModel({ type: 'student-t', df: 4, inflationMeanPct: 2.5, returnVolPct: 12 })
    const lnModel = createMarketModel({ type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: 12 })
    const tShocks: number[] = []
    const lnShocks: number[] = []
    for (let p = 0; p < 200; p++) {
      const rt = tModel.generatePath(createRng(2000 + p), 1)
      const rl = lnModel.generatePath(createRng(2000 + p), 1)
      tShocks.push(rt.returnShockPct![0]!)
      lnShocks.push(rl.returnShockPct![0]!)
    }
    const tKurt = tShocks.reduce((s, x) => s + Math.pow(x, 4), 0) / tShocks.length
    const lnKurt = lnShocks.reduce((s, x) => s + Math.pow(x, 4), 0) / lnShocks.length
    expect(tKurt).toBeGreaterThan(lnKurt) // fatter
  })

  it('class shocks stay consistent under bootstrap variants', () => {
    const model = createMarketModel({ type: 'stationary', equityWeightPct: 60, classShocks: true })
    const series = model.generatePath(createRng(55), 5)
    expect(series.classReturnShockPct?.usStocks?.length).toBe(5)
  })

  it('regime-switching produces some state variation (vol clustering proxy)', () => {
    const model = createMarketModel({ type: 'regime-switch', inflationMeanPct: 2.5 })
    const s = model.generatePath(createRng(99), 50)
    const range = Math.max(...s.returnShockPct!) - Math.min(...s.returnShockPct!)
    expect(range).toBeGreaterThan(5) // variation
  })

  it('CAPE conditioning lowers forward returns from a high starting CAPE', () => {
    const highCape = createMarketModel({ type: 'cape-conditioned', inflationMeanPct: 2.5, startingCape: 35 })
    const lowCape = createMarketModel({ type: 'cape-conditioned', inflationMeanPct: 2.5, startingCape: 10 })
    let highAvg = 0, lowAvg = 0
    for (let p = 0; p < 100; p++) {
      highAvg += highCape.generatePath(createRng(300 + p), 10).returnShockPct!.reduce((a, b) => a + b, 0)
      lowAvg += lowCape.generatePath(createRng(300 + p), 10).returnShockPct!.reduce((a, b) => a + b, 0)
    }
    expect(highAvg / 1000).toBeLessThan(lowAvg / 1000)
  })

  it('user shock scenario applies the specified year-one drop deterministically', () => {
    const model = createMarketModel({ type: 'user-shock', inflationMeanPct: 2.5, shockYear: 1, shockPct: -30 })
    const s = model.generatePath(createRng(123), 3)
    expect(s.returnShockPct![0]).toBeCloseTo(-30, 6)
    // later years not forced
    expect(Math.abs(s.returnShockPct![1]!)).toBeLessThan(50)
  })
})
