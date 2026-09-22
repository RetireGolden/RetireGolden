import { expect, it } from 'vitest'

import type { InsurancePolicy } from '../../model/plan.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { annualInsurancePremiumRows } from './annualInsurancePremiumRows.js'

function expectWithin(
  actual: number,
  target: number,
  tolerance: Parameters<typeof withinTolerance>[2],
  label: string,
): void {
  expect(
    withinTolerance(actual, target, tolerance),
    `${label} ${actual} is not within ${JSON.stringify(tolerance)} of the worksheet's ${target}`,
  ).toBe(true)
}

describeCalculation(
  'spending-insurance-premiums-annual',
  {
    example: {
      inputs: {
        ltcA: { premiumMode: 'lifetime', annualPremium: 1_200, subjectAge: 64, alive: true },
        lifeB: { premiumMode: 'paidUp', annualPremium: 900, subjectAge: 70, alive: true },
        lifeC: { premiumMode: 'untilAge', annualPremium: 600, subjectAge: 65, premiumEndAge: 65, alive: true },
        ltcD: { premiumMode: 'untilAge', annualPremium: 500, subjectAge: 66, premiumEndAge: 65, alive: true },
        lifeE: { premiumMode: 'untilAge', annualPremium: 600, subjectAge: 64, premiumEndAge: 65, alive: true },
      },
      expected: {
        insurancePremiums: 1_200,
        boundaryInsurancePremiums: 600,
        chargedThroughEndAgeWrongReading: 1_800,
        stoppingBoundaryEarlyWrongReading: 0,
        inflatedWrongReading: 1_236,
        chargingPaidUpAndPastEndAgeWrongReading: 2_600,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/spending-insurance-premiums-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/spending-insurance-premiums-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, Record<string, string | number | boolean>>
    const expected = example.expected as Record<string, number>

    const subjectAgeByPersonId = new Map<string, number>([
      ['ltc-a-owner', inputs.ltcA!.subjectAge as number],
      ['life-b-insured', inputs.lifeB!.subjectAge as number],
      ['life-c-insured', inputs.lifeC!.subjectAge as number],
      ['ltc-d-owner', inputs.ltcD!.subjectAge as number],
      ['life-e-insured', inputs.lifeE!.subjectAge as number],
    ])

    /** The worksheet's primary-case table, in its stated order. */
    const policies: readonly InsurancePolicy[] = [
      {
        kind: 'ltc', id: 'ltc-a', name: 'LTC A', owner: 'ltc-a-owner',
        annualPremium: inputs.ltcA!.annualPremium as number,
        premiumMode: 'lifetime',
        benefitMonthly: 0, benefitPeriodYears: 'lifetime', eliminationPeriodDays: 0,
      },
      {
        kind: 'permanentLife', id: 'life-b', name: 'Life B', insured: 'life-b-insured',
        beneficiary: 'estate',
        annualPremium: inputs.lifeB!.annualPremium as number,
        premiumMode: 'paidUp',
        deathBenefit: 0, cashValue: 0, cashValueMode: 'flatRate', cashValueGrowthPct: 0,
      },
      {
        kind: 'permanentLife', id: 'life-c', name: 'Life C', insured: 'life-c-insured',
        beneficiary: 'estate',
        annualPremium: inputs.lifeC!.annualPremium as number,
        premiumMode: 'untilAge',
        premiumEndAge: inputs.lifeC!.premiumEndAge as number,
        deathBenefit: 0, cashValue: 0, cashValueMode: 'flatRate', cashValueGrowthPct: 0,
      },
      {
        kind: 'ltc', id: 'ltc-d', name: 'LTC D', owner: 'ltc-d-owner',
        annualPremium: inputs.ltcD!.annualPremium as number,
        premiumMode: 'untilAge',
        premiumEndAge: inputs.ltcD!.premiumEndAge as number,
        benefitMonthly: 0, benefitPeriodYears: 'lifetime', eliminationPeriodDays: 0,
      },
    ]

    /** The worksheet's boundary case: one policy, one year below its end age. */
    const boundaryPolicies: readonly InsurancePolicy[] = [
      {
        kind: 'permanentLife', id: 'life-e', name: 'Life E', insured: 'life-e-insured',
        beneficiary: 'estate',
        annualPremium: inputs.lifeE!.annualPremium as number,
        premiumMode: 'untilAge',
        premiumEndAge: inputs.lifeE!.premiumEndAge as number,
        deathBenefit: 0, cashValue: 0, cashValueMode: 'flatRate', cashValueGrowthPct: 0,
      },
    ]

    function rowsFor(list: readonly InsurancePolicy[], alive: boolean) {
      return annualInsurancePremiumRows({
        policies: list,
        resolveSubject: (personId) => ({
          alive,
          ageAttained: subjectAgeByPersonId.get(personId) ?? 0,
        }),
      })
    }

    it('charges 1200: the lifetime policy alone, with the paid-up, at-end-age and past-end-age policies skipped', () => {
      const rows = rowsFor(policies, true)
      const total = rows.reduce((sum, row) => sum + row.amount, 0)
      expectWithin(total, expected.insurancePremiums!, example.tolerance, 'expenses.insurancePremiums')

      // Only LTC A is charged: Life B is paid up, Life C has attained its end
      // age of 65, and LTC D is past it.
      expect(rows.map((row) => row.record.policyId)).toEqual(['ltc-a'])

      // No inflation factor is applied: every charged row is its own level
      // nominal premium.
      for (const row of rows) {
        expect(row.amount).toBe(row.record.amount)
      }

      // The worksheet's wrong readings for the primary case.
      expect(
        withinTolerance(total, expected.chargedThroughEndAgeWrongReading!, example.tolerance),
      ).toBe(false)
      expect(withinTolerance(total, expected.inflatedWrongReading!, example.tolerance)).toBe(false)
      expect(
        withinTolerance(total, expected.chargingPaidUpAndPastEndAgeWrongReading!, example.tolerance),
      ).toBe(false)
    })

    it('charges Life E 600 at attained age 64, one year below its end age of 65', () => {
      const rows = rowsFor(boundaryPolicies, true)
      const total = rows.reduce((sum, row) => sum + row.amount, 0)
      expectWithin(
        total,
        expected.boundaryInsurancePremiums!,
        example.tolerance,
        'boundary-case expenses.insurancePremiums',
      )
      expect(rows.map((row) => row.record.policyId)).toEqual(['life-e'])

      // The worksheet's boundary wrong reading: stopping one year early.
      expect(
        withinTolerance(total, expected.stoppingBoundaryEarlyWrongReading!, example.tolerance),
      ).toBe(false)
    })

    it('charges nothing for a policy whose subject is not alive', () => {
      expect(rowsFor(policies, false)).toEqual([])
      expect(rowsFor(boundaryPolicies, false)).toEqual([])
    })
  },
)
