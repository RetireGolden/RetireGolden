import { expect, it } from 'vitest'

import { asAccountId } from '../actions/identity.js'
import { describeCalculation } from '../rules/describeCalculation.js'
import {
  CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS,
  CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS,
} from './annualCashFlowCapture.js'
import { cashFlowLineIds } from './annualCashFlowIds.js'
import { reconcileYearCashFlow } from './annualCashFlowReconciliation.js'
import type { YearCashFlowSourceLine, YearCashFlowUseLine } from './types.js'

const BROKERAGE = asAccountId('brokerage')

/** The worksheet's source lines, in published order, with the role each carries. */
function sourceLines(amounts: {
  spendable: readonly number[]
  portfolio: number
  loan: number
}): YearCashFlowSourceLine[] {
  const spendable = (property: string, amount: number): YearCashFlowSourceLine => ({
    id: cashFlowLineIds.sourcePropertySaleProceeds(property),
    kind: 'propertySaleProceeds',
    role: 'spendableSource',
    amountPlanDollars: amount,
    identities: [{ entityKind: 'propertyAccount', propertyAccountId: asAccountId(property) }],
  })
  return [
    spendable('home', amounts.spendable[0]!),
    {
      id: cashFlowLineIds.sourceNeedBasedPortfolioWithdrawal('brokerage'),
      kind: 'needBasedPortfolioWithdrawal',
      role: 'portfolioFunding',
      amountPlanDollars: amounts.portfolio,
      identities: [{ entityKind: 'account', accountId: BROKERAGE }],
    },
    spendable('cabin', amounts.spendable[1]!),
    {
      id: cashFlowLineIds.sourceHecmBackstopDraw('home'),
      kind: 'hecmBackstopDraw',
      role: 'loanProceeds',
      amountPlanDollars: amounts.loan,
      identities: [{ entityKind: 'propertyAccount', propertyAccountId: asAccountId('home') }],
    },
    spendable('lot', amounts.spendable[2]!),
  ]
}

/** One use line per unfunded amount, fully requested, funded where not unfunded. */
function useLines(unfunded: readonly number[]): YearCashFlowUseLine[] {
  const ids = [
    cashFlowLineIds.useRequiredLifestyle(),
    cashFlowLineIds.useTargetLifestyle(),
    cashFlowLineIds.useIdealLifestyle(),
    cashFlowLineIds.useExcessLifestyle(),
    cashFlowLineIds.useHealthcare(),
  ]
  const kinds = ['requiredLifestyle', 'targetLifestyle', 'idealLifestyle', 'excessLifestyle', 'healthcare'] as const
  return unfunded.map((amount, index) => ({
    id: ids[index]!,
    kind: kinds[index]!,
    requestedPlanDollars: 1_000 + amount,
    fundedPlanDollars: 1_000,
    unfundedPlanDollars: amount,
    identities: [],
  }))
}

describeCalculation(
  'cash-flow-drilldown-amounts',
  {
    example: {
      inputs: {
        spendable: [41_234.11, 3_000.3, 12.07],
        portfolio: 17_890.2,
        loan: 0,
        unfunded: [0, 1_500.25, 0, 300.5, 0.1],
      },
      expected: {
        hub: 62_136.68000000001,
        retiredLineOrderSum: 62_136.68,
        unfunded: 1_800.85,
        printedHub: 62_137,
      },
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/cash-flow-line-amount.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/cash-flow-line-amount.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as { spendable: number[]; portfolio: number; loan: number; unfunded: number[] }
    const expected = example.expected as Record<string, number>

    function reconcile() {
      return reconcileYearCashFlow({
        sourceLines: sourceLines(inputs),
        useLines: useLines(inputs.unfunded),
        transferLines: [],
        taxCharacterMetadata: [],
        tolerancePlanDollars: CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS,
        cashIdentityTolerancePlanDollars: CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS,
      })
    }

    it('the Household cash node is the cash identity source total, (spendable + portfolio) + loans by role', () => {
      const hub = reconcile().cash.sourceTotalPlanDollars
      expect(hub).toBe(expected.hub)
      // The chart used to add the lines in published order; that sum differs in the last digit only.
      const lines = sourceLines(inputs)
      let lineOrder = 0
      for (const line of lines) lineOrder += line.amountPlanDollars
      expect(lineOrder).toBe(expected.retiredLineOrderSum)
      expect(lineOrder).not.toBe(hub)
      expect(Math.abs(hub - lineOrder)).toBeLessThan(1e-9)
      expect(Math.round(hub)).toBe(expected.printedHub)
      expect(Math.round(lineOrder)).toBe(expected.printedHub)
    })

    it('the Unfunded node is the use identity unfunded total, the same as the positive lines added', () => {
      const unfunded = reconcile().uses.unfundedUsesPlanDollars
      expect(unfunded).toBe(expected.unfunded)
      let positive = 0
      for (const amount of inputs.unfunded) if (amount > 0) positive += amount
      expect(positive).toBe(unfunded)
    })
  },
)
