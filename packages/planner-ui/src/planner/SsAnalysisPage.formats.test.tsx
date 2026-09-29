/** @vitest-environment jsdom */
/**
 * The In-your-plan tab's formatting edges that no example plan reaches (the
 * B2-P1 slice 5 review's L9): a change that prints as $0 carries no sign, a
 * years difference of 0 reads "0 yr", and a heatmap missing a combination is
 * refused rather than drawn. The engine's sweep runs for real; only the
 * figures under test are replaced.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '@retiregolden/engine/model/plan'
import { refineClaimAgeMonthly, sweepClaimAges } from '@retiregolden/engine/decisions/claimAgeSweep'
import { getExampleById } from './examples/registry'
import { demoPlanId } from './examples/loadExample'
import { waitFor } from '../testSupport/settle'
import { SsAnalysisPage } from './SsAnalysisPage'
import { PlanCtx, type PlanContextValue } from './planContextCore'

vi.mock('@retiregolden/engine/decisions/claimAgeSweep', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@retiregolden/engine/decisions/claimAgeSweep')>()
  return { ...actual, sweepClaimAges: vi.fn(actual.sweepClaimAges), refineClaimAgeMonthly: vi.fn(actual.refineClaimAgeMonthly) }
})
const actual = await vi.importActual<typeof import('@retiregolden/engine/decisions/claimAgeSweep')>('@retiregolden/engine/decisions/claimAgeSweep')

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  vi.mocked(sweepClaimAges).mockImplementation(actual.sweepClaimAges)
  vi.mocked(refineClaimAgeMonthly).mockImplementation(actual.refineClaimAgeMonthly)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

async function render(plan: Plan): Promise<void> {
  const value: PlanContextValue = { plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanCtx.Provider value={value}>
          <SsAnalysisPage />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  await waitFor(() => container.querySelector('.skeleton') === null, {
    what: 'the claim-age sweep',
    attempts: 1500,
    intervalMs: 20,
    describe: () => container.textContent ?? '',
  })
}

function single(): Plan {
  const draft = createEmptyPlan({ newId: (() => { let n = 0; return () => `formats-${++n}` })() })
  draft.household.people[0] = { id: 'p1', name: 'Pat', dob: '1964-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 92, source: 'manual' } }
  draft.assumptions.inflationPct = 2
  draft.assumptions.defaultReturnPct = 5
  draft.expenses.baseAnnual = 45_000
  const taxable: Account = { type: 'taxable', id: 'brokerage', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 900_000, costBasis: 900_000, annualContribution: 0 }
  draft.accounts = [taxable]
  draft.incomes = [{ type: 'socialSecurity', id: 'ss', personId: 'p1', piaMonthly: 2_500, earnings: null, claimAge: { years: 67, months: 0 } }]
  const parsed = parsePlan(draft)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

const text = (): string => (container.textContent ?? '').replace(/\s+/gu, ' ')

describe('In your plan: formatting edges', () => {
  it('prints a change that rounds to $0 without a sign or a colour (SP1)', async () => {
    vi.mocked(sweepClaimAges).mockImplementation((plan, options) => ({ ...actual.sweepClaimAges(plan, options), winnerEstateChangeVsCurrent: 0.3 }))
    await render(single())
    const callout = container.querySelector('.callout--info')!
    expect(callout.textContent).toContain('($0)')
    expect(callout.textContent).not.toMatch(/[+−]\$0\b/u)
    expect(callout.querySelector('.delta-pos, .delta-neg')).toBeNull()
  }, 120_000)

  it('prints a years difference of 0 as "0 yr", with no sign (SP9)', async () => {
    // The durability label, over the estate ranking's winner, so a refinement exists to print.
    vi.mocked(sweepClaimAges).mockImplementation((plan, options) => ({
      ...actual.sweepClaimAges(plan, { ...options, objectivePolicyId: 'max-after-tax-estate' }),
      objectivePolicyId: options.objectivePolicyId,
      primaryMetricLabel: 'Money-lasts delta (years)',
    }))
    vi.mocked(refineClaimAgeMonthly).mockImplementation(() => ({
      claimByPersonId: { p1: { years: 69, months: 6 } },
      endingAfterTaxEstate: 1_000_000,
      primaryValue: 1,
      moved: true,
      estateChangeVsWinner: 1_000,
      primaryChangeVsWinner: 0,
      evaluations: 25,
      rejectedIneligibleBetter: 0,
    }))
    await render(single())
    const select = [...container.querySelectorAll<HTMLSelectElement>('select')].find((s) => [...s.options].some((o) => o.value === 'max-spending-durability'))!
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!
    await act(async () => {
      setter.call(select, 'max-spending-durability')
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await waitFor(() => container.querySelector('.skeleton') === null && [...container.querySelectorAll('button')].some((b) => b.textContent === 'Refine to the month'), {
      what: 'the durability sweep',
      attempts: 1500,
      intervalMs: 20,
      describe: () => container.textContent ?? '',
    })
    const refine = [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Refine to the month')!
    await act(async () => refine.click())
    expect(text()).toContain('; 0 yr on money-lasts delta (years)')
    expect(text()).not.toContain('+0 yr')
  }, 120_000)

  it('refuses to draw a heatmap missing a combination, naming it (SP8)', async () => {
    vi.mocked(sweepClaimAges).mockImplementation((plan, options) => {
      const sweep = actual.sweepClaimAges(plan, options)
      return { ...sweep, rows: sweep.rows.slice(1) }
    })
    const built = getExampleById('example-couple')!.build()
    await render({ ...built, id: demoPlanId('example-couple'), origin: 'example', exampleSourceId: 'example-couple' })
    const alert = [...container.querySelectorAll('[role="alert"]')].map((a) => a.textContent ?? '').find((t) => t.includes('missing'))
    expect(alert).toMatch(/The claim-age comparison is missing a combination \(\s*\d+ \/ \d+\), so the heatmap is not shown\./u)
    expect(container.querySelectorAll('.heatmap-cell-button')).toHaveLength(0)
  }, 120_000)
})
