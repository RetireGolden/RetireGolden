/**
 * Design-QA chrome pins (#418, #419, #423, #431, #436, #437, #438, #441). Pin
 * the CSS, not a jsdom visual: jsdom computes no layout, so the defects these
 * cover — a clipped focus ring, a mid-word clip, a header row that wraps —
 * are only observable in the stylesheet.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

const css: string = readFileSync(fileURLToPath(new URL('./planner.css', import.meta.url)), 'utf8')
const learnCss: string = readFileSync(fileURLToPath(new URL('../learn/learn.css', import.meta.url)), 'utf8')
const indexCss: string = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8')

function ruleBodyAt(source: string, start: number, selector: string): string {
  expect(start, `rule ${selector} present`).toBeGreaterThanOrEqual(0)
  const open = source.indexOf('{', start)
  let depth = 1
  let i = open + 1
  while (depth > 0 && i < source.length) {
    if (source[i] === '{') depth++
    if (source[i] === '}') depth--
    i++
  }
  return source.slice(open + 1, i - 1)
}

/**
 * Body of the first rule whose selector list is exactly `selector`: the text
 * must be followed by `{` and preceded only by whitespace back to the start
 * of the sheet, a `}`, or the end of a comment — so `.foo, .nowrap {` never
 * satisfies a pin for `.nowrap`. Plain string scanning, no dynamic RegExp.
 */
function rule(selector: string, source = css): string {
  let from = 0
  while (from < source.length) {
    const at = source.indexOf(selector, from)
    if (at < 0) break
    from = at + selector.length
    let after = from
    while (after < source.length && /\s/.test(source[after]!)) after++
    if (source[after] !== '{') continue
    let before = at - 1
    while (before >= 0 && /\s/.test(source[before]!)) before--
    const boundary = before < 0 || source[before] === '}' || source.slice(before - 1, before + 1) === '*/'
    if (!boundary) continue
    return ruleBodyAt(source, at, selector)
  }
  return ruleBodyAt(source, -1, selector)
}

/** Start offset of the shared .field text-input rule, or -1 when its selector list drifts. */
function indexOfSharedFieldRule(): number {
  return css.indexOf(".field input:not([type='checkbox']):not([type='radio']):not([type='range']),\n.field select {")
}

describe('Design-QA chrome pins', () => {
  it('plan-name input truncates with an ellipsis, not a mid-word clip (#431)', () => {
    const body = rule('.plan-name-input')
    expect(body).toMatch(/text-overflow:\s*ellipsis/)
    expect(body).toMatch(/width:\s*100%/)
    expect(body).toMatch(/max-width:\s*30rem/)
  })

  it('survivor table headers get a column floor and never break mid-token (#431)', () => {
    expect(rule('.compare-table.survivor-table')).toMatch(/min-width:\s*70rem/)
    // The filing-status column carries its longest segment on one line, so
    // a transition renders one line per segment, not a four-line wrap.
    const filingCell = rule('.compare-table.survivor-table .survivor-filing-cell')
    expect(filingCell).toMatch(/min-width: *18rem/)
    expect(filingCell).toMatch(/text-align: *left/)
    const headers = rule('.compare-table.survivor-table thead th')
    expect(headers).toMatch(/overflow-wrap:\s*normal/)
    expect(headers).toMatch(/hyphens:\s*none/)
    expect(rule('.nowrap')).toMatch(/white-space:\s*nowrap/)
    expect(rule('.survivor-timeline-segment')).toMatch(/display:\s*block/)
    // The wrap the table sits in scrolls, so the floor never widens the page.
    expect(rule('.year-table-wrap')).toMatch(/overflow:\s*auto/)
  })

  it('content pages have a chrome back link style (#419)', () => {
    const body = rule('.page-back')
    expect(body).toMatch(/color:\s*var\(--accent\)/)
    expect(body).toMatch(/display:\s*inline-block/)
  })

  it('a form-grid field can span the full row, which the Spending policy select uses (#423)', () => {
    expect(rule('.form-grid > .field-span-full')).toMatch(/grid-column:\s*1 \/ -1/)
  })

  it('article source links wrap inside the measure (#418)', () => {
    expect(rule('.learn-sources a', learnCss)).toMatch(/overflow-wrap:\s*anywhere/)
  })
})

describe('Design-QA chrome pins: theme and focus tokens', () => {
  it('the theme switcher does not clip its segment focus rings (#436)', () => {
    const switcher = rule('.theme-switcher', indexCss)
    // Any clipping overflow would cut the ring; only visible (the default) is allowed.
    expect(switcher).not.toMatch(/overflow(-x|-y)?:\s*(hidden|clip|auto|scroll)/)
    expect(switcher).toMatch(/border-radius:\s*999px/)
    // The end segments carry the pill shape instead of the container clipping it.
    expect(rule('.theme-switcher-button:first-child', indexCss)).toMatch(/border-radius:\s*999px 0 0 999px/)
    expect(rule('.theme-switcher-button:last-child', indexCss)).toMatch(/border-radius:\s*0 999px 999px 0/)
    // The ring itself is unchanged: the app-wide 2px gold signature, which is
    // what the removed clip was cutting into a sliver.
    const sharedFocus = rule(
      '.nav-link:focus-visible,\n.brand:focus-visible,\n.theme-switcher-button:focus-visible',
      indexCss,
    )
    expect(sharedFocus).toMatch(/outline:\s*2px solid var\(--accent\)/)
    expect(sharedFocus).toMatch(/outline-offset:\s*2px/)
  })

  it('the plan breadcrumb link uses the shared focus ring, not the UA default (#437)', () => {
    const body = rule('.workspace-breadcrumb a:focus-visible')
    expect(body).toMatch(/outline:\s*2px solid var\(--accent\)/)
    expect(body).toMatch(/outline-offset:\s*2px/)
  })

  it('empty states are a bounded well; an element that is itself a card keeps card chrome (#438)', () => {
    const body = rule('.empty-state')
    expect(body).toMatch(/border:\s*1px dashed var\(--border\)/)
    expect(body).toMatch(/border-radius:\s*var\(--radius\)/)
    expect(body).toMatch(/background:\s*color-mix/)
    // An element that is itself a card keeps its card chrome (#463 review).
    const cardEmpty = rule('.card.empty-state')
    expect(cardEmpty).toMatch(/border:\s*1px solid var\(--border\)/)
    expect(cardEmpty).toMatch(/background:\s*var\(--surface-1\)/)
  })

  it('disabled buttons use the flat token treatment, not opacity on a live fill (#441)', () => {
    const body = rule('.btn:disabled', indexCss)
    // Explicitly opaque: no dimming value, and nothing left for a UA sheet to fade.
    expect(body).not.toMatch(/opacity:\s*0?\.\d/)
    expect(body).toMatch(/opacity:\s*1\b/)
    expect(body).toMatch(/background:\s*var\(--surface-2\)/)
    expect(body).toMatch(/color:\s*var\(--muted\)/)
    expect(body).toMatch(/cursor:\s*not-allowed/)
    // Ghost buttons have no fill to composite against and keep the faded
    // treatment the plan-card Delete pin (#312) relies on.
    const ghost = rule('.btn-ghost:disabled,\n.btn.btn-ghost:disabled')
    expect(ghost).toMatch(/opacity:\s*0\.45/)
    // A ghost that also carries .btn must not pick up the filled treatment.
    expect(ghost).toMatch(/background:\s*transparent/)
  })
})

describe('Shared native-control treatment (#447, #451, #458, #466, #467, #469)', () => {
  it('checks and radios are drawn by the app, not the UA, in both states', () => {
    const box = rule("input[type='checkbox'],\ninput[type='radio']", indexCss)
    expect(box).toMatch(/appearance:\s*none/)
    expect(box).toMatch(/width:\s*var\(--control-check-size\)/)
    expect(box).toMatch(/border:\s*1px solid var\(--border\)/)
    expect(box).toMatch(/background:\s*var\(--surface-1\)/)
    const checked = rule("input[type='checkbox']:checked,\ninput[type='radio']:checked", indexCss)
    expect(checked).toMatch(/background:\s*var\(--accent\)/)
    // The mark is a clip-path filled with the token that already clears AA on --accent.
    const mark = rule("input[type='checkbox']::before,\ninput[type='radio']::before", indexCss)
    expect(mark).toMatch(/background:\s*currentColor/)
    expect(box).toMatch(/color:\s*var\(--accent-fg\)/)
    // Disabled follows the flat token treatment, never opacity on the fill.
    const disabled = rule("input[type='checkbox']:disabled,\ninput[type='radio']:disabled", indexCss)
    expect(disabled).toMatch(/background:\s*var\(--surface-2\)/)
    expect(disabled).not.toMatch(/opacity/)
  })

  it('selects drop the UA chrome and carry the theme-mirrored chevron token', () => {
    const select = rule('select', indexCss)
    expect(select).toMatch(/appearance:\s*none/)
    expect(select).toMatch(/background-image:\s*var\(--select-chevron\)/)
    expect(select).toMatch(/\bheight:\s*var\(--control-height\)/)
    expect(select).toMatch(/padding:\s*0\.45rem 2rem 0\.45rem 0\.55rem/)
    // The token exists in the light block and both dark mechanisms, and its
    // stroke is that block's --muted: a select cannot take currentColor on a
    // background glyph, so the data URI carries the hex, and this is what
    // keeps it from drifting when the palette moves.
    for (const block of [':root {', ":root[data-theme='dark'] {", ":root:not([data-theme='light']) {"]) {
      const at = indexCss.indexOf(block)
      expect(at, block).toBeGreaterThanOrEqual(0)
      const body = indexCss.slice(at, indexCss.indexOf('}', at))
      const muted = body.match(/--muted:\s*#([0-9a-fA-F]{6})/)?.[1]?.toLowerCase()
      const stroke = body.match(/--select-chevron:\s*url\("data:image\/svg\+xml[^"]*stroke='%23([0-9a-fA-F]{6})'/)?.[1]?.toLowerCase()
      expect(muted, `${block} defines --muted`).toBeTruthy()
      expect(stroke, `${block} defines --select-chevron with a stroke`).toBeTruthy()
      expect(stroke, `${block}: chevron stroke equals --muted`).toBe(muted)
    }
    // The field rule must not use the background shorthand (it would erase the
    // chevron) and must leave range sliders to the app-wide slider rule.
    const shared = rule(".field input:not([type='checkbox']):not([type='radio']):not([type='range']),\n.field select")
    expect(shared).toMatch(/background-color:\s*var\(--surface-1\)/)
    expect(shared).not.toMatch(/\bbackground:\s/)
    expect(shared).toMatch(/\bheight:\s*var\(--control-height\)/)
    expect(indexOfSharedFieldRule()).toBeGreaterThanOrEqual(0)
  })

  it('range sliders paint the track and thumb from tokens, inside .field too', () => {
    const range = rule("input[type='range']", indexCss)
    expect(range).toMatch(/appearance:\s*none/)
    expect(range).toMatch(/background:\s*transparent/)
    // No .field rule may re-box a slider: every .field input selector that
    // sets height/padding/border excludes type=range (Monte Carlo and the SS
    // Optimizer sliders sit inside .field and rendered as text boxes without this).
    const fieldInputSelectors = [...css.matchAll(/^\.field[^{\n]*\binput\b[^{\n]*\{/gm)].map((m) => m[0])
    expect(fieldInputSelectors.length).toBeGreaterThan(0)
    for (const sel of fieldInputSelectors) {
      if (/focus-visible|checkbox|\[type='radio'\]\s*\{|\[type='checkbox'\]\s*\{/.test(sel) && !/:not\(/.test(sel)) continue
      const body = ruleBodyAt(css, css.indexOf(sel), sel)
      if (/\b(height|padding|border)\s*:/.test(body)) {
        expect(sel, `${sel} must exclude range`).toMatch(/:not\(\[type='range'\]\)/)
      }
    }
    // High-contrast modes get the UA controls back instead of erased fills.
    const forced = indexCss.slice(indexCss.indexOf('@media (forced-colors: active)'))
    expect(forced).toMatch(/appearance:\s*auto/)
    expect(forced).toMatch(/input\[type='checkbox'\]::before,\s*input\[type='radio'\]::before\s*\{\s*display:\s*none/)
    for (const thumb of ["input[type='range']::-webkit-slider-thumb", "input[type='range']::-moz-range-thumb"]) {
      const body = rule(thumb, indexCss)
      expect(body, thumb).toMatch(/background:\s*var\(--accent\)/)
      expect(body, thumb).toMatch(/border:\s*2px solid var\(--surface-1\)/)
    }
    for (const track of ["input[type='range']::-webkit-slider-runnable-track", "input[type='range']::-moz-range-track"]) {
      expect(rule(track, indexCss), track).toMatch(/background:\s*var\(--surface-2\)/)
    }
  })

  it('number inputs keep semantics but lose the UA spin buttons (#451)', () => {
    expect(rule("input[type='number']", indexCss)).toMatch(/appearance:\s*textfield/)
    expect(
      rule("input[type='number']::-webkit-inner-spin-button,\ninput[type='number']::-webkit-outer-spin-button", indexCss),
    ).toMatch(/appearance:\s*none/)
  })

  it('every control shares the 2px gold focus ring', () => {
    const focus = rule(
      "input[type='checkbox']:focus-visible,\ninput[type='radio']:focus-visible,\ninput[type='range']:focus-visible,\nselect:focus-visible",
      indexCss,
    )
    expect(focus).toMatch(/outline:\s*2px solid var\(--accent\)/)
    expect(focus).toMatch(/outline-offset:\s*2px/)
  })

  it('form rows subgrid label and control tracks so a wrapped label never displaces one input (#470, #471, #477)', () => {
    // The base grid is untouched (single track, 0.8rem gap): browsers without
    // subgrid keep it as it was.
    expect(rule('.form-grid')).toMatch(/gap:\s*0\.8rem 1\.1rem/)
    expect(rule('.form-grid')).not.toMatch(/subgrid|grid-row/)
    const supports = css.slice(css.indexOf('@supports (grid-template-rows: subgrid)'))
    expect(supports.length).toBeGreaterThan(0)
    const inside = (selector: string) => rule(selector, supports)
    expect(inside('.form-grid > *')).toMatch(/grid-row:\s*span 2/)
    expect(inside('.form-grid > *')).not.toMatch(/margin/)
    // Exactly two children: a one-child compound field or a many-child field keeps its own layout.
    const two = '.form-grid > .field:has(> :nth-child(2)):not(:has(> :nth-child(3)))'
    expect(inside(two)).toMatch(/display:\s*grid/)
    expect(inside(`${two},\n  .form-grid > .field-with-action`)).toMatch(/grid-template-rows:\s*subgrid/)
    expect(supports).not.toMatch(/\.form-grid > \.field:not\(:has\(> :nth-child\(3\)\)\)\s*\{/)
    // Label to the bottom of its track (covers a bare .field-label too); control pulled up 0.45rem.
    expect(inside(`${two} > :first-child,\n  .form-grid > .field-with-action > .field > .field-label-row`)).toMatch(/align-self:\s*end/)
    expect(supports).toMatch(/:nth-child\(2\),[\s\S]*?\{\s*margin-top:\s*-0\.45rem/)
    expect(supports).not.toMatch(/\.form-grid > \.field > \.field-label-row\s*\{/)
    // Callouts and hints get their own full row.
    expect(inside('.form-grid > .callout,\n  .form-grid > .card-hint,\n  .form-grid > .field-hint,\n  .form-grid > p')).toMatch(/grid-column:\s*1 \/ -1/)
    // The ⓘ flows after the label's last word: inline formatting, not flex.
    expect(rule('.field-label-row')).toMatch(/display:\s*block/)
    expect(rule('.field-label-row > .field-label')).toMatch(/display:\s*inline/)
    expect(rule('.field-label-row > .help-tip')).toMatch(/vertical-align/)
  })

  it('the plan-error card aligns its actions and details with its centered prose (#444)', () => {
    expect(rule('.card.empty-state .picker-actions')).toMatch(/justify-content:\s*center/)
    const details = rule('.card.empty-state .ss-explainer')
    expect(details).toMatch(/margin-left:\s*auto/)
    expect(details).toMatch(/margin-right:\s*auto/)
    expect(details).toMatch(/text-align:\s*left/)
  })

  it('prose links get the app focus ring at (0,1,0), below any class-styled anchor rule (#450)', () => {
    const body = rule(':where(a):focus-visible', indexCss)
    expect(body).toMatch(/outline:\s*2px solid var\(--accent\)/)
    expect(body).toMatch(/outline-offset:\s*2px/)
  })

  it('destructive actions on persisted items are --bad at rest: plan cards and saved scenarios (#312, #460)', () => {
    const body = rule('.plan-card-actions .btn-ghost.btn-ghost-danger,\n.scenarios-table .btn-ghost.btn-ghost-danger')
    expect(body).toMatch(/color:\s*var\(--bad\)/)
    // A bare ghost-danger (an unsaved form row's Remove) is not in that list.
    expect(css).not.toMatch(/^\.btn-ghost\.btn-ghost-danger\s*\{[^}]*--bad/m)
  })

  it('the Learn-about-this-screen cluster is styled by the globally loaded sheet (#446)', () => {
    // learn.css loads only on /learn routes; the cluster renders on plan screens.
    // The aside is a .card, which already spaces itself; no extra top margin.
    expect(css).not.toMatch(/^\.learn-screen\s*\{/m)
    expect(rule('.learn-screen-list')).toMatch(/display:\s*flex/)
    expect(learnCss).not.toMatch(/^\.learn-screen\s*\{/m)
    expect(learnCss).not.toMatch(/^\.learn-screen-title\s*\{/m)
  })

  it('the scenario rows table carries the class the danger rule targets (#460)', () => {
    const page: string = readFileSync(fileURLToPath(new URL('./ScenariosPage.tsx', import.meta.url)), 'utf8')
    const overview = page.indexOf('<caption>Deterministic overview (nominal dollars)</caption>')
    expect(overview).toBeGreaterThan(0)
    const tag = page.lastIndexOf('<table', overview)
    expect(page.slice(tag, overview)).toMatch(/className="compare-table scenarios-table"/)
    expect(page.slice(overview)).toMatch(/className="btn-ghost btn-ghost-danger"/)
  })

  it('text, select, and affixed inputs share one height token', () => {
    const affix = rule('.input-affix')
    expect(affix).toMatch(/min-height:\s*var\(--control-height\)/)
    expect(affix).toMatch(/align-items:\s*stretch/)
    expect(rule('.input-affix > input')).toMatch(/min-height:\s*0/)
    // The field checkbox no longer forces width:auto, which undid the box size.
    expect(rule(".field--checkbox input[type='checkbox']")).not.toMatch(/width:\s*auto/)
  })
})
