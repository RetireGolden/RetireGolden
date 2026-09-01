import { describe, expect, it } from 'vitest'

import { packForYear } from '../../params/index.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { PersonYearState } from '../types.js'
import { annualHealthcareExpenses } from './annualHealthcareExpenses.js'

function run(
  plan = singlePersonPlan(),
  peopleStates: PersonYearState[] = [
    { personId: 'p1', ageAttained: 60, alive: true },
  ],
) {
  const { pack, isStandIn } = packForYear(2026)
  const states = new Map(peopleStates.map((state) => [state.personId, state]))
  return annualHealthcareExpenses({
    plan,
    pack,
    year: 2026,
    startYear: 2026,
    peopleStates,
    birthMonthByPerson: new Map([['p1', 1], ['p2', 7]]),
    resolveMagiFor: (year) => ({
      magi: 0,
      source: 'planFallback',
      year,
    }),
    ssa44ActiveInYear: () => false,
    filingStatusForYear: 'single',
    taxFilingStatusForYear: 'single',
    inflFactorFrom: () => 1,
    healthInflFactorFrom: () => 1,
    isStandIn,
    hasModeledPerson: (personId) => states.has(personId),
    resolvePerson: (personId) => states.get(personId)!,
    planHasTaxExemptYieldAttestation: false,
    taxExemptInterest: 0,
  })
}

function acaContract(monthly: number) {
  return {
    year: 2026,
    fplRegion: 'contiguous' as const,
    taxFamilyMembers: [{
      personId: 'p1',
      relationship: 'primary' as const,
      requiredToFile: 'required' as const,
      magi: 0,
    }],
    coveredMembers: [{
      personId: 'p1',
      enrollmentPremiumByMonth: new Array<number>(12).fill(monthly),
      slcspBenchmarkPremiumByMonth: new Array<number>(12).fill(monthly + 1),
    }],
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
}

describe('annualHealthcareExpenses', () => {
  it('preserves partial Medicare-year month allocation and premium folds', () => {
    const plan = singlePersonPlan()
    plan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 100
    plan.expenses.healthcare.medicareExtrasMonthlyPerPerson = 10
    const peopleStates: PersonYearState[] = [
      { personId: 'p1', ageAttained: 64, alive: true },
      { personId: 'p2', ageAttained: 65, alive: true },
    ]
    const result = run(plan, peopleStates)

    expect([...result.marketplaceMonthsByPerson]).toStrictEqual([
      [peopleStates[0], 12],
      [peopleStates[1], 6],
    ])
    expect(result.healthcare - result.medicarePremiums).toBeCloseTo(1_860, 10)
    expect(result.acaActive).toBe(false)
    expect(result.acaInitialSupportCodes).toStrictEqual([])
  })

  it('keeps accepted duplicate person IDs positional for Marketplace months', () => {
    const plan = singlePersonPlan()
    const first = { personId: 'p1', ageAttained: 64, alive: true }
    const second = { personId: 'p1', ageAttained: 66, alive: true }
    const result = run(plan, [first, second])

    expect([...result.marketplaceMonthsByPerson]).toStrictEqual([
      [first, 12],
      [second, 0],
    ])
  })

  it('keeps duplicate-contract max selection and support-code order', () => {
    const plan = singlePersonPlan()
    plan.expenses.healthcare.applyAcaCredit = true
    plan.expenses.healthcare.acaYears = [acaContract(100), acaContract(70)]
    const result = run(plan)

    expect(result.acaContract).toBeUndefined()
    expect(result.acaEnrollmentPremiums).toStrictEqual(
      new Array<number>(12).fill(100),
    )
    expect(result.acaSlcspBenchmarkPremiums).toStrictEqual(
      new Array<number>(12).fill(0),
    )
    expect(result.acaGrossEnrollmentPremium).toBe(1_200)
    expect(result.acaInitialSupportCodes).toStrictEqual([
      'duplicate-year-contract',
    ])
  })

  it('preserves the sole contract and monthly array identities downstream', () => {
    const plan = singlePersonPlan()
    const contract = acaContract(80)
    plan.expenses.healthcare.applyAcaCredit = true
    plan.expenses.healthcare.acaYears = [contract]
    const result = run(plan)

    expect(result.acaContract).toBe(contract)
    expect(result.acaEnrollmentPremiums).toStrictEqual(
      new Array<number>(12).fill(80),
    )
    expect(result.acaSlcspBenchmarkPremiums).toStrictEqual(
      new Array<number>(12).fill(81),
    )
    expect(result.acaInitialSupportCodes).toStrictEqual([])
  })

  it('folds covered-member premiums in positional floating-point order', () => {
    const plan = singlePersonPlan()
    const contract = acaContract(0)
    contract.coveredMembers = [1e16, 1, 2].map((premium, index) => ({
      personId: `covered-${index}`,
      enrollmentPremiumByMonth: [premium],
      slcspBenchmarkPremiumByMonth: [premium],
    }))
    plan.expenses.healthcare.applyAcaCredit = true
    plan.expenses.healthcare.acaYears = [contract]

    const result = run(plan)

    expect(result.acaEnrollmentPremiums[0]).toBe(10_000_000_000_000_002)
    expect(result.acaGrossEnrollmentPremium).toBe(10_000_000_000_000_002)
  })
})
