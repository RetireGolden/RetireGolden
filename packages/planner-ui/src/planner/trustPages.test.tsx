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
import { MemoryRouter } from 'react-router'

import { PlanCtx } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'
import { buildAssumptionsSnapshot, assumptionsExportText } from './assumptionsExport'
import { currentStartYear } from './useProjection'
import { AssumptionsCardPage } from './AssumptionsCardPage'
import { clearLongevity, saveLongevity } from '../longevity/storage'
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
    const text = el.textContent
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

  it('dates a questionnaire planning age by the result saved in this browser, and links that table (PR #759 review 1)', () => {
    const plan = createSamplePlan()
    const person = plan.household.people[0]!
    person.longevity = { planningAge: 88, source: 'model' }
    const page = () =>
      render(
        <PlanCtx.Provider value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
          <AssumptionsCardPage />
        </PlanCtx.Provider>,
      )
    const result = {
      baselineRemainingYears: 18.12, rawMultiplier: 1, appliedMultiplier: 1, centralRemainingYears: 18.12,
      bandLowRemainingYears: 16.3, bandHighRemainingYears: 19.6, illustrativePlanningAge: 87.6,
    }
    const answers = {
      age: 65, sex: 'male', bmiCategory: 'normal', smoking: 'never', alcohol: 'moderate', activity: 'moderate',
      diabetes: 'no', selfRatedHealth: 'good', parentalLongevity: 'unknown',
    } as const
    try {
      // Saved before the edition was recorded: the 2022 table, and its page.
      saveLongevity({ version: 1, updatedAt: '2026-09-01T00:00:00.000Z', answers, result })
      let el = page()
      expect(el.textContent).toContain('plan runs to age 88 (life-expectancy questionnaire estimate, SSA 2022 period life table, 2025 Trustees Report)')
      const personRow = () => Array.from(el.querySelectorAll('tr')).find((tr) => tr.textContent.includes(`${person.name}: retirement & planning age`))!
      expect(personRow().querySelector('a')!.getAttribute('href')).toBe('https://www.ssa.gov/oact/STATS/table4c6_2022_TR2025.html')
      act(() => root!.unmount())
      container?.remove()
      root = null
      clearLongevity()
      el = page()
      expect(el.textContent).toContain('plan runs to age 88 (life-expectancy questionnaire estimate, table edition not recorded)')
      expect(personRow().querySelector('a')).toBeNull()
    } finally {
      clearLongevity()
    }
  })
})

describe('HowTestedPage', () => {
  it('ships real harness names and non-stale counts', () => {
    const el = render(<HowTestedPage />)
    const text = el.textContent
    // Counts are glob-derived from the source tree; sanity-floor them so the
    // page can never render an empty validation story.
    const externalCount = Number(text.match(/(\d+) external-oracle suites/)?.[1])
    expect(externalCount).toBeGreaterThanOrEqual(5)
    const goldenCount = Number(text.match(/(\d+) suites hold fixed expected values/)?.[1])
    expect(goldenCount).toBeGreaterThan(externalCount)
    // Named oracles and the invariance fixture citation.
    expect(text).toContain('PolicyEngine-US')
    expect(text).toContain('assetLocationInvariance')
    // The caveats ship as prominently as the strengths.
    expect(text).toContain('deliberately simplifies')
    expect(text).toContain('single long-term-gains rate')
  })

  it('names no competing planner products', () => {
    const text = render(<HowTestedPage />).textContent
    for (const name of ['Boldin', 'Pralana', 'ProjectionLab', 'Owl', 'NewRetirement']) {
      expect(text).not.toContain(name)
    }
  })

  it('offers a chrome back link to the Disclaimer it is reached from (#419)', () => {
    const el = render(<HowTestedPage />)
    const back = el.querySelector('a.page-back')
    expect(back?.getAttribute('href')).toBe('/disclaimer')
    expect(back?.textContent).toMatch(/← Disclaimer/)
    // It sits above the h1 as page chrome, not inside the prose.
    expect(back!.compareDocumentPosition(el.querySelector('h1')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
