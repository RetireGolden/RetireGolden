/**
 * The `@retiregolden/planner-ui/report-model` subpath keeps exporting
 * `ROTH_FIVE_YEAR_INCOMPLETE_NOTE`. The constant now lives in
 * `planner/professionalConfirmation.ts` (so the plan editor does not pull the
 * whole report model into the plan route chunk), and `reportModel.ts`
 * re-exports it. This file imports it the way a consumer of the published
 * subpath does, through the exports-map target, and pins the exact text, so
 * dropping or changing the re-export fails here rather than in a host.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

import { ROTH_FIVE_YEAR_INCOMPLETE_NOTE as definedNote } from '../planner/professionalConfirmation'

const NOTE_TEXT =
  'The five-year period may not be complete; some earnings could be taxable when withdrawn. This model does not compute that tax.'

describe('report-model subpath', () => {
  it('re-exports ROTH_FIVE_YEAR_INCOMPLETE_NOTE with its exact text', async () => {
    const packageJson = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
    ) as { exports: Record<string, string> }
    const target = packageJson.exports['./report-model']
    expect(target).toBe('./src/report/reportModel.ts')

    // Load the module the exports map names, not a hand-written relative path.
    const published = (await import(
      /* @vite-ignore */ new URL(`../../${target!.replace(/^\.\//, '')}`, import.meta.url).href
    )) as Record<string, unknown>

    expect(published.ROTH_FIVE_YEAR_INCOMPLETE_NOTE).toBe(NOTE_TEXT)
    expect(published.ROTH_FIVE_YEAR_INCOMPLETE_NOTE).toBe(definedNote)
  })
})
