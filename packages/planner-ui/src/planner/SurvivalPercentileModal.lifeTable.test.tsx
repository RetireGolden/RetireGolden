/** @vitest-environment jsdom */
/**
 * D-LIFE-TABLE-2023 in the survival-percentile picker: the source line names
 * the table edition from the engine's source record, says what the chance
 * means for a person whose sex is not stated, and the pick it writes carries
 * the edition it was computed on.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { SSA_PERIOD_LIFE_TABLE } from '@retiregolden/engine/longevity/ssaPeriodLifeTable'
import type { Person } from '@retiregolden/engine/model/plan'
import { SurvivalPercentileModal } from './SurvivalPercentileModal'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

function person(sex: Person['sex']): Person {
  return { id: 'p1', name: 'Pat', dob: '1961-05-01', sex, retirementAge: 65, longevity: { planningAge: 95, source: 'manual' } }
}

function mount(who: Person, applied: Person['longevity'][], partner: Person | null = null): HTMLElement {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      <SurvivalPercentileModal person={who} personIndex={0} partner={partner} onApply={(l) => applied.push(l)} onClose={() => undefined} />,
    )
  })
  return container
}

describe('SurvivalPercentileModal and the SSA table edition', () => {
  it('names the edition from the source record, and for a sex not stated says the chance is the mean of the two', () => {
    const el = mount(person('average'), [])
    const source = el.querySelector('[data-testid="percentile-source"]')!.textContent.replace(/\s+/gu, ' ')
    const { periodYear, trusteesReportYear } = SSA_PERIOD_LIFE_TABLE.source
    expect(source).toContain(`the Social Security Administration's period life table for ${periodYear}, as used in the ${trusteesReportYear} Trustees Report`)
    expect(source).toContain('period life table for 2023, as used in the 2026 Trustees Report')
    expect(source).toContain('For a person whose sex is not stated, each chance is the average of the male and female chances.')
    expect(source).not.toContain('2022')
  })

  it('says nothing about averaging for a man, and writes the pick with the edition it was computed on', () => {
    const applied: Person['longevity'][] = []
    const el = mount(person('male'), applied)
    expect(el.querySelector('[data-testid="percentile-source"]')!.textContent).not.toContain('not stated')
    const use = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.startsWith('Use age'))!
    act(() => use.click())
    expect(applied).toHaveLength(1)
    expect(applied[0]!.source).toBe('percentile')
    expect(applied[0]!.percentile?.tableEdition).toEqual({ periodYear: 2023, trusteesReportYear: 2026 })
  })

  it('says each chance is the average for a joint pick whose partner\'s sex is not stated, and not once the pick is single', () => {
    const partner = { ...person('average'), id: 'p2', name: 'Sam', dob: '1963-02-01' }
    const el = mount(person('male'), [], partner)
    const source = () => el.querySelector('[data-testid="percentile-source"]')!.textContent.replace(/\s+/gu, ' ')
    // A couple starts on the joint pick, which reads the partner's curve.
    expect(source()).toContain('For a person whose sex is not stated, each chance is the average of the male and female chances.')
    const joint = Array.from(el.querySelectorAll('label')).find((l) => l.textContent?.includes('Either of us (joint)'))!
    const box = (joint.querySelector('input') ?? el.ownerDocument.getElementById(joint.htmlFor)) as HTMLInputElement
    act(() => box.click())
    expect(source()).not.toContain('not stated')
  })
})
