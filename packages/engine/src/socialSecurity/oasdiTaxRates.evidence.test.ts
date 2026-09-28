import { expect, it } from 'vitest'

import { describeCalculation, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { FIRST_OASDI_TAX_YEAR, OASDI_TAX_RATE_BY_YEAR } from './oasdiTaxRates.js'

const WORKSHEET = 'DOCS/calculations/social-security/oasdi-tax-rate-history.md'
const MUTATION = 'DOCS/calculations/social-security/oasdi-tax-rate-history.mutation.md'

// One row per year: employee, employer, self-employed ("none" before 1951).
const rows = worksheetExpectedRows(WORKSHEET)
const rate = (cell: string): number | null => (cell === 'none' ? null : worksheetNumber(cell))

describeCalculation(
  'oasdi-tax-rate-history',
  {
    example: {
      inputs: { years: '1937 to 2026' },
      expected: { rowCount: 90, employee1984: 5.4, employer1984: 5.7, employee2011: 4.2, selfEmployed2011: 10.4 },
      tolerance: { abs: 0 },
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  ({ example }) => {
    const expected = example.expected as Record<string, number>

    it('carries SSA\'s effective rate for every year 1937 to 2026, as the worksheet transcribes the table', () => {
      const tableYears = Object.keys(OASDI_TAX_RATE_BY_YEAR).map(Number).sort((a, b) => a - b)
      const sheetYears = [...rows.keys()].map(Number).sort((a, b) => a - b)
      expect(tableYears).toEqual(sheetYears)
      expect(tableYears).toHaveLength(expected.rowCount!)
      expect(tableYears[0]).toBe(FIRST_OASDI_TAX_YEAR)
      const mismatches: string[] = []
      for (const [year, cells] of rows) {
        const row = OASDI_TAX_RATE_BY_YEAR[Number(year)]!
        const sheet = { employee: rate(cells[0]!), employer: rate(cells[1]!), selfEmployed: rate(cells[2]!) }
        if (row.employee !== sheet.employee || row.employer !== sheet.employer || row.selfEmployed !== sheet.selfEmployed) {
          mismatches.push(`${year}: ${JSON.stringify(row)} against ${JSON.stringify(sheet)}`)
        }
      }
      expect(mismatches).toEqual([])
    })

    it('applies the footnotes: the employee\'s 1984 credit and the 2011-2012 reduction, not the employer\'s', () => {
      expect(OASDI_TAX_RATE_BY_YEAR[1984]).toEqual({ employee: expected.employee1984, employer: expected.employer1984, selfEmployed: 11.4 })
      expect(OASDI_TAX_RATE_BY_YEAR[2011]).toEqual({ employee: expected.employee2011, employer: 6.2, selfEmployed: expected.selfEmployed2011 })
      expect(OASDI_TAX_RATE_BY_YEAR[2012]).toEqual(OASDI_TAX_RATE_BY_YEAR[2011])
      expect(OASDI_TAX_RATE_BY_YEAR[1950]!.selfEmployed).toBeNull()
      expect(OASDI_TAX_RATE_BY_YEAR[1951]!.selfEmployed).toBe(2.25)
    })
  },
)
