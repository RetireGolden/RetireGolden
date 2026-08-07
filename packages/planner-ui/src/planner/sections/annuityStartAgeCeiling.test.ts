/**
 * The bound the accounts editor puts on an annuity's start age.
 *
 * The engine refuses a qualified annuity purchase that is not a QLAC and whose
 * payments commence after the owner's required beginning date (Treas. Reg.
 * 1.401(a)(9)-6(a)(3)(i), excused by (q)(1)(iii) for a QLAC alone). A field the
 * household can push past that refusal is a field that authors a plan which
 * will not save, so the editor carries the same bound — the treatment the
 * lump-sum election year already gets one section up.
 *
 * Tested against the engine's own function rather than a copy of the arithmetic,
 * so the two cannot drift: what is asserted here is WHICH accounts the editor
 * applies it to, which is the part the editor decides for itself.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, type Account, type Plan } from '@retiregolden/engine/model/plan'

import { annuityStartAgeCeiling } from './sectionHelpers'

let counter = 0
const testIds = (): string => `ceiling-${++counter}`
const fixedNow = (): Date => new Date('2026-06-11T00:00:00.000Z')

/** One person born in 1950, so the applicable RMD age is 72. */
function planWithOwner(dob = '1950-01-01'): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob,
    sex: 'average',
    retirementAge: null,
    longevity: { planningAge: 95, source: 'manual' },
  }
  return plan
}

function annuity(overrides: Partial<Extract<Account, { type: 'annuity' }>> = {}): Account {
  return {
    type: 'annuity',
    id: 'ann',
    name: 'Annuity',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    startAge: 80,
    monthlyAmount: 1_000,
    colaPct: 0,
    taxablePct: 100,
    purchase: {
      year: 2026,
      premium: 100_000,
      fundingAccountId: 'ira',
      taxQualification: 'qualified',
    },
    ...overrides,
  }
}

describe('annuityStartAgeCeiling', () => {
  it('bounds a qualified purchase that is not a QLAC', () => {
    // Born 1950, buying in 2026 at 76: the required beginning date is long
    // past, so the contract must commence in its purchase year.
    expect(annuityStartAgeCeiling(planWithOwner(), annuity())).toBe(76)
  })

  it('bounds by the required beginning date when the purchase comes first', () => {
    // Born 1962, so the applicable age is 75 and the last permissible start is
    // 76 — later than the owner's age of 64 in the purchase year, which is what
    // makes the required beginning date the binding term here.
    expect(annuityStartAgeCeiling(planWithOwner('1962-01-01'), annuity())).toBe(76)
  })

  it('lets a QLAC go', () => {
    // The one contract the regulation permits to defer, so the field is not
    // bounded and the schema's own 95 stands.
    const qlac = annuity({
      purchase: { year: 2026, premium: 100_000, fundingAccountId: 'ira', taxQualification: 'qualified', qlac: true },
    })
    expect(annuityStartAgeCeiling(planWithOwner(), qlac)).toBeNull()
  })

  it('lets a non-qualified purchase go', () => {
    // Section 401(a)(9) does not reach after-tax dollars, and no premium leaves
    // a pre-tax balance for the required-distribution base to lose.
    const nonQualified = annuity({
      purchase: { year: 2026, premium: 100_000, fundingAccountId: 'cash', taxQualification: 'nonQualified' },
    })
    expect(annuityStartAgeCeiling(planWithOwner(), nonQualified)).toBeNull()
  })

  it('lets an already-owned annuity go', () => {
    expect(annuityStartAgeCeiling(planWithOwner(), annuity({ purchase: undefined }))).toBeNull()
  })

  it('reads an unowned contract as the first person’s', () => {
    // The projection resolves a null owner to the first person in the
    // household, so the editor has to bound it against the same birth date or
    // it would offer an age the engine then refuses.
    expect(annuityStartAgeCeiling(planWithOwner(), annuity({ ownerPersonId: null }))).toBe(76)
  })

  it('leaves every other account type alone', () => {
    const pension: Account = {
      type: 'pension',
      id: 'pen',
      name: 'Pension',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      startAge: 80,
      monthlyAmount: 1_000,
      colaPct: 0,
      survivorPct: 50,
    }
    expect(annuityStartAgeCeiling(planWithOwner(), pension)).toBeNull()
  })
})
