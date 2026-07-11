/** @vitest-environment jsdom */
/**
 * "Update balances from a broker CSV" wiring: the parser's review checklist is
 * surfaced before Apply, duplicate plan-account targets block Apply instead of
 * silently last-write-winning, and applying writes balances/basis to the plan.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { createEmptyPlan, type Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx } from '../planContextCore'
import { UpdateBalancesPanel } from './UpdateBalancesPanel'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

let n = 0
const testIds = () => `ub-${++n}`

function planWithAccounts(): Plan {
  const plan = createEmptyPlan({ newId: testIds })
  const ownerId = plan.household.people[0]!.id
  plan.accounts.push(
    { id: 'acct-brokerage', type: 'taxable', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 1, costBasis: 1, annualContribution: 0 },
    { id: 'acct-roth', type: 'roth', name: 'Roth IRA', ownerPersonId: ownerId, annualReturnPct: null, kind: 'ira', balance: 1, annualContribution: 0 },
  )
  return plan
}

function renderPanel(plan: Plan) {
  const update = (mutator: (draft: Plan) => void) => mutator(plan)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      <PlanCtx.Provider value={{ plan, update, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
        <UpdateBalancesPanel />
      </PlanCtx.Provider>,
    )
  })
  return container
}

const TWO_ACCOUNT_CSV = `"Positions for account Brokerage ...789 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"VTI","FUND","$50,000.00","$40,000.00"
"SWVXX","MONEY MARKET","$5,000.00","--"

"Positions for account Roth IRA ...321 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"FXAIX","FUND","$14,000.00","$12,000.00"
`

async function chooseFile(el: HTMLElement, text: string) {
  const input = el.querySelector<HTMLInputElement>('input[type="file"]')!
  Object.defineProperty(input, 'files', { value: [new File([text], 'positions.csv', { type: 'text/csv' })], configurable: true })
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

function selects(el: HTMLElement): HTMLSelectElement[] {
  return Array.from(el.querySelectorAll('tbody select'))
}

function applyButton(el: HTMLElement): HTMLButtonElement {
  return Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Apply selected'))!
}

describe('UpdateBalancesPanel', () => {
  it('shows the parser review checklist before Apply', async () => {
    const el = renderPanel(planWithAccounts())
    await chooseFile(el, TWO_ACCOUNT_CSV)
    expect(el.querySelector('.import-review')).not.toBeNull()
    // The partial-basis honesty item from the parser is visible to returning users.
    expect(el.textContent).toContain('no cost basis')
  })

  it('applies assigned balances and basis to the plan accounts', async () => {
    const plan = planWithAccounts()
    const el = renderPanel(plan)
    await chooseFile(el, TWO_ACCOUNT_CSV)

    // Name-similarity guesses should already point at the right accounts.
    const [first, second] = selects(el)
    expect(first!.value).toBe('acct-brokerage')
    expect(second!.value).toBe('acct-roth')

    act(() => applyButton(el).click())
    const brokerage = plan.accounts.find((a) => a.id === 'acct-brokerage')!
    expect(brokerage).toMatchObject({ balance: 55000, costBasis: 40000 })
    const roth = plan.accounts.find((a) => a.id === 'acct-roth')!
    expect(roth).toMatchObject({ balance: 14000 })
  })

  it('blocks Apply when two file accounts target the same plan account', async () => {
    const plan = planWithAccounts()
    const el = renderPanel(plan)
    await chooseFile(el, TWO_ACCOUNT_CSV)

    const [, second] = selects(el)
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!
      setter.call(second!, 'acct-brokerage')
      second!.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('same plan account')
    expect(applyButton(el).disabled).toBe(true)
    act(() => applyButton(el).click())
    // Nothing was written.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1 })
  })
})
