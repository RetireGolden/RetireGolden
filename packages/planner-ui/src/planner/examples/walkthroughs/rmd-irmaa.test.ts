import { describe, expect, it } from 'vitest'

import { RMD_IRMAA_WALKTHROUGH } from './rmdIrmaa.walkthrough'
import { runWalkthrough } from './walkthrough'

/**
 * Holds the engine to the hand tables in rmdIrmaa.walkthrough.ts: every row's
 * engine figure equals the hand value, numbers within the row's tolerance
 * (half a cent unless the figure's contract promises less) and strings
 * exactly. The it() title is what the engine's walkthrough census publishes
 * for this id.
 */
describe('walkthrough: high balances, RMDs and IRMAA', () => {
  it('year 2026 of the RMD-and-IRMAA example equals the hand table', () => {
    const { tables } = runWalkthrough(RMD_IRMAA_WALKTHROUGH)
    expect(tables.map((table) => table.year)).toEqual([2026])
    for (const table of tables) {
      expect(table.rows.length, String(table.year)).toBeGreaterThan(20)
      const keys = new Set(table.rows.map((row) => row.key))
      expect(keys.size, String(table.year)).toBe(table.rows.length)
      for (const row of table.rows) {
        const at = `${table.year} ${row.key}: engine ${String(row.engine)} vs hand ${String(row.hand)}`
        if (typeof row.hand === 'number') {
          expect(row.engine, at).toBeTypeOf('number')
          expect(Math.abs((row.engine as number) - row.hand), at).toBeLessThanOrEqual(row.tolerance)
        } else {
          expect(row.engine, at).toBe(row.hand)
        }
      }
    }
  })
})
