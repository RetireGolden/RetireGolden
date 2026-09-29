import { expect, it } from 'vitest'

import type { AcaYearContract, Plan } from '../../model/plan.js'
import {
  describeCalculation,
  withinTolerance,
  worksheetExpectedRows,
  worksheetNumber,
} from '../../rules/describeCalculation.js'
import { cashAccount, productionTaxCalculator, recurringOrdinaryIncome, validatePlan } from '../../testing/planFixtures.js'
import { createEmptyPlan } from '../../model/plan.js'
import { simulatePlan, type SimulateOptions } from '../simulate.js'

const WORKSHEET = 'DOCS/calculations/medicare-and-aca/aca-contract-premium-basis.md'
const MUTATION = 'DOCS/calculations/medicare-and-aca/aca-contract-premium-basis.mutation.md'

const rows = worksheetExpectedRows(WORKSHEET)
const expected = (label: string): number => worksheetNumber(rows.get(label)![0]!)

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

let counter = 0
function couple(state: string, a: [string, string], b: [string, string], premium: number, contracts: AcaYearContract[]): Plan {
  const plan = createEmptyPlan({ newId: () => `basis-${++counter}`, now: () => new Date('2026-06-29T12:00:00.000Z') })
  plan.household.state = state
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people = [a, b].map(([id, dob]) => ({
    id,
    name: id,
    dob,
    sex: 'average' as const,
    retirementAge: null,
    longevity: { planningAge: 90, source: 'manual' as const },
  }))
  plan.assumptions.inflationPct = 2.5
  plan.assumptions.healthcareExtraInflationPct = 2
  plan.accounts = [cashAccount('cash', 900_000)]
  plan.incomes = [recurringOrdinaryIncome('consulting', 40_000)]
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: premium, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 0, acaYears: contracts }
  return validatePlan(plan)
}

const derived = (year: number): AcaYearContract => ({ year, premiumBasis: 'premiumField', ...FACTS })

function statedBoth(year: number): AcaYearContract {
  const row = new Array<number>(12).fill(700)
  return {
    year,
    fplRegion: 'contiguous',
    taxFamilyMembers: [
      { personId: 'casey', relationship: 'primary', requiredToFile: 'required', magi: 0 },
      { personId: 'drew', relationship: 'spouse', requiredToFile: 'required', magi: 0 },
    ],
    coveredMembers: ['casey', 'drew'].map((personId) => ({ personId, enrollmentPremiumByMonth: [...row], slcspBenchmarkPremiumByMonth: [...row] })),
    ...FACTS,
  }
}

function aca(plan: Plan, year: number, extra: Partial<SimulateOptions> = {}) {
  const result = simulatePlan(plan, { startYear: 2026, taxCalculator: productionTaxCalculator(), ...extra })
  const row = result.years.find((entry) => entry.year === year)
  if (row?.aca === undefined) throw new Error(`no ACA result in ${year}`)
  return row.aca
}

function expectDollars(actual: number, label: string): void {
  expect(withinTolerance(actual, expected(label), { abs: 0.005 }), `${label}: ${actual} against ${expected(label)}`).toBe(true)
}

const householdA = (state = 'CO') =>
  couple(state, ['alex', '1966-02-10'], ['blair', '1961-07-20'], 800, [derived(2026), derived(2027)])
const householdB = (contracts: AcaYearContract[]) => couple('CO', ['casey', '1966-01-01'], ['drew', '1964-01-01'], 700, contracts)

describeCalculation(
  'aca-contract-premium-basis',
  {
    example: {
      inputs: {
        householdA: { people: ['1966-02-10', '1961-07-20'], state: 'CO', premium: 800, inflationPct: 2.5, healthcareExtraPct: 2, basis: 'premiumField' },
        inflationPath2026Pct: 3,
        householdB: { people: ['1966-01-01', '1964-01-01'], drewDeathAge: 62, premium: 700 },
      },
      expected: Object.fromEntries([...rows].map(([label, cells]) => [label, cells[0]])),
      tolerance: { abs: 0.005 },
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  () => {
    it('fills a premium-field contract for each run and year from the premium field, the state and the people alive', () => {
      const a2026 = aca(householdA(), 2026)
      expect(a2026.premiumBasis).toBe('premiumField')
      expect(a2026.fplRegion).toBe('contiguous')
      expectDollars(a2026.grossEnrollmentPremium, 'A 2026 gross enrollment premium')
      expectDollars(a2026.applicableSlcspPremium!, 'A 2026 applicable SLCSP premium')
      expect(a2026.taxFamilySize).toBe(expected('A 2026 tax family size'))
      expectDollars(aca(householdA(), 2027).grossEnrollmentPremium, 'A 2027 gross enrollment premium, plan rates')
      expectDollars(
        aca(householdA(), 2027, { market: { inflationPct: [3, 3, 3] } }).grossEnrollmentPremium,
        'A 2027 gross enrollment premium, 3 percent inflation path',
      )
      expect(aca(householdA('AK'), 2026).fplRegion).toBe('alaska')
    })

    it('holds a stated contract as written and stops charging a member after the death year', () => {
      const deaths = { deathAgeByPersonId: { drew: 62 } }
      const stated = householdB([statedBoth(2026), statedBoth(2027)])
      expectDollars(aca(stated, 2026, deaths).grossEnrollmentPremium, 'B-stated 2026 gross enrollment premium')
      const after = aca(stated, 2027, deaths)
      expectDollars(after.grossEnrollmentPremium, 'B-stated 2027 gross enrollment premium')
      expect(after.premiumBasis).toBe('stated')
      expect(after.supportCodes).toContain('tax-family-member-unknown')

      const premiumField = aca(householdB([derived(2026), derived(2027)]), 2027, deaths)
      expectDollars(premiumField.grossEnrollmentPremium, 'B-derived 2027 gross enrollment premium')
      expect(premiumField.taxFamilySize).toBe(expected('B-derived 2027 tax family size'))
      expect(premiumField.supportCodes).not.toContain('tax-family-member-unknown')
    })

    it('does not read exampleSourceId', () => {
      const plain = householdA()
      const fromExample = { ...structuredClone(plain), exampleSourceId: 'early-retiree-aca' }
      expect(aca(fromExample, 2027, { market: { inflationPct: [3, 3, 3] } })).toStrictEqual(
        aca(plain, 2027, { market: { inflationPct: [3, 3, 3] } }),
      )
    })
  },
)
