import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { nextBalanceGuardrailMultiplier, nextGuardrailMultiplier, type GuardrailPolicy } from './guardrails.js'

describeCalculation(
  'withdrawal-rate-guardrail-step',
  {
    example: {
      inputs: { prevMultiplier: 0.8, currentRatePct: 6, startingRatePct: 4, upperGuardrailPct: 120, adjustmentPct: 10 },
      expected: { multiplier: 0.7, action: 'cut' },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/withdrawal-rate-guardrail-step.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/withdrawal-rate-guardrail-step.mutation.md',
  },
  ({ example }) => {
    const prev = example.inputs.prevMultiplier as number
    // The ledger passes the rates as ratios (target spending over the
    // start-of-year portfolio), so the worksheet's 6% and 4% enter as 0.06 and
    // 0.04; only their ratio, 1.5, reaches the band comparison.
    const currentRate = (example.inputs.currentRatePct as number) / 100
    const startingRate = (example.inputs.startingRatePct as number) / 100
    const policy: GuardrailPolicy = {
      upperGuardrailPct: example.inputs.upperGuardrailPct as number,
      adjustmentPct: example.inputs.adjustmentPct as number,
    }

    it('cuts the discretionary multiplier from 0.8 to 0.7 when a 6% rate exceeds 120% of the 4% starting rate', () => {
      const decision = nextGuardrailMultiplier(prev, currentRate, startingRate, policy)
      const expected = example.expected.multiplier as number
      expect(
        withinTolerance(decision.multiplier, expected, example.tolerance),
        `multiplier ${decision.multiplier} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
      expect(decision.action).toBe(example.expected.action)
    })

    it('holds inside the band: 4.5% against 4% is 112.5% of the starting rate', () => {
      const decision = nextGuardrailMultiplier(prev, 0.045, startingRate, policy)
      expect(decision.multiplier).toBe(prev)
      expect(decision.action).toBe('hold')
    })

    it('reports hold, not cut, when the zero floor absorbs the step', () => {
      // The claim's clamp: a multiplier already at 0 cannot fall further, and
      // downstream counts see no adjustment.
      const decision = nextGuardrailMultiplier(0, currentRate, startingRate, policy)
      expect(decision.multiplier).toBe(0)
      expect(decision.action).toBe('hold')
    })
  },
)

describeCalculation(
  'balance-risk-guardrail-step',
  {
    example: {
      inputs: {
        prevMultiplier: 0.8,
        currentRealBalance: 70,
        startingBalance: 100,
        lowerBalanceThresholdPct: 80,
        adjustmentPct: 10,
      },
      expected: { multiplier: 0.7, action: 'cut' },
      tolerance: { abs: 1e-12 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/balance-risk-guardrail-step.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/balance-risk-guardrail-step.mutation.md',
  },
  ({ example }) => {
    const prev = example.inputs.prevMultiplier as number
    const currentRealBalance = example.inputs.currentRealBalance as number
    const startingBalance = example.inputs.startingBalance as number
    const adjustmentPct = example.inputs.adjustmentPct as number
    const policy: GuardrailPolicy = {
      lowerBalanceThresholdPct: example.inputs.lowerBalanceThresholdPct as number,
      adjustmentPct,
    }

    it('cuts from 0.8 to 0.7 when the $70 real balance falls below the $80 lower threshold', () => {
      const decision = nextBalanceGuardrailMultiplier(prev, currentRealBalance, startingBalance, policy)
      const expected = example.expected.multiplier as number
      expect(
        withinTolerance(decision.multiplier, expected, example.tolerance),
        `multiplier ${decision.multiplier} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expected}`,
      ).toBe(true)
      expect(decision.action).toBe(example.expected.action)
    })

    it('holds when no threshold has been solved', () => {
      // The claim's degenerate case: a risk-based policy without thresholds
      // must not invent a trigger.
      const decision = nextBalanceGuardrailMultiplier(prev, currentRealBalance, startingBalance, { adjustmentPct })
      expect(decision.multiplier).toBe(prev)
      expect(decision.action).toBe('hold')
    })

    it('holds on an inverted pair whose lower threshold is not below its upper', () => {
      const decision = nextBalanceGuardrailMultiplier(prev, currentRealBalance, startingBalance, {
        lowerBalanceThresholdPct: 90,
        upperBalanceThresholdPct: 80,
        adjustmentPct,
      })
      expect(decision.multiplier).toBe(prev)
      expect(decision.action).toBe('hold')
    })
  },
)
