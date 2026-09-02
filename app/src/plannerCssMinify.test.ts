/**
 * The plan-card name clamp (#533, review of #556) rides on the
 * `display: -webkit-box` + `-webkit-box-orient: vertical` pair, which a
 * minifier can drop as obsolete. The web build's minifier is lightningcss;
 * it is reached here through Vite's own dependency tree, so this runs the
 * same version the build does, over the same source sheet, and checks the
 * emitted `.plan-card-name` rule still carries the pair. The planner-ui pin
 * guards the source; this guards what ships.
 */
import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { createRequire } from 'node:module'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

type Lightningcss = {
  transform: (options: { filename: string; code: Uint8Array; minify: boolean; targets?: Record<string, number> }) => {
    code: Uint8Array
  }
}

const requireFromVite = createRequire(createRequire(import.meta.url).resolve('vite/package.json'))
const { transform } = requireFromVite('lightningcss') as Lightningcss

const plannerCss: Uint8Array = readFileSync(
  fileURLToPath(new URL('../../packages/planner-ui/src/planner/planner.css', import.meta.url)),
)

/** Vite's documented default `build.cssTarget` for the modules target, in lightningcss's packed form. */
const VITE_MODULES_TARGETS = { chrome: 87 << 16, edge: 88 << 16, firefox: 78 << 16, safari: 14 << 16 }

/** Bodies of every emitted rule whose selector list is exactly `selector`. */
function minifiedRules(selector: string, targets?: Record<string, number>): string[] {
  const out = new TextDecoder().decode(transform({ filename: 'planner.css', code: plannerCss, minify: true, targets }).code)
  const rules: string[] = []
  let from = 0
  for (;;) {
    const at = out.indexOf(`${selector}{`, from)
    if (at < 0) break
    const close = out.indexOf('}', at)
    // Exactly this selector: the match must start the sheet or follow a `}`.
    if (at === 0 || out[at - 1] === '}') rules.push(out.slice(at + selector.length + 1, close))
    from = close
  }
  return rules
}

describe('planner.css through the web build minifier', () => {
  it('keeps the -webkit-box display and orientation the plan-card name clamp needs', () => {
    for (const targets of [undefined, VITE_MODULES_TARGETS]) {
      const bodies = minifiedRules('.plan-card-name', targets)
      expect(bodies.length, 'the rule survives').toBeGreaterThan(0)
      const clamp = bodies.find((b) => b.includes('-webkit-line-clamp:2'))
      expect(clamp, 'the clamp rule survives').toBeDefined()
      expect(clamp).toContain('display:-webkit-box')
      expect(clamp).toContain('-webkit-box-orient:vertical')
      expect(clamp).toContain('overflow:hidden')
    }
  })
})
