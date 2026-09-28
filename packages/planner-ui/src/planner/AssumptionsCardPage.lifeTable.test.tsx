/** @vitest-environment jsdom */
/**
 * PR #759 review round 2: the Assumptions card reads the questionnaire results
 * saved in this browser again when the plan changes, so a result completed
 * while the card is open dates the questionnaire planning age it produced
 * instead of the card keeping "table edition not recorded" until a reload.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { clearLongevity, saveLongevity } from '../longevity/storage'
import { createSamplePlan } from '../testSupport/samplePlan'
import { AssumptionsCardPage } from './AssumptionsCardPage'
import { PlanCtx } from './planContextCore'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
  clearLongevity()
})

function page(plan: Plan) {
  return (
    <MemoryRouter>
      <PlanCtx.Provider value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
        <AssumptionsCardPage />
      </PlanCtx.Provider>
    </MemoryRouter>
  )
}

function withQuestionnaireAge(plan: Plan, planningAge: number): Plan {
  const [first, ...rest] = plan.household.people
  return { ...plan, household: { ...plan.household, people: [{ ...first!, longevity: { planningAge, source: 'model' } }, ...rest] } }
}

describe('AssumptionsCardPage and the questionnaire result saved in this browser', () => {
  it('reads the saved result again when the plan changes, and then cites the table it was computed on', () => {
    clearLongevity()
    const plan = withQuestionnaireAge(createSamplePlan(), 88)
    const name = plan.household.people[0]!.name
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root!.render(page(plan)))
    const personRow = () =>
      Array.from(container!.querySelectorAll('tr')).find((tr) => tr.textContent.includes(`${name}: retirement & planning age`))!

    // 1. Nothing saved: the questionnaire age names no table and cites none.
    expect(personRow().textContent).toContain('plan runs to age 88 (life-expectancy questionnaire estimate, table edition not recorded)')
    expect(personRow().querySelector('a')).toBeNull()

    // 2. The questionnaire completes with the card open: it saves a result on
    // the 2023 table whose planning age is the plan's, and writes the plan.
    saveLongevity({
      version: 1,
      updatedAt: '2026-09-28T12:00:00.000Z',
      answers: {
        age: 65, sex: 'male', bmiCategory: 'normal', smoking: 'never', alcohol: 'moderate', activity: 'moderate',
        diabetes: 'no', selfRatedHealth: 'good', parentalLongevity: 'unknown',
      },
      result: {
        tableEdition: { periodYear: 2023, trusteesReportYear: 2026 },
        baselineRemainingYears: 18.12, rawMultiplier: 1, appliedMultiplier: 1, centralRemainingYears: 18.12,
        bandLowRemainingYears: 16.3, bandHighRemainingYears: 19.6, illustrativePlanningAge: 88.2,
      },
    })
    act(() => root!.render(page(withQuestionnaireAge(plan, 88))))
    expect(personRow().textContent).toContain(
      'plan runs to age 88 (life-expectancy questionnaire estimate, SSA 2023 period life table, 2026 Trustees Report)',
    )
    expect(personRow().querySelector('a')!.getAttribute('href')).toBe('https://www.ssa.gov/oact/STATS/table4c6.html')

    // 3. Cleared with the card open: the next plan change reads it again.
    clearLongevity()
    act(() => root!.render(page(withQuestionnaireAge(plan, 88))))
    expect(personRow().textContent).toContain('table edition not recorded')
  })
})
