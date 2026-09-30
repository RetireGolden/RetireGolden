/**
 * The benefits-only expected value's branches the worksheet cases do not
 * reach, restored from the retired planner-ui tests and added for the slice
 * review's surviving mutants (F16): a disability onset in the full-retirement-
 * age year, a lone claimant in a two-person household, and the couple
 * results the retired suite pinned.
 */
import { describe, expect, it } from 'vitest'

import type { FormerSpouse, Plan } from '../../model/plan.js'
import { couplePlan, socialSecurityIncome, validatePlan } from '../../testing/planFixtures.js'
import {
  benefitsOnlyRanking,
  disabilityReplacesClaimAge,
  expectedPvCouple,
  expectedPvSingle,
  priceBenefitsOnlyRanking,
  weighBenefitsOnlyRanking,
  type ExpectedValueClaimant,
  type ExpectedValueOptions,
} from './expectedValue.js'

const options: ExpectedValueOptions = {
  startYear: 2026,
  discountRate: 0.02,
  assumptions: { inflationPct: 2.5, ssCola: { mode: 'matchInflation' }, ssHaircut: null },
}
const dob1962 = { year: 1962, month: 6, day: 15 }

describe('disabilityReplacesClaimAge', () => {
  it('is true when a disability month is payable before the full-retirement-age month and false when none is, the ledger\'s schedule', () => {
    const stream = (onsetAge: number, onsetMonth?: number) =>
      ({ ...socialSecurityIncome('ss', 1_500, 67, 'p1'), disability: onsetMonth === undefined ? { onsetAge } : { onsetAge, onsetMonth } }) as Extract<Plan['incomes'][number], { type: 'socialSecurity' }>
    const person = { dob: '1964-09-15' }
    // Born 1964-09-15: full retirement age 67, reached in September 2031.
    expect(disabilityReplacesClaimAge(stream(66), person)).toBe(true)
    // An onset in 2031 read as January 1 first pays in June 2031, before the FRA month.
    expect(disabilityReplacesClaimAge(stream(67), person)).toBe(true)
    // An onset in September 2031 would first pay in March 2032, after it: a retirement claim.
    expect(disabilityReplacesClaimAge(stream(67, 9), person)).toBe(false)
    expect(disabilityReplacesClaimAge(socialSecurityIncome('ss', 1_500, 67, 'p1') as ReturnType<typeof stream>, person)).toBe(false)
  })
})

describe('benefitsOnlyRanking', () => {
  it('prices a lone claimant in a two-person household with the divorced-spouse benefit only after the spouse\'s death (the ledger\'s unmarried gate)', () => {
    const ex: FormerSpouse = { id: 'ex', relationship: 'divorced', dob: '1962-01-10', piaMonthly: 3_000, marriageYears: 15, remarriedAtAge: null }
    const plan = couplePlan({ p1Dob: '1964-06-15', p2Dob: '1965-03-01' })
    plan.household.people[0] = { ...plan.household.people[0]!, sex: 'female' }
    plan.incomes = [{ ...socialSecurityIncome('ss', 800, 67, 'p1'), formerSpouses: [ex] } as Plan['incomes'][number]]
    plan.assumptions = { ...plan.assumptions, ...options.assumptions }
    const ranking = benefitsOnlyRanking(validatePlan(plan), 0.02, 2026)
    const at67 = ranking.rows.find((row) => row.claimByPersonId.p1 === 67)!
    const claimant: ExpectedValueClaimant = { id: 'p1', dob: { year: 1964, month: 6, day: 15 }, sex: 'female', piaMonthly: 800, claimAge: { years: 67, months: 0 }, formerSpouses: [ex] }
    const spouse = plan.household.people[1]!
    expect(at67.expectedPv).toBeCloseTo(expectedPvSingle(claimant, { single: false, spouse: { id: spouse.id, sex: spouse.sex, dob: { year: 1965, month: 3, day: 1 } } }, options), 6)
    expect(at67.expectedPv).toBeGreaterThan(expectedPvSingle(claimant, { single: false }, options))
    expect(at67.expectedPv).toBeLessThan(expectedPvSingle(claimant, { single: true }, options))
  })

  it('keeps nothing between calls: a plan edited in place is priced again, and pricing once then weighing each rate gives the same ranking (PR #769 review, issue 6)', () => {
    const plan = validatePlan({ ...couplePlan({ p1Dob: '1964-06-15', p2Dob: '1965-03-01' }), incomes: [socialSecurityIncome('ss', 1_500, 67, 'p1')] })
    const before = benefitsOnlyRanking(plan, 0.02, 2026)
    const priced = priceBenefitsOnlyRanking(plan, 2026)
    expect(weighBenefitsOnlyRanking(priced, 0.02)).toEqual(before)
    expect(weighBenefitsOnlyRanking(priced, 0.04)).toEqual(benefitsOnlyRanking(plan, 0.04, 2026))
    // The same plan object with a larger PIA: every benefit on this path is in
    // proportion to it, so every row's value rises by 2,000/1,500.
    const stream = plan.incomes[0] as { piaMonthly: number }
    stream.piaMonthly = 2_000
    const after = benefitsOnlyRanking(plan, 0.02, 2026)
    after.rows.forEach((row, index) => expect(row.expectedPv / before.rows[index]!.expectedPv).toBeCloseTo(2_000 / 1_500, 9))
    // The rows priced before the edit keep the old plan's figures.
    expect(weighBenefitsOnlyRanking(priced, 0.02)).toEqual(before)
  })
})

describe('expectedPvSingle and expectedPvCouple, the retired suite\'s results', () => {
  const claimant = (over: Partial<ExpectedValueClaimant> = {}): ExpectedValueClaimant => ({
    dob: dob1962,
    sex: 'average',
    piaMonthly: 2_000,
    claimAge: { years: 67, months: 0 },
    ...over,
  })
  const at = (discountRate: number): ExpectedValueOptions => ({ ...options, discountRate })

  it('a single claimant\'s value falls as the discount rate rises, and delaying pays at 0% but not at 10%', () => {
    expect(expectedPvSingle(claimant(), { single: true }, at(0.05))).toBeLessThan(expectedPvSingle(claimant(), { single: true }, at(0.01)))
    const early = claimant({ claimAge: { years: 64, months: 0 } })
    const late = claimant({ claimAge: { years: 70, months: 0 } })
    expect(expectedPvSingle(late, { single: true }, at(0))).toBeGreaterThan(expectedPvSingle(early, { single: true }, at(0)))
    expect(expectedPvSingle(early, { single: true }, at(0.1))).toBeGreaterThan(expectedPvSingle(late, { single: true }, at(0.1)))
  })

  it('a couple\'s value falls as the discount rate rises', () => {
    const high = claimant({ piaMonthly: 3_000, sex: 'male' })
    const low = claimant({ piaMonthly: 1_000, sex: 'female', dob: { year: 1963, month: 2, day: 10 } })
    const values = [0, 0.02, 0.04, 0.08].map((rate) => expectedPvCouple(high, low, at(rate)))
    for (let i = 1; i < values.length; i++) expect(values[i]!).toBeLessThan(values[i - 1]!)
  })

  it('delaying the higher earner is worth more than delaying the lower earner, since the survivor keeps the larger benefit', () => {
    const high = claimant({ piaMonthly: 3_000, sex: 'male' })
    const low = claimant({ piaMonthly: 1_000, sex: 'female', dob: { year: 1963, month: 2, day: 10 } })
    const delayHigh = expectedPvCouple({ ...high, claimAge: { years: 70, months: 0 } }, { ...low, claimAge: { years: 64, months: 0 } }, options)
    const delayLow = expectedPvCouple({ ...high, claimAge: { years: 64, months: 0 } }, { ...low, claimAge: { years: 70, months: 0 } }, options)
    expect(delayHigh).toBeGreaterThan(delayLow)
    expect(expectedPvCouple(high, low, options)).toBeGreaterThan(expectedPvSingle(high, { single: true }, options))
  })
})
