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
import {
  applyRefresh,
  buildRefreshDelta,
  classifyRefresh,
  type RefreshCandidate,
  type RefreshClassification,
} from './refresh'

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

/** Wrap loose candidates in a classification (with an optional protected snapshot) for buildRefreshDelta. */
function classified(candidates: RefreshCandidate[], protectedPaths: readonly string[] = []): RefreshClassification {
  return { candidates, protectedPaths }
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
    const { candidates: [c] } = classifyRefresh(plan, [src('Brokerage ...789', 55_000, 40_000)])
    expect(c!.match).toBe('exact')
    expect(c!.targetAccountId).toBe('acct-brokerage')
    expect(c!.targetPath).toBe('accounts[0]')
    expect(c!.alternativeAccountIds).toEqual([])
  })

  it('keeps descriptive parentheticals — "(Joint)" is name content, "(Z12345678)" is a mask', () => {
    // Alone in the plan, the joint account is an exact label-equals-name match
    // once the mask (and only the mask) is stripped.
    const solo = planWith(loadedTaxable('acct-joint', 'Brokerage (Joint)'))
    const { candidates: [exact] } = classifyRefresh(solo, [src('Brokerage (Joint) (Z12345678)', 55_000, 40_000)])
    expect(exact!.match).toBe('exact')
    expect(exact!.targetAccountId).toBe('acct-joint')

    // Next to a plain "Brokerage" account the verdict is ambiguous (two
    // plausible accounts, default OFF) — but the JOINT account is the primary
    // suggestion. Pre-fix, "(joint)" was stripped as if it were a mask and the
    // WRONG account (plain Brokerage) won the equality match.
    const both = planWith(loadedTaxable('acct-joint', 'Brokerage (Joint)'), loadedTaxable('acct-solo', 'Brokerage'))
    const { candidates: [c] } = classifyRefresh(both, [src('Brokerage (Joint) (Z12345678)', 55_000, 40_000)])
    expect(c!.match).toBe('ambiguous')
    expect(c!.targetAccountId).toBe('acct-joint')
    expect(c!.alternativeAccountIds).toContain('acct-solo')
  })

  it('grades a clamped single-position value derived, never exact', () => {
    // max(0, -x) is a transformation, not a verbatim copy — the audit record
    // must not claim exact fidelity for a floored value.
    const plan = planWith(loadedTaxable('acct-brokerage', 'Brokerage'))
    const { candidates } = classifyRefresh(plan, [src('Brokerage ...789', -500, null, 1)])
    const selection = new Map([[0, 'acct-brokerage']])
    const delta = buildRefreshDelta(plan, classified(candidates), selection)
    const mapped = delta.review.find((r) => r.status === 'mapped')!
    expect(mapped.confidence).toBe('derived')
    expect(delta.changes[0]).toMatchObject({ field: 'balance', after: 0, clamped: true })
  })

  it('snapshots an empty protected set as [] when none is supplied', () => {
    const plan = planWith(loadedTaxable('acct-brokerage', 'Brokerage'))
    const classification = classifyRefresh(plan, [src('Brokerage ...789', 55_000, 40_000)])
    expect(classification.protectedPaths).toEqual([])
  })

  it('matches a single shared-word hit as likely', () => {
    const plan = planWith(loadedTaxable('acct-ind', 'Individual Brokerage'))
    const { candidates: [c] } = classifyRefresh(plan, [src('Individual ...789', 25_000, 15_000)])
    expect(c!.match).toBe('likely')
    expect(c!.targetAccountId).toBe('acct-ind')
  })

  it('keeps digits in names — "401k" never collapses to a stray letter that false-matches', () => {
    // The digit-strip regression: "401k" → "k" would whole-name-match inside
    // "brokerage" and silently pre-select overwriting the 401k from an
    // unrelated Brokerage row. Digits are name content and must survive.
    const plan = planWith(loadedTaxable('acct-401k', '401k'))
    const { candidates: [c] } = classifyRefresh(plan, [src('Brokerage ...789', 40_000, null)])
    expect(c!.match).toBe('unmatched')
    expect(c!.targetAccountId).toBeNull()
    // …while a file row that actually names the 401k still matches it.
    const { candidates: [hit] } = classifyRefresh(plan, [src('My 401k ...123', 40_000, null)])
    expect(hit!.match).toBe('exact')
    expect(hit!.targetAccountId).toBe('acct-401k')
  })

  it('never defaults ON a plan account whose whole name is a lone generic word', () => {
    // An account literally named "IRA": a Roth IRA file row proves only the
    // family, so the whole-name substring hit must stay default-off.
    const plan = createEmptyPlan({ newId: nextId })
    const owner = ownerId(plan)
    plan.accounts.push(traditional('acct-ira', 'IRA', owner))
    const { candidates: [c] } = classifyRefresh(plan, [src('Roth IRA ...321', 14_000, null)])
    expect(c!.match).toBe('ambiguous')
    expect(c!.targetAccountId).toBe('acct-ira') // suggested, not pre-selected
  })

  it('does NOT confuse Roth IRA with Rollover IRA — ambiguous, alternatives listed, not merged', () => {
    const plan = createEmptyPlan({ newId: nextId })
    const owner = ownerId(plan)
    plan.accounts.push(roth('acct-roth', 'Roth IRA', owner), traditional('acct-rollover', 'Rollover IRA', owner))

    const { candidates: [c] } = classifyRefresh(plan, [src('Roth IRA ...321', 14_000)])
    expect(c!.match).toBe('ambiguous')
    // The whole-name hit is the sensible primary IF the user turns the row on…
    expect(c!.targetAccountId).toBe('acct-roth')
    // …but Rollover IRA is recorded as the plausible runner-up, so nothing merges silently.
    expect(c!.alternativeAccountIds).toContain('acct-rollover')

    // Ambiguous rows default OFF: with no selection, nothing is written.
    const delta = buildRefreshDelta(plan, classified(c ? [c] : []), new Map())
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

    const { candidates: [c] } = classifyRefresh(plan, [src('Roth IRA ...321', 14_000)])
    expect(c!.match).toBe('ambiguous')
    // The best guess is still offered for one-click confirmation…
    expect(c!.targetAccountId).toBe('acct-rollover')
    // …but there is no other IRA here, so no runner-up, and — crucially — with
    // nothing selected (ambiguous defaults OFF), nothing is written.
    expect(c!.alternativeAccountIds).toEqual([])
    const delta = buildRefreshDelta(plan, classified(c ? [c] : []), new Map())
    expect(delta.changes).toEqual([])
  })

  it('treats a lone SEP-vs-Traditional shared-"IRA" hit as ambiguous too (confusable pair)', () => {
    // A second confusable pair, to show the demotion is about the category word,
    // not hard-coded to Roth/Rollover: plan has a SEP IRA, file lists a
    // Traditional IRA. They cross-match only on "IRA".
    const plan = createEmptyPlan({ newId: nextId })
    const owner = ownerId(plan)
    plan.accounts.push(traditional('acct-sep', 'SEP IRA', owner))

    const { candidates: [c] } = classifyRefresh(plan, [src('Traditional IRA ...9', 30_000)])
    expect(c!.match).toBe('ambiguous')
    expect(c!.targetAccountId).toBe('acct-sep')
    expect(c!.alternativeAccountIds).toEqual([])
  })

  it('still defaults ON a lone match on a distinctive (non-category) word', () => {
    // Guard the demotion is narrow: "Individual" is distinctive, not a category
    // word, so a lone shared-"Individual" hit stays 'likely' (default ON).
    const plan = planWith(loadedTaxable('acct-ind', 'Individual Brokerage'))
    const { candidates: [c] } = classifyRefresh(plan, [src('Individual ...789', 25_000, 15_000)])
    expect(c!.match).toBe('likely')
    expect(c!.targetAccountId).toBe('acct-ind')
  })

  it('reports an updatable plan account absent from the file as stale', () => {
    const plan = createEmptyPlan({ newId: nextId })
    const owner = ownerId(plan)
    plan.accounts.push(loadedTaxable('acct-brokerage', 'Brokerage'), roth('acct-roth', 'Roth IRA', owner))

    const classification = classifyRefresh(plan, [src('Brokerage ...789', 55_000, 40_000)])
    const delta = buildRefreshDelta(plan, classification, new Map([[0, 'acct-brokerage']]))
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

    const classification = classifyRefresh(plan, [src('Brokerage ...789', 99_000, 50_000)])
    // Classification puts the row on acct-brokerage; the user overrides onto the HSA.
    const selection = new Map([[0, 'acct-hsa']])
    const delta = buildRefreshDelta(plan, classification, selection)

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
    const classification = classifyRefresh(plan, [src('Home ...1', 550_000), src('Mortgage ...2', 190_000)])
    expect(classification.candidates.every((c) => c.match === 'unmatched' && c.targetAccountId === null)).toBe(true)

    // Even a hand-forced selection cannot write a non-updatable account.
    const delta = buildRefreshDelta(plan, classification, new Map([[0, 'acct-home']]))
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
    const classification = classifyRefresh(plan, [src('Big Brokerage ...9', 130_000, 75_000)])
    const selection = new Map([[0, 'acct-tax']])
    const delta = buildRefreshDelta(plan, classification, selection)
    const applied = applyRefresh(plan, delta, selection)

    expect(applied).toBe(1)
    // Everything the user configured survives; only the two money fields move.
    expect(plan.accounts[0]).toEqual({ ...before, balance: 130_000, costBasis: 75_000 })
  })

  it('leaves cost basis untouched when the file carried none (Vanguard)', () => {
    const account = loadedTaxable('acct-tax', 'Big Brokerage')
    const before = structuredClone(account)
    const plan = planWith(account)
    const classification = classifyRefresh(plan, [src('Big Brokerage ...9', 130_000, null)])
    const selection = new Map([[0, 'acct-tax']])
    const delta = buildRefreshDelta(plan, classification, selection)
    applyRefresh(plan, delta, selection)

    // basis stays at the original 60,000; the delta shows no basis change.
    expect(plan.accounts[0]).toEqual({ ...before, balance: 130_000 })
    expect(delta.changes.some((c) => c.field === 'costBasis')).toBe(false)
  })

  it('grades a single-position aggregate as exact and does not claim summation', () => {
    // A verbatim single-position read must not be labelled 'derived', and its
    // locator note must not claim a summation that never happened.
    const plan = planWith(loadedTaxable('acct-tax', 'Big Brokerage'))
    const classification = classifyRefresh(plan, [src('Big Brokerage ...9', 130_000, 75_000, 1)])
    const selection = new Map([[0, 'acct-tax']])
    const delta = buildRefreshDelta(plan, classification, selection)
    const mapped = delta.review.find((r) => r.status === 'mapped')!
    expect(mapped.confidence).toBe('exact')
    expect(mapped.locator).toMatchObject({ note: 'balance read from the single broker position' })

    // A multi-position aggregate is summed and grades 'derived' (plural wording).
    const multi = buildRefreshDelta(
      planWith(loadedTaxable('acct-tax', 'Big Brokerage')),
      classifyRefresh(plan, [src('Big Brokerage ...9', 130_000, 75_000, 3)]),
      selection,
    )
    const mappedMulti = multi.review.find((r) => r.status === 'mapped')!
    expect(mappedMulti.confidence).toBe('derived')
    expect(mappedMulti.locator).toMatchObject({ note: 'balance summed from the broker positions file' })
  })

  it('clamps negative totals and negative basis to $0 and flags them clamped', () => {
    const account = loadedTaxable('acct-tax', 'Margin')
    const plan = planWith(account)
    const classification = classifyRefresh(plan, [src('Margin ...9', -5_000, -1_000)])
    const selection = new Map([[0, 'acct-tax']])
    const delta = buildRefreshDelta(plan, classification, selection)
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
    const classification = classifyRefresh(plan, [src('Roth IRA ...321', 14_000, 12_000)])
    const selection = new Map([[0, 'acct-roth']])
    const delta = buildRefreshDelta(plan, classification, selection)
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
    const classification = classifyRefresh(plan, [src('Statement A ...1', 10_000, 8_000), src('Statement B ...2', 20_000, 15_000)])
    // Force both onto the same plan account.
    const selection = new Map([
      [0, 'acct-brokerage'],
      [1, 'acct-brokerage'],
    ])
    const delta = buildRefreshDelta(plan, classification, selection)

    expect(delta.duplicateGroups).toEqual([{ accountId: 'acct-brokerage', sourceIndexes: [0, 1] }])
    expect(delta.changes).toEqual([]) // blocked, never a last-write-wins merge
    expect(delta.review.some((r) => r.status === 'skipped' && r.detail.includes('at most once'))).toBe(true)

    const applied = applyRefresh(plan, delta, selection)
    expect(applied).toBe(0)
    expect(plan.accounts[0]).toMatchObject({ balance: 100_000 }) // unchanged
  })

  it('blocks the ENTIRE apply when any collision exists — a unique row alongside it is not written', () => {
    // Headless parity with the panel's block-everything gate: a single duplicate
    // group makes applyRefresh a full no-op, so even the collision-free row that
    // would otherwise apply lands nothing.
    const plan = planWith(
      loadedTaxable('acct-a', 'Alpha'),
      loadedTaxable('acct-b', 'Bravo'),
    )
    const classification = classifyRefresh(plan, [
      src('Alpha ...1', 11_000, 9_000), // unique → acct-a
      src('Bravo one ...2', 22_000, 15_000), // collision → acct-b
      src('Bravo two ...3', 33_000, 20_000), // collision → acct-b
    ])
    const selection = new Map([
      [0, 'acct-a'],
      [1, 'acct-b'],
      [2, 'acct-b'],
    ])
    const delta = buildRefreshDelta(plan, classification, selection)
    expect(delta.duplicateGroups).toEqual([{ accountId: 'acct-b', sourceIndexes: [1, 2] }])
    // The preview agrees with the full no-op: no change may claim it will land,
    // not even for the collision-free row.
    expect(delta.changes).toEqual([])

    const applied = applyRefresh(plan, delta, selection)
    expect(applied).toBe(0)
    expect(plan.accounts[0]).toMatchObject({ balance: 100_000 }) // the unique row's target, untouched
    expect(plan.accounts[1]).toMatchObject({ balance: 100_000 })
  })
})

describe('protectedTargets', () => {
  it('marks a protected candidate isProtected and skips it entirely on apply', () => {
    const plan = planWith(loadedTaxable('acct-brokerage', 'Brokerage'), loadedTaxable('acct-other', 'Other'))
    const protectedTargets = new Set(['accounts[0]'])
    const classification = classifyRefresh(plan, [src('Brokerage ...789', 55_000, 40_000)], { protectedTargets })
    expect(classification.candidates[0]!.isProtected).toBe(true)
    expect(classification.protectedPaths).toEqual(['accounts[0]'])

    const selection = new Map([[0, 'acct-brokerage']])
    const delta = buildRefreshDelta(plan, classification, selection, protectedTargets)
    // Preview shows it as a skip, not a change.
    expect(delta.changes).toEqual([])
    expect(delta.review.some((r) => r.status === 'skipped' && r.detail.includes('protected'))).toBe(true)

    const applied = applyRefresh(plan, delta, selection, protectedTargets)
    expect(applied).toBe(0)
    expect(plan.accounts[0]).toMatchObject({ balance: 100_000 }) // untouched
  })

  it('keeps a classified-protected candidate skipped even when apply is not handed the set', () => {
    // Belt-and-suspenders: a caller who threads protectedTargets into
    // classifyRefresh but forgets it at build/apply time must not write the
    // account — the classification's protectedPaths snapshot carries it forward.
    const plan = planWith(loadedTaxable('acct-brokerage', 'Brokerage'))
    const protectedTargets = new Set(['accounts[0]'])
    const classification = classifyRefresh(plan, [src('Brokerage ...789', 55_000, 40_000)], { protectedTargets })
    expect(classification.candidates[0]!.isProtected).toBe(true)
    const selection = new Map([[0, 'acct-brokerage']])
    const delta = buildRefreshDelta(plan, classification, selection) // set omitted
    const applied = applyRefresh(plan, delta, selection) // set omitted
    expect(applied).toBe(0)
    expect(plan.accounts[0]).toMatchObject({ balance: 100_000 })
  })

  it('protects a manually reassigned target when the set was supplied to classify ONLY (P1)', () => {
    // The P1 regression: an UNMATCHED file row (so isProtected is false — the
    // per-candidate carry-forward does nothing here) is hand-pointed by the user
    // onto a protected account. Only classify saw the protected set; build and
    // apply are handed nothing. The classification's protectedPaths snapshot is
    // the sole thing standing between the reassignment and a write — and it must
    // hold, so nothing is written.
    const plan = planWith(loadedTaxable('acct-open', 'Brokerage'), loadedTaxable('acct-secret', 'Vault'))
    const protectedTargets = new Set(['accounts[1]']) // acct-secret is off-limits
    const classification = classifyRefresh(plan, [src('Unmatched Holdings ...1', 88_000, 40_000)], { protectedTargets })
    const [candidate] = classification.candidates
    expect(candidate!.match).toBe('unmatched') // nothing auto-matched it
    expect(candidate!.isProtected).toBe(false) // so no per-candidate carry-forward
    expect(classification.protectedPaths).toEqual(['accounts[1]'])

    // The user overrides the unmatched row onto the protected account.
    const selection = new Map([[0, 'acct-secret']])
    const delta = buildRefreshDelta(plan, classification, selection) // set omitted at build
    expect(delta.changes).toEqual([]) // preview already shows nothing lands
    const applied = applyRefresh(plan, delta, selection) // set omitted at apply
    expect(applied).toBe(0)
    expect(plan.accounts[1]).toMatchObject({ balance: 100_000 }) // untouched

    // Control: the identical manual reassignment with NO protected set anywhere
    // does write — proving protection, not some other guard, is what stopped it.
    const openPlan = planWith(loadedTaxable('acct-open', 'Brokerage'), loadedTaxable('acct-secret', 'Vault'))
    const openClass = classifyRefresh(openPlan, [src('Unmatched Holdings ...1', 88_000, 40_000)])
    const openDelta = buildRefreshDelta(openPlan, openClass, new Map([[0, 'acct-secret']]))
    expect(applyRefresh(openPlan, openDelta, new Map([[0, 'acct-secret']]))).toBe(1)
    expect(openPlan.accounts[1]).toMatchObject({ balance: 88_000 })
  })

  it('protects a single field path (accounts[i].balance), and applies normally without the set', () => {
    const plan = planWith(loadedTaxable('acct-brokerage', 'Brokerage'))
    const fieldProtected = new Set(['accounts[0].balance'])
    const { candidates: [protectedCandidate] } = classifyRefresh(plan, [src('Brokerage ...789', 55_000, 40_000)], { protectedTargets: fieldProtected })
    expect(protectedCandidate!.isProtected).toBe(true)

    // Control: the identical refresh with no protected set does apply.
    const classification = classifyRefresh(plan, [src('Brokerage ...789', 55_000, 40_000)])
    const selection = new Map([[0, 'acct-brokerage']])
    const applied = applyRefresh(plan, buildRefreshDelta(plan, classification, selection), selection)
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
    const classification = classifyRefresh(plan, [
      src('Brokerage ...1', 55_000, 40_000),
      src('Roth IRA ...2', 14_000, 12_000),
      src('Margin ...3', -3_000, 9_000), // clamped balance, real basis
    ])
    const selection = new Map([
      [0, 'acct-brokerage'],
      [1, 'acct-roth'],
      [2, 'acct-margin'],
    ])
    const delta = buildRefreshDelta(plan, classification, selection)
    expect(delta.changes.length).toBeGreaterThan(0)

    applyRefresh(plan, delta, selection)
    for (const change of delta.changes) {
      expect(readPath(plan, change.path), change.path).toBe(change.after)
    }
  })
})
