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

/**
 * A className that writes the *base* badge class into markup, in any form a
 * call site might reach for: a quoted attribute, a braced string literal, a
 * template literal, a conditional, a helper call. Matching only `className="`
 * would leave `className={'type-chip'}` invisible, and a hole in this pin is a
 * hole on exactly the surfaces the rendered sweep cannot mount — which is the
 * whole reason the pin exists.
 *
 * The window is bounded and cannot cross `>`, so it stays inside one opening
 * tag. `type-chip--muted` is a modifier a call site may legitimately hand to
 * `TypeChip`, so the lookahead keeps modifiers out of the net; only the bare
 * class — the one `TypeChip` itself is responsible for — is caught.
 */
const BADGE_CLASS_IN_MARKUP = /className=\s*\{?[^>]{0,160}?(["'`])[^"'`]*\btype-chip(?![\w-])/

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

  it('catches every className form a call site could write the base class in', () => {
    // Calibration: a net that matched nothing would make the pin below vacuous,
    // and one that matched modifiers would forbid a legitimate call.
    const caught = [
      '<span className="type-chip">Cash</span>',
      "<span className='type-chip'>Cash</span>",
      '<span className="type-chip year-cash-flow-shortfall-badge">',
      "<span className={'type-chip'}>Cash</span>",
      '<span className={"type-chip"}>Cash</span>',
      '<span className={`type-chip ${extra}`}>Cash</span>',
      "<span className={muted ? 'type-chip type-chip--muted' : 'type-chip'}>Cash</span>",
      "<span className={classNames('type-chip', extra)}>Cash</span>",
      '<span\n  className="type-chip"\n>Cash</span>',
    ]
    for (const markup of caught) expect(BADGE_CLASS_IN_MARKUP.test(markup), markup).toBe(true)

    const allowed = [
      '<TypeChip className="type-chip--muted">Not applied</TypeChip>',
      "<TypeChip className={'type-chip--good'}>High Confidence</TypeChip>",
      '<TypeChip>Cash</TypeChip>',
      "const confidenceChips = { high: { className: 'type-chip--good' } }",
    ]
    for (const markup of allowed) expect(BADGE_CLASS_IN_MARKUP.test(markup), markup).toBe(false)
  })

  it('sees the one legitimate call: TypeChip is excluded by name, never invisible', () => {
    // The net has to match the real expression form the badge is written in.
    // If it did not, the sweep below would pass because it sees nothing at all.
    expect(BADGE_CLASS_IN_MARKUP.test(source(`${plannerUiSrc}planner/TypeChip.tsx`))).toBe(true)
  })

  it('only TypeChip.tsx writes the type-chip class into markup', () => {
    const offenders = files
      .filter((file) => !file.endsWith('planner/TypeChip.tsx'))
      .filter((file) => BADGE_CLASS_IN_MARKUP.test(source(file)))
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
