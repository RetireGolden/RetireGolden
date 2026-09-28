/** @vitest-environment jsdom */
/**
 * PR #759 review 8: the results card's "differs from SSA's printed figure
 * above by at most N years" follows the engine's published
 * CURVE_EXPECTANCY_GAP, rounded up to the thousandth, rather than a literal:
 * here the engine's value is replaced, and the card follows it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import type { LongevityPersisted } from '@retiregolden/engine/longevity/types'

vi.mock('@retiregolden/engine/longevity/ssaPeriodLifeTable', async (importOriginal) => {
  const original = await importOriginal<typeof import('@retiregolden/engine/longevity/ssaPeriodLifeTable')>()
  return { ...original, CURVE_EXPECTANCY_GAP: { ...original.CURVE_EXPECTANCY_GAP, maxYears: 0.01213 } }
})

const { LongevityResults } = await import('./LongevityResults')
const { curveExpectancyGapText } = await import('./constants')

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

const data: LongevityPersisted = {
  version: 1,
  updatedAt: '2026-09-28T12:00:00.000Z',
  answers: {
    age: 65, sex: 'male', bmiCategory: 'normal', smoking: 'never', alcohol: 'moderate', activity: 'moderate',
    diabetes: 'no', selfRatedHealth: 'good', parentalLongevity: 'unknown',
  },
  result: {
    tableEdition: { periodYear: 2023, trusteesReportYear: 2026 },
    baselineRemainingYears: 18.12, rawMultiplier: 1, appliedMultiplier: 1, centralRemainingYears: 18.12,
    bandLowRemainingYears: 16.3, bandHighRemainingYears: 19.6, illustrativePlanningAge: 83,
  },
}

describe('the curve-versus-printed gap on the results card', () => {
  it('prints the engine’s published gap, rounded up to the thousandth', () => {
    expect(curveExpectancyGapText()).toBe('0.013')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => {
      root!.render(<LongevityResults data={data} onEdit={() => undefined} onClear={() => undefined} />)
    })
    const text = (container.textContent ?? '').replace(/\s+/gu, ' ')
    expect(text).toContain("differs from SSA's printed figure above by at most 0.013 years.")
    expect(text).not.toContain('0.005')
  })

  it('rounds up, so "at most" stays true', () => {
    expect(curveExpectancyGapText(0.004961383989225965)).toBe('0.005')
    expect(curveExpectancyGapText(0.005)).toBe('0.005')
    expect(curveExpectancyGapText(0.0050001)).toBe('0.006')
  })
})
