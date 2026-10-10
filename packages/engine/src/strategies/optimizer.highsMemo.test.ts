/**
 * The HiGHS loader is memoised per process/worker, so its failure policy is
 * the thing worth testing rather than any number: a transient load failure
 * must not be cached. This file lives apart from `optimizer.test.ts` because
 * the memo is module state and `vi.mock('highs', ...)` has to replace the
 * real solver for the whole module graph, which those golden tests need.
 *
 * The same stand-in module carries the engine's raw-solution reader's failure
 * policy: the engine publishes only what HiGHS's raw solution says, so a
 * module whose writer it cannot wrap, or whose raw solution does not parse,
 * fails the solve with an error rather than falling back to the highs
 * package's six-digit parse.
 */

import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'

import { packForYear } from '../params/index.js'
import type { FilingStatus } from '../params/types.js'
import { optimizeSchedule, type OptimizerInput } from './optimizer.js'

/** A raw solution as `Highs_writeSolution` prints it, with two solved columns. */
const OPTIMAL_RAW = [
  'Model status',
  'Optimal',
  '',
  '# Primal solution values',
  'Feasible',
  'Objective 1769100.802718',
  '# Columns 2',
  'conv0 107028.8775',
  'trad1 1756817.79',
  '# Rows 0',
  '',
  '# Dual solution values',
  'None',
]

const loads = vi.hoisted(() => ({
  attempts: 0,
  /** What the stand-in's raw writer prints, and returns. */
  raw: [] as string[],
  rawStatus: 0,
  /** Whether the stand-in's solve calls the pretty writer the engine wraps. */
  callsWriter: true,
}))

vi.mock('highs', () => ({
  // The real package ships CJS with an `export default` loader that resolves
  // to the wasm module. Fail the first load the way a fetch/instantiate error
  // does, then succeed, so the memo's behavior across the two is observable.
  // The module it resolves to has what the engine's reader uses: `cwrap`, a
  // `Highs_writeSolutionPretty` property its `solve` looks up when it calls
  // it, and a `print` channel the raw writer prints through.
  default: async (options: { print: (line: string) => void }) => {
    loads.attempts++
    if (loads.attempts === 1) throw new Error('transient wasm load failure')
    const module = {
      cwrap: (name: string) =>
        name === 'Highs_writeSolution'
          ? () => {
              for (const line of loads.raw) options.print(line)
              return loads.rawStatus
            }
          : () => 0,
      Highs_writeSolutionPretty: (() => 0) as unknown,
      solve: () => {
        if (loads.callsWriter) (module.Highs_writeSolutionPretty as (highs: number, file: string) => number)(1, '/solution')
        return { Status: 'Optimal', ObjectiveValue: 1_769_100.8, Columns: {} }
      },
    }
    return module
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
    loads.raw = OPTIMAL_RAW
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

describe('HiGHS raw solution reader', () => {
  it('publishes the raw solution, not the package\'s parse of the pretty print', async () => {
    loads.raw = OPTIMAL_RAW
    const solved = await optimizeSchedule(input())
    expect(solved.status).toBe('optimal')
    // 1769100.802718 rounds to cents; the stand-in package's own parse says 1769100.8.
    expect(solved.endingAfterTax).toBe(1_769_100.8)
    expect(solved.schedule[0]!.conversion).toBe(107_028.88)
    expect(solved.schedule[0]!.endTrad).toBe(1_756_817.79)
    expect(solved.conversions).toEqual([{ year: PACK_YEAR, amount: 107_028.88 }])
  })

  it('reads a solve with no primal point as no solution', async () => {
    loads.raw = ['Model status', 'Infeasible', '', '# Primal solution values', 'None', '', '# Dual solution values', 'None']
    const solved = await optimizeSchedule(input())
    expect(solved.status).toBe('infeasible')
    expect(solved.endingAfterTax).toBeNull()
    expect(solved.lifetimeTax).toBeNull()
    expect(solved.schedule).toEqual([])
  })

  it('fails closed when the raw solution is missing or does not parse', async () => {
    const changed = "The highs package's solution writer changed"
    const unreadable: string[][] = [
      [],
      ['Model status', 'Optimal', '', '# Primal solution values', 'Feasible', 'Objective 12', '# Columns 1', 'conv0 1.0e3x'],
      ['Model status', 'Optimal', '', '# Primal solution values', 'Feasible', '# Columns 0'],
      ['Model status', 'Optimal', '', '# Primal solution values', 'Feasible', 'Objective 1', '# Columns 2', 'conv0 1'],
      ['Model status', 'Optimal', '', '# Primal solution values', 'Unknown'],
      ['Model status', 'Optimal', '', '# Primal solution values', 'Feasible', 'Objective inf', '# Columns 0'],
    ]
    for (const raw of unreadable) {
      loads.raw = raw
      await expect(optimizeSchedule(input()), raw.join(' | ')).rejects.toThrow(changed)
    }

    loads.raw = OPTIMAL_RAW
    loads.rawStatus = -1
    await expect(optimizeSchedule(input())).rejects.toThrow(changed)
    loads.rawStatus = 0

    loads.callsWriter = false
    await expect(optimizeSchedule(input())).rejects.toThrow(changed)
    loads.callsWriter = true

    // The reader is unharmed: the next readable solve publishes.
    expect((await optimizeSchedule(input())).status).toBe('optimal')
  })
})
