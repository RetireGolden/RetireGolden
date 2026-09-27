import { expect, it } from 'vitest'

import type { IncomeStream, Plan } from '../../model/plan.js'
import {
  describeCalculation,
  withinTolerance,
  worksheetExpectedRows,
  worksheetNumber,
} from '../../rules/describeCalculation.js'
import { attainedAgeMonthsInMonth } from '../../socialSecurity/nra.js'
import { widowEntitlementAgeMonths } from '../../socialSecurity/survivorBenefit.js'
import { simulatePlan } from '../simulate.js'
import { basePlan, cash, noTax, testIds, validate } from '../simulate.test-support.js'

const WORKSHEET = 'DOCS/calculations/social-security/survivor-reduction-entitlement-month.md'
const MUTATION = 'DOCS/calculations/social-security/survivor-reduction-entitlement-month.mutation.md'

// The Expected table's "Before" and "After" columns, read from the worksheet.
const rows = worksheetExpectedRows(WORKSHEET)
const before = (label: string): number => worksheetNumber(rows.get(label)![0]!)
const after = (label: string): number => worksheetNumber(rows.get(label)![1]!)

type Person = Plan['household']['people'][number]
type Claim = { years: number; months: number }

function person(id: string, dob: string, planningAge: number, retirementAge: number | null = null): Person {
  return { id, name: id, dob, sex: 'average', retirementAge, longevity: { planningAge, source: 'manual' } }
}

/** A couple filing jointly; the survivor is `a`. Social Security is published per year. */
function couple(a: Person, b: Person, claimA: Claim, claimB: Claim, piaA: number, piaB: number, wagesEndAge: number | null = null) {
  const plan = basePlan()
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people = [a, b]
  const incomes: IncomeStream[] = [
    { type: 'socialSecurity', id: testIds(), personId: a.id, piaMonthly: piaA, earnings: null, claimAge: claimA },
    { type: 'socialSecurity', id: testIds(), personId: b.id, piaMonthly: piaB, earnings: null, claimAge: claimB },
  ]
  if (wagesEndAge !== null) {
    incomes.push({ type: 'wages', id: testIds(), personId: a.id, annualGross: 40_000, endAge: wagesEndAge, realGrowthPct: 0 })
  }
  plan.incomes = incomes
  plan.accounts = [cash(5_000_000)]
  const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
  return (year: number): number => result.years.find((row) => row.year === year)!.incomes.socialSecurity
}

function expectWithin(actual: number, expected: number, label: string): void {
  expect(
    withinTolerance(actual, expected, { abs: 0.005 }),
    `${label} ${actual} is not within 0.005 of the worksheet's ${expected}`,
  ).toBe(true)
}

describeCalculation(
  'survivor-reduction-entitlement-month',
  {
    example: {
      inputs: {
        caseA: { survivorDob: '1964-06-15', workerDob: '1964-02-10', workerLifeAge: 64, survivorPia: 800, workerPia: 2_000, survivorClaim: '62y0m', workerClaim: '62y0m', year: 2029 },
        caseB: { survivorDob: '1962-09-20', workerDob: '1961-03-05', workerLifeAge: 65, survivorPia: 1_200, workerPia: 2_600, survivorClaim: '62y0m', workerClaim: '63y0m', year: 2027 },
        caseC: { survivorClaim: '66y0m', year: 2028 },
        caseD: { workerClaim: '67y0m', survivorWagesThroughAge: 64, year: 2029 },
        caseE: { workerClaim: '67y0m', survivorWagesThroughAge: 65, year: 2029 },
      },
      expected: {
        entitlementMonthsA: 775,
        entitlementMonthsB: 772,
        entitlementMonthsC: 792,
        caseA: after('A, 2029'),
        caseB: after('B, 2027'),
        caseC: after('C, 2028'),
        caseD: after('D, 2029'),
        caseE: after('E, 2029'),
        beforeA: before('A, 2029'),
        beforeB: before('B, 2027'),
        beforeD: before('D, 2029'),
        beforeE: before('E, 2029'),
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  ({ example }) => {
    const expected = example.expected as Record<string, number>
    const survivorB = person('W', '1962-09-20', 95, 67)
    const workerB = person('H', '1961-03-05', 65, 62)

    it('entitlement ages: the later of the own claim and the January after the year of death (775, 772, 792)', () => {
      expect(attainedAgeMonthsInMonth({ year: 1964, month: 6, day: 15 }, 2029, 1)).toBe(775)
      expect(widowEntitlementAgeMonths({ year: 1964, month: 6, day: 15 }, 2028, 744)).toBe(expected.entitlementMonthsA)
      expect(widowEntitlementAgeMonths({ year: 1962, month: 9, day: 20 }, 2026, 744)).toBe(expected.entitlementMonthsB)
      expect(widowEntitlementAgeMonths({ year: 1962, month: 9, day: 20 }, 2026, 792)).toBe(expected.entitlementMonthsC)
      // A birthday on the 1st attains each age a month earlier.
      expect(attainedAgeMonthsInMonth({ year: 1962, month: 10, day: 1 }, 2026, 12)).toBe(771)
      expect(attainedAgeMonthsInMonth({ year: 1962, month: 10, day: 2 }, 2026, 12)).toBe(770)
    })

    it('case A: the survivor is reduced at her age in January 2029, then held to the limit (19,800, not 15,769.29)', () => {
      const ss = couple(person('L', '1964-06-15', 95, 62), person('H', '1964-02-10', 64, 62), { years: 62, months: 0 }, { years: 62, months: 0 }, 800, 2_000)
      expectWithin(ss(2029), expected.caseA!, 'caseA')
      expect(withinTolerance(ss(2029), expected.beforeA!, example.tolerance)).toBe(false)
    })

    it('case B: first paid as a widow at 772 months, the survivor is paid the 2,145 limit (25,740, not 20,500.07)', () => {
      const ss = couple(survivorB, workerB, { years: 62, months: 0 }, { years: 63, months: 0 }, 1_200, 2_600)
      expectWithin(ss(2027), expected.caseB!, 'caseB')
      expect(withinTolerance(ss(2027), expected.beforeB!, example.tolerance)).toBe(false)
    })

    it('case C: a survivor who claims after the death is reduced from her own claim (25,740 from 2028)', () => {
      const ss = couple(survivorB, workerB, { years: 66, months: 0 }, { years: 63, months: 0 }, 1_200, 2_600)
      expect(ss(2027)).toBe(0)
      expectWithin(ss(2028), expected.caseC!, 'caseC')
    })

    it('case D: months withheld from her own benefit before the death are not credited to the widow(er) benefit', () => {
      const ss = couple(survivorB, workerB, { years: 62, months: 0 }, { years: 67, months: 0 }, 1_200, 2_600, 65)
      expectWithin(ss(2027), expected.caseD!, 'caseD 2027')
      expectWithin(ss(2029), expected.caseD!, 'caseD 2029')
      expect(withinTolerance(ss(2029), expected.beforeD!, example.tolerance)).toBe(false)
    })

    it('case E: months withheld from the widow(er) benefit are credited at the survivor full retirement age', () => {
      const ss = couple(survivorB, workerB, { years: 62, months: 0 }, { years: 67, months: 0 }, 1_200, 2_600, 66)
      expectWithin(ss(2029), expected.caseE!, 'caseE')
      expect(withinTolerance(ss(2029), expected.beforeE!, example.tolerance)).toBe(false)
    })
  },
)
