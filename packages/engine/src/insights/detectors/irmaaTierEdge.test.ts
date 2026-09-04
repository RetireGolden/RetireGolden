import { describe, expect, it } from 'vitest'

import { irmaaTierThreshold, packForYear } from '../../params/index.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { irmaaTierEdge } from './irmaaTierEdge.js'

/**
 * Engine-local coverage for the IRMAA tier-edge detector.
 *
 * The card's own rationale states the condition it is testing: a nominal MAGI
 * "just over the [premium year] IRMAA tier threshold", where "just over" is the
 * detector's shipped $5,000 proximity window, and the premium year is the
 * two-year lookback (42 U.S.C. 1395r(i)(4)), so a MAGI in year Y prices
 * premiums in Y+2.
 *
 * The boundary itself is read from the parameter pack through the engine's own
 * `irmaaTierThreshold`, at the same premium year and inflation factor the
 * detector passes, rather than being copied as a literal. Both edges of the
 * window are fixtured: one dollar over the threshold, exactly $5,000 over, and
 * $5,001 over. The plan's inflation is zero, so the pack threshold and the
 * projected one coincide and the fixture stays about the window, not indexing.
 */
const START_YEAR = 2026
const MAGI_YEAR = 2026
const PREMIUM_YEAR = MAGI_YEAR + 2

const pack = packForYear(START_YEAR).pack
const tierOneThreshold = irmaaTierThreshold(pack, 0, 'single', {
  premiumYear: PREMIUM_YEAR,
  inflationFactorToYear: () => 1,
})

function year(
  y: number,
  over: Partial<{ magi: number; rothConversion: number; ages: number[] }> = {},
): unknown {
  const ages = over.ages ?? [70]
  return {
    year: y,
    magi: over.magi ?? 0,
    rothConversion: over.rothConversion ?? 0,
    people: ages.map((ageAttained, i) => ({ personId: `p${i + 1}`, alive: true, ageAttained })),
  }
}

function context(
  opts: { magi: number; rothConversion?: number; premiumYearAges?: number[]; omitPremiumYear?: boolean } = {
    magi: tierOneThreshold + 1,
  },
): DetectorContext {
  const plan = singlePersonPlan({ dob: '1956-01-01' })
  const years = [
    year(MAGI_YEAR, { magi: opts.magi, rothConversion: opts.rothConversion ?? 0 }),
    year(MAGI_YEAR + 1),
    ...(opts.omitPremiumYear === true ? [] : [year(PREMIUM_YEAR, { ages: opts.premiumYearAges ?? [72] })]),
  ]
  return {
    plan,
    params: pack,
    projection: { startYear: START_YEAR, result: { years } },
  } as unknown as DetectorContext
}

describe('irmaaTierEdge', () => {
  it('fires one dollar over the first IRMAA threshold and names both years', () => {
    const card = irmaaTierEdge.screen(context({ magi: tierOneThreshold + 1 }))
    expect(card?.id).toBe('irmaa-tier-edge')
    expect(card?.category).toBe('tax-brackets')
    expect(card?.severity).toBe('attention')
    expect(card?.confidence).toBe('high')
    expect(card?.learnSlug).toBe('irmaa-two-year-lookback')
    // The two-year lookback: the MAGI year drives the premium year.
    expect(card?.rationale).toContain(`in ${MAGI_YEAR}`)
    expect(card?.rationale).toContain(`in ${PREMIUM_YEAR}`)
    expect(card?.evidence).toContainEqual({
      label: 'Amount over threshold',
      value: '$1',
      year: MAGI_YEAR,
    })
    expect(card?.evidence.find((e) => e.label.startsWith('IRMAA tier threshold'))?.year).toBe(PREMIUM_YEAR)
  })

  it('holds the $5,000 proximity window on both sides', () => {
    expect(irmaaTierEdge.screen(context({ magi: tierOneThreshold + 5_000 }))?.id).toBe('irmaa-tier-edge')
    expect(irmaaTierEdge.screen(context({ magi: tierOneThreshold + 5_001 }))).toBeNull()
  })

  it('stays silent at and below the threshold, where no surcharge applies', () => {
    expect(irmaaTierEdge.screen(context({ magi: tierOneThreshold }))).toBeNull()
    expect(irmaaTierEdge.screen(context({ magi: 0 }))).toBeNull()
  })

  it('stays silent when the premium year is outside the projection', () => {
    // Without the Y+2 row there is nobody to price the surcharge for.
    expect(irmaaTierEdge.screen(context({ magi: tierOneThreshold + 1, omitPremiumYear: true }))).toBeNull()
  })

  it('stays silent when nobody is on Medicare in the premium year', () => {
    // IRMAA is a Part B/D surcharge; under 65 there is no premium to raise.
    expect(
      irmaaTierEdge.screen(context({ magi: tierOneThreshold + 1, premiumYearAges: [64] })),
    ).toBeNull()
    expect(
      irmaaTierEdge.screen(context({ magi: tierOneThreshold + 1, premiumYearAges: [65] }))?.id,
    ).toBe('irmaa-tier-edge')
  })

  it('offers a conversion trim only when a conversion is what pushed MAGI over', () => {
    // The trim has to be larger than the overage plus the detector's $250
    // cushion, so a conversion smaller than that cannot be the lever.
    const overage = 1_000
    const conversionDriven = irmaaTierEdge.screen(
      context({ magi: tierOneThreshold + overage, rothConversion: 100_000 }),
    )
    expect(conversionDriven?.action.kind).toBe('preview-scenario')
    if (conversionDriven?.action.kind !== 'preview-scenario') throw new Error('expected a preview')
    expect(conversionDriven.action.scenarioName).toBe('Trim conversion below IRMAA tier')
    const patch = conversionDriven.action.patch as {
      strategies: { rothConversion: { mode: string; conversions: Array<{ year: number; amount: number }> } }
    }
    expect(patch.strategies.rothConversion.mode).toBe('manual')
    // 100,000 conversion less the 1,000 overage and the 250 cushion.
    expect(patch.strategies.rothConversion.conversions).toEqual([{ year: MAGI_YEAR, amount: 98_750 }])

    const notConversionDriven = irmaaTierEdge.screen(
      context({ magi: tierOneThreshold + overage, rothConversion: 0 }),
    )
    expect(notConversionDriven?.action).toEqual({ kind: 'advisory' })
  })

  it('evaluate() refuses a plan with no tier-edge year', () => {
    expect(() => irmaaTierEdge.evaluate!(context({ magi: 0 }))).toThrow(/not eligible/i)
  })
})
