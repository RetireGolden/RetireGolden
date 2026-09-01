/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '@retiregolden/engine/model/plan'

import {
  ANNUITY_MIN_START_AGE,
  PENSION_MAX_START_AGE,
  PENSION_MIN_START_AGE,
} from '../../accountStartAgeBounds'
import { PlanCtx } from '../planContextCore'
import { AccountFields } from './AccountFields'
import { EVEN_START_WEIGHTS, TAX_EXEMPT_ALLOCATION_DOUBLE_COUNT_WARNING, localCalendarDateIso } from './sectionHelpers'
import { Issues } from './shared'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  vi.useRealTimers()
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

function inheritedOf(account: Account) {
  if (account.type !== 'traditional' && account.type !== 'roth') throw new Error('expected a retirement account')
  return account.inherited
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
    expect(inheritedOf(account)?.beneficiary?.election).toBe('remain-beneficiary')
    expect(inheritedOf(account)?.beneficiary?.treatAsOwnElectionYear).toBeUndefined()
    expect(inheritedOf(account)?.beneficiary?.spouseUnlimitedWithdrawalRight).toBeUndefined()
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
    expect(inheritedOf(account)?.beneficiary?.edbCategory).toBe('disabled')
    expect(inheritedOf(account)?.beneficiary?.election).toBeUndefined()
    expect(inheritedOf(account)?.beneficiary?.treatAsOwnElectionYear).toBeUndefined()
    expect(inheritedOf(account)?.beneficiary?.spouseUnlimitedWithdrawalRight).toBeUndefined()
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
    expect(inheritedOf(account)?.beneficiary?.edbCategory).toBe('disabled')
    expect(inheritedOf(account)?.beneficiary?.spouseUnlimitedWithdrawalRight).toBeUndefined()
    expect(inheritedOf(account)?.beneficiary?.election).toBeUndefined()
    expect(inheritedOf(account)?.beneficiary?.treatAsOwnElectionYear).toBeUndefined()
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
    expect(inheritedOf(account)?.beneficiary?.soleBeneficiary).toBe(false)
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
    expect(inheritedOf(account)?.decedentHadStartedRmds).toBe(false)
    expect(inheritedOf(account)?.beneficiary?.ownerYearOfDeathRmdSatisfied).toBeUndefined()
    const parsed = parsePlan(structuredClone(mounted.plan))
    expect(parsed.ok).toBe(true)
  })

  it('clears ten-year-election when decedentHadStartedRmds is toggled on (parse-valid)', () => {
    const plan = planWithAccount(retirementAccount({
      inherited: {
        ownerDeathYear: 2024,
        decedentHadStartedRmds: false,
        beneficiary: {
          beneficiaryClass: 'designated-individual',
          edbCategory: 'disabled',
          beneficiaryBirthYear: 1970,
          soleBeneficiary: true,
          election: 'ten-year-election',
          ownerBirthYear: 1945,
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
    expect(inheritedOf(account)?.decedentHadStartedRmds).toBe(true)
    expect(inheritedOf(account)?.beneficiary?.election).toBeUndefined()
    const parsed = parsePlan(structuredClone(mounted.plan))
    expect(parsed.ok).toBe(true)
  })

  it('does not offer ten-year-election when decedentHadStartedRmds is true', () => {
    renderFields(planWithAccount(retirementAccount({
      inherited: {
        ownerDeathYear: 2024,
        decedentHadStartedRmds: true,
        beneficiary: {
          beneficiaryClass: 'designated-individual',
          edbCategory: 'surviving-spouse',
          beneficiaryBirthYear: 1965,
          soleBeneficiary: false,
          ownerBirthYear: 1945,
          ownerYearOfDeathRmdSatisfied: true,
          provenance: { source: 'user-entered', asOf: '2026-08-08' },
        },
      },
    })))

    const select = controlByLabel<HTMLSelectElement>(container!, 'Distribution election')
    const labels = Array.from(select.options).map((option) => option.label)
    expect(labels).toContain('Remain beneficiary')
    expect(labels).not.toContain('Elect 10-year rule')
  })

  it('clears treat-as-own and dependent facts when sole beneficiary becomes false (parse-valid)', () => {
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
      const select = controlByLabel<HTMLSelectElement>(mounted.container(), 'Sole beneficiary')
      select.value = 'false'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const account = mounted.plan.accounts[0]!
    expect(inheritedOf(account)?.beneficiary?.soleBeneficiary).toBe(false)
    expect(inheritedOf(account)?.beneficiary?.election).toBeUndefined()
    expect(inheritedOf(account)?.beneficiary?.treatAsOwnElectionYear).toBeUndefined()
    expect(inheritedOf(account)?.beneficiary?.spouseUnlimitedWithdrawalRight).toBeUndefined()
    const parsed = parsePlan(structuredClone(mounted.plan))
    expect(parsed.ok).toBe(true)
  })

  it('does not offer treat-as-own when the spouse is not the sole beneficiary', () => {
    renderFields(planWithAccount(retirementAccount({
      inherited: {
        ownerDeathYear: 2024,
        decedentHadStartedRmds: true,
        beneficiary: {
          beneficiaryClass: 'designated-individual',
          edbCategory: 'surviving-spouse',
          beneficiaryBirthYear: 1965,
          soleBeneficiary: false,
          ownerBirthYear: 1945,
          ownerYearOfDeathRmdSatisfied: true,
          provenance: { source: 'user-entered', asOf: '2026-08-08' },
        },
      },
    })))

    const select = controlByLabel<HTMLSelectElement>(container!, 'Distribution election')
    const labels = Array.from(select.options).map((option) => option.label)
    expect(labels).toContain('Remain beneficiary')
    expect(labels).not.toContain('Treat as own IRA')
  })

  it('preserves class-independent beneficiary facts when beneficiary class changes (parse-valid)', () => {
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
          ownerBirthMonth: 6,
          ownerBirthDay: 15,
          ownerYearOfDeathRmdSatisfied: true,
          provenance: { source: 'custodian statement', asOf: '2026-08-08' },
        },
      },
    }))
    plan.accounts[0]!.ownerPersonId = plan.household.people[0]!.id
    const mounted = mountEditable(plan)

    act(() => {
      const select = controlByLabel<HTMLSelectElement>(mounted.container(), 'Beneficiary class')
      select.value = 'estate'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const beneficiary = inheritedOf(mounted.plan.accounts[0]!)?.beneficiary
    expect(beneficiary?.beneficiaryClass).toBe('estate')
    expect(beneficiary?.ownerBirthYear).toBe(1945)
    expect(beneficiary?.ownerBirthMonth).toBe(6)
    expect(beneficiary?.ownerBirthDay).toBe(15)
    expect(beneficiary?.ownerYearOfDeathRmdSatisfied).toBe(true)
    expect(beneficiary?.provenance).toEqual({ source: 'custodian statement', asOf: '2026-08-08' })
    expect(beneficiary?.edbCategory).toBeUndefined()
    expect(beneficiary?.beneficiaryBirthYear).toBeUndefined()
    expect(beneficiary?.soleBeneficiary).toBeUndefined()
    expect(beneficiary?.election).toBeUndefined()
    expect(beneficiary?.treatAsOwnElectionYear).toBeUndefined()
    expect(beneficiary?.spouseUnlimitedWithdrawalRight).toBeUndefined()
    const parsed = parsePlan(structuredClone(mounted.plan))
    expect(parsed.ok).toBe(true)
  })

  it('shows a workplace hint instead of beneficiary details for inherited employer accounts', () => {
    renderFields(planWithAccount(retirementAccount({
      kind: 'employer',
      inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: false },
    })))

    expect(container?.querySelector('[data-testid="inherited-employer-hint"]')?.textContent).toBe(
      'Beneficiary details apply to inherited IRAs. Inherited workplace plans stay on the simpler planning estimate.',
    )
    expect(container?.querySelector('[data-testid="beneficiary-details-panel"]')).toBeNull()
    expect(container?.textContent).not.toContain('Use beneficiary details')
  })

  it('shows beneficiary details for inherited Roth employer accounts with the workplace note', () => {
    const plan = planWithAccount(rothAccount({
      kind: 'employer',
      inherited: {
        ownerDeathYear: 2024,
        decedentHadStartedRmds: false,
        beneficiary: {
          beneficiaryClass: 'designated-individual',
          edbCategory: 'none',
          beneficiaryBirthYear: 1985,
          soleBeneficiary: true,
          roth5YearStartYear: 2015,
          provenance: { source: 'user-entered', asOf: '2026-08-08' },
        },
      },
    }))
    plan.accounts[0]!.ownerPersonId = plan.household.people[0]!.id
    renderFields(plan)

    expect(container?.querySelector('[data-testid="inherited-roth-employer-hint"]')?.textContent).toBe(
      'Workplace-plan schedules are not modeled; this account uses the simpler planning estimate, and these facts are kept for review.',
    )
    expect(container?.querySelector('[data-testid="beneficiary-details-panel"]')).not.toBeNull()
    expect(container?.textContent).toContain('Roth 5-year start year')
    const parsed = parsePlan(structuredClone(plan))
    expect(parsed.ok).toBe(true)
  })

  it('hides contribution basis for inherited Roth accounts and clears it when inherited is enabled', () => {
    const plan = planWithAccount(rothAccount({ contributionBasis: 25_000 }))
    const mounted = mountEditable(plan)

    expect(mounted.container().textContent).toContain('Contribution basis')
    expect(mounted.container().querySelector('[data-testid="inherited-roth-contribution-basis-hint"]')).toBeNull()

    act(() => {
      const box = controlByLabel<HTMLInputElement>(mounted.container(), 'Inherited Roth account')
      box.click()
    })

    const account = mounted.plan.accounts[0]!
    expect(account.type).toBe('roth')
    if (account.type !== 'roth') throw new Error('expected roth')
    expect(account.contributionBasis).toBeUndefined()
    expect(mounted.container().textContent).not.toContain('Contribution basis')
    expect(mounted.container().querySelector('[data-testid="inherited-roth-contribution-basis-hint"]')?.textContent).toBe(
      'The model does not use contribution basis on an inherited Roth; its withdrawals are modeled untaxed with the five-year caution below.',
    )
  })

  it('clears sepp when inherited is enabled on a traditional account (parse-valid)', () => {
    const plan = planWithAccount(retirementAccount({
      sepp: { startAge: 55, method: 'rmd' },
    }))
    plan.accounts[0]!.ownerPersonId = plan.household.people[0]!.id
    const mounted = mountEditable(plan)

    expect(mounted.container().textContent).toContain('72(t) SEPP')

    act(() => {
      const box = controlByLabel<HTMLInputElement>(mounted.container(), 'Inherited account')
      box.click()
    })

    const account = mounted.plan.accounts[0]!
    expect(account.type).toBe('traditional')
    if (account.type !== 'traditional') throw new Error('expected traditional')
    expect(inheritedOf(account)).toBeDefined()
    expect(account.sepp).toBeUndefined()
    expect(mounted.container().textContent).not.toContain('72(t) SEPP')
    const parsed = parsePlan(structuredClone(mounted.plan))
    expect(parsed.ok).toBe(true)
  })

  it('shows the five-year caution for a recent Roth start year but not an old one', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T12:00:00Z'))

    const recentRoot = renderFields(planWithAccount(rothAccount({
      inherited: {
        ownerDeathYear: 2024,
        decedentHadStartedRmds: false,
        beneficiary: {
          beneficiaryClass: 'designated-individual',
          edbCategory: 'none',
          beneficiaryBirthYear: 1985,
          soleBeneficiary: true,
          roth5YearStartYear: 2024,
          provenance: { source: 'user-entered', asOf: '2026-08-08' },
        },
      },
    })))
    expect(recentRoot.querySelector('[data-testid="roth-five-year-incomplete-hint"]')?.textContent).toContain(
      'The five-year period may not be complete',
    )

    if (root) act(() => root!.unmount())
    container?.remove()
    root = null
    container = null

    const oldStartRoot: HTMLElement = renderFields(planWithAccount(rothAccount({
      inherited: {
        ownerDeathYear: 2024,
        decedentHadStartedRmds: false,
        beneficiary: {
          beneficiaryClass: 'designated-individual',
          edbCategory: 'none',
          beneficiaryBirthYear: 1985,
          soleBeneficiary: true,
          roth5YearStartYear: 2010,
          provenance: { source: 'user-entered', asOf: '2026-08-08' },
        },
      },
    })))
    expect(oldStartRoot.querySelector('[data-testid="roth-five-year-incomplete-hint"]')).toBeNull()

    vi.useRealTimers()
  })
})

describe('localCalendarDateIso', () => {
  it('uses the local calendar date, not UTC from toISOString', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T02:00:00Z'))
    const now = new Date()
    const localDate = localCalendarDateIso()
    expect(localDate).toBe(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
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
    expect(inheritedOf(account)).toBeDefined()
    expect(account.annualContribution).toBe(0)
    expect(account.contributionSchedule).toBeUndefined()
    expect(mounted.container().textContent).toContain('Inherited accounts cannot receive contributions.')
    const labelTexts = Array.from(mounted.container().querySelectorAll('label'))
      .map((label) => label.textContent ?? '')
    expect(labelTexts.some((text) => text.includes('Annual contribution'))).toBe(false)
    expect(labelTexts.some((text) => text.includes('Schedule contributions over time'))).toBe(false)
  })
})

describe('AccountFields inherited traditional treat-as-own contributions', () => {
  it('clears contributions and hides contribution inputs when treat-as-own is elected', () => {
    const plan = planWithAccount(retirementAccount({
      annualContribution: 7_000,
      contributionSchedule: [{ annualAmount: 7_000, fromAge: null, toAge: null, escalationPct: 0 }],
      inherited: {
        ownerDeathYear: 2024,
        decedentHadStartedRmds: true,
        beneficiary: {
          beneficiaryClass: 'designated-individual',
          edbCategory: 'surviving-spouse',
          beneficiaryBirthYear: 1965,
          soleBeneficiary: true,
          election: 'remain-beneficiary',
          provenance: { source: 'user-entered', asOf: '2026-08-08' },
        },
      },
    }))
    const mounted = mountEditable(plan)

    act(() => {
      const select = controlByLabel<HTMLSelectElement>(mounted.container(), 'Distribution election')
      select.value = 'treat-as-own'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const account = mounted.plan.accounts[0]!
    expect(account.type).toBe('traditional')
    if (account.type !== 'traditional') throw new Error('expected traditional')
    expect(inheritedOf(account)?.beneficiary?.election).toBe('treat-as-own')
    expect(account.annualContribution).toBe(0)
    expect(account.contributionSchedule).toBeUndefined()
    expect(mounted.container().textContent).toContain('Inherited accounts cannot receive contributions.')
    const labelTexts = Array.from(mounted.container().querySelectorAll('label'))
      .map((label) => label.textContent ?? '')
    expect(labelTexts.some((text) => text.includes('Annual contribution'))).toBe(false)
    expect(labelTexts.some((text) => text.includes('Schedule contributions over time'))).toBe(false)
  })
})

describe('prior-year FICA wages (414(v)(7) Box 3 proxy)', () => {
  it('shows the Box 3 field on an employer 401(k) and not on an IRA', () => {
    renderFields(planWithAccount(retirementAccount({
      id: 'k',
      name: '401k',
      kind: 'employer',
      annualContribution: 24_500,
    })))
    expect(container?.textContent).toContain('Prior-year FICA wages (Box 3)')
    expect(container?.textContent).toContain('if this same person has no Roth employer account of their own')
    expect(container?.textContent).not.toContain('if this household has no Roth employer account')

    if (root) act(() => root!.unmount())
    container?.remove()
    root = null
    container = null

    const iraContainer = renderFields(planWithAccount(retirementAccount({
      id: 'ira',
      name: 'IRA',
      kind: 'ira',
      annualContribution: 7_500,
    })))
    expect(iraContainer.textContent).not.toContain('Prior-year FICA wages (Box 3)')
  })

  it('displays the one-cent-over Box 3 boundary instead of rounding to whole dollars', () => {
    renderFields(planWithAccount(retirementAccount({
      id: 'k',
      name: '401k',
      kind: 'employer',
      annualContribution: 24_500,
      priorCalendarYearFicaWages: 150_000.01,
    })))
    const input = controlByLabel<HTMLInputElement>(container!, 'Prior-year FICA wages (Box 3)')
    expect(input.value).toBe('150,000.01')
    expect(input.value).not.toBe('150,000')
  })
})

describe('AccountFields property and debt editor boundaries', () => {
  it('renders property-specific fields without debt fields', () => {
    const property: Extract<Account, { type: 'property' }> = {
      type: 'property',
      id: 'home',
      name: 'Home',
      ownerPersonId: null,
      annualReturnPct: null,
      value: 500_000,
      plannedSaleYear: null,
      expectedNetProceeds: null,
    }

    const fields = renderFields(planWithAccount(property))

    expect(controlByLabel(fields, 'Value')).toBeTruthy()
    expect(controlByLabel(fields, 'Model a HECM line of credit')).toBeTruthy()
    expect(() => controlByLabel(fields, 'Interest rate')).toThrow('no label "Interest rate"')
  })

  it('renders debt-specific fields without property fields', () => {
    const debt: Extract<Account, { type: 'debt' }> = {
      type: 'debt',
      id: 'mortgage',
      name: 'Mortgage',
      ownerPersonId: null,
      annualReturnPct: null,
      balance: 250_000,
      interestPct: 4,
      monthlyPayment: 1_500,
    }

    const fields = renderFields(planWithAccount(debt))

    expect(controlByLabel(fields, 'Balance owed')).toBeTruthy()
    expect(controlByLabel(fields, 'Interest rate')).toBeTruthy()
    expect(controlByLabel(fields, 'Monthly payment')).toBeTruthy()
    expect(controlByLabel(fields, 'Lump-sum payoff year')).toBeTruthy()
    expect(() => controlByLabel(fields, 'Value')).toThrow('no label "Value"')
  })
})

describe('AccountFields pension and annuity editor boundaries', () => {
  it('keeps compatibility bounds aligned with the pension schema', () => {
    const pension: Extract<Account, { type: 'pension' }> = {
      type: 'pension',
      id: 'pension',
      name: 'Pension',
      ownerPersonId: 'placeholder',
      annualReturnPct: null,
      startAge: 65,
      monthlyAmount: 2_000,
      colaPct: 0,
      survivorPct: 50,
    }
    const plan = planWithAccount(pension)
    plan.accounts[0]!.ownerPersonId = plan.household.people[0]!.id
    const accepts = (startAge: number) => {
      const candidate = structuredClone(plan)
      const account = candidate.accounts[0]
      if (account?.type !== 'pension') throw new Error('expected pension')
      account.startAge = startAge
      return parsePlan(candidate).ok
    }

    expect(accepts(PENSION_MIN_START_AGE)).toBe(true)
    expect(accepts(PENSION_MAX_START_AGE)).toBe(true)
    expect(accepts(PENSION_MIN_START_AGE - 1)).toBe(false)
    expect(accepts(PENSION_MAX_START_AGE + 1)).toBe(false)
  })

  it('keeps the compatibility minimum aligned with the annuity schema', () => {
    const annuity: Extract<Account, { type: 'annuity' }> = {
      type: 'annuity',
      id: 'annuity',
      name: 'Annuity',
      ownerPersonId: 'placeholder',
      annualReturnPct: null,
      startAge: 65,
      monthlyAmount: 1_500,
      colaPct: 0,
      taxablePct: 60,
    }
    const plan = planWithAccount(annuity)
    plan.accounts[0]!.ownerPersonId = plan.household.people[0]!.id
    const accepts = (startAge: number) => {
      const candidate = structuredClone(plan)
      const account = candidate.accounts[0]
      if (account?.type !== 'annuity') throw new Error('expected annuity')
      account.startAge = startAge
      return parsePlan(candidate).ok
    }

    expect(accepts(ANNUITY_MIN_START_AGE)).toBe(true)
    expect(accepts(ANNUITY_MIN_START_AGE - 1)).toBe(false)
  })

  it('renders pension-specific fields without annuity purchase fields', () => {
    const pension: Extract<Account, { type: 'pension' }> = {
      type: 'pension',
      id: 'pension',
      name: 'Pension',
      ownerPersonId: 'af-owner',
      annualReturnPct: null,
      startAge: 65,
      monthlyAmount: 2_000,
      colaPct: 0,
      survivorPct: 50,
    }

    const fields = renderFields(planWithAccount(pension))

    const labels = Array.from(fields.querySelectorAll('label')).map((label) => label.textContent?.trim())
    expect(controlByLabel(fields, 'Pension source')).toBeTruthy()
    expect(labels.indexOf('Pension source')).toBeLessThan(labels.indexOf('Start age'))
    expect(controlByLabel<HTMLInputElement>(fields, 'Start age').max).toBe(String(PENSION_MAX_START_AGE))
    expect(controlByLabel(fields, 'Monthly amount')).toBeTruthy()
    expect(controlByLabel(fields, 'COLA')).toBeTruthy()
    expect(controlByLabel(fields, 'Survivor benefit')).toBeTruthy()
    expect(controlByLabel(fields, 'Lump-sum offer on record')).toBeTruthy()
    expect(() => controlByLabel(fields, 'Model a purchase event')).toThrow('no label "Model a purchase event"')
  })

  it('renders annuity-specific fields without pension election fields', () => {
    const annuity: Extract<Account, { type: 'annuity' }> = {
      type: 'annuity',
      id: 'annuity',
      name: 'Annuity',
      ownerPersonId: 'af-owner',
      annualReturnPct: null,
      startAge: 70,
      monthlyAmount: 1_500,
      colaPct: 0,
      taxablePct: 60,
    }

    const fields = renderFields(planWithAccount(annuity))

    expect(controlByLabel<HTMLInputElement>(fields, 'Start age').max).toBe('95')
    expect(controlByLabel(fields, 'Monthly amount')).toBeTruthy()
    expect(controlByLabel(fields, 'COLA')).toBeTruthy()
    expect(controlByLabel(fields, 'Payout form')).toBeTruthy()
    expect(controlByLabel(fields, 'Model a purchase event')).toBeTruthy()
    expect(() => controlByLabel(fields, 'Lump-sum offer on record')).toThrow('no label "Lump-sum offer on record"')
  })
})

describe('AccountFields extracted editor commit wiring', () => {
  it.each([
    ['below', '20', 40],
    ['above', '95', 80],
  ])('clamps a manually entered pension start age %s the schema range (parse-valid)', (_boundary, typed, expected) => {
    const pension: Extract<Account, { type: 'pension' }> = {
      type: 'pension',
      id: 'pension',
      name: 'Pension',
      ownerPersonId: 'placeholder',
      annualReturnPct: null,
      startAge: 65,
      monthlyAmount: 2_000,
      colaPct: 0,
      survivorPct: 50,
    }
    const plan = planWithAccount(pension)
    plan.accounts[0]!.ownerPersonId = plan.household.people[0]!.id
    const mounted = mountEditable(plan)
    const startAge = controlByLabel<HTMLInputElement>(mounted.container(), 'Start age')

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      if (!valueSetter) throw new Error('missing input value setter')
      valueSetter.call(startAge, typed)
      startAge.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const account = mounted.plan.accounts[0]
    expect(account?.type).toBe('pension')
    if (account?.type !== 'pension') throw new Error('expected pension')
    expect(account.startAge).toBe(expected)
    expect(parsePlan(structuredClone(mounted.plan)).ok).toBe(true)
  })

  it.each([
    ['below', '20', 40],
    ['above', '97', 95],
  ])('clamps a manually entered unpurchased annuity start age %s the schema range (parse-valid)', (_boundary, typed, expected) => {
    const annuity: Extract<Account, { type: 'annuity' }> = {
      type: 'annuity',
      id: 'annuity',
      name: 'Annuity',
      ownerPersonId: 'placeholder',
      annualReturnPct: null,
      startAge: 65,
      monthlyAmount: 1_000,
      colaPct: 0,
      taxablePct: 50,
    }
    const plan = planWithAccount(annuity)
    plan.accounts[0]!.ownerPersonId = plan.household.people[0]!.id
    const mounted = mountEditable(plan)
    const startAge = controlByLabel<HTMLInputElement>(mounted.container(), 'Start age')

    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      if (!valueSetter) throw new Error('missing input value setter')
      valueSetter.call(startAge, typed)
      startAge.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const account = mounted.plan.accounts[0]
    expect(account?.type).toBe('annuity')
    if (account?.type !== 'annuity') throw new Error('expected annuity')
    expect(account.startAge).toBe(expected)
    expect(parsePlan(structuredClone(mounted.plan)).ok).toBe(true)
  })

  it('enables a HECM and marks the property as a primary residence (parse-valid)', () => {
    const property: Extract<Account, { type: 'property' }> = {
      type: 'property',
      id: 'home',
      name: 'Home',
      ownerPersonId: null,
      annualReturnPct: null,
      value: 500_000,
      plannedSaleYear: null,
      expectedNetProceeds: null,
    }
    const mounted = mountEditable(planWithAccount(property))

    act(() => {
      controlByLabel<HTMLInputElement>(mounted.container(), 'Model a HECM line of credit').click()
    })

    const account = mounted.plan.accounts[0]
    expect(account?.type).toBe('property')
    if (account?.type !== 'property') throw new Error('expected property')
    expect(account.primaryResidence).toBe(true)
    expect(account.hecm?.drawPolicy).toBe('lastResort')
    expect(parsePlan(structuredClone(mounted.plan)).ok).toBe(true)
  })

  it('revives a historical pension offer year when the lump sum is elected (parse-valid)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T12:00:00Z'))
    const pension: Extract<Account, { type: 'pension' }> = {
      type: 'pension',
      id: 'pension',
      name: 'Pension',
      ownerPersonId: 'placeholder',
      annualReturnPct: null,
      startAge: 65,
      monthlyAmount: 2_000,
      colaPct: 0,
      survivorPct: 50,
      lumpSumOffer: { amount: 200_000, electionYear: 2020 },
    }
    const plan = planWithAccount(pension)
    const ownerId = plan.household.people[0]!.id
    plan.updatedAtIso = '2030-01-02T00:00:00.000Z'
    plan.accounts[0]!.ownerPersonId = ownerId
    plan.accounts.push(retirementAccount({ id: 'rollover', name: 'Rollover IRA', ownerPersonId: ownerId }))
    const mounted = mountEditable(plan)
    const election = controlByLabel<HTMLSelectElement>(mounted.container(), 'Election')

    act(() => {
      election.value = 'lumpSum'
      election.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const account = mounted.plan.accounts[0]
    expect(account?.type).toBe('pension')
    if (account?.type !== 'pension') throw new Error('expected pension')
    expect(account.lumpSumOffer?.electionYear).toBe(2030)
    expect(account.lumpSumElection?.rolloverAccountId).toBe('rollover')
    expect(parsePlan(structuredClone(mounted.plan)).ok).toBe(true)
  })

  it('clamps a qualified annuity start age when its owner changes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T12:00:00Z'))
    const annuity: Extract<Account, { type: 'annuity' }> = {
      type: 'annuity',
      id: 'annuity',
      name: 'Deferred annuity',
      ownerPersonId: 'placeholder',
      annualReturnPct: null,
      startAge: 90,
      monthlyAmount: 1_500,
      colaPct: 0,
      taxablePct: 100,
      purchase: {
        year: 2026,
        premium: 100_000,
        fundingAccountId: 'funding',
        taxQualification: 'qualified',
      },
    }
    const plan = planWithAccount(annuity)
    const olderOwner = plan.household.people[0]!
    olderOwner.dob = '1930-01-01'
    const youngerOwner = { ...olderOwner, id: 'younger', name: 'Younger owner', dob: '1970-01-01' }
    plan.household.people.push(youngerOwner)
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.accounts[0]!.ownerPersonId = olderOwner.id
    plan.accounts.push(retirementAccount({ id: 'funding', name: 'Funding IRA', ownerPersonId: olderOwner.id }))
    const mounted = mountEditable(plan)
    const owner = controlByLabel<HTMLSelectElement>(mounted.container(), 'Owner')

    act(() => {
      owner.value = youngerOwner.id
      owner.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const account = mounted.plan.accounts[0]
    expect(account?.type).toBe('annuity')
    if (account?.type !== 'annuity') throw new Error('expected annuity')
    expect(account.ownerPersonId).toBe(youngerOwner.id)
    expect(account.startAge).toBe(76)
  })

  it('retargets a qualified annuity away from an inherited IRA', () => {
    const annuity: Extract<Account, { type: 'annuity' }> = {
      type: 'annuity',
      id: 'annuity',
      name: 'Annuity',
      ownerPersonId: 'placeholder',
      annualReturnPct: null,
      startAge: 65,
      monthlyAmount: 1_000,
      colaPct: 0,
      taxablePct: 50,
      purchase: {
        year: 2026,
        premium: 100_000,
        fundingAccountId: 'cash',
        taxQualification: 'nonQualified',
      },
    }
    const plan = planWithAccount(annuity)
    const ownerId = plan.household.people[0]!.id
    plan.accounts[0]!.ownerPersonId = ownerId
    plan.accounts.push(
      retirementAccount({
        id: 'inherited',
        name: 'Inherited IRA',
        ownerPersonId: ownerId,
        inherited: { ownerDeathYear: 2025, decedentHadStartedRmds: false },
      }),
      retirementAccount({ id: 'owned', name: 'Owned IRA', ownerPersonId: ownerId }),
      {
        type: 'cash',
        id: 'cash',
        name: 'Cash',
        ownerPersonId: null,
        annualReturnPct: null,
        balance: 150_000,
        annualContribution: 0,
      },
    )
    const mounted = mountEditable(plan)
    const qualification = controlByLabel<HTMLSelectElement>(mounted.container(), 'Tax qualification')

    act(() => {
      qualification.value = 'qualified'
      qualification.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const account = mounted.plan.accounts[0]
    expect(account?.type).toBe('annuity')
    if (account?.type !== 'annuity') throw new Error('expected annuity')
    expect(account.purchase?.taxQualification).toBe('qualified')
    expect(account.purchase?.fundingAccountId).toBe('owned')
  })
})
