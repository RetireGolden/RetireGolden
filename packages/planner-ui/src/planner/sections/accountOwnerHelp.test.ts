/**
 * The owner help on a joint cash, taxable or equity-compensation account says
 * what the engine does (decision D-PEOPLE-ORDER, R3): a flat contribution
 * needs wages, a schedule does not, and a one-person plan is not told "either
 * of you" (the independent review's L5).
 */
import { describe, expect, it } from 'vitest'

import type { Account } from '@retiregolden/engine/model/plan'

import { ownerHelp } from './accountOwnerHelp'

const flat: Account = { type: 'taxable', id: 'brk', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 10_000, costBasis: 10_000, annualContribution: 6_000 }
const scheduled: Account = { ...flat, annualContribution: 0, contributionSchedule: [{ annualAmount: 6_000, fromAge: 60, toAge: 65, escalationPct: 0 }] }

describe('joint-account owner help (review L5)', () => {
  it('tells a couple a flat contribution needs wages and a schedule does not', () => {
    expect(ownerHelp(flat, 2)).toBe('Joint: contributions continue while either of you is alive and either of you has wages.')
    expect(ownerHelp(scheduled, 2)).toBe(
      'Joint: the contribution schedule follows the age of the person named under Ages follow and keeps contributing while either of you is alive, whether or not either of you has wages.',
    )
  })

  it('speaks to one person as "you"', () => {
    expect(ownerHelp(flat, 1)).toBe('Joint: contributions continue while you are alive and have wages.')
    expect(ownerHelp(scheduled, 1)).toBe('Joint: the contribution schedule follows your age and keeps contributing while you are alive, whether or not you have wages.')
    expect(ownerHelp(flat, 1)).not.toContain('either of you')
  })

  it('says the same on a joint cash account, and nothing on a Roth', () => {
    const cash: Account = { type: 'cash', id: 'c', name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 0, annualContribution: 1_000 }
    expect(ownerHelp(cash, 2)).toContain('either of you has wages')
    expect(ownerHelp({ type: 'roth', id: 'r', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 }, 2)).toBeUndefined()
  })
})
