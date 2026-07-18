/**
 * Sanitized render model for the household map: pixel positions, edge paths,
 * and formatted labels derived from the HouseholdGraph + layout. Under the
 * privacy toggle (`hideAmounts`) the produced model contains NO dollar
 * strings anywhere (test-enforced), so it is safe for screen sharing and
 * reusable for report embedding later. All figures are the plan's stored
 * values formatted here — no money math.
 */

import type {
  HouseholdEdge,
  HouseholdGraph,
  HouseholdNode,
  HouseholdEditSurface,
} from '@retiregolden/engine/household/householdGraph'
import { fmtMoney } from '../planner/format'
import { columnForKind, layoutHouseholdGraph, type MapColumnId } from './layout'

// --- geometry (px) ----------------------------------------------------------

export const NODE_W = 176
export const NODE_H = 64
export const COL_GAP = 72
export const ROW_GAP = 16
/** Vertical room for the column headings above row 0. */
export const HEADER_H = 34

// --- vocabulary -------------------------------------------------------------

/** Planner route segment (relative to /plan/:planId/) per edit surface. */
export const EDIT_SURFACE_ROUTES: Record<HouseholdEditSurface, string> = {
  household: 'household',
  socialSecurity: 'social-security',
  accounts: 'accounts',
  insurance: 'insurance',
  income: 'income',
  incomeFloor: 'income-floor',
}

/** Human vocabulary per node subtype (falls back to the subtype itself). */
const SUBTYPE_LABELS: Record<string, string> = {
  person: 'Person',
  divorced: 'Divorced-spousal record',
  deceased: 'Survivor record',
  wages: 'Wages',
  socialSecurity: 'Social Security',
  recurring: 'Recurring income',
  oneTime: 'One-time income',
  pension: 'Pension',
  annuity: 'Annuity',
  cash: 'Cash',
  taxable: 'Brokerage',
  equityComp: 'Equity comp',
  traditional: 'Traditional',
  roth: 'Roth',
  hsa: 'HSA',
  property: 'Property',
  debt: 'Debt',
  ltc: 'Long-term care',
  permanentLife: 'Permanent life',
  bridge: 'TIPS ladder (SS bridge)',
  floor: 'TIPS ladder (floor)',
  spouse: 'Estate destination',
  heir: 'Estate destination',
  charity: 'Estate destination',
  estate: 'Estate destination',
}

const AMOUNT_SUFFIX: Record<string, string> = {
  balance: '',
  value: '',
  owed: ' owed',
  annualIncome: '/yr',
  oneTimeAmount: ' one-time',
  monthlyBenefit: '/mo',
  deathBenefit: ' death benefit',
}

export function subtypeLabel(node: Pick<HouseholdNode, 'subtype'>): string {
  return SUBTYPE_LABELS[node.subtype] ?? node.subtype
}

export function amountText(node: Pick<HouseholdNode, 'amount' | 'amountKind'>): string | null {
  if (node.amount === null || node.amountKind === null) return null
  return `${fmtMoney(node.amount)}${AMOUNT_SUFFIX[node.amountKind] ?? ''}`
}

// --- view model -------------------------------------------------------------

export interface MapNodeVM {
  id: string
  kind: HouseholdNode['kind']
  label: string
  typeLabel: string
  /** Formatted stored amount; null when the node has none or amounts are hidden. */
  amountText: string | null
  completenessState: HouseholdNode['completeness']['state']
  missing: string[]
  /** Route segment relative to the plan root, for the deep link. */
  to: string
  /** Accessible name: full label + type + amount/hidden state + flags. */
  ariaLabel: string
  x: number
  y: number
  w: number
  h: number
  col: number
  row: number
}

export interface MapEdgeVM {
  id: string
  kind: HouseholdEdge['kind']
  label: string | undefined
  from: string
  to: string
  /** SVG path between the two node cards. */
  path: string
  /** Midpoint for the optional edge label. */
  labelX: number
  labelY: number
}

export interface MapColumnVM {
  id: MapColumnId
  label: string
  x: number
}

export interface MapTotalsVM {
  assetsText: string
  liabilitiesText: string
  netWorthText: string
}

export interface HouseholdMapViewModel {
  nodes: MapNodeVM[]
  edges: MapEdgeVM[]
  columns: MapColumnVM[]
  width: number
  height: number
  /** Null when amounts are hidden — the hidden model carries no dollar strings. */
  totals: MapTotalsVM | null
  amountsHidden: boolean
}

export interface MapViewOptions {
  hideAmounts?: boolean
  /** Restrict to nodes connected to this person (plus the person). */
  focusPersonId?: string | null
  /** Column groups to show; omitted = all. The People column is always kept. */
  visibleColumns?: readonly MapColumnId[] | null
}

function nodeXY(pos: { col: number; row: number }): { x: number; y: number } {
  return { x: pos.col * (NODE_W + COL_GAP), y: HEADER_H + pos.row * (NODE_H + ROW_GAP) }
}

function edgePath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  // Anchor on the facing sides; midway-control-point cubic for readability.
  const fromRight = from.x <= to.x
  const x1 = fromRight ? from.x + NODE_W : from.x
  const y1 = from.y + NODE_H / 2
  const x2 = fromRight ? to.x : to.x + NODE_W
  const y2 = to.y + NODE_H / 2
  if (Math.abs(x1 - x2) < 1) {
    // Same column: arc out to the left of the cards.
    const bow = NODE_H
    return `M ${x1} ${y1} C ${x1 - bow} ${y1}, ${x2 - bow} ${y2}, ${x2} ${y2}`
  }
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

function connectedNodeIds(graph: HouseholdGraph, personNodeId: string): Set<string> {
  const keep = new Set<string>([personNodeId])
  // The person's own items: what they own/receive, what covers or names them.
  // Deliberately not transitive through jointly-held items — focusing on one
  // member must not pull in the other member's whole side of the map.
  for (const e of graph.edges) {
    if (e.from === personNodeId && (e.kind === 'owns' || e.kind === 'receives')) keep.add(e.to)
    if (e.to === personNodeId && (e.kind === 'covers' || e.kind === 'formerSpouseOf' || e.kind === 'beneficiary')) {
      keep.add(e.from)
    }
  }
  // Attachments of the kept items: estate destinations, survivor
  // continuations, funding flows, and named beneficiaries.
  for (const e of graph.edges) {
    if (keep.has(e.from) && (e.kind === 'beneficiary' || e.kind === 'survivor' || e.kind === 'funds')) keep.add(e.to)
    if (keep.has(e.to) && e.kind === 'funds') keep.add(e.from)
  }
  return keep
}

export function buildMapViewModel(graph: HouseholdGraph, options: MapViewOptions = {}): HouseholdMapViewModel {
  const hideAmounts = options.hideAmounts === true

  // Filter the graph first, then lay out, so the visible picture is compact.
  let nodes = graph.nodes
  if (options.focusPersonId) {
    const keep = connectedNodeIds(graph, `person:${options.focusPersonId}`)
    nodes = nodes.filter((n) => keep.has(n.id))
  }
  if (options.visibleColumns) {
    const visible = new Set<MapColumnId>([...options.visibleColumns, 'people'])
    nodes = nodes.filter((n) => visible.has(columnForKind(n.kind)))
  }
  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges = graph.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to))
  const layout = layoutHouseholdGraph({ ...graph, nodes, edges })

  const nodeVMs: MapNodeVM[] = nodes.map((node) => {
    const pos = layout.positions[node.id]!
    const { x, y } = nodeXY(pos)
    const amount = hideAmounts ? null : amountText(node)
    const flags =
      node.completeness.state === 'complete'
        ? ''
        : node.completeness.state === 'unknown'
          ? `, cannot be estimated: ${node.completeness.missing.join('; ')}`
          : `, needs attention: ${node.completeness.missing.join('; ')}`
    return {
      id: node.id,
      kind: node.kind,
      label: node.label,
      typeLabel: subtypeLabel(node),
      amountText: amount,
      completenessState: node.completeness.state,
      missing: node.completeness.missing,
      to: EDIT_SURFACE_ROUTES[node.editSurface],
      ariaLabel: `${node.label}, ${subtypeLabel(node)}${amount ? `, ${amount}` : hideAmounts && node.amount !== null ? ', amount hidden' : ''}${flags}`,
      x,
      y,
      w: NODE_W,
      h: NODE_H,
      col: pos.col,
      row: pos.row,
    }
  })

  const posById = new Map(nodeVMs.map((n) => [n.id, n]))
  const edgeVMs: MapEdgeVM[] = edges.map((e) => {
    const from = posById.get(e.from)!
    const to = posById.get(e.to)!
    return {
      id: e.id,
      kind: e.kind,
      label: e.joint ? (e.label ? `${e.label} · joint` : 'joint') : e.label,
      from: e.from,
      to: e.to,
      path: edgePath(from, to),
      labelX: (from.x + to.x + NODE_W) / 2,
      labelY: (from.y + to.y + NODE_H) / 2,
    }
  })

  const columns: MapColumnVM[] = layout.columns.map((c, i) => ({
    id: c.id,
    label: c.label,
    x: i * (NODE_W + COL_GAP),
  }))

  const width = layout.columns.length * NODE_W + Math.max(0, layout.columns.length - 1) * COL_GAP
  const height = HEADER_H + layout.rowCount * NODE_H + Math.max(0, layout.rowCount - 1) * ROW_GAP

  return {
    nodes: nodeVMs,
    edges: edgeVMs,
    columns,
    width,
    height,
    totals: hideAmounts
      ? null
      : {
          assetsText: fmtMoney(graph.totals.assets),
          liabilitiesText: fmtMoney(graph.totals.liabilities),
          netWorthText: fmtMoney(graph.totals.netWorth),
        },
    amountsHidden: hideAmounts,
  }
}
