import { describe, expect, it } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import { createFlatTaxCalculator } from '@retiregolden/engine/projection/flatTax'
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

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    1899,
    2201,
  ])('rejects invalid projection start year %s before every lever dispatch', (startYear) => {
    const requests: ScenarioLeverRequest[] = [
      { id: 'retirementAge', yearsDelta: 1 },
      { id: 'spending', percentChange: 10 },
      { id: 'socialSecurityClaim', claimAge: 62 },
      { id: 'socialSecurityCut', cutPct: 20, fromYear: 2030 },
      {
        id: 'rothTarget',
        target: 'topOfBracket',
        targetValue: 24,
        startYear: 2026,
        endYear: 2030,
      },
      { id: 'rothSchedule', annualAmount: 20_000, startYear: 2026, endYear: 2030 },
      { id: 'rothNone' },
      { id: 'allocation', stockPct: 60 },
      { id: 'defaultReturn', returnPct: 4 },
      { id: 'pension', monthlyChangePct: 10, startAgeDelta: 1 },
      { id: 'annuity', monthlyChangePct: 10, startAgeDelta: 1 },
      { id: 'relocation', state: 'FL', moveYear: 2030 },
      { id: 'survivorSpending', percent: 70 },
      { id: 'care', startAge: 85, durationYears: 3, annualCost: 100_000 },
      { id: 'homeSale', saleYear: 2030 },
      { id: 'stopContributions' },
    ]

    for (const request of requests) {
      const result = buildScenarioLever(buildExampleCouple(), request, {
        ...context,
        startYear,
      })
      expect(result.ok, request.id).toBe(false)
      if (!result.ok) {
        expect(result.issues.join(' '), request.id).toContain('Projection start year')
      }
    }
  })

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

  it('rejects zero-value Roth schedules, no-op Social Security cuts, and cuts outside the projection', () => {
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
    if (!zeroCut.ok) expect(zeroCut.issues.join(' ')).toContain('same effective')
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

  it('requires post-withholding Social Security benefits for cut and claim-age levers', () => {
    const plan = buildExampleCouple()
    const person = plan.household.people[0]!
    person.dob = '1964-06-15'
    person.retirementAge = 67
    person.longevity.planningAge = 66
    const stream = plan.incomes
      .filter((income) => income.type === 'socialSecurity')
      .find((income) => income.personId === person.id)!
    stream.piaMonthly = 2_000
    stream.earnings = null
    stream.claimAge = { years: 62, months: 0 }
    delete stream.disability
    stream.formerSpouses = []
    const wages = plan.incomes.find(
      (income) => income.type === 'wages' && income.personId === person.id,
    )!
    if (wages.type !== 'wages') throw new Error('expected wages')
    wages.annualGross = 200_000
    wages.endAge = 67
    plan.incomes = [wages, stream]

    const withheldCut = buildScenarioLever(
      plan,
      { id: 'socialSecurityCut', cutPct: 20, fromYear: context.startYear },
      context,
    )
    const withheldClaim = buildScenarioLever(
      plan,
      { id: 'socialSecurityClaim', claimAge: 63 },
      context,
    )

    wages.annualGross = 0
    const payableCut = buildScenarioLever(
      plan,
      { id: 'socialSecurityCut', cutPct: 20, fromYear: context.startYear },
      context,
    )
    const payableClaim = buildScenarioLever(
      plan,
      { id: 'socialSecurityClaim', claimAge: 63 },
      context,
    )

    expect(withheldCut.ok).toBe(false)
    expect(withheldClaim.ok).toBe(false)
    expect(payableCut.ok).toBe(true)
    expect(payableClaim.ok).toBe(true)
  })

  it('does not expose a Social Security cut while SSDI is suspended by SGA through death', () => {
    const plan = buildExampleCouple()
    const person = plan.household.people[0]!
    person.dob = '1960-06-15'
    person.retirementAge = 67
    person.longevity.planningAge = 66
    const stream = plan.incomes
      .filter((income) => income.type === 'socialSecurity')
      .find((income) => income.personId === person.id)!
    stream.piaMonthly = 2_000
    stream.earnings = null
    stream.claimAge = { years: 67, months: 0 }
    stream.disability = { onsetAge: 55 }
    stream.formerSpouses = []
    const wages = plan.incomes.find(
      (income) => income.type === 'wages' && income.personId === person.id,
    )!
    if (wages.type !== 'wages') throw new Error('expected wages')
    wages.annualGross = 60_000
    wages.endAge = 67
    plan.incomes = [wages, stream]

    const suspended = buildScenarioLever(
      plan,
      { id: 'socialSecurityCut', cutPct: 20, fromYear: context.startYear },
      context,
    )
    wages.annualGross = 0
    const payable = buildScenarioLever(
      plan,
      { id: 'socialSecurityCut', cutPct: 20, fromYear: context.startYear },
      context,
    )

    expect(suspended.ok).toBe(false)
    expect(payable.ok).toBe(true)
  })

  it.each([
    { target: 'topOfBracket' as const, targetValue: 12 },
    { target: 'irmaaTier' as const, targetValue: 1 },
    { target: 'acaCliff' as const, targetValue: null },
    { target: 'fixedMagi' as const, targetValue: 100_000 },
  ])('requires positive Roth conversion headroom for $target targets', ({ target, targetValue }) => {
    const plan = buildExampleCouple()
    plan.incomes = []
    plan.expenses.baseAnnual = 0
    plan.expenses.idealAnnual = 0
    plan.expenses.excessAnnual = 0
    for (const account of plan.accounts) {
      if (account.type === 'traditional') account.balance = 1_000_000
    }
    const available = buildScenarioLever(
      plan,
      {
        id: 'rothTarget',
        target,
        targetValue,
        startYear: context.startYear,
        endYear: context.startYear + 2,
      },
      context,
    )

    const wages = buildExampleCouple()
    for (const person of wages.household.people) {
      person.retirementAge = 90
    }
    for (const income of wages.incomes) {
      if (income.type === 'wages') {
        income.annualGross = 500_000
        income.endAge = 90
      }
    }
    const unavailable = buildScenarioLever(
      wages,
      {
        id: 'rothTarget',
        target,
        targetValue: target === 'fixedMagi' ? 10_000 : targetValue,
        startYear: context.startYear,
        endYear: context.startYear,
      },
      context,
    )

    expect(available.ok).toBe(true)
    expect(unavailable.ok).toBe(false)
    if (!unavailable.ok) expect(unavailable.issues.join(' ')).toContain('headroom')
  })

  it('prices Roth target headroom with the planner tax stack instead of a zero-tax false positive', () => {
    const plan = buildExampleCouple()
    plan.incomes = []
    plan.insurance = []
    plan.careEvents = []
    plan.expenses.baseAnnual = 70_000
    plan.expenses.phases = []
    plan.expenses.oneTimeGoals = []
    plan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 0
    plan.expenses.healthcare.medicareExtrasMonthlyPerPerson = 0
    plan.assumptions.stateEffectiveTaxPct = 20
    const firstTraditional = plan.accounts.find(
      (candidate) => candidate.type === 'traditional',
    )
    for (const account of plan.accounts) {
      if (account.type === 'traditional') {
        account.balance = account === firstTraditional ? 80_000 : 0
        account.annualContribution = 0
        delete account.contributionSchedule
      }
    }
    plan.accounts = plan.accounts.filter(
      (account) => account.type === 'traditional' || account.type === 'roth',
    )
    const roth = plan.accounts.find((account) => account.type === 'roth')!
    roth.balance = 0
    roth.annualContribution = 0
    const request = {
      id: 'rothTarget' as const,
      target: 'fixedMagi' as const,
      targetValue: 200_000,
      startYear: context.startYear + 1,
      endYear: context.startYear + 1,
    }

    const zeroTax = buildScenarioLever(plan, request, {
      ...context,
      taxCalculatorForPlan: () => createFlatTaxCalculator(0),
    })
    const plannerTax = buildScenarioLever(plan, request, context)

    expect(zeroTax.ok).toBe(true)
    expect(plannerTax.ok).toBe(false)
    if (!plannerTax.ok) expect(plannerTax.issues.join(' ')).toContain('headroom')
  })

  it('rejects a future Roth schedule after the ledger depletes its opening source balance', () => {
    const plan = buildExampleCouple()
    plan.incomes = []
    plan.expenses.baseAnnual = 100_000
    plan.expenses.idealAnnual = 0
    plan.expenses.excessAnnual = 0
    for (const account of plan.accounts) {
      if (account.type === 'traditional') {
        account.balance = 50_000
        account.annualContribution = 0
        delete account.contributionSchedule
      } else if ('balance' in account) {
        account.balance = 0
      }
    }

    const result = buildScenarioLever(
      plan,
      {
        id: 'rothSchedule',
        annualAmount: 10_000,
        startYear: context.startYear + 1,
        endYear: context.startYear + 2,
      },
      context,
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.join(' ')).toContain('projected source balances')
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
    if (!unavailable.ok) expect(unavailable.issues.join(' ')).toContain('owned at projection start')
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

  it('requires Roth conversion windows to overlap the household projection', () => {
    const plan = buildExampleCouple()
    const horizon = Math.max(
      ...plan.household.people.map(
        (person) => Number(person.dob.slice(0, 4)) + person.longevity.planningAge,
      ),
    )
    const expiredTarget = buildScenarioLever(
      plan,
      {
        id: 'rothTarget',
        target: 'fixedMagi',
        targetValue: 150_000,
        startYear: context.startYear - 3,
        endYear: context.startYear - 1,
      },
      context,
    )
    const expiredSchedule = buildScenarioLever(
      plan,
      {
        id: 'rothSchedule',
        annualAmount: 10_000,
        startYear: context.startYear - 2,
        endYear: context.startYear - 1,
      },
      context,
    )
    const afterHorizon = buildScenarioLever(
      plan,
      {
        id: 'rothSchedule',
        annualAmount: 10_000,
        startYear: horizon + 1,
        endYear: horizon + 2,
      },
      context,
    )
    const boundaryOverlap = buildScenarioLever(
      plan,
      {
        id: 'rothSchedule',
        annualAmount: 10_000,
        startYear: context.startYear - 1,
        endYear: context.startYear,
      },
      context,
    )
    const pastOnlySource = buildExampleCouple()
    for (const account of pastOnlySource.accounts) {
      if (account.type !== 'traditional') continue
      account.balance = 0
      account.annualContribution = 0
      const owner = pastOnlySource.household.people.find(
        (person) => person.id === account.ownerPersonId,
      )
      const pastAge = owner ? context.startYear - 1 - Number(owner.dob.slice(0, 4)) : 0
      account.contributionSchedule =
        account.kind === 'ira'
          ? [{ annualAmount: 8_000, fromAge: pastAge, toAge: pastAge, escalationPct: 0 }]
          : undefined
    }
    const sourceOutsideOverlap = buildScenarioLever(
      pastOnlySource,
      {
        id: 'rothSchedule',
        annualAmount: 10_000,
        startYear: context.startYear - 1,
        endYear: context.startYear,
      },
      context,
    )

    expect(expiredTarget.ok).toBe(false)
    expect(expiredSchedule.ok).toBe(false)
    expect(afterHorizon.ok).toBe(false)
    expect(boundaryOverlap.ok).toBe(true)
    expect(sourceOutsideOverlap.ok).toBe(false)
    if (!expiredTarget.ok) expect(expiredTarget.issues.join(' ')).toContain('overlap')
    if (!expiredSchedule.ok) expect(expiredSchedule.issues.join(' ')).toContain('overlap')
    if (!afterHorizon.ok) expect(afterHorizon.issues.join(' ')).toContain('overlap')
    if (!sourceOutsideOverlap.ok) expect(sourceOutsideOverlap.issues.join(' ')).toContain('funded traditional')
    if (boundaryOverlap.ok) {
      const applied = applyScenarioPatch(plan, boundaryOverlap.patch)
      expect(applied.ok).toBe(true)
      if (applied.ok && applied.plan.strategies.rothConversion.mode === 'manual') {
        expect(applied.plan.strategies.rothConversion.conversions.map((conversion) => conversion.year)).toEqual([
          context.startYear - 1,
          context.startYear,
        ])
      }
    }
  })

  it('requires relocation to occur during the projection', () => {
    const plan = buildExampleCouple()
    const beforeStart = buildScenarioLever(
      plan,
      { id: 'relocation', state: 'FL', moveYear: context.startYear - 1 },
      context,
    )
    const atStart = buildScenarioLever(
      plan,
      { id: 'relocation', state: 'FL', moveYear: context.startYear },
      context,
    )

    expect(beforeStart.ok).toBe(false)
    expect(atStart.ok).toBe(true)
    if (!beforeStart.ok) expect(beforeStart.issues.join(' ')).toContain('projection start')
  })

  it('excludes effective pension elections but preserves pre-election payments', () => {
    const effective = planWithGuaranteedIncome()
    const effectivePension = effective.accounts.find((account) => account.type === 'pension')!
    const rollover = effective.accounts.find((account) => account.type === 'traditional')!
    effectivePension.lumpSumOffer = { amount: 250_000, electionYear: context.startYear }
    effectivePension.lumpSumElection = { rolloverAccountId: rollover.id }
    const unavailable = buildScenarioLever(
      effective,
      { id: 'pension', monthlyChangePct: 10, startAgeDelta: 0 },
      context,
    )

    const future = planWithGuaranteedIncome()
    const futurePension = future.accounts.find((account) => account.type === 'pension')!
    const futureRollover = future.accounts.find((account) => account.type === 'traditional')!
    const owner = future.household.people.find((person) => person.id === futurePension.ownerPersonId)!
    futurePension.startAge = context.startYear - Number(owner.dob.slice(0, 4))
    futurePension.lumpSumOffer = { amount: 250_000, electionYear: context.startYear + 1 }
    futurePension.lumpSumElection = { rolloverAccountId: futureRollover.id }
    const available = buildScenarioLever(
      future,
      { id: 'pension', monthlyChangePct: 10, startAgeDelta: 0 },
      context,
    )

    expect(unavailable.ok).toBe(false)
    if (!unavailable.ok) expect(unavailable.issues.join(' ')).toContain('effective lump-sum election')
    expect(available.ok).toBe(true)
  })

  it('recognizes active owned TIPS ladder cash flows as a future default-return balance source', () => {
    const zeroCashPlan = buildExampleCouple()
    zeroCashPlan.accounts = [
      {
        type: 'cash',
        id: 'ladder-cash',
        name: 'Ladder cash',
        ownerPersonId: null,
        annualReturnPct: null,
        balance: 0,
        annualContribution: 0,
      },
    ]
    zeroCashPlan.incomes = []
    zeroCashPlan.insurance = []
    zeroCashPlan.expenses.baseAnnual = 0
    zeroCashPlan.expenses.phases = []
    zeroCashPlan.expenses.oneTimeGoals = []
    zeroCashPlan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 0
    zeroCashPlan.expenses.healthcare.medicareExtrasMonthlyPerPerson = 0
    zeroCashPlan.incomeFloor = {
      ladders: [
        {
          id: 'owned-ladder',
          name: 'Owned bridge ladder',
          purpose: 'bridge',
          startYear: context.startYear + 3,
          endYear: context.startYear + 7,
          annualRealAmount: 30_000,
        },
      ],
    }

    const result = buildScenarioLever(
      zeroCashPlan,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )

    expect(result.ok).toBe(true)
  })

  it('stops only contributions that can occur during the projection', () => {
    const inactive = buildExampleCouple()
    inactive.incomes = inactive.incomes.filter((income) => income.type !== 'wages')
    for (const account of inactive.accounts) {
      if (!('annualContribution' in account)) continue
      account.annualContribution = 0
      delete account.contributionSchedule
    }
    const primary = inactive.household.people[0]!
    const primaryAgeAtStart = context.startYear - Number(primary.dob.slice(0, 4))
    const expired = inactive.accounts.find((account) => account.type === 'taxable')!
    expired.contributionSchedule = [
      {
        annualAmount: 12_000,
        fromAge: primaryAgeAtStart - 2,
        toAge: primaryAgeAtStart - 1,
        escalationPct: 0,
      },
    ]
    const noWages = inactive.accounts.find((account) => account.type === 'traditional')!
    noWages.annualContribution = 20_000

    const unavailable = buildScenarioLever(inactive, { id: 'stopContributions' }, context)
    expect(unavailable.ok).toBe(false)
    if (!unavailable.ok) expect(unavailable.issues.join(' ')).toContain('active during the projection')

    expired.contributionSchedule = [
      {
        annualAmount: 12_000,
        fromAge: primaryAgeAtStart,
        toAge: primaryAgeAtStart + 1,
        escalationPct: 0,
      },
    ]
    const available = buildScenarioLever(inactive, { id: 'stopContributions' }, context)
    expect(available.ok).toBe(true)
    if (!available.ok) return
    const applied = applyScenarioPatch(inactive, available.patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    const stopped = applied.plan.accounts.find((account) => account.id === expired.id)
    const clearedWithCoastScenario = applied.plan.accounts.find((account) => account.id === noWages.id)
    expect(stopped).toMatchObject({ annualContribution: 0 })
    expect(stopped && 'contributionSchedule' in stopped ? stopped.contributionSchedule : undefined).toBeUndefined()
    expect(clearedWithCoastScenario).toMatchObject({ annualContribution: 0 })
  })

  it('allocates only eligible accounts that can hold projected assets', () => {
    const plan = buildExampleCouple()
    plan.accounts = [
      {
        type: 'taxable',
        id: 'empty-taxable',
        name: 'Empty taxable',
        ownerPersonId: null,
        annualReturnPct: null,
        balance: 0,
        costBasis: 0,
        annualContribution: 0,
      },
      {
        type: 'roth',
        id: 'empty-roth',
        name: 'Empty Roth',
        ownerPersonId: plan.household.people[0]!.id,
        annualReturnPct: null,
        kind: 'ira',
        balance: 0,
        annualContribution: 0,
      },
    ]
    plan.incomes = []
    plan.insurance = []
    plan.strategies.rothConversion = { mode: 'none' }

    const unavailable = buildScenarioLever(plan, { id: 'allocation', stockPct: 60 }, context)
    expect(unavailable.ok).toBe(false)

    plan.incomes = [
      {
        type: 'oneTime',
        id: 'future-cash',
        label: 'Future cash',
        year: context.startYear + 1,
        amount: 50_000,
        taxTreatment: 'ordinary',
      },
    ]
    const consumed = buildScenarioLever(plan, { id: 'allocation', stockPct: 60 }, context)
    plan.expenses.baseAnnual = 0
    plan.expenses.phases = []
    plan.expenses.oneTimeGoals = []
    plan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 0
    plan.expenses.healthcare.medicareExtrasMonthlyPerPerson = 0
    const available = buildScenarioLever(plan, { id: 'allocation', stockPct: 60 }, context)
    expect(consumed.ok).toBe(false)
    expect(available.ok).toBe(true)
    if (!available.ok) return
    const applied = applyScenarioPatch(plan, available.patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    const taxable = applied.plan.accounts.find((account) => account.id === 'empty-taxable')
    const roth = applied.plan.accounts.find((account) => account.id === 'empty-roth')
    expect(taxable && 'allocation' in taxable ? taxable.allocation : undefined).toBeDefined()
    expect(roth && 'allocation' in roth ? roth.allocation : undefined).toBeDefined()
  })

  it('rejects remaining guaranteed no-op projection levers', () => {
    const homePlan = buildExampleCouple()
    const horizon = Math.max(
      ...homePlan.household.people.map(
        (person) => Number(person.dob.slice(0, 4)) + person.longevity.planningAge,
      ),
    )
    const lateSale = buildScenarioLever(
      homePlan,
      { id: 'homeSale', saleYear: horizon + 1 },
      context,
    )

    const noBenefit = buildExampleCouple()
    for (const income of noBenefit.incomes) {
      if (income.type !== 'socialSecurity') continue
      income.piaMonthly = 0
      income.earnings = null
      income.earningsProjection = null
      income.formerSpouses = []
    }
    const emptyClaim = buildScenarioLever(noBenefit, { id: 'socialSecurityClaim', claimAge: 70 }, context)
    const emptyCut = buildScenarioLever(
      noBenefit,
      { id: 'socialSecurityCut', cutPct: 20, fromYear: context.startYear },
      context,
    )
    const mixedBenefits = buildExampleCouple()
    const mixedStreams = mixedBenefits.incomes.filter((income) => income.type === 'socialSecurity')
    const disability = mixedStreams[0]!
    disability.piaMonthly = 2_000
    disability.disability = { onsetAge: 60 }
    const emptyRetirement = mixedStreams[1]!
    emptyRetirement.piaMonthly = 0
    emptyRetirement.earnings = null
    delete emptyRetirement.disability
    mixedBenefits.incomes = [
      ...mixedBenefits.incomes.filter((income) => income.type !== 'socialSecurity'),
      disability,
      emptyRetirement,
    ]
    const spousalClaim = buildScenarioLever(
      mixedBenefits,
      { id: 'socialSecurityClaim', claimAge: 70 },
      context,
    )

    const noPayout = planWithGuaranteedIncome()
    for (const person of noPayout.household.people) person.longevity.planningAge = 65
    const pension = noPayout.accounts.find((account) => account.type === 'pension')!
    const annuity = noPayout.accounts.find((account) => account.type === 'annuity')!
    pension.startAge = 80
    annuity.startAge = 80
    const latePension = buildScenarioLever(
      noPayout,
      { id: 'pension', monthlyChangePct: 10, startAgeDelta: 0 },
      context,
    )
    const lateAnnuity = buildScenarioLever(
      noPayout,
      { id: 'annuity', monthlyChangePct: 10, startAgeDelta: 0 },
      context,
    )
    pension.monthlyAmount = 0
    annuity.monthlyAmount = 0
    pension.startAge = 65
    annuity.startAge = 65
    const zeroPension = buildScenarioLever(
      noPayout,
      { id: 'pension', monthlyChangePct: 10, startAgeDelta: 0 },
      context,
    )
    const zeroAnnuity = buildScenarioLever(
      noPayout,
      { id: 'annuity', monthlyChangePct: 10, startAgeDelta: 0 },
      context,
    )

    expect(lateSale.ok).toBe(false)
    expect(emptyClaim.ok).toBe(false)
    expect(emptyCut.ok).toBe(false)
    expect(spousalClaim.ok).toBe(true)
    expect(latePension.ok).toBe(false)
    expect(lateAnnuity.ok).toBe(false)
    expect(zeroPension.ok).toBe(false)
    expect(zeroAnnuity.ok).toBe(false)
  })

  it('declares both canonical Social Security haircut patch shapes', () => {
    const rootPlan = buildExampleCouple()
    rootPlan.assumptions.ssHaircut = null
    const root = buildScenarioLever(
      rootPlan,
      { id: 'socialSecurityCut', cutPct: 20, fromYear: context.startYear + 2 },
      context,
    )
    expect(root.ok).toBe(true)
    if (root.ok) expect(root.operationPaths).toEqual(['/assumptions/ssHaircut'])

    const leafPlan = buildExampleCouple()
    leafPlan.assumptions.ssHaircut = { cutPct: 10, fromYear: context.startYear + 1 }
    const leaves = buildScenarioLever(
      leafPlan,
      { id: 'socialSecurityCut', cutPct: 20, fromYear: context.startYear + 2 },
      context,
    )
    expect(leaves.ok).toBe(true)
    if (leaves.ok) {
      expect(leaves.operationPaths).toEqual([
        '/assumptions/ssHaircut/cutPct',
        '/assumptions/ssHaircut/fromYear',
      ])
    }
  })

  it('checks Social Security benefits against their actual payable projection window', () => {
    const plan = buildExampleCouple()
    for (const person of plan.household.people) person.longevity.planningAge = 65
    for (const income of plan.incomes) {
      if (income.type !== 'socialSecurity') continue
      income.piaMonthly = 2_000
      income.earnings = null
      income.claimAge = { years: 70, months: 0 }
      delete income.disability
      income.formerSpouses = []
    }

    const lateClaim = buildScenarioLever(plan, { id: 'socialSecurityClaim', claimAge: 70 }, context)
    const lateCut = buildScenarioLever(
      plan,
      { id: 'socialSecurityCut', cutPct: 20, fromYear: context.startYear },
      context,
    )
    const zeroCash = {
      type: 'cash',
      id: 'ss-cash',
      name: 'SS cash',
      ownerPersonId: null,
      annualReturnPct: null,
      balance: 0,
      annualContribution: 0,
    } as const
    plan.accounts = [zeroCash]
    plan.incomes = plan.incomes.filter((income) => income.type === 'socialSecurity')
    plan.insurance = []
    const lateDefaultReturn = buildScenarioLever(plan, { id: 'defaultReturn', returnPct: 4 }, context)

    expect(lateClaim.ok).toBe(false)
    expect(lateCut.ok).toBe(false)
    expect(lateDefaultReturn.ok).toBe(false)
  })

  it('uses canonical FRA rules to decide whether disability controls claim age', () => {
    const janFirst = buildExampleCouple()
    const janFirstPerson = janFirst.household.people[0]!
    janFirstPerson.dob = '1960-01-01'
    janFirst.incomes = janFirst.incomes.filter(
      (income) => income.type !== 'socialSecurity' || income.personId === janFirstPerson.id,
    )
    const janFirstStream = janFirst.incomes.find((income) => income.type === 'socialSecurity')!
    janFirstStream.piaMonthly = 2_000
    janFirstStream.disability = { onsetAge: 66 }
    janFirstStream.claimAge = { years: 62, months: 0 }
    const normalRetirement = buildScenarioLever(
      janFirst,
      { id: 'socialSecurityClaim', claimAge: 70 },
      context,
    )

    const janSecond = structuredClone(janFirst)
    janSecond.household.people[0]!.dob = '1960-01-02'
    const disability = buildScenarioLever(
      janSecond,
      { id: 'socialSecurityClaim', claimAge: 70 },
      context,
    )

    expect(normalRetirement.ok).toBe(true)
    expect(disability.ok).toBe(false)
    if (!disability.ok) expect(disability.issues.join(' ')).toContain('Disability streams')
  })

  it('preserves the effective pre-projection residence in relocation scenarios', () => {
    const plan = buildExampleCouple()
    plan.household.state = 'CA'
    plan.household.stateMoves = [{ fromYear: 2024, fromMonth: 7, state: 'TX' }]

    const result = buildScenarioLever(
      plan,
      { id: 'relocation', state: 'FL', moveYear: 2030 },
      context,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const applied = applyScenarioPatch(plan, result.patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.plan.household.state).toBe('TX')
    expect(applied.plan.household.stateMoves).toEqual([{ fromYear: 2030, fromMonth: 7, state: 'FL' }])
    expect(result.warnings.join(' ')).not.toContain('replaces the plan')

    const sameState = buildScenarioLever(
      plan,
      { id: 'relocation', state: 'TX', moveYear: 2030 },
      context,
    )
    expect(sameState.ok).toBe(false)
  })

  it('requires a living recipient for survivor-only pension and annuity windows', () => {
    const plan = planWithGuaranteedIncome()
    const pension = plan.accounts.find((account) => account.type === 'pension')!
    const annuity = plan.accounts.find((account) => account.type === 'annuity')!
    const owner = plan.household.people.find((person) => person.id === pension.ownerPersonId)!
    const survivor = plan.household.people.find((person) => person.id !== owner.id)!
    owner.longevity.planningAge = context.startYear - Number(owner.dob.slice(0, 4)) - 1
    survivor.longevity.planningAge = 90
    pension.startAge = 55
    pension.survivorPct = 0
    annuity.startAge = 55
    annuity.payoutForm = { kind: 'lifeOnly' }

    const noPension = buildScenarioLever(
      plan,
      { id: 'pension', monthlyChangePct: 10, startAgeDelta: 0 },
      context,
    )
    const noAnnuity = buildScenarioLever(
      plan,
      { id: 'annuity', monthlyChangePct: 10, startAgeDelta: 0 },
      context,
    )
    expect(noPension.ok).toBe(false)
    expect(noAnnuity.ok).toBe(false)

    pension.survivorPct = 50
    annuity.payoutForm = { kind: 'jointSurvivor', survivorPct: 50 }
    const survivorPension = buildScenarioLever(
      plan,
      { id: 'pension', monthlyChangePct: 10, startAgeDelta: 0 },
      context,
    )
    const survivorAnnuity = buildScenarioLever(
      plan,
      { id: 'annuity', monthlyChangePct: 10, startAgeDelta: 0 },
      context,
    )
    expect(survivorPension.ok).toBe(true)
    expect(survivorAnnuity.ok).toBe(true)
  })

  it.each(['pension', 'annuity'] as const)(
    'compares combined %s amount and start-age changes against the projected payout schedule',
    (id) => {
      const flatPlan = planWithGuaranteedIncome()
      const flatAccount = flatPlan.accounts.find(
        (
          account,
        ): account is Extract<
          Plan['accounts'][number],
          { type: 'pension' | 'annuity' }
        > => account.type === id,
      )!
      flatAccount.startAge = 55
      flatAccount.colaPct = 0
      const flatEquivalent = buildScenarioLever(
        flatPlan,
        { id, monthlyChangePct: 0, startAgeDelta: 1 },
        context,
      )

      const colaPlan = planWithGuaranteedIncome()
      const colaAccount = colaPlan.accounts.find(
        (
          account,
        ): account is Extract<
          Plan['accounts'][number],
          { type: 'pension' | 'annuity' }
        > => account.type === id,
      )!
      colaAccount.startAge = 55
      colaAccount.colaPct = 2
      const combinedEquivalent = buildScenarioLever(
        colaPlan,
        { id, monthlyChangePct: 2, startAgeDelta: 1 },
        context,
      )
      const changed = buildScenarioLever(
        colaPlan,
        { id, monthlyChangePct: 0, startAgeDelta: 1 },
        context,
      )

      expect(flatEquivalent.ok).toBe(false)
      expect(combinedEquivalent.ok).toBe(false)
      expect(changed.ok).toBe(true)
    },
  )

  it('does not fall through from an effective but unpayable SSDI window', () => {
    const plan = buildExampleCouple()
    const person = plan.household.people[0]!
    person.dob = '1964-01-02'
    person.longevity.planningAge = 65
    plan.incomes = plan.incomes.filter(
      (income) => income.type !== 'socialSecurity' || income.personId === person.id,
    )
    const stream = plan.incomes.find((income) => income.type === 'socialSecurity')!
    stream.piaMonthly = 2_000
    stream.claimAge = { years: 62, months: 0 }
    stream.disability = { onsetAge: 66 }

    const result = buildScenarioLever(
      plan,
      { id: 'socialSecurityCut', cutPct: 20, fromYear: context.startYear },
      context,
    )

    expect(result.ok).toBe(false)
  })

  it('requires overlapping spouse claim windows for auxiliary-only Social Security', () => {
    const plan = buildExampleCouple()
    const claimant = plan.household.people[0]!
    const worker = plan.household.people[1]!
    claimant.dob = '1964-01-02'
    claimant.longevity.planningAge = 63
    worker.dob = '1966-01-02'
    worker.longevity.planningAge = 90
    const streams = plan.incomes.filter((income) => income.type === 'socialSecurity')
    const claimantStream = streams.find((income) => income.personId === claimant.id)!
    const workerStream = streams.find((income) => income.personId === worker.id)!
    claimantStream.piaMonthly = 0
    claimantStream.earnings = null
    claimantStream.claimAge = { years: 62, months: 0 }
    claimantStream.formerSpouses = []
    delete claimantStream.disability
    workerStream.piaMonthly = 2_000
    workerStream.earnings = null
    workerStream.claimAge = { years: 70, months: 0 }
    workerStream.formerSpouses = []
    workerStream.disability = { onsetAge: 60 }
    plan.incomes = [
      ...plan.incomes.filter((income) => income.type !== 'socialSecurity'),
      claimantStream,
      workerStream,
    ]

    const result = buildScenarioLever(
      plan,
      { id: 'socialSecurityClaim', claimAge: 62 },
      context,
    )

    expect(result.ok).toBe(false)
  })

  it('keeps survivor-only Social Security claim and cut windows available', () => {
    const plan = buildExampleCouple()
    const worker = plan.household.people[0]!
    const survivor = plan.household.people[1]!
    worker.dob = '1964-01-02'
    worker.longevity.planningAge = 65
    survivor.dob = '1966-01-02'
    survivor.longevity.planningAge = 90
    const streams = plan.incomes.filter((income) => income.type === 'socialSecurity')
    const workerStream = streams.find((income) => income.personId === worker.id)!
    const survivorStream = streams.find((income) => income.personId === survivor.id)!
    workerStream.piaMonthly = 2_000
    workerStream.earnings = null
    workerStream.claimAge = { years: 70, months: 0 }
    workerStream.disability = { onsetAge: 60 }
    survivorStream.piaMonthly = 0
    survivorStream.earnings = null
    survivorStream.claimAge = { years: 62, months: 0 }
    survivorStream.formerSpouses = []
    delete survivorStream.disability
    plan.incomes = [
      ...plan.incomes.filter((income) => income.type !== 'socialSecurity'),
      workerStream,
      survivorStream,
    ]

    const claim = buildScenarioLever(
      plan,
      { id: 'socialSecurityClaim', claimAge: 70 },
      context,
    )
    const cut = buildScenarioLever(
      plan,
      { id: 'socialSecurityCut', cutPct: 20, fromYear: 2036 },
      context,
    )

    expect(claim.ok).toBe(true)
    expect(cut.ok).toBe(true)
  })

  it('anchors purchased period-certain guarantees to nominal annuity start', () => {
    const plan = buildExampleCouple()
    const owner = plan.household.people[0]!
    owner.dob = '1960-01-02'
    owner.longevity.planningAge = 65
    plan.incomes = []
    plan.insurance = []
    plan.accounts = [
      {
        type: 'cash',
        id: 'period-cash',
        name: 'Period cash',
        ownerPersonId: null,
        annualReturnPct: null,
        balance: 0,
        annualContribution: 0,
      },
      {
        type: 'annuity',
        id: 'delayed-period',
        name: 'Delayed period certain',
        ownerPersonId: owner.id,
        annualReturnPct: null,
        startAge: 60,
        monthlyAmount: 2_000,
        colaPct: 0,
        taxablePct: 100,
        payoutForm: { kind: 'periodCertain', certainYears: 10 },
        purchase: {
          year: 2035,
          premium: 0,
          fundingAccountId: 'period-cash',
          taxQualification: 'nonQualified',
        },
      },
    ]

    const result = buildScenarioLever(plan, { id: 'defaultReturn', returnPct: 4 }, context)
    expect(result.ok).toBe(false)
  })

  it('offers Roth-none only for an effective conversion opportunity', () => {
    const expiredManual = buildExampleCouple()
    expiredManual.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: context.startYear - 1, amount: 25_000 }],
    }
    const manualResult = buildScenarioLever(expiredManual, { id: 'rothNone' }, context)

    const expiredFill = buildExampleCouple()
    expiredFill.strategies.rothConversion = {
      mode: 'fillToTarget',
      target: 'fixedMagi',
      targetValue: 150_000,
      startYear: context.startYear - 5,
      endYear: context.startYear - 1,
    }
    const fillResult = buildScenarioLever(expiredFill, { id: 'rothNone' }, context)

    const active = buildExampleCouple()
    active.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: context.startYear, amount: 25_000 }],
    }
    const activeResult = buildScenarioLever(active, { id: 'rothNone' }, context)

    expect(manualResult.ok).toBe(false)
    expect(fillResult.ok).toBe(false)
    expect(activeResult.ok).toBe(true)
  })

  it.each([
    {
      label: 'manual',
      strategy: {
        mode: 'manual' as const,
        conversions: [{ year: context.startYear + 1, amount: 25_000 }],
      },
    },
    {
      label: 'optimized',
      strategy: {
        mode: 'optimized' as const,
        conversions: [{ year: context.startYear + 1, amount: 25_000 }],
        optimizedAtIso: context.createdAtIso,
      },
    },
    {
      label: 'fill-to-target',
      strategy: {
        mode: 'fillToTarget' as const,
        target: 'fixedMagi' as const,
        targetValue: 200_000,
        startYear: context.startYear + 1,
        endYear: context.startYear + 1,
      },
    },
  ])('requires actual current-ledger Roth output for $label Roth-none availability', ({
    strategy,
  }) => {
    const depleted = buildExampleCouple()
    depleted.incomes = []
    depleted.insurance = []
    depleted.careEvents = []
    depleted.expenses.baseAnnual = 70_000
    depleted.expenses.phases = []
    depleted.expenses.oneTimeGoals = []
    depleted.expenses.healthcare.pre65MonthlyPremiumPerPerson = 0
    depleted.expenses.healthcare.medicareExtrasMonthlyPerPerson = 0
    depleted.assumptions.stateEffectiveTaxPct = 20
    const firstTraditional = depleted.accounts.find(
      (account) => account.type === 'traditional',
    )
    for (const account of depleted.accounts) {
      if (account.type !== 'traditional') continue
      account.balance = account === firstTraditional ? 80_000 : 0
      account.annualContribution = 0
      delete account.contributionSchedule
    }
    depleted.accounts = depleted.accounts.filter(
      (account) => account.type === 'traditional' || account.type === 'roth',
    )
    const roth = depleted.accounts.find((account) => account.type === 'roth')!
    roth.balance = 0
    roth.annualContribution = 0
    depleted.strategies.rothConversion = strategy

    const positive = structuredClone(depleted)
    positive.expenses.baseAnnual = 0
    const zeroOutput = buildScenarioLever(depleted, { id: 'rothNone' }, context)
    const positiveOutput = buildScenarioLever(positive, { id: 'rothNone' }, context)

    expect(zeroOutput.ok).toBe(false)
    expect(positiveOutput.ok).toBe(true)
  })

  it('requires a modeled survivor-only calendar year for survivor spending', () => {
    const sameLastAliveYear = buildExampleCouple()
    const [first, second] = sameLastAliveYear.household.people
    second!.longevity.planningAge =
      Number(first!.dob.slice(0, 4)) +
      first!.longevity.planningAge -
      Number(second!.dob.slice(0, 4))

    const unavailable = buildScenarioLever(
      sameLastAliveYear,
      { id: 'survivorSpending', percent: 70 },
      context,
    )
    const available = buildScenarioLever(
      buildExampleCouple(),
      { id: 'survivorSpending', percent: 70 },
      context,
    )

    expect(unavailable.ok).toBe(false)
    if (!unavailable.ok) expect(unavailable.issues.join(' ')).toContain('survivor-only year')
    expect(available.ok).toBe(true)
  })

  it('normalizes Social Security cut schedules at the projection boundary', () => {
    const equivalent = buildExampleCouple()
    equivalent.assumptions.ssHaircut = { cutPct: 20, fromYear: context.startYear - 5 }
    const equivalentResult = buildScenarioLever(
      equivalent,
      { id: 'socialSecurityCut', cutPct: 20, fromYear: context.startYear - 1 },
      context,
    )

    const changed = buildExampleCouple()
    changed.assumptions.ssHaircut = { cutPct: 20, fromYear: context.startYear + 2 }
    const changedResult = buildScenarioLever(
      changed,
      { id: 'socialSecurityCut', cutPct: 20, fromYear: context.startYear + 3 },
      context,
    )

    expect(equivalentResult.ok).toBe(false)
    if (!equivalentResult.ok) expect(equivalentResult.issues.join(' ')).toContain('same effective')
    expect(changedResult.ok).toBe(false)
    if (!changedResult.ok) expect(changedResult.issues.join(' ')).toContain('same effective')
  })

  it('allows a zero-percent Social Security cut to remove an effective haircut', () => {
    const plan = buildExampleCouple()
    plan.assumptions.ssHaircut = { cutPct: 100, fromYear: context.startYear }

    const result = buildScenarioLever(
      plan,
      { id: 'socialSecurityCut', cutPct: 0, fromYear: 2200 },
      context,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const applied = applyScenarioPatch(plan, result.patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.plan.assumptions.ssHaircut).toBeNull()
    expect(result.operationPaths).toEqual(['/assumptions/ssHaircut'])
  })

  it('recognizes an elected pension rollover as a Roth conversion source', () => {
    const plan = planWithGuaranteedIncome()
    for (const account of plan.accounts) {
      if (account.type !== 'traditional') continue
      account.balance = 0
      account.annualContribution = 0
      account.contributionSchedule = undefined
    }
    const rollover = plan.accounts.find((account) => account.type === 'traditional')!
    const pension = plan.accounts.find((account) => account.type === 'pension')!
    pension.lumpSumOffer = { amount: 250_000, electionYear: context.startYear }
    pension.lumpSumElection = { rolloverAccountId: rollover.id }

    const result = buildScenarioLever(
      plan,
      {
        id: 'rothSchedule',
        annualAmount: 25_000,
        startYear: context.startYear,
        endYear: context.startYear,
      },
      context,
    )

    expect(result.ok).toBe(true)
  })

  it('keeps effective pre-FRA SSDI claim ages available for former-spouse benefits', () => {
    const plan = buildExampleCouple()
    const stream = plan.incomes.find((income) => income.type === 'socialSecurity')!
    stream.claimAge = { years: 62, months: 0 }
    stream.disability = { onsetAge: 60 }
    stream.formerSpouses = [
      {
        id: 'former-spouse',
        relationship: 'deceased',
        dob: '1955-01-02',
        piaMonthly: 3_000,
        marriageYears: 12,
        remarriedAtAge: 60,
      },
    ]

    const result = buildScenarioLever(
      plan,
      { id: 'socialSecurityClaim', claimAge: 70 },
      context,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const applied = applyScenarioPatch(plan, result.patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    const changed = applied.plan.incomes.find((income) => income.id === stream.id)
    expect(changed?.type === 'socialSecurity' ? changed.claimAge : undefined).toEqual({
      years: 70,
      months: 0,
    })
  })

  it('rejects projection-equivalent post-FRA former-spouse SSDI claim changes', () => {
    const plan = buildExampleCouple()
    const stream = plan.incomes.find((income) => income.type === 'socialSecurity')!
    plan.incomes = [stream]
    stream.piaMonthly = 2_000
    stream.earnings = null
    stream.claimAge = { years: 67, months: 0 }
    stream.disability = { onsetAge: 60 }
    stream.formerSpouses = [
      {
        id: 'deceased-former-spouse',
        relationship: 'deceased',
        dob: '1955-01-02',
        piaMonthly: 8_000,
        marriageYears: 12,
        remarriedAtAge: 60,
      },
    ]
    const lateContext = { ...context, startYear: 2040 }

    const equivalent = buildScenarioLever(
      plan,
      { id: 'socialSecurityClaim', claimAge: 70 },
      lateContext,
    )
    stream.claimAge = { years: 62, months: 0 }
    const factorChange = buildScenarioLever(
      plan,
      { id: 'socialSecurityClaim', claimAge: 67 },
      lateContext,
    )

    expect(equivalent.ok).toBe(false)
    expect(factorChange.ok).toBe(true)
  })

  it('rejects projection-equivalent post-FRA current-spouse SSDI claim changes', () => {
    const plan = buildExampleCouple()
    const streams = plan.incomes.filter((income) => income.type === 'socialSecurity')
    const claimant = streams[0]!
    const spouse = streams[1]!
    plan.incomes = streams
    claimant.piaMonthly = 2_000
    claimant.earnings = null
    claimant.claimAge = { years: 67, months: 0 }
    claimant.disability = { onsetAge: 60 }
    claimant.formerSpouses = []
    spouse.piaMonthly = 8_000
    spouse.earnings = null
    spouse.claimAge = { years: 70, months: 0 }
    delete spouse.disability
    spouse.formerSpouses = []

    const result = buildScenarioLever(
      plan,
      { id: 'socialSecurityClaim', claimAge: 70 },
      { ...context, startYear: 2040 },
    )

    expect(result.ok).toBe(false)
  })

  it('preserves delayed-retirement factor changes for non-disability own benefits', () => {
    const plan = buildExampleCouple()
    const stream = plan.incomes.find((income) => income.type === 'socialSecurity')!
    plan.incomes = [stream]
    stream.piaMonthly = 2_000
    stream.earnings = null
    stream.claimAge = { years: 67, months: 0 }
    delete stream.disability
    stream.formerSpouses = []

    const result = buildScenarioLever(
      plan,
      { id: 'socialSecurityClaim', claimAge: 70 },
      { ...context, startYear: 2040 },
    )

    expect(result.ok).toBe(true)
  })

  it('changes pre-start annuity purchases but excludes purchases at projection start', () => {
    const plan = planWithGuaranteedIncome()
    const owned = plan.accounts.find((account) => account.type === 'annuity')!
    const funding = plan.accounts.find((account) => account.type === 'taxable')!
    owned.purchase = {
      year: context.startYear - 1,
      premium: 100_000,
      fundingAccountId: funding.id,
      taxQualification: 'nonQualified',
    }
    plan.accounts.push({
      ...owned,
      id: 'start-year-annuity',
      name: 'Start-year annuity',
      purchase: {
        ...owned.purchase,
        year: context.startYear,
      },
    })

    const result = buildScenarioLever(
      plan,
      { id: 'annuity', monthlyChangePct: 10, startAgeDelta: 1 },
      context,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.name).toContain('owned at projection start')
    const applied = applyScenarioPatch(plan, result.patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.plan.accounts.find((account) => account.id === owned.id)).toMatchObject({
      startAge: owned.startAge + 1,
      monthlyAmount: owned.monthlyAmount * 1.1,
    })
    expect(applied.plan.accounts.find((account) => account.id === 'start-year-annuity')).toEqual(
      plan.accounts.find((account) => account.id === 'start-year-annuity'),
    )
  })

  it('keeps auxiliary claim-age levers available for SSDI streams without an own benefit', () => {
    const currentSpousePlan = buildExampleCouple()
    const currentSpouseStream = currentSpousePlan.incomes.find(
      (income) => income.type === 'socialSecurity',
    )!
    currentSpouseStream.piaMonthly = null
    currentSpouseStream.earnings = null
    currentSpouseStream.claimAge = { years: 62, months: 0 }
    currentSpouseStream.disability = { onsetAge: 60 }
    currentSpouseStream.formerSpouses = []
    const currentSpouseClaim = buildScenarioLever(
      currentSpousePlan,
      { id: 'socialSecurityClaim', claimAge: 70 },
      context,
    )
    const currentSpouseCut = buildScenarioLever(
      currentSpousePlan,
      { id: 'socialSecurityCut', cutPct: 20, fromYear: context.startYear },
      context,
    )

    const formerSpousePlan = buildExampleCouple()
    const formerSpouseStream = formerSpousePlan.incomes.find(
      (income) => income.type === 'socialSecurity',
    )!
    formerSpousePlan.incomes = formerSpousePlan.incomes.filter(
      (income) => income.type !== 'socialSecurity' || income.id === formerSpouseStream.id,
    )
    formerSpouseStream.piaMonthly = null
    formerSpouseStream.earnings = null
    formerSpouseStream.claimAge = { years: 62, months: 0 }
    formerSpouseStream.disability = { onsetAge: 60 }
    formerSpouseStream.formerSpouses = [
      {
        id: 'deceased-former-spouse',
        relationship: 'deceased',
        dob: '1955-01-02',
        piaMonthly: 3_000,
        marriageYears: 12,
        remarriedAtAge: 60,
      },
    ]
    const formerSpouseClaim = buildScenarioLever(
      formerSpousePlan,
      { id: 'socialSecurityClaim', claimAge: 70 },
      context,
    )
    const formerSpouseCut = buildScenarioLever(
      formerSpousePlan,
      { id: 'socialSecurityCut', cutPct: 20, fromYear: context.startYear },
      context,
    )

    expect(currentSpouseClaim.ok).toBe(true)
    expect(currentSpouseCut.ok).toBe(true)
    expect(formerSpouseClaim.ok).toBe(true)
    expect(formerSpouseCut.ok).toBe(true)
  })

  it('ignores inherited-account contribution fields in coast scenarios', () => {
    const plan = buildExampleCouple()
    plan.incomes = plan.incomes.filter((income) => income.type !== 'wages')
    for (const account of plan.accounts) {
      if (!('annualContribution' in account)) continue
      account.annualContribution = 0
      delete account.contributionSchedule
    }
    const inherited = plan.accounts.find(
      (
        account,
      ): account is Extract<Plan['accounts'][number], { type: 'traditional' }> =>
        account.type === 'traditional' && account.kind === 'ira',
    )!
    const owner = plan.household.people.find((person) => person.id === inherited.ownerPersonId)!
    const ageAtStart = context.startYear - Number(owner.dob.slice(0, 4))
    inherited.inherited = { ownerDeathYear: 2024, decedentHadStartedRmds: true }
    inherited.annualContribution = 15_000
    inherited.contributionSchedule = [
      {
        annualAmount: 15_000,
        fromAge: ageAtStart,
        toAge: ageAtStart + 2,
        escalationPct: 0,
      },
    ]

    const unavailable = buildScenarioLever(plan, { id: 'stopContributions' }, context)
    expect(unavailable.ok).toBe(false)

    const taxable = plan.accounts.find((account) => account.type === 'taxable')!
    taxable.contributionSchedule = [
      {
        annualAmount: 10_000,
        fromAge: ageAtStart,
        toAge: ageAtStart + 2,
        escalationPct: 0,
      },
    ]
    const available = buildScenarioLever(plan, { id: 'stopContributions' }, context)
    expect(available.ok).toBe(true)
    if (!available.ok) return
    const applied = applyScenarioPatch(plan, available.patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.plan.accounts.find((account) => account.id === inherited.id)).toEqual(inherited)
  })

  it('requires positive property value before sale proceeds fund a fallback-return account', () => {
    const plan = buildExampleCouple()
    const cash = plan.accounts.find((account) => account.type === 'cash')!
    cash.balance = 0
    cash.annualContribution = 0
    cash.annualReturnPct = null
    const property = plan.accounts.find((account) => account.type === 'property')!
    property.value = 0
    property.plannedSaleYear = context.startYear + 1
    property.expectedNetProceeds = 250_000
    plan.accounts = [cash, property]
    plan.incomes = []
    plan.insurance = []
    plan.strategies.rothConversion = { mode: 'none' }

    const unavailable = buildScenarioLever(
      plan,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )
    property.value = 300_000
    const available = buildScenarioLever(
      plan,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )

    expect(unavailable.ok).toBe(false)
    expect(available.ok).toBe(true)
  })

  it('offers Roth-none for an active optimized conversion schedule', () => {
    const plan = buildExampleCouple()
    plan.strategies.rothConversion = {
      mode: 'optimized',
      conversions: [
        { year: context.startYear - 1, amount: 25_000 },
        { year: context.startYear, amount: 30_000 },
      ],
      optimizedAtIso: context.createdAtIso,
    }

    const result = buildScenarioLever(plan, { id: 'rothNone' }, context)

    expect(result.ok).toBe(true)
  })

  it('counts permanent-life proceeds only when settlement occurs during the projection', () => {
    const plan = buildExampleCouple()
    const cash = plan.accounts.find((account) => account.type === 'cash')!
    cash.balance = 0
    cash.annualContribution = 0
    cash.annualReturnPct = null
    plan.accounts = [cash]
    plan.incomes = []
    plan.insurance = plan.insurance.filter((policy) => policy.kind === 'permanentLife')
    plan.strategies.rothConversion = { mode: 'none' }
    const policy = plan.insurance.find((candidate) => candidate.kind === 'permanentLife')!
    const insured = plan.household.people.find((person) => person.id === policy.insured)!
    const birthYear = Number(insured.dob.slice(0, 4))
    insured.longevity.planningAge = context.startYear - birthYear - 1

    const settledBeforeProjection = buildScenarioLever(
      plan,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )
    insured.longevity.planningAge = context.startYear - birthYear
    const settlesDuringProjection = buildScenarioLever(
      plan,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )

    expect(settledBeforeProjection.ok).toBe(false)
    expect(settlesDuringProjection.ok).toBe(true)
  })

  it('counts scheduled permanent-life cash value that becomes positive before settlement', () => {
    const plan = buildExampleCouple()
    const cash = plan.accounts.find((account) => account.type === 'cash')!
    cash.balance = 0
    cash.annualContribution = 0
    cash.annualReturnPct = null
    plan.accounts = [cash]
    plan.incomes = []
    plan.insurance = plan.insurance.filter((policy) => policy.kind === 'permanentLife')
    plan.strategies.rothConversion = { mode: 'none' }
    const policy = plan.insurance.find((candidate) => candidate.kind === 'permanentLife')!
    const insured = plan.household.people.find((person) => person.id === policy.insured)!
    const ageAtStart = context.startYear - Number(insured.dob.slice(0, 4))
    insured.longevity.planningAge = ageAtStart + 2
    policy.deathBenefit = 0
    policy.cashValue = 0
    policy.cashValueMode = 'schedule'
    policy.cashValueGrowthPct = undefined
    policy.cashValueSchedule = [
      { age: ageAtStart, value: 0 },
      { age: ageAtStart + 1, value: 25_000 },
    ]

    const scheduledValue = buildScenarioLever(
      plan,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )
    policy.cashValueSchedule[1]!.value = 0
    const noScheduledValue = buildScenarioLever(
      plan,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )

    expect(scheduledValue.ok).toBe(true)
    expect(noScheduledValue.ok).toBe(false)
  })

  it('treats pre-start TIPS purchases as owned and requires future purchases to be fully funded', () => {
    const plan = buildExampleCouple()
    const cash = plan.accounts.find((account) => account.type === 'cash')!
    cash.balance = 0
    cash.annualContribution = 0
    cash.annualReturnPct = null
    const funding = plan.accounts.find((account) => account.type === 'taxable')!
    funding.balance = 0
    funding.annualContribution = 0
    funding.annualReturnPct = 3
    plan.accounts = [cash, funding]
    plan.incomes = []
    plan.insurance = []
    plan.strategies.rothConversion = { mode: 'none' }
    plan.expenses.baseAnnual = 0
    plan.expenses.phases = []
    plan.expenses.oneTimeGoals = []
    plan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 0
    plan.expenses.healthcare.medicareExtrasMonthlyPerPerson = 0
    plan.incomeFloor = {
      ladders: [
        {
          id: 'purchased-ladder',
          name: 'Purchased ladder',
          purpose: 'bridge',
          startYear: context.startYear + 1,
          endYear: context.startYear + 4,
          annualRealAmount: 30_000,
          purchase: {
            year: context.startYear - 1,
            fundingAccountId: funding.id,
          },
        },
      ],
    }

    const owned = buildScenarioLever(
      plan,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )
    plan.incomeFloor.ladders[0]!.purchase!.year = context.startYear
    const needsFunding = buildScenarioLever(
      plan,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )
    funding.balance = 10_000_000
    const fundedPurchase = buildScenarioLever(
      plan,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )

    expect(owned.ok).toBe(true)
    expect(needsFunding.ok).toBe(false)
    expect(fundedPurchase.ok).toBe(true)
  })

  it('honors an explicit zero PIA instead of falling back to earnings', () => {
    const plan = buildExampleCouple()
    const stream = plan.incomes.find((income) => income.type === 'socialSecurity')!
    plan.incomes = [stream]
    stream.piaMonthly = 0
    stream.earnings = Array.from({ length: 35 }, (_, index) => ({
      year: 1990 + index,
      amount: 100_000,
    }))
    stream.formerSpouses = []
    delete stream.disability

    const explicitZeroClaim = buildScenarioLever(
      plan,
      { id: 'socialSecurityClaim', claimAge: 62 },
      context,
    )
    const explicitZeroCut = buildScenarioLever(
      plan,
      { id: 'socialSecurityCut', cutPct: 20, fromYear: context.startYear },
      context,
    )
    stream.piaMonthly = null
    const earningsClaim = buildScenarioLever(
      plan,
      { id: 'socialSecurityClaim', claimAge: 62 },
      context,
    )
    const earningsCut = buildScenarioLever(
      plan,
      { id: 'socialSecurityCut', cutPct: 20, fromYear: context.startYear },
      context,
    )

    expect(explicitZeroClaim.ok).toBe(false)
    expect(explicitZeroCut.ok).toBe(false)
    expect(earningsClaim.ok).toBe(true)
    expect(earningsCut.ok).toBe(true)
  })

  it('rejects survivor scaling when no annual lifestyle spending is modeled', () => {
    const plan = buildExampleCouple()
    plan.expenses.baseAnnual = 0
    plan.expenses.idealAnnual = 0
    plan.expenses.excessAnnual = 0

    const unavailable = buildScenarioLever(
      plan,
      { id: 'survivorSpending', percent: 70 },
      context,
    )
    plan.expenses.idealAnnual = 1
    const available = buildScenarioLever(
      plan,
      { id: 'survivorSpending', percent: 70 },
      context,
    )

    expect(unavailable.ok).toBe(false)
    if (!unavailable.ok) expect(unavailable.issues.join(' ')).toContain('annual lifestyle spending')
    expect(available.ok).toBe(true)
  })

  it('requires a shifted retirement boundary to overlap the active projection', () => {
    const plan = buildExampleCouple()
    for (const person of plan.household.people) {
      person.retirementAge = context.startYear - Number(person.dob.slice(0, 4)) - 2
    }
    const expired = buildScenarioLever(
      plan,
      { id: 'retirementAge', yearsDelta: 1 },
      context,
    )

    plan.household.people[0]!.retirementAge =
      context.startYear - Number(plan.household.people[0]!.dob.slice(0, 4))
    const active = buildScenarioLever(
      plan,
      { id: 'retirementAge', yearsDelta: 1 },
      context,
    )

    expect(expired.ok).toBe(false)
    if (!expired.ok) expect(expired.issues.join(' ')).toContain('active projection')
    expect(active.ok).toBe(true)
  })

  it('declares only relocation paths reachable from the fast lever', () => {
    const relocation = SCENARIO_LEVER_DEFINITIONS.find(
      (definition) => definition.id === 'relocation',
    )!

    expect(relocation.declaredPaths).not.toContain('/expenses/baseAnnual')
    expect(relocation.declaredPaths).toEqual([
      '/assumptions/localIncomeTaxPct',
      '/assumptions/stateEffectiveTaxPct',
      '/household/state',
      '/household/stateMoves',
    ])
  })

  it('includes final-horizon inflows that receive same-year growth', () => {
    const plan = buildExampleCouple()
    const horizon = context.startYear + 2
    for (const person of plan.household.people) {
      person.longevity.planningAge = horizon - Number(person.dob.slice(0, 4))
    }
    plan.accounts = [
      {
        type: 'taxable',
        id: 'future-deposit-target',
        name: 'Future deposit target',
        ownerPersonId: null,
        annualReturnPct: null,
        balance: 0,
        costBasis: 0,
        annualContribution: 0,
      },
    ]
    plan.incomes = [
      {
        type: 'oneTime',
        id: 'final-year-cash',
        label: 'Final-year cash',
        year: horizon,
        amount: 100_000,
        taxTreatment: 'none',
      },
    ]
    plan.insurance = []
    plan.strategies.rothConversion = { mode: 'none' }
    plan.expenses.baseAnnual = 0
    plan.expenses.phases = []
    plan.expenses.oneTimeGoals = []
    plan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 0
    plan.expenses.healthcare.medicareExtrasMonthlyPerPerson = 0

    const finalReturn = buildScenarioLever(
      plan,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )
    const finalAllocation = buildScenarioLever(
      plan,
      { id: 'allocation', stockPct: 60 },
      context,
    )
    const oneYearEarlier = plan.incomes[0]!
    if (oneYearEarlier.type === 'oneTime') oneYearEarlier.year = horizon - 1
    const activeReturn = buildScenarioLever(
      plan,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )
    const activeAllocation = buildScenarioLever(
      plan,
      { id: 'allocation', stockPct: 60 },
      context,
    )

    expect(finalReturn.ok).toBe(true)
    expect(finalAllocation.ok).toBe(true)
    expect(activeReturn.ok).toBe(true)
    expect(activeAllocation.ok).toBe(true)
  })

  it('includes horizon-year contributions, rollovers, and Roth conversions in allocation availability', () => {
    const contributionPlan = buildExampleCouple()
    const horizon = context.startYear + 2
    for (const person of contributionPlan.household.people) {
      person.longevity.planningAge = horizon - Number(person.dob.slice(0, 4))
    }
    const contributionTarget = contributionPlan.accounts.find(
      (account) => account.type === 'taxable',
    )!
    const owner = contributionPlan.household.people[0]!
    contributionTarget.balance = 0
    contributionTarget.annualContribution = 0
    contributionTarget.annualReturnPct = null
    contributionTarget.contributionSchedule = [
      {
        annualAmount: 25_000,
        fromAge: horizon - Number(owner.dob.slice(0, 4)),
        toAge: horizon - Number(owner.dob.slice(0, 4)),
        escalationPct: 0,
      },
    ]
    contributionPlan.accounts = [contributionTarget]
    contributionPlan.incomes = []
    contributionPlan.insurance = []
    contributionPlan.strategies.rothConversion = { mode: 'none' }

    const contributionReturn = buildScenarioLever(
      contributionPlan,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )
    const contributionAllocation = buildScenarioLever(
      contributionPlan,
      { id: 'allocation', stockPct: 60 },
      context,
    )

    const rolloverPlan = planWithGuaranteedIncome()
    for (const person of rolloverPlan.household.people) {
      person.longevity.planningAge = horizon - Number(person.dob.slice(0, 4))
    }
    const rolloverTarget = rolloverPlan.accounts.find(
      (account) => account.type === 'traditional',
    )!
    rolloverTarget.balance = 0
    rolloverTarget.annualContribution = 0
    rolloverTarget.contributionSchedule = undefined
    const pension = rolloverPlan.accounts.find((account) => account.type === 'pension')!
    pension.lumpSumOffer = { amount: 250_000, electionYear: horizon }
    pension.lumpSumElection = { rolloverAccountId: rolloverTarget.id }
    rolloverPlan.accounts = [rolloverTarget, pension]
    rolloverPlan.incomes = []
    rolloverPlan.insurance = []
    rolloverPlan.strategies.rothConversion = { mode: 'none' }
    const rolloverAllocation = buildScenarioLever(
      rolloverPlan,
      { id: 'allocation', stockPct: 60 },
      context,
    )

    const conversionPlan = buildExampleCouple()
    for (const person of conversionPlan.household.people) {
      person.longevity.planningAge = horizon - Number(person.dob.slice(0, 4))
    }
    const source = conversionPlan.accounts.find((account) => account.type === 'traditional')!
    source.allocation = {
      mode: 'static',
      rebalancing: 'annual',
      weights: { usStocks: 45, intlStocks: 15, bonds: 40, cash: 0 },
    }
    const destination = conversionPlan.accounts.find((account) => account.type === 'roth')!
    destination.balance = 0
    destination.annualContribution = 0
    destination.contributionSchedule = undefined
    destination.allocation = undefined
    conversionPlan.accounts = [source, destination]
    conversionPlan.incomes = []
    conversionPlan.insurance = []
    conversionPlan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: horizon, amount: 25_000 }],
    }
    const conversionAllocation = buildScenarioLever(
      conversionPlan,
      { id: 'allocation', stockPct: 60 },
      context,
    )

    expect(contributionReturn.ok).toBe(true)
    expect(contributionAllocation.ok).toBe(true)
    expect(rolloverAllocation.ok).toBe(true)
    expect(conversionAllocation.ok).toBe(true)
  })

  it('requires the changed allocation to belong to an account with projected assets', () => {
    const plan = buildExampleCouple()
    const funded = plan.accounts.find((account) => account.type === 'taxable')!
    funded.allocation = {
      mode: 'static',
      rebalancing: 'annual',
      weights: { usStocks: 45, intlStocks: 15, bonds: 40, cash: 0 },
    }
    const empty = {
      ...funded,
      id: 'empty-taxable',
      name: 'Empty taxable',
      balance: 0,
      costBasis: 0,
      annualContribution: 0,
      contributionSchedule: undefined,
      allocation: undefined,
    }
    plan.accounts = [funded, empty]
    plan.incomes = []
    plan.insurance = []
    plan.strategies.rothConversion = { mode: 'none' }

    const emptyOnlyChange = buildScenarioLever(
      plan,
      { id: 'allocation', stockPct: 60 },
      context,
    )
    const fundedChange = buildScenarioLever(
      plan,
      { id: 'allocation', stockPct: 50 },
      context,
    )

    expect(emptyOnlyChange.ok).toBe(false)
    expect(fundedChange.ok).toBe(true)
  })

  it('requires one Social Security stream to both change and affect the projection', () => {
    const plan = buildExampleCouple()
    const streams = plan.incomes.filter((income) => income.type === 'socialSecurity')
    const effective = streams[0]!
    const inert = streams[1]!
    effective.claimAge = { years: 70, months: 0 }
    effective.piaMonthly = 2_000
    inert.claimAge = { years: 62, months: 0 }
    inert.piaMonthly = 0
    inert.earnings = null
    inert.formerSpouses = []
    const inertPerson = plan.household.people.find((person) => person.id === inert.personId)!
    inertPerson.longevity.planningAge = 65

    const unrelatedChange = buildScenarioLever(
      plan,
      { id: 'socialSecurityClaim', claimAge: 70 },
      context,
    )
    effective.claimAge = { years: 67, months: 0 }
    const effectiveChange = buildScenarioLever(
      plan,
      { id: 'socialSecurityClaim', claimAge: 70 },
      context,
    )

    expect(unrelatedChange.ok).toBe(false)
    expect(effectiveChange.ok).toBe(true)
  })

  it('rejects a zero-value property sale without another modeled sale effect', () => {
    const plan = buildExampleCouple()
    const property = plan.accounts.find((account) => account.type === 'property')!
    property.value = 0
    property.expectedNetProceeds = 250_000
    property.propertyTaxAnnual = 0
    property.insuranceAnnual = 0
    delete property.hecm

    const inert = buildScenarioLever(
      plan,
      { id: 'homeSale', saleYear: context.startYear + 2 },
      context,
    )
    property.propertyTaxAnnual = 1_000
    const carryingCost = buildScenarioLever(
      plan,
      { id: 'homeSale', saleYear: context.startYear + 2 },
      context,
    )

    expect(inert.ok).toBe(false)
    if (!inert.ok) expect(inert.issues.join(' ')).toContain('zero-value property')
    expect(carryingCost.ok).toBe(true)
  })

  it('ignores properties sold before the projection when selecting a home sale', () => {
    const plan = buildExampleCouple()
    const active = plan.accounts.find((account) => account.type === 'property')!
    const expired = {
      ...active,
      id: 'expired-property',
      name: 'Previously sold home',
      plannedSaleYear: context.startYear - 1,
    }
    plan.accounts.push(expired)

    const automatic = buildScenarioLever(
      plan,
      { id: 'homeSale', saleYear: context.startYear + 2 },
      context,
    )
    const explicitExpired = buildScenarioLever(
      plan,
      {
        id: 'homeSale',
        propertyId: expired.id,
        saleYear: context.startYear + 2,
      },
      context,
    )

    expect(automatic.ok).toBe(true)
    if (automatic.ok) {
      const applied = applyScenarioPatch(plan, automatic.patch)
      expect(applied.ok).toBe(true)
      if (applied.ok) {
        const activeAfter = applied.plan.accounts.find((account) => account.id === active.id)
        expect(activeAfter?.type === 'property' ? activeAfter.plannedSaleYear : null).toBe(
          context.startYear + 2,
        )
      }
    }
    expect(explicitExpired.ok).toBe(false)
    if (!explicitExpired.ok) expect(explicitExpired.issues.join(' ')).toContain('cannot be sold again')
  })

  it('uses the exact-tax property path when deciding whether a sale can fund returns', () => {
    const plan = buildExampleCouple()
    const cash = plan.accounts.find((account) => account.type === 'cash')!
    cash.balance = 0
    cash.annualContribution = 0
    cash.annualReturnPct = null
    const property = plan.accounts.find((account) => account.type === 'property')!
    property.value = 300_000
    property.plannedSaleYear = context.startYear + 1
    property.expectedNetProceeds = 0
    property.costBasis = 200_000
    plan.accounts = [cash, property]
    plan.incomes = []
    plan.insurance = []
    plan.strategies.rothConversion = { mode: 'none' }

    const exactTaxSale = buildScenarioLever(
      plan,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )
    delete property.costBasis
    const zeroLegacyProceeds = buildScenarioLever(
      plan,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )

    expect(exactTaxSale.ok).toBe(true)
    expect(zeroLegacyProceeds.ok).toBe(false)
  })

  it.each([
    { label: 'exact', costBasis: 200_000, expectedNetProceeds: 0 },
    { label: 'legacy', costBasis: undefined, expectedNetProceeds: 200_000 },
  ])('does not treat a fully HECM-encumbered $label sale as a general deposit', ({
    costBasis,
    expectedNetProceeds,
  }) => {
    const plan = buildExampleCouple()
    const cash = plan.accounts.find((account) => account.type === 'cash')!
    cash.balance = 0
    cash.annualContribution = 0
    cash.annualReturnPct = null
    const property = plan.accounts.find((account) => account.type === 'property')!
    property.value = 300_000
    property.plannedSaleYear = context.startYear + 1
    property.expectedNetProceeds = expectedNetProceeds
    property.costBasis = costBasis
    property.sellingCostPct = costBasis === undefined ? 0 : 25
    property.primaryResidence = true
    property.hecm = {
      openYear: context.startYear,
      principalLimitPct: 75,
      growthRatePct: 7,
      upfrontCostPct: 10,
      drawPolicy: 'lastResort',
    }
    plan.accounts = [cash, property]
    plan.incomes = []
    plan.insurance = []
    plan.expenses.baseAnnual = 0
    plan.expenses.phases = []
    plan.expenses.oneTimeGoals = [
      {
        id: 'hecm-draw-goal',
        label: 'HECM draw',
        year: context.startYear,
        amount: 500_000,
      },
    ]
    plan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 0
    plan.expenses.healthcare.medicareExtrasMonthlyPerPerson = 0
    plan.strategies.rothConversion = { mode: 'none' }

    const encumbered = buildScenarioLever(
      plan,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )
    delete property.hecm
    const unencumbered = buildScenarioLever(
      plan,
      { id: 'defaultReturn', returnPct: 4 },
      context,
    )

    expect(encumbered.ok).toBe(false)
    expect(unencumbered.ok).toBe(true)
  })

  it('preserves each account stock-region split when changing total stocks', () => {
    const plan = buildExampleCouple()
    const taxable = plan.accounts.find((account) => account.type === 'taxable')!
    taxable.allocation = {
      mode: 'static',
      rebalancing: 'annual',
      weights: { usStocks: 20, intlStocks: 60, bonds: 20, cash: 0 },
    }
    const roth = plan.accounts.find((account) => account.type === 'roth')!
    roth.allocation = {
      mode: 'static',
      rebalancing: 'annual',
      weights: { usStocks: 0, intlStocks: 0, bonds: 100, cash: 0 },
    }

    const result = buildScenarioLever(
      plan,
      { id: 'allocation', stockPct: 50 },
      context,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const applied = applyScenarioPatch(plan, result.patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    const taxableAfter = applied.plan.accounts.find((account) => account.id === taxable.id)
    const rothAfter = applied.plan.accounts.find((account) => account.id === roth.id)
    expect(taxableAfter && 'allocation' in taxableAfter ? taxableAfter.allocation : undefined).toMatchObject({
      weights: { usStocks: 12.5, intlStocks: 37.5, bonds: 50, cash: 0 },
    })
    expect(rothAfter && 'allocation' in rothAfter ? rothAfter.allocation : undefined).toMatchObject({
      weights: { usStocks: 37.5, intlStocks: 12.5, bonds: 50, cash: 0 },
    })
  })

  it('preserves each existing allocation rebalancing policy and defaults only unallocated accounts', () => {
    const plan = buildExampleCouple()
    const taxable = plan.accounts.find((account) => account.type === 'taxable')!
    taxable.allocation = {
      mode: 'linear',
      rebalancing: 'none',
      from: { usStocks: 60, intlStocks: 20, bonds: 20, cash: 0 },
      to: { usStocks: 30, intlStocks: 10, bonds: 60, cash: 0 },
      startYear: context.startYear,
      endYear: context.startYear + 10,
    }
    const roth = plan.accounts.find((account) => account.type === 'roth')!
    roth.allocation = undefined

    const result = buildScenarioLever(
      plan,
      { id: 'allocation', stockPct: 50 },
      context,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const applied = applyScenarioPatch(plan, result.patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    const taxableAfter = applied.plan.accounts.find((account) => account.id === taxable.id)
    const rothAfter = applied.plan.accounts.find((account) => account.id === roth.id)
    expect(taxableAfter && 'allocation' in taxableAfter ? taxableAfter.allocation?.rebalancing : undefined).toBe(
      'none',
    )
    expect(rothAfter && 'allocation' in rothAfter ? rothAfter.allocation?.rebalancing : undefined).toBe(
      'annual',
    )
  })

  it('recognizes pre-projection SSA-44 retirement relief as a retirement-age effect', () => {
    const plan = buildExampleCouple()
    const person = plan.household.people[0]!
    plan.household.people = [person]
    plan.household.filingStatus = 'single'
    person.retirementAge = context.startYear - Number(person.dob.slice(0, 4)) - 1
    plan.accounts = []
    plan.incomes = []
    plan.insurance = []
    plan.strategies.rothConversion = { mode: 'none' }
    plan.expenses.healthcare.ssa44 = { survivorYears: false, retirementYears: true }

    const withRelief = buildScenarioLever(
      plan,
      { id: 'retirementAge', yearsDelta: 1 },
      context,
    )
    plan.expenses.healthcare.ssa44.retirementYears = false
    const withoutRelief = buildScenarioLever(
      plan,
      { id: 'retirementAge', yearsDelta: 1 },
      context,
    )

    expect(withRelief.ok).toBe(true)
    expect(withoutRelief.ok).toBe(false)
  })

  it('recognizes retirement-age-defaulted Social Security earnings projections after the work boundary', () => {
    const plan = buildExampleCouple()
    const person = plan.household.people[0]!
    plan.household.people = [person]
    plan.household.filingStatus = 'single'
    person.retirementAge = 60
    plan.accounts = []
    plan.insurance = []
    plan.strategies.rothConversion = { mode: 'none' }
    plan.expenses.healthcare.ssa44 = { survivorYears: false, retirementYears: false }
    plan.incomes = [
      {
        type: 'socialSecurity',
        id: 'earnings-ss',
        personId: person.id,
        piaMonthly: null,
        earnings: [{ year: 2019, amount: 100_000 }],
        earningsProjection: { assumedAnnualEarnings: 100_000, throughAge: null },
        claimAge: { years: 70, months: 0 },
      },
    ]

    const result = buildScenarioLever(
      plan,
      { id: 'retirementAge', yearsDelta: 1 },
      context,
    )

    expect(result.ok).toBe(true)
  })

  it('recognizes employer-plan Rule-of-55 changes as retirement-age effects', () => {
    const plan = buildExampleCouple()
    const person = plan.household.people[0]!
    plan.household.people = [person]
    plan.household.filingStatus = 'single'
    person.retirementAge = 55
    plan.incomes = []
    plan.insurance = []
    plan.accounts = [
      {
        type: 'traditional',
        id: 'employer-plan',
        name: 'Employer plan',
        ownerPersonId: person.id,
        annualReturnPct: 4,
        kind: 'employer',
        balance: 100_000,
        annualContribution: 0,
      },
    ]
    plan.strategies.rothConversion = { mode: 'none' }
    const ruleOf55Context = { ...context, startYear: 2017 }

    const result = buildScenarioLever(
      plan,
      { id: 'retirementAge', yearsDelta: 1 },
      ruleOf55Context,
    )

    expect(result.ok).toBe(true)
  })

  it('rejects relocation schedules that are already equivalent after pre-start moves', () => {
    const plan = buildExampleCouple()
    plan.household.stateMoves = [
      { fromYear: context.startYear - 1, fromMonth: 7, state: 'TX' },
      { fromYear: 2030, fromMonth: 4, state: 'FL' },
    ]

    const equivalent = buildScenarioLever(
      plan,
      { id: 'relocation', state: 'FL', moveYear: 2030, moveMonth: 4 },
      context,
    )
    plan.assumptions.localIncomeTaxPct = 1
    const clearsOverride = buildScenarioLever(
      plan,
      { id: 'relocation', state: 'FL', moveYear: 2030, moveMonth: 4 },
      context,
    )

    expect(equivalent.ok).toBe(false)
    if (!equivalent.ok) expect(equivalent.issues.join(' ')).toContain('effective projection residence')
    expect(clearsOverride.ok).toBe(true)
  })

  it('requires former-spouse benefits to exceed unchanged SSDI before claim age is available', () => {
    const plan = buildExampleCouple()
    const person = plan.household.people[0]!
    const stream = plan.incomes
      .filter((income) => income.type === 'socialSecurity')
      .find((income) => income.personId === person.id)!
    plan.incomes = [stream]
    stream.piaMonthly = 3_000
    stream.claimAge = { years: 62, months: 0 }
    stream.disability = { onsetAge: 60 }
    stream.formerSpouses = [
      {
        id: 'former-spouse',
        relationship: 'deceased',
        dob: '1955-01-02',
        piaMonthly: 1_000,
        marriageYears: 12,
        remarriedAtAge: 60,
      },
    ]

    const smallerBenefit = buildScenarioLever(
      plan,
      { id: 'socialSecurityClaim', claimAge: 70 },
      context,
    )
    stream.formerSpouses[0]!.piaMonthly = 8_000
    const largerBenefit = buildScenarioLever(
      plan,
      { id: 'socialSecurityClaim', claimAge: 70 },
      context,
    )

    expect(smallerBenefit.ok).toBe(false)
    expect(largerBenefit.ok).toBe(true)
  })

  it('requires current-spouse auxiliary benefits to exceed unchanged SSDI before claim age is available', () => {
    const plan = buildExampleCouple()
    const streams = plan.incomes.filter((income) => income.type === 'socialSecurity')
    const claimant = streams[0]!
    const spouse = streams[1]!
    plan.incomes = streams
    claimant.piaMonthly = 3_000
    claimant.claimAge = { years: 62, months: 0 }
    claimant.disability = { onsetAge: 60 }
    claimant.formerSpouses = []
    spouse.piaMonthly = 1_000
    spouse.claimAge = { years: 70, months: 0 }
    spouse.formerSpouses = []

    const smallerBenefit = buildScenarioLever(
      plan,
      { id: 'socialSecurityClaim', claimAge: 70 },
      context,
    )
    spouse.piaMonthly = 10_000
    const largerBenefit = buildScenarioLever(
      plan,
      { id: 'socialSecurityClaim', claimAge: 70 },
      context,
    )

    expect(smallerBenefit.ok).toBe(false)
    expect(largerBenefit.ok).toBe(true)
  })

  it('rejects zero-value HECM properties without sale proceeds or carrying costs', () => {
    const plan = buildExampleCouple()
    const property = plan.accounts.find((account) => account.type === 'property')!
    property.value = 0
    property.propertyTaxAnnual = 0
    property.insuranceAnnual = 0
    property.primaryResidence = true
    property.hecm = {
      openYear: context.startYear,
      principalLimitPct: 50,
      growthRatePct: 7,
      upfrontCostPct: 2,
      drawPolicy: 'coordinated',
    }

    const result = buildScenarioLever(
      plan,
      { id: 'homeSale', propertyId: property.id, saleYear: context.startYear + 1 },
      context,
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.join(' ')).toContain('zero-value property')
  })

  it('includes care duration and annual cost in the generated scenario name', () => {
    const plan = buildExampleCouple()
    const person = plan.household.people[0]!
    const result = buildScenarioLever(
      plan,
      {
        id: 'care',
        personId: person.id,
        startAge: 85,
        durationYears: 4,
        annualCost: 125_000,
      },
      context,
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.name).toContain('4 years')
      expect(result.name).toContain('125,000 per year')
    }
  })
})
