/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { createEmptyPlan, type Account, type Plan } from '@retiregolden/engine/model/plan'

import { PlanCtx } from '../planContextCore'
import { AccountFields } from './AccountFields'
import { EVEN_START_WEIGHTS, TAX_EXEMPT_ALLOCATION_DOUBLE_COUNT_WARNING } from './sectionHelpers'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

let n = 0
const testIds = () => `af-${++n}`

function taxableAccount(overrides: Partial<Extract<Account, { type: 'taxable' }>> = {}): Extract<Account, { type: 'taxable' }> {
  return {
    type: 'taxable',
    id: 'brokerage',
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance: 100_000,
    costBasis: 100_000,
    annualContribution: 0,
    ...overrides,
  }
}

function planWithAccount(account: Extract<Account, { type: 'taxable' }>): Plan {
  const plan = createEmptyPlan({ newId: testIds })
  plan.accounts = [account]
  return plan
}

function renderFields(plan: Plan, accountIndex = 0) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const account = plan.accounts[accountIndex] as Extract<Account, { type: 'taxable' }>
  const panel: ReactNode = (
    <MemoryRouter>
      <PlanCtx.Provider value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
        <AccountFields account={account} index={accountIndex} />
      </PlanCtx.Provider>
    </MemoryRouter>
  )
  act(() => {
    root!.render(panel)
  })
  return container
}

function warningText(): string | null {
  return container?.textContent?.includes(TAX_EXEMPT_ALLOCATION_DOUBLE_COUNT_WARNING) ? TAX_EXEMPT_ALLOCATION_DOUBLE_COUNT_WARNING : null
}

describe('AccountFields tax-exempt interest double-count warning', () => {
  it('warns when allocation is set, tax-exempt yield is entered, and interest yield is blank', () => {
    renderFields(
      planWithAccount(
        taxableAccount({
          allocation: { mode: 'static', rebalancing: 'annual', weights: { ...EVEN_START_WEIGHTS } },
          taxExemptInterestYieldPct: 3,
          interestYieldPct: undefined,
        }),
      ),
    )
    expect(warningText()).toBe(TAX_EXEMPT_ALLOCATION_DOUBLE_COUNT_WARNING)
  })

  it('does not warn when interest yield override is set to 0', () => {
    renderFields(
      planWithAccount(
        taxableAccount({
          allocation: { mode: 'static', rebalancing: 'annual', weights: { ...EVEN_START_WEIGHTS } },
          taxExemptInterestYieldPct: 3,
          interestYieldPct: 0,
        }),
      ),
    )
    expect(warningText()).toBeNull()
  })

  it('does not warn when interest yield override is set to a positive value', () => {
    renderFields(
      planWithAccount(
        taxableAccount({
          allocation: { mode: 'static', rebalancing: 'annual', weights: { ...EVEN_START_WEIGHTS } },
          taxExemptInterestYieldPct: 3,
          interestYieldPct: 1.5,
        }),
      ),
    )
    expect(warningText()).toBeNull()
  })

  it('does not warn when allocation is absent', () => {
    renderFields(
      planWithAccount(
        taxableAccount({
          taxExemptInterestYieldPct: 3,
          interestYieldPct: undefined,
        }),
      ),
    )
    expect(warningText()).toBeNull()
  })
})
