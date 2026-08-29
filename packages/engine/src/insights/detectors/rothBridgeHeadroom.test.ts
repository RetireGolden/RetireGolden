import { describe, expect, it } from 'vitest'

import type { DetectorContext } from '../types.js'
import { rothBridgeHeadroom } from './rothBridgeHeadroom.js'

/**
 * Pins the SECURE 2.0 cohort boundary the detector shipped without: a person
 * born after 1959 is pre-RMD through age 74, so their ages 73 and 74 are
 * bridge years — the hardcoded `< 73` this file carried until 2026-08-29
 * silently ended the bridge two years early for every post-1959 cohort.
 * Registered as irc-401-a-9-C-v-applicable-age naming this detector.
 */
function context(birthYear: number, ages: readonly number[]): DetectorContext {
  const years = ages.map((ageAttained) => ({
    year: birthYear + ageAttained,
    inflationScale: 1,
    incomes: { wages: 0, socialSecurity: 0 },
    people: [{ personId: 'p1', ageAttained, alive: true }],
    balances: { trad: 500_000 },
  }))
  return {
    plan: {
      strategies: { rothConversion: { mode: 'none' } },
      accounts: [{ id: 'trad', type: 'traditional', inherited: false }],
    },
    projection: { startYear: years[0]!.year, result: { years } },
  } as unknown as DetectorContext
}

describe('rothBridgeHeadroom applicable-age cohort boundary', () => {
  it('keeps ages 73 and 74 in the bridge for a post-1959 cohort (applicable age 75)', () => {
    const card = rothBridgeHeadroom.screen(context(1962, [72, 73, 74, 75]))
    expect(card).not.toBeNull()
    expect(card!.evidence.find((e) => e.label === 'First low-income bridge year')!.value).toBe('2034')
    // 1962 + 74 = 2036: the bridge runs THROUGH age 74, and 75 ends it.
    expect(card!.evidence.find((e) => e.label === 'Last low-income bridge year')!.value).toBe('2036')
  })

  it('ends the bridge at 73 for a 1959-or-earlier cohort (applicable age 73)', () => {
    const card = rothBridgeHeadroom.screen(context(1955, [71, 72, 73, 74]))
    expect(card).not.toBeNull()
    expect(card!.evidence.find((e) => e.label === 'Last low-income bridge year')!.value).toBe('2027')
  })
})
