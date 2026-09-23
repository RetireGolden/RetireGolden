import { describe, expect, it } from 'vitest'

import { RMD_IRMAA_WALKTHROUGH } from './rmdIrmaa.walkthrough'
import { runWalkthrough, walkthroughRowProblem } from './walkthrough'

/**
 * Holds the engine to the hand tables in rmdIrmaa.walkthrough.ts: every row's
 * engine figure equals the hand value, strings exactly and numbers within the
 * row's tolerance (half a cent unless the figure's contract promises less,
 * one-sided where the contract returns a lower bound). The it() title is what
 * the engine's walkthrough census publishes for this id.
 */
describe('walkthrough: high balances, RMDs and IRMAA', () => {
  it('years 2026 and 2028 of the RMD-and-IRMAA example equal the hand tables', () => {
    const { tables } = runWalkthrough(RMD_IRMAA_WALKTHROUGH)
    expect(tables.map((table) => table.year)).toEqual([2026, 2028])
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
