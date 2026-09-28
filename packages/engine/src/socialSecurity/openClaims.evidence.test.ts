import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { describeCalculation, worksheetExpectedRows } from '../rules/describeCalculation.js'
import { claimYearOf, isClaimAlreadyMade, openClaims } from './openClaims.js'

const WORKSHEET = 'DOCS/calculations/social-security/social-security-claim-already-made.md'
const MUTATION = 'DOCS/calculations/social-security/social-security-claim-already-made.mutation.md'

const rows = worksheetExpectedRows(WORKSHEET)
const yearOf = (label: string): number => Number(rows.get(label)![0])
const madeOf = (label: string): boolean => rows.get(label)![1] === 'yes'

/** S-E: a couple, High born 1963-06-15 claiming at 62y0m and Low born 1966-01-01 claiming at 70y0m. */
function couple(): Plan {
  let n = 0
  const draft = createEmptyPlan({ newId: () => `claim-made-${++n}` })
  draft.household.filingStatus = 'marriedFilingJointly'
  draft.household.people = [
    { id: 'high', name: 'High', dob: '1963-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 90, source: 'manual' } },
    { id: 'low', name: 'Low', dob: '1966-01-01', sex: 'average', retirementAge: null, longevity: { planningAge: 90, source: 'manual' } },
  ]
  draft.incomes = [
    { type: 'socialSecurity', id: 'ss-high', personId: 'high', piaMonthly: 3_000, earnings: null, claimAge: { years: 62, months: 0 } },
    { type: 'socialSecurity', id: 'ss-low', personId: 'low', piaMonthly: 1_200, earnings: null, claimAge: { years: 70, months: 0 } },
  ]
  const parsed = parsePlan(draft)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describeCalculation(
  'social-security-claim-already-made',
  {
    example: {
      inputs: {
        sA: { dob: '1953-06-15', claimAge: { years: 67, months: 0 }, startYear: 2026 },
        sB: { dob: '1964-11-30', claimAge: { years: 62, months: 0 }, startYear: 2026 },
        sC: { dob: '1964-06-15', claimAge: { years: 62, months: 6 }, startYears: [2026, 2027] },
        sD: { dob: '1962-06-15', claimAges: [62, 64], startYear: 2026 },
        sE: { high: { dob: '1963-06-15', claimAge: 62 }, low: { dob: '1966-01-01', claimAge: 70 }, startYear: 2026 },
      },
      expected: {
        sAClaimYear: yearOf('S-A 1953 at 67'),
        sBClaimYear: yearOf('S-B 1964-11-30 at 62'),
        sCClaimYear: yearOf('S-C 1964 at 62y6m, start 2026'),
        sDCanonical62ClaimYear: yearOf('S-D 1962 canonical 62'),
        sEHighClaimYear: yearOf('S-E High, 1963 at 62'),
      },
      tolerance: 'exact',
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  () => {
    it('S-A to S-D: made exactly when the birth year plus the claim years is before the start year', () => {
      const cases: Array<[string, string, { years: number; months: number }, number]> = [
        ['S-A 1953 at 67', '1953-06-15', { years: 67, months: 0 }, 2026],
        ['S-B 1964-11-30 at 62', '1964-11-30', { years: 62, months: 0 }, 2026],
        ['S-C 1964 at 62y6m, start 2026', '1964-06-15', { years: 62, months: 6 }, 2026],
        ['S-C 1964 at 62y6m, start 2027', '1964-06-15', { years: 62, months: 6 }, 2027],
        ['S-D 1962 canonical 62', '1962-06-15', { years: 62, months: 0 }, 2026],
        ['S-D 1962 at 64', '1962-06-15', { years: 64, months: 0 }, 2026],
      ]
      for (const [label, dob, claimAge, startYear] of cases) {
        expect(claimYearOf({ dob }, claimAge), label).toBe(yearOf(label))
        expect(isClaimAlreadyMade({ dob }, claimAge, startYear), label).toBe(madeOf(label))
      }
    })

    it('S-E: openClaims holds the claim already made and leaves the other open, by the same test', () => {
      const split = openClaims(couple(), 2026)
      expect(split.alreadyClaimed.map((c) => [c.personId, c.claimYear])).toEqual([['high', yearOf('S-E High, 1963 at 62')]])
      expect(split.open.map((c) => [c.personId, c.claimYear])).toEqual([['low', yearOf('S-E Low, 1966 at 70')]])
      expect(madeOf('S-E High, 1963 at 62')).toBe(true)
      expect(madeOf('S-E Low, 1966 at 70')).toBe(false)
    })
  },
)
