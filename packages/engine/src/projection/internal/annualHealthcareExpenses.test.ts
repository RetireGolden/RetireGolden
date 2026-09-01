import { describe, expect, it } from 'vitest'

import { packForYear } from '../../params/index.js'
import type { ParameterPack } from '../../params/types.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { PersonYearState } from '../types.js'
import { annualHealthcareExpenses } from './annualHealthcareExpenses.js'

function run(
  plan = singlePersonPlan(),
  peopleStates: PersonYearState[] = [
    { personId: 'p1', ageAttained: 60, alive: true },
  ],
  options: {
    magi?: number
    magiByYear?: ReadonlyMap<number, number>
    ssa44Active?: boolean
    birthMonths?: readonly number[]
    configurePack?: (pack: ParameterPack) => void
  } = {},
) {
  const { pack: sourcePack, isStandIn } = packForYear(2026)
  const pack = structuredClone(sourcePack)
  options.configurePack?.(pack)
  return annualHealthcareExpenses({
    plan,
    pack,
    year: 2026,
    startYear: 2026,
    peopleStates,
    birthMonthByPersonPosition:
      options.birthMonths ?? peopleStates.map((state) => state.personId === 'p2' ? 7 : 1),
    resolveMagiFor: (year) => ({
      magi: options.magiByYear?.get(year) ?? options.magi ?? 0,
      source: 'planFallback',
      year,
    }),
    ssa44ActiveInYear: () => options.ssa44Active ?? false,
    filingStatusForYear: 'single',
    taxFilingStatusForYear: 'single',
    inflFactorFrom: () => 1,
    healthInflFactorFrom: () => 1,
    isStandIn,
    hasModeledPerson: (personId) =>
      peopleStates.some((state) => state.personId === personId),
    resolvePerson: (personId) =>
      peopleStates.find((state) => state.personId === personId)!,
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

    expect(result.marketplaceMonthsByPersonPosition).toStrictEqual([12, 6])
    // 42 U.S.C. 1395c makes age-65 entitlement run in monthly periods, while
    // 42 U.S.C. 1395p(d) centers initial enrollment on first eligibility. This
    // planning proxy therefore starts Medicare in the birth month:
    // p1 has 12 pre-65 months; p2 turns 65 in July and therefore has the
    // discriminating birthMonth - 1 = 6 Marketplace months, not a full-year
    // age flip or the seven months produced by starting after the birth month.
    expect(result.healthcare - result.medicarePremiums).toBe(1_860)
    expect(result.acaActive).toBe(false)
    expect(result.acaInitialSupportCodes).toStrictEqual([])
  })

  it('keeps accepted duplicate person IDs positional for Marketplace months', () => {
    const plan = singlePersonPlan()
    const first = { personId: 'p1', ageAttained: 64, alive: true }
    const second = { personId: 'p1', ageAttained: 66, alive: true }
    const result = run(plan, [first, second])

    expect(result.marketplaceMonthsByPersonPosition).toStrictEqual([12, 0])
  })

  it('keeps age-65 duplicate person IDs positional through distinct birth months', () => {
    const plan = singlePersonPlan()
    const peopleStates: PersonYearState[] = [
      { personId: 'p1', ageAttained: 65, alive: true },
      { personId: 'p1', ageAttained: 65, alive: true },
    ]

    const result = run(plan, peopleStates, { birthMonths: [1, 7] })

    expect(result.marketplaceMonthsByPersonPosition).toStrictEqual([0, 6])
  })

  it('rejects a birth-month row count that is not positional to people state', () => {
    expect(() => run(undefined, undefined, { birthMonths: [] })).toThrow(
      'Healthcare planner birth-month row mismatch',
    )
  })

  it('selects the prior-year SSA-44 MAGI only when it is active and lower', () => {
    const plan = singlePersonPlan()
    const magiByYear = new Map([[2024, 120_000], [2025, 90_000]])

    const standard = run(plan, undefined, { magiByYear })
    const redetermined = run(plan, undefined, {
      magiByYear,
      ssa44Active: true,
    })
    const tied = run(plan, undefined, {
      magiByYear: new Map([[2024, 90_000], [2025, 90_000]]),
      ssa44Active: true,
    })

    expect([standard.irmaaMagi, standard.irmaaLookbackMagiYear]).toStrictEqual([
      120_000, 2024,
    ])
    expect([
      redetermined.irmaaMagi,
      redetermined.irmaaLookbackMagiYear,
    ]).toStrictEqual([90_000, 2025])
    expect(tied.irmaaLookbackMagiYear).toBe(2024)
  })

  it('keeps referenced duplicate person IDs first-wins like simulatePlan', () => {
    const plan = singlePersonPlan()
    plan.exampleSourceId = 'duplicate-person-contract-oracle'
    plan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 100
    plan.expenses.healthcare.applyAcaCredit = true
    plan.expenses.healthcare.acaYears = [acaContract(100)]
    const first = { personId: 'p1', ageAttained: 64, alive: true }
    const second = { personId: 'p1', ageAttained: 66, alive: false }

    const result = run(plan, [first, second])

    expect(result.exampleContractInputMismatch).toBe(false)
    expect(result.acaInitialSupportCodes).not.toContain(
      'tax-family-member-unknown',
    )
    expect(result.acaInitialSupportCodes).not.toContain(
      'medicare-overlap-unsupported',
    )
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

  it('fails closed for duplicate covered members at the direct helper boundary', () => {
    const plan = singlePersonPlan()
    const contract = acaContract(100)
    contract.coveredMembers.push({ ...contract.coveredMembers[0]! })
    plan.expenses.healthcare.applyAcaCredit = true
    plan.expenses.healthcare.acaYears = [contract]

    expect(run(plan).acaInitialSupportCodes).toContain(
      'covered-member-duplicate',
    )
  })

  it('warns when a defensive parameter pack has an unverified Part D tier', () => {
    const plan = singlePersonPlan()
    const peopleStates: PersonYearState[] = [
      { personId: 'p1', ageAttained: 66, alive: true },
    ]

    const result = run(plan, peopleStates, {
      magi: 110_000,
      configurePack: (pack) => {
        pack.medicare.irmaaTiers[0]!.partDSurchargeMonthly = null
      },
    })

    expect(result.warnings).toStrictEqual([
      'An IRMAA tier with an unverified Part D surcharge was hit; Part D surcharge omitted for that tier.',
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
