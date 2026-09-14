/**
 * Imports the Docs output-family census into frozen engine data.
 *
 * Reads `output-families.json`, `output-field-coverage.json`, and
 * `output-exclusions.json` from a directory (or three file paths) given on
 * the command line, and writes:
 *
 *   - packages/engine/src/rules/outputFamilies.ts
 *   - packages/engine/src/rules/outputFieldCoverage.ts
 *   - packages/engine/src/rules/census/<the three files, as imported>
 *
 * The census copies sit beside the modules generated from them so
 * `outputCensus.freshness.test.ts` can regenerate the modules through
 * `renderCensusModules` below and fail on a hand edit or a skipped
 * regeneration. Generated files name the census git commit in their header;
 * the importer refuses to run when that commit cannot be resolved, so the
 * provenance is never 'unknown'. LF newlines.
 *
 * Run: node packages/engine/scripts/import-output-census.mjs <census-dir>
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const engineDir = resolve(scriptDir, '..')
const rulesDir = join(engineDir, 'src', 'rules')
const censusDir = join(rulesDir, 'census')

/** The census files by role: read from the Docs directory, copied under src/rules/census/. */
const CENSUS_FILES = Object.freeze({
  families: 'output-families.json',
  coverage: 'output-field-coverage.json',
  exclusions: 'output-exclusions.json',
})

export const CENSUS_FILE_NAMES = Object.freeze(Object.values(CENSUS_FILES))

const FAMILY_KINDS = new Set(['engine', 'ui-native', 'ui-transformation', 'adapter'])
const UI_KINDS = new Set(['ui-native', 'ui-transformation'])

function lf(text) {
  return text.replace(/\r\n/g, '\n')
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function parseArgs(argv) {
  const args = [...argv]
  while (args[0] === '--') args.shift()
  if (args.length === 1) {
    const dir = resolve(args[0])
    return {
      families: join(dir, CENSUS_FILES.families),
      coverage: join(dir, CENSUS_FILES.coverage),
      exclusions: join(dir, CENSUS_FILES.exclusions),
    }
  }
  if (args.length === 3) {
    return {
      families: resolve(args[0]),
      coverage: resolve(args[1]),
      exclusions: resolve(args[2]),
    }
  }
  throw new Error(
    'usage: node packages/engine/scripts/import-output-census.mjs <census-dir>\n' +
      '   or: node packages/engine/scripts/import-output-census.mjs <families.json> <coverage.json> <exclusions.json>',
  )
}

/**
 * The commit the census files are checked out at. The generated headers exist
 * to pin the census revision, so a directory whose commit cannot be resolved
 * (an exported snapshot, an extracted tarball, no git on PATH) is an error
 * here, never an 'unknown' written into the headers.
 */
function censusCommit(filePath) {
  let commit
  try {
    // The Docs census is often supplied from another worktree, which may be
    // owned by the interactive user while this importer runs in a sandbox.
    // This command only reads its explicit cwd; accepting that one worktree
    // lets the generated provenance name the actual census revision.
    commit = execFileSync('git', ['-c', 'safe.directory=*', 'rev-parse', 'HEAD'], {
      cwd: dirname(filePath),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    throw new Error(
      'import-output-census: cannot resolve the census commit for ' + dirname(filePath) +
        ' (not inside a git worktree, or git is unavailable); the generated headers pin the census revision, so refusing rather than writing "unknown"',
      { cause: error },
    )
  }
  if (!/^[0-9a-f]{40}$/u.test(commit)) {
    throw new Error('import-output-census: git rev-parse HEAD returned ' + JSON.stringify(commit) + ', not a commit hash')
  }
  return commit
}

function assertArray(value, label) {
  if (!Array.isArray(value)) throw new Error(label + ' must be a JSON array')
  return value
}

function asString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function asStringArray(value) {
  if (!Array.isArray(value)) return []
  return value.filter((entry) => typeof entry === 'string')
}

function relocationOf(kind, raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && (raw.status === 'pending' || raw.status === 'done')) {
    return {
      status: raw.status,
      target: typeof raw.target === 'string' ? raw.target : null,
    }
  }
  if (UI_KINDS.has(kind)) return { status: 'pending', target: null }
  return null
}

function engineSourceOf(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  if (typeof raw.path !== 'string' || typeof raw.symbol !== 'string') return null
  return { path: raw.path, symbol: raw.symbol }
}

function surfacesOf(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((entry) => entry && typeof entry === 'object' && typeof entry.surface === 'string' && typeof entry.selector === 'string')
    .map((entry) => ({ surface: entry.surface, selector: entry.selector }))
}

function familyRecord(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') {
    throw new Error('every family must have a string id')
  }
  const kind = asString(raw.kind)
  if (!FAMILY_KINDS.has(kind)) {
    throw new Error('family ' + raw.id + ' has unknown kind ' + JSON.stringify(raw.kind))
  }
  return {
    id: raw.id,
    family: {
      title: asString(raw.title),
      group: asString(raw.group),
      meaning: asString(raw.meaning),
      unit: asString(raw.unit),
      basis: asString(raw.basis, 'n/a'),
      dimensions: asStringArray(raw.dimensions),
      kind,
      engineSource: engineSourceOf(raw.engineSource),
      surfaces: surfacesOf(raw.surfaces),
      relocation: relocationOf(kind, raw.relocation),
    },
  }
}

/**
 * One coverage row. A row that names a family must name one the census
 * defines: the engine's field-to-family link is what the catalog hangs on,
 * so a typo or a deleted id is rejected here as well as by the conformance
 * gate, rather than imported and left to rot.
 */
function coverageRow(raw, familyIds) {
  if (!raw || typeof raw !== 'object') throw new Error('every coverage row must be an object')
  const row = {
    source: asString(raw.source),
    owner: asString(raw.owner),
    field: asString(raw.field),
    disposition: asString(raw.disposition),
    familyId: typeof raw.familyId === 'string' ? raw.familyId : null,
  }
  const label = row.source + ' ' + row.owner + '.' + row.field
  if (row.disposition === 'family' && row.familyId === null) {
    throw new Error('coverage row ' + label + ' has disposition family but no familyId')
  }
  if (row.familyId !== null && !familyIds.has(row.familyId)) {
    throw new Error('coverage row ' + label + ' names familyId ' + row.familyId + ', which is not a family in ' + CENSUS_FILES.families)
  }
  if (typeof raw.reasonKind === 'string') row.reasonKind = raw.reasonKind
  if (typeof raw.reason === 'string') row.reason = raw.reason
  if (typeof raw.tsType === 'string') row.tsType = raw.tsType
  if (typeof raw.note === 'string') row.note = raw.note
  return row
}

function exclusionRow(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('every exclusion row must be an object')
  return {
    id: asString(raw.id),
    path: asString(raw.path),
    symbol: asString(raw.symbol),
    field: asString(raw.field),
    reasonKind: asString(raw.reasonKind),
    reason: asString(raw.reason),
  }
}

function emitTs(header, body) {
  return lf(header + '\n' + body + '\n')
}

function generatedHeader(kind, commit) {
  return [
    '/**',
    ' * GENERATED FILE — DO NOT EDIT BY HAND.',
    ' *',
    ' * ' + kind + ' imported from the output-family census at commit ' + commit + '.',
    ' * Regenerate: node packages/engine/scripts/import-output-census.mjs <census-dir>',
    ' */',
  ].join('\n')
}

function familiesModuleText(families, commit) {
  const keyed = {}
  for (const { id, family } of families) {
    if (keyed[id] !== undefined) throw new Error('duplicate family id ' + id)
    keyed[id] = family
  }
  const body = [
    '',
    "export type OutputFamilyKind = 'engine' | 'ui-native' | 'ui-transformation' | 'adapter'",
    '',
    'export interface OutputFamilySurface {',
    '  readonly surface: string',
    '  readonly selector: string',
    '}',
    '',
    'export interface OutputFamilyEngineSource {',
    '  readonly path: string',
    '  readonly symbol: string',
    '}',
    '',
    'export interface OutputFamilyRelocation {',
    "  readonly status: 'pending' | 'done'",
    '  readonly target: string | null',
    '}',
    '',
    'export interface OutputFamily {',
    '  readonly title: string',
    '  readonly group: string',
    '  readonly meaning: string',
    '  readonly unit: string',
    '  readonly basis: string',
    '  readonly dimensions: readonly string[]',
    '  readonly kind: OutputFamilyKind',
    '  readonly engineSource: OutputFamilyEngineSource | null',
    '  readonly surfaces: readonly OutputFamilySurface[]',
    '  readonly relocation: OutputFamilyRelocation | null',
    '}',
    '',
    'const families = ' + JSON.stringify(keyed, null, 2) + ' satisfies Record<string, OutputFamily>',
    '',
    'export const OUTPUT_FAMILIES = Object.freeze(families)',
    '',
    'export type OutputFamilyId = keyof typeof OUTPUT_FAMILIES',
    '',
    'export const outputFamilyIds = Object.freeze(',
    '  Object.keys(OUTPUT_FAMILIES).sort() as readonly OutputFamilyId[],',
    ')',
  ].join('\n')
  return emitTs(generatedHeader('Output families', commit), body)
}

function coverageModuleText(coverage, exclusions, commit) {
  const body = [
    '',
    'export interface OutputFieldCoverageRow {',
    '  readonly source: string',
    '  readonly owner: string',
    '  readonly field: string',
    '  readonly disposition: string',
    '  readonly familyId: string | null',
    '  readonly reasonKind?: string',
    '  readonly reason?: string',
    '  readonly tsType?: string',
    '  /** The census author\'s explanation of an inline computation with no identifier to find. */',
    '  readonly note?: string',
    '}',
    '',
    'export interface OutputFieldExclusion {',
    '  readonly id: string',
    '  readonly path: string',
    '  readonly symbol: string',
    '  readonly field: string',
    '  readonly reasonKind: string',
    '  readonly reason: string',
    '}',
    '',
    'type RawCoverage = {',
    '  source?: unknown',
    '  owner?: unknown',
    '  field?: unknown',
    '  disposition?: unknown',
    '  familyId?: unknown',
    '  reasonKind?: unknown',
    '  reason?: unknown',
    '  tsType?: unknown',
    '  note?: unknown',
    '}',
    '',
    'type RawExclusion = {',
    '  id?: unknown',
    '  path?: unknown',
    '  symbol?: unknown',
    '  field?: unknown',
    '  reasonKind?: unknown',
    '  reason?: unknown',
    '}',
    '',
    'function asString(value: unknown, fallback = \'\'): string {',
    '  return typeof value === \'string\' ? value : fallback',
    '}',
    '',
    'function coverageRow(raw: RawCoverage): OutputFieldCoverageRow {',
    '  const row: OutputFieldCoverageRow = {',
    '    source: asString(raw.source),',
    '    owner: asString(raw.owner),',
    '    field: asString(raw.field),',
    '    disposition: asString(raw.disposition),',
    '    familyId: typeof raw.familyId === \'string\' ? raw.familyId : null,',
    '  }',
    '  if (typeof raw.reasonKind === \'string\') Object.assign(row, { reasonKind: raw.reasonKind })',
    '  if (typeof raw.reason === \'string\') Object.assign(row, { reason: raw.reason })',
    '  if (typeof raw.tsType === \'string\') Object.assign(row, { tsType: raw.tsType })',
    '  if (typeof raw.note === \'string\') Object.assign(row, { note: raw.note })',
    '  return row',
    '}',
    '',
    'function exclusionRow(raw: RawExclusion): OutputFieldExclusion {',
    '  return {',
    '    id: asString(raw.id),',
    '    path: asString(raw.path),',
    '    symbol: asString(raw.symbol),',
    '    field: asString(raw.field),',
    '    reasonKind: asString(raw.reasonKind),',
    '    reason: asString(raw.reason),',
    '  }',
    '}',
    '',
    'function compareStrings(left: string, right: string): number {',
    '  return left < right ? -1 : left > right ? 1 : 0',
    '}',
    '',
    'const coverageCensus = ' + JSON.stringify(coverage, null, 2) + ' satisfies readonly RawCoverage[]',
    '',
    'const exclusionCensus = ' + JSON.stringify(exclusions, null, 2) + ' satisfies readonly RawExclusion[]',
    '',
    'export const OUTPUT_FIELD_COVERAGE = Object.freeze(',
    '  (coverageCensus as readonly RawCoverage[]).map(coverageRow).sort(',
    '    (left, right) =>',
    '      compareStrings(left.source, right.source) ||',
    '      compareStrings(left.owner, right.owner) ||',
    '      compareStrings(left.field, right.field),',
    '  ),',
    ') as readonly OutputFieldCoverageRow[]',
    '',
    'export const OUTPUT_FIELD_EXCLUSIONS = Object.freeze(',
    '  (exclusionCensus as readonly RawExclusion[]).map(exclusionRow).sort((left, right) =>',
    '    compareStrings(left.id, right.id),',
    '  ),',
    ') as readonly OutputFieldExclusion[]',
  ].join('\n')
  return emitTs(generatedHeader('Output field coverage', commit), body)
}

/**
 * Validates the parsed census and renders both frozen modules, their headers
 * naming `commit`. Pure: the freshness suite calls it on the committed census
 * copies and compares the result with the committed modules, so the generator
 * that wrote them is the one that checks them.
 */
export function renderCensusModules(census, commit) {
  const families = assertArray(census.families, CENSUS_FILES.families)
    .map(familyRecord)
    .sort((left, right) => compareStrings(left.id, right.id))
  const familyIds = new Set(families.map(({ id }) => id))
  const coverage = assertArray(census.coverage, CENSUS_FILES.coverage)
    .map((raw) => coverageRow(raw, familyIds))
    .sort((left, right) =>
      compareStrings(left.source, right.source) ||
      compareStrings(left.owner, right.owner) ||
      compareStrings(left.field, right.field),
    )
  const exclusions = assertArray(census.exclusions, CENSUS_FILES.exclusions)
    .map(exclusionRow)
    .sort((left, right) => compareStrings(left.id, right.id))
  return {
    outputFamilies: familiesModuleText(families, commit),
    outputFieldCoverage: coverageModuleText(coverage, exclusions, commit),
    counts: { families: families.length, coverage: coverage.length, exclusions: exclusions.length },
  }
}

function main() {
  const paths = parseArgs(process.argv.slice(2))
  const commit = censusCommit(paths.families)
  const texts = {
    families: lf(readFileSync(paths.families, 'utf8')),
    coverage: lf(readFileSync(paths.coverage, 'utf8')),
    exclusions: lf(readFileSync(paths.exclusions, 'utf8')),
  }
  const modules = renderCensusModules(
    {
      families: JSON.parse(texts.families),
      coverage: JSON.parse(texts.coverage),
      exclusions: JSON.parse(texts.exclusions),
    },
    commit,
  )
  writeFileSync(join(rulesDir, 'outputFamilies.ts'), modules.outputFamilies, 'utf8')
  writeFileSync(join(rulesDir, 'outputFieldCoverage.ts'), modules.outputFieldCoverage, 'utf8')
  // The census as imported, beside the modules generated from it, so the
  // freshness suite can regenerate the modules from the copies and fail on a
  // hand edit or a skipped regeneration instead of drifting silently.
  mkdirSync(censusDir, { recursive: true })
  for (const [role, fileName] of Object.entries(CENSUS_FILES)) {
    writeFileSync(join(censusDir, fileName), texts[role], 'utf8')
  }
  console.log(
    'import-output-census: ' + modules.counts.families + ' families, ' +
      modules.counts.coverage + ' coverage rows, ' +
      modules.counts.exclusions + ' exclusions, census ' + commit,
  )
}

if (import.meta.main) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
