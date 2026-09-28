/** @vitest-environment jsdom */
/**
 * D-LIFE-TABLE-2023: the questionnaire's sex step names the unstated option
 * as the Household field does, and says what it averages.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { LongevityWizard } from './LongevityWizard'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

describe('LongevityWizard sex step', () => {
  it('labels the unstated option "Not stated (average of male and female)" and says it averages the two', () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => {
      root!.render(<LongevityWizard initialAnswers={{ age: 65, sex: 'average' }} onComplete={() => undefined} />)
    })
    const next = Array.from(container.querySelectorAll('button')).find((b) => b.className.includes('btn-primary'))!
    act(() => next.click())
    const labels = Array.from(container.querySelectorAll('.radio-option span')).map((span) => span.textContent)
    expect(labels).toEqual(['Male table', 'Female table', 'Not stated (average of male and female)'])
    const checked = container.querySelector<HTMLInputElement>('input[type="radio"]:checked')!
    expect(checked.value).toBe('average')
    expect((container.textContent ?? '').replace(/\s+/gu, ' ')).toContain('"Not stated" averages the two, as for someone equally likely to be either.')
  })
})
