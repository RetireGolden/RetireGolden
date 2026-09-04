/** @vitest-environment jsdom */
/**
 * The load-repair notice: the only place a household is told that opening a
 * plan changed the stored document. The sentences are asserted verbatim, not
 * derived from the copy module, so a copy edit has to be made deliberately in
 * two places rather than sliding through under a passing test.
 *
 * Plus the workspace load path that carries it — including the load error, the
 * provider's other per-document state — because the two are told apart by the
 * same mechanism (a planId tag read during render) and the gated store that
 * holds a switch mid-flight lives here.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import type { PlanLoadRepair } from '@retiregolden/engine/model/migrations'
import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanStoreProvider } from '../data/PlanStoreProvider'
import type { PlanStore, PlanSummary } from '../data/planStoreContext'
import { _resetPlanStoreForTests } from '../data/planStore'
import { EXAMPLE_PLAN_ID_PREFIX } from '../data/planOrigin'
import { PlanCtx, usePlan, type PlanContextValue } from './planContextCore'
import { PlanProvider } from './PlanContext'
import { PlanRepairCtx } from './planRepairContext'
import { PlanRepairNotice } from './PlanRepairNotice'
import { createSamplePlan } from '../testSupport/samplePlan'
import { settle } from '../testSupport/settle'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
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
    const alex = plan.household.people[0]
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

  it('names the age to fix and the box to tick for a deferred purchase stood down', async () => {
    // The one repair a household can act on in two different ways, so the
    // sentence has to offer both: an earlier start age, or the QLAC the
    // regulation reserves the deferral for. It also says where the premium went,
    // because the money not moving is the whole reason this repair is safe.
    // A start age of 85 is inside the QLAC ceiling, so the box is a real remedy.
    await mount([
      {
        kind: 'deferredAnnuityPurchaseStoodDown',
        accountId: 'ann',
        accountName: 'Longevity annuity',
        startAge: 85,
        latestPermittedStartAge: 76,
        latestPermittedStartAgeIfToggled: 85,
      },
    ])
    expect(items()).toEqual([
      'Longevity annuity was bought with pre-tax money and set to start paying at age 85. Only a QLAC can start that late; a purchase like this one has to start by age 76. The purchase was cleared and Longevity annuity pays nothing, so the premium stayed in the account it would have come from. Open Accounts to set it up again with an earlier start age, or to buy it as a QLAC.',
    ])
  })

  it('does not send a 90-year start age to a QLAC that would refuse it too', async () => {
    // The claim "only a QLAC can start that late" is false past the (q)(1)(ii)
    // ceiling: a stored non-QLAC at 90 fails the required-beginning-date bound
    // AND would fail the QLAC bound, so the older copy recommended a shape that
    // could not have kept the start age either. The message now says no pre-tax
    // purchase reaches that age and names only the control that works.
    await mount([
      {
        kind: 'deferredAnnuityPurchaseStoodDown',
        accountId: 'ann',
        accountName: 'Longevity annuity',
        startAge: 90,
        latestPermittedStartAge: 76,
        latestPermittedStartAgeIfToggled: 85,
      },
    ])
    expect(items()).toEqual([
      'Longevity annuity was bought with pre-tax money and set to start paying at age 90. A purchase like this one has to start by age 76, and buying it as a QLAC would not keep the later start either — a QLAC has to start by age 85. No pre-tax purchase can wait until 90. The purchase was cleared and Longevity annuity pays nothing, so the premium stayed in the account it would have come from. Open Accounts to set it up again with an earlier start age.',
    ])
    expect(items()[0]).not.toContain('Only a QLAC can start that late')
    expect(items()[0]).not.toContain('or to buy it as a QLAC')
  })

  it('names the one age that fixes a QLAC stood down for starting too late', async () => {
    // The mirror of the sentence above, and deliberately one control shorter:
    // this owner bought early, so dropping the box lands the contract on a
    // required-beginning-date ceiling of 76 — lower still — and offering it
    // would send the household to a second refusal.
    await mount([
      {
        kind: 'qlacPurchaseStoodDown',
        accountId: 'ann',
        accountName: 'Longevity annuity',
        startAge: 90,
        latestPermittedStartAge: 85,
        latestPermittedStartAgeIfToggled: 76,
      },
    ])
    expect(items()).toEqual([
      'Longevity annuity was bought as a QLAC and set to start paying at age 90. A QLAC is the longest a pre-tax purchase can wait, but it still has to start by age 85 — the IRA rules put the last start on the first of the month after your 85th birthday. The purchase was cleared and Longevity annuity pays nothing, so the premium stayed in the account it would have come from. Open Accounts to set it up again with an earlier start age.',
    ])
  })

  it('offers the untick to a late annuitizer whose ordinary ceiling is the higher one', async () => {
    // The required-beginning-date ceiling climbs with the purchase year, so an
    // owner who annuitized at 90 may hold a contract starting at 90 without the
    // QLAC election — the box is what refused them. Here dropping it is a real
    // remedy and the copy says so rather than naming the start age alone.
    await mount([
      {
        kind: 'qlacPurchaseStoodDown',
        accountId: 'ann',
        accountName: 'Longevity annuity',
        startAge: 90,
        latestPermittedStartAge: 85,
        latestPermittedStartAgeIfToggled: 90,
      },
    ])
    expect(items()).toEqual([
      'Longevity annuity was bought as a QLAC and set to start paying at age 90. A QLAC has to start by age 85 — the IRA rules put the last start on the first of the month after your 85th birthday. Bought as late as this one was, an ordinary pre-tax purchase could still start at 90. The purchase was cleared and Longevity annuity pays nothing, so the premium stayed in the account it would have come from. Open Accounts to set it up again with an earlier start age, or without the QLAC box ticked.',
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

/** In-memory PlanStore holding whatever raw documents a test wants loaded. */
function storeHolding(docs: Record<string, unknown>, deferredId?: string) {
  let open: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    open = resolve
  })
  const store: PlanStore = {
    async listPlans(): Promise<PlanSummary[]> {
      return []
    },
    async loadPlan(planId: string): Promise<unknown> {
      if (planId === deferredId) await gate
      return docs[planId] ?? null
    },
    async savePlan(): Promise<void> {},
    async deletePlan(): Promise<void> {},
  }
  const release = async () => {
    await act(async () => {
      open()
      await gate
      await Promise.resolve()
    })
  }
  return { store, release }
}

/** Renders the loaded plan's name, so a test can tell which document is on screen. */
function PlanNameProbe() {
  const { plan } = usePlan()
  return <p data-testid="plan-name">{plan.name}</p>
}

/** A stored document whose annuity is funded from an inherited account. */
function storedWithInheritedFundedAnnuity(): Record<string, unknown> {
  const plan = createSamplePlan()
  const owner = plan.household.people[0].id
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

/** The same document, renamed and re-keyed, so a test can hold two of them. */
function storedAs(id: string, name: string, doc: Record<string, unknown>): Record<string, unknown> {
  return { ...doc, id, name }
}

/**
 * A stored record that exists and will not open: a schema version from the
 * future. Deliberately not the missing-record case, whose 'not_object' reason
 * takes the softer "Plan not found" copy and, for an example id, would be
 * auto-seeded instead of failing at all.
 */
function unreadableDoc(): Record<string, unknown> {
  return { schemaVersion: 9_999 }
}

/** A clean, openable document under the given id and name. */
function openableDoc(id: string, name: string): Record<string, unknown> {
  return storedAs(id, name, JSON.parse(JSON.stringify(createSamplePlan())) as Record<string, unknown>)
}

const errorHeading = () => container.querySelector('.empty-state h2')?.textContent ?? null
const planName = () => container.querySelector('[data-testid="plan-name"]')?.textContent ?? null
const skeleton = () => container.querySelector('.skeleton[aria-label="Loading plan"]')

describe('the workspace load path', () => {
  async function mountWorkspace(doc: unknown) {
    await act(async () => {
      root.render(
        // The failure card links home, so the provider needs a router around it.
        <MemoryRouter>
          <PlanStoreProvider store={storeHolding({ p1: doc }).store}>
            <PlanProvider planId="p1">
              <PlanRepairNotice />
            </PlanProvider>
          </PlanStoreProvider>
        </MemoryRouter>,
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

  it('drops the previous notice the moment a switch starts, not when it resolves', async () => {
    // The workspace route reuses this provider across a planId change, so a
    // notice that waited for the next load to resolve would describe the wrong
    // document for the whole fetch — and its Dismiss button would clear a
    // notice the household was never shown for the plan they are now looking at.
    const repaired = storedAs('p1', 'Repaired plan', storedWithInheritedFundedAnnuity())
    const clean = storedAs('p2', 'Clean plan', JSON.parse(JSON.stringify(createSamplePlan())) as Record<string, unknown>)
    const { store, release } = storeHolding({ p1: repaired, p2: clean }, 'p2')
    const tree = (planId: string) => (
      <PlanStoreProvider store={store}>
        <PlanProvider planId={planId}>
          <PlanRepairNotice />
          <PlanNameProbe />
        </PlanProvider>
      </PlanStoreProvider>
    )

    await act(async () => root.render(tree('p1')))
    expect(items()).toHaveLength(1)

    // p2 is still in flight here: the switch has started and nothing has arrived.
    await act(async () => root.render(tree('p2')))
    expect(container.querySelector('.plan-repair-notice')).toBeNull()
    // The previously loaded plan is still on screen while the next one loads.
    // That is the provider's pre-existing behavior and this change leaves it be;
    // what must not survive the switch is the notice describing it.
    expect(container.querySelector('[data-testid="plan-name"]')?.textContent).toBe('Repaired plan')

    await release()
    expect(container.querySelector('.plan-repair-notice')).toBeNull()
    expect(container.querySelector('[data-testid="plan-name"]')?.textContent).toBe('Clean plan')
  })

  it('shows the failure card for a plan that cannot be opened', async () => {
    await mountWorkspace(unreadableDoc())
    expect(errorHeading()).toBe('This plan could not be opened')
    expect(container.querySelector('details')?.textContent).toContain('newer_than_app')
  })

  it('seeds a missing library demo with no notice over it', async () => {
    // The auto-seed path builds the plan from the registry rather than reading
    // one, so there is nothing to report — and nothing from a previous plan may
    // leak onto it either.
    const exampleId = `${EXAMPLE_PLAN_ID_PREFIX}example-couple`
    await act(async () => {
      root.render(
        <PlanStoreProvider store={storeHolding({}).store}>
          <PlanProvider planId={exampleId}>
            <PlanRepairNotice />
            <PlanNameProbe />
          </PlanProvider>
        </PlanStoreProvider>,
      )
    })
    await settle()
    // The probe rendering at all proves the seed ran: the provider shows a
    // skeleton, not children, until a plan is adopted.
    expect(container.querySelector('[data-testid="plan-name"]')?.textContent).toBe('Example couple')
    expect(container.querySelector('.plan-repair-notice')).toBeNull()
  })
})

describe('the workspace load failure', () => {
  const tree = (store: PlanStore, planId: string) => (
    // The failure card links home, so the provider needs a router around it.
    <MemoryRouter>
      <PlanStoreProvider store={store}>
        <PlanProvider planId={planId}>
          <PlanNameProbe />
        </PlanProvider>
      </PlanStoreProvider>
    </MemoryRouter>
  )

  it('clears the failure when the household picks a plan that opens', async () => {
    // The defect this pins: nothing cleared the error and the error branch
    // rendered ahead of everything else, so one plan that would not open left
    // "This plan could not be opened" over every plan chosen afterwards — the
    // household's only way out was a full page reload.
    const { store } = storeHolding({ p1: unreadableDoc(), p2: openableDoc('p2', 'Clean plan') })
    await act(async () => root.render(tree(store, 'p1')))
    await settle()
    expect(errorHeading()).toBe('This plan could not be opened')

    await act(async () => root.render(tree(store, 'p2')))
    await settle()
    expect(errorHeading()).toBeNull()
    expect(planName()).toBe('Clean plan')
  })

  it('shows no failure card while the next plan is still loading', async () => {
    // The switch away is instant; the next load is not. An error tagged for the
    // plan being left cannot speak for the one arriving, so this window shows
    // the skeleton — and specifically not the plan still held in state, which
    // the household stopped looking at when the failure card replaced it.
    const { store, release } = storeHolding(
      {
        p0: openableDoc('p0', 'First plan'),
        p1: unreadableDoc(),
        p2: openableDoc('p2', 'Clean plan'),
      },
      'p2',
    )
    await act(async () => root.render(tree(store, 'p0')))
    await settle()
    expect(planName()).toBe('First plan')

    await act(async () => root.render(tree(store, 'p1')))
    await settle()
    expect(errorHeading()).toBe('This plan could not be opened')

    // p2 is still in flight here: the switch has started and nothing has arrived.
    await act(async () => root.render(tree(store, 'p2')))
    expect(errorHeading()).toBeNull()
    expect(planName()).toBeNull()
    expect(skeleton()).not.toBeNull()

    await release()
    expect(errorHeading()).toBeNull()
    expect(planName()).toBe('Clean plan')
  })

  it('says storage refused rather than holding the loading skeleton', async () => {
    // A REJECTED read is not a reason code the migration produced. Before this
    // was caught, the workspace sat on its skeleton for the life of the tab,
    // with an unhandled rejection as the only trace.
    const refusing: PlanStore = {
      ...storeHolding({}).store,
      loadPlan: () => Promise.reject(new Error('storage refused')),
    }
    await act(async () => root.render(tree(refusing, 'p1')))
    await settle()

    expect(skeleton()).toBeNull()
    // Not "This plan could not be opened": nothing is known to be wrong with
    // the plan, and blaming their data for a browser that refused is worse
    // than saying nothing.
    expect(errorHeading()).toBe('Your plans could not be read')
    expect(container.textContent).toContain('Your data has not been changed')
  })

  it('keeps the failure card across a re-render of the same failed plan', async () => {
    const { store } = storeHolding({ p1: unreadableDoc() })
    await act(async () => root.render(tree(store, 'p1')))
    await settle()
    expect(errorHeading()).toBe('This plan could not be opened')

    await act(async () => root.render(tree(store, 'p1')))
    await settle()
    expect(errorHeading()).toBe('This plan could not be opened')
  })

  it('clears the failure when the same plan is reloaded and opens', async () => {
    // A store swap reloads the same planId (see PlanStoreProvider), so the tag
    // still matches and cannot be what clears this — the adoption is. Without
    // it, a host that fixed the record would keep being told it was broken.
    const broken = storeHolding({ p1: unreadableDoc() }).store
    const fixed = storeHolding({ p1: openableDoc('p1', 'Repaired record') }).store
    await act(async () => root.render(tree(broken, 'p1')))
    await settle()
    expect(errorHeading()).toBe('This plan could not be opened')

    await act(async () => root.render(tree(fixed, 'p1')))
    await settle()
    expect(errorHeading()).toBeNull()
    expect(planName()).toBe('Repaired record')
  })
})
