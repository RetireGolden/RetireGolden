/**
 * Browser-free, edition-neutral scenario lever builders.
 *
 * Every builder edits a cloned Plan and delegates persistence to the engine's
 * canonical v1 scenario contract. Arrays are intentionally atomic: a lever
 * that changes a person, income, account, care event, or move declares and
 * emits the corresponding array-root operation.
 */

import { stateForYear, type Plan } from '@retiregolden/engine/model/plan'
import { packForYear } from '@retiregolden/engine/params'
import { modeledStateCodes } from '@retiregolden/engine/params/state'
import { relocationScenarioPatch } from '@retiregolden/engine/projection/relocation'
import type { ScenarioActor, ScenarioPatchV1 } from '@retiregolden/engine/scenarios/contract'
import { createScenarioPatch } from '@retiregolden/engine/scenarios/patch'
import { applyScenarioPatch } from '@retiregolden/engine/scenarios/scenarios'
import { bestMaritalBenefit } from '@retiregolden/engine/socialSecurity/maritalBenefits'
import { effectiveBirthYear, fraForBirthYear } from '@retiregolden/engine/socialSecurity/nra'
import {
  acceptsContributions,
  isConvertibleToRoth,
} from '@retiregolden/engine/strategies/accountEligibility'

export type ScenarioLeverId =
  | 'retirementAge'
  | 'spending'
  | 'socialSecurityClaim'
  | 'socialSecurityCut'
  | 'rothTarget'
  | 'rothSchedule'
  | 'rothNone'
  | 'allocation'
  | 'defaultReturn'
  | 'pension'
  | 'annuity'
  | 'relocation'
  | 'survivorSpending'
  | 'care'
  | 'homeSale'
  | 'stopContributions'

export interface ScenarioLeverDefinition {
  id: ScenarioLeverId
  label: string
  /** Every canonical operation path this control may emit. */
  declaredPaths: readonly string[]
}

export const SCENARIO_LEVER_DEFINITIONS: readonly ScenarioLeverDefinition[] = [
  { id: 'retirementAge', label: 'All household retirement ages', declaredPaths: ['/household/people'] },
  { id: 'spending', label: 'Household base spending', declaredPaths: ['/expenses/baseAnnual'] },
  { id: 'socialSecurityClaim', label: 'All Social Security claim ages', declaredPaths: ['/incomes'] },
  {
    id: 'socialSecurityCut',
    label: 'Social Security benefit cut',
    declaredPaths: [
      '/assumptions/ssHaircut',
      '/assumptions/ssHaircut/cutPct',
      '/assumptions/ssHaircut/fromYear',
    ],
  },
  {
    id: 'rothTarget',
    label: 'Roth conversion target',
    declaredPaths: [
      '/strategies/rothConversion/conversions',
      '/strategies/rothConversion/endYear',
      '/strategies/rothConversion/mode',
      '/strategies/rothConversion/optimizedAtIso',
      '/strategies/rothConversion/startYear',
      '/strategies/rothConversion/target',
      '/strategies/rothConversion/targetValue',
    ],
  },
  {
    id: 'rothSchedule',
    label: 'Roth conversion schedule',
    declaredPaths: [
      '/strategies/rothConversion/conversions',
      '/strategies/rothConversion/endYear',
      '/strategies/rothConversion/mode',
      '/strategies/rothConversion/optimizedAtIso',
      '/strategies/rothConversion/startYear',
      '/strategies/rothConversion/target',
      '/strategies/rothConversion/targetValue',
    ],
  },
  {
    id: 'rothNone',
    label: 'Skip Roth conversions',
    declaredPaths: [
      '/strategies/rothConversion/conversions',
      '/strategies/rothConversion/endYear',
      '/strategies/rothConversion/mode',
      '/strategies/rothConversion/optimizedAtIso',
      '/strategies/rothConversion/startYear',
      '/strategies/rothConversion/target',
      '/strategies/rothConversion/targetValue',
    ],
  },
  { id: 'allocation', label: 'All eligible account allocations', declaredPaths: ['/accounts'] },
  { id: 'defaultReturn', label: 'Default return assumption', declaredPaths: ['/assumptions/defaultReturnPct'] },
  { id: 'pension', label: 'All existing pensions', declaredPaths: ['/accounts'] },
  { id: 'annuity', label: 'All annuities owned at projection start', declaredPaths: ['/accounts'] },
  {
    id: 'relocation',
    label: 'Relocation',
    declaredPaths: [
      '/assumptions/localIncomeTaxPct',
      '/assumptions/stateEffectiveTaxPct',
      '/expenses/baseAnnual',
      '/household/state',
      '/household/stateMoves',
    ],
  },
  { id: 'survivorSpending', label: 'Survivor spending', declaredPaths: ['/expenses/survivorSpendingPct'] },
  { id: 'care', label: 'Care event', declaredPaths: ['/careEvents'] },
  { id: 'homeSale', label: 'One existing property sale', declaredPaths: ['/accounts'] },
  { id: 'stopContributions', label: 'Coast check: stop all contributions', declaredPaths: ['/accounts'] },
] as const

export type ScenarioLeverRequest =
  | { id: 'retirementAge'; yearsDelta: number }
  | { id: 'spending'; percentChange: number }
  | { id: 'socialSecurityClaim'; claimAge: number }
  | { id: 'socialSecurityCut'; cutPct: number; fromYear: number }
  | {
      id: 'rothTarget'
      target: 'topOfBracket' | 'irmaaTier' | 'acaCliff' | 'fixedMagi'
      targetValue: number | null
      startYear: number
      endYear: number
    }
  | { id: 'rothSchedule'; annualAmount: number; startYear: number; endYear: number }
  | { id: 'rothNone' }
  | { id: 'allocation'; stockPct: number }
  | { id: 'defaultReturn'; returnPct: number }
  | { id: 'pension'; monthlyChangePct: number; startAgeDelta: number }
  | { id: 'annuity'; monthlyChangePct: number; startAgeDelta: number }
  | { id: 'relocation'; state: string; moveYear: number; moveMonth?: number }
  | { id: 'survivorSpending'; percent: number }
  | { id: 'care'; startAge: number; durationYears: number; annualCost: number; personId?: string }
  | { id: 'homeSale'; saleYear: number; propertyId?: string }
  | { id: 'stopContributions' }

export interface ScenarioLeverBuildContext {
  createdAtIso: string
  startYear: number
  actor?: ScenarioActor
  createId?: () => string
}

export interface BuiltScenarioLever {
  ok: true
  definition: ScenarioLeverDefinition
  name: string
  patch: ScenarioPatchV1
  /** Actual paths emitted by createScenarioPatch, in canonical order. */
  operationPaths: string[]
  warnings: string[]
}

export interface UnavailableScenarioLever {
  ok: false
  definition: ScenarioLeverDefinition | null
  issues: string[]
  warnings: string[]
}

export type ScenarioLeverBuildResult = BuiltScenarioLever | UnavailableScenarioLever

const DEFAULT_ACTOR: ScenarioActor = { kind: 'user' }
const MODELED_STATE_CODES = new Set(modeledStateCodes())

/** Non-open-ended federal bracket rates supported throughout the requested window. */
export function supportedRothBracketTargets(
  plan: Plan,
  startYear: number,
  endYear = startYear,
): number[] {
  if (
    validateCalendarYear(startYear, 'Start year') !== null ||
    validateCalendarYear(endYear, 'End year') !== null ||
    startYear > endYear
  ) {
    return []
  }
  let supported: number[] | null = null
  for (let year = startYear; year <= endYear; year++) {
    const brackets = packForYear(year).pack.federalTax.brackets[plan.household.filingStatus]
    const rates = new Set(brackets.slice(0, -1).map((bracket) => bracket.ratePct))
    supported =
      supported === null
        ? [...rates]
        : supported.filter((rate) => rates.has(rate))
  }
  return (supported ?? []).sort((left, right) => left - right)
}

/** IRMAA tier numbers supported throughout the requested window. */
export function supportedRothIrmaaTiers(startYear: number, endYear = startYear): number[] {
  if (
    validateCalendarYear(startYear, 'Start year') !== null ||
    validateCalendarYear(endYear, 'End year') !== null ||
    startYear > endYear
  ) {
    return []
  }
  let tierCount = Number.POSITIVE_INFINITY
  for (let year = startYear; year <= endYear; year++) {
    tierCount = Math.min(tierCount, packForYear(year).pack.medicare.irmaaTiers.length)
  }
  return Array.from({ length: tierCount }, (_, index) => index + 1)
}

function clonePlan(plan: Plan): Plan {
  return JSON.parse(JSON.stringify(plan)) as Plan
}

function definitionFor(id: unknown): ScenarioLeverDefinition | undefined {
  return SCENARIO_LEVER_DEFINITIONS.find((definition) => definition.id === id)
}

function unavailable(
  definition: ScenarioLeverDefinition | null,
  issues: string[],
  warnings: string[] = [],
): UnavailableScenarioLever {
  return { ok: false, definition, issues, warnings }
}

function validateNumber(
  value: number,
  label: string,
  options: { min?: number; max?: number; minExclusive?: boolean; maxExclusive?: boolean; integer?: boolean } = {},
): string | null {
  if (!Number.isFinite(value)) return `${label} must be a finite number.`
  if (options.integer && !Number.isInteger(value)) return `${label} must be a whole number.`
  if (
    options.min !== undefined &&
    (options.minExclusive ? value <= options.min : value < options.min)
  ) {
    return `${label} must be ${options.minExclusive ? 'greater than' : 'at least'} ${options.min}.`
  }
  if (
    options.max !== undefined &&
    (options.maxExclusive ? value >= options.max : value > options.max)
  ) {
    return `${label} must be ${options.maxExclusive ? 'less than' : 'at most'} ${options.max}.`
  }
  return null
}

function validateCalendarYear(value: number, label: string): string | null {
  return validateNumber(value, label, { min: 1900, max: 2200, integer: true })
}

function firstIssue(...issues: Array<string | null>): string | null {
  return issues.find((issue): issue is string => issue !== null) ?? null
}

function householdPlanningHorizonYear(plan: Plan): number {
  return Math.max(
    ...plan.household.people.map(
      (person) => Number(person.dob.slice(0, 4)) + person.longevity.planningAge,
    ),
  )
}

function hasWagesInYear(plan: Plan, personId: string, year: number): boolean {
  const person = plan.household.people.find((candidate) => candidate.id === personId)
  if (!person) return false
  const age = year - Number(person.dob.slice(0, 4))
  if (age > person.longevity.planningAge) return false
  return plan.incomes.some((income) => {
    if (income.type !== 'wages' || income.personId !== personId || income.annualGross <= 0) return false
    const stopAge = income.endAge ?? person.retirementAge
    return stopAge === null || age < stopAge
  })
}

function traditionalReceivesContributionInWindow(
  plan: Plan,
  account: Extract<Plan['accounts'][number], { type: 'traditional' }>,
  startYear: number,
  endYear: number,
): boolean {
  const ownerId = account.ownerPersonId ?? plan.household.people[0]?.id
  const owner = plan.household.people.find((person) => person.id === ownerId)
  if (!owner) return false
  for (let year = startYear; year <= endYear; year++) {
    const age = year - Number(owner.dob.slice(0, 4))
    if (age > owner.longevity.planningAge) continue
    if (account.contributionSchedule && account.contributionSchedule.length > 0) {
      const activePhase = account.contributionSchedule.some(
        (phase) =>
          phase.annualAmount > 0 &&
          age >= (phase.fromAge ?? 0) &&
          age <= (phase.toAge ?? 120),
      )
      if (activePhase && (account.kind !== 'employer' || hasWagesInYear(plan, owner.id, year))) return true
    } else if (account.annualContribution > 0 && hasWagesInYear(plan, owner.id, year)) {
      return true
    }
  }
  return false
}

function hasRothConversionSources(plan: Plan, startYear: number, endYear: number): boolean {
  return plan.accounts.some(
    (account) =>
      isConvertibleToRoth(account) &&
      (account.balance > 0 ||
        traditionalReceivesContributionInWindow(plan, account, startYear, endYear) ||
        plan.accounts.some(
          (candidate) =>
            candidate.type === 'pension' &&
            candidate.lumpSumOffer !== undefined &&
            candidate.lumpSumOffer.amount > 0 &&
            candidate.lumpSumOffer.electionYear >= startYear &&
            candidate.lumpSumOffer.electionYear <= endYear &&
            candidate.lumpSumElection?.rolloverAccountId === account.id,
        )),
  )
}

function hasRothDestination(plan: Plan): boolean {
  return plan.accounts.some((account) => account.type === 'roth')
}

function hasEffectiveRothConversionOpportunity(
  plan: Plan,
  startYear: number,
  endYear: number,
): boolean {
  if (!hasRothDestination(plan)) return false
  const strategy = plan.strategies.rothConversion
  if (strategy.mode === 'manual' || strategy.mode === 'optimized') {
    return strategy.conversions.some(
      (conversion) =>
        conversion.amount > 0 &&
        conversion.year >= startYear &&
        conversion.year <= endYear &&
        hasRothConversionSources(plan, conversion.year, conversion.year),
    )
  }
  if (strategy.mode === 'fillToTarget') {
    const effectiveStartYear = Math.max(startYear, strategy.startYear)
    const effectiveEndYear = Math.min(endYear, strategy.endYear)
    return (
      effectiveStartYear <= effectiveEndYear &&
      hasRothConversionSources(plan, effectiveStartYear, effectiveEndYear)
    )
  }
  return false
}

type ProjectedBalanceAccount = Extract<
  Plan['accounts'][number],
  { type: 'cash' | 'taxable' | 'equityComp' | 'traditional' | 'roth' | 'hsa' }
>

function isProjectedBalanceAccount(account: Plan['accounts'][number]): account is ProjectedBalanceAccount {
  return (
    account.type === 'cash' ||
    account.type === 'taxable' ||
    account.type === 'equityComp' ||
    account.type === 'traditional' ||
    account.type === 'roth' ||
    account.type === 'hsa'
  )
}

function receivesContributionDuringProjection(
  plan: Plan,
  account: ProjectedBalanceAccount,
  startYear: number,
): boolean {
  if (!acceptsContributions(account)) return false
  const ownerId = account.ownerPersonId ?? plan.household.people[0]?.id
  const owner = plan.household.people.find((person) => person.id === ownerId)
  if (!owner) return false
  const endYear = householdPlanningHorizonYear(plan)
  for (let year = startYear; year <= endYear; year++) {
    const age = year - Number(owner.dob.slice(0, 4))
    if (age > owner.longevity.planningAge) continue
    if (account.contributionSchedule && account.contributionSchedule.length > 0) {
      const activePhase = account.contributionSchedule.some(
        (phase) =>
          phase.annualAmount > 0 &&
          age >= (phase.fromAge ?? 0) &&
          age <= (phase.toAge ?? 120),
      )
      const isEmployer =
        (account.type === 'traditional' || account.type === 'roth') &&
        account.kind === 'employer'
      if (activePhase && (!isEmployer || hasWagesInYear(plan, owner.id, year))) return true
    } else if (account.annualContribution > 0 && hasWagesInYear(plan, owner.id, year)) {
      return true
    }
  }
  return false
}

type GuaranteedIncomeAccount = Extract<Plan['accounts'][number], { type: 'pension' | 'annuity' }>

function hasGuaranteedIncomePayoutWindow(
  plan: Plan,
  account: GuaranteedIncomeAccount,
  startYear: number,
): boolean {
  if (account.monthlyAmount <= 0) return false
  const ownerId = account.ownerPersonId ?? plan.household.people[0]?.id
  const owner = plan.household.people.find((person) => person.id === ownerId)
  if (!owner) return false
  const startCalendarYear = Number(owner.dob.slice(0, 4)) + account.startAge
  const firstPaymentYear = Math.max(
    startCalendarYear,
    account.type === 'annuity' && account.purchase ? account.purchase.year : startYear,
  )
  const projectionEndYear = householdPlanningHorizonYear(plan)
  const ownerLastAliveYear = Number(owner.dob.slice(0, 4)) + owner.longevity.planningAge
  const lastPaymentYear =
    account.type === 'pension' && account.lumpSumElection && account.lumpSumOffer
      ? Math.min(projectionEndYear, account.lumpSumOffer.electionYear - 1)
      : projectionEndYear
  const ownerCanReceive =
    Math.max(firstPaymentYear, startYear) <= Math.min(lastPaymentYear, ownerLastAliveYear)
  if (ownerCanReceive) return true

  const other = plan.household.people.find((person) => person.id !== owner.id)
  if (!other) return false
  const otherLastAliveYear = Number(other.dob.slice(0, 4)) + other.longevity.planningAge
  const survivorStartYear = Math.max(firstPaymentYear, ownerLastAliveYear + 1, startYear)
  if (account.type === 'pension') {
    return (
      account.startAge <= owner.longevity.planningAge &&
      account.survivorPct > 0 &&
      survivorStartYear <= Math.min(lastPaymentYear, otherLastAliveYear)
    )
  }
  const payoutForm = account.payoutForm ?? { kind: 'lifeOnly' as const }
  if (payoutForm.kind === 'periodCertain') {
    return (
      survivorStartYear <=
      Math.min(lastPaymentYear, otherLastAliveYear, startCalendarYear + payoutForm.certainYears - 1)
    )
  }
  return (
    payoutForm.kind === 'jointSurvivor' &&
    survivorStartYear <= Math.min(lastPaymentYear, otherLastAliveYear)
  )
}

type SocialSecurityIncome = Extract<Plan['incomes'][number], { type: 'socialSecurity' }>

function personForSocialSecurity(plan: Plan, income: SocialSecurityIncome) {
  return plan.household.people.find((person) => person.id === income.personId)
}

function disabilityControlsClaim(plan: Plan, income: SocialSecurityIncome): boolean {
  if (income.disability === undefined) return false
  const person = personForSocialSecurity(plan, income)
  if (!person) return false
  const year = Number(person.dob.slice(0, 4))
  const month = Number(person.dob.slice(5, 7))
  const day = Number(person.dob.slice(8, 10))
  const fra = fraForBirthYear(effectiveBirthYear(year, month, day))
  return income.disability.onsetAge < fra.years
}

function socialSecurityOwnBenefitPossible(income: SocialSecurityIncome): boolean {
  return (
    (income.piaMonthly ?? 0) > 0 ||
    income.earnings?.some((earning) => earning.amount > 0) === true
  )
}

function claimPayableWindow(
  plan: Plan,
  income: SocialSecurityIncome,
  claimAge: { years: number; months: number },
  startYear: number,
  endYear: number,
): { startYear: number; endYear: number } | null {
  const person = personForSocialSecurity(plan, income)
  if (!person) return null
  const birthYear = Number(person.dob.slice(0, 4))
  const payableStartYear = Math.max(startYear, birthYear + claimAge.years)
  const payableEndYear = Math.min(endYear, birthYear + person.longevity.planningAge)
  return payableStartYear <= payableEndYear
    ? { startYear: payableStartYear, endYear: payableEndYear }
    : null
}

function claimWindowsOverlap(
  first: { startYear: number; endYear: number },
  second: { startYear: number; endYear: number },
): boolean {
  return Math.max(first.startYear, second.startYear) <= Math.min(first.endYear, second.endYear)
}

function auxiliaryBenefitCanPay(
  plan: Plan,
  claimantWindow: { startYear: number; endYear: number },
  other: SocialSecurityIncome,
  startYear: number,
  endYear: number,
): boolean {
  if (!socialSecurityOwnBenefitPossible(other)) return false
  const otherPerson = personForSocialSecurity(plan, other)
  if (!otherPerson) return false
  const otherWindow = claimPayableWindow(plan, other, other.claimAge, startYear, endYear)
  if (otherWindow !== null && claimWindowsOverlap(claimantWindow, otherWindow)) return true

  const otherBirthYear = Number(otherPerson.dob.slice(0, 4))
  const otherDeathYear = otherBirthYear + otherPerson.longevity.planningAge
  const otherBenefitStartYear =
    otherBirthYear +
    (disabilityControlsClaim(plan, other)
      ? other.disability!.onsetAge
      : other.claimAge.years)
  return (
    Math.max(claimantWindow.startYear, otherDeathYear + 1, otherBenefitStartYear) <=
    claimantWindow.endYear
  )
}

function disabilityPaysDuringWindow(
  plan: Plan,
  income: SocialSecurityIncome,
  startYear: number,
  endYear: number,
): boolean {
  if (!disabilityControlsClaim(plan, income) || !socialSecurityOwnBenefitPossible(income)) return false
  const person = personForSocialSecurity(plan, income)
  if (!person) return false
  const birthYear = Number(person.dob.slice(0, 4))
  return (
    Math.max(startYear, birthYear + income.disability!.onsetAge) <=
    Math.min(endYear, birthYear + person.longevity.planningAge)
  )
}

function claimChangeCanAffectProjection(
  plan: Plan,
  income: SocialSecurityIncome,
  claimAge: { years: number; months: number },
  startYear: number,
  endYear: number,
): boolean {
  const claimantWindow = claimPayableWindow(plan, income, claimAge, startYear, endYear)
  if (!claimantWindow) return false
  if (!disabilityControlsClaim(plan, income) && socialSecurityOwnBenefitPossible(income)) {
    return true
  }
  const person = personForSocialSecurity(plan, income)
  if (person && income.formerSpouses?.length) {
    const birthYear = Number(person.dob.slice(0, 4))
    const claimantDob = {
      year: birthYear,
      month: Number(person.dob.slice(5, 7)),
      day: Number(person.dob.slice(8, 10)),
    }
    for (let year = claimantWindow.startYear; year <= claimantWindow.endYear; year++) {
      const benefit = bestMaritalBenefit(income.formerSpouses, {
        claimantDob,
        claimantClaimAge: claimAge,
        claimantSurvivorClaimAge: claimAge,
        claimantAge: year - birthYear,
        year,
        claimantIsSingle: plan.household.people.length === 1,
      })
      if (benefit && benefit.monthly > 0) return true
    }
  }
  if (plan.household.people.length !== 2) return false
  return plan.incomes.some(
    (other) =>
      other.type === 'socialSecurity' &&
      other.personId !== income.personId &&
      auxiliaryBenefitCanPay(plan, claimantWindow, other, startYear, endYear),
  )
}

function hasPayableSocialSecurityBenefit(
  plan: Plan,
  startYear: number,
  endYear: number,
): boolean {
  const streams = plan.incomes.filter((income) => income.type === 'socialSecurity')
  return streams.some(
    (income) =>
      disabilityPaysDuringWindow(plan, income, startYear, endYear) ||
      claimChangeCanAffectProjection(plan, income, income.claimAge, startYear, endYear),
  )
}

function hasPotentialGeneralDeposit(plan: Plan, startYear: number): boolean {
  const endYear = householdPlanningHorizonYear(plan)
  const hasIncome = plan.incomes.some((income) => {
    switch (income.type) {
      case 'wages':
        return income.annualGross > 0 && hasWagesInYear(plan, income.personId, startYear)
      case 'socialSecurity':
        return hasPayableSocialSecurityBenefit(plan, startYear, endYear)
      case 'recurring':
        return (
          income.annualAmount > 0 &&
          (income.endYear === null || income.endYear >= startYear) &&
          (income.startYear === null || income.startYear <= endYear)
        )
      case 'oneTime':
        return income.amount > 0 && income.year >= startYear && income.year <= endYear
    }
  })
  if (hasIncome) return true
  const hasGuaranteedIncome = plan.accounts.some(
    (account) =>
      (account.type === 'pension' || account.type === 'annuity') &&
      hasGuaranteedIncomePayoutWindow(plan, account, startYear),
  )
  if (hasGuaranteedIncome) return true
  const hasActiveOwnedLadder =
    plan.incomeFloor?.ladders.some(
      (ladder) =>
        ladder.purchase === undefined &&
        ladder.annualRealAmount > 0 &&
        ladder.endYear >= Math.max(ladder.startYear, startYear),
    ) === true
  if (hasActiveOwnedLadder) return true
  if (
    plan.accounts.some(
      (account) =>
        account.type === 'property' &&
          account.plannedSaleYear !== null &&
          account.plannedSaleYear >= startYear &&
          account.plannedSaleYear <= endYear &&
          account.value > 0 &&
          (account.expectedNetProceeds ?? account.value) > 0,
    )
  ) {
    return true
  }
  return plan.insurance.some(
    (policy) =>
      policy.kind === 'permanentLife' &&
      (policy.deathBenefit > 0 || policy.cashValue > 0),
  )
}

function holdsProjectedAssets(plan: Plan, account: ProjectedBalanceAccount, startYear: number): boolean {
  if (account.balance > 0 || receivesContributionDuringProjection(plan, account, startYear)) return true

  const endYear = householdPlanningHorizonYear(plan)
  const depositTarget =
    plan.accounts.find((candidate) => candidate.type === 'cash') ??
    plan.accounts.find((candidate) => candidate.type === 'taxable')
  if (depositTarget?.id === account.id && hasPotentialGeneralDeposit(plan, startYear)) return true

  if (
    account.type === 'traditional' &&
    plan.accounts.some(
      (candidate) =>
        candidate.type === 'pension' &&
        candidate.lumpSumOffer !== undefined &&
        candidate.lumpSumOffer.amount > 0 &&
        candidate.lumpSumOffer.electionYear >= startYear &&
        candidate.lumpSumOffer.electionYear <= endYear &&
        candidate.lumpSumElection?.rolloverAccountId === account.id,
    )
  ) {
    return true
  }

  if (account.type !== 'roth' || plan.accounts.find((candidate) => candidate.type === 'roth')?.id !== account.id) {
    return false
  }
  const strategy = plan.strategies.rothConversion
  if (strategy.mode === 'manual' || strategy.mode === 'optimized') {
    const activeConversions = strategy.conversions.filter(
      (conversion) =>
        conversion.amount > 0 &&
        conversion.year >= startYear &&
        conversion.year <= endYear,
    )
    return (
      activeConversions.length > 0 &&
      hasRothConversionSources(
        plan,
        Math.min(...activeConversions.map((conversion) => conversion.year)),
        Math.max(...activeConversions.map((conversion) => conversion.year)),
      )
    )
  }
  if (strategy.mode === 'fillToTarget') {
    const effectiveStartYear = Math.max(strategy.startYear, startYear)
    const effectiveEndYear = Math.min(strategy.endYear, endYear)
    return (
      effectiveStartYear <= effectiveEndYear &&
      hasRothConversionSources(plan, effectiveStartYear, effectiveEndYear)
    )
  }
  return false
}

function usesDefaultReturn(
  plan: Plan,
  account: Plan['accounts'][number],
  startYear: number,
): boolean {
  if (!isProjectedBalanceAccount(account)) return false
  if (
    account.annualReturnPct !== null ||
    ('allocation' in account && account.allocation !== undefined)
  ) {
    return false
  }
  return holdsProjectedAssets(plan, account, startYear)
}

function finish(
  plan: Plan,
  edited: Plan,
  definition: ScenarioLeverDefinition,
  name: string,
  warnings: string[],
  context: ScenarioLeverBuildContext,
): ScenarioLeverBuildResult {
  const result = createScenarioPatch(plan, edited, {
    title: name,
    createdAtIso: context.createdAtIso,
    actor: context.actor ?? DEFAULT_ACTOR,
  })
  if (!result.ok) return unavailable(definition, result.issues, warnings)
  const operationPaths = result.patch.operations.map((operation) => operation.path)
  if (operationPaths.length === 0) {
    return unavailable(definition, ['This lever matches the base plan and would not change any modeled input.'], warnings)
  }
  const undeclared = operationPaths.filter((path) => !definition.declaredPaths.includes(path))
  if (undeclared.length > 0) {
    return unavailable(definition, [`Lever emitted undeclared operation paths: ${undeclared.join(', ')}`], warnings)
  }
  return { ok: true, definition, name, patch: result.patch, operationPaths, warnings }
}

/**
 * Build one canonical scenario from a complete plan. The base object is never
 * mutated, and deterministic callers inject the timestamp and generated id.
 */
export function buildScenarioLever(
  plan: Plan,
  request: ScenarioLeverRequest,
  context: ScenarioLeverBuildContext,
): ScenarioLeverBuildResult {
  const requestId = (request as { id?: unknown } | null)?.id
  const definition = definitionFor(requestId)
  if (!definition) {
    return unavailable(null, [`Unknown scenario lever id "${String(requestId)}".`])
  }
  const edited = clonePlan(plan)
  const warnings: string[] = []

  switch (request.id) {
    case 'retirementAge': {
      const inputIssue = validateNumber(request.yearsDelta, 'Retirement-age change', {
        min: -50,
        max: 50,
        integer: true,
      })
      if (inputIssue) return unavailable(definition, [inputIssue])
      const editablePeople = edited.household.people.filter((person) => person.retirementAge !== null)
      if (editablePeople.length === 0) {
        return unavailable(definition, ['Add a retirement age to the household before using this lever.'])
      }
      if (editablePeople.length !== edited.household.people.length) {
        warnings.push('People without a retirement age are left unchanged.')
      }
      for (const person of editablePeople) {
        const nextAge = person.retirementAge! + request.yearsDelta
        const ageIssue = validateNumber(nextAge, `${person.name} retirement age`, { min: 30, max: 80 })
        if (ageIssue) return unavailable(definition, [ageIssue], warnings)
        person.retirementAge = nextAge
      }
      if (
        edited.incomes.some(
          (income) => income.type === 'wages' && income.endAge !== null,
        )
      ) {
        warnings.push('Wage streams with an explicit stop age do not follow the retirement-age change.')
      }
      const direction = request.yearsDelta < 0 ? 'earlier' : 'later'
      return finish(
        plan,
        edited,
        definition,
        `All household retirement ages ${Math.abs(request.yearsDelta)}y ${direction}`,
        warnings,
        context,
      )
    }

    case 'spending': {
      const inputIssue = validateNumber(request.percentChange, 'Spending change', { min: -100, max: 100 })
      if (inputIssue) return unavailable(definition, [inputIssue])
      if (plan.expenses.spendingPolicy?.mode === 'abw') {
        return unavailable(definition, ['Base spending is not used while the ABW spending policy is active.'])
      }
      if (plan.expenses.baseAnnual === 0) {
        return unavailable(definition, ['Base spending is zero; enter spending before applying a percentage change.'])
      }
      const proposed = Math.max(0, Math.round(plan.expenses.baseAnnual * (1 + request.percentChange / 100)))
      if (plan.expenses.requiredAnnual !== undefined && proposed < plan.expenses.requiredAnnual) {
        return unavailable(
          definition,
          [`The proposed spending is below required spending (${plan.expenses.requiredAnnual.toLocaleString()}).`],
        )
      }
      edited.expenses.baseAnnual = proposed
      return finish(
        plan,
        edited,
        definition,
        `Household base spending: ${proposed.toLocaleString('en-US')} per year`,
        warnings,
        context,
      )
    }

    case 'socialSecurityClaim': {
      const inputIssue = validateNumber(request.claimAge, 'Social Security claim age', {
        min: 62,
        max: 70,
        integer: true,
      })
      if (inputIssue) return unavailable(definition, [inputIssue])
      const streams = edited.incomes.filter((income) => income.type === 'socialSecurity')
      if (streams.length === 0) {
        return unavailable(definition, ['Add a Social Security income stream before changing claim age.'])
      }
      const proposedClaimAge = { years: request.claimAge, months: 0 }
      const projectionEndYear = householdPlanningHorizonYear(plan)
      const eligible = streams.filter(
        (stream) =>
          !disabilityControlsClaim(edited, stream) ||
          claimChangeCanAffectProjection(
            plan,
            stream,
            proposedClaimAge,
            context.startYear,
            projectionEndYear,
          ),
      )
      if (eligible.length === 0) {
        return unavailable(definition, ['Disability streams use onset age instead of retirement claim age.'])
      }
      if (
        !eligible.some((stream) =>
          claimChangeCanAffectProjection(
            plan,
            stream,
            proposedClaimAge,
            context.startYear,
            projectionEndYear,
          ),
        )
      ) {
        return unavailable(definition, ['No Social Security stream has a modeled benefit to change.'])
      }
      if (eligible.length !== streams.length) {
        warnings.push('Social Security disability streams are left unchanged because onset age controls their start.')
      }
      if (eligible.some((stream) => stream.piaMonthly === null && stream.earnings === null)) {
        warnings.push('A changed stream has neither a PIA nor earnings history, so its benefit amount may be unavailable.')
      }
      for (const stream of eligible) {
        stream.claimAge = proposedClaimAge
      }
      return finish(plan, edited, definition, `All Social Security claims at age ${request.claimAge}`, warnings, context)
    }

    case 'socialSecurityCut': {
      const inputIssue = firstIssue(
        validateNumber(request.cutPct, 'Social Security benefit cut', {
          min: 0,
          max: 100,
          minExclusive: true,
        }),
        validateCalendarYear(request.fromYear, 'Social Security cut start year'),
      )
      if (inputIssue) return unavailable(definition, [inputIssue])
      const streams = plan.incomes.filter((income) => income.type === 'socialSecurity')
      if (streams.length === 0) {
        return unavailable(definition, ['Add a Social Security income stream before modeling a benefit cut.'])
      }
      if (request.fromYear > householdPlanningHorizonYear(plan)) {
        return unavailable(definition, ['Social Security cut start year must be within the household planning horizon.'])
      }
      const currentHaircut = plan.assumptions.ssHaircut
      if (
        currentHaircut != null &&
        currentHaircut.cutPct === request.cutPct &&
        Math.max(context.startYear, currentHaircut.fromYear) ===
          Math.max(context.startYear, request.fromYear)
      ) {
        return unavailable(definition, [
          'This Social Security cut already has the same effective projection schedule.',
        ])
      }
      if (
        !hasPayableSocialSecurityBenefit(
          plan,
          Math.max(context.startYear, request.fromYear),
          householdPlanningHorizonYear(plan),
        )
      ) {
        return unavailable(definition, ['No Social Security stream has a modeled benefit to cut.'])
      }
      edited.assumptions.ssHaircut = {
        fromYear: request.fromYear,
        cutPct: request.cutPct,
      }
      return finish(
        plan,
        edited,
        definition,
        `${request.cutPct}% Social Security cut from ${request.fromYear}`,
        warnings,
        context,
      )
    }

    case 'rothTarget': {
      const targetValueIssue =
        request.target === 'acaCliff'
          ? request.targetValue === null
            ? null
            : 'ACA-cliff targets do not take a target value.'
          : request.targetValue === null
            ? 'This Roth target requires a target value.'
            : request.target === 'topOfBracket'
              ? supportedRothBracketTargets(plan, request.startYear, request.endYear).includes(request.targetValue)
                ? null
                : 'Roth bracket target must be a supported non-top federal bracket rate.'
              : request.target === 'irmaaTier'
                ? supportedRothIrmaaTiers(request.startYear, request.endYear).includes(request.targetValue)
                  ? null
                  : 'Roth IRMAA target must be an available surcharge tier.'
                : validateNumber(request.targetValue, 'Fixed MAGI target', {
                    min: 0,
                    minExclusive: true,
                  })
      const inputIssue = firstIssue(
        validateCalendarYear(request.startYear, 'Roth target start year'),
        validateCalendarYear(request.endYear, 'Roth target end year'),
        targetValueIssue,
      )
      if (inputIssue) return unavailable(definition, [inputIssue])
      if (request.startYear > request.endYear) {
        return unavailable(definition, ['Roth target start year must be on or before its end year.'])
      }
      const projectionEndYear = householdPlanningHorizonYear(plan)
      if (request.endYear < context.startYear || request.startYear > projectionEndYear) {
        return unavailable(definition, ['Roth target window must overlap the household projection.'])
      }
      if (
        !hasRothConversionSources(
          plan,
          Math.max(request.startYear, context.startYear),
          Math.min(request.endYear, projectionEndYear),
        )
      ) {
        return unavailable(definition, ['Add a funded traditional account before modeling Roth conversions.'])
      }
      if (!hasRothDestination(plan)) {
        return unavailable(definition, ['Add a Roth destination account before modeling Roth conversions.'])
      }
      edited.strategies.rothConversion = {
        mode: 'fillToTarget',
        target: request.target,
        targetValue: request.targetValue,
        startYear: request.startYear,
        endYear: request.endYear,
      }
      const targetName =
        request.target === 'topOfBracket'
          ? `${request.targetValue}% federal bracket`
          : request.target === 'irmaaTier'
            ? `IRMAA tier ${request.targetValue}`
            : request.target === 'acaCliff'
              ? 'ACA credit cliff'
              : `fixed MAGI ${request.targetValue?.toLocaleString('en-US')}`
      return finish(
        plan,
        edited,
        definition,
        `Roth target: ${targetName}, ${request.startYear}–${request.endYear}`,
        warnings,
        context,
      )
    }

    case 'rothSchedule': {
      const inputIssue = firstIssue(
        validateCalendarYear(request.startYear, 'Roth schedule start year'),
        validateCalendarYear(request.endYear, 'Roth schedule end year'),
        validateNumber(request.annualAmount, 'Annual Roth conversion', {
          min: 0,
          minExclusive: true,
        }),
      )
      if (inputIssue) return unavailable(definition, [inputIssue])
      if (request.startYear > request.endYear) {
        return unavailable(definition, ['Roth schedule start year must be on or before its end year.'])
      }
      const projectionEndYear = householdPlanningHorizonYear(plan)
      if (request.endYear < context.startYear || request.startYear > projectionEndYear) {
        return unavailable(definition, ['Roth schedule window must overlap the household projection.'])
      }
      if (
        !hasRothConversionSources(
          plan,
          Math.max(request.startYear, context.startYear),
          Math.min(request.endYear, projectionEndYear),
        )
      ) {
        return unavailable(definition, ['Add a funded traditional account before modeling Roth conversions.'])
      }
      if (!hasRothDestination(plan)) {
        return unavailable(definition, ['Add a Roth destination account before modeling Roth conversions.'])
      }
      edited.strategies.rothConversion = {
        mode: 'manual',
        conversions: Array.from({ length: request.endYear - request.startYear + 1 }, (_, index) => ({
          year: request.startYear + index,
          amount: request.annualAmount,
        })),
      }
      return finish(
        plan,
        edited,
        definition,
        `${request.annualAmount.toLocaleString('en-US')} Roth conversion, ${request.startYear}–${request.endYear}`,
        warnings,
        context,
      )
    }

    case 'rothNone': {
      if (
        !hasEffectiveRothConversionOpportunity(
          plan,
          context.startYear,
          householdPlanningHorizonYear(plan),
        )
      ) {
        return unavailable(definition, [
          'No Roth conversion opportunity is active during the projection.',
        ])
      }
      edited.strategies.rothConversion = { mode: 'none' }
      return finish(plan, edited, definition, 'No Roth conversions', warnings, context)
    }

    case 'allocation': {
      const inputIssue = validateNumber(request.stockPct, 'Stock allocation', { min: 0, max: 100 })
      if (inputIssue) return unavailable(definition, [inputIssue])
      const eligible = edited.accounts.filter(
        (account) =>
          account.type === 'taxable' ||
          account.type === 'traditional' ||
          account.type === 'roth' ||
          account.type === 'hsa',
      )
      if (!eligible.some((account) => holdsProjectedAssets(plan, account, context.startYear))) {
        return unavailable(definition, [
          'No investable taxable, traditional, Roth, or HSA account can hold assets during the projection.',
        ])
      }
      if (eligible.some((account) => account.allocation !== undefined && account.allocation.mode !== 'static')) {
        warnings.push('This replaces an existing glidepath with one static allocation.')
      }
      const stocks = request.stockPct
      const usStocks = stocks * 0.75
      const intlStocks = stocks * 0.25
      const bonds = 100 - stocks
      for (const account of eligible) {
        account.allocation = {
          mode: 'static',
          rebalancing: 'annual',
          weights: { usStocks, intlStocks, bonds, cash: 0 },
        }
      }
      return finish(plan, edited, definition, `All eligible accounts: ${stocks}% stocks / ${100 - stocks}% bonds`, warnings, context)
    }

    case 'defaultReturn': {
      const inputIssue = validateNumber(request.returnPct, 'Default return', {
        min: -100,
        max: 1000,
        minExclusive: true,
        maxExclusive: true,
      })
      if (inputIssue) return unavailable(definition, [inputIssue])
      if (!plan.accounts.some((account) => usesDefaultReturn(plan, account, context.startYear))) {
        return unavailable(
          definition,
          ['No cash or investment account currently uses the default-return assumption.'],
        )
      }
      edited.assumptions.defaultReturnPct = request.returnPct
      if (edited.accounts.some((account) => account.annualReturnPct !== null)) {
        warnings.push('Accounts with an explicit annual return are unaffected by the default-return assumption.')
      }
      if (edited.accounts.some((account) => 'allocation' in account && account.allocation !== undefined)) {
        warnings.push('Allocated accounts use asset-class assumptions and are unaffected by the default-return assumption.')
      }
      return finish(plan, edited, definition, `${request.returnPct}% default return`, warnings, context)
    }

    case 'pension': {
      const inputIssue = firstIssue(
        validateNumber(request.monthlyChangePct, 'Pension monthly-income change', {
          min: -100,
          max: 1000,
          maxExclusive: true,
        }),
        validateNumber(request.startAgeDelta, 'Pension start-age change', {
          min: -40,
          max: 40,
          integer: true,
        }),
      )
      if (inputIssue) return unavailable(definition, [inputIssue])
      const pensions = edited.accounts.filter((account) => account.type === 'pension')
      if (pensions.length === 0) {
        return unavailable(definition, ['Add an existing pension before using this lever.'])
      }
      const accounts = pensions.filter(
        (account) =>
          !(
            account.lumpSumElection &&
            account.lumpSumOffer &&
            account.lumpSumOffer.electionYear <= context.startYear
          ),
      )
      if (accounts.length === 0) {
        return unavailable(definition, [
          'All existing pensions have an effective lump-sum election and no longer pay during the projection.',
        ])
      }
      if (accounts.length !== pensions.length) {
        warnings.push('Pensions with a lump-sum election already effective at projection start are left unchanged.')
      }
      for (const account of accounts) {
        const nextStartAge = account.startAge + request.startAgeDelta
        const ageIssue = validateNumber(nextStartAge, `${account.name} pension start age`, { min: 40, max: 80 })
        if (ageIssue) return unavailable(definition, [ageIssue])
        account.startAge = nextStartAge
        account.monthlyAmount *= 1 + request.monthlyChangePct / 100
      }
      if (
        !accounts.some((account) => {
          const original = plan.accounts.find(
            (candidate): candidate is Extract<Plan['accounts'][number], { type: 'pension' }> =>
              candidate.type === 'pension' && candidate.id === account.id,
          )
          return (
            (original !== undefined && hasGuaranteedIncomePayoutWindow(plan, original, context.startYear)) ||
            hasGuaranteedIncomePayoutWindow(edited, account, context.startYear)
          )
        })
      ) {
        return unavailable(definition, ['No pension payments can occur during the projection.'])
      }
      return finish(
        plan,
        edited,
        definition,
        `All pensions: income ${request.monthlyChangePct >= 0 ? '+' : ''}${request.monthlyChangePct}%, start age ${request.startAgeDelta >= 0 ? '+' : ''}${request.startAgeDelta}y`,
        warnings,
        context,
      )
    }

    case 'annuity': {
      const inputIssue = firstIssue(
        validateNumber(request.monthlyChangePct, 'Annuity monthly-income change', {
          min: -100,
          max: 1000,
          maxExclusive: true,
        }),
        validateNumber(request.startAgeDelta, 'Annuity start-age change', {
          min: -55,
          max: 55,
          integer: true,
        }),
      )
      if (inputIssue) return unavailable(definition, [inputIssue])
      const accounts = edited.accounts.filter(
        (
          account,
        ): account is Extract<Plan['accounts'][number], { type: 'annuity' }> =>
          account.type === 'annuity' &&
          (account.purchase === undefined || account.purchase.year < context.startYear),
      )
      if (accounts.length === 0) {
        return unavailable(definition, [
          'Add an annuity owned at projection start before using this lever.',
        ])
      }
      for (const account of accounts) {
        const nextStartAge = account.startAge + request.startAgeDelta
        const ageIssue = validateNumber(nextStartAge, `${account.name} annuity start age`, { min: 40, max: 95 })
        if (ageIssue) return unavailable(definition, [ageIssue])
        account.startAge = nextStartAge
        account.monthlyAmount *= 1 + request.monthlyChangePct / 100
      }
      if (
        !accounts.some((account) => {
          const original = plan.accounts.find(
            (candidate): candidate is Extract<Plan['accounts'][number], { type: 'annuity' }> =>
              candidate.type === 'annuity' && candidate.id === account.id,
          )
          return (
            (original !== undefined && hasGuaranteedIncomePayoutWindow(plan, original, context.startYear)) ||
            hasGuaranteedIncomePayoutWindow(edited, account, context.startYear)
          )
        })
      ) {
        return unavailable(definition, ['No owned annuity payments can occur during the projection.'])
      }
      return finish(
        plan,
        edited,
        definition,
        `All annuities owned at projection start: income ${request.monthlyChangePct >= 0 ? '+' : ''}${request.monthlyChangePct}%, start age ${request.startAgeDelta >= 0 ? '+' : ''}${request.startAgeDelta}y`,
        warnings,
        context,
      )
    }

    case 'relocation': {
      if (typeof request.state !== 'string') {
        return unavailable(definition, ['Destination state must be a state-code string.'])
      }
      const state = request.state.trim().toUpperCase()
      const inputIssue = firstIssue(
        validateCalendarYear(request.moveYear, 'Move year'),
        validateCalendarYear(context.startYear, 'Projection start year'),
        request.moveMonth === undefined
          ? null
          : validateNumber(request.moveMonth, 'Move month', { min: 1, max: 12, integer: true }),
      )
      if (inputIssue) return unavailable(definition, [inputIssue])
      if (request.moveYear < context.startYear) {
        return unavailable(definition, ['Move year must be on or after the projection start year.'])
      }
      if (!MODELED_STATE_CODES.has(state)) {
        return unavailable(definition, ['Destination must be a modeled US state or the District of Columbia.'])
      }
      const effectiveStartState = stateForYear(plan.household, context.startYear - 1)
      const futureMoves = plan.household.stateMoves.filter((move) => move.fromYear >= context.startYear)
      if (state === effectiveStartState && futureMoves.length === 0) {
        return unavailable(definition, ['The household already lives in that state and has no future moves to replace.'])
      }
      const planningHorizonYear = householdPlanningHorizonYear(plan)
      if (request.moveYear > planningHorizonYear) {
        return unavailable(definition, ['Move year must be within the household planning horizon.'])
      }
      if (futureMoves.length > 0) {
        warnings.push('This scenario replaces the plan’s existing future state moves.')
      }
      if (plan.assumptions.stateEffectiveTaxPct > 0) {
        warnings.push(
          `The ${plan.assumptions.stateEffectiveTaxPct}% flat state-tax override is reset across the entire projection, including years before the move, so modeled destination rules can apply.`,
        )
      }
      if (plan.assumptions.localIncomeTaxPct > 0) {
        warnings.push(
          `The ${plan.assumptions.localIncomeTaxPct}% local income-tax rate is reset to 0% across the entire projection, including years before the move.`,
        )
      }
      warnings.push('Relocation models state and local income tax; property tax, sales tax, and cost of living are not inferred.')
      const relocationBase = clonePlan(plan)
      relocationBase.household.state = effectiveStartState
      relocationBase.household.stateMoves = futureMoves
      const loose = relocationScenarioPatch(
        relocationBase,
        { state, moveYear: request.moveYear, moveMonth: request.moveMonth },
        context.startYear,
      )
      const applied = applyScenarioPatch(relocationBase, loose)
      if (!applied.ok) return unavailable(definition, applied.issues, warnings)
      return finish(plan, applied.plan, definition, `Move to ${state} in ${request.moveYear}`, warnings, context)
    }

    case 'survivorSpending': {
      const inputIssue = validateNumber(request.percent, 'Survivor spending percent', { min: 0, max: 100 })
      if (inputIssue) return unavailable(definition, [inputIssue])
      if (plan.expenses.spendingPolicy?.mode === 'abw') {
        return unavailable(definition, ['Survivor spending scaling is not used while the ABW spending policy is active.'])
      }
      if (edited.household.people.length < 2) {
        return unavailable(definition, ['Survivor spending applies only to a two-person household.'])
      }
      const [firstPerson, secondPerson] = edited.household.people
      if (
        Number(firstPerson!.dob.slice(0, 4)) + firstPerson!.longevity.planningAge ===
        Number(secondPerson!.dob.slice(0, 4)) + secondPerson!.longevity.planningAge
      ) {
        return unavailable(definition, [
          'The household has no modeled survivor-only year.',
        ])
      }
      edited.expenses.survivorSpendingPct = request.percent
      return finish(plan, edited, definition, `${request.percent}% household spending in survivor years`, warnings, context)
    }

    case 'care': {
      const inputIssue = firstIssue(
        validateCalendarYear(context.startYear, 'Projection start year'),
        validateNumber(request.startAge, 'Care start age', { min: 40, max: 110, integer: true }),
        validateNumber(request.durationYears, 'Care duration', { min: 1, max: 25, integer: true }),
        validateNumber(request.annualCost, 'Annual care cost', { min: 0, minExclusive: true }),
      )
      if (inputIssue) return unavailable(definition, [inputIssue])
      if (request.personId === undefined && edited.household.people.length > 1) {
        return unavailable(definition, ['Choose which household member receives care.'])
      }
      const person =
        request.personId === undefined
          ? edited.household.people[0]
          : edited.household.people.find((entry) => entry.id === request.personId)
      if (request.personId !== undefined && !person) {
        return unavailable(definition, [`No household member has id "${request.personId}".`])
      }
      if (!person) return unavailable(definition, ['Add a household member before modeling a care event.'])
      const attainedAgeAtStart = context.startYear - Number(person.dob.slice(0, 4))
      if (
        attainedAgeAtStart >= request.startAge + request.durationYears ||
        attainedAgeAtStart > person.longevity.planningAge ||
        request.startAge > person.longevity.planningAge
      ) {
        return unavailable(definition, ['The care episode does not overlap this person’s projection.'])
      }
      if (!context.createId) return unavailable(definition, ['A deterministic care-event ID factory is required.'])
      edited.careEvents.push({
        id: context.createId(),
        personId: person.id,
        startAge: request.startAge,
        durationYears: request.durationYears,
        annualCost: request.annualCost,
      })
      if (!edited.insurance.some((policy) => policy.kind === 'ltc' && policy.owner === person.id)) {
        warnings.push(`${person.name} has no matching long-term-care policy recorded.`)
      }
      return finish(plan, edited, definition, `${person.name}: care at age ${request.startAge}`, warnings, context)
    }

    case 'homeSale': {
      const inputIssue = firstIssue(
        validateCalendarYear(context.startYear, 'Projection start year'),
        validateCalendarYear(request.saleYear, 'Property sale year'),
      )
      if (inputIssue) return unavailable(definition, [inputIssue])
      if (request.saleYear < context.startYear) {
        return unavailable(definition, ['Property sale year must be on or after the projection start year.'])
      }
      const properties = edited.accounts.filter((account) => account.type === 'property')
      if (properties.length === 0) return unavailable(definition, ['Add a property before modeling a home sale.'])
      if (request.propertyId === undefined && properties.length > 1) {
        return unavailable(definition, ['Choose a property before modeling a sale when the plan has multiple properties.'])
      }
      const property =
        request.propertyId === undefined
          ? properties[0]
          : properties.find((candidate) => candidate.id === request.propertyId)
      if (!property) return unavailable(definition, [`No property has id "${request.propertyId}".`])
      if (property.plannedSaleYear !== null) {
        warnings.push('This replaces an existing planned property sale year.')
      }
      if (property.value === 0) {
        warnings.push('A property has zero value, so its sale may not add proceeds.')
      }
      const horizonYear = Math.max(
        ...edited.household.people.map(
          (person) => Number(person.dob.slice(0, 4)) + person.longevity.planningAge,
        ),
      )
      if (request.saleYear > horizonYear) {
        return unavailable(definition, ['Property sale year must be within the household planning horizon.'])
      }
      property.plannedSaleYear = request.saleYear
      return finish(plan, edited, definition, `Sell ${property.name} in ${request.saleYear}`, warnings, context)
    }

    case 'stopContributions': {
      if (
        !plan.accounts.some(
          (account) =>
            isProjectedBalanceAccount(account) &&
            receivesContributionDuringProjection(plan, account, context.startYear),
        )
      ) {
        return unavailable(definition, ['No account contributions are active during the projection.'])
      }
      for (const account of edited.accounts) {
        if (!isProjectedBalanceAccount(account) || !acceptsContributions(account)) continue
        account.annualContribution = 0
        delete account.contributionSchedule
      }
      return finish(plan, edited, definition, 'Coast check: stop contributing', warnings, context)
    }
  }
}
