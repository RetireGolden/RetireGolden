import { expect, it } from 'vitest'

import { simulatePlan } from '../projection/simulate.js'
import { basePlan, cash, noTax, validate } from '../projection/simulate.test-support.js'
import { describeCalculation, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { resolveStreamPiaMonthly } from './piaFromEarnings.js'

const WORKSHEET = 'DOCS/calculations/social-security/social-security-pia-resolution.md'
const MUTATION = 'DOCS/calculations/social-security/social-security-pia-resolution.mutation.md'

// Columns: status, PIA.
const rows = worksheetExpectedRows(WORKSHEET)
const pia = (label: string): number => worksheetNumber(rows.get(label)![1]!)

const asOf = { startYear: 2026, colaAssumptionPct: 2.5 }
const person = { dob: '1960-05-01', retirementAge: null }
const history = Array.from({ length: 40 }, (_, i) => ({ year: 1982 + i, amount: 50_000 }))

describeCalculation(
  'social-security-pia-resolution',
  {
    example: {
      inputs: { asOf, person, history: '$50,000 each year 1982-2021' },
      expected: { entered: pia('E'), fromEarnings: pia('H'), eligibilityYear: pia('H eligibility-year PIA') },
      tolerance: { abs: 1e-9 },
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  () => {
    it("an entered PIA as entered; an earnings history's PIA raised by the increases since eligibility (2,846.40 to 3,364.40)", () => {
      expect(resolveStreamPiaMonthly({ piaMonthly: 2_500, earnings: null }, person, asOf)).toEqual({ status: 'entered', piaMonthly: pia('E') })
      const resolved = resolveStreamPiaMonthly({ piaMonthly: null, earnings: history }, person, asOf)
      expect(resolved.status).toBe('fromEarnings')
      if (resolved.status !== 'fromEarnings') return
      expect(resolved.piaMonthly).toBe(pia('H'))
      expect(resolved.detail.piaMonthly).toBe(pia('H eligibility-year PIA'))
      expect(resolved.standInColaYears).toEqual([])
      const eligibilityYear = resolveStreamPiaMonthly({ piaMonthly: null, earnings: history }, person, null)
      expect(eligibilityYear.status === 'fromEarnings' && eligibilityYear.piaMonthly).toBe(pia('H eligibility-year PIA'))
    })

    it("no PIA without one entered or an earnings history, and the computation's error for an eligibility before 1979", () => {
      expect(resolveStreamPiaMonthly({ piaMonthly: null, earnings: null }, person, asOf)).toEqual({ status: 'noPiaNoEarnings' })
      expect(resolveStreamPiaMonthly({ piaMonthly: null, earnings: [] }, person, asOf)).toEqual({ status: 'noPiaNoEarnings' })
      const early = resolveStreamPiaMonthly({ piaMonthly: null, earnings: [{ year: 1970, amount: 30_000 }] }, { dob: '1915-03-01', retirementAge: null }, asOf)
      expect(early.status === 'earningsError' && early.error.code).toBe('eligibility_before_1979')
    })

    it('the projection pays from the resolved PIA: 12 x 3,364.40 in 2027 for a claim at 67, with no COLA after the start', () => {
      const plan = basePlan()
      plan.assumptions.inflationPct = 0
      plan.assumptions.ssCola = { mode: 'fixed', annualPct: 0 }
      plan.household.people = [{ id: 'p', name: 'p', dob: '1960-05-01', sex: 'male', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } }]
      plan.incomes = [{ type: 'socialSecurity', id: 'ss', personId: 'p', piaMonthly: null, earnings: history, claimAge: { years: 67, months: 0 } }]
      plan.accounts = [cash(5_000_000)]
      const row = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax }).years.find((entry) => entry.year === 2027)!
      expect(row.incomes.socialSecurity).toBeCloseTo(12 * pia('H'), 9)
    })
  },
)
