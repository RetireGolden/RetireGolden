/** @vitest-environment jsdom */
/**
 * "Update balances from a broker CSV" wiring: the parser's review checklist is
 * surfaced before Apply, duplicate plan-account targets block Apply instead of
 * silently last-write-winning, and applying writes balances/basis to the plan.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { createEmptyPlan, type Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx } from '../planContextCore'
import { RefreshProtectionProvider } from '../RefreshProtectionProvider'
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

function renderPanel(plan: Plan, protectedAccounts?: ReadonlySet<string>) {
  const update = (mutator: (draft: Plan) => void) => mutator(plan)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const panel = <UpdateBalancesPanel />
  act(() => {
    root!.render(
      <PlanCtx.Provider value={{ plan, update, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
        {protectedAccounts ? (
          <RefreshProtectionProvider protectedAccounts={protectedAccounts}>{panel}</RefreshProtectionProvider>
        ) : (
          panel
        )}
      </PlanCtx.Provider>,
    )
  })
  return container
}

/**
 * Build a host protection set from stable account-id entries (an id, or
 * `<id>.<field>`) — what the protection seam speaks now that it binds to ids, not
 * positions. Every id is checked against the plan so a typo throws loudly here
 * instead of silently protecting nothing (the old positional helper yielded
 * `accounts[-1]` on a miss and quietly protected a phantom index).
 */
function protect(plan: Plan, ...entries: string[]): ReadonlySet<string> {
  for (const entry of entries) {
    const id = entry.includes('.') ? entry.slice(0, entry.indexOf('.')) : entry
    if (!plan.accounts.some((a) => a.id === id)) {
      throw new Error(`protect(): no plan account with id "${id}" (from entry "${entry}")`)
    }
  }
  return new Set(entries)
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
 * feeds the accounts an advisor froze, by STABLE account id (or `<id>.<field>`),
 * never by array position. The panel resolves each id to its current
 * `accounts[i]` fresh per render and threads the positional set into all three
 * engine calls so apply skips it. The per-row "Allow this refresh" control is
 * TRANSIENT and ROW-SCOPED — it releases the account for this panel instance and
 * only for the requesting row (the stored override is never touched, and a
 * sibling row cannot reach the released account). (Every spec above runs with no
 * provider and passes unchanged, which is the empty-default guarantee.)
 */
describe('UpdateBalancesPanel refresh protection', () => {
  it('protects a row by default while an unprotected sibling applies normally', async () => {
    const plan = planWithAccounts()
    const el = renderPanel(plan, protect(plan, 'acct-brokerage'))
    await chooseFile(el, TWO_ACCOUNT_CSV)

    const [brokerageSel, rothSel] = selects(el)
    // Brokerage is protected: off, disabled, with a visible note. Roth is not.
    expect(brokerageSel!.value).toBe('')
    expect(brokerageSel!.disabled).toBe(true)
    expect(rothSel!.disabled).toBe(false)
    expect(rothSel!.value).toBe('acct-roth')
    expect(el.querySelector('[role="note"]')?.textContent).toContain('Protected — advisor override')

    act(() => applyButton(el).click())
    // The protected account is untouched; the sibling refreshes.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1, costBasis: 1 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 14000 })
  })

  it('protects the right account after the plan array is reordered (id, not index)', async () => {
    // Protect Brokerage, then move it to the end of the array. A positional path
    // would now point at Roth; the id-based seam still protects Brokerage.
    const plan = planWithAccounts()
    const protectedAccounts = protect(plan, 'acct-brokerage')
    plan.accounts.reverse() // [Roth, Brokerage] — indices swapped vs. classification order
    const el = renderPanel(plan, protectedAccounts)
    await chooseFile(el, TWO_ACCOUNT_CSV)

    act(() => applyButton(el).click())
    // Brokerage stayed protected across the reorder; Roth (unprotected) refreshed.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1, costBasis: 1 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 14000 })
  })

  it('protects only the named field when a `<id>.<field>` entry is given', async () => {
    // Protecting acct-brokerage.costBasis blocks the whole account write (the
    // engine treats any protected field of an account as locking the account).
    const plan = planWithAccounts()
    const el = renderPanel(plan, protect(plan, 'acct-brokerage.costBasis'))
    await chooseFile(el, TWO_ACCOUNT_CSV)
    expect(selects(el)[0]!.disabled).toBe(true)

    act(() => applyButton(el).click())
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 1, costBasis: 1 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 14000 })
  })

  it('releases one row with "Allow this refresh" while a protected sibling stays untouched', async () => {
    const plan = planWithAccounts()
    const el = renderPanel(plan, protect(plan, 'acct-brokerage', 'acct-roth'))
    await chooseFile(el, TWO_ACCOUNT_CSV)

    // Both protected to start: both off and disabled.
    expect(selects(el)[0]!.disabled).toBe(true)
    expect(selects(el)[1]!.disabled).toBe(true)

    // Release only the Brokerage row.
    const allow = el.querySelector<HTMLButtonElement>('button[aria-label="Allow this refresh for Brokerage"]')!
    act(() => allow.click())

    // The released row is now enabled and pre-selected; the sibling stays locked.
    const [brokerageSel, rothSel] = selects(el)
    expect(brokerageSel!.disabled).toBe(false)
    expect(brokerageSel!.value).toBe('acct-brokerage')
    expect(rothSel!.disabled).toBe(true)

    act(() => applyButton(el).click())
    // Only the released account was written; the still-protected sibling was not.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 55000, costBasis: 40000 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 1 })
  })

  it('keeps an account released to one row out of reach of a sibling row', async () => {
    // Two file sections; row 0 guesses the protected Brokerage, row 1 guesses the
    // unprotected Roth (so its select stays enabled and can be DOM-tampered).
    const plan = planWithAccounts()
    const el = renderPanel(plan, protect(plan, 'acct-brokerage'))
    await chooseFile(el, TWO_ACCOUNT_CSV)

    // Release Brokerage for row 0.
    act(() => el.querySelector<HTMLButtonElement>('button[aria-label="Allow this refresh for Brokerage"]')!.click())

    // Row 1's Brokerage <option> is disabled and marked, so it cannot be selected.
    const rothSel = selects(el)[1]!
    const brokerageOption = Array.from(rothSel.options).find((o) => o.value === 'acct-brokerage')!
    expect(brokerageOption.disabled).toBe(true)
    expect(brokerageOption.textContent).toContain('(protected)')

    // Belt against DOM tampering: force row 1 to point at the released account and
    // apply. The sibling pairing is dropped, so it is neither a duplicate block
    // nor a second write — Brokerage is written once, from row 0 only.
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!
      setter.call(rothSel, 'acct-brokerage')
      rothSel.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(applyButton(el).disabled).toBe(false) // no false duplicate block
    act(() => applyButton(el).click())
    // Row 0's section total (55,000), not blocked at the starting 1 and not the
    // Roth section's 14,000 — proof the sibling write was dropped.
    expect(plan.accounts.find((a) => a.id === 'acct-brokerage')!).toMatchObject({ balance: 55000, costBasis: 40000 })
    expect(plan.accounts.find((a) => a.id === 'acct-roth')!).toMatchObject({ balance: 1 })
  })

  it('writes nothing to a released account once the releasing row is deselected', async () => {
    const plan = planWithAccounts()
    const el = renderPanel(plan, protect(plan, 'acct-brokerage'))
    await chooseFile(el, TWO_ACCOUNT_CSV)

    // Release Brokerage for row 0 (its select is now enabled and pre-selected).
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
    const el = renderPanel(plan, protect(plan, 'acct-brokerage'))
    await chooseFile(el, TWO_ACCOUNT_CSV)

    // Release the Brokerage row, proving it re-enables.
    act(() => el.querySelector<HTMLButtonElement>('button[aria-label="Allow this refresh for Brokerage"]')!.click())
    expect(selects(el)[0]!.disabled).toBe(false)

    // Choosing a new file clears the release — protection is restored.
    await chooseFile(el, TWO_ACCOUNT_CSV)
    expect(selects(el)[0]!.disabled).toBe(true)
    expect(selects(el)[0]!.value).toBe('')
    expect(el.querySelector('[role="note"]')?.textContent).toContain('Protected — advisor override')
  })
})
