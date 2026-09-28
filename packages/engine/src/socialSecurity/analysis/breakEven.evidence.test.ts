import { expect, it } from 'vitest'

import { simulatePlan } from '../../projection/simulate.js'
import { basePlan, cash, noTax, validate } from '../../projection/simulate.test-support.js'
import {
  describeCalculation,
  withinTolerance,
  worksheetExpectedRows,
  worksheetNumber,
} from '../../rules/describeCalculation.js'
import { breakEvenClaimAges, claimBreakEven, type ClaimBreakEvenInput } from './breakEven.js'

const WORKSHEET = 'DOCS/calculations/social-security/social-security-claim-break-even.md'
const MUTATION = 'DOCS/calculations/social-security/social-security-claim-break-even.mutation.md'

// The Expected table's values, read from the worksheet.
const rows = worksheetExpectedRows(WORKSHEET)
const value = (label: string): number => {
  const row = rows.get(label)
  if (row === undefined) throw new RangeError(`the worksheet has no Expected row "${label}"`)
  return worksheetNumber(row[0]!)
}

const matchInflation = { inflationPct: 2.5, ssCola: { mode: 'matchInflation' as const }, ssHaircut: null }
const caseA: ClaimBreakEvenInput = {
  dob: { year: 1964, month: 9, day: 2 },
  piaMonthly: 1_950,
  claimAges: [62, 67, 70],
  startYear: 2026,
  assumptions: matchInflation,
  growthPct: 0,
  throughAge: 95,
}
const caseB: ClaimBreakEvenInput = { ...caseA, dob: { year: 1996, month: 1, day: 1 }, piaMonthly: 2_500, throughAge: 90 }
const caseC: ClaimBreakEvenInput = { ...caseA, assumptions: { ...matchInflation, ssHaircut: { fromYear: 2034, cutPct: 17 } } }
const caseD: ClaimBreakEvenInput = {
  dob: { year: 1962, month: 4, day: 15 },
  piaMonthly: 2_900,
  claimAges: [67, 70],
  startYear: 2026,
  assumptions: { inflationPct: 2.5, ssCola: { mode: 'fixed', annualPct: 2 }, ssHaircut: null },
  growthPct: 0,
  throughAge: 92,
}

function atAge(input: ClaimBreakEvenInput, age: number): Readonly<Record<number, number>> {
  const point = claimBreakEven(input).series.find((entry) => entry.age === age)
  if (point === undefined) throw new RangeError(`no chart point at age ${age}`)
  return point.cumulative
}

function expectDollars(actual: number, expected: number, label: string): void {
  expect(withinTolerance(actual, expected, { rel: 1e-9 }), `${label}: ${actual} against the worksheet's ${expected}`).toBe(true)
}

function expectCrossings(input: ClaimBreakEvenInput, labels: readonly string[]): void {
  const crossings = claimBreakEven(input).crossings
  expect(crossings).toHaveLength(labels.length)
  crossings.forEach((crossing, index) => {
    const expected = value(labels[index]!)
    expect(crossing.age !== null && withinTolerance(crossing.age, expected, { abs: 1e-9 }), `${labels[index]}: ${crossing.age}`).toBe(true)
  })
}

describeCalculation(
  'social-security-claim-break-even',
  {
    example: {
      inputs: { caseA, caseB, caseC, caseD },
      expected: {
        aCrossings: [value('A crossing 62 vs 67'), value('A crossing 62 vs 70'), value('A crossing 67 vs 70')],
        printedA: ['75.7', '77.5', '79.5'],
        printedC: ['77.0', '79.0', '81.4'],
      },
      tolerance: { rel: 1e-9 },
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  () => {
    it('case A: crossings 75.709, 77.458 and 79.544, printed 75.7, 77.5 and 79.5', () => {
      expectCrossings(caseA, ['A crossing 62 vs 67', 'A crossing 62 vs 70', 'A crossing 67 vs 70'])
      const printed = claimBreakEven(caseA).crossings.map((crossing) => (Math.round(crossing.age! * 10) / 10).toFixed(1))
      expect(printed).toEqual(['75.7', '77.5', '79.5'])
    })

    it('case A: cumulative dollars at 67 and 80 in the plan\'s dollars, and a claim not yet started is 0', () => {
      const at67 = atAge(caseA, 67)
      expectDollars(at67[62]!, value('A age 67 claim 62'), 'A 67/62')
      expectDollars(at67[67]!, value('A age 67 claim 67'), 'A 67/67')
      expect(at67[70]).toBe(0)
      const at80 = atAge(caseA, 80)
      expectDollars(at80[62]!, value('A age 80 claim 62'), 'A 80/62')
      expectDollars(at80[67]!, value('A age 80 claim 67'), 'A 80/67')
      expectDollars(at80[70]!, value('A age 80 claim 70'), 'A 80/70')
    })

    it('case A at a 5% return: crossings 80.721, 82.372 and 84.532', () => {
      expectCrossings({ ...caseA, growthPct: 5 }, ['A5 crossing 62 vs 67', 'A5 crossing 62 vs 70', 'A5 crossing 67 vs 70'])
    })

    it('case B: a 30-year-old\'s dollars carry the plan\'s factor to 2058, 1.025^32, and the crossings do not move', () => {
      expectDollars(atAge(caseB, 62)[62]!, value('B age 62 claim 62'), 'B 62/62')
      const at80 = atAge(caseB, 80)
      expectDollars(at80[62]!, value('B age 80 claim 62'), 'B 80/62')
      expectDollars(at80[67]!, value('B age 80 claim 67'), 'B 80/67')
      expectDollars(at80[70]!, value('B age 80 claim 70'), 'B 80/70')
      expectCrossings(caseB, ['A crossing 62 vs 67', 'A crossing 62 vs 70', 'A crossing 67 vs 70'])
      // The retired chart's first-year value, 21,000, is not the plan's dollars.
      expect(withinTolerance(atAge(caseB, 62)[62]!, 21_000, { rel: 1e-9 })).toBe(false)
    })

    it('case C: a 17% haircut from 2034 moves the crossings to 76.959, 78.996 and 81.403', () => {
      expectCrossings(caseC, ['C crossing 62 vs 67', 'C crossing 62 vs 70', 'C crossing 67 vs 70'])
      const at80 = atAge(caseC, 80)
      expectDollars(at80[62]!, value('C age 80 claim 62'), 'C 80/62')
      expectDollars(at80[67]!, value('C age 80 claim 67'), 'C 80/67')
      expectDollars(at80[70]!, value('C age 80 claim 70'), 'C 80/70')
    })

    it('case D: a fixed 2% COLA compounds from the start year, not from 62 (36,930.04 at 67)', () => {
      expectCrossings(caseD, ['D crossing 67 vs 70'])
      expectDollars(atAge(caseD, 67)[67]!, value('D age 67 claim 67'), 'D 67/67')
      const at80 = atAge(caseD, 80)
      expectDollars(at80[67]!, value('D age 80 claim 67'), 'D 80/67')
      expectDollars(at80[70]!, value('D age 80 claim 70'), 'D 80/70')
      // The retired chart compounded from 62: 38,422 at 67.
      expect(withinTolerance(atAge(caseD, 67)[67]!, 38_422, { rel: 1e-3 })).toBe(false)
    })

    it('each year of case A is the Social Security the projection pays that person in that year', () => {
      const series = claimBreakEven(caseA).series
      for (const claimAge of [62, 67, 70]) {
        const plan = basePlan()
        plan.assumptions.inflationPct = 2.5
        plan.assumptions.ssCola = { mode: 'matchInflation' }
        plan.household.people = [{ id: 'p', name: 'p', dob: '1964-09-02', sex: 'female', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } }]
        plan.incomes = [{ type: 'socialSecurity', id: 'ss', personId: 'p', piaMonthly: 1_950, earnings: null, claimAge: { years: claimAge, months: 0 } }]
        plan.accounts = [cash(5_000_000)]
        const years = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax }).years
        for (const age of [claimAge, 75, 90]) {
          const index = series.findIndex((point) => point.age === age)
          const paid = series[index]!.cumulative[claimAge]! - (index > 0 ? series[index - 1]!.cumulative[claimAge]! : 0)
          const ledger = years.find((row) => row.year === 1964 + age)!.incomes.socialSecurity
          expect(withinTolerance(paid, ledger, { rel: 1e-12 }), `claim ${claimAge} at ${age}: chart ${paid}, ledger ${ledger}`).toBe(true)
        }
      }
    })

    it('offers 62, the full-retirement-age year and 70, none already past, and refuses a claim age before the start year', () => {
      expect(breakEvenClaimAges({ year: 1964, month: 9, day: 2 }, 2026)).toEqual([62, 67, 70])
      expect(breakEvenClaimAges({ year: 1958, month: 6, day: 1 }, 2026)).toEqual([70])
      expect(breakEvenClaimAges({ year: 1962, month: 4, day: 15 }, 2026)).toEqual([67, 70])
      expect(() => claimBreakEven({ ...caseD, claimAges: [62, 67] })).toThrow(RangeError)
    })
  },
)
