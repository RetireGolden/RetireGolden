import { describe, expect, it } from 'vitest'

import {
  CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS,
  CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS,
} from '@retiregolden/engine/projection/annualCashFlowCapture'
import { projectPlan } from '../../projection'
import { buildExampleCouple } from './buildExampleCouple'
import { EXAMPLE_FIXED_YEAR } from './buildContext'

describe('example couple annual cash flow', () => {
  it('keeps the drill-down available through taxed conversion and RMD years', () => {
    const plan = buildExampleCouple()
    const { result } = projectPlan(plan, {
      startYear: EXAMPLE_FIXED_YEAR,
      captureAnnualCashFlow: true,
    })

    const conversionYears = result.years.filter((year) => year.rothConversion > 0)
    const rmdYears = result.years.filter((year) => year.rmd > 0)
    expect(conversionYears.length).toBeGreaterThan(0)
    expect(rmdYears.length).toBeGreaterThan(0)

    // This fixture discriminates the production rule from the old 1e-6
    // reporting threshold: both kinds of taxed year contain a real funding
    // residual that the solver accepts only under its inclusive $0.005 budget.
    for (const [kind, years] of [
      ['conversion', conversionYears],
      ['RMD', rmdYears],
    ] as const) {
      const fundingBandYears = years.filter((year) => {
        const residual = Math.abs(year.cashFlow?.reconciliation.cash.differencePlanDollars ?? 0)
        return residual > CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS &&
          residual <= CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS
      })
      expect(fundingBandYears.length, `${kind} year exercises the funding residual band`)
        .toBeGreaterThan(0)
      for (const year of fundingBandYears) {
        expect(year.cashFlow?.reconciliation.status).toBe('reconciled')
        expect(year.cashFlow?.reconciliation.cashIdentityTolerancePlanDollars)
          .toBe(CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS)
      }
    }

    const refusedYears = result.years
      .filter((year) => year.cashFlow?.reconciliation.status !== 'reconciled')
      .map((year) => ({
        year: year.year,
        reasonCodes: year.cashFlow?.reconciliation.reasonCodes,
      }))
    expect(refusedYears).toEqual([])
  })
})
