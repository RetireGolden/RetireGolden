import { expect, it, vi } from 'vitest'

import { startingInvestableOf } from '../montecarlo/riskBasedGuardrails.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { noTraditionalPlan, simOptions } from '../testing/decisionFixtures.js'
import * as evaluation from './evaluateCandidate.js'
import { initialWithdrawalRatePct, solveMaxSustainableSpending } from './spendingSolver.js'

/** The IEEE 754 bits of a double, as sixteen hex digits. */
function bitsOf(value: number): string {
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value)
  return view.getBigUint64(0).toString(16).padStart(16, '0')
}

describeCalculation(
  'solved-initial-withdrawal-rate',
  {
    example: {
      inputs: {
        caseA: { maxBaseAnnual: 62_800, startingInvestable: 1_500_000 },
        caseB: { maxBaseAnnual: 40_000, startingInvestable: 1_000_000 },
        caseC: { maxBaseAnnual: 41_200, startingInvestable: 800_000 },
        caseD: { maxBaseAnnual: 62_800, startingInvestable: 0 },
        caseE: { maxBaseAnnual: 0, startingInvestable: 750_000 },
        caseF: { maxBaseAnnual: 33_300, startingInvestable: 612_345.67 },
      },
      expected: {
        caseA: 4.186666666666667,
        caseB: 4,
        caseC: 5.1499999999999995,
        caseD: null,
        caseE: 0,
        caseF: 5.438104918746302,
        bitsA: '4010bf258bf258c0',
        bitsC: '4014999999999999',
        printed: { caseA: '4.19', caseB: '4.00', caseC: '5.15', caseE: '0.00', caseF: '5.44' },
        otherAssociationA: 4.1866666666666665,
      },
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/solved-initial-withdrawal-rate-pct.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/solved-initial-withdrawal-rate-pct.mutation.md',
  },
  ({ example }) => {
    type Case = { maxBaseAnnual: number; startingInvestable: number }
    const inputs = example.inputs as Record<string, Case>
    const expected = example.expected as Record<string, unknown>

    it('cases A to F: (annual spend / starting investable) × 100, in that association, to the bit', () => {
      for (const key of ['caseA', 'caseB', 'caseC', 'caseE', 'caseF'] as const) {
        const c = inputs[key]!
        const rate = initialWithdrawalRatePct(c.maxBaseAnnual, c.startingInvestable)
        expect(rate !== null && withinTolerance(rate, expected[key] as number, example.tolerance), `${key}: ${rate}`).toBe(true)
        expect(rate!.toFixed(2)).toBe((expected.printed as Record<string, string>)[key])
      }
      expect(bitsOf(initialWithdrawalRatePct(inputs.caseA!.maxBaseAnnual, inputs.caseA!.startingInvestable)!)).toBe(expected.bitsA)
      expect(bitsOf(initialWithdrawalRatePct(inputs.caseC!.maxBaseAnnual, inputs.caseC!.startingInvestable)!)).toBe(expected.bitsC)
    })

    it('case D: no starting balance, no rate', () => {
      const c = inputs.caseD!
      expect(initialWithdrawalRatePct(c.maxBaseAnnual, c.startingInvestable)).toBe(expected.caseD)
    })

    it('rejects the other association, one unit in the last place off in case A', () => {
      const c = inputs.caseA!
      expect((c.maxBaseAnnual * 100) / c.startingInvestable).toBe(expected.otherAssociationA)
      expect(initialWithdrawalRatePct(c.maxBaseAnnual, c.startingInvestable)).not.toBe(expected.otherAssociationA)
    })

    it('is what the solver publishes for its rounded answer over the balances of the plan it solved', () => {
      const plan = noTraditionalPlan()
      plan.expenses.baseAnnual = 40_000
      const ctx = evaluation.createDecisionContext(plan, simOptions())
      const reference = evaluation.evaluateCandidate(ctx, {
        id: 'worksheet-shape', source: 'search', category: 'spending', label: 'Fixture shape', explanation: 'Schema scaffolding only',
      })
      const spy = vi.spyOn(evaluation, 'evaluateCandidate').mockImplementation((_ctx, candidate) => {
        const amount = (candidate.planPatch!['expenses'] as { baseAnnual: number }).baseAnnual
        return {
          ...reference,
          recommendationState: 'beneficial',
          candidateResult: { ...reference.candidateResult, depletionYear: amount <= 62_850 ? null : 2030 },
          candidateSummary: { ...reference.candidateSummary, endingAfterTaxEstate: 0 },
        }
      })
      try {
        const result = solveMaxSustainableSpending(ctx, { resolutionDollars: 500 })
        expect(result.maxBaseAnnual).toBe(62_800)
        expect(result.initialWithdrawalRatePct).toBe((62_800 / startingInvestableOf(plan)) * 100)
        // Not the rate on the passing probe (the worksheet's first wrong reading).
        expect(result.initialWithdrawalRatePct).not.toBe((62_813 / startingInvestableOf(plan)) * 100)
      } finally {
        spy.mockRestore()
      }
    })
  },
)
