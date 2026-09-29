/**
 * The as-of check: an elected pension lump sum dated before the year the plan
 * starts is refused at save, against a start year the host names (decision
 * D-2027-ROLLOVER, 2026-09-28). The derivation's U2 household: born 1961, a
 * $2,000-a-month pension from 65, a $300,000 offer elected in 2026 into a
 * $400,000 IRA, saved on 2026-10-15.
 *
 * Authority: none governs how a planner treats a past election; the rule is
 * the engine's own convention that balances are as of the start year (the
 * accounts editor's "Balances as of today") and that a rollover already
 * carried out is inside the receiving balance, so modelling it again would
 * count it twice. What the test pins is that the year judged is the start
 * year the host passes, never the save stamp, and that nothing is repaired.
 */

import { describe, expect, it } from 'vitest'

import { asOfIssues } from './asOfIssues.js'
import { migratePlanToCurrent } from './migrations.js'
import { createEmptyPlan, parsePlan, type Plan } from './plan.js'

function u2(electionYear: number, elected: boolean, updatedAtIso = '2026-10-15T12:00:00.000Z'): Plan {
  const plan = createEmptyPlan({ now: () => new Date('2026-10-15T12:00:00.000Z'), newId: (() => { let i = 0; return () => `id-${i++}` })() })
  const owner = plan.household.people[0]!
  owner.dob = '1961-03-01'
  plan.accounts = [
    { type: 'traditional', id: 'ira', name: 'Rollover IRA', ownerPersonId: owner.id, annualReturnPct: null, kind: 'ira', balance: 400_000, annualContribution: 0 },
    {
      type: 'pension', id: 'pen', name: 'Company pension', ownerPersonId: owner.id, annualReturnPct: null,
      startAge: 65, monthlyAmount: 2_000, colaPct: 0, survivorPct: 0,
      lumpSumOffer: { amount: 300_000, electionYear },
      ...(elected ? { lumpSumElection: { rolloverAccountId: 'ira' } } : {}),
    },
  ]
  const parsed = parsePlan({ ...plan, updatedAtIso })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describe('asOfIssues: an elected lump sum dated before the start year', () => {
  it('passes in the start year and later', () => {
    expect(asOfIssues(u2(2026, true), 2026)).toEqual([])
    expect(asOfIssues(u2(2027, true), 2026)).toEqual([])
  })

  it('refuses it from the next start year, at the field, naming both restatements', () => {
    expect(asOfIssues(u2(2026, true), 2027)).toEqual([
      "accounts.1.lumpSumOffer.electionYear: The lump-sum election is dated 2026, before this plan starts in 2027. If you took the lump sum, remove the pension and add the rollover to Rollover IRA's balance. If you did not, clear the election (the pension then pays) or move it to 2027 or later.",
    ])
  })

  it('judges the start year it is given, never the save stamp', () => {
    // Saved on New Year's Eve evening in New York (UTC stamp 2027-01-01): the
    // projection there still starts in 2026, so the 2026 election passes.
    expect(asOfIssues(u2(2026, true, '2027-01-01T03:00:00.000Z'), 2026)).toEqual([])
    // Saved on New Year's morning in Tokyo (UTC stamp 2026-12-31): the
    // projection there starts in 2027, so the 2026 election is refused.
    expect(asOfIssues(u2(2026, true, '2026-12-31T20:00:00.000Z'), 2027)).toHaveLength(1)
  })

  it('leaves an unelected offer alone: the pension pays and the projection says why', () => {
    expect(asOfIssues(u2(2020, false), 2027)).toEqual([])
  })

  it('is a check, never a repair: the stored plan opens as it was saved', () => {
    const stored = JSON.parse(JSON.stringify(u2(2026, true))) as unknown
    const migrated = migratePlanToCurrent(stored)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    expect(migrated.repairs).toEqual([])
    const pension = migrated.plan.accounts.find((account) => account.id === 'pen')
    expect(pension?.type === 'pension' ? pension.lumpSumElection : null).toEqual({ rolloverAccountId: 'ira' })
    expect(asOfIssues(migrated.plan, 2027)).toHaveLength(1)
  })

  it('names the receiving account generically when the target is not in the plan', () => {
    const plan = u2(2025, true)
    const pension = plan.accounts[1]
    if (pension?.type !== 'pension') throw new Error('fixture')
    const orphan: Plan = { ...plan, accounts: [plan.accounts[0]!, { ...pension, lumpSumElection: { rolloverAccountId: 'gone' } }] }
    expect(asOfIssues(orphan, 2026)[0]).toContain("add the rollover to the receiving account's balance")
  })
})
