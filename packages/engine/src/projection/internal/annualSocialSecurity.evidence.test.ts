import { expect, it } from 'vitest'

import type { Plan } from '../../model/plan.js'
import { parsePlan } from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import { createFederalTaxCalculator } from '../../tax/federalTax.js'
import { simulatePlan } from '../simulate.js'
import { annualSocialSecurityPayableMonths } from './annualSocialSecurity.js'

const pack = packForYear(2026).pack

function expectWithin(
  actual: number,
  expected: number,
  tolerance: Parameters<typeof withinTolerance>[2],
  label: string,
): void {
  expect(
    withinTolerance(actual, expected, tolerance),
    `${label} ${actual} is not within ${JSON.stringify(tolerance)} of the worksheet's ${expected}`,
  ).toBe(true)
}

function validated(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describeCalculation(
  'social-security-payable-months',
  {
    example: {
      inputs: {
        claimAgeYears: 65,
        claimAgeMonths: 4,
        ageBeforeClaimYear: 64,
        ageInClaimYear: 65,
        ageAfterClaimYear: 66,
      },
      expected: { beforeClaimYear: 0, claimYear: 8, afterClaimYear: 12 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/social-security/social-security-payable-months.md',
    mutation: 'DOCS/calculations/social-security/social-security-payable-months.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>
    const claimAge = { years: inputs.claimAgeYears!, months: inputs.claimAgeMonths! }

    it('pays 0, then 8, then 12 months around a 65y4m claim', () => {
      expectWithin(
        annualSocialSecurityPayableMonths(inputs.ageBeforeClaimYear!, claimAge),
        expected.beforeClaimYear!,
        example.tolerance,
        'beforeClaimYear',
      )
      expectWithin(
        annualSocialSecurityPayableMonths(inputs.ageInClaimYear!, claimAge),
        expected.claimYear!,
        example.tolerance,
        'claimYear',
      )
      expectWithin(
        annualSocialSecurityPayableMonths(inputs.ageAfterClaimYear!, claimAge),
        expected.afterClaimYear!,
        example.tolerance,
        'afterClaimYear',
      )
    })

    it('excludes the claim month itself, so a whole-year claim pays all twelve', () => {
      // The first wrong reading would pay 9 months here; including the claim
      // month would also push a 65y0m claim past twelve.
      expect(annualSocialSecurityPayableMonths(inputs.ageInClaimYear!, { years: 65, months: 0 })).toBe(12)
      expect(annualSocialSecurityPayableMonths(inputs.ageInClaimYear!, { years: 65, months: 11 })).toBe(1)
    })
  },
)

describeCalculation(
  'social-security-cola-factor',
  {
    example: {
      inputs: {
        projectionStartYear: 2026,
        fixedColaPct: 2.8,
        evaluatedYears: [2026, 2027, 2028],
        startYearMonthlyAmount: 2_000,
      },
      expected: {
        factors: [1, 1.028, 1.056784],
        monthlyAmounts: [2_000, 2_056, 2_113.568],
      },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/social-security/social-security-cola-factor.md',
    mutation: 'DOCS/calculations/social-security/social-security-cola-factor.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | number[]>
    const expected = example.expected as Record<string, number[]>
    const startYear = inputs.projectionStartYear as number
    const years = inputs.evaluatedYears as number[]

    /**
     * The smallest real projection in which the published benefit is exactly
     * PIA x 12 x the COLA factor: one stream already in force (so all twelve
     * months are payable every year), claimed at this person's own FRA (so the
     * claim factor is 1), no wages (no earnings test), no haircut, and no
     * second person to trigger a spousal or survivor step-up.
     */
    const projection = () => {
      const plan = singlePersonPlan({ dob: '1955-03-15', planningAge: 95 })
      plan.assumptions.ssCola = { mode: 'fixed', annualPct: inputs.fixedColaPct as number }
      plan.incomes = [
        {
          type: 'socialSecurity',
          id: 'ss-1',
          personId: 'p1',
          piaMonthly: inputs.startYearMonthlyAmount as number,
          earnings: null,
          claimAge: { years: 66, months: 2 },
        },
      ]
      return simulatePlan(validated(plan), {
        startYear,
        horizonEndYear: years[years.length - 1]!,
        taxCalculator: createFederalTaxCalculator(),
      })
    }

    it('compounds 2.8% from the projection start, leaving the first year unescalated', () => {
      // The pack's published 2026 rate is what the plan's fixed rate is set to.
      expect(pack.socialSecurity.colaPct).toBe(inputs.fixedColaPct)
      const result = projection()
      const benefitFor = (year: number): number => {
        const row = result.years.find((entry) => entry.year === year)
        if (row === undefined) throw new Error(`missing projection year ${year}`)
        return row.incomes.socialSecurity
      }
      const base = benefitFor(startYear)
      years.forEach((year, index) => {
        expectWithin(
          benefitFor(year) / base,
          expected.factors![index]!,
          example.tolerance,
          `ssColaFactor(${year})`,
        )
        expectWithin(
          benefitFor(year) / 12,
          expected.monthlyAmounts![index]!,
          { abs: 0.005 },
          `monthly amount in ${year}`,
        )
      })
    })

    it('does not escalate the first projection year', () => {
      // The first wrong reading applies the COLA once in the start year, which
      // would make every factor one power too high.
      const result = projection()
      const first = result.years.find((entry) => entry.year === startYear)!
      expectWithin(
        first.incomes.socialSecurity,
        (inputs.startYearMonthlyAmount as number) * 12,
        { abs: 0.005 },
        'start-year benefit',
      )
    })
  },
)
