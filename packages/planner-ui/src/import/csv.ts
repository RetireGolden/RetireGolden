/**
 * Hardened CSV parsing shared by every import mapper (onboarding-import-and-migration).
 *
 * Imported files are hostile input (same discipline as the SSA statement XML
 * parser): size/row/field caps, no exceptions on malformed text, and every
 * number routed through `parseMoney` so junk becomes an explicit skip rather
 * than NaN in a balance.
 */

export const MAX_CSV_CHARS = 5_000_000
export const MAX_CSV_ROWS = 20_000
export const MAX_CSV_FIELDS_PER_ROW = 100
/** Balances above this are assumed to be a parsing mistake, not a portfolio. */
export const MAX_REASONABLE_DOLLARS = 1e12

export type CsvParseResult = { ok: true; rows: string[][] } | { ok: false; message: string }

/**
 * RFC-4180-style parser: quoted fields (embedded commas/newlines/`""` escapes),
 * LF or CRLF row breaks, optional UTF-8 BOM. Fully empty rows are dropped.
 */
export function parseCsv(text: string): CsvParseResult {
  if (text.length > MAX_CSV_CHARS) {
    return { ok: false, message: 'File is too large to be a positions/plan export.' }
  }
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = (): string | null => {
    endField()
    if (row.length > MAX_CSV_FIELDS_PER_ROW) return 'A row has too many columns to be a supported export.'
    // Keep rows that carry any content; blank separator lines are structure, not data.
    if (row.some((f) => f.trim() !== '')) {
      rows.push(row)
      if (rows.length > MAX_CSV_ROWS) return 'File has too many rows to be a supported export.'
    }
    row = []
    return null
  }

  while (i < src.length) {
    const ch = src[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }
    if (ch === '"' && field === '') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      endField()
      i++
      continue
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      const err = endRow()
      if (err) return { ok: false, message: err }
      i++
      continue
    }
    field += ch
    i++
  }
  if (inQuotes) {
    return { ok: false, message: 'File ends inside a quoted value — it looks truncated or corrupted.' }
  }
  if (field !== '' || row.length > 0) {
    const err = endRow()
    if (err) return { ok: false, message: err }
  }
  if (rows.length === 0) {
    return { ok: false, message: 'File is empty.' }
  }
  return { ok: true, rows }
}

/**
 * Parse a currency-ish cell: `$1,234.56`, `(1,234)` (negative), `1234`,
 * `12.5%`-free plain numbers. Returns null for anything else (`--`, `N/A`,
 * text, Infinity, absurd magnitudes) so callers must handle junk explicitly.
 */
export function parseMoney(raw: string | undefined): number | null {
  if (raw === undefined) return null
  let s = raw.trim()
  if (s === '') return null
  let negative = false
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true
    s = s.slice(1, -1).trim()
  }
  if (s.startsWith('-')) {
    negative = true
    s = s.slice(1).trim()
  }
  s = s.replace(/^\$/, '').replace(/,/g, '').trim()
  if (s === '' || !/^\d+(\.\d+)?$/.test(s)) return null
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n) || n > MAX_REASONABLE_DOLLARS) return null
  return negative ? -n : n
}

/** Case-insensitive header lookup: the index of the first column whose name contains `needle`. */
export function findColumn(header: string[], ...needles: string[]): number {
  for (const needle of needles) {
    const target = needle.toLowerCase()
    const idx = header.findIndex((h) => h.trim().toLowerCase().includes(target))
    if (idx !== -1) return idx
  }
  return -1
}
