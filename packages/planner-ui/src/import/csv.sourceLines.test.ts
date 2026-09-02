/**
 * `parseCsv` numbers each kept row by the spreadsheet row it began on (#557
 * review): blank separator lines the parser drops advance the count and a
 * line break inside a quoted value does not (a multi-line cell is one
 * spreadsheet row, as Excel or Sheets shows it), so "Row 7" is row 7 in the
 * person's spreadsheet, not the seventh non-blank row.
 */
import { describe, expect, it } from 'vitest'

import { parseCsv } from './csv'

describe('parseCsv source rows', () => {
  it('counts blank lines the parser drops', () => {
    const r = parseCsv('Account,Balance\nCash,100\n\n\nBonds,200\n,\nStocks,300\n')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.rows.map((row) => row[0])).toEqual(['Account', 'Cash', 'Bonds', 'Stocks'])
    // Lines 3 and 4 are empty and line 6 is ",": all dropped, all counted.
    expect(r.sourceLines).toEqual([1, 2, 5, 7])
  })

  it('does not advance for a line break inside a quoted value (one spreadsheet row), and treats CRLF as one break', () => {
    const r = parseCsv('Account,Note\r\n"Cash","two\r\nlines"\r\nBonds,x\r\n\r\nStocks,y')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.rows[1]).toEqual(['Cash', 'two\r\nlines'])
    // The multi-line note is one cell in row 2, as Excel or Sheets shows it;
    // Bonds is row 3; row 4 is blank; Stocks is row 5.
    expect(r.sourceLines).toEqual([1, 2, 3, 5])
  })

  it('a quoted value with several embedded breaks still occupies one row', () => {
    const r = parseCsv('a,b\n"x","l1\nl2\nl3"\nc,d\n')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.sourceLines).toEqual([1, 2, 3])
  })

  it('numbers a file with no blank lines by plain row order, so nothing else moved', () => {
    const r = parseCsv('a,b\nc,d\ne,f')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.sourceLines).toEqual([1, 2, 3])
  })
})
