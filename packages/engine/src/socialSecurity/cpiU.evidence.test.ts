import { expect, it } from 'vitest'

import { describeCalculation } from '../rules/describeCalculation.js'
import {
  blsApiAnnualAverages,
  blsApiMonthlyValues,
  blsViewerAnnualAverages,
  monthlyMeanAtPublishedPrecision,
  sourceDigest,
  sourceFileNames,
  sourceManifest,
} from '../testing/socialSecuritySources.test-support.js'
import { CPI_U_ANNUAL_AVERAGE, CPI_U_FIRST_YEAR, CPI_U_LATEST_YEAR } from './cpiU.js'

const WORKSHEET = 'DOCS/calculations/social-security/cpi-u-annual-average.md'
const MUTATION = 'DOCS/calculations/social-security/cpi-u-annual-average.mutation.md'

// The publishers' own bytes (DOCS/calculations/social-security/sources/): BLS's
// API responses with the published annual averages (period M13) for 1937-1995
// and 2016-2025, its monthly responses for 1996-2015 (the API refused those
// years' averages), and the data viewer's "Annual" column for every year.
const api = blsApiAnnualAverages()
const viewer = blsViewerAnnualAverages()
const monthly = blsApiMonthlyValues()
const years = Array.from({ length: CPI_U_LATEST_YEAR - CPI_U_FIRST_YEAR + 1 }, (_, i) => CPI_U_FIRST_YEAR + i)

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

    it('carries BLS\'s published annual average for every year 1937 to 2025: the API\'s M13 where it returned one, the data viewer\'s column for 1996-2015', () => {
      const tableYears = Object.keys(CPI_U_ANNUAL_AVERAGE).map(Number).sort((a, b) => a - b)
      expect(tableYears).toEqual(years)
      expect(tableYears).toHaveLength(expected.rowCount!)
      expect(CPI_U_FIRST_YEAR).toBe(expected.first)
      expect(CPI_U_LATEST_YEAR).toBe(expected.latest)
      const mismatches: string[] = []
      for (const year of years) {
        const published = api.get(year) ?? viewer.get(year)
        if (CPI_U_ANNUAL_AVERAGE[year] !== published) mismatches.push(`${year}: ${CPI_U_ANNUAL_AVERAGE[year]} against BLS's ${published}`)
      }
      expect(mismatches).toEqual([])
      // Which source gives which years: the API's averages are missing exactly for 1996-2015.
      expect(years.filter((year) => !api.has(year))).toEqual(Array.from({ length: 20 }, (_, i) => 1996 + i))
    })

    it('the two BLS readings agree: the data viewer\'s column equals the API\'s average in all 69 years both give, and all 89 are in the viewer', () => {
      expect(years.filter((year) => !viewer.has(year))).toEqual([])
      expect(years.filter((year) => api.has(year) && api.get(year) !== viewer.get(year))).toEqual([])
    })

    it('for 1996-2015 the API\'s own monthly values, averaged at BLS precision, give the viewer\'s published average', () => {
      const mismatches: string[] = []
      for (let year = 1996; year <= 2015; year++) {
        const values = monthly.get(year) ?? []
        expect(values, String(year)).toHaveLength(12)
        const mean = monthlyMeanAtPublishedPrecision(year, values)
        if (mean !== viewer.get(year)) mismatches.push(`${year}: monthly mean ${mean} against the viewer's ${viewer.get(year)}`)
      }
      expect(mismatches).toEqual([])
    })

    it('uses the published averages where a recomputed monthly mean differs (1948, 1952, 1953, 1959, 1962, 1966)', () => {
      expect([1948, 1952, 1953, 1959, 1962, 1966].map((year) => CPI_U_ANNUAL_AVERAGE[year])).toEqual([24.1, 26.5, 26.7, 29.1, 30.2, 32.4])
      expect(CPI_U_ANNUAL_AVERAGE[2024]).toBe(313.689)
      expect(CPI_U_ANNUAL_AVERAGE[2025]).toBe(321.943)
    })

    it('the committed sources are the bytes the manifest names, and it names every file', async () => {
      const manifest = sourceManifest()
      expect(manifest.files.map((entry) => entry.file).sort()).toEqual(sourceFileNames().filter((name) => name !== 'manifest.json'))
      for (const entry of manifest.files) {
        expect(await sourceDigest(entry.file), entry.file).toEqual({ bytes: entry.bytes, sha256: entry.sha256 })
      }
    })
  },
)
