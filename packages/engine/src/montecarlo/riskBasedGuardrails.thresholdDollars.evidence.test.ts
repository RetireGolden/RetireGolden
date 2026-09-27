import { expect, it } from 'vitest'

import type { Plan } from '../model/plan.js'
import { describeCalculation } from '../rules/describeCalculation.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { cashAccount, runPlan, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { balanceThresholdPct, guardrailThresholdDollars, solveRiskBasedGuardrails } from './riskBasedGuardrails.js'

/** The IEEE 754 bits of a double, as sixteen hex digits. */
function bitsOf(value: number): string {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value)
  return view.getBigUint64(0).toString(16).padStart(16, '0')
}

/** A single filer with the given cash balances, in plan order, and a risk-based (or fixed-target) policy. */
function planWith(
  balances: readonly number[],
  policy: { lower?: number; upper?: number; mode?: 'riskBasedGuardrails' | 'fixedTarget' },
): Plan {
  const plan = singlePersonPlan({ dob: '1961-06-15', planningAge: 90 })
  plan.accounts = balances.map((balance, index) => cashAccount(`cash-${index}`, balance))
  plan.expenses.baseAnnual = 40_000
  plan.expenses.requiredAnnual = 20_000
  plan.expenses.spendingPolicy =
    policy.mode === 'fixedTarget'
      ? { mode: 'fixedTarget' }
      : {
          mode: 'riskBasedGuardrails',
          ...(policy.lower === undefined ? {} : { lowerBalanceThresholdPct: policy.lower }),
          ...(policy.upper === undefined ? {} : { upperBalanceThresholdPct: policy.upper }),
        }
  return validatePlan(plan)
}

/** The solver on an analytic success curve through its test seam (no Monte Carlo runs). */
function solveOnCurve(plan: Plan, successProbe: (f: number, m: number) => number, lowerBandPct: number, upperBandPct: number) {
  return solveRiskBasedGuardrails(plan, {
    startYear: 2026,
    taxCalculator: undefined as never,
    model: { type: 'lognormal', inflationMeanPct: 2.5 },
    pathCount: 1,
    seed: 1,
    lowerBandPct,
    upperBandPct,
    successProbe,
  })
}

describeCalculation(
  'guardrail-threshold-dollars',
  {
    example: {
      inputs: {
        caseA: { balances: [500_000], successProbe: 'min(1, f / (2m))', band: [70, 95] },
        caseB: { balances: [812_345.67, 422_222.22], lower: 63.47, upper: 148.05 },
        caseC: { balances: [0, 0], lower: 80, upper: 150 },
        caseD: { balances: [812_345.67, 422_222.22], lower: 63.47 },
        caseE: { balances: [500_000] },
        caseF: { balances: [500_000], lower: 60, upper: 60 },
        caseG: { balances: [812_345.67, 422_222.22], lower: 63.47, upper: 148.05 },
        caseH: { balances: [500_000], lower: 50.03, upper: 150.02 },
        ties: { k192Below: 0.76624, k64Below: 0.2687 },
        ledgerPin: { balances: [500_000], upper: 400, cutAt: 100.01, holdAt: 99.99 },
      },
      expected: {
        caseA: { lowerPct: 140.37, upperPct: 190.12, base: 500_000, lower: 701_850, upper: 950_600, lowerBits: '41256b3400000000' },
        caseB: { base: 1_234_567.8900000001, lower: 783_580.2397830001, upper: 1_827_777.7611450003 },
        caseC: { lowerPct: 80, upperPct: 150 },
        caseD: { base: 1_234_567.8900000001, lower: 783_580.2397830001 },
        caseF: { base: 500_000, lower: 300_000, upper: 300_000 },
        caseH: { lower: 250_149.99999999997, upper: 750_100.0000000001, otherLower: 250_150, otherUpper: 750_100 },
        ties: { k192: 76.62, k64: 26.88 },
        retiredSolverDollars: { lower: 701_835.9374999999, upper: 950_585.9374999999 },
      },
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/display-guardrail-balance-thresholds.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/display-guardrail-balance-thresholds.mutation.md',
  },
  ({ example }) => {
    type Case = { balances: number[]; lower?: number; upper?: number; band?: [number, number] }
    const inputs = example.inputs as Record<string, Case>
    const expected = example.expected as Record<string, Record<string, number | string>>

    it('case A: the solver persists 140.37 and 190.12, which act at $701,850 and $950,600 on $500,000', () => {
      const a = inputs.caseA!
      const e = expected.caseA!
      const solved = solveOnCurve(planWith(a.balances, {}), (f, m) => Math.min(1, f / (2 * m)), a.band![0], a.band![1])
      expect(solved.lower!.balancePct).toBe(e.lowerPct)
      expect(solved.upper!.balancePct).toBe(e.upperPct)
      const persisted = planWith(a.balances, { lower: solved.lower!.balancePct, upper: solved.upper!.balancePct })
      expect(guardrailThresholdDollars(persisted)).toEqual({
        status: 'anchored',
        base: e.base,
        lower: e.lower,
        upper: e.upper,
        acts: true,
      })
      const published = guardrailThresholdDollars(persisted) as { lower: number }
      expect(bitsOf(published.lower)).toBe(e.lowerBits)
      // The retired solver dollars, the fraction times the balance, never acted.
      expect(solved.lower!.balanceFrac * a.balances[0]!).toBe(expected.retiredSolverDollars!.lower)
      expect(solved.upper!.balanceFrac * a.balances[0]!).toBe(expected.retiredSolverDollars!.upper)
    })

    it('cases B and D: (percent / 100) × the balances in plan order, to the bit', () => {
      const b = inputs.caseB!
      expect(guardrailThresholdDollars(planWith(b.balances, { lower: b.lower!, upper: b.upper! }))).toEqual({
        status: 'anchored',
        ...expected.caseB,
        acts: true,
      })
      const d = inputs.caseD!
      expect(guardrailThresholdDollars(planWith(d.balances, { lower: d.lower! }))).toEqual({
        status: 'anchored',
        ...expected.caseD,
        upper: null,
        acts: true,
      })
    })

    it('case C: with no starting balance only the percents are published', () => {
      const c = inputs.caseC!
      expect(guardrailThresholdDollars(planWith(c.balances, { lower: c.lower!, upper: c.upper! }))).toEqual({
        status: 'no-starting-portfolio',
        ...expected.caseC,
      })
    })

    it('case H: the association is (percent / 100) × base, which the other order misses in the last digit', () => {
      const h = inputs.caseH!
      const e = expected.caseH!
      const published = guardrailThresholdDollars(planWith(h.balances, { lower: h.lower!, upper: h.upper! }))
      expect(published).toEqual({ status: 'anchored', base: 500_000, lower: e.lower, upper: e.upper, acts: true })
      expect((h.lower! * h.balances[0]!) / 100).toBe(e.otherLower)
      expect((h.upper! * h.balances[0]!) / 100).toBe(e.otherUpper)
      expect(e.lower).not.toBe(e.otherLower)
      expect(e.upper).not.toBe(e.otherUpper)
    })

    it('cases E, F and G: unsolved, an inverted pair that never acts, and a policy that is not risk-based', () => {
      expect(guardrailThresholdDollars(planWith(inputs.caseE!.balances, {}))).toEqual({ status: 'unsolved' })
      const f = inputs.caseF!
      expect(guardrailThresholdDollars(planWith(f.balances, { lower: f.lower!, upper: f.upper! }))).toEqual({
        status: 'anchored',
        ...expected.caseF,
        acts: false,
      })
      const g = inputs.caseG!
      expect(guardrailThresholdDollars(planWith(g.balances, { lower: g.lower!, upper: g.upper!, mode: 'fixedTarget' }))).toBeNull()
    })

    it('rounds in floating point: the solver reaches k = 192 a hair below the half and persists 76.62; k = 64 rounds up to 26.88', () => {
      const ties = example.inputs.ties as { k192Below: number; k64Below: number }
      const plan = planWith([500_000], {})
      for (const [key, below] of [['k192', ties.k192Below], ['k64', ties.k64Below]] as const) {
        const solved = solveOnCurve(plan, (f) => (f >= below ? 1 : 0), 50, 60)
        expect(solved.lower!.balancePct, key).toBe(expected.ties![key])
        expect(balanceThresholdPct(solved.lower!.balanceFrac), key).toBe(expected.ties![key])
      }
      expect(() => balanceThresholdPct(0)).toThrow(RangeError)
      expect(() => balanceThresholdPct(Number.NaN)).toThrow(RangeError)
    })

    it('the ledger acts on this base: a cut threshold at 100.01 percent cuts in the first year, 99.99 holds', () => {
      const pin = example.inputs.ledgerPin as { balances: number[]; upper: number; cutAt: number; holdAt: number }
      const noTax = createFlatTaxCalculator(0)
      const cut = runPlan(planWith(pin.balances, { lower: pin.cutAt, upper: pin.upper }), noTax)
      const hold = runPlan(planWith(pin.balances, { lower: pin.holdAt, upper: pin.upper }), noTax)
      expect(cut.years[0]!.guardrailAction).toBe('cut')
      expect(hold.years[0]!.guardrailAction).toBe('hold')
    })
  },
)
