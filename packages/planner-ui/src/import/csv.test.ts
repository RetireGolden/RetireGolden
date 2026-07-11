import { describe, expect, it } from 'vitest'

import { MAX_CSV_CHARS, MAX_CSV_FIELDS_PER_ROW, MAX_CSV_ROWS, findColumn, parseCsv, parseMoney } from './csv'

describe('parseCsv', () => {
  it('parses quoted fields with embedded commas, quotes, and newlines', () => {
    const r = parseCsv('"a,b","say ""hi""","line1\nline2"\nplain,2,3')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.rows).toEqual([
        ['a,b', 'say "hi"', 'line1\nline2'],
        ['plain', '2', '3'],
      ])
    }
  })

  it('handles CRLF line endings and a UTF-8 BOM', () => {
    const r = parseCsv('﻿a,b\r\nc,d\r\n')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.rows).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('drops fully blank rows but keeps rows with any content', () => {
    const r = parseCsv('a,b\n,\n""\n ,c\n')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.rows).toEqual([['a', 'b'], [' ', 'c']])
  })

  it('rejects files that end inside a quoted field', () => {
    const r = parseCsv('a,"unterminated')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('truncated')
  })

  it('rejects oversized files, too many rows, and too many columns', () => {
    expect(parseCsv('x'.repeat(MAX_CSV_CHARS + 1)).ok).toBe(false)
    expect(parseCsv(Array.from({ length: MAX_CSV_ROWS + 1 }, () => 'a').join('\n')).ok).toBe(false)
    expect(parseCsv(Array.from({ length: MAX_CSV_FIELDS_PER_ROW + 1 }, () => 'a').join(',')).ok).toBe(false)
  })

  it('rejects empty files', () => {
    expect(parseCsv('').ok).toBe(false)
    expect(parseCsv('\n\n').ok).toBe(false)
  })

  it('treats spreadsheet formulas as inert text, not code', () => {
    const r = parseCsv('=HYPERLINK("http://evil.test"),=1+2\n@SUM(A1),+cmd')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.rows[0]![0]).toBe('=HYPERLINK("http://evil.test")')
  })
})

describe('parseMoney', () => {
  it('parses currency formats', () => {
    expect(parseMoney('$1,234.56')).toBe(1234.56)
    expect(parseMoney('1234')).toBe(1234)
    expect(parseMoney(' $19,050.00 ')).toBe(19050)
    expect(parseMoney('($1,200.00)')).toBe(-1200)
    expect(parseMoney('-45.5')).toBe(-45.5)
    expect(parseMoney('0')).toBe(0)
  })

  it('returns null for junk, placeholders, and absurd magnitudes', () => {
    expect(parseMoney(undefined)).toBeNull()
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('--')).toBeNull()
    expect(parseMoney('N/A')).toBeNull()
    expect(parseMoney('12.5%')).toBeNull()
    expect(parseMoney('1e309')).toBeNull()
    expect(parseMoney('Infinity')).toBeNull()
    expect(parseMoney('NaN')).toBeNull()
    expect(parseMoney('$99,999,999,999,999')).toBeNull()
    expect(parseMoney('1.2.3')).toBeNull()
    expect(parseMoney('<script>')).toBeNull()
  })
})

describe('findColumn', () => {
  it('finds columns case-insensitively by substring, first needle wins', () => {
    const header = ['Symbol', 'Description', 'Mkt Val (Market Value)', 'Cost Basis']
    expect(findColumn(header, 'market value', 'mkt val')).toBe(2)
    expect(findColumn(header, 'cost basis')).toBe(3)
    expect(findColumn(header, 'nope')).toBe(-1)
  })
})
