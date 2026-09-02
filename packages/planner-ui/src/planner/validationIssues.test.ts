/**
 * Validation issues for people: the engine's exact `path: message` strings
 * become a section, a field label, and advice, without ever deciding what is
 * valid. Fixtures are real parser output from packages/engine (parsePlan on
 * a plan with a planning age of 9, a QCD of -5, and inflation of -999), plus
 * the paths the Design QA walk cited.
 */
import { describe, expect, it } from 'vitest'

import { adviceOf, issuesForSection, labelOfPath, parseIssue, parseIssues, sectionOfPath } from './validationIssues'

describe('parseIssue', () => {
  it('splits the engine string at the first colon-space and keeps both halves exact', () => {
    const p = parseIssue('household.people.0.longevity.planningAge: Too small: expected number to be >=60')
    expect(p.path).toBe('household.people.0.longevity.planningAge')
    expect(p.message).toBe('Too small: expected number to be >=60')
    expect(p.section).toBe('household')
    expect(p.label).toBe('Person 1: Planning age')
    expect(p.advice).toBe('Must be at least 60')
  })

  it('treats a string with no path as a plan-level issue', () => {
    const p = parseIssue('Something is off')
    expect(p.path).toBe('(root)')
    expect(p.label).toBe('Plan')
    expect(p.section).toBe('unknown')
  })
})

describe('labelOfPath', () => {
  it.each([
    ['strategies.qcdAnnual', 'Strategy: QCD annual amount'],
    ['strategies.taxableSafetyNetFloor', 'Strategy: Taxable safety-net floor'],
    ['strategies.itemizedDeductions.stateAndLocalTaxes', 'Itemized deductions: State and local taxes'],
    ['assumptions.localIncomeTaxPct', 'Assumptions: Local income tax %'],
    ['assumptions.inflationPct', 'Assumptions: Inflation %'],
    ['incomes.0.annualGross', 'Income 1: Annual gross'],
    ['incomes.0.endAge', 'Income 1: End age'],
    ['accounts.2.balance', 'Account 3: Balance'],
    ['accounts.4.plannedSaleYear', 'Account 5: Planned sale year'],
    ['insurance.0.cashValueSchedule', 'Insurance policy 1: Cash value schedule'],
    ['insurance.0.premiumEndAge', 'Insurance policy 1: Premium end age'],
    ['insurance.0.cashValueGrowthPct', 'Insurance policy 1: Cash value growth %'],
    ['careEvents.0.durationYears', 'Care event 1: Duration (years)'],
    ['incomeFloor.ladders.0.endYear', 'TIPS ladder 1: End year'],
    ['expenses.phases.0.multiplier', 'Phase 1: Multiplier'],
    ['expenses.baseAnnual', 'Spending: Baseline annual spending'],
    ['household.people.1.retirementAge', 'Person 2: Retirement age'],
    ['incomes.1.claimAge.years', 'Income 2: Years'],
    ['insurance.0', 'Insurance policy 1'],
    ['assumptions.someNewFieldPct', 'Assumptions: Some new field pct'],
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
    ["cashValueSchedule is required when cashValueMode is 'schedule'", "cashValueSchedule is required when cashValueMode is 'schedule'"],
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
