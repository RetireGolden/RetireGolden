/**
 * Wiring tests for the model picker presets/catalog: every previously
 * reachable MarketModelConfig stays reachable, presets write only existing
 * config values, and a preset produces byte-identical Monte Carlo results
 * to the same config picked from the advanced catalog.
 */

import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '@retiregolden/engine/model/plan'
import { runMonteCarlo } from '../mc/pool'
import {
  buildModel,
  MODEL_CATALOG,
  MODEL_PRESETS,
  presetFamilyOf,
  type ModelKind,
} from './marketModelPicker'

let counter = 0
const testIds = () => `picker-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

function basePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1961-06-15',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 90, source: 'manual' },
  }
  plan.assumptions.defaultReturnPct = 5
  plan.expenses.baseAnnual = 45_000
  const brokerage: Account = {
    type: 'taxable',
    id: testIds(),
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance: 1_200_000,
    costBasis: 800_000,
    annualContribution: 0,
  }
  plan.accounts = [brokerage]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

const ALL_KINDS: ModelKind[] = [
  'lognormal',
  'hist-iid',
  'hist-block',
  'hist-sequence',
  'student-t',
  'regime-switch',
  'cape-conditioned',
  'stationary',
  'empirical',
  'garch',
  'inflation-regime',
  'reversed-history',
  'user-shock',
  'gaussian',
  'ar1',
]

describe('model catalog', () => {
  it('keeps every previously reachable model selectable', () => {
    const catalogKinds = MODEL_CATALOG.map((entry) => entry.kind)
    expect(new Set(catalogKinds).size).toBe(catalogKinds.length)
    expect([...catalogKinds].sort()).toEqual([...ALL_KINDS].sort())
  })

  it('assigns every model a preset family', () => {
    for (const kind of ALL_KINDS) {
      expect(['smooth', 'history', 'stress']).toContain(presetFamilyOf(kind))
    }
  })

  it('maps each preset to a model in its own family', () => {
    expect(MODEL_PRESETS).toHaveLength(3)
    for (const preset of MODEL_PRESETS) {
      expect(presetFamilyOf(preset.kind)).toBe(preset.id)
    }
  })
})

describe('buildModel golden configs', () => {
  const plan = basePlan()
  const inflation = 2.5
  const vol = 12
  const equity = 60

  it('produces the exact config values the flat select produced', () => {
    // These literals are the pre-picker configs; a change here silently
    // changes Monte Carlo results for the same seed. classShocks is
    // undefined/false for this single-return plan.
    expect(buildModel('hist-iid', inflation, vol, equity, plan)).toEqual({
      type: 'historical',
      mode: 'iid',
      equityWeightPct: 60,
      classShocks: false,
    })
    expect(buildModel('hist-block', inflation, vol, equity, plan)).toEqual({
      type: 'historical',
      mode: 'block',
      equityWeightPct: 60,
      classShocks: false,
    })
    expect(buildModel('hist-sequence', inflation, vol, equity, plan)).toEqual({
      type: 'historical',
      mode: 'sequence',
      equityWeightPct: 60,
      classShocks: false,
    })
    expect(buildModel('student-t', inflation, vol, equity, plan)).toEqual({
      type: 'student-t',
      inflationMeanPct: inflation,
      returnVolPct: vol,
      classShocks: undefined,
    })
    expect(buildModel('regime-switch', inflation, vol, equity, plan)).toEqual({
      type: 'regime-switch',
      inflationMeanPct: inflation,
      classShocks: undefined,
    })
    expect(buildModel('cape-conditioned', inflation, vol, equity, plan)).toEqual({
      type: 'cape-conditioned',
      inflationMeanPct: inflation,
      returnVolPct: vol,
      startingCape: 28,
      classShocks: undefined,
    })
    expect(buildModel('stationary', inflation, vol, equity, plan)).toEqual({
      type: 'stationary',
      equityWeightPct: 60,
      classShocks: false,
    })
    expect(buildModel('empirical', inflation, vol, equity, plan)).toEqual({
      type: 'empirical',
      equityWeightPct: 60,
      centered: true,
      classShocks: false,
    })
    expect(buildModel('garch', inflation, vol, equity, plan)).toEqual({
      type: 'garch',
      inflationMeanPct: inflation,
      returnVolScalePct: vol,
      classShocks: undefined,
    })
    expect(buildModel('inflation-regime', inflation, vol, equity, plan)).toEqual({
      type: 'inflation-regime',
      baseInflationMeanPct: inflation,
      classShocks: undefined,
    })
    expect(buildModel('reversed-history', inflation, vol, equity, plan)).toEqual({
      type: 'reversed-history',
      equityWeightPct: 60,
      windowLengthYears: 10,
      classShocks: false,
    })
    expect(buildModel('user-shock', inflation, vol, equity, plan)).toEqual({
      type: 'user-shock',
      inflationMeanPct: inflation,
      shockYear: 1,
      shockPct: -25,
      baseReturnVolPct: vol,
      classShocks: undefined,
    })
    expect(buildModel('gaussian', inflation, vol, equity, plan)).toEqual({
      type: 'gaussian',
      inflationMeanPct: inflation,
      returnVolPct: vol,
      classShocks: undefined,
    })
    expect(buildModel('ar1', inflation, vol, equity, plan)).toEqual({
      type: 'ar1',
      inflationMeanPct: inflation,
      returnVolPct: vol,
      phi: 0.3,
      classShocks: undefined,
    })
    // Lognormal goes through buildLognormalModelConfigForPlan; assert shape.
    expect(buildModel('lognormal', inflation, vol, equity, plan)).toMatchObject({
      type: 'lognormal',
      inflationMeanPct: inflation,
    })
  })
})

describe('preset results are byte-identical to the advanced catalog', () => {
  it('a preset kind and the same kind picked from the catalog produce equal summaries per seed', async () => {
    const plan = basePlan()
    for (const preset of MODEL_PRESETS) {
      const presetModel = buildModel(preset.kind, 2.5, 12, 60, plan)
      const catalogKind = MODEL_CATALOG.find((entry) => entry.kind === preset.kind)!.kind
      const catalogModel = buildModel(catalogKind, 2.5, 12, 60, plan)
      expect(catalogModel).toEqual(presetModel)

      const opts = { startYear: 2026, pathCount: 25, seed: 42 }
      const a = await runMonteCarlo(plan, { ...opts, model: presetModel })
      const b = await runMonteCarlo(plan, { ...opts, model: catalogModel })
      expect(a.successRate).toBe(b.successRate)
      expect(a.fan).toEqual(b.fan)
      expect(a.endingAfterTaxEstate).toEqual(b.endingAfterTaxEstate)
    }
  }, 30_000)
})
