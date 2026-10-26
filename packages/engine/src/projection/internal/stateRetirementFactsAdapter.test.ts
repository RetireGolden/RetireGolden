import { describe, expect, it } from 'vitest'

import { createEmptyPlan, type Account } from '../../model/plan.js'
import { stateParamsFor } from '../../params/state/index.js'
import {
  newJerseyWorksheetCTaxableAmount,
  stateDirectQcdCollectionAdjustment,
} from '../../tax/stateQcdHsa.js'
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
import { californiaHsaAccountAdjustment } from '../../tax/stateQcdHsa.js'
import { isRailroadSource } from '../../tax/stateRetirementFacts.js'
import type { StateQcdEventFactsInput } from '../types.js'

const qcdProvenance = { source: 'IRA custodian 1099-R', asOf: '2026-12-31' } as const

function qcdEvidence(overrides: Partial<NonNullable<ReturnType<typeof createEmptyPlan>['stateTaxFacts']['qcdEventEvidence']>[number]> = {}) {
  return {
    eventId: 'qcd-routed:x',
    taxYear: 2026,
    accountId: 'ira',
    ownerPersonId: 'p1',
    transactionKind: 'directQcd' as const,
    grossIraDistribution: 10_000,
    directCharityTransfer: 10_000,
    federalExcludedAmount: 10_000,
    federalTaxableAmount: 0,
    federalBasisAllocated: 0,
    residency: 'fullYearResident' as const,
    directTransfer: true,
    provenance: qcdProvenance,
    ...overrides,
  }
}

/** The literal defaults the forced-distribution phase stamps on every runtime QCD. */
function runtimeQcd(overrides: Partial<StateQcdEventFactsInput> = {}): StateQcdEventFactsInput {
  return {
    eventId: 'qcd-routed:x',
    accountId: 'ira',
    ownerPersonId: 'p1',
    grossIraDistribution: 10_000,
    directCharityTransfer: 10_000,
    federalExcludedAmount: 10_000,
    federalTaxableAmount: 0,
    federalBasisAllocated: 0,
    residency: 'unknown',
    splitInterest: false,
    directTransfer: true,
    ...overrides,
  }
}

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

  it('passes each railroad source through, so the state return sees a railroad annuity (45 U.S.C. 231m)', () => {
    // The state calculator takes a railroad source off state income in every
    // state; a mapping that dropped or renamed one would re-tax it silently.
    for (const source of ['railroadTier1', 'railroadTier2', 'railroadRetirementAct'] as const) {
      expect(mapPensionSourceToStateKind(source)).toBe(source)
      const row = characterizePensionDistribution({
        account: {
          type: 'pension', id: 'rrb', name: 'Railroad annuity', ownerPersonId: 'owner',
          annualReturnPct: null, source, startAge: 60, monthlyAmount: 1_000, colaPct: 0, survivorPct: 0,
        } as Extract<Account, { type: 'pension' }>,
        sourceOwnerPersonId: 'owner',
        payeePersonId: 'owner',
        federallyIncludedAmount: 12_000,
        recipientAgeYears: 66,
      })
      expect(row.fact).toEqual(expect.objectContaining({
        accountId: 'rrb', ownerPersonId: 'owner', sourceKind: source, federallyIncludedAmount: 12_000,
      }))
      expect(isRailroadSource(row.fact.sourceKind)).toBe(true)
    }
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

describe('QCD event evidence merge (D48, D49)', () => {
  const njPolicy = stateParamsFor('NJ', 2026)?.directQcdPolicy
  // GIT-1 & 2 Worksheet C: taxable = distribution × (Dec 31 value + distributions
  // − unrecovered NJ contributions) / (Dec 31 value + distributions). A $0
  // unrecovered basis on a $10,000 QCD against a $90,000 year-end IRA is
  // 10,000 × 100,000 / 100,000 = 10,000. N.J.S.A. 54A does not follow the
  // IRC 408(d)(8) exclusion, so the federal exclusion is not a NJ subtraction.
  const njPool = {
    ownerPersonId: 'p1',
    december31IraValue: 90_000,
    allAnnualDistributions: 10_000,
    unrecoveredNjTaxedContributions: { known: true as const, amount: 0 },
    fullLiquidation: false,
  }

  function planWithEvidence(...rows: ReturnType<typeof qcdEvidence>[]) {
    const plan = createEmptyPlan({ newId: () => 'p1', now: () => new Date('2026-01-01') })
    plan.household.state = 'NJ'
    plan.stateTaxFacts.qcdEventEvidence = rows
    return plan
  }

  it('keeps evidence residency when the runtime QCD stamps unknown, so NJ Worksheet C taxes the full $10,000', () => {
    // Two 2026 residency segments, both NJ, so the single 12-month household
    // patch cannot promote an unknown QCD to full-year resident.
    const segments = [{ state: 'NJ', months: 6 }, { state: 'NJ', months: 6 }]
    // Evidence dollars that disagree with the executed gift do not replace it.
    // Characterization (residency, kind, direct transfer) is what the custodian
    // row supplies; the projected amount stays the distribution.
    const plan = planWithEvidence(qcdEvidence({
      grossIraDistribution: 1, directCharityTransfer: 1, federalExcludedAmount: 1,
    }))
    const [fact] = qcdEventFactsForYear(plan, 2026, [runtimeQcd()])!
    expect(fact!.grossIraDistribution).toBe(10_000)
    expect(fact!.directCharityTransfer).toBe(10_000)
    const residency = fact!.residency === 'unknown' && segments.length === 1 && segments[0]!.months === 12
      ? 'fullYearResident' as const
      : fact!.residency
    expect(residency).toBe('fullYearResident')
    expect(fact!.directTransfer).toBe(true)
    const worksheet = newJerseyWorksheetCTaxableAmount({
      pool: njPool,
      correspondingGrossDistributions: fact!.directCharityTransfer,
    })
    expect(worksheet.stateTaxableIraAmount).toBe(10_000)
    expect(worksheet.basisRecovered).toBe(0)
    const adjustment = stateDirectQcdCollectionAdjustment({
      events: [{ ...fact!, residency, directTransfer: fact!.directTransfer === true }],
      packPolicy: njPolicy,
      njPools: [njPool],
    })
    expect(adjustment.warnings).toEqual([])
    expect(adjustment.taxableIncomeDelta).toBe(10_000)
  })

  it('honors evidence transactionKind splitInterest instead of the runtime splitInterest false default', () => {
    // IRC 408(d)(8)(F): a split-interest transfer does not inherit the direct
    // QCD exclusion. The state leaf refuses it.
    const plan = planWithEvidence(qcdEvidence({ transactionKind: 'splitInterest' }))
    const [fact] = qcdEventFactsForYear(plan, 2026, [runtimeQcd()])!
    expect(fact!.transactionKind).toBe('splitInterest')
    expect(fact!.splitInterest).toBe(true)
    const adjustment = stateDirectQcdCollectionAdjustment({
      events: [{ ...fact!, directTransfer: fact!.directTransfer === true }],
      packPolicy: njPolicy,
      njPools: [njPool],
    })
    expect(adjustment.warnings.map((warning) => warning.code)).toContain('state-qcd-split-interest-refused')
    expect(adjustment.taxableIncomeDelta).toBe(0)
  })

  it('does not let the runtime directTransfer true default erase evidence that the transfer was not direct', () => {
    const plan = planWithEvidence(qcdEvidence({ directTransfer: false, transactionKind: 'other' }))
    const [fact] = qcdEventFactsForYear(plan, 2026, [runtimeQcd()])!
    expect(fact!.directTransfer).toBe(false)
    expect(fact!.transactionKind).toBe('other')
    const adjustment = stateDirectQcdCollectionAdjustment({
      events: [{ ...fact!, directTransfer: fact!.directTransfer === true }],
      packPolicy: njPolicy,
      njPools: [njPool],
    })
    expect(adjustment.warnings.map((warning) => warning.code)).toContain('state-qcd-direct-transfer-required')
    expect(adjustment.taxableIncomeDelta).toBe(0)
  })

  it('withholds an evidence-only QCD instead of pricing dollars the projection did not execute', () => {
    // IRC 408(d)(8)(A) excludes an executed direct transfer. A custodian row
    // with no matching runtime event is not that execution. NJ Worksheet C
    // subtracts federalTaxableAmount from the state taxable amount, which
    // assumes the federal base already includes it. The year stays incomplete.
    const plan = planWithEvidence(qcdEvidence({
      eventId: 'custodian-2026-qcd',
      grossIraDistribution: 10_000,
      directCharityTransfer: 10_000,
      federalExcludedAmount: 10_000,
      federalTaxableAmount: 0,
    }))
    expect(qcdEventFactsForYear(plan, 2026, [], 'NJ')).toBeUndefined()
  })

  it('keeps two QCD facts when two accounts share an eventId', () => {
    const plan = planWithEvidence(
      qcdEvidence({ eventId: 'shared', accountId: 'ira' }),
      qcdEvidence({ eventId: 'shared', accountId: 'ira-2', grossIraDistribution: 4_000, directCharityTransfer: 4_000, federalExcludedAmount: 4_000 }),
    )
    const matchedRuntime = qcdEventFactsForYear(plan, 2026, [
      runtimeQcd({ eventId: 'shared', accountId: 'ira' }),
      runtimeQcd({ eventId: 'shared', accountId: 'ira-2', grossIraDistribution: 4_000, directCharityTransfer: 4_000, federalExcludedAmount: 4_000 }),
    ], 'NJ')
    expect(matchedRuntime?.map((fact) => fact.accountId).sort()).toEqual(['ira', 'ira-2'])
  })

  it('leaves a year marked qcd-unknown incomplete when the runtime list is empty', () => {
    const plan = createEmptyPlan({ newId: () => 'p1', now: () => new Date('2026-01-01') })
    plan.household.state = 'NJ'
    plan.stateTaxFacts.annualEvidenceCompleteness = [{
      taxYear: 2026, state: 'NJ', qcd: 'unknown', provenance: qcdProvenance,
    }]
    expect(qcdEventFactsForYear(plan, 2026, [], 'NJ')).toBeUndefined()
    plan.stateTaxFacts.annualEvidenceCompleteness = [{
      taxYear: 2026, state: 'NJ', qcd: 'complete', provenance: qcdProvenance,
    }]
    expect(qcdEventFactsForYear(plan, 2026, undefined, 'NJ')).toEqual([])
  })

  it('does not treat one observed QCD as a complete collection when the year is marked unknown', () => {
    const plan = planWithEvidence(qcdEvidence())
    plan.stateTaxFacts.annualEvidenceCompleteness = [{
      taxYear: 2026, state: 'NJ', qcd: 'unknown', provenance: qcdProvenance,
    }]
    expect(qcdEventFactsForYear(plan, 2026, [runtimeQcd()], 'NJ')).toBeUndefined()
  })

  it('keeps a prior state QCD-unknown mark in a move year', () => {
    // The household leaves NJ on July 1. NJ marked its QCD activity unknown.
    // Year-end CA is not a known-empty collection for the NJ slice.
    const plan = createEmptyPlan({ newId: () => 'p1', now: () => new Date('2026-01-01') })
    plan.household.state = 'NJ'
    plan.household.stateMoves = [{ fromYear: 2026, fromMonth: 7, state: 'CA' }]
    plan.stateTaxFacts.annualEvidenceCompleteness = [{
      taxYear: 2026, state: 'NJ', qcd: 'unknown', provenance: qcdProvenance,
    }]
    expect(qcdEventFactsForYear(plan, 2026, [], 'CA')).toBeUndefined()
  })

  it('withholds the collection when two custodian rows share one identity', () => {
    const plan = planWithEvidence(
      qcdEvidence({ grossIraDistribution: 10_000 }),
      qcdEvidence({ grossIraDistribution: 4_000, directCharityTransfer: 4_000, federalExcludedAmount: 4_000 }),
    )
    expect(qcdEventFactsForYear(plan, 2026, [runtimeQcd()], 'NJ')).toBeUndefined()
    expect(qcdEventFactsForYear(plan, 2026, [], 'NJ')).toBeUndefined()
  })

  it('keeps custodian rows distinct when their ids contain a NUL', () => {
    const plan = planWithEvidence(
      qcdEvidence({ eventId: 'a', accountId: 'b\u0000c' }),
      qcdEvidence({
        eventId: 'a\u0000b', accountId: 'c',
        grossIraDistribution: 4_000, directCharityTransfer: 4_000, federalExcludedAmount: 4_000,
      }),
    )
    const facts = qcdEventFactsForYear(plan, 2026, [
      runtimeQcd({ eventId: 'a', accountId: 'b\u0000c' }),
      runtimeQcd({
        eventId: 'a\u0000b', accountId: 'c',
        grossIraDistribution: 4_000, directCharityTransfer: 4_000, federalExcludedAmount: 4_000,
      }),
    ], 'NJ')
    expect(facts).toHaveLength(2)
    expect(facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventId: 'a', accountId: 'b\u0000c', grossIraDistribution: 10_000 }),
      expect.objectContaining({ eventId: 'a\u0000b', accountId: 'c', grossIraDistribution: 4_000 }),
    ]))
  })

  it('refuses an unsupported NJ QCD before asking for the missing Worksheet C pool', () => {
    // IRC 408(d)(8)(F). The refusal does not wait on N.J.S.A. 54A basis.
    const split = stateDirectQcdCollectionAdjustment({
      events: [{
        ...runtimeQcd(),
        transactionKind: 'splitInterest',
        splitInterest: true,
        residency: 'fullYearResident',
        directTransfer: true,
      }],
      packPolicy: njPolicy,
    })
    expect(split.taxableIncomeDelta).toBe(0)
    expect(split.warnings.map((warning) => warning.code)).toEqual([
      'state-qcd-split-interest-refused',
      'nj-qcd-basis-unknown',
    ])
    const other = stateDirectQcdCollectionAdjustment({
      events: [{ ...runtimeQcd(), transactionKind: 'other', directTransfer: false, residency: 'fullYearResident' }],
      packPolicy: njPolicy,
    })
    expect(other.warnings.map((warning) => warning.code)).toEqual([
      'state-qcd-direct-transfer-required',
      'nj-qcd-basis-unknown',
    ])
  })
})

it('keeps an asserted California HSA deduction when the runtime row is only zero defaults (#803)', () => {
  // California reverses the federal HSA deduction (R&TC 17201; FTB 2025
  // Schedule CA; DOCS/domain/state-tax-research/CA.md,
  // ca-hsa-state-basis-nonconformity). Unknown activity is incomplete, so the
  // other Schedule CA categories are explicit known zeros and the year is
  // marked complete. Worksheet: add back the asserted deduction $4,300,
  // employer contribution excluded federally $0, interest $0, dividends $0,
  // realized gains $0, and subtract the federally included nonqualified
  // distribution $0. Addition = 4,300 + 0 + 0 + 0 + 0 − 0 = 4,300.
  // The runtime deduction of 0 is the candidate default for no modeled
  // contribution (issue #803). It is not a measurement that replaces the
  // asserted deduction. Withdrawal categories are omitted: the funding caller
  // passes them only when a withdrawal row exists.
  const plan = createEmptyPlan({ newId: () => 'p1', now: () => new Date('2026-01-01') })
  plan.accounts.push({
    type: 'hsa',
    id: 'hsa1',
    name: 'HSA',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    balance: 1_000,
    annualContribution: 0,
  })
  plan.stateTaxFacts.hsaYearEvidence = [{
    taxYear: 2026,
    state: 'CA',
    accountId: 'hsa1',
    ownerPersonId: 'p1',
    federalHsaDeduction: 4_300,
    employerContributionExcludedFederally: 0,
    employerContributionAlreadyInStateWages: 0,
    interest: 0,
    dividends: 0,
    realizedGains: 0,
    unrealizedAppreciation: 0,
    qualifiedCashWithdrawals: 0,
    nonqualifiedDistributionFederalAmount: 0,
    stateBasisBeforeYear: 0,
    annualActivityComplete: true,
    provenance: { source: 'plan-evidence', asOf: '2026-01-15' },
  }]
  const [fact] = hsaAccountYearFactsForYear(plan, 2026, 'CA', [{
    accountId: 'hsa1',
    ownerPersonId: 'p1',
    federalHsaDeduction: 0,
  }])!
  expect(fact!.federalHsaDeduction).toEqual({ known: true, amount: 4_300 })
  const addition = californiaHsaAccountAdjustment(fact!)
  expect(addition.warnings).toEqual([])
  expect(addition.taxableIncomeDelta).toBe(4_300)
})

it('keeps asserted HSA interest when the on-plan runtime row is only the deduction default', () => {
  // California taxes HSA interest in the year earned
  // (ca-hsa-state-basis-nonconformity; DOCS/domain/state-tax-research/CA.md).
  // The HSA account stays on the plan, so the funding caller sends a row whose
  // only numeric default is federalHsaDeduction 0. Asserted interest of
  // $1,200 is omitted from that row and stays. Every other Schedule CA
  // category is a known zero, so the year is complete.
  // Addition = 0 + 0 + 1,200 + 0 + 0 − 0 = 1,200.
  const plan = createEmptyPlan({ newId: () => 'p1', now: () => new Date('2026-01-01') })
  plan.accounts.push({
    type: 'hsa',
    id: 'hsa1',
    name: 'HSA',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    balance: 1_000,
    annualContribution: 0,
  })
  plan.stateTaxFacts.hsaYearEvidence = [{
    taxYear: 2026,
    state: 'CA',
    accountId: 'hsa1',
    ownerPersonId: 'p1',
    federalHsaDeduction: 0,
    employerContributionExcludedFederally: 0,
    interest: 1_200,
    dividends: 0,
    realizedGains: 0,
    nonqualifiedDistributionFederalAmount: 0,
    annualActivityComplete: true,
    provenance: { source: 'plan-evidence', asOf: '2026-01-15' },
  }]
  const [fact] = hsaAccountYearFactsForYear(plan, 2026, 'CA', [{
    accountId: 'hsa1',
    ownerPersonId: 'p1',
    federalHsaDeduction: 0,
  }])!
  expect(fact!.interest).toEqual({ known: true, amount: 1_200 })
  expect(fact!.annualActivityComplete).toBe(true)
  expect(californiaHsaAccountAdjustment(fact!).taxableIncomeDelta).toBe(1_200)
})

it('lets a characterized withdrawal zero replace a stale nonqualified amount', () => {
  // A qualified withdrawal is a measurement, not a `?? 0` default.
  // Schedule CA subtracts only the federally included nonqualified amount.
  // Evidence said that amount was $800; the characterized withdrawal used
  // none of it. The subtraction becomes 0. The unmodeled deduction default
  // of 0 still leaves the asserted $4,300 in place. Worksheet: 4,300 + 0 +
  // 0 + 0 + 0 − 0 = 4,300.
  const plan = createEmptyPlan({ newId: () => 'p1', now: () => new Date('2026-01-01') })
  plan.stateTaxFacts.hsaYearEvidence = [{
    taxYear: 2026,
    state: 'CA',
    accountId: 'hsa1',
    ownerPersonId: 'p1',
    federalHsaDeduction: 4_300,
    employerContributionExcludedFederally: 0,
    interest: 0,
    dividends: 0,
    realizedGains: 0,
    nonqualifiedDistributionFederalAmount: 800,
    annualActivityComplete: true,
    provenance: { source: 'plan-evidence', asOf: '2026-01-15' },
  }]
  const [fact] = hsaAccountYearFactsForYear(plan, 2026, 'CA', [{
    accountId: 'hsa1',
    ownerPersonId: 'p1',
    federalHsaDeduction: 0,
    grossDistributions: 2_000,
    qualifiedCashWithdrawals: 2_000,
    nonqualifiedDistributionFederalAmount: 0,
    nonqualifiedCashWithdrawals: 0,
  }])!
  expect(fact).toMatchObject({
    federalHsaDeduction: { known: true, amount: 4_300 },
    nonqualifiedDistributionFederalAmount: { known: true, amount: 0 },
    qualifiedCashWithdrawals: { known: true, amount: 2_000 },
  })
  expect(californiaHsaAccountAdjustment(fact!).taxableIncomeDelta).toBe(4_300)
})

it('lets a modeled non-zero HSA deduction replace asserted evidence', () => {
  // Boundary of the deduction-default rule, not a second tax oracle: a
  // present non-zero runtime deduction is the modeled year fact and replaces
  // evidence. An omitted interest member stays evidence-backed. A present
  // interest of 0 is a measurement and replaces the asserted interest.
  const plan = createEmptyPlan({ newId: () => 'p1', now: () => new Date('2026-01-01') })
  plan.stateTaxFacts.hsaYearEvidence = [{
    taxYear: 2026,
    state: 'CA',
    accountId: 'hsa1',
    ownerPersonId: 'p1',
    federalHsaDeduction: 4_300,
    interest: 1_200,
    provenance: { source: 'plan-evidence', asOf: '2026-01-15' },
  }]
  const replaced = hsaAccountYearFactsForYear(plan, 2026, 'CA', [{
    accountId: 'hsa1',
    ownerPersonId: 'p1',
    federalHsaDeduction: 1_000,
  }])
  expect(replaced?.[0]).toMatchObject({
    federalHsaDeduction: { known: true, amount: 1_000 },
    interest: { known: true, amount: 1_200 },
  })
  const measuredInterest = hsaAccountYearFactsForYear(plan, 2026, 'CA', [{
    accountId: 'hsa1',
    ownerPersonId: 'p1',
    interest: 0,
  }])
  expect(measuredInterest?.[0]?.interest).toEqual({ known: true, amount: 0 })
})
