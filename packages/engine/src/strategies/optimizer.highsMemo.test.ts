/**
 * The HiGHS loader is memoised per process/worker, so its failure policy is
 * the thing worth testing rather than any number: a transient load failure
 * must not be cached. This file lives apart from `optimizer.test.ts` because
 * the memo is module state and `vi.mock('highs', ...)` has to replace the
 * real solver for the whole module graph, which those golden tests need.
 */

import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'

import { packForYear } from '../params/index.js'
import type { FilingStatus } from '../params/types.js'
import { optimizeSchedule, type OptimizerInput } from './optimizer.js'

const loads = vi.hoisted(() => ({ attempts: 0 }))

vi.mock('highs', () => ({
  // The real package ships CJS with an `export default` loader that resolves
  // to the wasm module. Fail the first load the way a fetch/instantiate error
  // does, then succeed, so the memo's behavior across the two is observable.
  default: async () => {
    loads.attempts++
    if (loads.attempts === 1) throw new Error('transient wasm load failure')
    return {
      solve: () => ({ Status: 'Optimal', ObjectiveValue: 0, Columns: {} }),
    }
  },
}))

const PACK = packForYear(2025).pack

/** One flat year with nothing to decide; the solve result is stubbed anyway. */
function input(): OptimizerInput {
  return {
    years: [
      {
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
      },
    ],
    openingTrad: 100_000,
    openingInheritedTrad: 0,
    openingOther: 0,
    liquidationRate: 0.5,
  }
}

describe('HiGHS loader memo', () => {
  it('does not cache a failed load, so a later solve can still run', async () => {
    await expect(optimizeSchedule(input())).rejects.toThrow('transient wasm load failure')

    // Without clearing the memo this second call returns the same rejected
    // promise and the loader is never reached again for the worker's life.
    const second = await optimizeSchedule(input())
    expect(second.status).toBe('optimal')
    expect(loads.attempts).toBe(2)

    // The successful load IS memoised: a third solve reuses it.
    await optimizeSchedule(input())
    expect(loads.attempts).toBe(2)
  })
})
