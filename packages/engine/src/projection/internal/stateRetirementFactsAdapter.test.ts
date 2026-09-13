import { describe, expect, it } from 'vitest'

import { createEmptyPlan, type Account } from '../../model/plan.js'
import {
  ageOnDate,
  characterizePensionDistribution,
  inferEarlyDistributionDisqualifier,
  njIraOwnerPoolsForYear,
  qcdEventFactsForYear,
  retirementDistributionFactsForYear,
  householdFactsForYear,
  hsaAccountYearFactsForYear,
  isPublicPensionSourceKind,
  mapPensionSourceToStateKind,
  resolveStateDirectQcdPolicy,
} from './stateRetirementFactsAdapter.js'

describe('stateRetirementFactsAdapter', () => {
  it('rejects impossible schema-shaped civil dates without rolling them forward', () => {
    expect(ageOnDate('1960-02-30', '2026-12-31')).toBeUndefined()
    expect(ageOnDate('1960-01-01', '2026-02-30')).toBeUndefined()
    // Age uses the established calendar-month resolution, not whole years.
    expect(ageOnDate('1960-01-01', '2026-12-31')).toBeCloseTo(66 + 11 / 12, 8)
  })

  it('maps legacy private to ordinary private pension and keeps coarse public unknown', () => {
    expect(mapPensionSourceToStateKind('private')).toBe('ordinaryPrivatePension')
    expect(mapPensionSourceToStateKind('public')).toBe('unknownPublic')
    expect(mapPensionSourceToStateKind('unknownPrivate')).toBe('unknownPrivate')
    expect(mapPensionSourceToStateKind('militaryRetirement')).toBe(
      'militaryRetirement',
    )
    expect(isPublicPensionSourceKind('militaryRetirement')).toBe(true)
    expect(isPublicPensionSourceKind('ordinaryPrivatePension')).toBe(false)
  })

  it('infers early-distribution clearance only from proved payment age or a Jan-1 lower bound', () => {
    expect(inferEarlyDistributionDisqualifier({ explicit: 'true', ageAtDistributionYears: 70 })).toBe('true')
    expect(inferEarlyDistributionDisqualifier({ ageAtDistributionYears: 59.5 })).toBe('false')
    expect(inferEarlyDistributionDisqualifier({ ageAtDistributionYears: 59 })).toBe('unknown')
    expect(inferEarlyDistributionDisqualifier({ minimumAgeAtDistributionYears: 59.5 })).toBe('false')
    expect(inferEarlyDistributionDisqualifier({ minimumAgeAtDistributionYears: 59 })).toBe('unknown')
  })

  it('characterizes survivor payee with death cause and payee as ownerPersonId', () => {
    const account = {
      type: 'pension',
      id: 'pen1',
      name: 'Pension',
      ownerPersonId: 'owner',
      annualReturnPct: null,
      source: 'stateLocalPublic',
      stateEligibility: {
        decedentWouldQualify: true,
        survivorInsurableInterest: true,
        earlyDistributionDisqualifier: 'false',
      },
      startAge: 60,
      monthlyAmount: 1_000,
      colaPct: 0,
      survivorPct: 50,
    } as Extract<Account, { type: 'pension' }>

    const row = characterizePensionDistribution({
      account,
      sourceOwnerPersonId: 'owner',
      payeePersonId: 'survivor',
      federallyIncludedAmount: 6_000,
      recipientAgeYears: 64,
    })

    expect(row.sourceOwnerPersonId).toBe('owner')
    expect(row.fact).toEqual(
      expect.objectContaining({
        ownerPersonId: 'survivor',
        sourceKind: 'stateLocalPublic',
        federallyIncludedAmount: 6_000,
        recipientAgeYears: 64,
        cause: 'death',
        decedentWouldQualify: true,
        survivorInsurableInterest: true,
        earlyDistributionDisqualifier: 'false',
      }),
    )
  })

  it('resolves household year facts without inventing missing years', () => {
    const plan = createEmptyPlan({
      newId: () => 'x',
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    })
    plan.stateTaxFacts = {
      householdYearFacts: [
        {
          year: 2026,
          stateFilingStatus: 'headOfHousehold',
          exemptionTaxpayerCount: 1,
        },
      ],
      hsaYearEvidence: [],
      iraBasisYearEvidence: [],
    }
    expect(householdFactsForYear(plan, 2026)).toEqual({
      stateFilingStatus: 'headOfHousehold',
      exemptionTaxpayerCount: 1,
      // Default plan DOB 1970-01-01 is age 56 at TY2026 year-end; derived, not invented.
      age65EligibleCount: 0,
    })
    expect(householdFactsForYear(plan, 2027)).toBeUndefined()
  })

  it('never invents a conforming QCD policy from Plan input', () => {
    expect(resolveStateDirectQcdPolicy({})).toEqual({ kind: 'unknown' })
    expect(
      resolveStateDirectQcdPolicy({
        stateParamsPolicy: {
          kind: 'conformsWithAdoptedCap',
          annualCap: 100_000,
          citation: 'AR §26-51-307',
        },
      }),
    ).toEqual({
      kind: 'conformsWithAdoptedCap',
      annualCap: 100_000,
      citation: 'AR §26-51-307',
    })
  })

  it('keeps omitted HSA numeric members unknown and does not reuse another state basis', () => {
    const plan = createEmptyPlan({
      newId: () => 'x',
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    })
    plan.accounts.push({
      type: 'hsa',
      id: 'hsa1',
      name: 'HSA',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      balance: 1_000,
      annualContribution: 0,
    })
    plan.stateTaxFacts = {
      householdYearFacts: [],
      hsaYearEvidence: [
        {
          taxYear: 2026,
          accountId: 'hsa1',
          ownerPersonId: 'p1',
          state: 'NJ',
          federalHsaDeduction: 0,
          provenance: { source: 'plan-evidence', asOf: '2026-01-15' },
        },
      ],
      iraBasisYearEvidence: [],
    }
    const nj = hsaAccountYearFactsForYear(plan, 2026, 'NJ')
    expect(nj).toHaveLength(1)
    expect(nj![0]!.federalHsaDeduction).toEqual({ known: true, amount: 0 })
    expect(nj![0]!.stateBasisBeforeYear).toEqual({ known: false })
    expect(nj![0]!.interest).toEqual({ known: false })
    expect(hsaAccountYearFactsForYear(plan, 2026, 'CA')).toBeUndefined()
  })
})


describe('state event integration boundaries', () => {
  it('does not turn unknown contributory status into noncontributory proof', () => {
    const result = characterizePensionDistribution({
      account: { type: 'pension', id: 'p', source: 'stateLocalPublic',
        stateEligibility: { contributoryStatus: 'unknown' } } as Extract<Account, { type: 'pension' }>,
      sourceOwnerPersonId: 'owner', payeePersonId: 'owner',
      federallyIncludedAmount: 100, recipientAgeYears: 70,
    })
    expect(result.fact.publicPlanContributory).toBeUndefined()
  })

  it('preserves source/payee identity and the six-month age boundary for IRA events', () => {
    const plan = createEmptyPlan({ newId: () => 'owner', now: () => new Date('2026-01-01') })
    plan.household.people[0]!.dob = '1967-03-12'
    const [before, boundary] = retirementDistributionFactsForYear(plan, 2026,
      ['2026-09-11', '2026-09-12'].map((distributionDate) => ({
        eventId: distributionDate, accountId: 'ira', sourceOwnerPersonId: 'decedent',
        recipientPersonId: 'owner', source: 'ira' as const, federallyIncludedAmount: 500,
        distributionDate,
      })))
    expect(before!.ageAtDistributionYears).toBeLessThan(59.5)
    expect(boundary!.ageAtDistributionYears).toBe(59.5)
    expect(boundary).toMatchObject({ ownerPersonId: 'owner', sourceOwnerPersonId: 'decedent', accountId: 'ira', cause: 'death' })
  })

  it('keeps a missing NJ denominator unknown instead of inventing a zero pool', () => {
    const plan = createEmptyPlan({ newId: () => 'x', now: () => new Date('2026-01-01') })
    // Deliberately incomplete imported annual evidence; provenance is not used by this mapper.
    plan.stateTaxFacts.iraBasisYearEvidence = [{ taxYear: 2026, state: 'NJ', ownerPersonId: 'x',
      accountId: 'ira', unrecoveredStateBasis: 200 } as typeof plan.stateTaxFacts.iraBasisYearEvidence[number]]
    expect(njIraOwnerPoolsForYear(plan, 2026)?.[0]?.unrecoveredNjTaxedContributions).toEqual({ known: false })
    Object.assign(plan.stateTaxFacts.iraBasisYearEvidence[0]!, {
      yearEndAccountValue: 700, distributionsDuringYear: 100,
      postYearContributionsThroughFilingDeadline: 200, annualDistributionsComplete: true,
    })
    expect(njIraOwnerPoolsForYear(plan, 2026)?.[0]).toMatchObject({
      december31IraValue: 900, allAnnualDistributions: 100,
      unrecoveredNjTaxedContributions: { known: true, amount: 200 }, fullLiquidation: false,
    })
  })
})


it('asserted retirement characterization supplements eligibility but not coarse public source identity', () => {
  const plan = createEmptyPlan({ newId: () => 'owner', now: () => new Date('2026-01-01') })
  plan.stateTaxFacts.retirementDistributionEvidence = [{
    taxYear: 2026, eventId: 'pension', accountId: 'p', sourceOwnerPersonId: 'owner',
    recipientPersonId: 'owner', source: 'militaryRetirement', federallyIncludedAmount: 999,
  } as NonNullable<typeof plan.stateTaxFacts.retirementDistributionEvidence>[number]]
  expect(retirementDistributionFactsForYear(plan, 2026, [])).toEqual([])
  const result = retirementDistributionFactsForYear(plan, 2026, [{
    eventId: 'pension', accountId: 'p', sourceOwnerPersonId: 'owner', recipientPersonId: 'owner',
    source: 'public', federallyIncludedAmount: 200,
  }])
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({ sourceKind: 'unknownPublic', federallyIncludedAmount: 200 })
})

it('characterizes UI-shaped Delaware and South Carolina private pensions with inferred clearance', () => {
  const plan = createEmptyPlan({ newId: () => 'owner', now: () => new Date('2026-01-01') })
  plan.household.people[0]!.dob = '1966-01-01'
  const account = {
    type: 'pension',
    id: 'pen',
    name: 'Pension',
    ownerPersonId: 'owner',
    annualReturnPct: null,
    source: 'private',
    startAge: 60,
    monthlyAmount: 1_000,
    colaPct: 0,
    survivorPct: 0,
  } as Extract<Account, { type: 'pension' }>
  const de = characterizePensionDistribution({
    account,
    sourceOwnerPersonId: 'owner',
    payeePersonId: 'owner',
    federallyIncludedAmount: 10_000,
    recipientAgeYears: 60,
  })
  expect(de.fact).toMatchObject({ sourceKind: 'ordinaryPrivatePension', earlyDistributionDisqualifier: 'unknown' })
  const [sc] = retirementDistributionFactsForYear(plan, 2026, [{
    eventId: 'pen', accountId: 'pen', sourceOwnerPersonId: 'owner', recipientPersonId: 'owner',
    source: 'private', federallyIncludedAmount: 10_000,
  }])
  expect(sc).toMatchObject({
    sourceKind: 'ordinaryPrivatePension',
    minimumAgeAtDistributionYears: 60,
    earlyDistributionDisqualifier: 'false',
  })
  const explicitTrue = retirementDistributionFactsForYear(plan, 2026, [{
    eventId: 'pen', accountId: 'pen', sourceOwnerPersonId: 'owner', recipientPersonId: 'owner',
    source: 'private', federallyIncludedAmount: 10_000,
    eligibility: { earlyDistributionDisqualifier: 'true' },
  }])
  expect(explicitTrue[0]?.earlyDistributionDisqualifier).toBe('true')
  const crossing = createEmptyPlan({ newId: () => 'owner', now: () => new Date('2026-01-01') })
  crossing.household.people[0]!.dob = '1967-01-01'
  const [undated] = retirementDistributionFactsForYear(crossing, 2026, [{
    eventId: 'pen', accountId: 'pen', sourceOwnerPersonId: 'owner', recipientPersonId: 'owner',
    source: 'private', federallyIncludedAmount: 10_000,
  }])
  expect(undated).toMatchObject({ minimumAgeAtDistributionYears: 59, earlyDistributionDisqualifier: 'unknown' })
})

it('infers early-distribution clearance through characterizePensionDistribution when tax year and payee DOB are supplied', () => {
  const account = {
    type: 'pension',
    id: 'pen',
    name: 'Pension',
    ownerPersonId: 'owner',
    annualReturnPct: null,
    source: 'private',
    startAge: 60,
    monthlyAmount: 1_000,
    colaPct: 0,
    survivorPct: 0,
  } as Extract<Account, { type: 'pension' }>
  const cleared = characterizePensionDistribution({
    account,
    sourceOwnerPersonId: 'owner',
    payeePersonId: 'owner',
    federallyIncludedAmount: 10_000,
    recipientAgeYears: 60,
    taxYear: 2026,
    payeeDateOfBirth: '1966-01-01',
  })
  expect(cleared.fact).toMatchObject({
    sourceKind: 'ordinaryPrivatePension',
    minimumAgeAtDistributionYears: 60,
    earlyDistributionDisqualifier: 'false',
  })
  const withoutDob = characterizePensionDistribution({
    account,
    sourceOwnerPersonId: 'owner',
    payeePersonId: 'owner',
    federallyIncludedAmount: 10_000,
    recipientAgeYears: 60,
  })
  expect(withoutDob.fact).toMatchObject({
    earlyDistributionDisqualifier: 'unknown',
  })
  expect(withoutDob.fact.minimumAgeAtDistributionYears).toBeUndefined()
})


it('emits projected HSA earnings and distributions without inventing state basis', () => {
  const plan = createEmptyPlan({ newId: () => 'owner', now: () => new Date('2026-01-01') })
  const [fact] = hsaAccountYearFactsForYear(plan, 2026, 'NJ', [{
    accountId: 'hsa', ownerPersonId: 'owner', interest: 200, dividends: 100,
    employerContributionExcludedFederally: 500, qualifiedCashWithdrawals: 300,
    grossDistributions: 300,
  }])!
  expect(fact).toMatchObject({ interest: { known: true, amount: 200 },
    dividends: { known: true, amount: 100 },
    employerContributionExcludedFederally: { known: true, amount: 500 },
    qualifiedCashWithdrawals: { known: true, amount: 300 }, grossDistributions: 300,
    stateBasisBeforeYear: { known: false }, employerContributionAlreadyInStateWages: { known: false },
  })
})


it('preserves runtime known-empty collections separately from absent external evidence', () => {
  const plan = createEmptyPlan({ newId: () => 'p', now: () => new Date('2026-01-01') })
  expect(hsaAccountYearFactsForYear(plan, 2026, 'CA', [])).toEqual([])
  expect(hsaAccountYearFactsForYear(plan, 2026, 'CA')).toBeUndefined()
  expect(qcdEventFactsForYear(plan, 2026, [], 'CA')).toEqual([])
  expect(qcdEventFactsForYear(plan, 2026, undefined, 'CA')).toBeUndefined()
})


it('derives owner age for state retirement deductions even without retirement events', () => {
  const plan = createEmptyPlan({ newId: () => 'p', now: () => new Date('2026-01-01') })
  plan.household.people[0]!.dob = '1961-12-31'
  expect(householdFactsForYear(plan, 2026, { federalAgi: 50000 })?.ownerStateTaxFacts)
    .toEqual([{ ownerPersonId: 'p', recipientAgeYears: 65 }])
})


it('uses explicit return claimant ids to exclude deceased owner age deductions', () => {
  const plan = createEmptyPlan({ newId: () => 'p', now: () => new Date('2026-01-01') })
  expect(householdFactsForYear(plan, 2026, { claimantPersonIds: [] })?.ownerStateTaxFacts).toEqual([])
  const result = characterizePensionDistribution({
    account: { type: 'pension', id: 'pension', source: 'militarySurvivor',
      stateEligibility: { decedentAgeYears: 62 } } as Extract<Account, { type: 'pension' }>,
    sourceOwnerPersonId: 'decedent', payeePersonId: 'survivor',
    federallyIncludedAmount: 10000, recipientAgeYears: 50,
  })
  expect(result.fact).toMatchObject({ decedentAgeYears: 62, recipientAgeYears: 50, ownerPersonId: 'survivor' })
})

it('leaves invalid claimant ages unknown instead of publishing zero', () => {
  const plan = createEmptyPlan({ newId: () => 'p', now: () => new Date('2026-01-01') })
  plan.household.people[0]!.dob = '1960-02-30'
  const facts = householdFactsForYear(plan, 2026, { claimantPersonIds: ['p'] })!
  expect(facts.ownerStateTaxFacts).toEqual([{ ownerPersonId: 'p' }])
  expect(facts.age65EligibleCount).toBeUndefined()
})

it('preserves an explicitly supplied age-65 count despite an invalid claimant DOB', () => {
  const plan = createEmptyPlan({ newId: () => 'p', now: () => new Date('2026-01-01') })
  plan.household.people[0]!.dob = '1960-02-30'
  plan.stateTaxFacts.householdYearFacts = [{ year: 2026, age65EligibleCount: 1 }]
  expect(householdFactsForYear(plan, 2026, { claimantPersonIds: ['p'] })?.age65EligibleCount).toBe(1)
})
