/** @vitest-environment jsdom */
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createEmptyPlan, type Plan } from '@retiregolden/engine/model/plan'
import { ImportAvailabilityProvider } from '../../import/ImportAvailabilityProvider'
import { PlanCtx } from '../planContextCore'
import { SocialSecuritySection } from '../SocialSecuritySection'
import { LivePricesCard } from './IncomeFloorSection'

vi.mock('../../data/fedInvestClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/fedInvestClient')>()
  return {
    ...actual,
    fetchFedInvestTips: vi.fn(async () => {
      throw new Error('FedInvest unavailable for test')
    }),
    readFedInvestCache: vi.fn(() => null),
  }
})

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

function planTree(plan: Plan, child: ReactNode, importEnabled: boolean) {
  return (
    <MemoryRouter>
      <PlanCtx.Provider
        value={{
          plan,
          update: (mutator) => mutator(plan),
          discardPendingSave: () => undefined,
          saveState: 'saved',
          issues: [],
        }}
      >
        <ImportAvailabilityProvider enabled={importEnabled}>{child}</ImportAvailabilityProvider>
      </PlanCtx.Provider>
    </MemoryRouter>
  )
}

function socialSecurityPlan(): Plan {
  const plan = createEmptyPlan({ newId: () => crypto.randomUUID() })
  const person = plan.household.people[0]!
  plan.incomes.push({
    type: 'socialSecurity',
    id: 'social-security-test',
    personId: person.id,
    piaMonthly: null,
    earnings: [],
    claimAge: { years: 67, months: 0 },
  })
  return plan
}

function incomeFloorPlan(): Plan {
  const plan = createEmptyPlan({ newId: () => crypto.randomUUID() })
  plan.incomeFloor = {
    ladders: [
      {
        id: 'ladder-test',
        name: 'Test ladder',
        purpose: 'floor',
        startYear: new Date().getFullYear() + 1,
        endYear: new Date().getFullYear() + 2,
        annualRealAmount: 12_000,
      },
    ],
  }
  return plan
}

describe('host file-import availability', () => {
  it('removes the mySSA XML chooser while leaving manual earnings entry available', () => {
    const disabled = renderToString(planTree(socialSecurityPlan(), <SocialSecuritySection />, false))
    expect(disabled).toContain('You can still enter annual earnings above')
    expect(disabled).toContain('Annual covered earnings')
    expect(disabled).not.toContain('Import mySSA statement')
    expect(disabled).not.toContain('type="file"')

    const enabled = renderToString(planTree(socialSecurityPlan(), <SocialSecuritySection />, true))
    expect(enabled).toContain('Import mySSA statement')
    expect(enabled).toContain('type="file"')
  })

  it('removes the FedInvest CSV chooser after a failed live fetch', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root!.render(planTree(incomeFloorPlan(), <LivePricesCard />, false))
    })
    const fetchButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Fetch live prices'),
    )
    expect(fetchButton).toBeDefined()

    await act(async () => {
      fetchButton!.click()
    })

    expect(container.textContent).toContain('File import is temporarily unavailable')
    expect(container.textContent).not.toContain('Import securityprice.csv')
    expect(container.querySelector('input[type="file"]')).toBeNull()

    await act(async () => {
      root!.render(planTree(incomeFloorPlan(), <LivePricesCard />, true))
    })
    expect(container.textContent).toContain('Import securityprice.csv')
    expect(container.querySelector('input[type="file"]')).not.toBeNull()
  })
})
