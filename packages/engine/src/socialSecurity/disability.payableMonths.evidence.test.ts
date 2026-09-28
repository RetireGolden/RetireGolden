import { expect, it } from 'vitest'

import type { Plan } from '../model/plan.js'
import { ssdiNotPayableBeforeFraWarning } from '../projection/internal/annualSocialSecurity.js'
import { simulatePlan } from '../projection/simulate.js'
import { basePlan, cash, noTax, validate } from '../projection/simulate.test-support.js'
import {
  describeCalculation,
  withinTolerance,
  worksheetExpectedRows,
  worksheetNumber,
} from '../rules/describeCalculation.js'

const WORKSHEET = 'DOCS/calculations/social-security/ssdi-payable-months.md'
const MUTATION = 'DOCS/calculations/social-security/ssdi-payable-months.mutation.md'

// The Expected table's "Before" and "After" columns, read from the worksheet.
const rows = worksheetExpectedRows(WORKSHEET)
const before = (label: string): number => worksheetNumber(rows.get(label)![0]!)
const after = (label: string): number => worksheetNumber(rows.get(label)![1]!)

/** The worksheet's worker: born 1970-06-15, PIA 2,000, no COLA, projection from 2026. */
function projection(disability: { onsetAge: number; onsetMonth?: number }, claimAgeYears: number) {
  const plan: Plan = basePlan()
  plan.household.people[0] = {
    id: 'p1', name: 'Pat', dob: '1970-06-15', sex: 'average',
    retirementAge: null, longevity: { planningAge: 90, source: 'manual' },
  }
  plan.incomes = [{
    type: 'socialSecurity', id: 'ss-p1', personId: 'p1', piaMonthly: 2_000, earnings: null,
    disability, claimAge: { years: claimAgeYears, months: 0 },
  }]
  plan.accounts = [cash(3_000_000)]
  return simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
}

function yearOf(result: ReturnType<typeof projection>, year: number) {
  return result.years.find((row) => row.year === year)!
}

function expectWithin(actual: number, expected: number, label: string): void {
  expect(
    withinTolerance(actual, expected, { abs: 0.005 }),
    `${label} ${actual} is not within 0.005 of the worksheet's ${expected}`,
  ).toBe(true)
}

const ONSET_TABLE = [
  { label: 'Blank, 2030', onsetMonth: undefined, year: 2030 },
  { label: 'January, 2030', onsetMonth: 1, year: 2030 },
  { label: 'March, 2030', onsetMonth: 3, year: 2030 },
  { label: 'June, 2030', onsetMonth: 6, year: 2030 },
  { label: 'July, 2030', onsetMonth: 7, year: 2030 },
  { label: 'October, 2031', onsetMonth: 10, year: 2031 },
  { label: 'December, 2031', onsetMonth: 12, year: 2031 },
] as const

describeCalculation(
  'ssdi-payable-months',
  {
    example: {
      inputs: {
        worker: { dob: '1970-06-15', piaMonthly: 2_000, fraMonth: '2037-06', inflationPct: 0, startYear: 2026 },
        onsetTable: { onsetAge: 60, onsetMonths: ['blank', 1, 3, 6, 7, 10, 12], claimAge: 62 },
        fraEdges: { onsetAge: 66, onsetMonths: [11, 12], claimAge: 70 },
        fraYearSplit: { onsetAge: 60, onsetMonth: 3 },
      },
      expected: Object.fromEntries([...rows.keys()].map((label) => [label, after(label)])),
      tolerance: { abs: 0.005 },
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  () => {
    it('the onset table: nothing for the five waiting months, the PIA from the sixth month after the onset month', () => {
      for (const row of ONSET_TABLE) {
        const disability = row.onsetMonth === undefined ? { onsetAge: 60 } : { onsetAge: 60, onsetMonth: row.onsetMonth }
        const paid = yearOf(projection(disability, 62), row.year).incomes.socialSecurity
        expectWithin(paid, after(row.label), row.label)
        // The engine before 2026-09-27 paid the full year; every row moves.
        expect(withinTolerance(paid, before(row.label), { abs: 0.005 }), `${row.label} still pays the old full year`).toBe(false)
      }
    })

    it('the November 2036 onset: one disability month, then the automatic conversion at FRA (16,000 in 2037, 2,000 of it SSDI)', () => {
      const result = projection({ onsetAge: 66, onsetMonth: 11 }, 70)
      const y2037 = yearOf(result, 2037)
      expectWithin(y2037.incomes.socialSecurity, after('November 2036 onset, 2037'), 'November 2037')
      expectWithin(y2037.ssdiPaid, after('November 2036 onset, 2037 SSDI'), 'November 2037 SSDI')
      expect(result.warnings).not.toContain(ssdiNotPayableBeforeFraWarning('Pat'))
    })

    it('the December 2036 onset: no disability benefit, a warning, and the claim at 70 at the engine\'s claim-year convention (29,760 in 2040)', () => {
      const result = projection({ onsetAge: 66, onsetMonth: 12 }, 70)
      expectWithin(yearOf(result, 2037).incomes.socialSecurity, after('December 2036 onset, 2037'), 'December 2037')
      expectWithin(yearOf(result, 2040).incomes.socialSecurity, after('December 2036 onset, 2040 (engine claim-year convention)'), 'December 2040')
      // By statute the claim at 70 starts in June 2040 and pays 7 x 2,480.
      expect(yearOf(result, 2040).incomes.socialSecurity).not.toBeCloseTo(7 * 2_480, 2)
      expect(result.years.every((row) => row.ssdiPaid === 0)).toBe(true)
      expect(result.warnings).toContain(ssdiNotPayableBeforeFraWarning('Pat'))
    })

    it('the FRA year is split: SSDI for January to May 2037, the converted benefit from June, none after', () => {
      const result = projection({ onsetAge: 60, onsetMonth: 3 }, 62)
      expectWithin(yearOf(result, 2037).incomes.socialSecurity, 24_000, 'March 2037 total')
      expectWithin(yearOf(result, 2037).ssdiPaid, after('March onset, 2037 SSDI'), 'March 2037 SSDI')
      expectWithin(yearOf(result, 2038).ssdiPaid, after('March onset, 2038 SSDI'), 'March 2038 SSDI')
      expect(withinTolerance(yearOf(result, 2037).ssdiPaid, before('March onset, 2037 SSDI'), { abs: 0.005 })).toBe(false)
    })
  },
)
