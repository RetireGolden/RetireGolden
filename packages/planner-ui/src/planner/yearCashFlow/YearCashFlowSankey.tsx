/**
 * Year cash-flow Sankey — presentation only.
 *
 * Amounts are the selector's published Plan dollars, passed through a caller
 * display transform. Colors come from existing CSS tokens. The unfunded branch
 * is labeled and dashed/patterned, never distinguished by color alone.
 */

import { useEffect, useRef, useState, type SVGProps } from 'react'
import { Sankey, Tooltip } from 'recharts'

import { chartTooltipStyle } from '../chartStyle'
import { fmtMoney } from '../format'
import type {
  YearCashFlowSankeyFlag,
  YearCashFlowSankeyNode,
  YearCashFlowSankeyView,
  YearCashFlowSankeyViewId,
} from './buildYearCashFlow'

export type YearCashFlowDisplayAmount = (year: number, nominalAmount: number) => number

export interface YearCashFlowSankeyProps {
  readonly view: YearCashFlowSankeyView
  readonly viewId: YearCashFlowSankeyViewId
  readonly year: number
  readonly displayAmount: YearCashFlowDisplayAmount
  readonly sourceTotalPlanDollars: number
  readonly fundedUsesPlanDollars: number
  readonly shortfallPlanDollars: number
  readonly transferDebitsPlanDollars?: number
  readonly transferCreditsPlanDollars?: number
}

/** Semantic node fills — one token per side, matching the legend swatches. */
const NODE_COLOR = {
  source: 'var(--chart-1)',
  hub: 'var(--chart-3)',
  fundedUse: 'var(--chart-4)',
  unfunded: 'var(--bad)',
  transfer: 'var(--chart-6)',
} as const

const UNFUNDED_HATCH_ID = 'year-cash-flow-unfunded-hatch'
const LABEL_MAX = 20
const MIN_CHART_WIDTH = 560
const FALLBACK_CHART_WIDTH = 720
/** Primary node label — DESIGN.md 1rem minimum for 50+ readability. */
const NODE_LABEL_FONT_PX = 16
/** Secondary amount line — no smaller than 0.85rem at a 16px root. */
const NODE_AMOUNT_FONT_PX = 13.6
const NODE_PADDING = 26
const NODE_HEIGHT_PER_NODE = 50

/**
 * Ordinary link stroke vs --surface-1 (index.css), opacity 1:
 * light #5b6470 on #ffffff ≈ 6.0:1; dark #97a1ad on #161b22 ≈ 6.6:1.
 * Both clear WCAG 1.4.11's 3:1 floor (the prior 55% mix did not).
 */
const LINK_STROKE = 'var(--muted)'
const LINK_STROKE_OPACITY = 1

interface ChartNode extends YearCashFlowSankeyNode {
  readonly name: string
  readonly fill: string
  readonly displayAmount: number
  readonly amountLabel: string
}

interface ChartLink {
  readonly source: number
  readonly target: number
  readonly value: number
  readonly flag: YearCashFlowSankeyFlag | null
  readonly kind: string
  readonly kindLabel: string
  readonly label: string
  readonly name: string
  readonly displayAmount: number
  readonly amountLabel: string
}

interface PlacedNode {
  readonly x?: number
  readonly y?: number
  readonly width?: number
  readonly height?: number
  readonly payload?: ChartNode
  readonly index?: number
}

interface PlacedLink {
  readonly sourceX?: number
  readonly sourceY?: number
  readonly targetX?: number
  readonly targetY?: number
  readonly sourceControlX?: number
  readonly targetControlX?: number
  readonly linkWidth?: number
  readonly payload?: ChartLink
}

function isUnfundedNode(node: Pick<YearCashFlowSankeyNode, 'flag' | 'role'>): boolean {
  return node.flag === 'unfunded' || node.role === 'unfundedOrigin' || node.role === 'unfundedUse'
}

function nodeColor(node: YearCashFlowSankeyNode): string {
  if (isUnfundedNode(node)) return NODE_COLOR.unfunded
  if (node.side === 'source') return NODE_COLOR.source
  if (node.side === 'hub') return NODE_COLOR.hub
  if (node.side === 'fundedUse') return NODE_COLOR.fundedUse
  if (node.side === 'transfer') return NODE_COLOR.transfer
  return NODE_COLOR.hub
}

function useMeasuredChartWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(FALLBACK_CHART_WIDTH)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const apply = () => {
      const measured = Math.floor(el.clientWidth)
      setWidth(Math.max(MIN_CHART_WIDTH, measured > 0 ? measured : FALLBACK_CHART_WIDTH))
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

function truncateLabel(label: string): string {
  if (label.length <= LABEL_MAX) return label
  return `${label.slice(0, LABEL_MAX - 1)}…`
}

function nodeAmountLabel(
  node: YearCashFlowSankeyNode,
  year: number,
  displayAmount: YearCashFlowDisplayAmount,
): string {
  const totalIn = node.totalInPlanDollars
  const totalOut = node.totalOutPlanDollars
  if (totalIn !== undefined && totalOut !== undefined && totalIn > 0 && totalOut > 0) {
    return `in ${fmtMoney(displayAmount(year, totalIn))} / out ${fmtMoney(displayAmount(year, totalOut))}`
  }
  return fmtMoney(displayAmount(year, node.amountPlanDollars))
}

function toChartData(
  view: YearCashFlowSankeyView,
  year: number,
  displayAmount: YearCashFlowDisplayAmount,
): { nodes: ChartNode[]; links: ChartLink[] } {
  const nodes = view.nodes.map((node) => ({
    ...node,
    name: node.label,
    fill: nodeColor(node),
    displayAmount: displayAmount(year, node.amountPlanDollars),
    amountLabel: nodeAmountLabel(node, year, displayAmount),
  }))
  const indexById = new Map(nodes.map((node, index) => [node.id, index]))
  const links: ChartLink[] = []
  for (const link of view.links) {
    const source = indexById.get(link.source)
    const target = indexById.get(link.target)
    if (source === undefined || target === undefined) continue
    const value = displayAmount(year, link.amountPlanDollars)
    if (value <= 0) continue
    const amountLabel = fmtMoney(value)
    const headline = `${link.kindLabel} - ${amountLabel}`
    links.push({
      source,
      target,
      value,
      flag: link.flag,
      kind: link.kind,
      kindLabel: link.kindLabel,
      label: link.lineLabel,
      name: headline,
      displayAmount: value,
      amountLabel,
    })
  }
  return { nodes, links }
}

function tooltipFields(payload: unknown): {
  label: string
  amount: number
  amountLabel: string
  kind: string
  isLink: boolean
} {
  if (!payload || typeof payload !== 'object') {
    return { label: '', amount: Number.NaN, amountLabel: '', kind: '', isLink: false }
  }
  const record = payload as Record<string, unknown>
  const label =
    typeof record.label === 'string' ? record.label
    : typeof record.name === 'string' ? record.name
    : ''
  const kind =
    typeof record.kindLabel === 'string' ? record.kindLabel
    : typeof record.kind === 'string' ? record.kind
    : ''
  const amount =
    typeof record.displayAmount === 'number' ? record.displayAmount
    : typeof record.value === 'number' ? record.value
    : Number.NaN
  const amountLabel = typeof record.amountLabel === 'string' ? record.amountLabel : ''
  const isLink = typeof record.source === 'number' && typeof record.target === 'number'
  return { label, amount, amountLabel, kind, isLink }
}

export function YearCashFlowSankeyTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: readonly { payload?: unknown }[]
}) {
  if (!active || !payload?.[0]) return null
  const fields = tooltipFields(payload[0].payload)
  if (!fields.label && !fields.kind) return null
  if (fields.isLink) {
    return (
      <div className="year-cash-flow-sankey-tooltip" style={chartTooltipStyle}>
        <div>{`${fields.kind} - ${fields.amountLabel || fmtMoney(fields.amount)}`}</div>
        {fields.label && fields.label !== fields.kind ? (
          <div className="small">{fields.label}</div>
        ) : null}
      </div>
    )
  }
  return (
    <div className="year-cash-flow-sankey-tooltip" style={chartTooltipStyle}>
      <div>{fields.label}</div>
      <div className="year-cash-flow-num">{fields.amountLabel || fmtMoney(fields.amount)}</div>
      <div className="small">{fields.kind}</div>
    </div>
  )
}

function nodeFill(node: YearCashFlowSankeyNode, fill?: string): string {
  if (isUnfundedNode(node)) return `url(#${UNFUNDED_HATCH_ID})`
  return fill ?? nodeColor(node)
}

type SankeyNodeProps = PlacedNode & Omit<SVGProps<SVGRectElement>, keyof PlacedNode>

export function YearCashFlowSankeyNode(props: SankeyNodeProps) {
  const { x = 0, y = 0, width = 0, height = 0, payload, index = 0, ...rest } = props
  if (!payload) return <g />
  const nodeWidth = width > 0 ? width : 12
  const nodeHeight = height > 0 ? height : 12
  const unfunded = isUnfundedNode(payload)
  const fill = nodeFill(payload, payload.fill)
  const labelOnRight = payload.side === 'fundedUse' || payload.side === 'unfundedUse' || x > 280
  const textX = labelOnRight ? x + nodeWidth + 6 : x - 6
  const textAnchor = labelOnRight ? 'start' : 'end'
  const labelBlockHeight = NODE_LABEL_FONT_PX + NODE_AMOUNT_FONT_PX + 4
  const labelTopY = y + (nodeHeight - labelBlockHeight) / 2
  const title = `${payload.label} (${payload.kindLabel}): ${payload.amountLabel}`
  return (
    <g className="year-cash-flow-sankey-node" data-node-id={payload.id} data-flag={payload.flag ?? undefined} data-unresolved={payload.unresolved ? 'true' : undefined}>
      {index === 0 ? (
        <defs>
          <pattern
            id={UNFUNDED_HATCH_ID}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill="var(--surface-1)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--bad)" strokeWidth="2" />
          </pattern>
        </defs>
      ) : null}
      <rect
        x={x}
        y={y}
        width={nodeWidth}
        height={nodeHeight}
        fill={fill}
        stroke={unfunded ? 'var(--bad)' : 'var(--border)'}
        strokeDasharray={unfunded ? '3 2' : undefined}
        rx={2}
        {...rest}
      />
      <text x={textX} y={labelTopY} textAnchor={textAnchor} fill="var(--fg)">
        <title>{title}</title>
        <tspan fontSize={NODE_LABEL_FONT_PX}>
          {truncateLabel(payload.label)}
          {payload.unresolved ? (
            <tspan className="year-cash-flow-unresolved-marker"> Unresolved</tspan>
          ) : null}
        </tspan>
        <tspan
          x={textX}
          dy={NODE_AMOUNT_FONT_PX + 4}
          fontSize={NODE_AMOUNT_FONT_PX}
          fill="var(--muted)"
          className="year-cash-flow-num"
        >
          {payload.amountLabel}
        </tspan>
      </text>
    </g>
  )
}

/** Always in the tree: Recharts only mounts custom nodes after a size effect, so SSR/a11y need this. */
function YearCashFlowSankeyNodeMap({ nodes }: { nodes: readonly ChartNode[] }) {
  if (nodes.length === 0) return null
  return (
    <svg className="sr-only" aria-hidden="true" width="0" height="0">
      {nodes.map((node) => (
        <g
          key={node.id}
          className="year-cash-flow-sankey-node"
          data-node-id={node.id}
          data-flag={node.flag ?? undefined}
          data-unresolved={node.unresolved ? 'true' : undefined}
        >
          <rect fill={node.fill} width="1" height="1" />
          <text>
            <tspan fontSize={NODE_LABEL_FONT_PX}>
              {node.label}
              {node.unresolved ? (
                <tspan className="year-cash-flow-unresolved-marker"> Unresolved</tspan>
              ) : null}
            </tspan>
            <tspan fontSize={NODE_AMOUNT_FONT_PX}>{` ${node.amountLabel}`}</tspan>
          </text>
        </g>
      ))}
    </svg>
  )
}

type SankeyLinkProps = PlacedLink & Omit<SVGProps<SVGPathElement>, keyof PlacedLink>

export function YearCashFlowSankeyLink(props: SankeyLinkProps) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourceControlX,
    targetControlX,
    linkWidth = 1,
    payload,
    ...rest
  } = props
  if (
    sourceX === undefined ||
    sourceY === undefined ||
    targetX === undefined ||
    targetY === undefined ||
    sourceControlX === undefined ||
    targetControlX === undefined
  ) {
    return <g />
  }
  const unfunded = payload?.flag === 'unfunded'
  return (
    <path
      className="year-cash-flow-sankey-link"
      data-flag={payload?.flag ?? undefined}
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={unfunded ? 'var(--bad)' : LINK_STROKE}
      strokeWidth={Math.max(linkWidth, 1.5)}
      strokeOpacity={unfunded ? 1 : LINK_STROKE_OPACITY}
      strokeDasharray={unfunded ? '6 4' : undefined}
      {...rest}
    />
  )
}

function YearCashFlowSankeyLegend({ viewId, hasUnfunded }: { viewId: YearCashFlowSankeyViewId; hasUnfunded: boolean }) {
  const items =
    viewId === 'transfers'
      ? [{ key: 'transfer', label: 'Transfer', swatch: NODE_COLOR.transfer, dashed: false }]
      : [
          { key: 'source', label: 'Sources', swatch: NODE_COLOR.source, dashed: false },
          { key: 'hub', label: 'Household cash', swatch: NODE_COLOR.hub, dashed: false },
          { key: 'funded', label: 'Funded uses', swatch: NODE_COLOR.fundedUse, dashed: false },
          ...(hasUnfunded
            ? [{ key: 'unfunded', label: 'Unfunded', swatch: NODE_COLOR.unfunded, dashed: true }]
            : []),
        ]
  return (
    <ul className="year-cash-flow-legend">
      {items.map((item) => (
        <li key={item.key}>
          <span
            className={
              item.dashed
                ? 'year-cash-flow-legend-swatch year-cash-flow-legend-swatch--unfunded'
                : 'year-cash-flow-legend-swatch'
            }
            style={item.dashed ? undefined : { background: item.swatch }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

function chartAriaLabel(props: YearCashFlowSankeyProps): string {
  const src = fmtMoney(props.displayAmount(props.year, props.sourceTotalPlanDollars))
  const funded = fmtMoney(props.displayAmount(props.year, props.fundedUsesPlanDollars))
  const short = fmtMoney(props.displayAmount(props.year, props.shortfallPlanDollars))
  if (props.viewId === 'transfers') {
    const debits = fmtMoney(props.displayAmount(props.year, props.transferDebitsPlanDollars ?? 0))
    const credits = fmtMoney(props.displayAmount(props.year, props.transferCreditsPlanDollars ?? 0))
    return `Transfers for ${props.year}. Debits ${debits}. Credits ${credits}.`
  }
  return `Cash flow for ${props.year}. Source total ${src}. Funded uses ${funded}. Shortfall ${short}.`
}

export function YearCashFlowSankey(props: YearCashFlowSankeyProps) {
  const { view, viewId } = props
  const { ref: chartRef, width } = useMeasuredChartWidth()
  const data = toChartData(view, props.year, props.displayAmount)
  const hasUnfunded = view.nodes.some(isUnfundedNode) || view.links.some((link) => link.flag === 'unfunded')
  const height = Math.max(280, data.nodes.length * NODE_HEIGHT_PER_NODE)
  const empty = data.nodes.length === 0 || data.links.length === 0

  return (
    <div
      ref={chartRef}
      className="year-cash-flow-sankey"
      role="group"
      aria-label={chartAriaLabel(props)}
      data-animation-active="false"
      data-view={viewId}
      data-chart-width={String(width)}
      data-node-ids={view.nodes.map((node) => node.id).join(' ')}
      data-link-ids={view.links.map((link) => link.id).join(' ')}
    >
      <YearCashFlowSankeyNodeMap nodes={data.nodes} />
      {empty ? (
        <p className="small">No lines to graph in this view.</p>
      ) : (
        <div className="year-cash-flow-sankey-chart">
          <Sankey
            width={width}
            height={height}
            data={data}
            nodeWidth={12}
            nodePadding={NODE_PADDING}
            iterations={32}
            margin={{ top: 12, right: 140, bottom: 12, left: 140 }}
            node={<YearCashFlowSankeyNode />}
            link={<YearCashFlowSankeyLink />}
          >
            <Tooltip content={YearCashFlowSankeyTooltip} isAnimationActive={false} />
          </Sankey>
        </div>
      )}
      <YearCashFlowSankeyLegend viewId={viewId} hasUnfunded={hasUnfunded} />
    </div>
  )
}
