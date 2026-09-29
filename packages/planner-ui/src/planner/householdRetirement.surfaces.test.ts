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
 * - Wages paid past a retirement age keep the person working (round-one review
 *   of #765, issues 1 and 3): aggressive-saver's Taylor, retiring at 45 (2041)
 *   with wages to age 50, is paid through 2045, and FI, Coast-FIRE, the
 *   savings-rate window and the funded ratio all start in 2046, exactly as a
 *   retirement age of 50 gives; wages that stop at 42 leave the retirement
 *   age's 2041.
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

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/** Every surface's year on one plan: the FI basis, Coast-FIRE's horizon, the savings-rate window, the funded ratio. */
function surfaces(plan: Plan) {
  const view = projectPlan(plan, EXAMPLE_FIXED_YEAR)
  const s = view.summary
  const facts = fiTargetBasisFacts(s, plan)
  const start = fundedRatioStart(plan, view.startYear)
  const wageYears = view.result.years.filter((y) => y.incomes.wages > 0).map((y) => y.year)
  return {
    view,
    facts,
    lastWageYear: wageYears[wageYears.length - 1],
    fi: [s.fiBasis.retirementYear, s.fiBasis.retirementRule, s.fiBasis.spendingYear],
    coastFireHorizon: coastFireHorizonYear(facts),
    funded: [start.retirementYear, start.rule, start.fromYear],
    // The savings-rate average is the mean of the published rates before the retirement year.
    savingsWindow: (year: number) => [s.averagePreRetirementSavingsRatePct, mean(s.savingsRates.filter((r) => r.year < year).map((r) => r.ratePct))],
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

  it('starts every surface in the first year without wages paid past a retirement age (review of #765, issues 1 and 3)', () => {
    const taylorWagesTo = (endAge: number, retirementAge = 45) => variant('aggressive-saver', (plan) => {
      const person = plan.household.people[0]!
      person.retirementAge = retirementAge
      wagesEndAt(plan, person.id, endAge)
    })
    const past = surfaces(taylorWagesTo(50))
    // The ledger pays Taylor's wages through 2045, past the retirement age's 2041.
    expect(past.lastWageYear).toBe(2045)
    expect(past.fi).toEqual([2046, 'wagesPastRetirementAge', 2046])
    expect(past.coastFireHorizon).toBe(2046)
    expect(past.funded).toEqual([2046, 'wagesPastRetirementAge', 2046])
    const [average, window] = past.savingsWindow(2046)
    expect(average).toBeCloseTo(window!, 10)
    expect(fiTargetBasisSentence(past.facts)).toContain(
      "The FI target is 2046's spending, tax and penalties (the first year without your wages, which continue past your retirement age)",
    )
    // The same household written with a retirement age of 50 pays the same
    // wages and gets the same FI figures, Coast-FIRE and savings rate.
    const at50 = taylorWagesTo(50, 50)
    expect(figures(taylorWagesTo(50)).ledger).toBe(figures(at50).ledger)
    expect(figures(taylorWagesTo(50)).fi).toEqual(figures(at50).fi)
    expect(surfaces(at50).funded).toEqual([2046, 'retirementAge', 2046])
  })

  it('keeps the retirement age when wages stop before it (review of #765, issues 1 and 3)', () => {
    const early = surfaces(variant('aggressive-saver', (plan) => wagesEndAt(plan, plan.household.people[0]!.id, 42)))
    expect(early.lastWageYear).toBe(2037)
    expect(early.fi).toEqual([2041, 'retirementAge', 2041])
    expect(early.coastFireHorizon).toBe(2041)
    expect(early.funded).toEqual([2041, 'retirementAge', 2041])
    const [average, window] = early.savingsWindow(2041)
    expect(average).toBeCloseTo(window!, 10)
    expect(fiTargetBasisSentence(early.facts)).toContain("The FI target is 2041's spending, tax and penalties (the year you retire)")
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
