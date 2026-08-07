/** @vitest-environment jsdom */
/**
 * The load-repair notice: the only place a household is told that opening a
 * plan changed the stored document. The sentences are asserted verbatim, not
 * derived from the copy module, so a copy edit has to be made deliberately in
 * two places rather than sliding through under a passing test.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import type { PlanLoadRepair } from '@retiregolden/engine/model/migrations'
import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanStoreProvider } from '../data/PlanStoreProvider'
import type { PlanStore, PlanSummary } from '../data/planStoreContext'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { PlanProvider } from './PlanContext'
import { PlanRepairCtx } from './planRepairContext'
import { PlanRepairNotice } from './PlanRepairNotice'
import { createSamplePlan } from '../testSupport/samplePlan'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function contextFor(plan: Plan): PlanContextValue {
  return { plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }
}

async function mount(repairs: readonly PlanLoadRepair[], dismiss: () => void = () => undefined, plan = createSamplePlan()) {
  await act(async () => {
    root.render(
      <PlanCtx.Provider value={contextFor(plan)}>
        <PlanRepairCtx.Provider value={{ repairs, dismiss }}>
          <PlanRepairNotice />
        </PlanRepairCtx.Provider>
      </PlanCtx.Provider>,
    )
  })
}

const items = () => [...container.querySelectorAll('li')].map((li) => li.textContent)

describe('PlanRepairNotice', () => {
  it('renders nothing when the load repaired nothing', async () => {
    await mount([])
    expect(container.querySelector('.plan-repair-notice')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('names the person the back-filled owner points at', async () => {
    const plan = createSamplePlan()
    const alex = plan.household.people[0]!
    await mount(
      [{ kind: 'accountOwnerBackFilled', accountId: 'trad', accountName: 'Old 401(k)', ownerPersonId: alex.id }],
      () => undefined,
      plan,
    )
    expect(items()).toEqual([
      `Old 401(k) was stored without an owner, and it is now owned by ${alex.name}. Open Accounts to assign it to someone else.`,
    ])
  })

  it('falls back to the household position when the owner id names nobody', async () => {
    // The engine reports the id it wrote; a plan whose people changed underneath
    // it still gets a true sentence rather than a blank or a raw id.
    await mount([{ kind: 'accountOwnerBackFilled', accountId: 'trad', accountName: 'Old 401(k)', ownerPersonId: 'nobody' }])
    expect(items()).toEqual([
      'Old 401(k) was stored without an owner, and it is now owned by the first person in your household. Open Accounts to assign it to someone else.',
    ])
  })

  it('renders the copy for every lump-sum election kind', async () => {
    await mount([
      { kind: 'lumpSumElectionDroppedElectionYearPassed', accountId: 'pen', accountName: 'Pension', electionYear: 2025 },
      { kind: 'lumpSumElectionDroppedUnreadableSaveDate', accountId: 'pen2', accountName: 'Second pension' },
      {
        kind: 'lumpSumElectionDroppedInheritedTarget',
        accountId: 'pen3',
        accountName: 'Third pension',
        targetAccountId: 'inh',
        targetAccountName: 'Inherited IRA',
      },
      {
        kind: 'lumpSumElectionDroppedTargetUnavailable',
        accountId: 'pen4',
        accountName: 'Fourth pension',
        targetAccountId: 'ira',
        targetAccountName: 'Rollover IRA',
      },
      {
        kind: 'lumpSumElectionDroppedTargetUnavailable',
        accountId: 'pen5',
        accountName: 'Fifth pension',
        targetAccountId: 'gone',
        targetAccountName: null,
      },
    ])
    expect(items()).toEqual([
      'Pension was set to take its lump sum in 2025, and that year has already passed. The election was cleared and the lump-sum offer is still on record. Open Accounts to take the lump sum in a year that has not passed, or leave the pension paying its annuity.',
      'Second pension was set to take its lump sum. The date this plan was last saved could not be read, so the app could not tell whether the election year had already passed. The election was cleared and the lump-sum offer is still on record. Saving this plan writes a fresh date, and you can set the election again from Accounts.',
      'Third pension was set to roll its lump sum into Inherited IRA, which is inherited. An inherited account cannot receive a pension rollover. The election was cleared and the lump-sum offer is still on record. Open Accounts to roll it into a traditional account you own.',
      'Fourth pension was set to roll its lump sum into Rollover IRA, and that is not an account this plan can pay a rollover into. The election was cleared and the lump-sum offer is still on record. Open Accounts to roll it into a traditional account you own.',
      'Fifth pension was set to roll its lump sum into an account this plan no longer holds. The election was cleared and the lump-sum offer is still on record. Open Accounts to roll it into a traditional account you own.',
    ])
  })

  it('renders the copy for both annuity kinds', async () => {
    await mount([
      {
        kind: 'annuityPremiumRetargeted',
        accountId: 'ann',
        accountName: 'SPIA',
        fromAccountId: 'inh',
        fromAccountName: 'Inherited IRA',
        toAccountId: 'ira',
        toAccountName: 'Rollover IRA',
      },
      {
        kind: 'annuityPurchaseStoodDown',
        accountId: 'ann2',
        accountName: 'Deferred annuity',
        fromAccountId: 'inh',
        fromAccountName: 'Inherited IRA',
      },
    ])
    expect(items()).toEqual([
      'SPIA was bought with a premium from Inherited IRA, which is inherited. An inherited account cannot fund an annuity purchase, so the premium now comes from Rollover IRA. The purchase year, the premium, and its pre-tax treatment are unchanged. Open Accounts to fund it from a different account you own.',
      'Deferred annuity was bought with a premium from Inherited IRA, which is inherited. An inherited account cannot fund an annuity purchase, and this plan holds no traditional account you own that could have paid the premium instead. The purchase was cleared and Deferred annuity pays nothing. Open Accounts to add the account the premium came from, then set the purchase up again.',
    ])
  })

  it('shows the heading and lead once, above one item per repair', async () => {
    await mount([
      { kind: 'lumpSumElectionDroppedUnreadableSaveDate', accountId: 'pen', accountName: 'Pension' },
      { kind: 'lumpSumElectionDroppedUnreadableSaveDate', accountId: 'pen2', accountName: 'Second pension' },
    ])
    const notice = container.querySelector('.plan-repair-notice')!
    expect(notice.querySelector('strong')?.textContent).toBe('This plan changed when it opened')
    expect(notice.textContent).toContain(
      'This plan was stored with details the app no longer accepts. It opened with the changes below so you can see what is different and decide what to do. Nothing else in your plan was changed.',
    )
    expect(items()).toHaveLength(2)
  })

  it('dismisses on the notice control', async () => {
    let dismissed = 0
    await mount([{ kind: 'lumpSumElectionDroppedUnreadableSaveDate', accountId: 'pen', accountName: 'Pension' }], () => {
      dismissed += 1
    })
    const button = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Dismiss')!
    await act(async () => button.click())
    expect(dismissed).toBe(1)
  })
})

/** In-memory PlanStore holding whatever raw document a test wants loaded. */
function storeHolding(id: string, doc: unknown): PlanStore {
  return {
    async listPlans(): Promise<PlanSummary[]> {
      return []
    },
    async loadPlan(planId: string): Promise<unknown> {
      return planId === id ? doc : null
    },
    async savePlan(): Promise<void> {},
    async deletePlan(): Promise<void> {},
  }
}

/** A stored document whose annuity is funded from an inherited account. */
function storedWithInheritedFundedAnnuity(): Record<string, unknown> {
  const plan = createSamplePlan()
  const owner = plan.household.people[0]!.id
  plan.id = 'p1'
  plan.accounts = [
    { type: 'traditional', id: 'ira', name: 'Rollover IRA', ownerPersonId: owner, annualReturnPct: null, kind: 'ira', balance: 400_000, annualContribution: 0 },
    { type: 'traditional', id: 'inh', name: 'Inherited IRA', ownerPersonId: owner, annualReturnPct: null, kind: 'ira', balance: 300_000, annualContribution: 0,
      inherited: { ownerDeathYear: 2022, decedentHadStartedRmds: true } },
    { type: 'annuity', id: 'ann', name: 'SPIA', ownerPersonId: owner, annualReturnPct: null, startAge: 70, monthlyAmount: 1_000, colaPct: 0, taxablePct: 100,
      purchase: { year: 2030, premium: 100_000, fundingAccountId: 'inh', taxQualification: 'qualified' } },
  ] as never
  return JSON.parse(JSON.stringify(plan)) as Record<string, unknown>
}

describe('the workspace load path', () => {
  async function mountWorkspace(doc: unknown) {
    await act(async () => {
      root.render(
        <PlanStoreProvider store={storeHolding('p1', doc)}>
          <PlanProvider planId="p1">
            <PlanRepairNotice />
          </PlanProvider>
        </PlanStoreProvider>,
      )
    })
  }

  it('tells the household what the load changed, once', async () => {
    // The retarget leaves no trace in the projection, so this notice is the
    // household's only way to find out the premium changed source.
    await mountWorkspace(storedWithInheritedFundedAnnuity())
    expect(container.querySelectorAll('.plan-repair-notice')).toHaveLength(1)
    expect(items()).toEqual([
      'SPIA was bought with a premium from Inherited IRA, which is inherited. An inherited account cannot fund an annuity purchase, so the premium now comes from Rollover IRA. The purchase year, the premium, and its pre-tax treatment are unchanged. Open Accounts to fund it from a different account you own.',
    ])
  })

  it('stays silent for a document that needed no repair', async () => {
    const plan = createSamplePlan()
    plan.id = 'p1'
    await mountWorkspace(JSON.parse(JSON.stringify(plan)))
    expect(container.querySelector('.plan-repair-notice')).toBeNull()
  })

  it('closes for the rest of the visit when dismissed', async () => {
    await mountWorkspace(storedWithInheritedFundedAnnuity())
    const button = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Dismiss')!
    await act(async () => button.click())
    expect(container.querySelector('.plan-repair-notice')).toBeNull()
  })
})
