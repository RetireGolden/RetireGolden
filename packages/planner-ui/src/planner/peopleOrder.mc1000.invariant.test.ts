/**
 * Bit for bit at 1,000 paths (independent review L3): reversed or renamed,
 * the two couples on which the review found last-bit differences in the
 * Monte Carlo paths (no-annuity-brokerage, 4 paths in every mode;
 * annuity-purchases-estate, 1 care path) now draw identical paths, compared
 * as exact floats, in the headline, longevity and care modes. The per-person
 * healthcare sum and the legacy QCD split now add in the canonical order.
 * The measurement harness (C:/rgwt/staging/order-diag/impl) asserts the same
 * on all seven example couples.
 */
import { describe, expect, it } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import { DEFAULT_LTC_SHOCK } from '@retiregolden/engine/montecarlo/ltcShock'

import { runMcRequest } from '../mc/runRequest'
import { appExamplePlanById } from '../testSupport/appExamples'
import { EXAMPLE_FIXED_YEAR } from './examples/buildContext'
import { headlineMcRunOptions } from './useMcSuccessRate'

const PATHS = 1_000

function paths(plan: Plan, mode: 'headline' | 'longevity' | 'care'): string[] {
  const o = headlineMcRunOptions(plan, PATHS, EXAMPLE_FIXED_YEAR)
  const run = runMcRequest({
    kind: 'monteCarlo', plan, startYear: EXAMPLE_FIXED_YEAR, seed: o.seed, model: o.model, pathCount: PATHS, firstPathIndex: 0,
    progressEvery: PATHS, stochasticLongevity: mode === 'longevity', ltcShock: mode === 'care' ? DEFAULT_LTC_SHOCK : null,
  } as never)
  // Exact floats: JSON keeps every bit of a double.
  return run.paths.map((p) => JSON.stringify([p.endingNetWorth, p.endingInvestable, p.depletionYear, Array.from(p.investableByYear)]))
}

const reversed = (plan: Plan): Plan => ({ ...structuredClone(plan), household: { ...plan.household, people: [...plan.household.people].reverse() } })

function renamed(plan: Plan): Plan {
  let json = JSON.stringify(plan)
  plan.household.people.forEach((person, i) => { json = json.split(person.id).join(`${i === 0 ? 'zz' : 'aa'}-renamed-${i}`) })
  return JSON.parse(json) as Plan
}

describe('1,000 paths, bit for bit, whoever is listed first and whatever the ids are called (review L3)', () => {
  for (const id of ['no-annuity-brokerage', 'annuity-purchases-estate']) {
    it(`${id}: reversed and renamed, every path in every mode`, () => {
      const plan = appExamplePlanById(id)
      for (const mode of ['headline', 'longevity', 'care'] as const) {
        const listed = paths(plan, mode)
        const flipped = paths(reversed(plan), mode)
        expect(flipped.filter((p, i) => p !== listed[i]).length, `${mode} reversed`).toBe(0)
        const other = paths(renamed(plan), mode)
        expect(other.filter((p, i) => p !== listed[i]).length, `${mode} renamed`).toBe(0)
      }
    }, 900_000)
  }
})
