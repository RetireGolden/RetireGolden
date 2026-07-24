/** @vitest-environment jsdom */
/**
 * "Update balances from a broker CSV" wiring: the parser's review checklist is
 * surfaced before Apply, duplicate plan-account targets block Apply instead of
 * silently last-write-winning, and applying writes balances/basis to the plan.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { createEmptyPlan, type Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx } from '../planContextCore'
import { RefreshProtectionProvider } from '../RefreshProtectionProvider'
import type { RefreshProtectionEntry } from '../refreshProtectionContext'
import { UpdateBalancesPanel } from './UpdateBalancesPanel'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
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

function providerTree(plan: Plan, panel: ReactNode, protectedAccounts?: readonly RefreshProtectionEntry[]) {
  const update = (mutator: (draft: Plan) => void) => mutator(plan)
  return (
    <PlanCtx.Provider value={{ plan, update, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
      {protectedAccounts ? (
        <RefreshProtectionProvider protectedAccounts={protectedAccounts}>{panel}</RefreshProtectionProvider>
      ) : (
        panel
      )}
    </PlanCtx.Provider>
  )
}

function renderPanel(plan: Plan, protectedAccounts?: readonly RefreshProtectionEntry[]) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(providerTree(plan, <UpdateBalancesPanel />, protectedAccounts))
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

function selects(el: HTMLElement): HTMLSelectElement[] {
  return Array.from(el.querySelectorAll('tbody select'))
}

function applyButton(el: HTMLElement): HTMLButtonElement {
  return Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Apply selected'))!
}

describe('UpdateBalancesPanel', () => {
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
    const el = renderPanel(plan, protect(plan, { accountId: 'acct-brokerage' }))
    await chooseFile(el, TWO_ACCOUNT_CSV)

    const [brokerageSel, rothSel] = selects(el)
    // Brokerage's guess is protected: the row is selected onto it but BLOCKED (not
    // disabled — protected accounts stay selectable), with a visible note. Roth is
    // an ordinary applying row.
    expect(brokerageSel!.value).toBe('acct-brokerage')
    expect(brokerageSel!.disabled).toBe(false)
    expect(rothSel!.disabled).toBe(false)
    expect(rothSel!.value).toBe('acct-roth')
    expect(el.querySelector('[role="note"]')?.textContent).toContain('Protected — advisor override')

    act(() => applyButton(el).click())
    // The protected account is untouched (blocked contributes nothing); the sibling refreshes.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1, costBasis: 1 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 14000 })
  })

  it('protects the right account after the plan array is reordered (id, not index)', async () => {
    // Protect Brokerage, then move it to the end of the array. A positional path
    // would now point at Roth; the id-based seam still protects Brokerage.
    const plan = planWithAccounts()
    const protectedAccounts = protect(plan, { accountId: 'acct-brokerage' })
    plan.accounts.reverse() // [Roth, Brokerage] — indices swapped vs. classification order
    const el = renderPanel(plan, protectedAccounts)
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
    const el = renderPanel(plan, protect(plan, { accountId: 'acct-brokerage', field: 'costBasis' }))
    await chooseFile(el, TWO_ACCOUNT_CSV)
    // Selected onto the protected account, the row renders blocked (not disabled).
    expect(selects(el)[0]!.value).toBe('acct-brokerage')
    expect(el.querySelector('[role="note"]')?.textContent).toContain('Protected — advisor override')

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
    const el = renderPanel(plan, protect(plan, { accountId: 'a.b' }, { accountId: 'a', field: 'costBasis' }))
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
    const el = renderPanel(plan, protect(plan, { accountId: 'acct-brokerage' }))
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
    expect(el.querySelector('[role="note"]')?.textContent).toContain('Protected — advisor override')
    expect(previewCells(el)[0]).not.toContain('→')

    // Release scoped to this row, then apply — the account refreshes from this row.
    act(() => el.querySelector<HTMLButtonElement>('button[aria-label="Allow this refresh for Brokerage"]')!.click())
    act(() => applyButton(el).click())
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 77000, costBasis: 60000 })
  })

  it('releases one row with "Allow this refresh" while a protected sibling stays blocked', async () => {
    const plan = planWithAccounts()
    const el = renderPanel(plan, protect(plan, { accountId: 'acct-brokerage' }, { accountId: 'acct-roth' }))
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
    const el = renderPanel(plan, protect(plan, { accountId: 'acct-brokerage' }))
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

  it('writes nothing to a released account once the releasing row is deselected', async () => {
    const plan = planWithAccounts()
    const el = renderPanel(plan, protect(plan, { accountId: 'acct-brokerage' }))
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
    const el = renderPanel(plan, protect(plan, { accountId: 'acct-brokerage' }))
    await chooseFile(el, TWO_ACCOUNT_CSV)

    // Release the Brokerage row, proving its note clears (it now applies).
    act(() => el.querySelector<HTMLButtonElement>('button[aria-label="Allow this refresh for Brokerage"]')!.click())
    expect(el.querySelector('[role="note"]')).toBeNull()

    // Choosing a new file clears the release — protection is restored (row blocked again).
    await chooseFile(el, TWO_ACCOUNT_CSV)
    expect(selects(el)[0]!.value).toBe('acct-brokerage')
    expect(el.querySelector('[role="note"]')?.textContent).toContain('Protected — advisor override')
  })

  it('revokes a row\'s release when that row re-targets, restoring protection for a sibling', async () => {
    // Release is scoped to the exact (row, account) pairing. When the releasing row
    // re-targets away from the account, the release must be dropped — protection is
    // restored, and another row that then selects the account sees it blocked and can
    // release it itself.
    const plan = planWithAccounts()
    const el = renderPanel(plan, protect(plan, { accountId: 'acct-brokerage' }))
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
    expect(el.querySelector('[role="note"]')?.textContent).toContain('Protected — advisor override')

    // Row 1 releases it (a fresh release, now owned by row 1) and applies — the write
    // lands from row 1's section (Roth section value, 14,000 / basis 12,000).
    act(() => el.querySelector<HTMLButtonElement>('button[aria-label="Allow this refresh for Brokerage"]')!.click())
    act(() => applyButton(el).click())
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 14000, costBasis: 12000 })
  })

  it('lists the protected row in the review checklist as skipped (provenance is not hidden)', async () => {
    // A selected-but-protected row must be VISIBLE in the checklist as deliberately
    // left unchanged — the panel keeps the unreleased protected selection in the map
    // it hands the engine, so the engine emits its protected-target 'skipped' item.
    const plan = planWithAccounts()
    const el = renderPanel(plan, protect(plan, { accountId: 'acct-brokerage' }))
    await chooseFile(el, TWO_ACCOUNT_CSV)

    // Brokerage is the protected, blocked row; Roth applies normally.
    expect(selects(el)[0]!.value).toBe('acct-brokerage')
    const review = el.querySelector('.import-review')!
    expect(review.textContent).toContain('Skipped')
    expect(review.textContent).toContain('protected, so the refresh left its balance unchanged')
    // The row's broker label anchors the skip item to what the user sees in the table.
    expect(review.textContent).toContain('Brokerage')
    // The applying sibling is still reported as imported.
    expect(review.textContent).toContain('Refreshed the balance')
  })

  it('says protection (not a missing assignment) held everything back when every assigned row is blocked', async () => {
    // Both guesses land on protected accounts, so applying writes zero. The message
    // must name the advisor overrides rather than falsely claim nothing was assigned.
    const plan = planWithAccounts()
    const el = renderPanel(plan, protect(plan, { accountId: 'acct-brokerage' }, { accountId: 'acct-roth' }))
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
  })

  it('resets transient panel state when the plan identity changes', async () => {
    // The workspace reuses one panel instance across /plan/:id navigation. Cloned
    // plans share account ids, so a stale release must not survive into a different
    // plan and bypass its protection. Render plan P1, parse + release, then swap the
    // context to a plan with a DIFFERENT id and assert the panel is back to initial.
    const p1 = planWithAccounts()
    const el = renderPanel(p1, protect(p1, { accountId: 'acct-brokerage' }))
    await chooseFile(el, TWO_ACCOUNT_CSV)
    act(() => el.querySelector<HTMLButtonElement>('button[aria-label="Allow this refresh for Brokerage"]')!.click())
    // Parsed table is up and the release cleared the note.
    expect(el.querySelector('tbody')).not.toBeNull()
    expect(el.querySelector('[role="note"]')).toBeNull()

    // Swap the context to a different plan (same cloned account ids, new plan id).
    const p2 = planWithAccounts()
    expect(p2.id).not.toBe(p1.id)
    act(() => {
      root!.render(providerTree(p2, <UpdateBalancesPanel />, protect(p2, { accountId: 'acct-brokerage' })))
    })

    // Back to the initial state: no parsed table.
    expect(el.querySelector('tbody')).toBeNull()

    // And re-parsing under the new plan protects its (freshly protected) account —
    // the stale release did not carry over.
    await chooseFile(el, TWO_ACCOUNT_CSV)
    expect(selects(el)[0]!.value).toBe('acct-brokerage')
    expect(el.querySelector('[role="note"]')?.textContent).toContain('Protected — advisor override')
  })
})
