import { expect, it } from 'vitest'

import { describeCalculation, worksheetExpectedRows, worksheetNumber } from '../rules/describeCalculation.js'
import { productionTaxCalculator, recurringOrdinaryIncome, singlePersonPlan, cashAccount, validatePlan } from '../testing/planFixtures.js'
import { HEADLINE_MONTE_CARLO_PATH_COUNT, HEADLINE_MONTE_CARLO_RETURN_VOL_PCT, headlineMonteCarloOptions } from './headline.js'
import { createMarketModel } from './marketModels.js'
import { DEFAULT_MONTE_CARLO_SEED, derivePathSeed } from './rng.js'
import { runMonteCarloPaths } from './run.js'

const WORKSHEET = 'DOCS/calculations/monte-carlo/monte-carlo-default-seed.md'
const MUTATION = 'DOCS/calculations/monte-carlo/monte-carlo-default-seed.mutation.md'

const rows = worksheetExpectedRows(WORKSHEET)
const expected = (label: string): number => worksheetNumber(rows.get(label)![0]!)

describeCalculation(
  'monte-carlo-default-seed',
  {
    example: {
      inputs: { seedLiteral: '0x5eeded', pathIndices: [0, 1], inflationPct: 2.5, startYear: 2026 },
      expected: Object.fromEntries([...rows].map(([label, cells]) => [label, cells[0]])),
      tolerance: 'exact',
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  () => {
    it('is 6,221,293, and seeds paths 0 and 1 as the worksheet derives', () => {
      expect(DEFAULT_MONTE_CARLO_SEED).toBe(expected('DEFAULT_MONTE_CARLO_SEED'))
      expect(derivePathSeed(DEFAULT_MONTE_CARLO_SEED, 0)).toBe(expected('Path 0 seed'))
      expect(derivePathSeed(DEFAULT_MONTE_CARLO_SEED, 1)).toBe(expected('Path 1 seed'))
    })

    it('publishes the headline options on it, the same for a plan under any id', () => {
      const plan = singlePersonPlan({ dob: '1964-01-01', planningAge: 90 })
      plan.assumptions.inflationPct = 2.5
      plan.accounts = [cashAccount('cash', 400_000)]
      plan.incomes = [recurringOrdinaryIncome('pension', 20_000)]
      expect(HEADLINE_MONTE_CARLO_PATH_COUNT).toBe(expected('Headline path count'))
      expect(HEADLINE_MONTE_CARLO_RETURN_VOL_PCT).toBe(expected('Headline return volatility, percent'))
      const options = headlineMonteCarloOptions(plan, 2026)
      expect(options).toStrictEqual({
        startYear: 2026,
        pathCount: expected('Headline path count'),
        seed: expected('DEFAULT_MONTE_CARLO_SEED'),
        model: { type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: expected('Headline return volatility, percent') },
      })
      // A copy under another id draws the same markets, path for path.
      const copy = { ...structuredClone(plan), id: 'saved-to-my-plans-copy' }
      const paths = (p: typeof plan) => {
        const o = headlineMonteCarloOptions(p, 2026, 4)
        return runMonteCarloPaths(validatePlan(p), {
          startYear: o.startYear,
          taxCalculator: productionTaxCalculator(),
          model: createMarketModel(o.model),
          seed: o.seed,
          pathCount: o.pathCount,
        }).paths.map((path) => path.endingInvestable)
      }
      expect(paths(copy)).toStrictEqual(paths(plan))
    })
  },
)
