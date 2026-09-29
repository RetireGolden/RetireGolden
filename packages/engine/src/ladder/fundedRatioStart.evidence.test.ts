/**
 * Evidence for funded-ratio-household-start: the funded ratio counts from the
 * household's later retirement and names whose it is, whoever is listed
 * first (decision D-PEOPLE-ORDER), and counts from none when nobody retires
 * in the plan (the independent review's N3). The seven cases and their years
 * are the worksheet's; each is run in list order and reversed.
 */
import { expect, it } from 'vitest'

import { describeCalculation, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { fundedRatioStart } from './fundedRatio.js'

const WORKSHEET = 'DOCS/calculations/ladders-and-valuation/funded-ratio-household-start.md'
const rows = worksheetExpectedRows(WORKSHEET)
const expected = (label: string): number | null => {
  const cell = rows.get(label)![0]!
  return cell === 'none' ? null : worksheetNumber(cell)
}
const START = 2026

type Person = { id: string; name: string; dob: string; sex: 'average'; retirementAge: number | null; longevity: { planningAge: number; source: 'manual' } }
const person = (name: string, dob: string, retirementAge: number | null): Person =>
  ({ id: name.toLowerCase(), name, dob, sex: 'average', retirementAge, longevity: { planningAge: 90, source: 'manual' } })
/** The helper reads the people and their wages. */
const household = (people: Person[], wages: string[] = []) => ({
  household: { people },
  incomes: wages.map((personId) => ({ type: 'wages', id: `w-${personId}`, personId, annualGross: 60_000, endAge: null, realGrowthPct: 0 })),
}) as unknown as Parameters<typeof fundedRatioStart>[0]

const CASES: { label: string; people: Person[]; wages?: string[]; name: string | null }[] = [
  { label: 'Case 1', people: [person('Robin', '1962-05-01', 65), person('Pat', '1966-02-01', 64)], name: 'Pat' },
  { label: 'Case 2', people: [person('Sam', '1964-03-01', 66), person('Alex', '1960-03-01', 70)], name: 'Alex' },
  { label: 'Case 3', people: [person('Chris', '1958-01-01', 60), person('Lee', '1955-01-01', 65)], name: 'Lee' },
  { label: 'Case 4', people: [person('Dana', '1961-01-01', null), person('Kim', '1970-01-01', 61)], name: 'Kim' },
  { label: 'Case 5', people: [person('Jo', '1964-01-01', null)], name: 'Jo' },
  { label: 'Case 6', people: [person('Ann', '1970-01-01', null)], wages: ['ann'], name: null },
  { label: 'Case 7', people: [person('Sam', '1964-09-02', null), person('Alex', '1962-04-15', 66)], wages: ['sam'], name: 'Alex' },
]

describeCalculation(
  'funded-ratio-household-start',
  {
    example: {
      inputs: { startYear: START, cases: CASES.map(({ label, people, wages }) => ({ label, people, wages: wages ?? [] })) },
      expected: Object.fromEntries([...rows].map(([label, cells]) => [label, cells[0]])),
      tolerance: 'exact',
    },
    worksheet: WORKSHEET,
    mutation: 'DOCS/calculations/ladders-and-valuation/funded-ratio-household-start.mutation.md',
  },
  () => {
    it('counts from the later retirement, never before the start year, and names that person', () => {
      for (const { label, people, wages, name } of CASES) {
        const start = fundedRatioStart(household(people, wages), START)
        expect(start.fromYear, label).toBe(expected(`${label} counting year`))
        expect(start.personId, label).toBe(name?.toLowerCase() ?? null)
      }
      // Who works through the plan, left out of the later retirement.
      expect(fundedRatioStart(household(CASES[5]!.people, ['ann']), START).notRetiring.map((p) => p.personId)).toEqual(['ann'])
      expect(fundedRatioStart(household(CASES[6]!.people, ['sam']), START).notRetiring.map((p) => p.personId)).toEqual(['sam'])
      expect(fundedRatioStart(household(CASES[2]!.people), START).retirementYear).toBe(expected('Case 3 retirement year'))
    })

    it('gives the same year and person with the people listed the other way round', () => {
      for (const { label, people, wages } of CASES) {
        expect(fundedRatioStart(household([...people].reverse(), wages), START), label).toEqual(fundedRatioStart(household(people, wages), START))
      }
    })
  },
)
