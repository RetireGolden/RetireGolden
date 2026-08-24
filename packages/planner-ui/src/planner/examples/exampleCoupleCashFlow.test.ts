import { describe, expect, it } from 'vitest'

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

    const refusedYears = result.years
      .filter((year) => year.cashFlow?.reconciliation.status !== 'reconciled')
      .map((year) => ({
        year: year.year,
        reasonCodes: year.cashFlow?.reconciliation.reasonCodes,
      }))
    expect(refusedYears).toEqual([])
  })
})
