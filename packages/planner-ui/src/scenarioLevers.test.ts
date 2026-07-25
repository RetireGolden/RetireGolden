import { describe, expect, it } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import { parseScenarioPatch } from '@retiregolden/engine/scenarios/contract'
import { applyScenarioPatch } from '@retiregolden/engine/scenarios/scenarios'
import { buildExampleCouple } from './planner/examples/buildExampleCouple'
import {
  buildScenarioLever,
  SCENARIO_LEVER_DEFINITIONS,
  type ScenarioLeverRequest,
} from './scenarioLevers'

const context = {
  createdAtIso: '2026-07-24T20:00:00.000Z',
  startYear: 2026,
  createId: () => 'care-scenario-id',
} as const

function planWithGuaranteedIncome(): Plan {
  const plan = buildExampleCouple()
  const ownerPersonId = plan.household.people[0]!.id
  plan.accounts.push(
    {
      type: 'pension',
      id: 'pension-1',
      name: 'Pension',
      ownerPersonId,
      annualReturnPct: null,
      startAge: 65,
      monthlyAmount: 2_000,
      colaPct: 0,
      survivorPct: 50,
    },
    {
      type: 'annuity',
      id: 'annuity-1',
      name: 'Annuity',
      ownerPersonId,
      annualReturnPct: null,
      startAge: 70,
      monthlyAmount: 1_000,
      colaPct: 0,
      taxablePct: 80,
    },
  )
  return plan
}

describe('scenario lever contract', () => {
  const cases: Array<{
    request: ScenarioLeverRequest
    expectedPaths: string[]
    prepare?: () => Plan
  }> = [
    { request: { id: 'retirementAge', yearsDelta: -2 }, expectedPaths: ['/household/people'] },
    { request: { id: 'spending', percentChange: 10 }, expectedPaths: ['/expenses/baseAnnual'] },
    { request: { id: 'socialSecurityClaim', claimAge: 62 }, expectedPaths: ['/incomes'] },
    {
      request: { id: 'socialSecurityCut', cutPct: 25, fromYear: 2034 },
      expectedPaths: ['/assumptions/ssHaircut'],
    },
    {
      request: { id: 'rothTarget', target: 'topOfBracket', targetValue: 24, startYear: 2027, endYear: 2030 },
      expectedPaths: [
        '/strategies/rothConversion/endYear',
        '/strategies/rothConversion/startYear',
        '/strategies/rothConversion/targetValue',
      ],
    },
    {
      request: { id: 'rothSchedule', annualAmount: 30_000, startYear: 2027, endYear: 2029 },
      expectedPaths: [
        '/strategies/rothConversion/conversions',
        '/strategies/rothConversion/endYear',
        '/strategies/rothConversion/mode',
        '/strategies/rothConversion/startYear',
        '/strategies/rothConversion/target',
        '/strategies/rothConversion/targetValue',
      ],
    },
    {
      request: { id: 'rothNone' },
      expectedPaths: [
        '/strategies/rothConversion/endYear',
        '/strategies/rothConversion/mode',
        '/strategies/rothConversion/startYear',
        '/strategies/rothConversion/target',
        '/strategies/rothConversion/targetValue',
      ],
    },
    { request: { id: 'allocation', stockPct: 60 }, expectedPaths: ['/accounts'] },
    { request: { id: 'defaultReturn', returnPct: 3 }, expectedPaths: ['/assumptions/defaultReturnPct'] },
    {
      request: { id: 'pension', monthlyChangePct: 10, startAgeDelta: 1 },
      expectedPaths: ['/accounts'],
      prepare: planWithGuaranteedIncome,
    },
    {
      request: { id: 'annuity', monthlyChangePct: 10, startAgeDelta: 1 },
      expectedPaths: ['/accounts'],
      prepare: planWithGuaranteedIncome,
    },
    { request: { id: 'relocation', state: 'FL', moveYear: 2028 }, expectedPaths: ['/household/stateMoves'] },
    { request: { id: 'survivorSpending', percent: 70 }, expectedPaths: ['/expenses/survivorSpendingPct'] },
    {
      request: {
        id: 'care',
        personId: 'example-couple--alex',
        startAge: 85,
        durationYears: 3,
        annualCost: 100_000,
      },
      expectedPaths: ['/careEvents'],
    },
    { request: { id: 'homeSale', saleYear: 2032 }, expectedPaths: ['/accounts'] },
    { request: { id: 'stopContributions' }, expectedPaths: ['/accounts'] },
  ]

  it.each(cases)('builds a canonical $request.id patch with exact declared paths', ({ request, expectedPaths, prepare }) => {
    const plan = prepare?.() ?? buildExampleCouple()
    const before = JSON.stringify(plan)
    const result = buildScenarioLever(plan, request, context)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.operationPaths).toEqual(expectedPaths)
    expect(result.operationPaths.every((path) => !/\/\d+(?:\/|$)/.test(path))).toBe(true)
    expect(result.operationPaths.every((path) => result.definition.declaredPaths.includes(path))).toBe(true)
    expect(parseScenarioPatch(result.patch).ok).toBe(true)
    expect(applyScenarioPatch(plan, result.patch).ok).toBe(true)
    expect(JSON.stringify(plan)).toBe(before)
  })

  it('gives every fast lever a unique machine-readable path declaration', () => {
    expect(new Set(SCENARIO_LEVER_DEFINITIONS.map((definition) => definition.id)).size).toBe(
      SCENARIO_LEVER_DEFINITIONS.length,
    )
    expect(
      SCENARIO_LEVER_DEFINITIONS.every(
        (definition) =>
          definition.declaredPaths.length > 0 &&
          definition.declaredPaths.every((path) => path.startsWith('/')),
      ),
    ).toBe(true)
  })

  it('blocks missing data and unsafe spending instead of silently inventing it', () => {
    const plan = buildExampleCouple()
    plan.accounts = plan.accounts.filter((account) => account.type !== 'property')
    plan.expenses.requiredAnnual = 90_000

    const home = buildScenarioLever(plan, { id: 'homeSale', saleYear: 2030 }, context)
    const spending = buildScenarioLever(plan, { id: 'spending', percentChange: -25 }, context)

    expect(home.ok).toBe(false)
    expect(spending.ok).toBe(false)
    if (!home.ok) expect(home.issues.join(' ')).toContain('property')
    if (!spending.ok) expect(spending.issues.join(' ')).toContain('required spending')
  })

  it('warns when a lever leaves explicit modeling choices unaffected or replaces them', () => {
    const plan = buildExampleCouple()
    plan.incomes[0] = { ...plan.incomes[0]!, type: 'wages', endAge: 65 } as Plan['incomes'][number]
    const taxable = plan.accounts.find((account) => account.type === 'taxable')!
    taxable.allocation = {
      mode: 'linear',
      rebalancing: 'annual',
      from: { usStocks: 60, intlStocks: 20, bonds: 20, cash: 0 },
      to: { usStocks: 30, intlStocks: 10, bonds: 60, cash: 0 },
      startYear: 2026,
      endYear: 2040,
    }
    const retirement = buildScenarioLever(plan, { id: 'retirementAge', yearsDelta: -1 }, context)
    const allocation = buildScenarioLever(plan, { id: 'allocation', stockPct: 50 }, context)
    const returns = buildScenarioLever(plan, { id: 'defaultReturn', returnPct: 3 }, context)

    expect(retirement.warnings.join(' ')).toContain('explicit stop age')
    expect(allocation.warnings.join(' ')).toContain('replaces an existing glidepath')
    expect(returns.warnings.join(' ')).toContain('Allocated accounts')
  })

  it('rejects an unbounded Roth schedule before allocating its year list', () => {
    const result = buildScenarioLever(
      buildExampleCouple(),
      {
        id: 'rothSchedule',
        annualAmount: 10_000,
        startYear: 2026,
        endYear: Number.MAX_SAFE_INTEGER,
      },
      context,
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.join(' ')).toContain('at most 2200')
  })

  it.each([
    [{ id: 'socialSecurityClaim', claimAge: 61 }, 'at least 62'],
    [{ id: 'allocation', stockPct: Number.POSITIVE_INFINITY }, 'finite number'],
    [{ id: 'survivorSpending', percent: 101 }, 'at most 100'],
    [{ id: 'care', startAge: 84.5, durationYears: 3, annualCost: 50_000 }, 'whole number'],
    [{ id: 'defaultReturn', returnPct: Number.NaN }, 'finite number'],
  ] as Array<[ScenarioLeverRequest, string]>)(
    'rejects invalid stable-API input for $0.id',
    (request, expectedIssue) => {
      const result = buildScenarioLever(buildExampleCouple(), request, context)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.issues.join(' ')).toContain(expectedIssue)
    },
  )

  it('rejects unmodeled and no-op relocation destinations', () => {
    const plan = buildExampleCouple()
    const fake = buildScenarioLever(plan, { id: 'relocation', state: 'ZZ', moveYear: 2028 }, context)
    const current = buildScenarioLever(plan, { id: 'relocation', state: 'KY', moveYear: 2028 }, context)

    expect(fake.ok).toBe(false)
    expect(current.ok).toBe(false)
    if (!fake.ok) expect(fake.issues.join(' ')).toContain('modeled US state')
    if (!current.ok) expect(current.issues.join(' ')).toContain('already lives')
  })

  it('rejects an explicit unknown care recipient instead of falling back', () => {
    const result = buildScenarioLever(
      buildExampleCouple(),
      { id: 'care', personId: 'missing-person', startAge: 85, durationYears: 2, annualCost: 75_000 },
      context,
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.join(' ')).toContain('missing-person')
  })

  it('requires a care recipient for couples but safely defaults a one-person household', () => {
    const couple = buildExampleCouple()
    const ambiguous = buildScenarioLever(
      couple,
      { id: 'care', startAge: 85, durationYears: 2, annualCost: 75_000 },
      context,
    )

    const single = buildExampleCouple()
    const retainedPersonId = single.household.people[0]!.id
    single.household.filingStatus = 'single'
    single.household.people = [single.household.people[0]!]
    single.incomes = single.incomes.filter(
      (income) => !('personId' in income) || income.personId === retainedPersonId,
    )
    single.accounts = single.accounts.filter(
      (account) => account.ownerPersonId === null || account.ownerPersonId === retainedPersonId,
    )
    single.insurance = single.insurance.filter((policy) =>
      policy.kind === 'ltc' ? policy.owner === retainedPersonId : policy.insured === retainedPersonId,
    )
    single.careEvents = single.careEvents.filter((event) => event.personId === retainedPersonId)
    const unambiguous = buildScenarioLever(
      single,
      { id: 'care', startAge: 85, durationYears: 2, annualCost: 75_000 },
      context,
    )

    expect(ambiguous.ok).toBe(false)
    if (!ambiguous.ok) expect(ambiguous.issues.join(' ')).toContain('Choose which household member')
    expect(unambiguous.ok).toBe(true)
  })

  it('requires an unambiguous property and changes only the selected property', () => {
    const plan = buildExampleCouple()
    const first = plan.accounts.find((account) => account.type === 'property')!
    plan.accounts.push({ ...first, id: 'second-property', name: 'Lake house', plannedSaleYear: null })

    const ambiguous = buildScenarioLever(plan, { id: 'homeSale', saleYear: 2030 }, context)
    const selected = buildScenarioLever(
      plan,
      { id: 'homeSale', propertyId: 'second-property', saleYear: 2030 },
      context,
    )

    expect(ambiguous.ok).toBe(false)
    if (!ambiguous.ok) expect(ambiguous.issues.join(' ')).toContain('Choose a property')
    expect(selected.ok).toBe(true)
    if (!selected.ok) return
    const applied = applyScenarioPatch(plan, selected.patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    const properties = applied.plan.accounts.filter((account) => account.type === 'property')
    expect(properties.find((property) => property.id === first.id)?.plannedSaleYear).toBeNull()
    expect(properties.find((property) => property.id === 'second-property')?.plannedSaleYear).toBe(2030)
  })

  it('returns a structured error for an unknown runtime lever id', () => {
    const result = buildScenarioLever(
      buildExampleCouple(),
      { id: 'not-a-lever' } as unknown as ScenarioLeverRequest,
      context,
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.definition).toBeNull()
      expect(result.issues.join(' ')).toContain('Unknown scenario lever id')
    }
  })

  it('reports representative missing data across lever families', () => {
    const plan = buildExampleCouple()
    plan.incomes = plan.incomes.filter((income) => income.type !== 'socialSecurity')
    plan.accounts = plan.accounts.filter(
      (account) =>
        account.type !== 'traditional' &&
        account.type !== 'roth' &&
        account.type !== 'taxable' &&
        account.type !== 'hsa' &&
        account.type !== 'property',
    )
    plan.household.filingStatus = 'single'
    plan.household.people = [plan.household.people[0]!]

    const results = [
      buildScenarioLever(plan, { id: 'socialSecurityClaim', claimAge: 67 }, context),
      buildScenarioLever(plan, { id: 'rothSchedule', annualAmount: 10_000, startYear: 2026, endYear: 2027 }, context),
      buildScenarioLever(plan, { id: 'allocation', stockPct: 60 }, context),
      buildScenarioLever(plan, { id: 'survivorSpending', percent: 70 }, context),
      buildScenarioLever(plan, { id: 'homeSale', saleYear: 2030 }, context),
    ]

    expect(results.every((result) => !result.ok)).toBe(true)
  })

  it('names scenarios with the values actually written', () => {
    const plan = buildExampleCouple()
    const spending = buildScenarioLever(plan, { id: 'spending', percentChange: 10 }, context)
    const claims = buildScenarioLever(plan, { id: 'socialSecurityClaim', claimAge: 62 }, context)

    expect(spending.ok).toBe(true)
    expect(claims.ok).toBe(true)
    if (spending.ok) expect(spending.name).toContain('105,600')
    if (claims.ok) expect(claims.name).toContain('age 62')
  })

  it('requires both an eligible owned traditional source and a Roth destination', () => {
    const noDestination = buildExampleCouple()
    noDestination.accounts = noDestination.accounts.filter((account) => account.type !== 'roth')
    const target = buildScenarioLever(
      noDestination,
      { id: 'rothTarget', target: 'topOfBracket', targetValue: 24, startYear: 2027, endYear: 2030 },
      context,
    )
    const schedule = buildScenarioLever(
      noDestination,
      { id: 'rothSchedule', annualAmount: 20_000, startYear: 2027, endYear: 2030 },
      context,
    )

    expect(target.ok).toBe(false)
    expect(schedule.ok).toBe(false)
    if (!target.ok) expect(target.issues.join(' ')).toContain('Roth destination')

    const inheritedOnly = buildExampleCouple()
    const ownedTraditional = inheritedOnly.accounts.find((account) => account.type === 'traditional')!
    inheritedOnly.accounts = inheritedOnly.accounts.filter((account) => account.type !== 'traditional')
    inheritedOnly.accounts.push({
      ...ownedTraditional,
      id: 'inherited-traditional',
      inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: true },
    })
    const inheritedResult = buildScenarioLever(
      inheritedOnly,
      { id: 'rothSchedule', annualAmount: 20_000, startYear: 2027, endYear: 2030 },
      context,
    )
    expect(inheritedResult.ok).toBe(false)
    if (!inheritedResult.ok) expect(inheritedResult.issues.join(' ')).toContain('funded traditional')
  })

  it('accepts only engine-supported Roth bracket and IRMAA targets', () => {
    const plan = buildExampleCouple()
    const unsupportedBracket = buildScenarioLever(
      plan,
      { id: 'rothTarget', target: 'topOfBracket', targetValue: 20, startYear: 2027, endYear: 2030 },
      context,
    )
    const zeroTier = buildScenarioLever(
      plan,
      { id: 'rothTarget', target: 'irmaaTier', targetValue: 0, startYear: 2027, endYear: 2030 },
      context,
    )
    const highTier = buildScenarioLever(
      plan,
      { id: 'rothTarget', target: 'irmaaTier', targetValue: 6, startYear: 2027, endYear: 2030 },
      context,
    )
    const supportedTier = buildScenarioLever(
      plan,
      { id: 'rothTarget', target: 'irmaaTier', targetValue: 5, startYear: 2027, endYear: 2030 },
      context,
    )

    expect(unsupportedBracket.ok).toBe(false)
    expect(zeroTier.ok).toBe(false)
    expect(highTier.ok).toBe(false)
    expect(supportedTier.ok).toBe(true)
  })

  it('rejects modeled inputs that cannot affect the projection', () => {
    const plan = buildExampleCouple()
    const pastSale = buildScenarioLever(
      plan,
      { id: 'homeSale', saleYear: context.startYear - 1 },
      context,
    )
    const endedCare = buildScenarioLever(
      plan,
      {
        id: 'care',
        personId: plan.household.people[0]!.id,
        startAge: 40,
        durationYears: 2,
        annualCost: 50_000,
      },
      context,
    )
    const noSocialSecurity = buildExampleCouple()
    noSocialSecurity.incomes = noSocialSecurity.incomes.filter((income) => income.type !== 'socialSecurity')
    const benefitCut = buildScenarioLever(
      noSocialSecurity,
      { id: 'socialSecurityCut', cutPct: 20, fromYear: 2034 },
      context,
    )

    expect(pastSale.ok).toBe(false)
    expect(endedCare.ok).toBe(false)
    expect(benefitCut.ok).toBe(false)
    if (!pastSale.ok) expect(pastSale.issues.join(' ')).toContain('projection start')
    if (!endedCare.ok) expect(endedCare.issues.join(' ')).toContain('does not overlap')
    if (!benefitCut.ok) expect(benefitCut.issues.join(' ')).toContain('Social Security income')
  })

  it('rejects zero-value Roth schedules and Social Security cuts outside the projection', () => {
    const plan = buildExampleCouple()
    const horizon = Math.max(
      ...plan.household.people.map(
        (person) => Number(person.dob.slice(0, 4)) + person.longevity.planningAge,
      ),
    )
    const zeroRoth = buildScenarioLever(
      plan,
      { id: 'rothSchedule', annualAmount: 0, startYear: 2027, endYear: 2029 },
      context,
    )
    const zeroCut = buildScenarioLever(
      plan,
      { id: 'socialSecurityCut', cutPct: 0, fromYear: 2034 },
      context,
    )
    const lateCut = buildScenarioLever(
      plan,
      { id: 'socialSecurityCut', cutPct: 20, fromYear: horizon + 1 },
      context,
    )

    expect(zeroRoth.ok).toBe(false)
    expect(zeroCut.ok).toBe(false)
    expect(lateCut.ok).toBe(false)
    if (!zeroRoth.ok) expect(zeroRoth.issues.join(' ')).toContain('greater than 0')
    if (!zeroCut.ok) expect(zeroCut.issues.join(' ')).toContain('greater than 0')
    if (!lateCut.ok) expect(lateCut.issues.join(' ')).toContain('planning horizon')
  })

  it('disables base and survivor spending levers while ABW controls lifestyle spending', () => {
    const plan = buildExampleCouple()
    plan.expenses.spendingPolicy = { mode: 'abw' }

    const base = buildScenarioLever(plan, { id: 'spending', percentChange: 10 }, context)
    const survivor = buildScenarioLever(plan, { id: 'survivorSpending', percent: 70 }, context)

    expect(base.ok).toBe(false)
    expect(survivor.ok).toBe(false)
    if (!base.ok) expect(base.issues.join(' ')).toContain('ABW')
    if (!survivor.ok) expect(survivor.issues.join(' ')).toContain('ABW')
  })

  it('discloses relocation tax assumptions that the shared helper resets plan-wide', () => {
    const plan = buildExampleCouple()
    plan.assumptions.stateEffectiveTaxPct = 5
    plan.assumptions.localIncomeTaxPct = 3

    const result = buildScenarioLever(
      plan,
      { id: 'relocation', state: 'FL', moveYear: 2028 },
      context,
    )

    expect(result.ok).toBe(true)
    expect(result.warnings.join(' ')).toContain('5% flat state-tax override')
    expect(result.warnings.join(' ')).toContain('3% local income-tax rate')
    expect(result.warnings.join(' ')).toContain('including years before the move')
  })

  it('allows zero-opening-balance traditional sources with modeled contributions in the window', () => {
    const annual = buildExampleCouple()
    for (const account of annual.accounts) {
      if (account.type === 'traditional') account.balance = 0
    }
    const annualResult = buildScenarioLever(
      annual,
      { id: 'rothSchedule', annualAmount: 10_000, startYear: 2026, endYear: 2026 },
      context,
    )

    const scheduled = buildExampleCouple()
    for (const account of scheduled.accounts) {
      if (account.type !== 'traditional') continue
      account.balance = 0
      account.annualContribution = 0
      account.contributionSchedule =
        account.kind === 'ira'
          ? [{ annualAmount: 8_000, fromAge: 60, toAge: 65, escalationPct: 0 }]
          : undefined
    }
    const scheduleResult = buildScenarioLever(
      scheduled,
      { id: 'rothSchedule', annualAmount: 5_000, startYear: 2027, endYear: 2027 },
      context,
    )

    expect(annualResult.ok).toBe(true)
    expect(scheduleResult.ok).toBe(true)
  })

  it('rejects zero-cost care and relocation after the household horizon', () => {
    const plan = buildExampleCouple()
    const care = buildScenarioLever(
      plan,
      {
        id: 'care',
        personId: plan.household.people[0]!.id,
        startAge: 85,
        durationYears: 2,
        annualCost: 0,
      },
      context,
    )
    const horizon = Math.max(
      ...plan.household.people.map(
        (person) => Number(person.dob.slice(0, 4)) + person.longevity.planningAge,
      ),
    )
    const move = buildScenarioLever(
      plan,
      { id: 'relocation', state: 'FL', moveYear: horizon + 1 },
      context,
    )

    expect(care.ok).toBe(false)
    expect(move.ok).toBe(false)
    if (!care.ok) expect(care.issues.join(' ')).toContain('greater than 0')
    if (!move.ok) expect(move.issues.join(' ')).toContain('planning horizon')
  })

  it('enables default-return changes only when a projected balance account uses the fallback', () => {
    const noFallback = buildExampleCouple()
    noFallback.accounts = noFallback.accounts.filter(
      (account) => account.type === 'property' || account.type === 'debt',
    )
    const unavailable = buildScenarioLever(
      noFallback,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )

    const fallback = buildExampleCouple()
    fallback.accounts = [
      {
        type: 'cash',
        id: 'fallback-cash',
        name: 'Fallback cash',
        ownerPersonId: null,
        annualReturnPct: null,
        balance: 1_000,
        annualContribution: 0,
      },
    ]
    const available = buildScenarioLever(
      fallback,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )

    const inert = buildExampleCouple()
    inert.accounts = [
      {
        type: 'cash',
        id: 'inert-cash',
        name: 'Inert cash',
        ownerPersonId: null,
        annualReturnPct: null,
        balance: 0,
        annualContribution: 0,
      },
    ]
    inert.incomes = []
    inert.insurance = []
    const inertResult = buildScenarioLever(
      inert,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )

    expect(unavailable.ok).toBe(false)
    if (!unavailable.ok) expect(unavailable.issues.join(' ')).toContain('uses the default-return')
    expect(available.ok).toBe(true)
    expect(inertResult.ok).toBe(false)
    if (!inertResult.ok) expect(inertResult.issues.join(' ')).toContain('uses the default-return')
  })

  it('changes owned annuities without rewriting future purchase contracts', () => {
    const plan = planWithGuaranteedIncome()
    const owned = plan.accounts.find((account) => account.type === 'annuity')!
    const funding = plan.accounts.find((account) => account.type === 'taxable')!
    plan.accounts.push({
      ...owned,
      id: 'future-annuity',
      name: 'Future annuity',
      purchase: {
        year: 2030,
        premium: 100_000,
        fundingAccountId: funding.id,
        taxQualification: 'nonQualified',
      },
    })

    const result = buildScenarioLever(
      plan,
      { id: 'annuity', monthlyChangePct: 10, startAgeDelta: 1 },
      context,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const applied = applyScenarioPatch(plan, result.patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    const ownedAfter = applied.plan.accounts.find((account) => account.id === owned.id)
    const futureAfter = applied.plan.accounts.find((account) => account.id === 'future-annuity')
    expect(ownedAfter).toMatchObject({ startAge: owned.startAge + 1, monthlyAmount: owned.monthlyAmount * 1.1 })
    expect(futureAfter).toEqual(plan.accounts.find((account) => account.id === 'future-annuity'))

    const purchaseOnly = buildExampleCouple()
    purchaseOnly.accounts.push(plan.accounts.find((account) => account.id === 'future-annuity')!)
    const unavailable = buildScenarioLever(
      purchaseOnly,
      { id: 'annuity', monthlyChangePct: 10, startAgeDelta: 1 },
      context,
    )
    expect(unavailable.ok).toBe(false)
    if (!unavailable.ok) expect(unavailable.issues.join(' ')).toContain('owned annuity')
  })

  it('names Roth targets with their target and year window', () => {
    const plan = buildExampleCouple()
    const bracket = buildScenarioLever(
      plan,
      { id: 'rothTarget', target: 'topOfBracket', targetValue: 24, startYear: 2027, endYear: 2030 },
      context,
    )
    const irmaa = buildScenarioLever(
      plan,
      { id: 'rothTarget', target: 'irmaaTier', targetValue: 2, startYear: 2031, endYear: 2032 },
      context,
    )

    expect(bracket.ok).toBe(true)
    expect(irmaa.ok).toBe(true)
    if (bracket.ok) expect(bracket.name).toBe('Roth target: 24% federal bracket, 2027–2030')
    if (irmaa.ok) expect(irmaa.name).toBe('Roth target: IRMAA tier 2, 2031–2032')
  })
})
