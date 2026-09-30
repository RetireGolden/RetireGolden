/**
 * Public Law 118-273, the Social Security Fairness Act: sections 2 and 3 strike
 * the Government Pension Offset (42 U.S.C. 402(k)(5)) and the Windfall
 * Elimination Provision (42 U.S.C. 415(a)(7), (d)(3) and (f)(9)), and section 4
 * applies both repeals to monthly benefits payable for months after December
 * 2023. A pension from work Social Security did not cover therefore reduces
 * neither the worker's own benefit nor a spouse's benefit in any year the
 * planner projects.
 *
 * Each contrary reading is the benefit the repealed provision would have paid,
 * worked by hand from the text it had before the repeal:
 * - WEP: a worker first eligible in 2022 (born 1960) with 20 or fewer years of
 *   substantial covered earnings had the 90 percent factor on the first bend
 *   amount replaced by 40 percent, a cut of 50 percent of the 2022 first bend
 *   point, 1,024 x 0.5 = 512 dollars a month, limited to half the non-covered
 *   pension (3,000 / 2 = 1,500). 2,000 - 512 = 1,488 a month, 17,856 a year.
 * - GPO: a spouse's benefit was reduced by two-thirds of the non-covered
 *   pension, 3,000 x 2/3 = 2,000 a month, more than the 1,000 dollar spouse
 *   benefit (half the worker's 2,000 dollar PIA), so it paid nothing.
 * The repeal reading pays the PIA at full retirement age, 2,000 x 12 = 24,000,
 * and the half-PIA spouse benefit, 1,000 x 12 = 12,000.
 */
import { describe, expect, it } from 'vitest'

import type { Account } from '../model/plan.js'
import { describeRule } from '../rules/describeRule.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { cashAccount, couplePlan, singlePersonPlan, socialSecurityIncome, validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { Plan } from '../model/plan.js'
import type { YearResult } from './types.js'

const noTax = createFlatTaxCalculator(0)

function run(plan: Plan): YearResult[] {
  return simulatePlan(validatePlan(plan), { startYear: 2026, taxCalculator: noTax, captureAnnualCashFlow: true }).years
}

function sourceAmount(year: YearResult, id: string): number | undefined {
  return year.cashFlow?.sourceLines.find((row) => row.id === id)?.amountPlanDollars
}

/** A 3,000 dollar monthly pension from state or local work Social Security did not cover. */
function nonCoveredPension(ownerPersonId: string): Account {
  return {
    type: 'pension',
    id: `noncovered-${ownerPersonId}`,
    name: 'Teacher pension',
    ownerPersonId,
    annualReturnPct: 0,
    startAge: 65,
    monthlyAmount: 3_000,
    colaPct: 0,
    survivorPct: 0,
    source: 'stateLocalPublic',
    stateEligibility: { earningsNotCoveredBySocialSecurity: true, contributoryStatus: 'contributory' },
  }
}

function year2027(years: readonly YearResult[]): YearResult {
  const year = years.find((row) => row.year === 2027)
  if (year === undefined) throw new Error('missing 2027')
  return year
}

describe('Social Security Fairness Act repeal of WEP and GPO', () => {
  describeRule('pl-118-273-sec-2-3-wep-gpo-repeal', {
    note: 'own benefit with a non-covered pension',
    readings: { unreducedAfterRepeal: 24_000, windfallEliminationReduced: 17_856 },
    accepted: 'unreducedAfterRepeal',
  }, ({ accepted, readings }) => {
    it('pays the full PIA at full retirement age beside a non-covered pension', () => {
      // Born mid-1960: full retirement age 67y0m, reached in 2027; 0% COLA.
      const plan = singlePersonPlan({ dob: '1960-06-15', planningAge: 90 })
      plan.accounts = [cashAccount('cash-1', 0), nonCoveredPension('p1')]
      plan.incomes = [socialSecurityIncome('ss-p1', 2_000, 67, 'p1')]
      const year = year2027(run(plan))
      const benefit = sourceAmount(year, 'source:socialSecurity:ss-p1')

      expect(sourceAmount(year, 'source:pension:noncovered-p1')).toBeCloseTo(36_000, 6)
      expect(benefit).toBeCloseTo(accepted, 6)
      expect(benefit).not.toBeCloseTo(readings.windfallEliminationReduced, 6)
    })
  })

  describeRule('pl-118-273-sec-2-3-wep-gpo-repeal', {
    note: 'spouse benefit with a non-covered pension',
    readings: { unreducedAfterRepeal: 12_000, governmentPensionOffset: 0 },
    accepted: 'unreducedAfterRepeal',
  }, ({ accepted, readings }) => {
    it('pays the half-PIA spouse benefit to a spouse drawing a non-covered pension', () => {
      const plan = couplePlan({ p1Dob: '1960-06-15', p2Dob: '1960-06-15', p1PlanningAge: 90, p2PlanningAge: 90 })
      plan.accounts = [cashAccount('cash-1', 0), nonCoveredPension('p2')]
      plan.incomes = [
        socialSecurityIncome('ss-p1', 2_000, 67, 'p1'),
        socialSecurityIncome('ss-p2', 0, 67, 'p2'),
      ]
      const year = year2027(run(plan))
      const spouse = sourceAmount(year, 'source:socialSecurity:ss-p2')

      expect(sourceAmount(year, 'source:pension:noncovered-p2')).toBeCloseTo(36_000, 6)
      expect(sourceAmount(year, 'source:socialSecurity:ss-p1')).toBeCloseTo(24_000, 6)
      expect(spouse).toBeCloseTo(accepted, 6)
      expect(spouse).not.toBeCloseTo(readings.governmentPensionOffset, 6)
    })
  })
})
