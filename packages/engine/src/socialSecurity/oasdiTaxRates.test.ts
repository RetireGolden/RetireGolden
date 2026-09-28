import { expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import { FIRST_OASDI_TAX_YEAR, OASDI_TAX_RATE_BY_YEAR } from './oasdiTaxRates.js'

// 3101(a) imposes the tax on the employee at a flat 6.2 percent. The
// employer pays the same again and a self-employed individual pays both, so
// quoting one figure for the other is a factor of two rather than a rounding.
describeRule('irc-3101-a-oasdi-employee-tax-rate', {
  readings: { employeeShare: 6.2, combinedEmployerAndEmployee: 12.4 },
  accepted: 'employeeShare',
}, ({ accepted, readings }) => {
  it('carries the employee side rather than the combined rate for 2026, the current-law row', () => {
    const current = OASDI_TAX_RATE_BY_YEAR[2026]!
    expect(current.employee).toBe(accepted)
    expect(current.employee).not.toBe(readings.combinedEmployerAndEmployee)
    expect(current.employee + current.employer).toBeCloseTo(readings.combinedEmployerAndEmployee, 10)
    expect(current.selfEmployed).toBe(readings.combinedEmployerAndEmployee)
  })
})

it('covers every year from 1937 through 2026 with no gap, and no self-employment rate before 1951', () => {
  const years = Object.keys(OASDI_TAX_RATE_BY_YEAR).map(Number)
  expect(Math.min(...years)).toBe(FIRST_OASDI_TAX_YEAR)
  expect(Math.max(...years)).toBe(2026)
  expect(years).toHaveLength(2026 - 1937 + 1)
  for (const year of years) {
    const rates = OASDI_TAX_RATE_BY_YEAR[year]!
    expect(rates.selfEmployed === null, String(year)).toBe(year < 1951)
  }
})
