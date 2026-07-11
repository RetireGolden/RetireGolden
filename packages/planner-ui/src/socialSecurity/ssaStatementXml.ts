/**
 * Parse mySSA "Online Social Security Statement" XML (OSSS schema 2.0).
 * @see http://ssa.gov/osss/schemas/2.0
 */

import type { YearEarning } from '@retiregolden/engine/socialSecurity/piaFromEarnings'

export const OSSS_NS = 'http://ssa.gov/osss/schemas/2.0'

export type SsaStatementXmlOk = {
  ok: true
  dob: string
  rows: YearEarning[]
  /** SSA statement name field (PII); optional display only. */
  statementName?: string
  /** XML FileCreationDate text if present; display only. */
  fileCreationDate?: string
  /** When endYear > startYear on an Earnings element, only startYear was applied. */
  yearRangeWarnings: string[]
}

export type SsaStatementXmlFail = {
  ok: false
  message: string
}

export type SsaStatementXmlResult = SsaStatementXmlOk | SsaStatementXmlFail

function textContentNs(parent: Element, localName: string): string {
  const NS = OSSS_NS
  const kids = parent.getElementsByTagNameNS(NS, localName)
  return kids[0]?.textContent?.trim() ?? ''
}

function parseNonNegInt(s: string | null | undefined): number | null {
  if (s == null || s === '') return null
  const n = Number.parseInt(String(s).trim(), 10)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

function parseNonNegAmount(s: string | null | undefined): number {
  if (s == null || s === '') return 0
  const n = Number.parseFloat(String(s).trim())
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

function isValidDobIso(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  return !!(y && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)
}

/**
 * Serialize earnings rows for `earningsPaste` / `parseEarningsLines`.
 */
export function yearEarningsToPaste(rows: YearEarning[]): string {
  const sorted = [...rows].sort((a, b) => a.year - b.year)
  return sorted.map((r) => `${r.year} ${r.amount}`).join('\n')
}

/**
 * Parse OSSS 2.0 statement XML (browser or Vitest jsdom).
 */
export function parseSsaStatementXml(xmlText: string): SsaStatementXmlResult {
  if (typeof DOMParser === 'undefined') {
    return { ok: false, message: 'XML parsing is not available in this environment.' }
  }

  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const root = doc.documentElement
  if (!root) {
    return { ok: false, message: 'Empty or invalid XML document.' }
  }

  const pe = doc.getElementsByTagName('parsererror')
  if (pe.length > 0) {
    const hint = pe[0]?.textContent?.trim().slice(0, 200)
    return {
      ok: false,
      message: hint ? `XML parse error: ${hint}` : 'XML parse error.',
    }
  }

  if (root.namespaceURI !== OSSS_NS || root.localName !== 'OnlineSocialSecurityStatementData') {
    return {
      ok: false,
      message:
        'Not a recognized SSA online statement export (expected OnlineSocialSecurityStatementData in the official SSA namespace).',
    }
  }

  const dobRaw = textContentNs(root, 'DateOfBirth')
  if (!isValidDobIso(dobRaw)) {
    return { ok: false, message: 'Statement XML is missing a valid DateOfBirth (YYYY-MM-DD).' }
  }

  const nameRaw = textContentNs(root, 'Name')
  const fileDateRaw = textContentNs(root, 'FileCreationDate')

  const yearRangeWarnings: string[] = []
  const byYear = new Map<number, number>()

  const earningsNodes = root.getElementsByTagNameNS(OSSS_NS, 'Earnings')
  for (let i = 0; i < earningsNodes.length; i++) {
    const el = earningsNodes[i]!
    const startY = parseNonNegInt(el.getAttribute('startYear'))
    if (startY === null || startY < 1951 || startY > 2100) continue

    const endYRaw = el.getAttribute('endYear')
    const endY = endYRaw != null && endYRaw !== '' ? parseNonNegInt(endYRaw) : startY
    const end = endY === null ? startY : endY

    if (end > startY) {
      yearRangeWarnings.push(
        `Earnings element with startYear=${startY} and endYear=${end}: using start year only (same as SSA row granularity in exports).`,
      )
    }

    const fica = parseNonNegAmount(textContentNs(el, 'FicaEarnings'))
    const y = startY
    const prev = byYear.get(y) ?? 0
    byYear.set(y, prev + fica)
  }

  const rows: YearEarning[] = []
  for (const [year, amount] of byYear) {
    rows.push({ year, amount })
  }

  return {
    ok: true,
    dob: dobRaw.trim(),
    rows,
    statementName: nameRaw || undefined,
    fileCreationDate: fileDateRaw || undefined,
    yearRangeWarnings,
  }
}

/** Latest year with positive FICA earnings; if none, latest year in rows. */
export function defaultLastEarningsYearFromRows(rows: YearEarning[]): number | null {
  if (rows.length === 0) return null
  let maxAny = rows[0]!.year
  let maxPositive = -Infinity
  for (const r of rows) {
    if (r.year > maxAny) maxAny = r.year
    if (r.amount > 0 && r.year > maxPositive) maxPositive = r.year
  }
  if (Number.isFinite(maxPositive)) return maxPositive
  return maxAny
}
