import { describe, expect, it } from 'vitest'

import { buildHouseholdGraph } from '@retiregolden/engine/household/householdGraph'
import { buildExampleCouple } from '../planner/examples/buildExampleCouple'
import { buildUnderSavedSingle } from '../planner/examples/buildUnderSavedSingle'
import { layoutHouseholdGraph, MAP_COLUMN_ORDER } from './layout'

describe('layoutHouseholdGraph', () => {
  it('is deterministic: the same plan always produces the identical layout', () => {
    const a = layoutHouseholdGraph(buildHouseholdGraph(buildExampleCouple()))
    const b = layoutHouseholdGraph(buildHouseholdGraph(buildExampleCouple()))
    expect(a).toEqual(b)
  })

  it('places every node exactly once, in column order, with dense rows', () => {
    const graph = buildHouseholdGraph(buildExampleCouple())
    const layout = layoutHouseholdGraph(graph)
    expect(Object.keys(layout.positions).sort()).toEqual(graph.nodes.map((n) => n.id).sort())
    // Column ids appear in the fixed order (empty columns dropped).
    const order = layout.columns.map((c) => c.id)
    expect(order).toEqual(MAP_COLUMN_ORDER.filter((id) => order.includes(id)))
    // Rows are dense per column: 0..n-1 in nodeIds order.
    for (const [colIndex, column] of layout.columns.entries()) {
      column.nodeIds.forEach((nodeId, row) => {
        expect(layout.positions[nodeId]).toEqual({ col: colIndex, row })
      })
    }
    expect(layout.rowCount).toBe(Math.max(...layout.columns.map((c) => c.nodeIds.length)))
  })

  it('an unrelated addition never reorders existing nodes within their columns', () => {
    const base = buildExampleCouple()
    const before = layoutHouseholdGraph(buildHouseholdGraph(base))
    const withExtra = buildExampleCouple()
    withExtra.accounts = [
      ...withExtra.accounts,
      {
        type: 'cash',
        id: 'new-cash',
        name: 'New savings',
        ownerPersonId: null,
        annualReturnPct: 1,
        balance: 5_000,
        annualContribution: 0,
      },
    ]
    const after = layoutHouseholdGraph(buildHouseholdGraph(withExtra))
    for (const column of before.columns) {
      const afterColumn = after.columns.find((c) => c.id === column.id)!
      // Existing ids keep their relative order (the new id appends).
      expect(afterColumn.nodeIds.filter((id) => column.nodeIds.includes(id))).toEqual(column.nodeIds)
    }
  })

  it('stable snapshot: the example couple layout', () => {
    const layout = layoutHouseholdGraph(buildHouseholdGraph(buildExampleCouple()))
    expect(layout.columns.map((c) => ({ id: c.id, nodeIds: c.nodeIds }))).toMatchSnapshot()
  })

  it('stable snapshot: the under-saved single layout', () => {
    const layout = layoutHouseholdGraph(buildHouseholdGraph(buildUnderSavedSingle()))
    expect(layout.columns.map((c) => ({ id: c.id, nodeIds: c.nodeIds }))).toMatchSnapshot()
  })
})
