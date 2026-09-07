import { describe, expect, it } from 'vitest'

import { describeRule } from '../../rules/describeRule.js'
import type { DetectorContext } from '../types.js'
import { rothBridgeHeadroom } from './rothBridgeHeadroom.js'

/**
 * Pins the SECURE 2.0 cohort boundary the detector shipped without, at the
 * statutory cut itself (1959 is the last 73 cohort; 1960 is the first 75
 * cohort), so this fixture discriminates BOTH failure directions: the old
 * hardcoded `< 73` (which truncates the 1960 cohort's bridge two years
 * early) and a hypothetical drift that mapped 1959 to 75 (which would
 * extend a bridge the statute ends at 73). For cohorts born 1950 or
 * earlier the helper returns 72; that changes nothing reachable, because
 * every projection year puts those cohorts far past any applicable age.
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

function lastBridgeYear(birthYear: number): string {
  const card = rothBridgeHeadroom.screen(context(birthYear, [71, 72, 73, 74, 75]))
  expect(card).not.toBeNull()
  return card!.evidence.find((e) => e.label === 'Last low-income bridge year')!.value as string
}

describe('rothBridgeHeadroom applicable-age cohort boundary', () => {
  describeRule('irc-401-a-9-C-v-applicable-age', {
    note: 'detector bridge window ends at the cohort-dependent applicable age',
    readings: {
      cohortDependentApplicableAge: { born1959LastYear: '2031', born1960LastYear: '2034' },
      hardcodedAgeSeventyThree: { born1959LastYear: '2031', born1960LastYear: '2032' },
      nineteenFiftyNineMappedToSeventyFive: { born1959LastYear: '2033', born1960LastYear: '2034' },
    },
    accepted: 'cohortDependentApplicableAge',
  }, ({ accepted, readings }) => {
    it('last included year is age 74 for the first 75-cohort (born 1960)', () => {
      const actual = { born1959LastYear: lastBridgeYear(1959), born1960LastYear: lastBridgeYear(1960) }
      expect(actual).toEqual(accepted)
      expect(actual).not.toEqual(readings.hardcodedAgeSeventyThree)
      expect(actual).not.toEqual(readings.nineteenFiftyNineMappedToSeventyFive)
    })

    it('last included year is age 72 for the final 73-cohort (born 1959); the RMD start year is excluded', () => {
      expect(lastBridgeYear(1959)).toBe('2031')
    })
  })
})

describe('rothBridgeHeadroom product boundary gates', () => {
  const birthYear = 1960

  function screen(
    rows: ReadonlyArray<{ wages: number; tradBalance: number; ageAttained: number }>,
  ) {
    const years = rows.map((row) => ({
      year: birthYear + row.ageAttained,
      inflationScale: 1,
      incomes: { wages: row.wages, socialSecurity: 0 },
      people: [{ personId: 'p1', ageAttained: row.ageAttained, alive: true }],
      balances: { trad: row.tradBalance },
    }))
    const ctx = {
      plan: {
        strategies: { rothConversion: { mode: 'none' } },
        accounts: [{ id: 'trad', type: 'traditional', inherited: false }],
      },
      projection: { startYear: years[0]!.year, result: { years } },
    } as unknown as DetectorContext
    return rothBridgeHeadroom.screen(ctx)
  }

  it.each([
    {
      label: 'opening trad below 10k blocks even when a later year qualifies',
      rows: [
        { ageAttained: 62, wages: 0, tradBalance: 9_999 },
        { ageAttained: 63, wages: 0, tradBalance: 20_000 },
      ],
      expectCard: false,
    },
    {
      label: 'opening at 10k with ineligible wages still allows a later bridge year',
      rows: [
        { ageAttained: 62, wages: 10_000, tradBalance: 10_000 },
        { ageAttained: 63, wages: 9_999, tradBalance: 10_001 },
      ],
      expectCard: true,
      expectPreviewWindow: { startYear: 2023, endYear: 2023 },
    },
    {
      label: 'year trad exactly 10k is not bridge-eligible',
      rows: [{ ageAttained: 62, wages: 0, tradBalance: 10_000 }],
      expectCard: false,
    },
    {
      label: 'wages at 10k block bridge despite trad above 10k',
      rows: [{ ageAttained: 62, wages: 10_000, tradBalance: 10_001 }],
      expectCard: false,
    },
    {
      label: 'wages below 10k with trad above 10k yields fill-to-12% preview',
      rows: [{ ageAttained: 62, wages: 9_999, tradBalance: 10_001 }],
      expectCard: true,
      expectPreviewWindow: { startYear: 2022, endYear: 2022 },
    },
  ])('$label', ({ rows, expectCard, expectPreviewWindow }) => {
    const card = screen(rows)
    if (!expectCard) {
      expect(card).toBeNull()
      return
    }
    expect(card).not.toBeNull()
    if (expectPreviewWindow) {
      expect(card!.action).toMatchObject({
        kind: 'preview-scenario',
        patch: {
          strategies: {
            rothConversion: {
              mode: 'fillToTarget',
              target: 'topOfBracket',
              targetValue: 12,
              startYear: expectPreviewWindow.startYear,
              endYear: expectPreviewWindow.endYear,
            },
          },
        },
      })
    }
  })
})
