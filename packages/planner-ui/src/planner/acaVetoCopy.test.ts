/**
 * Wording guarantees for the shared ACA-actionability-veto copy: year lists
 * merge and read naturally, the parameter-gap cause is named when the codes
 * say so, and the positive-row caveat only appears when a row was actually
 * blocked (no scary caveat on fallbacks with nothing positive to explain).
 */
import { describe, expect, it } from 'vitest'

import type { AcaActionabilityVeto } from '@retiregolden/engine/projection/optimizePlan'
import {
  acaVetoExplanation,
  acaVetoYears,
  diagnosticsWithoutUnpricedCreditSentence,
  formatYearRuns,
  unpricedCreditSpendingNote,
  type UnpricedCreditFacts,
} from './acaVetoCopy'

function veto(overrides: Partial<AcaActionabilityVeto> = {}): AcaActionabilityVeto {
  return {
    baselineNonActionableYears: [2027, 2028],
    candidateNonActionableYears: [],
    supportCodes: ['tax-year-parameters-unsupported'],
    vetoedCandidateIds: ['bracket-10'],
    vetoedMilp: false,
    ...overrides,
  }
}

describe('acaVetoYears', () => {
  it('merges baseline and candidate-only years, deduplicated and ascending', () => {
    expect(
      acaVetoYears(veto({ baselineNonActionableYears: [2028, 2027], candidateNonActionableYears: [2029, 2027] })),
    ).toEqual([2027, 2028, 2029])
  })
})

describe('acaVetoExplanation', () => {
  it('names the missing-parameters cause and the blocked row caveat', () => {
    const text = acaVetoExplanation(veto())
    expect(text).toContain('marketplace (ACA) coverage in 2027 and 2028')
    expect(text).toContain("RetireGolden doesn't have the credit's figures for those years yet")
    expect(text).toContain('no conversion schedule is presented as actionable')
    expect(text).toContain('leave the unpriced ACA effect out')
  })

  it('uses singular phrasing for one year and a generic cause for other codes', () => {
    const text = acaVetoExplanation(
      veto({
        baselineNonActionableYears: [2026],
        supportCodes: ['other-material-facts-unsupported'],
        vetoedCandidateIds: [],
      }),
    )
    expect(text).toContain('evidence for 2026 could not be priced as actionable')
    expect(text).toContain('cannot measure that change in that year')
    expect(text).toContain('while it stays unpriced')
    // Nothing improving was blocked, so no caveat about blocked rows.
    expect(text).not.toContain('blocked candidate row')
  })

  it('falls back to the generic cause when codes are mixed across years', () => {
    // 2026 is non-actionable for unknown tax-exempt interest; only 2027 waits
    // on parameters — claiming both years wait on parameters would be false.
    const text = acaVetoExplanation(
      veto({
        baselineNonActionableYears: [2026, 2027],
        supportCodes: ['other-material-facts-unsupported', 'tax-year-parameters-unsupported'],
      }),
    )
    expect(text).toContain('The marketplace (ACA) evidence for 2026 and 2027 could not be priced as actionable')
    expect(text).not.toContain("doesn't have the credit's figures")
  })

  it('lists three or more years with commas', () => {
    const text = acaVetoExplanation(veto({ baselineNonActionableYears: [2026, 2027, 2028] }))
    expect(text).toContain('2026, 2027, and 2028')
  })
})

describe('formatYearRuns', () => {
  it('collapses runs of three or more and lists the rest', () => {
    expect(formatYearRuns([2027])).toBe('2027')
    expect(formatYearRuns([2028, 2027])).toBe('2027 and 2028')
    expect(formatYearRuns([2027, 2028, 2029, 2030])).toBe('2027 to 2030')
    expect(formatYearRuns([2026, 2027, 2028, 2030])).toBe('2026 to 2028 and 2030')
    expect(formatYearRuns([2026, 2027, 2029])).toBe('2026, 2027, and 2029')
  })
})

describe('unpricedCreditSpendingNote', () => {
  function facts(
    years: number[],
    reasons: UnpricedCreditFacts['acaGrossPremiumReasons'],
    direction: UnpricedCreditFacts['acaGrossPremiumDirection'] = 'conservative',
  ): UnpricedCreditFacts {
    return { acaGrossPremiumYears: years, acaGrossPremiumReasons: reasons, acaGrossPremiumDirection: direction }
  }
  const fixedTail =
    'The projection pays the full Marketplace premium in those years; if you receive a credit then, you would likely be able to spend somewhat more than this.'

  it('is null when every Marketplace year is priced', () => {
    expect(unpricedCreditSpendingNote(facts([], [], null), true)).toBeNull()
  })

  it('names one reason for every year when there is only one', () => {
    expect(unpricedCreditSpendingNote(facts([2027, 2028, 2029], ['tax-year-parameters-unsupported']), true)).toBe(
      "The premium tax credit isn't counted in 2027 to 2029: RetireGolden doesn't have the credit's figures for those years yet. " +
        fixedTail,
    )
  })

  it('names every reason for a single year, which has them all', () => {
    expect(
      unpricedCreditSpendingNote(facts([2027], ['missing-year-contract', 'tax-year-parameters-unsupported']), true),
    ).toBe(
      "The premium tax credit isn't counted in 2027: the planner doesn't yet collect the household details the credit needs and " +
        "RetireGolden doesn't have the credit's figures for that year yet. " +
        'The projection pays the full Marketplace premium in that year; if you receive a credit then, you would likely be able to spend somewhat more than this.',
    )
  })

  it('does not pin every merged reason on every year, and states the below-poverty-line case as current law has it', () => {
    // 2026 is below the poverty line; 2027 and 2028 wait on parameters.
    const text = unpricedCreditSpendingNote(
      facts([2026, 2027, 2028], ['below-100-fpl-exception-unsupported', 'tax-year-parameters-unsupported']),
      true,
    )
    expect(text).toBe(
      "The premium tax credit isn't counted in 2026 to 2028. In each of those years, at least one of these applies: " +
        'income is below the poverty line, where there is generally no credit and Medicaid may apply; ' +
        "RetireGolden doesn't have the credit's figures for those years yet. " +
        fixedTail,
    )
  })

  it('says an edited example no longer matches its stated credit figures', () => {
    expect(unpricedCreditSpendingNote(facts([2026], ['example-contract-input-mismatch']), true)).toContain(
      "isn't counted in 2026: the example's inputs were edited, so its stated credit figures no longer apply.",
    )
  })

  it('ignores informational codes and gives the generic reason for an unmapped one', () => {
    expect(
      unpricedCreditSpendingNote(facts([2027, 2028], ['tax-exempt-interest-plan-derived', 'fixed-point-nonconvergent']), true),
    ).toBe("The premium tax credit isn't counted in 2027 and 2028: some facts the credit needs are missing. " + fixedTail)
  })

  it('says a credit could move a guardrail answer either way', () => {
    expect(unpricedCreditSpendingNote(facts([2027, 2028], ['guardrail-interaction-unsupported'], 'uncertain'), true)).toBe(
      "The premium tax credit isn't counted in 2027 and 2028: the credit isn't modeled together with guardrail spending. " +
        'The projection pays the full Marketplace premium in those years; a credit then could move this answer up or down, ' +
        'because your spending guardrails respond to what healthcare costs.',
    )
  })

  it('never calls a missing answer conservative', () => {
    expect(unpricedCreditSpendingNote(facts([2027], ['tax-year-parameters-unsupported']), false)).toMatch(
      /in that year; a credit then would lower that cost\.$/,
    )
    expect(unpricedCreditSpendingNote(facts([2027], ['tax-year-parameters-unsupported'], 'uncertain'), false)).toMatch(
      /in that year; a credit then could change this result, because your spending guardrails respond to what healthcare costs\.$/,
    )
  })
})

describe('diagnosticsWithoutUnpricedCreditSentence', () => {
  const engineSentence =
    'The ACA premium tax credit is not priced in 2027 (tax-year-parameters-unsupported); the ledger budgets the full Marketplace premium in those years, and a credit there would lower that cost.'

  it('drops the engine sentence by its content, wherever it sits', () => {
    expect(diagnosticsWithoutUnpricedCreditSentence(['Stopped early.', engineSentence])).toEqual(['Stopped early.'])
    expect(diagnosticsWithoutUnpricedCreditSentence([engineSentence, 'Stopped early.'])).toEqual(['Stopped early.'])
  })

  it('keeps a last diagnostic that is something else', () => {
    expect(
      diagnosticsWithoutUnpricedCreditSentence(['Even zero base spending depletes the portfolio before the plan ends.']),
    ).toEqual(['Even zero base spending depletes the portfolio before the plan ends.'])
  })
})
