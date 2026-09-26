/**
 * The engine display functions the Results table reads never throw on a real
 * ledger, and the figures stay in their domains (check-report correction 8).
 * A throw from a display function would take down the whole Results table,
 * so every example plan's every year is run through `yearDisplayFigures`:
 * net care cost is never negative (the floor absorbs only a last-place
 * residue; anything larger is refused by the engine), and every year carries
 * a finite, non-negative tax-free gains room.
 */
import { describe, expect, it } from 'vitest'

import { projectionDisplayFigures, yearDisplayFigures } from '@retiregolden/engine/projection/yearFigures'
import { projectPlan } from '../projection'
import { EXAMPLE_PLANS } from './examples/registry'

describe('yearDisplayFigures on every example ledger', () => {
  it.each(EXAMPLE_PLANS.map((example) => [example.id, example] as const))('%s', (_id, example) => {
    const plan = example.build()
    const view = projectPlan(plan, 2026)
    const problems: string[] = []
    for (const row of view.result.years) {
      try {
        const figures = yearDisplayFigures(plan, row)
        if (!(figures.netCareCost >= 0)) problems.push(`${row.year}: net care ${figures.netCareCost}`)
        const room = figures.taxFreeGainsRoom
        if (room === null || !Number.isFinite(room) || room < 0) problems.push(`${row.year}: gains room ${room}`)
      } catch (error) {
        problems.push(`${row.year}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    expect(problems).toEqual([])
    expect(projectionDisplayFigures(plan, view.result)).toHaveLength(view.result.years.length)
  })
})
