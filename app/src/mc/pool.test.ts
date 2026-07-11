import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '@retiregolden/engine/model/plan'
import { runHistoricalStressSuiteViews, runMonteCarlo, runStochasticFrontiers } from './pool'

let counter = 0
const testIds = () => `pool-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

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
  plan.assumptions.defaultReturnPct = 5
  plan.expenses.baseAnnual = 45_000
  const brokerage: Account = {
    type: 'taxable',
    id: testIds(),
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance: 1_200_000,
    costBasis: 800_000,
    annualContribution: 0,
  }
  plan.accounts = [brokerage]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describe('runMonteCarlo (pool entry; sync fallback in this environment)', () => {
  it('runs end-to-end with the real tax stack and is seed-reproducible', async () => {
    const plan = basePlan()
    const opts = {
      startYear: 2026,
      pathCount: 50,
      seed: 42,
      model: { type: 'lognormal', inflationMeanPct: 2.5 } as const,
    }
    const a = await runMonteCarlo(plan, opts)
    const b = await runMonteCarlo(plan, opts)
    expect(a.pathCount).toBe(50)
    expect(a.successRate).toBe(b.successRate)
    expect(a.fan).toEqual(b.fan)
    expect(a.fan[0]!.year).toBe(2026)
  })

  it('reports monotonically non-decreasing progress up to the total', async () => {
    const plan = basePlan()
    const seen: number[] = []
    await runMonteCarlo(plan, {
      startYear: 2026,
      pathCount: 30,
      seed: 1,
      model: { type: 'historical', mode: 'block' },
      onProgress: (done, total) => {
        expect(total).toBe(30)
        seen.push(done)
      },
    })
    expect(seen.length).toBeGreaterThan(0)
    expect(seen[seen.length - 1]).toBe(30)
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeGreaterThanOrEqual(seen[i - 1]!)
  })

  it('completes 1,000 paths over a ~26-year horizon within the performance budget', async () => {
    const plan = basePlan()
    const started = performance.now()
    const summary = await runMonteCarlo(plan, {
      startYear: 2026,
      pathCount: 1000,
      seed: 7,
      model: { type: 'lognormal', inflationMeanPct: 2.5 },
    })
    const elapsedMs = performance.now() - started
    expect(summary.pathCount).toBe(1000)
    // Single-threaded fallback; the worker pool divides this across cores.
    expect(elapsedMs).toBeLessThan(15_000)
  }, 20_000)

  it('runs frontiers through the async pool facade', async () => {
    const plan = basePlan()
    const result = await runStochasticFrontiers(plan, {
      startYear: 2026,
      pathCount: 20,
      seed: 7,
      model: { type: 'lognormal', inflationMeanPct: 2.5 },
    })
    expect(result.spending.length).toBeGreaterThan(0)
    expect(result.retirement.length).toBeGreaterThan(0)
  })

  it('returns summarized historical stress rows through the async pool facade', async () => {
    const plan = basePlan()
    const result = await runHistoricalStressSuiteViews(plan, {
      startYear: 2026,
      equityWeightPct: 60,
      worstWindowCount: 3,
    })
    expect(result.suites).toHaveLength(2)
    for (const suite of result.suites) {
      expect(suite.worstByEndingAfterTaxEstate).toHaveLength(3)
      expect(suite.worstByEndingAfterTaxEstate[0]!.summary.endingAfterTaxEstate).toEqual(expect.any(Number))
      expect(suite.worstByEndingAfterTaxEstate[0]!.projection.depletionYear ?? null).not.toBeUndefined()
    }
  })
})
