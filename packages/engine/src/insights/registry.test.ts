import { describe, expect, it } from 'vitest'
import type { Detector, DetectorContext, InsightCard } from './types.js'
import {
  CONFIDENCE_RANKING_WEIGHTS,
  computeCardScore,
  registry,
  sortCards,
  SUCCESS_RATE_POINT_DOLLAR_EQUIVALENT,
} from './registry.js'
import { runScreen } from './runInsights.js'

describe('detector framework scoring and ranking', () => {
  /**
   * These two are unsourced ranking heuristics, so nothing outside this test
   * pins them. Pinning them here makes a change to card ordering a deliberate
   * edit with a visible diff rather than a silent nudge.
   */
  it('pins the card-ranking heuristic constants', () => {
    expect(SUCCESS_RATE_POINT_DOLLAR_EQUIVALENT).toBe(10000)
    expect(CONFIDENCE_RANKING_WEIGHTS).toEqual({ high: 1.0, medium: 0.7, low: 0.4 })
  })


  it('correctly scores cards based on impact magnitude and confidence weight', () => {
    const cardA: InsightCard = {
      id: 'card-a',
      category: 'tax-brackets',
      title: 'Card A',
      rationale: '',
      impact: { endingAfterTaxEstateDelta: 10000 },
      exact: false,
      confidence: 'high',
      severity: 'info',
      evidence: [{ label: 'Value', value: '$10,000' }],
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
      severity: 'info',
      evidence: [{ label: 'Value', value: '$20,000' }],
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
      severity: 'info',
      evidence: [{ label: 'Value', value: '$0' }],
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
      severity: 'attention',
      evidence: [{ label: 'Success-rate change', value: '5%' }],
      action: { kind: 'advisory' },
    }

    expect(computeCardScore(card)).toBe(35_000)
  })

  it('runs an empty detector list and drops non-applicable cards', () => {
    const applicable: Detector = {
      id: 'applicable',
      category: 'tax-brackets',
      version: 1,
      screen: () => ({
        id: 'applicable',
        category: 'tax-brackets',
        title: 'Applicable',
        rationale: '',
        impact: { endingAfterTaxEstateDelta: 1 },
        exact: false,
        confidence: 'high',
        severity: 'info',
        evidence: [{ label: 'Value', value: '$1' }],
        action: { kind: 'advisory' },
      }),
    }
    const notApplicable: Detector = {
      id: 'not-applicable',
      category: 'tax-brackets',
      version: 1,
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

describe('detector governance', () => {
  it('gives every detector module its own sibling test file', () => {
    // The insights/** coverage floor in vitest.config.ts has headroom (it is
    // set a few points under what the suite measures) precisely so that
    // unrelated edits do not trip it. That same headroom means deleting one
    // small detector's dedicated test file is not guaranteed to move the
    // aggregate below the floor - the consumer integration suites
    // (src/integration/insightsDetectors.test.ts and friends) still exercise
    // the detector somewhat. This test closes that gap directly, independent
    // of the aggregate percentage: every non-test module under
    // insights/detectors/ must have a `<name>.test.ts` sibling, so deleting a
    // detector's fixtures fails here even when it would not move the floor.
    const implementations = import.meta.glob('./detectors/*.ts', { query: '?raw', import: 'default', eager: true })
    const tests = import.meta.glob('./detectors/*.test.ts', { query: '?raw', import: 'default', eager: true })
    const implementationPaths = Object.keys(implementations).filter((path) => !path.endsWith('.test.ts'))
    expect(implementationPaths.length).toBeGreaterThan(0)
    const missingTests = implementationPaths.filter(
      (path) => !(path.replace(/\.ts$/u, '.test.ts') in tests),
    )
    expect(missingTests).toEqual([])
  })

  it('registers unique kebab-case IDs', () => {
    const ids = registry.map((detector) => detector.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))).toBe(true)
  })

  it('uses valid versions for every registered detector', () => {
    expect(registry.every((detector) => Number.isInteger(detector.version) && detector.version >= 1)).toBe(true)
  })

  it('excludes deprecated detectors from the default registry', () => {
    expect(registry.every((detector) => detector.deprecated === undefined)).toBe(true)
  })
})
