/** @vitest-environment jsdom */
/**
 * The Optimize page's success rate for a proposed schedule runs the headline
 * configuration built from the base plan: the engine's default seed and the
 * plan's own lognormal model (decision D-MC-DEFAULT-SEED, 2026-09-28; review
 * finding M3, S11), so it is comparable with the headline rate.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { buildLognormalModelConfigForPlan } from '@retiregolden/engine/montecarlo/marketModels'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'
import { waitFor } from '../testSupport/settle'

vi.mock('../optimize/runner', () => ({ runOptimize: vi.fn() }))
vi.mock('../mc/pool', () => ({
  DEFAULT_PATH_COUNT: 1000,
  runMonteCarlo: vi.fn().mockResolvedValue({ successRate: 0.91 }),
}))

import { runMonteCarlo } from '../mc/pool'
import { runOptimize } from '../optimize/runner'
import type { OptimizeResult } from '../optimize/messages'
import { OptimizePage } from './OptimizePage'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function contextFor(plan: Plan): PlanContextValue {
  return { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
}

function result(): OptimizeResult {
  return {
    schedule: {
      status: 'optimal',
      endingAfterTax: 1_000_000,
      lifetimeTax: 100_000,
      schedule: [],
      conversions: [{ year: 2027, amount: 60_000 }],
      solveMs: 1,
    },
    postProcessed: null,
    tournament: {
      policyId: 'max-after-tax-estate',
      winnerSource: 'candidate',
      winnerCandidateId: 'fill-22',
      winnerLabel: 'Fill the 22% bracket',
      winnerConversions: [{ year: 2027, amount: 60_000 }],
      winnerValidation: {
        recommendationState: 'beneficial',
        afterTaxEstateDelta: 65_000,
        lifetimeTaxDelta: 12_000,
        moneyLastsYearsDelta: 0,
        requestedConversionTotal: 60_000,
        executedConversionTotal: 60_000,
        baseline: { endingAfterTaxEstate: 935_000 },
        candidate: { endingAfterTaxEstate: 1_000_000 },
      },
      marginOverMilpDollars: 9_000,
      candidates: [],
      retirementActionReadinessVeto: null,
      retirementActionPromotion: null,
      acaActionabilityVeto: null,
      searchRefined: true,
      searchSimulations: 8,
    },
    convergence: {},
    claimAge: null,
  } as unknown as OptimizeResult
}

describe('Optimize proposed-schedule success rate', () => {
  it('runs 1,000 paths on seed 6,221,293 with the headline model of the base plan', async () => {
    vi.mocked(runOptimize).mockResolvedValue(result())
    const plan = createSamplePlan()
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={contextFor(plan)}>
            <OptimizePage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    await waitFor(() => vi.mocked(runMonteCarlo).mock.calls.length > 0, {
      what: 'the proposed-schedule run',
      attempts: 600,
      intervalMs: 20,
    })
    const opts = vi.mocked(runMonteCarlo).mock.calls.at(-1)![1]
    expect(opts.seed).toBe(6_221_293)
    expect(opts.pathCount).toBe(1_000)
    expect(opts.model).toStrictEqual(buildLognormalModelConfigForPlan(plan, 12))
  })
})
