/**
 * planner-ui composes and presents engine results; it must not restate law, so a
 * rule id it mentions must exist in the registry, and it may only consume the
 * engine through its public subpaths.
 */

import { describe, expect, it } from 'vitest'
import { taxRuleIds } from '@retiregolden/engine/rules'

// Vite requires the options to be an inline object literal.
const packageSources = import.meta.glob('./**/*.{ts,tsx,mts,cts}', { query: '?raw', import: 'default', eager: true })

const SELF = 'engineRuleReferences.test.ts'
const registeredRuleIds = new Set<string>(taxRuleIds)
const registryPrefixes = new Set(taxRuleIds.map((ruleId) => ruleId.split('-')[0]!))

/** Same shape as taxRuleRegistry.conformance.test.ts — authority-anchored ids only. */
const authorityShaped = /`([A-Za-z0-9]+(?:-[A-Za-z0-9]+){3,})`/gu
/** "registered as `x`" — any kebab token after the phrase is a registry citation. */
const citedAsRegistered =
  /[Rr]egistered(?:,[^`]{0,80})? as[\s*/]*`([A-Za-z0-9][A-Za-z0-9-]*)`/gu

const DEEP_IMPORT_PATTERNS: ReadonlyArray<{ pattern: RegExp, label: string }> = [
  { pattern: /@retiregolden\/engine\/(?:src|dist)\//u, label: '@retiregolden/engine src/dist path' },
  { pattern: /engine\/params\/(?:data|state\/data)\//u, label: 'engine parameter data table' },
  { pattern: /\.\.\/.*(?:packages\/)?engine\/(?:src|dist)\//u, label: 'relative escape into engine internals' },
]

/** ES module specifiers only — import.meta.glob patterns are out of scope. */
function moduleSpecifiers(source: string): string[] {
  const specifiers: string[] = []
  for (const match of source.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gmu)) {
    specifiers.push(match[1]!)
  }
  for (const match of source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]/gu)) {
    specifiers.push(match[1]!)
  }
  for (const match of source.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/gu)) {
    specifiers.push(match[1]!)
  }
  return specifiers
}

function citedRuleIdsInSource(source: string): string[] {
  const cited: string[] = []
  for (const match of source.matchAll(authorityShaped)) {
    const token = match[1]!
    if (!registryPrefixes.has(token.split('-')[0]!)) continue
    cited.push(token)
  }
  for (const match of source.matchAll(citedAsRegistered)) {
    cited.push(match[1]!)
  }
  return cited
}

describe('engine consumer boundaries', () => {
  it('cites only rule ids that exist in the registry', () => {
    const unknown: string[] = []
    for (const [path, source] of Object.entries(packageSources)) {
      if (path.endsWith(SELF)) continue
      for (const token of citedRuleIdsInSource(source as string)) {
        if (!registeredRuleIds.has(token)) unknown.push(`${path}: ${token}`)
      }
    }
    expect([...new Set(unknown)].sort()).toEqual([])
  })

  it('never deep-imports engine internals or parameter data tables', () => {
    const offenders: string[] = []
    for (const [path, source] of Object.entries(packageSources)) {
      if (path.endsWith(SELF)) continue
      for (const specifier of moduleSpecifiers(source as string)) {
        for (const { pattern, label } of DEEP_IMPORT_PATTERNS) {
          if (pattern.test(specifier)) offenders.push(`${path}: ${specifier} (${label})`)
        }
      }
    }
    expect([...new Set(offenders)].sort()).toEqual([])
  })
})
