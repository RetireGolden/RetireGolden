import { describe, expect, it } from 'vitest'

import {
  buildCalculationCoverageReport,
  oracleIdsOf,
  oracleRegistryRowsOf,
  oracleTolerancesOf,
  plainMarkdownText,
  type CalculationCoverageInput,
} from './coverageReport.js'

/**
 * The census's published-examples list: each external-oracle fixture file
 * joined to its rows in the "Implemented fixtures" table of
 * DOCS/external-oracles.md and to the tolerances its comments state. The
 * committed registry and fixtures are held by the freshness suite; these
 * cases pin the parsing and every way the census refuses to build.
 */

const FEDERAL = 'packages/engine/src/tax/federalTax.external.golden.test.ts'
const STATE = 'packages/engine/src/tax/stateTax.external.golden.test.ts'

const TABLE = [
  '| ID | Domain | Fixture | Primary source |',
  '|---|---|---|---|',
  `| ORACLE-001 | Federal tax | [\`${FEDERAL}\`](../${FEDERAL}) | IRS Rev. Proc. 2025-32 — brackets. |`,
  `| ORACLE-009/010 | State tax | [\`${STATE}\`](../${STATE}) | NJ graduated brackets; KY flat rate. |`,
  `| ORACLE-013 | State tax | [\`${STATE}\`](../${STATE}) | CA FTB **basic** deduction, pinned \`abc1234\`. |`,
  '| ORACLE-011/012 | Optimizer | [`packages/engine/src/projection/o.external.characterization.test.ts`](../x) | Owl, directional. |',
  '| — | TIPS ladder | [`packages/engine/src/ladder/l.worksheet.golden.test.ts`](../x) | Hand worksheet. |',
]

function registry(table: readonly string[] = TABLE, after: readonly string[] = []): string {
  return [
    '# External oracle comparisons',
    '',
    '## Implemented fixtures',
    '',
    'The external-oracle fixtures currently in the tree:',
    '',
    ...table,
    '',
    'Known gaps, kept visible on purpose.',
    ...after,
    '',
    '## Per-domain notes',
    '',
    '| Not | the | fixtures | table |',
  ].join('\n')
}

const FEDERAL_SOURCE = [
  '/**',
  ' * ORACLE-001 (DOCS/external-oracles.md) — federal income tax vs IRS Rev. Proc. 2025-32.',
  ' * Access date: 2026-06-29. Tax year under test: 2026. Tolerance: $1.',
  ' */',
  "it('reproduces the schedule', () => {})",
  "it('reproduces the deduction', () => {})",
  "// it('a pending case in a comment does not count', () => {})",
].join('\n')

const STATE_SOURCE = [
  '/**',
  ' * ORACLE-009 (DOCS/external-oracles.md) — New Jersey. See also ORACLE-001 for the federal side.',
  ' * Tolerance: $1, asserted to cents where the model is exact.',
  ' */',
  "it('nj', () => {})",
  '/**',
  ' * ORACLE-010 (DOCS/external-oracles.md) — Kentucky. Access date: 2026-06-30. Tolerance: $1, asserted to cents',
  ' * where the model is exact.',
  ' */',
  "it('ky', () => {})",
  '/** ORACLE-013 (DOCS/external-oracles.md) — California. Tolerance: $0.01 (the schedule is exact). */',
  "test('ca', () => {})",
].join('\n')

function census(overrides: Partial<CalculationCoverageInput>) {
  return buildCalculationCoverageReport({
    registry: {},
    recordModules: [],
    families: {},
    attestations: {},
    testSources: {},
    externalGoldenSources: { [FEDERAL]: FEDERAL_SOURCE, [STATE]: STATE_SOURCE },
    oracleRegistryText: registry(),
    walkthroughs: [],
    symbolLineFor: () => 1,
    docTextFor: () => null,
    ...overrides,
  }).manifest
}

describe('the oracle registry table', () => {
  it('reads the fixture rows, skipping rows that are not external goldens and tables in later sections', () => {
    expect(oracleRegistryRowsOf(registry())).toEqual([
      { id: 'ORACLE-001', domain: 'Federal tax', source: 'IRS Rev. Proc. 2025-32 — brackets.', file: FEDERAL },
      { id: 'ORACLE-009/010', domain: 'State tax', source: 'NJ graduated brackets; KY flat rate.', file: STATE },
      { id: 'ORACLE-013', domain: 'State tax', source: 'CA FTB basic deduction, pinned abc1234.', file: STATE },
    ])
    expect(oracleIdsOf('ORACLE-009/010')).toEqual(['ORACLE-009', 'ORACLE-010'])
    expect(oracleIdsOf('ORACLE-001')).toEqual(['ORACLE-001'])
  })

  it('reads an escaped pipe inside a cell as a pipe, and publishes the source as plain text', () => {
    const escaped = TABLE.map((row) => row.replace('IRS Rev. Proc. 2025-32 — brackets.', 'IRS Rev. Proc. 2025-32 \\| 2026 adjustments.'))
    expect(oracleRegistryRowsOf(registry(escaped))[0]!.source).toBe('IRS Rev. Proc. 2025-32 | 2026 adjustments.')
    expect(plainMarkdownText('[Rev. Proc. 2025-32](https://irs.gov/x), *basic* and _flat_ rate, ``code`` and **bold**')).toBe(
      'Rev. Proc. 2025-32, basic and flat rate, code and bold',
    )
    // Markers that are not emphasis stay: a lone asterisk, an identifier's underscore.
    expect(plainMarkdownText('5 * 3, peopleAged65Plus_count')).toBe('5 * 3, peopleAged65Plus_count')
  })

  it('refuses a missing or malformed table', () => {
    expect(() => oracleRegistryRowsOf('# External oracle comparisons\n')).toThrow('no "## Implemented fixtures" section')
    expect(() => oracleRegistryRowsOf('## Implemented fixtures\n\nNo table.\n')).toThrow('no table under')
    expect(() => oracleRegistryRowsOf(registry(['| Id | Area | Fixture | Source |', ...TABLE.slice(1)]))).toThrow(
      "the table's header must be | ID | Domain | Fixture | Primary source |",
    )
    expect(() => oracleRegistryRowsOf(registry([TABLE[0]!, ...TABLE.slice(2)]))).toThrow('followed by its delimiter row')
    const withRow = (row: string) => registry([TABLE[0]!, TABLE[1]!, row, ...TABLE.slice(3)])
    expect(() => oracleRegistryRowsOf(withRow(`| ORACLE-001 | Federal tax | [\`${FEDERAL}\`](x) |`))).toThrow('a row has 3 cells, not 4')
    // An unescaped pipe in a source cell is a fifth cell, and the message says how to write it.
    expect(() => oracleRegistryRowsOf(withRow(`| ORACLE-001 | Federal tax | [\`${FEDERAL}\`](x) | IRS | 2026 |`))).toThrow(
      'write a pipe inside a cell as \\|',
    )
    expect(() => oracleRegistryRowsOf(withRow(`| ORACLE-001 | Federal tax | ${FEDERAL} | IRS |`))).toThrow('row ORACLE-001 has no fixture link')
    expect(() => oracleRegistryRowsOf(withRow(`| — | Federal tax | [\`${FEDERAL}\`](x) | IRS |`))).toThrow(
      `the row for ${FEDERAL} has no ORACLE id`,
    )
  })

  it('refuses an id listed twice and a row stranded after the table ends', () => {
    const twice = [...TABLE, `| ORACLE-013 | State tax | [\`${STATE}\`](x) | NV, copied from CA. |`]
    expect(() => oracleRegistryRowsOf(registry(twice))).toThrow(`ORACLE-013 is listed twice (for ${STATE} and for ${STATE})`)
    // One id inside a range counts too, including on a row that is not a published example.
    const inRange = [...TABLE, '| ORACLE-012 | Optimizer | [`packages/engine/src/projection/p.external.characterization.test.ts`](x) | Again. |']
    expect(() => oracleRegistryRowsOf(registry(inRange))).toThrow('ORACLE-012 is listed twice')
    // A blank line ends a Markdown table, so a row below it would drop out silently.
    const split = [...TABLE.slice(0, 3), '', ...TABLE.slice(3)]
    expect(() => oracleRegistryRowsOf(registry(split))).toThrow('a table row appears after the table has ended')
    expect(() => oracleRegistryRowsOf(registry(TABLE, ['', '| ORACLE-099 | After | [`x.external.golden.test.ts`](x) | Prose above. |']))).toThrow(
      'a table row appears after the table has ended',
    )
  })
})

describe('the tolerance statements', () => {
  it('reads each distinct statement to the end of its sentence, in block and line comments, never in code', () => {
    expect(oracleTolerancesOf(FEDERAL_SOURCE)).toEqual(['$1'])
    expect(oracleTolerancesOf(STATE_SOURCE)).toEqual(['$1, asserted to cents where the model is exact', '$0.01 (the schedule is exact)'])
    // The period in 0.10 does not end the sentence; the one after the parenthesis does.
    expect(oracleTolerancesOf('/**\n * Tolerance: $0.10 (published to the dime).\n */')).toEqual(['$0.10 (published to the dime)'])
    // Prose after the sentence on the same line, and a closing marker, are not part of it.
    expect(oracleTolerancesOf('/**\n * Tolerance: $1. See DOCS/external-oracles.md.\n */')).toEqual(['$1'])
    expect(oracleTolerancesOf('/**\n * Access date: 2026-06-29.\n * Tolerance: $1. */')).toEqual(['$1'])
    expect(oracleTolerancesOf('/** Tolerance: $2 a year. */')).toEqual(['$2 a year'])
    expect(oracleTolerancesOf('// Tolerance: $3.\n/* Tolerance: $4. */')).toEqual(['$3', '$4'])
    // In a string, the label is data, not a statement.
    expect(oracleTolerancesOf("const note = 'Tolerance: $5.'\nconst other = `Tolerance: $6.`")).toEqual([])
  })

  it('refuses a statement that does not end its sentence rather than publishing it garbled', () => {
    // It would run into the next labelled field.
    expect(() => oracleTolerancesOf('/**\n * Tolerance: $1/yr\n * Access date: 2026-06-29. Tax year: 2026.\n */')).toThrow(
      'a "Tolerance:" statement must end its sentence with a period: "$1/yr"',
    )
    // Or into a blank comment line, or past the wrap limit.
    expect(() => oracleTolerancesOf('/**\n * Tolerance: $1 per case\n *\n * More prose.\n */')).toThrow('must end its sentence with a period')
    expect(() => oracleTolerancesOf('/**\n * Tolerance: a\n * b\n * c\n * d\n * e.\n */')).toThrow('must end its sentence with a period')
    expect(() => oracleTolerancesOf('/**\n * Tolerance: .\n */')).toThrow('a "Tolerance:" statement is empty')
  })
})

describe('the published oracle examples', () => {
  it('publishes each fixture file with its code-level cases, tolerances and registry rows, sorted by file', () => {
    expect(census({}).oracleExamples).toEqual([
      {
        file: FEDERAL,
        count: 2,
        tolerances: ['$1'],
        oracles: [{ id: 'ORACLE-001', domain: 'Federal tax', source: 'IRS Rev. Proc. 2025-32 — brackets.' }],
      },
      {
        file: STATE,
        count: 3,
        tolerances: ['$1, asserted to cents where the model is exact', '$0.01 (the schedule is exact)'],
        oracles: [
          { id: 'ORACLE-009/010', domain: 'State tax', source: 'NJ graduated brackets; KY flat rate.' },
          { id: 'ORACLE-013', domain: 'State tax', source: 'CA FTB basic deduction, pinned abc1234.' },
        ],
      },
    ])
    // No fixtures and no registry: nothing to publish and nothing to check.
    expect(census({ externalGoldenSources: {}, oracleRegistryText: null }).oracleExamples).toEqual([])
  })

  it('refuses a fixture with no registry row, a stale row, and a missing registry', () => {
    const unregistered = 'packages/engine/src/rmd/rmd.external.golden.test.ts'
    expect(() => census({ externalGoldenSources: { [FEDERAL]: FEDERAL_SOURCE, [STATE]: STATE_SOURCE, [unregistered]: FEDERAL_SOURCE } })).toThrow(
      `external oracle registry: ${unregistered} has no row in the "Implemented fixtures" table of DOCS/external-oracles.md`,
    )
    expect(() => census({ externalGoldenSources: { [FEDERAL]: FEDERAL_SOURCE } })).toThrow(
      `external oracle registry: row ORACLE-009/010 names ${STATE}, which is not an external golden fixture in the tree`,
    )
    // A stale row is refused even when there are no fixtures at all.
    expect(() => census({ externalGoldenSources: {} })).toThrow('which is not an external golden fixture in the tree')
    expect(() => census({ oracleRegistryText: null })).toThrow('DOCS/external-oracles.md is required')
  })

  it('refuses an oracle the file declares but the registry does not list, and the reverse', () => {
    const extra = STATE_SOURCE + "\n/** ORACLE-018 (DOCS/external-oracles.md) — Nevada. Tolerance: $1. */\nit('nv', () => {})"
    expect(() => census({ externalGoldenSources: { [FEDERAL]: FEDERAL_SOURCE, [STATE]: extra } })).toThrow(
      `external oracle registry: ${STATE} declares ORACLE-018, which the "Implemented fixtures" table does not list for it`,
    )
    const missing = STATE_SOURCE.replace('ORACLE-013 (DOCS/external-oracles.md)', 'ORACLE-013')
    expect(() => census({ externalGoldenSources: { [FEDERAL]: FEDERAL_SOURCE, [STATE]: missing } })).toThrow(
      `the "Implemented fixtures" table lists ORACLE-013 for ${STATE}, which the file does not declare as "ORACLE-013 (DOCS/external-oracles.md)"`,
    )
    // A bare mention of another file's oracle is a cross-reference, not a declaration (STATE_SOURCE mentions ORACLE-001).
    expect(census({}).oracleExamples.map((example) => example.oracles.map((oracle) => oracle.id))).toEqual([
      ['ORACLE-001'],
      ['ORACLE-009/010', 'ORACLE-013'],
    ])
  })

  it('refuses a fixture with no tolerance, or one it cannot read, naming the file', () => {
    expect(() => census({ externalGoldenSources: { [FEDERAL]: "/** ORACLE-001 (DOCS/external-oracles.md). */\nit('x', () => {})", [STATE]: STATE_SOURCE } })).toThrow(
      `external oracle fixture ${FEDERAL} states no "Tolerance:" line in its comments`,
    )
    const garbled = FEDERAL_SOURCE.replace('Tolerance: $1.', 'Tolerance: $1/yr')
    expect(() => census({ externalGoldenSources: { [FEDERAL]: garbled, [STATE]: STATE_SOURCE } })).toThrow(
      `external oracle fixture ${FEDERAL}: a "Tolerance:" statement must end its sentence with a period`,
    )
  })
})
