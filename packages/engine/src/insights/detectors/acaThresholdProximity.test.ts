import { describe, expect, it } from 'vitest'

import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { acaThresholdProximity } from './acaThresholdProximity.js'

function context(fplPct = 405): DetectorContext {
  const plan = singlePersonPlan()
  return {
    plan,
    params: { year: 2026, aca: { maxFplPctForCredit: 400 } },
    projection: {
      startYear: 2026,
      result: {
        years: [
          {
            year: 2027,
            aca: {
              householdMagi: 81_000,
              federalPovertyLine: 20_000,
              fplPct,
              cliffState: 'above-cliff',
            },
          },
        ],
      },
    },
  } as unknown as DetectorContext
}

describe('ACA threshold proximity detector', () => {
  it('flags the first Marketplace year just over the published FPL cliff', () => {
    const ctx = context()
    ctx.params.aca.maxFplPctForCredit = 350
    const card = acaThresholdProximity.screen(ctx)

    expect(card).toMatchObject({
      severity: 'info',
      confidence: 'medium',
      rationale: expect.stringContaining(
        'whether a credit is payable then depends on benchmark premiums versus the required contribution',
      ),
      impact: {
        qualitative: 'A small MAGI reduction may restore premium-tax-credit eligibility; the payable credit depends on benchmark premiums vs required contribution.',
      },
      evidence: [
        { label: 'Household MAGI in 2027', value: '$81,000', year: 2027 },
        { label: 'Federal poverty line in 2027', value: '$20,000', year: 2027 },
        { label: 'FPL percentage in 2027', value: '405.00%', year: 2027 },
        { label: 'ACA credit boundary', value: '400.00%' },
      ],
    })
  })

  it('stays silent just under the boundary', () => {
    const ctx = context(399.9)
    ctx.projection.result.years[0]!.aca = {
      ...ctx.projection.result.years[0]!.aca!,
      cliffState: 'below-cliff',
    }

    expect(acaThresholdProximity.screen(ctx)).toBeNull()
  })

  it('includes the upper end of the 25-point above-cliff band', () => {
    expect(acaThresholdProximity.screen(context(425))).not.toBeNull()
    expect(acaThresholdProximity.screen(context(425.1))).toBeNull()
  })

  it('shows a 400.01% result distinctly from the 400.00% credit boundary', () => {
    const card = acaThresholdProximity.screen(context(400.01))

    expect(card?.evidence).toContainEqual({ label: 'FPL percentage in 2027', value: '400.01%', year: 2027 })
    expect(card?.evidence).toContainEqual({ label: 'ACA credit boundary', value: '400.00%' })
  })

  it('flags an epsilon-published at-cliff result with its no-headroom impact and evidence', () => {
    const ctx = context(400.0000000001)
    ctx.projection.result.years[0]!.aca = {
      ...ctx.projection.result.years[0]!.aca!,
      cliffState: 'at-cliff',
      modeledAllowablePtc: 1_250,
    }

    expect(acaThresholdProximity.screen(ctx)).toMatchObject({
      severity: 'attention',
      rationale: expect.stringMatching(/exactly at the 400% FPL/i),
      impact: {
        qualitative: 'A small MAGI increase would eliminate the modeled premium tax credit; there is no headroom at the boundary.',
      },
      evidence: [
        { label: 'Household MAGI in 2027', value: '$81,000', year: 2027 },
        { label: 'Federal poverty line in 2027', value: '$20,000', year: 2027 },
        { label: 'FPL percentage in 2027', value: '400.00%', year: 2027 },
        { label: 'ACA credit boundary', value: '400.00%' },
        { label: 'Modeled premium tax credit at stake', value: '$1,250', year: 2027 },
      ],
    })
  })

  it('stays silent at the cliff when the model has no premium tax credit to lose', () => {
    const ctx = context(400.0000000001)
    ctx.projection.result.years[0]!.aca = {
      ...ctx.projection.result.years[0]!.aca!,
      cliffState: 'at-cliff',
      modeledAllowablePtc: 0,
    }

    expect(acaThresholdProximity.screen(ctx)).toBeNull()
  })

  it('stays silent at the cliff for a sub-dollar modeled premium tax credit', () => {
    const ctx = context(400.0000000001)
    ctx.projection.result.years[0]!.aca = {
      ...ctx.projection.result.years[0]!.aca!,
      cliffState: 'at-cliff',
      modeledAllowablePtc: 0.4,
    }

    expect(acaThresholdProximity.screen(ctx)).toBeNull()
  })

  it('flags at least one dollar of modeled premium tax credit at the cliff', () => {
    const ctx = context(400.0000000001)
    ctx.projection.result.years[0]!.aca = {
      ...ctx.projection.result.years[0]!.aca!,
      cliffState: 'at-cliff',
      modeledAllowablePtc: 1,
    }

    expect(acaThresholdProximity.screen(ctx)?.evidence).toContainEqual({
      label: 'Modeled premium tax credit at stake',
      value: '$1',
      year: 2027,
    })
  })
})
