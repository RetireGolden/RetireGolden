/**
 * The bound that the accounts editor puts on an annuity's start age.
 *
 * The engine holds every qualified annuity purchase to one of two ceilings, and
 * the QLAC box decides which. Without it, payments must commence by the owner's
 * required beginning date (Treas. Reg. 1.401(a)(9)-6(a)(3)(i), excused by
 * (q)(1)(iii) for a QLAC alone); with it, that excuse is granted and (q)(1)(ii)
 * substitutes a ceiling of its own at the first of the month after the owner's
 * 85th birthday. A field the household can push past either refusal is a field
 * that authors a plan which will not save, so the editor carries whichever bound
 * applies — the treatment the lump-sum election year already gets one section up.
 *
 * Tested against the engine's own function rather than a copy of the arithmetic,
 * so the two cannot drift: what is asserted here is WHICH accounts the editor
 * applies it to, which is the part the editor decides for itself.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, type Account, type Plan } from '@retiregolden/engine/model/plan'

import {
  annuityStartAgeBounds,
  annuityStartAgeCeiling,
  annuityStartAgeHelp,
  clampedAnnuityStartAge,
} from './sectionHelpers'

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

/** The same contract with the QLAC box ticked, which swaps which bound applies. */
function qlacAnnuity(overrides: Partial<Extract<Account, { type: 'annuity' }>> = {}): Account {
  return annuity({
    purchase: { year: 2026, premium: 100_000, fundingAccountId: 'ira', taxQualification: 'qualified', qlac: true },
    ...overrides,
  })
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

  it('bounds a QLAC at its own, later ceiling', () => {
    // The QLAC election buys an excuse from the required beginning date
    // (Treas. Reg. 1.401(a)(9)-6(q)(1)(iii)) and a second ceiling with it:
    // (q)(1)(ii) requires the contract to commence by the first of the month
    // after the owner's 85th birthday. So the box raises the bound from 76 to
    // 85 rather than removing it.
    expect(annuityStartAgeCeiling(planWithOwner(), qlacAnnuity())).toBe(85)
  })

  it('gives a December-born owner the extra start age their deadline gives them', () => {
    // The deadline is the first day of the month NEXT FOLLOWING the 85th
    // anniversary, which for a December birthday is January 1 of the next
    // calendar year — where the projection commences a start age of 86.
    expect(annuityStartAgeCeiling(planWithOwner('1950-12-01'), qlacAnnuity())).toBe(86)
    expect(annuityStartAgeCeiling(planWithOwner('1950-11-30'), qlacAnnuity())).toBe(85)
  })

  it('pulls a QLAC start age down on the commit that ticks the box', () => {
    // Ticking QLAC on a contract already stored at 90 raises the ceiling from
    // 76 to 85 and the start age is still past it, so the clamp binds on the
    // purchase commit rather than leaving a plan that will not save.
    expect(clampedAnnuityStartAge(planWithOwner(), qlacAnnuity({ startAge: 90 }))).toBe(85)
    expect(clampedAnnuityStartAge(planWithOwner(), qlacAnnuity({ startAge: 85 }))).toBeNull()
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
 * What the field SAYS, which is the half of this that can be wrong while every
 * number above is right.
 *
 * The two ceilings do not order the same way for every owner. A QLAC's is fixed
 * at 85 (86 for a December birth); an ordinary qualified purchase's is the later
 * of the applicable RMD age plus one and the owner's age in the purchase year,
 * so it CLIMBS with a late annuitization and overtakes the QLAC's. Copy that
 * names one box as the way to start later is therefore true for some households
 * and false for others, and the false half sends them to a second refusal.
 */
describe('annuityStartAgeHelp', () => {
  const helpFor = (plan: Plan, account: Account) => annuityStartAgeHelp(annuityStartAgeBounds(plan, account))

  it('offers the QLAC box to an owner it would actually help', () => {
    // Born 1950, buying at 76: the ordinary ceiling is 76 and the QLAC's is 85,
    // so ticking the box buys nine more years and the copy names it.
    expect(helpFor(planWithOwner(), annuity())).toBe(
      'A pre-tax annuity purchase has to start paying by age 76. To start later than that, tick "QLAC (qualified longevity annuity)" below — a QLAC is the only kind of deferred annuity the IRA rules allow, and it has to start by age 85.',
    )
  })

  it('does not offer the QLAC box to an owner it would refuse', () => {
    // Born 1930, buying in 2026 at 96: the ordinary ceiling is the schema's 95
    // and the QLAC's is 85, so the box LOWERS what is allowed by ten years.
    // This is the case the old unconditional copy got wrong.
    const help = helpFor(planWithOwner('1930-01-01'), annuity())
    expect(help).toBe(
      'A pre-tax annuity purchase has to start paying by age 95. Ticking "QLAC (qualified longevity annuity)" below would not buy a later start: a QLAC has to start by age 85.',
    )
    expect(help).not.toContain('To start later than that')
  })

  it('offers the untick to a QLAC whose ordinary ceiling is the higher one', () => {
    // The same 1930-born owner with the box already ticked: dropping it is the
    // remedy, and the copy names the age it would buy back.
    expect(helpFor(planWithOwner('1930-01-01'), qlacAnnuity())).toBe(
      'A QLAC has to start paying by age 85. To start later than that, untick "QLAC (qualified longevity annuity)" below — bought this late, an ordinary pre-tax purchase may start as late as age 95.',
    )
  })

  it('does not claim a QLAC is the latest start any pre-tax purchase allows', () => {
    // Born 1950, buying at 76: here the QLAC's 85 really is the higher ceiling,
    // so unticking would lower it to 76 and the copy says so instead of
    // offering the untick — and, unlike the copy this replaced, it does not
    // assert that 85 is the most any pre-tax purchase can ever reach.
    const help = helpFor(planWithOwner(), qlacAnnuity())
    expect(help).toBe(
      'A QLAC has to start paying by age 85. Unticking "QLAC (qualified longevity annuity)" below would not buy a later start: a pre-tax purchase that is not a QLAC has to start by age 76.',
    )
    expect(help).not.toContain('the latest start the IRA rules allow')
  })

  it('says nothing where no bound applies', () => {
    expect(helpFor(planWithOwner(), annuity({ purchase: undefined }))).toBeUndefined()
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
      plan.household.people[0],
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

  it('stores the schema minimum when a typed start age falls below it', () => {
    expect(clampedAnnuityStartAge(planWithOwner(), annuity({ startAge: 20 }))).toBe(40)
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
    const moved = annuity({ startAge: 76, ownerPersonId: plan.household.people[0].id })
    expect(clampedAnnuityStartAge(plan, moved)).toBeNull()
  })

  it('says nothing about a contract no ceiling reaches', () => {
    // Section 401(a)(9) does not reach an after-tax purchase at all, so neither
    // bound applies and a start age of 90 stores as authored. The QLAC box is
    // NOT such a contract any more — it swaps which ceiling applies rather than
    // removing one, and its own case is pinned above.
    const nonQualified = annuity({
      startAge: 90,
      purchase: { year: 2026, premium: 100_000, fundingAccountId: 'cash', taxQualification: 'nonQualified' },
    })
    expect(clampedAnnuityStartAge(planWithOwner(), nonQualified)).toBeNull()
  })

  it('still applies the schema maximum where no regulatory ceiling reaches', () => {
    const nonQualified = annuity({
      startAge: 97,
      purchase: { year: 2026, premium: 100_000, fundingAccountId: 'cash', taxQualification: 'nonQualified' },
    })
    expect(clampedAnnuityStartAge(planWithOwner(), nonQualified)).toBe(95)
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
