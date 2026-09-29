/**
 * No page projects a stored plan from the clock (decision D-2027-ROLLOVER,
 * 2026-09-28).
 *
 * A library example is written as a 2026 snapshot and runs from
 * EXAMPLE_FIXED_YEAR; a user plan runs from the clock's year. Both come from
 * one resolver, `projectionStartYear(plan)` in `../startYear.ts`, and the
 * projection seams (`projectPlan`, `useProjection`, `headlineMcRunOptions`,
 * `piaAsOfPlan`, `claimingPeople`, `warningFor`) take the start year with no
 * clock default, so the compiler finds every caller. This guard closes the
 * other door: a page reading the clock itself. Any `currentStartYear()`,
 * `.getFullYear()` or `.getUTCFullYear()` under `planner/` fails here unless
 * the allow-list below names its file and says why a clock read is right
 * there.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readdirSync, readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

/** Files that may read the clock, each with the reason it is not a plan's start year. */
const ALLOWED: Readonly<Record<string, string>> = {
  'examples/ExamplePreviewBanner.tsx':
    "the banner compares the clock's year with the example's to say what Save to my plans would change; the example itself still runs from its own year",
  'LongevityModal.tsx':
    "the questionnaire asks about the person's health today, so the age it quotes is the person's age today",
  'sections/sectionHelpers.ts':
    "localCalendarDateIso is today's local date as a date field's default, not a projection year",
}

const CLOCK_READ = /\bcurrentStartYear\(\)|\.getFullYear\(\)|\.getUTCFullYear\(\)/g

describe('pages read the plan start year from projectionStartYear, never from the clock', () => {
  const plannerDir = fileURLToPath(new URL('.', import.meta.url))
  const files = (readdirSync(plannerDir, { recursive: true }) as string[])
    .map((file) => file.replace(/\\/g, '/'))
    .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file))

  it('finds the planner sources (the sweep is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(100)
    expect(files).toContain('PlanWorkspace.tsx')
  })

  it('no source outside the allow-list reads the clock', () => {
    const offenders: string[] = []
    for (const file of files) {
      if (file in ALLOWED) continue
      const text: string = readFileSync(`${plannerDir}/${file}`, 'utf8')
      const lines = text.split(/\r?\n/)
      lines.forEach((line, index) => {
        // Comments may name the functions; only code counts.
        const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')
        if (CLOCK_READ.test(code)) offenders.push(`${file}:${index + 1}: ${line.trim()}`)
        CLOCK_READ.lastIndex = 0
      })
    }
    expect(offenders).toEqual([])
  })

  it('every allow-listed file still reads the clock (a stale entry is removed, not kept)', () => {
    for (const file of Object.keys(ALLOWED)) {
      const text: string = readFileSync(`${plannerDir}/${file}`, 'utf8')
      expect(CLOCK_READ.test(text), file).toBe(true)
      CLOCK_READ.lastIndex = 0
    }
  })
})
