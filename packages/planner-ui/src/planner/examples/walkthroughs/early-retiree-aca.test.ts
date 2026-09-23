import { describe, expect, it } from 'vitest'

import { EARLY_RETIREE_ACA_WALKTHROUGH } from './earlyRetireeAca.walkthrough'
import { runWalkthrough } from './walkthrough'

/**
 * Holds the engine to the hand tables in earlyRetireeAca.walkthrough.ts:
 * every row's engine figure equals the hand value, numbers within the row's
 * tolerance (half a cent, or $0.01 where the contract sizes by bisection) and
 * strings exactly. The it() title is what the engine's walkthrough census
 * publishes for this id.
 */
describe('walkthrough: early retiree and the ACA cliff', () => {
  it('year 2026 of the early-retiree ACA example equals the hand table', () => {
    const { tables } = runWalkthrough(EARLY_RETIREE_ACA_WALKTHROUGH)
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
