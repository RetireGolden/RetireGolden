/**
 * Assemble this year's spending: what it costs, what the guardrails will fund,
 * and what the year publishes as its expense record.
 *
 * Six already-extracted producers run here in a fixed order, and the order is
 * the point -- each one reads a number the one before it produced:
 *
 * 1. lifestyle layers (required/target/ideal/excess, before any guardrail);
 * 2. debt service, healthcare, insurance premiums, long-term care and property
 *    carrying costs, the five system-computed costs;
 * 3. `systemRequired`, their sum, which is required by default so a plan can
 *    never report floor success after silently cutting healthcare, housing,
 *    debt or care;
 * 4. the HSA qualified-withdrawal cap, which needs `netCare`;
 * 5. the withdrawal-rate guardrail decision, which needs both the layers and
 *    `systemRequired`, and which is the only thing here that moves state
 *    ACROSS years (`discretionaryMultiplier`, `startingWithdrawalRate` and
 *    `startingRealPortfolio` come in, are reassigned, and go back out);
 * 6. one-time goals, then the expense summary that folds skipped goals back
 *    into the reported totals.
 *
 * Move-only, out of the `simulatePlan` year loop. Every fold still adds row by
 * row in producer order rather than pre-summing, because `debtService`,
 * `insurancePremiums` and `propertyCosts` all start at zero here and IEEE-754
 * addition is not associative. Every effect fires at its original point: the
 * debt-balance write before the next row, the LTC benefit-year writes before
 * the person rows, the healthcare warnings before the insurance fold.
 *
 * Four of the results are deliberately still MUTABLE at the caller, and the
 * year says so with `let`: the ACA fixed point adds its converged healthcare
 * delta to `healthcare`, `requiredSpendingBase` and `targetSpendingBase`, and
 * the annual pass moves `qualifiedMedicalThisYear` and `hsaQualifiedCap`. This
 * phase produces their opening values, not their final ones.
 *
 * `plan` comes in whole because `annualHealthcareExpenses` takes it whole;
 * narrowing below that boundary is that module's call to make, not this one's.
 */
import type { Plan } from '../../model/plan.js'
import type { FilingStatus, ParameterPack } from '../../params/types.js'
import type { GoalScheduler } from '../../spending/flexibleGoals.js'
import type { GuardrailPolicy } from '../../spending/guardrails.js'
import type {
  PersonYearState,
  ProjectedFilingStatus,
} from '../types.js'
import type {
  RecordedAccountAmount,
  RecordedGoalOutcome,
  RecordedLongTermCare,
  RecordedPolicyPremium,
} from '../annualCashFlowYearSites.js'
import {
  annualDebtServiceRows,
  annualLongTermCarePlan,
} from './annualDebtAndLongTermCare.js'
import { annualExpenseSummary, type AnnualExpenseSummary } from './annualExpenseSummary.js'
import { annualGuardrailFundingPlan, type AnnualGuardrailFundingPlan } from './annualGuardrailFunding.js'
import {
  annualHealthcareExpenses,
  type AnnualHealthcareExpensesResult,
  type IrmaaLookbackMagiSource,
} from './annualHealthcareExpenses.js'
import { annualInsurancePremiumRows } from './annualInsurancePremiumRows.js'
import { annualLifestyleLayers } from './annualLifestyleLayers.js'
import type { PhysicalBalanceState } from './annualLogicalBalanceLedger.js'
import {
  annualOneTimeGoalFundingPhase,
  type AnnualGoalOutcomeCounts,
} from './annualOneTimeGoalFundingPhase.js'
import { annualPropertyCarryingCosts } from './annualPropertyCarryingCosts.js'

/**
 * The five cash-flow sinks this phase writes, and nothing else on the year's
 * capture surface. Null means the projection captures no cash flow.
 */
export interface AnnualExpenseAssemblyCommitSites {
  recordDebtService(row: RecordedAccountAmount): void
  recordInsurancePremium(row: RecordedPolicyPremium): void
  recordLongTermCare(row: RecordedLongTermCare): void
  recordPropertyCosts(row: RecordedAccountAmount): void
  recordGoalOutcome(row: RecordedGoalOutcome): void
}

export interface AnnualExpenseAssemblyPhaseInput {
  /** Whole, because `annualHealthcareExpenses` reads it whole. */
  readonly plan: Plan
  readonly pack: ParameterPack
  readonly year: number
  readonly startYear: number
  readonly inflFactor: number
  readonly isStandIn: boolean
  readonly inflFactorFrom: (fromYear: number, toYear: number) => number
  readonly healthInflFactorFrom: (fromYear: number, toYear: number) => number
  readonly aliveCount: number
  readonly anyAlive: boolean
  readonly peopleStates: readonly PersonYearState[]
  readonly primaryPersonId: string
  readonly resolvePerson: (personId: string) => PersonYearState
  readonly hasModeledPerson: (personId: string) => boolean
  /** Last-wins by public person id, matching simulatePlan's Map construction. */
  readonly birthMonthByPerson: ReadonlyMap<string, number>
  readonly filingStatusForYear: ProjectedFilingStatus
  readonly taxFilingStatusForYear: FilingStatus
  readonly resolveMagiFor: (year: number) => {
    magi: number
    source: IrmaaLookbackMagiSource
    year: number
  }
  readonly ssa44ActiveInYear: (year: number) => boolean
  readonly planHasTaxExemptYieldAttestation: boolean
  /** This year's tax-exempt interest, already folded by the income phase. */
  readonly taxExemptInterest: number
  /** Live physical rows, read for the lifestyle and guardrail signals. */
  readonly balances: readonly PhysicalBalanceState[]
  /** One opening value per physical balance row, in matching order. */
  readonly startOfYearPositionalBalances: readonly number[]
  /** Live debt balances, advanced one row at a time by the debt fold. */
  readonly debtBalances: Map<string, number>
  /** Live LTC benefit-years-used ledger, written after the plan is built. */
  readonly ltcBenefitYearsUsed: Map<string, number>
  readonly captureAnnualCashFlow: boolean
  readonly abwActive: boolean
  readonly abwRealReturnPct: number
  readonly abwTiltPct: number
  readonly abwHorizonYear: number
  readonly hsaReimburseLaterActive: boolean
  readonly hsaReimbursablePool: number
  readonly guardrailsActive: boolean
  readonly riskBasedGuardrails: boolean
  readonly spendingPolicy: Plan['expenses']['spendingPolicy']
  readonly guardrailPolicy: GuardrailPolicy
  readonly goalScheduler: GoalScheduler | null
  /** Carried across years: read here, reassigned, and handed back. */
  readonly discretionaryMultiplier: number
  readonly startingWithdrawalRate: number | null
  readonly startingRealPortfolio: number | null
  /** The year's warning set; the healthcare planner's warnings are inserted. */
  readonly warnings: Set<string>
  readonly yearSites: AnnualExpenseAssemblyCommitSites | null
}

export interface AnnualExpenseAssemblyPhaseResult {
  readonly requiredLifestyle: number
  readonly targetLifestyle: number
  readonly idealLifestyle: number
  readonly excessLifestyle: number
  /** Opening value: the ACA fixed point adds its converged delta at the year. */
  readonly healthcare: AnnualHealthcareExpensesResult['healthcare']
  readonly healthInflFactor: AnnualHealthcareExpensesResult['healthInflFactor']
  readonly acaContractsForYear: AnnualHealthcareExpensesResult['acaContractsForYear']
  readonly acaContract: AnnualHealthcareExpensesResult['acaContract']
  readonly acaEnrollmentPremiums: AnnualHealthcareExpensesResult['acaEnrollmentPremiums']
  readonly acaSlcspBenchmarkPremiums: AnnualHealthcareExpensesResult['acaSlcspBenchmarkPremiums']
  readonly acaGrossEnrollmentPremium: AnnualHealthcareExpensesResult['acaGrossEnrollmentPremium']
  readonly acaActive: AnnualHealthcareExpensesResult['acaActive']
  readonly healthcareExcludingAcaEnrollment: AnnualHealthcareExpensesResult['healthcareExcludingAcaEnrollment']
  readonly healthcareExcludingMarketplacePremium: AnnualHealthcareExpensesResult['healthcareExcludingMarketplacePremium']
  readonly acaInitialSupportCodes: AnnualHealthcareExpensesResult['acaInitialSupportCodes']
  readonly exampleContractInputMismatch: AnnualHealthcareExpensesResult['exampleContractInputMismatch']
  readonly medicarePremiums: AnnualHealthcareExpensesResult['medicarePremiums']
  readonly irmaaSurcharge: AnnualHealthcareExpensesResult['irmaaSurcharge']
  readonly irmaaTier: AnnualHealthcareExpensesResult['irmaaTier']
  readonly irmaaMagi: AnnualHealthcareExpensesResult['irmaaMagi']
  readonly irmaaLookbackMagiSource: AnnualHealthcareExpensesResult['irmaaLookbackMagiSource']
  readonly irmaaLookbackMagiYear: AnnualHealthcareExpensesResult['irmaaLookbackMagiYear']
  readonly irmaaNextTierThreshold: AnnualHealthcareExpensesResult['irmaaNextTierThreshold']
  readonly marketplaceMonthsByPersonPosition: AnnualHealthcareExpensesResult['marketplaceMonthsByPersonPosition']
  readonly pre65MonthlyPremiumPerPerson: AnnualHealthcareExpensesResult['pre65MonthlyPremiumPerPerson']
  /** Care cost net of the policy benefit, which is capped at the cost. */
  readonly netCare: number
  /** Opening values: the annual pass moves both. */
  readonly qualifiedMedicalThisYear: number
  readonly hsaQualifiedCap: number
  readonly discretionaryMultiplier: AnnualGuardrailFundingPlan['discretionaryMultiplier']
  readonly startingWithdrawalRate: AnnualGuardrailFundingPlan['startingWithdrawalRate']
  readonly startingRealPortfolio: AnnualGuardrailFundingPlan['startingRealPortfolio']
  readonly guardrailAction: AnnualGuardrailFundingPlan['guardrailAction']
  readonly targetLifestyleFunded: AnnualGuardrailFundingPlan['targetLifestyleFunded']
  readonly idealLifestyleFunded: AnnualGuardrailFundingPlan['idealLifestyleFunded']
  readonly excessLifestyleFunded: AnnualGuardrailFundingPlan['excessLifestyleFunded']
  readonly skippedRequiredNominal: number
  readonly skippedTargetNominal: number
  readonly skippedIdealNominal: number
  readonly skippedExcessNominal: number
  /** Returned by identity; the year publishes this object as its goal counts. */
  readonly goalOutcomeCounts: AnnualGoalOutcomeCounts
  readonly expenses: AnnualExpenseSummary['expenses']
  /** Opening values: the ACA fixed point adds its converged delta at the year. */
  readonly requiredSpendingBase: AnnualExpenseSummary['requiredSpendingBase']
  readonly targetSpendingBase: AnnualExpenseSummary['targetSpendingBase']
  readonly idealSpendingBase: AnnualExpenseSummary['idealSpendingBase']
  readonly excessSpendingBase: AnnualExpenseSummary['excessSpendingBase']
}

export function annualExpenseAssemblyPhase(
  input: AnnualExpenseAssemblyPhaseInput,
): AnnualExpenseAssemblyPhaseResult {
  const {
    plan,
    pack,
    year,
    startYear,
    inflFactor,
    isStandIn,
    inflFactorFrom,
    healthInflFactorFrom,
    aliveCount,
    anyAlive,
    peopleStates,
    primaryPersonId,
    resolvePerson,
    hasModeledPerson,
    birthMonthByPerson,
    filingStatusForYear,
    taxFilingStatusForYear,
    resolveMagiFor,
    ssa44ActiveInYear,
    planHasTaxExemptYieldAttestation,
    taxExemptInterest,
    balances,
    startOfYearPositionalBalances,
    debtBalances,
    ltcBenefitYearsUsed,
    captureAnnualCashFlow,
    abwActive,
    abwRealReturnPct,
    abwTiltPct,
    abwHorizonYear,
    hsaReimburseLaterActive,
    hsaReimbursablePool,
    guardrailsActive,
    riskBasedGuardrails,
    spendingPolicy,
    guardrailPolicy,
    goalScheduler,
    warnings,
    yearSites,
  } = input
  // The four producers below still call it `stateOf`, as the year loop did.
  const stateOf = resolvePerson
  let { discretionaryMultiplier, startingWithdrawalRate, startingRealPortfolio } =
    input
  const {
    requiredLifestyle,
    targetLifestyle,
    idealLifestyle,
    excessLifestyle,
  } = annualLifestyleLayers({
    expenses: plan.expenses,
    primaryAge: stateOf(primaryPersonId).ageAttained,
    peopleStateCount: peopleStates.length,
    aliveCount,
    anyAlive,
    inflFactor,
    abwActive,
    abwRealReturnPct,
    abwTiltPct,
    abwHorizonYear,
    year,
    balances,
    startOfYearBalances: startOfYearPositionalBalances,
  })
  let debtService = 0
  for (const row of annualDebtServiceRows({
    accounts: plan.accounts,
    balances: debtBalances,
    year,
  })) {
    debtBalances.set(row.accountId, row.nextBalance)
    debtService += row.amount
    yearSites?.recordDebtService({
      accountId: row.accountId,
      ownerPersonId: row.ownerPersonId,
      amount: row.amount,
    })
  }
  const healthcarePlan = annualHealthcareExpenses({
    plan,
    pack,
    year,
    startYear,
    peopleStates,
    birthMonthByPerson,
    resolveMagiFor,
    ssa44ActiveInYear,
    filingStatusForYear,
    taxFilingStatusForYear,
    inflFactorFrom,
    healthInflFactorFrom,
    isStandIn,
    hasModeledPerson,
    resolvePerson: stateOf,
    planHasTaxExemptYieldAttestation,
    taxExemptInterest,
  })
  const healthcare = healthcarePlan.healthcare
  const healthInflFactor = healthcarePlan.healthInflFactor
  const acaContractsForYear = healthcarePlan.acaContractsForYear
  const acaContract = healthcarePlan.acaContract
  const acaEnrollmentPremiums = healthcarePlan.acaEnrollmentPremiums
  const acaSlcspBenchmarkPremiums =
    healthcarePlan.acaSlcspBenchmarkPremiums
  const acaGrossEnrollmentPremium =
    healthcarePlan.acaGrossEnrollmentPremium
  const acaActive = healthcarePlan.acaActive
  const healthcareExcludingAcaEnrollment =
    healthcarePlan.healthcareExcludingAcaEnrollment
  const healthcareExcludingMarketplacePremium =
    healthcarePlan.healthcareExcludingMarketplacePremium
  const acaInitialSupportCodes = healthcarePlan.acaInitialSupportCodes
  const exampleContractInputMismatch =
    healthcarePlan.exampleContractInputMismatch
  const medicarePremiums = healthcarePlan.medicarePremiums
  const irmaaSurcharge = healthcarePlan.irmaaSurcharge
  const irmaaTier = healthcarePlan.irmaaTier
  const irmaaMagi = healthcarePlan.irmaaMagi
  const irmaaLookbackMagiSource =
    healthcarePlan.irmaaLookbackMagiSource
  const irmaaLookbackMagiYear = healthcarePlan.irmaaLookbackMagiYear
  const irmaaNextTierThreshold = healthcarePlan.irmaaNextTierThreshold
  const marketplaceMonthsByPersonPosition =
    healthcarePlan.marketplaceMonthsByPersonPosition
  if (marketplaceMonthsByPersonPosition.length !== peopleStates.length) throw new Error('Healthcare planner person-row mismatch')
  const pre65MonthlyPremiumPerPerson =
    healthcarePlan.pre65MonthlyPremiumPerPerson
  for (const warning of healthcarePlan.warnings) warnings.add(warning)
  // Insurance premiums: level (fixed nominal), charged while the insured/owner
  // is alive. paidUp charges nothing; untilAge stops at premiumEndAge.
  let insurancePremiums = 0
  for (const row of annualInsurancePremiumRows({
    policies: plan.insurance,
    resolveSubject: stateOf,
  })) {
    insurancePremiums += row.amount
    yearSites?.recordInsurancePremium(row.record)
  }

  // LTC care episodes: a deterministic late-life cost spike, additive to
  // baseline spending. An owned LTC policy offsets it up to its monthly cap
  // (grown by the inflation rider) after the elimination period, for at most
  // benefitPeriodYears. The net (careCost − ltcBenefit) is what hits spending.
  const longTermCare = annualLongTermCarePlan({
    careEvents: plan.careEvents,
    policies: plan.insurance,
    benefitYearsUsed: ltcBenefitYearsUsed,
    resolvePerson: stateOf,
    healthInflFactor,
    year,
    startYear,
    capturePersonRows: captureAnnualCashFlow,
  })
  const careCost = longTermCare.careCost
  const ltcBenefit = longTermCare.ltcBenefit
  for (const write of longTermCare.benefitYearWrites) {
    ltcBenefitYearsUsed.set(write.policyId, write.yearsUsed)
  }
  for (const row of longTermCare.personRows) {
    yearSites?.recordLongTermCare(row)
  }

  // Property carrying costs: tax + insurance charged while the property is
  // owned, continuing after any mortgage is paid off — the part of a PITI
  // payment the debt account deliberately excludes. Today's dollars, inflated;
  // skipped from the sale year on, and (like base spending) once nobody is alive.
  let propertyCosts = 0
  for (const row of annualPropertyCarryingCosts({
    accounts: plan.accounts,
    year,
    anyAlive,
    inflFactor,
  })) {
    propertyCosts += row.amount
    yearSites?.recordPropertyCosts(row.record)
  }

  // System-computed costs are required by default: a plan must never report
  // "floor success" after silently cutting healthcare, housing, debt, or care.
  const netCare = careCost - ltcBenefit // ltcBenefit is capped at careCost above
  const systemRequired = debtService + propertyCosts + healthcare + insurancePremiums + netCare

  // HSA qualified-withdrawal cap (steps 2–3): the household's modeled medical
  // costs this year (healthcare premiums + net care costs), plus the
  // accumulated reimburse-later pool when any HSA opts in. Cap-mode HSA
  // withdrawals are tax- and penalty-free only up to this.
  // Ordinary Marketplace premiums are not HSA-qualified medical expenses
  // under Pub. 969's general rule. (The narrow COBRA, unemployment, Medicare,
  // and qualified-LTC exceptions are not represented by an ACA contract.)
  const qualifiedMedicalThisYear = healthcareExcludingMarketplacePremium + netCare
  const hsaQualifiedCap = qualifiedMedicalThisYear + (hsaReimburseLaterActive ? hsaReimbursablePool : 0)

  // Withdrawal-rate guardrail decision (before funding). The signal is this
  // year's recurring target spending over the start-of-year portfolio, compared
  // to the same ratio in the first solvent year. Cutting/raising moves the
  // discretionary multiplier; the required floor is never touched.
  const guardrailFunding = annualGuardrailFundingPlan({
    guardrailsActive,
    riskBasedGuardrails,
    allowRaisesAboveTarget: spendingPolicy?.allowRaisesAboveTarget,
    guardrailPolicy,
    oneTimeGoals: plan.expenses.oneTimeGoals,
    isGoalResolved: (goalId) => goalScheduler?.isResolved(goalId) ?? false,
    year,
    inflFactor,
    anyAlive,
    balances,
    startOfYearBalances: startOfYearPositionalBalances,
    requiredLifestyle,
    targetLifestyle,
    idealLifestyle,
    excessLifestyle,
    systemRequired,
    discretionaryMultiplier,
    startingWithdrawalRate,
    startingRealPortfolio,
  })
  discretionaryMultiplier = guardrailFunding.discretionaryMultiplier
  startingWithdrawalRate = guardrailFunding.startingWithdrawalRate
  startingRealPortfolio = guardrailFunding.startingRealPortfolio
  const guardrailAction = guardrailFunding.guardrailAction
  const targetLifestyleFunded = guardrailFunding.targetLifestyleFunded
  const idealLifestyleFunded = guardrailFunding.idealLifestyleFunded
  const excessLifestyleFunded = guardrailFunding.excessLifestyleFunded
  const remainingUpsideBudget = guardrailFunding.remainingUpsideBudget
  const cutting = guardrailFunding.cutting
  const canPullForwardGoals = guardrailFunding.canPullForwardGoals

  // One-time goals. The phase lives in
  // `internal/annualOneTimeGoalFundingPhase.ts`: under guardrails they route
  // through the scheduler (which may delay/skip flexible goals when cutting);
  // otherwise every goal funds in its target year exactly, as it always has.
  // A *skipped* goal is intended spending that never happens, so its amount is
  // tracked as a target miss (a required-classified skip is also a required
  // miss) rather than silently vanishing from both sides of the ledger.
  // Every accumulator starts at zero and has no earlier writer this year, so
  // the fold moved with the loops; `goalOutcomeCounts` comes back by identity
  // because the year publishes that very object as `spending.flexibleGoals`.
  const oneTimeGoalFunding = annualOneTimeGoalFundingPhase({
    year,
    inflFactor,
    anyAlive,
    goalScheduler,
    oneTimeGoals: plan.expenses.oneTimeGoals,
    cutting,
    canPullForwardGoals,
    remainingUpsideBudget,
    commitGoalOutcome: yearSites === null
      ? undefined
      : (row) => yearSites.recordGoalOutcome(row),
  })
  const oneTimeGoalsFunded = oneTimeGoalFunding.oneTimeGoalsFunded
  const requiredGoalsFunded = oneTimeGoalFunding.requiredGoalsFunded
  const targetGoalsFunded = oneTimeGoalFunding.targetGoalsFunded
  const idealGoalsFunded = oneTimeGoalFunding.idealGoalsFunded
  const excessGoalsFunded = oneTimeGoalFunding.excessGoalsFunded
  const skippedRequiredNominal = oneTimeGoalFunding.skippedRequiredNominal
  const skippedTargetNominal = oneTimeGoalFunding.skippedTargetNominal
  const skippedIdealNominal = oneTimeGoalFunding.skippedIdealNominal
  const skippedExcessNominal = oneTimeGoalFunding.skippedExcessNominal
  const goalOutcomeCounts = oneTimeGoalFunding.goalOutcomeCounts

  // Base layers are funding-consistent (they exclude skipped goals) so the
  // shortfall attribution below stays clean; skipped goals are folded back into
  // the *reported* required/target totals and the shortfalls as explicit deltas.
  const expenseSummary = annualExpenseSummary({
    requiredLifestyle,
    targetLifestyle,
    targetLifestyleFunded,
    idealLifestyle,
    idealLifestyleFunded,
    excessLifestyle,
    excessLifestyleFunded,
    systemRequired,
    oneTimeGoalsFunded,
    requiredGoalsFunded,
    targetGoalsFunded,
    idealGoalsFunded,
    excessGoalsFunded,
    skippedRequiredNominal,
    skippedTargetNominal,
    skippedIdealNominal,
    skippedExcessNominal,
    debtService,
    propertyCosts,
    healthcare,
    insurancePremiums,
    careCost,
    ltcBenefit,
    discretionaryMultiplier,
  })
  const expenses = expenseSummary.expenses
  const requiredSpendingBase = expenseSummary.requiredSpendingBase
  const targetSpendingBase = expenseSummary.targetSpendingBase
  const idealSpendingBase = expenseSummary.idealSpendingBase
  const excessSpendingBase = expenseSummary.excessSpendingBase
  return {
    requiredLifestyle,
    targetLifestyle,
    idealLifestyle,
    excessLifestyle,
    healthcare,
    healthInflFactor,
    acaContractsForYear,
    acaContract,
    acaEnrollmentPremiums,
    acaSlcspBenchmarkPremiums,
    acaGrossEnrollmentPremium,
    acaActive,
    healthcareExcludingAcaEnrollment,
    healthcareExcludingMarketplacePremium,
    acaInitialSupportCodes,
    exampleContractInputMismatch,
    medicarePremiums,
    irmaaSurcharge,
    irmaaTier,
    irmaaMagi,
    irmaaLookbackMagiSource,
    irmaaLookbackMagiYear,
    irmaaNextTierThreshold,
    marketplaceMonthsByPersonPosition,
    pre65MonthlyPremiumPerPerson,
    netCare,
    qualifiedMedicalThisYear,
    hsaQualifiedCap,
    discretionaryMultiplier,
    startingWithdrawalRate,
    startingRealPortfolio,
    guardrailAction,
    targetLifestyleFunded,
    idealLifestyleFunded,
    excessLifestyleFunded,
    skippedRequiredNominal,
    skippedTargetNominal,
    skippedIdealNominal,
    skippedExcessNominal,
    goalOutcomeCounts,
    expenses,
    requiredSpendingBase,
    targetSpendingBase,
    idealSpendingBase,
    excessSpendingBase,
  }
}
