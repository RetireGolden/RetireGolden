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
 * example runs past 2026, the only parameter year) made every probe a
 * refusal. Now those years pay the full Marketplace premium, as the
 * projection already budgets them, and the answer names them. The values
 * were recomputed from the implemented code and match the table of the
 * D-SOLVER-ACA-GATE derivation (2026-09-26). The two that still have no
 * answer are true: ltc-shock depletes even at zero base spending (care costs
 * of about $150,000 a year in 2042 to 2044), and guardrails-flex-goals
 * depletes at its $34,000 required floor, the lowest level its plan checks
 * accept. Characterization values, not a legal oracle: a change to the
 * projection moves them, and the change must say why.
 */
import { describe, expect, it } from 'vitest'

import type { AcaSupportCode } from '@retiregolden/engine/projection/types'
import type { Plan } from '@retiregolden/engine/model/plan'
import { runSpendingSolveRequest } from '../../optimize/runSpendingSolve'
import { EXAMPLE_FIXED_YEAR, exampleFixedNow } from './buildContext'
import { EXAMPLE_PLANS, type ExamplePlan } from './registry'

const PARAMS: AcaSupportCode = 'tax-year-parameters-unsupported'
const BELOW_FPL: AcaSupportCode = 'below-100-fpl-exception-unsupported'
const GUARDRAIL: AcaSupportCode = 'guardrail-interaction-unsupported'

interface SolverGolden {
  /** The solver's exact answer, today's dollars; the page shows it floored to $100. */
  maxBaseAnnual: number | null
  probes: number
  /** First and last year whose credit is unpriced (every span is contiguous); null when none. */
  acaYears: [number, number] | null
  reasons: AcaSupportCode[]
}

const EXPECTED: Record<string, SolverGolden> = {
  'example-couple': { maxBaseAnnual: 117_000, probes: 10, acaYears: [2027, 2029], reasons: [PARAMS] },
  'under-saved-single': { maxBaseAnnual: 65_250, probes: 10, acaYears: null, reasons: [] },
  'bracket-fill-roth': { maxBaseAnnual: 101_602, probes: 10, acaYears: null, reasons: [] },
  'early-retiree-aca': { maxBaseAnnual: 45_313, probes: 9, acaYears: [2027, 2028], reasons: [PARAMS] },
  'rmd-irmaa': { maxBaseAnnual: 131_485, probes: 10, acaYears: null, reasons: [] },
  'inherited-ira-beneficiary': { maxBaseAnnual: 26_438, probes: 10, acaYears: null, reasons: [] },
  'survivor-years': { maxBaseAnnual: 59_063, probes: 10, acaYears: null, reasons: [] },
  'moving-state-tax': { maxBaseAnnual: 107_657, probes: 10, acaYears: [2027, 2030], reasons: [PARAMS] },
  'ltc-shock': { maxBaseAnnual: null, probes: 2, acaYears: [2026, 2028], reasons: [BELOW_FPL, PARAMS] },
  'early-career-match': { maxBaseAnnual: 59_766, probes: 9, acaYears: [2027, 2065], reasons: [PARAMS] },
  'aggressive-saver': { maxBaseAnnual: 90_352, probes: 11, acaYears: [2027, 2060], reasons: [PARAMS] },
  'coast-fire': { maxBaseAnnual: 66_407, probes: 9, acaYears: [2027, 2060], reasons: [PARAMS] },
  'barista-fire': { maxBaseAnnual: 52_032, probes: 9, acaYears: [2027, 2060], reasons: [PARAMS] },
  'bridge-early-retirement': { maxBaseAnnual: 70_704, probes: 9, acaYears: [2027, 2045], reasons: [PARAMS] },
  'lean-fat-fire': { maxBaseAnnual: 74_532, probes: 9, acaYears: [2027, 2055], reasons: [PARAMS] },
  'hsa-stealth-retirement': { maxBaseAnnual: 54_688, probes: 9, acaYears: [2027, 2050], reasons: [PARAMS] },
  'salary-growth-escalation': { maxBaseAnnual: 68_204, probes: 9, acaYears: [2027, 2060], reasons: [PARAMS] },
  'guardrails-flex-goals': { maxBaseAnnual: null, probes: 2, acaYears: [2026, 2028], reasons: [GUARDRAIL, PARAMS] },
  'annuity-purchases-estate': { maxBaseAnnual: 114_259, probes: 10, acaYears: null, reasons: [] },
  'glidepath-allocation': { maxBaseAnnual: 75_563, probes: 9, acaYears: [2027, 2027], reasons: [PARAMS] },
  'hsa-property-depth': { maxBaseAnnual: 28_688, probes: 9, acaYears: [2026, 2029], reasons: [BELOW_FPL, PARAMS] },
  'fixed-target-spending': { maxBaseAnnual: 30_813, probes: 9, acaYears: [2026, 2028], reasons: [BELOW_FPL, PARAMS] },
  'no-annuity-brokerage': { maxBaseAnnual: 116_391, probes: 10, acaYears: null, reasons: [] },
  'static-allocation-control': { maxBaseAnnual: 71_688, probes: 9, acaYears: [2027, 2027], reasons: [PARAMS] },
  'brokerage-no-hsa': { maxBaseAnnual: 28_290, probes: 9, acaYears: [2026, 2029], reasons: [BELOW_FPL, PARAMS] },
  'all-401k-no-bridge': { maxBaseAnnual: 71_250, probes: 10, acaYears: [2027, 2051], reasons: [PARAMS] },
  'brokerage-bridge-401k': { maxBaseAnnual: 71_250, probes: 10, acaYears: [2027, 2051], reasons: [PARAMS] },
  'no-head-start-grad': { maxBaseAnnual: 55_000, probes: 9, acaYears: [2027, 2069], reasons: [PARAMS] },
  'trump-account-head-start': { maxBaseAnnual: 64_282, probes: 9, acaYears: [2027, 2069], reasons: [PARAMS] },
}

/** The only examples with no answer, and the failure each one truly has. */
const NO_ANSWER: Record<string, string> = {
  'ltc-shock': 'Even zero base spending depletes the portfolio or breaks the estate floor.',
  'guardrails-flex-goals': 'Even the required spending floor ($34,000/yr) depletes the portfolio or breaks the estate floor.',
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

function yearsBetween(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
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

      expect(solved.maxBaseAnnual).toBe(expected!.maxBaseAnnual)
      expect(solved.simulationCount).toBe(expected!.probes)
      expect(solved.acaGrossPremiumYears).toEqual(expected!.acaYears ? yearsBetween(...expected!.acaYears) : [])
      expect(solved.acaGrossPremiumReasons).toEqual(expected!.reasons)
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
      // Nothing silent: an unpriced year is always named in the diagnostics.
      if (expected!.acaYears !== null) {
        expect(solved.diagnostics.join(' ')).toContain(`The ACA premium tax credit is not priced in ${expected!.acaYears[0]}`)
      }
    }, 120_000)
  }
})
