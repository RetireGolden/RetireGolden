import { describe, expect, it } from 'vitest'

import { csvCell, csvQuote } from './csvCell'

/**
 * The single formula-neutralization + quoting policy shared by every CSV
 * export path (`report/reportModel.ts`, `planner/yearCashFlow/detailCsv.ts`,
 * `planner/inheritedCsv.ts`). Neutralization: a text cell whose first
 * non-space character is `= + - @` or a literal tab/CR is prefixed with an
 * apostrophe. Quoting: unchanged — a comma, double quote, or line break
 * wraps the cell in double quotes with embedded quotes doubled.
 */
describe('csvCell', () => {
  it('passes numbers through bare', () => {
    expect(csvCell(0)).toBe('0')
    expect(csvCell(-42.5)).toBe('-42.5')
  })

  it('renders null and undefined as an empty cell', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })

  it('passes ordinary text through unchanged', () => {
    expect(csvCell('Brokerage')).toBe('Brokerage')
  })

  it.each(['=', '+', '-', '@', '\t', '\r'])('neutralizes a cell starting with %s', (trigger) => {
    const value = `${trigger}SUM(A1)`
    expect(csvCell(value)).toBe(csvQuote(`'${value}`))
  })

  it('neutralizes after leading ASCII spaces', () => {
    expect(csvCell('  =SUM(A1)')).toBe(`'  =SUM(A1)`)
  })

  it('does not neutralize text that merely contains a trigger character mid-string', () => {
    expect(csvCell('Total = 5')).toBe('Total = 5')
  })

  it('quotes a neutralized cell that also contains a comma or quote', () => {
    expect(csvCell('=HYPERLINK("evil","x")')).toBe(`"'=HYPERLINK(""evil"",""x"")"`)
  })

  it('quotes cells containing commas, quotes, or newlines with quoting unchanged from before', () => {
    expect(csvCell('say "hello", world')).toBe('"say ""hello"", world"')
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"')
    expect(csvCell('a,b')).toBe('"a,b"')
  })

  it('leaves an empty string as an empty cell', () => {
    expect(csvCell('')).toBe('')
  })
})
