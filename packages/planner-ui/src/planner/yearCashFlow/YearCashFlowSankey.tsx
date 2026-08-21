/**
 * Year cash-flow Sankey — presentation only.
 *
 * Amounts are the selector's published Plan dollars, passed through a caller
 * display transform. Colors come from existing CSS tokens. The unfunded branch
 * is labeled and dashed/patterned, never distinguished by color alone.
 */

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

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
] as const

const UNFUNDED_HATCH_ID = 'year-cash-flow-unfunded-hatch'
const LABEL_MAX = 20

interface ChartNode extends YearCashFlowSankeyNode {
  readonly name: string
  readonly fill: string
  readonly displayAmount: number
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

function nodeColor(node: YearCashFlowSankeyNode, index: number): string {
  if (isUnfundedNode(node)) return 'var(--bad)'
  return CHART_COLORS[index % CHART_COLORS.length]
}

function truncateLabel(label: string): string {
  if (label.length <= LABEL_MAX) return label
  return `${label.slice(0, LABEL_MAX - 1)}…`
}

function toChartData(
  view: YearCashFlowSankeyView,
  year: number,
  displayAmount: YearCashFlowDisplayAmount,
): { nodes: ChartNode[]; links: ChartLink[] } {
  const nodes = view.nodes.map((node, index) => ({
    ...node,
    name: node.label,
    fill: nodeColor(node, index),
    displayAmount: displayAmount(year, node.amountPlanDollars),
  }))
  const indexById = new Map(nodes.map((node, index) => [node.id, index]))
  const links: ChartLink[] = []
  for (const link of view.links) {
    const source = indexById.get(link.source)
    const target = indexById.get(link.target)
    if (source === undefined || target === undefined) continue
    const value = displayAmount(year, link.amountPlanDollars)
    if (value <= 0) continue
    const sourceNode = nodes[source]!
    const targetNode = nodes[target]!
    const label = `${sourceNode.label} to ${targetNode.label}`
    links.push({
      source,
      target,
      value,
      flag: link.flag,
      kind: sourceNode.kind,
      kindLabel: sourceNode.kindLabel,
      label,
      name: label,
      displayAmount: value,
    })
  }
  return { nodes, links }
}

function tooltipFields(payload: unknown): { label: string; amount: number; kind: string } {
  if (!payload || typeof payload !== 'object') {
    return { label: '', amount: Number.NaN, kind: '' }
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
  return { label, amount, kind }
}

function YearCashFlowSankeyTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: readonly { payload?: unknown }[]
}) {
  if (!active || !payload?.[0]) return null
  const fields = tooltipFields(payload[0].payload)
  if (!fields.label && !fields.kind) return null
  return (
    <div className="year-cash-flow-sankey-tooltip" style={chartTooltipStyle}>
      <div>{fields.label}</div>
      <div className="year-cash-flow-num">{fmtMoney(fields.amount)}</div>
      <div className="small">{fields.kind}</div>
    </div>
  )
}

function YearCashFlowSankeyNode({ x = 0, y = 0, width = 0, height = 0, payload, index = 0 }: PlacedNode) {
  if (!payload || width <= 0 || height <= 0) return <g />
  const unfunded = isUnfundedNode(payload)
  const fill = unfunded ? `url(#${UNFUNDED_HATCH_ID})` : payload.fill
  const labelOnRight = payload.side === 'fundedUse' || payload.side === 'unfundedUse' || x > 280
  const textX = labelOnRight ? x + width + 6 : x - 6
  const textAnchor = labelOnRight ? 'start' : 'end'
  const title = `${payload.label} (${payload.kindLabel}): ${fmtMoney(payload.displayAmount)}`
  return (
    <g className="year-cash-flow-sankey-node" data-node-id={payload.id} data-flag={payload.flag ?? undefined}>
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
        width={width}
        height={height}
        fill={fill}
        stroke={unfunded ? 'var(--bad)' : 'var(--border)'}
        strokeDasharray={unfunded ? '3 2' : undefined}
        rx={2}
      />
      <text
        x={textX}
        y={y + height / 2}
        textAnchor={textAnchor}
        dominantBaseline="middle"
        fill="var(--fg)"
        fontSize={11}
      >
        <title>{title}</title>
        {truncateLabel(payload.label)}
      </text>
    </g>
  )
}

function YearCashFlowSankeyLink(props: PlacedLink) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourceControlX,
    targetControlX,
    linkWidth = 1,
    payload,
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
      stroke={unfunded ? 'var(--bad)' : 'var(--muted)'}
      strokeWidth={Math.max(linkWidth, 1.5)}
      strokeOpacity={0.55}
      strokeDasharray={unfunded ? '6 4' : undefined}
    />
  )
}

function YearCashFlowSankeyLegend({ viewId, hasUnfunded }: { viewId: YearCashFlowSankeyViewId; hasUnfunded: boolean }) {
  const items =
    viewId === 'transfers'
      ? [{ key: 'transfer', label: 'Transfer', swatch: 'var(--chart-6)', dashed: false }]
      : [
          { key: 'source', label: 'Sources', swatch: 'var(--chart-1)', dashed: false },
          { key: 'hub', label: 'Household cash', swatch: 'var(--chart-3)', dashed: false },
          { key: 'funded', label: 'Funded uses', swatch: 'var(--chart-4)', dashed: false },
          ...(hasUnfunded
            ? [{ key: 'unfunded', label: 'Unfunded', swatch: 'var(--bad)', dashed: true }]
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
  const data = toChartData(view, props.year, props.displayAmount)
  const hasUnfunded = view.nodes.some(isUnfundedNode) || view.links.some((link) => link.flag === 'unfunded')
  const height = Math.max(280, data.nodes.length * 36)
  const empty = data.nodes.length === 0 || data.links.length === 0

  return (
    <div
      className="year-cash-flow-sankey"
      role="group"
      aria-label={chartAriaLabel(props)}
      data-animation-active="false"
      data-view={viewId}
      data-node-ids={view.nodes.map((node) => node.id).join(' ')}
      data-link-ids={view.links.map((link) => link.id).join(' ')}
    >
      {empty ? (
        <p className="small">No lines to graph in this view.</p>
      ) : (
        <div className="year-cash-flow-sankey-chart">
          <Sankey
            width={720}
            height={height}
            data={data}
            nodeWidth={12}
            nodePadding={18}
            iterations={32}
            margin={{ top: 12, right: 140, bottom: 12, left: 140 }}
            node={<YearCashFlowSankeyNode />}
            link={<YearCashFlowSankeyLink />}
            isAnimationActive={false}
          >
            <Tooltip content={YearCashFlowSankeyTooltip} isAnimationActive={false} />
          </Sankey>
        </div>
      )}
      <YearCashFlowSankeyLegend viewId={viewId} hasUnfunded={hasUnfunded} />
    </div>
  )
}
