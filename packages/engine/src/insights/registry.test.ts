import { describe, expect, it } from 'vitest'
import type { Detector, DetectorContext, InsightCard } from './types.js'
import { computeCardScore, registry, sortCards } from './registry.js'
import { runScreen } from './runInsights.js'

describe('detector framework scoring and ranking', () => {
  it('correctly scores cards based on impact magnitude and confidence weight', () => {
    const cardA: InsightCard = {
      id: 'card-a',
      category: 'tax-brackets',
      title: 'Card A',
      rationale: '',
      impact: { endingAfterTaxEstateDelta: 10000 },
      exact: false,
      confidence: 'high',
      action: { kind: 'advisory' },
    }
    const cardB: InsightCard = {
      id: 'card-b',
      category: 'tax-brackets',
      title: 'Card B',
      rationale: '',
      impact: { endingAfterTaxEstateDelta: 20000 },
      exact: false,
      confidence: 'medium', // 20000 * 0.7 = 14000
      action: { kind: 'advisory' },
    }
    const cardC: InsightCard = {
      id: 'card-c',
      category: 'tax-brackets',
      title: 'Card C',
      rationale: '',
      impact: { qualitative: 'Some qualitative info' },
      exact: false,
      confidence: 'low', // purely qualitative => -1
      action: { kind: 'advisory' },
    }

    expect(computeCardScore(cardA)).toBe(10000)
    expect(computeCardScore(cardB)).toBe(14000)
    expect(computeCardScore(cardC)).toBe(-1)

    const sorted = sortCards([cardA, cardB, cardC])
    expect(sorted[0]!.id).toBe('card-b')
    expect(sorted[1]!.id).toBe('card-a')
    expect(sorted[2]!.id).toBe('card-c')
  })

  it('scores success-rate impacts by magnitude', () => {
    const card: InsightCard = {
      id: 'success-risk',
      category: 'sequence-risk',
      title: 'Success risk',
      rationale: '',
      impact: { successRateDeltaPct: -5 },
      exact: false,
      confidence: 'medium',
      action: { kind: 'advisory' },
    }

    expect(computeCardScore(card)).toBe(35_000)
  })

  it('runs an empty detector list and drops non-applicable cards', () => {
    const applicable: Detector = {
      id: 'applicable',
      category: 'tax-brackets',
      screen: () => ({
        id: 'applicable',
        category: 'tax-brackets',
        title: 'Applicable',
        rationale: '',
        impact: { endingAfterTaxEstateDelta: 1 },
        exact: false,
        confidence: 'high',
        action: { kind: 'advisory' },
      }),
    }
    const notApplicable: Detector = {
      id: 'not-applicable',
      category: 'tax-brackets',
      screen: () => null,
    }

    expect(runScreen({} as DetectorContext, [])).toEqual([])
    expect(runScreen({} as DetectorContext, [notApplicable, applicable]).map((card) => card.id)).toEqual(['applicable'])
  })

  it('keeps the shared registry alphabetized by detector id', () => {
    const ids = registry.map((detector) => detector.id)
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)))
  })
})
