/** @vitest-environment jsdom */
/**
 * D-LIFE-TABLE-2023 on the Household page: the Sex field says where sex is
 * used and what "Not stated" means (the 50/50 mixture of the two survival
 * curves), and a percentile pick is restated with the SSA table edition it was
 * made on, never relabelled with the one the planner carries now.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx } from '../planContextCore'
import { createSamplePlan } from '../../testSupport/samplePlan'
import { HouseholdSection } from './HouseholdSection'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

function mount(plan: Plan): HTMLElement {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      <MemoryRouter initialEntries={['/plan/x/household']}>
        <PlanCtx.Provider
          value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}
        >
          <HouseholdSection />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  return container
}

function sexSelect(el: HTMLElement): HTMLSelectElement {
  const label = Array.from(el.querySelectorAll('label')).find((l) => l.textContent?.trim() === 'Sex')!
  return el.ownerDocument.getElementById(label.htmlFor) as HTMLSelectElement
}

function withPercentilePick(tableEdition?: { periodYear: number; trusteesReportYear: number }): Plan {
  const plan = createSamplePlan()
  const person = plan.household.people[0]!
  person.longevity = {
    planningAge: 93,
    source: 'percentile',
    percentile: { pct: 25, joint: false, ...(tableEdition ? { tableEdition } : {}) },
  }
  return plan
}

describe('Household sex and the SSA life table', () => {
  it('labels the unstated option "Not stated (average of male and female)" and says where sex is used', () => {
    const el = mount(createSamplePlan())
    const select = sexSelect(el)
    const labels = Array.from(select.options).map((option) => option.textContent)
    expect(labels).toEqual(['Female', 'Male', 'Not stated (average of male and female)'])
    const help = el.textContent ?? ''
    expect(help).toContain('the survival-percentile planning age, the survival-percentile spending horizon, the Social Security expected values, the lifespans Monte Carlo draws when it models longevity, and the taxable share of a joint-and-survivor annuity')
    expect(help).toContain("'Not stated' averages the male and female chances of being alive at each age, as for someone equally likely to be either.")
    expect(help).not.toContain('Only used as the baseline for the life-expectancy estimate')
    expect(help).not.toContain('blended table')
  })

  it('restates a pick made before the table edition was stored as a 2022 pick, and says the planner has moved on', () => {
    const el = mount(withPercentilePick())
    const text = (el.textContent ?? '').replace(/\s+/gu, ' ')
    expect(text).toContain('(SSA 2022 period life table; the planner now uses the 2023 table). Re-open Percentile to refresh it as ages change.')
  })

  it('restates a pick made on the 2023 table as a 2023 pick', () => {
    const el = mount(withPercentilePick({ periodYear: 2023, trusteesReportYear: 2026 }))
    const text = (el.textContent ?? '').replace(/\s+/gu, ' ')
    expect(text).toContain('(SSA 2023 period life table). Re-open Percentile to refresh it as ages change.')
    expect(text).not.toContain('the planner now uses')
  })
})
