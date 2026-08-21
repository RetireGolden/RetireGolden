/**
 * Annual cash-flow reconciliation.
 *
 * Stage 1 stub: compute the three conservation identities from published
 * lines (empty lines are the 0=0 year) and fail closed on the scalar→group
 * incomplete-inventory heuristic. Duplicate detection, lineage, amount
 * validation, and lexicographic sort land with later stages. Stage 5 retires
 * the heuristic in favor of the real cash/use/transfer identities.
 *
 * Do not probe `incomes.total` or `YearResult.withdrawals.total` 1:1.
 * `incomes.total` includes reinvested taxable yield; `withdrawals.total`
 * folds RMD/SEPP/inherited/actions into need-based. `hecmDraw` already
 * includes `hecmShortfallDraw` — coordinated is `hecmDraw - hecmShortfallDraw`.
 *
 * @see DOCS/features/year-cash-flow.md (Conservation and failure contract)
 */

import type {
  YearCashFlowCashIdentityTotals,
  YearCashFlowReconciliation,
  YearCashFlowReconciliationDiagnostic,
  YearCashFlowReconciliationReasonCode,
  YearCashFlowSourceLine,
  YearCashFlowTransferIdentityTotals,
  YearCashFlowTransferLine,
  YearCashFlowUseIdentityTotals,
  YearCashFlowUseKind,
  YearCashFlowUseLine,
} from './types.js'

/**
 * Committed economic scalars the stage-1–4 incomplete-inventory heuristic
 * compares to published line groups. A probe fires when the scalar is
 * strictly greater than the published tolerance and the named group is
 * empty.
 */
export interface CashFlowIncompleteInventoryProbes {
  readonly incomesTotal: number
  readonly taxableYieldReinvested: number
  readonly propertySaleProceedsTotal: number
  readonly rmdTotal: number
  readonly seppTotal: number
  readonly inheritedTotal: number
  readonly needBasedWithdrawalTotal: number
  readonly retirementActionProceeds: number
  /** Coordinated + backstop. Do not probe this 1:1 against a single line group. */
  readonly hecmDraw: number
  readonly hecmShortfallDraw: number
  readonly tax: number
  readonly penalties: number
  readonly contributionsTotal: number
  readonly employerMatchTotal: number
  readonly surplus: number
}

export interface ReconcileYearCashFlowInput {
  readonly sourceLines: readonly YearCashFlowSourceLine[]
  readonly useLines: readonly YearCashFlowUseLine[]
  readonly transferLines: readonly YearCashFlowTransferLine[]
  readonly probes: CashFlowIncompleteInventoryProbes
  readonly tolerancePlanDollars: number
}

/** Funded household uses in the cash identity, excluding tax/penalties/contributions/surplus. */
const FUNDED_HOUSEHOLD_USE_KINDS: ReadonlySet<YearCashFlowUseKind> = new Set([
  'requiredLifestyle',
  'targetLifestyle',
  'idealLifestyle',
  'excessLifestyle',
  'oneTimeGoal',
  'debtService',
  'propertyCosts',
  'healthcare',
  'insurancePremium',
  'longTermCare',
])

function cashIdentity(sourceLines: readonly YearCashFlowSourceLine[], useLines: readonly YearCashFlowUseLine[]):
  YearCashFlowCashIdentityTotals {
  let spendableSourcesPlanDollars = 0
  let portfolioFundingPlanDollars = 0
  let loanProceedsPlanDollars = 0
  for (const line of sourceLines) {
    if (line.role === 'spendableSource') spendableSourcesPlanDollars += line.amountPlanDollars
    else if (line.role === 'portfolioFunding') portfolioFundingPlanDollars += line.amountPlanDollars
    else if (line.role === 'loanProceeds') loanProceedsPlanDollars += line.amountPlanDollars
  }
  let fundedHouseholdUsesPlanDollars = 0
  let settledTaxPlanDollars = 0
  let penaltiesPlanDollars = 0
  let contributionsPlanDollars = 0
  let surplusInvestmentPlanDollars = 0
  for (const line of useLines) {
    if (FUNDED_HOUSEHOLD_USE_KINDS.has(line.kind)) {
      fundedHouseholdUsesPlanDollars += line.fundedPlanDollars
    } else if (line.kind === 'settledTax') {
      settledTaxPlanDollars += line.fundedPlanDollars
    } else if (line.kind === 'earlyWithdrawalPenalty') {
      penaltiesPlanDollars += line.fundedPlanDollars
    } else if (line.kind === 'contribution') {
      contributionsPlanDollars += line.fundedPlanDollars
    } else if (line.kind === 'surplusInvestment') {
      surplusInvestmentPlanDollars += line.fundedPlanDollars
    }
  }
  const sourceTotalPlanDollars =
    spendableSourcesPlanDollars + portfolioFundingPlanDollars + loanProceedsPlanDollars
  const destinationTotalPlanDollars =
    fundedHouseholdUsesPlanDollars +
    settledTaxPlanDollars +
    penaltiesPlanDollars +
    contributionsPlanDollars +
    surplusInvestmentPlanDollars
  return {
    spendableSourcesPlanDollars,
    portfolioFundingPlanDollars,
    loanProceedsPlanDollars,
    sourceTotalPlanDollars,
    fundedHouseholdUsesPlanDollars,
    settledTaxPlanDollars,
    penaltiesPlanDollars,
    contributionsPlanDollars,
    surplusInvestmentPlanDollars,
    destinationTotalPlanDollars,
    differencePlanDollars: sourceTotalPlanDollars - destinationTotalPlanDollars,
  }
}

function useIdentity(useLines: readonly YearCashFlowUseLine[]): YearCashFlowUseIdentityTotals {
  let requestedUsesPlanDollars = 0
  let fundedUsesPlanDollars = 0
  let unfundedUsesPlanDollars = 0
  for (const line of useLines) {
    requestedUsesPlanDollars += line.requestedPlanDollars
    fundedUsesPlanDollars += line.fundedPlanDollars
    unfundedUsesPlanDollars += line.unfundedPlanDollars
  }
  const dispositionTotalPlanDollars = fundedUsesPlanDollars + unfundedUsesPlanDollars
  return {
    requestedUsesPlanDollars,
    fundedUsesPlanDollars,
    unfundedUsesPlanDollars,
    dispositionTotalPlanDollars,
    differencePlanDollars: requestedUsesPlanDollars - dispositionTotalPlanDollars,
  }
}

function transferIdentity(transferLines: readonly YearCashFlowTransferLine[]):
  YearCashFlowTransferIdentityTotals {
  let debitsPlanDollars = 0
  let creditsPlanDollars = 0
  for (const line of transferLines) {
    debitsPlanDollars += line.debitPlanDollars
    creditsPlanDollars += line.creditPlanDollars
  }
  return {
    debitsPlanDollars,
    creditsPlanDollars,
    differencePlanDollars: debitsPlanDollars - creditsPlanDollars,
  }
}

function isRmdDivertedQcd(line: YearCashFlowTransferLine): boolean {
  if (line.kind !== 'qualifiedCharitableDistribution') return false
  const lineage = line.lineage
  if (lineage === undefined) return false
  for (const link of lineage) {
    if (link.relationship === 'divertedBeforeHouseholdCash') return true
  }
  return false
}

/**
 * Native-precision reconciliation for one assembled year. Empty published
 * arrays yield the 0=0 identities. Stages 1–4 also fail closed when a probe
 * scalar from the incomplete-inventory table is nonempty and its named group
 * is empty.
 */
export function reconcileYearCashFlow(input: ReconcileYearCashFlowInput): YearCashFlowReconciliation {
  const { sourceLines, useLines, transferLines, probes, tolerancePlanDollars } = input
  const cash = cashIdentity(sourceLines, useLines)
  const uses = useIdentity(useLines)
  const transfers = transferIdentity(transferLines)

  const reasonCodes: YearCashFlowReconciliationReasonCode[] = []
  const diagnostics: YearCashFlowReconciliationDiagnostic[] = []

  const push = (
    reasonCode: YearCashFlowReconciliationReasonCode,
    diagnostic: Omit<YearCashFlowReconciliationDiagnostic, 'reasonCode'>,
  ): void => {
    if (!reasonCodes.includes(reasonCode)) reasonCodes.push(reasonCode)
    diagnostics.push({ reasonCode, ...diagnostic })
  }

  const probe = (scalar: number, groupEmpty: boolean): boolean =>
    scalar > tolerancePlanDollars && groupEmpty

  const spendableEmpty = sourceLines.every((line) => line.role !== 'spendableSource')
  const spendableScalar =
    probes.incomesTotal - probes.taxableYieldReinvested + probes.propertySaleProceedsTotal
  if (probe(spendableScalar, spendableEmpty)) {
    push('unsupportedLedgerTerm', {
      lineIds: [],
      expectedPlanDollars: spendableScalar,
      actualPlanDollars: 0,
      differencePlanDollars: spendableScalar,
    })
  }

  const reinvestedYieldEmpty = transferLines.every((line) => line.kind !== 'reinvestedYield')
  if (probe(probes.taxableYieldReinvested, reinvestedYieldEmpty)) {
    push('unsupportedLedgerTerm', {
      lineIds: [],
      expectedPlanDollars: probes.taxableYieldReinvested,
      actualPlanDollars: 0,
      differencePlanDollars: probes.taxableYieldReinvested,
    })
  }

  const rmdGroupEmpty =
    sourceLines.every((line) =>
      !(line.kind === 'requiredMinimumDistribution' && line.role === 'portfolioFunding')) &&
    transferLines.every((line) => !isRmdDivertedQcd(line))
  if (probe(probes.rmdTotal, rmdGroupEmpty)) {
    push('unsupportedLedgerTerm', {
      lineIds: [],
      expectedPlanDollars: probes.rmdTotal,
      actualPlanDollars: 0,
      differencePlanDollars: probes.rmdTotal,
    })
  }

  const seppEmpty = sourceLines.every((line) => line.kind !== 'seppDistribution')
  if (probe(probes.seppTotal, seppEmpty)) {
    push('unsupportedLedgerTerm', {
      lineIds: [],
      expectedPlanDollars: probes.seppTotal,
      actualPlanDollars: 0,
      differencePlanDollars: probes.seppTotal,
    })
  }

  const inheritedEmpty = sourceLines.every((line) => line.kind !== 'inheritedAccountDistribution')
  if (probe(probes.inheritedTotal, inheritedEmpty)) {
    push('unsupportedLedgerTerm', {
      lineIds: [],
      expectedPlanDollars: probes.inheritedTotal,
      actualPlanDollars: 0,
      differencePlanDollars: probes.inheritedTotal,
    })
  }

  const needBasedEmpty = sourceLines.every((line) => line.kind !== 'needBasedPortfolioWithdrawal')
  if (probe(probes.needBasedWithdrawalTotal, needBasedEmpty)) {
    push('unsupportedLedgerTerm', {
      lineIds: [],
      expectedPlanDollars: probes.needBasedWithdrawalTotal,
      actualPlanDollars: 0,
      differencePlanDollars: probes.needBasedWithdrawalTotal,
    })
  }

  const retirementActionEmpty = sourceLines.every((line) => line.kind !== 'retirementActionWithdrawal')
  if (probe(probes.retirementActionProceeds, retirementActionEmpty)) {
    push('unsupportedLedgerTerm', {
      lineIds: [],
      expectedPlanDollars: probes.retirementActionProceeds,
      actualPlanDollars: 0,
      differencePlanDollars: probes.retirementActionProceeds,
    })
  }

  const coordinatedEmpty = sourceLines.every((line) => line.kind !== 'hecmCoordinatedDraw')
  const coordinatedScalar = probes.hecmDraw - probes.hecmShortfallDraw
  if (probe(coordinatedScalar, coordinatedEmpty)) {
    push('unsupportedLedgerTerm', {
      lineIds: [],
      expectedPlanDollars: coordinatedScalar,
      actualPlanDollars: 0,
      differencePlanDollars: coordinatedScalar,
    })
  }

  const backstopEmpty = sourceLines.every((line) => line.kind !== 'hecmBackstopDraw')
  if (probe(probes.hecmShortfallDraw, backstopEmpty)) {
    push('unsupportedLedgerTerm', {
      lineIds: [],
      expectedPlanDollars: probes.hecmShortfallDraw,
      actualPlanDollars: 0,
      differencePlanDollars: probes.hecmShortfallDraw,
    })
  }

  const settledTaxEmpty = useLines.every((line) => line.kind !== 'settledTax')
  if (probe(probes.tax, settledTaxEmpty)) {
    push('unsupportedLedgerTerm', {
      lineIds: [],
      expectedPlanDollars: probes.tax,
      actualPlanDollars: 0,
      differencePlanDollars: probes.tax,
    })
  }

  const penaltyEmpty = useLines.every((line) => line.kind !== 'earlyWithdrawalPenalty')
  if (probe(probes.penalties, penaltyEmpty)) {
    push('unsupportedLedgerTerm', {
      lineIds: [],
      expectedPlanDollars: probes.penalties,
      actualPlanDollars: 0,
      differencePlanDollars: probes.penalties,
    })
  }

  const contributionEmpty = useLines.every((line) => line.kind !== 'contribution')
  if (probe(probes.contributionsTotal, contributionEmpty)) {
    push('unsupportedLedgerTerm', {
      lineIds: [],
      expectedPlanDollars: probes.contributionsTotal,
      actualPlanDollars: 0,
      differencePlanDollars: probes.contributionsTotal,
    })
  }

  const employerMatchEmpty = transferLines.every((line) => line.kind !== 'employerMatch')
  if (probe(probes.employerMatchTotal, employerMatchEmpty)) {
    push('unsupportedLedgerTerm', {
      lineIds: [],
      expectedPlanDollars: probes.employerMatchTotal,
      actualPlanDollars: 0,
      differencePlanDollars: probes.employerMatchTotal,
    })
  }

  const surplusEmpty = useLines.every((line) => line.kind !== 'surplusInvestment')
  if (probe(probes.surplus, surplusEmpty)) {
    push('unsupportedLedgerTerm', {
      lineIds: [],
      expectedPlanDollars: probes.surplus,
      actualPlanDollars: 0,
      differencePlanDollars: probes.surplus,
    })
  }

  if (Math.abs(cash.differencePlanDollars) > tolerancePlanDollars) {
    push('cashIdentityMismatch', {
      lineIds: [],
      expectedPlanDollars: cash.destinationTotalPlanDollars,
      actualPlanDollars: cash.sourceTotalPlanDollars,
      differencePlanDollars: cash.differencePlanDollars,
    })
  }
  if (Math.abs(uses.differencePlanDollars) > tolerancePlanDollars) {
    push('useIdentityMismatch', {
      lineIds: [],
      expectedPlanDollars: uses.requestedUsesPlanDollars,
      actualPlanDollars: uses.dispositionTotalPlanDollars,
      differencePlanDollars: uses.differencePlanDollars,
    })
  }
  if (Math.abs(transfers.differencePlanDollars) > tolerancePlanDollars) {
    push('transferIdentityMismatch', {
      lineIds: [],
      expectedPlanDollars: transfers.creditsPlanDollars,
      actualPlanDollars: transfers.debitsPlanDollars,
      differencePlanDollars: transfers.differencePlanDollars,
    })
  }

  return {
    status: reasonCodes.length === 0 ? 'reconciled' : 'notReconciled',
    tolerancePlanDollars,
    cash,
    uses,
    transfers,
    reasonCodes,
    diagnostics,
  }
}
