/**
 * One rule for the household's later retirement on every surface (the
 * independent review's M4 and N3), on the reviewer's cases.
 *
 * - Two ways of writing the same household give the same figures: a person
 *   with no retirement age whose wages end at an age retires in the first year
 *   without them, exactly as a retirement age at that age does. Measured at
 *   the review: aggressive-saver $2,660,002 against $1,514,785, example-couple
 *   $3,572,657 against $3,377,120, the no-retirement-age side priced in a year
 *   still paid wages.
 * - A person who works until death never retires in the plan: example-couple
 *   with Sam's retirement age cleared (Sam's wages run to 2059) is priced on
 *   Alex's 2028 retirement, and every surface says Sam works through the plan;
 *   aggressive-saver with no retirement age prices no FI figure at all (the
 *   review measured $38,930,249, priced in the death year).
 */
import { describe, expect, it } from 'vitest'

import { detectorProjection } from '@retiregolden/engine/insights/detectorProjection'
import { runScreen } from '@retiregolden/engine/insights/runInsights'
import { fundedRatioStart } from '@retiregolden/engine/ladder/fundedRatio'
import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { packForYear } from '@retiregolden/engine/params'

import { projectPlan } from '../projection'
import { appExamplePlanById } from '../testSupport/appExamples'
import { EXAMPLE_FIXED_YEAR } from './examples/buildContext'
import { coastFireHorizonYear, fiTargetBasisFacts, fiTargetBasisSentence } from './fiTargetCopy'

function variant(id: string, change: (plan: Plan) => void): Plan {
  const doc = structuredClone(appExamplePlanById(id))
  change(doc)
  const parsed = parsePlan(doc)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

const wagesEndAt = (plan: Plan, personId: string, endAge: number | null) => {
  for (const income of plan.incomes) if (income.type === 'wages' && income.personId === personId) income.endAge = endAge
}

function figures(plan: Plan) {
  const view = projectPlan(plan, EXAMPLE_FIXED_YEAR)
  const s = view.summary
  return {
    ledger: JSON.stringify(view.result.years.map((y) => [y.year, y.incomes.total, y.tax, y.investableTotal])),
    fi: [s.fiNumber, s.fiYear, s.fiAge, s.coastFireNumber, s.averagePreRetirementSavingsRatePct, s.fiBasis.spendingYear],
  }
}

describe('one household retirement rule on every surface (review M4, N3)', () => {
  it('gives two ways of writing the same one-person household the same FI figures (aggressive-saver)', () => {
    const noAge = variant('aggressive-saver', (plan) => {
      const person = plan.household.people[0]!
      person.retirementAge = null
      wagesEndAt(plan, person.id, 45)
    })
    const age = variant('aggressive-saver', (plan) => { plan.household.people[0]!.retirementAge = 45 })
    const [a, b] = [figures(noAge), figures(age)]
    expect(a.ledger).toBe(b.ledger)
    expect(a.fi).toEqual(b.fi)
    expect(Math.round(b.fi[0]!)).toBe(1_514_785)
  })

  it('gives two ways of writing the same couple the same FI figures (example-couple)', () => {
    const noAge = variant('example-couple', (plan) => {
      const sam = plan.household.people.find((p) => p.name === 'Sam')!
      sam.retirementAge = null
      wagesEndAt(plan, sam.id, 67)
    })
    const age = variant('example-couple', (plan) => { plan.household.people.find((p) => p.name === 'Sam')!.retirementAge = 67 })
    const [a, b] = [figures(noAge), figures(age)]
    expect(a.ledger).toBe(b.ledger)
    expect(a.fi).toEqual(b.fi)
    expect(Math.round(b.fi[0]!)).toBe(3_377_120)
  })

  it('prices no FI figure for a person who works until death, and says so', () => {
    const plan = variant('aggressive-saver', (doc) => { doc.household.people[0]!.retirementAge = null })
    const view = projectPlan(plan, EXAMPLE_FIXED_YEAR)
    expect([view.summary.fiNumber, view.summary.fiYear, view.summary.fiAge, view.summary.coastFireNumber]).toEqual([null, null, null, null])
    const facts = fiTargetBasisFacts(view.summary, plan)
    expect(fiTargetBasisSentence(facts)).toBe(
      'No FI target is priced: you work through the plan, so you do not retire in the plan and there is no retirement year to price.',
    )
    expect(coastFireHorizonYear(facts)).toBeNull()
    expect(fundedRatioStart(plan, view.startYear).fromYear).toBeNull()
  })

  it('prices a couple on the other person\'s retirement when one works through the plan, on FI, the funded ratio and its insight', () => {
    const plan = variant('example-couple', (doc) => {
      doc.household.people.find((p) => p.name === 'Sam')!.retirementAge = null
      doc.expenses.requiredAnnual = 60_000
    })
    const view = projectPlan(plan, EXAMPLE_FIXED_YEAR)
    const [alex, sam] = [plan.household.people.find((p) => p.name === 'Alex')!, plan.household.people.find((p) => p.name === 'Sam')!]
    expect(view.summary.fiBasis).toMatchObject({ personId: alex.id, retirementYear: 2028, retirementRule: 'retirementAge', spendingYear: 2028 })
    expect(view.summary.fiBasis.notRetiring.map((p) => p.personId)).toEqual([sam.id])
    expect(fiTargetBasisSentence(fiTargetBasisFacts(view.summary, plan)))
      .toContain("(the year Alex retires; Sam works through the plan, so FI is priced on Alex's retirement)")

    const start = fundedRatioStart(plan, view.startYear)
    expect([start.personId, start.retirementYear, start.rule, start.fromYear]).toEqual([alex.id, 2028, 'retirementAge', 2028])

    const cards = runScreen({ plan, projection: detectorProjection(view.result, view.summary), params: packForYear(view.startYear).pack })
    const funded = cards.find((card) => card.id === 'income-floor-funded')
    expect(funded?.rationale).toContain("Counted from 2028: the year Alex retires; Sam works through the plan, so the count starts at Alex's retirement.")
  })
})
