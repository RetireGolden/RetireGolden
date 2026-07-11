/**
 * Step 2 (UI/UX round 2): the example-plan persistence story must be told the
 * same way everywhere. The banner, workspace save indicator, and open-example
 * dialog all draw from these constants; this test asserts they stay internally
 * consistent and truthful (edits ARE kept on-device; the example stays out of
 * Your plans until promoted; a fresh copy discards the on-device edits).
 */
import { describe, expect, it } from 'vitest'

import {
  EXAMPLE_BANNER_PERSISTENCE,
  EXAMPLE_LOAD_FRESH_DESC,
  EXAMPLE_OPEN_EXISTING_DESC,
  EXAMPLE_SAVE_INDICATOR,
} from './exampleCopy'

describe('example persistence copy', () => {
  it('the banner and save indicator agree that edits are kept on this device', () => {
    expect(EXAMPLE_SAVE_INDICATOR).toMatch(/kept on this device/i)
    expect(EXAMPLE_BANNER_PERSISTENCE).toMatch(/kept on this device/i)
  })

  it('the banner explains the example stays out of Your plans until promoted', () => {
    expect(EXAMPLE_BANNER_PERSISTENCE).toMatch(/Your plans/)
    expect(EXAMPLE_BANNER_PERSISTENCE).toMatch(/Save to my plans/)
  })

  it('never contradicts itself by claiming edits are not kept', () => {
    for (const copy of [EXAMPLE_SAVE_INDICATOR, EXAMPLE_BANNER_PERSISTENCE, EXAMPLE_OPEN_EXISTING_DESC]) {
      expect(copy, copy).not.toMatch(/won.?t (be )?(kept|saved|appear)/i)
      expect(copy, copy).not.toMatch(/not (kept|saved)/i)
    }
  })

  it('the two open-example choices describe opposite outcomes', () => {
    expect(EXAMPLE_OPEN_EXISTING_DESC).toMatch(/keeps/i)
    expect(EXAMPLE_LOAD_FRESH_DESC).toMatch(/resets|discard/i)
  })
})
