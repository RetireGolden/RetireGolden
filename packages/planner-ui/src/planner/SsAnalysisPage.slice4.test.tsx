/** @vitest-environment jsdom */
/**
 * The Social Security analysis page on the engine's models (B2-P1 slice 4):
 * the break-even callout, the benefits-only headline and couple copy, the
 * paid-in panel in today's dollars, survivor switching with identical
 * strategies shown once, the disability refusal, and the couple primer's
 * full-retirement-age label.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createEmptyPlan, parsePlan, type FormerSpouse, type Plan } from '@retiregolden/engine/model/plan'
import { oasdiPaidIn } from '@retiregolden/engine/socialSecurity/analysis/oasdiReturn'
import { fmtMoney } from './format'
import { getExampleById } from './examples/registry'
import { waitFor } from '../testSupport/settle'
import { SsAnalysisPage } from './SsAnalysisPage'
import { PlanCtx, type PlanContextValue } from './planContextCore'

let container: HTMLDivElement
let root: Root
let counter = 0
const id = () => `ss-s4-${++counter}`

beforeEach(() => {
  // The page prices from the projection's first year, the current year.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

function contextFor(plan: Plan): PlanContextValue {
  return { plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }
}

async function render(plan: Plan): Promise<void> {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanCtx.Provider value={contextFor(plan)}>
          <SsAnalysisPage />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
}

async function openTab(name: 'Benefits only' | 'Break-even'): Promise<void> {
  const tab = [...container.querySelectorAll<HTMLButtonElement>('button[role="tab"]')].find((b) => b.textContent === name)
  if (!tab) throw new Error(`no ${name} tab`)
  await act(async () => tab.click())
}

const text = (): string => (container.textContent ?? '').replace(/\s+/gu, ' ')

function singlePlan(dob: string, sex: 'male' | 'female', stream: Record<string, unknown>): Plan {
  const draft = createEmptyPlan({ newId: id })
  draft.household.people[0] = { id: 'p1', name: 'Pat', dob, sex, retirementAge: null, longevity: { planningAge: 92, source: 'manual' } }
  draft.assumptions.inflationPct = 2.5
  draft.assumptions.ssCola = { mode: 'matchInflation' }
  draft.incomes = [{ type: 'socialSecurity', id: id(), personId: 'p1', piaMonthly: null, earnings: null, claimAge: { years: 67, months: 0 }, ...stream }]
  const parsed = parsePlan(draft)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describe('Social Security analysis page on the engine models', () => {
  it('benefits only, example-couple: the 2% headline is the engine\'s (70 / 62, $865k) and the couple copy states the rules', async () => {
    await render(getExampleById('example-couple')!.build())
    await openTab('Benefits only')
    const page = text()
    expect(page).toContain('Highest expected value: claim at 70 / 62')
    expect(page).toContain('expected PV $865k')
    expect(page).toContain('the lower earner receives their own benefit plus a reduced spousal top-up once both have claimed')
    expect(page).not.toContain('larger of their reduced own benefit or a reduced half')
  })

  it('benefits only names what it leaves out, and names each person whose wages would trigger the earnings test', async () => {
    await render(getExampleById('example-couple')!.build())
    await openTab('Benefits only')
    const page = text()
    expect(page).toContain('There is no earnings test, so benefits the plan would hold back while someone is still working are counted as paid.')
    expect(page).toContain('A former spouse\'s record is not counted for a person in a couple. And each person has one claim age.')
    expect(page).not.toContain('the difference comes from taxes, portfolio growth, and the plan\'s fixed planning ages')
    // Alex works to 66 and Sam to 64: the ledger withholds while each works before full retirement age.
    expect(page).toContain("Alex's wages in this plan would have part of their benefit held back under the earnings test if they claimed at 64 or 65.")
    expect(page).toContain("Sam's wages in this plan would have part of their benefit held back under the earnings test if they claimed at 62 or 63.")
    // The chart compares Alex at 67 and 70, which the test does not reach; Sam's chart starts at 62.
    await openTab('Break-even')
    expect(text()).not.toContain("Alex's wages in this plan")
    const sam = [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Person"] button')].find((b) => b.textContent === 'Sam')!
    await act(async () => sam.click())
    expect(text()).toContain("Sam's wages in this plan would have part of their benefit held back under the earnings test if they claimed at 62.")
  })

  it('break-even, example-couple: the callout rounds the engine\'s crossing and the chart is in the plan\'s dollars', async () => {
    await render(getExampleById('example-couple')!.build())
    await openTab('Break-even')
    const page = text()
    expect(page).toMatch(/67 vs 70: waiting until 70 pulls ahead around age \d+(\.\d)?\./u)
    expect(page).toContain("in the plan's dollars for each year (cost-of-living increases that match the plan's 2.5% inflation)")
  })

  it('a disability benefit from its onset is not ranked or charted, with a sentence saying why', async () => {
    const plan = singlePlan('1970-03-15', 'male', { piaMonthly: 1_500, disability: { onsetAge: 55 } })
    await render(plan)
    await openTab('Benefits only')
    expect(text()).toContain("Pat's benefit is a disability benefit, paid from the onset of the disability rather than from a claim age")
    expect(container.querySelector('table.claim-table tbody tr')).toBeNull()
    await openTab('Break-even')
    expect(text()).toContain("Pat's benefit is a disability benefit")
  })

  it('paid in: each year\'s rate and base in 2026 dollars ($225,418), and the ratio on the start-year PIA (2.46×)', async () => {
    const earnings = Array.from({ length: 40 }, (_, i) => ({ year: 1982 + i, amount: 50_000 }))
    await render(singlePlan('1960-05-01', 'male', { earnings }))
    await openTab('Benefits only')
    const page = text()
    expect(page).toContain('Paid in so far (OASDI, 2026 dollars)$225,418')
    expect(page).toContain('Employer paid so far (context)$228,683')
    expect(page).not.toContain('What your projected work will pay')
    expect(page).toContain('Ratio (get back ÷ paid in)2.46×')
    expect(page).not.toContain('3.80×')
    // The panel names the parts the Learning Center article describes (learn/socialSecurityTaxesVsBenefits.article.test.ts).
    expect(page).toContain("the tax your projected work will pay, in today's dollars")
    expect(page).toContain("(on your record, or a former spouse's when larger): those already received")
  })

  it('paid in: the projected work the PIA counts is paid in too, so the ratio is 1.59×, not 2.46×', async () => {
    const earnings = Array.from({ length: 23 }, (_, i) => ({ year: 2003 + i, amount: 60_000 }))
    const plan = singlePlan('1981-06-15', 'male', { earnings, earningsProjection: { assumedAnnualEarnings: 60_000, throughAge: 65 } })
    const draft = structuredClone(plan)
    draft.household.people[0] = { ...draft.household.people[0]!, sex: 'average', retirementAge: 65 }
    await render(draft)
    await openTab('Benefits only')
    const page = text()
    expect(page).toContain('Paid in so far (OASDI, 2026 dollars)$116,507')
    expect(page).toContain('What your projected work will pay (2026–2042, 2026 dollars)$63,240')
    expect(page).toContain('Ratio (get back ÷ paid in)1.59×')
    expect(page).not.toContain('2.46×')
  })

  it('paid in: a disability benefit from its onset gets the sentence, not a ratio', async () => {
    const earnings = Array.from({ length: 30 }, (_, i) => ({ year: 1992 + i, amount: 50_000 }))
    await render(singlePlan('1970-03-15', 'male', { earnings, disability: { onsetAge: 55 } }))
    await openTab('Benefits only')
    const panel = container.querySelector('details.ss-explainer')!.textContent.replace(/\s+/gu, ' ')
    expect(panel).toContain("Pat's benefit is a disability benefit, paid from the onset of the disability rather than from a claim age")
    expect(panel).not.toContain('Ratio (get back')
  })

  it('paid in: a history with no benefit estimate still shows what was paid in so far, and says why the rest is missing (PR #757 review 3)', async () => {
    // Robin turned 62 in 1977: the resolver refuses the history (eligibility before 1979).
    const earnings = Array.from({ length: 30 }, (_, i) => ({ year: 1946 + i, amount: 6_000 }))
    const draft = createEmptyPlan({ newId: id })
    draft.household.filingStatus = 'marriedFilingJointly'
    draft.household.people = [
      { id: 'p1', name: 'Pat', dob: '1960-05-01', sex: 'male', retirementAge: null, longevity: { planningAge: 92, source: 'manual' } },
      { id: 'p2', name: 'Robin', dob: '1915-03-01', sex: 'female', retirementAge: null, longevity: { planningAge: 115, source: 'manual' } },
    ]
    draft.assumptions.inflationPct = 2.5
    draft.incomes = [
      { type: 'socialSecurity', id: id(), personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 67, months: 0 } },
      { type: 'socialSecurity', id: id(), personId: 'p2', piaMonthly: null, earnings, claimAge: { years: 65, months: 0 } },
    ]
    const parsed = parsePlan(draft)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    await render(parsed.plan)
    await openTab('Benefits only')
    const panel = container.querySelector('details.ss-explainer')!.textContent.replace(/\s+/gu, ' ')
    const paid = oasdiPaidIn(earnings, { selfEmployed: false, startYear: 2026, inflationPct: 2.5 })
    expect(panel).toContain(`Paid in so far (OASDI, 2026 dollars)${fmtMoney(paid.paidInToday)}`)
    expect(panel).toContain('Robin turned 62 before 1979, and benefits for people who did use an older formula the planner does not compute.')
    expect(panel).toContain('So the benefits and the ratio are not shown.')
    expect(panel).not.toContain('Enter an earnings history')
  })

  it('a household whose only history gives no benefit estimate is told why on the empty page', async () => {
    const earnings = Array.from({ length: 30 }, (_, i) => ({ year: 1946 + i, amount: 6_000 }))
    const draft = createEmptyPlan({ newId: id })
    draft.household.people[0] = { id: 'p1', name: 'Robin', dob: '1915-03-01', sex: 'female', retirementAge: null, longevity: { planningAge: 115, source: 'manual' } }
    draft.incomes = [{ type: 'socialSecurity', id: id(), personId: 'p1', piaMonthly: null, earnings, claimAge: { years: 65, months: 0 } }]
    const parsed = parsePlan(draft)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    await render(parsed.plan)
    expect(text()).toContain('No Social Security to analyze yet')
    expect(text()).toContain('Robin turned 62 before 1979')
  })

  it('survivor switching: strategies paying the same benefits are shown once, the survivor benefit at 62 alone first', async () => {
    const deceased: FormerSpouse = { id: 'ex', relationship: 'deceased', dob: '1962-01-20', piaMonthly: 2_400, marriageYears: 20, remarriedAtAge: null, deceasedClaimAge: { years: 62, months: 0 } }
    await render(singlePlan('1964-06-15', 'female', { piaMonthly: 1_500, formerSpouses: [deceased] }))
    await openTab('Benefits only')
    const labels = [...container.querySelectorAll('.mt-lg table.claim-table tbody tr td:first-child')].map((cell) => cell.textContent)
    expect(labels).toEqual([
      'Survivor only, at 62',
      'Own at 62, switch to survivor at 67',
      'Survivor only, at 67',
      'Own only, at 70',
      'Own only, at 67',
    ])
    expect(text()).toContain('$423k')
  })

  it('the divorced-spouse note shows only where the ranking prices the record: a claimant living alone, not a couple (PR #757 review 1)', async () => {
    const ex: FormerSpouse = { id: 'ex', relationship: 'divorced', dob: '1966-02-10', piaMonthly: 2_000, marriageYears: 12, remarriedAtAge: null }
    const note = 'With a living ex-spouse, this ranking pays what the plan pays'
    await render(singlePlan('1964-06-15', 'female', { piaMonthly: 800, formerSpouses: [ex] }))
    await openTab('Benefits only')
    expect(text()).toContain(note)

    const draft = createEmptyPlan({ newId: id })
    draft.household.filingStatus = 'marriedFilingJointly'
    draft.household.people = [
      { id: 'p1', name: 'Pat', dob: '1964-06-15', sex: 'female', retirementAge: null, longevity: { planningAge: 92, source: 'manual' } },
      { id: 'p2', name: 'Robin', dob: '1963-03-01', sex: 'male', retirementAge: null, longevity: { planningAge: 90, source: 'manual' } },
    ]
    draft.incomes = [
      { type: 'socialSecurity', id: id(), personId: 'p1', piaMonthly: 800, earnings: null, claimAge: { years: 67, months: 0 }, formerSpouses: [ex] },
      { type: 'socialSecurity', id: id(), personId: 'p2', piaMonthly: 2_400, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    const parsed = parsePlan(draft)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    await render(parsed.plan)
    await openTab('Benefits only')
    expect(text()).toContain('A former spouse\'s record is not counted for a person in a couple.')
    expect(text()).not.toContain(note)
  })

  it('the couple primer calls PIA x 12 the full-retirement-age benefit', async () => {
    await render(getExampleById('example-couple')!.build())
    await waitFor(() => container.querySelector('.skeleton') === null && text().includes('full-retirement-age benefit (PIA)'), {
      what: 'the couple primer',
      attempts: 600,
      intervalMs: 20,
      describe: () => text().slice(0, 400),
    })
    expect(text()).toMatch(/has the larger full-retirement-age benefit \(PIA\): \$35k\/yr against \$23k\/yr for /u)
    // The wait above allows 12 s for the in-your-plan sweep; the test's own limit must exceed it (5 s by default).
  }, 20_000)
})
