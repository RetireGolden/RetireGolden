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
 * Every string literal and template literal in a source, with its delimiters
 * off — escapes consumed so a `\"` inside a double-quoted string does not end
 * it early.
 */
const STRING_LITERAL = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g

/**
 * The base badge class as a whole token. The word-ish boundaries are what
 * separate it from the modifiers a call site may legitimately hand to
 * `TypeChip` (`type-chip--muted`, `type-chip--good`) and from an unrelated
 * name that merely starts the same way (`type-chippy`).
 */
const BARE_BADGE_CLASS = /(?<![\w-])type-chip(?![\w-])/

/**
 * True when a source writes the base badge class as a string anywhere.
 *
 * Two earlier versions of this pin tried to recognise the *expression* around
 * the class — `className="…"`, then a bounded window after `className=`. Both
 * leaked, and the second leaked in a way worth remembering: the window was
 * bounded on `>` to stay inside one opening tag, which hid
 * `className={count > 0 ? 'type-chip' : ''}`; re-bounding on `<` hid the
 * mirror, `count < 3`. There is no bound that is right, because `<` and `>`
 * are both comparisons AND both element delimiters, and no regex can tell
 * which is which.
 *
 * So this does not parse the expression at all. If the token appears as a
 * string in the file, the file writes the class — whatever wraps it: an
 * attribute, a braced literal, a template segment, a conditional in either
 * direction, a helper call, or a `const badge = 'type-chip'` assigned three
 * lines earlier. That is strictly stricter than any expression-aware net,
 * and it cannot acquire this class of hole again.
 */
function writesBadgeClass(source: string): boolean {
  for (const match of source.matchAll(STRING_LITERAL)) {
    if (BARE_BADGE_CLASS.test(match[2] ?? '')) return true
  }
  return false
}

/** Source files under `planner-ui/src`; tests may name the class freely. */
function componentSources(dir: string, found: string[] = []): string[] {
  const entries = readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>
  for (const entry of entries) {
    const full = `${dir}${entry.name}`
    if (entry.isDirectory()) componentSources(`${full}/`, found)
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) found.push(full)
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

  it('finds the sources it claims to sweep', () => {
    // Guards the pin below against a silently empty file list.
    expect(files.length).toBeGreaterThan(50)
    expect(files.some((f) => f.endsWith('planner/TypeChip.tsx'))).toBe(true)
    expect(files.some((f) => f.endsWith('planner/sections/AccountsSection.tsx'))).toBe(true)
  })

  it('catches the base class inside any expression, in either comparison direction', () => {
    // Calibration: a sweep that matched nothing would make the pin below
    // vacuous, and one that matched modifiers would forbid a legitimate call.
    // Every form the two earlier expression-aware nets were asked to cover is
    // kept here, plus the `<` comparison that killed the second one.
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
      "<span className={kind === 'cash' ? 'type-chip' : ''}>Cash</span>",
      "<span className={kind !== 'cash' ? '' : 'type-chip'}>Cash</span>",
      "<span className={count > 0 ? 'type-chip' : ''}>Cash</span>",
      "<span className={count >= 2 ? 'type-chip' : ''}>Cash</span>",
      "<span className={count < 3 ? 'type-chip' : ''}>Cash</span>",
      "<span className={count <= 3 ? 'type-chip' : ''}>Cash</span>",
      "<span className={rows.filter((r) => r.on).length > 0 ? 'type-chip' : ''}>Cash</span>",
      "<span className={active && 'type-chip'}>Cash</span>",
      // Not an expression at all: the class named far from its use.
      "const badge = 'type-chip'\n<span className={badge}>Cash</span>",
    ]
    for (const markup of caught) expect(writesBadgeClass(markup), markup).toBe(true)

    const allowed = [
      '<TypeChip className="type-chip--muted">Not applied</TypeChip>',
      "<TypeChip className={'type-chip--good'}>High Confidence</TypeChip>",
      '<TypeChip>Cash</TypeChip>',
      "const confidenceChips = { high: { className: 'type-chip--good' } }",
      '<span className="type-chippy">an unrelated name</span>',
    ]
    for (const markup of allowed) expect(writesBadgeClass(markup), markup).toBe(false)
  })

  it('sees the one legitimate call: TypeChip is excluded by name, never invisible', () => {
    // The sweep has to match the module that really does write the class. If
    // it did not, the pin below would pass because it sees nothing at all.
    expect(writesBadgeClass(source(`${plannerUiSrc}planner/TypeChip.tsx`))).toBe(true)
  })

  it('only TypeChip.tsx writes the type-chip class', () => {
    const offenders = files
      .filter((file) => !file.endsWith('planner/TypeChip.tsx'))
      .filter((file) => writesBadgeClass(source(file)))
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
