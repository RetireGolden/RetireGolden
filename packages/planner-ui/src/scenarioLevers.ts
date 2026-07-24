/**
 * Browser-free, edition-neutral scenario lever builders.
 *
 * Every builder edits a cloned Plan and delegates persistence to the engine's
 * canonical v1 scenario contract. Arrays are intentionally atomic: a lever
 * that changes a person, income, account, care event, or move declares and
 * emits the corresponding array-root operation.
 */

import type { Plan } from '@retiregolden/engine/model/plan'
import { modeledStateCodes } from '@retiregolden/engine/params/state'
import { relocationScenarioPatch } from '@retiregolden/engine/projection/relocation'
import type { ScenarioActor, ScenarioPatchV1 } from '@retiregolden/engine/scenarios/contract'
import { createScenarioPatch } from '@retiregolden/engine/scenarios/patch'
import { applyScenarioPatch } from '@retiregolden/engine/scenarios/scenarios'

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
  { id: 'socialSecurityCut', label: 'Social Security benefit cut', declaredPaths: ['/assumptions/ssHaircut'] },
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
  { id: 'annuity', label: 'All existing annuities', declaredPaths: ['/accounts'] },
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

function hasRothConversionSources(plan: Plan): boolean {
  return plan.accounts.some((account) => account.type === 'traditional' && account.balance > 0)
}

function hasRothDestination(plan: Plan): boolean {
  return plan.accounts.some((account) => account.type === 'roth')
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
      const eligible = streams.filter((stream) => stream.disability === undefined)
      if (eligible.length === 0) {
        return unavailable(definition, ['Disability streams use onset age instead of retirement claim age.'])
      }
      if (eligible.length !== streams.length) {
        warnings.push('Social Security disability streams are left unchanged because onset age controls their start.')
      }
      if (eligible.some((stream) => stream.piaMonthly === null && stream.earnings === null)) {
        warnings.push('A changed stream has neither a PIA nor earnings history, so its benefit amount may be unavailable.')
      }
      for (const stream of eligible) {
        stream.claimAge = { years: request.claimAge, months: 0 }
      }
      return finish(plan, edited, definition, `All Social Security claims at age ${request.claimAge}`, warnings, context)
    }

    case 'socialSecurityCut': {
      const inputIssue = firstIssue(
        validateNumber(request.cutPct, 'Social Security benefit cut', { min: 0, max: 100 }),
        validateCalendarYear(request.fromYear, 'Social Security cut start year'),
      )
      if (inputIssue) return unavailable(definition, [inputIssue])
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
            : validateNumber(
                request.targetValue,
                'Roth target value',
                request.target === 'irmaaTier'
                  ? { min: 0, max: 10, integer: true }
                  : request.target === 'topOfBracket'
                    ? { min: 0, max: 100, minExclusive: true }
                    : { min: 0 },
              )
      const inputIssue = firstIssue(
        validateCalendarYear(request.startYear, 'Roth target start year'),
        validateCalendarYear(request.endYear, 'Roth target end year'),
        targetValueIssue,
      )
      if (inputIssue) return unavailable(definition, [inputIssue])
      if (!hasRothConversionSources(plan)) {
        return unavailable(definition, ['Add a funded traditional account before modeling Roth conversions.'])
      }
      if (!hasRothDestination(plan)) warnings.push('No Roth account is recorded; conversion proceeds are still modeled by the engine.')
      if (request.startYear > request.endYear) {
        return unavailable(definition, ['Roth target start year must be on or before its end year.'])
      }
      edited.strategies.rothConversion = {
        mode: 'fillToTarget',
        target: request.target,
        targetValue: request.targetValue,
        startYear: request.startYear,
        endYear: request.endYear,
      }
      return finish(plan, edited, definition, 'Roth conversions: fill to target', warnings, context)
    }

    case 'rothSchedule': {
      const inputIssue = firstIssue(
        validateCalendarYear(request.startYear, 'Roth schedule start year'),
        validateCalendarYear(request.endYear, 'Roth schedule end year'),
        validateNumber(request.annualAmount, 'Annual Roth conversion', { min: 0 }),
      )
      if (inputIssue) return unavailable(definition, [inputIssue])
      if (!hasRothConversionSources(plan)) {
        return unavailable(definition, ['Add a funded traditional account before modeling Roth conversions.'])
      }
      if (!hasRothDestination(plan)) warnings.push('No Roth account is recorded; conversion proceeds are still modeled by the engine.')
      if (request.startYear > request.endYear) {
        return unavailable(definition, ['Roth schedule start year must be on or before its end year.'])
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
      if (eligible.length === 0) {
        return unavailable(definition, ['Add an investable taxable, traditional, Roth, or HSA account first.'])
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
      const accounts = edited.accounts.filter((account) => account.type === 'pension')
      if (accounts.length === 0) {
        return unavailable(definition, ['Add an existing pension before using this lever.'])
      }
      for (const account of accounts) {
        const nextStartAge = account.startAge + request.startAgeDelta
        const ageIssue = validateNumber(nextStartAge, `${account.name} pension start age`, { min: 40, max: 80 })
        if (ageIssue) return unavailable(definition, [ageIssue])
        account.startAge = nextStartAge
        account.monthlyAmount *= 1 + request.monthlyChangePct / 100
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
      const accounts = edited.accounts.filter((account) => account.type === 'annuity')
      if (accounts.length === 0) {
        return unavailable(definition, ['Add an existing annuity before using this lever.'])
      }
      for (const account of accounts) {
        const nextStartAge = account.startAge + request.startAgeDelta
        const ageIssue = validateNumber(nextStartAge, `${account.name} annuity start age`, { min: 40, max: 95 })
        if (ageIssue) return unavailable(definition, [ageIssue])
        account.startAge = nextStartAge
        account.monthlyAmount *= 1 + request.monthlyChangePct / 100
      }
      return finish(
        plan,
        edited,
        definition,
        `All annuities: income ${request.monthlyChangePct >= 0 ? '+' : ''}${request.monthlyChangePct}%, start age ${request.startAgeDelta >= 0 ? '+' : ''}${request.startAgeDelta}y`,
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
      if (!MODELED_STATE_CODES.has(state)) {
        return unavailable(definition, ['Destination must be a modeled US state or the District of Columbia.'])
      }
      if (state === plan.household.state && plan.household.stateMoves.length === 0) {
        return unavailable(definition, ['The household already lives in that state and has no future moves to replace.'])
      }
      if (plan.household.stateMoves.length > 0) {
        warnings.push('This scenario replaces the plan’s existing future state moves.')
      }
      warnings.push('Relocation models state and local income tax; property tax, sales tax, and cost of living are not inferred.')
      const loose = relocationScenarioPatch(
        plan,
        { state, moveYear: request.moveYear, moveMonth: request.moveMonth },
        context.startYear,
      )
      const applied = applyScenarioPatch(plan, loose)
      if (!applied.ok) return unavailable(definition, applied.issues, warnings)
      return finish(plan, applied.plan, definition, `Move to ${state} in ${request.moveYear}`, warnings, context)
    }

    case 'survivorSpending': {
      const inputIssue = validateNumber(request.percent, 'Survivor spending percent', { min: 0, max: 100 })
      if (inputIssue) return unavailable(definition, [inputIssue])
      if (edited.household.people.length < 2) {
        return unavailable(definition, ['Survivor spending applies only to a two-person household.'])
      }
      edited.expenses.survivorSpendingPct = request.percent
      return finish(plan, edited, definition, `${request.percent}% household spending in survivor years`, warnings, context)
    }

    case 'care': {
      const inputIssue = firstIssue(
        validateNumber(request.startAge, 'Care start age', { min: 40, max: 110, integer: true }),
        validateNumber(request.durationYears, 'Care duration', { min: 1, max: 25, integer: true }),
        validateNumber(request.annualCost, 'Annual care cost', { min: 0 }),
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
      const inputIssue = validateCalendarYear(request.saleYear, 'Property sale year')
      if (inputIssue) return unavailable(definition, [inputIssue])
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
      if (request.saleYear > horizonYear) warnings.push('The sale year is beyond the current planning horizon.')
      property.plannedSaleYear = request.saleYear
      return finish(plan, edited, definition, `Sell ${property.name} in ${request.saleYear}`, warnings, context)
    }

    case 'stopContributions': {
      let changed = false
      for (const account of edited.accounts) {
        if (!('annualContribution' in account)) continue
        if (account.annualContribution !== 0 || account.contributionSchedule !== undefined) changed = true
        account.annualContribution = 0
        delete account.contributionSchedule
      }
      if (!changed) return unavailable(definition, ['No scheduled account contributions are recorded.'])
      return finish(plan, edited, definition, 'Coast check: stop contributing', warnings, context)
    }
  }
}
