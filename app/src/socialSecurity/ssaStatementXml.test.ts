/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import { parseEarningsLines } from './piaFromEarnings'
import {
  defaultLastEarningsYearFromRows,
  parseSsaStatementXml,
  yearEarningsToPaste,
} from './ssaStatementXml'

const MINIMAL_STATEMENT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<osss:OnlineSocialSecurityStatementData xmlns:osss="http://ssa.gov/osss/schemas/2.0">
  <osss:UserInformation>
    <osss:DateOfBirth>1983-03-01</osss:DateOfBirth>
  </osss:UserInformation>
  <osss:EarningsRecord>
    <osss:Earnings startYear="2016" endYear="2016">
      <osss:FicaEarnings>100068</osss:FicaEarnings>
      <osss:MedicareEarnings>100068</osss:MedicareEarnings>
    </osss:Earnings>
    <osss:Earnings startYear="2017" endYear="2017">
      <osss:FicaEarnings>127200</osss:FicaEarnings>
      <osss:MedicareEarnings>147728</osss:MedicareEarnings>
    </osss:Earnings>
  </osss:EarningsRecord>
</osss:OnlineSocialSecurityStatementData>`

describe('parseSsaStatementXml', () => {
  it('parses DOB, FICA earnings (not Medicare when higher), and merges years', () => {
    const r = parseSsaStatementXml(MINIMAL_STATEMENT_XML)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.dob).toBe('1983-03-01')
    expect(r.rows).toHaveLength(2)
    const y2017 = r.rows.find((x) => x.year === 2017)
    expect(y2017?.amount).toBe(127200)
    expect(defaultLastEarningsYearFromRows(r.rows)).toBe(2017)
  })

  it('round-trips through paste format and parseEarningsLines', () => {
    const r = parseSsaStatementXml(MINIMAL_STATEMENT_XML)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const paste = yearEarningsToPaste(r.rows)
    const { rows, errors } = parseEarningsLines(paste)
    expect(errors).toEqual([])
    expect(rows).toEqual(
      expect.arrayContaining([
        { year: 2016, amount: 100068 },
        { year: 2017, amount: 127200 },
      ]),
    )
    expect(rows).toHaveLength(2)
  })

  it('records a warning when endYear exceeds startYear (uses start year only)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<osss:OnlineSocialSecurityStatementData xmlns:osss="http://ssa.gov/osss/schemas/2.0">
  <osss:UserInformation><osss:DateOfBirth>1983-03-01</osss:DateOfBirth></osss:UserInformation>
  <osss:EarningsRecord>
    <osss:Earnings startYear="2020" endYear="2021">
      <osss:FicaEarnings>50000</osss:FicaEarnings>
      <osss:MedicareEarnings>50000</osss:MedicareEarnings>
    </osss:Earnings>
  </osss:EarningsRecord>
</osss:OnlineSocialSecurityStatementData>`
    const r = parseSsaStatementXml(xml)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.yearRangeWarnings.length).toBeGreaterThan(0)
    expect(r.rows).toEqual([{ year: 2020, amount: 50000 }])
  })

  it('rejects non-SSA root', () => {
    const r = parseSsaStatementXml('<root xmlns="http://example.com"/>')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.message).toMatch(/recognized SSA/i)
  })
})

describe('defaultLastEarningsYearFromRows', () => {
  it('uses latest year with positive amount when present', () => {
    expect(
      defaultLastEarningsYearFromRows([
        { year: 2020, amount: 0 },
        { year: 2021, amount: 100 },
      ]),
    ).toBe(2021)
  })

  it('falls back to latest calendar year when all amounts are zero', () => {
    expect(
      defaultLastEarningsYearFromRows([
        { year: 2019, amount: 0 },
        { year: 2020, amount: 0 },
      ]),
    ).toBe(2020)
  })
})
