/**
 * WCAG contrast guards computed from the actual token hex values in
 * index.css, so a palette tweak that drops body/interactive text below AA
 * fails here instead of waiting for an eyeball audit. Covers both theme
 * mechanisms because the [data-theme='dark'] block and the
 * prefers-color-scheme block are asserted to define identical palettes.
 */

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'

const css: string = readFileSync(fileURLToPath(new URL('./index.css', import.meta.url)), 'utf8')

function extractBlock(selectorStart: string): string {
  const start = css.indexOf(selectorStart)
  expect(start, `selector ${selectorStart} present in index.css`).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', start)
  let depth = 1
  let i = open + 1
  while (depth > 0 && i < css.length) {
    if (css[i] === '{') depth++
    if (css[i] === '}') depth--
    i++
  }
  return css.slice(open + 1, i - 1)
}

function tokensOf(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const match of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out[match[1]!] = match[2]!.toLowerCase()
  }
  return out
}

function luminance(hex: string): number {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

const light = tokensOf(extractBlock(':root {'))
const toggledDark = tokensOf(extractBlock(":root[data-theme='dark']"))
const mediaDark = tokensOf(extractBlock(":root:not([data-theme='light'])"))

describe('theme mechanisms agree', () => {
  it('toggled dark and prefers-color-scheme dark define the same palette', () => {
    expect(toggledDark).toEqual(mediaDark)
  })
})

describe('light theme contrast (WCAG AA 4.5:1)', () => {
  it('accent-fg on accent (primary buttons) meets AA', () => {
    expect(contrast(light['accent']!, light['accent-fg']!)).toBeGreaterThanOrEqual(4.5)
  })

  it('accent text on surfaces and background meets AA', () => {
    expect(contrast(light['accent']!, light['surface-1']!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(light['accent']!, light['surface-2']!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(light['accent']!, light['bg']!)).toBeGreaterThanOrEqual(4.5)
  })

  it('body, muted, and status text on surfaces meets AA', () => {
    for (const fg of ['fg', 'muted', 'good', 'warn', 'bad'] as const) {
      for (const bg of ['bg', 'surface-1', 'surface-2'] as const) {
        expect(contrast(light[fg]!, light[bg]!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

describe('dark theme contrast (WCAG AA 4.5:1)', () => {
  it('accent-fg on accent (primary buttons) meets AA', () => {
    expect(contrast(toggledDark['accent']!, toggledDark['accent-fg']!)).toBeGreaterThanOrEqual(4.5)
  })

  it('accent text on surfaces and background meets AA', () => {
    expect(contrast(toggledDark['accent']!, toggledDark['surface-1']!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(toggledDark['accent']!, toggledDark['surface-2']!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(toggledDark['accent']!, toggledDark['bg']!)).toBeGreaterThanOrEqual(4.5)
  })

  it('body, muted, and status text on surfaces meets AA', () => {
    for (const fg of ['fg', 'muted', 'good', 'warn', 'bad'] as const) {
      for (const bg of ['bg', 'surface-1', 'surface-2'] as const) {
        expect(contrast(toggledDark[fg]!, toggledDark[bg]!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})
