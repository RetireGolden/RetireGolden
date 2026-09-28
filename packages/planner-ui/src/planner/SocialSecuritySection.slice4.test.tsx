/** @vitest-environment jsdom */
/**
 * The Social Security step's AIME explainer and credit note read the engine
 * (B2-P1 slice 4): the zero-year counts from PiaFromEarningsResult, the exact
 * zero-year gain naming the replaced year, and the credit estimate at each
 * year's quarter-of-coverage amount.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'

import { PlanCtx } from './planContextCore'
import { SocialSecuritySection } from './SocialSecuritySection'

let root: Root | null = null
let container: HTMLDivElement | null = null
let counter = 0
const id = () => `ss-s4s-${++counter}`

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
})

afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount())
  container?.remove()
  root = null
  container = null
  vi.useRealTimers()
})

function plan(dob: string, earnings: { year: number; amount: number }[]): Plan {
  const draft = createEmptyPlan({ newId: id })
  draft.household.people[0] = { id: 'p1', name: 'Pat', dob, sex: 'female', retirementAge: null, longevity: { planningAge: 92, source: 'manual' } }
  draft.incomes = [{ type: 'socialSecurity', id: id(), personId: 'p1', piaMonthly: null, earnings, claimAge: { years: 67, months: 0 } }]
  const parsed = parsePlan(draft)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

async function mount(initialPlan: Plan): Promise<string> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () =>
    root!.render(
      <MemoryRouter>
        <PlanCtx.Provider value={{ plan: initialPlan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
          <SocialSecuritySection />
        </PlanCtx.Provider>
      </MemoryRouter>,
    ),
  )
  return (container.textContent ?? '').replace(/\s+/gu, ' ')
}

describe('Social Security step: the explainer and the credit note on the engine', () => {
  it('counts the averaged $0 years and names the replaced year: 2027 at $60,000 adds $46/mo', async () => {
    // Born 1966-07-20, $60,000 each year 1995-2024 (the zero-year worksheet's case A).
    const earnings = Array.from({ length: 30 }, (_, i) => ({ year: 1995 + i, amount: 60_000 }))
    const page = await mount(plan('1966-07-20', earnings))
    expect(page).toContain('Averages your top 35 earning years (wage-indexed) into an AIME of $7,487/mo.')
    expect(page).toContain('5 of those 35 years are $0.')
    expect(page).toContain('Replacing your $0 year in 2027 with about $60,000 of earnings would add $46/mo.')
    expect(page).not.toContain('rough estimate at the current bend rate')
    expect(page).toContain('Blank = estimated 40 from your earnings (40 needed).')
  })

  it('past 61 the $0 year has passed: it says what 2019 would have added, $23/mo in 2026 dollars (17.90 for 2020)', async () => {
    // Born 1958-06-15, $50,000 each year 1985-2015 (the zero-year worksheet's case O).
    const earnings = Array.from({ length: 31 }, (_, i) => ({ year: 1985 + i, amount: 50_000 }))
    const page = await mount(plan('1958-06-15', earnings))
    expect(page).toContain('Had you earned about $50,000 in 2019, one of your $0 years, your benefit would be $23/mo higher in 2026 dollars.')
    expect(page).not.toContain('Replacing your $0 year in 2019')
  })

  it("estimates credits at each year's amount: 11 for the credit worksheet's case A, where one 2025 amount gave 5", async () => {
    const earnings = [{ year: 1980, amount: 1_200 }, { year: 1990, amount: 1_500 }, { year: 2025, amount: 5_000 }, { year: 2026, amount: 7_000 }]
    const page = await mount(plan('1958-04-10', earnings))
    expect(page).toContain('Blank = estimated 11 from your earnings (40 needed).')
    expect(page).toContain('Estimated 11 of the 40 credits needed')
    expect(page).toContain("each year's SSA earnings amount")
  })
})
