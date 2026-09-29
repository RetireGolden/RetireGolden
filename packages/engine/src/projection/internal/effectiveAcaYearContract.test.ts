/**
 * The contract a run prices (decisions D-EXAMPLE-SOURCE-SWITCH and
 * D-ACA-CONTRACT-PATHS, 2026-09-28). Expected values are hand arithmetic from
 * the decisions' text, not read from the module:
 * - 'premiumField': region from the state lived in that year, tax family from
 *   the people alive (first primary, next spouse, required to file, MAGI 0),
 *   covered members alive with Marketplace months, and each covered month's
 *   premium and benchmark = premium field x this run's health factor;
 * - 'stated': as written, except a covered member not alive this year is
 *   charged nothing.
 */
import { describe, expect, it } from 'vitest'

import type { AcaPremiumFieldYearContract, AcaStatedYearContract, Plan } from '../../model/plan.js'
import { couplePlan } from '../../testing/planFixtures.js'
import type { PersonYearState } from '../types.js'
import { effectiveAcaYearContract, fplRegionForState } from './effectiveAcaYearContract.js'

const FACTS = {
  taxExemptInterest: { state: 'notApplicable' as const, amount: null },
  foreignExclusionAddback: { state: 'notApplicable' as const, amount: null },
  assertions: {
    coverageEligibility: 'supported' as const,
    form8814: 'notApplicable' as const,
    specialAllocation: 'notApplicable' as const,
    marriedFilingSeparatelyException: 'notApplicable' as const,
    selfEmployedHealthInsuranceDeduction: 'notApplicable' as const,
    otherMaterialFacts: 'none' as const,
  },
}

function derived(year: number): AcaPremiumFieldYearContract {
  return { year, premiumBasis: 'premiumField', ...FACTS }
}

function stated(year: number, monthly: number): AcaStatedYearContract {
  const row = new Array<number>(12).fill(monthly)
  return {
    year,
    fplRegion: 'contiguous',
    taxFamilyMembers: [
      { personId: 'p1', relationship: 'primary', requiredToFile: 'required', magi: 0 },
      { personId: 'p2', relationship: 'spouse', requiredToFile: 'required', magi: 0 },
    ],
    coveredMembers: [
      { personId: 'p1', enrollmentPremiumByMonth: [...row], slcspBenchmarkPremiumByMonth: [...row] },
      { personId: 'p2', enrollmentPremiumByMonth: [...row], slcspBenchmarkPremiumByMonth: [...row] },
    ],
    ...FACTS,
  }
}

function plan(state = 'CA', premium = 800): Plan {
  const p = couplePlan({ state, p1Dob: '1968-03-10', p2Dob: '1961-07-20', p1PlanningAge: 95, p2PlanningAge: 95 })
  p.expenses.healthcare.pre65MonthlyPremiumPerPerson = premium
  return p
}

const both: PersonYearState[] = [
  { personId: 'p1', ageAttained: 59, alive: true },
  { personId: 'p2', ageAttained: 66, alive: true },
]

describe('effectiveAcaYearContract, premiumField basis', () => {
  it('fills the region, family, covered members and premiums for this run and year', () => {
    // 2027 on a run whose healthcare factor from 2026 is 1.045: p1 (59) has 12
    // Marketplace months, p2 (66) none. 800 x 1.045 = 836 a month for p1.
    const out = effectiveAcaYearContract(derived(2027), {
      plan: plan(),
      year: 2027,
      peopleStates: both,
      marketplaceMonthsByPersonPosition: [12, 0],
      healthInflFactor: 1.045,
    })
    expect(out.premiumBasis).toBe('premiumField')
    expect(out.fplRegion).toBe('contiguous')
    // The older person (p2, 66) is the primary, whoever is listed first
    // (the canonical people order; the labels only count).
    expect(out.taxFamilyMembers).toStrictEqual([
      { personId: 'p2', relationship: 'primary', requiredToFile: 'required', magi: 0 },
      { personId: 'p1', relationship: 'spouse', requiredToFile: 'required', magi: 0 },
    ])
    expect(out.coveredMembers.map((member) => member.personId)).toStrictEqual(['p1'])
    const premium = out.coveredMembers[0]!.enrollmentPremiumByMonth
    expect(premium.every((value) => Math.abs(value - 836) < 1e-9)).toBe(true)
    expect(out.coveredMembers[0]!.slcspBenchmarkPremiumByMonth).toStrictEqual(premium)
    expect(out.taxExemptInterest).toStrictEqual(FACTS.taxExemptInterest)
    expect(out.assertions).toStrictEqual(FACTS.assertions)
  })

  it('covers only the months before Medicare in the year of 65, at the start-year premium', () => {
    // 2026, factor 1: p2 turns 65 in July, so January to June (6 months).
    const out = effectiveAcaYearContract(derived(2026), {
      plan: plan(),
      year: 2026,
      peopleStates: [
        { personId: 'p1', ageAttained: 58, alive: true },
        { personId: 'p2', ageAttained: 65, alive: true },
      ],
      marketplaceMonthsByPersonPosition: [12, 6],
      healthInflFactor: 1,
    })
    expect(out.coveredMembers[1]!.enrollmentPremiumByMonth).toStrictEqual([800, 800, 800, 800, 800, 800, 0, 0, 0, 0, 0, 0])
    expect(out.coveredMembers[0]!.enrollmentPremiumByMonth).toStrictEqual(new Array<number>(12).fill(800))
  })

  it('derives the family from the people alive this run, so a survivor is the primary', () => {
    // p1 has died on this run; p2 (62) is alive and covered all year.
    const out = effectiveAcaYearContract(derived(2023), {
      plan: plan(),
      year: 2023,
      peopleStates: [
        { personId: 'p1', ageAttained: 55, alive: false },
        { personId: 'p2', ageAttained: 62, alive: true },
      ],
      marketplaceMonthsByPersonPosition: [0, 12],
      healthInflFactor: 1,
    })
    expect(out.taxFamilyMembers).toStrictEqual([
      { personId: 'p2', relationship: 'primary', requiredToFile: 'required', magi: 0 },
    ])
    expect(out.coveredMembers.map((member) => member.personId)).toStrictEqual(['p2'])
  })

  it('takes the region from the state lived in that year', () => {
    expect(fplRegionForState('AK')).toBe('alaska')
    expect(fplRegionForState('HI')).toBe('hawaii')
    expect(fplRegionForState('KY')).toBe('contiguous')
    const alaska = effectiveAcaYearContract(derived(2027), {
      plan: plan('AK'),
      year: 2027,
      peopleStates: both,
      marketplaceMonthsByPersonPosition: [12, 0],
      healthInflFactor: 1,
    })
    expect(alaska.fplRegion).toBe('alaska')
  })

  it('takes the region from a move, year by year (the state lived in that year, not the starting state)', () => {
    // Starting in Alaska, moving to Hawaii from 2030 and to Colorado from
    // 2033: 2029 is Alaska's table, 2030 to 2032 Hawaii's, 2033 contiguous.
    const moved = plan('AK')
    moved.household.stateMoves = [
      { fromYear: 2030, fromMonth: 7, state: 'HI' },
      { fromYear: 2033, fromMonth: 1, state: 'CO' },
    ]
    const regionIn = (year: number) =>
      effectiveAcaYearContract(derived(year), {
        plan: moved,
        year,
        peopleStates: both,
        marketplaceMonthsByPersonPosition: [12, 0],
        healthInflFactor: 1,
      }).fplRegion
    expect([2029, 2030, 2032, 2033].map(regionIn)).toEqual(['alaska', 'hawaii', 'hawaii', 'contiguous'])
  })

  it('keeps the facts the contract stores: its assertions, tax-exempt interest and foreign exclusion', () => {
    const stored: AcaPremiumFieldYearContract = {
      ...derived(2027),
      taxExemptInterest: { state: 'known', amount: 2_500 },
      foreignExclusionAddback: { state: 'unknown', amount: null },
      assertions: { ...FACTS.assertions, coverageEligibility: 'unsupported', otherMaterialFacts: 'unsupported' },
    }
    const out = effectiveAcaYearContract(stored, {
      plan: plan(),
      year: 2027,
      peopleStates: both,
      marketplaceMonthsByPersonPosition: [12, 0],
      healthInflFactor: 1,
    })
    expect(out.taxExemptInterest).toStrictEqual({ state: 'known', amount: 2_500 })
    expect(out.foreignExclusionAddback).toStrictEqual({ state: 'unknown', amount: null })
    expect(out.assertions).toStrictEqual(stored.assertions)
  })
})

describe('effectiveAcaYearContract, stated basis', () => {
  it('uses the stated figures as written, whatever the run\'s inflation', () => {
    const contract = stated(2027, 700)
    const out = effectiveAcaYearContract(contract, {
      plan: plan(),
      year: 2027,
      peopleStates: [
        { personId: 'p1', ageAttained: 59, alive: true },
        { personId: 'p2', ageAttained: 61, alive: true },
      ],
      marketplaceMonthsByPersonPosition: [12, 12],
      healthInflFactor: 1.2,
    })
    expect(out).toStrictEqual({ ...contract, premiumBasis: 'stated' })
    expect(out.coveredMembers).toBe(contract.coveredMembers)
  })

  it('charges nothing for a covered member who is not alive this year, and keeps the stated family', () => {
    const contract = stated(2027, 700)
    const out = effectiveAcaYearContract(contract, {
      plan: plan(),
      year: 2027,
      peopleStates: [
        { personId: 'p1', ageAttained: 59, alive: true },
        { personId: 'p2', ageAttained: 61, alive: false },
      ],
      marketplaceMonthsByPersonPosition: [12, 0],
      healthInflFactor: 1,
    })
    expect(out.coveredMembers[0]!.enrollmentPremiumByMonth).toStrictEqual(new Array<number>(12).fill(700))
    expect(out.coveredMembers[1]!.enrollmentPremiumByMonth).toStrictEqual(new Array<number>(12).fill(0))
    expect(out.coveredMembers[1]!.slcspBenchmarkPremiumByMonth).toStrictEqual(new Array<number>(12).fill(0))
    // The stated tax family is left as written: it no longer describes the
    // household, which the engine refuses to price (tax-family-member-unknown).
    expect(out.taxFamilyMembers).toBe(contract.taxFamilyMembers)
    // The input is not mutated.
    expect(contract.coveredMembers[1]!.enrollmentPremiumByMonth).toStrictEqual(new Array<number>(12).fill(700))
  })
})
