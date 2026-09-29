/**
 * The words every page uses for projected parameter years (decision
 * D-2027-ROLLOVER, 2026-09-28): which figures a year projects, from which
 * publication, at the plan's inflation. The facts are the engine's
 * (`@retiregolden/engine/params` components); this pins the wording and that
 * a 2026 start marks 2027 on, and a 2027 start marks its first year.
 */
import { describe, expect, it } from 'vitest'

import {
  isParameterYearProjected,
  parameterFiguresCsvValue,
  projectedComponentsIn,
  projectedParametersFrom,
  projectedParametersSentence,
  statuteIndexedStateDeductions,
} from './projectedParameters'

describe('projected parameter years', () => {
  const plan = { inflationPct: 2.5, healthcareExtraInflationPct: 3 }

  it('2026 is published throughout; 2027 projects four publishers from 2026, and HSA limits from 2028', () => {
    expect(isParameterYearProjected(2026)).toBe(false)
    expect(isParameterYearProjected(2027)).toBe(true)
    // The IRS published the 2027 HSA limits in May 2026 (Rev. Proc. 2026-24),
    // and they are loaded (hsaLimitYears.ts), so 2027 does not project them.
    expect(projectedComponentsIn(2027).map((component) => [component.label, component.fromYear])).toEqual([
      ['tax brackets', 2026],
      ['retirement-plan limits (with the QCD limit)', 2026],
      ['Social Security figures', 2026],
      ['Medicare premiums', 2026],
    ])
    expect(projectedComponentsIn(2028).map((component) => [component.label, component.fromYear])).toContainEqual(['HSA limits', 2027])
  })

  it('says so, from the first projected year, with Medicare at healthcare inflation and the state figures held (review M1, M3)', () => {
    const sentence =
      'From 2027, tax brackets, retirement-plan limits (with the QCD limit), Social Security figures, and Medicare premiums ' +
      'are projected from their 2026 figures; from 2028, HSA limits are projected from their 2027 figures. ' +
      "Until RetireGolden loads each agency's own figures, they grow at this plan's 2.5% inflation assumption, " +
      'and Medicare premiums at its 5.5% healthcare inflation (its inflation plus its healthcare premium); ' +
      "the agencies' figures will differ. " +
      "State income tax uses each state's enacted schedules where RetireGolden has loaded them, and otherwise the " +
      "state's 2026 figures held without growth, except the standard deduction: one that follows the federal " +
      "deduction moves with it, and the District of Columbia's from 2027 and Washington's from 2029, which their " +
      "own statutes index to inflation, grow at this plan's 2.5% inflation assumption."
    expect(projectedParametersSentence(2026, plan)).toBe(sentence)
    // A plan that starts in 2027 projects from its first year.
    expect(projectedParametersSentence(2027, plan)).toBe(sentence)
    expect(projectedParametersSentence(2026, { inflationPct: 4, healthcareExtraInflationPct: 1 })).toContain(
      "at this plan's 4% inflation assumption, and Medicare premiums at its 5% healthcare inflation",
    )
    expect(projectedParametersSentence(2026, { inflationPct: 4, healthcareExtraInflationPct: 1 })).toContain(
      "grow at this plan's 4% inflation assumption.",
    )
    expect(projectedParametersSentence(2026, plan)).not.toContain('publishes')
    // From 2030 the District's deduction is the federal one (D.C. Act 26-416),
    // so a plan that starts then names only Washington's statute.
    expect(projectedParametersSentence(2030, plan)).toContain(
      "moves with it, and Washington's from 2030, which its statute indexes to inflation, grows at this plan's 2.5% inflation assumption.",
    )
  })

  it('names every state whose own statute indexes its deduction, from its first indexed year (V2)', () => {
    expect(statuteIndexedStateDeductions(2026, 2038)).toEqual([
      { code: 'DC', name: 'the District of Columbia', fromYear: 2027 },
      { code: 'WA', name: 'Washington', fromYear: 2029 },
    ])
    expect(statuteIndexedStateDeductions(2027, 2028).map((state) => state.code)).toEqual(['DC'])
    expect(statuteIndexedStateDeductions(2030, 2042).map((state) => state.code)).toEqual(['WA'])
    // The sentence gives each a name, not its code.
    for (const state of statuteIndexedStateDeductions(2026, 2080)) expect(state.name).not.toBe(state.code)
  })

  it('marks each CSV year, with no comma, and says the state figures from 2027', () => {
    const held = 'state enacted where loaded else 2026 held; federal-following state deductions move with federal'
    expect(parameterFiguresCsvValue(2026)).toBe('published')
    expect(parameterFiguresCsvValue(2027)).toBe(`federal projected from 2026; ${held}; DC deduction statute-indexed at plan inflation`)
    expect(parameterFiguresCsvValue(2028)).toBe(`federal projected from 2026 and 2027; ${held}; DC deduction statute-indexed at plan inflation`)
    expect(parameterFiguresCsvValue(2029)).toContain(`${held}; DC and WA deductions statute-indexed at plan inflation`)
    expect(parameterFiguresCsvValue(2030)).toContain(`${held}; WA deduction statute-indexed at plan inflation`)
    for (const year of [2026, 2027, 2028, 2029, 2030, 2040]) expect(parameterFiguresCsvValue(year)).not.toContain(',')
  })

  it('lists them as data for the assumptions export', () => {
    expect(projectedParametersFrom(2026).map(({ fromYear, figures, projectedFrom }) => ({ fromYear, figures, projectedFrom }))).toEqual([
      { fromYear: 2027, figures: 'tax brackets', projectedFrom: 2026 },
      { fromYear: 2027, figures: 'retirement-plan limits (with the QCD limit)', projectedFrom: 2026 },
      { fromYear: 2027, figures: 'Social Security figures', projectedFrom: 2026 },
      { fromYear: 2027, figures: 'Medicare premiums', projectedFrom: 2026 },
      { fromYear: 2028, figures: 'HSA limits', projectedFrom: 2027 },
    ])
  })
})
