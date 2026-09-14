#!/usr/bin/env node
/**
 * Imports the Docs output-family census into frozen engine data.
 *
 * Reads `output-families.json`, `output-field-coverage.json`, and
 * `output-exclusions.json` from a directory (or three file paths) given on
 * the command line, and writes:
 *
 *   - packages/engine/src/rules/outputFamilies.ts
 *   - packages/engine/src/rules/outputFieldCoverage.ts
 *
 * Generated files name the census git commit in their header. LF newlines.
 *
 * Run: node packages/engine/scripts/import-output-census.mjs <census-dir>
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const engineDir = resolve(scriptDir, '..')
const rulesDir = join(engineDir, 'src', 'rules')

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
      families: join(dir, 'output-families.json'),
      coverage: join(dir, 'output-field-coverage.json'),
      exclusions: join(dir, 'output-exclusions.json'),
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

function censusCommit(filePath) {
  try {
    // The Docs census is often supplied from another worktree, which may be
    // owned by the interactive user while this importer runs in a sandbox.
    // This command only reads its explicit cwd; accepting that one worktree
    // lets the generated provenance name the actual census revision.
    return execFileSync('git', ['-c', 'safe.directory=*', 'rev-parse', 'HEAD'], {
      cwd: dirname(filePath),
      encoding: 'utf8',
    }).trim()
  } catch {
    return 'unknown'
  }
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

function coverageRow(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('every coverage row must be an object')
  const row = {
    source: asString(raw.source),
    owner: asString(raw.owner),
    field: asString(raw.field),
    disposition: asString(raw.disposition),
    familyId: typeof raw.familyId === 'string' ? raw.familyId : null,
  }
  if (typeof raw.reasonKind === 'string') row.reasonKind = raw.reasonKind
  if (typeof raw.reason === 'string') row.reason = raw.reason
  if (typeof raw.tsType === 'string') row.tsType = raw.tsType
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

function writeFamilies(families, commit) {
  const keyed = {}
  for (const { id, family } of families.sort((left, right) => compareStrings(left.id, right.id))) {
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
  writeFileSync(join(rulesDir, 'outputFamilies.ts'), emitTs(generatedHeader('Output families', commit), body), 'utf8')
}

function writeCoverage(coverage, exclusions, commit) {
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
  writeFileSync(join(rulesDir, 'outputFieldCoverage.ts'), emitTs(generatedHeader('Output field coverage', commit), body), 'utf8')
}

function main() {
  const paths = parseArgs(process.argv.slice(2))
  const commit = censusCommit(paths.families)
  const families = assertArray(JSON.parse(readFileSync(paths.families, 'utf8')), 'output-families.json').map(familyRecord)
  const coverage = assertArray(JSON.parse(readFileSync(paths.coverage, 'utf8')), 'output-field-coverage.json')
    .map(coverageRow)
    .sort((left, right) =>
      compareStrings(left.source, right.source) ||
      compareStrings(left.owner, right.owner) ||
      compareStrings(left.field, right.field),
    )
  const exclusions = assertArray(JSON.parse(readFileSync(paths.exclusions, 'utf8')), 'output-exclusions.json')
    .map(exclusionRow)
    .sort((left, right) => compareStrings(left.id, right.id))
  writeFamilies(families, commit)
  writeCoverage(coverage, exclusions, commit)
  console.log(
    'import-output-census: ' + families.length + ' families, ' +
      coverage.length + ' coverage rows, ' +
      exclusions.length + ' exclusions, census ' + commit,
  )
}

if (import.meta.main) {
  main()
}
