/**
 * Sanitized render model for the household map: pixel positions, edge paths,
 * and formatted labels derived from the HouseholdGraph + layout. Under the
 * privacy toggle (`hideAmounts`) the produced model contains NO dollar
 * strings anywhere (test-enforced), so it is safe for screen sharing and
 * reusable for report embedding later. All figures are the plan's stored
 * values formatted here — no money math.
 */

import {
  personNodeId,
  type HouseholdEdge,
  type HouseholdGraph,
  type HouseholdNode,
  type HouseholdEditSurface,
} from './householdGraph'
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
  /**
   * True when the plan stores a dollar figure for this node — even while
   * amounts are hidden, so renderers can show a placeholder only where a real
   * amount is concealed (a person card never gets a "•••").
   */
  hasAmount: boolean
  completenessState: HouseholdNode['completeness']['state']
  missing: string[]
  /** Factual schema attachments (e.g. a property's HECM line of credit). */
  notes: string[]
  /**
   * This node's relationships, phrased for the accessible text list — every
   * edge kind and label, so topology never lives only in the aria-hidden SVG.
   */
  relations: string[]
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

/**
 * Traversal rule for person focus (documented in household-map.md):
 *  1. Seed with the person's OWN items — edges touching the focus person
 *     directly (what they own/receive; what covers, names, or unlocks them).
 *  2. Grow to a fixpoint along ATTACHMENT edges only (beneficiary, survivor,
 *     funds endpoints of already-kept nodes), so e.g. the estate destination
 *     of an annuity reached via a `funds` edge is kept regardless of plan
 *     entry order.
 * Ownership/receives edges are never re-traversed from kept non-focus nodes,
 * so a jointly held account never pulls in the other member or their side of
 * the map (persons are never the `from` of an attachment edge, so a person
 * added as a named beneficiary is a leaf).
 */
function connectedNodeIds(graph: HouseholdGraph, personNodeId: string): Set<string> {
  const keep = new Set<string>([personNodeId])
  for (const e of graph.edges) {
    if (e.from === personNodeId && (e.kind === 'owns' || e.kind === 'receives')) keep.add(e.to)
    if (e.to === personNodeId && (e.kind === 'covers' || e.kind === 'formerSpouseOf' || e.kind === 'beneficiary')) {
      keep.add(e.from)
    }
  }
  // Fixpoint over attachment edges: repeat until no growth, so the result is
  // independent of the order entities appear in the plan.
  let grew = true
  while (grew) {
    grew = false
    for (const e of graph.edges) {
      if (keep.has(e.from) && !keep.has(e.to) && (e.kind === 'beneficiary' || e.kind === 'survivor' || e.kind === 'funds')) {
        keep.add(e.to)
        grew = true
      }
      if (keep.has(e.to) && !keep.has(e.from) && e.kind === 'funds') {
        keep.add(e.from)
        grew = true
      }
    }
  }
  return keep
}

export function buildMapViewModel(graph: HouseholdGraph, options: MapViewOptions = {}): HouseholdMapViewModel {
  const hideAmounts = options.hideAmounts === true

  // Filter the graph first, then lay out, so the visible picture is compact.
  let nodes = graph.nodes
  if (options.focusPersonId) {
    const keep = connectedNodeIds(graph, personNodeId(options.focusPersonId))
    nodes = nodes.filter((n) => keep.has(n.id))
  }
  if (options.visibleColumns) {
    const visible = new Set<MapColumnId>([...options.visibleColumns, 'people'])
    nodes = nodes.filter((n) => visible.has(columnForKind(n.kind)))
  }
  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges = graph.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to))
  const layout = layoutHouseholdGraph({ ...graph, nodes, edges })

  const labelById = new Map(nodes.map((n) => [n.id, n.label]))
  const edgeAnnotation = (e: (typeof edges)[number]): string => {
    const parts = [e.label, e.joint ? 'joint' : undefined].filter((p): p is string => p !== undefined)
    return parts.length > 0 ? ` (${parts.join(' · ')})` : ''
  }
  /** Phrase every edge touching a node, so topology survives without the SVG. */
  const relationsOf = (nodeId: string): string[] => {
    const phrases: string[] = []
    for (const e of edges) {
      const note = edgeAnnotation(e)
      if (e.from === nodeId) {
        const to = labelById.get(e.to) ?? e.to
        if (e.kind === 'owns') phrases.push(`Owns ${to}${note}`)
        else if (e.kind === 'receives') phrases.push(`Receives ${to}${note}`)
        else if (e.kind === 'covers') phrases.push(`Covers ${to}${note}`)
        else if (e.kind === 'beneficiary') phrases.push(`Passes to ${to}${note}`)
        else if (e.kind === 'survivor') phrases.push(`Survivor continuation to ${to}${note}`)
        else if (e.kind === 'funds') phrases.push(`Funds ${to}${note}`)
        else phrases.push(`Benefit source for ${to}${note}`)
      } else if (e.to === nodeId) {
        const from = labelById.get(e.from) ?? e.from
        if (e.kind === 'owns') phrases.push(`Owned by ${from}${note}`)
        else if (e.kind === 'receives') phrases.push(`Received by ${from}${note}`)
        else if (e.kind === 'covers') phrases.push(`Covered by ${from}${note}`)
        else if (e.kind === 'beneficiary') phrases.push(`Beneficiary of ${from}${note}`)
        else if (e.kind === 'survivor') phrases.push(`Survivor continuation from ${from}${note}`)
        else if (e.kind === 'funds') phrases.push(`Funded by ${from}${note}`)
        else phrases.push(`Has former-spouse record: ${from}${note}`)
      }
    }
    return phrases
  }

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
    const notesText = node.notes.length > 0 ? `, ${node.notes.join('; ')}` : ''
    return {
      id: node.id,
      kind: node.kind,
      label: node.label,
      typeLabel: subtypeLabel(node),
      amountText: amount,
      hasAmount: node.amount !== null,
      completenessState: node.completeness.state,
      missing: node.completeness.missing,
      notes: node.notes,
      relations: relationsOf(node.id),
      to: EDIT_SURFACE_ROUTES[node.editSurface],
      ariaLabel: `${node.label}, ${subtypeLabel(node)}${amount ? `, ${amount}` : hideAmounts && node.amount !== null ? ', amount hidden' : ''}${notesText}${flags}`,
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
