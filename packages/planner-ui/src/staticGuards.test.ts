/**
 * Static source guards from the UI/UX remediation plan:
 *  (a) no native window.prompt/confirm/alert in app code — the in-app
 *      dialogs (planner/dialogs.tsx) are the only dialog vocabulary;
 *  (b) every var(--x) reference resolves to a custom property defined in a
 *      stylesheet — catches the --surface-3 class of bug permanently;
 *  (c) no planner/learn component re-inlines a spacing value the --space-*
 *      scale already names — keeps the utility-class migration from silently
 *      unwinding one component at a time.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync, readdirSync, statSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { join, relative } from 'node:path'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

const srcRoot: string = fileURLToPath(new URL('.', import.meta.url))

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir) as string[]) {
    const full = join(dir, name) as string
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const sourceFiles: string[] = walk(srcRoot).filter((f) => /\.(ts|tsx|css)$/.test(f))
const rel = (f: string): string => (relative(srcRoot, f) as string).replaceAll('\\', '/')
const appFiles = sourceFiles.filter((f) => !/\.test\.(ts|tsx)$/.test(f) && !rel(f).startsWith('testSupport/'))

describe('no native browser dialogs', () => {
  it('window.prompt/confirm/alert do not appear in app code', () => {
    const offenders: string[] = []
    for (const file of appFiles) {
      const text: string = readFileSync(file, 'utf8')
      if (/window\.(prompt|confirm|alert)\s*\(/.test(text)) offenders.push(rel(file))
    }
    expect(offenders).toEqual([])
  })
})

describe('Learn callouts use the full-border vocabulary', () => {
  it('learn.css has no side-stripe (border-left) callouts', () => {
    // Round 2 aligned Learn callouts/scenario cards with the planner .callout
    // full-tinted-border vocabulary; a 4px border-left is the anti-pattern that
    // made the app disagree with itself. Keep it from creeping back.
    const learnCss = sourceFiles.find((f) => rel(f) === 'learn/learn.css')
    expect(learnCss, 'learn/learn.css should exist').toBeDefined()
    const text: string = readFileSync(learnCss!, 'utf8')
    expect(text).not.toMatch(/border-left/)
  })
})

describe('CSS custom properties resolve', () => {
  it('every var(--x) reference has a definition in some stylesheet', () => {
    const defined = new Set<string>()
    for (const file of sourceFiles.filter((f) => f.endsWith('.css'))) {
      const text: string = readFileSync(file, 'utf8')
      for (const match of text.matchAll(/--([\w-]+)\s*:/g)) defined.add(match[1]!)
    }
    expect(defined.size).toBeGreaterThan(0)

    const missing: string[] = []
    for (const file of appFiles) {
      const text: string = readFileSync(file, 'utf8')
      for (const match of text.matchAll(/var\(\s*--([\w-]+)/g)) {
        if (!defined.has(match[1]!)) {
          missing.push(`${rel(file)}: --${match[1]}`)
        }
      }
    }
    expect(missing).toEqual([])
  })
})

describe('spacing uses the scale, not fresh inline literals', () => {
  // The --space-* tokens and the .mt-*/.mb-*/.gap-* utilities exist so a
  // component names a step instead of re-typing a number; 59 sites were
  // converted to them. Nothing stops the next component from typing
  // `marginTop: '0.75rem'` again, and the migration would then unwind one
  // edit at a time. This fails the moment an inline margin-top/-bottom/gap
  // repeats a value the scale already has a name for.
  //
  // Off-scale values (0.6rem, 0.9rem, 1.25rem, 0.25rem) are NOT flagged:
  // they are deliberate one-offs, and forcing them onto the scale is a
  // layout decision, not a mechanical one.

  /** Every value the --space-* scale names, mapped to the utility to use. */
  const utilityFor: Record<string, Record<string, string>> = {
    marginTop: { '0.35rem': 'mt-xs', '0.5rem': 'mt-sm', '0.75rem': 'mt-ms', '1rem': 'mt-md', '1.5rem': 'mt-lg' },
    marginBottom: { '0.5rem': 'mb-sm', '0.75rem': 'mb-ms', '1rem': 'mb-md' },
    gap: { '0.75rem': 'gap-ms' },
  }

  /**
   * Sites that keep an inline literal on purpose. Every one of them carries a
   * non-spacing property in the same style object — a skeleton's height, a
   * measure cap, a border — so the object stays inline either way and pulling
   * one property out into a class would split it across two mechanisms for no
   * gain. Counts are exact, so a stale entry fails as loudly as a new offender.
   */
  const allowed: { file: string; property: string; value: string; count: number; why: string }[] = [
    { file: 'planner/OptimizePage.tsx', property: 'marginTop', value: '0.75rem', count: 1, why: "loading skeleton, sized inline by height: '2rem'" },
    { file: 'planner/PlanContext.tsx', property: 'marginTop', value: '1rem', count: 1, why: "loading skeleton, sized inline by height: '14rem'" },
    { file: 'planner/PlanPickerPage.tsx', property: 'marginBottom', value: '1rem', count: 1, why: "loading skeleton, sized inline by height: '2rem'" },
    { file: 'planner/RelocationComparePage.tsx', property: 'marginTop', value: '0.75rem', count: 1, why: "loading skeleton, sized inline by height: '2rem'" },
    { file: 'planner/ResultsPage.tsx', property: 'marginTop', value: '0.5rem', count: 1, why: "ScrollRegion style prop also carries border: 'none'" },
    { file: 'planner/SpendingSolverPage.tsx', property: 'marginTop', value: '0.75rem', count: 1, why: "loading skeleton, sized inline by height: '2rem'" },
    { file: 'planner/SsAnalysisPage.tsx', property: 'marginBottom', value: '0.75rem', count: 1, why: "form grid also carries maxWidth: '26rem'" },
  ]

  const key = (file: string, property: string, value: string): string => `${file} ${property}: '${value}'`

  it('the scale in index.css still defines every value the guard polices', () => {
    // If a --space-* value is edited, the map above has to move with it, or
    // the guard would quietly stop covering the converted sites.
    const indexCss: string = readFileSync(join(srcRoot, 'index.css'), 'utf8')
    const scale = new Set<string>()
    for (const match of indexCss.matchAll(/--space-[\w-]+:\s*([^;]+);/g)) scale.add(match[1]!.trim())
    for (const [property, values] of Object.entries(utilityFor)) {
      for (const value of Object.keys(values)) {
        expect(scale, `${property} ${value} is a --space-* value`).toContain(value)
      }
    }
  })

  it('no planner/learn .tsx inlines a spacing value the scale names', () => {
    const scoped = appFiles.filter((f) => /\.tsx$/.test(f) && /^(planner|learn)\//.test(rel(f)))
    expect(scoped.length).toBeGreaterThan(50)

    const found = new Map<string, number>()
    for (const file of scoped) {
      const text: string = readFileSync(file, 'utf8')
      for (const match of text.matchAll(/\b(marginTop|marginBottom|gap):\s*'([^']+)'/g)) {
        const property = match[1]!
        const value = match[2]!
        const utility = utilityFor[property]?.[value]
        if (utility === undefined) continue
        const k = key(rel(file), property, value)
        found.set(k, (found.get(k) ?? 0) + 1)
      }
    }

    const stale: string[] = []
    for (const entry of allowed) {
      const k = key(entry.file, entry.property, entry.value)
      const actual = found.get(k) ?? 0
      if (actual !== entry.count) {
        stale.push(`${k} — allowlisted ${entry.count}, found ${actual} (${entry.why})`)
        found.delete(k)
        continue
      }
      found.delete(k)
    }
    expect(stale, 'allowlist entries match the source exactly').toEqual([])

    const offenders = [...found.entries()].map(([k, n]) => {
      const [, property = '', value = ''] = /^(?:.*) (marginTop|marginBottom|gap): '(.+)'$/.exec(k) ?? []
      return `${k} x${n} — use .${utilityFor[property]?.[value] ?? '?'} instead`
    })
    expect(offenders.sort()).toEqual([])
  })
})

describe('noUncheckedIndexedAccess stays on', () => {
  it('tsconfig.src.json and tsconfig.node.json both enable it', () => {
    // Deleting the flag from either tsconfig would still let `tsc -b` pass —
    // it only shows up as newly-unchecked indexed reads, not a build failure.
    // Pin it here so removing it fails a test instead of silently reopening
    // the ~1,250-site backlog this flag closed.
    const packageRoot: string = fileURLToPath(new URL('..', import.meta.url))
    for (const name of ['tsconfig.src.json', 'tsconfig.node.json']) {
      const text: string = readFileSync(join(packageRoot, name), 'utf8')
      expect(text, name).toMatch(/"noUncheckedIndexedAccess"\s*:\s*true/)
    }
  })
})
