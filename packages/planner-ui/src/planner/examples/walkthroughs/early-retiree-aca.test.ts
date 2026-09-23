import { describe, expect, it } from 'vitest'

import { EARLY_RETIREE_ACA_WALKTHROUGH } from './earlyRetireeAca.walkthrough'
import { runWalkthrough, walkthroughRowProblem } from './walkthrough'

/**
 * Holds the engine to the hand tables in earlyRetireeAca.walkthrough.ts:
 * every row's engine figure equals the hand value, strings exactly and
 * numbers within the row's tolerance (half a cent, or at most $0.01 below the
 * exact value for the two figures the contract sizes by bisection). The it()
 * title is what the engine's walkthrough census publishes for this id.
 */
describe('walkthrough: early retiree and the ACA cliff', () => {
  it('years 2026 and 2027 of the early-retiree ACA example equal the hand tables', () => {
    const { tables } = runWalkthrough(EARLY_RETIREE_ACA_WALKTHROUGH)
    expect(tables.map((table) => table.year)).toEqual([2026, 2027])
    for (const table of tables) {
      expect(table.rows.length, String(table.year)).toBeGreaterThan(20)
      const keys = new Set(table.rows.map((row) => row.key))
      expect(keys.size, String(table.year)).toBe(table.rows.length)
      const problems = table.rows
        .map((row) => walkthroughRowProblem(row, `${table.year} ${row.key}`))
        .filter((problem): problem is string => problem !== null)
      expect(problems).toEqual([])
    }
  })
})
