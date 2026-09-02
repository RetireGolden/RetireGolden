/**
 * Validation issues for people: the engine's exact `path: message` strings
 * become a section, a field label, and advice, without ever deciding what is
 * valid. The first block round-trips a real `parsePlan` failure so a change
 * in the engine's (Zod's) wording fails here instead of silently leaving raw
 * messages on screen; the rest use the paths the Design QA walk cited.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan } from '@retiregolden/engine/model/plan'

import { adviceOf, issuesForSection, labelOfPath, parseIssue, parseIssues, sectionOfPath } from './validationIssues'

describe('real engine output', () => {
  it('translates what parsePlan actually reports for a planning age of 9, a QCD of -5, and inflation of -999', () => {
    const plan = createEmptyPlan({ newId: () => 'id-' + Math.random().toString(36).slice(2, 8) })
    plan.assumptions.inflationPct = -999
    plan.strategies.qcdAnnual = -5
    plan.household.people[0] = { ...plan.household.people[0]!, longevity: { planningAge: 9, source: 'manual' } }
    const r = parsePlan(plan)
    expect(r.ok).toBe(false)
    if (r.ok) return
    const byPath = Object.fromEntries(parseIssues(r.issues).map((i) => [i.path, i]))
    expect(byPath['household.people.0.longevity.planningAge']).toMatchObject({
      section: 'household',
      label: 'Person 1: Planning age',
      advice: 'Must be at least 60',
    })
    expect(byPath['strategies.qcdAnnual']).toMatchObject({
      section: 'strategy',
      label: "Strategy: QCD per year (today's $)",
      advice: 'Must be at least 0',
    })
    expect(byPath['assumptions.inflationPct']).toMatchObject({ section: 'assumptions', advice: 'Must be more than -100' })
    // Every real message was translated: none passes through as Zod wording.
    for (const i of Object.values(byPath)) expect(i.advice, i.message).not.toMatch(/^(Too small|Too big|Invalid input)/)
  })
})

describe('parseIssue', () => {
  it('splits the engine string at the first colon-space and keeps both halves exact', () => {
    const p = parseIssue('household.people.0.longevity.planningAge: Too small: expected number to be >=60')
    expect(p.path).toBe('household.people.0.longevity.planningAge')
    expect(p.message).toBe('Too small: expected number to be >=60')
    expect(p.section).toBe('household')
    expect(p.label).toBe('Person 1: Planning age')
    expect(p.advice).toBe('Must be at least 60')
  })

  it('treats a string with no path, or a $ path, as a plan-level issue', () => {
    const p = parseIssue('Something is off')
    expect(p.path).toBe('(root)')
    expect(p.label).toBe('Plan')
    expect(p.section).toBe('unknown')
    expect(parseIssue('$: Invalid input').path).toBe('(root)')
  })
})

describe('labelOfPath', () => {
  it.each([
    ['strategies.qcdAnnual', "Strategy: QCD per year (today's $)"],
    ['strategies.taxableSafetyNetFloor', 'Strategy: Taxable safety-net floor'],
    ['strategies.itemizedDeductions.stateAndLocalTaxes', 'Itemized deductions: State & local taxes (SALT)'],
    ['assumptions.localIncomeTaxPct', 'Assumptions: Local income tax'],
    ['assumptions.inflationPct', 'Assumptions: Inflation %'],
    ['incomes.0.annualGross', 'Income 1: Annual gross'],
    ['incomes.0.endAge', 'Income 1: Stop age'],
    ['accounts.2.balance', 'Account 3: Balance'],
    ['accounts.4.plannedSaleYear', 'Account 5: Planned sale year'],
    ['insurance.0.cashValueSchedule', 'Insurance policy 1: Cash value schedule'],
    ['insurance.0.premiumEndAge', 'Insurance policy 1: Premium end age'],
    ['insurance.0.cashValueGrowthPct', 'Insurance policy 1: Cash value growth'],
    ['careEvents.0.durationYears', 'Care event 1: Duration (years)'],
    ['incomeFloor.ladders.0.endYear', 'TIPS ladder 1: End year'],
    ['expenses.phases.0.multiplier', 'Phase 1: Multiplier'],
    ['expenses.baseAnnual', 'Spending: Baseline annual spending'],
    ['household.people.1.retirementAge', 'Person 2: Retirement age'],
    ['household.stateMoves.0.fromYear', 'Move 1: From year'],
    ['incomes.1.claimAge.years', 'Income 2: Claim age (years)'],
    ['incomes.1.claimAge.months', 'Income 2: Claim age (+ months)'],
    ['incomes.0.startYear', 'Income 1: Start year'],
    ['incomes.0.annualAmount', 'Income 1: Annual amount'],
    ['strategies.rothConversion.targetValue', 'Roth conversion: Target'],
    ['strategies.rothConversion.startYear', 'Roth conversion: Start year'],
    ['strategies.rothConversion.endYear', 'Roth conversion: End year'],
    ['strategies.rothConversion.conversions.0.year', 'Conversion 1: Year'],
    ['strategies.withdrawalOrder.bracketPct', 'Withdrawal strategy: Target bracket %'],
    ['assumptions.stateEffectiveTaxPct', 'Assumptions: State effective tax % (override)'],
    ['assumptions.healthcareExtraInflationPct', 'Assumptions: Healthcare extra inflation %'],
    ['assumptions.assetClassParams.usStocks.returnPct', 'Asset classes: US stocks › Expected return %'],
    ['assumptions.ssHaircut.cutPct', 'Social Security haircut: Cut %'],
    ['expenses.oneTimeGoals.0.year', 'Goal 1: Year'],
    ['expenses.oneTimeGoals.2.amount', 'Goal 3: Amount'],
    ['expenses.healthcare.pre65MonthlyPremiumPerPerson', 'Healthcare: Pre-65 premium / person / month'],
    ['accounts.3.interestPct', 'Account 4: Interest rate %'],
    ['accounts.3.payoffYear', 'Account 4: Payoff year'],
    ['accounts.1.dividendYieldPct', 'Account 2: Dividend yield %'],
    ['accounts.1.qualifiedRatio', 'Account 2: Qualified dividends (share, 0–1)'],
    ['incomeFloor.ladders.0.purchase.year', 'TIPS ladder 1: Purchase year'],
    ['insurance.0.cashValueSchedule.1.age', 'Schedule year 2: Age'],
    ['insurance.0', 'Insurance policy 1'],
    ['assumptions.someNewFieldPct', 'Assumptions: Some new field pct'],
    ['accounts.0.hsaContributionAnnual', 'Account 1: HSA contribution annual'],
    ['someMap.2024.value', 'Some map 2024: Value'],
    ['$', 'Plan'],
  ])('%s → %s', (path, label) => {
    expect(labelOfPath(path)).toBe(label)
  })
})

describe('sectionOfPath', () => {
  it.each([
    ['household.people.0.dob', 'household'],
    ['assumptions.inflationPct', 'assumptions'],
    ['strategies.qcdAnnual', 'strategy'],
    ['expenses.phases.0.multiplier', 'spending'],
    ['accounts.0.balance', 'accounts'],
    ['incomes.0.annualGross', 'income'],
    ['incomes.1.claimAge.years', 'social-security'],
    ['incomes.1.piaMonthly', 'social-security'],
    ['insurance.0.premiumEndAge', 'insurance'],
    ['careEvents.0.durationYears', 'insurance'],
    ['incomeFloor.ladders.0.endYear', 'income-floor'],
    ['schemaVersion', 'unknown'],
  ])('%s → %s', (path, section) => {
    expect(sectionOfPath(path)).toBe(section)
  })
})

describe('adviceOf', () => {
  it.each([
    ['Too small: expected number to be >=0', 'Must be at least 0'],
    ['Too small: expected number to be >-100', 'Must be more than -100'],
    ['Too big: expected number to be <=20', 'Must be at most 20'],
    ['Too big: expected number to be <1', 'Must be less than 1'],
    ['Invalid input: expected number, received NaN', 'Enter a number'],
    ['Invalid input', 'Enter a valid value'],
    ['Too small: expected string to have >=1 characters', 'Enter a value'],
    ['Too small: expected array to have >=1 items', 'Add at least one entry'],
    // The engine's cross-field messages that name schema keys are translated exactly (#489, #503) …
    ["cashValueSchedule is required when cashValueMode is 'schedule'", 'Add at least one schedule row, or grow cash value by a flat rate'],
    ["premiumEndAge is required when premiumMode is 'untilAge'", 'Enter the age premiums end'],
    // … and the ones already written for people pass through (#512).
    ['a ladder must end in or after its first payout year', 'a ladder must end in or after its first payout year'],
  ])('%s → %s', (message, advice) => {
    expect(adviceOf(message)).toBe(advice)
  })
})

describe('issuesForSection', () => {
  it('scopes issues to their card and keeps unplaceable ones visible everywhere', () => {
    const issues = parseIssues([
      'strategies.qcdAnnual: Too small: expected number to be >=0',
      'household.people.0.longevity.planningAge: Too small: expected number to be >=60',
      'schemaVersion: Invalid input',
    ])
    expect(issuesForSection(issues, 'strategy').map((i) => i.path)).toEqual(['strategies.qcdAnnual', 'schemaVersion'])
    expect(issuesForSection(issues, 'household').map((i) => i.path)).toEqual([
      'household.people.0.longevity.planningAge',
      'schemaVersion',
    ])
    expect(issuesForSection(issues, 'spending').map((i) => i.path)).toEqual(['schemaVersion'])
  })
})
