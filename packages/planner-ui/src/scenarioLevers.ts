/**
 * Browser-free, edition-neutral scenario lever builders.
 *
 * Every builder edits a cloned Plan and delegates persistence to the engine's
 * canonical v1 scenario contract. Arrays are intentionally atomic: a lever
 * that changes a person, income, account, care event, or move declares and
 * emits the corresponding array-root operation.
 */

import {
  stateForYear,
  stateResidencySegmentsForYear,
  type Plan,
} from '@retiregolden/engine/model/plan'
import { targetWeightsAt } from '@retiregolden/engine/allocation/assetClasses'
import { fmtNumber } from './planner/format'
import { packForYear } from '@retiregolden/engine/params'
import { modeledStateCodes } from '@retiregolden/engine/params/state'
import {
  annuityPayoutForm,
  annuityPayoutFraction,
} from '@retiregolden/engine/projection/annuityForms'
import { relocationScenarioPatch } from '@retiregolden/engine/projection/relocation'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import type { TaxCalculator } from '@retiregolden/engine/projection/types'
import type { ScenarioActor, ScenarioPatchV1 } from '@retiregolden/engine/scenarios/contract'
import { applyScenarioPatchInput, createScenarioPatch } from '@retiregolden/engine/scenarios/patch'
import {
  effectiveBirthYear,
  fraForBirthYear,
} from '@retiregolden/engine/socialSecurity/nra'
import {
  computePiaFromEarnings,
  isPiaFromEarningsError,
  piaInputFromEarnings,
  resolveEarningsProjection,
} from '@retiregolden/engine/socialSecurity/piaFromEarnings'
import {
  acceptsContributions,
  isConvertibleToRoth,
  traditionalWithdrawalPenaltyRate,
} from '@retiregolden/engine/strategies/accountEligibility'
import { taxCalculatorFor as standardTaxCalculatorForPlan } from './planTaxCalculator'
import { boundsForPath } from './planner/schemaBounds'

// Read from the engine's schema rather than restated as literals (the schema
// is the single source of truth for what a value is allowed to be — see
// `planner/schemaBounds.ts`). Module-level: the schema doesn't change within
// a session, so this is computed once, not per lever invocation.
//
// `boundsForPath` returns null only for a path the schema doesn't recognize
// as a bounded number — normally impossible for these two wired paths (a
// drift test in `schemaFieldBounds.test.ts` fails the build the moment the
// generated map and the live engine schema disagree), but `?? FALLBACK`
// below is what stands between a broken generate step and this lever
// silently accepting any age at all: `validateNumber` treats an `undefined`
// bound as "no restriction", so an unguarded `RETIREMENT_AGE_BOUNDS?.min`
// would fail OPEN rather than fail closed. The fallback restates the
// literals this lever always enforced before it started reading the schema.
const RETIREMENT_AGE_FALLBACK_BOUNDS = { min: 30, max: 80 }
const SS_CLAIM_AGE_YEARS_FALLBACK_BOUNDS = { min: 62, max: 70 }
const RETIREMENT_AGE_BOUNDS = boundsForPath('household.people.N.retirementAge') ?? RETIREMENT_AGE_FALLBACK_BOUNDS
const SS_CLAIM_AGE_YEARS_BOUNDS = boundsForPath('incomes.N.claimAge.years') ?? SS_CLAIM_AGE_YEARS_FALLBACK_BOUNDS

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
  { id: 'socialSecurityClaim', label: 'All eligible Social Security claim ages', declaredPaths: ['/incomes'] },
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
  /**
   * Prices bounded availability probes. Defaults to the planner's standard
   * federal + plan-specific state/local stack.
   */
  taxCalculatorForPlan?: (plan: Plan) => TaxCalculator
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

function accountConvertibleToRothInWindow(
  plan: Plan,
  account: Plan['accounts'][number],
  startYear: number,
  endYear: number,
): account is Extract<Plan['accounts'][number], { type: 'traditional' }> {
  const owner = plan.household.people.find((person) => person.id === account.ownerPersonId)
  for (let year = startYear; year <= endYear; year += 1) {
    // Construct the year-level facts here rather than importing
    // `rothConversionSourceContextForPerson`: pack-smoke installs the
    // published engine floor, which does not export that helper yet.
    // `isConvertibleToRoth` still receives the same `{ ownerAgeAttained,
    // ownerRetirementAge }` shape the engine gate reads.
    if (
      isConvertibleToRoth(account, {
        ownerAgeAttained: owner === undefined ? 0 : year - Number(owner.dob.slice(0, 4)),
        ownerRetirementAge: owner?.retirementAge ?? null,
      })
    ) {
      return true
    }
  }
  return false
}

function hasRothConversionSources(plan: Plan, startYear: number, endYear: number): boolean {
  return plan.accounts.some(
    (account) =>
      accountConvertibleToRothInWindow(plan, account, startYear, endYear) &&
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

function hasPositiveRothTargetHeadroom(
  plan: Plan,
  strategy: Extract<Plan['strategies']['rothConversion'], { mode: 'fillToTarget' }>,
  projectionStartYear: number,
  taxCalculatorForPlan: (plan: Plan) => TaxCalculator,
): boolean {
  const edited = clonePlan(plan)
  edited.strategies.rothConversion = strategy
  try {
    const projection = simulatePlan(edited, {
      startYear: projectionStartYear,
      horizonEndYear: strategy.endYear,
      taxCalculator: taxCalculatorForPlan(edited),
    })
    return projection.years.some(
      (year) =>
        year.year >= Math.max(projectionStartYear, strategy.startYear) &&
        year.year <= strategy.endYear &&
        year.rothConversion > 1e-8,
    )
  } catch {
    return false
  }
}

function hasPositiveRothScheduleOutput(
  plan: Plan,
  strategy: Extract<Plan['strategies']['rothConversion'], { mode: 'manual' }>,
  projectionStartYear: number,
  projectionEndYear: number,
  taxCalculatorForPlan: (plan: Plan) => TaxCalculator,
): boolean {
  const edited = clonePlan(plan)
  edited.strategies.rothConversion = strategy
  try {
    const projection = simulatePlan(edited, {
      startYear: projectionStartYear,
      horizonEndYear: projectionEndYear,
      taxCalculator: taxCalculatorForPlan(edited),
    })
    const requestedYears = new Set(strategy.conversions.map((conversion) => conversion.year))
    return projection.years.some(
      (year) => requestedYears.has(year.year) && year.rothConversion > 1e-8,
    )
  } catch {
    return false
  }
}

function hasPositiveCurrentRothConversionOutput(
  plan: Plan,
  startYear: number,
  endYear: number,
  taxCalculatorForPlan: (plan: Plan) => TaxCalculator,
): boolean {
  if (plan.strategies.rothConversion.mode === 'none') return false
  try {
    const projection = simulatePlan(plan, {
      startYear,
      horizonEndYear: endYear,
      taxCalculator: taxCalculatorForPlan(plan),
    })
    return projection.years.some(
      (year) =>
        year.year >= startYear &&
        year.year <= endYear &&
        year.rothConversion > 1e-8,
    )
  } catch {
    return false
  }
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

function guaranteedIncomeAnnualPayout(
  plan: Plan,
  account: GuaranteedIncomeAccount,
  year: number,
): number {
  if (account.monthlyAmount <= 0) return 0
  const ownerId = account.ownerPersonId ?? plan.household.people[0]?.id
  const owner = plan.household.people.find((person) => person.id === ownerId)
  if (!owner) return 0
  const startCalendarYear = Number(owner.dob.slice(0, 4)) + account.startAge
  if (year < startCalendarYear) return 0
  if (account.type === 'annuity' && account.purchase && year < account.purchase.year) return 0
  if (
    account.type === 'pension' &&
    account.lumpSumElection &&
    account.lumpSumOffer &&
    year >= account.lumpSumOffer.electionYear
  ) {
    return 0
  }

  const isAlive = (person: Plan['household']['people'][number]) =>
    year - Number(person.dob.slice(0, 4)) <= person.longevity.planningAge
  const ownerAlive = isAlive(owner)
  const other = plan.household.people.find((person) => person.id !== owner.id)
  const otherAlive = other ? isAlive(other) : false
  const grown =
    account.monthlyAmount *
    12 *
    Math.pow(1 + account.colaPct / 100, year - startCalendarYear)

  if (account.type === 'annuity') {
    return (
      grown *
      annuityPayoutFraction(annuityPayoutForm(account), {
        ownerAlive,
        otherAlive,
        anyAlive: plan.household.people.some(isAlive),
        yearsSinceStart: year - startCalendarYear,
      })
    )
  }
  if (ownerAlive) return grown
  return (
    otherAlive &&
    account.startAge <= owner.longevity.planningAge
      ? grown * (account.survivorPct / 100)
      : 0
  )
}

function guaranteedIncomeSchedulesDiffer(
  originalPlan: Plan,
  editedPlan: Plan,
  original: GuaranteedIncomeAccount,
  proposed: GuaranteedIncomeAccount,
  startYear: number,
): boolean {
  const endYear = Math.max(
    householdPlanningHorizonYear(originalPlan),
    householdPlanningHorizonYear(editedPlan),
  )
  let hasPayout = false
  for (let year = startYear; year <= endYear; year++) {
    const before = guaranteedIncomeAnnualPayout(originalPlan, original, year)
    const after = guaranteedIncomeAnnualPayout(editedPlan, proposed, year)
    hasPayout ||= before > 0 || after > 0
    if (Math.abs(before - after) > 1e-8) return true
  }

  // A non-qualified purchased annuity's exclusion ratio is fixed from its
  // start age, so equal gross payments can still have different taxable cash flow.
  return (
    hasPayout &&
    original.type === 'annuity' &&
    proposed.type === 'annuity' &&
    original.purchase?.taxQualification === 'nonQualified' &&
    proposed.purchase?.taxQualification === 'nonQualified' &&
    original.startAge !== proposed.startAge
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

function resolvedSocialSecurityPia(
  plan: Plan,
  income: SocialSecurityIncome,
  retirementAgeOverride?: number,
): number | null {
  if (income.piaMonthly !== null) return income.piaMonthly
  if (!income.earnings || income.earnings.length === 0) return null
  const person = personForSocialSecurity(plan, income)
  if (!person) return null
  const projection = resolveEarningsProjection(
    income.earningsProjection,
    retirementAgeOverride ?? person.retirementAge,
  )
  const result = computePiaFromEarnings(
    piaInputFromEarnings(
      Number(person.dob.slice(0, 4)),
      Number(person.dob.slice(5, 7)),
      Number(person.dob.slice(8, 10)),
      income.earnings,
      projection,
    ),
  )
  return isPiaFromEarningsError(result) ? null : result.piaMonthly
}

function projectedSocialSecuritySchedule(
  plan: Plan,
  startYear: number,
  endYear: number,
  taxCalculatorForPlan: (plan: Plan) => TaxCalculator,
): number[] | null {
  try {
    const projection = simulatePlan(plan, {
      startYear,
      horizonEndYear: endYear,
      taxCalculator: taxCalculatorForPlan(plan),
    })
    return projection.years.map((year) => year.incomes.socialSecurity)
  } catch {
    return null
  }
}

function claimChangeCanAffectProjection(
  plan: Plan,
  income: SocialSecurityIncome,
  claimAge: { years: number; months: number },
  startYear: number,
  endYear: number,
  taxCalculatorForPlan: (plan: Plan) => TaxCalculator,
): boolean {
  if (
    income.claimAge.years === claimAge.years &&
    income.claimAge.months === claimAge.months
  ) {
    return false
  }
  const edited = clonePlan(plan)
  const editedIncome = edited.incomes.find(
    (candidate): candidate is SocialSecurityIncome =>
      candidate.type === 'socialSecurity' && candidate.id === income.id,
  )
  if (!editedIncome) return false
  editedIncome.claimAge = claimAge
  const before = projectedSocialSecuritySchedule(
    plan,
    startYear,
    endYear,
    taxCalculatorForPlan,
  )
  const after = projectedSocialSecuritySchedule(
    edited,
    startYear,
    endYear,
    taxCalculatorForPlan,
  )
  return (
    before !== null &&
    after !== null &&
    before.some((amount, index) => Math.abs(amount - (after[index] ?? 0)) > 1e-8)
  )
}

function createProjectedAccountBalanceProbe(
  plan: Plan,
  startYear: number,
  taxCalculatorForPlan: (plan: Plan) => TaxCalculator,
): (accountId: string) => boolean {
  let positiveAccountIds: Set<string> | null = null
  let evaluated = false
  return (accountId) => {
    if (!evaluated) {
      evaluated = true
      try {
        const projection = simulatePlan(plan, {
          startYear,
          horizonEndYear: householdPlanningHorizonYear(plan),
          taxCalculator: taxCalculatorForPlan(plan),
        })
        positiveAccountIds = new Set(
          projection.years.flatMap((year) =>
            Object.entries(year.balances)
              .filter(([, balance]) => balance > 1e-8)
              .map(([projectedAccountId]) => projectedAccountId),
          ),
        )
      } catch {
        positiveAccountIds = null
      }
    }
    return positiveAccountIds?.has(accountId) === true
  }
}

function holdsProjectedAssets(
  plan: Plan,
  account: ProjectedBalanceAccount,
  startYear: number,
  hasPositiveProjectedBalance: (accountId: string) => boolean,
): boolean {
  const endYear = householdPlanningHorizonYear(plan)
  if (account.balance > 0 || receivesContributionDuringProjection(plan, account, startYear)) {
    return true
  }
  const depositTarget =
    plan.accounts.find((candidate) => candidate.type === 'cash') ??
    plan.accounts.find((candidate) => candidate.type === 'taxable')
  if (
    depositTarget?.id === account.id &&
    hasPositiveProjectedBalance(account.id)
  ) {
    return true
  }

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

  return (
    account.type === 'roth' &&
    plan.accounts.find((candidate) => candidate.type === 'roth')?.id === account.id &&
    hasPositiveProjectedBalance(account.id)
  )
}

type AllocatableAccount = Extract<
  Plan['accounts'][number],
  { type: 'taxable' | 'traditional' | 'roth' | 'hsa' }
>

function proposedStaticAllocation(
  account: AllocatableAccount,
  stockPct: number,
  startYear: number,
) {
  let usShare = 0.75
  if (account.allocation !== undefined) {
    // targetWeightsAt always returns one entry per ASSET_CLASS_IDS (currently
    // led by usStocks, intlStocks), so indices 0 and 1 are always present —
    // the engine's own weightsToVector/lerpVectors rely on the same guarantee.
    const currentWeights = targetWeightsAt(account.allocation, startYear)
    const currentStockWeight = currentWeights[0]! + currentWeights[1]!
    if (currentStockWeight > 0) usShare = currentWeights[0]! / currentStockWeight
  }
  const usStocks = stockPct * usShare
  return {
    mode: 'static' as const,
    rebalancing: account.allocation?.rebalancing ?? ('annual' as const),
    weights: {
      usStocks,
      intlStocks: stockPct - usStocks,
      bonds: 100 - stockPct,
      cash: 0,
    },
  }
}

function allocationMatches(
  current: AllocatableAccount['allocation'],
  proposed: ReturnType<typeof proposedStaticAllocation>,
): boolean {
  if (
    current === undefined ||
    current.mode !== 'static' ||
    current.rebalancing !== proposed.rebalancing
  ) {
    return false
  }
  return (
    current.weights.usStocks === proposed.weights.usStocks &&
    current.weights.intlStocks === proposed.weights.intlStocks &&
    current.weights.bonds === proposed.weights.bonds &&
    current.weights.cash === proposed.weights.cash
  )
}

function retirementAgeChangeCanAffectProjection(
  plan: Plan,
  person: Plan['household']['people'][number],
  nextAge: number,
  startYear: number,
  hasPositiveProjectedBalance: (accountId: string) => boolean,
): boolean {
  if (person.retirementAge === null || person.retirementAge === nextAge) return false
  const birthYear = Number(person.dob.slice(0, 4))
  const endYear = householdPlanningHorizonYear(plan)
  const lastAliveYear = birthYear + person.longevity.planningAge
  const firstChangedWorkYear = birthYear + Math.min(person.retirementAge, nextAge)
  const lastChangedWorkYear = birthYear + Math.max(person.retirementAge, nextAge) - 1
  if (
    firstChangedWorkYear <= endYear &&
    Math.min(lastChangedWorkYear, lastAliveYear) >= startYear &&
    plan.incomes.some(
      (income) =>
        income.type === 'wages' &&
        income.personId === person.id &&
        income.endAge === null &&
        income.annualGross > 0,
    )
  ) {
    return true
  }

  if (plan.expenses.healthcare.ssa44?.retirementYears) {
    const activeInYear = (year: number, proposedAge: number) => {
      return plan.household.people.some((candidate) => {
        const retirementAge =
          candidate.id === person.id ? proposedAge : candidate.retirementAge
        if (
          retirementAge === null ||
          retirementAge > candidate.longevity.planningAge
        ) {
          return false
        }
        const eventYear = Number(candidate.dob.slice(0, 4)) + retirementAge
        return year > eventYear && year <= eventYear + 2
      })
    }
    for (let year = startYear; year <= endYear; year++) {
      if (activeInYear(year, person.retirementAge) !== activeInYear(year, nextAge)) {
        return true
      }
    }
  }

  for (const income of plan.incomes) {
    if (
      income.type !== 'socialSecurity' ||
      income.personId !== person.id ||
      income.piaMonthly !== null ||
      !income.earningsProjection ||
      income.earningsProjection.throughAge !== null
    ) {
      continue
    }
    const currentPia = resolvedSocialSecurityPia(plan, income)
    const proposedPia = resolvedSocialSecurityPia(plan, income, nextAge)
    if (currentPia !== null && proposedPia !== null && currentPia !== proposedPia) {
      return true
    }
  }

  for (const account of plan.accounts) {
    if (
      account.type !== 'traditional' ||
      account.kind !== 'employer' ||
      (account.ownerPersonId ?? plan.household.people[0]?.id) !== person.id ||
      !holdsProjectedAssets(plan, account, startYear, hasPositiveProjectedBalance)
    ) {
      continue
    }
    const firstYear = Math.max(startYear, birthYear)
    const lastYear = Math.min(endYear, birthYear + person.longevity.planningAge)
    for (let year = firstYear; year <= lastYear; year++) {
      const ownerAgeAttained = year - birthYear
      if (
        traditionalWithdrawalPenaltyRate(account, {
          ownerAgeAttained,
          ownerRetirementAge: person.retirementAge,
        }) !==
        traditionalWithdrawalPenaltyRate(account, {
          ownerAgeAttained,
          ownerRetirementAge: nextAge,
        })
      ) {
        return true
      }
    }
  }

  return false
}

function relocationSchedulesMatch(
  plan: Plan,
  proposed: Plan['household'],
  startYear: number,
): boolean {
  const endYear = householdPlanningHorizonYear(plan)
  for (let year = startYear; year <= endYear; year++) {
    const currentSegments = stateResidencySegmentsForYear(plan.household, year)
    const proposedSegments = stateResidencySegmentsForYear(proposed, year)
    if (JSON.stringify(currentSegments) !== JSON.stringify(proposedSegments)) return false
  }
  return true
}

function usesDefaultReturn(
  plan: Plan,
  account: Plan['accounts'][number],
  startYear: number,
  hasPositiveProjectedBalance: (accountId: string) => boolean,
): boolean {
  if (!isProjectedBalanceAccount(account)) return false
  if (
    account.annualReturnPct !== null ||
    ('allocation' in account && account.allocation !== undefined)
  ) {
    return false
  }
  return holdsProjectedAssets(plan, account, startYear, hasPositiveProjectedBalance)
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
  const startYearIssue = validateCalendarYear(context.startYear, 'Projection start year')
  if (startYearIssue) return unavailable(definition, [startYearIssue])
  const edited = clonePlan(plan)
  const warnings: string[] = []
  const taxCalculatorForPlan =
    context.taxCalculatorForPlan ?? standardTaxCalculatorForPlan
  const hasPositiveProjectedBalance = createProjectedAccountBalanceProbe(
    plan,
    context.startYear,
    taxCalculatorForPlan,
  )

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
      let overlapsProjection = false
      for (const person of editablePeople) {
        const nextAge = person.retirementAge! + request.yearsDelta
        const ageIssue = validateNumber(nextAge, `${person.name} retirement age`, {
          min: RETIREMENT_AGE_BOUNDS.min,
          max: RETIREMENT_AGE_BOUNDS.max,
        })
        if (ageIssue) return unavailable(definition, [ageIssue], warnings)
        if (
          retirementAgeChangeCanAffectProjection(
            plan,
            person,
            nextAge,
            context.startYear,
            hasPositiveProjectedBalance,
          )
        ) {
          overlapsProjection = true
        }
        person.retirementAge = nextAge
      }
      if (!overlapsProjection) {
        return unavailable(definition, [
          'No shifted retirement boundary overlaps the active projection.',
        ], warnings)
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
          [`The proposed spending is below required spending (${fmtNumber(plan.expenses.requiredAnnual)}).`],
        )
      }
      edited.expenses.baseAnnual = proposed
      return finish(
        plan,
        edited,
        definition,
        // The four lever names below keep their bare-number shape: each is
        // stored in `plan.scenarios[].name` and in its patch title, so adding a
        // currency symbol would read differently from every name a saved plan
        // already holds. What moves is only where the grouping comes from.
        `Household base spending: ${fmtNumber(proposed)} per year`,
        warnings,
        context,
      )
    }

    case 'socialSecurityClaim': {
      const inputIssue = validateNumber(request.claimAge, 'Social Security claim age', {
        min: SS_CLAIM_AGE_YEARS_BOUNDS.min,
        max: SS_CLAIM_AGE_YEARS_BOUNDS.max,
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
            taxCalculatorForPlan,
          ),
      )
      if (eligible.length === 0) {
        return unavailable(definition, ['Disability streams use onset age instead of retirement claim age.'])
      }
      const effectiveChange = eligible.some(
        (stream) =>
          (stream.claimAge.years !== proposedClaimAge.years ||
            stream.claimAge.months !== proposedClaimAge.months) &&
          claimChangeCanAffectProjection(
            plan,
            stream,
            proposedClaimAge,
            context.startYear,
            projectionEndYear,
            taxCalculatorForPlan,
          ),
      )
      if (!effectiveChange) {
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
      const beforeSchedule = projectedSocialSecuritySchedule(
        plan,
        context.startYear,
        projectionEndYear,
        taxCalculatorForPlan,
      )
      const afterSchedule = projectedSocialSecuritySchedule(
        edited,
        context.startYear,
        projectionEndYear,
        taxCalculatorForPlan,
      )
      if (
        beforeSchedule === null ||
        afterSchedule === null ||
        !beforeSchedule.some(
          (amount, index) => Math.abs(amount - (afterSchedule[index] ?? 0)) > 1e-8,
        )
      ) {
        return unavailable(definition, [
          'The requested claim ages do not alter post-withholding Social Security benefits.',
        ])
      }
      return finish(plan, edited, definition, `All Social Security claims at age ${request.claimAge}`, warnings, context)
    }

    case 'socialSecurityCut': {
      const inputIssue = firstIssue(
        validateNumber(request.cutPct, 'Social Security benefit cut', {
          min: 0,
          max: 100,
        }),
        validateCalendarYear(request.fromYear, 'Social Security cut start year'),
      )
      if (inputIssue) return unavailable(definition, [inputIssue])
      const streams = plan.incomes.filter((income) => income.type === 'socialSecurity')
      if (streams.length === 0) {
        return unavailable(definition, ['Add a Social Security income stream before modeling a benefit cut.'])
      }
      const projectionEndYear = householdPlanningHorizonYear(plan)
      if (request.cutPct > 0 && request.fromYear > projectionEndYear) {
        return unavailable(definition, ['Social Security cut start year must be within the household planning horizon.'])
      }
      const currentHaircut = plan.assumptions.ssHaircut
      const proposedHaircut =
        request.cutPct === 0
          ? null
          : {
              fromYear: request.fromYear,
              cutPct: request.cutPct,
            }
      const haircutFactor = (
        haircut: Plan['assumptions']['ssHaircut'],
        year: number,
      ): number =>
        haircut !== null && year >= haircut.fromYear ? 1 - haircut.cutPct / 100 : 1
      const beforeHaircut = clonePlan(plan)
      beforeHaircut.assumptions.ssHaircut = null
      const payableSchedule = projectedSocialSecuritySchedule(
        beforeHaircut,
        context.startYear,
        projectionEndYear,
        taxCalculatorForPlan,
      )
      const hasPayableBenefit = payableSchedule?.some((amount) => amount > 1e-8) === true
      let changesPayableBenefit = false
      for (let index = 0; index < (payableSchedule?.length ?? 0); index++) {
        if ((payableSchedule?.[index] ?? 0) <= 1e-8) continue
        const year = context.startYear + index
        if (
          Math.abs(
            haircutFactor(currentHaircut, year) - haircutFactor(proposedHaircut, year),
          ) > 1e-8
        ) {
          changesPayableBenefit = true
          break
        }
      }
      if (!changesPayableBenefit && hasPayableBenefit) {
        return unavailable(definition, [
          'This Social Security cut already has the same effective projection schedule.',
        ])
      }
      if (!hasPayableBenefit) {
        return unavailable(definition, ['No Social Security stream has a modeled benefit to cut.'])
      }
      edited.assumptions.ssHaircut = proposedHaircut
      return finish(
        plan,
        edited,
        definition,
        proposedHaircut === null
          ? 'No Social Security benefit cut'
          : `${request.cutPct}% Social Security cut from ${request.fromYear}`,
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
      const proposedStrategy = {
        mode: 'fillToTarget',
        target: request.target,
        targetValue: request.targetValue,
        startYear: request.startYear,
        endYear: request.endYear,
      } satisfies Extract<Plan['strategies']['rothConversion'], { mode: 'fillToTarget' }>
      if (
        !hasPositiveRothTargetHeadroom(
          plan,
          proposedStrategy,
          context.startYear,
          taxCalculatorForPlan,
        )
      ) {
        return unavailable(definition, [
          'No target year has positive Roth conversion headroom under the requested ceiling.',
        ])
      }
      edited.strategies.rothConversion = proposedStrategy
      const targetName =
        request.target === 'topOfBracket'
          ? `${request.targetValue}% federal bracket`
          : request.target === 'irmaaTier'
            ? `IRMAA tier ${request.targetValue}`
            : request.target === 'acaCliff'
              ? 'ACA credit cliff'
              : `fixed MAGI ${request.targetValue === null ? '' : fmtNumber(request.targetValue)}`
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
      const proposedStrategy = {
        mode: 'manual',
        conversions: Array.from({ length: request.endYear - request.startYear + 1 }, (_, index) => ({
          year: request.startYear + index,
          amount: request.annualAmount,
        })),
      } satisfies Extract<Plan['strategies']['rothConversion'], { mode: 'manual' }>
      if (
        !hasPositiveRothScheduleOutput(
          plan,
          proposedStrategy,
          context.startYear,
          Math.min(request.endYear, projectionEndYear),
          taxCalculatorForPlan,
        )
      ) {
        return unavailable(definition, [
          'No requested year produces a Roth conversion from the projected source balances.',
        ])
      }
      edited.strategies.rothConversion = proposedStrategy
      return finish(
        plan,
        edited,
        definition,
        `${fmtNumber(request.annualAmount)} Roth conversion, ${request.startYear}–${request.endYear}`,
        warnings,
        context,
      )
    }

    case 'rothNone': {
      if (
        !hasPositiveCurrentRothConversionOutput(
          plan,
          context.startYear,
          householdPlanningHorizonYear(plan),
          taxCalculatorForPlan,
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
        (account): account is AllocatableAccount =>
          account.type === 'taxable' ||
          account.type === 'traditional' ||
          account.type === 'roth' ||
          account.type === 'hsa',
      )
      const proposedById = new Map(
        eligible.map((account) => [
          account.id,
          proposedStaticAllocation(account, request.stockPct, context.startYear),
        ]),
      )
      if (
        !eligible.some((account) => {
          const original = plan.accounts.find(
            (candidate): candidate is AllocatableAccount =>
              candidate.id === account.id &&
              (candidate.type === 'taxable' ||
                candidate.type === 'traditional' ||
                candidate.type === 'roth' ||
                candidate.type === 'hsa'),
          )
          const proposed = proposedById.get(account.id)!
          return (
            original !== undefined &&
            holdsProjectedAssets(
              plan,
              original,
              context.startYear,
              hasPositiveProjectedBalance,
            ) &&
            !allocationMatches(original.allocation, proposed)
          )
        })
      ) {
        return unavailable(definition, [
          'No projected investable account would receive a changed allocation.',
        ])
      }
      if (eligible.some((account) => account.allocation !== undefined && account.allocation.mode !== 'static')) {
        warnings.push('This replaces an existing glidepath with one static allocation.')
      }
      for (const account of eligible) {
        account.allocation = proposedById.get(account.id)!
      }
      return finish(plan, edited, definition, `All eligible accounts: ${request.stockPct}% stocks / ${100 - request.stockPct}% bonds`, warnings, context)
    }

    case 'defaultReturn': {
      const inputIssue = validateNumber(request.returnPct, 'Default return', {
        min: -100,
        max: 1000,
        minExclusive: true,
        maxExclusive: true,
      })
      if (inputIssue) return unavailable(definition, [inputIssue])
      if (
        !plan.accounts.some((account) =>
          usesDefaultReturn(
            plan,
            account,
            context.startYear,
            hasPositiveProjectedBalance,
          ),
        )
      ) {
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
            original !== undefined &&
            guaranteedIncomeSchedulesDiffer(plan, edited, original, account, context.startYear)
          )
        })
      ) {
        return unavailable(definition, [
          'The requested pension changes do not alter any projected payments.',
        ])
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
            original !== undefined &&
            guaranteedIncomeSchedulesDiffer(plan, edited, original, account, context.startYear)
          )
        })
      ) {
        return unavailable(definition, [
          'The requested annuity changes do not alter any projected payments.',
        ])
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
      const moveMonth = request.moveMonth ?? 7
      const inputIssue = firstIssue(
        validateCalendarYear(request.moveYear, 'Move year'),
        validateCalendarYear(context.startYear, 'Projection start year'),
        validateNumber(moveMonth, 'Move month', { min: 1, max: 12, integer: true }),
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
        { state, moveYear: request.moveYear, moveMonth },
        context.startYear,
      )
      // This is an internal probe used to construct the final canonical patch,
      // so apply the loose relocation without the public scenario wrapper's
      // ACA-evidence invalidation. The final patch is invalidated when it is
      // applied to a plan, after its canonical preconditions have succeeded.
      const applied = applyScenarioPatchInput(relocationBase, loose)
      if (!applied.ok) return unavailable(definition, applied.issues, warnings)
      const taxOverridesChange =
        plan.assumptions.stateEffectiveTaxPct > 0 ||
        plan.assumptions.localIncomeTaxPct > 0
      if (
        !taxOverridesChange &&
        relocationSchedulesMatch(plan, applied.plan.household, context.startYear)
      ) {
        return unavailable(definition, [
          'The household already lives under the requested effective projection residence schedule.',
        ])
      }
      return finish(
        plan,
        applied.plan,
        definition,
        `Move to ${state} in ${request.moveYear}, month ${moveMonth}`,
        warnings,
        context,
      )
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
      if (
        plan.expenses.baseAnnual === 0 &&
        (plan.expenses.idealAnnual ?? 0) === 0 &&
        (plan.expenses.excessAnnual ?? 0) === 0
      ) {
        return unavailable(definition, [
          'No annual lifestyle spending is modeled for survivor scaling.',
        ])
      }
      // Safe: the `length < 2` guard above already proved two people exist.
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
      return finish(
        plan,
        edited,
        definition,
        `${person.name}: ${request.durationYears} years of care at age ${request.startAge}, ${fmtNumber(request.annualCost)} per year`,
        warnings,
        context,
      )
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
      const allProperties = edited.accounts.filter((account) => account.type === 'property')
      if (allProperties.length === 0) {
        return unavailable(definition, ['Add a property before modeling a home sale.'])
      }
      const expiredProperty =
        request.propertyId === undefined
          ? undefined
          : allProperties.find(
              (property) =>
                property.id === request.propertyId &&
                property.plannedSaleYear !== null &&
                property.plannedSaleYear < context.startYear,
            )
      if (expiredProperty) {
        return unavailable(definition, [
          `${expiredProperty.name} was sold before the active projection and cannot be sold again.`,
        ])
      }
      const properties = allProperties.filter(
        (property) =>
          property.plannedSaleYear === null ||
          property.plannedSaleYear >= context.startYear,
      )
      if (properties.length === 0) {
        return unavailable(definition, [
          'No property remains owned during the active projection.',
        ])
      }
      if (request.propertyId === undefined && properties.length > 1) {
        return unavailable(definition, ['Choose a property before modeling a sale when the plan has multiple properties.'])
      }
      const property =
        request.propertyId === undefined
          ? properties[0]
          : properties.find((candidate) => candidate.id === request.propertyId)
      if (!property) return unavailable(definition, [`No property has id "${request.propertyId}".`])
      if (
        property.value === 0 &&
        (property.propertyTaxAnnual ?? 0) === 0 &&
        (property.insuranceAnnual ?? 0) === 0
      ) {
        return unavailable(definition, [
          'This zero-value property has no modeled sale proceeds or carrying costs; its HECM also has no value to draw.',
        ])
      }
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
