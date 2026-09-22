import { expect, it } from 'vitest'

import { asAccountId, asPersonId } from '../actions/identity.js'
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
  YearCashFlowUseKind,
  YearCashFlowUseLine,
} from './types.js'

const BROKERAGE = asAccountId('brokerage')
const MORTGAGE = asAccountId('mortgage')
const IRA = asAccountId('ira')
const PROPERTY = asAccountId('home')
const PERSON = asPersonId('p1')

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

/** requested, funded and unfunded per use kind, in worksheet order. */
type UseAmounts = Record<YearCashFlowUseKind, readonly [number, number, number]>

describeCalculation(
  'cash-flow-reconciliation-totals',
  {
    example: {
      inputs: {
        spendableSources: 65_000,
        portfolioFunding: 25_000.004,
        loanProceeds: 10_000,
        useLines: {
          requiredLifestyle: [30_000, 30_000, 0],
          targetLifestyle: [11_000, 10_000, 1_000],
          idealLifestyle: [6_000, 5_000, 1_000],
          excessLifestyle: [2_000, 2_000, 0],
          oneTimeGoal: [6_000, 5_000, 1_000],
          debtService: [6_000, 6_000, 0],
          propertyCosts: [4_000, 4_000, 0],
          healthcare: [5_000, 5_000, 0],
          insurancePremium: [2_000, 2_000, 0],
          longTermCare: [1_000, 1_000, 0],
          settledTax: [12_000, 12_000, 0],
          earlyWithdrawalPenalty: [1_000, 1_000, 0],
          contribution: [7_000, 7_000, 0],
          surplusInvestment: [10_000, 10_000, 0],
        } satisfies UseAmounts,
        transferDebits: [5_500, 7_000, 10_000],
        transferCredits: [5_500, 7_000, 10_000],
      },
      expected: {
        cashSourceTotal: 100_000.004,
        fundedHouseholdUses: 70_000,
        settledTax: 12_000,
        penalties: 1_000,
        contributions: 7_000,
        surplusInvestment: 10_000,
        cashDestinationTotal: 100_000,
        cashDifference: 0.004,
        requestedUses: 103_000,
        fundedUses: 100_000,
        unfundedUses: 3_000,
        useDispositionTotal: 103_000,
        useDifference: 0,
        transferDebits: 22_500,
        transferCredits: 22_500,
        transferDifference: 0,
        cashIdentityTolerance: 0.005,
        structuralTolerance: 0.000001,
        firstDerivationFundedUsesWrongReading: 90_000,
        withoutSurplusDestinationWrongReading: 90_000,
        subtractedUnfundedDispositionWrongReading: 97_000,
        addedTransferSidesWrongReading: 45_000,
      },
      tolerance: { abs: 0.000001 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/cash-flow-reconciliation-totals.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/cash-flow-reconciliation-totals.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as {
      spendableSources: number
      portfolioFunding: number
      loanProceeds: number
      useLines: UseAmounts
      transferDebits: readonly number[]
      transferCredits: readonly number[]
    }
    const expected = example.expected as Record<string, number>

    function expectWithin(actual: number, target: number, label: string): void {
      expect(
        withinTolerance(actual, target, example.tolerance),
        `${label} ${actual} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${target}`,
      ).toBe(true)
    }

    /**
     * One line set carries all three identities, as the re-derived worksheet
     * states it: fourteen use lines, one per kind of the closed vocabulary,
     * three source lines and three paired transfers.
     */
    function lines(): {
      sourceLines: YearCashFlowSourceLine[]
      useLines: YearCashFlowUseLine[]
      transferLines: YearCashFlowTransferLine[]
    } {
      const u = inputs.useLines
      const use = (
        id: string,
        kind: YearCashFlowUseKind,
        identities: YearCashFlowUseLine['identities'],
        penaltyClass?: 'traditionalEarly',
      ): YearCashFlowUseLine => ({
        id: id as YearCashFlowUseLine['id'],
        kind,
        ...(penaltyClass === undefined ? {} : { penaltyClass }),
        requestedPlanDollars: u[kind][0],
        fundedPlanDollars: u[kind][1],
        unfundedPlanDollars: u[kind][2],
        identities,
      })
      return {
        sourceLines: [
          {
            id: cashFlowLineIds.sourcePropertySaleProceeds('home'),
            kind: 'propertySaleProceeds',
            role: 'spendableSource',
            amountPlanDollars: inputs.spendableSources,
            identities: [{ entityKind: 'propertyAccount', propertyAccountId: PROPERTY }],
          },
          {
            id: cashFlowLineIds.sourceNeedBasedPortfolioWithdrawal('brokerage'),
            kind: 'needBasedPortfolioWithdrawal',
            role: 'portfolioFunding',
            amountPlanDollars: inputs.portfolioFunding,
            identities: [{ entityKind: 'account', accountId: BROKERAGE }],
          },
          {
            id: cashFlowLineIds.sourceHecmBackstopDraw('home'),
            kind: 'hecmBackstopDraw',
            role: 'loanProceeds',
            amountPlanDollars: inputs.loanProceeds,
            identities: [{ entityKind: 'propertyAccount', propertyAccountId: PROPERTY }],
          },
        ],
        useLines: [
          use(cashFlowLineIds.useRequiredLifestyle(), 'requiredLifestyle', []),
          use(cashFlowLineIds.useTargetLifestyle(), 'targetLifestyle', []),
          use(cashFlowLineIds.useIdealLifestyle(), 'idealLifestyle', []),
          use(cashFlowLineIds.useExcessLifestyle(), 'excessLifestyle', []),
          use(cashFlowLineIds.useOneTimeGoal('trip'), 'oneTimeGoal', [{ entityKind: 'goal', goalId: 'trip' }]),
          use(cashFlowLineIds.useDebtService('mortgage'), 'debtService', [{ entityKind: 'account', accountId: MORTGAGE }]),
          use(cashFlowLineIds.usePropertyCosts('home'), 'propertyCosts', [{ entityKind: 'propertyAccount', propertyAccountId: PROPERTY }]),
          use(cashFlowLineIds.useHealthcare(), 'healthcare', []),
          use(cashFlowLineIds.useInsurancePremium('term'), 'insurancePremium', [{ entityKind: 'insurancePolicy', policyId: 'term' }]),
          use(cashFlowLineIds.useLongTermCare('p1'), 'longTermCare', [{ entityKind: 'person', personId: PERSON }]),
          use(cashFlowLineIds.useSettledTax(), 'settledTax', []),
          use(cashFlowLineIds.usePenaltyHousehold('traditionalEarly'), 'earlyWithdrawalPenalty', [], 'traditionalEarly'),
          use(cashFlowLineIds.useContribution('brokerage'), 'contribution', [{ entityKind: 'account', accountId: BROKERAGE }]),
          use(cashFlowLineIds.useSurplusUnassigned(), 'surplusInvestment', []),
        ],
        transferLines: [
          {
            id: cashFlowLineIds.transferBeyondRmdQcd('p1', 'ira'),
            kind: 'qualifiedCharitableDistribution',
            source: { entityKind: 'account', accountId: IRA },
            destination: { entityKind: 'charity' },
            debitPlanDollars: inputs.transferDebits[0]!,
            creditPlanDollars: inputs.transferCredits[0]!,
            identities: [{ entityKind: 'account', accountId: IRA }],
          },
          {
            id: cashFlowLineIds.transferEmployeeContribution('brokerage'),
            kind: 'employeeContribution',
            source: { entityKind: 'householdCash' },
            destination: { entityKind: 'account', accountId: BROKERAGE },
            debitPlanDollars: inputs.transferDebits[1]!,
            creditPlanDollars: inputs.transferCredits[1]!,
            identities: [{ entityKind: 'account', accountId: BROKERAGE }],
          },
          {
            // The worksheet's third paired transfer (surplus investment); the
            // identity reads only the paired amounts.
            id: cashFlowLineIds.transferReinvestedYield('brokerage'),
            kind: 'reinvestedYield',
            source: { entityKind: 'accountYield', accountId: BROKERAGE },
            destination: { entityKind: 'account', accountId: BROKERAGE },
            debitPlanDollars: inputs.transferDebits[2]!,
            creditPlanDollars: inputs.transferCredits[2]!,
            identities: [{ entityKind: 'account', accountId: BROKERAGE }],
          },
        ],
      }
    }

    it('accepts the 0.004 cash residual at the annual-funding tolerance and publishes the by-kind destination members', () => {
      // The two tolerances are read from the capture module rather than
      // written in.
      expect(CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS).toBe(expected.cashIdentityTolerance)
      expect(CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS).toBe(expected.structuralTolerance)

      const result = reconcile(lines())
      expect(result.reasonCodes).not.toContain('missingRequiredIdentity')
      expectWithin(result.cash.sourceTotalPlanDollars, expected.cashSourceTotal!, 'cash source total')
      expectWithin(result.cash.fundedHouseholdUsesPlanDollars, expected.fundedHouseholdUses!, 'funded household uses')
      expectWithin(result.cash.settledTaxPlanDollars, expected.settledTax!, 'settled tax')
      expectWithin(result.cash.penaltiesPlanDollars, expected.penalties!, 'penalties')
      expectWithin(result.cash.contributionsPlanDollars, expected.contributions!, 'contributions')
      expectWithin(result.cash.surplusInvestmentPlanDollars, expected.surplusInvestment!, 'surplus investment')
      expectWithin(result.cash.destinationTotalPlanDollars, expected.cashDestinationTotal!, 'cash destination total')
      expectWithin(result.cash.differencePlanDollars, expected.cashDifference!, 'cash difference')
      expect(result.reasonCodes).not.toContain('cashIdentityMismatch')

      // Omitting a destination member (surplus investment) is the worksheet's
      // fourth wrong reading.
      expect(
        withinTolerance(
          result.cash.destinationTotalPlanDollars,
          expected.withoutSurplusDestinationWrongReading!,
          example.tolerance,
        ),
      ).toBe(false)
    })

    it('rejects the same 0.004 residual at the strict structural tolerance', () => {
      // The worksheet's third wrong reading: judging cash conservation at the
      // 1e-6 bound the use and transfer identities are judged at.
      const result = reconcile({
        ...lines(),
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

    it('sums requested, funded and unfunded over the fourteen use lines, and the funded total is the destination total', () => {
      const result = reconcile(lines())
      expectWithin(result.uses.requestedUsesPlanDollars, expected.requestedUses!, 'requested uses')
      expectWithin(result.uses.fundedUsesPlanDollars, expected.fundedUses!, 'funded uses')
      expectWithin(result.uses.unfundedUsesPlanDollars, expected.unfundedUses!, 'unfunded uses')
      expectWithin(result.uses.dispositionTotalPlanDollars, expected.useDispositionTotal!, 'use disposition total')
      expectWithin(result.uses.differencePlanDollars, expected.useDifference!, 'use difference')
      expect(result.reasonCodes).not.toContain('useIdentityMismatch')
      // The same sum over the same lines: the first derivation's 90,000 cannot
      // sit beside a 100,000 destination total.
      expect(result.uses.fundedUsesPlanDollars).toBe(result.cash.destinationTotalPlanDollars)
      expect(
        withinTolerance(
          result.uses.fundedUsesPlanDollars,
          expected.firstDerivationFundedUsesWrongReading!,
          example.tolerance,
        ),
      ).toBe(false)
      // Subtracting unfunded from funded would give 97,000, not 103,000.
      expect(
        withinTolerance(
          result.uses.dispositionTotalPlanDollars,
          expected.subtractedUnfundedDispositionWrongReading!,
          example.tolerance,
        ),
      ).toBe(false)
    })

    it('pairs 22500 of transfer debits against 22500 of credits for a zero difference', () => {
      const result = reconcile(lines())
      expectWithin(result.transfers.debitsPlanDollars, expected.transferDebits!, 'transfer debits')
      expectWithin(result.transfers.creditsPlanDollars, expected.transferCredits!, 'transfer credits')
      expectWithin(result.transfers.differencePlanDollars, expected.transferDifference!, 'transfer difference')
      expect(result.reasonCodes).not.toContain('transferIdentityMismatch')
      // Adding the two paired sides is the worksheet's last wrong reading.
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

describeCalculation(
  'cash-flow-line-plan-dollars',
  {
    example: {
      inputs: {
        spendableSources: 40_000,
        portfolioFunding: 30_000,
        loanProceeds: 10_000,
        fundedHouseholdUses: 50_000,
        settledTax: 10_000,
        penalties: 2_000,
        contributions: 8_000,
        surplusInvestment: 10_000,
        postSolveLifeInsuranceDeposit: 5_000,
      },
      expected: {
        sourceTotal: 80_000,
        destinationTotal: 80_000,
        difference: 0,
        depositInSourcesWrongReading: 85_000,
        omittingLoanProceedsWrongReading: 70_000,
        transferDoubleCountedDestinationWrongReading: 88_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/cash-flow-line-plan-dollars.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/cash-flow-line-plan-dollars.mutation.md',
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
     * The worksheet's eight cash totals as published lines, plus the 5,000
     * post-solve life-insurance deposit that must stay outside the identity
     * and the same-dollar contribution transfer whose credit must not be
     * summed into destinations a second time.
     */
    function identityLines(): {
      sourceLines: YearCashFlowSourceLine[]
      useLines: YearCashFlowUseLine[]
      transferLines: YearCashFlowTransferLine[]
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
          {
            id: cashFlowLineIds.sourceLifeInsuranceDeathBenefit('policy'),
            kind: 'lifeInsuranceDeathBenefit',
            role: 'postSolveDeposit',
            amountPlanDollars: inputs.postSolveLifeInsuranceDeposit!,
            identities: [{ entityKind: 'account', accountId: BROKERAGE }],
            postSolveDestination: { entityKind: 'account', accountId: BROKERAGE },
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
        transferLines: [
          {
            id: cashFlowLineIds.transferEmployeeContribution('brokerage'),
            kind: 'employeeContribution',
            source: { entityKind: 'householdCash' },
            destination: { entityKind: 'account', accountId: BROKERAGE },
            debitPlanDollars: inputs.contributions!,
            creditPlanDollars: inputs.contributions!,
            identities: [{ entityKind: 'account', accountId: BROKERAGE }],
          },
        ],
      }
    }

    it('closes the 80000 cash identity and leaves the 5000 post-solve deposit outside it', () => {
      const { sourceLines, useLines, transferLines } = identityLines()
      const result = reconcile({ sourceLines, useLines, transferLines })

      expectWithin(result.cash.sourceTotalPlanDollars, expected.sourceTotal!, 'cash source total')
      expectWithin(result.cash.destinationTotalPlanDollars, expected.destinationTotal!, 'cash destination total')
      expectWithin(result.cash.differencePlanDollars, expected.difference!, 'cash difference')
      expect(result.reasonCodes).not.toContain('cashIdentityMismatch')

      // Each source role really carries its own worksheet figure.
      expectWithin(result.cash.spendableSourcesPlanDollars, inputs.spendableSources!, 'spendable sources')
      expectWithin(result.cash.portfolioFundingPlanDollars, inputs.portfolioFunding!, 'portfolio funding')
      expectWithin(result.cash.loanProceedsPlanDollars, inputs.loanProceeds!, 'loan proceeds')

      // The worksheet's three wrong readings.
      for (const wrong of [
        expected.depositInSourcesWrongReading!,
        expected.omittingLoanProceedsWrongReading!,
      ]) {
        expect(withinTolerance(result.cash.sourceTotalPlanDollars, wrong, example.tolerance)).toBe(false)
      }
      expect(
        withinTolerance(
          result.cash.destinationTotalPlanDollars,
          expected.transferDoubleCountedDestinationWrongReading!,
          example.tolerance,
        ),
      ).toBe(false)
      // The transfer view carries the same 8,000 of contribution dollars once
      // on each side, and neither side joined the destination total.
      expectWithin(result.transfers.debitsPlanDollars, inputs.contributions!, 'transfer debits')
      expectWithin(result.transfers.creditsPlanDollars, inputs.contributions!, 'transfer credits')
    })
  },
)

describeCalculation(
  'cash-flow-tax-character-amount',
  {
    example: {
      inputs: {
        physicalTaxableWithdrawal: 100_000,
        attachedCapitalGainCharacter: 30_000,
        otherPhysicalSources: 20_000,
      },
      expected: {
        taxCharacterAmount: 30_000,
        sourceTotal: 120_000,
        characterAsCashWrongReading: 150_000,
        gainReplacingGrossWrongReading: 50_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/taxes/cash-flow-tax-character-amount.md',
    mutation: 'DOCS/calculations/taxes/cash-flow-tax-character-amount.mutation.md',
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

    function characterLines(capitalGainAmount: number): {
      sourceLines: YearCashFlowSourceLine[]
      useLines: YearCashFlowUseLine[]
    } {
      return {
        sourceLines: [
          {
            id: cashFlowLineIds.sourceNeedBasedPortfolioWithdrawal('brokerage'),
            kind: 'needBasedPortfolioWithdrawal',
            role: 'portfolioFunding',
            amountPlanDollars: inputs.physicalTaxableWithdrawal!,
            identities: [{ entityKind: 'account', accountId: BROKERAGE }],
            taxCharacter: [{ kind: 'capitalGain', amountPlanDollars: capitalGainAmount }],
          },
          {
            id: cashFlowLineIds.sourcePropertySaleProceeds('home'),
            kind: 'propertySaleProceeds',
            role: 'spendableSource',
            amountPlanDollars: inputs.otherPhysicalSources!,
            identities: [{ entityKind: 'propertyAccount', propertyAccountId: PROPERTY }],
          },
        ],
        useLines: [
          {
            id: cashFlowLineIds.useRequiredLifestyle(),
            kind: 'requiredLifestyle',
            requestedPlanDollars: inputs.physicalTaxableWithdrawal! + inputs.otherPhysicalSources!,
            fundedPlanDollars: inputs.physicalTaxableWithdrawal! + inputs.otherPhysicalSources!,
            unfundedPlanDollars: 0,
            identities: [],
          },
        ],
      }
    }

    it('annotates the 100000 withdrawal with 30000 of gain and still totals 120000 of cash', () => {
      const { sourceLines, useLines } = characterLines(inputs.attachedCapitalGainCharacter!)
      const result = reconcile({ sourceLines, useLines })

      // The annotation really is published at the worksheet's amount.
      const annotated = sourceLines[0]!
      expectWithin(
        annotated.taxCharacter?.[0]?.amountPlanDollars ?? 0,
        expected.taxCharacterAmount!,
        'taxCharacter.amountPlanDollars',
      )
      expectWithin(result.cash.sourceTotalPlanDollars, expected.sourceTotal!, 'cash source total')
      expect(result.reasonCodes).not.toContain('cashIdentityMismatch')

      // The worksheet's first two wrong readings.
      expect(
        withinTolerance(result.cash.sourceTotalPlanDollars, expected.characterAsCashWrongReading!, example.tolerance),
      ).toBe(false)
      expect(
        withinTolerance(result.cash.sourceTotalPlanDollars, expected.gainReplacingGrossWrongReading!, example.tolerance),
      ).toBe(false)
    })

    it('accepts a negative capital-gain character and still counts it as no cash', () => {
      // The worksheet's third wrong reading is a rule: requiring every
      // character amount to be nonnegative would reject a realized loss.
      const { sourceLines, useLines } = characterLines(-inputs.attachedCapitalGainCharacter!)
      const result = reconcile({ sourceLines, useLines })
      expectWithin(result.cash.sourceTotalPlanDollars, expected.sourceTotal!, 'cash source total with a loss')
      expect(result.reasonCodes).not.toContain('cashIdentityMismatch')
    })
  },
)
