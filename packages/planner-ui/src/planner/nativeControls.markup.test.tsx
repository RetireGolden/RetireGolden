/** @vitest-environment jsdom */
/**
 * Markup half of the shared native-control treatment (PR #472). The CSS pins
 * live in designQa.chrome.test.ts; these cover what the CSS cannot: a select
 * carries its full label as a title (placeholder included), a suffixed number
 * field names its unit to assistive tech, the Strategy bracket target moved
 * its percent into that suffix, and the Social Security discount-rate slider
 * has an accessible name and a unit-bearing value text (#456).
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { createSamplePlan } from '../testSupport/samplePlan'
import { NumberField, PercentField, SelectField } from './fields'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { SsAnalysisPage } from './SsAnalysisPage'
import { StrategySection } from './sections'

let root: Root | null = null
let host: HTMLDivElement | null = null

afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount())
  host?.remove()
  root = null
  host = null
})

async function render(node: React.ReactNode) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => root!.render(node))
  return host
}

function contextFor(plan = createSamplePlan()): PlanContextValue {
  return { plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }
}

describe('SelectField title', () => {
  const options = [
    { value: 'a', label: 'Maximize after-tax estate' },
    { value: 'b', label: 'Maximize spending durability' },
  ] as const

  it('carries the selected option label so a clipped select still reveals it on hover', async () => {
    const el = await render(<SelectField label="Rank by" value="a" options={options} onCommit={() => undefined} />)
    expect(el.querySelector('select')!.title).toBe('Maximize after-tax estate')
  })

  it('falls back to the placeholder while nothing is chosen', async () => {
    const el = await render(
      <SelectField label="Class" value="" placeholder="Choose beneficiary class" options={options} onCommit={() => undefined} />,
    )
    expect(el.querySelector('select')!.title).toBe('Choose beneficiary class')
  })
})

describe('NumberField suffix is the accessible unit', () => {
  it('describes the input with the suffix instead of hiding it', async () => {
    const el = await render(<PercentField label="Bracket" value={22} onCommit={() => undefined} />)
    const input = el.querySelector('input')!
    const unit = el.querySelector('.input-affix > span')!
    expect(unit.textContent).toBe('%')
    expect(unit.getAttribute('aria-hidden')).toBeNull()
    expect(unit.id).toBeTruthy()
    expect(input.getAttribute('aria-describedby')).toBe(unit.id)
  })

  it('adds no description when there is no suffix', async () => {
    const el = await render(<NumberField label="Tier index" value={1} onCommit={() => undefined} />)
    expect(el.querySelector('input')!.getAttribute('aria-describedby')).toBeNull()
  })
})

describe('Strategy bracket target (#451)', () => {
  // #451 asked that the unit ride with the value rather than sit in the label
  // ("Bracket (%)"). Since #495 decision D6 the control is a select of the
  // published rates (#508), so the percent rides in each option's own text
  // instead of an affix — the same rule, the control the decision chose.
  it('labels the field Bracket and puts the percent on the value, not the label', async () => {
    const plan = createSamplePlan()
    plan.strategies.rothConversion = {
      mode: 'fillToTarget',
      target: 'topOfBracket',
      targetValue: 22,
      startYear: 2027,
      endYear: 2035,
    }
    const el = await render(
      <MemoryRouter initialEntries={['/plan/x/strategy']}>
        <PlanCtx.Provider value={contextFor(plan)}>
          <StrategySection />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
    const field = [...el.querySelectorAll('.field')].find(
      (f) => f.querySelector('.field-label')?.textContent === 'Bracket',
    )
    expect(field, 'a field labelled exactly "Bracket"').toBeDefined()
    const select = field!.querySelector('select')
    expect(select, 'the bracket control is a select of the published rates').not.toBeNull()
    // Each option leads with its own rate and unit; the top bracket then says
    // what it does, since there is nothing above it to fill (#508 review r1-2).
    expect([...select!.options].filter((o) => !o.disabled).map((o) => /^\d+(\.\d+)?%/.test(o.textContent ?? ''))).not.toContain(false)
    expect(el.textContent).not.toContain('Bracket (%)')
  })
})

describe('Social Security discount-rate slider (#456)', () => {
  it('has an accessible name and a percent value text', async () => {
    const el = await render(
      <MemoryRouter>
        <PlanCtx.Provider value={contextFor()}>
          <SsAnalysisPage />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
    const tab = [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) => b.textContent === 'Benefits only')!
    await act(async () => {
      tab.click()
    })
    const slider = el.querySelector<HTMLInputElement>('input[type="range"]')!
    expect(slider).not.toBeNull()
    expect(slider.getAttribute('aria-label')).toBe('Real discount rate')
    expect(slider.getAttribute('aria-valuetext')).toBe(`${slider.value}%`)
  })
})
