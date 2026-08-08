/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '@retiregolden/engine/model/plan'

import { PlanCtx } from '../planContextCore'
import { AccountFields } from './AccountFields'
import { EVEN_START_WEIGHTS, TAX_EXEMPT_ALLOCATION_DOUBLE_COUNT_WARNING, localCalendarDateIso } from './sectionHelpers'
import { Issues } from './shared'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

let n = 0
const testIds = () => `af-${++n}`

function taxableAccount(overrides: Partial<Extract<Account, { type: 'taxable' }>> = {}): Extract<Account, { type: 'taxable' }> {
  return {
    type: 'taxable',
    id: 'brokerage',
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance: 100_000,
    costBasis: 100_000,
    annualContribution: 0,
    ...overrides,
  }
}

function planWithAccount(account: Account): Plan {
  const plan = createEmptyPlan({ newId: testIds })
  plan.accounts = [account]
  return plan
}

function renderFields(plan: Plan, accountIndex = 0, onUpdate?: (mutator: (draft: Plan) => void) => void) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const account = plan.accounts[accountIndex]!
  const panel: ReactNode = (
    <MemoryRouter>
      <PlanCtx.Provider
        value={{
          plan,
          update: onUpdate ?? (() => undefined),
          discardPendingSave: () => undefined,
          saveState: 'saved',
          issues: [],
        }}
      >
        <AccountFields account={account} index={accountIndex} />
      </PlanCtx.Provider>
    </MemoryRouter>
  )
  act(() => {
    root!.render(panel)
  })
  return container
}

function controlByLabel<T extends HTMLElement = HTMLElement>(rootEl: HTMLElement, label: string): T {
  const labels = Array.from(rootEl.querySelectorAll('label'))
  const match = labels.find((el) => el.textContent?.trim() === label)
  if (!match) throw new Error(`no label "${label}"`)
  const id = match.getAttribute('for')
  if (!id) throw new Error(`label "${label}" has no for=`)
  const control = rootEl.querySelector(`[id="${id.replace(/"/g, '\\"')}"]`)
  if (!control) throw new Error(`no control for label "${label}"`)
  return control as T
}

/** Mount AccountFields with a live draft so commits can be asserted as parse-valid. */
function mountEditable(plan: Plan) {
  let current = structuredClone(plan)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const render = () => {
    const account = current.accounts[0]!
    act(() => {
      root!.render(
        <MemoryRouter>
          <PlanCtx.Provider
            value={{
              plan: current,
              update: (mutator) => {
                const draft = structuredClone(current)
                mutator(draft)
                current = draft
                render()
              },
              discardPendingSave: () => undefined,
              saveState: 'saved',
              issues: [],
            }}
          >
            <AccountFields account={account} index={0} />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
  }
  render()
  return {
    get plan() {
      return current
    },
    container: () => container!,
  }
}

function retirementAccount(overrides: Partial<Extract<Account, { type: 'traditional' }>> = {}): Extract<Account, { type: 'traditional' }> {
  return {
    type: 'traditional',
    id: 'inherited-ira',
    name: 'Inherited IRA',
    ownerPersonId: 'af-owner',
    annualReturnPct: null,
    kind: 'ira',
    balance: 100_000,
    annualContribution: 0,
    ...overrides,
  }
}

function rothAccount(overrides: Partial<Extract<Account, { type: 'roth' }>> = {}): Extract<Account, { type: 'roth' }> {
  return {
    type: 'roth',
    id: 'inherited-roth',
    name: 'Inherited Roth IRA',
    ownerPersonId: 'af-owner',
    annualReturnPct: null,
    kind: 'ira',
    balance: 100_000,
    annualContribution: 0,
    ...overrides,
  }
}

function renderIssues(plan: Plan, issues: string[]) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      <PlanCtx.Provider value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'invalid', issues }}>
        <Issues />
      </PlanCtx.Provider>,
    )
  })
}

function warningText(): string | null {
  return container?.textContent?.includes(TAX_EXEMPT_ALLOCATION_DOUBLE_COUNT_WARNING) ? TAX_EXEMPT_ALLOCATION_DOUBLE_COUNT_WARNING : null
}

describe('AccountFields tax-exempt interest double-count warning', () => {
  it('warns when allocation is set, tax-exempt yield is entered, and interest yield is blank', () => {
    renderFields(
      planWithAccount(
        taxableAccount({
          allocation: { mode: 'static', rebalancing: 'annual', weights: { ...EVEN_START_WEIGHTS } },
          taxExemptInterestYieldPct: 3,
          interestYieldPct: undefined,
        }),
      ),
    )
    expect(warningText()).toBe(TAX_EXEMPT_ALLOCATION_DOUBLE_COUNT_WARNING)
  })

  it('does not warn when interest yield override is set to 0', () => {
    renderFields(
      planWithAccount(
        taxableAccount({
          allocation: { mode: 'static', rebalancing: 'annual', weights: { ...EVEN_START_WEIGHTS } },
          taxExemptInterestYieldPct: 3,
          interestYieldPct: 0,
        }),
      ),
    )
    expect(warningText()).toBeNull()
  })

  it('does not warn when interest yield override is set to a positive value', () => {
    renderFields(
      planWithAccount(
        taxableAccount({
          allocation: { mode: 'static', rebalancing: 'annual', weights: { ...EVEN_START_WEIGHTS } },
          taxExemptInterestYieldPct: 3,
          interestYieldPct: 1.5,
        }),
      ),
    )
    expect(warningText()).toBeNull()
  })

  it('does not warn when allocation is absent', () => {
    renderFields(
      planWithAccount(
        taxableAccount({
          taxExemptInterestYieldPct: 3,
          interestYieldPct: undefined,
        }),
      ),
    )
    expect(warningText()).toBeNull()
  })
})

describe('AccountFields inherited beneficiary details', () => {
  it('labels traditional inherited enable as Inherited account without universal 10-year copy', () => {
    renderFields(planWithAccount(retirementAccount()))

    expect(container?.textContent).toContain('Inherited account')
    expect(container?.textContent).not.toContain('Inherited account (10-year rule)')
    expect(container?.textContent).toContain('distribution schedule depends on the beneficiary facts')
  })

  it('keeps legacy inherited accounts on the optional planning-estimate path', () => {
    renderFields(planWithAccount(retirementAccount({ inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: false } })))

    expect(container?.textContent).toContain('Use beneficiary details')
    expect(container?.textContent).toContain('simpler planning estimate')
    expect(container?.textContent).not.toContain('Eligible designated beneficiary category')
  })

  it('shows designated-beneficiary facts and spouse-only election controls when the facts are present', () => {
    renderFields(planWithAccount(retirementAccount({
      inherited: {
        ownerDeathYear: 2024,
        decedentHadStartedRmds: true,
        beneficiary: {
          beneficiaryClass: 'designated-individual',
          edbCategory: 'surviving-spouse',
          beneficiaryBirthYear: 1965,
          soleBeneficiary: true,
          election: 'treat-as-own',
          treatAsOwnElectionYear: 2025,
          spouseUnlimitedWithdrawalRight: true,
          provenance: { source: 'custodian statement', asOf: '2026-08-08' },
        },
      },
    })))

    expect(container?.textContent).toContain('Eligible designated beneficiary category')
    expect(container?.textContent).toContain('Treat-as-own election year')
    expect(container?.textContent).toContain('Spouse has unlimited withdrawal right')
    expect(container?.textContent).toContain('Owner\'s year-of-death RMD was satisfied')
  })

  it('opens the required beneficiary panel for inherited Roth accounts and includes Roth-specific evidence', () => {
    renderFields(planWithAccount(rothAccount({
      inherited: {
        ownerDeathYear: 2024,
        decedentHadStartedRmds: false,
        beneficiary: {
          beneficiaryClass: 'estate',
          roth5YearStartYear: 2010,
          provenance: { source: 'custodian statement', asOf: '2026-08-08' },
        },
      },
    })))

    expect(container?.textContent).toContain('Inherited Roth accounts need beneficiary details')
    expect(container?.textContent).toContain('Roth 5-year start year')
    expect(container?.textContent).not.toContain('Owner had started RMDs')
  })

  it('surfaces a contradictory beneficiary fact through the shared validation display', () => {
    const plan = planWithAccount(retirementAccount({
      inherited: {
        ownerDeathYear: 2024,
        decedentHadStartedRmds: false,
        beneficiary: {
          beneficiaryClass: 'designated-individual',
          edbCategory: 'minor-child',
          beneficiaryBirthYear: 1990,
          soleBeneficiary: true,
          provenance: { source: 'custodian statement', asOf: '2026-08-08' },
        },
      },
    }))
    plan.accounts[0]!.ownerPersonId = plan.household.people[0]!.id
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) throw new Error('expected a contradictory beneficiary fact')

    renderIssues(plan, parsed.issues)
    expect(container?.textContent).toContain("edbCategory 'minor-child' is contradicted by beneficiaryBirthYear")
    expect(container?.textContent).toContain('correct beneficiaryBirthYear, ownerDeathYear, or edbCategory')
  })

  it('clears treatAsOwnElectionYear when the election leaves treat-as-own (parse-valid)', () => {
    const plan = planWithAccount(retirementAccount({
      ownerPersonId: 'af-owner',
      inherited: {
        ownerDeathYear: 2024,
        decedentHadStartedRmds: true,
        beneficiary: {
          beneficiaryClass: 'designated-individual',
          edbCategory: 'surviving-spouse',
          beneficiaryBirthYear: 1965,
          soleBeneficiary: true,
          election: 'treat-as-own',
          treatAsOwnElectionYear: 2025,
          spouseUnlimitedWithdrawalRight: true,
          ownerBirthYear: 1945,
          ownerYearOfDeathRmdSatisfied: true,
          provenance: { source: 'user-entered', asOf: '2026-08-08' },
        },
      },
    }))
    plan.accounts[0]!.ownerPersonId = plan.household.people[0]!.id
    const mounted = mountEditable(plan)

    act(() => {
      const select = controlByLabel<HTMLSelectElement>(mounted.container(), 'Distribution election')
      select.value = 'remain-beneficiary'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const account = mounted.plan.accounts[0]!
    expect(account.type).toBe('traditional')
    if (account.type !== 'traditional') throw new Error('expected traditional')
    expect(account.inherited?.beneficiary?.election).toBe('remain-beneficiary')
    expect(account.inherited?.beneficiary?.treatAsOwnElectionYear).toBeUndefined()
    expect(account.inherited?.beneficiary?.spouseUnlimitedWithdrawalRight).toBeUndefined()
    const parsed = parsePlan(structuredClone(mounted.plan))
    expect(parsed.ok).toBe(true)
  })

  it('clears election and treatAsOwnElectionYear when the EDB category changes (parse-valid)', () => {
    const plan = planWithAccount(retirementAccount({
      inherited: {
        ownerDeathYear: 2024,
        decedentHadStartedRmds: true,
        beneficiary: {
          beneficiaryClass: 'designated-individual',
          edbCategory: 'surviving-spouse',
          beneficiaryBirthYear: 1965,
          soleBeneficiary: true,
          election: 'treat-as-own',
          treatAsOwnElectionYear: 2025,
          spouseUnlimitedWithdrawalRight: true,
          ownerBirthYear: 1945,
          ownerYearOfDeathRmdSatisfied: true,
          provenance: { source: 'user-entered', asOf: '2026-08-08' },
        },
      },
    }))
    plan.accounts[0]!.ownerPersonId = plan.household.people[0]!.id
    const mounted = mountEditable(plan)

    act(() => {
      const select = controlByLabel<HTMLSelectElement>(
        mounted.container(),
        'Eligible designated beneficiary category',
      )
      select.value = 'disabled'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const account = mounted.plan.accounts[0]!
    expect(account.type).toBe('traditional')
    if (account.type !== 'traditional') throw new Error('expected traditional')
    expect(account.inherited?.beneficiary?.edbCategory).toBe('disabled')
    expect(account.inherited?.beneficiary?.election).toBeUndefined()
    expect(account.inherited?.beneficiary?.treatAsOwnElectionYear).toBeUndefined()
    expect(account.inherited?.beneficiary?.spouseUnlimitedWithdrawalRight).toBeUndefined()
    const parsed = parsePlan(structuredClone(mounted.plan))
    expect(parsed.ok).toBe(true)
  })

  it('clears spouseUnlimitedWithdrawalRight when the EDB category leaves surviving-spouse (parse-valid)', () => {
    const plan = planWithAccount(retirementAccount({
      inherited: {
        ownerDeathYear: 2024,
        decedentHadStartedRmds: true,
        beneficiary: {
          beneficiaryClass: 'designated-individual',
          edbCategory: 'surviving-spouse',
          beneficiaryBirthYear: 1965,
          soleBeneficiary: true,
          election: 'treat-as-own',
          treatAsOwnElectionYear: 2025,
          spouseUnlimitedWithdrawalRight: true,
          ownerBirthYear: 1945,
          ownerYearOfDeathRmdSatisfied: true,
          provenance: { source: 'user-entered', asOf: '2026-08-08' },
        },
      },
    }))
    plan.accounts[0]!.ownerPersonId = plan.household.people[0]!.id
    const mounted = mountEditable(plan)

    act(() => {
      const select = controlByLabel<HTMLSelectElement>(
        mounted.container(),
        'Eligible designated beneficiary category',
      )
      // 'disabled' keeps the fixture parse-coherent: a 1965-born beneficiary
      // cannot be a minor child of a 2024 decedent (parse rejects age >= 22).
      select.value = 'disabled'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const account = mounted.plan.accounts[0]!
    expect(account.inherited?.beneficiary?.edbCategory).toBe('disabled')
    expect(account.inherited?.beneficiary?.spouseUnlimitedWithdrawalRight).toBeUndefined()
    expect(account.inherited?.beneficiary?.election).toBeUndefined()
    expect(account.inherited?.beneficiary?.treatAsOwnElectionYear).toBeUndefined()
    const parsed = parsePlan(structuredClone(mounted.plan))
    expect(parsed.ok).toBe(true)
  })

  it('records soleBeneficiary false when several beneficiaries are selected (parse-valid)', () => {
    const plan = planWithAccount(retirementAccount({
      ownerPersonId: 'af-owner',
      inherited: {
        ownerDeathYear: 2024,
        decedentHadStartedRmds: false,
        beneficiary: {
          beneficiaryClass: 'designated-individual',
          edbCategory: 'none',
          beneficiaryBirthYear: 1970,
          provenance: { source: 'user-entered', asOf: '2026-08-08' },
        },
      },
    }))
    plan.accounts[0]!.ownerPersonId = plan.household.people[0]!.id
    const mounted = mountEditable(plan)

    act(() => {
      const select = controlByLabel<HTMLSelectElement>(mounted.container(), 'Sole beneficiary')
      select.value = 'false'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const account = mounted.plan.accounts[0]!
    expect(account.inherited?.beneficiary?.soleBeneficiary).toBe(false)
    const parsed = parsePlan(structuredClone(mounted.plan))
    expect(parsed.ok).toBe(true)
  })

  it('clears ownerYearOfDeathRmdSatisfied when decedentHadStartedRmds is toggled off (parse-valid)', () => {
    const plan = planWithAccount(retirementAccount({
      inherited: {
        ownerDeathYear: 2024,
        decedentHadStartedRmds: true,
        beneficiary: {
          beneficiaryClass: 'designated-individual',
          edbCategory: 'surviving-spouse',
          beneficiaryBirthYear: 1965,
          soleBeneficiary: true,
          election: 'remain-beneficiary',
          ownerBirthYear: 1945,
          ownerYearOfDeathRmdSatisfied: true,
          provenance: { source: 'user-entered', asOf: '2026-08-08' },
        },
      },
    }))
    plan.accounts[0]!.ownerPersonId = plan.household.people[0]!.id
    const mounted = mountEditable(plan)

    act(() => {
      const box = controlByLabel<HTMLInputElement>(mounted.container(), 'Owner had started RMDs')
      box.click()
    })

    const account = mounted.plan.accounts[0]!
    expect(account.type).toBe('traditional')
    if (account.type !== 'traditional') throw new Error('expected traditional')
    expect(account.inherited?.decedentHadStartedRmds).toBe(false)
    expect(account.inherited?.beneficiary?.ownerYearOfDeathRmdSatisfied).toBeUndefined()
    const parsed = parsePlan(structuredClone(mounted.plan))
    expect(parsed.ok).toBe(true)
  })
})

describe('localCalendarDateIso', () => {
  it('uses the local calendar date, not UTC from toISOString', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T02:00:00Z'))
    const utcDate = new Date().toISOString().slice(0, 10)
    const localDate = localCalendarDateIso()
    expect(localDate).not.toBe(utcDate)
    expect(localDate).toBe(
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
    )
    vi.useRealTimers()
  })
})

describe('AccountFields inherited Roth contributions', () => {
  it('clears contributions and hides contribution inputs when inherited is enabled on a Roth account', () => {
    const plan = planWithAccount(rothAccount({
      annualContribution: 7_000,
      contributionSchedule: [{ annualAmount: 7_000, fromAge: null, toAge: null, escalationPct: 0 }],
    }))
    const mounted = mountEditable(plan)

    // The contribution controls may render collapsed at mount; the load-bearing
    // behavior is that enabling inherited clears the stored amounts and shows
    // the hint while no contribution control remains labeled on the panel.
    act(() => {
      const box = controlByLabel<HTMLInputElement>(mounted.container(), 'Inherited Roth account')
      box.click()
    })

    const account = mounted.plan.accounts[0]!
    expect(account.type).toBe('roth')
    if (account.type !== 'roth') throw new Error('expected roth')
    expect(account.inherited).toBeDefined()
    expect(account.annualContribution).toBe(0)
    expect(account.contributionSchedule).toBeUndefined()
    expect(mounted.container().textContent).toContain('Inherited accounts cannot receive contributions.')
    const labelTexts = Array.from(mounted.container().querySelectorAll('label'))
      .map((label) => label.textContent ?? '')
    expect(labelTexts.some((text) => text.includes('Annual contribution'))).toBe(false)
    expect(labelTexts.some((text) => text.includes('Schedule contributions over time'))).toBe(false)
  })
})
