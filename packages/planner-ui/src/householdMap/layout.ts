/**
 * Deterministic layered layout for the household map. Pure data → data:
 * fixed columns (People → Income → Accounts → Property & debt → Protection &
 * estate), rows follow the graph's node order (which follows plan entry
 * order), so the same plan always produces the identical layout and an
 * unrelated edit never shuffles the picture. The layout carries no dollar
 * values — only node identity and grid positions.
 */

import type { HouseholdGraph, HouseholdNodeKind } from '@retiregolden/engine/household/householdGraph'

export type MapColumnId = 'people' | 'income' | 'accounts' | 'propertyDebt' | 'protection'

export const MAP_COLUMN_ORDER: readonly MapColumnId[] = ['people', 'income', 'accounts', 'propertyDebt', 'protection']

export const MAP_COLUMN_LABELS: Record<MapColumnId, string> = {
  people: 'People',
  income: 'Income',
  accounts: 'Accounts',
  propertyDebt: 'Property & debt',
  protection: 'Protection & estate',
}

const KIND_TO_COLUMN: Record<HouseholdNodeKind, MapColumnId> = {
  person: 'people',
  formerSpouse: 'people',
  income: 'income',
  guaranteedIncome: 'income',
  ladder: 'income',
  account: 'accounts',
  property: 'propertyDebt',
  debt: 'propertyDebt',
  insurance: 'protection',
  estate: 'protection',
}

export interface MapColumn {
  id: MapColumnId
  label: string
  /** Node ids in row order (graph order = plan entry order). */
  nodeIds: string[]
}

export interface NodePosition {
  /** Index into `columns` (only non-empty columns are kept). */
  col: number
  row: number
}

export interface HouseholdMapLayout {
  columns: MapColumn[]
  positions: Record<string, NodePosition>
  /** Height of the tallest column, in rows. */
  rowCount: number
}

export function columnForKind(kind: HouseholdNodeKind): MapColumnId {
  return KIND_TO_COLUMN[kind]
}

export function layoutHouseholdGraph(graph: HouseholdGraph): HouseholdMapLayout {
  const byColumn = new Map<MapColumnId, string[]>(MAP_COLUMN_ORDER.map((id) => [id, []]))
  for (const node of graph.nodes) {
    byColumn.get(KIND_TO_COLUMN[node.kind])!.push(node.id)
  }
  const columns: MapColumn[] = []
  const positions: Record<string, NodePosition> = {}
  let rowCount = 0
  for (const id of MAP_COLUMN_ORDER) {
    const nodeIds = byColumn.get(id)!
    if (nodeIds.length === 0) continue
    const col = columns.length
    columns.push({ id, label: MAP_COLUMN_LABELS[id], nodeIds })
    nodeIds.forEach((nodeId, row) => {
      positions[nodeId] = { col, row }
    })
    rowCount = Math.max(rowCount, nodeIds.length)
  }
  return { columns, positions, rowCount }
}
