/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'

import type { YearCashFlowSankeyView } from './buildYearCashFlow'
import {
  YearCashFlowSankey,
  YearCashFlowSankeyLink,
  YearCashFlowSankeyNode,
  YearCashFlowSankeyTooltip,
} from './YearCashFlowSankey'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const view: YearCashFlowSankeyView = {
  nodes: [
    {
      id: 'wages',
      view: 'cashFlow',
      side: 'source',
      role: 'spendableSource',
      kind: 'wages',
      kindLabel: 'Wages',
      personKey: 'household',
      personLabel: 'Household',
      label: 'Wages',
      amountPlanDollars: 50_000,
      underlyingLineIds: ['wages'],
      unresolved: false,
      collapsed: false,
      flag: null,
    },
    {
      id: 'householdCash',
      view: 'cashFlow',
      side: 'hub',
      role: 'householdCash',
      kind: 'householdCash',
      kindLabel: 'Household cash',
      personKey: 'household',
      personLabel: 'Household',
      label: 'Household cash',
      amountPlanDollars: 50_000,
      underlyingLineIds: [],
      unresolved: false,
      collapsed: false,
      flag: null,
    },
    {
      id: 'lifestyle',
      view: 'cashFlow',
      side: 'fundedUse',
      role: 'fundedUse',
      kind: 'requiredLifestyle',
      kindLabel: 'Required lifestyle',
      personKey: 'household',
      personLabel: 'Household',
      label: 'Required lifestyle',
      amountPlanDollars: 40_000,
      underlyingLineIds: ['lifestyle'],
      unresolved: false,
      collapsed: false,
      flag: null,
    },
    {
      id: 'unfunded',
      view: 'cashFlow',
      side: 'unfundedOrigin',
      role: 'unfundedOrigin',
      kind: 'unfunded',
      kindLabel: 'Unfunded',
      personKey: 'household',
      personLabel: 'Household',
      label: 'Unfunded',
      amountPlanDollars: 10_000,
      underlyingLineIds: [],
      unresolved: false,
      collapsed: false,
      flag: 'unfunded',
    },
    {
      id: 'unfunded:lifestyle',
      view: 'cashFlow',
      side: 'unfundedUse',
      role: 'unfundedUse',
      kind: 'requiredLifestyle',
      kindLabel: 'Required lifestyle',
      personKey: 'household',
      personLabel: 'Household',
      label: 'Required lifestyle',
      amountPlanDollars: 10_000,
      underlyingLineIds: ['lifestyle'],
      unresolved: false,
      collapsed: false,
      flag: 'unfunded',
    },
  ],
  links: [
    {
      id: 'wages->householdCash',
      view: 'cashFlow',
      source: 'wages',
      target: 'householdCash',
      amountPlanDollars: 50_000,
      underlyingLineIds: ['wages'],
      flag: null,
      kind: 'wages',
      kindLabel: 'Wages',
      lineLabel: 'Wages',
    },
    {
      id: 'householdCash->lifestyle',
      view: 'cashFlow',
      source: 'householdCash',
      target: 'lifestyle',
      amountPlanDollars: 40_000,
      underlyingLineIds: ['lifestyle'],
      flag: null,
      kind: 'requiredLifestyle',
      kindLabel: 'Required lifestyle',
      lineLabel: 'Required lifestyle',
    },
    {
      id: 'unfunded->unfunded:lifestyle',
      view: 'cashFlow',
      source: 'unfunded',
      target: 'unfunded:lifestyle',
      amountPlanDollars: 10_000,
      underlyingLineIds: ['lifestyle'],
      flag: 'unfunded',
      kind: 'requiredLifestyle',
      kindLabel: 'Required lifestyle',
      lineLabel: 'Required lifestyle',
    },
  ],
}

function chart() {
  return (
    <YearCashFlowSankey
      view={view}
      viewId="cashFlow"
      year={2030}
      displayAmount={(_year, amount) => amount}
      sourceTotalPlanDollars={50_000}
      fundedUsesPlanDollars={40_000}
      shortfallPlanDollars={10_000}
    />
  )
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('YearCashFlowSankey', () => {
  it('renders nodes and links from a synthetic model with animation disabled', async () => {
    await act(async () => {
      root.render(chart())
    })
    const host = container.querySelector('.year-cash-flow-sankey')
    expect(host).not.toBeNull()
    expect(host!.getAttribute('data-animation-active')).toBe('false')
    expect(host!.getAttribute('data-node-ids')?.split(' ')).toEqual([
      'wages',
      'householdCash',
      'lifestyle',
      'unfunded',
      'unfunded:lifestyle',
    ])
    expect(host!.getAttribute('data-link-ids')?.split(' ')).toEqual([
      'wages->householdCash',
      'householdCash->lifestyle',
      'unfunded->unfunded:lifestyle',
    ])
    expect(host!.getAttribute('aria-label')).toBe(
      'Cash flow for 2030. Source total $50,000. Funded uses $40,000. Shortfall $10,000.',
    )
    expect(container.querySelector('.year-cash-flow-legend')?.textContent).toContain('Unfunded')
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('keeps the unfunded legend cue textual, not color alone', () => {
    const html = renderToStaticMarkup(chart())
    expect(html).toContain('year-cash-flow-legend-swatch--unfunded')
    expect(html).toContain('Unfunded')
    expect(html).toContain('data-animation-active="false"')
  })

  it('renders an explicit Unresolved marker on an unresolved node label', () => {
    const unresolvedView: YearCashFlowSankeyView = {
      ...view,
      nodes: view.nodes.map((node) =>
        node.id === 'wages' ? { ...node, unresolved: true, flag: 'unresolved', label: 'Wages · Unknown source (ID ghost)' } : node,
      ),
    }
    const html = renderToStaticMarkup(
      <YearCashFlowSankey
        view={unresolvedView}
        viewId="cashFlow"
        year={2030}
        displayAmount={(_year, amount) => amount}
        sourceTotalPlanDollars={50_000}
        fundedUsesPlanDollars={40_000}
        shortfallPlanDollars={10_000}
      />,
    )
    expect(html).toContain('data-unresolved="true"')
    expect(html).toContain('Unresolved')
    expect(html).toContain('Unknown source (ID ghost)')
  })

  it('titles a bidirectional transfer endpoint with in and out totals', () => {
    const transferView: YearCashFlowSankeyView = {
      nodes: [
        {
          id: 'account:ira-pat',
          view: 'transfers',
          side: 'transfer',
          role: 'transferEndpoint',
          kind: 'account',
          kindLabel: 'Rollover IRA',
          personKey: 'p1',
          personLabel: 'Pat',
          label: 'Pat - Rollover IRA (IRA)',
          amountPlanDollars: 12_000,
          totalInPlanDollars: 7_000,
          totalOutPlanDollars: 12_000,
          underlyingLineIds: ['transfer:employeeContribution:ira-pat', 'transfer:namedRothConversion:ira-pat:roth-pat'],
          unresolved: false,
          collapsed: false,
          flag: null,
        },
      ],
      links: [],
    }
    const html = renderToStaticMarkup(
      <YearCashFlowSankey
        view={transferView}
        viewId="transfers"
        year={2030}
        displayAmount={(_year, amount) => amount}
        sourceTotalPlanDollars={0}
        fundedUsesPlanDollars={0}
        shortfallPlanDollars={0}
      />,
    )
    expect(html).toContain('in $7,000 / out $12,000')
    expect(html).not.toContain('$19,000')
  })

  it('renders node labels at readable font sizes for the 50+ audience', () => {
    const html = renderToStaticMarkup(chart())
    expect(html).toContain('font-size="16"')
    expect(html).toContain('font-size="13.6"')
    expect(html).not.toContain('font-size="11"')
  })

  it('colors nodes by side so legend swatches match the chart', () => {
    const html = renderToStaticMarkup(chart())
    expect(html).toContain('background:var(--chart-1)')
    expect(html).toContain('background:var(--chart-3)')
    expect(html).toContain('background:var(--chart-4)')
    expect(html).toMatch(/data-node-id="wages"[^>]*>[\s\S]*?fill="var\(--chart-1\)"/)
    expect(html).toMatch(/data-node-id="householdCash"[^>]*>[\s\S]*?fill="var\(--chart-3\)"/)
    expect(html).toMatch(/data-node-id="lifestyle"[^>]*>[\s\S]*?fill="var\(--chart-4\)"/)
    expect(html).not.toMatch(/stroke-opacity="0\.55"/)
    expect(html).toContain('data-chart-width=')
  })

  it('forwards Recharts interaction props onto custom Sankey links and nodes', async () => {
    const link = view.links.find((item) => item.id === 'householdCash->lifestyle')
    expect(link).toBeDefined()
    const onLinkMouseEnter = vi.fn()
    const onNodeMouseEnter = vi.fn()

    await act(async () => {
      root.render(
        <svg>
          <YearCashFlowSankeyLink
            sourceX={10}
            sourceY={20}
            targetX={200}
            targetY={80}
            sourceControlX={70}
            targetControlX={140}
            linkWidth={6}
            payload={{
              source: 0,
              target: 1,
              value: 40_000,
              flag: null,
              kind: link!.kind,
              kindLabel: link!.kindLabel,
              label: link!.lineLabel,
              name: `${link!.kindLabel} - $40,000`,
              displayAmount: 40_000,
              amountLabel: '$40,000',
            }}
            onMouseEnter={onLinkMouseEnter}
          />
          <YearCashFlowSankeyNode
            x={12}
            y={24}
            width={12}
            height={40}
            index={1}
            payload={{
              ...view.nodes.find((node) => node.id === 'lifestyle')!,
              name: 'Required lifestyle',
              fill: 'var(--chart-4)',
              displayAmount: 40_000,
              amountLabel: '$40,000',
            }}
            onMouseEnter={onNodeMouseEnter}
          />
        </svg>,
      )
    })

    const path = container.querySelector('.year-cash-flow-sankey-link')
    const rect = container.querySelector('.year-cash-flow-sankey-node rect')
    expect(path).not.toBeNull()
    expect(rect).not.toBeNull()

    await act(async () => {
      // React derives synthetic mouseenter from bubbling mouseover events.
      path!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      rect!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })

    expect(onLinkMouseEnter).toHaveBeenCalledTimes(1)
    expect(onNodeMouseEnter).toHaveBeenCalledTimes(1)

    const tooltipHtml = renderToStaticMarkup(
      <YearCashFlowSankeyTooltip
        active
        payload={[
          {
            payload: {
              source: 0,
              target: 1,
              kind: link!.kind,
              kindLabel: link!.kindLabel,
              label: link!.lineLabel,
              displayAmount: 40_000,
              amountLabel: '$40,000',
            },
          },
        ]}
      />,
    )
    expect(tooltipHtml).toContain('Required lifestyle - $40,000')
    expect(tooltipHtml).not.toContain('Household cash')
  })

  it('observes host width when opening empty then switching to a populated view', async () => {
    const observed: Element[] = []
    const disconnect = vi.fn()
    let resizeCallback: ResizeObserverCallback | undefined
    let observerInstance: ResizeObserver | undefined

    class MockResizeObserver {
      private readonly callback: ResizeObserverCallback

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
        resizeCallback = this.callback
        observerInstance = {
          observe: (el: Element) => observed.push(el),
          disconnect,
        } as unknown as ResizeObserver
      }

      observe(el: Element) {
        observed.push(el)
      }

      disconnect() {
        disconnect()
      }
    }

    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

    const fireResize = async (el: Element, width: number) => {
      Object.defineProperty(el, 'clientWidth', { configurable: true, value: width })
      await act(async () => {
        resizeCallback?.(
          [{ contentRect: { width } as DOMRectReadOnly, target: el } as ResizeObserverEntry],
          observerInstance!,
        )
      })
    }

    const emptyView: YearCashFlowSankeyView = { nodes: [], links: [] }
    const props = {
      viewId: 'cashFlow' as const,
      year: 2030,
      displayAmount: (_year: number, amount: number) => amount,
      sourceTotalPlanDollars: 0,
      fundedUsesPlanDollars: 0,
      shortfallPlanDollars: 0,
    }

    await act(async () => {
      root.render(<YearCashFlowSankey view={emptyView} {...props} />)
    })

    const hostAfterEmpty = container.querySelector('.year-cash-flow-sankey')
    expect(hostAfterEmpty).not.toBeNull()
    const hostObserved = () =>
      observed.filter((el) => el.classList.contains('year-cash-flow-sankey'))
    expect(hostObserved()).toHaveLength(1)
    expect(hostObserved()[0]).toBe(hostAfterEmpty)
    expect(container.querySelector('.year-cash-flow-sankey-chart')).toBeNull()

    await fireResize(hostAfterEmpty!, 640)
    expect(hostAfterEmpty!.getAttribute('data-chart-width')).toBe('640')

    await act(async () => {
      root.render(chart())
    })

    expect(hostObserved()).toHaveLength(1)
    expect(container.querySelector('.year-cash-flow-sankey-chart')).not.toBeNull()
    expect(hostAfterEmpty!.getAttribute('data-chart-width')).toBe('640')

    delete (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver
  })
})
