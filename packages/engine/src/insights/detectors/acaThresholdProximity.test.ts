import { describe, expect, it } from 'vitest'

import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { acaThresholdProximity } from './acaThresholdProximity.js'

function context(fplPct = 405): DetectorContext {
  const plan = singlePersonPlan()
  return {
    plan,
    params: { year: 2026 },
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
    const card = acaThresholdProximity.screen(ctx)

    expect(card).toMatchObject({
      severity: 'info',
      confidence: 'medium',
      rationale: expect.stringMatching(
        /can restore credit eligibility \(subject to the credit's other conditions\); whether a credit is payable then depends on benchmark premiums versus the required contribution/,
      ),
      impact: {
        qualitative: 'A small MAGI reduction may restore premium-tax-credit eligibility; the payable credit depends on benchmark premiums vs required contribution.',
      },
      evidence: [
        { label: 'Household MAGI in 2027', value: '$81,000', year: 2027 },
        { label: 'Federal poverty line in 2027', value: '$20,000', year: 2027 },
        { label: 'FPL percentage in 2027', value: '405.00%', year: 2027 },
        { label: 'ACA credit boundary', value: '400.00%', year: 2027 },
        { label: 'FPL overage above credit boundary in 2027', value: '5.0 percentage points', year: 2027 },
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

  it('shows a 400.01% result with two-decimal main figures and an overage delta', () => {
    const card = acaThresholdProximity.screen(context(400.01))

    expect(card?.evidence).toContainEqual({ label: 'FPL percentage in 2027', value: '400.01%', year: 2027 })
    expect(card?.evidence).toContainEqual({ label: 'ACA credit boundary', value: '400.00%', year: 2027 })
    expect(card?.evidence).toContainEqual({
      label: 'FPL overage above credit boundary in 2027',
      value: '0.010 percentage points',
      year: 2027,
    })
  })

  it('keeps two-decimal FPL figures when 400.001% rounds to 400.00% and carries the overage in a delta entry', () => {
    // Two-decimal renderings of 400.001 and 400 both read "400.00%"; the overage
    // delta keeps the positive gap visible without extending main figures.
    const card = acaThresholdProximity.screen(context(400.001))

    expect(card?.evidence).toContainEqual({ label: 'FPL percentage in 2027', value: '400.00%', year: 2027 })
    expect(card?.evidence).toContainEqual({ label: 'ACA credit boundary', value: '400.00%', year: 2027 })
    expect(card?.evidence).toContainEqual({
      label: 'FPL overage above credit boundary in 2027',
      value: '0.0010 percentage points',
      year: 2027,
    })
  })

  it('surfaces a sub-0.00005 FPL overage as a nonzero plain-decimal delta entry', () => {
    // 0.00004 rounds to 0.00 at two decimals; significant-digit formatting still
    // shows a positive gap without scientific notation.
    const card = acaThresholdProximity.screen(context(400.00004))

    expect(card?.evidence).toContainEqual({ label: 'FPL percentage in 2027', value: '400.00%', year: 2027 })
    expect(card?.evidence).toContainEqual({ label: 'ACA credit boundary', value: '400.00%', year: 2027 })
    expect(card?.evidence).toContainEqual({
      label: 'FPL overage above credit boundary in 2027',
      value: '0.000040 percentage points',
      year: 2027,
    })
    // Reject scientific notation (e.g. 4.0e-5), not the letter "e" in "percentage".
    expect(card?.evidence.find((e) => e.label.startsWith('FPL overage'))?.value).not.toMatch(/\d[eE][+-]?\d/)
  })

  it('surfaces a 1e-7-scale FPL overage without scientific notation', () => {
    // toPrecision(2) would emit "1.0e-7"; plain-decimal expansion must stay
    // human-readable and never round a positive delta to zero.
    const card = acaThresholdProximity.screen(context(400.0000001))

    expect(card?.evidence).toContainEqual({
      label: 'FPL overage above credit boundary in 2027',
      value: '0.00000010 percentage points',
      year: 2027,
    })
    expect(card?.evidence.find((e) => e.label.startsWith('FPL overage'))?.value).not.toMatch(/\d[eE][+-]?\d/)
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
        { label: 'ACA credit boundary', value: '400.00%', year: 2027 },
        { label: 'Modeled premium tax credit at stake', value: '$1,250', year: 2027 },
      ],
    })
  })

  it('formats non-integral published dollar amounts with cents', () => {
    // Math.round drops $1.49 → $1; keep cents for any non-integral amount.
    const ctx = context(405)
    ctx.projection.result.years[0]!.aca = {
      ...ctx.projection.result.years[0]!.aca!,
      householdMagi: 81_000.49,
      federalPovertyLine: 20_000.5,
      cliffState: 'at-cliff',
      modeledAllowablePtc: 1.49,
    }

    expect(acaThresholdProximity.screen(ctx)?.evidence).toEqual(
      expect.arrayContaining([
        { label: 'Household MAGI in 2027', value: '$81,000.49', year: 2027 },
        { label: 'Federal poverty line in 2027', value: '$20,000.50', year: 2027 },
        { label: 'Modeled premium tax credit at stake', value: '$1.49', year: 2027 },
      ]),
    )
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
