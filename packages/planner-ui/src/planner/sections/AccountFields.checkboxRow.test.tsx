/** @vitest-environment jsdom */
/**
 * Contribution-row checkbox alignment (#516): the centring rule in
 * planner.css targets `.form-grid > .field--checkbox > input[type='checkbox']`
 * inside a subgridded two-child field. jsdom computes no layout, so this
 * pins the markup half — the rule's selector matches the real "Schedule
 * contributions over time" box, and the field has exactly the two children
 * the subgrid rule keys on — while designQa.clusterB.test.ts pins the sheet.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { createEmptyPlan, type Account, type Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx } from '../planContextCore'
import { AccountFields } from './AccountFields'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

let n = 0
const testIds = () => `cb-${++n}`

function renderAccount(account: Account) {
  const plan: Plan = createEmptyPlan({ newId: testIds })
  plan.accounts = [account]
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      <MemoryRouter>
        <PlanCtx.Provider
          value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}
        >
          <AccountFields account={account} index={0} />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  return container
}

const CENTRING_SELECTOR = ".form-grid > .field--checkbox > input[type='checkbox']"
const TWO_CHILD_FIELD_SELECTOR = '.form-grid > .field:has(> :nth-child(2)):not(:has(> :nth-child(3)))'

describe('contribution-row checkbox markup (#516)', () => {
  it('the centring selector matches the Schedule-contributions box in a two-child subgrid field', () => {
    const el = renderAccount({
      type: 'cash',
      id: 'cash',
      name: 'Savings',
      ownerPersonId: null,
      annualReturnPct: null,
      balance: 10_000,
      annualContribution: 0,
    })
    const label = Array.from(el.querySelectorAll('label.field-label')).find(
      (l) => l.textContent?.trim() === 'Schedule contributions over time',
    )!
    expect(label).toBeDefined()
    const box = el.ownerDocument.getElementById(label.getAttribute('for')!) as HTMLInputElement
    expect(box.type).toBe('checkbox')
    // The rule reaches this exact element, and its field is the two-child
    // shape the subgrid rule keys on (label row + control), in a form grid
    // beside the money fields it has to line up with.
    expect(Array.from(el.querySelectorAll(CENTRING_SELECTOR))).toContain(box)
    const field = box.parentElement!
    expect(field.classList.contains('field--checkbox')).toBe(true)
    expect(field.children).toHaveLength(2)
    expect(field.parentElement!.classList.contains('form-grid')).toBe(true)
    const money = Array.from(el.querySelectorAll('label.field-label')).find((l) => l.textContent?.trim() === 'Annual contribution')!
    expect(money.closest('.form-grid')).toBe(field.parentElement)
    // jsdom cannot evaluate :has(); guard the selector text the sheet uses.
    expect(TWO_CHILD_FIELD_SELECTOR).toContain('.field:has(> :nth-child(2)):not(:has(> :nth-child(3)))')
  })
})
