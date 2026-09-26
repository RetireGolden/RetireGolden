import { expect, it } from 'vitest'
import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { describeCalculation, withinTolerance, type CalculationTolerance } from '../rules/describeCalculation.js'
import { solveRiskBasedGuardrails, startingInvestableOf } from './riskBasedGuardrails.js'

let counter = 0
const testIds = () => `b1p4-mc-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

function taxable(balance: number): Account {
  return {
    type: 'taxable',
    id: testIds(),
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance,
    costBasis: balance,
    annualContribution: 0,
  }
}

function cash(balance: number): Account {
  return {
    type: 'cash',
    id: testIds(),
    name: 'Cash',
    ownerPersonId: null,
    annualReturnPct: null,
    balance,
    annualContribution: 0,
  }
}

function home(value: number): Account {
  return {
    type: 'property',
    id: testIds(),
    name: 'Home',
    ownerPersonId: null,
    annualReturnPct: null,
    value,
    plannedSaleYear: null,
    expectedNetProceeds: null,
  }
}

function planOf(accounts: Account[]): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.accounts = accounts
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describeCalculation(
  'risk-based-starting-investable',
  {
    example: {
      inputs: { taxable: 100_000, cash: 20_000, home: 300_000 },
      expected: { startingInvestable: 120_000 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/monte-carlo/risk-based-starting-investable.md',
    mutation: 'DOCS/calculations/monte-carlo/risk-based-starting-investable.mutation.md',
  },
  ({ example }) => {
    it('sums taxable $100,000 and cash $20,000; the $300,000 home is excluded', () => {
      const plan = planOf([
        taxable(example.inputs.taxable as number),
        cash(example.inputs.cash as number),
        home(example.inputs.home as number),
      ])
      expect(startingInvestableOf(plan)).toBe(example.expected.startingInvestable)
    })
  },
)

/**
 * The solver's thresholds and suggested adjustments against an analytic success curve
 * (D-SOLVER-SEAM, decided 2026-09-25). The optional successProbe replaces each Monte Carlo
 * run with S(f, m) = min(1, f / (2m)), which is nondecreasing in the balance scale f and
 * nonincreasing in the spending multiplier m, as shared-path success is. Every expected value
 * below is derived by hand in the worksheet: the ten-step balance lattice 0.02 + k · 3.98/1024,
 * the eight-step spending lattices, and the probe count. No Monte Carlo runs, so the plan's tax
 * calculator and market model are never read; the placeholders below only satisfy the types.
 */
describeCalculation(
  'risk-based-guardrail-threshold-solver',
  {
    example: {
      inputs: {
        taxable: 500_000,
        baseAnnual: 40_000,
        lowerBandPct: 70,
        upperBandPct: 95,
        successProbe: 'min(1, f / (2m))',
      },
      expected: {
        successAtCurrent: 0.5,
        lowerLatticeIndex: 356,
        upperLatticeIndex: 484,
        lowerBalanceFrac: 1.403671875,
        upperBalanceFrac: 1.901171875,
        lowerBalanceDollars: 701_835.9375,
        upperBalanceDollars: 950_585.9375,
        cutMultiplier: 0.849609375,
        cutAnnualDollars: 6_015.625,
        cutMonthlyDollars: 501.3020833333333,
        cutSuccessAfter: 0.8260689655172412,
        raiseMultiplier: 1.1484375,
        raiseAnnualDollars: 5_937.5,
        raiseMonthlyDollars: 494.7916666666667,
        raiseSuccessAfter: 0.8277210884353741,
        probeCalls: 40,
      },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/monte-carlo/risk-based-guardrail-threshold-solver.md',
    mutation: 'DOCS/calculations/monte-carlo/risk-based-guardrail-threshold-solver.mutation.md',
  },
  ({ example }) => {
    const expected = example.expected as Record<string, number>
    const DOLLARS: CalculationTolerance = { abs: 1e-6 }
    const STEP = 3.98 / 1024

    function solve(successProbe: (f: number, m: number) => number, onProbeDone?: (done: number, total: number) => void) {
      const plan = planOf([taxable(example.inputs.taxable as number)])
      plan.expenses.baseAnnual = example.inputs.baseAnnual as number
      return solveRiskBasedGuardrails(plan, {
        startYear: 2026,
        // Never read when a successProbe is given: no Monte Carlo run happens.
        taxCalculator: undefined as never,
        model: { type: 'lognormal', inflationMeanPct: 2.5 },
        pathCount: 1,
        seed: 1,
        lowerBandPct: example.inputs.lowerBandPct as number,
        upperBandPct: example.inputs.upperBandPct as number,
        successProbe,
        ...(onProbeDone ? { onProbeDone } : {}),
      })
    }

    function expectWithin(actual: number, target: number, label: string, tolerance: CalculationTolerance = example.tolerance): void {
      expect(withinTolerance(actual, target, tolerance), `${label} ${actual} is not within ${JSON.stringify(tolerance)} of ${target}`).toBe(true)
    }

    const analytic = (f: number, m: number) => Math.min(1, f / (2 * m))

    it('edges at k = 356 and 484 on 0.02 + k · 3.98/1024: 1.403671875 ($701,835.9375) and 1.901171875 ($950,585.9375)', () => {
      const solution = solve(analytic)
      expect(solution.successAtCurrent).toBe(expected.successAtCurrent)
      expect(solution.lowerOutcome).toBe('solved')
      expect(solution.upperOutcome).toBe('solved')
      expect(Math.round((solution.lower!.balanceFrac - 0.02) / STEP)).toBe(expected.lowerLatticeIndex)
      expect(Math.round((solution.upper!.balanceFrac - 0.02) / STEP)).toBe(expected.upperLatticeIndex)
      expectWithin(solution.lower!.balanceFrac, expected.lowerBalanceFrac!, 'lower balanceFrac')
      expectWithin(solution.upper!.balanceFrac, expected.upperBalanceFrac!, 'upper balanceFrac')
      expectWithin(solution.lower!.balanceDollars, expected.lowerBalanceDollars!, 'lower balanceDollars', DOLLARS)
      expectWithin(solution.upper!.balanceDollars, expected.upperBalanceDollars!, 'upper balanceDollars', DOLLARS)
      expectWithin(solution.lower!.successAtThreshold, expected.lowerBalanceFrac! / 2, 'lower successAtThreshold')
      expectWithin(solution.upper!.successAtThreshold, expected.upperBalanceFrac! / 2, 'upper successAtThreshold')
    })

    it('cut 0.849609375 ($501.3020833333333 a month) and raise 1.1484375 ($494.7916666666667 a month)', () => {
      const solution = solve(analytic)
      const cut = solution.suggestedCut!
      const raise = solution.suggestedRaise!
      expectWithin(cut.spendingMultiplier, expected.cutMultiplier!, 'cut multiplier')
      expectWithin(cut.annualDollars, expected.cutAnnualDollars!, 'cut annualDollars', DOLLARS)
      expectWithin(cut.monthlyDollars, expected.cutMonthlyDollars!, 'cut monthlyDollars', DOLLARS)
      expectWithin(cut.successAfter, expected.cutSuccessAfter!, 'cut successAfter')
      expectWithin(raise.spendingMultiplier, expected.raiseMultiplier!, 'raise multiplier')
      expectWithin(raise.annualDollars, expected.raiseAnnualDollars!, 'raise annualDollars', DOLLARS)
      expectWithin(raise.monthlyDollars, expected.raiseMonthlyDollars!, 'raise monthlyDollars', DOLLARS)
      expectWithin(raise.successAfter, expected.raiseSuccessAfter!, 'raise successAfter')
    })

    it('follows the worksheet\'s bisection paths and calls the probe 40 times, reporting progress up to (40, 41)', () => {
      const calls: [number, number][] = []
      const progress: [number, number][] = []
      solve(
        (f, m) => {
          calls.push([f, m])
          return analytic(f, m)
        },
        (done, total) => progress.push([done, total]),
      )
      expect(calls).toHaveLength(expected.probeCalls!)
      expect(progress.at(-1)).toEqual([expected.probeCalls, 41])
      const latticeIndex = (f: number) => Math.round((f - 0.02) / STEP)
      // Call 1 is successAtCurrent at f = 1. Then the lower edge: both ends, then ten mids.
      expect(calls[0]).toEqual([1, 1])
      expect(calls.slice(1, 13).map(([f]) => latticeIndex(f))).toEqual([0, 1024, 512, 256, 384, 320, 352, 368, 360, 356, 354, 355])
      // The upper edge reuses the cached ends and mids 512, 256 and 384.
      expect(calls.slice(13, 20).map(([f]) => latticeIndex(f))).toEqual([448, 480, 496, 488, 484, 482, 483])
      expect(calls.slice(1, 20).every(([, m]) => m === 1)).toBe(true)
      // The cut: best case at m = 0.3, eight mids on 0.3 + j · 0.7/256, then successAfter at j = 201.
      const cutIndex = (m: number) => Math.round((m - 0.3) / (0.7 / 256))
      expect(calls.slice(20, 30).map(([, m]) => cutIndex(m))).toEqual([0, 128, 192, 224, 208, 200, 204, 202, 201, 201])
      // The raise: best case at m = 2, eight mids on 1 + j/256, then successAfter at j = 38.
      expect(calls.slice(30, 40).map(([, m]) => Math.round((m - 1) * 256))).toEqual([256, 128, 64, 32, 48, 40, 36, 38, 39, 38])
    })

    it('reports always-above-band and never-reaches-band without a threshold, and refuses a probe value outside [0, 1]', () => {
      const safe = solve(() => 0.99)
      expect([safe.lowerOutcome, safe.upperOutcome]).toEqual(['always-above-band', 'always-above-band'])
      expect([safe.lower, safe.upper, safe.suggestedCut, safe.suggestedRaise]).toEqual([null, null, null, null])
      const underfunded = solve((f) => Math.min(1, f / 10))
      expect([underfunded.lowerOutcome, underfunded.upperOutcome]).toEqual(['never-reaches-band', 'never-reaches-band'])
      for (const bad of [1.5, -0.1, Number.NaN]) {
        expect(() => solve(() => bad)).toThrow(
          new RangeError(
            `successProbe returned ${bad} at balanceFrac 1, spendingMultiplier 1; a success probability must be a finite number from 0 to 1.`,
          ),
        )
      }
    })
  },
)
