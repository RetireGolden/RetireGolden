/**
 * Assemble the core public record for one settled annual pass.
 *
 * WHAT IT TAKES: already-committed annual ledger scalars plus the outputs of
 * the settlement-publication, per-entity publication, and snapshot
 * coordinators. Optional channels arrive as `undefined`; this boundary owns
 * whether those keys are published. Cash-flow capture is also assembled here,
 * after every economic commit has completed.
 *
 * WHAT IT PRODUCES: the canonical core annual-pass `YearResult` object in its
 * legacy property order, including the exact realized-gain and net-worth
 * associations and the year's published `netPortfolioNeed`.
 *
 * WHAT IT REFUSES: it does not move balances, mutate pass state, append to the
 * projection result, attach the outer settlement's committed owned non-Roth
 * IRA replay evidence, or choose annual phase order. `simulatePlan` retains
 * all of those orchestration responsibilities.
 */
import {
  assembleYearCashFlow,
  type AssembleYearCashFlowInput,
} from '../annualCashFlowCapture.js'
import type { YearResult } from '../types.js'
import type {
  AnnualRetirementActionSettlementPublicationResult,
} from './annualRetirementActionSettlementPublication.js'
import type { AnnualSnapshot } from './annualSnapshot.js'
import type { PublishedEntityFacts } from './publishedEntityFacts.js'

export interface AnnualYearResultChronology {
  readonly year: YearResult['year']
  readonly inflationScale: NonNullable<YearResult['inflationScale']>
  readonly people: YearResult['people']
  readonly filingStatus: YearResult['filingStatus']
}

export interface AnnualYearResultLedgerPublication {
  readonly incomes: YearResult['incomes']
  readonly expenses: YearResult['expenses']
  readonly contributions: YearResult['contributions']
  readonly ownedNonRothIraContributions:
    YearResult['ownedNonRothIraContributions']
  readonly ownedNonRothIraBalancesBeforeGrowth:
    YearResult['ownedNonRothIraBalancesBeforeGrowth']
  readonly ownedNonRothIraPhysicalBalancesBeforeGrowth:
    YearResult['ownedNonRothIraPhysicalBalancesBeforeGrowth']
  readonly ownedNonRothIraPhysicalOpeningBalances:
    YearResult['ownedNonRothIraPhysicalOpeningBalances']
  readonly qualifiedAnnuityPayments: YearResult['qualifiedAnnuityPayments']
  readonly socialSecurityStreams: YearResult['socialSecurityStreams']
  readonly employerMatch: YearResult['employerMatch']
}

export interface AnnualYearResultRetirementPublication {
  readonly rmd: YearResult['rmd']
  readonly rmdShortfallExciseTax: YearResult['rmdShortfallExciseTax']
  readonly rmdShortfallExciseDetails: YearResult['rmdShortfallExciseDetails']
  readonly sepp: YearResult['sepp']
  readonly inheritedDistribution: YearResult['inheritedDistribution']
  readonly inheritedTraditionalDistribution:
    YearResult['inheritedTraditionalDistribution']
  readonly inheritedAccounts: YearResult['inheritedAccounts']
  readonly qcd: YearResult['qcd']
  readonly rothConversion: YearResult['rothConversion']
  readonly aggregateRothConversionAllocationBalances:
    YearResult['aggregateRothConversionAllocationBalances']
  readonly aggregateRothConversionAllocationDesired:
    YearResult['aggregateRothConversionAllocationDesired']
  readonly retirementRuntimeSource: YearResult['retirementRuntimeSource']
  readonly retirementRuntimeApplicationSource:
    YearResult['retirementRuntimeApplicationSource']
  readonly ownedNonRothIraPostGrowthSource:
    YearResult['ownedNonRothIraPostGrowthSource']
  readonly retirementActionExecution:
    YearResult['retirementActionExecution']
  readonly rothConversionActionExecution:
    YearResult['rothConversionActionExecution']
  readonly qcdActionExecution: YearResult['qcdActionExecution']
}

export interface AnnualYearResultTaxPublication {
  readonly penalties: YearResult['penalties']
  readonly magi: YearResult['magi']
  readonly aca: YearResult['aca']
  readonly medicarePremiums: YearResult['medicarePremiums']
  readonly irmaaSurcharge: YearResult['irmaaSurcharge']
  readonly irmaaTier: YearResult['irmaaTier']
  readonly irmaaLookbackMagi: YearResult['irmaaLookbackMagi']
  readonly irmaaLookbackMagiSource: YearResult['irmaaLookbackMagiSource']
  readonly irmaaLookbackMagiYear: YearResult['irmaaLookbackMagiYear']
  readonly irmaaNextTierThreshold: YearResult['irmaaNextTierThreshold']
  readonly advisoryFederalTax: NonNullable<YearResult['advisoryFederalTax']>
  readonly ltcgZeroHeadroom: YearResult['ltcgZeroHeadroom']
  readonly ssEarningsTestWithheld: YearResult['ssEarningsTestWithheld']
  readonly ssdiPaid: YearResult['ssdiPaid']
  readonly tax: YearResult['tax']
}

export interface AnnualYearResultFundingPublication {
  readonly withdrawals: YearResult['withdrawals']
  readonly realizedGains: Readonly<{
    withdrawal: number
    rebalance: number
    retirementAction: number
  }>
  readonly taxExemptInterest: YearResult['taxExemptInterest']
  readonly capitalLossUsedAgainstGains:
    YearResult['capitalLossUsedAgainstGains']
  readonly capitalLossUsedAgainstOrdinary:
    YearResult['capitalLossUsedAgainstOrdinary']
  readonly capitalLossCarryforwardRemaining:
    YearResult['capitalLossCarryforwardRemaining']
  readonly surplusInvested: YearResult['surplusInvested']
  readonly shortfall: YearResult['shortfall']
  readonly requiredShortfall: YearResult['requiredShortfall']
  readonly targetShortfall: YearResult['targetShortfall']
  readonly idealShortfall: YearResult['idealShortfall']
  readonly excessShortfall: YearResult['excessShortfall']
  readonly guardrailAction: YearResult['guardrailAction']
  readonly flexibleGoals: YearResult['flexibleGoals']
}

export interface AnnualYearResultBalanceSheetPublication {
  readonly snapshot: Readonly<AnnualSnapshot>
  readonly ladderValue: YearResult['ladderValue']
  readonly deathBenefit: YearResult['deathBenefit']
  readonly hecmDraw: YearResult['hecmDraw']
}

export interface AnnualYearResultAssemblyInput {
  readonly chronology: Readonly<AnnualYearResultChronology>
  readonly ledger: Readonly<AnnualYearResultLedgerPublication>
  readonly entityFacts: Readonly<PublishedEntityFacts>
  readonly retirement: Readonly<AnnualYearResultRetirementPublication>
  readonly settlement:
    Readonly<AnnualRetirementActionSettlementPublicationResult>
  readonly tax: Readonly<AnnualYearResultTaxPublication>
  readonly funding: Readonly<AnnualYearResultFundingPublication>
  readonly balanceSheet: Readonly<AnnualYearResultBalanceSheetPublication>
  /** Undefined means capture disabled; an input always publishes `cashFlow`. */
  readonly cashFlowInput?: Readonly<AssembleYearCashFlowInput>
}

/** Pure with respect to every caller-owned object, map, set, and array. */
export function annualYearResultAssembly(
  input: AnnualYearResultAssemblyInput,
): YearResult {
  const { chronology, ledger, entityFacts, retirement, settlement, tax, funding } =
    input
  const snapshot = input.balanceSheet.snapshot

  return {
    year: chronology.year,
    inflationScale: chronology.inflationScale,
    people: chronology.people,
    filingStatus: chronology.filingStatus,
    incomes: ledger.incomes,
    expenses: ledger.expenses,
    contributions: ledger.contributions,
    ownedNonRothIraContributions: ledger.ownedNonRothIraContributions,
    ownedNonRothIraBalancesBeforeGrowth:
      ledger.ownedNonRothIraBalancesBeforeGrowth,
    ownedNonRothIraPhysicalBalancesBeforeGrowth:
      ledger.ownedNonRothIraPhysicalBalancesBeforeGrowth,
    ownedNonRothIraPhysicalOpeningBalances:
      ledger.ownedNonRothIraPhysicalOpeningBalances,
    ownedRothIraPoolActivity: entityFacts.ownedRothIraPoolActivity,
    employerRothAccountActivity: entityFacts.employerRothAccountActivity,
    ownedTraditionalIraAggregateActivity:
      entityFacts.ownedTraditionalIraAggregateActivity,
    qualifiedAnnuityPayments: ledger.qualifiedAnnuityPayments,
    socialSecurityStreams: ledger.socialSecurityStreams,
    employerMatch: ledger.employerMatch,
    rmd: retirement.rmd,
    rmdShortfallExciseTax: retirement.rmdShortfallExciseTax,
    rmdShortfallExciseDetails: retirement.rmdShortfallExciseDetails,
    sepp: retirement.sepp,
    inheritedDistribution: retirement.inheritedDistribution,
    inheritedTraditionalDistribution:
      retirement.inheritedTraditionalDistribution,
    ...(retirement.inheritedAccounts === undefined
      ? {}
      : { inheritedAccounts: retirement.inheritedAccounts }),
    qcd: retirement.qcd,
    rothConversion: retirement.rothConversion,
    ...(retirement.aggregateRothConversionAllocationBalances === undefined
      ? {}
      : {
          aggregateRothConversionAllocationBalances:
            retirement.aggregateRothConversionAllocationBalances,
        }),
    ...(retirement.aggregateRothConversionAllocationDesired === undefined
      ? {}
      : {
          aggregateRothConversionAllocationDesired:
            retirement.aggregateRothConversionAllocationDesired,
        }),
    retirementRuntimeSource: retirement.retirementRuntimeSource,
    retirementRuntimeApplicationSource:
      retirement.retirementRuntimeApplicationSource,
    ownedNonRothIraPostGrowthSource:
      retirement.ownedNonRothIraPostGrowthSource,
    ...(retirement.retirementActionExecution === undefined
      ? {}
      : { retirementActionExecution: retirement.retirementActionExecution }),
    ...(settlement.retirementActionPublication === undefined
      ? {}
      : {
          retirementActionPublication:
            settlement.retirementActionPublication,
        }),
    ...(settlement.conversionLinkedWithdrawalGroupExecution === undefined
      ? {}
      : {
          conversionLinkedWithdrawalGroupExecution:
            settlement.conversionLinkedWithdrawalGroupExecution,
        }),
    ...(retirement.rothConversionActionExecution === undefined
      ? {}
      : {
          rothConversionActionExecution:
            retirement.rothConversionActionExecution,
        }),
    ...(settlement.qcdActionPrerequisites === undefined
      ? {}
      : {
          qcdActionPrerequisites:
            settlement.qcdActionPrerequisites.evidence,
        }),
    ...(settlement.qcdActionPrerequisites === undefined ||
      retirement.qcdActionExecution === undefined
      ? {}
      : { qcdActionExecution: retirement.qcdActionExecution }),
    penalties: tax.penalties,
    magi: tax.magi,
    ...(tax.aca === undefined ? {} : { aca: tax.aca }),
    medicarePremiums: tax.medicarePremiums,
    irmaaSurcharge: tax.irmaaSurcharge,
    irmaaTier: tax.irmaaTier,
    irmaaLookbackMagi: tax.irmaaLookbackMagi,
    irmaaLookbackMagiSource: tax.irmaaLookbackMagiSource,
    irmaaLookbackMagiYear: tax.irmaaLookbackMagiYear,
    irmaaNextTierThreshold: tax.irmaaNextTierThreshold,
    advisoryFederalTax: tax.advisoryFederalTax,
    amt: tax.advisoryFederalTax.detail.alternativeMinimumTax,
    ltcgZeroHeadroom: tax.ltcgZeroHeadroom,
    ssEarningsTestWithheld: tax.ssEarningsTestWithheld,
    ssdiPaid: tax.ssdiPaid,
    tax: tax.tax,
    withdrawals: funding.withdrawals,
    realizedGains:
      funding.realizedGains.withdrawal +
      funding.realizedGains.rebalance +
      funding.realizedGains.retirementAction,
    taxableYield: ledger.incomes.taxableYield,
    taxExemptInterest: funding.taxExemptInterest,
    capitalLossUsedAgainstGains: funding.capitalLossUsedAgainstGains,
    capitalLossUsedAgainstOrdinary:
      funding.capitalLossUsedAgainstOrdinary,
    capitalLossCarryforwardRemaining:
      funding.capitalLossCarryforwardRemaining,
    surplusInvested: funding.surplusInvested,
    shortfall: funding.shortfall,
    requiredShortfall: funding.requiredShortfall,
    targetShortfall: funding.targetShortfall,
    idealShortfall: funding.idealShortfall,
    excessShortfall: funding.excessShortfall,
    guardrailAction: funding.guardrailAction,
    flexibleGoals: funding.flexibleGoals,
    balances: snapshot.balanceRecord,
    investableTotal: snapshot.investableTotal,
    insuranceCashValue: snapshot.insuranceCashValueTotal,
    ladderValue: input.balanceSheet.ladderValue,
    deathBenefit: input.balanceSheet.deathBenefit,
    hecmDraw: input.balanceSheet.hecmDraw,
    hecmLoanBalance: snapshot.hecmLoanTotal,
    // Preserve the legacy left-to-right IEEE-754 association exactly.
    netWorth:
      snapshot.investableTotal +
      snapshot.propertyTotal -
      snapshot.debtTotal +
      snapshot.insuranceCashValueTotal +
      input.balanceSheet.ladderValue -
      snapshot.hecmEffectiveDebt,
    ...(input.cashFlowInput === undefined
      ? {}
      : { cashFlow: assembleYearCashFlow(input.cashFlowInput) }),
    // Every input is final at this boundary: the ledger's committed income and
    // expense totals and the settled tax and penalty scalars. Published last so
    // no existing key moves position — key order is observable output here.
    netPortfolioNeed: Math.max(
      0,
      ledger.expenses.total + tax.tax + tax.penalties - ledger.incomes.total,
    ),
  }
}
