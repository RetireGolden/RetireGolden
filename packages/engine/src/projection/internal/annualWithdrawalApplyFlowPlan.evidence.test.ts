import { expect, it } from 'vitest'

import type { Account, InheritedAccount } from '../../model/plan.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { annualWithdrawalApplyFlowPlan } from './annualWithdrawalApplyFlowPlan.js'

describeCalculation(
  'inherited-distribution-voluntary-annual',
  {
    example: {
      inputs: {
        openingInheritedBalance: 100_000,
        forcedRequiredTakeAlreadyExecuted: 5_000,
        remainingBalanceBeforeOrdinaryWithdrawals: 95_000,
        householdOrdinaryPlanDrawFromThisAccount: 12_000,
        treatAsOwnEffective: false,
      },
      expected: {
        voluntaryAmount: 12_000,
        accountTotalDistribution: 17_000,
        totalAsVoluntaryWrongReading: 17_000,
        forcedSubtractedAgainWrongReading: 7_000,
        treatAsOwnVoluntaryAmount: 0,
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/inherited-distribution-voluntary-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/inherited-distribution-voluntary-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | boolean>
    const expected = example.expected as Record<string, number>
    const YEAR = 2030
    const ACCOUNT_ID = 'inherited-ira'
    const remaining = inputs.remainingBalanceBeforeOrdinaryWithdrawals as number
    const planDraw = inputs.householdOrdinaryPlanDrawFromThisAccount as number

    const inheritedFacts: InheritedAccount = {
      ownerDeathYear: 2026,
      decedentHadStartedRmds: false,
      beneficiary: {
        beneficiaryClass: 'designated-individual',
        edbCategory: 'none',
        beneficiaryBirthYear: 1981,
        soleBeneficiary: true,
        election: 'none',
        provenance: { source: 'worksheet fixture', asOf: '2026-01-01' },
      },
    } as InheritedAccount

    const account = {
      type: 'traditional',
      id: ACCOUNT_ID,
      name: ACCOUNT_ID,
      ownerPersonId: 'beneficiary',
      annualReturnPct: 0,
      kind: 'ira',
      balance: 0,
      annualContribution: 0,
      inherited: inheritedFacts,
    } as unknown as Extract<Account, { type: 'traditional' }>

    function plan(ownerTreatment: boolean) {
      return annualWithdrawalApplyFlowPlan({
        year: YEAR,
        ownerTreatmentRouting: new Map([[ACCOUNT_ID, ownerTreatment]]),
        balances: [{ account, balance: remaining, costBasis: 0 }],
        inheritedEvidence: [{ accountId: ACCOUNT_ID }],
        withdrawnByAccountId: new Map([[ACCOUNT_ID, planDraw]]),
        taxableSales: new Map(),
        recordsOwnedIraApplicationFor: () => false,
      })
    }

    it('publishes the 12000 additional draw, not the 17000 total the account distributed', () => {
      const result = plan(inputs.treatAsOwnEffective as boolean)
      expect(result.evidenceWrites).toHaveLength(1)
      const write = result.evidenceWrites[0]!
      expect(write.accountId).toBe(ACCOUNT_ID)
      expect(write.voluntaryAmount).toBe(expected.voluntaryAmount)

      // The account really moves 95,000 down by the 12,000 ordinary draw; the
      // 5,000 forced take is already out of the balance this phase receives.
      const operation = result.balanceOperations[0]!
      expect(operation.sourceBalanceBefore).toBe(remaining)
      expect(operation.taken).toBe(planDraw)
      expect(operation.sourceBalanceAfter).toBe(remaining - planDraw)

      // The worksheet's first two wrong readings.
      expect(write.voluntaryAmount).not.toBe(expected.totalAsVoluntaryWrongReading)
      expect(write.voluntaryAmount).not.toBe(expected.forcedSubtractedAgainWrongReading)
      // The account's total distribution is the worksheet's 17,000, of which
      // only the 12,000 is voluntary.
      expect(
        withinTolerance(
          (inputs.forcedRequiredTakeAlreadyExecuted as number) + write.voluntaryAmount,
          expected.accountTotalDistribution!,
          example.tolerance,
        ),
      ).toBe(true)
    })

    it('writes no inherited voluntary row at all once treat-as-own is effective', () => {
      const result = plan(true)
      expect(result.evidenceWrites).toEqual([])
      // The withdrawal still happens; it is simply not inherited-classified.
      expect(result.balanceOperations[0]?.taken).toBe(planDraw)
      const voluntaryFromInheritedEvidence = result.evidenceWrites.reduce(
        (sum, write) => sum + write.voluntaryAmount,
        0,
      )
      expect(voluntaryFromInheritedEvidence).toBe(expected.treatAsOwnVoluntaryAmount)
    })
  },
)
