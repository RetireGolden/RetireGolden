/**
 * Design-QA cluster J, the source half of #570.
 *
 * The rendered sweep in designQa.clusterJ.chips.test.tsx can only see the
 * screens it mounts, and mounting every surface that carries a kind badge (the
 * relocation page, the retirement-action editors, the year cash-flow dialog)
 * costs far more than the defect is worth.
 *
 * This is the cheap half that covers all of them at once: the badge markup —
 * and with it the separator that keeps the badge off the title in the text
 * layer — lives in exactly one module, so no call site can go back to a bare
 * `<span className="type-chip">`, which is the shape that produced every
 * string on the issue.
 */
import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readdirSync, readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

const plannerUiSrc: string = fileURLToPath(new URL('..', import.meta.url))

/** Component sources under `planner-ui/src`; tests may name the class freely. */
function componentSources(dir: string, found: string[] = []): string[] {
  const entries = readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>
  for (const entry of entries) {
    const full = `${dir}${entry.name}`
    if (entry.isDirectory()) componentSources(`${full}/`, found)
    else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) found.push(full)
  }
  return found
}

/**
 * Source with LF line endings whatever this checkout wrote, and with block
 * comments removed so prose about the class can never satisfy — or trip — the
 * pin.
 */
function source(file: string): string {
  return (readFileSync(file, 'utf8') as string).replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '')
}

describe('cluster J: the kind badge markup has one home (#570)', () => {
  const files = componentSources(plannerUiSrc)

  it('finds the component sources it claims to sweep', () => {
    // Guards the pin below against a silently empty file list.
    expect(files.length).toBeGreaterThan(50)
    expect(files.some((f) => f.endsWith('planner/TypeChip.tsx'))).toBe(true)
    expect(files.some((f) => f.endsWith('planner/sections/AccountsSection.tsx'))).toBe(true)
  })

  it('only TypeChip.tsx writes the type-chip class into markup', () => {
    const offenders = files
      .filter((file) => !file.endsWith('planner/TypeChip.tsx'))
      .filter((file) => /className=(["'`])[^"'`]*\btype-chip\b/.test(source(file)))
      .map((file) => file.slice(plannerUiSrc.length))
    expect(offenders).toEqual([])
  })

  it('the one home really does carry a separator on both sides of the badge', () => {
    // Otherwise the pin above would be satisfied by a TypeChip that glues.
    const chip = source(`${plannerUiSrc}planner/TypeChip.tsx`)
    expect(chip).toMatch(/\{' '\}\s*\n?\s*<span className=/)
    expect(chip).toMatch(/<\/span>\{' '\}/)
  })
})
