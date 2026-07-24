/**
 * Broker-refresh engine suite (WS4). Fixtures are hand-built plan accounts and
 * parsed broker aggregates; expected values are chosen by hand, never read back
 * from the engine's own output. The load-bearing claims: the classifier does
 * not confuse "Roth IRA" with "Rollover IRA", a balance-only refresh leaves
 * every strategy field byte-identical, protected targets are untouched, and the
 * preview a caller renders is exactly what apply writes.
 */

import { describe, expect, it } from 'vitest'

import { createEmptyPlan, type Account, type Plan } from '@retiregolden/engine/model/plan'
import type { BrokerAccountBalance } from './brokerCsv'
import { applyRefresh, buildRefreshDelta, classifyRefresh } from './refresh'

let seq = 0
const nextId = () => `p-${++seq}`

function planWith(...accounts: Account[]): Plan {
  const plan = createEmptyPlan({ newId: nextId })
  plan.accounts.push(...accounts)
  return plan
}

function ownerId(plan: Plan): string {
  return plan.household.people[0]!.id
}

function src(accountLabel: string, totalValue: number, costBasis: number | null = null, positionCount = 2): BrokerAccountBalance {
  return { accountLabel, totalValue, costBasis, positionCount }
}

/** A taxable account carrying every strategy field the refresh must not touch. */
function loadedTaxable(id: string, name: string): Account {
  return {
    id,
    type: 'taxable',
    name,
    ownerPersonId: null,
    annualReturnPct: 6.5,
    estateBeneficiary: { destination: 'charity', charityPct: 40 },
    balance: 100_000,
    costBasis: 60_000,
    interestYieldPct: 1.2,
    dividendYieldPct: 1.8,
    qualifiedRatio: 0.9,
    reinvestDividends: true,
    allocation: { mode: 'static', rebalancing: 'annual', weights: { usStocks: 60, intlStocks: 20, bonds: 15, cash: 5 } },
    annualContribution: 12_000,
    contributionSchedule: [{ annualAmount: 12_000, fromAge: 50, toAge: 65, escalationPct: 2 }],
  }
}

function roth(id: string, name: string, owner: string): Account {
  return { id, type: 'roth', name, kind: 'ira', ownerPersonId: owner, annualReturnPct: null, balance: 5_000, annualContribution: 0 }
}

function traditional(id: string, name: string, owner: string): Account {
  return { id, type: 'traditional', name, kind: 'ira', ownerPersonId: owner, annualReturnPct: null, balance: 5_000, annualContribution: 0 }
}

/** Read a plan field addressed by a `RefreshFieldDelta.path` (`accounts[i].field`). */
function readPath(plan: Plan, path: string): number {
  const m = /^accounts\[(\d+)\]\.(balance|costBasis)$/.exec(path)!
  const account = plan.accounts[Number(m[1])]! as Account & Record<string, number>
  return account[m[2]!]!
}

describe('classifyRefresh — matching', () => {
  it('matches a single whole-name hit as exact', () => {
    const plan = planWith(loadedTaxable('acct-brokerage', 'Brokerage'))
    const [c] = classifyRefresh(plan, [src('Brokerage ...789', 55_000, 40_000)])
    expect(c!.match).toBe('exact')
    expect(c!.targetAccountId).toBe('acct-brokerage')
    expect(c!.targetPath).toBe('accounts[0]')
    expect(c!.alternativeAccountIds).toEqual([])
  })

  it('matches a single shared-word hit as likely', () => {
    const plan = planWith(loadedTaxable('acct-ind', 'Individual Brokerage'))
    const [c] = classifyRefresh(plan, [src('Individual ...789', 25_000, 15_000)])
    expect(c!.match).toBe('likely')
    expect(c!.targetAccountId).toBe('acct-ind')
  })

  it('does NOT confuse Roth IRA with Rollover IRA — ambiguous, alternatives listed, not merged', () => {
    const plan = createEmptyPlan({ newId: nextId })
    const owner = ownerId(plan)
    plan.accounts.push(roth('acct-roth', 'Roth IRA', owner), traditional('acct-rollover', 'Rollover IRA', owner))

    const [c] = classifyRefresh(plan, [src('Roth IRA ...321', 14_000)])
    expect(c!.match).toBe('ambiguous')
    // The whole-name hit is the sensible primary IF the user turns the row on…
    expect(c!.targetAccountId).toBe('acct-roth')
    // …but Rollover IRA is recorded as the plausible runner-up, so nothing merges silently.
    expect(c!.alternativeAccountIds).toContain('acct-rollover')

    // Ambiguous rows default OFF: with no selection, nothing is written.
    const delta = buildRefreshDelta(plan, c ? [c] : [], new Map())
    expect(delta.changes).toEqual([])
  })

  it('does NOT default-ON a lone shared-"IRA" match when only one IRA is in the plan', () => {
    // The asymmetric returning-user case: the plan holds a Rollover IRA and the
    // broker file lists a Roth IRA the user hasn't added yet. They share only
    // the category word "IRA" — which fits every IRA subtype — so promoting this
    // to a default-ON 'likely' would silently overwrite the Rollover balance
    // with the Roth number. It must come back ambiguous and default OFF.
    const plan = createEmptyPlan({ newId: nextId })
    const owner = ownerId(plan)
    plan.accounts.push(traditional('acct-rollover', 'Rollover IRA', owner))

    const [c] = classifyRefresh(plan, [src('Roth IRA ...321', 14_000)])
    expect(c!.match).toBe('ambiguous')
    // The best guess is still offered for one-click confirmation…
    expect(c!.targetAccountId).toBe('acct-rollover')
    // …but there is no other IRA here, so no runner-up, and — crucially — with
    // nothing selected (ambiguous defaults OFF), nothing is written.
    expect(c!.alternativeAccountIds).toEqual([])
    const delta = buildRefreshDelta(plan, c ? [c] : [], new Map())
    expect(delta.changes).toEqual([])
  })

  it('treats a lone SEP-vs-Traditional shared-"IRA" hit as ambiguous too (confusable pair)', () => {
    // A second confusable pair, to show the demotion is about the category word,
    // not hard-coded to Roth/Rollover: plan has a SEP IRA, file lists a
    // Traditional IRA. They cross-match only on "IRA".
    const plan = createEmptyPlan({ newId: nextId })
    const owner = ownerId(plan)
    plan.accounts.push(traditional('acct-sep', 'SEP IRA', owner))

    const [c] = classifyRefresh(plan, [src('Traditional IRA ...9', 30_000)])
    expect(c!.match).toBe('ambiguous')
    expect(c!.targetAccountId).toBe('acct-sep')
    expect(c!.alternativeAccountIds).toEqual([])
  })

  it('still defaults ON a lone match on a distinctive (non-category) word', () => {
    // Guard the demotion is narrow: "Individual" is distinctive, not a category
    // word, so a lone shared-"Individual" hit stays 'likely' (default ON).
    const plan = planWith(loadedTaxable('acct-ind', 'Individual Brokerage'))
    const [c] = classifyRefresh(plan, [src('Individual ...789', 25_000, 15_000)])
    expect(c!.match).toBe('likely')
    expect(c!.targetAccountId).toBe('acct-ind')
  })

  it('reports an updatable plan account absent from the file as stale', () => {
    const plan = createEmptyPlan({ newId: nextId })
    const owner = ownerId(plan)
    plan.accounts.push(loadedTaxable('acct-brokerage', 'Brokerage'), roth('acct-roth', 'Roth IRA', owner))

    const candidates = classifyRefresh(plan, [src('Brokerage ...789', 55_000, 40_000)])
    const delta = buildRefreshDelta(plan, candidates, new Map([[0, 'acct-brokerage']]))
    expect(delta.staleAccountIds).toContain('acct-roth')
    expect(delta.staleAccountIds).not.toContain('acct-brokerage')
  })

  it('does not list an account as stale when a row is manually reassigned onto it', () => {
    // 'Health Savings' shares no word with any file row, so classification never
    // matches it — the classic "going stale" case. But the user hand-points the
    // Brokerage row at it. Because it is now being written, it must NOT also be
    // reported as stale: 'stale accounts are listed but never modified' has to
    // hold under manual override, not just for the auto-classification.
    const plan = createEmptyPlan({ newId: nextId })
    const owner = ownerId(plan)
    const hsa: Account = { id: 'acct-hsa', type: 'hsa', name: 'Health Savings', ownerPersonId: owner, annualReturnPct: null, balance: 4_000, annualContribution: 0 }
    plan.accounts.push(loadedTaxable('acct-brokerage', 'Brokerage'), hsa)

    const candidates = classifyRefresh(plan, [src('Brokerage ...789', 99_000, 50_000)])
    // Classification puts the row on acct-brokerage; the user overrides onto the HSA.
    const selection = new Map([[0, 'acct-hsa']])
    const delta = buildRefreshDelta(plan, candidates, selection)

    expect(delta.staleAccountIds).not.toContain('acct-hsa')
    // And the override really does write it — the classification list would
    // otherwise have called a modified account stale.
    const applied = applyRefresh(plan, delta, selection)
    expect(applied).toBe(1)
    expect(plan.accounts.find((a) => a.id === 'acct-hsa')).toMatchObject({ balance: 99_000 })
  })

  it('never classifies property or debt as a refresh target', () => {
    const plan = planWith(
      { id: 'acct-home', type: 'property', name: 'Home', ownerPersonId: null, annualReturnPct: null, value: 500_000, plannedSaleYear: null, expectedNetProceeds: null },
      { id: 'acct-loan', type: 'debt', name: 'Mortgage', ownerPersonId: null, annualReturnPct: null, balance: 200_000, interestPct: 5, monthlyPayment: 1_500 },
    )
    const candidates = classifyRefresh(plan, [src('Home ...1', 550_000), src('Mortgage ...2', 190_000)])
    expect(candidates.every((c) => c.match === 'unmatched' && c.targetAccountId === null)).toBe(true)

    // Even a hand-forced selection cannot write a non-updatable account.
    const delta = buildRefreshDelta(plan, candidates, new Map([[0, 'acct-home']]))
    expect(delta.changes).toEqual([])
    const applied = applyRefresh(plan, delta, new Map([[0, 'acct-home']]))
    expect(applied).toBe(0)
    expect(plan.accounts[0]).toMatchObject({ value: 500_000 })
  })
})

describe('applyRefresh — the structural acceptance', () => {
  it('refreshes balance and basis only, leaving every strategy field byte-identical', () => {
    const account = loadedTaxable('acct-tax', 'Big Brokerage')
    const before = structuredClone(account)
    const plan = planWith(account)
    const candidates = classifyRefresh(plan, [src('Big Brokerage ...9', 130_000, 75_000)])
    const selection = new Map([[0, 'acct-tax']])
    const delta = buildRefreshDelta(plan, candidates, selection)
    const applied = applyRefresh(plan, delta, selection)

    expect(applied).toBe(1)
    // Everything the user configured survives; only the two money fields move.
    expect(plan.accounts[0]).toEqual({ ...before, balance: 130_000, costBasis: 75_000 })
  })

  it('leaves cost basis untouched when the file carried none (Vanguard)', () => {
    const account = loadedTaxable('acct-tax', 'Big Brokerage')
    const before = structuredClone(account)
    const plan = planWith(account)
    const candidates = classifyRefresh(plan, [src('Big Brokerage ...9', 130_000, null)])
    const selection = new Map([[0, 'acct-tax']])
    const delta = buildRefreshDelta(plan, candidates, selection)
    applyRefresh(plan, delta, selection)

    // basis stays at the original 60,000; the delta shows no basis change.
    expect(plan.accounts[0]).toEqual({ ...before, balance: 130_000 })
    expect(delta.changes.some((c) => c.field === 'costBasis')).toBe(false)
  })

  it('clamps negative totals and negative basis to $0 and flags them clamped', () => {
    const account = loadedTaxable('acct-tax', 'Margin')
    const plan = planWith(account)
    const candidates = classifyRefresh(plan, [src('Margin ...9', -5_000, -1_000)])
    const selection = new Map([[0, 'acct-tax']])
    const delta = buildRefreshDelta(plan, candidates, selection)
    applyRefresh(plan, delta, selection)

    expect(plan.accounts[0]).toMatchObject({ balance: 0, costBasis: 0 })
    const balanceDelta = delta.changes.find((c) => c.field === 'balance')!
    expect(balanceDelta).toMatchObject({ after: 0, clamped: true })
    const basisDelta = delta.changes.find((c) => c.field === 'costBasis')!
    expect(basisDelta).toMatchObject({ after: 0, clamped: true })
  })

  it('does not touch the plan when the balance is written to a non-basis account (Roth: balance only)', () => {
    const plan = createEmptyPlan({ newId: nextId })
    const owner = ownerId(plan)
    const account = roth('acct-roth', 'Roth IRA', owner)
    const before = structuredClone(account)
    plan.accounts.push(account)
    const candidates = classifyRefresh(plan, [src('Roth IRA ...321', 14_000, 12_000)])
    const selection = new Map([[0, 'acct-roth']])
    const delta = buildRefreshDelta(plan, candidates, selection)
    applyRefresh(plan, delta, selection)

    // The file's basis is ignored on a Roth; only the balance lands, and no
    // costBasis field is invented on an account type that has none.
    expect(plan.accounts[0]).toEqual({ ...before, balance: 14_000 })
    expect('costBasis' in plan.accounts[0]!).toBe(false)
    expect(delta.changes.some((c) => c.field === 'costBasis')).toBe(false)
  })
})

describe('duplicate collisions', () => {
  it('reports two selected rows on one plan account as a duplicate group that blocks apply', () => {
    const plan = planWith(loadedTaxable('acct-brokerage', 'Brokerage'), loadedTaxable('acct-other', 'Other'))
    const candidates = classifyRefresh(plan, [src('Statement A ...1', 10_000, 8_000), src('Statement B ...2', 20_000, 15_000)])
    // Force both onto the same plan account.
    const selection = new Map([
      [0, 'acct-brokerage'],
      [1, 'acct-brokerage'],
    ])
    const delta = buildRefreshDelta(plan, candidates, selection)

    expect(delta.duplicateGroups).toEqual([{ accountId: 'acct-brokerage', sourceIndexes: [0, 1] }])
    expect(delta.changes).toEqual([]) // blocked, never a last-write-wins merge
    expect(delta.review.some((r) => r.status === 'skipped' && r.detail.includes('at most once'))).toBe(true)

    const applied = applyRefresh(plan, delta, selection)
    expect(applied).toBe(0)
    expect(plan.accounts[0]).toMatchObject({ balance: 100_000 }) // unchanged
  })
})

describe('protectedTargets', () => {
  it('marks a protected candidate isProtected and skips it entirely on apply', () => {
    const plan = planWith(loadedTaxable('acct-brokerage', 'Brokerage'), loadedTaxable('acct-other', 'Other'))
    const protectedTargets = new Set(['accounts[0]'])
    const candidates = classifyRefresh(plan, [src('Brokerage ...789', 55_000, 40_000)], { protectedTargets })
    expect(candidates[0]!.isProtected).toBe(true)

    const selection = new Map([[0, 'acct-brokerage']])
    const delta = buildRefreshDelta(plan, candidates, selection, protectedTargets)
    // Preview shows it as a skip, not a change.
    expect(delta.changes).toEqual([])
    expect(delta.review.some((r) => r.status === 'skipped' && r.detail.includes('protected'))).toBe(true)

    const applied = applyRefresh(plan, delta, selection, protectedTargets)
    expect(applied).toBe(0)
    expect(plan.accounts[0]).toMatchObject({ balance: 100_000 }) // untouched
  })

  it('keeps a classified-protected candidate skipped even when apply is not handed the set', () => {
    // Belt-and-suspenders: a caller who threads protectedTargets into
    // classifyRefresh but forgets it at apply time must not write the account.
    const plan = planWith(loadedTaxable('acct-brokerage', 'Brokerage'))
    const protectedTargets = new Set(['accounts[0]'])
    const candidates = classifyRefresh(plan, [src('Brokerage ...789', 55_000, 40_000)], { protectedTargets })
    expect(candidates[0]!.isProtected).toBe(true)
    const selection = new Map([[0, 'acct-brokerage']])
    const delta = buildRefreshDelta(plan, candidates, selection) // set omitted
    const applied = applyRefresh(plan, delta, selection) // set omitted
    expect(applied).toBe(0)
    expect(plan.accounts[0]).toMatchObject({ balance: 100_000 })
  })

  it('protects a single field path (accounts[i].balance), and applies normally without the set', () => {
    const plan = planWith(loadedTaxable('acct-brokerage', 'Brokerage'))
    const fieldProtected = new Set(['accounts[0].balance'])
    const [protectedCandidate] = classifyRefresh(plan, [src('Brokerage ...789', 55_000, 40_000)], { protectedTargets: fieldProtected })
    expect(protectedCandidate!.isProtected).toBe(true)

    // Control: the identical refresh with no protected set does apply.
    const candidates = classifyRefresh(plan, [src('Brokerage ...789', 55_000, 40_000)])
    const selection = new Map([[0, 'acct-brokerage']])
    const applied = applyRefresh(plan, buildRefreshDelta(plan, candidates, selection), selection)
    expect(applied).toBe(1)
    expect(plan.accounts[0]).toMatchObject({ balance: 55_000, costBasis: 40_000 })
  })
})

describe('preview/apply agreement', () => {
  it('buildRefreshDelta after-values equal the post-applyRefresh state for every selected candidate', () => {
    const plan = createEmptyPlan({ newId: nextId })
    const owner = ownerId(plan)
    plan.accounts.push(
      loadedTaxable('acct-brokerage', 'Brokerage'),
      roth('acct-roth', 'Roth IRA', owner),
      loadedTaxable('acct-margin', 'Margin'),
    )
    const candidates = classifyRefresh(plan, [
      src('Brokerage ...1', 55_000, 40_000),
      src('Roth IRA ...2', 14_000, 12_000),
      src('Margin ...3', -3_000, 9_000), // clamped balance, real basis
    ])
    const selection = new Map([
      [0, 'acct-brokerage'],
      [1, 'acct-roth'],
      [2, 'acct-margin'],
    ])
    const delta = buildRefreshDelta(plan, candidates, selection)
    expect(delta.changes.length).toBeGreaterThan(0)

    applyRefresh(plan, delta, selection)
    for (const change of delta.changes) {
      expect(readPath(plan, change.path), change.path).toBe(change.after)
    }
  })
})
