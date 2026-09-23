import { describe, expect, it } from 'vitest'

import {
  buildCalculationCoverageReport,
  oracleRegistryRowsOf,
  oracleTolerancesOf,
  type CalculationCoverageInput,
} from './coverageReport.js'

/**
 * The census's published-examples list: each external-oracle fixture file
 * joined to its rows in the "Implemented fixtures" table of
 * DOCS/external-oracles.md and to the tolerances its comments state. The
 * committed registry and fixtures are held by the freshness suite; these
 * cases pin the parsing and the three ways the census refuses to build.
 */

const FEDERAL = 'packages/engine/src/tax/federalTax.external.golden.test.ts'
const STATE = 'packages/engine/src/tax/stateTax.external.golden.test.ts'

const REGISTRY = [
  '# External oracle comparisons',
  '',
  '## Implemented fixtures',
  '',
  'The external-oracle fixtures currently in the tree:',
  '',
  '| ID | Domain | Fixture | Primary source |',
  '|---|---|---|---|',
  `| ORACLE-001 | Federal tax | [\`${FEDERAL}\`](../${FEDERAL}) | IRS Rev. Proc. 2025-32 — brackets. |`,
  `| ORACLE-009/010 | State tax | [\`${STATE}\`](../${STATE}) | NJ graduated brackets; KY flat rate. |`,
  `| ORACLE-013 | State tax | [\`${STATE}\`](../${STATE}) | CA FTB **basic** deduction, pinned \`abc1234\`. |`,
  '| ORACLE-011/012 | Optimizer | [`packages/engine/src/projection/o.external.characterization.test.ts`](../x) | Owl, directional. |',
  '| — | TIPS ladder | [`packages/engine/src/ladder/l.worksheet.golden.test.ts`](../x) | Hand worksheet. |',
  '',
  'Known gaps, kept visible on purpose.',
  '',
  '| ORACLE-099 | Not a fixture row | [`packages/nowhere.external.golden.test.ts`](../x) | After the table. |',
].join('\n')

const FEDERAL_SOURCE = [
  '/**',
  ' * ORACLE-001 — federal income tax vs IRS Rev. Proc. 2025-32.',
  ' * Access date: 2026-06-29. Tax year under test: 2026. Tolerance: $1.',
  ' */',
  "it('reproduces the schedule', () => {})",
  "it('reproduces the deduction', () => {})",
  "// it('a pending case in a comment does not count', () => {})",
].join('\n')

const STATE_SOURCE = [
  '/**',
  ' * ORACLE-009 — New Jersey.',
  ' * Tolerance: $1, asserted to cents where the model is exact.',
  ' */',
  "it('nj', () => {})",
  '/**',
  ' * ORACLE-010 — Kentucky. Access date: 2026-06-30. Tolerance: $1, asserted to cents',
  ' * where the model is exact.',
  ' */',
  "it('ky', () => {})",
  '/**',
  ' * ORACLE-013 — California. Tolerance: $0.01 (the schedule is exact).',
  ' */',
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
    oracleRegistryText: REGISTRY,
    walkthroughs: [],
    symbolLineFor: () => 1,
    docTextFor: () => null,
    ...overrides,
  }).manifest
}

describe('the published oracle examples', () => {
  it('reads the fixture rows of the registry table, skipping rows that are not external goldens', () => {
    expect(oracleRegistryRowsOf(REGISTRY)).toEqual([
      { id: 'ORACLE-001', domain: 'Federal tax', source: 'IRS Rev. Proc. 2025-32 — brackets.', file: FEDERAL },
      { id: 'ORACLE-009/010', domain: 'State tax', source: 'NJ graduated brackets; KY flat rate.', file: STATE },
      // Markdown emphasis and code marks are removed from the source text.
      { id: 'ORACLE-013', domain: 'State tax', source: 'CA FTB basic deduction, pinned abc1234.', file: STATE },
    ])
  })

  it('reads each distinct tolerance statement, joining one that wraps onto the next comment line', () => {
    expect(oracleTolerancesOf(FEDERAL_SOURCE)).toEqual(['$1'])
    expect(oracleTolerancesOf(STATE_SOURCE)).toEqual([
      '$1, asserted to cents where the model is exact',
      '$0.01 (the schedule is exact)',
    ])
    // A "Tolerance:" outside a block comment (in code or a line comment) is not a statement.
    expect(oracleTolerancesOf("const note = 'Tolerance: $5.'\n// Tolerance: $5.")).toEqual([])
  })

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
    // No fixtures, no registry needed.
    expect(census({ externalGoldenSources: {}, oracleRegistryText: null }).oracleExamples).toEqual([])
  })

  it('refuses a fixture with no registry row, a stale row, a fixture with no tolerance, and a missing registry', () => {
    const unregistered = 'packages/engine/src/rmd/rmd.external.golden.test.ts'
    expect(() => census({ externalGoldenSources: { [FEDERAL]: FEDERAL_SOURCE, [STATE]: STATE_SOURCE, [unregistered]: FEDERAL_SOURCE } })).toThrow(
      `external oracle registry: ${unregistered} has no row in the "Implemented fixtures" table of DOCS/external-oracles.md`,
    )
    expect(() => census({ externalGoldenSources: { [FEDERAL]: FEDERAL_SOURCE } })).toThrow(
      `external oracle registry: row ORACLE-009/010 names ${STATE}, which is not an external golden fixture in the tree`,
    )
    expect(() => census({ externalGoldenSources: { [FEDERAL]: "it('x', () => {})", [STATE]: STATE_SOURCE } })).toThrow(
      `external oracle fixture ${FEDERAL} states no "Tolerance:" line in its comments`,
    )
    expect(() => census({ oracleRegistryText: null })).toThrow('DOCS/external-oracles.md is required')
  })

  it('refuses a registry whose fixture table is missing or malformed', () => {
    expect(() => oracleRegistryRowsOf('# External oracle comparisons\n')).toThrow('no "## Implemented fixtures" section')
    const withRow = (row: string) => REGISTRY.replace(/\| ORACLE-001 \|[^\n]*/u, row)
    expect(() => oracleRegistryRowsOf(withRow(`| ORACLE-001 | Federal tax | [\`${FEDERAL}\`](x) |`))).toThrow('a row has 3 cells, not 4')
    expect(() => oracleRegistryRowsOf(withRow(`| ORACLE-001 | Federal tax | ${FEDERAL} | IRS |`))).toThrow('row ORACLE-001 has no fixture link')
    expect(() => oracleRegistryRowsOf(withRow(`| — | Federal tax | [\`${FEDERAL}\`](x) | IRS |`))).toThrow(
      `the row for ${FEDERAL} has no ORACLE id`,
    )
  })
})
