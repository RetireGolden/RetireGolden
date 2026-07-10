/**
 * Static source guards from the UI/UX remediation plan:
 *  (a) no native window.prompt/confirm/alert in app code — the in-app
 *      dialogs (planner/dialogs.tsx) are the only dialog vocabulary;
 *  (b) every var(--x) reference resolves to a custom property defined in a
 *      stylesheet — catches the --surface-3 class of bug permanently.
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
          missing.push(`${rel(file)}: --${match[1]!}`)
        }
      }
    }
    expect(missing).toEqual([])
  })
})
