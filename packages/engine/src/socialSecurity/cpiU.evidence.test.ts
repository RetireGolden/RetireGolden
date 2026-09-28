import { expect, it } from 'vitest'

import { describeCalculation, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { CPI_U_ANNUAL_AVERAGE, CPI_U_FIRST_YEAR, CPI_U_LATEST_YEAR } from './cpiU.js'

const WORKSHEET = 'DOCS/calculations/social-security/cpi-u-annual-average.md'
const MUTATION = 'DOCS/calculations/social-security/cpi-u-annual-average.mutation.md'

const rows = worksheetExpectedRows(WORKSHEET)

describeCalculation(
  'cpi-u-annual-average',
  {
    example: {
      inputs: { series: 'CUUR0000SA0, annual averages 1937 to 2025' },
      expected: { rowCount: 89, first: 1937, latest: 2025 },
      tolerance: 'exact',
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  ({ example }) => {
    const expected = example.expected as Record<string, number>

    it('carries the annual average for every year 1937 to 2025, as the worksheet transcribes it', () => {
      const tableYears = Object.keys(CPI_U_ANNUAL_AVERAGE).map(Number).sort((a, b) => a - b)
      expect(tableYears).toEqual([...rows.keys()].map(Number).sort((a, b) => a - b))
      expect(tableYears).toHaveLength(expected.rowCount!)
      expect(CPI_U_FIRST_YEAR).toBe(expected.first)
      expect(CPI_U_LATEST_YEAR).toBe(expected.latest)
      const mismatches = [...rows].filter(([year, cells]) => CPI_U_ANNUAL_AVERAGE[Number(year)] !== worksheetNumber(cells[0]!))
      expect(mismatches.map(([year]) => year)).toEqual([])
    })

    it('uses the published averages where a recomputed monthly mean differs (1948, 1952, 1953, 1959, 1962, 1966)', () => {
      expect([1948, 1952, 1953, 1959, 1962, 1966].map((year) => CPI_U_ANNUAL_AVERAGE[year])).toEqual([24.1, 26.5, 26.7, 29.1, 30.2, 32.4])
      expect(CPI_U_ANNUAL_AVERAGE[2024]).toBe(313.689)
      expect(CPI_U_ANNUAL_AVERAGE[2025]).toBe(321.943)
    })
  },
)
