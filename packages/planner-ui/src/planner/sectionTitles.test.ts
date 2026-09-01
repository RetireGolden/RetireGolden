/**
 * SECTION_TITLES is the one place that owns screen wording: the rail, the
 * tab title, the h1, and the Insights "Go to …" link all read it (#461).
 * The cross-package check below is what keeps that link from quietly
 * falling back to "Go to screen": every plannerRoute a detector emits must
 * resolve to a title here, so adding a detector for an unmapped screen
 * fails this test instead of shipping the old wording.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readdirSync, readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

import { SECTION_TITLES, sectionTitleOf } from './sectionTitles'

describe('sectionTitleOf', () => {
  it('names a route segment, or a path that starts with one', () => {
    expect(sectionTitleOf('spending')).toBe('Spending')
    expect(sectionTitleOf('monte-carlo')).toBe('Monte Carlo')
    expect(sectionTitleOf('spending-solver/anything')).toBe('How much can I spend?')
    expect(sectionTitleOf('/optimize')).toBe('Roth & Tax Optimizer')
  })

  it('returns null for an unmapped segment rather than inventing a name', () => {
    expect(sectionTitleOf('no-such-screen')).toBeNull()
    expect(sectionTitleOf('')).toBeNull()
  })
})

describe('every insight detector route has a screen title', () => {
  const detectorsDir = fileURLToPath(new URL('../../../engine/src/insights/detectors/', import.meta.url))
  const files: string[] = readdirSync(detectorsDir).filter((f: string) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

  it('finds the detector sources', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it('maps each plannerRoute a detector emits', () => {
    const routes = new Set<string>()
    for (const file of files) {
      const text: string = readFileSync(detectorsDir + file, 'utf8')
      for (const match of text.matchAll(/plannerRoute:\s*'([^']+)'/g)) routes.add(match[1]!)
    }
    expect(routes.size).toBeGreaterThan(3)
    for (const route of routes) {
      expect(sectionTitleOf(route), `detector plannerRoute "${route}" has no SECTION_TITLES entry`).not.toBeNull()
      expect(SECTION_TITLES[route.split('/')[0]!]).toBeTruthy()
    }
  })
})
