/**
 * B2-P1 slice 2 parity on the example library: the figures the pages used to
 * compute now come from the engine, and the retired expressions (kept here,
 * nowhere else) show what changed and what did not.
 *
 * - Guardrail thresholds: guardrailThresholdDollars equals the retired
 *   (percent / 100) × startingInvestableOf(plan) bit for bit (R3).
 * - Bucket lens: the engine's rows equal the retired planner function's.
 * - Cash-flow drilldown: the hub and unfunded nodes are the engine's
 *   reconciliation totals; the retired line sums differ only in the last
 *   digit and print the same whole dollars.
 * - Histogram labels: the engine's bin centres equal the retired centres on
 *   every histogram whose values are not all equal, and the five examples the
 *   worksheet names as all one value at the page's own run draw one bar, "$0".
 */
import { describe, expect, it } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import { aggregateMonteCarlo, runMonteCarloPaths } from '@retiregolden/engine/montecarlo/run'
import { createMarketModel } from '@retiregolden/engine/montecarlo/marketModels'
import { guardrailThresholdDollars, startingInvestableOf } from '@retiregolden/engine/montecarlo/riskBasedGuardrails'
import { bucketLens, BUCKET_LENS_SPANS } from '@retiregolden/engine/projection/bucketLens'
import type { ProjectionResult } from '@retiregolden/engine/projection/types'
import { projectPlan } from '../projection'
import { EXAMPLE_FIXED_YEAR } from './examples/buildContext'
import { EXAMPLE_PLANS } from './examples/registry'
import { buildModel } from './marketModelPicker'
import { HEADLINE_MC_MODEL } from './useMcSuccessRate'
import { taxCalculatorFor } from './useProjection'
import { buildYearCashFlowSankey, HOUSEHOLD_CASH_NODE_ID, UNFUNDED_ORIGIN_NODE_ID } from './yearCashFlow/buildYearCashFlow'
import { fmtMoney, histogramBars } from './format'
import { DEFAULT_PATH_COUNT, runMonteCarlo } from '../mc/pool'
import { seedFromPlanId } from './useProjection'

/** The planner's bucket lens as it was until slice 2 (a missing need read as 0). */
function retiredBucketLens(result: ProjectionResult, spans: readonly number[]) {
  const years = result.years
  const needs = years.map((y) => (typeof y.netPortfolioNeed === 'number' ? y.netPortfolioNeed : 0))
  return years.map((y, i) => {
    let remaining = y.investableTotal
    const buckets: number[] = []
    let cursor = i
    for (const span of spans) {
      let bucketNeed = 0
      for (let k = 0; k < span; k++) {
        if (cursor + k >= needs.length) break
        bucketNeed += needs[cursor + k]!
      }
      cursor += span
      const claimed = Math.min(remaining, bucketNeed)
      buckets.push(claimed)
      remaining -= claimed
    }
    buckets.push(remaining)
    return { year: y.year, need: needs[i]!, buckets, investableTotal: y.investableTotal }
  })
}

describe('slice 2 figures on the example library', () => {
  it('prints the guardrail thresholds the retired product printed, bit for bit, on every example', () => {
    for (const example of EXAMPLE_PLANS) {
      const built = example.build()
      const plan: Plan = {
        ...built,
        expenses: {
          ...built.expenses,
          spendingPolicy: { mode: 'riskBasedGuardrails', lowerBalanceThresholdPct: 80, upperBalanceThresholdPct: 150 },
        },
      }
      const published = guardrailThresholdDollars(plan)
      expect(published?.status, example.id).toBe('anchored')
      if (published?.status !== 'anchored') continue
      expect(published.lower, example.id).toBe((80 / 100) * startingInvestableOf(plan))
      expect(published.upper, example.id).toBe((150 / 100) * startingInvestableOf(plan))
    }
  })

  it('reads the buckets, the cash-flow hub and the unfunded node from the engine, with nothing printed differently', () => {
    // How many rows and years the library exercises, and how many differ in
    // the last digit, are measurements of the examples at a commit (the
    // worksheets record them); the invariant is each row's parity below.
    let bucketRows = 0
    let years = 0
    let hubMaxDiff = 0
    for (const example of EXAMPLE_PLANS) {
      const plan = example.build()
      const view = projectPlan(plan, { startYear: EXAMPLE_FIXED_YEAR, captureAnnualCashFlow: true })
      for (const spans of Object.values(BUCKET_LENS_SPANS)) {
        const engine = bucketLens(view.result, spans)
        const retired = retiredBucketLens(view.result, spans)
        expect(engine, `${example.id} buckets`).toEqual(retired)
        engine.forEach((row, index) => {
          bucketRows++
          row.buckets.forEach((value, k) => expect(Object.is(value, retired[index]!.buckets[k]), example.id).toBe(true))
        })
      }
      for (const year of view.result.years) {
        if (year.cashFlow === undefined || year.cashFlow.reconciliation.status !== 'reconciled') continue
        years++
        const model = buildYearCashFlowSankey(plan, year, { showAll: true })
        expect(model.kind, `${example.id} ${year.year}`).toBe('ready')
        if (model.kind !== 'ready') continue
        const nodes = model.views.cashFlow.nodes
        const hub = nodes.find((node) => node.id === HOUSEHOLD_CASH_NODE_ID)!
        expect(hub.amountPlanDollars).toBe(year.cashFlow.reconciliation.cash.sourceTotalPlanDollars)
        let retiredHub = 0
        for (const line of year.cashFlow.sourceLines) {
          if (line.role === 'spendableSource' || line.role === 'portfolioFunding' || line.role === 'loanProceeds') {
            retiredHub += line.amountPlanDollars
          }
        }
        const diff = Math.abs(retiredHub - hub.amountPlanDollars)
        hubMaxDiff = Math.max(hubMaxDiff, diff)
        expect(diff).toBeLessThan(1e-9)
        const factor = view.basis.factors[year.year - view.basis.startYear]!
        expect(fmtMoney(retiredHub), `${example.id} ${year.year} nominal`).toBe(fmtMoney(hub.amountPlanDollars))
        expect(fmtMoney(retiredHub / factor), `${example.id} ${year.year} today`).toBe(fmtMoney(hub.amountPlanDollars / factor))
        const unfunded = nodes.find((node) => node.id === UNFUNDED_ORIGIN_NODE_ID)
        const unfundedTotal = year.cashFlow.reconciliation.uses.unfundedUsesPlanDollars
        expect(unfunded !== undefined, `${example.id} ${year.year} unfunded node`).toBe(unfundedTotal > 0)
        if (unfunded) {
          let retiredUnfunded = 0
          for (const line of year.cashFlow.useLines) if (line.unfundedPlanDollars > 0) retiredUnfunded += line.unfundedPlanDollars
          expect(unfunded.amountPlanDollars).toBe(unfundedTotal)
          expect(retiredUnfunded).toBe(unfundedTotal)
        }
      }
    }
    expect(bucketRows).toBeGreaterThan(0)
    expect(years).toBeGreaterThan(0)
    expect(hubMaxDiff).toBeLessThan(1e-10)
  }, 300_000)

  it('labels every histogram that is not all one value with the retired centre, bit for bit', () => {
    let degenerate = 0
    for (const example of EXAMPLE_PLANS) {
      const plan = example.build()
      const summary = aggregateMonteCarlo(
        runMonteCarloPaths(plan, {
          startYear: EXAMPLE_FIXED_YEAR,
          taxCalculator: taxCalculatorFor(plan),
          model: createMarketModel(
            buildModel(HEADLINE_MC_MODEL.kind, plan.assumptions.inflationPct, HEADLINE_MC_MODEL.returnVolPct, HEADLINE_MC_MODEL.equityWeightPct, plan),
          ),
          seed: 1,
          pathCount: 60,
        }),
      )
      const histogram = summary.endingInvestable.histogram
      const allEqual = histogram.counts[0] === summary.pathCount && histogram.binWidth === 1
      if (allEqual) {
        degenerate++
        expect(new Set(histogram.binCenters), example.id).toEqual(new Set([histogram.min]))
        continue
      }
      histogram.binCenters.forEach((centre, i) =>
        expect(Object.is(centre, histogram.min + (i + 0.5) * histogram.binWidth), `${example.id} bin ${i}`).toBe(true),
      )
    }
    expect(degenerate).toBeGreaterThan(0)
  }, 300_000)

  it("draws one bar, \"$0\", for the five examples every path of the page's own run ends at $0", async () => {
    // The page's defaults (display-histogram-bin-label, correction 5): the plan
    // id's seed as the app stamps an example (example:<id>), 1,000 paths, the
    // headline model, no stochastic longevity or care shock.
    const ALL_AT_ZERO = ['inherited-ira-beneficiary', 'survivor-years', 'ltc-shock', 'brokerage-no-hsa', 'fixed-target-spending']
    expect(DEFAULT_PATH_COUNT).toBe(1_000)
    for (const id of ALL_AT_ZERO) {
      const example = EXAMPLE_PLANS.find((candidate) => candidate.id === id)!
      const plan: Plan = { ...example.build(), id: `example:${id}` }
      const summary = await runMonteCarlo(plan, {
        startYear: EXAMPLE_FIXED_YEAR,
        pathCount: DEFAULT_PATH_COUNT,
        seed: seedFromPlanId(plan.id),
        model: buildModel(HEADLINE_MC_MODEL.kind, plan.assumptions.inflationPct, HEADLINE_MC_MODEL.returnVolPct, HEADLINE_MC_MODEL.equityWeightPct, plan),
        stochasticLongevity: false,
        ltcShock: null,
      })
      const histogram = summary.endingInvestable.histogram
      expect(summary.pathCount, id).toBe(1_000)
      expect(histogram.counts[0], id).toBe(1_000)
      expect(new Set(histogram.binCenters), id).toEqual(new Set([0]))
      expect(histogramBars(histogram), id).toEqual([{ label: '$0', count: 1_000 }])
    }
  }, 300_000)
})
