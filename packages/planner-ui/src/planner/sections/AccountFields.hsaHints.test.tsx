/** @vitest-environment jsdom */
/**
 * HSA beneficiary fields (#516): an HSA carries both the older Beneficiary
 * shorthand and the shared Estate beneficiary; each field's hint says which
 * wins, matching the engine's resolution (explicit estate destination first,
 * else the shorthand — projection/compare.ts resolveEstateDestination).
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
const testIds = () => `hsa-${++n}`

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

describe('HSA beneficiary hints (#516)', () => {
  it('tells apart the Beneficiary shorthand from the Estate beneficiary override', () => {
    const el = renderAccount({
      type: 'hsa',
      id: 'hsa',
      name: 'HSA',
      ownerPersonId: null,
      annualReturnPct: null,
      balance: 10_000,
      annualContribution: 0,
    })
    const labels = Array.from(el.querySelectorAll('label.field-label')).map((l) => l.textContent?.trim())
    expect(labels).toContain('Beneficiary')
    expect(labels).toContain('Estate beneficiary')
    expect(el.textContent).toContain('Spouse / non-spouse shorthand. An Estate beneficiary set below overrides it.')
    expect(el.textContent).toContain('Blank = follows the Beneficiary above.')
    expect(el.textContent).not.toContain('Blank = default by account type.')
    // The blank option itself says the same thing; "by account type" would
    // contradict the untaxed spouse outcome the shorthand can produce.
    const estate = Array.from(el.querySelectorAll('label.field-label')).find((l) => l.textContent?.trim() === 'Estate beneficiary')!
    const select = el.ownerDocument.getElementById(estate.getAttribute('for')!) as HTMLSelectElement
    expect(select.options[0]!.value).toBe('')
    expect(select.options[0]!.textContent).toBe('Default (follows Beneficiary above)')
  })

  it('keeps the by-type hint on accounts without the shorthand', () => {
    const el = renderAccount({
      type: 'roth',
      id: 'roth',
      name: 'Roth IRA',
      ownerPersonId: null,
      annualReturnPct: null,
      kind: 'ira',
      balance: 10_000,
      annualContribution: 0,
    })
    expect(el.textContent).toContain('Blank = default by account type.')
    expect(el.textContent).not.toContain('follows the Beneficiary above')
    expect(el.textContent).toContain('Default (by account type)')
  })
})
