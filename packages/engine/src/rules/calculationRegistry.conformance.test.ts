import { readPackageSource } from '../../scripts/census-sources.mjs'
import { describe, expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from './describeCalculation.js'
import {
  CALCULATION_RECORD_MODULES,
  CALCULATION_REGISTRY,
  calculationIds,
  type CalculationId,
  type CalculationRecord,
} from './calculationRegistry.js'
import { COVERAGE_ATTESTATIONS } from './coverageAttestations.js'
import {
  buildCalculationCoverageReport,
  type CalculationCoverageManifest,
  type CalculationRecordGates,
} from './coverageReport.js'
import { OUTPUT_FAMILIES, type OutputFamily } from './outputFamilies.js'
import { OUTPUT_FIELD_COVERAGE, type OutputFieldCoverageRow } from './outputFieldCoverage.js'
import { declaredSymbolLinesOf, symbolAnchorLine, type DeclaredSymbol } from './symbolLines.js'
import { laddersAndValuationRecords } from './calculations/laddersAndValuation.js'
import { spendingAndWithdrawalsRecords } from './calculations/spendingAndWithdrawals.js'

const RECORD_MODULES: readonly (readonly [string, Readonly<Record<string, unknown>>])[] = [
  ['laddersAndValuation', laddersAndValuationRecords],
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

const ABW_WORKSHEET = 'DOCS/calculations/spending-and-withdrawals/abw-annuity-due-payment.md'
const ABW_MUTATION = 'DOCS/calculations/spending-and-withdrawals/abw-annuity-due-payment.mutation.md'

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

function symbolLineFor(path: string, symbol: string): number {
  const globKey = engineGlobKeyOf(path)
  const source = engineSources[globKey]
  if (source === undefined) throw new Error(path + ' is not an engine source file the glob can see')
  return symbolAnchorLine(declaredSymbolsOf(globKey, source), path, symbol)
}

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

/** A half-open index span `[start, end)` of the text it was found in. */
type Span = { readonly start: number; readonly end: number }

/** An identifier character: a letter, digit, `_`, or `$`. */
function isIdentifierChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9_$]/u.test(ch)
}

/**
 * Index of the next occurrence of `word` in `text` at or after `from` that
 * stands as a whole word: at the start of the text or after a character
 * outside `[A-Za-z0-9_$]`, and at the end of the text or before such a
 * character. Replaces the pattern `(?:^|[^\w$])word\b` with `word`
 * interpolated; a `$` in the word is compared literally, so `$foo` and
 * `foo$` are names of their own and neither is found by `foo`. -1 when there
 * is no such occurrence.
 */
function indexOfWord(text: string, word: string, from = 0): number {
  for (let at = text.indexOf(word, from); at !== -1; at = text.indexOf(word, at + 1)) {
    if (!isIdentifierChar(text[at - 1]) && !isIdentifierChar(text[at + word.length])) return at
  }
  return -1
}

/** Whether `word` occurs anywhere in `text` as a whole word (see indexOfWord). */
function hasWord(text: string, word: string): boolean {
  return indexOfWord(text, word) !== -1
}

/**
 * Whether `word` ends exactly at index `end` of `text` and begins at a word
 * start (the start of the text or after a character outside `[A-Za-z0-9_$]`),
 * so that `const` is found before `foo` in `export const foo` and not in
 * `myconst foo`.
 */
function wordEndsAt(text: string, end: number, word: string): boolean {
  const start = end - word.length
  return start >= 0 && text.startsWith(word, start) && !isIdentifierChar(text[start - 1])
}

/**
 * Fold an optional modifier into a span start. When `modifier` stands before
 * index `start` of `text` with at least one whitespace character between,
 * return the index where the modifier begins; otherwise return `start`
 * unchanged. Replaces an optional `(?:modifier\s+)?` prefix of a pattern.
 */
function foldModifier(text: string, start: number, modifier: string): number {
  let cursor = start
  while (cursor > 0 && /\s/u.test(text[cursor - 1]!)) cursor -= 1
  if (cursor === start) return start
  return wordEndsAt(text, cursor, modifier) ? cursor - modifier.length : start
}

/**
 * Every declaration of `name` in `source` under one of `keywords`, in source
 * order. A declaration is a keyword at a word start, at least one whitespace
 * character, then `name` followed by an identifier boundary (the end of the
 * text or a character outside `[A-Za-z0-9_$]`). An `export` standing before
 * the keyword, and with `modifiers.async` an `async` standing before it, is
 * folded into the span's start; the span's end is the index just past `name`.
 * Replaces `(?:export\s+)?(?:async\s+)?(?:kw1|kw2|...)\s+name\b` scanned with
 * the `g` flag over the same text, which is the raw source: comments and
 * strings are not stripped here, exactly as before.
 */
function declarationsOf(
  source: string,
  keywords: readonly string[],
  name: string,
  modifiers: { async?: boolean } = {},
): Span[] {
  const spans: Span[] = []
  for (let at = indexOfWord(source, name); at !== -1; at = indexOfWord(source, name, at + 1)) {
    let cursor = at
    while (cursor > 0 && /\s/u.test(source[cursor - 1]!)) cursor -= 1
    if (cursor === at) continue
    const keyword = keywords.find((candidate) => wordEndsAt(source, cursor, candidate))
    if (keyword === undefined) continue
    let start = cursor - keyword.length
    if (modifiers.async === true) start = foldModifier(source, start, 'async')
    start = foldModifier(source, start, 'export')
    spans.push({ start, end: at + name.length })
  }
  return spans
}

const VALUE_OR_FUNCTION_KEYWORDS: readonly string[] = ['const', 'let', 'var', 'class', 'function']
const TYPE_KEYWORDS: readonly string[] = ['interface', 'type']
const ALIAS_KEYWORDS: readonly string[] = ['type']
const FUNCTION_KEYWORDS: readonly string[] = ['function']
const VALUE_KEYWORDS: readonly string[] = ['const', 'let', 'var', 'class']

/**
 * Whether `source` declares `name` as a brace-less type alias: a `type name`
 * declaration whose first following `=` is not followed, after optional
 * whitespace, by `{`. Replaces `(?:export\s+)?type\s+name\b[^=]*=(?!\s*\{)`
 * tested against the file: any one such declaration is enough, and a `type
 * name` with no `=` after it at all counts for nothing.
 */
function isAliasWithoutBlock(source: string, name: string): boolean {
  for (const { end } of declarationsOf(source, ALIAS_KEYWORDS, name)) {
    const equals = source.indexOf('=', end)
    if (equals === -1) continue
    let cursor = equals + 1
    while (cursor < source.length && /\s/u.test(source[cursor]!)) cursor += 1
    if (source[cursor] !== '{') return true
  }
  return false
}

/**
 * Whether `body` (the inside of a member block) declares a member named
 * `leaf`: the leaf at a word start (the start of the text or after a
 * character outside `[A-Za-z0-9_$]`), then an optional `?`, optional
 * whitespace, and `:`. Replaces `(?:^|[^\w$])leaf\??\s*:`.
 */
function declaresMember(body: string, leaf: string): boolean {
  for (let at = indexOfWord(body, leaf); at !== -1; at = indexOfWord(body, leaf, at + 1)) {
    let cursor = at + leaf.length
    if (body[cursor] === '?') cursor += 1
    while (cursor < body.length && /\s/u.test(body[cursor]!)) cursor += 1
    if (body[cursor] === ':') return true
  }
  return false
}

/**
 * The block opened by the first of `declarations` (spans from declarationsOf,
 * found in `source`) that leads to one: from just past the declared name,
 * skip generics and an initializer's `=` up to the first `{` or `(`, and
 * return what that brace or parenthesis pair encloses. Declarations that run
 * into a `;` first, or into nothing, are passed over.
 */
function locateNamedBlock(
  source: string,
  declarations: Iterable<Span>,
): { kind: 'braces' | 'params'; body: string } | null {
  for (const { end } of declarations) {
    let i = skipWsAndComments(source, end)
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

/**
 * A census name (an owner, the head of a dotted owner, or a field leaf) about
 * to be handed to a locator. The census is a committed artifact, not user
 * input, but the name still steers a scan of source text, so it must be
 * identifier-shaped (letters, digits, `_`, `$`); anything else is a malformed
 * census row and fails here by name. The scanners compare characters and
 * never compile a pattern, so a `$` is literal and nothing is escaped: the
 * name is returned as it is.
 */
function censusName(name: string, label: string): string {
  if (!/^[A-Za-z_$][\w$]*$/u.test(name)) {
    throw new RangeError(`${label} ${JSON.stringify(name)} is not identifier-shaped`)
  }
  return name
}

function locateOwnerBlock(source: string, owner: string): { kind: 'braces' | 'params' | 'module'; body: string } | null {
  if (owner === 'module') return { kind: 'module', body: source }
  // `detector.screen` style owners name a method on an exported value: locate
  // the value and treat the file as the field-existence scope.
  if (owner.includes('.')) {
    const head = censusName(owner.slice(0, owner.indexOf('.')), 'census owner head')
    const valueHead = locateNamedBlock(source, declarationsOf(source, VALUE_OR_FUNCTION_KEYWORDS, head))
    return valueHead ? { kind: 'module', body: source } : null
  }
  // A brace-less alias (`type X = Pick<...>`, a union, a mapped type) has no
  // member block to enumerate; its fields are checked by existence in the
  // file so the locator never scans forward into the next declaration.
  const name = censusName(owner, 'census owner')
  if (isAliasWithoutBlock(source, name)) return { kind: 'module', body: source }
  const typeBlock = locateNamedBlock(source, declarationsOf(source, TYPE_KEYWORDS, name))
  if (typeBlock) return typeBlock
  // The census names functions and consts as owners for some rows. Those are
  // not interface/type blocks to enumerate; locate the symbol so the census
  // is not rejected, then treat the file as the field-existence scope.
  const functionBlock = locateNamedBlock(source, declarationsOf(source, FUNCTION_KEYWORDS, name, { async: true }))
  if (functionBlock) return { kind: 'module', body: source }
  const valueBlock = locateNamedBlock(source, declarationsOf(source, VALUE_KEYWORDS, name))
  if (valueBlock) return { kind: 'module', body: source }
  return null
}

/**
 * Whether the `<` at `index` of `source` is closed by a matching `>` later in
 * the same bracket scope. Walks forward from the `<`, skipping comments and
 * string literals the way splitTopLevel does, `=>` as one token, and balanced
 * `(...)` and `{...}` blocks whole; a nested glued `<` counts up and a `>`
 * counts down. Answers yes when the count reaches zero, and no when the walk
 * first meets a `)` or `}` that closes the enclosing scope, or the end of the
 * text.
 */
function closesAngleWithinScope(source: string, index: number): boolean {
  let depth = 1
  let i = index + 1
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
    if (c === '=' && source[i + 1] === '>') {
      i += 2
      continue
    }
    if (c === '(' || c === '{') {
      i = skipBalanced(source, i, c, c === '(' ? ')' : '}')
      continue
    }
    if (c === ')' || c === '}') return false
    if (c === '<') {
      if (/[\w$]/u.test(source[i - 1]!) && source[i + 1] !== '=') depth += 1
    } else if (c === '>') {
      depth -= 1
      if (depth === 0) return true
    }
    i += 1
  }
  return false
}

/**
 * Splits `source` at any of `separators` that sits at depth zero of braces,
 * parentheses, and angle brackets. `=>` is one token that touches no counter
 * (its `>` is not a closing angle). A `<` opens an angle scope only when it
 * is a generic opener: glued to the identifier before it (`Map<`, `f<T>`),
 * not the first half of `<=`, and closed by a matching `>` later in the same
 * bracket scope (closesAngleWithinScope). A comparison written `a < b` has a
 * space before it and counts for nothing; a glued comparison `width<b` in a
 * default value, with no `>` after it in its scope, counts for nothing
 * either, so neither can leave the scanner believing it is inside a generic.
 * The angle count is also saved and reset at every `(` or `{` and restored at
 * the matching close, so whatever a nested scope leaves open dies with it,
 * and it never goes below zero. The one accepted residual: a glued comparison
 * followed later in the same scope by a bare `>` comparison
 * (`a<b ? 1 : 0, next: number = c > d`) still pairs, and the members between
 * merge. The census is a committed artifact and the gate over its rows is
 * the real check.
 */
function splitTopLevel(source: string, separators: string): string[] {
  const parts: string[] = []
  let start = 0
  let i = 0
  let braces = 0
  let parens = 0
  let angles = 0
  const savedAngles: number[] = []
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
    if (c === '=' && source[i + 1] === '>') {
      i += 2
      continue
    }
    if (c === '{' || c === '(') {
      if (c === '{') braces += 1
      else parens += 1
      savedAngles.push(angles)
      angles = 0
    } else if (c === '}' || c === ')') {
      if (c === '}') braces -= 1
      else parens -= 1
      angles = savedAngles.pop() ?? 0
    } else if (c === '<') {
      const gluedToName = i > 0 && /[\w$]/u.test(source[i - 1]!)
      if (gluedToName && source[i + 1] !== '=' && closesAngleWithinScope(source, i)) angles += 1
    } else if (c === '>') angles = Math.max(0, angles - 1)
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

interface CodeLevel {
  readonly code: string
  readonly literals: ReadonlySet<string>
}

const codeLevelCache = new Map<string, CodeLevel>()

/**
 * `source` at CODE level for the field-existence check: comments and the
 * contents of string, template, and regex literals are blanked (newlines
 * kept), and the complete values of plain string literals are collected
 * separately, because an owner such as a CSV column list names its fields as
 * whole literals. A quote with no closing quote on its own line is not a
 * string — a JSX text apostrophe ("don't") would otherwise swallow the code
 * after it — and template substitutions stay code.
 */
function codeLevelOf(censusPath: string, source: string): CodeLevel {
  const cached = codeLevelCache.get(censusPath)
  if (cached !== undefined) return cached
  let code = ''
  const literals = new Set<string>()
  let i = 0
  while (i < source.length) {
    const afterComment = skipComment(source, i)
    if (afterComment !== i) {
      code += source.slice(i, afterComment).replace(/[^\n]/gu, ' ')
      i = afterComment
      continue
    }
    const c = source[i]!
    if (c === "'" || c === '"') {
      let cursor = i + 1
      while (cursor < source.length && source[cursor] !== c && source[cursor] !== '\n') {
        cursor += source[cursor] === '\\' ? 2 : 1
      }
      if (source[cursor] === c) {
        literals.add(source.slice(i + 1, cursor))
        code += c + ' '.repeat(cursor - i - 1) + c
        i = cursor + 1
        continue
      }
      // No closing quote on this line: JSX text or prose, not a literal.
      code += c
      i += 1
      continue
    }
    if (c === '`') {
      let cursor = i + 1
      let depth = 0
      code += c
      while (cursor < source.length) {
        const cc = source[cursor]!
        if (depth === 0) {
          if (cc === '`') {
            code += cc
            cursor += 1
            break
          }
          if (cc === '\\') {
            code += '  '
            cursor += 2
            continue
          }
          if (cc === '$' && source[cursor + 1] === '{') {
            depth = 1
            code += '${'
            cursor += 2
            continue
          }
          code += cc === '\n' ? cc : ' '
          cursor += 1
          continue
        }
        if (cc === '{') depth += 1
        else if (cc === '}') depth -= 1
        code += cc
        cursor += 1
      }
      i = cursor
      continue
    }
    if (c === '/' && regexLiteralCanOpenAt(source, i)) {
      let cursor = i + 1
      let inClass = false
      let closed = false
      while (cursor < source.length && source[cursor] !== '\n') {
        const cc = source[cursor]!
        if (cc === '\\') {
          cursor += 2
          continue
        }
        if (cc === '[') inClass = true
        else if (cc === ']') inClass = false
        else if (cc === '/' && !inClass) {
          closed = true
          break
        }
        cursor += 1
      }
      if (closed) {
        code += '/' + ' '.repeat(cursor - i - 1) + '/'
        i = cursor + 1
        continue
      }
    }
    code += c
    i += 1
  }
  const result = { code, literals }
  codeLevelCache.set(censusPath, result)
  return result
}

function docText(repoPath: string): string | undefined {
  return calculationDocs['../../../../' + repoPath.replace(/\\/gu, '/')]
}

/** Families some record's `outputs` name — `feeds` deliberately excluded, since feeding is not computing. */
function computedFamilies(): ReadonlySet<string> {
  const computed = new Set<string>()
  for (const record of Object.values(CALCULATION_REGISTRY)) {
    for (const familyId of record.outputs) computed.add(familyId)
  }
  return computed
}

/** Family ids in `outputs` or `feeds` that are not families, each prefixed by the list that named it. */
function unknownFamilyIds(record: CalculationRecord, families: Readonly<Record<string, unknown>>): string[] {
  const unknown: string[] = []
  for (const familyId of record.outputs) {
    if (!Object.hasOwn(families, familyId)) unknown.push(`outputs: ${familyId}`)
  }
  for (const familyId of record.feeds ?? []) {
    if (!Object.hasOwn(families, familyId)) unknown.push(`feeds: ${familyId}`)
  }
  return unknown
}

/** Family ids named in both `outputs` and `feeds` — a record cannot both be a family's number and merely enter it. */
function overlappingFamilyIds(record: CalculationRecord): string[] {
  const outputs = new Set<string>(record.outputs)
  return (record.feeds ?? []).filter((familyId) => outputs.has(familyId))
}

/** Whether the record names at least one family across `outputs` and `feeds`. */
function namesAFamily(record: CalculationRecord): boolean {
  return record.outputs.length + (record.feeds ?? []).length > 0
}

let publishedManifestMemo: CalculationCoverageManifest | null = null

/**
 * The manifest the generator would publish for the registry as it stands,
 * built by the same report builder from this suite's own view of the
 * sources. The family-status gates below check the builder's published lists
 * against the registry independently, so a drift in either shows up here
 * rather than only in the byte-for-byte freshness pin.
 */
function publishedManifest(): CalculationCoverageManifest {
  if (publishedManifestMemo !== null) return publishedManifestMemo
  publishedManifestMemo = buildCalculationCoverageReport({
    registry: CALCULATION_REGISTRY,
    recordModules: CALCULATION_RECORD_MODULES,
    families: OUTPUT_FAMILIES,
    attestations: COVERAGE_ATTESTATIONS,
    testSources,
    externalGoldenSources: {},
    walkthroughs: [],
    symbolLineFor,
    docTextFor: (path) => docText(path) ?? null,
  }).manifest
  return publishedManifestMemo
}

const SYNTHETIC_ID = 'synthetic-calculation'
const SYNTHETIC_FIXTURE = [
  `describeCalculation('${SYNTHETIC_ID}', { example: {}, worksheet: 'w', mutation: 'm' }, () => {`,
  "  it('registers a test', () => {",
  '    expect(1).toBe(1)',
  '  })',
  '})',
  '',
].join('\n')

function syntheticFamily(kind: OutputFamily['kind'], relocation: OutputFamily['relocation']): OutputFamily {
  return {
    title: 'Synthetic family',
    group: 'synthetic',
    meaning: 'A family that exists only inside this test.',
    unit: 'usd',
    basis: 'nominal',
    dimensions: [],
    kind,
    engineSource: null,
    surfaces: [{ surface: 'page', selector: 'value' }],
    relocation,
  }
}

function syntheticRecord(outputs: readonly string[], feeds?: readonly string[]): CalculationRecord {
  return {
    title: 'Synthetic calculation',
    purpose: 'Exists only to drive the report builder in this test.',
    kind: 'formula',
    outputs: outputs as unknown as CalculationRecord['outputs'],
    ...(feeds === undefined ? {} : { feeds: feeds as unknown as CalculationRecord['feeds'] }),
    statement: 'y = x',
    formula: null,
    justification: { kind: 'assumption', rationale: 'test', intendedUse: 'test', errorBound: null },
    limits: [],
    implementedBy: ['packages/engine/src/spending/abw.ts'],
    implementedByFunctions: ['packages/engine/src/spending/abw.ts#abwAnnualPayment'],
    verifiedOn: '2026-09-14',
    provenance: { derivedBy: 'deriving-agent', implementedBy: 'implementing-agent', reviewedBy: 'reviewing-agent' },
  }
}

/**
 * A two-family report: one ui family still relocation-pending, one done, both
 * explained by one passing record unless `record` substitutes another.
 */
function syntheticReport(
  options: {
    readonly symbolLineFor?: (path: string, symbol: string) => number
    readonly record?: CalculationRecord
  } = {},
) {
  const registry = {
    [SYNTHETIC_ID]: options.record ?? syntheticRecord(['synthetic-ui-pending', 'synthetic-ui-done']),
  }
  return buildCalculationCoverageReport({
    registry,
    recordModules: [['synthetic', registry]],
    families: {
      'synthetic-ui-pending': syntheticFamily('ui-native', { status: 'pending', target: null }),
      'synthetic-ui-done': syntheticFamily('ui-transformation', { status: 'done', target: 'packages/engine/src/synthetic.ts' }),
    },
    attestations: {},
    testSources: { '../spending/synthetic.evidence.test.ts': SYNTHETIC_FIXTURE },
    externalGoldenSources: {},
    walkthroughs: [],
    symbolLineFor: options.symbolLineFor ?? (() => 1),
    docTextFor: () => null,
  })
}

function gatesAllPass(gates: CalculationRecordGates): boolean {
  return Object.values(gates).every((gate) => gate === true)
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

  it('names only families that exist in OUTPUT_FAMILIES, in outputs and in feeds alike', () => {
    const unknown: string[] = []
    for (const [id, record] of Object.entries(CALCULATION_REGISTRY)) {
      for (const entry of unknownFamilyIds(record, OUTPUT_FAMILIES)) unknown.push(`${id} ${entry}`)
    }
    expect(unknown).toEqual([])
  })

  it('keeps outputs and feeds disjoint on every record', () => {
    const overlapping: string[] = []
    for (const [id, record] of Object.entries(CALCULATION_REGISTRY)) {
      for (const familyId of overlappingFamilyIds(record)) overlapping.push(`${id}: ${familyId}`)
    }
    expect(overlapping).toEqual([])
  })

  it('names at least one family across outputs and feeds on every record', () => {
    const nameless = Object.entries(CALCULATION_REGISTRY)
      .filter(([, record]) => !namesAFamily(record))
      .map(([id]) => id)
    expect(nameless).toEqual([])
  })

  it('rejects a synthetic record whose feeds names a family that does not exist', () => {
    const record = syntheticRecord(['synthetic-ui-done'], ['synthetic-missing'])
    expect(unknownFamilyIds(record, { 'synthetic-ui-done': true })).toEqual(['feeds: synthetic-missing'])
    // The builder's familiesExist gate is the same test, published per record.
    expect(syntheticReport({ record }).shards[0]!.shard.records[0]!.gates.familiesExist).toBe(false)
  })

  it('rejects a synthetic record whose feeds repeats one of its outputs', () => {
    expect(overlappingFamilyIds(syntheticRecord(['synthetic-ui-done'], ['synthetic-ui-done']))).toEqual([
      'synthetic-ui-done',
    ])
    expect(overlappingFamilyIds(syntheticRecord(['synthetic-ui-done'], ['synthetic-ui-pending']))).toEqual([])
  })

  it('rejects a synthetic record that names no family in outputs or feeds', () => {
    expect(namesAFamily(syntheticRecord([]))).toBe(false)
    expect(namesAFamily(syntheticRecord([], []))).toBe(false)
    expect(namesAFamily(syntheticRecord([], ['synthetic-ui-done']))).toBe(true)
    expect(namesAFamily(syntheticRecord(['synthetic-ui-done']))).toBe(true)
  })

  it('publishes no-record-yet for exactly the families no record computes, so an engine family is never silently uncatalogued', () => {
    const computed = computedFamilies()
    const { noRecordYet } = publishedManifest().families
    const published = new Set(noRecordYet)
    const violations: string[] = []
    for (const familyId of noRecordYet) {
      if (!Object.hasOwn(OUTPUT_FAMILIES, familyId)) {
        violations.push(`${familyId}: published as no-record-yet but is not a family`)
      } else if (computed.has(familyId)) {
        violations.push(`${familyId}: published as no-record-yet although a record's outputs name it`)
      }
    }
    for (const [familyId, family] of Object.entries(OUTPUT_FAMILIES)) {
      if (!computed.has(familyId) && !published.has(familyId)) {
        violations.push(`${familyId} (${family.kind}): no record computes it and the report does not say so`)
      }
    }
    expect(violations).toEqual([])
    expect(noRecordYet).toEqual([...noRecordYet].sort())
  })

  it('publishes fedBy for exactly the families some record feeds, as sorted record ids', () => {
    const expected: Record<string, string[]> = {}
    // Widened: the frozen registry's inferred type omits `feeds` until a record declares one.
    for (const [id, record] of Object.entries<CalculationRecord>(CALCULATION_REGISTRY)) {
      for (const familyId of record.feeds ?? []) {
        if (!Object.hasOwn(OUTPUT_FAMILIES, familyId)) continue
        const feeders = expected[familyId] ?? []
        feeders.push(id)
        expected[familyId] = feeders
      }
    }
    for (const feeders of Object.values(expected)) feeders.sort()
    const { fedBy } = publishedManifest().families
    expect(fedBy).toEqual(expected)
    expect(Object.keys(fedBy)).toEqual(Object.keys(fedBy).sort())
  })

  it('links every family-disposition coverage row to a family that exists', () => {
    const violations: string[] = []
    for (const row of OUTPUT_FIELD_COVERAGE) {
      const label = `${row.source} ${row.owner}.${row.field}`
      if (row.disposition === 'family' && row.familyId === null) {
        violations.push(`${label}: disposition family without a familyId`)
      }
      if (row.familyId !== null && !Object.hasOwn(OUTPUT_FAMILIES, row.familyId)) {
        violations.push(`${label}: familyId ${row.familyId} is not a family`)
      }
    }
    expect(violations).toEqual([])
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

  it('binds a derivation fixture to the record\'s own worksheet', () => {
    expect(() =>
      describeCalculation(
        'abw-annuity-due-payment',
        {
          example: { inputs: {}, expected: { payment: 110 }, tolerance: 'exact' },
          worksheet: 'DOCS/calculations/spending-and-withdrawals/another-worksheet.md',
          mutation: 'DOCS/calculations/spending-and-withdrawals/another-worksheet.mutation.md',
        },
        () => {},
      ),
    ).toThrow(/justification\.worksheet is DOCS\/calculations\/spending-and-withdrawals\/abw-annuity-due-payment\.md/u)
  })

  it('binds a derivation fixture to the worksheet\'s mutation receipt by the shared convention', () => {
    expect(() =>
      describeCalculation(
        'abw-annuity-due-payment',
        {
          example: { inputs: {}, expected: { payment: 110 }, tolerance: 'exact' },
          worksheet: ABW_WORKSHEET,
          mutation: 'DOCS/calculations/spending-and-withdrawals/abw-annuity-due-payment-receipt.md',
        },
        () => {},
      ),
    ).toThrow(/mutation receipt is DOCS\/calculations\/spending-and-withdrawals\/abw-annuity-due-payment\.mutation\.md/u)
  })

  it('compares evidence under the fixture tolerance contract', () => {
    expect(withinTolerance(110, 110, 'exact')).toBe(true)
    expect(withinTolerance(110 + 1e-12, 110, 'exact')).toBe(false)
    expect(withinTolerance(110 + 1e-10, 110, { abs: 1e-9 })).toBe(true)
    expect(withinTolerance(111, 110, { abs: 1e-9 })).toBe(false)
    expect(withinTolerance(110.001, 110, { rel: 1e-4 })).toBe(true)
    expect(withinTolerance(110.001, 110, { rel: 1e-6 })).toBe(false)
    // rel is relative to |expected|: an expectation of 0 leaves only abs.
    expect(withinTolerance(0.5, 0, { rel: 1 })).toBe(false)
    expect(withinTolerance(0.5, 0, { rel: 1, abs: 1 })).toBe(true)
    expect(withinTolerance(110.5, 110, {})).toBe(false)
  })

  it('guards every numeric leaf of each census owner, and every coverage row\'s field', () => {
    const pairs = new Map<string, { source: string; owner: string }>()
    const rowsByPair = new Map<string, OutputFieldCoverageRow[]>()
    for (const row of OUTPUT_FIELD_COVERAGE) {
      const key = row.source + '\u0000' + row.owner
      pairs.set(key, { source: row.source, owner: row.owner })
      rowsByPair.set(key, [...(rowsByPair.get(key) ?? []), row])
    }
    const missing: string[] = []
    const unknownFields: string[] = []
    const unlocated: string[] = []
    const tsxWithoutNote: string[] = []
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
      const covered = new Map((rowsByPair.get(key) ?? []).map((row) => [row.field, row]))
      const { all, numeric } = enumerateOwnerFields(block)
      if (block.kind !== 'module') {
        for (const field of numeric) {
          if (!covered.has(field)) missing.push(`${owner}.${field}`)
        }
        const existing = new Set(all)
        for (const field of covered.keys()) {
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
          const leaf = censusName(segments[segments.length - 1]!, `census field leaf of ${owner}.${field}`)
          if (!declaresMember(block.body, leaf)) unknownFields.push(`${owner}.${field}`)
        }
      } else {
        // A module-kind owner (a function, const, class, or page component)
        // declares no member block, so existence means the leaf appears in
        // the file at CODE level: as an identifier outside comments and
        // strings, or as a whole string literal (a CSV column list names its
        // fields that way). A .tsx page component may also document inline
        // arithmetic the census named itself, with no identifier to find; such
        // a row is accepted only with a non-empty `note` explaining the
        // computation.
        const { code, literals } = codeLevelOf(source, text)
        for (const [field, row] of covered) {
          const rawLeaf = field.split('.').pop()!.replace(/\[\]$/u, '')
          const leaf = censusName(rawLeaf, `census field leaf of ${owner}.${field}`)
          if (hasWord(code, leaf) || literals.has(rawLeaf)) continue
          if (source.endsWith('.tsx')) {
            if (typeof row.note === 'string' && row.note.trim().length > 0) continue
            tsxWithoutNote.push(`${source} ${owner}.${field}`)
            continue
          }
          unknownFields.push(`${owner}.${field}`)
        }
      }
    }
    expect(unlocated, 'census owners that could not be located: ' + (unlocated.join(', ') || 'none')).toEqual([])
    expect(missing, 'numeric leaves missing a coverage row: ' + (missing.join(', ') || 'none')).toEqual([])
    expect(unknownFields, 'coverage rows whose field does not exist: ' + (unknownFields.join(', ') || 'none')).toEqual(
      [],
    )
    expect(
      tsxWithoutNote,
      '.tsx rows with no identifier at code level and no note explaining the inline computation: ' +
        (tsxWithoutNote.join(', ') || 'none'),
    ).toEqual([])
  })

  it('splits members after a comparison in a default value that never closes its angle', () => {
    const body = 'limit: number = a < b ? 1 : 0, next: number, tail: number'
    expect(splitTopLevel(body, ',').map((part) => part.trim())).toEqual([
      'limit: number = a < b ? 1 : 0',
      'next: number',
      'tail: number',
    ])
    const lessOrEqual = 'limit: number = a <= b ? 1 : 0, next: number'
    expect(splitTopLevel(lessOrEqual, ',').map((part) => part.trim())).toEqual([
      'limit: number = a <= b ? 1 : 0',
      'next: number',
    ])
    const arrowBody = 'below: (x: number) => x < limit, tail: Map<string, number>, last: number'
    expect(splitTopLevel(arrowBody, ',').map((part) => part.trim())).toEqual([
      'below: (x: number) => x < limit',
      'tail: Map<string, number>',
      'last: number',
    ])
  })

  it('confines an angle left open inside parentheses to that scope', () => {
    const body = 'check: (a: number = x<y ? 1 : 0) => number, generic: Array<\n  number\n>, tail: number'
    expect(splitTopLevel(body, ',').map((part) => part.trim())).toEqual([
      'check: (a: number = x<y ? 1 : 0) => number',
      'generic: Array<\n  number\n>',
      'tail: number',
    ])
  })

  it('opens an angle scope for a glued < only when a > closes it in the same scope', () => {
    const glued = 'limit: number = width<b ? 1 : 0, next: number, tail: number'
    expect(splitTopLevel(glued, ',').map((part) => part.trim())).toEqual([
      'limit: number = width<b ? 1 : 0',
      'next: number',
      'tail: number',
    ])
    const withGeneric = 'wide: Map<string, number>, limit: number = width<b ? 1 : 0, tail: number'
    expect(splitTopLevel(withGeneric, ',').map((part) => part.trim())).toEqual([
      'wide: Map<string, number>',
      'limit: number = width<b ? 1 : 0',
      'tail: number',
    ])
    const arrow = 'pick: (a: number) => a<b, tail: number'
    expect(splitTopLevel(arrow, ',').map((part) => part.trim())).toEqual(['pick: (a: number) => a<b', 'tail: number'])
    expect(closesAngleWithinScope('Map<string, (x: number) => number>', 3)).toBe(true)
    expect(closesAngleWithinScope('Array<Map<string, number>>', 5)).toBe(true)
    expect(closesAngleWithinScope('Array<Map<string, number>>', 9)).toBe(true)
    expect(closesAngleWithinScope('width<b ? 1 : 0', 5)).toBe(false)
    expect(closesAngleWithinScope('(x<y) => x, z: Array<number>', 2)).toBe(false)
  })

  it('splits members after a callback-typed member and a comparison, keeping the angle count in sync', () => {
    const body = [
      '',
      '  format: (n: number) => string',
      '  compare: (left: number, right: number) => number',
      '  sort: Array<(left: number, right: number) => -1 | 0 | 1>',
      '  after: number',
      '  last?: number | null',
      '',
    ].join('\n')
    expect(enumerateOwnerFields({ kind: 'braces', body })).toEqual({
      all: ['format', 'compare', 'sort', 'after', 'last'],
      numeric: ['after', 'last'],
    })
    const params = 'limit: number = a > b ? 1 : 0, next: number, wide: Map<string, number>, tail: number'
    expect(enumerateOwnerFields({ kind: 'params', body: params })).toEqual({
      all: ['limit', 'next', 'wide', 'tail'],
      numeric: ['next', 'tail'],
    })
  })

  it('finds a declaration only when a keyword at a word start precedes the name with whitespace', () => {
    const found = (source: string, keywords: readonly string[], name: string, modifiers?: { async?: boolean }) =>
      declarationsOf(source, keywords, name, modifiers).map((span) => source.slice(span.start, span.end))
    expect(found('const foo = 1', VALUE_KEYWORDS, 'foo')).toEqual(['const foo'])
    expect(found('export const foo = 1', VALUE_KEYWORDS, 'foo')).toEqual(['export const foo'])
    expect(found('export\n  let foo = 1', VALUE_KEYWORDS, 'foo')).toEqual(['export\n  let foo'])
    expect(found('myconst foo = 1', VALUE_KEYWORDS, 'foo')).toEqual([])
    expect(found('constfoo = 1', VALUE_KEYWORDS, 'foo')).toEqual([])
    expect(found('const fooBar = 1', VALUE_KEYWORDS, 'foo')).toEqual([])
    expect(found('interface foo {}', VALUE_KEYWORDS, 'foo')).toEqual([])
    expect(found('export async function foo() {}', FUNCTION_KEYWORDS, 'foo', { async: true })).toEqual([
      'export async function foo',
    ])
    expect(found('async function foo() {}', FUNCTION_KEYWORDS, 'foo', { async: true })).toEqual(['async function foo'])
    expect(found('export function foo() {}', FUNCTION_KEYWORDS, 'foo', { async: true })).toEqual(['export function foo'])
    expect(found('asyncfunction foo() {}', FUNCTION_KEYWORDS, 'foo', { async: true })).toEqual([])
    // Every declaration is reported, in source order, and the span ends just
    // past the name: that end is what the block locator scans from.
    const source = 'let foo: number\nexport class foo {\n  a: number\n}'
    expect(declarationsOf(source, VALUE_KEYWORDS, 'foo')).toEqual([
      { start: 0, end: 7 },
      { start: 16, end: source.indexOf('foo {') + 3 },
    ])
    expect(locateNamedBlock(source, declarationsOf(source, VALUE_KEYWORDS, 'foo'))).toEqual({
      kind: 'braces',
      body: '\n  a: number\n',
    })
    expect(locateNamedBlock(source, [])).toBeNull()
  })

  it('bounds a word by identifier characters, so fooBar is not foo and a $ belongs to the name', () => {
    expect(indexOfWord('fooBar', 'foo')).toBe(-1)
    expect(indexOfWord('foo_1', 'foo')).toBe(-1)
    expect(indexOfWord('myfoo', 'foo')).toBe(-1)
    expect(indexOfWord('foo', 'foo')).toBe(0)
    expect(indexOfWord('a.foo', 'foo')).toBe(2)
    expect(indexOfWord('foo(', 'foo')).toBe(0)
    expect(indexOfWord('$foo', 'foo')).toBe(-1)
    expect(indexOfWord('foo$', 'foo')).toBe(-1)
    expect(indexOfWord('$foo', '$foo')).toBe(0)
    expect(indexOfWord('foo$', 'foo$')).toBe(0)
    expect(indexOfWord('foo$ $foo', 'foo$')).toBe(0)
    expect(indexOfWord('foo$ $foo', '$foo')).toBe(5)
    expect(indexOfWord('foofoo foo', 'foo', 1)).toBe(7)
    expect(hasWord('a foo b', 'foo')).toBe(true)
    expect(hasWord('a fooBar b', 'foo')).toBe(false)
    expect(censusName('foo$', 'test')).toBe('foo$')
    expect(() => censusName('foo-bar', 'test')).toThrow(RangeError)
  })

  it('accepts a brace-less alias and rejects one that opens a member block', () => {
    expect(isAliasWithoutBlock("type X = Pick<A, 'b'>", 'X')).toBe(true)
    expect(isAliasWithoutBlock("export type X = Pick<A, 'b'>", 'X')).toBe(true)
    expect(isAliasWithoutBlock('type X = A | B', 'X')).toBe(true)
    expect(isAliasWithoutBlock('type X = {\n  a: number\n}', 'X')).toBe(false)
    expect(isAliasWithoutBlock('export type X =\n  {\n  a: number\n}', 'X')).toBe(false)
    expect(isAliasWithoutBlock("type XY = Pick<A, 'b'>", 'X')).toBe(false)
    expect(isAliasWithoutBlock("prototype X = Pick<A, 'b'>", 'X')).toBe(false)
    expect(isAliasWithoutBlock('interface X { a: number }', 'X')).toBe(false)
    expect(isAliasWithoutBlock('type X', 'X')).toBe(false)
    // The first `=` after the name decides, whatever follows a later one.
    expect(isAliasWithoutBlock("type X = {\n  a: number\n}\ntype Y = Pick<A, 'b'>", 'X')).toBe(false)
    expect(isAliasWithoutBlock("type X = Pick<A, 'b'>\ntype Y = {\n  a: number\n}", 'X')).toBe(true)
  })

  it('finds a leaf declared in a block as the name, an optional ?, whitespace, and a colon', () => {
    expect(declaresMember('  foo: number', 'foo')).toBe(true)
    expect(declaresMember('foo?: number', 'foo')).toBe(true)
    expect(declaresMember('foo\n  : number', 'foo')).toBe(true)
    expect(declaresMember('{ a: string; foo : number }', 'foo')).toBe(true)
    expect(declaresMember('fooBar: number', 'foo')).toBe(false)
    expect(declaresMember('myfoo: number', 'foo')).toBe(false)
    expect(declaresMember('$foo: number', 'foo')).toBe(false)
    expect(declaresMember('foo = 1', 'foo')).toBe(false)
    expect(declaresMember('a: foo', 'foo')).toBe(false)
    // `?` must be glued to the name, as the pattern it replaces required.
    expect(declaresMember('foo ?: number', 'foo')).toBe(false)
  })

  it('finds a leaf at code level only as a whole identifier', () => {
    expect(hasWord('const total = base + foo', 'foo')).toBe(true)
    expect(hasWord('foo', 'foo')).toBe(true)
    expect(hasWord('row.foo()', 'foo')).toBe(true)
    expect(hasWord('const fooTotal = 1', 'foo')).toBe(false)
    expect(hasWord('const myFoo = foo2', 'foo')).toBe(false)
    expect(hasWord('const $foo = 1', 'foo')).toBe(false)
    expect(hasWord('const foo$ = 1', 'foo')).toBe(false)
    expect(hasWord('', 'foo')).toBe(false)
  })

  it('carries a relocation object on every ui family and none on engine and adapter families', () => {
    const violations: string[] = []
    // Widened: the frozen literal types make each family's relocation a
    // provable null or object, which would narrow the checks below to never.
    const families: Readonly<Record<string, OutputFamily>> = OUTPUT_FAMILIES
    for (const [id, family] of Object.entries(families)) {
      const isUi = family.kind === 'ui-native' || family.kind === 'ui-transformation'
      if (isUi && family.relocation === null) violations.push(`${id} (${family.kind}): relocation missing`)
      if (!isUi && family.relocation !== null) violations.push(`${id} (${family.kind}): relocation must be null`)
    }
    expect(violations).toEqual([])
  })

  it('publishes relocation-pending for exactly the ui families whose relocation is pending, and counts none of them complete', () => {
    const { complete, relocationPending } = publishedManifest().families
    const expected = Object.entries(OUTPUT_FAMILIES)
      .filter(([, family]) => family.relocation !== null && family.relocation.status === 'pending')
      .map(([id]) => id)
      .sort()
    expect(relocationPending).toEqual(expected)
    expect(complete.filter((id) => relocationPending.includes(id))).toEqual([])
  })

  it('never counts a relocation-pending family complete, even when its record passes every gate', () => {
    const report = syntheticReport()
    expect(report.manifest.families).toMatchObject({
      complete: ['synthetic-ui-done'],
      partial: ['synthetic-ui-pending'],
      noRecordYet: [],
      relocationPending: ['synthetic-ui-pending'],
      fedBy: {},
    })
    expect(report.shards[0]!.shard.records[0]!.feeds).toEqual([])
    expect(report.shards[0]!.shard.records[0]!.gates).toEqual({
      fixtureRegistersTest: true,
      pinsResolve: true,
      familiesExist: true,
      worksheetExists: true,
      mutationExists: true,
      provenanceIndependent: true,
    })
  })

  it('keeps a family that a passing record only feeds in no-record-yet, and publishes the feeder under fedBy', () => {
    // The intermediate-quantity case: the record's own number is one family,
    // and it enters another family computed by code that has no record yet.
    const report = syntheticReport({ record: syntheticRecord(['synthetic-ui-done'], ['synthetic-ui-pending']) })
    const record = report.shards[0]!.shard.records[0]!
    expect(gatesAllPass(record.gates)).toBe(true)
    expect(record.outputs).toEqual(['synthetic-ui-done'])
    expect(record.feeds).toEqual(['synthetic-ui-pending'])
    expect(report.manifest.families).toMatchObject({
      complete: ['synthetic-ui-done'],
      partial: [],
      noRecordYet: ['synthetic-ui-pending'],
      fedBy: { 'synthetic-ui-pending': [SYNTHETIC_ID] },
    })
  })

  it('publishes a broken gate on the record rather than folding it into the family status', () => {
    const report = syntheticReport({
      symbolLineFor: () => {
        throw new Error('pin moved')
      },
    })
    expect(report.manifest.families.complete).toEqual([])
    expect(report.manifest.families.partial).toEqual(['synthetic-ui-done', 'synthetic-ui-pending'])
    expect(report.shards[0]!.shard.records[0]!.gates).toMatchObject({ pinsResolve: false, fixtureRegistersTest: true })
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
        worksheet: ABW_WORKSHEET,
        mutation: ABW_MUTATION,
      }, () => {}),
    ).toThrow(RangeError)
  })
})
