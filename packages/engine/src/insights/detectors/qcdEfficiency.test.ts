import { describe, expect, it } from 'vitest'

import { candidateFromInsight } from '../../decisions/insightsAdapter.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import {
  QCD_EFFICIENCY_EXPLORATORY_REASON,
  qcdEfficiency,
} from './qcdEfficiency.js'

function context(): DetectorContext {
  const plan = singlePersonPlan({ dob: '2000-01-01' })
  plan.strategies.itemizedDeductions = {
    stateAndLocalTaxes: 0,
    mortgageInterest: 0,
    charitable: 2_500,
  }
  return {
    plan,
    projection: {
      result: {
        startYear: 2026,
        endYear: 2026,
        years: [{ year: 2026, people: [], balances: {} }],
      },
    },
  } as unknown as DetectorContext
}

describe('QCD efficiency detector source integrity', () => {
  it('keeps the aggregate comparison explicitly exploratory without inferring age or source', () => {
    const ctx = context()
    const card = qcdEfficiency.screen(ctx)

    expect(card).not.toBeNull()
    expect(card?.rationale).toMatch(/cannot call the transfer implementation-ready/i)
    expect(card?.rationale).not.toMatch(/you are over/i)
    expect(card?.confidence).toBe('medium')
    expect(card?.action).toMatchObject({
      kind: 'preview-scenario',
      patch: { strategies: { qcdAnnual: 2_500 } },
      retirementActionReadiness: {
        state: 'exploratoryNonActionable',
        reason: QCD_EFFICIENCY_EXPLORATORY_REASON,
      },
      candidateMetadata: {
        qcdAnnualTargets: [{ year: 2026, requestedAmount: 250_000 }],
      },
    })
    const candidate = candidateFromInsight(card!, card!.action)
    expect(candidate?.retirementActionReadiness).toEqual({
      state: 'exploratoryNonActionable',
      reason: QCD_EFFICIENCY_EXPLORATORY_REASON,
    })
    expect(candidate?.metadata).toEqual({
      qcdAnnualTargets: [{ year: 2026, requestedAmount: 250_000 }],
    })
  })

  it('does not emit a card without a positive charitable target or projection year', () => {
    const ctx = context()
    ctx.plan.strategies.itemizedDeductions!.charitable = 0
    expect(qcdEfficiency.screen(ctx)).toBeNull()

    const noYear = context()
    noYear.projection.result.years = []
    expect(qcdEfficiency.screen(noYear)).toBeNull()
  })
})
