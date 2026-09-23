import { describe, expect, it } from 'vitest'

import { BRACKET_FILL_ROTH_WALKTHROUGH } from './bracketFillRoth.walkthrough'
import { runWalkthrough, walkthroughRowProblem } from './walkthrough'

/**
 * Holds the engine to the hand tables in bracketFillRoth.walkthrough.ts:
 * every row's engine figure equals the hand value, strings exactly and
 * numbers within the row's tolerance (half a cent, or at most $0.01 below the
 * exact root for the household conversion the contract sizes by bisection).
 * The it() title is what the engine's walkthrough census publishes for this id.
 */
describe('walkthrough: bracket-fill Roth conversions', () => {
  it('year 2026 of the bracket-fill Roth example equals the hand table', () => {
    const { tables } = runWalkthrough(BRACKET_FILL_ROTH_WALKTHROUGH)
    expect(tables.map((table) => table.year)).toEqual([2026])
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
