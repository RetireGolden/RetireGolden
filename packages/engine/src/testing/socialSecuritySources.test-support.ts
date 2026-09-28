/**
 * Parsers for the publishers' own bytes behind the Social Security data tables
 * (DOCS/calculations/social-security/sources/, listed in its manifest.json):
 * BLS's CPI-U responses and data-viewer column, and SSA's tax-rate and
 * quarter-of-coverage tables. The evidence tests compare every row of
 * socialSecurity/cpiU.ts, socialSecurity/oasdiTaxRates.ts and
 * ssaWageData.ts#QUARTER_OF_COVERAGE_AMOUNT_BY_YEAR with what these return, so
 * a transcription error in a table cannot hide behind a worksheet copied the
 * same way. Test-only (the *.test-support.ts suffix keeps it out of dist).
 */
// Read as text, exactly as committed (the directory is -text in .gitattributes,
// so a checkout never rewrites a byte); every file is UTF-8 without a BOM.
const PREFIX = '../../../../DOCS/calculations/social-security/sources/'
const raw = import.meta.glob('../../../../DOCS/calculations/social-security/sources/**/*.{json,html}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export interface SourceEntry {
  readonly file: string
  readonly bytes: number
  readonly sha256: string
  readonly url: string
  readonly retrievedOn: string
}

/** The committed source files by their path under sources/, manifest.json included. */
export function sourceFileNames(): string[] {
  return Object.keys(raw).map((key) => key.slice(PREFIX.length)).sort()
}

export function sourceText(file: string): string {
  const text = raw[PREFIX + file]
  if (text === undefined) throw new Error(`no source file ${file}`)
  return text
}

export function sourceManifest(): { readonly files: readonly SourceEntry[] } {
  return JSON.parse(sourceText('manifest.json')) as { files: SourceEntry[] }
}

interface MinimalWebCrypto {
  subtle: { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> }
}

/** A file's UTF-8 bytes and their SHA-256, by WebCrypto (the engine's compile surface has no node types). */
export async function sourceDigest(file: string): Promise<{ bytes: number; sha256: string }> {
  const { TextEncoder: TextEncoderConstructor } = globalThis as unknown as {
    TextEncoder: new () => { encode(input: string): Uint8Array }
  }
  const bytes = new TextEncoderConstructor().encode(sourceText(file))
  const digest = await (crypto as unknown as MinimalWebCrypto).subtle.digest('SHA-256', bytes)
  return { bytes: bytes.length, sha256: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('') }
}

interface BlsResponse {
  readonly status: string
  readonly Results: { readonly series: readonly { readonly seriesID: string; readonly data: readonly { year: string; period: string; value: string }[] }[] }
}

function blsSeries(file: string): readonly { year: string; period: string; value: string }[] {
  const response = JSON.parse(sourceText(file)) as BlsResponse
  if (response.status !== 'REQUEST_SUCCEEDED') throw new Error(`${file}: ${response.status}`)
  const series = response.Results.series.find((entry) => entry.seriesID === 'CUUR0000SA0')
  if (series === undefined) throw new Error(`${file}: no CUUR0000SA0 series`)
  return series.data
}

const files = () => sourceManifest().files.map((entry) => entry.file)

/** BLS's published annual averages (period M13) from the API v2 responses, by year. */
export function blsApiAnnualAverages(): Map<number, number> {
  const out = new Map<number, number>()
  for (const file of files().filter((name) => name.startsWith('bls-cpiu/api-v2-'))) {
    for (const row of blsSeries(file)) if (row.period === 'M13') out.set(Number(row.year), Number(row.value))
  }
  return out
}

/** BLS's monthly values (periods M01 to M12) from the API v1 responses, by year. */
export function blsApiMonthlyValues(): Map<number, number[]> {
  const out = new Map<number, number[]>()
  for (const file of files().filter((name) => name.startsWith('bls-cpiu/api-v1-'))) {
    for (const row of blsSeries(file)) {
      if (/^M(0[1-9]|1[0-2])$/u.test(row.period)) out.set(Number(row.year), [...(out.get(Number(row.year)) ?? []), Number(row.value)])
    }
  }
  return out
}

/** The data viewer's "Annual" column, by year. */
export function blsViewerAnnualAverages(): Map<number, number> {
  const viewer = JSON.parse(sourceText('bls-cpiu/data-viewer-annual-1937-2025.json')) as { annual: Record<string, string> }
  return new Map(Object.entries(viewer.annual).map(([year, value]) => [Number(year), Number(value)]))
}

/**
 * The mean of a year's twelve monthly values rounded half up at BLS's
 * published precision (one decimal before 2007, three from 2007), in
 * thousandths so the rounding is exact.
 */
export function monthlyMeanAtPublishedPrecision(year: number, monthly: readonly number[]): number {
  const thousandths = monthly.reduce((sum, value) => sum + Math.round(value * 1_000), 0)
  const step = year < 2007 ? 100 : 1
  // Half up on a non-negative total: floor(x / (12 step) + 1/2), in integers.
  const rounded = Math.floor((2 * thousandths + 12 * step) / (24 * step)) * step
  return rounded / 1_000
}

const collapse = (html: string): string => html.replace(/<[^>]*>/gu, ' ').replace(/&nbsp;/gu, ' ').replace(/\s+/gu, ' ').trim()

export interface SsaRateRow {
  /** The table's totals, the rates the trust funds received. */
  readonly employeeEmployer: number
  readonly selfEmployed: number | null
}

export interface SsaFootnoteRates {
  /** Footnote a: the year of the employee credit and the effective employee rate. */
  readonly employeeCredit: { readonly year: number; readonly employee: number }
  /** Footnote c: the reduced years and the effective employee and self-employed rates. */
  readonly payrollReduction: { readonly years: readonly number[]; readonly employee: number; readonly selfEmployed: number }
}

/**
 * The rate table's rows by year: each row's first cell is a year, a range
 * such as "1937-49", or "2019 and later" (through `lastYear`), and its fourth
 * and seventh cells are the employee-and-employer total and the self-employed
 * total ("--" for none).
 */
export function ssaTrustFundRates(lastYear: number): Map<number, SsaRateRow> {
  const html = sourceText('ssa-oasdi-rates.table.html')
  const out = new Map<number, SsaRateRow>()
  for (const [, body] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gu)) {
    const cells = [...body!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gu)].map(([, cell]) => collapse(cell!))
    if (cells.length !== 7) continue
    // Footnote markers follow the year, as "1984 a" or "2000-15 b , c".
    const label = cells[0]!.replace(/\s+[a-d](\s*,\s*[a-d])*$/u, '')
    const years = yearsOf(label, lastYear)
    const rate = (cell: string): number | null => (cell === '--' ? null : Number(cell))
    for (const year of years) out.set(year, { employeeEmployer: rate(cells[3]!)!, selfEmployed: rate(cells[6]!) })
  }
  return out
}

function yearsOf(label: string, lastYear: number): number[] {
  const later = /^(\d{4}) and later$/u.exec(label)
  if (later) return range(Number(later[1]), lastYear)
  const span = /^(\d{4})-(\d{2})$/u.exec(label)
  if (span) {
    const from = Number(span[1])
    return range(from, Math.floor(from / 100) * 100 + Number(span[2]))
  }
  if (/^\d{4}$/u.test(label)) return [Number(label)]
  throw new Error(`unexpected year cell "${label}"`)
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

/** The effective rates footnotes a and c give, read from their text. */
export function ssaFootnoteRates(): SsaFootnoteRates {
  const text = collapse(sourceText('ssa-oasdi-rates.table.html'))
  const a = /In (\d{4}) only, an immediate credit of [\d.]+ percent of taxable wages was allowed against the OASDI taxes paid by employees, resulting in an effective employee tax rate of ([\d.]+) percent\./u.exec(text)
  const c = /For (\d{4}) and (\d{4}), the OASDI tax rate is reduced by \d+ percentage points for employees and for self-employed workers, resulting in a ([\d.]+) percent effective tax rate for employees and a ([\d.]+) percent effective tax rate for self-employed workers\./u.exec(text)
  if (!a || !c) throw new Error('footnote a or c not found')
  return {
    employeeCredit: { year: Number(a[1]), employee: Number(a[2]) },
    payrollReduction: { years: range(Number(c[1]), Number(c[2])), employee: Number(c[3]), selfEmployed: Number(c[4]) },
  }
}

/**
 * The effective rates by year: the table's totals, with footnote a's employee
 * credit and footnote c's reduction applied. The employer pays the table's
 * total in every year; the self-employed credits of 1984 to 1989, which the
 * page gives against the combined OASDI and HI tax, are not applied.
 */
export function ssaEffectiveRates(lastYear: number): Map<number, { employee: number; employer: number; selfEmployed: number | null }> {
  const { employeeCredit, payrollReduction } = ssaFootnoteRates()
  const out = new Map<number, { employee: number; employer: number; selfEmployed: number | null }>()
  for (const [year, row] of ssaTrustFundRates(lastYear)) {
    let employee = row.employeeEmployer
    let selfEmployed = row.selfEmployed
    if (year === employeeCredit.year) employee = employeeCredit.employee
    if (payrollReduction.years.includes(year)) {
      employee = payrollReduction.employee
      selfEmployed = payrollReduction.selfEmployed
    }
    out.set(year, { employee, employer: row.employeeEmployer, selfEmployed })
  }
  return out
}

/** The quarter-of-coverage series, by year. */
export function ssaQuarterOfCoverageAmounts(): Map<number, number> {
  const html = sourceText('ssa-quarter-of-coverage.table.html')
  const out = new Map<number, number>()
  for (const [, year, amount] of html.matchAll(/<td align="left">(\d{4})<\/td>\s*<td align="right">\$?([\d,]+)<\/td>/gu)) {
    out.set(Number(year), Number(amount!.replace(/,/gu, '')))
  }
  return out
}
