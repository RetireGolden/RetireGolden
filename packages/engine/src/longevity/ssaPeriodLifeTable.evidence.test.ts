import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import {
  CURRENT_LIFE_TABLE_EDITION,
  KNOWN_LIFE_TABLE_EDITIONS,
  LAST_TABLE_AGE,
  LIFE_TABLE_EDITION_BEFORE_THE_FIELD,
  SSA_PERIOD_LIFE_TABLE,
  baselineRemainingYears,
  isCurrentLifeTableEdition,
  knownLifeTableEdition,
  storedLifeTableEdition,
} from './ssaPeriodLifeTable.js'

const WORKSHEET = 'DOCS/calculations/longevity/ssa-period-life-table.md'
const MUTATION = 'DOCS/calculations/longevity/ssa-period-life-table.mutation.md'

// One row per exact age: male q, male e, female q, female e, as SSA prints them.
const rows = worksheetExpectedRows(WORKSHEET)

/** SHA-256 of a UTF-8 string, through WebCrypto (the engine's compile-time surface carries no node types). */
async function sha256Hex(text: string): Promise<string> {
  interface MinimalWebCrypto {
    subtle: { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> }
  }
  const { TextEncoder: TextEncoderConstructor } = globalThis as unknown as {
    TextEncoder: new () => { encode(input: string): Uint8Array }
  }
  const webCrypto = crypto as unknown as MinimalWebCrypto
  const digest = await webCrypto.subtle.digest('SHA-256', new TextEncoderConstructor().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

describeCalculation(
  'ssa-period-life-table',
  {
    example: {
      inputs: { table: 'SSA Table 4C6, period 2023, 2026 Trustees Report', ages: '0 to 119' },
      expected: { rowCount: 120, lastAge: 119, periodYear: 2023, trusteesReportYear: 2026 },
      tolerance: 'exact',
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  ({ example }) => {
    const expected = example.expected as Record<string, number>
    const { male, female, source } = SSA_PERIOD_LIFE_TABLE

    it('carries SSA\'s q and e for both sexes at every age 0 to 119, cell for cell as the worksheet transcribes the page', () => {
      const ages = [...rows.keys()].map(Number)
      expect(ages).toEqual(Array.from({ length: expected.rowCount! }, (_, age) => age))
      for (const column of [male.q, male.e, female.q, female.e]) expect(column).toHaveLength(expected.rowCount!)
      const mismatches: string[] = []
      for (const [age, cells] of rows) {
        const x = Number(age)
        const sheet = cells.map(worksheetNumber)
        const table = [male.q[x], male.e[x], female.q[x], female.e[x]]
        if (table.some((value, i) => value !== sheet[i])) mismatches.push(`${age}: ${table.join(', ')} against ${sheet.join(', ')}`)
      }
      expect(mismatches).toEqual([])
    })

    it('rebuilds the columns\' SHA-256 from the numbers: toFixed(6) and toFixed(2) give back the printed strings', async () => {
      let text = 'age,qM,eM,qF,eF\n'
      for (let x = 0; x < source.rows; x++) {
        text += `${x},${male.q[x]!.toFixed(6)},${male.e[x]!.toFixed(2)},${female.q[x]!.toFixed(6)},${female.e[x]!.toFixed(2)}\n`
      }
      expect(await sha256Hex(text)).toBe(source.columnsSha256)
      // The same text is what the worksheet's Expected table prints, row by row.
      for (const [age, cells] of rows) {
        const x = Number(age)
        expect([male.q[x]!.toFixed(6), male.e[x]!.toFixed(2), female.q[x]!.toFixed(6), female.e[x]!.toFixed(2)]).toEqual(cells)
      }
    })

    it('prints the rows the records quote: 65 is 0.016455 / 18.12 / 0.010188 / 20.66, and 119 is 0.926604 / 0.58 for both sexes', () => {
      expect([male.q[65], male.e[65], female.q[65], female.e[65]]).toEqual([0.016455, 18.12, 0.010188, 20.66])
      expect([male.q[119], male.e[119], female.q[119], female.e[119]]).toEqual([0.926604, 0.58, 0.926604, 0.58])
      expect(LAST_TABLE_AGE).toBe(expected.lastAge)
      // The questionnaire's baseline is the printed e; 'average' is the mean of the two.
      expect(baselineRemainingYears(65, 'male')).toBe(18.12)
      expect(baselineRemainingYears(65, 'female')).toBe(20.66)
      expect(baselineRemainingYears(65, 'average')).toBe((18.12 + 20.66) / 2)
      // A fractional age is linear between the two rows' printed e.
      const e = (age: number, column: 0 | 2) => worksheetNumber(rows.get(String(age))![column + 1]!)
      expect(withinTolerance(baselineRemainingYears(65.5, 'male'), (e(65, 0) + e(66, 0)) / 2, { abs: 1e-12 })).toBe(true)
      expect(withinTolerance(baselineRemainingYears(65.25, 'female'), 0.75 * e(65, 2) + 0.25 * e(66, 2), { abs: 1e-12 })).toBe(true)
    })

    it('names its source: the page, the edition, the Trustees Report, the read date and the archive capture', () => {
      expect(source).toEqual({
        publisher: 'Social Security Administration, Office of the Chief Actuary',
        table: 'Actuarial Life Table (Table 4C6)',
        caption: 'Period Life Table, 2023, as used in the 2026 Trustees Report',
        periodYear: expected.periodYear,
        trusteesReportYear: expected.trusteesReportYear,
        url: 'https://www.ssa.gov/oact/STATS/table4c6.html',
        readOn: '2026-09-27',
        readHow: 'browser, table cells',
        archive: {
          url: 'https://web.archive.org/web/20260922113934/https://www.ssa.gov/oact/STATS/table4c6.html',
          capturedAt: '2026-09-22T11:39:34Z',
        },
        columnsSha256: '32e6a4c36584ea44d7778c48397c8650d882288cb1bcb6f9861edfd8c3acfe4c',
        rows: expected.rowCount,
      })
    })

    it('labels a stored figure with the edition it was made on: its own, or the 2022 table when it names none', () => {
      expect(CURRENT_LIFE_TABLE_EDITION).toEqual({ periodYear: 2023, trusteesReportYear: 2026 })
      expect(storedLifeTableEdition(undefined)).toEqual({ periodYear: 2022, trusteesReportYear: 2025 })
      expect(storedLifeTableEdition(undefined)).toBe(LIFE_TABLE_EDITION_BEFORE_THE_FIELD)
      expect(storedLifeTableEdition(CURRENT_LIFE_TABLE_EDITION)).toBe(CURRENT_LIFE_TABLE_EDITION)
      expect(isCurrentLifeTableEdition(undefined)).toBe(false)
      expect(isCurrentLifeTableEdition({ periodYear: 2023, trusteesReportYear: 2026 })).toBe(true)
      // Both years must match: a mixed pair is not the table the engine carries.
      expect(isCurrentLifeTableEdition({ periodYear: 2023, trusteesReportYear: 2025 })).toBe(false)
      expect(isCurrentLifeTableEdition({ periodYear: 2022, trusteesReportYear: 2026 })).toBe(false)
    })

    it("knows two editions, each with SSA's own page, and no other (PR #759 review 7)", () => {
      expect(KNOWN_LIFE_TABLE_EDITIONS).toEqual([
        { edition: { periodYear: 2022, trusteesReportYear: 2025 }, url: 'https://www.ssa.gov/oact/STATS/table4c6_2022_TR2025.html' },
        { edition: { periodYear: 2023, trusteesReportYear: 2026 }, url: SSA_PERIOD_LIFE_TABLE.source.url },
      ])
      // A figure that names no edition was made on the 2022 table.
      expect(knownLifeTableEdition(undefined)).toBe(KNOWN_LIFE_TABLE_EDITIONS[0])
      expect(knownLifeTableEdition({ periodYear: 2023, trusteesReportYear: 2026 })).toBe(KNOWN_LIFE_TABLE_EDITIONS[1])
      // A mixed pair, a later edition and a malformed one are none of them: no page is made up for them.
      for (const other of [
        { periodYear: 2023, trusteesReportYear: 2025 },
        { periodYear: 2024, trusteesReportYear: 2027 },
        { periodYear: 0, trusteesReportYear: 0 },
        { periodYear: Number.NaN, trusteesReportYear: 2026 },
      ]) {
        expect(knownLifeTableEdition(other), JSON.stringify(other)).toBeNull()
      }
    })
  },
)
