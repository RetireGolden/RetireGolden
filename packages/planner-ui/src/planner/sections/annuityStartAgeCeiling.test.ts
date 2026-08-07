/**
 * The bound that the accounts editor puts on an annuity's start age.
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

import { annuityStartAgeCeiling, clampedAnnuityStartAge } from './sectionHelpers'

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

  it('caps the ceiling at the schema maximum instead of standing down', () => {
    // A 1930-born owner buying in 2026 is 96 at purchase, so the regulatory
    // ceiling computes past the schema's 95 cap. The binding ceiling is 95:
    // returning null there would switch the commit-time clamp off exactly
    // where it should bind, and a typed 97 would sit in plan state until
    // save.
    const plan = planWithOwner('1930-01-01')
    expect(annuityStartAgeCeiling(plan, annuity())).toBe(95)
    expect(clampedAnnuityStartAge(plan, annuity({ startAge: 97 }))).toBe(95)
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

/**
 * What the editor STORES, which is a different question from what it offers.
 *
 * `annuityStartAgeCeiling` only decides the number field's `max`, and a `max`
 * governs the stepper — not a typed value, and not an edit to some other field
 * that moves the ceiling underneath a start age which was valid a moment ago.
 * Both routes end at a plan `parsePlan` refuses, with no field showing which
 * value is at fault, so every commit that can move the ceiling asks this.
 */
describe('clampedAnnuityStartAge', () => {
  /** Two owners whose ceilings differ: 1940 buys at 86, 1962 is bounded at 76. */
  function twoOwnerPlan(): Plan {
    const plan = planWithOwner('1940-01-01')
    plan.household.people = [
      plan.household.people[0]!,
      {
        id: 'p2',
        name: 'Sam',
        dob: '1962-01-01',
        sex: 'average',
        retirementAge: null,
        longevity: { planningAge: 95, source: 'manual' },
      },
    ]
    return plan
  }

  it('stores the ceiling when a typed start age goes past it', () => {
    // The finding this exists for: the field offered 76 and accepted 90.
    expect(clampedAnnuityStartAge(planWithOwner(), annuity({ startAge: 90 }))).toBe(76)
  })

  it('leaves a typed start age at the ceiling alone', () => {
    expect(clampedAnnuityStartAge(planWithOwner(), annuity({ startAge: 76 }))).toBeNull()
  })

  it('leaves a typed start age below the ceiling alone', () => {
    expect(clampedAnnuityStartAge(planWithOwner(), annuity({ startAge: 65 }))).toBeNull()
  })

  it('pulls the start age down when the new owner has a lower ceiling', () => {
    // Switching a contract from the 1940 owner (who bought it at 86, so 85 was
    // fine) to the 1962 owner, whose applicable RMD age of 75 puts the last
    // permissible start at 76. Nothing about the contract changed; the person
    // it is measured against did.
    const plan = twoOwnerPlan()
    const moved = annuity({ startAge: 85, ownerPersonId: 'p2' })
    expect(annuityStartAgeCeiling(plan, annuity({ startAge: 85 }))).toBe(86)
    expect(clampedAnnuityStartAge(plan, moved)).toBe(76)
  })

  it('leaves the start age alone when the new owner has a higher ceiling', () => {
    // The other direction has to be silent: an edit that widens what is allowed
    // must not move a value the household chose.
    const plan = twoOwnerPlan()
    const moved = annuity({ startAge: 76, ownerPersonId: plan.household.people[0]!.id })
    expect(clampedAnnuityStartAge(plan, moved)).toBeNull()
  })

  it('says nothing about a contract the ceiling does not reach', () => {
    const qlac = annuity({
      startAge: 90,
      purchase: { year: 2026, premium: 100_000, fundingAccountId: 'ira', taxQualification: 'qualified', qlac: true },
    })
    expect(clampedAnnuityStartAge(planWithOwner(), qlac)).toBeNull()
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
    expect(clampedAnnuityStartAge(planWithOwner(), pension)).toBeNull()
  })
})
