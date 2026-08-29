import { describe, expect, it } from 'vitest'

import type { ProjectionResult } from '../projection/types.js'
import { bridgeYearFilter } from './objectives.js'

/**
 * The objective-side twin of the detector's cohort fixture: the
 * bridge-durability window must end at the cohort-dependent applicable age,
 * not a hardcoded 73. Discriminates both directions at the statutory cut
 * (1959 last 73-cohort; 1960 first 75-cohort). Registered via
 * irc-401-a-9-C-v-applicable-age naming bridgeYearFilter.
 */
function row(birthYear: number, ageAttained: number): ProjectionResult['years'][number] {
  return {
    year: birthYear + ageAttained,
    incomes: { wages: 0, socialSecurity: 0 },
    people: [{ personId: 'p1', ageAttained, alive: true }],
  } as unknown as ProjectionResult['years'][number]
}

describe('bridgeYearFilter applicable-age cohort boundary', () => {
  it('keeps ages 73 and 74 in the window for the first 75-cohort (born 1960)', () => {
    expect(bridgeYearFilter(row(1960, 73))).toBe(true)
    expect(bridgeYearFilter(row(1960, 74))).toBe(true)
    expect(bridgeYearFilter(row(1960, 75))).toBe(false)
  })

  it('ends the window at the applicable age for the final 73-cohort (born 1959)', () => {
    expect(bridgeYearFilter(row(1959, 72))).toBe(true)
    // Guards the reverse drift too: a 1959 birth mapped to 75 would keep 73 in.
    expect(bridgeYearFilter(row(1959, 73))).toBe(false)
  })
})
