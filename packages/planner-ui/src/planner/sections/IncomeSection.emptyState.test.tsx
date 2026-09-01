/** @vitest-environment jsdom */
/**
 * Income empty state (#421): with no income streams the section says so, in
 * the same words Insurance uses, and the line goes away once a stream exists.
 */
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'

import { PlanCtx } from '../planContextCore'
import { createSamplePlan } from '../../testSupport/samplePlan'
import { IncomeSection } from './IncomeSection'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount())
  container?.remove()
  root = null
  container = null
})

function emptyIncomePlan(): Plan {
  const plan = createSamplePlan()
  plan.incomes = []
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

async function mount(initialPlan: Plan) {
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
        <IncomeSection />
      </PlanCtx.Provider>
    )
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root!.render(<MemoryRouter><Harness /></MemoryRouter>))
  return container
}

describe('IncomeSection empty state (#421)', () => {
  it('shows the empty-state line when there are no income streams, above the Add buttons', async () => {
    const host = await mount(emptyIncomePlan())
    const empty = host.querySelector('.empty-state')
    expect(empty?.textContent).toBe('No income streams yet. Add one below.')
    const addRow = host.querySelector('.add-row')!
    expect(empty!.compareDocumentPosition(addRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect([...addRow.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      '+ Wages',
      '+ Recurring',
      '+ One-time',
    ])
  })

  it('drops the line once a stream is added', async () => {
    const host = await mount(emptyIncomePlan())
    const wages = [...host.querySelectorAll('button')].find((b) => b.textContent === '+ Wages')!
    await act(async () => wages.click())
    expect(host.querySelector('.empty-state')).toBeNull()
    expect(host.querySelectorAll('.item-row')).toHaveLength(1)
  })

  it('does not show the line for a plan that has income', async () => {
    const host = await mount(createSamplePlan())
    expect(host.querySelector('.empty-state')).toBeNull()
  })
})
