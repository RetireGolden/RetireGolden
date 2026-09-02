/** Pure assembly of the annual optimizer linearization probe. */
import {
  planDollarsMoveNoLedgerCent,
  planDollarsToLedgerCents,
  signedLedgerCentTotalToPlanDollars,
  type RothConversionExecutionEvidence,
} from '../../actions/index.js'
import { compareUtf16CodeUnits } from '../../actions/structuralId.js'
import type { SimulatorAnnualRetirementRuntimeOccurrence } from
  '../annualRetirementRuntimeJournal.js'
import type { OptimizerYearProbe, YearAcaResult } from '../types.js'

export interface AnnualOptimizerProbeTraditionalAccountSnapshot {
  readonly openingBalance: number
  readonly closingBalance: number
  /** Opening-bucket identity stays inherited for S2 across the LP horizon. */
  readonly inheritedOpeningBucket: boolean
  readonly hasSpouseTreatAsOwnElection: boolean
  readonly treatAsOwnEffective: boolean
  readonly rmdObligation: number
  readonly ownerWithdrawal: number
  readonly includedInOwnerTraditional: boolean
  readonly remainingTaxableFraction: number
  readonly convertibleToRoth: boolean
}

export interface AnnualOptimizerProbeOrdinaryActionSnapshot {
  readonly committed: boolean
  readonly balances: readonly Readonly<{
    readonly accountId: string
    readonly openingBalanceCents: bigint
    readonly closingBalanceCents: bigint
  }>[]
}

export interface AnnualOptimizerProbeConversionActionSnapshot {
  readonly committed: boolean
  readonly evidence: readonly Readonly<{
    readonly outcome: RothConversionExecutionEvidence['outcome']
    readonly destinationRothAccountId: string
    readonly allocations: readonly Readonly<{
      readonly sourceAccountId: string
      readonly executedAmountCents: bigint
    }>[]
  }>[]
}

export interface AnnualOptimizerProbeQcdActionSnapshot {
  readonly committed: boolean
  readonly evidence: readonly Readonly<{
    readonly sourceAccountId: string
    readonly executedAmountCents: bigint
  }>[]
}

export interface AnnualOptimizerProbeRuntimeOccurrenceSnapshot {
  readonly sourceAccountId: string | null
  readonly kind: SimulatorAnnualRetirementRuntimeOccurrence['kind']
  readonly grossAmountPlanDollars: number
}

export interface AnnualOptimizerProbeAcaSnapshot {
  readonly readiness: YearAcaResult['readiness']
  readonly federalPovertyLine: number | null
  readonly householdMagi: number | null
  readonly modeledAllowablePtc: number | null
  readonly cliffState: YearAcaResult['cliffState']
}

export interface AnnualOptimizerProbeInput {
  readonly year: number
  readonly traditionalAccounts:
    readonly AnnualOptimizerProbeTraditionalAccountSnapshot[]
  readonly ordinaryAction: AnnualOptimizerProbeOrdinaryActionSnapshot | null
  readonly conversionAction:
    AnnualOptimizerProbeConversionActionSnapshot | null
  readonly qcdAction: AnnualOptimizerProbeQcdActionSnapshot | null
  readonly runtimeOccurrences:
    readonly AnnualOptimizerProbeRuntimeOccurrenceSnapshot[]
  readonly exogenousStrategyDebits: readonly Readonly<{
    readonly accountId: string
    readonly amountPlanDollars: number
  }>[]
  readonly rmdTotal: number
  readonly rmdNontaxable: number
  readonly inheritedOrdinaryIncome: number
  readonly qcdIncomeOffset: number
  readonly namedQcdIncomeOffset: number
  readonly qcdFromRmd: number
  readonly namedQcdRmdSatisfied: number
  readonly incomeBeforeConversion: number
  readonly taxableSocialSecurity: number
  readonly preWithdrawalCapitalResult: number
  readonly qualifiedDividends: number
  readonly iraNontaxableFinal: number
  readonly namedRothConversionExecuted: number
  readonly namedRothConversionNontaxable: number
  readonly retirementActionProceeds: number
  readonly expensesTotal: number
  readonly contributions: number
  readonly incomesTotal: number
  readonly taxableYieldReinvested: number
  readonly traditionalInflow: number
  readonly otherInflow: number
  readonly taxableInflow: number
  readonly grossSocialSecurity: number
  readonly taxExemptInterest: number
  readonly acaForeignExclusionAddback: number
  readonly yearAcaResult: AnnualOptimizerProbeAcaSnapshot | undefined
  readonly maxFplPctForCredit: number
  readonly totalRothConversionTaxable: number
  readonly traditionalWithdrawal: number
  readonly taxableWithdrawal: number
  readonly totalRothConversion: number
  readonly taxableAmountForGrossConversion: (gross: number) => number
  readonly seppTotal: number
  readonly peopleAged65Plus: number
  readonly ssa44IrmaaRedetermination: boolean
}

/**
 * WHAT IT TAKES: detached annual account/action/runtime snapshots plus settled
 * tax, ACA, distribution, contribution, and income scalars.
 *
 * WHAT IT PRODUCES: one fresh optimizer probe whose movement rows are ordered
 * by account id and whose scalars preserve the ledger's existing fold order.
 *
 * WHAT IT REFUSES: optimizer execution, live ledger reads or writes, annual
 * settlement replay, capture-sink invocation, and final result publication.
 */
export function annualOptimizerProbePublication(
  input: AnnualOptimizerProbeInput,
): OptimizerYearProbe {
  const {
    rmdTotal,
    rmdNontaxable,
    totalRothConversion,
    totalRothConversionTaxable,
    yearAcaResult,
  } = input
  let startTraditional = 0
  let startInheritedTraditional = 0
  for (const account of input.traditionalAccounts) {
    if (account.inheritedOpeningBucket) {
      startInheritedTraditional += account.openingBalance
    } else {
      startTraditional += account.openingBalance
    }
  }

  // S2 post-flip owner-RMD obligation shares remain in the inherited opening
  // bucket for the static LP horizon, so remap only the probe's forced flow.
  let s2FlipOwnerRmdObligationRemap = 0
  let s2FlipOwnerRmdObligationRemapTaxable = 0
  let s2FlipOwnerRmdObligationRemapNontaxable = 0
  const ownerRmdNontaxableFraction =
    rmdTotal > 0 ? rmdNontaxable / rmdTotal : 0
  for (const account of input.traditionalAccounts) {
    if (!account.hasSpouseTreatAsOwnElection) continue
    if (!account.treatAsOwnEffective) continue
    const obligation = account.rmdObligation
    if (obligation <= 0 || planDollarsMoveNoLedgerCent(obligation)) continue
    const shareNontaxable = obligation * ownerRmdNontaxableFraction
    s2FlipOwnerRmdObligationRemap += obligation
    s2FlipOwnerRmdObligationRemapTaxable += obligation - shareNontaxable
    s2FlipOwnerRmdObligationRemapNontaxable += shareNontaxable
  }
  const probeRmd = Math.max(
    0,
    rmdTotal - s2FlipOwnerRmdObligationRemap,
  )
  const probeInheritedDistribution =
    input.inheritedOrdinaryIncome + s2FlipOwnerRmdObligationRemap
  const rmdTaxableTotal = Math.max(
    0,
    rmdTotal - rmdNontaxable,
  )
  const probeRmdTaxable = Math.max(
    0,
    rmdTaxableTotal - s2FlipOwnerRmdObligationRemapTaxable,
  )

  // Income and cash are distinct sides of a QCD routed from an RMD. The LP
  // re-decides the forced distribution, so both established corrections stay.
  const optimizerForcedDistributionOrdinaryExclusion = Math.max(
    0,
    Math.min(
      input.qcdIncomeOffset + input.namedQcdIncomeOffset,
      rmdTotal - rmdNontaxable,
    ) + s2FlipOwnerRmdObligationRemapNontaxable,
  )
  const optimizerForcedDistributionCashDiversion = Math.max(
    0,
    Math.min(
      input.qcdFromRmd + input.namedQcdRmdSatisfied,
      rmdTotal,
    ),
  )
  const optimizerOrdinaryIncomeBase =
    Math.max(
      0,
      input.incomeBeforeConversion -
        (probeRmdTaxable - optimizerForcedDistributionOrdinaryExclusion) -
        input.inheritedOrdinaryIncome -
        s2FlipOwnerRmdObligationRemap,
    ) + input.taxableSocialSecurity
  const optimizerCapitalGainsBase =
    Math.max(0, input.preWithdrawalCapitalResult) + input.qualifiedDividends

  let optimizerOwnerTraditionalWithdrawal = 0
  let remainingTraditionalGross = 0
  let remainingTraditionalTaxable = 0
  let remainingConvertibleGross = 0
  for (const account of input.traditionalAccounts) {
    if (account.includedInOwnerTraditional) {
      optimizerOwnerTraditionalWithdrawal += account.ownerWithdrawal
      const gross = Math.max(0, account.closingBalance)
      remainingTraditionalGross += gross
      remainingTraditionalTaxable +=
        gross * account.remainingTaxableFraction
    }
    if (account.convertibleToRoth) {
      remainingConvertibleGross += Math.max(0, account.closingBalance)
    }
  }
  const optimizerTraditionalGross =
    rmdTotal + optimizerOwnerTraditionalWithdrawal
  const optimizerTraditionalTaxable =
    (rmdTotal - rmdNontaxable) +
    (optimizerOwnerTraditionalWithdrawal - input.iraNontaxableFinal)

  // Aggregate exact-cent action deltas once per account before converting.
  const committedActionCentsByAccountId = new Map<string, bigint>()
  const addCommittedActionCents = (accountId: string, cents: bigint): void => {
    committedActionCentsByAccountId.set(
      accountId,
      (committedActionCentsByAccountId.get(accountId) ?? 0n) + cents,
    )
  }
  if (input.ordinaryAction?.committed) {
    for (const snapshot of input.ordinaryAction.balances) {
      addCommittedActionCents(
        snapshot.accountId,
        snapshot.closingBalanceCents - snapshot.openingBalanceCents,
      )
    }
  }
  if (input.conversionAction?.committed) {
    for (const evidence of input.conversionAction.evidence) {
      if (evidence.outcome !== 'executed') continue
      let creditedCents = 0n
      for (const allocation of evidence.allocations) {
        creditedCents += allocation.executedAmountCents
        addCommittedActionCents(
          allocation.sourceAccountId,
          -allocation.executedAmountCents,
        )
      }
      addCommittedActionCents(
        evidence.destinationRothAccountId,
        creditedCents,
      )
    }
  }
  if (input.qcdAction?.committed) {
    for (const evidence of input.qcdAction.evidence) {
      if (evidence.executedAmountCents <= 0n) continue
      addCommittedActionCents(
        evidence.sourceAccountId,
        -evidence.executedAmountCents,
      )
    }
  }
  const optimizerCommittedActionAccountMovement =
    [...committedActionCentsByAccountId]
      .filter(([, cents]) => cents !== 0n)
      .map(([accountId, cents]) => ({
        accountId,
        amount: signedLedgerCentTotalToPlanDollars(cents),
      }))
      .sort((left, right) =>
        compareUtf16CodeUnits(left.accountId, right.accountId))

  // Strategy occurrences publish four debit producers and one rollover credit;
  // purchase debits arrive on the explicit mutation-site channel.
  const exogenousStrategyCentsByAccountId = new Map<string, bigint>()
  const addExogenousStrategyMovementCents = (
    accountId: string,
    signedAmountPlanDollars: number,
  ): void => {
    const magnitude = BigInt(
      planDollarsToLedgerCents(Math.abs(signedAmountPlanDollars)),
    )
    const cents = signedAmountPlanDollars < 0 ? -magnitude : magnitude
    exogenousStrategyCentsByAccountId.set(
      accountId,
      (exogenousStrategyCentsByAccountId.get(accountId) ?? 0n) + cents,
    )
  }
  for (const occurrence of input.runtimeOccurrences) {
    if (occurrence.sourceAccountId === null) continue
    const signedAmountPlanDollars =
      occurrence.kind === 'legacyQcd' ||
      occurrence.kind === 'automaticSeppDistribution'
        ? -occurrence.grossAmountPlanDollars
        : occurrence.kind === 'rolloverInflow'
          ? occurrence.grossAmountPlanDollars
          : 0
    if (signedAmountPlanDollars === 0) continue
    addExogenousStrategyMovementCents(
      occurrence.sourceAccountId,
      signedAmountPlanDollars,
    )
  }
  for (const debit of input.exogenousStrategyDebits) {
    addExogenousStrategyMovementCents(
      debit.accountId,
      -debit.amountPlanDollars,
    )
  }
  const optimizerExogenousStrategyAccountMovement =
    [...exogenousStrategyCentsByAccountId]
      .filter(([, cents]) => cents !== 0n)
      .map(([accountId, cents]) => ({
        accountId,
        amount: signedLedgerCentTotalToPlanDollars(cents),
      }))
      .sort((left, right) =>
        compareUtf16CodeUnits(left.accountId, right.accountId))

  return {
    year: input.year,
    committedActionAccountMovement:
      optimizerCommittedActionAccountMovement,
    exogenousStrategyAccountMovement:
      optimizerExogenousStrategyAccountMovement,
    exogenousStrategyProceeds: input.seppTotal,
    forcedDistributionOrdinaryIncomeExclusion:
      optimizerForcedDistributionOrdinaryExclusion,
    forcedDistributionCashDiversion:
      optimizerForcedDistributionCashDiversion,
    committedConversionOrdinaryIncome: Math.max(
      0,
      input.namedRothConversionExecuted -
        input.namedRothConversionNontaxable,
    ),
    committedActionProceeds: input.retirementActionProceeds,
    ordinaryIncomeBase: optimizerOrdinaryIncomeBase,
    spendingNeed: input.expensesTotal + input.contributions,
    exogenousCash: input.incomesTotal - input.taxableYieldReinvested,
    traditionalInflow: input.traditionalInflow,
    otherInflow: input.otherInflow,
    taxableInflow: input.taxableInflow,
    ssBenefits: input.grossSocialSecurity,
    taxableSsBase: input.taxableSocialSecurity,
    ssProvisionalIncomeAddbacks:
      input.taxExemptInterest + input.acaForeignExclusionAddback,
    magiTaxExemptInterest: input.taxExemptInterest,
    capitalGainsBase: optimizerCapitalGainsBase,
    acaConversionMagiHeadroom:
      yearAcaResult?.readiness === 'actionable' &&
      yearAcaResult.federalPovertyLine !== null &&
      yearAcaResult.householdMagi !== null
        ? Math.max(
            0,
            yearAcaResult.federalPovertyLine *
                (input.maxFplPctForCredit / 100) -
              yearAcaResult.householdMagi,
          )
        : null,
    incumbentModeledMagiBeforeTaxableWithdrawalGains:
      optimizerOrdinaryIncomeBase +
      optimizerCapitalGainsBase +
      (rmdTotal - rmdNontaxable) -
      optimizerForcedDistributionOrdinaryExclusion +
      input.inheritedOrdinaryIncome +
      totalRothConversionTaxable +
      input.traditionalWithdrawal -
      input.iraNontaxableFinal,
    incumbentTaxableWithdrawal: input.taxableWithdrawal,
    acaModeledAllowablePtc:
      yearAcaResult?.modeledAllowablePtc ?? null,
    acaCliffState: yearAcaResult?.cliffState ?? null,
    incumbentRothConversion: totalRothConversion,
    rothConversionTaxableFraction:
      totalRothConversion > 0
        ? Math.min(
            1,
            Math.max(
              0,
              totalRothConversionTaxable /
                totalRothConversion,
            ),
          )
        : remainingConvertibleGross > 0
          ? input.taxableAmountForGrossConversion(
              remainingConvertibleGross,
            ) / remainingConvertibleGross
          : 1,
    rmd: probeRmd,
    rmdTaxable: probeRmdTaxable,
    incumbentTraditionalDistribution: optimizerTraditionalGross,
    traditionalWithdrawalTaxableFraction:
      optimizerTraditionalGross > 0
        ? Math.min(
            1,
            Math.max(
              0,
              optimizerTraditionalTaxable / optimizerTraditionalGross,
            ),
          )
        : remainingTraditionalGross > 0
          ? remainingTraditionalTaxable / remainingTraditionalGross
          : 1,
    startTraditional,
    inheritedDistribution: probeInheritedDistribution,
    startInheritedTraditional,
    peopleAged65Plus: input.peopleAged65Plus,
    ssa44IrmaaRedetermination: input.ssa44IrmaaRedetermination,
  }
}
