import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { buildLognormalModelConfigForPlan, createMarketModel } from '../montecarlo/marketModels.js'
import { aggregateMonteCarlo, runMonteCarloPaths } from '../montecarlo/run.js'
import { combineTaxCalculators, createFederalTaxCalculator } from '../tax/federalTax.js'
import { createStateTaxCalculator } from '../tax/stateTax.js'
import type { TaxCalculator } from '../projection/types.js'
import { createDecisionContext, evaluateCandidate, planForCandidate } from './evaluateCandidate.js'
import { attachStochasticMetrics, compareMonteCarloSuccessRates } from './stochastic.js'

/** A plan's own tax stack: federal plus its own flat state override, as the planner builds one per plan. */
function ownTaxStack(plan: Plan): TaxCalculator {
  return combineTaxCalculators(
    createFederalTaxCalculator(),
    createStateTaxCalculator({
      overridePct: plan.assumptions.stateEffectiveTaxPct,
      localPct: plan.assumptions.localIncomeTaxPct,
    }),
  )
}

/** A retiree drawing on a traditional IRA, so a state income tax moves every path. */
function retireePlan(): Plan {
  let counter = 0
  const plan = createEmptyPlan({
    newId: () => `stochastic-${++counter}`,
    now: () => new Date('2026-06-11T00:00:00.000Z'),
  })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1960-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 90, source: 'manual' },
  }
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.expenses.baseAnnual = 50_000
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [
    { type: 'traditional', id: 'ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 2_500_000, annualContribution: 0 },
  ]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describeCalculation(
  'monte-carlo-success-rate-comparison',
  {
    example: {
      inputs: {
        caseY: { baseline: { successes: 912, paths: 1_000 }, proposal: { successes: 948, paths: 1_000 } },
        caseZ: { baseline: { successes: 700, paths: 1_000 }, proposal: { successes: 700, paths: 1_000 } },
        caseAA: { baseline: { successes: 228, paths: 250 }, proposal: { successes: 229, paths: 250 } },
        caseAB: { baseline: { successes: 501, paths: 1_000 }, proposal: { successes: 500, paths: 1_000 } },
        caseAC: { baseline: { successes: 0, paths: 1_000 }, proposal: { successes: 0, paths: 1_000 } },
        caseAD: { baseline: { successes: 912, paths: 1_000 }, proposal: { successes: 229, paths: 250 } },
        perPlanTax: { candidateStateEffectiveTaxPct: 5, pathCount: 100, seed: 20_260_927 },
      },
      expected: {
        caseY: 0.03599999999999992,
        caseZ: 0,
        caseAA: 0.0040000000000000036,
        caseAB: -0.0010000000000000009,
        caseAC: 0,
      },
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/insights/insight-monte-carlo-success-delta.md',
    mutation: 'DOCS/calculations/insights/insight-monte-carlo-success-delta.mutation.md',
  },
  ({ example }) => {
    type Run = { successes: number; paths: number }
    const inputs = example.inputs as Record<string, { baseline: Run; proposal: Run }>
    const expected = example.expected as Record<string, number>
    const summary = (run: Run) => ({ successRate: run.successes / run.paths, pathCount: run.paths })

    it('cases Y to AC: proposal minus baseline on the same paths, a fraction of paths', () => {
      for (const key of ['caseY', 'caseZ', 'caseAA', 'caseAB', 'caseAC']) {
        const c = inputs[key]!
        const comparison = compareMonteCarloSuccessRates(summary(c.baseline), summary(c.proposal))
        expect(withinTolerance(comparison.delta, expected[key]!, example.tolerance), `${key}: ${comparison.delta}`).toBe(true)
        expect(comparison.baseline).toBe(c.baseline.successes / c.baseline.paths)
        expect(comparison.proposal).toBe(c.proposal.successes / c.proposal.paths)
      }
      // A flat comparison is a positive zero, never a negative one.
      expect(Object.is(compareMonteCarloSuccessRates(summary(inputs.caseZ!.baseline), summary(inputs.caseZ!.proposal)).delta, 0)).toBe(true)
      // The wrong reading: baseline minus proposal turns every green line red.
      const y = inputs.caseY!
      expect(y.baseline.successes / y.baseline.paths - y.proposal.successes / y.proposal.paths).toBe(-expected.caseY!)
    })

    it('case AD: runs on different path counts are refused', () => {
      const c = inputs.caseAD!
      expect(() => compareMonteCarloSuccessRates(summary(c.baseline), summary(c.proposal))).toThrow(RangeError)
    })

    it('prices each shared-path entry with its own plan\'s tax stack when the context has a per-plan builder', () => {
      const perPlan = example.inputs.perPlanTax as { candidateStateEffectiveTaxPct: number; pathCount: number; seed: number }
      const plan = retireePlan()
      const simulateOptions = { startYear: 2026, taxCalculator: ownTaxStack(plan) }
      const ctx = createDecisionContext(plan, simulateOptions, undefined, ownTaxStack)
      const candidate = {
        id: 'flat-state-tax',
        source: 'scenario-sweep' as const,
        category: 'geography' as const,
        label: 'A flat state income tax',
        explanation: 'The plan with a flat state income tax.',
        planPatch: { assumptions: { stateEffectiveTaxPct: perPlan.candidateStateEffectiveTaxPct } },
      }
      const evaluation = evaluateCandidate(ctx, candidate)
      const model = buildLognormalModelConfigForPlan(plan, 12)
      attachStochasticMetrics(ctx, [evaluation], {
        startYear: 2026,
        taxCalculator: simulateOptions.taxCalculator,
        model,
        pathCount: perPlan.pathCount,
        seed: perPlan.seed,
      })
      const built = planForCandidate(plan, candidate)
      if (!built.ok) throw new Error('the candidate plan did not build')
      const candidatePlan = built.plan
      expect(candidatePlan.assumptions.stateEffectiveTaxPct).toBe(perPlan.candidateStateEffectiveTaxPct)
      const runWith = (taxCalculator: TaxCalculator) =>
        aggregateMonteCarlo(
          runMonteCarloPaths(candidatePlan, {
            startYear: 2026,
            taxCalculator,
            model: createMarketModel(model),
            seed: perPlan.seed,
            pathCount: perPlan.pathCount,
          }),
        )
      const own = runWith(ownTaxStack(candidatePlan))
      const shared = runWith(simulateOptions.taxCalculator)
      const attached = evaluation.stochastic!
      expect(attached.candidate.successRate).toBe(own.successRate)
      expect(attached.candidate.medianEndingAfterTaxEstate).toBe(own.endingAfterTaxEstate.percentiles.p50)
      // The wrong reading: the base plan's stack prices the candidate without
      // its state tax, and its median estate is higher.
      expect(shared.endingAfterTaxEstate.percentiles.p50).toBeGreaterThan(own.endingAfterTaxEstate.percentiles.p50)
      expect(attached.candidate.medianEndingAfterTaxEstate).not.toBe(shared.endingAfterTaxEstate.percentiles.p50)
      expect(attached.deltas.successRate).toBe(
        compareMonteCarloSuccessRates(attached.baseline, attached.candidate).delta,
      )
    })
  },
)
