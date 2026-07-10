import { describe, expect, it } from 'vitest'

import { singlePersonPlan } from '../testSupport/planFixtures'
import { candidateClaimAges } from './ssAnalysis'

/**
 * Atomic oracle tests for the claiming-grid candidate ages (Phase 1 P1,
 * calculation-test-plan.md). The grid runs 62-70 but never offers a claim age the
 * person has already passed; someone already past 70 is left with 70.
 */
const personBorn = (dob: string) => singlePersonPlan({ dob }).household.people[0]!

describe('candidate claim ages golden worksheets (startYear 2026)', () => {
  it('offers the full 62-70 grid for someone not yet 62', () => {
    // Born 1968 -> age 58 in 2026; no past ages to exclude.
    expect(candidateClaimAges(personBorn('1968-06-15'), 2026)).toEqual([62, 63, 64, 65, 66, 67, 68, 69, 70])
  })

  it('excludes claim ages already passed', () => {
    // Born 1962 -> age 64 in 2026; 62 and 63 are in the past.
    expect(candidateClaimAges(personBorn('1962-06-15'), 2026)).toEqual([64, 65, 66, 67, 68, 69, 70])
  })

  it('includes the current age exactly at the boundary', () => {
    // Born 1964 -> age 62 in 2026; 62 is reachable, none excluded.
    expect(candidateClaimAges(personBorn('1964-06-15'), 2026)).toEqual([62, 63, 64, 65, 66, 67, 68, 69, 70])
  })

  it('leaves only 70 for someone already past 70', () => {
    // Born 1950 -> age 76 in 2026; every grid age is in the past.
    expect(candidateClaimAges(personBorn('1950-06-15'), 2026)).toEqual([70])
  })
})
