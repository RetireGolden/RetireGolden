/**
 * Deterministic grouping policy for the year cash-flow Sankey.
 *
 * Person/account lines stay distinct by default. Lines whose published amount
 * is below a share of their side total MAY collapse into one `Other (n)` node
 * per (side, kind, person) group. Collapse never mixes two spouses, two
 * kinds, or an unresolved Plan reference into household cash (or into anyone
 * else's Other). `showAll` disables collapsing entirely.
 *
 * The accessible table always lists every underlying engine line; grouping
 * rewrites only the visual nodes/links. Amounts on a collapsed node are the
 * exact sum of the published engine amounts of its members — presentation
 * aggregation, not a recomputation.
 *
 * @see DOCS/features/year-cash-flow.md
 */

import type { YearCashFlowSankeyLink, YearCashFlowSankeyNode } from './buildYearCashFlow'

/** Lines below this share of their side total are eligible to collapse. */
export const YEAR_CASH_FLOW_COLLAPSE_THRESHOLD_SHARE = 0.01

export interface YearCashFlowGroupingOptions {
  /** When true, every line stays its own node. */
  readonly showAll?: boolean
  /** Override the default {@link YEAR_CASH_FLOW_COLLAPSE_THRESHOLD_SHARE}. */
  readonly collapseThresholdShare?: number
}

const COLLAPSIBLE_SIDES = new Set(['source', 'fundedUse', 'unfundedUse'])

function groupKey(node: YearCashFlowSankeyNode): string {
  return `${node.side}\0${node.kind}\0${node.personKey}`
}

function otherNodeId(node: YearCashFlowSankeyNode): string {
  return `other:${node.side}:${node.kind}:${node.personKey}`
}

function otherLabel(node: YearCashFlowSankeyNode, n: number): string {
  const body = `Other (${n}) — ${node.kindLabel}`
  if (node.personKey === 'household') return body
  return `${node.personLabel} — ${body}`
}

function uniqueSorted(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/**
 * Collapse small same-kind, same-person nodes on the household-cash Sankey.
 * Transfer endpoints are left distinct: merging destinations would hide where
 * the dollars went. Unresolved nodes are never collapsed.
 */
export function applyYearCashFlowGrouping(
  view: {
    readonly nodes: readonly YearCashFlowSankeyNode[]
    readonly links: readonly YearCashFlowSankeyLink[]
  },
  options: YearCashFlowGroupingOptions = {},
): {
  readonly nodes: readonly YearCashFlowSankeyNode[]
  readonly links: readonly YearCashFlowSankeyLink[]
} {
  if (options.showAll === true) {
    return { nodes: view.nodes, links: view.links }
  }
  const threshold = options.collapseThresholdShare ?? YEAR_CASH_FLOW_COLLAPSE_THRESHOLD_SHARE

  const sideTotals = new Map<string, number>()
  for (const node of view.nodes) {
    if (!COLLAPSIBLE_SIDES.has(node.side)) continue
    sideTotals.set(node.side, (sideTotals.get(node.side) ?? 0) + node.amountPlanDollars)
  }

  const groups = new Map<string, YearCashFlowSankeyNode[]>()
  for (const node of view.nodes) {
    if (!COLLAPSIBLE_SIDES.has(node.side) || node.unresolved || node.collapsed) continue
    const key = groupKey(node)
    const members = groups.get(key)
    if (members) members.push(node)
    else groups.set(key, [node])
  }

  const collapsedToOther = new Map<string, string>()
  const otherById = new Map<string, YearCashFlowSankeyNode>()

  for (const members of groups.values()) {
    const sideTotal = sideTotals.get(members[0]!.side) ?? 0
    if (sideTotal <= 0) continue
    const eligible = members.filter((node) => node.amountPlanDollars < threshold * sideTotal)
    if (eligible.length < 2) continue
    const representative = eligible.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0]!
    const id = otherNodeId(representative)
    const underlyingLineIds = uniqueSorted(eligible.flatMap((node) => node.underlyingLineIds))
    let amountPlanDollars = 0
    for (const node of eligible) amountPlanDollars += node.amountPlanDollars
    const other: YearCashFlowSankeyNode = {
      id,
      view: representative.view,
      side: representative.side,
      role: representative.role,
      kind: representative.kind,
      kindLabel: representative.kindLabel,
      personKey: representative.personKey,
      personLabel: representative.personLabel,
      label: otherLabel(representative, eligible.length),
      amountPlanDollars,
      underlyingLineIds,
      unresolved: false,
      collapsed: true,
      flag: representative.flag,
    }
    otherById.set(id, other)
    for (const node of eligible) collapsedToOther.set(node.id, id)
  }

  if (collapsedToOther.size === 0) {
    return { nodes: view.nodes, links: view.links }
  }

  const emittedOther = new Set<string>()
  const nodes: YearCashFlowSankeyNode[] = []
  for (const node of view.nodes) {
    const otherId = collapsedToOther.get(node.id)
    if (otherId === undefined) {
      nodes.push(node)
      continue
    }
    if (emittedOther.has(otherId)) continue
    emittedOther.add(otherId)
    nodes.push(otherById.get(otherId)!)
  }

  function linkLabelsForEndpoints(
    source: string,
    target: string,
    link: Pick<YearCashFlowSankeyLink, 'kindLabel' | 'lineLabel'>,
  ): Pick<YearCashFlowSankeyLink, 'kindLabel' | 'lineLabel'> {
    const sourceOther = otherById.get(source)
    if (sourceOther !== undefined) {
      return { lineLabel: sourceOther.label, kindLabel: sourceOther.kindLabel }
    }
    const targetOther = otherById.get(target)
    if (targetOther !== undefined) {
      return { lineLabel: targetOther.label, kindLabel: targetOther.kindLabel }
    }
    return { lineLabel: link.lineLabel, kindLabel: link.kindLabel }
  }

  const merged = new Map<string, YearCashFlowSankeyLink>()
  const order: string[] = []
  for (const link of view.links) {
    const source = collapsedToOther.get(link.source) ?? link.source
    const target = collapsedToOther.get(link.target) ?? link.target
    const key = `${source}\0${target}\0${link.flag ?? ''}`
    const labels = linkLabelsForEndpoints(source, target, link)
    const existing = merged.get(key)
    if (existing) {
      merged.set(key, {
        ...existing,
        ...labels,
        amountPlanDollars: existing.amountPlanDollars + link.amountPlanDollars,
        underlyingLineIds: uniqueSorted([...existing.underlyingLineIds, ...link.underlyingLineIds]),
      })
      continue
    }
    order.push(key)
    merged.set(key, {
      id: `${source}->${target}${link.flag ? `:${link.flag}` : ''}`,
      view: link.view,
      source,
      target,
      amountPlanDollars: link.amountPlanDollars,
      underlyingLineIds: uniqueSorted(link.underlyingLineIds),
      flag: link.flag,
      kind: link.kind,
      kindLabel: labels.kindLabel,
      lineLabel: labels.lineLabel,
    })
  }
  const links = order.map((key) => merged.get(key)!)
  return { nodes, links }
}
