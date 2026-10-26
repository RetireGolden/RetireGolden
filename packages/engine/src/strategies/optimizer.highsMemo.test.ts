/**
 * The HiGHS loader is memoised per process/worker, so its failure policy is
 * the thing worth testing rather than any number: a transient load failure
 * must not be cached. This file lives apart from `optimizer.test.ts` because
 * the memo is module state and `vi.mock('highs', ...)` has to replace the
 * real solver for the whole module graph, which those golden tests need.
 *
 * The same stand-in module carries the engine's solution reader's failure
 * policy: the engine publishes only what HiGHS's status codes and solution
 * doubles say, so a module without the persistent model API, a status code
 * the engine does not name, or a column it cannot read fails the solve with an
 * error rather than publishing a guess.
 */

import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'

import { packForYear } from '../params/index.js'
import type { FilingStatus } from '../params/types.js'
import { optimizeSchedule, type OptimizerInput } from './optimizer.js'

/** What one solved stand-in model reports. */
type Solved = {
  modelStatus: number
  primalStatus: number
  objective: number
  names: string[]
  values: number[]
  /** The model's column count, when it differs from the solution's. */
  numCols?: number
  /** What `run` returns, when it is not a clean run. */
  ran?: unknown
}

/** An optimal solve with two solved columns, at more digits than a printed solution carries. */
const OPTIMAL: Solved = {
  modelStatus: 7,
  primalStatus: 2,
  objective: 1_769_100.802718,
  names: ['conv0', 'trad1'],
  values: [107_028.8775, 1_756_817.79],
}

/** The package's model status constants, as highs 1.15.4 publishes them. */
const MODEL_STATUS = {
  notSet: 0,
  loadError: 1,
  modelError: 2,
  presolveError: 3,
  solveError: 4,
  postsolveError: 5,
  empty: 6,
  optimal: 7,
  infeasible: 8,
  unboundedOrInfeasible: 9,
  unbounded: 10,
  objectiveBound: 11,
  objectiveTarget: 12,
  timeLimit: 13,
  iterationLimit: 14,
  unknown: 15,
  solutionLimit: 16,
  interrupted: 17,
}
const SOLUTION_STATUS = { none: 0, infeasible: 1, feasible: 2 }

const loads = vi.hoisted(() => ({
  attempts: 0,
  /** What the stand-in's next solve reports. */
  solved: null as unknown,
  /** The status constants the stand-in module publishes. */
  constants: null as unknown,
  /** Whether the stand-in module has the persistent model API. */
  hasWithModel: true,
  /** Options each solve set, and whether its model was disposed. */
  optionsSet: [] as Record<string, unknown>[],
  disposed: 0,
}))

vi.mock('highs', () => ({
  // Fail the first load the way a fetch/instantiate error does, then succeed,
  // so the memo's behavior across the two is observable. The module it
  // resolves to has what the engine's reader uses: `withModel` over an LP
  // source, the status constants, and per model `options.set`, `run`,
  // `getModelStatus`, `getDimensions`, `info.get('primal_solution_status')`,
  // `getObjectiveValue`, `getSolution` and `getColName`.
  default: async () => {
    loads.attempts++
    if (loads.attempts === 1) throw new Error('transient wasm load failure')
    return {
      constants: loads.constants,
      ...(loads.hasWithModel
        ? {
            withModel: (source: { format: string; data: string }, operation: (model: unknown) => unknown) => {
              if (source.format !== 'lp' || typeof source.data !== 'string') throw new Error('not an LP source')
              const solved = loads.solved as Solved
              const model = {
                options: { set: (values: Record<string, unknown>) => loads.optionsSet.push(values) },
                info: { get: (name: string) => (name === 'primal_solution_status' ? solved.primalStatus : 0) },
                run: () => ('ran' in solved ? solved.ran : { status: 0, warnings: [], modelStatus: solved.modelStatus }),
                getModelStatus: () => solved.modelStatus,
                getDimensions: () => ({ numCols: solved.numCols ?? solved.values.length }),
                getObjectiveValue: () => solved.objective,
                getSolution: () => ({ colValue: Float64Array.from(solved.values) }),
                getColName: (index: number) => solved.names[index]!,
              }
              try {
                return operation(model)
              } finally {
                loads.disposed++
              }
            },
          }
        : {}),
    }
  },
}))

const PACK_YEAR = 2025
const PACK = packForYear(PACK_YEAR).pack

/**
 * One year, kept internally consistent (the year matches the pack it carries)
 * so nothing here misleads a later reader who reuses it. The numbers are not
 * the subject: the mocked loader stubs every solve, so what this fixture has
 * to do is reach `getHighs` at all.
 */
function input(): OptimizerInput {
  return {
    years: [
      {
        year: PACK_YEAR,
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
    loads.constants = { modelStatus: MODEL_STATUS, solutionStatus: SOLUTION_STATUS }
    loads.solved = OPTIMAL
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

describe('HiGHS solution reader', () => {
  it('publishes the solution doubles in cents, in a model disposed after each solve', async () => {
    loads.solved = OPTIMAL
    loads.optionsSet = []
    const disposedBefore = loads.disposed
    const solved = await optimizeSchedule(input())
    expect(solved.status).toBe('optimal')
    expect(solved.endingAfterTax).toBe(1_769_100.8)
    expect(solved.schedule[0]!.conversion).toBe(107_028.88)
    expect(solved.schedule[0]!.endTrad).toBe(1_756_817.79)
    expect(solved.conversions).toEqual([{ year: PACK_YEAR, amount: 107_028.88 }])
    expect(loads.optionsSet).toEqual([{ output_flag: false, time_limit: 60, mip_max_nodes: 5000 }])
    expect(loads.disposed).toBe(disposedBefore + 1)
  })

  it('reads the node limit by its status code, with the incumbent it found', async () => {
    loads.solved = { ...OPTIMAL, modelStatus: 16 }
    const solved = await optimizeSchedule(input())
    expect(solved.status).toBe('node-limit')
    expect(solved.schedule[0]!.conversion).toBe(107_028.88)
  })

  it('reads a solve with no primal point as no solution', async () => {
    loads.solved = { modelStatus: 8, primalStatus: 0, objective: Infinity, names: [], values: [] }
    const solved = await optimizeSchedule(input())
    expect(solved.status).toBe('infeasible')
    expect(solved.endingAfterTax).toBeNull()
    expect(solved.lifetimeTax).toBeNull()
    expect(solved.schedule).toEqual([])
  })

  it('fails closed when a solve cannot be read in full', async () => {
    const changed = "The highs package's solver interface changed"
    const unreadable: Solved[] = [
      { ...OPTIMAL, modelStatus: 99 },
      { ...OPTIMAL, primalStatus: 3 },
      { ...OPTIMAL, objective: Number.NaN },
      { ...OPTIMAL, values: [Number.NaN, 1] },
      { ...OPTIMAL, names: ['conv0', 'conv0'] },
      { ...OPTIMAL, names: ['conv0', ''] },
      // A solution short of the model's columns would read the rest as 0.
      { ...OPTIMAL, numCols: 3 },
      // A run that reports neither success nor a warning, or another status.
      { ...OPTIMAL, ran: undefined },
      { ...OPTIMAL, ran: { status: 2, modelStatus: 7 } },
      { ...OPTIMAL, ran: { status: 0, modelStatus: 8 } },
    ]
    for (const solved of unreadable) {
      loads.solved = solved
      await expect(optimizeSchedule(input()), JSON.stringify(solved)).rejects.toThrow(changed)
    }

    // A status that means HiGHS never solved the model is an error, not "no
    // solution": it would otherwise read as a plan no schedule funds.
    for (const modelStatus of [0, 1, 2, 3, 4, 5, 6]) {
      loads.solved = { ...OPTIMAL, modelStatus }
      await expect(optimizeSchedule(input()), String(modelStatus)).rejects.toThrow("HiGHS did not solve the optimizer's model")
    }

    // An infinite objective on a feasible point is the solve's answer, not a
    // changed interface, and is refused as such.
    loads.solved = { ...OPTIMAL, objective: Infinity }
    await expect(optimizeSchedule(input())).rejects.toThrow('A feasible solution must carry a finite objective')

    // The reader is unharmed: the next readable solve publishes.
    loads.solved = OPTIMAL
    expect((await optimizeSchedule(input())).status).toBe('optimal')
  })
})

describe('HiGHS module check at load', () => {
  it('refuses a module without the persistent model API or with renumbered or unnamed status codes, and does not cache the refusal', async () => {
    const changed = "The highs package's solver interface changed"
    const refusals: { hasWithModel: boolean; constants: unknown }[] = [
      { hasWithModel: false, constants: { modelStatus: MODEL_STATUS, solutionStatus: SOLUTION_STATUS } },
      { hasWithModel: true, constants: { modelStatus: { ...MODEL_STATUS, solutionLimit: 15 }, solutionStatus: SOLUTION_STATUS } },
      { hasWithModel: true, constants: { modelStatus: { ...MODEL_STATUS, presolveError: 6 }, solutionStatus: SOLUTION_STATUS } },
      { hasWithModel: true, constants: { modelStatus: { ...MODEL_STATUS, newLimit: 18 }, solutionStatus: SOLUTION_STATUS } },
      { hasWithModel: true, constants: { modelStatus: MODEL_STATUS, solutionStatus: { ...SOLUTION_STATUS, feasible: 1 } } },
      { hasWithModel: true, constants: undefined },
    ]
    for (const refusal of refusals) {
      // A fresh engine module graph, so its memo starts empty and the next
      // solve loads the stand-in again.
      vi.resetModules()
      const fresh = await import('./optimizer.js')
      loads.hasWithModel = refusal.hasWithModel
      loads.constants = refusal.constants
      loads.solved = OPTIMAL
      await expect(fresh.optimizeSchedule(input()), JSON.stringify(refusal)).rejects.toThrow(changed)
      // The refusal is not memoised: a module the reader can use loads next time.
      loads.hasWithModel = true
      loads.constants = { modelStatus: MODEL_STATUS, solutionStatus: SOLUTION_STATUS }
      expect((await fresh.optimizeSchedule(input())).status).toBe('optimal')
    }
  })
})
