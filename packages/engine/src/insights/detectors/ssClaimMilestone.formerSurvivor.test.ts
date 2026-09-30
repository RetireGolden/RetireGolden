/**
 * The milestone detector's prior-year former-spouse price against the ledger
 * (PR #769 review, issue 5). The detector asks whether a former spouse's
 * benefit was already paying in the year before the start; it must price that
 * benefit as the ledger's former-spouse pass does (householdYear.ts), including
 * a survivor benefit that a remarriage before 60 barred until the current
 * spouse's death, which starts, and is reduced from, the January after that
 * death (maritalBenefits.ts#formerSpouseSurvivorEntitlementAgeMonths; POMS RS
 * 00207.003 A).
 */
import { expect, it } from 'vitest'

import type { FormerSpouse, IncomeStream, Plan } from '../../model/plan.js'
import { simulatePlan } from '../../projection/simulate.js'
import { basePlan, cash, noTax, testIds, validate } from '../../projection/simulate.test-support.js'
import { priorYearFormerSpouseBenefit } from './ssClaimMilestone.js'

type Person = Plan['household']['people'][number]

function person(id: string, dob: string, planningAge = 95): Person {
  return { id, name: id, dob, sex: 'average', retirementAge: 67, longevity: { planningAge, source: 'manual' } }
}

function ss(personId: string, pia: number, years: number, formerSpouses?: FormerSpouse[]): IncomeStream {
  return { type: 'socialSecurity', id: testIds(), personId, piaMonthly: pia, earnings: null, claimAge: { years, months: 0 }, ...(formerSpouses ? { formerSpouses } : {}) }
}

// The ledger's case B (householdYear.test.ts): J, born 1964-02-10, PIA 600,
// claims at 62. Her first husband died (PIA 3,000, claimed at his full
// retirement age, married 20 years); she remarried at 55, to H, born
// 1962-03-20, who dies in December 2030. From January 2031 she is unmarried and
// the benefit on her first husband is paid, reduced for her age then (803
// months, one before her survivor FRA): 3,000 x (1 - 0.285/84) = 2,989.82 a
// month. Reduced from her own claim at 744 months, as the detector priced it
// before this review: 2,389.29.
it('prices a start-year-2032 claimant\'s 2031 former-spouse survivor benefit as the ledger pays it (case B)', () => {
  const first: FormerSpouse = { id: 'first', relationship: 'deceased', dob: '1958-05-10', piaMonthly: 3_000, marriageYears: 20, remarriedAtAge: 55 }
  const plan = basePlan()
  plan.household.people = [person('H', '1962-03-20', 68), person('J', '1964-02-10')]
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.incomes = [ss('H', 1_000, 67), ss('J', 600, 62, [first])]
  plan.accounts = [cash(10_000_000)]
  const valid = validate(plan)
  const result = simulatePlan(valid, { startYear: 2026, taxCalculator: noTax })
  const row = result.years.find((y) => y.year === 2031)!
  const ledger2031 = (row.socialSecurityStreams ?? []).filter((s) => s.personId === 'J').reduce((sum, s) => sum + s.annualAmount, 0)
  expect(Math.round(ledger2031 * 100) / 100).toBe(35_877.86)

  const prior = priorYearFormerSpouseBenefit({
    plan: valid,
    personId: 'J',
    projectedAge: 2032 - 1964,
    startYear: 2032,
    formerRelationships: ['deceased', 'surviving-divorced'],
    claimantIsSingle: true,
    claimantUnmarriedFromMonthIndex: 2031 * 12,
  })
  expect(prior).not.toBeNull()
  expect(prior!.monthly).toBeCloseTo(ledger2031 / 12, 9)
  expect(Math.round(prior!.monthly * 100) / 100).toBe(2_989.82)
  expect(prior!.annual).toBeCloseTo(ledger2031, 9)
  // Reduced from her own claim, as when the detector took no unmarried month.
  const fromOwnClaim = priorYearFormerSpouseBenefit({
    plan: valid,
    personId: 'J',
    projectedAge: 2032 - 1964,
    startYear: 2032,
    formerRelationships: ['deceased', 'surviving-divorced'],
    claimantIsSingle: true,
    claimantUnmarriedFromMonthIndex: -Infinity,
  })
  expect(Math.round(fromOwnClaim!.monthly * 100) / 100).toBe(2_389.29)
})
