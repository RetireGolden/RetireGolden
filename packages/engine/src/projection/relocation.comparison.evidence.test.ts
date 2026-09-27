import { afterEach, expect, it, vi } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { createEmptyPlan, parsePlan, stateForYear, type Plan } from '../model/plan.js'
import * as compare from './compare.js'
import type { ProjectionSummary } from './compare.js'
import { compareRelocationCandidates } from './relocation.js'
import * as simulation from './simulate.js'
import type { ProjectionResult, YearResult } from './types.js'

/** The 64-bit pattern of a double, so a last-bit difference shows. */
function bits(x: number): string {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, x)
  return view.getBigUint64(0).toString(16).padStart(16, '0')
}

/** A validated Kentucky plan ending in `endYear`; its own figures never reach the rows, which come from the seams below. */
function kentuckyPlan(endYear: number, inflationPct: number): Plan {
  let counter = 0
  const plan = createEmptyPlan({
    newId: () => `reloc-cmp-${++counter}`,
    now: () => new Date('2026-06-11T00:00:00.000Z'),
  })
  plan.household.state = 'KY'
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1966-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: endYear - 1966, source: 'manual' },
  }
  plan.assumptions.inflationPct = inflationPct
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.localIncomeTaxPct = 0
  plan.accounts = [
    { type: 'cash', id: 'cash-1', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 100_000, annualContribution: 0 },
  ]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

/**
 * The worksheet's rows at the two seams the row runner reads: the ledger's
 * years (only the year and its inflation factor, built by the ledger
 * recurrence f(start) = 1, f(y + 1) = f(y) × (1 + r)) and the summary's two
 * figures, chosen per row by the row's residence. Everything between the
 * seams and the published row is the real code.
 */
function stubRows(options: {
  startYear: number
  endYear: number
  inflationPct: number
  byState: Record<string, { lifetimeTaxesAndPenalties: number; endingAfterTaxEstate: number }>
}): void {
  const rate = options.inflationPct / 100
  const years: YearResult[] = []
  let factor = 1
  for (let year = options.startYear; year <= options.endYear; year++) {
    years.push({ year, inflationScale: factor } as unknown as YearResult)
    factor *= 1 + rate
  }
  const ledger = {
    startYear: options.startYear,
    endYear: options.endYear,
    years,
    depletionYear: null,
    endingInvestable: 0,
    endingNetWorth: 0,
    endingNondeductibleIraBasis: 0,
    warnings: [],
  } as unknown as ProjectionResult
  vi.spyOn(simulation, 'simulatePlan').mockImplementation(() => ledger)
  vi.spyOn(compare, 'summarizeProjection').mockImplementation((plan) => {
    const state = stateForYear(plan.household, options.endYear)
    const figures = options.byState[state]
    if (figures === undefined) throw new Error('No worksheet row for ' + state)
    return { ...figures, endingNetWorth: figures.endingAfterTaxEstate } as unknown as ProjectionSummary
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describeCalculation(
  'relocation-row-comparison',
  {
    example: {
      inputs: {
        caseN: { baseline: 433_212.4, candidate: 363_292.6 },
        caseP: { estate: 4_058_000, endYear: 2059, inflationPct: 2.5, startYear: 2026 },
        caseQ: { baseline: 163_853.1, candidate: 163_853.1 },
      },
      expected: {
        caseN: -69_919.80000000005,
        caseNBits: 'c0f111fcccccccd0',
        caseP: 1_796_488.6791213197,
        casePBits: '413b6988addae512',
        caseQ: 0,
      },
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/relocation-tax-comparison.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/relocation-tax-comparison.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, Record<string, number>>
    const expected = example.expected as Record<string, number | string>

    it('case N: each row publishes its lifetime sum minus the baseline row\'s, and case O: none on the baseline or a failed row', () => {
      const c = inputs.caseN!
      stubRows({
        startYear: 2026,
        endYear: 2059,
        inflationPct: 2.5,
        byState: {
          KY: { lifetimeTaxesAndPenalties: c.baseline!, endingAfterTaxEstate: 1 },
          FL: { lifetimeTaxesAndPenalties: c.candidate!, endingAfterTaxEstate: 1 },
        },
      })
      const comparison = compareRelocationCandidates(kentuckyPlan(2059, 2.5), [{ state: 'FL' }, { state: 'XXX' }], {
        startYear: 2026,
      })
      const [baseline, florida, failed] = comparison.rows
      const delta = florida!.lifetimeTaxesAndPenaltiesDeltaVsBaseline!
      expect(withinTolerance(delta, expected.caseN as number, example.tolerance), `caseN: ${delta}`).toBe(true)
      expect(bits(delta)).toBe(expected.caseNBits)
      // The wrong reading: baseline minus row shows the lower-tax state as costlier.
      expect(delta).not.toBe(c.baseline! - c.candidate!)
      expect(baseline!.lifetimeTaxesAndPenaltiesDeltaVsBaseline).toBeNull()
      expect(failed!.error).not.toBeNull()
      expect(failed!.lifetimeTaxesAndPenaltiesDeltaVsBaseline).toBeNull()
      expect(failed!.endingAfterTaxEstateTodayDollars).toBeNull()
    })

    it('case P: the estate in the comparison\'s start-year dollars, by the row\'s own factor at its end year', () => {
      const c = inputs.caseP!
      stubRows({
        startYear: c.startYear!,
        endYear: c.endYear!,
        inflationPct: c.inflationPct!,
        byState: { KY: { lifetimeTaxesAndPenalties: 0, endingAfterTaxEstate: c.estate! } },
      })
      const comparison = compareRelocationCandidates(kentuckyPlan(c.endYear!, c.inflationPct!), [], { startYear: c.startYear! })
      const estate = comparison.rows[0]!.endingAfterTaxEstateTodayDollars!
      expect(withinTolerance(estate, expected.caseP as number, example.tolerance), `caseP: ${estate}`).toBe(true)
      expect(bits(estate)).toBe(expected.casePBits)
      // The wrong reading: the nominal estate itself, and the estate deflated
      // one year short (a render-time clock a year later than the run).
      expect(estate).not.toBe(c.estate)
      expect(estate).not.toBe(c.estate! / Math.pow(1.025, c.endYear! - c.startYear! - 1))
    })

    it('case Q: a candidate priced exactly like the baseline publishes a positive zero', () => {
      const c = inputs.caseQ!
      stubRows({
        startYear: 2026,
        endYear: 2059,
        inflationPct: 2.5,
        byState: {
          KY: { lifetimeTaxesAndPenalties: c.baseline!, endingAfterTaxEstate: 1 },
          TX: { lifetimeTaxesAndPenalties: c.candidate!, endingAfterTaxEstate: 1 },
        },
      })
      const comparison = compareRelocationCandidates(kentuckyPlan(2059, 2.5), [{ state: 'TX' }], { startYear: 2026 })
      expect(Object.is(comparison.rows[1]!.lifetimeTaxesAndPenaltiesDeltaVsBaseline, expected.caseQ)).toBe(true)
    })
  },
)
