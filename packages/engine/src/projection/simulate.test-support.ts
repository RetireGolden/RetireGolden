import {
  createEmptyPlan,
  parsePlan,
  type Account,
  type IncomeStream,
  type Plan,
} from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'

let counter = 0
export const testIds = () => `sim-${++counter}`
export const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

export const noTax = createFlatTaxCalculator(0)

/** Single person born 1966, retiring at 67 (2033), planning to 90 (2056). */
export function basePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1966-06-15',
    sex: 'average',
    retirementAge: 67,
    longevity: { planningAge: 90, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0 // most tests reason in flat dollars
  plan.assumptions.defaultReturnPct = 0
  return plan
}

export function cash(balance: number, contribution = 0): Account {
  return { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance, annualContribution: contribution }
}

export function taxable(balance: number, costBasis: number): Extract<Account, { type: 'taxable' }> {
  return {
    type: 'taxable',
    id: testIds(),
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance,
    costBasis,
    interestYieldPct: 0,
    dividendYieldPct: 0,
    qualifiedRatio: 0.85,
    reinvestDividends: true,
    annualContribution: 0,
  }
}

export function traditional(balance: number, contribution = 0, owner = 'p1'): Account {
  return { type: 'traditional', id: testIds(), name: '401k', ownerPersonId: owner, annualReturnPct: null, kind: 'employer', balance, annualContribution: contribution }
}

export function traditionalIra(balance: number, contribution = 0, owner = 'p1'): Account {
  return { type: 'traditional', id: testIds(), name: 'IRA', ownerPersonId: owner, annualReturnPct: null, kind: 'ira', balance, annualContribution: contribution }
}

export function wages(annualGross: number, personId = 'p1'): IncomeStream {
  return { type: 'wages', id: testIds(), personId, annualGross, endAge: null, realGrowthPct: 0 }
}

export function validate(plan: Plan): Plan {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

export function socialSecurityIncomeIn(result: ReturnType<typeof simulatePlan>, year: number): number {
  const projectedYear = result.years.find((candidate) => candidate.year === year)
  if (projectedYear === undefined) throw new Error(`expected projection year ${year}`)
  const income = projectedYear.incomes.socialSecurity
  if (!Number.isFinite(income)) throw new Error(`expected finite Social Security income for ${year}`)
  return income
}

export function currentYearAca(
  plan: Plan,
  {
    year = 2026,
    coveredPersonIds = ['p1'],
    coveredMonths = 12,
    monthlyEnrollment = 1_000,
    monthlySlcsp = monthlyEnrollment,
  }: {
    year?: number
    coveredPersonIds?: string[]
    coveredMonths?: number
    monthlyEnrollment?: number
    monthlySlcsp?: number
  } = {},
): void {
  plan.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: monthlyEnrollment,
    applyAcaCredit: true,
    medicareExtrasMonthlyPerPerson: 0,
    acaYears: [
      {
        year,
        fplRegion: 'contiguous',
        taxFamilyMembers: plan.household.people.map((person, index) => ({
          personId: person.id,
          relationship: index === 0 ? 'primary' as const : 'spouse' as const,
          requiredToFile: 'required' as const,
          magi: 0,
        })),
        coveredMembers: coveredPersonIds.map((personId) => ({
          personId,
          enrollmentPremiumByMonth: Array.from({ length: 12 }, (_, month) =>
            month < coveredMonths ? monthlyEnrollment : 0,
          ),
          slcspBenchmarkPremiumByMonth: Array.from({ length: 12 }, (_, month) =>
            month < coveredMonths ? monthlySlcsp : 0,
          ),
        })),
        taxExemptInterest: { state: 'notApplicable', amount: null },
        foreignExclusionAddback: { state: 'notApplicable', amount: null },
        assertions: {
          coverageEligibility: 'supported',
          form8814: 'notApplicable',
          specialAllocation: 'notApplicable',
          marriedFilingSeparatelyException: 'notApplicable',
          selfEmployedHealthInsuranceDeduction: 'notApplicable',
          otherMaterialFacts: 'none',
        },
      },
    ],
  }
}
