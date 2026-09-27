/** @vitest-environment jsdom */
/**
 * The Social Security step's "Computed PIA" line shows the PIA the projection
 * pays from: an earnings-derived PIA raised by the cost-of-living increases
 * since the eligibility year, with the eligibility-year amount beside it
 * (pia-cost-of-living-since-eligibility, decision D-SS-LAW-2).
 */
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'

import { PlanCtx } from './planContextCore'
import { SocialSecuritySection } from './SocialSecuritySection'

let root: Root | null = null
let container: HTMLDivElement | null = null
let counter = 0
const id = () => `ss-pia-${++counter}`

beforeEach(() => {
  // The line is priced for the projection's first year, the current year.
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
  draft.household.people[0] = {
    id: 'p1', name: 'Pat', dob, sex: 'male', retirementAge: null, longevity: { planningAge: 92, source: 'manual' },
  }
  draft.assumptions.inflationPct = 0
  draft.assumptions.ssCola = { mode: 'matchInflation' }
  draft.incomes = [{ type: 'socialSecurity', id: id(), personId: 'p1', piaMonthly: null, earnings, claimAge: { years: 67, months: 0 } }]
  const parsed = parsePlan(draft)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

async function mount(initialPlan: Plan): Promise<HTMLDivElement> {
  function Harness() {
    const [current, setPlan] = useState(initialPlan)
    return (
      <PlanCtx.Provider
        value={{
          plan: current,
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
        <SocialSecuritySection />
      </PlanCtx.Provider>
    )
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root!.render(<MemoryRouter><Harness /></MemoryRouter>))
  return container
}

function computedPiaLine(host: HTMLElement): string {
  const line = [...host.querySelectorAll<HTMLElement>('.field-hint')].find((p) => p.textContent?.startsWith('Computed PIA:'))
  if (!line) throw new Error('no Computed PIA line')
  return line.textContent.replace(/\s+/gu, ' ')
}

describe('Social Security step: computed PIA', () => {
  it('shows the PIA the projection pays from 2026, with the eligibility-year amount (3,364.40, not 2,846.40)', async () => {
    // Born 1960-05-01, $50,000 in each year 1982-2021: 2,846.40 for 2022,
    // raised by the December 2022-2025 increases to 3,364.40. The line rounds
    // to whole dollars.
    const earnings = Array.from({ length: 40 }, (_, i) => ({ year: 1982 + i, amount: 50_000 }))
    const text = computedPiaLine(await mount(plan('1960-05-01', earnings)))
    expect(text).toContain('Computed PIA: $3,364/mo at full retirement age, as the plan pays it from 2026.')
    expect(text).toContain('Your earnings give $2,846/mo for 2022, the year you became eligible at 62')
    expect(text).toContain('adds each cost-of-living increase from then, whether or not you have claimed: every increase through 2025.')
  })

  it('names the plan\'s COLA assumption for the years SSA has not announced (a 2028 start: 2026 and 2027)', async () => {
    // The same earnings, priced for a projection starting in 2028: the
    // published increases through 2025, then the plan's assumption (0% here,
    // inflation with a matched COLA) for 2026 and 2027.
    vi.setSystemTime(new Date('2028-06-15T12:00:00Z'))
    const earnings = Array.from({ length: 40 }, (_, i) => ({ year: 1982 + i, amount: 50_000 }))
    const text = computedPiaLine(await mount(plan('1960-05-01', earnings)))
    expect(text).toContain('as the plan pays it from 2028.')
    expect(text).toContain(
      "the published increases through 2025, and the plan's COLA assumption for 2026 and 2027, which Social Security has not yet announced.",
    )
    expect(text).not.toContain('every increase')
  })

  it('names only the plan\'s COLA assumption when every year since eligibility is unannounced', async () => {
    // Born 1965-04-20: eligible in 2027. A 2029 start raises the PIA by the
    // plan's assumption for 2027 and 2028 only.
    vi.setSystemTime(new Date('2029-06-15T12:00:00Z'))
    const earnings = Array.from({ length: 35 }, (_, i) => ({ year: 1990 + i, amount: 50_000 }))
    const text = computedPiaLine(await mount(plan('1965-04-20', earnings)))
    expect(text).toContain('for 2027, the year you became eligible at 62')
    expect(text).toContain(
      "whether or not you have claimed: the plan's COLA assumption for 2027 and 2028, which Social Security has not yet announced.",
    )
  })

  it('shows the earnings PIA unchanged, with no note, for a person not yet eligible', async () => {
    // Born 1970: eligible in 2032, after the projection's first year.
    const earnings = Array.from({ length: 30 }, (_, i) => ({ year: 1995 + i, amount: 50_000 }))
    const text = computedPiaLine(await mount(plan('1970-03-10', earnings)))
    expect(text).toMatch(/^Computed PIA: \$[\d,]+\/mo at full retirement age\./u)
    expect(text).not.toContain('Your earnings give')
  })
})
