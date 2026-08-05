/**
 * The per-host rendering conventions in DOCS/operations/quote-fidelity.md and
 * the `HOST_CONVENTIONS` constant the verifier runs on are the same
 * measurements written twice. This is what keeps them the same measurements.
 *
 * Why it is worth a test rather than a caveat: that doc table is what a person
 * consults when a quote fails and they have to decide whether the difference is
 * a rendering convention or a rewrite. A table claiming LII renders U+0027 when
 * the code knows it renders U+2019 does not confuse the reader — it gives them
 * a confident wrong answer, which is the failure the whole checker exists to
 * prevent. The doc used to assert the two "cannot drift apart silently" with
 * nothing enforcing it. This is the enforcement.
 *
 * Compared per host: the possessive apostrophe, the structural dash and the
 * section sign. The notes column is prose in both places and is not compared —
 * it would only ever produce false failures.
 *
 * Rows the doc marks unmeasured ("unknown", "not recoverable", U+FFFD) are held
 * to the opposite rule: a host the doc says was never measured must NOT appear
 * in HOST_CONVENTIONS, because an entry there is a claim that it was.
 */
import { describe, expect, it } from 'vitest'
import { HOST_CONVENTIONS } from '../../scripts/host-conventions.mjs'
import docMarkdown from '../../../../DOCS/operations/quote-fidelity.md?raw'

/** A doc cell that declines to state a convention, rather than stating one. */
const UNMEASURED = Symbol('unmeasured')
type Measured<T> = T | typeof UNMEASURED

const isUnmeasured = (cell: string): boolean => /\bunknown\b|not recoverable|U\+FFFD/i.test(cell)

/** `**U+2019** (curly)` → `’`. */
function codepointIn(cell: string, column: string): string {
  const match = /U\+([0-9A-Fa-f]{4,6})/.exec(cell)
  if (match === null) {
    throw new Error(
      `the ${column} cell "${cell}" states neither a U+ codepoint nor that it is unmeasured — ` +
        'the doc table and this test have to agree on how a convention is written down',
    )
  }
  return String.fromCodePoint(Number.parseInt(match[1], 16))
}

function apostropheOf(cell: string): Measured<string | null> {
  if (isUnmeasured(cell)) return UNMEASURED
  // `null` in the code means "this host is internally inconsistent, assert
  // nothing" — a measurement, not a gap, and the doc says so in words.
  if (/inconsistent|no assertion/i.test(cell)) return null
  return codepointIn(cell, 'apostrophe')
}

const dashOf = (cell: string): Measured<string> =>
  isUnmeasured(cell) ? UNMEASURED : codepointIn(cell, 'structural dash')

const sectionSignOf = (cell: string): Measured<string> =>
  isUnmeasured(cell) ? UNMEASURED : cell.replace(/`/g, '').replace(/\s+/g, ' ').trim()

interface DocRow {
  host: string
  qualifier: string
  apostrophe: Measured<string | null>
  structuralDash: Measured<string>
  sectionSign: Measured<string>
}

/**
 * Parse the per-host table. Only the first four columns are read, so a stray
 * `|` in the free-text notes column cannot shift the fields that matter.
 */
function parseDocTable(markdown: string): DocRow[] {
  const lines = markdown.split(/\r?\n/)
  const headerIndex = lines.findIndex((line) => line.startsWith('| Host |'))
  if (headerIndex < 0) {
    throw new Error('no per-host table in quote-fidelity.md — expected a row starting "| Host |"')
  }
  const rows: DocRow[] = []
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.startsWith('|')) break
    const cells = line.split('|')
    const hostCell = cells[1]?.trim() ?? ''
    const hostMatch = /`([^`]+)`/.exec(hostCell)
    if (hostMatch === null) {
      throw new Error(`the host cell "${hostCell}" does not name a host in backticks`)
    }
    rows.push({
      host: hostMatch[1],
      qualifier: hostCell.replace(hostMatch[0], '').trim(),
      apostrophe: apostropheOf(cells[2]?.trim() ?? ''),
      structuralDash: dashOf(cells[3]?.trim() ?? ''),
      sectionSign: sectionSignOf(cells[4]?.trim() ?? ''),
    })
  }
  return rows
}

const docRows = parseDocTable(docMarkdown)
const measuredRows = docRows.filter((row) => row.apostrophe !== UNMEASURED)
const label = (row: DocRow): string => (row.qualifier ? `${row.host} ${row.qualifier}` : row.host)

describe('DOCS/operations/quote-fidelity.md host conventions', () => {
  it('parsed the table at all', () => {
    // Without this, a doc restructure that the parser walks straight past would
    // make every assertion below pass on an empty list.
    expect(docRows.length).toBeGreaterThanOrEqual(Object.keys(HOST_CONVENTIONS).length)
    expect(measuredRows.length).toBeGreaterThan(0)
  })

  it('describes the same hosts as HOST_CONVENTIONS, in both directions', () => {
    const documented = [...new Set(measuredRows.map((row) => row.host))].sort()
    expect(documented).toEqual(Object.keys(HOST_CONVENTIONS).sort())
  })

  it.each(measuredRows.map((row) => [label(row), row] as const))(
    '%s: apostrophe, structural dash and section sign match the code',
    (_name, row) => {
      const convention = HOST_CONVENTIONS[row.host]
      expect(convention, `${row.host} is in the doc table but not in HOST_CONVENTIONS`).toBeDefined()
      expect(row.apostrophe).toBe(convention.apostrophe)
      if (row.structuralDash !== UNMEASURED) {
        expect(row.structuralDash).toBe(convention.structuralDash)
      }
      if (row.sectionSign !== UNMEASURED) {
        expect(row.sectionSign).toBe(convention.sectionSign)
      }
    },
  )

  it('keeps hosts the doc calls unmeasured out of HOST_CONVENTIONS', () => {
    const measuredHosts = new Set(measuredRows.map((row) => row.host))
    const unmeasuredOnly = docRows.map((row) => row.host).filter((host) => !measuredHosts.has(host))
    // www.jct.gov is the live case: it sits behind a Cloudflare challenge, so
    // nothing about how it renders has ever been observed. An entry in
    // HOST_CONVENTIONS would be a measurement nobody took.
    for (const host of unmeasuredOnly) {
      expect(
        HOST_CONVENTIONS[host],
        `${host} is documented as unmeasured but HOST_CONVENTIONS states conventions for it`,
      ).toBeUndefined()
    }
  })
})
