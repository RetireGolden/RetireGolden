/** @vitest-environment jsdom */
/**
 * Markup half of Design-QA cluster I. The stylesheet pins live in
 * designQa.clusterI.test.ts; these cover the two things a CSS pin cannot see:
 * that the LTC stress table really is rendered inside a named scroll region
 * (#575), and that the ⓘ really is the label's next sibling — the adjacency the
 * #573 rule matches on, which no stylesheet pin can prove.
 */
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'

import { createSamplePlan } from '../testSupport/samplePlan'
import { PlanCtx } from './planContextCore'
import { InsuranceSection } from './sections/InsuranceSection'
import { StrategySection } from './sections/StrategySection'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount())
  container?.remove()
  root = null
  container = null
})

function validPlan(mutate?: (plan: Plan) => void): Plan {
  const plan = createSamplePlan()
  mutate?.(plan)
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

/** Mounts `child` under a live plan context whose `update` re-renders, like the workspace does. */
async function mount(initialPlan: Plan, child: React.ReactNode) {
  function Harness() {
    const [plan, setPlan] = useState(initialPlan)
    return (
      <PlanCtx.Provider
        value={{
          plan,
          update: (mutator) =>
            setPlan((previous) => {
              const next = structuredClone(previous)
              mutator(next)
              return next
            }),
          discardPendingSave: () => undefined,
          saveState: 'saved',
          issues: [],
        }}
      >
        {child}
      </PlanCtx.Provider>
    )
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root!.render(<MemoryRouter><Harness /></MemoryRouter>))
  return container
}

describe('cluster I: the LTC stress table is inside a scroll region (#575)', () => {
  it('the table is wrapped in a named, table-wrap-chromed region that keeps all three rows', async () => {
    const host = await mount(validPlan(), <InsuranceSection />)
    const table = host.querySelector('table.compare-table')
    expect(table, 'the LTC stress table rendered').not.toBeNull()
    const region = table!.closest('[role="region"]')
    expect(region, 'the table is inside a scroll region').not.toBeNull()
    expect(region!.getAttribute('aria-label')).toBe('LTC stress test scenarios')
    // The wrap chrome is what carries overflow:auto and the scroll cue; --grow
    // is what stops a three-row table being sliced by the height cap (#468).
    expect(region!.className).toContain('year-table-wrap')
    expect(region!.className).toContain('year-table-wrap--grow')
    // Nothing was dropped on the way into the wrap.
    expect([...table!.querySelectorAll('tbody th')].map((th) => th.textContent)).toEqual([
      'No care needed',
      'Care, self-funded',
      'Care, insured',
    ])
  })
})

describe('cluster I: the help ⓘ is the label element it belongs to (#573)', () => {
  it('a hinted field renders the ⓘ as the label caption’s immediate next sibling', async () => {
    const host = await mount(
      validPlan((plan) => {
        plan.strategies.itemizedDeductions = { stateAndLocalTaxes: 0, mortgageInterest: 0, charitable: 0 }
      }),
      <StrategySection />,
    )
    const salt = [...host.querySelectorAll<HTMLElement>('.field-label')].find(
      (l) => l.textContent === 'State & local taxes (SALT)',
    )
    expect(salt, 'the SALT caption rendered').toBeDefined()
    // `.field-label-row > .field-label:has(+ .help-tip)` is what reserves the
    // icon's room; it matches only while the ⓘ is the caption's next sibling.
    const next = salt!.nextElementSibling
    expect(next?.className, 'the ⓘ follows the caption directly').toContain('help-tip')
    expect(salt!.parentElement?.className).toBe('field-label-row')
    // A field with no hint, help, learn link or source has no ⓘ at all, so the
    // reserved room is only ever taken where there is an icon to put in it.
    const plain = [...host.querySelectorAll<HTMLElement>('.field-label')].find(
      (l) => l.textContent === 'Mortgage interest',
    )
    expect(plain, 'the sibling caption rendered').toBeDefined()
    expect(plain!.nextElementSibling).toBeNull()
    // The two-child shape the form-grid subgrids into a shared label row: the
    // caption row and the control, nothing else, on both fields (#467, #473).
    for (const caption of [salt!, plain!]) {
      const field = caption.closest('.field')!
      expect(field.children).toHaveLength(2)
      expect(field.children[0]!.className).toBe('field-label-row')
    }
  })
})
