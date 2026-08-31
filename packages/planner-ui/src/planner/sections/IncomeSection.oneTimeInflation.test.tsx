/** @vitest-environment jsdom */

/**
 * The AUTHORED half of the plan-schema-v5 contract.
 *
 * v5 gives a one-time income stream an `inflationAdjusted` election, and the
 * two defaults around it deliberately differ: `migratePlanV4ToV5` writes FALSE
 * onto every stored plan (the only value that reprojects an existing file to
 * the numbers its owner last saw), while the editor authors NEW streams TRUE
 * (matching how the same person enters a one-time spending goal).
 *
 * The migrated half is pinned in the engine's `migrations.test.ts`. This file
 * pins the authored half, which nothing else could: `makeIncome` is local to
 * `IncomeSection.tsx` and is not exported, so flipping its default to `false`
 * type-checks and leaves every engine and planner-ui suite green while every
 * windfall a user adds after upgrading silently stops tracking a same-year
 * one-time goal.
 *
 * It also pins the amount LABEL, because the units being invisible is the
 * defect v5 exists to close. A label that stopped switching would leave the
 * election working and the user unable to see which reading is in force.
 */
import { act, useState, type ReactNode } from 'react'
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

async function mount(initialPlan: Plan, content: ReactNode = <IncomeSection />) {
  let current = initialPlan
  function Harness() {
    const [plan, setPlan] = useState(initialPlan)
    current = plan
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
        {content}
      </PlanCtx.Provider>
    )
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root!.render(<MemoryRouter><Harness /></MemoryRouter>))
  return { container, current: () => current }
}

function buttonByText(host: HTMLElement, text: string): HTMLButtonElement {
  const found = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)
  if (found === undefined) throw new Error(`no button labelled "${text}"`)
  return found as HTMLButtonElement
}

const labels = (host: HTMLElement): string[] =>
  [...host.querySelectorAll('.field-label')].map((l) => l.textContent ?? '')

function oneTimeOf(plan: Plan): Extract<Plan['incomes'][number], { type: 'oneTime' }> {
  const found = plan.incomes.find((i) => i.type === 'oneTime')
  if (found === undefined || found.type !== 'oneTime') throw new Error('no one-time stream in the plan')
  return found
}

describe('IncomeSection — one-time inflation election', () => {
  it('authors a new one-time stream with the election ON', async () => {
    const { container: host, current } = await mount(emptyIncomePlan())
    expect(current().incomes).toEqual([]) // the default is about to be observable

    await act(async () => buttonByText(host, '+ One-time').click())

    // The whole point: TRUE, not the migrated FALSE. A silent flip here would
    // pass every other suite in the repository.
    expect(oneTimeOf(current()).inflationAdjusted).toBe(true)
    // …and the plan the editor produces is one `parsePlan` accepts, so the
    // authored default cannot be a shape only the editor tolerates.
    expect(parsePlan(current()).ok).toBe(true)
  })

  it('states the units on the amount label, and switches them with the election', async () => {
    const { container: host, current } = await mount(emptyIncomePlan())
    await act(async () => buttonByText(host, '+ One-time').click())
    const year = oneTimeOf(current()).year

    // ON: today's dollars, grown to the event year.
    expect(labels(host)).toContain("Amount (today's $)")
    expect(labels(host)).not.toContain(`Amount (${year} $)`)

    const box = [...host.querySelectorAll('input[type="checkbox"]')].at(-1) as HTMLInputElement
    await act(async () => box.click())

    // OFF: dollars of the event year itself, taken as entered.
    expect(oneTimeOf(current()).inflationAdjusted).toBe(false)
    expect(labels(host)).toContain(`Amount (${year} $)`)
    expect(labels(host)).not.toContain("Amount (today's $)")
  })
})
