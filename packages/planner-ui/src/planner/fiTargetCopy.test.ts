import { describe, expect, it } from 'vitest'

import type { ProjectionSummary } from '@retiregolden/engine/projection/compare'
import type { RetirementYearRule } from '@retiregolden/engine/projection/householdRetirement'
import { createEmptyPlan } from '@retiregolden/engine/model/plan'

import { fiReachedPhrase, fiTargetBasisFacts, fiTargetBasisSentence } from './fiTargetCopy'

const plan = createEmptyPlan({ newId: () => 'id', now: () => new Date('2026-06-01T00:00:00Z') })
const summaryWith = (fiBasis: Pick<ProjectionSummary['fiBasis'], 'spendingYear' | 'spendingSource'>, lifetimeRothConversions = 50_000) =>
  fiTargetBasisFacts({ lifetimeRothConversions, fiBasis: { ...fiBasis, personId: plan.household.people[0]!.id, retirementYear: 2031, retirementRule: 'retirementAge', personLastYearAlive: 2060, notRetiring: [] } } as unknown as ProjectionSummary, plan)

describe('fiTargetBasisSentence', () => {
  const couple = (spendingYear: number, retirementYear: number) =>
    fiTargetBasisSentence({ spendingYear, spendingSource: 'projection', withdrawalRatePct: 4, personName: 'Taylor', retirementYear, retirementRule: 'retirementAge', personLastYearAlive: 2060, householdSize: 2, conversionExecuted: false, notRetiring: [] })

  it("names whose retirement a couple's FI target prices", () => {
    expect(couple(2031, 2031)).toBe(
      "The FI target is 2031's spending, tax and penalties (the year Taylor retires, the later of your two retirements), in today's dollars, divided by your 4% withdrawal rate.",
    )
    expect(couple(2026, 2024)).toContain("(the plan's first year: Taylor, the later of you to retire, reaches retirement age in 2024)")
    expect(couple(2026, 2080)).toContain("(the plan's first year: the plan ends before Taylor retires in 2080)")
  })

  it('says which rule gave the year when a person has no retirement age (review M4, N3)', () => {
    const facts = (retirementRule: RetirementYearRule, retirementYear: number, householdSize = 2) =>
      fiTargetBasisSentence({ spendingYear: Math.max(2026, retirementYear), spendingSource: 'projection', withdrawalRatePct: 4, personName: 'Sam', retirementYear, retirementRule, personLastYearAlive: 2059, householdSize, conversionExecuted: false, notRetiring: [] })
    expect(facts('wagesEnd', 2031)).toContain("(the first year without Sam's wages, since Sam has no retirement age, the later of your two retirements)")
    expect(facts('wagesEnd', 2031, 1)).toContain('(the first year without your wages, since you have no retirement age)')
    expect(facts('startYear', 2026)).toContain("(the plan's first year: Sam has no retirement age and no wages in the plan, and neither of you retires later)")
    // Wages paid past a retirement age (round-one review of #765, issues 1 and 3).
    expect(facts('wagesPastRetirementAge', 2046)).toContain("(the first year without Sam's wages, which continue past Sam's retirement age, the later of your two retirements)")
    expect(facts('wagesPastRetirementAge', 2046, 1)).toContain('(the first year without your wages, which continue past your retirement age)')
    expect(facts('wagesPastRetirementAge', 2020)).toContain("(the plan's first year: Sam's wages end in 2019, the later of your two retirements)")
  })

  it('names who works through the plan and prices the other person\'s retirement, or prices nothing (review N3)', () => {
    const base = { spendingSource: 'projection' as const, withdrawalRatePct: 4, householdSize: 2, conversionExecuted: false, personLastYearAlive: 2054 }
    const sam = { personName: 'Sam', rule: 'wagesEnd' as const, year: 2060, lastYearAlive: 2059 }
    expect(fiTargetBasisSentence({ ...base, spendingYear: 2034, personName: 'Alex', retirementYear: 2034, retirementRule: 'retirementAge', notRetiring: [sam] })).toBe(
      "The FI target is 2034's spending, tax and penalties (the year Alex retires; Sam works through the plan, so FI is priced on Alex's retirement), in today's dollars, divided by your 4% withdrawal rate.",
    )
    const nobody = { ...base, spendingSource: 'noRetirementInPlan' as const, spendingYear: null, personName: null, retirementYear: null, retirementRule: null, personLastYearAlive: null }
    expect(fiTargetBasisSentence({ ...nobody, notRetiring: [{ ...sam, personName: 'Alex', lastYearAlive: 2054, year: 2055 }, sam] })).toBe(
      'No FI target is priced: Alex works through the plan and Sam works through the plan, so neither of you retires in the plan and there is no retirement year to price.',
    )
    expect(fiTargetBasisSentence({ ...nobody, householdSize: 1, notRetiring: [{ ...sam, personName: 'Ann' }] })).toBe(
      'No FI target is priced: you work through the plan, so you do not retire in the plan and there is no retirement year to price.',
    )
    expect(fiTargetBasisSentence({ ...nobody, householdSize: 1, notRetiring: [{ personName: 'Bo', rule: 'retirementAge', year: 2055, lastYearAlive: 2050 }] })).toBe(
      'No FI target is priced: your retirement age comes after your planning age, so you do not retire in the plan and there is no retirement year to price.',
    )
  })

  it('names the person whose age FI is reached at, for a couple only', () => {
    const facts = { spendingYear: 2031, spendingSource: 'projection' as const, withdrawalRatePct: 4, personName: 'Taylor', retirementYear: 2031, retirementRule: 'retirementAge' as const, personLastYearAlive: 2060, householdSize: 2, conversionExecuted: false, notRetiring: [] }
    expect(fiReachedPhrase(2035, 72, facts)).toBe('2035, when Taylor is 72')
    expect(fiReachedPhrase(2035, 72, { ...facts, householdSize: 1 })).toBe('2035 (age 72)')
  })

  it('names the priced year and the withdrawal rate', () => {
    expect(fiTargetBasisSentence(summaryWith({ spendingYear: 2031, spendingSource: 'projection' }))).toBe(
      "The FI target is 2031's spending, tax and penalties (the year you retire), in today's dollars, divided by your 4% withdrawal rate.",
    )
  })

  it('says a converting plan is priced as if the household had not converted', () => {
    expect(
      fiTargetBasisSentence(summaryWith({ spendingYear: 2028, spendingSource: 'conversionFreeProjection' })),
    ).toContain("Your plan converts to Roth, and a conversion's tax, with what it costs in later years such as a higher Medicare premium, is paid once, so 2028 is priced as if you had not converted.")
  })

  it('never says a plan converts when every conversion request was refused and nothing converted (review N2)', () => {
    for (const spendingSource of ['conversionFreeProjection', 'conversionTaxIncluded'] as const) {
      const sentence = fiTargetBasisSentence(summaryWith({ spendingYear: 2026, spendingSource }, 0))
      expect(sentence).toContain('Your plan asks to convert to Roth, but no conversion goes through, so there is no conversion tax in 2026 to leave out.')
      expect(sentence).not.toContain('converts to Roth,')
      expect(sentence).not.toContain('It includes what your Roth conversions cost')
    }
  })

  it('says when the conversion tax is in the base', () => {
    expect(
      fiTargetBasisSentence(summaryWith({ spendingYear: 2028, spendingSource: 'conversionTaxIncluded' })),
    ).toContain('It includes what your Roth conversions cost in 2028.')
  })

  it('names base spending for an empty projection', () => {
    expect(fiTargetBasisSentence(summaryWith({ spendingYear: null, spendingSource: 'baseAnnual' }))).toBe(
      'The FI target is your base annual spending divided by your 4% withdrawal rate.',
    )
  })
})
