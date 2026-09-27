import { expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import { computePiaFromEarnings, isPiaFromEarningsError, piaInputFromEarnings } from './piaFromEarnings.js'

// A worker born 1956-08-14 (eligibility 2018, indexing year 2016, AWI
// 48,642.15, bend points 895 and 5,397) with 50,000 dollars of covered earnings
// in every year from 1978 through 2017. Section 415(e)(1) counts 1978 only up to
// that year's 17,700 base, indexed to 17,700 x 48,642.15 / 10,556.03 = 81,561;
// 1979 to 1989 are capped at 22,900 to 48,000. The top 35 indexed years sum to
// 3,123,363, so the AIME is 7,436 and the PIA 0.9 x 895 + 0.32 x 4,502 +
// 0.15 x 2,039 = 2,551.99, floored to 2,551.90. Capping 1978 at the latest base
// (184,500), as the engine did until 2026-09-27, counts the whole 50,000:
// AIME 7,790 and PIA 2,605.00.
describeRule('usc-42-415-e-1-earnings-above-the-base-not-counted', {
  note: 'a 1978 wage above that year\'s base',
  readings: {
    thatYearsBase: { aime: 7_436, piaMonthly: 2_551.9 },
    latestBaseForYearsBefore1979: { aime: 7_790, piaMonthly: 2_605 },
  },
  accepted: 'thatYearsBase',
}, ({ accepted, readings }) => {
  it('counts a 1978 wage only up to the 1978 contribution and benefit base', () => {
    const earnings = Array.from({ length: 40 }, (_, index) => ({ year: 1978 + index, amount: 50_000 }))
    const result = computePiaFromEarnings(piaInputFromEarnings(1956, 8, 14, earnings))
    if (isPiaFromEarningsError(result)) throw new Error(result.code)
    expect({ aime: result.aime, piaMonthly: result.piaMonthly }).toEqual(accepted)
    expect({ aime: result.aime, piaMonthly: result.piaMonthly }).not.toEqual(readings.latestBaseForYearsBefore1979)
  })
})

// A worker born 1925-03-03 (eligibility 1987, indexing year 1985, AWI
// 16,822.51, first bend point 310) with 20,000 dollars in 1960 and in 1970. The
// window starts at 1951, the first computation base year, so 36 elapsed years
// give 31 computation years; 1960 counts 4,800 (indexed 20,151) and 1970 counts
// 7,800 (indexed 21,210): AIME floor(41,361 / 372) = 111, PIA 99.90. The old
// window from 1947 with no cap before 1979 averaged 138,349 over 420 months:
// AIME 329, PIA 285.00.
describeRule('usc-42-415-e-1-earnings-above-the-base-not-counted', {
  note: 'computation base years after 1950',
  readings: {
    after1950AtEachYearsBase: { firstBaseYear: 1951, computationYearCount: 31, aime: 111, piaMonthly: 99.9 },
    fromAge22UncappedBefore1979: { firstBaseYear: 1947, computationYearCount: 35, aime: 329, piaMonthly: 285 },
  },
  accepted: 'after1950AtEachYearsBase',
}, ({ accepted, readings }) => {
  it('starts the window at 1951 and caps the 1960 and 1970 wages at their bases', () => {
    const result = computePiaFromEarnings(
      piaInputFromEarnings(1925, 3, 3, [{ year: 1960, amount: 20_000 }, { year: 1970, amount: 20_000 }]),
    )
    if (isPiaFromEarningsError(result)) throw new Error(result.code)
    const produced = {
      firstBaseYear: result.firstBaseYear,
      computationYearCount: result.computationYearCount,
      aime: result.aime,
      piaMonthly: result.piaMonthly,
    }
    expect(produced).toEqual(accepted)
    expect(produced).not.toEqual(readings.fromAge22UncappedBefore1979)
  })
})

// The window's first year is never before 1951 (415(b)(2)(B)(ii)-(iii)), so
// the earnings input's last year is clamped into it even when the history has
// nothing after 1950. The same 1925 worker with wages only in 1948 and 1949:
// those years are outside every computation year, so the AIME is 0 and so is
// the PIA, rather than an error from a last earnings year before the window.
it('keeps a history with nothing after 1950 inside the 1951 window: AIME 0, not an error', () => {
  const input = piaInputFromEarnings(1925, 3, 3, [{ year: 1948, amount: 3_000 }, { year: 1949, amount: 3_000 }])
  expect(input.lastEarningsYear).toBe(1951)
  const result = computePiaFromEarnings(input)
  if (isPiaFromEarningsError(result)) throw new Error(result.code)
  expect(result.firstBaseYear).toBe(1951)
  expect(result.aime).toBe(0)
  expect(result.piaMonthly).toBe(0)
})
