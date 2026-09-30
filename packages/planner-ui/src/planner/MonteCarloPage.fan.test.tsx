/** @vitest-environment jsdom */
/**
 * The Monte Carlo page's Range of outcomes chart and ending-balance histogram,
 * rendered: the page runs a (stubbed) simulation and Recharts draws the real
 * charts at a fixed size, since jsdom lays nothing out. The bands are range
 * areas between two of the engine's fan levels and the tooltip prints each as
 * "$low to $high" (owner decision R14, worksheet display-fan-band-widths); the
 * histogram's bars are labelled with the engine's bin centres, and a sample
 * that ended at one value draws one bar (worksheet display-histogram-bin-label).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cloneElement, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { MonteCarloSummary } from '@retiregolden/engine/montecarlo/run'
import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'
import { waitFor } from '../testSupport/settle'
import { fanInnerBand, fanOuterBand, fmtMoneyCompact, fmtMoneyOrRange, histogramBars } from './format'
import { buildModel } from './marketModelPicker'
import { HEADLINE_MC_MODEL } from './useMcSuccessRate'

vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>()
  return {
    ...original,
    // jsdom measures every box as 0 × 0, so each chart gets a fixed 600 × 300.
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) =>
      cloneElement(children, { width: 600, height: 300 }),
  }
})

vi.mock('../mc/pool', async (importOriginal) => {
  const original = await importOriginal<typeof import('../mc/pool')>()
  return { ...original, runMonteCarlo: vi.fn() }
})

import * as pool from '../mc/pool'
import { MonteCarloPage } from './MonteCarloPage'

const actualPool = await vi.importActual<typeof import('../mc/pool')>('../mc/pool')
const mockedRunMc = vi.mocked(pool.runMonteCarlo)

// The worksheet's two fan rows: round levels, then fractional ones.
const FAN = [
  { year: 2050, p10: 400_000, p25: 600_000, p50: 800_000, p75: 1_000_000, p90: 1_300_000 },
  { year: 2051, p10: 12_345.67, p25: 30_000, p50: 50_000, p75: 70_000, p90: 98_765.43 },
]

let container: HTMLDivElement
let root: Root
let base: MonteCarloSummary | undefined

beforeEach(async () => {
  vi.clearAllMocks()
  if (base === undefined) {
    const plan = createSamplePlan()
    const model = buildModel(HEADLINE_MC_MODEL.kind, plan.assumptions.inflationPct, HEADLINE_MC_MODEL.returnVolPct, HEADLINE_MC_MODEL.equityWeightPct, plan)
    base = await actualPool.runMonteCarlo(plan, { startYear: 2026, pathCount: 8, seed: 7, model })
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function contextFor(plan: Plan): PlanContextValue {
  return { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
}

/** Mounts the page on a run whose fan and ending-investable histogram are given. */
async function mountWith(histogram: MonteCarloSummary['endingInvestable']['histogram']): Promise<void> {
  const summary: MonteCarloSummary = { ...base!, fan: FAN, endingInvestable: { ...base!.endingInvestable, histogram } }
  mockedRunMc.mockResolvedValue(summary)
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanCtx.Provider value={contextFor(createSamplePlan())}>
          <MonteCarloPage />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400)) // past the 250 ms auto-run debounce
  })
  await waitFor(() => figure('Fan chart')?.querySelector('.recharts-wrapper') != null, { what: 'the fan chart' })
}

function figure(labelStart: string): Element | undefined {
  return Array.from(container.querySelectorAll('[role="figure"]')).find((node) =>
    node.getAttribute('aria-label')?.startsWith(labelStart),
  )
}

/** Hovers the fan chart at x and returns the tooltip's rows as [name, value]. */
async function tooltipAt(x: number): Promise<string[][]> {
  const wrapper = figure('Fan chart')!.querySelector('.recharts-wrapper')!
  await act(async () => {
    wrapper.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: 150 }))
    await new Promise((r) => setTimeout(r, 20))
  })
  return Array.from(figure('Fan chart')!.querySelectorAll('.recharts-tooltip-item')).map((item) => [
    item.querySelector('.recharts-tooltip-item-name')?.textContent ?? '',
    item.querySelector('.recharts-tooltip-item-value')?.textContent ?? '',
  ])
}

/** The histogram's x-axis labels: the dollar ticks (its y axis counts paths). */
function moneyTicks(chart: Element): (string | null)[] {
  return Array.from(chart.querySelectorAll('.recharts-cartesian-axis-tick-value'))
    .map((tick) => tick.textContent)
    .filter((text) => text?.startsWith('$') === true)
}

const ONE_VALUE = { min: 0, binWidth: 1, counts: [8, ...Array<number>(29).fill(0)], binCenters: Array<number>(30).fill(0) }

describe('Range of outcomes', () => {
  it('maps a fan row to its two levels and prints a band as them, a line as its level, anything else as "—"', () => {
    expect(fanOuterBand(FAN[0]!)).toEqual([400_000, 1_300_000])
    expect(fanInnerBand(FAN[0]!)).toEqual([600_000, 1_000_000])
    expect(fanOuterBand(FAN[1]!)).toEqual([12_345.67, 98_765.43])
    expect(Object.is(fanOuterBand(FAN[1]!)[1], FAN[1]!.p90)).toBe(true)
    expect(fmtMoneyOrRange([400_000, 1_300_000])).toBe('$400,000 to $1,300,000')
    expect(fmtMoneyOrRange([12_345.67, 98_765.43])).toBe('$12,346 to $98,765')
    expect(fmtMoneyOrRange(800_000)).toBe('$800,000')
    expect(fmtMoneyOrRange([400_000])).toBe('—')
    expect(fmtMoneyOrRange([1, 2, 3])).toBe('—')
  })

  it('draws each band as a range area and its tooltip prints the two levels, with no width and no base series', async () => {
    await mountWith(ONE_VALUE)
    const chart = figure('Fan chart')!
    // A range area's lower edge follows p10 (or p25) from year to year; an area
    // stacked on the axis would have a flat lower edge.
    const areas = Array.from(chart.querySelectorAll('path.recharts-area-area')).map((path) => path.getAttribute('d')!)
    expect(areas).toHaveLength(2)
    for (const d of areas) {
      const points = d.replace(/^M/u, '').replace(/Z$/u, '').split('L').map((point) => point.split(',').map(Number))
      expect(points).toHaveLength(4)
      const [, top1, bottom1, bottom0] = points as [number[], number[], number[], number[]]
      expect(bottom0[1]).not.toBe(bottom1[1])
      expect(bottom1[1]).toBeGreaterThan(top1[1]!)
    }
    expect(await tooltipAt(120)).toEqual([
      ['10th to 90th percentile', '$400,000 to $1,300,000'],
      ['25th to 75th percentile', '$600,000 to $1,000,000'],
      ['Median', '$800,000'],
    ])
    expect(await tooltipAt(560)).toEqual([
      ['10th to 90th percentile', '$12,346 to $98,765'],
      ['25th to 75th percentile', '$30,000 to $70,000'],
      ['Median', '$50,000'],
    ])
    expect(chart.textContent).not.toContain('$900,000')
    expect(chart.textContent).not.toMatch(/\bp10\b|\bp25\b/u)
  })
})

describe('Ending balance distribution', () => {
  it('labels bars with the engine bin centres and draws one bar when every path ended at one value', async () => {
    expect(histogramBars(ONE_VALUE)).toEqual([{ label: '$0', count: 8 }])
    const spread = { min: 100_000, binWidth: 50_000, counts: [2, 0, 5], binCenters: [125_000, 175_000, 225_000] }
    expect(histogramBars(spread)).toEqual([
      { label: '$125k', count: 2 },
      { label: '$175k', count: 0 },
      { label: '$225k', count: 5 },
    ])

    await mountWith(ONE_VALUE)
    const histogram = figure('Histogram of ending investable')!
    expect(histogram.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(1)
    const ticks = moneyTicks(histogram)
    expect(ticks).toEqual(['$0'])
  })

  it('draws one bar per bin, labelled with its centre, when the endings differ', async () => {
    await mountWith({ min: 100_000, binWidth: 50_000, counts: [2, 1, 5], binCenters: [125_000, 175_000, 225_000] })
    const histogram = figure('Histogram of ending investable')!
    expect(histogram.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(3)
    const ticks = moneyTicks(histogram)
    expect(ticks).toEqual(['$125k', '$175k', '$225k'])
  })
})

describe('Chart labels and the Why panel read the engine (B2-P1 freeze additions)', () => {
  // Eight paths: three run out (one in 2040, two in 2045) and five last. The
  // page used to sum the year counts (3), subtract the failing count from the
  // path count (5) and walk the counts to half the failing count (2045).
  const DEPLETING: Partial<MonteCarloSummary> = {
    pathCount: 8,
    lastingPathCount: 5,
    depletionYearCounts: [
      { year: 2040, count: 1 },
      { year: 2045, count: 2 },
    ],
    medianFirstDepletionYear: 2045,
  }

  async function mountDepleting(): Promise<void> {
    const summary: MonteCarloSummary = {
      ...base!,
      ...DEPLETING,
      fan: FAN,
      downsideRisk: { ...base!.downsideRisk, failingPathCount: 3, failureRate: 3 / 8 },
      successRate: 5 / 8,
    }
    mockedRunMc.mockResolvedValue(summary)
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={contextFor(createSamplePlan())}>
            <MonteCarloPage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400))
    })
    await waitFor(() => figure('Histogram of first-depletion years') !== undefined, { what: 'the depletion chart' })
  }

  it('labels the ending-balance histogram with what it shows, and no estate figure', async () => {
    await mountDepleting()
    const label = figure('Histogram of ending investable')!.getAttribute('aria-label')
    expect(label).toBe('Histogram of ending investable balances: how many of the 8 simulated paths ended in each balance range.')
    expect(label).not.toMatch(/estate/iu)
    expect(label).not.toContain(fmtMoneyCompact(base!.endingAfterTaxEstate.percentiles.p50))
  })

  it("labels the depletion chart with the engine's failing-path count and prints the engine's lasting count and median year", async () => {
    await mountDepleting()
    expect(figure('Histogram of first-depletion years')!.getAttribute('aria-label')).toBe(
      'Histogram of first-depletion years for the 3 paths that ran out of money.',
    )
    const text = (container.textContent ?? '').replace(/\s+/gu, ' ')
    expect(text).toContain('lasted to the end of the plan in 5 of the 8 simulated markets (3 depleted early)')
    expect(text).toContain('between 2040 and 2045 (median 2045)')
  })
})
