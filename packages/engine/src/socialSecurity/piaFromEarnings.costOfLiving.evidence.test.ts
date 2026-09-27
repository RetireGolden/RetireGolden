import { expect, it } from 'vitest'

import type { Plan } from '../model/plan.js'
import { simulatePlan } from '../projection/simulate.js'
import { basePlan, cash, noTax, validate } from '../projection/simulate.test-support.js'
import {
  describeCalculation,
  withinTolerance,
  worksheetExpectedRows,
  worksheetNumber,
} from '../rules/describeCalculation.js'
import { piaWithCostOfLivingIncreases } from './piaFromEarnings.js'
import { COLA_PCT_BY_YEAR, LATEST_PUBLISHED_COLA_YEAR } from './ssaWageData.js'

const WORKSHEET = 'DOCS/calculations/social-security/pia-cost-of-living-since-eligibility.md'
const MUTATION = 'DOCS/calculations/social-security/pia-cost-of-living-since-eligibility.mutation.md'

// The Expected table's "Before" and "After" columns, read from the worksheet.
const rows = worksheetExpectedRows(WORKSHEET)
const before = (label: string): number => worksheetNumber(rows.get(label)![0]!)
const after = (label: string): number => worksheetNumber(rows.get(label)![1]!)

function projection(startYear: number, fixedColaPct: number | null) {
  const plan: Plan = basePlan()
  plan.household.people = [
    { id: 'p1', name: 'Worker', dob: '1960-05-01', sex: 'male', retirementAge: 62, longevity: { planningAge: 90, source: 'manual' } },
  ]
  plan.incomes = [{
    type: 'socialSecurity',
    id: 'ss-p1',
    personId: 'p1',
    piaMonthly: null,
    earnings: Array.from({ length: 40 }, (_, index) => ({ year: 1982 + index, amount: 50_000 })),
    claimAge: { years: 67, months: 0 },
  }]
  plan.accounts = [cash(3_000_000)]
  if (fixedColaPct !== null) plan.assumptions.ssCola = { mode: 'fixed', annualPct: fixedColaPct }
  return simulatePlan(validate(plan), { startYear, taxCalculator: noTax })
}

function expectWithin(actual: number, expected: number, label: string): void {
  expect(
    withinTolerance(actual, expected, { abs: 0.005 }),
    `${label} ${actual} is not within 0.005 of the worksheet's ${expected}`,
  ).toBe(true)
}

describeCalculation(
  'pia-cost-of-living-since-eligibility',
  {
    example: {
      inputs: {
        caseA: { dob: '1960-05-01', earnings: '50,000 each year 1982 through 2021', claimAge: '67y0m', eligibilityPia: 2_846.4, eligibilityYear: 2022, startYear: 2026 },
        caseB: { eligibilityPia: 2_551.9, eligibilityYear: 2018, startYear: 2026 },
        caseC: { startYear: 2028, fixedColaPct: 2 },
        publishedColaPct: { 2018: 2.8, 2019: 1.6, 2020: 1.3, 2021: 5.9, 2022: 8.7, 2023: 3.2, 2024: 2.5, 2025: 2.8 },
      },
      expected: {
        caseAPia: after('A, start-year PIA'),
        caseA2027: after('A, 2027'),
        caseBPia: after('B, start-year PIA'),
        caseCPia: after('C, start-year PIA'),
        caseC2028: after('C, 2028'),
        beforeA2027: before('A, 2027'),
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  ({ example }) => {
    const expected = example.expected as Record<string, number>
    const inputs = example.inputs as Record<string, Record<string, number>>

    it('carries SSA\'s published increases through 2025', () => {
      for (const [year, pct] of Object.entries(inputs.publishedColaPct!)) expect(COLA_PCT_BY_YEAR[Number(year)], year).toBe(pct)
      expect(COLA_PCT_BY_YEAR[1999]).toBe(2.5)
      expect(LATEST_PUBLISHED_COLA_YEAR).toBe(2025)
    })

    it('cases A and B: the published chain, floored to the dime each year (3,364.40 and 3,379.20)', () => {
      const a = inputs.caseA!
      const chainA = piaWithCostOfLivingIncreases(a.eligibilityPia!, a.eligibilityYear!, a.startYear! - 1, 0)
      expectWithin(chainA.piaMonthly, expected.caseAPia!, 'caseA PIA')
      expect(chainA.standInYears).toEqual([])
      const b = inputs.caseB!
      expectWithin(piaWithCostOfLivingIncreases(b.eligibilityPia!, b.eligibilityYear!, b.startYear! - 1, 0).piaMonthly, expected.caseBPia!, 'caseB PIA')
      // No step when eligibility is not before the first year.
      expect(piaWithCostOfLivingIncreases(a.eligibilityPia!, 2026, 2025, 0).piaMonthly).toBe(a.eligibilityPia)
    })

    it('case A: the ledger pays the start-year PIA (40,372.80 in 2027, not 34,156.80)', () => {
      const result = projection(2026, null)
      const paid = result.years.find((row) => row.year === 2027)!.incomes.socialSecurity
      expectWithin(paid, expected.caseA2027!, 'caseA 2027')
      expect(withinTolerance(paid, expected.beforeA2027!, example.tolerance)).toBe(false)
      expect(result.warnings.join(' ')).not.toContain('COLA assumption')
    })

    it('case C: unannounced years use the plan\'s COLA assumption, with a warning (42,002.40 in 2028)', () => {
      const c = inputs.caseC!
      expectWithin(piaWithCostOfLivingIncreases(2_846.4, 2022, c.startYear! - 1, c.fixedColaPct!).piaMonthly, expected.caseCPia!, 'caseC PIA')
      expect(piaWithCostOfLivingIncreases(2_846.4, 2022, c.startYear! - 1, c.fixedColaPct!).standInYears).toEqual([2026, 2027])
      const result = projection(c.startYear!, c.fixedColaPct!)
      expectWithin(result.years.find((row) => row.year === 2028)!.incomes.socialSecurity, expected.caseC2028!, 'caseC 2028')
      expect(result.warnings.join(' ')).toContain('COLA assumption')
    })
  },
)
