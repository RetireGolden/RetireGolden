import { describe, expect, it } from 'vitest'
import {
  APPROXIMATION_KINDS,
  type ApproximationEntry,
  type ApproximationKind,
} from './approximationKinds.js'
import { declaredSymbolLinesOf, symbolAnchorLine, type DeclaredSymbol } from './symbolLines.js'
import { TAX_RULE_REGISTRY } from './taxRuleRegistry.js'

// Vite requires the options to be an inline object literal.
const engineSources = import.meta.glob('../**/*.ts', { query: '?raw', import: 'default', eager: true })

/**
 * Glob keys are relative to this directory; pins are repo-relative. Vite emits
 * same-directory files as `./name`, not `../rules/name`, so both folds are
 * needed, the same as the registry conformance suite.
 */
const engineGlobKeyOf = (repoPath: string): string =>
  repoPath.replace(/^packages\/engine\/src\/rules\//u, './').replace(/^packages\/engine\/src\//u, '../')

const declaredSymbolCache = new Map<string, ReadonlyMap<string, DeclaredSymbol>>()

function declaredSymbolsOf(globKey: string, source: string): ReadonlyMap<string, DeclaredSymbol> {
  const cached = declaredSymbolCache.get(globKey)
  if (cached !== undefined) return cached
  const table = declaredSymbolLinesOf(globKey, source)
  declaredSymbolCache.set(globKey, table)
  return table
}

const kinds: Readonly<Record<string, ApproximationEntry>> = APPROXIMATION_KINDS

const approximatedIds = Object.entries(TAX_RULE_REGISTRY)
  .filter(([, record]) => record.classification === 'approximated')
  .map(([id]) => id)
  .sort()

const EXPECTED_KEYS: Readonly<Record<ApproximationKind, readonly string[]>> = {
  fix: ['implementation', 'kind'],
  'needs-fact': ['kind', 'missingInput'],
  convention: ['kind', 'reason'],
}

/**
 * Words the public site must not show: internal test and tooling vocabulary a
 * reader of the known-limits table cannot be expected to know. Whole words,
 * any case; "exact ledger" is matched as a phrase so "ledger" alone stays
 * usable.
 */
const BANNED_PUBLIC_WORDS = /\b(?:fixtures?|golden|regression|harness|exact\s+ledger|packs?|vintage)\b/giu
const EM_DASH = '—'

/** Every public-text problem in one string, empty when it reads as plain words. */
function publicTextProblems(text: string): readonly string[] {
  const problems = [...text.matchAll(BANNED_PUBLIC_WORDS)].map((match) => 'uses "' + match[0] + '"')
  if (text.includes(EM_DASH)) problems.push('uses an em dash')
  return problems
}

/** The strings an entry publishes, by field name. */
function publishedStrings(entry: ApproximationEntry): readonly (readonly [string, string])[] {
  switch (entry.kind) {
    case 'fix':
      return [['implementation', entry.implementation]]
    case 'needs-fact':
      return [['missingInput', entry.missingInput]]
    case 'convention':
      return [['reason', entry.reason]]
  }
}

describe('approximation kinds conformance', () => {
  it('carries exactly the registry rules classified approximated, in both directions', () => {
    const keyed = new Set(Object.keys(kinds))
    const approximated = new Set(approximatedIds)
    const missing = approximatedIds.filter((id) => !keyed.has(id)).map((id) => id + ' is approximated but has no kind')
    const stale = [...keyed]
      .filter((id) => !approximated.has(id))
      .map((id) =>
        id in TAX_RULE_REGISTRY
          ? id + ' carries a kind but is classified ' + TAX_RULE_REGISTRY[id as keyof typeof TAX_RULE_REGISTRY].classification
          : id + ' carries a kind but is not a registry rule',
      )
    expect([...missing, ...stale]).toEqual([])
  })

  it('lists its entries sorted by rule id', () => {
    const ids = Object.keys(kinds)
    expect(ids).toEqual([...ids].sort())
  })

  it('gives every entry exactly the shape of its kind, with non-empty trimmed text', () => {
    const violations: string[] = []
    for (const [id, entry] of Object.entries(kinds)) {
      const expected = EXPECTED_KEYS[entry.kind]
      if (expected === undefined) {
        violations.push(id + ': unknown kind ' + String(entry.kind))
        continue
      }
      const keys = Object.keys(entry).sort()
      if (keys.join(',') !== expected.join(',')) {
        violations.push(id + ': a ' + entry.kind + ' entry carries ' + keys.join(', ') + ', expected ' + expected.join(', '))
      }
      for (const [field, text] of publishedStrings(entry)) {
        if (typeof text !== 'string' || text.trim().length === 0 || text.trim() !== text) {
          violations.push(id + ': ' + field + ' must be non-empty text with no surrounding whitespace')
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('pins every fix to an engine source file that exists and a symbol declared in it', () => {
    // The pin is published as a deep link to where the fix goes, so it
    // resolves through symbolLines' two-tier rule exactly like the registry's
    // own function pins: a moved, deleted, or ambiguous symbol fails here.
    const violations: string[] = []
    let resolved = 0
    for (const [id, entry] of Object.entries(kinds)) {
      if (entry.kind !== 'fix') continue
      const parts = entry.implementation.split('#')
      if (parts.length !== 2 || parts[0]!.length === 0 || parts[1]!.length === 0) {
        violations.push(id + ': ' + entry.implementation + ' must be <path>#<symbol>')
        continue
      }
      const [path, symbol] = parts as [string, string]
      const globKey = engineGlobKeyOf(path)
      const source = engineSources[globKey] as string | undefined
      if (!path.startsWith('packages/engine/src/') || source === undefined) {
        violations.push(id + ': ' + path + ' is not an engine source file')
        continue
      }
      try {
        const line = symbolAnchorLine(declaredSymbolsOf(globKey, source), path, symbol)
        if (Number.isInteger(line) && line >= 1) resolved += 1
        else violations.push(id + ': ' + entry.implementation + ' resolved to line ' + line)
      } catch (error) {
        violations.push(id + ': ' + (error instanceof Error ? error.message : String(error)))
      }
    }
    expect(violations).toEqual([])
    expect(resolved).toBe(Object.values(kinds).filter(({ kind }) => kind === 'fix').length)
  })

  it('pins the counts by kind', () => {
    // Pinned so a reclassification or a landed fix is a visible, deliberate
    // edit here. The fix count should trend to zero: each landed fix removes
    // its entry (the rule is no longer approximated) and lowers it.
    const counts: Record<ApproximationKind, number> = { fix: 0, 'needs-fact': 0, convention: 0 }
    for (const entry of Object.values(kinds)) counts[entry.kind] += 1
    expect(counts).toEqual({ fix: 77, 'needs-fact': 26, convention: 19 })
    expect(counts.fix + counts['needs-fact'] + counts.convention).toBe(approximatedIds.length)
  })

  it('publishes only plain public text: no em dashes and no internal test vocabulary', () => {
    const violations: string[] = []
    for (const [id, entry] of Object.entries(kinds)) {
      for (const [field, text] of publishedStrings(entry)) {
        for (const problem of publicTextProblems(text)) violations.push(id + ' ' + field + ' ' + problem)
      }
    }
    expect(violations).toEqual([])
  })

  it('flags the banned words as whole words in any case, and nothing that merely contains them', () => {
    // Probes for the checker itself, so a regex that silently matched nothing
    // could not pass the public-text test above.
    for (const text of [
      'a golden case',
      'Fixtures kept',
      'one fixture',
      'the Exact Ledger re-prices',
      'the exact  ledger',
      'a regression',
      'the test harness',
      'a parameter pack',
      'state packs',
      'the 2026 vintage',
      'two parts' + EM_DASH + 'one clause',
    ]) {
      expect(publicTextProblems(text), text).not.toEqual([])
    }
    for (const text of [
      'packages/engine/src/params/index.ts#irmaaTierThreshold',
      'packaging and unpacked backpacks',
      'the full year-by-year projection re-prices candidates',
      'a ledger of gifts',
      'goldenrod harnessing',
      'two parts, one clause',
    ]) {
      expect(publicTextProblems(text), text).toEqual([])
    }
  })
})
