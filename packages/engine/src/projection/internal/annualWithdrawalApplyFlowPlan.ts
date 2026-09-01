/**
 * Pure plan for the voluntary-withdrawal portion of the annual apply-flow
 * phase. The caller retains every live write and runtime-journal commit.
 */
import type { Account } from '../../model/plan.js'
import { isTreatAsOwnEffective } from '../../strategies/accountEligibility.js'

type ApplyFlowAccount = Extract<
  Account,
  {
    type:
      | 'cash'
      | 'taxable'
      | 'equityComp'
      | 'traditional'
      | 'roth'
      | 'hsa'
  }
>

export interface AnnualWithdrawalApplyFlowBalanceState {
  readonly account: Readonly<ApplyFlowAccount>
  readonly balance: number
  readonly costBasis: number
}

export interface AnnualWithdrawalEvidenceInput {
  readonly accountId: string
}

export interface AnnualWithdrawalTaxableSale {
  readonly remainingCostBasis: number
  readonly remainingFairMarketValue: number
}

export interface AnnualWithdrawalEvidenceWrite {
  readonly evidenceIndex: number
  readonly accountId: string
  readonly voluntaryAmount: number
}

export interface AnnualWithdrawalBalanceOperation {
  readonly balanceIndex: number
  readonly accountId: string
  readonly taken: number
  readonly sourceBalanceBefore: number
  readonly sourceBalanceAfter: number
  readonly costBasisAfter: number | null
  /** The caller throws at this operation's original transaction position. */
  readonly taxableSaleMissing: boolean
  readonly recordsTraditionalRuntimeOccurrence: boolean
  readonly recordsOwnedIraApplication: boolean
}

export interface AnnualWithdrawalApplyFlowPlanInput {
  readonly year: number
  readonly balances: readonly AnnualWithdrawalApplyFlowBalanceState[]
  readonly inheritedEvidence: readonly AnnualWithdrawalEvidenceInput[]
  readonly withdrawnByAccountId: ReadonlyMap<string, number>
  readonly taxableSales: ReadonlyMap<string, AnnualWithdrawalTaxableSale>
  readonly recordsOwnedIraApplicationFor: (
    account: Readonly<ApplyFlowAccount>,
  ) => boolean
}

export interface AnnualWithdrawalApplyFlowPlanResult {
  readonly evidenceWrites: readonly AnnualWithdrawalEvidenceWrite[]
  readonly balanceOperations: readonly AnnualWithdrawalBalanceOperation[]
}

export function annualWithdrawalApplyFlowPlan(
  input: Readonly<AnnualWithdrawalApplyFlowPlanInput>,
): AnnualWithdrawalApplyFlowPlanResult {
  const balanceStateByAccountId = new Map(
    input.balances.map((state) => [state.account.id, state] as const),
  )
  const evidenceWrites: AnnualWithdrawalEvidenceWrite[] = []
  for (const [evidenceIndex, evidence] of input.inheritedEvidence.entries()) {
    const evidenceAccount =
      balanceStateByAccountId.get(evidence.accountId)?.account
    if (
      evidenceAccount !== undefined &&
      (evidenceAccount.type === 'traditional' ||
        evidenceAccount.type === 'roth') &&
      isTreatAsOwnEffective(evidenceAccount, input.year)
    ) continue
    evidenceWrites.push({
      evidenceIndex,
      accountId: evidence.accountId,
      voluntaryAmount:
        input.withdrawnByAccountId.get(evidence.accountId) ?? 0,
    })
  }

  const shadowByState = new Map<
    AnnualWithdrawalApplyFlowBalanceState,
    { balance: number; costBasis: number }
  >(
    input.balances.map((state) => [
      state,
      { balance: state.balance, costBasis: state.costBasis },
    ]),
  )
  const balanceOperations: AnnualWithdrawalBalanceOperation[] = []
  for (const [balanceIndex, state] of input.balances.entries()) {
    const taken = input.withdrawnByAccountId.get(state.account.id) ?? 0
    if (taken <= 0) continue
    const shadow = shadowByState.get(state)!
    const sourceBalanceBefore = shadow.balance
    let sourceBalanceAfter: number
    let costBasisAfter: number | null = null
    let taxableSaleMissing = false
    if (state.account.type === 'taxable') {
      const sale = input.taxableSales.get(state.account.id)
      if (sale === undefined) {
        taxableSaleMissing = true
        sourceBalanceAfter = sourceBalanceBefore
      } else {
        costBasisAfter = sale.remainingCostBasis
        sourceBalanceAfter = sale.remainingFairMarketValue
      }
    } else if (
      state.account.type === 'equityComp' &&
      sourceBalanceBefore > 0
    ) {
      const basisRatio = Math.min(
        1,
        shadow.costBasis / sourceBalanceBefore,
      )
      costBasisAfter = Math.max(
        0,
        shadow.costBasis - taken * basisRatio,
      )
      sourceBalanceAfter = sourceBalanceBefore - taken
    } else {
      sourceBalanceAfter = sourceBalanceBefore - taken
    }
    shadow.balance = sourceBalanceAfter
    if (costBasisAfter !== null) shadow.costBasis = costBasisAfter
    balanceOperations.push({
      balanceIndex,
      accountId: state.account.id,
      taken,
      sourceBalanceBefore,
      sourceBalanceAfter,
      costBasisAfter,
      taxableSaleMissing,
      recordsTraditionalRuntimeOccurrence:
        state.account.type === 'traditional',
      recordsOwnedIraApplication:
        state.account.type === 'traditional' &&
        input.recordsOwnedIraApplicationFor(state.account),
    })
  }
  return { evidenceWrites, balanceOperations }
}
