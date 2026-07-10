import { describe, expect, it } from 'vitest'
import {
  computePiaFromEarnings,
  eligibilityYearFromDobParts,
  isPiaFromEarningsError,
  parseEarningsLines,
  piaInputFromEarnings,
  piaMonthlyFromAime,
  resolveEarningsProjection,
  type PiaFromEarningsResult,
} from './piaFromEarnings'

describe('piaMonthlyFromAime', () => {
  it('matches SSA bend formula for 2015 (published bend points)', () => {
    expect(piaMonthlyFromAime(2000, 2015)).toBeCloseTo(1119.0, 5)
  })

  it('rounds down to the next lower dime', () => {
    expect(piaMonthlyFromAime(3000, 2020)).toBe(1516.8)
  })
})

describe('piaInputFromEarnings', () => {
  it('clamps lastEarningsYear into the AIME base window', () => {
    // DOB 1962-06-15 → base 1984–2023. Earnings past 2023 are out of window.
    const input = piaInputFromEarnings(1962, 6, 15, [
      { year: 2020, amount: 50_000 },
      { year: 2030, amount: 50_000 },
    ])
    expect(input.lastEarningsYear).toBe(2023)
  })
})

describe('resolveEarningsProjection', () => {
  it('returns null when nothing is stored', () => {
    expect(resolveEarningsProjection(null, 65)).toBeNull()
    expect(resolveEarningsProjection(undefined, 65)).toBeNull()
  })

  it('defaults throughAge to the retirement age', () => {
    expect(resolveEarningsProjection({ assumedAnnualEarnings: null, throughAge: null }, 60)).toEqual({
      assumedAnnualEarnings: null,
      throughAge: 60,
    })
  })

  it('honors an explicit throughAge override', () => {
    expect(resolveEarningsProjection({ assumedAnnualEarnings: 70_000, throughAge: 58 }, 65)).toEqual({
      assumedAnnualEarnings: 70_000,
      throughAge: 58,
    })
  })

  it('returns null when neither throughAge nor retirement age is available', () => {
    expect(resolveEarningsProjection({ assumedAnnualEarnings: 70_000, throughAge: null }, null)).toBeNull()
  })
})

describe('eligibilityYearFromDobParts', () => {
  it('uses Jan 1 deemed birth year for eligibility', () => {
    expect(eligibilityYearFromDobParts(1962, 1, 1)).toBe(2023)
    expect(eligibilityYearFromDobParts(1962, 6, 15)).toBe(2024)
  })
})

describe('parseEarningsLines', () => {
  it('parses year and amount with spaces or commas', () => {
    const { rows, errors } = parseEarningsLines('1999 45000\n2000, 50000')
    expect(errors).toEqual([])
    expect(rows).toEqual([
      { year: 1999, amount: 45000 },
      { year: 2000, amount: 50000 },
    ])
  })
})

describe('computePiaFromEarnings', () => {
  it('returns eligibility_before_1979 for very early birth years', () => {
    const r = computePiaFromEarnings({
      dobYear: 1910,
      dobMonth: 6,
      dobDay: 1,
      earnings: [],
      lastEarningsYear: 1970,
    })
    expect(isPiaFromEarningsError(r)).toBe(true)
    if (isPiaFromEarningsError(r)) expect(r.code).toBe('eligibility_before_1979')
  })

  it('errors when last earnings year is outside the base period', () => {
    const r = computePiaFromEarnings({
      dobYear: 1962,
      dobMonth: 6,
      dobDay: 15,
      earnings: [{ year: 2023, amount: 50000 }],
      lastEarningsYear: 1980,
    })
    expect(isPiaFromEarningsError(r)).toBe(true)
    if (isPiaFromEarningsError(r)) expect(r.code).toBe('last_earnings_year_out_of_range')
  })

  /**
   * Fixture 1: DOB 1953-06-15 → eligibility 2015; base 1975–2014; one unindexed year 2014
   * (2014 &gt; eligibilityYear−2) at $50k → AIME floor(50000/420)=119 → PIA 90% rounded to dime.
   */
  it('fixture: single high year in last base year (unindexed) for 2015 eligibility', () => {
    const r = computePiaFromEarnings({
      dobYear: 1953,
      dobMonth: 6,
      dobDay: 15,
      earnings: [{ year: 2014, amount: 50_000 }],
      lastEarningsYear: 2014,
    })
    expect(isPiaFromEarningsError(r)).toBe(false)
    if (!isPiaFromEarningsError(r)) {
      expect(r.eligibilityYear).toBe(2015)
      expect(r.aime).toBe(119)
      expect(r.piaMonthly).toBe(107.1)
      expect(r.usesStandInForFutureTables).toBe(false)
    }
  })

  /**
   * Fixture 2: same worker; earnings only in 2012 (wage-indexed) at $50k;
   * indexed annual = floor(50_000 × AWI_2013 / AWI_2012).
   */
  it('fixture: single indexed year 2012 for 2015 eligibility', () => {
    const r = computePiaFromEarnings({
      dobYear: 1953,
      dobMonth: 6,
      dobDay: 15,
      earnings: [{ year: 2012, amount: 50_000 }],
      lastEarningsYear: 2014,
    })
    expect(isPiaFromEarningsError(r)).toBe(false)
    if (!isPiaFromEarningsError(r)) {
      expect(r.aime).toBe(120)
      expect(r.piaMonthly).toBe(108.0)
      expect(r.usesStandInForFutureTables).toBe(false)
    }
  })

  it('fixture: 2020 eligibility PIA matches bend formula for AIME 3000', () => {
    expect(piaMonthlyFromAime(3000, 2020)).toBe(1516.8)
  })

  it('zero-fill: sparse earnings still produce AIME under full divisor when window is long', () => {
    const r = computePiaFromEarnings({
      dobYear: 1962,
      dobMonth: 6,
      dobDay: 15,
      earnings: [
        { year: 2020, amount: 40_000 },
        { year: 2021, amount: 40_000 },
      ],
      lastEarningsYear: 2023,
    })
    expect(isPiaFromEarningsError(r)).toBe(false)
    if (!isPiaFromEarningsError(r)) {
      expect(r.computationYearCount).toBe(35)
      expect(r.aime).toBeGreaterThan(0)
      expect(r.aime).toBeLessThan(500)
      expect(r.usesStandInForFutureTables).toBe(false)
    }
  })

  // -------------------------------------------------------------------------
  // Future-earnings projection (V7 §3.5)
  // -------------------------------------------------------------------------

  // Worker born 1975-06-15 → eligibility 2037, base years 1997–2036 (age 22–61).
  // 28 reported years 1997–2024 at $60k leave 7 zero years in the top-35 set.
  const dob = { dobYear: 1975, dobMonth: 6, dobDay: 15 }
  const reported = Array.from({ length: 28 }, (_, i) => ({ year: 1997 + i, amount: 60_000 }))
  const ok = (r: ReturnType<typeof computePiaFromEarnings>): PiaFromEarningsResult => {
    if (isPiaFromEarningsError(r)) throw new Error(`unexpected error: ${r.code}`)
    return r
  }

  it('projection fills future base years and raises PIA versus treating them as zero', () => {
    const noProj = ok(computePiaFromEarnings({ ...dob, earnings: reported, lastEarningsYear: 2024 }))
    const retire62 = ok(
      computePiaFromEarnings({
        ...dob,
        earnings: reported,
        lastEarningsYear: 2024,
        projection: { assumedAnnualEarnings: 60_000, throughAge: 62 },
      }),
    )
    expect(noProj.projectedYearCount).toBe(0)
    // 2025–2036 (12 years) projected; top-35 now entirely $60k → higher AIME.
    expect(retire62.projectedYearCount).toBe(12)
    expect(retire62.aime).toBeGreaterThan(noProj.aime)
    expect(retire62.piaMonthly).toBeGreaterThan(noProj.piaMonthly)
    const projYears = retire62.indexedYears.filter((y) => y.projected)
    expect(projYears[0]!.year).toBe(2025)
    expect(projYears.at(-1)!.year).toBe(2036)
  })

  it('different retirement ages from the same history produce different PIAs', () => {
    const retire55 = ok(
      computePiaFromEarnings({ ...dob, earnings: reported, lastEarningsYear: 2024, projection: { assumedAnnualEarnings: 60_000, throughAge: 55 } }),
    )
    const retire62 = ok(
      computePiaFromEarnings({ ...dob, earnings: reported, lastEarningsYear: 2024, projection: { assumedAnnualEarnings: 60_000, throughAge: 62 } }),
    )
    const workToFra = ok(
      computePiaFromEarnings({ ...dob, earnings: reported, lastEarningsYear: 2024, projection: { assumedAnnualEarnings: 60_000, throughAge: 67 } }),
    )
    // Retire at 55 → only 5 projected years (2025–2029), still some zero years.
    expect(retire55.projectedYearCount).toBe(5)
    expect(retire55.aime).toBeLessThan(retire62.aime)
    // Past age 62 nothing changes: the AIME base period ends the year before 62,
    // so working to FRA gives the same retirement PIA as stopping at 62.
    expect(workToFra.aime).toBe(retire62.aime)
    expect(workToFra.piaMonthly).toBe(retire62.piaMonthly)
  })

  it('caps projected future earnings at the taxable maximum (latest wage base stand-in)', () => {
    // Codex P2: a high earner projecting $300k through age 62 must not credit
    // post-table years (2027+) at the full $300k — they cap at the wage base.
    const LATEST_WAGE_BASE = 184_500 // 2026, the latest published taxable maximum
    const r = ok(
      computePiaFromEarnings({
        ...dob,
        earnings: reported,
        lastEarningsYear: 2024,
        projection: { assumedAnnualEarnings: 300_000, throughAge: 62 },
      }),
    )
    const projYears = r.indexedYears.filter((y) => y.projected)
    expect(projYears.length).toBeGreaterThan(0)
    for (const y of projYears) {
      expect(y.rawEarnings).toBe(300_000)
      expect(y.cappedEarnings).toBeLessThanOrEqual(LATEST_WAGE_BASE)
    }
    // $300k and $200k projections both clear every cap → identical AIME.
    const lower = ok(
      computePiaFromEarnings({ ...dob, earnings: reported, lastEarningsYear: 2024, projection: { assumedAnnualEarnings: 200_000, throughAge: 62 } }),
    )
    expect(r.aime).toBe(lower.aime)
  })

  it('assumed earnings default to the most recent reported year', () => {
    const stepUp = [...reported.slice(0, -1), { year: 2024, amount: 90_000 }]
    const reuseRecent = ok(
      computePiaFromEarnings({ ...dob, earnings: stepUp, lastEarningsYear: 2024, projection: { assumedAnnualEarnings: null, throughAge: 62 } }),
    )
    const explicit90k = ok(
      computePiaFromEarnings({ ...dob, earnings: stepUp, lastEarningsYear: 2024, projection: { assumedAnnualEarnings: 90_000, throughAge: 62 } }),
    )
    expect(reuseRecent.aime).toBe(explicit90k.aime)
  })

  it('uses latest published AWI and bend points when eligibility is far in the future (young workers)', () => {
    const r = computePiaFromEarnings({
      dobYear: 1983,
      dobMonth: 3,
      dobDay: 1,
      earnings: [{ year: 2020, amount: 100_000 }],
      lastEarningsYear: 2024,
    })
    expect(isPiaFromEarningsError(r)).toBe(false)
    if (!isPiaFromEarningsError(r)) {
      expect(r.eligibilityYear).toBe(2045)
      expect(r.usesStandInForFutureTables).toBe(true)
      expect(r.piaMonthly).toBeGreaterThan(0)
    }
  })
})
