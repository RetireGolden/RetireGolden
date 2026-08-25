/** @vitest-environment jsdom */
/**
 * "Update balances from a broker CSV" wiring: the parser's review checklist is
 * surfaced before Apply, duplicate plan-account targets block Apply instead of
 * silently last-write-winning, and applying writes balances/basis to the plan.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  IDBCursor,
  IDBDatabase,
  IDBFactory,
  IDBIndex,
  IDBKeyRange,
  IDBObjectStore,
  IDBOpenDBRequest,
  IDBRequest,
  IDBTransaction,
} from 'fake-indexeddb'

import { createEmptyPlan, type Plan } from '@retiregolden/engine/model/plan'
import { refreshMappingKey, type RefreshSnapshot } from '../../import/refresh'
import {
  _resetRefreshHistoryForTests,
  listRefreshSnapshots,
  saveRefreshManualMapping,
  saveRefreshSnapshot,
} from '../../import/refreshHistory'
import { PlanCtx } from '../planContextCore'
import { RefreshProtectionProvider } from '../RefreshProtectionProvider'
import {
  RefreshProtectionContext,
  type RefreshProtectionEntry,
  type RefreshProtectionValue,
} from '../refreshProtectionContext'
import { UpdateBalancesPanel } from './UpdateBalancesPanel'
import { ImportAvailabilityProvider } from '../../import/ImportAvailabilityProvider'

let root: Root | null = null
let container: HTMLDivElement | null = null
const initialIndexedDb = globalThis.indexedDB

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
  _resetRefreshHistoryForTests()
  globalThis.indexedDB = initialIndexedDb
})

let n = 0
const testIds = () => `ub-${++n}`

function planWithAccounts(): Plan {
  const plan = createEmptyPlan({ newId: testIds })
  const ownerId = plan.household.people[0]!.id
  plan.accounts.push(
    { id: 'acct-brokerage', type: 'taxable', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 1, costBasis: 1, annualContribution: 0 },
    { id: 'acct-roth', type: 'roth', name: 'Roth IRA', ownerPersonId: ownerId, annualReturnPct: null, kind: 'ira', balance: 1, annualContribution: 0 },
  )
  return plan
}

/**
 * What the HOST supplies to the protection seam. An options object rather than
 * positional arguments: the seam now carries two independent values
 * (`protectedAccounts` and `pending`), and a second optional positional would make
 * "pending with no protected accounts" — a real host state, the initial load —
 * unexpressible without passing a placeholder list.
 *
 * A `RefreshProtectionProvider` is mounted only when at least one field is
 * supplied. `renderPanel(plan)` therefore still mounts **no provider at all**,
 * which is the public web app's shape and the empty-default guarantee every spec
 * in the first describe block relies on.
 */
interface HostProtection {
  protectedAccounts?: readonly RefreshProtectionEntry[]
  pending?: boolean
}

function providerTree(plan: Plan, panel: ReactNode, host: HostProtection = {}) {
  const update = (mutator: (draft: Plan) => void) => mutator(plan)
  const hasProvider = host.protectedAccounts !== undefined || host.pending !== undefined
  return (
    <PlanCtx.Provider value={{ plan, update, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
      {hasProvider ? (
        <RefreshProtectionProvider protectedAccounts={host.protectedAccounts ?? []} pending={host.pending}>
          {panel}
        </RefreshProtectionProvider>
      ) : (
        panel
      )}
    </PlanCtx.Provider>
  )
}

function panelTree(plan: Plan, host: HostProtection = {}, importEnabled = true, importResolved = true) {
  return (
    <ImportAvailabilityProvider enabled={importEnabled} resolved={importResolved}>
      {providerTree(plan, <UpdateBalancesPanel />, host)}
    </ImportAvailabilityProvider>
  )
}

function enabledPanelTree(plan: Plan, host: HostProtection = {}) {
  return panelTree(plan, host, true)
}

function renderPanel(plan: Plan, host: HostProtection = {}, importEnabled = true, importResolved = true) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(panelTree(plan, host, importEnabled, importResolved))
  })
  return container
}

/**
 * Build a host protection list from structured entries (`{ accountId, field? }`) —
 * what the protection seam speaks now that it binds to ids as structured values,
 * not to positions or `<id>.<field>` strings. Every entry's `accountId` is
 * validated against the plan so a typo throws loudly here instead of silently
 * protecting nothing. There is no parsing: a dotted id (`'broker.acct-1'`) is one
 * whole account, and an `{ accountId: 'a', field: 'costBasis' }` entry names its
 * field explicitly — so ids that nest (`'a'`, `'a.b'`) carry no ambiguity.
 */
function protect(plan: Plan, ...entries: RefreshProtectionEntry[]): readonly RefreshProtectionEntry[] {
  const ids = new Set(plan.accounts.map((a) => a.id))
  for (const entry of entries) {
    if (!ids.has(entry.accountId)) throw new Error(`protect(): no plan account matches accountId "${entry.accountId}"`)
  }
  return entries
}

const TWO_ACCOUNT_CSV = `"Positions for account Brokerage ...789 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"VTI","FUND","$50,000.00","$40,000.00"
"SWVXX","MONEY MARKET","$5,000.00","--"

"Positions for account Roth IRA ...321 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"FXAIX","FUND","$14,000.00","$12,000.00"
`

// Two Schwab sections whose masks differ but whose names are identical — both
// classify (exact) onto the single "Brokerage" plan account, so the duplicate
// suggestion surfaces on its own, with no manual re-pointing.
const TWO_BROKERAGE_CSV = `"Positions for account Brokerage ...111 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"VTI","FUND","$10,000.00","$8,000.00"

"Positions for account Brokerage ...222 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"FXAIX","FUND","$20,000.00","$15,000.00"
`

// Two "Brokerage" sections (both classify onto the single Brokerage plan account)
// PLUS a Roth section. When Brokerage is protected, the two Brokerage rows must not
// register as a duplicate that blocks the whole apply — the unprotected Roth row
// still applies.
const TWO_BROKERAGE_PLUS_ROTH_CSV = `"Positions for account Brokerage ...111 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"VTI","FUND","$10,000.00","$8,000.00"

"Positions for account Brokerage ...222 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"FXAIX","FUND","$20,000.00","$15,000.00"

"Positions for account Roth IRA ...321 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"FXAIX","FUND","$14,000.00","$12,000.00"
`

// One Roth section against a plan holding both a Roth IRA and a Rollover IRA —
// they share the generic word "ira", so the match is ambiguous.
const ROTH_ONLY_CSV = `"Positions for account Roth IRA ...321 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"FXAIX","FUND","$14,000.00","$12,000.00"
`

// One section whose label ("Windfall") matches no plan account by name, so the
// row is 'unmatched' and starts on "Don't update" — the user must pick a target
// by hand. Used to prove an unmatched row can still reach a protected account.
const UNMATCHED_CSV = `"Positions for account Windfall ...999 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"VTI","FUND","$77,000.00","$60,000.00"
`

/** Read the before→after preview cell text for each parsed row, in order. */
function previewCells(el: HTMLElement): string[] {
  return Array.from(el.querySelectorAll<HTMLTableCellElement>('.refresh-preview')).map((c) => c.textContent ?? '')
}

async function chooseFile(el: HTMLElement, text: string) {
  const input = el.querySelector<HTMLInputElement>('input[type="file"]')!
  Object.defineProperty(input, 'files', { value: [new File([text], 'positions.csv', { type: 'text/csv' })], configurable: true })
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

function enableDurableRefreshHistory() {
  // The idb wrapper touches more than `indexedDB`; installing only the
  // factory leaves IDBRequest and friends undefined and open() throws mid
  // file-parse, so every constructor the wrapper wraps is installed. The
  // afterEach below restores the jsdom default (no IndexedDB) because the
  // legacy tests in this file rely on the synchronous no-store apply path.
  globalThis.indexedDB = new IDBFactory()
  globalThis.IDBRequest = IDBRequest
  globalThis.IDBOpenDBRequest = IDBOpenDBRequest
  globalThis.IDBTransaction = IDBTransaction
  globalThis.IDBDatabase = IDBDatabase
  globalThis.IDBObjectStore = IDBObjectStore
  globalThis.IDBIndex = IDBIndex
  globalThis.IDBCursor = IDBCursor
  globalThis.IDBKeyRange = IDBKeyRange
  _resetRefreshHistoryForTests()
}

async function settlePanel() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

function selects(el: HTMLElement): HTMLSelectElement[] {
  return Array.from(el.querySelectorAll('tbody select'))
}

function applyButton(el: HTMLElement): HTMLButtonElement {
  return el.querySelector<HTMLButtonElement>('.picker-actions .btn-primary')!
}

/** Apply, or `null` — the control only exists once a file has been parsed. */
function maybeApplyButton(el: HTMLElement): HTMLButtonElement | null {
  return el.querySelector<HTMLButtonElement>('.picker-actions .btn-primary')
}

function cancelButton(el: HTMLElement): HTMLButtonElement {
  return el.querySelector<HTMLButtonElement>('.picker-actions .btn-secondary')!
}

function restoreButtons(el: HTMLElement): HTMLButtonElement[] {
  return Array.from(el.querySelectorAll<HTMLButtonElement>('.refresh-history .btn-small'))
}

function chooseButton(el: HTMLElement): HTMLButtonElement {
  return Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Choose broker CSV'))!
}

/** The protection-pending explanation's text, or `null` when it is not shown. */
function pendingExplanation(el: HTMLElement): string | null {
  return el.querySelector('.refresh-protection-pending')?.textContent ?? null
}

function accountBalance(plan: Plan, accountId: string): number | undefined {
  const account = plan.accounts.find((candidate) => candidate.id === accountId)
  return account && 'balance' in account ? account.balance : undefined
}

describe('UpdateBalancesPanel', () => {
  it('fails closed before exposing the broker file input when the host disables imports', () => {
    const el = renderPanel(planWithAccounts(), {}, false)
    expect(el.textContent).toContain('File import is temporarily unavailable')
    expect(el.querySelector('input[type="file"]')).toBeNull()
    expect(chooseButton(el)).toBeUndefined()
    expect(el.querySelector('.card')).not.toBeNull()
    expect(el.querySelector('h2')?.textContent).toContain('Update balances')
  })

  it('stays fail closed without announcing an incident while availability is pending', () => {
    const el = renderPanel(planWithAccounts(), {}, false, false)
    expect(el.textContent).toContain('Checking whether file import is available')
    expect(el.textContent).not.toContain('File import is temporarily unavailable')
    expect(el.querySelector('input[type="file"]')).toBeNull()
    expect(chooseButton(el)).toBeUndefined()
  })

  it('keeps an existing refresh snapshot restorable when new file import is disabled', async () => {
    const plan = planWithAccounts()
    const el = renderPanel(plan)
    await chooseFile(el, TWO_ACCOUNT_CSV)
    act(() => applyButton(el).click())
    expect(accountBalance(plan, 'acct-brokerage')).toBe(55000)

    act(() => root!.render(panelTree(plan, {}, false)))
    expect(el.querySelector('input[type="file"]')).toBeNull()
    expect(el.textContent).toContain('Restore previous balances')
    const restore = Array.from(el.querySelectorAll('button')).find((button) => button.textContent === 'Restore')!
    await act(async () => restore.click())
    expect(accountBalance(plan, 'acct-brokerage')).toBe(1)
  })

  it('shows the parser review checklist before Apply', async () => {
    const el = renderPanel(planWithAccounts())
    await chooseFile(el, TWO_ACCOUNT_CSV)
    expect(el.querySelector('.import-review')).not.toBeNull()
    // The partial-basis honesty item from the parser is visible to returning users.
    expect(el.textContent).toContain('no cost basis')
  })

  it('applies assigned balances and basis to the plan accounts', async () => {
    const plan = planWithAccounts()
    const el = renderPanel(plan)
    await chooseFile(el, TWO_ACCOUNT_CSV)

    // Name-similarity guesses should already point at the right accounts.
    const [first, second] = selects(el)
    expect(first!.value).toBe('acct-brokerage')
    expect(second!.value).toBe('acct-roth')

    act(() => applyButton(el).click())
    const brokerage = plan.accounts.find((a) => a.id === 'acct-brokerage')!
    expect(brokerage).toMatchObject({ balance: 55000, costBasis: 40000 })
    const roth = plan.accounts.find((a) => a.id === 'acct-roth')!
    expect(roth).toMatchObject({ balance: 14000 })
  })

  it('applies when durable history is unavailable and says no undo record was saved', async () => {
    // Keep this host explicitly browser-history-free: applying must stay
    // synchronous in jsdom, while its message honestly distinguishes the
    // in-session refresh from a durable undo point.
    globalThis.indexedDB = undefined as unknown as IDBFactory
    _resetRefreshHistoryForTests()
    const plan = planWithAccounts()
    const el = renderPanel(plan)
    await chooseFile(el, TWO_ACCOUNT_CSV)

    act(() => applyButton(el).click())

    expect(plan.accounts.find((account) => account.id === 'acct-brokerage')!).toMatchObject({ balance: 55_000, costBasis: 40_000 })
    expect(el.querySelector('[role="status"]')?.textContent).toContain('No undo record could be saved in this browser.')
  })

  it('omits the no-undo warning after a durable snapshot is saved', async () => {
    enableDurableRefreshHistory()
    const plan = planWithAccounts()
    const el = renderPanel(plan)
    await chooseFile(el, TWO_ACCOUNT_CSV)

    act(() => applyButton(el).click())
    await settlePanel()

    expect(plan.accounts.find((account) => account.id === 'acct-brokerage')!).toMatchObject({ balance: 55_000, costBasis: 40_000 })
    expect(el.querySelector('[role="status"]')?.textContent).not.toContain('No undo record could be saved in this browser.')
  })

  it('cancels an apply suspended on its durable history write', async () => {
    enableDurableRefreshHistory()
    const plan = planWithAccounts()
    const el = renderPanel(plan)
    await chooseFile(el, TWO_ACCOUNT_CSV)
    const cancel = cancelButton(el)

    // IndexedDB makes Apply yield after it captures the epoch. Cancel runs
    // before that write settles, so no mutation or stale success message may
    // survive its reset.
    act(() => {
      applyButton(el).click()
      cancel.click()
    })
    await settlePanel()

    expect(plan.accounts.find((account) => account.id === 'acct-brokerage')!).toMatchObject({ balance: 1, costBasis: 1 })
    expect(plan.accounts.find((account) => account.id === 'acct-roth')!).toMatchObject({ balance: 1 })
    expect(el.querySelector('tbody')).toBeNull()
    expect(el.querySelector('[role="status"]')).toBeNull()
  })

  it('rejects a file above 16 MiB before reading or hashing it', async () => {
    const plan = planWithAccounts()
    const el = renderPanel(plan)
    const tooLarge = new File(['not read'], 'too-large.csv', { type: 'text/csv' })
    let textRead = false
    let hashRead = false
    Object.defineProperties(tooLarge, {
      size: { value: 16 * 1024 * 1024 + 1 },
      text: {
        value: () => {
          textRead = true
          return Promise.resolve('')
        },
      },
      arrayBuffer: {
        value: () => {
          hashRead = true
          return Promise.resolve(new ArrayBuffer(0))
        },
      },
    })
    const input = el.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', { value: [tooLarge], configurable: true })

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
    })

    expect(textRead).toBe(false)
    expect(hashRead).toBe(false)
    expect(el.querySelector('[role="status"]')?.textContent).toContain('no larger than 16 MiB')
  })

  it('keeps a broker-scoped remembered match through a protection-driven reclassification', async () => {
    enableDurableRefreshHistory()
    const plan = planWithAccounts()
    // The file label shares no words with any account name, so without the
    // stored mapping this row is unmatched; 'remembered' is the operative
    // tier, not shadowed by an exact name hit.
    await saveRefreshManualMapping({
      planId: plan.id,
      normalizedBrokerLabel: refreshMappingKey('schwab', 'Acct X ...999'),
      accountId: 'acct-brokerage',
      assignedAtIso: '2026-07-15T12:00:00.000Z',
    })
    const rememberedCsv = `"Positions for account Acct X ...999 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"VTI","FUND","$50,000.00","$40,000.00"

"Positions for account Roth IRA ...321 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"FXAIX","FUND","$14,000.00","$12,000.00"
`
    // Protect the OTHER row's account: releasing it forces the render-time
    // reclassification while the remembered row stays a plain candidate.
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-roth' }) })
    await chooseFile(el, rememberedCsv)

    expect(el.textContent).toContain('Remembered match')
    act(() => el.querySelector<HTMLButtonElement>('button[aria-label="Allow this refresh for Roth IRA"]')!.click())

    // The release changes the effective protection set and forces render-time
    // classification, which must keep the same broker-scoped key.
    expect(el.textContent).toContain('Remembered match')
  })

  it('omits advisor-protected accounts from a restore undo snapshot and its count', async () => {
    enableDurableRefreshHistory()
    const plan = planWithAccounts()
    const brokerage = plan.accounts.find((account) => account.id === 'acct-brokerage')!
    const roth = plan.accounts.find((account) => account.id === 'acct-roth')!
    if (brokerage.type !== 'taxable') throw new Error('expected taxable account')
    if (roth.type !== 'roth') throw new Error('expected Roth account')
    brokerage.balance = 50_000
    brokerage.costBasis = 30_000
    roth.balance = 14_000
    const snapshot: RefreshSnapshot = {
      id: 'restore-protected',
      planId: plan.id,
      appliedAtIso: '2026-07-15T12:00:00.000Z',
      sourceLabel: 'Schwab — positions.csv',
      sourceSha256: '',
      changes: [
        {
          accountId: 'acct-brokerage',
          accountName: 'Brokerage',
          before: { balance: 10_000, costBasis: 8_000 },
          after: { balance: 50_000, costBasis: 30_000 },
        },
        {
          accountId: 'acct-roth',
          accountName: 'Roth IRA',
          before: { balance: 5_000, costBasis: null },
          after: { balance: 14_000, costBasis: null },
        },
      ],
    }
    await saveRefreshSnapshot(snapshot)
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }) })
    await settlePanel()

    act(() => restoreButtons(el)[0]!.click())
    await settlePanel()

    expect(brokerage).toMatchObject({ balance: 50_000, costBasis: 30_000 })
    expect(roth).toMatchObject({ balance: 5_000 })
    const status = el.querySelector('[role="status"]')?.textContent ?? ''
    expect(status).toContain('Restored previous balances for 1 account')
    expect(status).toContain('1 account was left unchanged, protected by advisor overrides')
    const undoSnapshot = (await listRefreshSnapshots(plan.id)).find((item) => item.sourceLabel.startsWith('Restore previous balances'))!
    expect(undoSnapshot.changes.map((change) => change.accountId)).toEqual(['acct-roth'])
  })

  it('serializes two restore clicks so the first restore owns the undo point', async () => {
    enableDurableRefreshHistory()
    const plan = planWithAccounts()
    const brokerage = plan.accounts.find((account) => account.id === 'acct-brokerage')!
    if (brokerage.type !== 'taxable') throw new Error('expected taxable account')
    brokerage.balance = 50_000
    brokerage.costBasis = 30_000
    await saveRefreshSnapshot({
      id: 'older-restore',
      planId: plan.id,
      appliedAtIso: '2026-07-14T12:00:00.000Z',
      sourceLabel: 'Older snapshot',
      sourceSha256: '',
      changes: [
        {
          accountId: 'acct-brokerage',
          accountName: 'Brokerage',
          before: { balance: 5_000, costBasis: 3_000 },
          after: { balance: 10_000, costBasis: 8_000 },
        },
      ],
    })
    await saveRefreshSnapshot({
      id: 'newer-restore',
      planId: plan.id,
      appliedAtIso: '2026-07-15T12:00:00.000Z',
      sourceLabel: 'Newer snapshot',
      sourceSha256: '',
      changes: [
        {
          accountId: 'acct-brokerage',
          accountName: 'Brokerage',
          before: { balance: 10_000, costBasis: 8_000 },
          after: { balance: 50_000, costBasis: 30_000 },
        },
      ],
    })
    const el = renderPanel(plan)
    await settlePanel()
    const restores = restoreButtons(el)

    act(() => {
      restores[0]!.click()
      restores[1]!.click()
    })
    await settlePanel()

    expect(brokerage).toMatchObject({ balance: 10_000, costBasis: 8_000 })
  })

  it('blocks Apply when two file accounts target the same plan account', async () => {
    const plan = planWithAccounts()
    const el = renderPanel(plan)
    await chooseFile(el, TWO_ACCOUNT_CSV)

    const [, second] = selects(el)
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!
      setter.call(second!, 'acct-brokerage')
      second!.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('same plan account')
    expect(applyButton(el).disabled).toBe(true)
    act(() => applyButton(el).click())
    // Nothing was written.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1 })
  })

  it('renders the before→after delta for an assigned account', async () => {
    const plan = createEmptyPlan({ newId: testIds })
    const ownerId = plan.household.people[0]!.id
    // Distinctive current balances so the "before" side is unambiguous vs. the file value.
    plan.accounts.push(
      { id: 'acct-brokerage', type: 'taxable', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 33000, costBasis: 22000, annualContribution: 0 },
      { id: 'acct-roth', type: 'roth', name: 'Roth IRA', ownerPersonId: ownerId, annualReturnPct: null, kind: 'ira', balance: 9000, annualContribution: 0 },
    )
    const el = renderPanel(plan)
    await chooseFile(el, TWO_ACCOUNT_CSV)

    const [brokeragePreview, rothPreview] = previewCells(el)
    // Brokerage: 33,000 → 55,000, with a basis line 22,000 → 40,000.
    expect(brokeragePreview).toContain('$33,000')
    expect(brokeragePreview).toContain('$55,000')
    expect(brokeragePreview).toContain('$22,000')
    expect(brokeragePreview).toContain('$40,000')
    // Roth carries no basis field, so only the balance moves.
    expect(rothPreview).toContain('$9,000')
    expect(rothPreview).toContain('$14,000')
    expect(rothPreview).not.toContain('basis')
  })

  it('notes an updatable plan account that is missing from the file (going stale)', async () => {
    const plan = createEmptyPlan({ newId: testIds })
    const ownerId = plan.household.people[0]!.id
    plan.accounts.push(
      { id: 'acct-brokerage', type: 'taxable', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 1, costBasis: 1, annualContribution: 0 },
      { id: 'acct-roth', type: 'roth', name: 'Roth IRA', ownerPersonId: ownerId, annualReturnPct: null, kind: 'ira', balance: 1, annualContribution: 0 },
      // Updatable, but nothing in the file matches its name.
      { id: 'acct-hsa', type: 'hsa', name: 'Fidelity HSA', ownerPersonId: ownerId, annualReturnPct: null, balance: 4000, annualContribution: 0 },
    )
    const el = renderPanel(plan)
    await chooseFile(el, TWO_ACCOUNT_CSV)

    const notes = Array.from(el.querySelectorAll('.callout')).map((c) => c.textContent ?? '')
    const stale = notes.find((t) => t.includes("aren't in the file"))
    expect(stale).toBeDefined()
    expect(stale).toContain('Fidelity HSA')
    // The matched accounts are not called stale.
    expect(stale).not.toContain('Brokerage')
  })

  it('surfaces a duplicate-suggestion callout that blocks apply and writes nothing', async () => {
    const plan = createEmptyPlan({ newId: testIds })
    plan.accounts.push(
      { id: 'acct-brokerage', type: 'taxable', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 5000, costBasis: 3000, annualContribution: 0 },
    )
    const el = renderPanel(plan)
    // Both file sections name "Brokerage", so both default onto the one plan account.
    await chooseFile(el, TWO_BROKERAGE_CSV)

    const [first, second] = selects(el)
    expect(first!.value).toBe('acct-brokerage')
    expect(second!.value).toBe('acct-brokerage')

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('same plan account')
    expect(applyButton(el).disabled).toBe(true)

    act(() => applyButton(el).click())
    // The collision blocks apply entirely — no last-write-wins.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 5000, costBasis: 3000 })
  })

  it('defaults an ambiguous match to "Don\'t update"', async () => {
    const plan = createEmptyPlan({ newId: testIds })
    const ownerId = plan.household.people[0]!.id
    plan.accounts.push(
      { id: 'acct-roth', type: 'roth', name: 'Roth IRA', ownerPersonId: ownerId, annualReturnPct: null, kind: 'ira', balance: 1, annualContribution: 0 },
      { id: 'acct-rollover', type: 'traditional', name: 'Rollover IRA', ownerPersonId: ownerId, annualReturnPct: null, kind: 'ira', balance: 1, annualContribution: 0 },
    )
    const el = renderPanel(plan)
    await chooseFile(el, ROTH_ONLY_CSV)

    // "Roth IRA" and "Rollover IRA" both match on the shared word "ira" — the
    // row is ambiguous, so its select stays on "Don't update" until the user picks.
    const [rothRow] = selects(el)
    expect(rothRow!.value).toBe('')
    // And with nothing assigned, the preview shows no write for it.
    expect(previewCells(el)[0]).not.toContain('→')
  })
})

/**
 * Refresh-protection seam: a `RefreshProtectionProvider` (the Pro/Advisor host)
 * feeds the accounts an advisor froze as STRUCTURED entries (`{ accountId, field? }`),
 * never by array position. The panel resolves each `accountId` to its current
 * `accounts[i]` fresh per render and threads the positional set into all three
 * engine calls so apply skips it. Protected accounts stay SELECTABLE in every row
 * (marked "(protected)"); selecting one BLOCKS the row (note + "Allow this
 * refresh") and contributes nothing until released, so even an unmatched row can
 * reach a frozen account. The per-row "Allow this refresh" control is TRANSIENT
 * and ROW-SCOPED — it releases the account for this panel instance and only for
 * the requesting row (the stored override is never touched, and a sibling row
 * cannot reach the released account). (Every spec above runs with no provider and
 * passes unchanged, which is the empty-default guarantee.)
 */
describe('UpdateBalancesPanel refresh protection', () => {
  it('blocks a protected guess by default while an unprotected sibling applies normally', async () => {
    const plan = planWithAccounts()
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }) })
    await chooseFile(el, TWO_ACCOUNT_CSV)

    const [brokerageSel, rothSel] = selects(el)
    // Brokerage's guess is protected: the row is selected onto it but BLOCKED (not
    // disabled — protected accounts stay selectable), with a visible note. Roth is
    // an ordinary applying row.
    expect(brokerageSel!.value).toBe('acct-brokerage')
    expect(brokerageSel!.disabled).toBe(false)
    expect(rothSel!.disabled).toBe(false)
    expect(rothSel!.value).toBe('acct-roth')
    expect(el.querySelector('[role="note"]')?.textContent).toContain('Protected: advisor override')

    act(() => applyButton(el).click())
    // The protected account is untouched (blocked contributes nothing); the sibling refreshes.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1, costBasis: 1 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 14000 })
    // The partial-apply message names the held-back account — the table (and its
    // skipped-item audit) is gone, so the status is the only place the user can
    // learn a selected account was deliberately left unchanged.
    const status = el.querySelector('[role="status"]')?.textContent ?? ''
    expect(status).toContain('Updated 1 account')
    expect(status).toContain('1 selected account was left unchanged, protected by advisor overrides')
  })

  it('protects the right account after the plan array is reordered (id, not index)', async () => {
    // Protect Brokerage, then move it to the end of the array. A positional path
    // would now point at Roth; the id-based seam still protects Brokerage.
    const plan = planWithAccounts()
    const protectedAccounts = protect(plan, { accountId: 'acct-brokerage' })
    plan.accounts.reverse() // [Roth, Brokerage] — indices swapped vs. classification order
    const el = renderPanel(plan, { protectedAccounts })
    await chooseFile(el, TWO_ACCOUNT_CSV)

    act(() => applyButton(el).click())
    // Brokerage stayed protected across the reorder; Roth (unprotected) refreshed.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1, costBasis: 1 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 14000 })
  })

  it('blocks the whole account refresh for a costBasis-scoped entry (conservative semantics)', async () => {
    // Field-scoped protection is conservative today: an entry for acct-brokerage
    // narrowed to costBasis blocks the account's ENTIRE refresh, balance included —
    // `applyBrokerBalance` writes balance+basis as a unit and the engine treats any
    // protected field as locking the account. This pins the load-bearing conservative
    // behaviour so it can't regress.
    const plan = planWithAccounts()
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage', field: 'costBasis' }) })
    await chooseFile(el, TWO_ACCOUNT_CSV)
    // Selected onto the protected account, the row renders blocked (not disabled).
    expect(selects(el)[0]!.value).toBe('acct-brokerage')
    expect(el.querySelector('[role="note"]')?.textContent).toContain('Protected: advisor override')

    act(() => applyButton(el).click())
    // Balance stays 1 too — the costBasis-scoped entry blocked the whole write.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1, costBasis: 1 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 14000 })
  })

  it('handles nested account ids unambiguously with structured entries (`a.b` whole + `a` costBasis)', async () => {
    // With the structured contract there is no parsing to get wrong: an entry for
    // account 'a.b' and a SIBLING entry for account 'a' (field costBasis) name their
    // accounts verbatim, so ids that nest ('a' and 'a.b') — and dotted ids in general
    // — carry no ambiguity. Both accounts are protected; neither writes. Under the old
    // string contract the flat 'a.costBasis' would have been the ambiguous case; the
    // structured shape eliminates it.
    const plan = createEmptyPlan({ newId: testIds })
    const ownerId = plan.household.people[0]!.id
    plan.accounts.push(
      { id: 'a.b', type: 'taxable', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 1, costBasis: 1, annualContribution: 0 },
      { id: 'a', type: 'roth', name: 'Roth IRA', ownerPersonId: ownerId, annualReturnPct: null, kind: 'ira', balance: 1, annualContribution: 0 },
    )
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'a.b' }, { accountId: 'a', field: 'costBasis' }) })
    await chooseFile(el, TWO_ACCOUNT_CSV)

    // Brokerage guessed 'a.b' (whole-account protected); Roth guessed 'a' (costBasis
    // entry, conservatively the whole account). Both selected-but-blocked.
    const [brokerageSel, rothSel] = selects(el)
    expect(brokerageSel!.value).toBe('a.b')
    expect(rothSel!.value).toBe('a')
    expect(el.querySelectorAll('[role="note"]').length).toBe(2)

    act(() => applyButton(el).click())
    // Neither wrote — the two structured entries protect exactly their two accounts.
    expect(plan.accounts.find((a) => a.id === 'a.b')!).toMatchObject({ balance: 1, costBasis: 1 })
    expect(plan.accounts.find((a) => a.id === 'a')!).toMatchObject({ balance: 1 })
  })

  it('lets an unmatched row select a protected account, then block, release, and apply to it', async () => {
    // An unmatched row (no name guess) must still have a path to a protected
    // account: the protected account is a selectable (marked) option, selecting it
    // blocks the row, and the row-scoped release then lets it apply.
    const plan = createEmptyPlan({ newId: testIds })
    const ownerId = plan.household.people[0]!.id
    plan.accounts.push(
      { id: 'acct-brokerage', type: 'taxable', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 1, costBasis: 1, annualContribution: 0 },
      { id: 'acct-hsa', type: 'hsa', name: 'Fidelity HSA', ownerPersonId: ownerId, annualReturnPct: null, balance: 4000, annualContribution: 0 },
    )
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }) })
    await chooseFile(el, UNMATCHED_CSV)

    // The file row matches nothing, so it starts on "Don't update" with no note.
    const sel = selects(el)[0]!
    expect(sel.value).toBe('')
    expect(el.querySelector('[role="note"]')).toBeNull()
    // The protected Brokerage account is offered as a selectable (marked) option.
    const brokerageOption = Array.from(sel.options).find((o) => o.value === 'acct-brokerage')!
    expect(brokerageOption.disabled).toBe(false)
    expect(brokerageOption.textContent).toContain('(protected)')

    // Selecting it blocks the row (does not auto-release) and surfaces the control;
    // while blocked, the preview shows no write for the row.
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!
      setter.call(sel, 'acct-brokerage')
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(el.querySelector('[role="note"]')?.textContent).toContain('Protected: advisor override')
    expect(previewCells(el)[0]).not.toContain('→')

    // Release scoped to this row, then apply — the account refreshes from this row.
    act(() => el.querySelector<HTMLButtonElement>('button[aria-label="Allow this refresh for Brokerage"]')!.click())
    act(() => applyButton(el).click())
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 77000, costBasis: 60000 })
  })

  it('releases one row with "Allow this refresh" while a protected sibling stays blocked', async () => {
    const plan = planWithAccounts()
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }, { accountId: 'acct-roth' }) })
    await chooseFile(el, TWO_ACCOUNT_CSV)

    // Both guessed onto protected accounts: both selected but blocked, each with a note.
    expect(selects(el)[0]!.value).toBe('acct-brokerage')
    expect(selects(el)[1]!.value).toBe('acct-roth')
    expect(el.querySelectorAll('[role="note"]').length).toBe(2)

    // Release only the Brokerage row.
    const allow = el.querySelector<HTMLButtonElement>('button[aria-label="Allow this refresh for Brokerage"]')!
    act(() => allow.click())

    // The released row's note clears (it now applies); the sibling stays blocked.
    const [brokerageSel, rothSel] = selects(el)
    expect(brokerageSel!.value).toBe('acct-brokerage')
    expect(rothSel!.value).toBe('acct-roth')
    expect(el.querySelectorAll('[role="note"]').length).toBe(1) // only the still-protected Roth row

    act(() => applyButton(el).click())
    // Only the released account was written; the still-protected sibling was not.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 55000, costBasis: 40000 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 1 })
  })

  it('keeps an account released to one row out of reach of a sibling row', async () => {
    // Two file sections; row 0 guesses the protected Brokerage, row 1 guesses the
    // unprotected Roth (so its select applies and can be DOM-tampered).
    const plan = planWithAccounts()
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }) })
    await chooseFile(el, TWO_ACCOUNT_CSV)

    // Release Brokerage for row 0.
    act(() => el.querySelector<HTMLButtonElement>('button[aria-label="Allow this refresh for Brokerage"]')!.click())

    // Row 1's Brokerage <option> is now SELECTABLE (never disabled) but still marked
    // "(protected)" — it belongs to row 0's release, so selecting it blocks row 1.
    const rothSel = selects(el)[1]!
    const brokerageOption = Array.from(rothSel.options).find((o) => o.value === 'acct-brokerage')!
    expect(brokerageOption.disabled).toBe(false)
    expect(brokerageOption.textContent).toContain('(protected)')

    // Belt against DOM tampering: force row 1 to point at the released account and
    // apply. Row 1 is blocked (released to row 0, not row 1) so its pairing is
    // dropped — neither a duplicate block nor a second write. Brokerage is written
    // once, from row 0 only.
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!
      setter.call(rothSel, 'acct-brokerage')
      rothSel.dispatchEvent(new Event('change', { bubbles: true }))
    })
    // The stripped sibling leaves an audit record: the checklist shows a skipped
    // item naming the released-elsewhere protection, so the discard is not silent.
    expect(el.querySelector('.import-review')!.textContent).toContain('released to a different row')
    expect(applyButton(el).disabled).toBe(false) // no false duplicate block
    act(() => applyButton(el).click())
    // Row 0's section total (55,000), not blocked at the starting 1 and not the
    // Roth section's 14,000 — proof the sibling write was dropped.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 55000, costBasis: 40000 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 1 })
  })

  it('does not falsely duplicate-block two rows on the same unreleased protected account', async () => {
    // Two file rows classify onto the SAME protected Brokerage account, and a third
    // row onto the unprotected Roth. Round 4 kept the protected selections so the
    // engine could emit their skip items — but that made the two of them a duplicate
    // group, and any duplicate disables Apply GLOBALLY, so the unrelated Roth row
    // could never refresh. Now the protected pairings are stripped before the engine
    // sees them: no duplicate block, the Roth row applies, and BOTH protected rows
    // still surface as panel-synthesized skips.
    const plan = planWithAccounts() // Brokerage (protected below) + Roth IRA
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }) })
    await chooseFile(el, TWO_BROKERAGE_PLUS_ROTH_CSV)

    const [b0, b1, rothRow] = selects(el)
    expect(b0!.value).toBe('acct-brokerage')
    expect(b1!.value).toBe('acct-brokerage')
    expect(rothRow!.value).toBe('acct-roth')

    // No false duplicate collision, so Apply stays enabled and no alert is shown.
    expect(el.querySelector('[role="alert"]')).toBeNull()
    expect(applyButton(el).disabled).toBe(false)

    // The checklist carries BOTH protected skips (one per Brokerage row) plus the
    // Roth import.
    const review = el.querySelector('.import-review')!.textContent ?? ''
    expect((review.match(/protected by an advisor override/g) ?? []).length).toBe(2)
    expect(review).toContain('Refreshed the balance')

    act(() => applyButton(el).click())
    // The unprotected third row applied; the protected account stayed put.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1, costBasis: 1 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 14000 })
  })

  it('writes nothing to a released account once the releasing row is deselected', async () => {
    const plan = planWithAccounts()
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }) })
    await chooseFile(el, TWO_ACCOUNT_CSV)

    // Release Brokerage for row 0 (it was selected-but-blocked; now it applies).
    act(() => el.querySelector<HTMLButtonElement>('button[aria-label="Allow this refresh for Brokerage"]')!.click())
    const brokerageSel = selects(el)[0]!
    expect(brokerageSel.value).toBe('acct-brokerage')

    // Deselect row 0 back to "Don't update", then apply.
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!
      setter.call(brokerageSel, '')
      brokerageSel.dispatchEvent(new Event('change', { bubbles: true }))
    })
    act(() => applyButton(el).click())
    // Nothing targets Brokerage, so it is unchanged even though it was released.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1, costBasis: 1 })
  })

  it('restores protection when a new file is chosen (releases are transient)', async () => {
    const plan = planWithAccounts()
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }) })
    await chooseFile(el, TWO_ACCOUNT_CSV)

    // Release the Brokerage row, proving its note clears (it now applies).
    act(() => el.querySelector<HTMLButtonElement>('button[aria-label="Allow this refresh for Brokerage"]')!.click())
    expect(el.querySelector('[role="note"]')).toBeNull()

    // Choosing a new file clears the release — protection is restored (row blocked again).
    await chooseFile(el, TWO_ACCOUNT_CSV)
    expect(selects(el)[0]!.value).toBe('acct-brokerage')
    expect(el.querySelector('[role="note"]')?.textContent).toContain('Protected: advisor override')
  })

  it('revokes a row\'s release when that row re-targets, restoring protection for a sibling', async () => {
    // Release is scoped to the exact (row, account) pairing. When the releasing row
    // re-targets away from the account, the release must be dropped — protection is
    // restored, and another row that then selects the account sees it blocked and can
    // release it itself.
    const plan = planWithAccounts()
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }) })
    await chooseFile(el, TWO_ACCOUNT_CSV)

    // Row 0 guessed Brokerage (protected → blocked). Release it for row 0.
    act(() => el.querySelector<HTMLButtonElement>('button[aria-label="Allow this refresh for Brokerage"]')!.click())
    expect(el.querySelector('[role="note"]')).toBeNull() // row 0 now applies

    const setSelect = (sel: HTMLSelectElement, value: string) =>
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!
        setter.call(sel, value)
        sel.dispatchEvent(new Event('change', { bubbles: true }))
      })

    // Row 0 re-targets to "Don't update": its release of Brokerage is revoked, so
    // Brokerage is protected again.
    setSelect(selects(el)[0]!, '')

    // Row 1 now selects Brokerage — with protection restored it is blocked, not applied.
    setSelect(selects(el)[1]!, 'acct-brokerage')
    expect(el.querySelector('[role="note"]')?.textContent).toContain('Protected: advisor override')

    // Row 1 releases it (a fresh release, now owned by row 1) and applies — the write
    // lands from row 1's section (Roth section value, 14,000 / basis 12,000).
    act(() => el.querySelector<HTMLButtonElement>('button[aria-label="Allow this refresh for Brokerage"]')!.click())
    act(() => applyButton(el).click())
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 14000, costBasis: 12000 })
  })

  it('lists the protected row in the review checklist as skipped (provenance is not hidden)', async () => {
    // A selected-but-protected row must be VISIBLE in the checklist as deliberately
    // left unchanged. The panel now STRIPS the unreleased protected selection before
    // the engine sees it (so a duplicate on a protected account can't falsely block
    // Apply) and SYNTHESIZES the skip item itself, worded to match the engine's own.
    const plan = planWithAccounts()
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }) })
    await chooseFile(el, TWO_ACCOUNT_CSV)

    // Brokerage is the protected, blocked row; Roth applies normally.
    expect(selects(el)[0]!.value).toBe('acct-brokerage')
    const review = el.querySelector('.import-review')!
    expect(review.textContent).toContain('Skipped')
    expect(review.textContent).toContain('protected by an advisor override')
    expect(review.textContent).toContain('left its balance unchanged')
    // The row's broker label anchors the skip item to what the user sees in the table.
    expect(review.textContent).toContain('Brokerage')
    // The applying sibling is still reported as imported.
    expect(review.textContent).toContain('Refreshed the balance')
  })

  it('does not call a manually-assigned protected account stale (blocked, not absent)', async () => {
    // An unmatched file row manually assigned to a protected account is stripped from
    // the engine selection, so the engine — blind to the selection — reports that
    // account as stale ("not in the file"). But the user DID assign it; it is blocked
    // by an override, not absent. The panel must show the blocked note and must NOT
    // also name the account in the stale list, so it never says both at once.
    const plan = createEmptyPlan({ newId: testIds })
    const ownerId = plan.household.people[0]!.id
    plan.accounts.push(
      { id: 'acct-brokerage', type: 'taxable', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 1, costBasis: 1, annualContribution: 0 },
      // Genuinely absent from the file — this one SHOULD be reported stale.
      { id: 'acct-hsa', type: 'hsa', name: 'Fidelity HSA', ownerPersonId: ownerId, annualReturnPct: null, balance: 4000, annualContribution: 0 },
    )
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }) })
    await chooseFile(el, UNMATCHED_CSV)

    // The Windfall row matches nothing; hand-point it at the protected Brokerage.
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!
      setter.call(selects(el)[0]!, 'acct-brokerage')
      selects(el)[0]!.dispatchEvent(new Event('change', { bubbles: true }))
    })

    // The row is blocked by the override.
    expect(el.querySelector('[role="note"]')?.textContent).toContain('Protected: advisor override')

    // The stale note names the genuinely-absent HSA but NOT the assigned-but-blocked
    // Brokerage — no "blocked AND not in the file" contradiction about one account.
    const notes = Array.from(el.querySelectorAll('.callout')).map((c) => c.textContent ?? '')
    const stale = notes.find((t) => t.includes("aren't in the file"))
    expect(stale).toBeDefined()
    expect(stale).toContain('Fidelity HSA')
    expect(stale).not.toContain('Brokerage')
  })

  it('says protection (not a missing assignment) held everything back when every assigned row is blocked', async () => {
    // Both guesses land on protected accounts, so applying writes zero. The message
    // must name the advisor overrides rather than falsely claim nothing was assigned.
    const plan = planWithAccounts()
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }, { accountId: 'acct-roth' }) })
    await chooseFile(el, TWO_ACCOUNT_CSV)

    expect(selects(el)[0]!.value).toBe('acct-brokerage')
    expect(selects(el)[1]!.value).toBe('acct-roth')

    act(() => applyButton(el).click())
    // Nothing was written — both accounts stayed put.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1, costBasis: 1 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 1 })
    const status = el.querySelector('[role="status"]')!.textContent ?? ''
    expect(status).toContain('No balances were applied')
    expect(status).toContain('2 selected accounts are protected by advisor overrides')
    expect(status).toContain('Allow this refresh')
    // It must NOT fall back to the "nothing assigned" wording — the selections were visible.
    expect(status).not.toContain('No accounts were assigned')
    // The zero came purely from protection, so the panel must NOT tear itself down:
    // the message points at "Allow this refresh" controls, which must still be there.
    expect(el.querySelector('tbody')).not.toBeNull()
    expect(selects(el)[0]!.value).toBe('acct-brokerage')
    expect(selects(el)[1]!.value).toBe('acct-roth')
    const allowButtons = Array.from(el.querySelectorAll('button')).filter((b) =>
      b.getAttribute('aria-label')?.startsWith('Allow this refresh for'),
    )
    expect(allowButtons.length).toBe(2)

    // User-initiated Cancel tears the table down — and must clear the now-orphaned
    // status message too, which pointed at "Allow this refresh" controls the reset
    // just removed. Leaving it up would direct the user at gone controls.
    const cancel = cancelButton(el)
    act(() => cancel.click())
    expect(el.querySelector('tbody')).toBeNull()
    expect(el.querySelector('[role="status"]')).toBeNull()
  })

  it('counts unique protected accounts (not blocked rows) in the zero-write message', async () => {
    // Two file rows classify onto the SAME protected Brokerage account. The blocked
    // count is by account, not by row, so two rows on one protected account report a
    // single protected account (singular), matching the message's "accounts" wording.
    const plan = createEmptyPlan({ newId: testIds })
    plan.accounts.push(
      { id: 'acct-brokerage', type: 'taxable', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 5000, costBasis: 3000, annualContribution: 0 },
    )
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }) })
    await chooseFile(el, TWO_BROKERAGE_CSV)

    // Both rows guessed the one protected Brokerage account; stripping keeps them from
    // forming a duplicate block, so Apply proceeds and writes nothing.
    expect(selects(el)[0]!.value).toBe('acct-brokerage')
    expect(selects(el)[1]!.value).toBe('acct-brokerage')
    expect(applyButton(el).disabled).toBe(false)

    act(() => applyButton(el).click())
    const status = el.querySelector('[role="status"]')!.textContent ?? ''
    // One unique account → singular "1 selected account is", not "2 selected accounts".
    expect(status).toContain('1 selected account is protected by advisor overrides')
    expect(status).not.toContain('2 selected')
  })

  it('resets transient panel state when the plan identity changes', async () => {
    // The workspace reuses one panel instance across /plan/:id navigation. Cloned
    // plans share account ids, so a stale release must not survive into a different
    // plan and bypass its protection. Render plan P1, parse + release, then swap the
    // context to a plan with a DIFFERENT id and assert the panel is back to initial.
    const p1 = planWithAccounts()
    const el = renderPanel(p1, { protectedAccounts: protect(p1, { accountId: 'acct-brokerage' }) })
    await chooseFile(el, TWO_ACCOUNT_CSV)
    act(() => el.querySelector<HTMLButtonElement>('button[aria-label="Allow this refresh for Brokerage"]')!.click())
    // Parsed table is up and the release cleared the note.
    expect(el.querySelector('tbody')).not.toBeNull()
    expect(el.querySelector('[role="note"]')).toBeNull()

    // Swap the context to a different plan (same cloned account ids, new plan id).
    const p2 = planWithAccounts()
    expect(p2.id).not.toBe(p1.id)
    act(() => {
      root!.render(enabledPanelTree(p2, { protectedAccounts: protect(p2, { accountId: 'acct-brokerage' }) }))
    })

    // Back to the initial state: no parsed table.
    expect(el.querySelector('tbody')).toBeNull()

    // And re-parsing under the new plan protects its (freshly protected) account —
    // the stale release did not carry over.
    await chooseFile(el, TWO_ACCOUNT_CSV)
    expect(selects(el)[0]!.value).toBe('acct-brokerage')
    expect(el.querySelector('[role="note"]')?.textContent).toContain('Protected: advisor override')
  })

  it('discards an in-flight file read when the plan changes mid-read', async () => {
    // A slow `file.text()` must not repopulate the panel from the OLD plan after a
    // navigation swap — cloned plans share account ids, so an old file applied to the
    // new plan could bypass its protection. `handleFile` snapshots `plan.id` before the
    // await and compares it to `committedPlanId`, which a layout effect advances
    // synchronously at commit — so a read that captured the old identity is dropped even
    // if its text() settles before any passive effect could run. Start a read whose
    // text() we resolve by hand, swap the plan context mid-read, then resolve: dropped.
    const p1 = planWithAccounts()
    const el = renderPanel(p1, { protectedAccounts: protect(p1, { accountId: 'acct-brokerage' }) })

    let resolveText!: (value: string) => void
    const file = new File(['ignored'], 'positions.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'text', {
      value: () => new Promise<string>((resolve) => { resolveText = resolve }),
      configurable: true,
    })

    const input = el.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    act(() => input.dispatchEvent(new Event('change', { bubbles: true })))
    // The read is outstanding — nothing parsed yet.
    expect(el.querySelector('tbody')).toBeNull()

    // Swap to a DIFFERENT plan (new id, same cloned account ids) mid-read.
    const p2 = planWithAccounts()
    expect(p2.id).not.toBe(p1.id)
    act(() => {
      root!.render(enabledPanelTree(p2, { protectedAccounts: protect(p2, { accountId: 'acct-brokerage' }) }))
    })

    // Resolve the OLD read now, with a CSV that would otherwise build a table. Because
    // the epoch moved, the continuation discards it — the panel stays reset.
    await act(async () => {
      resolveText(TWO_ACCOUNT_CSV)
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(el.querySelector('tbody')).toBeNull()

    // The epoch is not stuck: a fresh read under the new plan still builds its table.
    await chooseFile(el, TWO_ACCOUNT_CSV)
    expect(el.querySelector('tbody')).not.toBeNull()
    expect(selects(el)[0]!.value).toBe('acct-brokerage')
  })

  it('leaves an in-flight read untouched by a plain re-render with the same plan (epoch not bumped in render)', async () => {
    // The concrete false-discard bug — a concurrent render React DISCARDS still leaves a
    // bumped ref behind, invalidating a legit read for the still-visible plan — is not
    // directly reproducible in jsdom, which has no concurrent, discardable renders. What
    // IS testable is the precondition the fix guarantees: the read epoch is bumped only
    // in event handlers, never in render, so an ordinary re-render cannot invalidate an
    // outstanding read. Start a read, force a plain re-render with the SAME plan (no
    // identity change — an ordinary render that concurrent React could discard), then
    // resolve: the read still builds its table rather than being falsely dropped.
    const plan = planWithAccounts()
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }) })

    let resolveText!: (value: string) => void
    const file = new File(['ignored'], 'positions.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'text', {
      value: () => new Promise<string>((resolve) => { resolveText = resolve }),
      configurable: true,
    })
    const input = el.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    act(() => input.dispatchEvent(new Event('change', { bubbles: true })))
    // The read is outstanding — nothing parsed yet.
    expect(el.querySelector('tbody')).toBeNull()

    // Plain re-render with the SAME plan id (no identity reset). This must not touch the
    // read epoch — a render-phase bump is exactly the removed bug.
    act(() => {
      root!.render(enabledPanelTree(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }) }))
    })

    // Resolve: epoch unchanged and committed plan identity unchanged, so it lands.
    await act(async () => {
      resolveText(TWO_ACCOUNT_CSV)
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(el.querySelector('tbody')).not.toBeNull()
    expect(selects(el)[0]!.value).toBe('acct-brokerage')
  })

  it('shows the newer file and discards a superseded slower read (releases after it stay valid)', async () => {
    // Two files chosen back-to-back carry the same plan identity, so an (id, generation)
    // guard could let the OLDER read win when it settles last. A synchronous per-read
    // epoch — bumped at the very start of every handleFile — makes each selection
    // supersede the prior in-flight read: choose slow A, then fast B; resolve B, then A;
    // the panel shows B's rows, A is dropped, and a release made after B survives A.
    const plan = planWithAccounts()
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }) })
    const input = el.querySelector<HTMLInputElement>('input[type="file"]')!

    // File A: a slow read we resolve by hand. Its CSV would build a table if it won.
    let resolveA!: (value: string) => void
    const fileA = new File(['a'], 'a.csv', { type: 'text/csv' })
    Object.defineProperty(fileA, 'text', {
      value: () => new Promise<string>((resolve) => { resolveA = resolve }),
      configurable: true,
    })
    // File B: also hand-resolved, chosen AFTER A so it supersedes it.
    let resolveB!: (value: string) => void
    const fileB = new File(['b'], 'b.csv', { type: 'text/csv' })
    Object.defineProperty(fileB, 'text', {
      value: () => new Promise<string>((resolve) => { resolveB = resolve }),
      configurable: true,
    })

    // Choose A (slow), then B (fast) back-to-back — both reads now outstanding.
    Object.defineProperty(input, 'files', { value: [fileA], configurable: true })
    act(() => input.dispatchEvent(new Event('change', { bubbles: true })))
    Object.defineProperty(input, 'files', { value: [fileB], configurable: true })
    act(() => input.dispatchEvent(new Event('change', { bubbles: true })))

    // Resolve B first — the newer read wins and builds its table.
    await act(async () => {
      resolveB(TWO_ACCOUNT_CSV)
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(el.querySelector('tbody')).not.toBeNull()
    expect(selects(el)[0]!.value).toBe('acct-brokerage')

    // A release made after B is in effect (its blocked note clears).
    act(() => el.querySelector<HTMLButtonElement>('button[aria-label="Allow this refresh for Brokerage"]')!.click())
    expect(el.querySelector('[role="note"]')).toBeNull()

    // Now resolve the OLDER read A. It was superseded, so it must NOT repopulate the
    // panel or clobber B's release.
    await act(async () => {
      resolveA(TWO_ACCOUNT_CSV)
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    // Still B's table with B's release intact — the row applies, so apply writes it.
    expect(selects(el)[0]!.value).toBe('acct-brokerage')
    expect(el.querySelector('[role="note"]')).toBeNull()
    act(() => applyButton(el).click())
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 55000, costBasis: 40000 })
  })
})

/**
 * The `pending` half of the seam: a host that resolves its protected set
 * asynchronously has an interval where an empty `protectedAccounts` would read as
 * "nothing is protected", and a refresh landing in that window could overwrite an
 * advisor-frozen account. `pending` says "not known yet" instead, and the panel
 * refuses BOTH the file and the apply while it is true, for two different
 * reasons: applying against an unknown set is unsafe, while a preview built
 * during the window is merely untruthful — it would draw every row as
 * unprotected and then rewrite itself when the real set arrived. (Untruthful,
 * not unsafe: the panel recomputes every protection-derived value from the live
 * context each render, and the row seeding never consults protection at all.)
 *
 * The default is `false` everywhere it is not supplied, INCLUDING the no-provider
 * path: the public web app mounts no provider and its protection is genuinely
 * known (empty), so defaulting to `true` would permanently disable its Apply.
 */
describe('UpdateBalancesPanel protection pending', () => {
  it('gates the file chooser and offers no apply control while protection is unknown', async () => {
    const plan = planWithAccounts()
    const el = renderPanel(plan, { protectedAccounts: [], pending: true })

    // The chooser is refused, and says why in a visible explanation AND on the
    // control itself — a greyed-out button with no reason is the thing to avoid.
    expect(chooseButton(el).disabled).toBe(true)
    const explanation = pendingExplanation(el)
    expect(explanation).toContain('Checking which accounts your advisor has protected')
    expect(chooseButton(el).title).toBe(explanation)
    // Nothing is parsed, so there is no apply control at all — the strongest gate.
    expect(maybeApplyButton(el)).toBeNull()
    expect(el.querySelector('tbody')).toBeNull()
  })

  it('refuses a file driven straight at the hidden input while pending (belt, not just the button)', async () => {
    // The chooser button is disabled, but the hidden <input type="file"> can still
    // be dispatched at directly. `handleFile` must refuse it: parsing here would
    // seed row selections from a protected set the host has not resolved.
    const plan = planWithAccounts()
    const el = renderPanel(plan, { protectedAccounts: [], pending: true })

    await chooseFile(el, TWO_ACCOUNT_CSV)

    expect(el.querySelector('tbody')).toBeNull()
    expect(maybeApplyButton(el)).toBeNull()
    // And nothing reached the plan.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1, costBasis: 1 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 1 })
  })

  it('tears down an already-parsed preview if the host goes back to pending', async () => {
    // A table parsed while protection was KNOWN was classified, pre-selected and
    // previewed against that set. If the host re-enters pending, that preview no
    // longer describes a known protection state and would change under the user when
    // the new answer lands — so it is cleared, and the panel is gated again.
    const plan = planWithAccounts()
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }) })
    await chooseFile(el, TWO_ACCOUNT_CSV)
    expect(el.querySelector('tbody')).not.toBeNull()
    expect(maybeApplyButton(el)).not.toBeNull()

    act(() => {
      root!.render(
        enabledPanelTree(plan, {
          protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }),
          pending: true,
        }),
      )
    })

    expect(el.querySelector('tbody')).toBeNull()
    expect(maybeApplyButton(el)).toBeNull()
    expect(chooseButton(el).disabled).toBe(true)
    expect(pendingExplanation(el)).toContain('Checking which accounts your advisor has protected')
    // Neither account moved.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1, costBasis: 1 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 1 })
  })

  it('enables the panel with protection applied once pending clears', async () => {
    // The transition a real host makes: mount pending with nothing resolved, then
    // hand over the resolved set. The panel must come back to life AND honour the
    // protection that just arrived — an enabled panel that forgot the set would be
    // worse than the gate it replaced.
    const plan = planWithAccounts()
    const el = renderPanel(plan, { protectedAccounts: [], pending: true })
    expect(chooseButton(el).disabled).toBe(true)

    act(() => {
      root!.render(
        enabledPanelTree(plan, {
          protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }),
          pending: false,
        }),
      )
    })

    // Gate lifted: the explanation is gone and the chooser carries no leftover title.
    expect(pendingExplanation(el)).toBeNull()
    expect(chooseButton(el).disabled).toBe(false)
    expect(chooseButton(el).title).toBe('')

    // The now-known protection is in force: the Brokerage row is blocked, the Roth
    // row applies.
    await chooseFile(el, TWO_ACCOUNT_CSV)
    expect(selects(el)[0]!.value).toBe('acct-brokerage')
    expect(el.querySelector('[role="note"]')?.textContent).toContain('Protected: advisor override')
    expect(applyButton(el).disabled).toBe(false)

    act(() => applyButton(el).click())
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1, costBasis: 1 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 14000 })
  })

  it('behaves exactly as before when a provider passes pending: false', async () => {
    // An explicit `pending: false` must be indistinguishable from the pre-`pending`
    // provider: no explanation, no titles, protection enforced, apply writes.
    const plan = planWithAccounts()
    const el = renderPanel(plan, {
      protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }),
      pending: false,
    })
    expect(pendingExplanation(el)).toBeNull()
    expect(chooseButton(el).disabled).toBe(false)

    await chooseFile(el, TWO_ACCOUNT_CSV)
    expect(applyButton(el).disabled).toBe(false)
    expect(applyButton(el).title).toBe('')
    expect(el.querySelector('[role="note"]')?.textContent).toContain('Protected: advisor override')

    act(() => applyButton(el).click())
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1, costBasis: 1 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 14000 })
  })

  it('is never pending with no provider mounted (the public web app is not gated)', async () => {
    // The load-bearing default. The public app renders no provider, so a `pending`
    // that defaulted to `true` would permanently disable its Apply.
    const plan = planWithAccounts()
    const el = renderPanel(plan) // no provider at all

    expect(pendingExplanation(el)).toBeNull()
    expect(chooseButton(el).disabled).toBe(false)
    expect(chooseButton(el).title).toBe('')

    await chooseFile(el, TWO_ACCOUNT_CSV)
    expect(applyButton(el).disabled).toBe(false)
    act(() => applyButton(el).click())
    // Both accounts refreshed — nothing is protected and nothing is gated.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 55000, costBasis: 40000 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 14000 })
  })

  it('names the duplicate collision, not protection, when Apply is blocked by duplicates', async () => {
    // `blocked` meant duplicates only before `pending` existed, and it still does:
    // the disabled Apply must explain the cause that actually fired, or the two
    // gates become indistinguishable to a user looking at one greyed-out button.
    const plan = createEmptyPlan({ newId: testIds })
    plan.accounts.push(
      { id: 'acct-brokerage', type: 'taxable', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 5000, costBasis: 3000, annualContribution: 0 },
    )
    const el = renderPanel(plan)
    await chooseFile(el, TWO_BROKERAGE_CSV)

    expect(applyButton(el).disabled).toBe(true)
    expect(applyButton(el).title).toContain('same plan account')
    expect(applyButton(el).title).not.toContain('advisor')
    expect(pendingExplanation(el)).toBeNull()
  })

  it('drops an in-flight read if the host goes pending while it is outstanding', async () => {
    // The post-await continuation guard. `handleFile`'s entry check closed over
    // the OLD `protectionPending`, so a read that began while protection was
    // KNOWN cannot see the host withdraw it — and without a commit-synchronous
    // guard the continuation would call setParsed right after the render-phase
    // reset cleared it, rendering a full preview table (rows pre-selected, a
    // delta computed) against a protection set the host no longer stands behind.
    const plan = planWithAccounts()
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }) })

    let resolveText!: (value: string) => void
    const file = new File(['ignored'], 'positions.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'text', {
      value: () => new Promise<string>((resolve) => { resolveText = resolve }),
      configurable: true,
    })
    const input = el.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    act(() => input.dispatchEvent(new Event('change', { bubbles: true })))
    expect(el.querySelector('tbody')).toBeNull() // outstanding

    // The host flips to pending mid-read.
    act(() => {
      root!.render(
        enabledPanelTree(plan, {
          protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }),
          pending: true,
        }),
      )
    })

    // Resolve the read with a CSV that would otherwise build a table.
    await act(async () => {
      resolveText(TWO_ACCOUNT_CSV)
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(el.querySelector('tbody')).toBeNull()
    expect(maybeApplyButton(el)).toBeNull()
    expect(chooseButton(el).disabled).toBe(true)
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1, costBasis: 1 })

    // Not stuck: once the host resolves, a fresh read builds its table again.
    act(() => {
      root!.render(
        enabledPanelTree(plan, {
          protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }),
          pending: false,
        }),
      )
    })
    await chooseFile(el, TWO_ACCOUNT_CSV)
    expect(el.querySelector('tbody')).not.toBeNull()
  })

  it('drops an in-flight read that spanned a whole pending cycle, not only one ending pending', async () => {
    // The post-await guard used to sample whether protection is pending RIGHT NOW.
    // A `file.text()` slow enough to span a full false→true→false cycle sees only
    // the final false, so the continuation calls setParsed and restores the very
    // preview the pending transition deliberately cleared — a table seeded, rows
    // pre-selected and a delta computed against the set that was known before the
    // host withdrew and re-issued it. What matters is whether pending was ENTERED
    // during the read, which is a committed generation, not a current value.
    const plan = planWithAccounts()
    const el = renderPanel(plan, { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }) })

    let resolveText!: (value: string) => void
    const file = new File(['ignored'], 'positions.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'text', {
      value: () => new Promise<string>((resolve) => { resolveText = resolve }),
      configurable: true,
    })
    const input = el.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    act(() => input.dispatchEvent(new Event('change', { bubbles: true })))
    expect(el.querySelector('tbody')).toBeNull() // outstanding

    // The whole cycle, start to finish, while the read is still outstanding.
    for (const pending of [true, false]) {
      act(() => {
        root!.render(
          enabledPanelTree(plan, {
            protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }),
            pending,
          }),
        )
      })
    }
    // Protection is known again, so the panel is usable — this is not the
    // "still pending" case the current-value check already caught.
    expect(pendingExplanation(el)).toBeNull()
    expect(chooseButton(el).disabled).toBe(false)

    // Resolve the read with a CSV that would otherwise build a table.
    await act(async () => {
      resolveText(TWO_ACCOUNT_CSV)
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(el.querySelector('tbody')).toBeNull()
    expect(maybeApplyButton(el)).toBeNull()
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1, costBasis: 1 })

    // Not stuck: a fresh read, started now that protection is known, still lands.
    await chooseFile(el, TWO_ACCOUNT_CSV)
    expect(el.querySelector('tbody')).not.toBeNull()
    expect(selects(el)[0]!.value).toBe('acct-brokerage')
  })

  it('accepts a host-built context value that omits pending entirely', async () => {
    // `RefreshProtectionValue` is named in the README as part of the supported
    // product API and the context module is importable through the exports
    // wildcard, so a host may construct its own value object. `pending` is
    // therefore an OPTIONAL member: this object — which is exactly what a host
    // written before `pending` existed produces — must still typecheck, and the
    // absent flag must read as `false` rather than gating the panel forever.
    const plan = planWithAccounts()
    const value: RefreshProtectionValue = { protectedAccounts: protect(plan, { accountId: 'acct-brokerage' }) }

    container = window.document.createElement('div')
    window.document.body.appendChild(container)
    root = createRoot(container)
    act(() => {
      root!.render(
        <PlanCtx.Provider
          value={{ plan, update: (m) => m(plan), discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}
        >
          <RefreshProtectionContext.Provider value={value}>
            <UpdateBalancesPanel />
          </RefreshProtectionContext.Provider>
        </PlanCtx.Provider>,
      )
    })

    expect(pendingExplanation(container)).toBeNull()
    expect(chooseButton(container).disabled).toBe(false)

    // …and the protection it DID supply is still enforced.
    await chooseFile(container, TWO_ACCOUNT_CSV)
    expect(container.querySelector('[role="note"]')?.textContent).toContain('Protected: advisor override')
    act(() => applyButton(container!).click())
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1, costBasis: 1 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 14000 })
  })
})
