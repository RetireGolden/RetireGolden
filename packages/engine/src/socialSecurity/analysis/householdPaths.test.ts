/**
 * The benefits-only models' paths (analysis/householdPaths.ts) on the earnings
 * test's year: cases the implementation review of D-SS-ANALYSIS-EARNINGS-TEST
 * found unpinned in the models (its gaps PA08 and PA12). Each figure is hand
 * arithmetic, in today's dollars.
 */
import { expect, it } from 'vitest'

import type { Assumptions } from '../../model/plan.js'
import { describeRule } from '../../rules/describeRule.js'
import { priceHouseholdPaths, type PathHousehold } from './householdPaths.js'

function alone(dob: string, pia: number, claimYears: number, wagesInYear: (year: number) => number, inflationPct: number): PathHousehold {
  const assumptions: Pick<Assumptions, 'inflationPct' | 'ssCola' | 'ssHaircut'> = { inflationPct, ssCola: { mode: 'matchInflation' }, ssHaircut: null }
  return {
    people: [{
      person: { id: 'p', name: 'p', dob },
      stream: { type: 'socialSecurity', id: 'p-ss', personId: 'p', piaMonthly: pia, earnings: null, claimAge: { years: claimYears, months: 0 } },
      piaMonthly: pia,
    }],
    startYear: 2026,
    assumptions,
    wages: (_personId, year) => wagesInYear(year),
  }
}

/**
 * The path on which everyone lives: each year the path can still change, then
 * the steady year that repeats after it, in today's dollars, to the cent.
 */
function aliveYears(household: PathHousehold, lastYear: number): number[] {
  const paths = priceHouseholdPaths(household, lastYear)
  const cents = (value: number): number => Math.round(value * 100) / 100
  return [...paths.alive.explicit.map((year) => cents(year.get('p') ?? 0)), cents(paths.alive.steady.get('p') ?? 0)]
}

// Gap PA08: born 1964-01-15, PIA 2,000, claims at 62, $40,000 of wages in 2026
// and 41,000 in 2027 (40,000 in today's dollars) at 2.5% inflation. The 2027
// excess is floor((41,000 - 24,480 x 1.025)/2) = 7,954, and 2027 pays 9,266, or
// 9,040 in today's dollars. At the 2026 amount: 8,960, 8,741.46 today.
describeRule('usc-42-403-f-8-earnings-test-exempt-amounts', {
  note: 'carried past the latest published year at the plan\'s inflation, in the models',
  readings: {
    carriedAtThePlansInflation: 9_040,
    heldAtThe2026Amounts: 8_741.46,
  },
  accepted: 'carriedAtThePlansInflation',
}, ({ accepted, readings }) => {
  it('prices a path\'s 2027 against the exempt amounts grown at the plan\'s inflation', () => {
    const years = aliveYears(alone('1964-01-15', 2_000, 62, (year) => (year === 2026 ? 40_000 : year === 2027 ? 41_000 : 0), 2.5), 2035)
    expect(years[0]).toBe(9_040)
    expect(years[1]).toBe(accepted)
    expect(years[1]).not.toBe(readings.heldAtThe2026Amounts)
  })
})

// Gap PA12: a path whose only wages before full retirement age fall in the year
// it is reached. Born 1960-07-15 (FRA month July 2027), claimed at 62 in 2022
// (1,400 a month), $150,000 of wages in 2027 only. The six months before July
// earn 75,000, an excess of floor((75,000 - 65,160)/3) = 3,280, charged January,
// February and 480 of March: three crediting months. From July she is paid 57
// months early, 2,000 x 0.7125 = 1,425: 2027 pays 8,400 - 3,280 + 8,550 = 13,670,
// and each later year 17,100. A path that ignored the FRA year's wages would
// take 2027 as steady and pay 16,800 every year.
describeRule('usc-42-403-f-3-fra-year-months-before-fra', {
  note: 'a path whose only wages fall in the year full retirement age is reached',
  readings: {
    testsTheMonthsBeforeTheFraMonth: { y2026: 16_800, y2027: 13_670, after: 17_100 },
    ignoresTheFraYearsWages: { y2026: 16_800, y2027: 16_800, after: 16_800 },
  },
  accepted: 'testsTheMonthsBeforeTheFraMonth',
}, ({ accepted, readings }) => {
  it('tests a path whose only wages before full retirement age fall in the FRA year', () => {
    const years = aliveYears(alone('1960-07-15', 2_000, 62, (year) => (year === 2027 ? 150_000 : 0), 0), 2035)
    const observed = { y2026: years[0], y2027: years[1], after: years[years.length - 1] }
    expect(observed).toEqual(accepted)
    expect(observed).not.toEqual(readings.ignoresTheFraYearsWages)
  })
})

// PR #769 review, issue 3, in the models: the same person as the ledger's case,
// born 1959-06-15 (FRA month April 2026), claimed at 62 (1,416.67 a month),
// $300,000 of wages in 2026 only. 2026 pays 13,945 and each later year 17,300.
// The whole-years rule tests 2025 and pays 17,000 throughout; one month more
// before April, 12,975 in 2026.
describeRule('usc-42-403-f-3-fra-year-months-before-fra', {
  note: 'a path in a full-retirement-age year with FRA months: born 1959, FRA 66 and 10 months',
  readings: {
    theMonthsBeforeTheFraMonth: { y2026: 13_945, after: 17_300 },
    theYearOfTheWholeYears: { y2026: 17_000, after: 17_000 },
    oneMonthTooMany: { y2026: 12_975, after: 17_300 },
  },
  accepted: 'theMonthsBeforeTheFraMonth',
}, ({ accepted, readings }) => {
  it('prices the 2026 path of a person born 1959-06-15 against the three months before April', () => {
    const years = aliveYears(alone('1959-06-15', 2_000, 62, (year) => (year === 2026 ? 300_000 : 0), 0), 2035)
    const observed = { y2026: years[0], after: years[years.length - 1] }
    expect(observed).toEqual(accepted)
    expect(observed).not.toEqual(readings.theYearOfTheWholeYears)
    expect(observed).not.toEqual(readings.oneMonthTooMany)
  })
})
