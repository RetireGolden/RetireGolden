/**
 * "How much can I spend?" on every library example: the solver answers each
 * one as the page does, or fails because spending at the lowest valid level
 * really depletes, never because a probe could not run.
 *
 * Each example is loaded as the app loads it (`loadExample.ts#stampDemo`:
 * `build()`, then `origin: 'example'` and `exampleSourceId`) and solved
 * through the page's own executor (`runSpendingSolveRequest`: the plan's tax
 * stack, the shared interactive budget, the bequest target as the estate
 * floor) from the examples' fixed start year.
 *
 * Pinned 2026-09-26 when the solver stopped refusing plans whose Marketplace
 * credit is unpriced (D-SOLVER-ACA-GATE). Before, 22 of the 29 had no answer:
 * any year whose premium tax credit the projection could not price (every
 * example runs past 2026, the only year RetireGolden has the credit's
 * figures for) made every probe a
 * refusal. Now those years pay the full Marketplace premium, as the
 * projection already budgets them, and the answer names them. The values
 * were recomputed from the implemented code and match the table of the
 * D-SOLVER-ACA-GATE derivation (2026-09-26). The two that still have no
 * answer are true: ltc-shock depletes even at zero base spending (care costs
 * of about $150,000 a year in 2042 to 2044 net of the policy benefit, on gross
 * costs of $223,750, $236,056 and $249,039), and guardrails-flex-goals
 * depletes at its $34,000 required floor, the lowest level its plan checks
 * accept. Characterization values, not a legal oracle: a change to the
 * projection moves them, and the change must say why.
 *
 * Re-pinned 2026-09-26 (decision D-ACA-2027-TABLE): 2027 is priced on its
 * published credit figures (Rev. Proc. 2026-26 and the HHS 2026 poverty
 * guidelines), so 2027 leaves the unpriced years of the 18 examples that had
 * it: glidepath-allocation and static-allocation-control lose the disclosure
 * entirely, and hsa-property-depth's years become 2026, 2028 and 2029, no
 * longer one span, which is why the years are listed rather than bounded. Two
 * answers move up, as a priced credit can only move a fixed-target answer:
 * early-retiree-aca 45,313 -> 45,625 (its 2027 credit, 10,924.78 with the IRS
 * rounding, lowers what 2027 must withdraw) and hsa-property-depth 28,688 ->
 * 29,087; the answer-run case below goes 28,750 -> 29,063. Probe counts and
 * every other answer are unchanged. Recomputed from the implemented code;
 * they match the D-ACA-2027-TABLE derivation's table and its check.
 *
 * B2-P1 slice 2 (owner decision R4, 2026-09-27): the solver publishes the
 * level that passed as feasibleBaseAnnual and its answer, maxBaseAnnual, as
 * that level rounded down to $100 (the figure the page showed). No example
 * with an answer spends under guardrails, so every published answer is the
 * rounded one, no extra run happens and the probe counts are unchanged.
 */
import { describe, expect, it } from 'vitest'

import type { AcaSupportCode } from '@retiregolden/engine/projection/types'
import type { Plan } from '@retiregolden/engine/model/plan'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import { runSpendingSolveRequest } from '../../optimize/runSpendingSolve'
import { taxCalculatorFor } from '../../planTaxCalculator'
import { EXAMPLE_FIXED_YEAR, exampleFixedNow } from './buildContext'
import { EXAMPLE_PLANS, type ExamplePlan } from './registry'

const PARAMS: AcaSupportCode = 'tax-year-parameters-unsupported'
const BELOW_FPL: AcaSupportCode = 'below-100-fpl-exception-unsupported'
const GUARDRAIL: AcaSupportCode = 'guardrail-interaction-unsupported'

interface SolverGolden {
  /** The level that passed (the solver's feasibleBaseAnnual), today's dollars. */
  maxBaseAnnual: number | null
  /** The published answer (the solver's maxBaseAnnual): that level rounded down to $100. */
  displayed: number | null
  probes: number
  /** Every year whose credit is unpriced, ascending; null when none. */
  acaYears: number[] | null
  reasons: AcaSupportCode[]
}

/** The years from `first` to `last`, inclusive. */
function span(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
}

const EXPECTED: Record<string, SolverGolden> = {
  'example-couple': { maxBaseAnnual: 117_000, displayed: 117_000, probes: 10, acaYears: span(2028, 2029), reasons: [PARAMS] },
  'under-saved-single': { maxBaseAnnual: 65_250, displayed: 65_200, probes: 10, acaYears: null, reasons: [] },
  'bracket-fill-roth': { maxBaseAnnual: 101_602, displayed: 101_600, probes: 10, acaYears: null, reasons: [] },
  'early-retiree-aca': { maxBaseAnnual: 45_625, displayed: 45_600, probes: 9, acaYears: [2028], reasons: [PARAMS] },
  'rmd-irmaa': { maxBaseAnnual: 131_485, displayed: 131_400, probes: 10, acaYears: null, reasons: [] },
  'inherited-ira-beneficiary': { maxBaseAnnual: 26_438, displayed: 26_400, probes: 10, acaYears: null, reasons: [] },
  'survivor-years': { maxBaseAnnual: 59_063, displayed: 59_000, probes: 10, acaYears: null, reasons: [] },
  'moving-state-tax': { maxBaseAnnual: 107_657, displayed: 107_600, probes: 10, acaYears: span(2028, 2030), reasons: [PARAMS] },
  'ltc-shock': { maxBaseAnnual: null, displayed: null, probes: 2, acaYears: span(2026, 2028), reasons: [BELOW_FPL, PARAMS] },
  'early-career-match': { maxBaseAnnual: 59_766, displayed: 59_700, probes: 9, acaYears: span(2028, 2065), reasons: [PARAMS] },
  'aggressive-saver': { maxBaseAnnual: 90_352, displayed: 90_300, probes: 11, acaYears: span(2028, 2060), reasons: [PARAMS] },
  'coast-fire': { maxBaseAnnual: 66_407, displayed: 66_400, probes: 9, acaYears: span(2028, 2060), reasons: [PARAMS] },
  'barista-fire': { maxBaseAnnual: 52_032, displayed: 52_000, probes: 9, acaYears: span(2028, 2060), reasons: [PARAMS] },
  'bridge-early-retirement': { maxBaseAnnual: 70_704, displayed: 70_700, probes: 9, acaYears: span(2028, 2045), reasons: [PARAMS] },
  'lean-fat-fire': { maxBaseAnnual: 74_532, displayed: 74_500, probes: 9, acaYears: span(2028, 2055), reasons: [PARAMS] },
  'hsa-stealth-retirement': { maxBaseAnnual: 54_688, displayed: 54_600, probes: 9, acaYears: span(2028, 2050), reasons: [PARAMS] },
  'salary-growth-escalation': { maxBaseAnnual: 68_204, displayed: 68_200, probes: 9, acaYears: span(2028, 2060), reasons: [PARAMS] },
  'guardrails-flex-goals': { maxBaseAnnual: null, displayed: null, probes: 2, acaYears: span(2026, 2028), reasons: [GUARDRAIL, PARAMS] },
  'annuity-purchases-estate': { maxBaseAnnual: 114_259, displayed: 114_200, probes: 10, acaYears: null, reasons: [] },
  'glidepath-allocation': { maxBaseAnnual: 75_563, displayed: 75_500, probes: 9, acaYears: null, reasons: [] },
  'hsa-property-depth': { maxBaseAnnual: 29_087, displayed: 29_000, probes: 9, acaYears: [2026, 2028, 2029], reasons: [BELOW_FPL, PARAMS] },
  'fixed-target-spending': { maxBaseAnnual: 30_813, displayed: 30_800, probes: 9, acaYears: span(2026, 2028), reasons: [BELOW_FPL, PARAMS] },
  'no-annuity-brokerage': { maxBaseAnnual: 116_391, displayed: 116_300, probes: 10, acaYears: null, reasons: [] },
  'static-allocation-control': { maxBaseAnnual: 71_688, displayed: 71_600, probes: 9, acaYears: null, reasons: [] },
  'brokerage-no-hsa': { maxBaseAnnual: 28_290, displayed: 28_200, probes: 9, acaYears: span(2026, 2029), reasons: [BELOW_FPL, PARAMS] },
  'all-401k-no-bridge': { maxBaseAnnual: 71_250, displayed: 71_200, probes: 10, acaYears: span(2028, 2051), reasons: [PARAMS] },
  'brokerage-bridge-401k': { maxBaseAnnual: 71_250, displayed: 71_200, probes: 10, acaYears: span(2028, 2051), reasons: [PARAMS] },
  'no-head-start-grad': { maxBaseAnnual: 55_000, displayed: 55_000, probes: 9, acaYears: span(2028, 2069), reasons: [PARAMS] },
  'trump-account-head-start': { maxBaseAnnual: 64_282, displayed: 64_200, probes: 9, acaYears: span(2028, 2069), reasons: [PARAMS] },
}

/** The only examples with no answer, and the failure each one truly has. */
const NO_ANSWER: Record<string, string> = {
  'ltc-shock': 'Even zero base spending depletes the portfolio before the plan ends.',
  'guardrails-flex-goals': 'Even the required spending floor ($34,000/yr) depletes the portfolio before the plan ends.',
}

/** As `loadExample.ts#stampDemo` stamps a library demo before the planner opens it. */
function stampDemo(example: ExamplePlan): Plan {
  const built = example.build()
  return {
    ...built,
    id: `example--${example.id}`,
    name: example.title,
    origin: 'example',
    exampleSourceId: example.id,
    createdAtIso: exampleFixedNow().toISOString(),
    updatedAtIso: exampleFixedNow().toISOString(),
  }
}

describe('sustainable spending on every example', () => {
  it('pins every example in the library', () => {
    expect(EXAMPLE_PLANS.map((example) => example.id).sort()).toEqual(Object.keys(EXPECTED).sort())
  })

  for (const example of EXAMPLE_PLANS) {
    it(`${example.title} solves as pinned`, () => {
      const expected = EXPECTED[example.id]
      expect(expected, `missing golden fixture for ${example.id}`).toBeDefined()
      const solved = runSpendingSolveRequest({ plan: stampDemo(example), startYear: EXAMPLE_FIXED_YEAR })

      expect(solved.feasibleBaseAnnual).toBe(expected!.maxBaseAnnual)
      expect(solved.maxBaseAnnual).toBe(expected!.displayed)
      expect(solved.maxBaseAnnualRounding).toBe(expected!.displayed === null ? null : 'down-to-hundred')
      expect(solved.spendingSlackDollars).toBe(
        expected!.displayed === null ? null : expected!.displayed - stampDemo(example).expenses.baseAnnual,
      )
      expect(solved.simulationCount).toBe(expected!.probes)
      expect(solved.acaGrossPremiumYears).toEqual(expected!.acaYears ?? [])
      expect(solved.acaGrossPremiumReasons).toEqual(expected!.reasons)
      // Only Guardrails and flexible goals spends under guardrails, where a
      // credit could move the answer either way.
      expect(solved.acaGrossPremiumDirection).toBe(
        expected!.acaYears === null ? null : example.id === 'guardrails-flex-goals' ? 'uncertain' : 'conservative',
      )
      // Every probe ran: a failed probe is a real depletion, never a refusal.
      expect(solved.limitingConstraint).toBe('depletion')

      const failure = NO_ANSWER[example.id]
      if (failure === undefined) {
        expect(solved.maxBaseAnnual).not.toBeNull()
        expect(solved.converged).toBe(true)
        expect(solved.evidence!.depletionYear).toBeNull()
      } else {
        expect(solved.maxBaseAnnual).toBeNull()
        expect(solved.diagnostics[0]).toBe(failure)
      }
      // Only ltc-shock tried zero spending and ran out of money; Guardrails
      // and flexible goals failed at its $34,000 floor and never tried zero.
      expect(solved.zeroSpendingDepletes).toBe(example.id === 'ltc-shock')
      // Nothing silent: an unpriced year is always named, in the last diagnostic.
      if (expected!.acaYears !== null) {
        expect(solved.diagnostics.at(-1)!.startsWith(`The ACA premium tax credit is not priced in ${expected!.acaYears[0]}`)).toBe(true)
      }
    }, 120_000)
  }
})

describe('the unpriced years come from the run the answer rests on', () => {
  it('reports the answer run, not the seed, when their Marketplace years differ', () => {
    // hsa-property-depth spent at $80,000: the seed run's income prices its
    // 2026 credit, but the answer's much lower spending leaves 2026 income
    // under the poverty line, where the credit is not priced. 2027 is priced
    // on its published figures in both runs.
    const example = EXAMPLE_PLANS.find((candidate) => candidate.id === 'hsa-property-depth')!
    const plan = stampDemo(example)
    plan.expenses.baseAnnual = 80_000
    const seedRun = simulatePlan(plan, { startYear: EXAMPLE_FIXED_YEAR, taxCalculator: taxCalculatorFor(plan) })
    expect(seedRun.years.find((year) => year.year === 2026)?.aca?.readiness).toBe('actionable')

    const solved = runSpendingSolveRequest({ plan, startYear: EXAMPLE_FIXED_YEAR })
    expect(solved.feasibleBaseAnnual).toBe(29_063)
    expect(solved.maxBaseAnnual).toBe(29_000)
    expect(solved.acaGrossPremiumYears).toEqual([2026, 2028, 2029])
    expect(solved.acaGrossPremiumReasons).toContain(BELOW_FPL)
  }, 120_000)
})

describe('guardrail feasibility is not monotone in the base amount', () => {
  it('depletes at a lower base and not at a higher one, with no Marketplace year', () => {
    // The counterexample the sustainable-spending-bisection record cites.
    const example = EXAMPLE_PLANS.find((candidate) => candidate.id === 'example-couple')!
    const plan = example.build()
    plan.expenses.healthcare = { ...plan.expenses.healthcare, pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false }
    delete plan.expenses.healthcare.acaYears
    plan.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails', upperGuardrailPct: 125 }
    plan.expenses.requiredAnnual = 86_400
    const run = (baseAnnual: number) => {
      const variant = { ...plan, expenses: { ...plan.expenses, baseAnnual } }
      return simulatePlan(variant, { startYear: EXAMPLE_FIXED_YEAR, taxCalculator: taxCalculatorFor(variant) })
    }

    const lower = run(164_391)
    const higher = run(166_971)
    expect(lower.years.some((year) => year.aca !== undefined)).toBe(false)
    expect(lower.depletionYear).toBe(2059)
    expect(higher.depletionYear).toBeNull()
  }, 120_000)
})

describe('under guardrails a rounded amount that fails is not published', () => {
  it('publishes the exact $76,641 for lean-fat-fire under withdrawal-rate guardrails, because $76,600 runs out', () => {
    // Found by the independent review of B2-P1 slice 2 (2026-09-27): the
    // example under withdrawal-rate guardrails (upper 150) with a $40,500
    // required floor passes at $76,641 and depletes at $76,600, the amount
    // rounded down to the hundred, so the solver publishes the exact amount.
    const example = EXAMPLE_PLANS.find((candidate) => candidate.id === 'lean-fat-fire')!
    const plan = stampDemo(example)
    plan.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails', upperGuardrailPct: 150 }
    plan.expenses.requiredAnnual = 40_500
    const solved = runSpendingSolveRequest({ plan, startYear: EXAMPLE_FIXED_YEAR })
    expect(solved.feasibleBaseAnnual).toBe(76_641)
    expect(solved.maxBaseAnnual).toBe(76_641)
    expect(solved.maxBaseAnnualRounding).toBe('none')
    expect(solved.spendingSlackDollars).toBe(76_641 - plan.expenses.baseAnnual)
    expect(solved.diagnostics.some((message) => message.includes('not rounded down to $76,600/yr'))).toBe(true)

    const run = (baseAnnual: number) => {
      const variant = { ...plan, expenses: { ...plan.expenses, baseAnnual } }
      return simulatePlan(variant, { startYear: EXAMPLE_FIXED_YEAR, taxCalculator: taxCalculatorFor(variant) })
    }
    expect(run(76_641).depletionYear).toBeNull()
    expect(run(76_600).depletionYear).toBe(2085)
  }, 120_000)
})
