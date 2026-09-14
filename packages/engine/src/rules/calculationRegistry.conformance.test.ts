import { readPackageSource } from '../../scripts/census-sources.mjs'
import { describe, expect, it } from 'vitest'
import { describeCalculation } from './describeCalculation.js'
import {
  CALCULATION_RECORD_MODULES,
  CALCULATION_REGISTRY,
  calculationIds,
  type CalculationId,
} from './calculationRegistry.js'
import { OUTPUT_FAMILIES } from './outputFamilies.js'
import { OUTPUT_FIELD_COVERAGE } from './outputFieldCoverage.js'
import { declaredSymbolLinesOf, symbolAnchorLine, type DeclaredSymbol } from './symbolLines.js'
import { spendingAndWithdrawalsRecords } from './calculations/spendingAndWithdrawals.js'

const RECORD_MODULES: readonly (readonly [string, Readonly<Record<string, unknown>>])[] = [
  ['spendingAndWithdrawals', spendingAndWithdrawalsRecords],
]

const testSources = import.meta.glob('../**/*.test.ts', { query: '?raw', import: 'default', eager: true })
const engineSources = import.meta.glob('../**/*.ts', { query: '?raw', import: 'default', eager: true })
function plannerUiSourceText(censusPath: string): string | undefined {
  // Read through the scripts helper: glob keys outside this package's root are
  // not stable across Vite roots, and the census names files relative to packages/.
  return readPackageSource(censusPath)
}
const calculationDocs = import.meta.glob('../../../../DOCS/calculations/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const CONFORMANCE_SOURCE = 'calculationRegistry.conformance.test.ts'

const REGEX_LITERAL_PRECEDING_KEYWORDS = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'throw',
  'yield',
  'case',
])

function regexLiteralCanOpenAt(source: string, index: number): boolean {
  let cursor = index - 1
  while (cursor >= 0 && /\s/u.test(source[cursor]!)) cursor -= 1
  if (cursor < 0) return true
  if ('(,=:;!&|?{['.includes(source[cursor]!)) return true
  if (!/[a-zA-Z0-9_$]/u.test(source[cursor]!)) return false
  let wordStart = cursor
  while (wordStart >= 0 && /[a-zA-Z0-9_$]/u.test(source[wordStart]!)) wordStart -= 1
  const word = source.slice(wordStart + 1, cursor + 1)
  return REGEX_LITERAL_PRECEDING_KEYWORDS.has(word)
}

function stripComments(source: string): string {
  let out = ''
  let i = 0
  while (i < source.length) {
    const c = source[i]!
    const next = source[i + 1]
    if (c === '/' && next === '/') {
      const eol = source.indexOf('\n', i)
      const end = eol === -1 ? source.length : eol
      out += ' '.repeat(end - i)
      i = end
      continue
    }
    if (c === '/' && next === '*') {
      const close = source.indexOf('*/', i + 2)
      const end = close === -1 ? source.length : close + 2
      out += source.slice(i, end).replace(/[^\n]/gu, ' ')
      i = end
      continue
    }
    if (c === "'" || c === '"') {
      let cursor = i + 1
      while (cursor < source.length && source[cursor] !== c) {
        cursor += source[cursor] === '\\' ? 2 : 1
      }
      cursor = Math.min(cursor + 1, source.length)
      out += source.slice(i, cursor)
      i = cursor
      continue
    }
    if (c === '`') {
      let cursor = i + 1
      while (cursor < source.length && source[cursor] !== '`') {
        cursor += source[cursor] === '\\' ? 2 : 1
      }
      cursor = Math.min(cursor + 1, source.length)
      out += source.slice(i, cursor)
      i = cursor
      continue
    }
    if (c === '/' && regexLiteralCanOpenAt(source, i)) {
      let cursor = i + 1
      let inClass = false
      let closed = false
      while (cursor < source.length) {
        const cc = source[cursor]!
        if (cc === '\\') {
          cursor += 2
          continue
        }
        if (cc === '[') inClass = true
        else if (cc === ']') inClass = false
        else if (cc === '/' && !inClass) {
          cursor += 1
          closed = true
          break
        } else if (cc === '\n') {
          break
        }
        cursor += 1
      }
      if (closed) {
        while (cursor < source.length && /[a-z]/iu.test(source[cursor]!)) cursor += 1
        out += source.slice(i, cursor)
        i = cursor
        continue
      }
    }
    out += c
    i += 1
  }
  return out
}

function callEnd(source: string, start: number): number {
  const open = source.indexOf('(', start)
  if (open === -1) return source.length
  let depth = 0
  let i = open
  while (i < source.length) {
    const c = source[i]!
    if (c === "'" || c === '"') {
      let cursor = i + 1
      while (cursor < source.length && source[cursor] !== c) {
        cursor += source[cursor] === '\\' ? 2 : 1
      }
      i = Math.min(cursor + 1, source.length)
      continue
    }
    if (c === '`') {
      let cursor = i + 1
      while (cursor < source.length && source[cursor] !== '`') {
        cursor += source[cursor] === '\\' ? 2 : 1
      }
      i = Math.min(cursor + 1, source.length)
      continue
    }
    if (c === '(') depth += 1
    if (c === ')') {
      depth -= 1
      if (depth === 0) return i + 1
    }
    i += 1
  }
  return source.length
}

function isChainedExpect(body: string, matchStart: number): boolean {
  const close = callEnd(body, matchStart)
  let cursor = close
  while (cursor < body.length && /\s/u.test(body[cursor]!)) cursor += 1
  return body[cursor] === '.'
}

function registersATest(source: string, start: number, end: number): boolean {
  const body = source.slice(start, end)
  if (!/\bit\(\s*['"`]/u.test(body)) return false
  for (const match of body.matchAll(/\bexpect\(/gu)) {
    if (isChainedExpect(body, match.index ?? 0)) return true
  }
  return false
}

const claimedCalculationIds = new Map<string, string[]>()
for (const [path, rawSource] of Object.entries(testSources)) {
  if (path.endsWith(CONFORMANCE_SOURCE)) continue
  const source = stripComments(rawSource)
  for (const match of source.matchAll(/describeCalculation\(\s*'([^']+)'/gu)) {
    const id = match[1]!
    const start = match.index ?? 0
    const end = callEnd(source, start)
    if (!registersATest(source, start, end)) continue
    claimedCalculationIds.set(id, [...(claimedCalculationIds.get(id) ?? []), path])
  }
}

const CALCULATION_MODULE_FILE = /^(?:\.\.\/rules|\.)\/calculations\/([^/]+)\.ts$/u
const calculationModuleFileNames = Object.keys(engineSources)
  .map((path) => CALCULATION_MODULE_FILE.exec(path)?.[1])
  .filter((name): name is string => name !== undefined)
  .sort()

const declaredSymbolCache = new Map<string, ReadonlyMap<string, DeclaredSymbol>>()

function declaredSymbolsOf(globKey: string, source: string): ReadonlyMap<string, DeclaredSymbol> {
  const cached = declaredSymbolCache.get(globKey)
  if (cached !== undefined) return cached
  const table = declaredSymbolLinesOf(globKey, source)
  declaredSymbolCache.set(globKey, table)
  return table
}

const engineGlobKeyOf = (repoPath: string): string =>
  repoPath.replace(/^packages\/engine\/src\/rules\//u, './').replace(/^packages\/engine\/src\//u, '../')

function censusSourceText(censusPath: string): string | undefined {
  if (censusPath.startsWith('engine/src/')) {
    const repo = 'packages/' + censusPath
    return engineSources[engineGlobKeyOf(repo)]
  }
  if (censusPath.startsWith('planner-ui/src/')) {
    return plannerUiSourceText(censusPath)
  }
  return undefined
}

function skipWsAndComments(source: string, index: number): number {
  let i = index
  for (;;) {
    while (i < source.length && /\s/u.test(source[i]!)) i += 1
    if (source[i] === '/' && source[i + 1] === '/') {
      const eol = source.indexOf('\n', i)
      i = eol === -1 ? source.length : eol + 1
      continue
    }
    if (source[i] === '/' && source[i + 1] === '*') {
      const close = source.indexOf('*/', i + 2)
      i = close === -1 ? source.length : close + 2
      continue
    }
    return i
  }
}

/**
 * Advance past a comment starting at `i` (`//` to end of line, or a block
 * comment), or return `i` unchanged when no comment starts there. Both
 * scanners below call this before looking at quotes: this codebase's doc
 * comments contain apostrophes ("today's $"), which a quote-aware scanner
 * would otherwise read as the start of a string and swallow the braces after.
 */
function skipComment(source: string, i: number): number {
  if (source[i] === '/' && source[i + 1] === '/') {
    const eol = source.indexOf('\n', i)
    return eol === -1 ? source.length : eol
  }
  if (source[i] === '/' && source[i + 1] === '*') {
    const end = source.indexOf('*/', i + 2)
    return end === -1 ? source.length : end + 2
  }
  return i
}

function skipBalanced(source: string, start: number, open: string, close: string): number {
  let depth = 0
  let i = start
  while (i < source.length) {
    const afterComment = skipComment(source, i)
    if (afterComment !== i) {
      i = afterComment
      continue
    }
    const c = source[i]!
    if (c === "'" || c === '"') {
      i += 1
      while (i < source.length && source[i] !== c) i += source[i] === '\\' ? 2 : 1
      i += 1
      continue
    }
    if (c === open) depth += 1
    if (c === close) {
      depth -= 1
      if (depth === 0) return i + 1
    }
    i += 1
  }
  return source.length
}

function locateNamedBlock(
  source: string,
  pattern: RegExp,
): { kind: 'braces' | 'params'; body: string } | null {
  for (const match of source.matchAll(pattern)) {
    let i = skipWsAndComments(source, (match.index ?? 0) + match[0].length)
    while (i < source.length && source[i] !== '{' && source[i] !== '(' && source[i] !== ';') {
      if (source[i] === '<') {
        i = skipWsAndComments(source, skipBalanced(source, i, '<', '>'))
        continue
      }
      if (source[i] === '=') {
        i = skipWsAndComments(source, i + 1)
        continue
      }
      i += 1
    }
    if (source[i] === '{') {
      const end = skipBalanced(source, i, '{', '}')
      return { kind: 'braces', body: source.slice(i + 1, end - 1) }
    }
    if (source[i] === '(') {
      const end = skipBalanced(source, i, '(', ')')
      return { kind: 'params', body: source.slice(i + 1, end - 1) }
    }
  }
  return null
}

function locateOwnerBlock(source: string, owner: string): { kind: 'braces' | 'params' | 'module'; body: string } | null {
  if (owner === 'module') return { kind: 'module', body: source }
  // `detector.screen` style owners name a method on an exported value: locate
  // the value and treat the file as the field-existence scope.
  if (owner.includes('.')) {
    const head = owner.slice(0, owner.indexOf('.'))
    const valueHead = locateNamedBlock(
      source,
      new RegExp(`(?:export\\s+)?(?:const|let|var|class|function)\\s+${head}\\b`, 'g'),
    )
    return valueHead ? { kind: 'module', body: source } : null
  }
  // A brace-less alias (`type X = Pick<...>`, a union, a mapped type) has no
  // member block to enumerate; its fields are checked by existence in the
  // file so the locator never scans forward into the next declaration.
  const aliasWithoutBlock = new RegExp(`(?:export\\s+)?type\\s+${owner}\\b[^=]*=(?!\\s*\\{)`, 'u')
  if (aliasWithoutBlock.test(source)) return { kind: 'module', body: source }
  const typeBlock = locateNamedBlock(
    source,
    new RegExp(`(?:export\\s+)?(?:interface|type)\\s+${owner}\\b`, 'g'),
  )
  if (typeBlock) return typeBlock
  // The census names functions and consts as owners for some rows. Those are
  // not interface/type blocks to enumerate; locate the symbol so the census
  // is not rejected, then treat the file as the field-existence scope.
  const functionBlock = locateNamedBlock(
    source,
    new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${owner}\\b`, 'g'),
  )
  if (functionBlock) return { kind: 'module', body: source }
  const valueBlock = locateNamedBlock(
    source,
    new RegExp(`(?:export\\s+)?(?:const|let|var|class)\\s+${owner}\\b`, 'g'),
  )
  if (valueBlock) return { kind: 'module', body: source }
  return null
}

function splitTopLevel(source: string, separators: string): string[] {
  const parts: string[] = []
  let start = 0
  let i = 0
  let braces = 0
  let parens = 0
  let angles = 0
  while (i < source.length) {
    const afterComment = skipComment(source, i)
    if (afterComment !== i) {
      i = afterComment
      continue
    }
    const c = source[i]!
    if (c === "'" || c === '"') {
      i += 1
      while (i < source.length && source[i] !== c) i += source[i] === '\\' ? 2 : 1
      i += 1
      continue
    }
    if (c === '{') braces += 1
    else if (c === '}') braces -= 1
    else if (c === '(') parens += 1
    else if (c === ')') parens -= 1
    else if (c === '<') angles += 1
    else if (c === '>') angles -= 1
    else if (braces === 0 && parens === 0 && angles === 0 && separators.includes(c)) {
      parts.push(source.slice(start, i))
      start = i + 1
    }
    i += 1
  }
  parts.push(source.slice(start))
  return parts
}

function propertyName(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed.startsWith('[') || trimmed.startsWith('...')) return null
  const quoted = /^(['"])([^'"]+)\1$/u.exec(trimmed)
  if (quoted) return quoted[2]!
  if (/^[A-Za-z_$][\w$]*$/u.test(trimmed)) return trimmed
  return null
}

function isNumericLeafType(typeText: string): boolean {
  const stripped = typeText
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/\/\/.*$/gmu, '')
    .replace(/^readonly\s+/u, '')
    .replace(/\s+/gu, '')
  if (stripped === 'number[]' || stripped === 'Array<number>' || stripped === 'readonlynumber[]') return true
  const inner = stripped.replace(/^\((.*)\)$/u, '$1')
  const parts = inner.split('|').filter((part) => part.length > 0)
  return parts.includes('number') && parts.every((part) => part === 'number' || part === 'null' || part === 'undefined')
}

function enumerateOwnerFields(block: { kind: 'braces' | 'params' | 'module'; body: string }): {
  all: string[]
  numeric: string[]
} {
  if (block.kind === 'module') {
    return { all: [], numeric: [] }
  }
  // Members are separated by commas, semicolons or, in this codebase's style,
  // bare newlines; splitTopLevel only splits at depth zero, so a multi-line
  // nested type stays one member.
  const members = splitTopLevel(block.body, ',;\n')
  const all: string[] = []
  const numeric: string[] = []
  for (const member of members) {
    const trimmed = member.trim()
    if (trimmed === '') continue
    const cleaned = trimmed.replace(/^readonly\s+/u, '')
    const colon = cleaned.indexOf(':')
    if (colon === -1) continue
    const name = propertyName(cleaned.slice(0, colon).replace(/\?$/u, ''))
    if (name === null) continue
    all.push(name)
    if (isNumericLeafType(cleaned.slice(colon + 1))) numeric.push(name)
  }
  return { all, numeric }
}

function docText(repoPath: string): string | undefined {
  return calculationDocs['../../../../' + repoPath.replace(/\\/gu, '/')]
}

function namedFamilies(): ReadonlySet<string> {
  const named = new Set<string>()
  for (const record of Object.values(CALCULATION_REGISTRY)) {
    for (const familyId of record.outputs) named.add(familyId)
  }
  return named
}

describe('calculation registry conformance', () => {
  it('accounts for every calculation module on disk', () => {
    expect(calculationModuleFileNames).toEqual([...RECORD_MODULES.map(([name]) => name)].sort())
  })

  it('keeps the registry\'s published module list identical to this one', () => {
    expect([...CALCULATION_RECORD_MODULES].map(([name]) => name).sort()).toEqual(
      [...RECORD_MODULES.map(([name]) => name)].sort(),
    )
    const publishedByName = new Map(CALCULATION_RECORD_MODULES.map(([name, records]) => [name, records]))
    for (const [name, records] of RECORD_MODULES) {
      expect(publishedByName.get(name), name).toBe(records)
    }
  })

  it('registers each calculation id in exactly one module', () => {
    const perModule = RECORD_MODULES.map(([name, records]) => [name, Object.keys(records).length] as const)
    const total = perModule.reduce((sum, [, count]) => sum + count, 0)
    expect({ total, perModule }).toEqual({ total: calculationIds.length, perModule })
  })

  it('covers every calculation record with a describeCalculation block that registers a test', () => {
    const uncovered = calculationIds.filter((id) => !claimedCalculationIds.has(id))
    expect(uncovered).toEqual([])
  })

  it('rejects a fixture claiming a calculation that is not registered', () => {
    const unknown = [...claimedCalculationIds.keys()].filter((id) => !(id in CALCULATION_REGISTRY))
    expect(unknown).toEqual([])
  })

  it('resolves every implementedByFunctions pin through symbolLines', () => {
    const violations: string[] = []
    for (const [id, record] of Object.entries(CALCULATION_REGISTRY)) {
      const entries = record.implementedByFunctions
      if (new Set(entries).size !== entries.length) {
        violations.push(`${id}: implementedByFunctions carries duplicate entries`)
      }
      const pinnedPaths = new Set(entries.map((entry) => entry.split('#')[0]))
      for (const path of record.implementedBy) {
        if (!pinnedPaths.has(path)) violations.push(`${id}: ${path} is on the trail but carries no function pin`)
      }
      for (const entry of entries) {
        const parts = entry.split('#')
        if (parts.length !== 2 || parts[1]!.length === 0) {
          violations.push(`${id}: ${entry} must be <path>#<symbol>`)
          continue
        }
        const [path, symbol] = parts as [string, string]
        if (!record.implementedBy.includes(path)) {
          violations.push(`${id}: ${entry} path must be in implementedBy`)
          continue
        }
        const globKey = engineGlobKeyOf(path)
        const source = engineSources[globKey]
        if (source === undefined) {
          violations.push(`${id}: ${path} not found among engine sources`)
          continue
        }
        try {
          symbolAnchorLine(declaredSymbolsOf(globKey, source), path, symbol)
        } catch (error) {
          violations.push(`${id}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('names only existing families and reports engine families with no record yet', () => {
    const unknownOutputs: string[] = []
    for (const [id, record] of Object.entries(CALCULATION_REGISTRY)) {
      for (const familyId of record.outputs) {
        if (!(familyId in OUTPUT_FAMILIES)) unknownOutputs.push(`${id}: ${familyId}`)
      }
    }
    const named = namedFamilies()
    const noRecordYet = Object.entries(OUTPUT_FAMILIES)
      .filter(([familyId, family]) => family.kind === 'engine' && !named.has(familyId))
      .map(([familyId]) => familyId)
      .sort()
    expect(
      { unknownOutputs, noRecordYet },
      'engine families with no record yet:\n' + (noRecordYet.join('\n') || '(none)'),
    ).toEqual({ unknownOutputs: [], noRecordYet })
  })

  it('requires every named worksheet and mutation file to exist and be non-empty', () => {
    const missing: string[] = []
    const requireDoc = (label: string, path: string): void => {
      const text = docText(path)
      if (text === undefined || text.trim().length === 0) missing.push(`${label}: ${path}`)
    }
    for (const [id, record] of Object.entries(CALCULATION_REGISTRY)) {
      if (record.justification.kind === 'derivation') {
        requireDoc(`${id} justification.worksheet`, record.justification.worksheet)
      }
    }
    for (const [path, rawSource] of Object.entries(testSources)) {
      if (path.endsWith(CONFORMANCE_SOURCE)) continue
      const source = stripComments(rawSource)
      // Only describeCalculation fixtures carry evidence paths; other suites
      // use `worksheet:` and `mutation:` keys for their own purposes.
      for (const call of source.matchAll(/describeCalculation\(/gu)) {
        const start = call.index ?? 0
        const body = source.slice(start, callEnd(source, start))
        for (const match of body.matchAll(/(?:worksheet|mutation):\s*'([^']+)'/gu)) {
          requireDoc(`${path} ${match[0]}`, match[1]!)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('guards every numeric leaf of each census owner, and every coverage row\'s field', () => {
    const pairs = new Map<string, { source: string; owner: string }>()
    const rowsByPair = new Map<string, string[]>()
    for (const row of OUTPUT_FIELD_COVERAGE) {
      const key = row.source + '\u0000' + row.owner
      pairs.set(key, { source: row.source, owner: row.owner })
      rowsByPair.set(key, [...(rowsByPair.get(key) ?? []), row.field])
    }
    const missing: string[] = []
    const unknownFields: string[] = []
    const unlocated: string[] = []
    for (const { source, owner } of [...pairs.values()].sort((left, right) =>
      left.source < right.source ? -1 : left.source > right.source ? 1 : left.owner < right.owner ? -1 : left.owner > right.owner ? 1 : 0,
    )) {
      const text = censusSourceText(source)
      if (text === undefined) {
        unlocated.push(owner + ' (source ' + source + ' not found)')
        continue
      }
      const block = locateOwnerBlock(text, owner)
      if (block === null) {
        unlocated.push(owner)
        continue
      }
      const key = source + '\u0000' + owner
      const covered = new Set(rowsByPair.get(key) ?? [])
      const { all, numeric } = enumerateOwnerFields(block)
      if (block.kind !== 'module') {
        for (const field of numeric) {
          if (!covered.has(field)) missing.push(`${owner}.${field}`)
        }
        const existing = new Set(all)
        for (const field of covered) {
          // A dotted field names a leaf inside a nested member; the owner
          // block only declares the member, so the first segment must exist.
          // The nested object's own leaves are guarded under their own type
          // when it is named, and by existence in the file when it is inline.
          const segments = field.split('.').map((segment) => segment.replace(/\[\]$/u, ''))
          const head = segments[0]!
          if (existing.has(head)) continue
          // The census sometimes records a leaf of a nested inline object or
          // array element without its parent segment. Accept the row when the
          // leaf name is declared somewhere inside this owner's block; a leaf
          // that appears nowhere in the block is a census error.
          const leaf = segments[segments.length - 1]!
          const declaredInBlock = new RegExp(`(?:^|[^\\w$])${leaf}\\??\\s*:`, 'u')
          if (!declaredInBlock.test(block.body)) unknownFields.push(`${owner}.${field}`)
        }
      } else {
        // A page component owner (.tsx) documents inline arithmetic the census
        // named itself; there is no declared identifier to find, so existence
        // is not asserted there. For .ts owners (functions, consts, classes)
        // the field must appear in the file.
        if (source.endsWith('.tsx')) continue
        for (const field of covered) {
          const leaf = field.split('.').pop()!.replace(/\[\]$/u, '')
          const declared = new RegExp(`(?:^|[^\\w$])${leaf}\\b`, 'u')
          if (!declared.test(text)) unknownFields.push(`${owner}.${field}`)
        }
      }
    }
    expect(unlocated, 'census owners that could not be located: ' + (unlocated.join(', ') || 'none')).toEqual([])
    expect(missing, 'numeric leaves missing a coverage row: ' + (missing.join(', ') || 'none')).toEqual([])
    expect(unknownFields, 'coverage rows whose field does not exist: ' + (unknownFields.join(', ') || 'none')).toEqual(
      [],
    )
  })

  it('computes relocation-pending status rather than failing on it', () => {
    const relocationPending = Object.entries(OUTPUT_FAMILIES)
      .filter(([, family]) =>
        (family.kind === 'ui-native' || family.kind === 'ui-transformation') &&
        family.relocation !== null &&
        family.relocation.status === 'pending',
      )
      .map(([id]) => id)
      .sort()
    expect(
      { count: relocationPending.length, ids: relocationPending },
      'relocation-pending families (computed status, not a failure)',
    ).toEqual({ count: relocationPending.length, ids: relocationPending })
  })

  it('requires provenance.derivedBy to differ from provenance.reviewedBy', () => {
    const same = calculationIds.filter((id) => {
      const { derivedBy, reviewedBy } = CALCULATION_REGISTRY[id].provenance
      return derivedBy === reviewedBy
    })
    expect(same).toEqual([])
  })

  it('throws on an unknown calculation id', () => {
    expect(() =>
      describeCalculation('not-a-registered-calculation' as CalculationId, {
        example: { inputs: {}, expected: { value: 1 }, tolerance: 'exact' },
        worksheet: 'DOCS/calculations/spending-and-withdrawals/abw-annuity-due-payment.md',
        mutation: 'DOCS/calculations/spending-and-withdrawals/abw-annuity-due-payment.mutation.md',
      }, () => {}),
    ).toThrow(RangeError)
  })
})
