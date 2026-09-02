/** @vitest-environment jsdom */
/**
 * Strategy charitable-giving cross-reference (#518): the copy points at the
 * Retirement actions card only while that card is on the page; otherwise it
 * says what would make the card appear. The optional money floors show what a
 * blank means instead of an empty box.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { createEmptyPlan, type Plan } from '@retiregolden/engine/model/plan'
import { createSamplePlan } from '../../testSupport/samplePlan'
import { settle, waitFor } from '../../testSupport/settle'
import { PlanCtx, type PlanContextValue } from '../planContextCore'
import { StrategySection } from './StrategySection'

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

async function mount(plan: Plan) {
  const value: PlanContextValue = { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanCtx.Provider value={value}>
          <StrategySection />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  await settle()
}

function h2s(): string[] {
  return [...container.querySelectorAll('h2')].map((h) => h.textContent ?? '')
}

describe('StrategySection charitable copy (#518)', () => {
  it('points at the Retirement actions card when the plan mounts one', async () => {
    const plan = createSamplePlan()
    await mount(plan)
    await waitFor(() => h2s().includes('Retirement actions'), { what: 'the lazy Retirement actions card' })
    expect(container.textContent).toContain('in the Retirement actions card above')
    expect(container.textContent).not.toContain('a Retirement actions card appears above')
  })

  it('says what would make the card appear when there is none to point at', async () => {
    const plan = createEmptyPlan({ name: 'Bare' })
    await mount(plan)
    await settle()
    expect(h2s()).not.toContain('Retirement actions')
    expect(container.textContent).toContain('a Retirement actions card appears above')
    expect(container.textContent).not.toContain('in the Retirement actions card above')
  })

  it('the optional floors say what blank means inside the box', async () => {
    const plan = createSamplePlan()
    await mount(plan)
    const placeholders = [...container.querySelectorAll('.input-affix input')].map((el) => el.getAttribute('placeholder'))
    expect(placeholders).toContain('No floor')
    expect(placeholders).toContain('No reserve')
    // Required money fields keep no placeholder: their zero is a value.
    const floor = [...container.querySelectorAll('label')].find((l) => l.textContent === 'Taxable safety-net floor')!
    const input = document.getElementById(floor.htmlFor) as HTMLInputElement
    expect(input.value).toBe('')
    expect(input.placeholder).toBe('No floor')
    // While the placeholder shows, the "$" chip steps back so the box does not
    // read "$ No floor"; a required money field keeps its chip.
    expect(input.parentElement!.querySelector('span')!.className).toBe('input-affix-unit--blank')
    // Focus alone keeps the placeholder, so the chip stays back until a character is typed.
    await act(async () => {
      input.focus()
    })
    expect(document.activeElement).toBe(input)
    expect(input.parentElement!.querySelector('span')!.className).toBe('input-affix-unit--blank')
    // The wrapper carries the opt-in modifier the placeholder rule is scoped to.
    expect(input.parentElement!.className).toBe('input-affix input-affix--optional')
    const qcd = [...container.querySelectorAll('label')].find((l) => l.textContent === "QCD per year (today's $)")!
    const qcdInput = document.getElementById(qcd.htmlFor) as HTMLInputElement
    expect(qcdInput.value).toBe('0')
    expect(qcdInput.parentElement!.querySelector('span')!.className).toBe('')
    expect(qcdInput.parentElement!.className).toBe('input-affix')
  })
})
