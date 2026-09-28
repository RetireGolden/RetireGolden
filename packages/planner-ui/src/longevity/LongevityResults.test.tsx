/** @vitest-environment jsdom */
/**
 * D-LIFE-TABLE-2023: a saved questionnaire result is labelled with the SSA
 * table edition it was computed on. A result saved before the field existed
 * was made on the 2022 table and says so, with a note that the planner has
 * moved on; it is never shown under the 2023 label. A current result states
 * how far the survival curve's own life expectancy is from SSA's printed one.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import type { LongevityPersisted } from '@retiregolden/engine/longevity/types'
import { LongevityResults } from './LongevityResults'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

function saved(tableEdition?: { periodYear: number; trusteesReportYear: number }, baseline = 18.12): LongevityPersisted {
  return {
    version: 1,
    updatedAt: '2026-09-27T12:00:00.000Z',
    answers: {
      age: 65, sex: 'male', bmiCategory: 'normal', smoking: 'never', alcohol: 'moderate', activity: 'moderate',
      diabetes: 'no', selfRatedHealth: 'good', parentalLongevity: 'unknown',
    },
    result: {
      ...(tableEdition ? { tableEdition } : {}),
      baselineRemainingYears: baseline,
      rawMultiplier: 1,
      appliedMultiplier: 1,
      centralRemainingYears: baseline,
      bandLowRemainingYears: baseline * 0.9,
      bandHighRemainingYears: baseline * 1.08,
      illustrativePlanningAge: 65 + Math.round(baseline),
    },
  }
}

function mount(data: LongevityPersisted): HTMLElement {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(<LongevityResults data={data} onEdit={() => undefined} onClear={() => undefined} />)
  })
  return container
}

describe('LongevityResults and the SSA table edition', () => {
  it('labels a result saved before the edition was stored as the 2022 table, links its page and says the planner has moved on', () => {
    const el = mount(saved(undefined, 17.48))
    const text = (el.textContent ?? '').replace(/\s+/gu, ' ')
    expect(text).toContain('Population baseline: 17.48 remaining years at age 65')
    expect(text).toContain('SSA period life table, 2022 (2025 Trustees Report)')
    expect(text).toContain('using 2022 mortality rates')
    expect(text).not.toContain('SSA period life table, 2023 (2026 Trustees Report). The')
    const link = el.querySelector('a')!
    expect(link.getAttribute('href')).toBe('https://www.ssa.gov/oact/STATS/table4c6_2022_TR2025.html')
    expect(el.querySelector('[data-testid="longevity-older-table"]')!.textContent.replace(/\s+/gu, ' ')).toBe(
      'Saved on the SSA period life table, 2022 (2025 Trustees Report). The planner now uses the SSA period life table, 2023 (2026 Trustees Report). Edit your answers to recompute this estimate on it.',
    )
  })

  it('names a sex that is not stated with the Household label', () => {
    const data = saved({ periodYear: 2023, trusteesReportYear: 2026 }, 19.39)
    const el = mount({ ...data, answers: { ...data.answers, sex: 'average' } })
    const text = (el.textContent ?? '').replace(/\s+/gu, ' ')
    expect(text).toContain('Population baseline: 19.39 remaining years at age 65, sex Not stated (average of male and female).')
  })

  it('labels a current result with the 2023 table and states the curve\'s gap from the printed life expectancy', () => {
    const el = mount(saved({ periodYear: 2023, trusteesReportYear: 2026 }))
    const text = (el.textContent ?? '').replace(/\s+/gu, ' ')
    expect(text).toContain('SSA period life table, 2023 (2026 Trustees Report)')
    expect(text).toContain('using 2023 mortality rates')
    expect(el.querySelector('a')!.getAttribute('href')).toBe('https://www.ssa.gov/oact/STATS/table4c6.html')
    expect(text).toContain('The life expectancy they imply differs from SSA\'s printed figure above by at most 0.005 years.')
    expect(el.querySelector('[data-testid="longevity-older-table"]')).toBeNull()
  })
})
