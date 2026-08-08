/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '@retiregolden/engine/model/plan'

import { PlanCtx } from '../planContextCore'
import { AccountFields } from './AccountFields'
import { EVEN_START_WEIGHTS, TAX_EXEMPT_ALLOCATION_DOUBLE_COUNT_WARNING } from './sectionHelpers'
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

function renderFields(plan: Plan, accountIndex = 0) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const account = plan.accounts[accountIndex]!
  const panel: ReactNode = (
    <MemoryRouter>
      <PlanCtx.Provider value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
        <AccountFields account={account} index={accountIndex} />
      </PlanCtx.Provider>
    </MemoryRouter>
  )
  act(() => {
    root!.render(panel)
  })
  return container
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
})
