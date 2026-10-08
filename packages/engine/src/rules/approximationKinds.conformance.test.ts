import { describe, expect, it } from 'vitest'
import {
  APPROXIMATION_KINDS,
  type ApproximationEntry,
  type ApproximationKind,
} from './approximationKinds.js'
import { TAX_RULE_REGISTRY } from './taxRuleRegistry.js'

const kinds: Readonly<Record<string, ApproximationEntry>> = APPROXIMATION_KINDS

const approximatedIds = Object.entries(TAX_RULE_REGISTRY)
  .filter(([, record]) => record.classification === 'approximated')
  .map(([id]) => id)
  .sort()

const EXPECTED_KEYS: Readonly<Record<ApproximationKind, readonly string[]>> = {
  fix: ['kind'],
  'needs-fact': ['kind', 'missingInput'],
  convention: ['kind', 'reason'],
}

/** The strings an entry publishes, by field name. A fix publishes none. */
function publishedStrings(entry: ApproximationEntry): readonly (readonly [string, string])[] {
  switch (entry.kind) {
    case 'fix':
      return []
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

  it('gives every fix a home in the rule\'s own registered implementations', () => {
    // A fix entry names no location of its own: the public page links the
    // rule's registered implementations (published with their lines) as where
    // the fix goes, so every fix rule must have at least one pinned function.
    const homeless = Object.entries(kinds)
      .filter(([, entry]) => entry.kind === 'fix')
      .map(([id]) => id)
      .filter((id) => {
        const record = TAX_RULE_REGISTRY[id as keyof typeof TAX_RULE_REGISTRY]
        // The record type already demands non-empty lists; widened here so the
        // runtime check still stands if that type is ever loosened.
        const files: readonly string[] = record.implementedBy
        const functions: readonly string[] = record.implementedByFunctions
        return files.length === 0 || functions.length === 0
      })
    expect(homeless).toEqual([])
  })

  it('pins the counts by kind', () => {
    // Pinned so a reclassification or a landed fix is a visible, deliberate
    // edit here. The fix count should trend to zero: each landed fix removes
    // its entry (the rule is no longer approximated) and lowers it. The B1-P2
    // triage counted 77 / 26 / 19; the module doc lists each reclassification
    // and each rule registered as approximated since, with its evidence.
    const counts: Record<ApproximationKind, number> = { fix: 0, 'needs-fact': 0, convention: 0 }
    for (const entry of Object.values(kinds)) counts[entry.kind] += 1
    expect(counts).toEqual({ fix: 71, 'needs-fact': 28, convention: 23 })
    expect(counts.fix + counts['needs-fact'] + counts.convention).toBe(approximatedIds.length)
  })
})
