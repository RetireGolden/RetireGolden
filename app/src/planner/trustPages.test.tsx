/** @vitest-environment jsdom */
/**
 * Trust-layer pages (steps 1 and 5): the assumptions card renders every
 * snapshot group and its copy-export writes the real export text, and the
 * "How RetireGolden is tested" page ships with live (glob-derived) harness
 * counts and the invariance claim — with the caveats stated too.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

import { PlanCtx } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'
import { buildAssumptionsSnapshot, assumptionsExportText } from './assumptionsExport'
import { currentStartYear } from './useProjection'
import { AssumptionsCardPage } from './AssumptionsCardPage'
import { HowTestedPage } from './HowTestedPage'

let root: Root | null = null
let container: HTMLDivElement | null = null

function render(node: React.ReactNode) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(<MemoryRouter>{node}</MemoryRouter>)
  })
  return container
}

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
  vi.unstubAllGlobals()
})

describe('AssumptionsCardPage', () => {
  it('renders every snapshot group and row', () => {
    const plan = createSamplePlan()
    const el = render(
      <PlanCtx.Provider value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
        <AssumptionsCardPage />
      </PlanCtx.Provider>,
    )
    const snapshot = buildAssumptionsSnapshot(plan, currentStartYear())
    const text = el.textContent!
    for (const group of snapshot.groups) {
      expect(text).toContain(group.label)
      for (const row of group.rows) expect(text).toContain(row.label)
    }
  })

  it('copies the text export to the clipboard', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const plan = createSamplePlan()
    const el = render(
      <PlanCtx.Provider value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
        <AssumptionsCardPage />
      </PlanCtx.Provider>,
    )
    const button = Array.from(el.querySelectorAll('button')).find((b) => b.textContent === 'Copy as text')!
    await act(async () => {
      button.click()
    })
    expect(writeText).toHaveBeenCalledWith(assumptionsExportText(buildAssumptionsSnapshot(plan, currentStartYear())))
  })
})

describe('HowTestedPage', () => {
  it('ships real harness names and non-stale counts', () => {
    const el = render(<HowTestedPage />)
    const text = el.textContent!
    // Counts are glob-derived from the source tree; sanity-floor them so the
    // page can never render an empty validation story.
    const externalCount = Number(text.match(/(\d+) external-oracle golden suites/)?.[1])
    expect(externalCount).toBeGreaterThanOrEqual(5)
    const goldenCount = Number(text.match(/(\d+) golden suites/)?.[1])
    expect(goldenCount).toBeGreaterThan(externalCount)
    // Named oracles and the invariance fixture citation.
    expect(text).toContain('PolicyEngine-US')
    expect(text).toContain('assetLocationInvariance')
    // The caveats ship as prominently as the strengths.
    expect(text).toContain('deliberately simplifies')
    expect(text).toContain('single long-term-gains rate')
  })

  it('names no competing planner products', () => {
    const text = render(<HowTestedPage />).textContent!
    for (const name of ['Boldin', 'Pralana', 'ProjectionLab', 'Owl', 'NewRetirement']) {
      expect(text).not.toContain(name)
    }
  })
})
