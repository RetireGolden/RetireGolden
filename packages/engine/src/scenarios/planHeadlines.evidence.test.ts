import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import type { YearResult } from '../projection/types.js'
import { comparePlanHeadlines, type ComparedProjection } from './planHeadlines.js'

/**
 * One side of a comparison as the worksheets state it: a household whose first
 * person is born on `dob`, a ledger from `startYear` to `endYear` whose rows
 * carry only the fields the comparison reads (the year's inflation factor,
 * built by the ledger recurrence f(start) = 1, f(y + 1) = f(y) × (1 + r),
 * and that year's tax and penalties), and the summary's four money figures.
 */
function side(options: {
  startYear?: number
  endYear: number
  depletionYear?: number | null
  dob?: string | null
  inflationPct?: number
  taxAndPenalties?: readonly (readonly [number, number])[]
  summary?: Partial<ComparedProjection['summary']>
}): ComparedProjection {
  const startYear = options.startYear ?? 2026
  const rate = (options.inflationPct ?? 2.5) / 100
  const years: YearResult[] = []
  let factor = 1
  for (let year = startYear; year <= options.endYear; year++) {
    const [tax, penalties] = options.taxAndPenalties?.[year - startYear] ?? [0, 0]
    years.push({ year, inflationScale: factor, tax, penalties } as unknown as YearResult)
    factor *= 1 + rate
  }
  return {
    plan: {
      household: {
        people: options.dob === null ? [] : [{ dob: options.dob ?? '1960-01-01' }],
      },
    } as unknown as ComparedProjection['plan'],
    result: { startYear, endYear: options.endYear, depletionYear: options.depletionYear ?? null, years },
    summary: {
      endingNetWorth: 0,
      endingInvestable: 0,
      endingAfterTaxEstate: 0,
      lifetimeTaxesAndPenalties: 0,
      ...options.summary,
    },
  }
}

describeCalculation(
  'plan-headline-money-comparison',
  {
    example: {
      inputs: {
        caseH: { baseline: { end: 2050, estate: 1_000_000 }, proposal: { end: 2050, estate: 1_250_000 } },
        caseI: { baseline: { end: 2050, estate: 1_800_000 }, proposal: { end: 2060, estate: 2_000_000 }, inflationPct: 2.5 },
        caseJ: {
          inflationPct: 2,
          baseline: { end: 2027, taxAndPenalties: [[4_500, 500], [5_100, 0]] },
          proposal: { end: 2028, taxAndPenalties: [[3_000, 0], [3_060, 0], [3_121.2, 0]] },
        },
        caseK: {
          baseline: { end: 2056, inflationPct: 2.5, estate: 1_000_000, lifetime: 100 },
          proposal: { end: 2056, inflationPct: 2.0, estate: 1_100_000, lifetime: 90 },
        },
        caseL: { baselineStart: 2026, proposalStart: 2027 },
        caseM: { baselineEstate: Number.NaN, proposalEstate: 1 },
      },
      expected: {
        caseH: { moneyBasis: 'nominal', estate: { baseline: 1_000_000, proposal: 1_250_000, delta: 250_000 } },
        caseI: {
          moneyBasis: 'today',
          estate: { baseline: 995_175.6375339222, proposal: 863_810.6860865355, delta: -131_364.95144738676 },
          nominalDelta: 200_000,
          baselineFactorReading: 110_575.07,
        },
        caseJ: {
          moneyBasis: 'today',
          lifetime: { baseline: 10_000, proposal: 9_000, delta: -1_000 },
          nominalDelta: -918.8,
          endYearFactorReading: -1_077.28,
        },
        caseK: {
          moneyBasis: 'nominal',
          estate: { baseline: 1_000_000, proposal: 1_100_000, delta: 100_000 },
          lifetime: { baseline: 100, proposal: 90, delta: -10 },
        },
      },
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/compare-plan-money-deltas.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/compare-plan-money-deltas.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, Record<string, unknown>>
    const expected = example.expected as Record<string, Record<string, unknown>>
    const same = (actual: number, want: number, label: string) =>
      expect(withinTolerance(actual, want, example.tolerance), `${label}: actual ${actual}, worksheet ${want}`).toBe(true)

    it('case H: two plans that end in the same year compare nominal figures', () => {
      const c = inputs.caseH as { baseline: { end: number; estate: number }; proposal: { end: number; estate: number } }
      const headline = comparePlanHeadlines(
        side({ endYear: c.baseline.end, summary: { endingAfterTaxEstate: c.baseline.estate } }),
        side({ endYear: c.proposal.end, summary: { endingAfterTaxEstate: c.proposal.estate } }),
      )
      const e = expected.caseH as { moneyBasis: string; estate: Record<string, number> }
      expect(headline.moneyBasis).toBe(e.moneyBasis)
      expect(headline.endingAfterTaxEstate).toEqual(e.estate)
    })

    it('case I: plans ending in 2050 and 2060 compare in 2026 dollars, each by its own factor, and the sign flips', () => {
      const c = inputs.caseI as {
        baseline: { end: number; estate: number }
        proposal: { end: number; estate: number }
        inflationPct: number
      }
      const baseline = side({ endYear: c.baseline.end, inflationPct: c.inflationPct, summary: { endingAfterTaxEstate: c.baseline.estate } })
      const proposal = side({ endYear: c.proposal.end, inflationPct: c.inflationPct, summary: { endingAfterTaxEstate: c.proposal.estate } })
      const headline = comparePlanHeadlines(baseline, proposal)
      const e = expected.caseI as { moneyBasis: string; estate: Record<string, number>; nominalDelta: number; baselineFactorReading: number }
      expect(headline.moneyBasis).toBe(e.moneyBasis)
      expect(headline.startYear).toBe(2026)
      expect(headline.endYear).toEqual({ baseline: 2050, proposal: 2060, delta: 10 })
      same(headline.endingAfterTaxEstate.baseline, e.estate.baseline!, 'baseline estate')
      same(headline.endingAfterTaxEstate.proposal, e.estate.proposal!, 'proposal estate')
      same(headline.endingAfterTaxEstate.delta, e.estate.delta!, 'estate delta')
      // The wrong readings: nominal subtraction across end years, and both
      // sides deflated by the baseline's factor at its own end year.
      expect(c.proposal.estate - c.baseline.estate).toBe(e.nominalDelta)
      const baselineFactor = baseline.result.years.at(-1)!.inflationScale!
      expect(Math.round(((c.proposal.estate - c.baseline.estate) / baselineFactor) * 100) / 100).toBe(e.baselineFactorReading)
      expect(headline.endingAfterTaxEstate.delta).not.toBe(e.baselineFactorReading)
    })

    it('case J: lifetime tax plus penalties is re-summed year by year in 2026 dollars', () => {
      const c = inputs.caseJ as {
        inflationPct: number
        baseline: { end: number; taxAndPenalties: [number, number][] }
        proposal: { end: number; taxAndPenalties: [number, number][] }
      }
      const headline = comparePlanHeadlines(
        side({ endYear: c.baseline.end, inflationPct: c.inflationPct, taxAndPenalties: c.baseline.taxAndPenalties }),
        side({ endYear: c.proposal.end, inflationPct: c.inflationPct, taxAndPenalties: c.proposal.taxAndPenalties }),
      )
      const e = expected.caseJ as { moneyBasis: string; lifetime: Record<string, number>; nominalDelta: number; endYearFactorReading: number }
      expect(headline.moneyBasis).toBe(e.moneyBasis)
      same(headline.lifetimeTaxesAndPenalties.baseline, e.lifetime.baseline!, 'baseline lifetime')
      same(headline.lifetimeTaxesAndPenalties.proposal, e.lifetime.proposal!, 'proposal lifetime')
      same(headline.lifetimeTaxesAndPenalties.delta, e.lifetime.delta!, 'lifetime delta')
      // The wrong readings: the nominal sums, and each sum divided by its end-year factor.
      const nominal = (rows: [number, number][]) => rows.reduce((total, [tax, penalties]) => total + tax + penalties, 0)
      expect(Math.round((nominal(c.proposal.taxAndPenalties) - nominal(c.baseline.taxAndPenalties)) * 100) / 100).toBe(e.nominalDelta)
      const endFactorReading = nominal(c.proposal.taxAndPenalties) / 1.0404 - nominal(c.baseline.taxAndPenalties) / 1.02
      expect(Math.round(endFactorReading * 100) / 100).toBe(e.endYearFactorReading)
    })

    it('case K: one end year stays nominal even when the two plans assume different inflation', () => {
      const c = inputs.caseK as {
        baseline: { end: number; inflationPct: number; estate: number; lifetime: number }
        proposal: { end: number; inflationPct: number; estate: number; lifetime: number }
      }
      const build = (s: typeof c.baseline) =>
        side({
          endYear: s.end,
          inflationPct: s.inflationPct,
          summary: { endingAfterTaxEstate: s.estate, lifetimeTaxesAndPenalties: s.lifetime },
        })
      const headline = comparePlanHeadlines(build(c.baseline), build(c.proposal))
      const e = expected.caseK as { moneyBasis: string; estate: Record<string, number>; lifetime: Record<string, number> }
      expect(headline.moneyBasis).toBe(e.moneyBasis)
      expect(headline.endingAfterTaxEstate).toEqual(e.estate)
      expect(headline.lifetimeTaxesAndPenalties).toEqual(e.lifetime)
    })

    it('cases L and M: different start years and a non-finite figure are refused with a RangeError', () => {
      const l = inputs.caseL as { baselineStart: number; proposalStart: number }
      expect(() =>
        comparePlanHeadlines(side({ startYear: l.baselineStart, endYear: 2050 }), side({ startYear: l.proposalStart, endYear: 2050 })),
      ).toThrow(RangeError)
      const m = inputs.caseM as { baselineEstate: number; proposalEstate: number }
      expect(() =>
        comparePlanHeadlines(
          side({ endYear: 2050, summary: { endingAfterTaxEstate: m.baselineEstate } }),
          side({ endYear: 2050, summary: { endingAfterTaxEstate: m.proposalEstate } }),
        ),
      ).toThrow(RangeError)
    })
  },
)

describeCalculation(
  'plan-headline-longevity-comparison',
  {
    example: {
      inputs: {
        caseA: { baseline: { D: 2046, E: 2052, dob: '1962-01-01' }, proposal: { D: null, E: 2049, dob: '1953-01-01' } },
        caseB: { baseline: { D: 2046, E: 2052, dob: '1962-01-01' }, proposal: { D: 2043, E: 2057, dob: '1962-06-15' } },
        caseC: { baseline: { D: null, E: 2056 }, proposal: { D: null, E: 2056 } },
        caseD: { baseline: { D: null, E: 2056 }, proposal: { D: null, E: 2059 } },
        caseE: { baseline: { D: null, E: 2050 }, proposal: { D: 2056, E: 2060, dob: '1960-01-01' } },
        caseF: { baseline: { D: 2030, E: 2050, dob: '1960-01-01' }, proposal: { D: 2026, E: 2050, dob: '1960-01-01' } },
        caseG: { baseline: { D: 2040, E: 2050, dob: '1960-01-01' }, proposal: { D: 2045, E: 2050, dob: null } },
        caseH: { baseline: { D: 2050, E: 2060, dob: '1960-01-01' }, proposal: { D: null, E: 2049 } },
      },
      expected: {
        caseA: { lastFunded: [2045, 2049], delta: 4, bound: 'atLeast', success: 100, age: [84, null, null] },
        caseB: { lastFunded: [2045, 2042], delta: -3, bound: null, success: 0, age: [84, 81, -3] },
        caseC: { lastFunded: [2056, 2056], delta: null, bound: 'bothFull', success: 0, age: [null, null, null], endYearDelta: 0 },
        caseD: { lastFunded: [2056, 2059], delta: null, bound: 'bothFull', success: 0, age: [null, null, null], endYearDelta: 3 },
        caseE: { lastFunded: [2050, 2055], delta: 5, bound: 'atMost', success: -100, age: [null, 96, null] },
        caseF: { lastFunded: [2029, 2025], delta: -4, bound: null, success: 0, age: [70, 66, -4] },
        caseH: { lastFunded: [2049, 2049], delta: 0, bound: 'atLeast', success: 100, age: [90, null, null] },
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/compare-plan-deltas.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/compare-plan-deltas.mutation.md',
  },
  ({ example }) => {
    type Side = { D: number | null; E: number; dob?: string | null }
    const inputs = example.inputs as Record<string, { baseline: Side; proposal: Side }>
    const expected = example.expected as Record<
      string,
      { lastFunded: [number, number]; delta: number | null; bound: string | null; success: number; age: [number | null, number | null, number | null]; endYearDelta?: number }
    >
    const build = (s: Side) => side({ endYear: s.E, depletionYear: s.D, dob: s.dob === undefined ? '1960-01-01' : s.dob })

    it('cases A to F and H: last funded years, their difference and bound, success points and depletion ages', () => {
      for (const key of ['caseA', 'caseB', 'caseC', 'caseD', 'caseE', 'caseF', 'caseH']) {
        const c = inputs[key]!
        const e = expected[key]!
        const headline = comparePlanHeadlines(build(c.baseline), build(c.proposal))
        expect([headline.moneyLasts.baseline.lastFundedYear, headline.moneyLasts.proposal.lastFundedYear], key).toEqual(e.lastFunded)
        expect(headline.moneyLasts.delta, key).toBe(e.delta)
        expect(headline.moneyLasts.bound, key).toBe(e.bound)
        expect(headline.deterministicSuccessPct.delta, key).toBe(e.success)
        expect(
          [headline.depletionAgePrimary.baseline, headline.depletionAgePrimary.proposal, headline.depletionAgePrimary.delta],
          key,
        ).toEqual(e.age)
        if (e.endYearDelta !== undefined) expect(headline.endYear.delta, key).toBe(e.endYearDelta)
      }
    })

    it('case D: two full plans on different horizons publish no difference, not the gap between their end years', () => {
      const c = inputs.caseD!
      const headline = comparePlanHeadlines(build(c.baseline), build(c.proposal))
      // The wrong readings: the retired value 0 ("they last equally long"), and
      // the difference of last funded years, which is only the horizon gap.
      expect(headline.moneyLasts.delta).not.toBe(0)
      expect(headline.moneyLasts.delta).not.toBe(c.proposal.E - c.baseline.E)
      expect(headline.moneyLasts.delta).toBeNull()
    })

    it('case A: the lasts-through reading on the full side against the last funded year on the other gives +5, not +4', () => {
      const c = inputs.caseA!
      const headline = comparePlanHeadlines(build(c.baseline), build(c.proposal))
      const mixed = c.proposal.E + 1 - (c.baseline.D! - 1)
      expect(mixed).toBe(5)
      expect(headline.moneyLasts.delta).toBe(expected.caseA!.delta)
    })

    it('case G: a depleting side whose first person has no birth date is refused, not given an age', () => {
      const c = inputs.caseG!
      expect(() => comparePlanHeadlines(build(c.baseline), build(c.proposal))).toThrow(RangeError)
    })
  },
)
