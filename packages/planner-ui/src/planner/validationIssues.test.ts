/**
 * Validation issues for people: the engine's exact `path: message` strings
 * become a section, a field label, and advice, without ever deciding what is
 * valid. The first block round-trips a real `parsePlan` failure so a change
 * in the engine's (Zod's) wording fails here instead of silently leaving raw
 * messages on screen; the rest use the paths the Design QA walk cited.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan } from '@retiregolden/engine/model/plan'

import { adviceOf, issuesForSection, labelOfPath, labelOfSegments, parseIssue, parseIssues, sectionOfPath } from './validationIssues'

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
    ['assumptions.inflationPct', 'Assumptions: Inflation'],
    ['incomes.0.annualGross', 'Income 1: Annual gross'],
    ['incomes.0.endAge', 'Income 1: Stop age'],
    ['accounts.2.balance', 'Account 3: Balance'],
    ['accounts.4.plannedSaleYear', 'Account 5: Planned sale year'],
    ['insurance.0.cashValueSchedule', 'Insurance policy 1: Cash-value schedule'],
    ['insurance.0.premiumEndAge', 'Insurance policy 1: Premiums end at age'],
    ['insurance.0.cashValueGrowthPct', 'Insurance policy 1: Cash value growth'],
    ['careEvents.0.durationYears', 'Care event 1: Duration (years)'],
    ['incomeFloor.ladders.0.endYear', 'TIPS ladder 1: Last payout year'],
    ['expenses.phases.0.multiplier', 'Phase 1: Multiplier'],
    ['expenses.baseAnnual', 'Spending: Baseline annual spending'],
    ['household.people.1.retirementAge', 'Person 2: Retirement age'],
    ['household.stateMoves.0.fromYear', 'Move 1: Move year'],
    ['incomes.1.claimAge.years', 'Income 2: Claim age (years)'],
    ['incomes.1.claimAge.months', 'Income 2: Claim age (+ months)'],
    ['incomes.0.startYear', 'Income 1: Start year'],
    ['incomes.0.annualAmount', 'Income 1: Annual amount'],
    ['strategies.rothConversion.targetValue', 'Roth conversion: Target'],
    ['strategies.rothConversion.startYear', 'Roth conversion: Start year'],
    ['strategies.rothConversion.endYear', 'Roth conversion: End year'],
    ['strategies.rothConversion.conversions.0.year', 'Conversion 1: Year'],
    ['strategies.withdrawalOrder.bracketPct', 'Withdrawal strategy: Target bracket'],
    ['assumptions.stateEffectiveTaxPct', 'Assumptions: State effective tax (override)'],
    ['assumptions.healthcareExtraInflationPct', 'Assumptions: Healthcare extra inflation'],
    ['assumptions.assetClassParams.usStocks.returnPct', 'Asset classes: US stocks › Expected return'],
    ['assumptions.ssHaircut.cutPct', 'Social Security haircut: Cut'],
    ['expenses.oneTimeGoals.0.year', 'Goal 1: Year'],
    ['expenses.oneTimeGoals.2.amount', "Goal 3: Amount (today's $)"],
    ['expenses.healthcare.pre65MonthlyPremiumPerPerson', 'Healthcare: Pre-65 premium / person / month'],
    ['accounts.3.interestPct', 'Account 4: Interest rate'],
    ['accounts.3.payoffYear', 'Account 4: Lump-sum payoff year'],
    ['accounts.1.dividendYieldPct', 'Account 2: Dividend yield'],
    ['accounts.1.qualifiedRatio', 'Account 2: Qualified dividends'],
    ['incomeFloor.ladders.0.purchase.year', 'TIPS ladder 1: Purchase year'],
    ['insurance.0.cashValueSchedule.1.age', 'Schedule row 2: Age'],
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
    // Every stream leaf whose only editor is on the Social Security page (r1-1).
    ['incomes.1.earnings.3.amount', 'social-security'],
    ['incomes.1.earningsProjection.throughAge', 'social-security'],
    ['incomes.1.coveredQuarters', 'social-security'],
    ['incomes.1.formerSpouses.0.piaMonthly', 'social-security'],
    ['incomes.1.disability.onsetAge', 'social-security'],
    // …while the wage and recurring leaves stay on Income.
    ['incomes.0.realGrowthPct', 'income'],
    ['incomes.0.annualAmount', 'income'],
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

  it('names the field, not the schema key, in the engine messages that carry one (r1-7)', () => {
    expect(adviceOf("beneficiaryBirthYear is required when beneficiaryClass is 'designated-individual'; provide the beneficiary's birth year for the life-expectancy regime and consistency checks")).toBe(
      "“Beneficiary birth year” is required when “Beneficiary class” is 'designated-individual'; provide the beneficiary's birth year for the life-expectancy regime and consistency checks",
    )
    expect(adviceOf("soleBeneficiary is required when beneficiaryClass is 'designated-individual'; set it to true or false")).toBe(
      "“Sole beneficiary” is required when “Beneficiary class” is 'designated-individual'; set it to true or false",
    )
    expect(adviceOf('ownerBirthMonth is required when ownerBirthDay is provided; supply the birth month or remove the birth day')).toBe(
      '“Original owner birth month” is required when “Original owner birth day” is provided; supply the birth month or remove the birth day',
    )
    expect(adviceOf('earliestYear cannot be after latestYear')).toBe('“Earliest year” cannot be after “Latest year”')
    // A message with no schema key in it is left exactly as the engine wrote it.
    expect(adviceOf('a ladder must be purchased before its first payout year')).toBe('a ladder must be purchased before its first payout year')
    expect(adviceOf('required annual spending cannot exceed baseline (target) annual spending')).toBe(
      'required annual spending cannot exceed baseline (target) annual spending',
    )
  })
})

describe('labels with the plan in hand', () => {
  it('names a Social Security stream for its person, not its slot in the incomes array (r2-7)', () => {
    const plan = createEmptyPlan({ newId: () => 'id-' + Math.random().toString(36).slice(2, 8) })
    const alex = plan.household.people[0]!
    plan.household.people[0] = { ...alex, name: 'Alex' }
    plan.incomes = [
      { type: 'wages', id: 'w', personId: alex.id, annualGross: 100_000, endAge: null, realGrowthPct: 0 },
      { type: 'recurring', id: 'r', label: 'Rental', annualAmount: 1, startYear: null, endYear: null, inflationAdjusted: true, taxTreatment: 'ordinary' },
      { type: 'socialSecurity', id: 's', personId: alex.id, piaMonthly: 2_000, earnings: null, claimAge: { years: 67, months: 18 } },
    ]
    const issue = 'incomes.2.claimAge.months: Too big: expected number to be <=11'
    expect(parseIssue(issue, plan).label).toBe('Social Security (Alex): Claim age (+ months)')
    // The wage stream keeps its number: that is how the Income page lists it.
    expect(parseIssue('incomes.0.annualGross: Too small: expected number to be >=0', plan).label).toBe('Income 1: Annual gross')
    // Without the plan, the numbered form is all there is.
    expect(parseIssue(issue).label).toBe('Income 3: Claim age (+ months)')
    expect(parseIssues([issue], plan)[0]!.section).toBe('social-security')
  })

  it('states the brokerage qualified-dividend bound in the percent the card shows, not the stored ratio (r2-4)', () => {
    // The engine stores a 0–1 share; the card shows and edits it as a percent.
    // The bound is the engine's, re-expressed in the field's own unit.
    expect(adviceOf('Too big: expected number to be <=1', 'accounts.1.qualifiedRatio')).toBe('Must be at most 100')
    expect(adviceOf('Too small: expected number to be >=0', 'accounts.1.qualifiedRatio')).toBe('Must be at least 0')
    expect(parseIssue('accounts.1.qualifiedRatio: Too big: expected number to be <=1').advice).toBe('Must be at most 100')
    // The asset-class share is already a 0–100 field and is untouched.
    expect(adviceOf('Too big: expected number to be <=100', 'assumptions.assetClassParams.usStocks.qualifiedRatioPct')).toBe('Must be at most 100')
    expect(adviceOf('Too big: expected number to be <=1', 'strategies.someRatio')).toBe('Must be at most 1')
  })
})

describe('labelOfSegments', () => {
  it('keeps a segment that holds a slash or a dot whole, so a decoded pointer key is not read as a path (r1-14)', () => {
    expect(labelOfSegments(['assumptions', 'historicalAnnualMagiByYear', '2024'])).toBe('Historical annual MAGI by year 2024')
    // `/assumptions/a~1b` decodes to the single key "a/b", not two segments.
    expect(labelOfSegments(['assumptions', 'a/b'])).toBe('Assumptions: A/b')
    expect(labelOfSegments(['expenses', 'oneTimeGoals', '0', 'amount'])).toBe("Goal 1: Amount (today's $)")
    expect(labelOfSegments([])).toBe('Plan')
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
