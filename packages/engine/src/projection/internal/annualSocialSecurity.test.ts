import { describe, expect, it } from 'vitest'

import type { IncomeStream, Person } from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import { claimFactor } from '../../socialSecurity/claimFactor.js'
import { couplePlan, singlePersonPlan } from '../../testing/planFixtures.js'
import type { PersonYearState } from '../types.js'
import {
  annualSocialSecurity,
  type AnnualSocialSecurityInput,
} from './annualSocialSecurity.js'

type SocialSecurityIncome = Extract<IncomeStream, { type: 'socialSecurity' }>

function ss(
  id: string,
  personId: string,
  piaMonthly: number | null,
  claimAge = { years: 67, months: 0 },
): SocialSecurityIncome {
  return {
    type: 'socialSecurity',
    id,
    personId,
    piaMonthly,
    earnings: null,
    claimAge,
  }
}

function call(overrides: Partial<AnnualSocialSecurityInput> = {}) {
  const person = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 }).household.people[0]!
  const people = overrides.people ?? [person]
  const states = new Map<string, PersonYearState>(
    people.map((value) => [value.id, {
      personId: value.id,
      ageAttained: 67,
      alive: true,
    }]),
  )
  return annualSocialSecurity({
    incomes: [],
    people,
    personById: new Map(people.map((value) => [value.id, value])),
    stateOf: (personId) => states.get(personId)!,
    resolvedPiaByStreamId: new Map(),
    wagesByPerson: new Map(),
    withheldMonthsByPerson: new Map(),
    year: 2027,
    ssColaFactor: 1,
    ssHaircutFactor: 1,
    pack: packForYear(2026).pack,
    limitGrowth: 1,
    ...overrides,
  })
}

function peopleAndStates(
  people: readonly Person[],
  states: readonly PersonYearState[],
) {
  const byState = new Map(states.map((state) => [state.personId, state]))
  return {
    people,
    personById: new Map(people.map((person) => [person.id, person])),
    stateOf: (personId: string) => byState.get(personId)!,
  }
}

describe('annualSocialSecurity — own benefits and publication', () => {
  it('publishes one fresh row per configured stream in plan order and marks the last resolved gate', () => {
    const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 })
    const person = plan.household.people[0]!
    const incomes = [
      ss('first', person.id, 1_000),
      ss('unresolved', person.id, null),
      ss('last', person.id, 500),
    ]
    const input = {
      incomes,
      ...peopleAndStates([person], [{ personId: person.id, ageAttained: 67, alive: true }]),
      resolvedPiaByStreamId: new Map([
        ['first', 1_000],
        ['last', 500],
      ]),
    }

    const first = call(input)
    const second = call(input)

    expect(first.socialSecurity).toBe(18_240)
    expect(first.socialSecurityStreams.map((row) => row.streamId)).toEqual([
      'first',
      'unresolved',
      'last',
    ])
    expect(first.socialSecurityStreams).toEqual([
      {
        personId: person.id,
        streamId: 'first',
        source: 'own-retirement',
        annualAmount: 12_160,
        claimInForce: true,
        preWithholdingAnnual: 12_160,
        isSpousalSurvivorGateStream: false,
      },
      {
        personId: person.id,
        streamId: 'unresolved',
        source: 'none',
        annualAmount: 0,
        claimInForce: false,
        preWithholdingAnnual: 0,
        isSpousalSurvivorGateStream: false,
      },
      {
        personId: person.id,
        streamId: 'last',
        source: 'own-retirement',
        annualAmount: 6_080,
        claimInForce: true,
        preWithholdingAnnual: 6_080,
        isSpousalSurvivorGateStream: true,
      },
    ])
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(second.socialSecurityStreams).not.toBe(first.socialSecurityStreams)
    expect(second.withheldMonthWrites).not.toBe(first.withheldMonthWrites)
    expect(second.warnings).not.toBe(first.warnings)
    for (let index = 0; index < first.socialSecurityStreams.length; index++) {
      expect(second.socialSecurityStreams[index]).not.toBe(first.socialSecurityStreams[index])
    }
  })

  it('preserves the left-associated per-person benefit fold', () => {
    const person = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 }).household.people[0]!
    const incomes = [
      ss('large', person.id, 1e16 / 12),
      ss('small', person.id, 1 / 12),
      ss('negative-large', person.id, -1e16 / 12),
    ]
    const result = call({
      incomes,
      ...peopleAndStates([person], [{ personId: person.id, ageAttained: 67, alive: true }]),
      resolvedPiaByStreamId: new Map(incomes.map((stream) => [stream.id, stream.piaMonthly!])),
    })

    expect(result.socialSecurity).toBe(2)
    const [large, small, negativeLarge] = result.socialSecurityStreams
    const reordered =
      0 + large!.preWithholdingAnnual + negativeLarge!.preWithholdingAnnual + small!.preWithholdingAnnual
    expect(reordered).not.toBe(result.socialSecurity)
    expect(result.socialSecurityStreams.map((row) => row.streamId)).toEqual([
      'large',
      'small',
      'negative-large',
    ])
  })

  it('keeps last-wins person facts separate from first-wins duplicate-person state', () => {
    const first = singlePersonPlan({ dob: '1937-01-01', planningAge: 90 }).household.people[0]!
    const last = {
      ...first,
      name: 'Last duplicate',
      dob: '1960-01-01',
    }
    const people = [first, last]
    const states = [
      { personId: first.id, ageAttained: 62, alive: true },
      { personId: last.id, ageAttained: 90, alive: false },
    ] satisfies PersonYearState[]
    const stream = ss('duplicate-person', first.id, 1_000, { years: 62, months: 0 })
    const result = call({
      incomes: [stream],
      people,
      personById: new Map(people.map((person) => [person.id, person])),
      stateOf: (personId) => states.find((state) => state.personId === personId)!,
      resolvedPiaByStreamId: new Map([[stream.id, 1_000]]),
    })

    // The last duplicate supplies the 1960 DOB (70.8333% age-62 factor for its
    // 66y8m FRA), while the first duplicate supplies the living age-62 state.
    // Unifying either lookup changes this exact amount or suppresses it.
    expect(result.socialSecurity).toBe(8_500)
    expect(result.socialSecurityStreams).toHaveLength(1)
    expect(result.socialSecurityStreams[0]).toMatchObject({
      personId: first.id,
      streamId: stream.id,
      annualAmount: 8_500,
      claimInForce: true,
    })
  })

  it('preserves duplicate stream occurrences and the first publication entry', () => {
    const people = couplePlan({
      p1Dob: '1960-01-01',
      p2Dob: '1960-01-01',
      p1PlanningAge: 90,
      p2PlanningAge: 90,
    }).household.people
    const incomes = [
      ss('duplicate-stream', people[0]!.id, 1_000),
      ss('duplicate-stream', people[1]!.id, 1_000),
    ]
    const perPerson = 1_000 * claimFactor(1960, 1, 1, { years: 67, months: 0 }) * 12
    const result = call({
      incomes,
      ...peopleAndStates(people, [
        { personId: people[0]!.id, ageAttained: 67, alive: true },
        { personId: people[1]!.id, ageAttained: 67, alive: true },
      ]),
      resolvedPiaByStreamId: new Map([['duplicate-stream', 1_000]]),
    })

    expect(result.socialSecurity).toBe(perPerson + perPerson)
    expect(result.socialSecurityStreams).toEqual([
      {
        personId: people[0]!.id,
        streamId: 'duplicate-stream',
        source: 'own-retirement',
        annualAmount: perPerson,
        claimInForce: true,
        preWithholdingAnnual: perPerson + perPerson,
        isSpousalSurvivorGateStream: true,
      },
      {
        personId: people[1]!.id,
        streamId: 'duplicate-stream',
        source: 'own-retirement',
        annualAmount: 0,
        claimInForce: true,
        preWithholdingAnnual: perPerson + perPerson,
        isSpousalSurvivorGateStream: true,
      },
    ])
  })

  it('does not mutate any input collection or element', () => {
    const basePerson = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 }).household.people[0]!
    const person = Object.freeze({
      ...basePerson,
      longevity: Object.freeze({ ...basePerson.longevity }),
    })
    const stream = Object.freeze({
      ...ss('frozen', person.id, 1_000),
      claimAge: Object.freeze({ years: 67, months: 0 }),
    })
    const state = Object.freeze<PersonYearState>({
      personId: person.id,
      ageAttained: 67,
      alive: true,
    })
    const incomes = Object.freeze([stream])
    const people = Object.freeze([person])
    const personById = new Map([[person.id, person]])
    const states = new Map([[state.personId, state]])
    const resolvedPiaByStreamId = new Map([[stream.id, 1_000]])
    const wagesByPerson = new Map([[person.id, 123]])
    const withheldMonthsByPerson = new Map([[person.id, 4]])
    const pack = packForYear(2026).pack
    const before = {
      personById: [...personById],
      states: [...states],
      resolvedPiaByStreamId: [...resolvedPiaByStreamId],
      wagesByPerson: [...wagesByPerson],
      withheldMonthsByPerson: [...withheldMonthsByPerson],
      pack: structuredClone(pack),
    }
    const input = Object.freeze<AnnualSocialSecurityInput>({
      incomes,
      people,
      personById,
      stateOf: (personId) => states.get(personId)!,
      resolvedPiaByStreamId,
      wagesByPerson,
      withheldMonthsByPerson,
      year: 2027,
      ssColaFactor: 1,
      ssHaircutFactor: 1,
      pack,
      limitGrowth: 1,
    })

    const first = annualSocialSecurity(input)
    const second = annualSocialSecurity(input)

    expect(second).toEqual(first)
    expect([...personById]).toEqual(before.personById)
    expect([...states]).toEqual(before.states)
    expect([...resolvedPiaByStreamId]).toEqual(before.resolvedPiaByStreamId)
    expect([...wagesByPerson]).toEqual(before.wagesByPerson)
    expect([...withheldMonthsByPerson]).toEqual(before.withheldMonthsByPerson)
    expect(pack).toEqual(before.pack)
    expect(incomes).toEqual([stream])
    expect(people).toEqual([person])
  })

  it('preserves the positive-zero result of folding a negative-zero benefit', () => {
    const person = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 }).household.people[0]!
    const stream = ss('negative-zero', person.id, -0)
    const result = call({
      incomes: [stream],
      ...peopleAndStates([person], [{ personId: person.id, ageAttained: 67, alive: true }]),
      resolvedPiaByStreamId: new Map([[stream.id, -0]]),
    })

    expect(Object.is(result.socialSecurity, 0)).toBe(true)
    expect(Object.is(result.socialSecurity, -0)).toBe(false)
    expect(Object.is(result.socialSecurityStreams[0]!.annualAmount, 0)).toBe(true)
    expect(Object.is(result.socialSecurityStreams[0]!.preWithholdingAnnual, 0)).toBe(true)
  })
})

describe('annualSocialSecurity — explicit effects', () => {
  it('returns earnings-test month writes and warnings without mutating inputs', () => {
    const person = singlePersonPlan({ dob: '1964-01-01', planningAge: 90 }).household.people[0]!
    const stream = ss('early', person.id, 2_000, { years: 62, months: 0 })
    const pack = packForYear(2026).pack
    const wages = 50_000
    const withheldMonths = new Map([[person.id, 2]])
    const preWithholding = 2_000 * claimFactor(1964, 1, 1, stream.claimAge) * 12
    const withheld = Math.min(
      (wages - pack.socialSecurity.earningsTestBelowFraAnnual) / 2,
      preWithholding,
    )
    const months = Math.min(12, Math.round((withheld / preWithholding) * 12))

    const result = call({
      incomes: [stream],
      ...peopleAndStates([person], [{ personId: person.id, ageAttained: 62, alive: true }]),
      resolvedPiaByStreamId: new Map([[stream.id, 2_000]]),
      wagesByPerson: new Map([[person.id, wages]]),
      withheldMonthsByPerson: withheldMonths,
      year: 2026,
      pack,
    })

    expect(result.ssEarningsTestWithheld).toBe(withheld)
    expect(result.socialSecurity).toBe(preWithholding - withheld)
    expect(result.withheldMonthWrites).toEqual([{ personId: person.id, value: 2 + months }])
    expect(result.warnings).toEqual([
      'The earnings test withheld benefits for working early claimants; withheld months are credited back at full retirement age (annual approximation).',
    ])
    expect([...withheldMonths]).toEqual([[person.id, 2]])
  })

  it('returns an SGA warning and publishes an in-force SSDI row with zero paid', () => {
    const person = singlePersonPlan({ dob: '1964-01-01', planningAge: 90 }).household.people[0]!
    const stream = {
      ...ss('ssdi', person.id, 2_000, { years: 62, months: 0 }),
      disability: { onsetAge: 60 },
    }
    const pack = packForYear(2026).pack
    const result = call({
      incomes: [stream],
      ...peopleAndStates([person], [{ personId: person.id, ageAttained: 62, alive: true }]),
      resolvedPiaByStreamId: new Map([[stream.id, 2_000]]),
      wagesByPerson: new Map([[person.id, pack.socialSecurity.sgaMonthlyNonBlind * 12 + 1]]),
      year: 2026,
      pack,
    })

    expect(result.socialSecurity).toBe(0)
    expect(result.ssdiPaid).toBe(0)
    expect(result.withheldMonthWrites).toEqual([])
    expect(result.warnings).toEqual([
      'Earnings above Substantial Gainful Activity (SGA) suspended Social Security disability (SSDI) for a working year.',
    ])
    expect(result.socialSecurityStreams).toEqual([{
      personId: person.id,
      streamId: stream.id,
      source: 'ssdi',
      annualAmount: 0,
      claimInForce: true,
      preWithholdingAnnual: 24_000,
      isSpousalSurvivorGateStream: true,
    }])
  })
})

describe('annualSocialSecurity — spouse precedence', () => {
  it('publishes the current-spouse top-up on the lower earner gate stream', () => {
    const people = couplePlan({ p1Dob: '1960-01-01', p2Dob: '1960-01-01' }).household.people
    const streams = [ss('low', 'p1', 1_000), ss('high', 'p2', 3_000)]
    const result = call({
      incomes: streams,
      ...peopleAndStates(people, [
        { personId: 'p1', ageAttained: 67, alive: true },
        { personId: 'p2', ageAttained: 67, alive: true },
      ]),
      resolvedPiaByStreamId: new Map([['low', 1_000], ['high', 3_000]]),
    })

    expect(result.socialSecurityStreams[0]).toMatchObject({
      streamId: 'low',
      source: 'spousal',
      claimInForce: true,
      isSpousalSurvivorGateStream: true,
    })
    expect(result.socialSecurityStreams[1]).toMatchObject({
      streamId: 'high',
      source: 'own-retirement',
      claimInForce: true,
      isSpousalSurvivorGateStream: true,
    })
  })

  it('keeps deceased-worker computation available for the living survivor step-up', () => {
    const people = couplePlan({ p1Dob: '1960-01-01', p2Dob: '1960-01-01' }).household.people
    const streams = [ss('survivor', 'p1', 1_000), ss('deceased', 'p2', 3_000)]
    const result = call({
      incomes: streams,
      ...peopleAndStates(people, [
        { personId: 'p1', ageAttained: 67, alive: true },
        { personId: 'p2', ageAttained: 67, alive: false },
      ]),
      resolvedPiaByStreamId: new Map([['survivor', 1_000], ['deceased', 3_000]]),
    })

    expect(result.socialSecurity).toBe(36_480.00000000001)
    expect(result.socialSecurityStreams).toEqual([
      {
        personId: 'p1',
        streamId: 'survivor',
        source: 'survivor',
        annualAmount: 36_480.00000000001,
        claimInForce: true,
        preWithholdingAnnual: 36_480.00000000001,
        isSpousalSurvivorGateStream: true,
      },
      {
        personId: 'p2',
        streamId: 'deceased',
        source: 'none',
        annualAmount: 0,
        claimInForce: false,
        preWithholdingAnnual: 0,
        isSpousalSurvivorGateStream: true,
      },
    ])
  })
})
