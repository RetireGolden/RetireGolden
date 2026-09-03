/**
 * Execute the post-action annual funding, application, and close sequence.
 *
 * The input separates immutable annual facts, prior phase results, the live
 * ledger, callbacks, and optional cash-flow capture. This coordinator owns the
 * existing fixed-point funding loop, accepted ledger applications, post-solve
 * growth, tax/penalty settlement, and core YearResult assembly in their legacy
 * order. It returns that core result plus the optional optimizer probe.
 *
 * It does not choose or retry the owned non-Roth IRA settlement attempt, append
 * the year to the projection, or publish the optimizer probe; simulatePlan keeps
 * those outer orchestration effects.
 */
import type { Account, Person, Plan } from '../../model/plan.js'
import type { ParameterPack } from '../../params/types.js'
import type { IraProRataYear } from '../../strategies/iraBasis.js'
import type { SimulatorAnnualRetirementRuntimeOccurrence } from '../annualRetirementRuntimeJournal.js'
import type {
  InheritedAccountYearEvidence,
  OptimizerYearProbe,
  PersonYearState,
  ProjectedFilingStatus,
  SimulatorRetirementRuntimeApplication,
  SocialSecurityStreamActivity,
  TaxCalculator,
  TaxYearInput,
  YearResult,
  YearCashFlowTransferEndpoint,
} from '../types.js'
import type { AnnualCashFlowPenaltySnapshot } from '../annualCashFlowCapture.js'
import type { AnnualCashFlowYearSites } from '../annualCashFlowYearSites.js'
import type { EmployerElectiveAllocation } from '../employerRothCatchUp.js'
import type { AssetAllocationPolicy } from '../../model/plan.js'
import type { AnnualLiabilityRunTaxInput } from '../../actions/annualLiabilityRunIdentity.js'
import type { ConversionTaxFundingTaxUnitEvidence } from '../../actions/conversionTaxFundingEvidence.js'
import type { ConversionLinkedWithdrawalGroupLiabilityRun } from '../../actions/index.js'

import {
  hasSpouseTreatAsOwnElection,
  isTreatAsOwnEffective,
} from '../../strategies/accountEligibility.js'
import {
  ROTH_QUALIFIED_AGE,
  applyConversionPrincipalDebt,
  assumedSeedConsequentialSpill,
  type RothBasisState,
} from '../../strategies/rothBasis.js'
import { applyCapitalLossCarryforward, computeFederalTax, taxableSocialSecurity } from '../../tax/federalTax.js'
import { compareUtf16CodeUnits } from '../../actions/structuralId.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from '../moneyTolerance.js'
import type { PhaseLedgerScalarBindings } from './phaseLedgerScalars.js'
import { readPhaseLedgerScalars, writePhaseLedgerScalars } from './phaseLedgerScalars.js'
import {
  annualCoordinatedHecmAllocations,
  annualCoordinatedHecmEligibility,
} from './annualCoordinatedHecm.js'
import { annualHecmBackstopPlan } from './annualHecmBackstop.js'
import {
  annualAcaResultPublication,
  type AnnualAcaResultPublicationResult,
} from './annualAcaResultPublication.js'
import { annualOptimizerProbePublication } from './annualOptimizerProbePublication.js'
import { annualPermanentLifeTransitions } from './annualPermanentLifeTransitions.js'
import { annualSnapshot } from './annualSnapshot.js'
import { annualWithdrawalApplyFlowPlan } from './annualWithdrawalApplyFlowPlan.js'
import {
  annualWithdrawalPlan,
  annualWithdrawalStrategy,
} from './annualWithdrawalPlanning.js'
import { annualPostSolveAccountGrowth } from './annualPostSolveAccountGrowth.js'
import { annualRetirementActionSettlementPublication } from './annualRetirementActionSettlementPublication.js'
import { annualYearResultAssembly } from './annualYearResultAssembly.js'
import {
  annualFundingFixedPoint,
  type AnnualFundingFixedPointEvaluationRequest,
} from './annualFundingFixedPoint.js'
import {
  annualFundingWithdrawalEffects,
  type AnnualFundingWithdrawalEffectAccount,
  type AnnualHsaWithdrawalEffectAccount,
} from './annualFundingWithdrawalEffects.js'
import {
  annualFundingCandidateEvaluation,
  type AnnualFundingCandidateEvaluationContext,
} from './annualFundingCandidateEvaluation.js'
import { propertyEventsAndGrowth } from './propertyEventsAndGrowth.js'
import { publishedEntityFacts } from './publishedEntityFacts.js'
import { attributeShortfall } from '../../spending/layers.js'
import {
  AnnualLogicalBalanceLedger,
  type PhysicalBalanceState,
} from './annualLogicalBalanceLedger.js'
import type { FilingStatus } from '../../params/types.js'
import type {
  AnnualForcedDistributionQcdRetirementActionsResult,
} from './annualForcedDistributionQcdAndRetirementActions.js'
import type {
  AnnualAggregateRothConversionPhaseResult,
} from './annualAggregateRothConversionPhase.js'
import type { GuardrailAction } from '../../spending/guardrails.js'
import type { AcaSupportCode } from './types/aca.js'
import type { IrmaaLookbackMagiSource } from './annualHealthcareExpenses.js'
import type { AnnualIncomeSetupResult } from './annualIncomeSetup.js'
import { resolveAssetClassParams } from '../../allocation/assetClasses.js'

type SimulatorRetirementRuntimeApplicationWithoutOrdinal =
  SimulatorRetirementRuntimeApplication extends infer Application
  ? Application extends SimulatorRetirementRuntimeApplication
  ? Omit<Application, 'mutationOrdinal'>
  : never
  : never

type AcaContractYear = NonNullable<
  NonNullable<Plan['expenses']['healthcare']['acaYears']>[number]
>

type TreatAsOwnAccount = Parameters<typeof isTreatAsOwnEffective>[0]
type RothAccount = Extract<Account, { type: 'roth' }>
type HecmLineState = { loanBalance: number; principalLimit: number }

type Form8606ConsequentialChannel =
  | 'distributions'
  | 'conversions'
  | 'annuityPayments'

const EPSILON = ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS

export interface AnnualFundingApplicationAndClosePhaseFacts {
  readonly year: number
  readonly startYear: number
  readonly pack: Readonly<ParameterPack>
  readonly plan: Readonly<Plan>
  readonly primary: Readonly<Person>
  readonly personById: ReadonlyMap<string, Readonly<Person>>
  readonly peopleStates: PersonYearState[]
  readonly anyAlive: boolean
  readonly aliveCount: number
  readonly inflFactor: number
  readonly limitGrowth: number
  readonly taxFilingStatusForYear: FilingStatus
  readonly filingStatusForYear: ProjectedFilingStatus
  readonly safetyNetFloorToday: number
  readonly taxCalculator: TaxCalculator
  readonly contributions: number
  readonly traditionalInflow: number
  readonly otherInflow: number
  readonly taxableInflow: number
  readonly incomes: YearResult['incomes']
  readonly taxableYieldReinvested: number
  readonly ladderTaxableInterest: number
  readonly rebalanceRealizedGains: number
  readonly propertySaleProceedsTotal: number
  readonly acaActive: boolean
  readonly acaContract: AcaContractYear | undefined
  readonly acaInitialSupportCodes: readonly AcaSupportCode[]
  readonly acaGrossEnrollmentPremium: number
  readonly acaEnrollmentPremiums: readonly number[]
  readonly acaSlcspBenchmarkPremiums: readonly number[]
  readonly healthcareExcludingAcaEnrollment: number
  readonly healthcareExcludingMarketplacePremium: number
  readonly netCare: number
  readonly hsaReimburseLaterActive: boolean
  readonly exampleContractInputMismatch: boolean
  readonly acaContractsForYear: readonly AcaContractYear[]
  readonly marketplaceMonthsByPersonPosition: readonly number[]
  readonly pre65MonthlyPremiumPerPerson: number
  readonly healthInflFactor: number
  readonly isStandIn: boolean
  readonly planHasInheritedAccounts: boolean
  readonly ownedNonRothIraContributions: number
  readonly socialSecurityStreams: readonly SocialSecurityStreamActivity[]
  readonly qualifiedAnnuityPayments: YearResult['qualifiedAnnuityPayments']
  readonly employerMatch: number
  readonly employerAllocationByOwner: ReadonlyMap<string, EmployerElectiveAllocation>
  readonly ladderValueTotal: number
  readonly medicarePremiums: number
  readonly irmaaSurcharge: number
  readonly irmaaTier: number
  readonly irmaaMagi: number
  readonly irmaaLookbackMagiSource: IrmaaLookbackMagiSource
  readonly irmaaLookbackMagiYear: number | undefined
  readonly irmaaNextTierThreshold: number | null
  readonly ssEarningsTestWithheld: number
  readonly ssdiPaid: number
  readonly skippedRequiredNominal: number
  readonly skippedTargetNominal: number
  readonly skippedIdealNominal: number
  readonly skippedExcessNominal: number
  readonly guardrailAction: GuardrailAction
  readonly goalOutcomeCounts: {
    funded: number
    partiallyFunded: number
    deferred: number
    skipped: number
    fundedAmount: number
    unfundedAmount: number
  }
  readonly requiredLifestyle: number
  readonly targetLifestyle: number
  readonly targetLifestyleFunded: number
  readonly idealLifestyle: number
  readonly idealLifestyleFunded: number
  readonly excessLifestyle: number
  readonly excessLifestyleFunded: number
  readonly idealSpendingBase: number
  readonly excessSpendingBase: number
  readonly inflFactorFrom: (packYear: number, projectionYear: number) => number
  readonly returnShockAt: (year: number) => number
  readonly classShockAt: (year: number, classIndex: number) => number
  readonly classParams: ReturnType<typeof resolveAssetClassParams>
  readonly allocationTrack: Map<string, { policy: AssetAllocationPolicy; weights: number[] }>
  readonly distributedYieldByBalanceIndex: AnnualIncomeSetupResult['distributedYieldByBalanceIndex']
  readonly annuityStagingCandidates: readonly Readonly<{
    readonly contract: Account
    readonly funding: Account
    readonly ownerPersonId: string | null
  }>[]
  readonly startOfYearAnnuityContractValue: ReadonlyMap<string, number>
  readonly startOfYearPositionalBalances: readonly number[]
  readonly startOfYearBalance: ReadonlyMap<string, number>
  readonly conversionFundingTaxUnitEvidence: ConversionTaxFundingTaxUnitEvidence | null
  readonly annualLiabilityBaseline: ConversionLinkedWithdrawalGroupLiabilityRun | null
  readonly annualLiabilityNonGroupTaxInputs: readonly Readonly<AnnualLiabilityRunTaxInput>[]
  readonly exogenousStrategyDebits: readonly Readonly<{
    readonly accountId: string
    readonly amountPlanDollars: number
  }>[]
  readonly collidingEncodedProducerSegments: readonly string[]
  readonly publishCashFlow: boolean
  readonly captureOptimizerInputs: ((probe: OptimizerYearProbe) => void) | undefined
  readonly lifeAgeOf: (person: Readonly<Person>) => number
  readonly ssa44ActiveInYear: (year: number) => boolean
  readonly canonicalRuntimeOccurrenceOrder: (
    left: SimulatorAnnualRetirementRuntimeOccurrence,
    right: SimulatorAnnualRetirementRuntimeOccurrence,
  ) => number
}

export interface AnnualFundingApplicationAndClosePhaseLedger {
  balances: PhysicalBalanceState[]
  annualIdKeyedBalances: PhysicalBalanceState[]
  annualLogicalBalanceLedger: AnnualLogicalBalanceLedger
  iraProRata: Map<string, IraProRataYear>
  iraBasisByOwner: Map<string, number>
  rothBasis: Map<string, RothBasisState>
  rothAssumedContributionRemaining: Map<string, number>
  rothCounterfactualFreeCoverConsumed: Map<string, number>
  ownedRothAssumedBasisConsequentialByOwner: Map<string, number>
  employerRothAssumedBasisConsequentialByAccount: Map<string, number>
  form8606ConsequentialByOwner: Map<string, {
    distributions: number
    conversions: number
    annuityPayments: number
  }>
  warnings: Set<string>
  hecmStates: Map<string, HecmLineState>
  propertyValues: Map<string, number>
  debtBalances: Map<string, number>
  insuranceCashValues: Map<string, number>
  magiHistory: Map<number, number>
  inheritedYearEvidenceDraft: InheritedAccountYearEvidence[]
  annualRetirementRuntimeOccurrences: SimulatorAnnualRetirementRuntimeOccurrence[]
  annualRetirementRuntimeApplications: SimulatorRetirementRuntimeApplication[]
  annuityContractValue: Map<string, number>
  expenses: YearResult['expenses']
  /**
   * The money-bearing scalars this phase mutates, bound rather than copied.
   *
   * Every other field above is a container the phase mutates in place, so the
   * caller sees the change for free. These are numbers, and used to be copied
   * out of the ledger by a hand-written block at the call site — a block the
   * compiler never checked. See `readPhaseLedgerScalars`.
   */
  readonly scalars: PhaseLedgerScalarBindings<AnnualFundingApplicationAndClosePhaseScalars>
}

/**
 * The scalar simulator locals the funding-and-close phase owns for the year.
 *
 * One record, named once: the phase's opening read and its closing write are
 * both driven from it, so a new scalar cannot reach one end and miss the other.
 */
export interface AnnualFundingApplicationAndClosePhaseScalars {
  healthcare: number
  qualifiedMedicalThisYear: number
  hsaQualifiedCap: number
  requiredSpendingBase: number
  targetSpendingBase: number
  capitalLossPool: number
  hsaReimbursablePool: number
  depletionYear: number | null
  conversionNontaxable: number
  priorYearPortfolioReturnPct: number
}

export interface AnnualFundingApplicationAndClosePhaseCallbacks {
  readonly stateOf: (personId: string) => Readonly<PersonYearState>
  readonly isTreatAsOwnEffective: (
    account: Readonly<TreatAsOwnAccount>,
    taxYear: number,
  ) => boolean
  readonly isInheritedRothOutsideOwnedPool: (account: Readonly<RothAccount>) => boolean
  readonly rothPoolKey: (account: Readonly<RothAccount>) => string
  readonly splitAnnualIraDistribution: (
    readState: IraProRataYear,
    amount: number,
  ) => {
    readonly nontaxable: number
    readonly taxable: number
    readonly next: IraProRataYear
  }
  readonly resolveAssumedCharacter: (input: Readonly<{
    ownerPersonId: string
    calculationScope:
    | 'form8606Line7Distributions'
    | 'form8606Line8NetConversions'
    occurrenceKind:
    | 'ownedIraRmd'
    | 'annuityContractDistribution'
    | 'automaticSeppDistribution'
    | 'legacyNeedBasedWithdrawal'
    | 'legacyQcd'
    | 'legacyRothConversion'
    | 'namedRothConversion'
    producerOccurrenceKey: string
    sourceAccountId: string
    mutationOrdinal: number
    grossAmountPlanDollars: number
    remainingBasisPlanDollars?: number
  }>) => { basisReturn: number; ordinaryIncome: number } | null
  readonly noteForm8606Taxable: (
    ownerPersonId: string,
    taxable: number,
    channel: Form8606ConsequentialChannel,
  ) => void
  readonly recordAnnualRetirementRuntimeOccurrence: (
    occurrence: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
  ) => void
  readonly recordAnnualRetirementRuntimeApplication: (
    application: SimulatorRetirementRuntimeApplicationWithoutOrdinal,
  ) => SimulatorRetirementRuntimeApplication
  readonly runtimeOccurrenceKey: (
    kind: SimulatorAnnualRetirementRuntimeOccurrence['kind'],
    ...binding: readonly unknown[]
  ) => string
  readonly deposit: (amount: number) => void
  readonly inflRateAt: (year: number) => number
  readonly readUnassignedCash: () => number
  readonly readNextRetirementRuntimeMutationOrdinal: () => number
}

export interface AnnualFundingApplicationAndClosePhaseCapture {
  readonly yearSites: AnnualCashFlowYearSites
  readonly seppByAccountId: Map<string, { ownerPersonId: string | null; take: number }>
  readonly hecmCoordinatedByProperty: Map<string, number>
  readonly hecmBackstopByProperty: Map<string, number>
  readonly legacyPropertySaleDeposits: {
    propertyAccountId: string
    amount: number
    destination: YearCashFlowTransferEndpoint
  }[]
  readonly deathBenefits: {
    policyId: string
    insuredPersonId: string
    amount: number
    destination: YearCashFlowTransferEndpoint
  }[]
  readonly surplusDestination: YearCashFlowTransferEndpoint
  readonly cashFlowPenaltyLines: AnnualCashFlowPenaltySnapshot[]
  readonly rothPoolTaxableOrdinaryByPersonId: Map<string, number>
  readonly annuityBasisReturnByAccountId: Map<string, number>
  readonly rmdNontaxableByOwner: Map<string, number>
  readonly seppNontaxableByAccountId: Map<string, number>
  readonly aggregateConversionDraws: {
    sourceAccountId: string
    destinationAccountId: string
    ownerPersonId: string
    amount: number
    nontaxable: number
  }[]
  readonly qcdExclusionFromRmdByOwner: Map<string, number>
  readonly qcdExclusionBeyondRmdByOwner: Map<string, number>
  readonly qcdOrdinaryBeyondRmdByOwner: Map<string, number>
  readonly qcdBeyondRmdCharacterByOccurrence: {
    ownerId: string
    sourceAccountId: string
    exclusion: number
    ordinary: number
  }[]
  readonly qcdOrdinaryFromRmdByOwner: Map<string, number>
  readonly qcdBasisFromRmdByOwner: Map<string, number>
  readonly hsaNonqualifiedOrdinaryByAccountId: Map<string, number>
  readonly employerRothTaxableOrdinaryByAccountId: Map<string, number>
  readonly distributedYieldByAccountId: AnnualIncomeSetupResult['distributedYieldByAccountId']
}

export interface AnnualFundingApplicationAndClosePhasePrior {
  readonly forcedDistribution: AnnualForcedDistributionQcdRetirementActionsResult
  readonly aggregateRoth: AnnualAggregateRothConversionPhaseResult
}

export interface AnnualFundingApplicationAndClosePhaseInput {
  readonly facts: AnnualFundingApplicationAndClosePhaseFacts
  readonly prior: AnnualFundingApplicationAndClosePhasePrior
  readonly ledger: AnnualFundingApplicationAndClosePhaseLedger
  readonly callbacks: AnnualFundingApplicationAndClosePhaseCallbacks
  readonly capture: AnnualFundingApplicationAndClosePhaseCapture | null
}

export interface AnnualFundingApplicationAndClosePhaseResult {
  readonly yearResult: YearResult
  readonly optimizerProbe: OptimizerYearProbe | null
}

export function annualFundingApplicationAndClosePhase(
  input: AnnualFundingApplicationAndClosePhaseInput,
): AnnualFundingApplicationAndClosePhaseResult {
  const { facts, prior, ledger, callbacks, capture } = input
  const {
    year,
    startYear,
    pack,
    plan,
    primary,
    personById,
    peopleStates,
    anyAlive,
    aliveCount,
    inflFactor,
    limitGrowth,
    taxFilingStatusForYear,
    filingStatusForYear,
    safetyNetFloorToday,
    taxCalculator,
    contributions,
    traditionalInflow,
    otherInflow,
    taxableInflow,
    incomes,
    taxableYieldReinvested,
    ladderTaxableInterest,
    rebalanceRealizedGains,
    propertySaleProceedsTotal,
    acaActive,
    acaContract,
    acaInitialSupportCodes,
    acaGrossEnrollmentPremium,
    acaEnrollmentPremiums,
    acaSlcspBenchmarkPremiums,
    healthcareExcludingAcaEnrollment,
    healthcareExcludingMarketplacePremium,
    netCare,
    hsaReimburseLaterActive,
    exampleContractInputMismatch,
    acaContractsForYear,
    marketplaceMonthsByPersonPosition,
    pre65MonthlyPremiumPerPerson,
    healthInflFactor,
    isStandIn,
    planHasInheritedAccounts,
    ownedNonRothIraContributions,
    socialSecurityStreams,
    qualifiedAnnuityPayments,
    employerMatch,
    employerAllocationByOwner,
    ladderValueTotal,
    medicarePremiums,
    irmaaSurcharge,
    irmaaTier,
    irmaaMagi,
    irmaaLookbackMagiSource,
    irmaaLookbackMagiYear,
    irmaaNextTierThreshold,
    ssEarningsTestWithheld,
    ssdiPaid,
    skippedRequiredNominal,
    skippedTargetNominal,
    skippedIdealNominal,
    skippedExcessNominal,
    guardrailAction,
    goalOutcomeCounts,
    requiredLifestyle,
    targetLifestyle,
    targetLifestyleFunded,
    idealLifestyle,
    idealLifestyleFunded,
    excessLifestyle,
    excessLifestyleFunded,
    idealSpendingBase,
    excessSpendingBase,
    inflFactorFrom,
    returnShockAt,
    classShockAt,
    classParams,
    allocationTrack,
    distributedYieldByBalanceIndex,
    annuityStagingCandidates,
    startOfYearAnnuityContractValue,
    startOfYearPositionalBalances,
    startOfYearBalance,
    conversionFundingTaxUnitEvidence,
    annualLiabilityBaseline,
    annualLiabilityNonGroupTaxInputs,
    exogenousStrategyDebits,
    collidingEncodedProducerSegments,
    publishCashFlow,
    captureOptimizerInputs,
    lifeAgeOf,
    ssa44ActiveInYear,
    canonicalRuntimeOccurrenceOrder,
  } = facts
  const { forcedDistribution: forcedDistributionPhase, aggregateRoth: aggregateRothPhase } = prior
  const {
    rmdTotal,
    seppTotal,
    inheritedTotal,
    inheritedOrdinaryIncome,
    inheritedRothForced,
    rmdShortfallExciseResults,
    rmdShortfallExciseTax,
    qcd,
    qcdIncomeOffset,
    qcdFromRmd,
    namedQcdRmdSatisfied,
    namedQcdIncomeOffset,
    retirementActionExecution,
    retirementActionCash,
    retirementActionEquityCompensation,
    retirementActionProceeds,
    retirementActionTaxableProceeds,
    retirementActionCapitalGainOrLoss,
    namedRothConversionExecuted,
    namedRothConversionNontaxable,
    rothConversionActionExecution,
    effectiveLinkedWithdrawalGroups,
    legacyQcdCharacterizations,
    qcdActionExecution,
    linkedGroupAssessmentRequests,
    isAggregatedIraThisYear,
    rmdBalances,
    rmdObligationByAccount,
    rmdTakeByAccount,
    ownedIraRmdGrossByOwner,
    qcdFromRmdByOwner,
    qcdGrossByOwner,
    qcdQualifiedFromRmdByOwner,
    deferredLegacyQcdDistributions,
    qcdActionPrerequisiteResult,
  } = forcedDistributionPhase
  const rmdNontaxable = forcedDistributionPhase.rmdNontaxable
  const {
    incomeBeforeConversion,
    itemizedDeductions,
    residenceState,
    stateResidency,
    agesAlive,
    privateRetirementBase,
    publicPensionBase,
    generatedTaxExemptInterest,
    planDerivedTaxExemptInterest,
    yearTaxExemptInterest,
    acaForeignExclusionAddback,
    preWithdrawalCapitalResult,
    netCapitalForPreWithdrawalSizing,
    peopleAged65Plus,
    rothConversion,
    totalRothConversion,
    totalRothConversionTaxable,
    aggregateRothConversionTarget,
    aggregateRothConversionAllocationBalances,
    aggregateRothConversionAllocationDesired,
    yearConvertibleToRoth,
    ownedIraConversionTaxableFraction,
  } = aggregateRothPhase
  const {
    balances,
    annualIdKeyedBalances,
    annualLogicalBalanceLedger,
    iraProRata,
    iraBasisByOwner,
    rothBasis,
    rothAssumedContributionRemaining,
    rothCounterfactualFreeCoverConsumed,
    ownedRothAssumedBasisConsequentialByOwner,
    employerRothAssumedBasisConsequentialByAccount,
    form8606ConsequentialByOwner,
    warnings,
    hecmStates,
    propertyValues,
    debtBalances,
    insuranceCashValues,
    magiHistory,
    inheritedYearEvidenceDraft,
    annualRetirementRuntimeOccurrences,
    annualRetirementRuntimeApplications,
    annuityContractValue,
    expenses,
  } = ledger
  const openingScalars = readPhaseLedgerScalars(ledger.scalars)
  let healthcare = openingScalars.healthcare
  let qualifiedMedicalThisYear = openingScalars.qualifiedMedicalThisYear
  let hsaQualifiedCap = openingScalars.hsaQualifiedCap
  let requiredSpendingBase = openingScalars.requiredSpendingBase
  let targetSpendingBase = openingScalars.targetSpendingBase
  let capitalLossPool = openingScalars.capitalLossPool
  let hsaReimbursablePool = openingScalars.hsaReimbursablePool
  let depletionYear = openingScalars.depletionYear
  const conversionNontaxable = openingScalars.conversionNontaxable
  let priorYearPortfolioReturnPct = openingScalars.priorYearPortfolioReturnPct
  const {
    stateOf,
    isTreatAsOwnEffective,
    isInheritedRothOutsideOwnedPool,
    rothPoolKey,
    splitAnnualIraDistribution,
    resolveAssumedCharacter,
    noteForm8606Taxable,
    recordAnnualRetirementRuntimeOccurrence,
    recordAnnualRetirementRuntimeApplication,
    runtimeOccurrenceKey,
    deposit,
    inflRateAt,
    readUnassignedCash,
    readNextRetirementRuntimeMutationOrdinal,
  } = callbacks
  const yearSites = capture?.yearSites ?? null
  const seppByAccountId = capture?.seppByAccountId ?? null
  const hecmCoordinatedByProperty = capture?.hecmCoordinatedByProperty ?? null
  const hecmBackstopByProperty = capture?.hecmBackstopByProperty ?? null
  const legacyPropertySaleDeposits = capture?.legacyPropertySaleDeposits ?? null
  const deathBenefits = capture?.deathBenefits ?? null
  const surplusDestination = capture?.surplusDestination ?? null
  const cashFlowPenaltyLines = capture?.cashFlowPenaltyLines ?? null
  const rothPoolTaxableOrdinaryByPersonId = capture?.rothPoolTaxableOrdinaryByPersonId ?? null
  const annuityBasisReturnByAccountId = capture?.annuityBasisReturnByAccountId ?? null
  const rmdNontaxableByOwner = capture?.rmdNontaxableByOwner ?? null
  const seppNontaxableByAccountId = capture?.seppNontaxableByAccountId ?? null
  const aggregateConversionDraws = capture?.aggregateConversionDraws ?? null
  const qcdExclusionFromRmdByOwner = capture?.qcdExclusionFromRmdByOwner ?? null
  const qcdExclusionBeyondRmdByOwner = capture?.qcdExclusionBeyondRmdByOwner ?? null
  const qcdOrdinaryBeyondRmdByOwner = capture?.qcdOrdinaryBeyondRmdByOwner ?? null
  const qcdBeyondRmdCharacterByOccurrence = capture?.qcdBeyondRmdCharacterByOccurrence ?? null
  const qcdOrdinaryFromRmdByOwner = capture?.qcdOrdinaryFromRmdByOwner ?? null
  const qcdBasisFromRmdByOwner = capture?.qcdBasisFromRmdByOwner ?? null
  const hsaNonqualifiedOrdinaryByAccountId = capture?.hsaNonqualifiedOrdinaryByAccountId ?? null
  const employerRothTaxableOrdinaryByAccountId = capture?.employerRothTaxableOrdinaryByAccountId ?? null
  const distributedYieldByAccountId = capture?.distributedYieldByAccountId ?? null
  const opts = { captureOptimizerInputs }

    // --- fixed-point tax / withdrawal iteration ----------------------------
    // Only the taxable (post-pro-rata) part of a conversion is ordinary income.
    const ordinaryBase = incomeBeforeConversion + totalRothConversionTaxable

    // --- HECM coordinated draws (annuity-pension-and-home-equity, step 4) ---
    // Pfau's coordinated strategy: in the year after the portfolio actually
    // lost money (the realized wealth-weighted return the growth pass applied,
    // covering allocated and single-return accounts alike — not the raw
    // additive shock, which can be negative in a year the portfolio still
    // gained), fund spending from the line's tax-free loan proceeds instead of
    // selling depressed assets. Eligibility and capacity are established here;
    // the ACA/tax fixed point below sizes and commits the draw against the
    // post-credit pre-tax need. The year's taxes still ride the normal
    // withdrawal flow. Deterministic runs (no market series) never have a
    // losing year, so coordinated draws are Monte Carlo / scenario behavior;
    // the last-resort backstop below works everywhere.
    let hecmDraw: number
    const coordinatedHecm = annualCoordinatedHecmEligibility({
      accounts: plan.accounts,
      hecmStates,
      anyAlive,
      year,
      startYear,
      priorYearPortfolioReturnPct,
    })

    // Exact-taxed property sale proceeds enter the cash flow here (their gains
    // are already in the tax base above), so a sale can fund its own tax bill.
    // HECM draws are loan proceeds — cash in, never income.
    const baseCashInflows =
      incomes.total -
      taxableYieldReinvested +
      rmdTotal -
      qcdFromRmd -
      namedQcdRmdSatisfied +
      seppTotal +
      inheritedTotal +
      propertySaleProceedsTotal +
      retirementActionProceeds

    // The coordinator owns withdrawal-order resolution and candidate account
    // drains; the caller retains every accepted balance/basis/journal commit.
    const withdrawalStrategyResult = annualWithdrawalStrategy(Object.freeze({
      withdrawalOrder: plan.strategies.withdrawalOrder,
      year,
      readSizing: () => Object.freeze({
          year,
          pack,
          filingStatus: taxFilingStatusForYear,
          ordinaryIncomeBase: ordinaryBase,
          capitalGains: netCapitalForPreWithdrawalSizing,
          qualifiedDividends: incomes.qualifiedDividends,
          ssBenefits: incomes.socialSecurity,
          peopleAged65Plus,
          householdSize: aliveCount,
          taxExemptInterest: yearTaxExemptInterest,
          aca: aggregateRothConversionTarget.acaSizingInput,
          inflationScale: inflFactorFrom(pack.year, year),
          itemizedDeductions,
      }),
    }))
    if (withdrawalStrategyResult.warning !== null) {
      warnings.add(withdrawalStrategyResult.warning)
    }
    const withdrawalStrategy = withdrawalStrategyResult.strategy

    // Form 8606 character for need-based owned-IRA withdrawals. The separate
    // annualFundingWithdrawalEffects coordinator applies traditional, HSA, and
    // Roth early-withdrawal treatment after this taxable share is known. Its
    // modeled policy includes the 10% traditional additional tax, the HSA
    // 20% proxy, the employer-plan Rule-of-55 proxy, and Roth FIFO character.
    // SEPP distributions remain outside this need-based flow above, while this
    // helper owns only the annual Form 8606 taxable-share input to that policy.
    interface NeedBasedOwnedIraCharacter {
      readonly nontaxable: number
      readonly taxableBySourceAccountId: ReadonlyMap<string, number>
    }
    const needBasedOwnedIraCharacter = (
      byAccountId: ReadonlyMap<string, number>,
    ): NeedBasedOwnedIraCharacter => {
      const entriesByOwner = new Map<string, Array<{
        sourceAccountId: string
        grossAmount: number
        assumed: { basisReturn: number; ordinaryIncome: number } | null
      }>>()
      // A PREDICTION about a counter this phase does not own, stated plainly
      // because it is load-bearing and nothing in the type system holds it up.
      //
      // The character has to be known before the draw is applied, because the
      // character sizes the draw -- so the replay allocation identity has to be
      // derived from the mutation ordinal the application WILL receive. The
      // assumption is that the next applications recorded are exactly these
      // draws, one per aggregated IRA, in `rmdBalances` order, starting here.
      //
      // If it drifts, `resolveAssumedCharacter` finds no matching assumed effect
      // and returns null, and the draw prices on the pre-distribution pro-rata
      // state instead. That is the registered legacy fallback of
      // `irc-408-d-2-C-projection-pro-rata-measurement-instant`, not a wrong
      // answer -- and the attempt driver above this re-runs the annual pass
      // until the characters it assumed are the ones the run produced. What the
      // fallback does not do is announce itself, so the prediction is pinned by
      // `simulate.assumedCharacterOrdinalPrediction.test.ts` rather than left to
      // be discovered as a repriced year.
      //
      // Reserving the ordinals here instead of predicting them is not available:
      // this helper runs twice per pass (a probe while sizing, then again once
      // the draw settles) and a reservation taken during a discarded probe would
      // burn ordinals that other applications recorded in between would then be
      // numbered around, moving the journal for every plan.
      let predictedOrdinal = readNextRetirementRuntimeMutationOrdinal()
      for (const state of rmdBalances) {
        if (!isAggregatedIraThisYear(state.account)) continue
        const grossAmount = byAccountId.get(state.account.id) ?? 0
        if (grossAmount <= 0) continue
        const ownerPersonId = state.account.ownerPersonId ?? primary.id
        const producerOccurrenceKey = runtimeOccurrenceKey(
          'legacyNeedBasedWithdrawal',
          state.account.id,
        )
        const assumed = resolveAssumedCharacter({
          ownerPersonId,
          calculationScope: 'form8606Line7Distributions',
          occurrenceKind: 'legacyNeedBasedWithdrawal',
          producerOccurrenceKey,
          sourceAccountId: state.account.id,
          mutationOrdinal: predictedOrdinal,
          grossAmountPlanDollars: grossAmount,
        })
        predictedOrdinal += 1
        entriesByOwner.set(ownerPersonId, [
          ...(entriesByOwner.get(ownerPersonId) ?? []),
          { sourceAccountId: state.account.id, grossAmount, assumed },
        ])
      }
      let nontaxable = 0
      const taxableBySourceAccountId = new Map<string, number>()
      for (const [ownerPersonId, entries] of entriesByOwner) {
        if (entries.every((entry) => entry.assumed !== null)) {
          for (const entry of entries) {
            const assumed = entry.assumed!
            nontaxable += assumed.basisReturn
            taxableBySourceAccountId.set(
              entry.sourceAccountId,
              (taxableBySourceAccountId.get(entry.sourceAccountId) ?? 0) +
                assumed.ordinaryIncome,
            )
          }
          continue
        }
        const grossAmount = entries.reduce(
          (total, entry) => total + entry.grossAmount,
          0,
        )
        const proRata = iraProRata.get(ownerPersonId)
        const split = proRata === undefined
          ? { nontaxable: 0, taxable: grossAmount }
          : splitAnnualIraDistribution(proRata, grossAmount)
        nontaxable += split.nontaxable
        const taxableFraction = grossAmount > 0
          ? split.taxable / grossAmount
          : 1
        for (const entry of entries) {
          taxableBySourceAccountId.set(
            entry.sourceAccountId,
            (taxableBySourceAccountId.get(entry.sourceAccountId) ?? 0) +
              entry.grossAmount * taxableFraction,
          )
        }
      }
      return { nontaxable, taxableBySourceAccountId }
    }

    // Snapshot the candidate-withdrawal identity once per annual pass. The
    // coordinator never sees live balances or caller-owned warning/basis maps.
    const fundingWithdrawalEffectAccounts = Object.freeze(
      rmdBalances.flatMap((state): AnnualFundingWithdrawalEffectAccount[] => {
        if (state.account.type === 'traditional') {
          const ownerId = state.account.ownerPersonId ?? primary.id
          return [Object.freeze({
            kind: 'traditional',
            sourceAccountId: state.account.id,
            account: state.account,
            ownerAgeAttained: stateOf(ownerId).ageAttained,
            ownerRetirementAge:
              personById.get(ownerId)?.retirementAge ?? null,
            treatAsOwnEffective:
              isTreatAsOwnEffective(state.account, year),
          })]
        }
        if (state.account.type === 'roth') {
          const ownerId = state.account.ownerPersonId ?? primary.id
          return [Object.freeze({
            kind: 'roth',
            sourceAccountId: state.account.id,
            poolKey: isInheritedRothOutsideOwnedPool(state.account)
              ? null
              : rothPoolKey(state.account),
            ownerAgeAttained: stateOf(ownerId).ageAttained,
          })]
        }
        if (state.account.type === 'hsa') {
          const ownerId = state.account.ownerPersonId ?? primary.id
          return [Object.freeze({
            kind: 'hsa',
            sourceAccountId: state.account.id,
            withdrawalTreatment: state.account.withdrawalTreatment,
            ownerAgeAttained: stateOf(ownerId).ageAttained,
          })]
        }
        return []
      }),
    )
    const fundingHsaEffectAccounts = fundingWithdrawalEffectAccounts.filter(
      (row): row is AnnualHsaWithdrawalEffectAccount => row.kind === 'hsa',
    )

    // Pro-rata (Form 8606) return-of-basis in a candidate's need-based IRA
    // draws (step 5). Pure — probed against the uncommitted per-owner year
    // state; the pools commit once, after the final plan.
    // Withdrawals hold the safety-net floor (nominal) back from liquid accounts.
    const floorReserveNominal = safetyNetFloorToday > 0 ? safetyNetFloorToday * inflFactor : 0

    // Capital-loss carryforward (today's start-of-year pool, constant across the
    // iteration); netting reduces ordinary + gains before both federal and state
    // tax so the AGI cascade (taxable SS, IRMAA, ACA, state) falls out for free.
    const lossOffsetLimit = pack.federalTax.capitalLossOrdinaryOffsetLimit
    const fundingCandidateAcaContract = acaContract
      ? Object.freeze({
          taxFamilySize: acaContract.taxFamilyMembers.length,
          fplRegion: acaContract.fplRegion,
          taxExemptInterest: acaContract.taxExemptInterest,
          foreignExclusionAddback: acaContract.foreignExclusionAddback,
          dependents: Object.freeze(
            acaContract.taxFamilyMembers
              .filter((member) => member.relationship === 'dependent')
              .map((member) => Object.freeze({
                personId: member.personId,
                requiredToFile: member.requiredToFile,
                magi: member.magi,
              })),
          ),
        })
      : null
    const fundingCandidateEvaluationContext:
      AnnualFundingCandidateEvaluationContext = Object.freeze({
        withdrawalEffectAccounts: fundingWithdrawalEffectAccounts,
        hsaEffectAccounts: fundingHsaEffectAccounts,
        rothBasisByPool: rothBasis,
        taxCalculator,
        taxInputBase: Object.freeze({
          year,
          filingStatus: filingStatusForYear,
          taxableInterestIncome: incomes.taxableInterest + ladderTaxableInterest,
          taxExemptInterest: yearTaxExemptInterest,
          foreignExclusionAddback: acaForeignExclusionAddback,
          usGovernmentInterest: ladderTaxableInterest,
          ordinaryDividends: incomes.ordinaryDividends,
          qualifiedDividends: incomes.qualifiedDividends,
          ssBenefits: incomes.socialSecurity,
          peopleAged65Plus,
          inflationScale: limitGrowth,
          state: residenceState,
          stateResidency,
          publicPensionIncome: publicPensionBase,
          agesAlive,
          itemizedDeductions,
        }),
        ordinaryIncomeBase: ordinaryBase,
        privateRetirementIncomeBase: privateRetirementBase,
        preWithdrawalCapitalResult,
        capitalLossCarryforward: capitalLossPool,
        capitalLossOrdinaryOffsetLimit: lossOffsetLimit,
        currentHealthcare: healthcare,
        aca: Object.freeze({
          active: acaActive,
          contract: fundingCandidateAcaContract,
          initialSupportCodes: acaInitialSupportCodes,
          generatedTaxExemptInterest,
          planDerivedTaxExemptInterest,
          grossEnrollmentPremium: acaGrossEnrollmentPremium,
          enrollmentPremiums: acaEnrollmentPremiums,
          slcspBenchmarkPremiums: acaSlcspBenchmarkPremiums,
          healthcareExcludingEnrollment: healthcareExcludingAcaEnrollment,
          pricingInflationScale: inflFactorFrom(pack.year, year),
        }),
        hsa: Object.freeze({
          initialQualifiedCap: hsaQualifiedCap,
          qualifiedExpenseCap:
            healthcareExcludingMarketplacePremium +
            netCare +
            (hsaReimburseLaterActive ? hsaReimbursablePool : 0),
        }),
        parameterPack: pack,
        spendingAndContributions: expenses.total + contributions,
        rmdShortfallExciseTax,
        tolerancePlanDollars: EPSILON,
      })
    const evaluateWithdrawalNeed = (
      request: AnnualFundingFixedPointEvaluationRequest,
    ) => {
      const withdrawalPlan = annualWithdrawalPlan(Object.freeze({
        needPlanDollars: request.need,
        states: Object.freeze([...rmdBalances]),
        strategy: withdrawalStrategy,
        year,
        liquidReservePlanDollars: floorReserveNominal,
      }))
      const iraCharacterProbe = needBasedOwnedIraCharacter(
        withdrawalPlan.byAccountId,
      )
      const evaluation = annualFundingCandidateEvaluation(Object.freeze({
        ...fundingCandidateEvaluationContext,
        request,
        withdrawalPlan,
        iraCharacter: iraCharacterProbe,
      }))
      if (evaluation.traditionalEarlyWithdrawalPenaltyCharged) {
        warnings.add(
          'Early-withdrawal penalties were charged (pre-59½ traditional or pre-65 HSA).',
        )
      }
      return evaluation
    }
    // The selected plan, tax, and premium stay paired; never recompute from accepted cash.
    const fundingFixedPoint = annualFundingFixedPoint({
      spendingUsesBeforeTax: expenses.total + contributions,
      baseCashInflows,
      currentHealthcare: healthcare,
      coordinatedHecmCapacity: coordinatedHecm.capacity,
      acaActive,
      acaGrossEnrollmentPremium,
      acaInitialSupportCodeCount: acaInitialSupportCodes.length,
      tolerancePlanDollars: EPSILON,
      evaluate: evaluateWithdrawalNeed,
    })
    const cashInflows = fundingFixedPoint.acceptedCashInflows
    hecmDraw = fundingFixedPoint.acceptedCoordinatedHecmDraw
    const {
      evaluation,
      converged,
      acaFixedPointFailed,
      acaConflictingCliffBasins,
      evaluationCount: acaEvaluationCount,
      maxEvaluationCount,
    } = fundingFixedPoint

    if (acaFixedPointFailed) {
      warnings.add(
        `ACA premium, tax, and withdrawals did not reach a stable subsidized fixed point for ${year}; gross enrollment premium was funded.`,
      )
    } else if (!converged) {
      warnings.add(
        `Tax and withdrawal funding could not reconcile within half a cent for ${year}; the closest result differs by $${fundingFixedPoint.closestResidual.toFixed(2)}.`,
      )
    }
    if (acaConflictingCliffBasins) {
      warnings.add(
        `ACA funding has conflicting subsidized and gross-premium fixed points for ${year}; gross enrollment premium was funded.`,
      )
    }

    const healthcareDelta = evaluation.healthcare - healthcare
    if (Math.abs(healthcareDelta) > 0) {
      healthcare = evaluation.healthcare
      qualifiedMedicalThisYear = healthcareExcludingMarketplacePremium + netCare
      hsaQualifiedCap = evaluation.hsaQualifiedCap
      requiredSpendingBase += healthcareDelta
      targetSpendingBase += healthcareDelta
      expenses.healthcare = healthcare
      expenses.requiredSpending += healthcareDelta
      expenses.targetSpending += healthcareDelta
      expenses.intendedSpending += healthcareDelta
      expenses.total += healthcareDelta
    }
    const { withdrawalPlan, tax, penalties } = evaluation
    // Commit only the coordinated draw accepted by the converged ACA/tax
    // funding solve. Capacity was measured before probing and no line balance
    // has changed since, so allocation is deterministic across multiple lines.
    for (const allocation of annualCoordinatedHecmAllocations({
      acceptedDraw: hecmDraw,
      propertyAccountIds: coordinatedHecm.propertyAccountIds,
      hecmStates,
    })) {
      const line = hecmStates.get(allocation.propertyAccountId)
      if (!line) continue
      line.loanBalance += allocation.amount
      hecmCoordinatedByProperty?.set(
        allocation.propertyAccountId,
        allocation.amount,
      )
    }
    // Any open HECM line backstops a true portfolio shortfall regardless of
    // draw policy — no borrower defaults on spending with credit available.
    // The policy only controls proactive (coordinated) draws above.
    const hecmBackstop = annualHecmBackstopPlan(Object.freeze({
      accounts: plan.accounts,
      hecmStates,
      portfolioShortfall: withdrawalPlan.shortfall,
      anyAlive,
    }))
    for (const allocation of hecmBackstop.allocations) {
      const line = hecmStates.get(allocation.propertyAccountId)
      if (!line) continue
      line.loanBalance += allocation.amount
      hecmBackstopByProperty?.set(
        allocation.propertyAccountId,
        allocation.amount,
      )
    }
    const hecmShortfallDraw = hecmBackstop.draw
    hecmDraw += hecmShortfallDraw
    const shortfallAfterHecm = hecmBackstop.shortfallAfterHecm
    // The caller retains observable live line/map mutation, coordinated-then-
    // backstop accumulation, capture gating, and downstream residual use.
    // Those effects make this application loop orchestration, not HECM policy.
    const surplus = Math.max(0, cashInflows - expenses.total - contributions - tax - penalties)
    const iraCharacterFinal = needBasedOwnedIraCharacter(
      withdrawalPlan.byAccountId,
    )
    const withdrawalEffectsFinal = annualFundingWithdrawalEffects({
      accounts: fundingWithdrawalEffectAccounts,
      withdrawalsByAccountId: withdrawalPlan.byAccountId,
      traditionalTaxableByAccountId:
        iraCharacterFinal.taxableBySourceAccountId,
      rothBasisByPool: rothBasis,
      year,
      hsaQualifiedCap,
    })
    const rothEffectFinal = withdrawalEffectsFinal.roth
    const hsaEffectFinal = withdrawalEffectsFinal.hsa
    const iraNontaxableFinal = iraCharacterFinal.nontaxable
    if (publishCashFlow) {
      // Pass-local penalty snapshot at committed finals. Assemble does not
      // re-walk the withdrawal-effects coordinator.
      for (const row of withdrawalEffectsFinal.traditional.rows) {
        cashFlowPenaltyLines!.push({
          attribution: 'account',
          accountId: row.sourceAccountId,
          penaltyClass: 'traditionalEarly',
          amount: row.amount,
        })
      }
      for (const row of withdrawalEffectsFinal.hsa.rows) {
        if (row.nonQualified > 0) {
          hsaNonqualifiedOrdinaryByAccountId!.set(
            row.sourceAccountId,
            row.nonQualified,
          )
        }
        if (row.penalty > 0) {
          cashFlowPenaltyLines!.push({
            attribution: 'account',
            accountId: row.sourceAccountId,
            penaltyClass: 'hsaNonMedical',
            amount: row.penalty,
          })
        }
      }
      for (const row of withdrawalEffectsFinal.roth.rows) {
        if (row.split === null) continue
        if (row.poolKey.startsWith('rothira:')) {
          const personId = row.poolKey.slice('rothira:'.length)
          if (row.split.penalty > 0) {
            cashFlowPenaltyLines!.push({
              attribution: 'rothPool',
              personId,
              penaltyClass: 'rothEarly',
              amount: row.split.penalty,
            })
          }
          if (row.split.taxableOrdinary > 0) {
            rothPoolTaxableOrdinaryByPersonId!.set(
              personId,
              row.split.taxableOrdinary,
            )
          }
        } else if (row.poolKey.startsWith('roth:')) {
          const accountId = row.poolKey.slice('roth:'.length)
          if (row.split.penalty > 0) {
            cashFlowPenaltyLines!.push({
              attribution: 'account',
              accountId,
              penaltyClass: 'rothEarly',
              amount: row.split.penalty,
            })
          }
          if (row.split.taxableOrdinary > 0) {
            employerRothTaxableOrdinaryByAccountId!.set(
              accountId,
              row.split.taxableOrdinary,
            )
          }
        }
      }
    }
    if (withdrawalPlan.reserveUsed > EPSILON) {
      warnings.add('Spending needs dipped into the taxable safety-net floor after all other accounts were exhausted.')
    }
    if (hsaEffectFinal.taxableOrdinary > EPSILON) {
      warnings.add(
        'Some HSA withdrawals exceeded modeled qualified medical expenses; the excess was taxed as ordinary income (and penalized before 65).',
      )
    }
    if (rothEffectFinal.penalty > 0) {
      warnings.add(
        'Early Roth distributions were penalized: earnings before 59½, or converted amounts tapped within 5 years (the conversion-ladder seasoning rule).',
      )
    }

    if (
      aggregateRothConversionTarget.fillToTargetSelected &&
      rothConversion > 0 &&
      withdrawalPlan.byCategory.traditional > 0.01
    ) {
      warnings.add(
        'Spending withdrawals from traditional accounts pushed income above the Roth-conversion target in some years.',
      )
    }

    // Apply the carryforward to the final realized figures, then commit the
    // depleted pool to next year. Netted ordinary/gains feed MAGI, taxable SS,
    // and the gain-harvesting headroom below, so the AGI cascade is consistent.
    // IRA pro-rata basis reduces the taxable traditional draw; non-qualified
    // HSA withdrawals add ordinary income.
    const lossNetting = applyCapitalLossCarryforward(
      capitalLossPool,
      Math.max(
        0,
        ordinaryBase +
          withdrawalPlan.byCategory.traditional -
          iraNontaxableFinal +
          rothEffectFinal.taxableOrdinary +
          hsaEffectFinal.taxableOrdinary,
      ),
      preWithdrawalCapitalResult + withdrawalPlan.realizedGains,
      lossOffsetLimit,
    )
    capitalLossPool = lossNetting.remaining

    // Record realized MAGI (≈ AGI) for IRMAA's 2-year lookback and ACA. Non-
    // qualified Roth earnings are ordinary income, so they lift MAGI too.
    // gainsRealized is signed (a net capital loss is negative); floor MAGI at 0.
    const ordinaryRealized = lossNetting.ordinaryAfter
    const gainsRealized = lossNetting.netCapitalGain
    const realizedCapitalGainsBeforeCarryforward =
      preWithdrawalCapitalResult + withdrawalPlan.realizedGains
    const taxableSs = taxableSocialSecurity(
      pack,
      taxFilingStatusForYear,
      ordinaryRealized + gainsRealized + incomes.qualifiedDividends,
      incomes.socialSecurity,
      yearTaxExemptInterest,
      acaForeignExclusionAddback,
    )
    magiHistory.set(
      year,
      Math.max(
        0,
        ordinaryRealized +
          gainsRealized +
          incomes.qualifiedDividends +
          taxableSs +
          yearTaxExemptInterest,
      ),
    )

    // Gain-harvesting advisory: room left in the 0% LTCG bracket this year, given
    // the realized income and deductions (roadmap V8 §4). Advisory only — the
    // engine doesn't auto-harvest. Federal-law boundary, so computed federally.
    // Capture the input + detail for planning surfaces; do not recompute later.
    const advisoryFederalTaxInput: TaxYearInput = {
      year,
      filingStatus: filingStatusForYear,
      ordinaryIncome: ordinaryRealized,
      capitalGains: gainsRealized,
      realizedCapitalGainsBeforeCarryforward,
      taxableInterestIncome: incomes.taxableInterest + ladderTaxableInterest,
      taxExemptInterest: yearTaxExemptInterest,
      foreignExclusionAddback: acaForeignExclusionAddback,
      usGovernmentInterest: ladderTaxableInterest,
      ordinaryDividends: incomes.ordinaryDividends,
      qualifiedDividends: incomes.qualifiedDividends,
      ssBenefits: incomes.socialSecurity,
      peopleAged65Plus,
      inflationScale: limitGrowth,
      itemizedDeductions,
    }
    const federalDetail = computeFederalTax(advisoryFederalTaxInput)
    const ltcgZeroHeadroom = federalDetail.zeroRateLtcgHeadroom
    if (federalDetail.alternativeMinimumTax > EPSILON) {
      warnings.add('The planning-grade AMT screen bound in at least one year; tax includes the AMT excess.')
    }

    let yearAcaResult: AnnualAcaResultPublicationResult['yearAcaResult']
    if (acaActive) {
      const acaContractSnapshot = acaContract
        ? Object.freeze({
            fplRegion: acaContract.fplRegion,
            taxFamilyMembers: Object.freeze(
              acaContract.taxFamilyMembers.map((member) => Object.freeze({
                personId: member.personId,
                relationship: member.relationship,
                requiredToFile: member.requiredToFile,
                magi: member.magi,
              })),
            ),
            coveredMembers: Object.freeze(
              acaContract.coveredMembers.map((member) => Object.freeze({
                personId: member.personId,
                enrollmentPremiumByMonth: Object.freeze([
                  ...member.enrollmentPremiumByMonth,
                ]),
                slcspBenchmarkPremiumByMonth: Object.freeze([
                  ...member.slcspBenchmarkPremiumByMonth,
                ]),
              })),
            ),
          })
        : null
      const acaMagiProbeSnapshot = evaluation.acaMagiProbe === null
        ? null
        : Object.freeze({
            magi: evaluation.acaMagiProbe.magi,
            components: Object.freeze({ ...evaluation.acaMagiProbe.components }),
            dependents: Object.freeze(
              evaluation.acaMagiProbe.dependents.map((dependent) =>
                Object.freeze({ ...dependent })),
            ),
          })
      const acaPublication = annualAcaResultPublication(Object.freeze({
        active: true,
        evaluation: Object.freeze({
          requiredNeed: evaluation.requiredNeed,
          withdrawalTotal: evaluation.withdrawalPlan.byCategory.total,
          withdrawalShortfall: evaluation.withdrawalPlan.shortfall,
          acaSupportCodes: Object.freeze([...evaluation.acaSupportCodes]),
          acaQuote: evaluation.acaQuote === null
            ? null
            : Object.freeze({ ...evaluation.acaQuote }),
          acaMagiProbe: acaMagiProbeSnapshot,
        }),
        fixedPointFailed: acaFixedPointFailed,
        converged,
        conflictingCliffBasins: acaConflictingCliffBasins,
        evaluationCount: acaEvaluationCount,
        maxEvaluationCount,
        contract: acaContractSnapshot,
        contractCount: acaContractsForYear.length,
        exampleContractInputMismatch,
        isStandIn,
        people: Object.freeze(
          peopleStates.map((person) => Object.freeze({
            personId: person.personId,
            alive: person.alive,
          })),
        ),
        marketplaceMonthsByPersonPosition: Object.freeze([
          ...marketplaceMonthsByPersonPosition,
        ]),
        pre65MonthlyPremiumPerPerson,
        healthInflationScale: healthInflFactor,
        parameterPack: pack,
        fplInflationScale: inflFactorFrom(pack.year, year),
        federalAgi: federalDetail.agiBeforeFloor,
        grossSocialSecurity: incomes.socialSecurity,
        taxableSocialSecurity: federalDetail.taxableSocialSecurity,
        taxExemptInterest: yearTaxExemptInterest,
        foreignExclusionAddback: acaForeignExclusionAddback,
        grossEnrollmentPremium: acaGrossEnrollmentPremium,
        slcspBenchmarkPremiums: Object.freeze([
          ...acaSlcspBenchmarkPremiums,
        ]),
        healthcare,
        healthcareExcludingAcaEnrollment,
      }))
      yearAcaResult = acaPublication.yearAcaResult
      for (const warning of acaPublication.warnings) warnings.add(warning)
    }

    // V8 optimizer linearization probe (no-op unless a sink is supplied). The
    // ordinary base excludes all traditional distributions and conversions —
    // `incomeBeforeConversion` already nets out preTaxContributions and QCD and
    // includes RMD, so subtracting RMD leaves the non-traditional ordinary
    // income; the baseline taxable-SS portion is folded in as a constant.
    let optimizerProbe: OptimizerYearProbe | null = null
    if (opts.captureOptimizerInputs) {
      const traditionalAccountSnapshots = Object.freeze(
        rmdBalances.flatMap((state) => {
          if (state.account.type !== 'traditional') return []
          const inheritedOpeningBucket =
            state.account.inherited !== undefined
          const treatAsOwnEffective =
            isTreatAsOwnEffective(state.account, year)
          const includedInOwnerTraditional =
            !inheritedOpeningBucket || treatAsOwnEffective
          const remainingTaxableFraction =
            includedInOwnerTraditional &&
            isAggregatedIraThisYear(state.account)
              ? ownedIraConversionTaxableFraction(
                  state.account.ownerPersonId ?? primary.id,
                )
              : 1
          return [Object.freeze({
            openingBalance:
              startOfYearBalance.get(state.account.id) ?? 0,
            closingBalance: state.balance,
            inheritedOpeningBucket,
            hasSpouseTreatAsOwnElection:
              hasSpouseTreatAsOwnElection(state.account),
            treatAsOwnEffective,
            rmdObligation:
              rmdObligationByAccount.get(state.account.id) ?? 0,
            ownerWithdrawal:
              withdrawalPlan.byAccountId.get(state.account.id) ?? 0,
            includedInOwnerTraditional,
            remainingTaxableFraction,
            convertibleToRoth: yearConvertibleToRoth(state.account),
          })]
        }),
      )
      const ordinaryActionSnapshot =
        retirementActionExecution?.committed
          ? Object.freeze({
              committed: true,
              balances: Object.freeze(
                retirementActionExecution.balances.map((snapshot) =>
                  Object.freeze({
                    accountId: String(snapshot.accountId),
                    openingBalanceCents: BigInt(snapshot.openingBalance),
                    closingBalanceCents: BigInt(snapshot.closingBalance),
                  })),
              ),
            })
          : retirementActionExecution === undefined
            ? null
            : Object.freeze({ committed: false, balances: Object.freeze([]) })
      const conversionActionSnapshot =
        rothConversionActionExecution?.committed
          ? Object.freeze({
              committed: true,
              evidence: Object.freeze(
                rothConversionActionExecution.evidence.map((evidence) =>
                  Object.freeze({
                    outcome: evidence.outcome,
                    destinationRothAccountId:
                      String(evidence.destinationRothAccountId),
                    allocations: Object.freeze(
                      evidence.allocations.map((allocation) =>
                        Object.freeze({
                          sourceAccountId:
                            String(allocation.sourceAccountId),
                          executedAmountCents:
                            BigInt(allocation.executedAmount),
                        })),
                    ),
                  })),
              ),
            })
          : rothConversionActionExecution === undefined
            ? null
            : Object.freeze({ committed: false, evidence: Object.freeze([]) })
      const qcdActionSnapshot = qcdActionExecution?.committed
        ? Object.freeze({
            committed: true,
            evidence: Object.freeze(
              qcdActionExecution.evidence.map((evidence) =>
                Object.freeze({
                  sourceAccountId: String(evidence.sourceAccountId),
                  executedAmountCents: BigInt(evidence.executedAmount),
                })),
            ),
          })
        : qcdActionExecution === undefined
          ? null
          : Object.freeze({ committed: false, evidence: Object.freeze([]) })
      const optimizerAcaSnapshot = yearAcaResult === undefined
        ? undefined
        : Object.freeze({
            readiness: yearAcaResult.readiness,
            federalPovertyLine: yearAcaResult.federalPovertyLine,
            householdMagi: yearAcaResult.householdMagi,
            modeledAllowablePtc: yearAcaResult.modeledAllowablePtc,
            cliffState: yearAcaResult.cliffState,
          })
      optimizerProbe = annualOptimizerProbePublication(Object.freeze({
        year,
        traditionalAccounts: traditionalAccountSnapshots,
        ordinaryAction: ordinaryActionSnapshot,
        conversionAction: conversionActionSnapshot,
        qcdAction: qcdActionSnapshot,
        runtimeOccurrences: Object.freeze(
          annualRetirementRuntimeOccurrences.map((occurrence) =>
            Object.freeze({
              sourceAccountId: occurrence.sourceAccountId === null
                ? null
                : String(occurrence.sourceAccountId),
              kind: occurrence.kind,
              grossAmountPlanDollars:
                occurrence.grossAmountPlanDollars,
            })),
        ),
        exogenousStrategyDebits: Object.freeze(
          exogenousStrategyDebits.map((debit) => Object.freeze({
            accountId: debit.accountId,
            amountPlanDollars: debit.amountPlanDollars,
          })),
        ),
        rmdTotal,
        rmdNontaxable,
        inheritedOrdinaryIncome,
        qcdIncomeOffset,
        namedQcdIncomeOffset,
        qcdFromRmd,
        namedQcdRmdSatisfied,
        incomeBeforeConversion,
        taxableSocialSecurity: taxableSs,
        preWithdrawalCapitalResult,
        qualifiedDividends: incomes.qualifiedDividends,
        iraNontaxableFinal,
        namedRothConversionExecuted,
        namedRothConversionNontaxable,
        retirementActionProceeds,
        expensesTotal: expenses.total,
        contributions,
        incomesTotal: incomes.total,
        taxableYieldReinvested,
        traditionalInflow,
        otherInflow,
        taxableInflow,
        grossSocialSecurity: incomes.socialSecurity,
        taxExemptInterest: yearTaxExemptInterest,
        acaForeignExclusionAddback,
        yearAcaResult: optimizerAcaSnapshot,
        maxFplPctForCredit: pack.aca.maxFplPctForCredit,
        totalRothConversionTaxable,
        traditionalWithdrawal:
          withdrawalPlan.byCategory.traditional,
        taxableWithdrawal: withdrawalPlan.byCategory.taxable,
        totalRothConversion,
        taxableAmountForGrossConversion: (gross: number) =>
          aggregateRothConversionTarget.taxableAmountForGross(gross),
        seppTotal,
        peopleAged65Plus,
        ssa44IrmaaRedetermination: ssa44ActiveInYear(year),
      }))
    }

    // --- apply flows -------------------------------------------------------
    // Publish replacement inherited-evidence rows with voluntary amounts
    // (planner draws beyond the forced requirement this year). The helper
    // snapshot and each replacement are frozen; this draft array changes only
    // by replacing a slot, never by mutating a published evidence object.
    // Forced already reduced the balance, so the need-based plan is
    // voluntary-only for each still-inherited account.
    // S2 POST-FLIP rows keep voluntaryAmount 0: owner-side draws are not
    // inherited voluntary draws (the flip already moved the account out of
    // the inherited schedule). The helper builds the last-wins account lookup
    // once per year so evidence rows do not scan every balance.
    const withdrawalApplyFlowPlan = annualWithdrawalApplyFlowPlan({
      year,
      balances: annualIdKeyedBalances,
      inheritedEvidence: inheritedYearEvidenceDraft,
      withdrawnByAccountId: withdrawalPlan.byAccountId,
      taxableSales: withdrawalPlan.taxableSales,
      recordsOwnedIraApplicationFor: isAggregatedIraThisYear,
    })
    for (const write of withdrawalApplyFlowPlan.evidenceWrites) {
      const evidence = inheritedYearEvidenceDraft[write.evidenceIndex]
      if (evidence === undefined || evidence.accountId !== write.accountId) {
        throw new Error(
          'Withdrawal apply-flow evidence operation lost its row position',
        )
      }
      inheritedYearEvidenceDraft[write.evidenceIndex] = Object.freeze({
        ...evidence,
        voluntaryAmount: write.voluntaryAmount,
      })
    }
    for (const operation of withdrawalApplyFlowPlan.balanceOperations) {
      const state = annualIdKeyedBalances[operation.balanceIndex]
      const group = annualLogicalBalanceLedger.groups[operation.balanceIndex]
      // Planning and commit are intentionally adjacent. Fail before applying a
      // stale operation if a future change breaks the logical group boundary.
      if (
        state === undefined ||
        group === undefined ||
        state.account.id !== operation.accountId ||
        group.id !== operation.accountId ||
        state.balance !== operation.sourceBalanceBefore
      ) {
        throw new Error(
          'Withdrawal apply-flow operation lost its balance position',
        )
      }
      const taken = operation.taken
      // No sub-cent discharge here. A traditional draw the exact-cent ledger
      // records as zero never reaches this loop: `annualWithdrawalPlan` refuses to
      // allocate one, so the year's published traditional total, its ordinary
      // income and this movement are all derived from the same plan and cannot
      // disagree about whether the draw happened. Discharging here instead
      // would move the balance and leave the total claiming a withdrawal with
      // no occurrence to explain it.
      const sourceBalanceBefore = state.balance
      let ownedIraProducerOccurrenceKey: string | null = null
      if (operation.recordsTraditionalRuntimeOccurrence) {
        // Voluntary inherited traditional draws use this kind — distinct from
        // forced `inheritedIraRmd` (required / final-sweep) recorded above.
        const kind = 'legacyNeedBasedWithdrawal' as const
        const producerOccurrenceKey = runtimeOccurrenceKey(kind, state.account.id)
        recordAnnualRetirementRuntimeOccurrence({
          producerOccurrenceKey,
          kind,
          grossAmountPlanDollars: taken,
          ownerPersonId: state.account.ownerPersonId,
          sourceAccountId: state.account.id,
          executionDate: null,
          executionSequence: null,
          movementAuthorityId: null,
        })
        if (operation.recordsOwnedIraApplication) {
          ownedIraProducerOccurrenceKey = producerOccurrenceKey
        }
      }
      if (operation.taxableSaleMissing) {
        throw new Error('Planned taxable sale disappeared before commit')
      }
      group.applyClosingSnapshot({
        balance: operation.sourceBalanceAfter,
        ...(operation.costBasisAfter === null
          ? {}
          : { costBasis: operation.costBasisAfter }),
      })
      if (ownedIraProducerOccurrenceKey !== null) {
        recordAnnualRetirementRuntimeApplication({
          applicationKind: 'debit',
          producerOccurrenceKey: ownedIraProducerOccurrenceKey,
          simulatorPhase: 'legacyNeedBasedWithdrawal',
          ownerPersonId: state.account.ownerPersonId,
          sourceAccountId: state.account.id,
          sourceBalanceBeforePlanDollars: sourceBalanceBefore,
          appliedAmountPlanDollars: taken,
          sourceBalanceAfterPlanDollars: state.balance,
        })
      }
    }
    // Commit the Roth basis ordering (contributions → conversions → earnings) once
    // per pool, so next year's seasoning + earnings are correct across the owner's
    // aggregated Roth IRAs. Also annotate assumed-seed consumption (observation
    // only — does not change the split economics). Flag only when the spill into
    // assumed seed exceeds free-cover capacity at this moment (FIFO prefix of
    // seasoned conversion principal + wholly nontaxable unseasoned principal;
    // stops at the first unseasoned taxable layer).
    for (const row of withdrawalEffectsFinal.roth.rows) {
      if (row.split === null) continue
      const key = row.poolKey
      const taken = row.taken
      const age = row.ownerAgeAttained
      const split = row.split
      const rb = rothBasis.get(key)
      if (!rb) continue
      const assumedRemaining = rothAssumedContributionRemaining.get(key) ?? 0
      // Known contribution basis (supplied seed + credits) is consumed first;
      // only the residual draw into the assumed seed is a candidate spill.
      let fromAssumed = 0
      if (split.contributions > 0 && assumedRemaining > 0) {
        const knownContribution = Math.max(0, rb.contributionBasis - assumedRemaining)
        fromAssumed = Math.max(0, split.contributions - knownContribution)
        if (fromAssumed > 0) {
          rothAssumedContributionRemaining.set(
            key,
            Math.max(0, assumedRemaining - fromAssumed),
          )
        }
      }
      // Counterfactual conversion-principal tracker stays live for the pool's
      // remaining pre-60 draws even after the assumed seed is fully spent. An
      // early draw that re-homes assumed seed into free cover *or* unseasoned
      // taxable principal (and free layers behind it) consumes those layers in
      // the assumed-zero world; a later free-conversion take must evaluate
      // against that CF residual, not live free cover alone.
      if (age < ROTH_QUALIFIED_AGE && taken > 0) {
        const priorCfConversionExtra =
          rothCounterfactualFreeCoverConsumed.get(key) ?? 0
        if (fromAssumed > 0 || priorCfConversionExtra > 0) {
          // 1) Materialize CF layer state from PRE-DRAW layers with prior debt
          // applied first — never charge prior debt against split.next after the
          // live conversion take. Applying debt after can erase real CF
          // difference (e.g. $50 prior seed debt then $100 seasoned conversion
          // take: live residual is empty so post-draw debt is a no-op, hiding
          // that CF only had $50 principal for the shared conversion).
          // 2) Price fully ordered draws on BOTH sides with the same FIFO walk
          //    as splitRothWithdrawal — live conversion amount against live
          //    layers, CF amount (conversion + assumed seed, which is free
          //    contribution live) against debt-adjusted CF layers. Do NOT walk
          //    the live free-prefix length from the CF head (that misattributes
          //    free dollars onto CF mixed layers). Character-wise CF-vs-live
          //    gaps (earnings / unseasoned taxable) are tracked both ways: a
          //    consequence in either direction (supplying the omitted seed
          //    would CHANGE character up or down) is a verdict. One-way
          //    Math.max discarded the live-more path; L1 abs of both
          //    characters double-counts pure recharacterization.
          // 3) Reconcile the tracker: CF principal this walk consumed minus the
          //    live conversion take from the split (per-layer FIFO figures).
          //    Seed re-homing raises debt; live catch-up on principal CF already
          //    spent lowers it. Increment-only left stale debt after live
          //    consumed the same layers (e.g. $50 seed / $25 principal → $25
          //    debt, then live takes that $25 conversion: both worlds spent it).
          const cfLayers = applyConversionPrincipalDebt(
            rb.conversionLayers,
            priorCfConversionExtra,
          )
          // Shallow copy: the walk only reads layers; zero-debt returns the
          // live array itself, so the spread keeps the state type mutable
          // without per-object cloning on this hot path.
          const cfState = { contributionBasis: 0, conversionLayers: [...cfLayers] }
          const liveState = {
            contributionBasis: 0,
            conversionLayers: rb.conversionLayers,
          }
          // Mirror splitRothWithdrawal per-layer consumption on both sides.
          const liveWalk = assumedSeedConsequentialSpill(
            liveState,
            split.conversions,
            year,
            age,
            0,
          )
          const cfWalk = assumedSeedConsequentialSpill(
            cfState,
            split.conversions + fromAssumed,
            year,
            age,
            0,
          )
          // Both directions: CF-over-live and live-over-CF character gaps.
          // Verdict magnitude is the larger one-way gap (not L1 sum).
          const cfOverLive =
            Math.max(0, cfWalk.earningsSpill - liveWalk.earningsSpill) +
            Math.max(0, cfWalk.unseasonedTaxableSpill - liveWalk.unseasonedTaxableSpill)
          const liveOverCf =
            Math.max(0, liveWalk.earningsSpill - cfWalk.earningsSpill) +
            Math.max(
              0,
              liveWalk.unseasonedTaxableSpill - cfWalk.unseasonedTaxableSpill,
            )
          const consequentialSpill = Math.max(cfOverLive, liveOverCf)
          // CF-extra principal outstanding = prior extra + CF principal this
          // draw consumed − live conversion principal this draw (split figure).
          // Equivalent to seed-only debt when CF still has residual for the
          // shared conversion; reduces when live catch-up exceeds new CF spend.
          const nextCfConversionExtra = Math.max(
            0,
            priorCfConversionExtra +
              cfWalk.conversionPrincipalConsumed -
              split.conversions,
          )
          if (nextCfConversionExtra > 0) {
            rothCounterfactualFreeCoverConsumed.set(key, nextCfConversionExtra)
          } else {
            rothCounterfactualFreeCoverConsumed.delete(key)
          }
          if (consequentialSpill > 0) {
            if (key.startsWith('rothira:')) {
              const ownerPersonId = key.slice('rothira:'.length)
              ownedRothAssumedBasisConsequentialByOwner.set(
                ownerPersonId,
                (ownedRothAssumedBasisConsequentialByOwner.get(ownerPersonId) ?? 0) +
                  consequentialSpill,
              )
            } else if (key.startsWith('roth:')) {
              const accountId = key.slice('roth:'.length)
              employerRothAssumedBasisConsequentialByAccount.set(
                accountId,
                (employerRothAssumedBasisConsequentialByAccount.get(accountId) ?? 0) +
                  consequentialSpill,
              )
            }
          }
        }
      }
      rothBasis.set(key, split.next)
    }
    // Commit the year's Form-8606 IRA basis depletion from need-based draws
    // (RMD/SEPP/conversion basis already committed above as they happened).
    // The assumed-basis verdict reads the executed character that priced
    // tax/penalty (`iraCharacterFinal`); basis carryforward still depletes via
    // the same pro-rata state the year's forced draws already opened.
    {
      const needBasedTakenByOwner = new Map<string, number>()
      for (const state of rmdBalances) {
        if (!isAggregatedIraThisYear(state.account)) continue
        const taken = withdrawalPlan.byAccountId.get(state.account.id) ?? 0
        if (taken <= 0) continue
        const ownerId = state.account.ownerPersonId ?? primary.id
        needBasedTakenByOwner.set(
          ownerId,
          (needBasedTakenByOwner.get(ownerId) ?? 0) + taken,
        )
      }
      for (const [ownerId, taken] of needBasedTakenByOwner) {
        let executedTaxable = 0
        for (const state of rmdBalances) {
          if (!isAggregatedIraThisYear(state.account)) continue
          if ((state.account.ownerPersonId ?? primary.id) !== ownerId) continue
          const accountTaken = withdrawalPlan.byAccountId.get(state.account.id) ?? 0
          if (accountTaken <= 0) continue
          executedTaxable +=
            iraCharacterFinal.taxableBySourceAccountId.get(state.account.id) ??
            accountTaken
        }
        // Verdict: observe the character actually used for tax/penalty.
        noteForm8606Taxable(ownerId, executedTaxable, 'distributions')
        const proRata = iraProRata.get(ownerId)
        if (proRata === undefined) continue
        const split = splitAnnualIraDistribution(proRata, taken)
        iraBasisByOwner.set(ownerId, split.next.basis)
      }
      // Owners with open pro-rata but no need-based draw still need basis
      // carried forward (already in iraProRata / iraBasisByOwner from prior
      // commits). Sync remaining basis for pro-rata owners that had no need-
      // based take above.
      for (const [ownerId, proRata] of iraProRata) {
        if (needBasedTakenByOwner.has(ownerId)) continue
        iraBasisByOwner.set(ownerId, proRata.basis)
      }
    }
    // Reimburse-later accumulation (step 3): out-of-pocket qualified medical
    // expenses this year (modeled costs the cap-mode HSAs did NOT reimburse)
    // grow the pool; qualified HSA reimbursements draw it down. Grows in
    // nominal dollars alongside the expenses it defers. Only cap-mode
    // consumption (`capConsumed`) touches the pool — qualified draws from
    // `assumeAllQualified`/legacy HSAs are not measured against modeled
    // expenses and must not draw the pool down.
    if (hsaReimburseLaterActive) {
      const qualifiedDrawn = hsaEffectFinal.capConsumed
      const reimbursedFromCurrentYear = Math.min(qualifiedDrawn, qualifiedMedicalThisYear)
      const drawnFromPool = qualifiedDrawn - reimbursedFromCurrentYear
      const outOfPocketThisYear = Math.max(0, qualifiedMedicalThisYear - reimbursedFromCurrentYear)
      hsaReimbursablePool = Math.max(0, hsaReimbursablePool - drawnFromPool) + outOfPocketThisYear
    }
    deposit(surplus)

    if (shortfallAfterHecm > EPSILON && depletionYear === null) depletionYear = year

    // --- property events + growth ------------------------------------------
    // The phase itself lives in `internal/propertyEventsAndGrowth.ts`. It owns
    // the growth, the legacy tax-free sale and the line accrual; this loop owns
    // every write, applied per row in the same statement order the inlined
    // phase used (close the line, deposit, publish, write the value back, then
    // compound what is left open). `plan.accounts` order is load-bearing three
    // ways at once — deposit order, value compounding, and whether a same-id
    // line accrues before a later row closes it. The helper carries a private
    // numeric shadow of both maps, plus an accrued-id set so each actual HECM
    // line receives its annual multiplier exactly once.
    for (const row of propertyEventsAndGrowth({
      accounts: plan.accounts,
      year,
      propertyValues,
      inflRateAt,
      hecmStates,
      // Gated on the ARRAY this payload feeds, which is what the inlined phase
      // gated on: it built its literal inside `legacyPropertySaleDeposits?.push(
      // { … })`. Both are assigned in the same `if (publishCashFlow)` block, so
      // this is a no-op today; writing it this way makes the payload's laziness
      // hold by construction rather than by that coincidence.
      surplusDestination: legacyPropertySaleDeposits === null ? null : surplusDestination,
    })) {
      if (row.closesHecmForAccountId !== null) hecmStates.delete(row.closesHecmForAccountId)
      if (row.deposit !== null) deposit(row.deposit)
      if (row.record !== null) legacyPropertySaleDeposits?.push(row.record)
      propertyValues.set(row.propertyAccountId, row.value)
      if (row.hecmGrowth !== null) {
        const line = hecmStates.get(row.propertyAccountId)!
        line.principalLimit *= row.hecmGrowth
        line.loanBalance *= row.hecmGrowth
      }
    }

    // --- insurance: permanent-life cash value + death benefit --------------
    const permanentLife = annualPermanentLifeTransitions({
      policies: plan.insurance,
      insuranceCashValues,
      resolveInsured: (personId) => {
        const insured = personById.get(personId)
        return insured === undefined
          ? null
          : {
              deathAge: lifeAgeOf(insured),
              ageAttained: stateOf(personId).ageAttained,
            }
      },
    })
    const deathBenefitPaid = permanentLife.deathBenefitPaid
    for (const transition of permanentLife.transitions) {
      if (transition.payout !== null) {
        deposit(transition.payout)
        if (transition.payout > 0) {
          deathBenefits?.push({
            policyId: transition.policyId,
            insuredPersonId: transition.insuredPersonId,
            amount: transition.payout,
            destination: surplusDestination!,
          })
        }
      }
      insuranceCashValues.set(transition.policyId, transition.cashValue)
    }

    const ownedNonRothIraBalancesBeforeGrowth = Object.freeze(
      Object.fromEntries(
        annualIdKeyedBalances
          .filter((state) => isAggregatedIraThisYear(state.account))
          .map((state) => [state.account.id, state.balance]),
      ),
    )
    const ownedNonRothIraPhysicalBalancesBeforeGrowth = Object.freeze(
      balances.flatMap((state, balanceIndex) =>
        isAggregatedIraThisYear(state.account)
          ? [Object.freeze({
              sourceAccountId: state.account.id,
              balanceIndex,
              balancePlanDollars: state.balance,
            })]
          : []),
    )
    const ownedNonRothIraPhysicalOpeningBalances = Object.freeze(
      balances.flatMap((state, balanceIndex) =>
        isAggregatedIraThisYear(state.account)
          ? [Object.freeze({
              sourceAccountId: state.account.id,
              balanceIndex,
              balancePlanDollars: startOfYearPositionalBalances[balanceIndex]!,
            })]
          : []),
    )

    const accountGrowth = annualPostSolveAccountGrowth({
      states: balances,
      allocationTrack,
      distributedYieldByBalanceIndex,
      classParams,
      defaultReturnPct: plan.assumptions.defaultReturnPct,
      shockPct: returnShockAt(year),
      year,
      classShockAt,
    })
    // Wealth-weighted total return the ledger actually applies this year
    // (including distributed yield — interest, dividends, and tax-exempt
    // interest; a distribution, not a loss). Next year's coordinated HECM
    // check reads it, so the down-market signal is the realized portfolio
    // return, not the raw additive shock. The coordinator returns exactly one
    // positional row per physical balance; the caller commits every market
    // balance and drifted weight before publishing that signal, then commits
    // reinvestment in the original second pass below.
    for (let balanceIndex = 0; balanceIndex < balances.length; balanceIndex++) {
      const row = accountGrowth.rows[balanceIndex]!
      const state = balances[balanceIndex]!
      state.balance = row.marketClosingBalance
      if (row.kind === 'allocated') {
        allocationTrack.get(String(balanceIndex))!.weights = row.driftedWeights
      }
    }
    priorYearPortfolioReturnPct = accountGrowth.priorYearPortfolioReturnPct

    // Distributed yield is credited only after every account's market growth.
    // Reinvestment is not growth and adds basis only to the taxable physical
    // row whose earlier yield calculation produced it.
    for (let balanceIndex = 0; balanceIndex < balances.length; balanceIndex++) {
      const row = accountGrowth.rows[balanceIndex]!
      if (row.reinvestedYield <= 0) continue
      const state = balances[balanceIndex]!
      state.balance += row.reinvestedYield
      if (state.account.type === 'taxable') state.costBasis += row.reinvestedYield
    }

    const ownedNonRothIraBalancesByOwner = new Map<
      string | null,
      Array<{ sourceAccountId: string; balanceIndex: number; balancePlanDollars: number }>
    >()
    for (const [balanceIndex, state] of balances.entries()) {
      if (!isAggregatedIraThisYear(state.account)) continue
      // A validated Plan always supplies an owner here. Preserve null on a
      // malformed direct simulatePlan call so this raw, not-yet-validated
      // source never invents ownership that later replay could mistake as fact.
      const ownerPersonId = state.account.ownerPersonId
      const accountBalances = ownedNonRothIraBalancesByOwner.get(ownerPersonId) ?? []
      accountBalances.push({
        sourceAccountId: state.account.id,
        balanceIndex,
        balancePlanDollars: state.balance,
      })
      ownedNonRothIraBalancesByOwner.set(ownerPersonId, accountBalances)
    }
    // The contract values that belong on line 6 beside those balances, read at
    // the same instant. Annuity accounts take no growth -- they hold no balance
    // the ledger could grow -- so reading the channel here rather than before
    // the growth loop changes no figure; it is read here so the two halves of
    // line 6 are captured at one boundary and the replay can say so.
    const annuityContractValuesByOwner = new Map<
      string | null,
      Array<{
        annuityAccountId: string
        fundingAccountId: string
        contractValueOpeningPlanDollars: number
        contractValuePlanDollars: number
      }>
    >()
    for (const { contract, funding, ownerPersonId } of annuityStagingCandidates) {
      const contractValuePlanDollars = annuityContractValue.get(contract.id)
      if (contractValuePlanDollars === undefined) continue
      const entries = annuityContractValuesByOwner.get(ownerPersonId) ?? []
      entries.push({
        annuityAccountId: contract.id,
        fundingAccountId: funding.id,
        contractValueOpeningPlanDollars:
          startOfYearAnnuityContractValue.get(contract.id) ?? 0,
        contractValuePlanDollars,
      })
      annuityContractValuesByOwner.set(ownerPersonId, entries)
    }
    const ownedNonRothIraPostGrowthSource = Object.freeze({
      status: 'postGrowthOwnedNonRothIraBalancesCaptured' as const,
      captureBoundary:
        'afterAllAnnualTransactionsAndGrowthBeforeYearResultPublication' as const,
      annualObservationValidation: 'notRun' as const,
      planId: plan.id,
      taxYear: year,
      ownerPools: Object.freeze(
        [...ownedNonRothIraBalancesByOwner]
          .sort(([leftOwner], [rightOwner]) => {
            if (leftOwner === null) return rightOwner === null ? 0 : -1
            if (rightOwner === null) return 1
            return compareUtf16CodeUnits(leftOwner, rightOwner)
          })
          .map(([ownerPersonId, accountBalances]) => Object.freeze({
            ownerPersonId,
            accountBalances: Object.freeze(
              accountBalances
                .sort((left, right) =>
                  compareUtf16CodeUnits(
                    left.sourceAccountId,
                    right.sourceAccountId,
                  ) || left.balanceIndex - right.balanceIndex,
                )
                .map((balance) => Object.freeze({ ...balance })),
            ),
            annuityContractValues: Object.freeze(
              (annuityContractValuesByOwner.get(ownerPersonId) ?? [])
                .sort((left, right) => compareUtf16CodeUnits(
                  left.annuityAccountId, right.annuityAccountId,
                ))
                .map((value) => Object.freeze({ ...value })),
            ),
          })),
      ),
    })

    // --- snapshot ------------------------------------------------------------
    const snapshot = annualSnapshot({
      balances,
      publishedBalances: annualIdKeyedBalances,
      unassignedCash: readUnassignedCash(),
      propertyValues,
      debtBalances,
      hecmStates,
      insuranceCashValues,
    })

    const reportedWithdrawals = {
      ...withdrawalPlan.byCategory,
      cash: withdrawalPlan.byCategory.cash + retirementActionCash,
      taxable:
        withdrawalPlan.byCategory.taxable +
        retirementActionEquityCompensation +
        retirementActionTaxableProceeds,
      // Traditional forced only: Roth forced is Roth-character (K1/K2).
      traditional:
        withdrawalPlan.byCategory.traditional +
        rmdTotal +
        seppTotal +
        inheritedOrdinaryIncome,
      roth: withdrawalPlan.byCategory.roth + inheritedRothForced,
      total:
        withdrawalPlan.byCategory.total +
        rmdTotal +
        seppTotal +
        inheritedTotal +
        retirementActionProceeds,
    }
    // Attribute any portfolio shortfall across the spending layers: a deliberate
    // guardrail cut is a target-lifestyle miss, a genuine shortfall reaches the
    // required floor only after exhausting discretionary. Skipped goals are added
    // on top (a skipped goal is spending that never happened). Legacy `shortfall`
    // (and depletion-year logic) are left exactly as they were.
    const shortfallAttribution = attributeShortfall({
      requiredSpending: requiredSpendingBase,
      targetSpending: targetSpendingBase,
      idealSpending: idealSpendingBase,
      excessSpending: excessSpendingBase,
      fundedSpending: expenses.total,
      withdrawalShortfall: shortfallAfterHecm,
    })
    const requiredShortfall = shortfallAttribution.requiredShortfall + skippedRequiredNominal
    const targetShortfall = shortfallAttribution.targetShortfall + skippedTargetNominal + skippedRequiredNominal
    const idealShortfall = shortfallAttribution.idealShortfall + skippedIdealNominal
    const excessShortfall = shortfallAttribution.excessShortfall + skippedExcessNominal
    const retirementRuntimeSource = Object.freeze({
      status: 'runtimeOccurrenceSourcesCaptured' as const,
      captureBoundary:
        'legacyAnnualPassCommittedBeforeYearResultPublication' as const,
      journalValidation: 'notRun' as const,
      planId: plan.id,
      taxYear: year,
      runtimeOccurrences: Object.freeze(
        [...annualRetirementRuntimeOccurrences]
          .sort(canonicalRuntimeOccurrenceOrder)
          .map((occurrence) => Object.freeze({ ...occurrence })),
      ),
      // Only the routed share belongs in the nonmoving overlay. The rest of the
      // annual total left an owned IRA under its own occurrences above, and
      // publishing it here as well would double-count the gift.
      //
      // The attribution travels with it, which is what lets the owned-IRA
      // runtime source series characterize a gift year instead of refusing it.
      // Both figures are the ones the 408(d)(8)(D) block settled above:
      // `qcdFromRmdByOwner` is the routed gross the published annual total is
      // made of, and `qcdQualifiedFromRmdByOwner` is the carve the deferred
      // forced distributions were committed against, so the replay reproduces
      // the ledger's own line-7 grosses rather than deriving rival ones.
      nonmovingLegacyQcdOverlay: qcdFromRmd > 0
        ? Object.freeze({
          status: 'nonmovingLegacyQcdCaptured' as const,
          kind: 'legacyQcd' as const,
          taxYear: year,
          grossAmountPlanDollars: qcdFromRmd,
          ownerAttributions: Object.freeze(
            [...qcdFromRmdByOwner.entries()]
              .filter(([, routed]) => routed > 0)
              .sort(([left], [right]) => compareUtf16CodeUnits(left, right))
              .map(([ownerPersonId, routedGrossPlanDollars]) => Object.freeze({
                ownerPersonId,
                routedGrossPlanDollars,
                qualifiedLine7ExclusionPlanDollars: Math.min(
                  routedGrossPlanDollars,
                  qcdQualifiedFromRmdByOwner.get(ownerPersonId) ?? 0,
                ),
              })),
          ),
          physicalMovement: 'notAdditionalMovement' as const,
          inventoryReplay:
            'attributedToOwnedIraRequiredDistributionGrosses' as const,
        })
        : null,
      // The moving half's characterization, in the order the draws moved. The
      // 408(d)(8)(D) block sized each one against the owner's aggregate
      // includible amount, so the replay reads which part of each draw was a
      // gift and which part was an ordinary distribution rather than assuming
      // the whole of it was the former.
      legacyQcdCharacterizations: Object.freeze(
        legacyQcdCharacterizations.map((entry) => Object.freeze({ ...entry })),
      ),
    })
    const retirementRuntimeApplicationSource = Object.freeze({
      status: 'runtimeApplicationSourcesCaptured' as const,
      captureBoundary:
        'atOwnedNonRothIraMutationSitesBeforeAnnualGrowth' as const,
      applicationValidation: 'notRun' as const,
      planId: plan.id,
      taxYear: year,
      // Mutation order is evidence. Do not sort this array: account-order
      // dependent legacy commits must remain visible to later replay.
      applications: Object.freeze(
        annualRetirementRuntimeApplications.map((application) =>
          application.applicationKind === 'aggregateRothDestinationCredit' ||
            application.applicationKind === 'namedRothDestinationCredit'
            ? Object.freeze({
              ...application,
              producerOccurrenceKeys: Object.freeze([
                ...application.producerOccurrenceKeys,
              ]),
              sourceOwnerPersonIds: Object.freeze([
                ...application.sourceOwnerPersonIds,
              ]),
            })
            : Object.freeze({ ...application }),
        ),
      ),
    })
    // This publication depends on settled tax, penalties, and committed
    // executor evidence, so it remains ordered after every annual movement and
    // before per-entity fact publication and `YearResult` assembly. The
    // coordinator is pure; this caller retains all economic commits.
    const settlementPublication = annualRetirementActionSettlementPublication({
      planId: plan.id,
      taxYear: year,
      taxPlanDollars: tax,
      penaltiesPlanDollars: penalties,
      retirementActionExecution,
      rothConversionActionExecution,
      qcdActionPrerequisiteResult,
      qcdActionExecution,
      linkedGroupAssessmentRequests,
      linkedWithdrawalGroups: effectiveLinkedWithdrawalGroups,
      conversionFundingTaxUnitEvidence,
      annualLiabilityBaseline,
      annualLiabilityNonGroupTaxInputs,
    })

    // --- per-entity published facts (insight one-source-of-truth channel) ---
    // Only assumed-basis consequential verdicts are published on these rows —
    // every remaining member has a production consumer (missingDataBasis).
    const entityFacts = publishedEntityFacts({
      accounts: plan.accounts,
      primaryPersonId: primary.id,
      ownedRothAssumedBasisConsequentialByOwner,
      employerRothAssumedBasisConsequentialByAccount,
      form8606ConsequentialByOwner,
    })

    // This is the core annual-pass record. The outer owned non-Roth IRA
    // settlement may later clone it solely to attach its committed replay;
    // simulatePlan retains final result-array publication after that boundary.
    const yearResult = annualYearResultAssembly({
      chronology: {
        year,
        inflationScale: inflFactor,
        people: peopleStates,
        filingStatus: filingStatusForYear,
      },
      ledger: {
        incomes,
        expenses,
        contributions,
        ownedNonRothIraContributions,
        ownedNonRothIraBalancesBeforeGrowth,
        ownedNonRothIraPhysicalBalancesBeforeGrowth,
        ownedNonRothIraPhysicalOpeningBalances,
        qualifiedAnnuityPayments,
        socialSecurityStreams,
        employerMatch,
      },
      entityFacts,
      retirement: {
        rmd: rmdTotal,
        rmdShortfallExciseTax,
        rmdShortfallExciseDetails: rmdShortfallExciseResults,
        sepp: seppTotal,
        inheritedDistribution: inheritedTotal,
        inheritedTraditionalDistribution: inheritedOrdinaryIncome,
        inheritedAccounts: planHasInheritedAccounts
          ? inheritedYearEvidenceDraft
          : undefined,
        qcd,
        rothConversion: totalRothConversion,
        aggregateRothConversionAllocationBalances,
        aggregateRothConversionAllocationDesired,
        retirementRuntimeSource,
        retirementRuntimeApplicationSource,
        ownedNonRothIraPostGrowthSource,
        retirementActionExecution,
        rothConversionActionExecution,
        qcdActionExecution,
      },
      settlement: settlementPublication,
      tax: {
        penalties,
        magi: magiHistory.get(year)!,
        aca: yearAcaResult,
        medicarePremiums,
        irmaaSurcharge,
        irmaaTier,
        irmaaLookbackMagi: irmaaMagi,
        irmaaLookbackMagiSource,
        irmaaLookbackMagiYear,
        irmaaNextTierThreshold,
        advisoryFederalTax: {
          input: advisoryFederalTaxInput,
          detail: federalDetail,
        },
        ltcgZeroHeadroom,
        ssEarningsTestWithheld,
        ssdiPaid,
        tax,
      },
      funding: {
        withdrawals: reportedWithdrawals,
        realizedGains: {
          withdrawal: withdrawalPlan.realizedGains,
          rebalance: rebalanceRealizedGains,
          retirementAction: retirementActionCapitalGainOrLoss,
        },
        taxExemptInterest: yearTaxExemptInterest,
        capitalLossUsedAgainstGains: lossNetting.usedAgainstGains,
        capitalLossUsedAgainstOrdinary: lossNetting.usedAgainstOrdinary,
        capitalLossCarryforwardRemaining: lossNetting.remaining,
        surplusInvested: surplus,
        shortfall: shortfallAfterHecm,
        requiredShortfall,
        targetShortfall,
        idealShortfall,
        excessShortfall,
        guardrailAction,
        flexibleGoals: goalOutcomeCounts,
      },
      balanceSheet: {
        snapshot,
        ladderValue: ladderValueTotal,
        deathBenefit: deathBenefitPaid,
        hecmDraw,
      },
      ...(publishCashFlow
        ? {
            cashFlowInput: {
              yearSites: yearSites!,
              passLocals: {
                seppByAccountId: seppByAccountId!,
                hecmCoordinatedByProperty: hecmCoordinatedByProperty!,
                hecmBackstopByProperty: hecmBackstopByProperty!,
                annuityBasisReturnByAccountId: annuityBasisReturnByAccountId!,
                rmdNontaxableByOwner: rmdNontaxableByOwner!,
                seppNontaxableByAccountId: seppNontaxableByAccountId!,
                penaltyLines: cashFlowPenaltyLines!,
                rothPoolTaxableOrdinaryByPersonId: rothPoolTaxableOrdinaryByPersonId!,
                legacyPropertySaleDeposits: legacyPropertySaleDeposits!,
                deathBenefits: deathBenefits!,
                surplusDestination: surplusDestination!,
                qcdExclusionFromRmdByOwner: qcdExclusionFromRmdByOwner!,
                qcdExclusionBeyondRmdByOwner: qcdExclusionBeyondRmdByOwner!,
                qcdOrdinaryBeyondRmdByOwner: qcdOrdinaryBeyondRmdByOwner!,
                qcdBeyondRmdCharacterByOccurrence: qcdBeyondRmdCharacterByOccurrence!,
                qcdOrdinaryFromRmdByOwner: qcdOrdinaryFromRmdByOwner!,
                qcdBasisFromRmdByOwner: qcdBasisFromRmdByOwner!,
                hsaNonqualifiedOrdinaryByAccountId: hsaNonqualifiedOrdinaryByAccountId!,
                employerRothTaxableOrdinaryByAccountId: employerRothTaxableOrdinaryByAccountId!,
              },
              socialSecurityStreams,
              rmdTakeByAccount,
              ownedIraRmdGrossByOwner,
              qcdFromRmdByOwner,
              qcdGrossByOwner,
              deferredLegacyQcdDistributions,
              employerPlanAccountIds: new Set(
                plan.accounts.flatMap((account) =>
                  account.type === 'traditional' && account.kind !== 'ira' ? [account.id] : [],
                ),
              ),
              inheritedTraditionalAccountIds: new Set(
                plan.accounts.flatMap((account) =>
                  account.type === 'traditional' && account.inherited !== undefined
                    ? [account.id]
                    : [],
                ),
              ),
              withdrawalPlanByAccountId: withdrawalPlan.byAccountId,
              withdrawalPlanTaxableSales: withdrawalPlan.taxableSales,
              iraCharacterFinal,
              inheritedYearEvidence: inheritedYearEvidenceDraft,
              retirementActionExecution,
              rothConversionActionExecution,
              qcdActionExecution,
              namedRothConversionExecuted,
              namedRothConversionNontaxable,
              conversionNontaxable,
              rothConversion,
              aggregateConversionDraws: aggregateConversionDraws!,
              distributedYieldByAccountId: distributedYieldByAccountId!,
              ownerPersonIdByAccountId: new Map(
                plan.accounts.map((account) => [
                  account.id,
                  'ownerPersonId' in account ? account.ownerPersonId ?? null : null,
                ]),
              ),
              employerAllocationByOwner,
              yearTaxExemptInterest,
              generatedTaxExemptInterest,
              acaForeignExclusionAddback,
              incomesTotal: incomes.total,
              taxableYieldReinvested,
              propertySaleProceedsTotal,
              rmdTotal,
              seppTotal,
              inheritedTotal,
              needBasedWithdrawalTotal: withdrawalPlan.byCategory.total,
              retirementActionProceeds,
              hecmDraw,
              hecmShortfallDraw,
              tax,
              penalties,
              contributionsTotal: contributions,
              collidingEncodedProducerSegments,
              employerMatchTotal: employerMatch,
              surplus,
              requiredLifestyle,
              targetLifestyle,
              targetLifestyleFunded,
              idealLifestyle,
              idealLifestyleFunded,
              excessLifestyle,
              excessLifestyleFunded,
              healthcare,
              shortfallAfterHecm,
            },
          }
        : {}),
    })

  writePhaseLedgerScalars(ledger.scalars, {
    healthcare,
    qualifiedMedicalThisYear,
    hsaQualifiedCap,
    requiredSpendingBase,
    targetSpendingBase,
    capitalLossPool,
    hsaReimbursablePool,
    depletionYear,
    conversionNontaxable,
    priorYearPortfolioReturnPct,
  })

  return { yearResult, optimizerProbe }
}
