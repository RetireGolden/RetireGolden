/** @vitest-environment jsdom */
/**
 * A pension lump-sum election dated before the year the plan starts, through
 * the rendered workspace and the browser store (decision D-2027-ROLLOVER,
 * 2026-09-28; the check's spec 3 and its c05 measurements).
 *
 * The household is the derivation's U2: born 1961, a $2,000-a-month pension
 * from 65, a $300,000 offer elected in 2026 into a $400,000 IRA, saved by the
 * app on 2026-10-15. Before this change, reopening it in 2027 kept the
 * election, the next autosave was refused, the chip read "Could not store
 * locally" with no reason, and the edit was lost on reload; on New Year's Eve
 * in New York the save stamp's UTC year refused an election the projection
 * still modelled, and on New Year's morning in Tokyo it accepted one the
 * projection had stopped modelling.
 *
 * Now: the stored plan opens as stored, the start-year check runs on load, on
 * every edit and at every save against `projectionStartYear(plan)`, and a
 * refusal reads "Fix 1 issue to store" and names the issue, never "Could not
 * store locally". The zone is set at runtime (`process.env.TZ`), which Node
 * honours; only `Date` is faked, so the autosave's timers stay real.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { _resetPlanStoreForTests, loadPlan, savePlan } from '../data/planStore'
import { AUTOSAVE_SETTLE_MS, settle, sleep, waitFor } from '../testSupport/settle'
import { usePlan } from './planContextCore'
import { PlanWorkspace } from './PlanWorkspace'

// `process` is read off globalThis: the package tsconfig omits node types, and vitest runs in node.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process!.env
const originalTz = env['TZ']

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  localStorage.clear()
  // The headline Monte Carlo fails fast (no Worker in jsdom) instead of
  // running 1,000 paths in process; the save path is what is under test.
  vi.stubEnv('DEV', false)
})

afterEach(async () => {
  if (root) await act(async () => root.unmount())
  container?.remove()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  if (originalTz === undefined) delete env['TZ']
  else env['TZ'] = originalTz
})

/** Sets the zone and the instant every `new Date()` reads. */
function clock(zone: string, isoInstant: string): void {
  env['TZ'] = zone
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(isoInstant))
}

function u2Plan(): Plan {
  let next = 0
  const plan = createEmptyPlan({ now: () => new Date('2026-10-15T12:00:00.000Z'), newId: () => `u2-${next++}`, name: 'U2 pension' })
  const owner = plan.household.people[0]!
  owner.dob = '1961-03-01'
  plan.expenses.baseAnnual = 60_000
  plan.accounts = [
    { type: 'traditional', id: 'ira', name: 'Rollover IRA', ownerPersonId: owner.id, annualReturnPct: null, kind: 'ira', balance: 400_000, annualContribution: 0 },
    {
      type: 'pension', id: 'pen', name: 'Company pension', ownerPersonId: owner.id, annualReturnPct: null,
      startAge: 65, monthlyAmount: 2_000, colaPct: 0, survivorPct: 0,
      lumpSumOffer: { amount: 300_000, electionYear: 2026 },
      lumpSumElection: { rolloverAccountId: 'ira' },
    },
  ]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

/** The app's own save on 2026-10-15, as the household made it. */
async function seedSavedIn2026(): Promise<Plan> {
  const saved = await savePlan(u2Plan(), () => new Date('2026-10-15T12:00:00.000Z'))
  if (!saved.ok) throw new Error(saved.issues.join('; '))
  return saved.plan
}

function Editor() {
  const { plan, update, issues } = usePlan()
  return (
    <div>
      <span data-testid="base">{plan.expenses.baseAnnual}</span>
      <ul data-testid="issues">
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
      <button type="button" data-testid="edit" onClick={() => update((d) => void (d.expenses.baseAnnual = 61_000))} />
      <button
        type="button"
        data-testid="clear-election"
        onClick={() =>
          update((d) => {
            const pension = d.accounts.find((account) => account.id === 'pen')
            if (pension?.type === 'pension') pension.lumpSumElection = undefined
          })
        }
      />
    </div>
  )
}

async function mount(planId: string): Promise<void> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/plan/${planId}/edit`]}>
        <Routes>
          <Route path="/plan/:planId/*" element={<PlanWorkspace />}>
            <Route path="edit" element={<Editor />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
  })
  await waitFor(() => container.querySelector('[data-testid="base"]') !== null, { what: 'the plan to open' })
}

const chip = (): string => container.querySelector('.save-state')?.textContent ?? ''
const issueText = (): string => container.querySelector('[data-testid="issues"]')?.textContent ?? ''
const click = async (testId: string): Promise<void> => {
  await act(async () => {
    ;(container.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement).click()
    await sleep(AUTOSAVE_SETTLE_MS)
  })
  await settle()
}

const ISSUE =
  'accounts.1.lumpSumOffer.electionYear: The lump-sum election is dated 2026, before this plan starts in 2027. ' +
  "If you took the lump sum, remove the pension and add the rollover to Rollover IRA's balance. " +
  'If you did not, clear the election (the pension then pays) or move it to 2027 or later.'

describe('a 2026 election reopened in 2027 (derivation U2, check c05)', () => {
  it('opens as stored, names the issue on the chip, holds the save, and loses no edit once it is fixed', async () => {
    const seeded = await seedSavedIn2026()
    clock('America/New_York', '2027-01-15T17:00:00.000Z')
    await mount(seeded.id)

    // Opened as stored: nothing repaired, nothing guessed.
    const stored = await loadPlan(seeded.id)
    expect(stored.ok && stored.repairs).toEqual([])
    await waitFor(() => chip() === 'Fix 1 issue to store', { what: 'the invalid chip on load' })
    expect(issueText()).toBe(ISSUE)
    expect(chip()).not.toBe('Could not store locally')

    // An edit stays on screen and is held, not written and not reported as a storage failure.
    await click('edit')
    expect(container.querySelector('[data-testid="base"]')!.textContent).toBe('61000')
    expect(chip()).toBe('Fix 1 issue to store')
    const held = await loadPlan(seeded.id)
    expect(held.ok && held.plan.expenses.baseAnnual).toBe(60_000)

    // Fixing the issue stores the plan, earlier edit included.
    await click('clear-election')
    await waitFor(() => chip() === 'Stored on this device', { what: 'the save after the fix' })
    const saved = await loadPlan(seeded.id)
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.plan.expenses.baseAnnual).toBe(61_000)
    const pension = saved.plan.accounts.find((account) => account.id === 'pen')
    expect(pension?.type === 'pension' ? pension.lumpSumElection : 'not a pension').toBeUndefined()
  })
})

describe('New Year instants: the save judges the start year, on the local calendar', () => {
  it('New York, 22:00 on 31 December 2026 (UTC 2027): no issue, and the save succeeds', async () => {
    const seeded = await seedSavedIn2026()
    clock('America/New_York', '2027-01-01T03:00:00.000Z')
    await mount(seeded.id)
    await waitFor(() => chip() === 'Stored on this device', { what: 'the saved chip on load' })
    await click('edit')
    await waitFor(() => chip() === 'Stored on this device', { what: 'the autosave' })
    const saved = await loadPlan(seeded.id)
    expect(saved.ok && saved.plan.expenses.baseAnnual).toBe(61_000)
    expect(saved.ok && saved.plan.updatedAtIso).toBe('2027-01-01T03:00:00.000Z')
    expect(issueText()).toBe('')
  })

  it('Tokyo, 05:00 on 1 January 2027 (UTC still 2026): the issue is shown', async () => {
    const seeded = await seedSavedIn2026()
    clock('Asia/Tokyo', '2026-12-31T20:00:00.000Z')
    await mount(seeded.id)
    await waitFor(() => chip() === 'Fix 1 issue to store', { what: 'the invalid chip on load' })
    expect(issueText()).toBe(ISSUE)
  })
})

describe('a plan left open across local midnight on 31 December, with no click (review issues 4 and 8)', () => {
  it('reads "Fix 1 issue to store" once its start year becomes 2027, and holds the save', async () => {
    const seeded = await seedSavedIn2026()
    // 23:59:59 on 31 December in New York: the plan starts in 2026 and its
    // 2026 election is current, so the chip reads saved.
    clock('America/New_York', '2027-01-01T04:59:59.000Z')
    await mount(seeded.id)
    await waitFor(() => chip() === 'Stored on this device', { what: 'the saved chip before midnight' })
    expect(issueText()).toBe('')

    // Midnight passes. Nothing is clicked; the workspace renders again at the
    // local New Year (useClockYear's timer) and judges the plan from 2027.
    await act(async () => {
      vi.setSystemTime(new Date('2027-01-01T05:00:01.000Z'))
      await sleep(1_500)
    })
    await settle()
    await waitFor(() => chip() === 'Fix 1 issue to store', { what: 'the invalid chip after midnight' })
    expect(issueText()).toBe(ISSUE)
    const held = await loadPlan(seeded.id)
    expect(held.ok && held.plan.updatedAtIso).toBe('2026-10-15T12:00:00.000Z')
  })
})

describe('a save the check refuses is surfaced, never reported as a storage failure', () => {
  it('an edit made before local midnight and saved after it lists the issue', async () => {
    const seeded = await seedSavedIn2026()
    // 23:59:59.7 on 31 December in New York: the plan still starts in 2026, so
    // the edit is valid and schedules its autosave; the save runs after
    // midnight, when the plan starts in 2027.
    clock('America/New_York', '2027-01-01T04:59:59.700Z')
    await mount(seeded.id)
    await act(async () => {
      ;(container.querySelector('[data-testid="edit"]') as HTMLButtonElement).click()
    })
    await act(async () => {
      vi.setSystemTime(new Date('2027-01-01T05:00:01.000Z'))
      await sleep(AUTOSAVE_SETTLE_MS)
    })
    await settle()
    await waitFor(() => chip() === 'Fix 1 issue to store', { what: 'the refused save' })
    expect(chip()).not.toBe('Could not store locally')
    expect(issueText()).toBe(ISSUE)
    const held = await loadPlan(seeded.id)
    expect(held.ok && held.plan.expenses.baseAnnual).toBe(60_000)
  })
})
