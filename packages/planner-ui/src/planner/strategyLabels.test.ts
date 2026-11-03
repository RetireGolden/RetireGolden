/**
 * Strategy labels (#766): every mode of the Roth-conversion and
 * withdrawal-order unions reads as plain language, and no label carries a
 * schema value. The expected strings are the copy the issue asks for ("Fill
 * to top of 22% bracket") and the labels the Strategy editor already shows
 * for each target (StrategySection's Target options: tax bracket, IRMAA tier
 * edge, ACA 400% FPL cliff, fixed MAGI).
 */

import { describe, expect, it } from 'vitest'
import type { Plan } from '@retiregolden/engine/model/plan'
import { buildExampleCouple } from './examples/buildExampleCouple'
import { rothConversionSummary, rothConversionTargetPhrase, withdrawalOrderSummary } from './strategyLabels'

type RothConversion = Plan['strategies']['rothConversion']
type FillTarget = Extract<RothConversion, { mode: 'fillToTarget' }>

const SCHEMA_VALUES = /topOfBracket|irmaaTier|acaCliff|fixedMagi|fillToTarget|bracketTargeted|sequential\b|proportional\b/

function fill(target: FillTarget['target'], targetValue: number | null): FillTarget {
  return { mode: 'fillToTarget', target, targetValue, startYear: 2028, endYear: 2036 }
}

describe('rothConversionSummary', () => {
  it('reads the Example couple bracket fill as the issue asks (#766)', () => {
    expect(rothConversionSummary(buildExampleCouple().strategies.rothConversion)).toBe(
      'Fill to top of 22% bracket, 2028–2036',
    )
  })

  it.each<[string, RothConversion, string]>([
    ['none', { mode: 'none' }, 'None'],
    ['manual, one year', { mode: 'manual', conversions: [{ year: 2030, amount: 40_000 }] }, 'Manual, 1 year'],
    [
      'manual, several years',
      { mode: 'manual', conversions: [{ year: 2030, amount: 1 }, { year: 2031, amount: 1 }, { year: 2032, amount: 1 }] },
      'Manual, 3 years',
    ],
    [
      'optimized',
      { mode: 'optimized', conversions: [{ year: 2030, amount: 1 }, { year: 2031, amount: 1 }] },
      'Optimized, 2 years',
    ],
    ['top of bracket', fill('topOfBracket', 24), 'Fill to top of 24% bracket, 2028–2036'],
    ['IRMAA tier', fill('irmaaTier', 2), 'Fill to just under IRMAA tier 2, 2028–2036'],
    ['ACA cliff', fill('acaCliff', null), 'Fill to just under the ACA 400% FPL cliff, 2028–2036'],
    ['fixed MAGI', fill('fixedMagi', 150_000), 'Fill to a MAGI of $150,000, 2028–2036'],
  ])('%s', (_name, rc, expected) => {
    const label = rothConversionSummary(rc)
    expect(label).toBe(expected)
    expect(label).not.toMatch(SCHEMA_VALUES)
  })

  it('says a target with no value yet is unset instead of printing a blank or "null"', () => {
    expect(rothConversionTargetPhrase('topOfBracket', null)).toBe('top of a tax bracket (none chosen)')
    expect(rothConversionTargetPhrase('irmaaTier', null)).toBe('just under an IRMAA tier (none chosen)')
    expect(rothConversionTargetPhrase('fixedMagi', null)).toBe('a fixed MAGI (none set)')
    for (const target of ['topOfBracket', 'irmaaTier', 'acaCliff', 'fixedMagi'] as const) {
      expect(rothConversionTargetPhrase(target, null)).not.toMatch(/null|undefined|NaN/)
    }
  })
})

describe('withdrawalOrderSummary', () => {
  it.each<[Plan['strategies']['withdrawalOrder'], string]>([
    // The engine's SEQUENTIAL_ORDER drains HSA last, so the label names it.
    [{ mode: 'sequential' }, 'Sequential: cash, taxable, equity comp, traditional, Roth, HSA'],
    [{ mode: 'proportional' }, 'Proportional across accounts'],
    [{ mode: 'bracketTargeted', bracketPct: 22 }, 'Bracket-targeted to 22%'],
  ])('%j', (w, expected) => {
    expect(withdrawalOrderSummary(w)).toBe(expected)
  })
})
