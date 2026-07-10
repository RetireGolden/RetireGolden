/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'

import { defaultLastEarningsYearFromRows, parseSsaStatementXml } from './ssaStatementXml'

function statementXml(body: string, dob = '1983-03-01'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<osss:OnlineSocialSecurityStatementData xmlns:osss="http://ssa.gov/osss/schemas/2.0">
  <osss:UserInformation>
    <osss:DateOfBirth>${dob}</osss:DateOfBirth>
  </osss:UserInformation>
  <osss:EarningsRecord>
    ${body}
  </osss:EarningsRecord>
</osss:OnlineSocialSecurityStatementData>`
}

describe('parseSsaStatementXml adversarial fixtures', () => {
  it('rejects malformed XML instead of returning partial data', () => {
    const result = parseSsaStatementXml('<osss:OnlineSocialSecurityStatementData>')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/xml parse error/i)
  })

  it('rejects a valid-looking root in the wrong namespace', () => {
    const xml = `<osss:OnlineSocialSecurityStatementData xmlns:osss="http://example.com/not-ssa">
  <osss:UserInformation><osss:DateOfBirth>1983-03-01</osss:DateOfBirth></osss:UserInformation>
</osss:OnlineSocialSecurityStatementData>`

    const result = parseSsaStatementXml(xml)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/recognized SSA/i)
  })

  it('rejects statements missing a valid date of birth', () => {
    const missingDob = `<?xml version="1.0" encoding="UTF-8"?>
<osss:OnlineSocialSecurityStatementData xmlns:osss="http://ssa.gov/osss/schemas/2.0">
  <osss:UserInformation></osss:UserInformation>
  <osss:EarningsRecord></osss:EarningsRecord>
</osss:OnlineSocialSecurityStatementData>`

    const result = parseSsaStatementXml(missingDob)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/DateOfBirth/)
  })

  it('accepts a valid statement with no earnings rows without inventing earnings', () => {
    const result = parseSsaStatementXml(statementXml(''))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows).toEqual([])
    expect(defaultLastEarningsYearFromRows(result.rows)).toBeNull()
  })

  it('keeps Medicare-only earnings out of FICA earnings', () => {
    const result = parseSsaStatementXml(
      statementXml(`
        <osss:Earnings startYear="2022" endYear="2022">
          <osss:MedicareEarnings>220000</osss:MedicareEarnings>
        </osss:Earnings>
      `),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows).toEqual([{ year: 2022, amount: 0 }])
    expect(defaultLastEarningsYearFromRows(result.rows)).toBe(2022)
  })

  it('merges duplicate years and ignores invalid year/amount entries', () => {
    const result = parseSsaStatementXml(
      statementXml(`
        <osss:Earnings startYear="2021" endYear="2021"><osss:FicaEarnings>10000</osss:FicaEarnings></osss:Earnings>
        <osss:Earnings startYear="2021" endYear="2021"><osss:FicaEarnings>2500.50</osss:FicaEarnings></osss:Earnings>
        <osss:Earnings startYear="1950" endYear="1950"><osss:FicaEarnings>999999</osss:FicaEarnings></osss:Earnings>
        <osss:Earnings startYear="2022" endYear="2022"><osss:FicaEarnings>-5</osss:FicaEarnings></osss:Earnings>
      `),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows).toEqual([
      { year: 2021, amount: 12_500.5 },
      { year: 2022, amount: 0 },
    ])
  })

  it('handles a large statement without dropping or reordering valid rows', () => {
    const earningsRows = Array.from(
      { length: 1500 },
      (_, i) => `<osss:Earnings startYear="${1951 + (i % 50)}" endYear="${1951 + (i % 50)}"><osss:FicaEarnings>1</osss:FicaEarnings></osss:Earnings>`,
    ).join('\n')

    const result = parseSsaStatementXml(statementXml(earningsRows))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows).toHaveLength(50)
    expect(result.rows.reduce((sum, row) => sum + row.amount, 0)).toBe(1500)
    expect(result.rows[0]).toEqual({ year: 1951, amount: 30 })
    expect(result.rows.at(-1)).toEqual({ year: 2000, amount: 30 })
  })
})
