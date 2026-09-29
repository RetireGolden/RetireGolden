/**
 * Evidence for household-later-retirement: one rule for the household's later
 * retirement, shared by the FI figures and the funded ratio (the independent
 * review's M4 and N3). The thirteen cases and their years are the worksheet's;
 * each runs in list order and reversed, and cases 3, 10 and 11 also run
 * through summarizeProjection and fundedRatioStart to show both surfaces name
 * the same person and year, or price nothing when nobody retires in the plan.
 * Cases 11 to 13 are wages paid past a retirement age, and wages that stop
 * before it (round-one review of #765, issues 1 and 3).
 */
import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { fundedRatioStart } from '../ladder/fundedRatio.js'
import { describeCalculation, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { summarizeProjection } from './compare.js'
import { householdRetirement, householdRetirementClause, notRetiringClause, type RetirementYearRule } from './householdRetirement.js'
import { simulatePlan } from './simulate.js'

const WORKSHEET = 'DOCS/calculations/cash-flow-and-summary/household-later-retirement.md'
const rows = worksheetExpectedRows(WORKSHEET)
const expectedYear = (label: string): number | null => {
  const cell = rows.get(`${label} year`)![0]!
  return cell === 'none' ? null : worksheetNumber(cell)
}
const START = 2026

type Person = Plan['household']['people'][number]
const person = (name: string, dob: string, retirementAge: number | null, planningAge = 90): Person =>
  ({ id: name.toLowerCase(), name, dob, sex: 'average', retirementAge, longevity: { planningAge, source: 'manual' } })
const wages = (personId: string, endAge: number | null) =>
  ({ type: 'wages', id: `w-${personId}`, personId, annualGross: 50_000, endAge, realGrowthPct: 0 }) as Plan['incomes'][number]
const household = (people: Person[], incomes: Plan['incomes'] = []) => ({ household: { people }, incomes }) as unknown as Pick<Plan, 'household' | 'incomes'>

const CASES: { label: string; people: Person[]; incomes?: Plan['incomes']; name: string | null; rule: RetirementYearRule | null; notRetiring: string[] }[] = [
  { label: 'Case 1', people: [person('Robin', '1962-05-01', 65), person('Pat', '1966-02-01', 64)], name: 'Pat', rule: 'retirementAge', notRetiring: [] },
  { label: 'Case 2', people: [person('Sam', '1964-03-01', 66), person('Alex', '1960-03-01', 70)], name: 'Alex', rule: 'retirementAge', notRetiring: [] },
  { label: 'Case 3', people: [person('Sam', '1964-09-02', null, 95), person('Alex', '1962-04-15', 66)], incomes: [wages('sam', null)], name: 'Alex', rule: 'retirementAge', notRetiring: ['sam'] },
  { label: 'Case 4', people: [person('Lee', '1970-01-01', null), person('Chris', '1960-01-01', 68)], incomes: [wages('lee', 60)], name: 'Lee', rule: 'wagesEnd', notRetiring: [] },
  { label: 'Case 5', people: [person('Dana', '1961-01-01', null), person('Kim', '1970-01-01', 61)], name: 'Kim', rule: 'retirementAge', notRetiring: [] },
  { label: 'Case 6', people: [person('Jo', '1964-01-01', null)], name: 'Jo', rule: 'startYear', notRetiring: [] },
  { label: 'Case 7', people: [person('Max', '1950-01-01', null)], incomes: [wages('max', 70)], name: 'Max', rule: 'startYear', notRetiring: [] },
  { label: 'Case 8', people: [person('Ann', '1970-01-01', null, 80)], incomes: [wages('ann', 90)], name: null, rule: null, notRetiring: ['ann'] },
  { label: 'Case 9', people: [person('Bo', '1970-01-01', 85, 80), person('Cy', '1972-01-01', 63)], name: 'Cy', rule: 'retirementAge', notRetiring: ['bo'] },
  { label: 'Case 10', people: [person('Ed', '1966-01-01', null), person('Flo', '1968-01-01', null)], incomes: [wages('ed', null), wages('flo', null)], name: null, rule: null, notRetiring: ['ed', 'flo'] },
  { label: 'Case 11', people: [person('Gus', '1966-01-01', 65), person('Hal', '1964-01-01', 68)], incomes: [wages('gus', 75)], name: 'Gus', rule: 'wagesPastRetirementAge', notRetiring: [] },
  { label: 'Case 12', people: [person('Ivy', '1970-01-01', 62)], incomes: [wages('ivy', 55)], name: 'Ivy', rule: 'retirementAge', notRetiring: [] },
  { label: 'Case 13', people: [person('Jay', '1960-01-01', 67, 85), person('Kay', '1962-01-01', 66)], incomes: [wages('jay', 90)], name: 'Kay', rule: 'retirementAge', notRetiring: ['jay'] },
]

function planOf(people: Person[], incomes: Plan['incomes']): Plan {
  const plan = createEmptyPlan({ newId: () => 'later-retirement', now: () => new Date('2026-06-29T12:00:00.000Z') })
  plan.household.filingStatus = people.length > 1 ? 'marriedFilingJointly' : 'single'
  plan.household.people = people.map((p) => structuredClone(p))
  plan.incomes = incomes
  plan.accounts = [{ type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 500_000, annualContribution: 0 }]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describeCalculation(
  'household-later-retirement',
  {
    example: {
      inputs: { startYear: START, cases: CASES.map(({ label, people, incomes }) => ({ label, people, incomes: incomes ?? [] })) },
      expected: Object.fromEntries([...rows].map(([label, cells]) => [label, cells[0]])),
      tolerance: 'exact',
    },
    worksheet: WORKSHEET,
    mutation: 'DOCS/calculations/cash-flow-and-summary/household-later-retirement.mutation.md',
  },
  () => {
    it('gives each case its year, person and rule, and who works through the plan', () => {
      for (const { label, people, incomes, name, rule, notRetiring } of CASES) {
        const { retirement, notRetiring: left } = householdRetirement(household(people, incomes), START)
        expect([retirement?.year ?? null, retirement?.personId ?? null, retirement?.rule ?? null], label)
          .toEqual([expectedYear(label), name?.toLowerCase() ?? null, rule])
        expect(left.map((p) => p.personId), label).toEqual(notRetiring)
      }
    })

    it('gives the same answer with the people listed the other way round', () => {
      for (const { label, people, incomes } of CASES) {
        expect(householdRetirement(household([...people].reverse(), incomes), START), label)
          .toEqual(householdRetirement(household(people, incomes), START))
      }
    })

    it('names the same person and year on the FI figures and the funded ratio, and who works through the plan', () => {
      const plan = planOf(CASES[2]!.people, [wages('sam', null)])
      const result = simulatePlan(plan, { startYear: START, taxCalculator: createFlatTaxCalculator(0) })
      const fi = summarizeProjection(plan, result, { conversionFreeRun: null }).fiBasis
      const funded = fundedRatioStart(plan, START)
      expect([fi.personId, fi.retirementYear, fi.retirementRule]).toEqual(['alex', expectedYear('Case 3'), 'retirementAge'])
      expect([funded.personId, funded.retirementYear, funded.rule]).toEqual([fi.personId, fi.retirementYear, fi.retirementRule])
      expect(fi.notRetiring.map((p) => p.personId)).toEqual(['sam'])
      expect(funded.notRetiring).toEqual(fi.notRetiring)
      const { retirement, notRetiring } = householdRetirement(plan, START)
      expect(householdRetirementClause(retirement!, 'Alex', retirement!.year, false)).toBe('the year Alex retires')
      expect(notRetiringClause(notRetiring[0]!, 'Sam')).toBe('Sam works through the plan')
    })

    it('prices the first year without wages paid past a retirement age on the FI figures and the funded ratio, and says why', () => {
      const plan = planOf(CASES[10]!.people, CASES[10]!.incomes!)
      const result = simulatePlan(plan, { startYear: START, taxCalculator: createFlatTaxCalculator(0) })
      // The ledger pays Gus's wages through 2040, past his retirement age's 2031.
      const paid = result.years.filter((y) => y.incomes.wages > 0).map((y) => y.year)
      expect([paid[0], paid[paid.length - 1]]).toEqual([START, expectedYear('Case 11')! - 1])
      const summary = summarizeProjection(plan, result, { conversionFreeRun: null })
      expect([summary.fiBasis.personId, summary.fiBasis.retirementYear, summary.fiBasis.retirementRule, summary.fiBasis.spendingYear])
        .toEqual(['gus', expectedYear('Case 11'), 'wagesPastRetirementAge', expectedYear('Case 11')])
      const funded = fundedRatioStart(plan, START)
      expect([funded.personId, funded.fromYear, funded.rule]).toEqual(['gus', expectedYear('Case 11'), 'wagesPastRetirementAge'])
      const { retirement } = householdRetirement(plan, START)
      expect(householdRetirementClause(retirement!, 'Gus', retirement!.year))
        .toBe("the first year without Gus's wages, which continue past Gus's retirement age, the later of your two retirements")
      expect(householdRetirementClause(retirement!, null, retirement!.year, false))
        .toBe('the first year without your wages, which continue past your retirement age')
      const jay = householdRetirement(household(CASES[12]!.people, CASES[12]!.incomes), START).notRetiring[0]!
      expect([jay.rule, notRetiringClause(jay, 'Jay')]).toEqual(['wagesPastRetirementAge', 'Jay works through the plan'])
    })

    it('prices no FI figure and counts no funded ratio when nobody retires in the plan', () => {
      const plan = planOf(CASES[9]!.people, CASES[9]!.incomes!)
      const result = simulatePlan(plan, { startYear: START, taxCalculator: createFlatTaxCalculator(0) })
      const summary = summarizeProjection(plan, result, { conversionFreeRun: null })
      expect([summary.fiNumber, summary.fiYear, summary.fiAge, summary.coastFireNumber]).toEqual([null, null, null, null])
      expect(summary.fiBasis).toMatchObject({ spendingYear: null, spendingSource: 'noRetirementInPlan', personId: null })
      expect(summary.fiBasis.notRetiring.map((p) => p.personId)).toEqual(['ed', 'flo'])
      expect(fundedRatioStart(plan, START).fromYear).toBeNull()
    })
  },
)
