import { expect, it } from 'vitest'

import { asAccountId } from '../actions/identity.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import {
  CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS,
  CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS,
} from './annualCashFlowCapture.js'
import { cashFlowLineIds } from './annualCashFlowIds.js'
import { reconcileYearCashFlow } from './annualCashFlowReconciliation.js'
import type {
  YearCashFlowReconciliation,
  YearCashFlowSourceLine,
  YearCashFlowTransferLine,
  YearCashFlowUseLine,
} from './types.js'

const BROKERAGE = asAccountId('brokerage')
const PROPERTY = asAccountId('home')

function reconcile(opts: {
  sourceLines?: readonly YearCashFlowSourceLine[]
  useLines?: readonly YearCashFlowUseLine[]
  transferLines?: readonly YearCashFlowTransferLine[]
  cashIdentityTolerancePlanDollars?: number
}): YearCashFlowReconciliation {
  return reconcileYearCashFlow({
    sourceLines: opts.sourceLines ?? [],
    useLines: opts.useLines ?? [],
    transferLines: opts.transferLines ?? [],
    taxCharacterMetadata: [],
    tolerancePlanDollars: CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS,
    cashIdentityTolerancePlanDollars:
      opts.cashIdentityTolerancePlanDollars ?? CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS,
  })
}

describeCalculation(
  'cash-flow-reconciliation-totals',
  {
    example: {
      inputs: {
        spendableSources: 65_000,
        portfolioFunding: 25_000.004,
        loanProceeds: 10_000,
        fundedHouseholdUses: 70_000,
        settledTax: 12_000,
        penalties: 1_000,
        contributions: 7_000,
        surplusInvestment: 10_000,
        requestedUses: 93_000,
        fundedUses: 90_000,
        unfundedUses: 3_000,
        transferDebits: 22_500,
        transferCredits: 22_500,
      },
      expected: {
        cashSourceTotal: 100_000.004,
        cashDestinationTotal: 100_000,
        cashDifference: 0.004,
        useDispositionTotal: 93_000,
        useDifference: 0,
        transferDifference: 0,
        cashIdentityTolerance: 0.005,
        structuralTolerance: 0.000001,
        addedTransferSidesWrongReading: 45_000,
        withoutSurplusDestinationWrongReading: 90_000,
        subtractedUnfundedDispositionWrongReading: 87_000,
      },
      tolerance: { abs: 0.000001 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/cash-flow-reconciliation-totals.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/cash-flow-reconciliation-totals.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    function expectWithin(actual: number, target: number, label: string): void {
      expect(
        withinTolerance(actual, target, example.tolerance),
        `${label} ${actual} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${target}`,
      ).toBe(true)
    }

    /**
     * The three identities are asserted on three separate line sets. They
     * cannot share one: the worksheet's $100,000 cash destination total is the
     * funded amount of the very use lines whose funded total it states as
     * $90,000, so no single captured year can carry both figures.
     */
    function cashIdentityLines(): {
      sourceLines: YearCashFlowSourceLine[]
      useLines: YearCashFlowUseLine[]
    } {
      return {
        sourceLines: [
          {
            id: cashFlowLineIds.sourcePropertySaleProceeds('home'),
            kind: 'propertySaleProceeds',
            role: 'spendableSource',
            amountPlanDollars: inputs.spendableSources!,
            identities: [{ entityKind: 'propertyAccount', propertyAccountId: PROPERTY }],
          },
          {
            id: cashFlowLineIds.sourceNeedBasedPortfolioWithdrawal('brokerage'),
            kind: 'needBasedPortfolioWithdrawal',
            role: 'portfolioFunding',
            amountPlanDollars: inputs.portfolioFunding!,
            identities: [{ entityKind: 'account', accountId: BROKERAGE }],
          },
          {
            id: cashFlowLineIds.sourceHecmBackstopDraw('home'),
            kind: 'hecmBackstopDraw',
            role: 'loanProceeds',
            amountPlanDollars: inputs.loanProceeds!,
            identities: [{ entityKind: 'propertyAccount', propertyAccountId: PROPERTY }],
          },
        ],
        useLines: [
          {
            id: cashFlowLineIds.useRequiredLifestyle(),
            kind: 'requiredLifestyle',
            requestedPlanDollars: inputs.fundedHouseholdUses!,
            fundedPlanDollars: inputs.fundedHouseholdUses!,
            unfundedPlanDollars: 0,
            identities: [],
          },
          {
            id: cashFlowLineIds.useSettledTax(),
            kind: 'settledTax',
            requestedPlanDollars: inputs.settledTax!,
            fundedPlanDollars: inputs.settledTax!,
            unfundedPlanDollars: 0,
            identities: [],
          },
          {
            id: cashFlowLineIds.usePenaltyHousehold('traditionalEarly'),
            kind: 'earlyWithdrawalPenalty',
            penaltyClass: 'traditionalEarly',
            requestedPlanDollars: inputs.penalties!,
            fundedPlanDollars: inputs.penalties!,
            unfundedPlanDollars: 0,
            identities: [],
          },
          {
            id: cashFlowLineIds.useContribution('brokerage'),
            kind: 'contribution',
            requestedPlanDollars: inputs.contributions!,
            fundedPlanDollars: inputs.contributions!,
            unfundedPlanDollars: 0,
            identities: [{ entityKind: 'account', accountId: BROKERAGE }],
          },
          {
            id: cashFlowLineIds.useSurplusUnassigned(),
            kind: 'surplusInvestment',
            requestedPlanDollars: inputs.surplusInvestment!,
            fundedPlanDollars: inputs.surplusInvestment!,
            unfundedPlanDollars: 0,
            identities: [],
          },
        ],
      }
    }

    it('accepts a 0.004 cash residual at the annual funding tolerance', () => {
      // The two tolerances are read from the capture module rather than
      // written in.
      expect(CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS).toBe(expected.cashIdentityTolerance)
      expect(CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS).toBe(expected.structuralTolerance)

      const { sourceLines, useLines } = cashIdentityLines()
      const result = reconcile({ sourceLines, useLines })
      expectWithin(result.cash.sourceTotalPlanDollars, expected.cashSourceTotal!, 'cash source total')
      expectWithin(result.cash.destinationTotalPlanDollars, expected.cashDestinationTotal!, 'cash destination total')
      expectWithin(result.cash.differencePlanDollars, expected.cashDifference!, 'cash difference')
      expect(result.reasonCodes).not.toContain('cashIdentityMismatch')

      // Surplus investment really is a destination member: dropping it would
      // leave the worksheet's second wrong reading.
      expectWithin(result.cash.surplusInvestmentPlanDollars, inputs.surplusInvestment!, 'surplus investment total')
      expect(
        withinTolerance(
          result.cash.destinationTotalPlanDollars,
          expected.withoutSurplusDestinationWrongReading!,
          example.tolerance,
        ),
      ).toBe(false)
    })

    it('rejects the same 0.004 residual at the strict structural tolerance', () => {
      // The worksheet's first wrong reading: judging cash conservation at the
      // 1e-6 bound the use and transfer identities are judged at.
      const { sourceLines, useLines } = cashIdentityLines()
      const result = reconcile({
        sourceLines,
        useLines,
        cashIdentityTolerancePlanDollars: CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS,
      })
      expect(result.reasonCodes).toContain('cashIdentityMismatch')
    })

    it('accepts a difference exactly at the bound, because only a strictly greater one fails', () => {
      const result = reconcile({
        sourceLines: [
          {
            id: cashFlowLineIds.sourcePropertySaleProceeds('home'),
            kind: 'propertySaleProceeds',
            role: 'spendableSource',
            amountPlanDollars: expected.cashIdentityTolerance!,
            identities: [{ entityKind: 'propertyAccount', propertyAccountId: PROPERTY }],
          },
        ],
      })
      expectWithin(result.cash.differencePlanDollars, expected.cashIdentityTolerance!, 'cash difference at the bound')
      expect(result.reasonCodes).not.toContain('cashIdentityMismatch')
    })

    it('adds funded and unfunded uses to the 93000 requested total', () => {
      const result = reconcile({
        useLines: [
          {
            id: cashFlowLineIds.useRequiredLifestyle(),
            kind: 'requiredLifestyle',
            requestedPlanDollars: inputs.requestedUses!,
            fundedPlanDollars: inputs.fundedUses!,
            unfundedPlanDollars: inputs.unfundedUses!,
            identities: [],
          },
        ],
      })
      expectWithin(result.uses.requestedUsesPlanDollars, inputs.requestedUses!, 'requested uses')
      expectWithin(result.uses.fundedUsesPlanDollars, inputs.fundedUses!, 'funded uses')
      expectWithin(result.uses.unfundedUsesPlanDollars, inputs.unfundedUses!, 'unfunded uses')
      expectWithin(result.uses.dispositionTotalPlanDollars, expected.useDispositionTotal!, 'use disposition total')
      expectWithin(result.uses.differencePlanDollars, expected.useDifference!, 'use difference')
      expect(result.reasonCodes).not.toContain('useIdentityMismatch')
      // The worksheet's third wrong reading: subtracting unfunded from funded.
      expect(
        withinTolerance(
          result.uses.dispositionTotalPlanDollars,
          expected.subtractedUnfundedDispositionWrongReading!,
          example.tolerance,
        ),
      ).toBe(false)
    })

    it('pairs 22500 of transfer debits against 22500 of credits for a zero difference', () => {
      const result = reconcile({
        transferLines: [
          {
            id: cashFlowLineIds.transferReinvestedYield('brokerage'),
            kind: 'reinvestedYield',
            source: { entityKind: 'accountYield', accountId: BROKERAGE },
            destination: { entityKind: 'account', accountId: BROKERAGE },
            debitPlanDollars: inputs.transferDebits!,
            creditPlanDollars: inputs.transferCredits!,
            identities: [{ entityKind: 'account', accountId: BROKERAGE }],
          },
        ],
      })
      expectWithin(result.transfers.debitsPlanDollars, inputs.transferDebits!, 'transfer debits')
      expectWithin(result.transfers.creditsPlanDollars, inputs.transferCredits!, 'transfer credits')
      expectWithin(result.transfers.differencePlanDollars, expected.transferDifference!, 'transfer difference')
      expect(result.reasonCodes).not.toContain('transferIdentityMismatch')
      // The worksheet's fourth wrong reading: adding the two paired sides.
      expect(
        withinTolerance(
          result.transfers.debitsPlanDollars,
          expected.addedTransferSidesWrongReading!,
          example.tolerance,
        ),
      ).toBe(false)
    })
  },
)
