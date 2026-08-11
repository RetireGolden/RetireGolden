import { describe, expect, it } from 'vitest'

import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { ssClaimMilestone } from './ssClaimMilestone.js'

type StreamSource = 'own-retirement' | 'ssdi' | 'spousal' | 'survivor' | 'none'

function withSsStreams(
  years: Array<{
    year: number
    people: { personId: string; ageAttained: number; alive: boolean }[]
    socialSecurityStreams?: {
      personId: string
      streamId: string
      source: StreamSource
      annualAmount: number
      claimInForce: boolean
      preWithholdingAnnual: number
      isSpousalSurvivorGateStream: boolean
    }[]
  }>,
  personId: string,
  streamId: string,
  firstClaimYear: number,
  annualAmount = 24_000,
  source: StreamSource = 'own-retirement',
  options: { claimInForceWithZeroPay?: boolean } = {},
) {
  for (const year of years) {
    const prior = (year.socialSecurityStreams ?? []).filter(
      (entry) => !(entry.personId === personId && entry.streamId === streamId),
    )
    const inForce = year.year >= firstClaimYear
    const pay = inForce
      ? (options.claimInForceWithZeroPay ? 0 : annualAmount)
      : 0
    year.socialSecurityStreams = [
      ...prior,
      {
        personId,
        streamId,
        source: inForce ? source : 'none',
        annualAmount: pay,
        claimInForce: inForce,
        preWithholdingAnnual: inForce ? annualAmount : 0,
        isSpousalSurvivorGateStream: true,
      },
    ]
  }
}

function context(ageAtStart = 67, claimYears = 67, claimMonths = 6, includesClaimYear = true): DetectorContext {
  const plan = singlePersonPlan({ dob: '1960-01-01' })
  plan.incomes = [
    {
      id: 'ss',
      type: 'socialSecurity',
      personId: 'p1',
      piaMonthly: 2_000,
      earnings: null,
      claimAge: { years: claimYears, months: claimMonths },
    },
  ] as never
  const finalYear = includesClaimYear ? Math.max(2026, 1960 + claimYears) : 2026
  const years = Array.from({ length: finalYear - 2026 + 1 }, (_, offset) => ({
    year: 2026 + offset,
    people: [{ personId: 'p1', ageAttained: ageAtStart + offset, alive: true }],
  }))
  const firstClaimYear = 1960 + claimYears
  if (includesClaimYear) {
    withSsStreams(years, 'p1', 'ss', firstClaimYear)
  } else {
    withSsStreams(years, 'p1', 'ss', 9999)
  }
  return {
    plan,
    params: { year: 2026 },
    projection: {
      startYear: 2026,
      result: { years },
    },
  } as unknown as DetectorContext
}

describe('Social Security claim milestone detector', () => {
  it('flags a claim within one year as attention with exact claim evidence', () => {
    const card = ssClaimMilestone.screen(context())

    // Published first claim-in-force year = 2027 (dobYear + claimAge.years).
    expect(card).toMatchObject({
      severity: 'attention',
      plannerRoute: 'social-security-analysis',
      evidence: [
        { label: "Pat's modeled claim age (configured filing age)", value: '67 years 6 months' },
        { label: "Pat's attained age in first payable year", value: '67', year: 2027 },
        { label: 'Age at projection start (2026)', value: '67', year: 2026 },
        { label: 'Modeled first claim year (claim in force; partial when claim months > 0)', value: '2027', year: 2027 },
        { label: "Pat's modeled benefit in first claim year (own retirement)", value: '$24,000', year: 2027 },
      ],
    })
  })

  it('uses the published first claim-in-force year for non-January birthdays', () => {
    const ctx = context()
    ctx.plan.household.people[0]!.dob = '1960-11-15'
    const card = ssClaimMilestone.screen(ctx)
    // Milestone year is the published first claim-in-force year (2027).
    expect(card?.evidence.find((e) => e.label.startsWith('Modeled first claim year'))?.value).toBe('2027')
  })

  it('uses info for a decision two model years away and stays silent just beyond two years', () => {
    expect(ssClaimMilestone.screen(context(66, 68, 0))?.severity).toBe('info')
    expect(ssClaimMilestone.screen(context(67, 69, 1))).toBeNull()
  })

  it('stays silent when the published benefit source is SSDI', () => {
    const ctx = context()
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    withSsStreams(years, 'p1', 'ss', 2027, 24_000, 'ssdi')
    const income = ctx.plan.incomes[0] as { disability?: { onsetAge: number } }
    income.disability = { onsetAge: 60 }

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('fires when disability.onsetAge is at/after FRA (invalid SSDI falls through to retirement)', () => {
    // simulate treats onsetAge >= FRA as invalid SSDI metadata and publishes
    // normal own-retirement — never source `ssdi`. The detector must not
    // suppress that stream as an automatic FRA conversion.
    const ctx = context(66, 67, 0)
    const income = ctx.plan.incomes[0] as { disability?: { onsetAge: number }; piaMonthly: number }
    income.disability = { onsetAge: 70 } // FRA for 1960 birth is 67
    income.piaMonthly = 2_000
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    // Truthful publication: own-retirement only (no ssdi year), claim in 2027.
    withSsStreams(years, 'p1', 'ss', 2027, 24_000, 'own-retirement')

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'attention',
      evidence: expect.arrayContaining([
        {
          label: "Pat's modeled benefit in first claim year (own retirement)",
          value: '$24,000',
          year: 2027,
        },
      ]),
    })
  })

  it('uses effectiveBirthYear for the onsetAge < FRA gate (1960-01-01 → FRA 66y10m)', () => {
    // Jan-1 DOB uses prior calendar year for FRA. 1960-01-01 → effective 1959 →
    // FRA 66y10m (fra.years = 66). Calendar-year FRA for 1960 is 67; without
    // the Jan-1 rule, onsetAge 66 would wrongly count as valid SSDI and suppress
    // a horizon-start own-retirement stream as an automatic FRA conversion.
    // claimAge.years = 67 so the claim-age pre-horizon arm (age > claimAge.years)
    // does not fire at age 67 — only the disability FRA gate can suppress.
    const ctx = context(67, 67, 0)
    expect(ctx.plan.household.people[0]!.dob).toBe('1960-01-01')
    const income = ctx.plan.incomes[0] as { disability?: { onsetAge: number }; piaMonthly: number }
    income.disability = { onsetAge: 66 }
    income.piaMonthly = 2_000
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss',
          source: 'own-retirement',
          annualAmount: 24_000,
          claimInForce: true,
          preWithholdingAnnual: 24_000,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    // onsetAge 66 is not < effective FRA years 66 → not a conversion suppress.
    // Without effectiveBirthYear, onsetAge 66 < calendar FRA 67 would silence.
    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'attention',
    })
  })

  it('stays silent when SSDI converts to own-retirement at FRA (no application)', () => {
    // Pre-FRA years publish source ssdi; FRA year publishes own-retirement for
    // the same dollars. That conversion is not a filing decision.
    const ctx = context(66, 67, 0)
    const income = ctx.plan.incomes[0] as { disability?: { onsetAge: number }; piaMonthly: number }
    income.disability = { onsetAge: 55 }
    income.piaMonthly = 2_000
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      const atFra = year.year >= 2027
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss',
          source: atFra ? 'own-retirement' : 'ssdi',
          annualAmount: 24_000,
          claimInForce: true,
          preWithholdingAnnual: 24_000,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('stays silent when post-FRA converted own-retirement is already in force at horizon start', () => {
    // Horizon starts at FRA with source own-retirement on a disability stream —
    // automatic conversion already happened; not a claim milestone.
    const ctx = context(67, 67, 0)
    const income = ctx.plan.incomes[0] as { disability?: { onsetAge: number }; piaMonthly: number }
    income.disability = { onsetAge: 55 }
    income.piaMonthly = 2_000
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss',
          source: 'own-retirement',
          annualAmount: 24_000,
          claimInForce: true,
          preWithholdingAnnual: 24_000,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('stays silent when an SSDI-at-start stream later transitions to survivor', () => {
    // Stream already paying SSDI at horizon start; source becomes 'survivor' later.
    // That is not a new filing decision — pre-horizon must include SSDI-at-start rows.
    const ctx = context(55, 67, 0)
    const income = ctx.plan.incomes[0] as { disability?: { onsetAge: number }; piaMonthly: number }
    income.disability = { onsetAge: 50 }
    income.piaMonthly = 2_000
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      const survivor = year.year >= 2027
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss',
          source: survivor ? 'survivor' : 'ssdi',
          annualAmount: 24_000,
          claimInForce: true,
          preWithholdingAnnual: 24_000,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('fires when a zero-benefit SSDI stream at start later pays an auxiliary claim', () => {
    // Zero-PIA SSDI can publish claim-in-force with $0/$0 at horizon start.
    // That is not "already claimed" — a later positive auxiliary (spousal)
    // claim on the same stream must still surface.
    const ctx = context(66, 62, 0)
    const income = ctx.plan.incomes[0] as {
      disability?: { onsetAge: number }
      piaMonthly: number
    }
    income.disability = { onsetAge: 50 }
    income.piaMonthly = 0
    ctx.plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1960-01-01',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 95, source: 'manual' },
    })
    ctx.plan.incomes.push({
      id: 'ss-spouse',
      type: 'socialSecurity',
      personId: 'p2',
      piaMonthly: 2_000,
      earnings: null,
      claimAge: { years: 70, months: 0 },
    } as never)
    ctx.projection.result.years = Array.from({ length: 3 }, (_, offset) => ({
      year: 2026 + offset,
      people: [
        { personId: 'p1', ageAttained: 66 + offset, alive: true },
        { personId: 'p2', ageAttained: 66 + offset, alive: true },
      ],
      socialSecurityStreams: [] as {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[],
    })) as never
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      const auxiliary = year.year >= 2028
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss',
          source: auxiliary ? 'spousal' : 'ssdi',
          annualAmount: auxiliary ? 12_000 : 0,
          claimInForce: true,
          preWithholdingAnnual: auxiliary ? 12_000 : 0,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'info',
      evidence: expect.arrayContaining([
        { label: "Pat's modeled benefit in first claim year (spousal)", value: '$12,000', year: 2028 },
      ]),
    })
  })

  it('fires for a claim at 68 years 1 month exactly two model years away', () => {
    const card = ssClaimMilestone.screen(context(66, 68, 1))

    expect(card?.severity).toBe('info')
    expect(card?.evidence).toContainEqual({
      label: "Pat's modeled claim age (configured filing age)",
      value: '68 years 1 month',
    })
    expect(card?.evidence).toContainEqual({
      label: "Pat's attained age in first payable year",
      value: '68',
      year: 2028,
    })
    expect(card?.evidence).toContainEqual({
      label: 'Modeled first claim year (claim in force; partial when claim months > 0)',
      value: '2028',
      year: 2028,
    })
  })

  it('stays silent when the published claim never becomes in force', () => {
    const ctx = context()
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    withSsStreams(years, 'p1', 'ss', 9999)
    const income = ctx.plan.incomes[0] as { piaMonthly: number | null; earnings: unknown[] | null }
    income.piaMonthly = null
    income.earnings = null

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('stays silent when claim is never in force across the horizon', () => {
    const ctx = context()
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    withSsStreams(years, 'p1', 'ss', 9999)

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('fires when claim is in force even if earnings-test withholding zeros the paid amount', () => {
    const ctx = context()
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    withSsStreams(years, 'p1', 'ss', 2027, 24_000, 'own-retirement', {
      claimInForceWithZeroPay: true,
    })

    const card = ssClaimMilestone.screen(ctx)
    expect(card).toMatchObject({
      severity: 'attention',
    })
    // Fully withheld: pre-withholding (claim-age-sensitive) and paid $0, ≤5 evidence.
    expect(card?.evidence).toEqual(
      expect.arrayContaining([
        {
          label: "Pat's pre-withholding modeled benefit in first claim year (own retirement)",
          value: '$24,000',
          year: 2027,
        },
        {
          label:
            "Pat's paid amount in first claim year (earnings test / SGA withheld to $0; own retirement)",
          value: '$0',
          year: 2027,
        },
      ]),
    )
    expect(card?.evidence.length).toBeLessThanOrEqual(5)
    // Age-at-start is omitted to stay within the GOVERNANCE cap when dual benefit rows are present.
    expect(card?.evidence.some((e) => e.label.startsWith('Age at projection start'))).toBe(false)
  })

  it('stays silent for a pre-horizon claim already in force at the start year', () => {
    // Claim age 62; person is 70 at horizon start — first published in-force row
    // is year 0 of the projection, but the filing decision already happened.
    const ctx = context(70, 62, 0)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    // context() sets first claim year to dobYear + claimYears = 2022; force
    // in-horizon continuation from the start year instead.
    withSsStreams(years, 'p1', 'ss', 2026, 24_000, 'own-retirement')

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('stays silent when claim is in force but nothing is modeled pre-withholding', () => {
    // $0 paid with $0 pre-withholding is not an earnings-test story — unmodeled.
    // Claim age year is 2022 (dob 1960 + 62); in-horizon zeros have no filing-age
    // transition, so the unmodeled-zero skip applies (distinct from override filing).
    const ctx = context(70, 62, 0)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss',
          source: 'own-retirement',
          annualAmount: 0,
          claimInForce: true,
          preWithholdingAnnual: 0,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('fires for a spousal-source claim from the published first claim-in-force year', () => {
    const ctx = context(66, 68, 0)
    const income = ctx.plan.incomes[0] as { piaMonthly: number }
    income.piaMonthly = 0
    ctx.plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1960-01-01',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 95, source: 'manual' },
    })
    ctx.plan.incomes.push({
      id: 'ss-spouse',
      type: 'socialSecurity',
      personId: 'p2',
      piaMonthly: 2_000,
      earnings: null,
      claimAge: { years: 70, months: 0 },
    } as never)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.people.push({ personId: 'p2', ageAttained: year.year - 1960, alive: true })
    }
    withSsStreams(years, 'p1', 'ss', 2028, 12_000, 'spousal')
    withSsStreams(years, 'p2', 'ss-spouse', 9999)

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'info',
      evidence: expect.arrayContaining([
        { label: 'Modeled first claim year (claim in force)', value: '2028', year: 2028 },
      ]),
    })
  })

  it('uses the published first claim-in-force year for a survivor-source benefit', () => {
    const ctx = context(66, 68, 0)
    const income = ctx.plan.incomes[0] as { piaMonthly: number }
    income.piaMonthly = 0
    ctx.plan.household.people.push({
      id: 'p2', name: 'Sam', dob: '1960-01-01', sex: 'average', retirementAge: null,
      longevity: { planningAge: 95, source: 'manual' },
    })
    ctx.plan.incomes.push({
      id: 'ss-spouse', type: 'socialSecurity', personId: 'p2', piaMonthly: 2_000,
      earnings: null, claimAge: { years: 68, months: 0 },
    } as never)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.people.push({ personId: 'p2', ageAttained: year.year - 1960, alive: year.year < 2028 })
    }
    withSsStreams(years, 'p1', 'ss', 2028, 24_000, 'survivor')

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'info',
      evidence: expect.arrayContaining([
        { label: "Pat's modeled benefit in first claim year (survivor)", value: '$24,000', year: 2028 },
      ]),
    })
  })

  it('stays silent when a published claim starts beyond the two-year window', () => {
    const ctx = context(66, 68, 0)
    const income = ctx.plan.incomes[0] as { piaMonthly: number }
    income.piaMonthly = 0
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    withSsStreams(years, 'p1', 'ss', 2030, 12_000, 'spousal')

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('fires for a former-spouse spousal source from published stream activity', () => {
    const ctx = context(66, 68, 0)
    const income = ctx.plan.incomes[0] as { piaMonthly: number; formerSpouses?: unknown[] }
    income.piaMonthly = 0
    income.formerSpouses = [{
      id: 'former-spouse',
      relationship: 'divorced',
      dob: '1950-01-01',
      piaMonthly: 2_000,
      marriageYears: 12,
      remarriedAtAge: null,
    }]
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    withSsStreams(years, 'p1', 'ss', 2028, 12_000, 'spousal')

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'info',
    })
  })

  it('fires when a living former spouse first reaches eligibility age 62 at the start year', () => {
    // Claimant already past own claim age; first positive spousal at horizon start
    // because the living former spouse turns 62 in 2026 — enabling event at start,
    // not pre-horizon already-paying.
    const ctx = context(66, 62, 0)
    ctx.plan.incomes = [
      {
        id: 'ss',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 0,
        earnings: null,
        claimAge: { years: 62, months: 0 },
        formerSpouses: [
          {
            id: 'former-spouse',
            relationship: 'divorced',
            // Age 62 at start year 2026 → first eligibility year.
            dob: '1964-01-01',
            piaMonthly: 2_000,
            marriageYears: 12,
            remarriedAtAge: null,
          },
        ],
      },
    ] as never
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss',
          source: 'spousal',
          annualAmount: 12_000,
          claimInForce: true,
          preWithholdingAnnual: 12_000,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'attention',
      evidence: expect.arrayContaining([
        {
          label: 'Modeled first claim year (claim in force)',
          value: '2026',
          year: 2026,
        },
        { label: "Pat's modeled benefit in first claim year (spousal)", value: '$12,000', year: 2026 },
      ]),
    })
  })

  it('stays silent when former-spouse spousal is already paying and the ex was eligible pre-horizon', () => {
    // Living former spouse already well past 62 before start — enabling event
    // predates the horizon; positive spousal at start is already-paying.
    const ctx = context(70, 62, 0)
    ctx.plan.incomes = [
      {
        id: 'ss',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 0,
        earnings: null,
        claimAge: { years: 62, months: 0 },
        formerSpouses: [
          {
            id: 'former-spouse',
            relationship: 'divorced',
            dob: '1950-01-01', // age 76 at 2026
            piaMonthly: 2_000,
            marriageYears: 12,
            remarriedAtAge: null,
          },
        ],
      },
    ] as never
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss',
          source: 'spousal',
          annualAmount: 12_000,
          claimInForce: true,
          preWithholdingAnnual: 12_000,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('stays silent when already-paying former-spouse spousal wins over earnings-resolved own PIA', () => {
    // piaMonthly null but usable earnings: winning-anchor prior-year comparison
    // must resolve own PIA through the earnings path (same as the sim) before
    // comparing to the former-spouse benefit. Null PIA alone used to short-
    // circuit and misclassify the start-row spousal as a NEW entitlement.
    const earnings = []
    for (let y = 1984; y <= 2023; y++) earnings.push({ year: y, amount: 5_000 })
    const ctx = context(70, 62, 0)
    ctx.plan.incomes = [
      {
        id: 'ss',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: null,
        earnings,
        claimAge: { years: 62, months: 0 },
        formerSpouses: [
          {
            id: 'former-spouse',
            relationship: 'divorced',
            dob: '1950-01-01', // age 76 at 2026 — eligible well before start
            piaMonthly: 4_000,
            marriageYears: 12,
            remarriedAtAge: null,
          },
        ],
      },
    ] as never
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss',
          source: 'spousal',
          annualAmount: 24_000,
          claimInForce: true,
          preWithholdingAnnual: 24_000,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('stays silent when already-paying former-spouse spousal has null own PIA and no usable earnings', () => {
    // Claim age pre-horizon; living former already eligible pre-horizon; published
    // payable aux at start. Without entered PIA or earnings the detector cannot
    // prove a prior-year win over own — but the enabler predates the horizon, so
    // the start-year aux is already-paying (enabling-event rule), not a new claim.
    const ctx = context(70, 62, 0)
    ctx.plan.incomes = [
      {
        id: 'ss',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: null,
        earnings: null,
        claimAge: { years: 62, months: 0 },
        formerSpouses: [
          {
            id: 'former-spouse',
            relationship: 'divorced',
            dob: '1950-01-01', // age 76 at 2026 — eligible well before start
            piaMonthly: 4_000,
            marriageYears: 12,
            remarriedAtAge: null,
          },
        ],
      },
    ] as never
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss',
          source: 'spousal',
          annualAmount: 24_000,
          claimInForce: true,
          preWithholdingAnnual: 24_000,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('does not treat an ineligible living former spouse as a pre-horizon enabling event', () => {
    // Age-only gate would treat a long-ago-born ex as already-eligible pre-horizon
    // even when marriageYears < 10 cannot enable divorced-spousal under
    // maritalBenefitFor. Positive spousal at start must still surface.
    const ctx = context(70, 62, 0)
    ctx.plan.incomes = [
      {
        id: 'ss',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 0,
        earnings: null,
        claimAge: { years: 62, months: 0 },
        formerSpouses: [
          {
            id: 'former-spouse',
            relationship: 'divorced',
            dob: '1950-01-01', // age 76 at 2026 — age-only would pass
            piaMonthly: 2_000,
            marriageYears: 9, // short of DIVORCED_MIN_MARRIAGE_YEARS
            remarriedAtAge: null,
          },
        ],
      },
    ] as never
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss',
          source: 'spousal',
          annualAmount: 12_000,
          claimInForce: true,
          preWithholdingAnnual: 12_000,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'attention',
      evidence: expect.arrayContaining([
        {
          label: 'Modeled first claim year (claim in force)',
          value: '2026',
          year: 2026,
        },
      ]),
    })
  })

  it('does not treat an eligible low-PIA former spouse as already-paying when they never won over own', () => {
    // Older eligible ex produces less than own benefit pre-horizon; a second
    // high-PIA ex turns 62 at start and causes the first actual spousal payment.
    // Eligibility alone would suppress the NEW start-year entitlement.
    const ctx = context(70, 62, 0)
    ctx.plan.incomes = [
      {
        id: 'ss',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 2_000, // own > 50% of low-PIA ex
        earnings: null,
        claimAge: { years: 62, months: 0 },
        formerSpouses: [
          {
            id: 'low-pia-ex',
            relationship: 'divorced',
            dob: '1950-01-01', // eligible well before start
            piaMonthly: 500, // 50% * factor << own
            marriageYears: 12,
            remarriedAtAge: null,
          },
          {
            id: 'high-pia-ex',
            relationship: 'divorced',
            dob: '1964-01-01', // turns 62 in 2026 — first eligibility at start
            piaMonthly: 4_000,
            marriageYears: 12,
            remarriedAtAge: null,
          },
        ],
      },
    ] as never
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss',
          source: 'spousal',
          annualAmount: 18_000,
          claimInForce: true,
          preWithholdingAnnual: 18_000,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'attention',
      evidence: expect.arrayContaining([
        {
          label: 'Modeled first claim year (claim in force)',
          value: '2026',
          year: 2026,
        },
      ]),
    })
  })

  it('stays silent when the projection does not reach a claim-in-force year', () => {
    expect(ssClaimMilestone.screen(context(67, 67, 6, false))).toBeNull()
  })

  it('selects the most imminent qualifying claim in household order', () => {
    const ctx = context(66, 68, 0)
    ctx.plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1960-01-01',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 95, source: 'manual' },
    })
    ctx.plan.incomes.push({
      id: 'ss-p2',
      type: 'socialSecurity',
      personId: 'p2',
      piaMonthly: 2_000,
      earnings: null,
      claimAge: { years: 67, months: 0 },
    } as never)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.people.push({ personId: 'p2', ageAttained: year.year - 1960, alive: true })
    }
    withSsStreams(years, 'p1', 'ss', 2028)
    withSsStreams(years, 'p2', 'ss-p2', 2027)

    expect(ssClaimMilestone.screen(ctx)?.title).toBe("Sam's Social Security claim is imminent")
  })

  it('attributes claim-age evidence to the stream that is claim-in-force', () => {
    const ctx = context(66, 68, 0)
    ctx.plan.incomes.push({
      id: 'ss-imminent',
      type: 'socialSecurity',
      personId: 'p1',
      piaMonthly: 2_000,
      earnings: null,
      claimAge: { years: 67, months: 0 },
    } as never)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    // Only the imminent stream is claim-in-force in 2027; the later-claim stream is not.
    for (const year of years) {
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss',
          source: 'none',
          annualAmount: 0,
          claimInForce: false,
          preWithholdingAnnual: 0,
          isSpousalSurvivorGateStream: false,
        },
        {
          personId: 'p1',
          streamId: 'ss-imminent',
          source: year.year >= 2027 ? 'own-retirement' : 'none',
          annualAmount: year.year >= 2027 ? 24_000 : 0,
          claimInForce: year.year >= 2027,
          preWithholdingAnnual: year.year >= 2027 ? 24_000 : 0,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'attention',
      evidence: expect.arrayContaining([
        { label: "Pat's modeled claim age (configured filing age)", value: '67 years 0 months' },
        { label: "Pat's attained age in first payable year", value: '67', year: 2027 },
      ]),
    })
  })

  it('prefers a positive-paying sibling over a zero-pay gate stream in the same claim year', () => {
    // Own-retirement pays; a zero-PIA spousal/survivor gate stream also becomes
    // claim-in-force the same year — report the paying stream and its amounts.
    const ctx = context(66, 67, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-own',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 67, months: 0 },
      },
      {
        id: 'ss-gate',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 0,
        earnings: null,
        claimAge: { years: 67, months: 0 },
      },
    ] as never
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      const inForce = year.year >= 2027
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss-gate',
          source: inForce ? 'spousal' : 'none',
          annualAmount: 0,
          claimInForce: inForce,
          preWithholdingAnnual: inForce ? 0 : 0,
          isSpousalSurvivorGateStream: true,
        },
        {
          personId: 'p1',
          streamId: 'ss-own',
          source: inForce ? 'own-retirement' : 'none',
          annualAmount: inForce ? 24_000 : 0,
          claimInForce: inForce,
          preWithholdingAnnual: inForce ? 24_000 : 0,
          isSpousalSurvivorGateStream: false,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'attention',
      evidence: expect.arrayContaining([
        { label: "Pat's modeled claim age (configured filing age)", value: '67 years 0 months' },
        { label: "Pat's attained age in first payable year", value: '67', year: 2027 },
        { label: "Pat's modeled benefit in first claim year (own retirement)", value: '$24,000', year: 2027 },
      ]),
    })
  })

  it('continues past an already-claimed sibling to surface a later imminent stream', () => {
    // Stream A already claimed years ago (in force at horizon start); stream B
    // claims next year. Pre-horizon skip is per stream — B still fires.
    const ctx = context(70, 62, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-already',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 1_500,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
      {
        id: 'ss-imminent',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 71, months: 0 },
      },
    ] as never
    // Extend horizon through the imminent claim year (age 71 → 2027).
    ctx.projection.result.years = Array.from({ length: 3 }, (_, offset) => ({
      year: 2026 + offset,
      people: [{ personId: 'p1', ageAttained: 70 + offset, alive: true }],
      socialSecurityStreams: [
        {
          personId: 'p1',
          streamId: 'ss-already',
          source: 'own-retirement' as StreamSource,
          annualAmount: 18_000,
          claimInForce: true,
          preWithholdingAnnual: 18_000,
          isSpousalSurvivorGateStream: false,
        },
        {
          personId: 'p1',
          streamId: 'ss-imminent',
          source: (2026 + offset >= 2027 ? 'own-retirement' : 'none') as StreamSource,
          annualAmount: 2026 + offset >= 2027 ? 24_000 : 0,
          claimInForce: 2026 + offset >= 2027,
          preWithholdingAnnual: 2026 + offset >= 2027 ? 24_000 : 0,
          isSpousalSurvivorGateStream: true,
        },
      ],
    })) as never

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'attention',
      evidence: expect.arrayContaining([
        { label: "Pat's modeled claim age (configured filing age)", value: '71 years 0 months' },
        // dob 1960 → age 67 in 2027 (annual-ledger); fixture people.ageAttained is independent.
        { label: "Pat's attained age in first payable year", value: '67', year: 2027 },
        // age 67 < claimAge 71 → payableMonths 0 (< 12) keeps the partial footnote.
        { label: 'Modeled first claim year (claim in force; partial when claim months > 0)', value: '2027', year: 2027 },
        { label: "Pat's modeled benefit in first claim year (own retirement)", value: '$24,000', year: 2027 },
      ]),
    })
  })

  it('continues past a zero-PIA claim-in-force row to a later positive sibling stream', () => {
    // Zero-PIA stream is claim-in-force with both amounts zero (unmodeled) but its
    // claim-age year (2022 = 1960+62) is pre-horizon — no filing-age transition
    // in-window. A sibling stream starts a positive claim in 2028 — the empty
    // row must not abort the person's search.
    const ctx = context(66, 67, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-zero-pia',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 0,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
      {
        id: 'ss-sibling',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 68, months: 0 },
      },
    ] as never
    ctx.projection.result.years = Array.from({ length: 3 }, (_, offset) => {
      const y = 2026 + offset
      return {
        year: y,
        people: [{ personId: 'p1', ageAttained: 66 + offset, alive: true }],
        socialSecurityStreams: [
          {
            personId: 'p1',
            streamId: 'ss-zero-pia',
            source: 'own-retirement' as StreamSource,
            annualAmount: 0,
            claimInForce: true,
            preWithholdingAnnual: 0,
            isSpousalSurvivorGateStream: true,
          },
          {
            personId: 'p1',
            streamId: 'ss-sibling',
            source: (y >= 2028 ? 'own-retirement' : 'none') as StreamSource,
            annualAmount: y >= 2028 ? 24_000 : 0,
            claimInForce: y >= 2028,
            preWithholdingAnnual: y >= 2028 ? 24_000 : 0,
            isSpousalSurvivorGateStream: false,
          },
        ],
      }
    }) as never

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'info',
      evidence: expect.arrayContaining([
        { label: "Pat's modeled claim age (configured filing age)", value: '68 years 0 months' },
        { label: "Pat's attained age in first payable year", value: '68', year: 2028 },
        {
          label: 'Modeled first claim year (claim in force)',
          value: '2028',
          year: 2028,
        },
        { label: "Pat's modeled benefit in first claim year (own retirement)", value: '$24,000', year: 2028 },
      ]),
    })
  })

  it('fires for a claimInForce stream zeroed by auxiliary override at its filing age', () => {
    // Gate stream already pays an auxiliary benefit; sibling own-retirement reaches
    // filing age with claimInForce true while override zeroes source/amounts.
    // Published contract: claimInForce is the filing fact — still a real decision.
    const ctx = context(66, 67, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-gate',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 0,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
      {
        id: 'ss-own',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 67, months: 0 },
      },
    ] as never
    ctx.projection.result.years = Array.from({ length: 3 }, (_, offset) => {
      const y = 2026 + offset
      const ownFiling = y >= 2027
      return {
        year: y,
        people: [{ personId: 'p1', ageAttained: 66 + offset, alive: true }],
        socialSecurityStreams: [
          {
            personId: 'p1',
            streamId: 'ss-gate',
            source: 'spousal' as StreamSource,
            annualAmount: 12_000,
            claimInForce: true,
            preWithholdingAnnual: 12_000,
            isSpousalSurvivorGateStream: true,
          },
          {
            personId: 'p1',
            streamId: 'ss-own',
            // Override zeroes published source/amounts; claimInForce remains the filing fact.
            source: (ownFiling ? 'none' : 'none') as StreamSource,
            annualAmount: 0,
            claimInForce: ownFiling,
            preWithholdingAnnual: 0,
            isSpousalSurvivorGateStream: false,
          },
        ],
      }
    }) as never

    // Gate is already-paying pre-horizon (positive spousal at start past claim age
    // with no household co-person — living former path not used; claim age 62 and
    // age 66). Own stream filing at 2027 still surfaces via filing-age transition.
    // Single household + positive spousal at start: auxiliaryAlreadyPaying needs
    // former spouse or co-person. Without either, former-spouse arm returns true
    // for spousal past claim age → gate is pre-horizon. Own stream fires.
    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'attention',
      evidence: expect.arrayContaining([
        { label: "Pat's modeled claim age (configured filing age)", value: '67 years 0 months' },
        {
          label: 'Modeled first claim year (claim in force)',
          value: '2027',
          year: 2027,
        },
        {
          label: "Pat's modeled benefit in first claim year (claim in force; none)",
          value: '$0',
          year: 2027,
        },
      ]),
    })
  })

  it('stays silent for unresolved empty stream rows (source none, not in force)', () => {
    // Unresolved streams publish { source: 'none', claimInForce: false, $0 }.
    // Milestone must treat them as unmodeled, not as filing decisions.
    const ctx = context(66, 68, 0)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss',
          source: 'none',
          annualAmount: 0,
          claimInForce: false,
          preWithholdingAnnual: 0,
          isSpousalSurvivorGateStream: false,
        },
      ]
    }
    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('stays silent for a zero-PIA sibling zeroed by auxiliary override at its claim-age year', () => {
    // Pin: aux override pays on the gate stream; a zero-PIA sibling reaches its
    // configured claim year with claimInForce + $0. Override-filing must require
    // a positive own resolved benefit — nothing would pay from this sibling's
    // own record, so the transition stays silent (distinct from positive-PIA
    // override-hidden filing).
    const ctx = context(66, 67, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-gate',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 0,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
      {
        id: 'ss-zero-sibling',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 0,
        earnings: null,
        claimAge: { years: 67, months: 0 },
      },
    ] as never
    ctx.projection.result.years = Array.from({ length: 3 }, (_, offset) => {
      const y = 2026 + offset
      const siblingFiling = y >= 2027
      return {
        year: y,
        people: [{ personId: 'p1', ageAttained: 66 + offset, alive: true }],
        socialSecurityStreams: [
          {
            personId: 'p1',
            streamId: 'ss-gate',
            source: 'spousal' as StreamSource,
            annualAmount: 12_000,
            claimInForce: true,
            preWithholdingAnnual: 12_000,
            isSpousalSurvivorGateStream: true,
          },
          {
            personId: 'p1',
            streamId: 'ss-zero-sibling',
            source: 'none' as StreamSource,
            annualAmount: 0,
            claimInForce: siblingFiling,
            preWithholdingAnnual: 0,
            isSpousalSurvivorGateStream: false,
          },
        ],
      }
    }) as never

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('stays silent for a plain zero-PIA claimInForce row at filing age with no auxiliary', () => {
    // Valid zero-PIA stream: claimInForce true, both amounts $0, configured
    // filing year in horizon — same published shape as override-hidden filing,
    // but no gate stream paying an auxiliary source. Must stay unmodeled.
    const ctx = context(66, 67, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-zero-pia',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 0,
        earnings: null,
        claimAge: { years: 67, months: 0 },
      },
    ] as never
    ctx.projection.result.years = Array.from({ length: 3 }, (_, offset) => {
      const y = 2026 + offset
      const atFiling = y >= 2027
      return {
        year: y,
        people: [{ personId: 'p1', ageAttained: 66 + offset, alive: true }],
        socialSecurityStreams: [
          {
            personId: 'p1',
            streamId: 'ss-zero-pia',
            source: (atFiling ? 'own-retirement' : 'none') as StreamSource,
            annualAmount: 0,
            claimInForce: atFiling,
            preWithholdingAnnual: 0,
            isSpousalSurvivorGateStream: true,
          },
        ],
      }
    }) as never

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('stays silent when an SSDI sibling is zeroed by auxiliary override at its claim-age year', () => {
    // SSDI sets claimInForce at its pay site; auxiliary override then zeroes
    // source/amounts on the sibling. That is not a retirement filing — the
    // override-filing-transition path must exclude SSDI-source-suppressed streams.
    // Former-spouse PIA must beat summed own (incl. the SSDI sibling) so the
    // start-year spousal is already-paying under the same ssOwnByPerson gate
    // the sim uses — otherwise the aux row would look like a NEW entitlement.
    const ctx = context(66, 67, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-aux',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 0,
        earnings: null,
        claimAge: { years: 62, months: 0 },
        formerSpouses: [
          {
            id: 'former-spouse',
            relationship: 'divorced',
            dob: '1950-01-01',
            piaMonthly: 8_000, // 50% × factor > SSDI $2,000/mo own
            marriageYears: 12,
            remarriedAtAge: null,
          },
        ],
      },
      {
        id: 'ss-ssdi',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 67, months: 0 },
        disability: { onsetAge: 55 },
      },
    ] as never
    ctx.projection.result.years = Array.from({ length: 3 }, (_, offset) => {
      const y = 2026 + offset
      const atClaimAgeYear = y >= 2027
      return {
        year: y,
        people: [{ personId: 'p1', ageAttained: 66 + offset, alive: true }],
        socialSecurityStreams: [
          {
            personId: 'p1',
            streamId: 'ss-aux',
            source: 'spousal' as StreamSource,
            annualAmount: 36_000,
            claimInForce: true,
            preWithholdingAnnual: 36_000,
            isSpousalSurvivorGateStream: true,
          },
          {
            personId: 'p1',
            streamId: 'ss-ssdi',
            // Override zeroed: claimInForce remains from SSDI pay site; not a filing.
            source: 'none' as StreamSource,
            annualAmount: 0,
            claimInForce: atClaimAgeYear,
            preWithholdingAnnual: 0,
            isSpousalSurvivorGateStream: false,
          },
        ],
      }
    }) as never

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('reports attained age at the first payable year when an auxiliary benefit pays after configured claim age', () => {
    // Configured claim age 62; spousal first pays in 2028 when Pat is 68.
    // Claim-age evidence must not be read as the age in the payable year.
    const ctx = context(66, 62, 0)
    const income = ctx.plan.incomes[0] as { piaMonthly: number }
    income.piaMonthly = 0
    ctx.plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1960-01-01',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 95, source: 'manual' },
    })
    ctx.plan.incomes.push({
      id: 'ss-spouse',
      type: 'socialSecurity',
      personId: 'p2',
      piaMonthly: 2_000,
      earnings: null,
      claimAge: { years: 70, months: 0 },
    } as never)
    // context(66, 62) only builds through 2026 (dobYear+claimYears < start); extend to payable year.
    ctx.projection.result.years = Array.from({ length: 3 }, (_, offset) => ({
      year: 2026 + offset,
      people: [
        { personId: 'p1', ageAttained: 66 + offset, alive: true },
        { personId: 'p2', ageAttained: 66 + offset, alive: true },
      ],
      socialSecurityStreams: [] as {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[],
    })) as never
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    withSsStreams(years, 'p1', 'ss', 2028, 12_000, 'spousal')
    withSsStreams(years, 'p2', 'ss-spouse', 9999)

    const card = ssClaimMilestone.screen(ctx)
    expect(card).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'info',
      rationale: expect.stringContaining('configured claim age of 62 years 0 months'),
      evidence: expect.arrayContaining([
        { label: "Pat's modeled claim age (configured filing age)", value: '62 years 0 months' },
        { label: "Pat's attained age in first payable year", value: '68', year: 2028 },
        {
          // Pre-horizon filing age; first payable year receives all 12 months.
          label: 'Modeled first claim year (claim in force)',
          value: '2028',
          year: 2028,
        },
        { label: "Pat's modeled benefit in first claim year (spousal)", value: '$12,000', year: 2028 },
      ]),
    })
    expect(card?.rationale).toContain('attained age 68')
  })

  it('keeps a zero-PIA retirement stream out of pre-horizon so a later auxiliary claim can fire', () => {
    // Stream is claim-in-force at horizon start with both amounts $0 (zero PIA).
    // Pre-horizon must require a positive published amount — same rule as SSDI —
    // so a later auxiliary amount on the same stream still surfaces.
    const ctx = context(66, 67, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-zero-pia',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 0,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
    ] as never
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      const auxiliary = year.year >= 2027
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss-zero-pia',
          source: auxiliary ? 'spousal' : 'own-retirement',
          annualAmount: auxiliary ? 12_000 : 0,
          claimInForce: true,
          preWithholdingAnnual: auxiliary ? 12_000 : 0,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'attention',
      evidence: expect.arrayContaining([
        { label: "Pat's modeled claim age (configured filing age)", value: '62 years 0 months' },
        { label: "Pat's modeled benefit in first claim year (spousal)", value: '$12,000', year: 2027 },
      ]),
    })
  })

  it('fires for a first-year auxiliary entitlement when own claim age is pre-horizon', () => {
    // Zero-PIA claimant filed at 62; age 66 at the 2026 horizon. First becomes
    // entitled to a positive spousal amount in the projection's first year when
    // the co-spouse's claim is also first-year (enabling event in year one) —
    // not already-paying pre-horizon. claimAge pre-horizon must not suppress.
    const ctx = context(66, 62, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-zero-pia',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 0,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
    ] as never
    ctx.plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1960-01-01',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 95, source: 'manual' },
    })
    ctx.plan.incomes.push({
      id: 'ss-spouse',
      type: 'socialSecurity',
      personId: 'p2',
      piaMonthly: 2_000,
      earnings: null,
      // Co-spouse first claims in 2026 (age 66 == claim age) — year-one enabling event.
      claimAge: { years: 66, months: 0 },
    } as never)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.people.push({ personId: 'p2', ageAttained: year.year - 1960, alive: true })
      const spouseClaiming = year.year >= 2026
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss-zero-pia',
          source: spouseClaiming ? 'spousal' : 'none',
          annualAmount: spouseClaiming ? 12_000 : 0,
          claimInForce: spouseClaiming,
          preWithholdingAnnual: spouseClaiming ? 12_000 : 0,
          isSpousalSurvivorGateStream: true,
        },
        {
          personId: 'p2',
          streamId: 'ss-spouse',
          source: spouseClaiming ? 'own-retirement' : 'none',
          annualAmount: spouseClaiming ? 24_000 : 0,
          claimInForce: spouseClaiming,
          preWithholdingAnnual: spouseClaiming ? 24_000 : 0,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'attention',
      evidence: expect.arrayContaining([
        { label: "Pat's modeled claim age (configured filing age)", value: '62 years 0 months' },
        {
          // Filed pre-horizon (claim age 62); first aux year pays all 12 months.
          label: 'Modeled first claim year (claim in force)',
          value: '2026',
          year: 2026,
        },
        { label: "Pat's modeled benefit in first claim year (spousal)", value: '$12,000', year: 2026 },
      ]),
    })
  })

  it('stays silent when an auxiliary benefit is already paying at the horizon start', () => {
    // Ordinary couple: both claimed years before the horizon; lower earner has
    // a positive spousal top-up at start. That is already-paying pre-horizon,
    // not a new entitlement transition within the horizon.
    const ctx = context(70, 62, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-lower',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 500,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
    ] as never
    ctx.plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1954-01-01',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 95, source: 'manual' },
    })
    ctx.plan.incomes.push({
      id: 'ss-higher',
      type: 'socialSecurity',
      personId: 'p2',
      piaMonthly: 2_500,
      earnings: null,
      claimAge: { years: 66, months: 0 },
    } as never)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      // p1 age 70 at 2026; p2 age 72 at 2026 — both well past claim age.
      year.people = [
        { personId: 'p1', ageAttained: 70 + (year.year - 2026), alive: true },
        { personId: 'p2', ageAttained: 72 + (year.year - 2026), alive: true },
      ]
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss-lower',
          source: 'spousal',
          annualAmount: 15_000,
          claimInForce: true,
          preWithholdingAnnual: 15_000,
          isSpousalSurvivorGateStream: true,
        },
        {
          personId: 'p2',
          streamId: 'ss-higher',
          source: 'own-retirement',
          annualAmount: 30_000,
          claimInForce: true,
          preWithholdingAnnual: 30_000,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('uses co-spouse last-wins gate stream claim age for already-paying classification', () => {
    // Co-spouse has two streams with unequal claim ages. Plan-order first is
    // early (62); last / gate stream is 66 (first claim year at horizon start).
    // First-wins would wrongly treat age 66 > 62 as pre-horizon enabling;
    // last-wins (ssStreamByPerson / isSpousalSurvivorGateStream) keeps the
    // year-one enabling claim — spousal at start still fires.
    const ctx = context(66, 62, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-zero-pia',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 0,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
    ] as never
    ctx.plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1960-01-01',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 95, source: 'manual' },
    })
    ctx.plan.incomes.push(
      {
        id: 'ss-spouse-early',
        type: 'socialSecurity',
        personId: 'p2',
        piaMonthly: 1_000,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      } as never,
      {
        id: 'ss-spouse-gate',
        type: 'socialSecurity',
        personId: 'p2',
        piaMonthly: 2_000,
        earnings: null,
        // Gate stream (last-wins): first claim year at horizon start (age 66).
        claimAge: { years: 66, months: 0 },
      } as never,
    )
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.people.push({ personId: 'p2', ageAttained: year.year - 1960, alive: true })
      const spouseClaiming = year.year >= 2026
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss-zero-pia',
          source: spouseClaiming ? 'spousal' : 'none',
          annualAmount: spouseClaiming ? 12_000 : 0,
          claimInForce: spouseClaiming,
          preWithholdingAnnual: spouseClaiming ? 12_000 : 0,
          isSpousalSurvivorGateStream: true,
        },
        {
          personId: 'p2',
          streamId: 'ss-spouse-early',
          source: 'none',
          annualAmount: 0,
          claimInForce: false,
          preWithholdingAnnual: 0,
          isSpousalSurvivorGateStream: false,
        },
        {
          personId: 'p2',
          streamId: 'ss-spouse-gate',
          source: spouseClaiming ? 'own-retirement' : 'none',
          annualAmount: spouseClaiming ? 24_000 : 0,
          claimInForce: spouseClaiming,
          preWithholdingAnnual: spouseClaiming ? 24_000 : 0,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'attention',
      evidence: expect.arrayContaining([
        { label: "Pat's modeled benefit in first claim year (spousal)", value: '$12,000', year: 2026 },
      ]),
    })
  })

  it('fires for survivor at horizon start when co-spouse first deceased year is the start', () => {
    // Claimant past own claim age; co-spouse's first modeled deceased year is
    // the projection start (lifeAge + 1 at start, alive false). Survivor
    // benefit at start is a new entitlement — death-at-start must fire, not
    // be treated as already-paying pre-horizon. Death timing reads published
    // lifeAge / alive flags — not plan planningAge.
    const ctx = context(70, 62, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-survivor',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 500,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
    ] as never
    // DOB 1960, lifeAge 65 → last alive 2025, first deceased year 2026 (= start).
    ctx.plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1960-01-01',
      sex: 'average',
      retirementAge: null,
      // Plan planningAge deliberately differs from published lifeAge below —
      // detector must not read this for death timing.
      longevity: { planningAge: 95, source: 'manual' },
    })
    ctx.plan.incomes.push({
      id: 'ss-decedent',
      type: 'socialSecurity',
      personId: 'p2',
      piaMonthly: 2_500,
      earnings: null,
      claimAge: { years: 66, months: 0 },
    } as never)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean; lifeAge?: number }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      // ageAttained 66 = lifeAge + 1 at 2026 — first deceased year at start.
      year.people = [
        { personId: 'p1', ageAttained: 70 + (year.year - 2026), alive: true, lifeAge: 95 },
        { personId: 'p2', ageAttained: 66 + (year.year - 2026), alive: false, lifeAge: 65 },
      ]
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss-survivor',
          source: 'survivor',
          annualAmount: 30_000,
          claimInForce: true,
          preWithholdingAnnual: 30_000,
          isSpousalSurvivorGateStream: true,
        },
        {
          personId: 'p2',
          streamId: 'ss-decedent',
          source: 'none',
          annualAmount: 0,
          claimInForce: false,
          preWithholdingAnnual: 0,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'attention',
      evidence: expect.arrayContaining([
        { label: "Pat's modeled benefit in first claim year (survivor)", value: '$30,000', year: 2026 },
      ]),
    })
  })

  it('stays silent for survivor already paying when co-spouse died before the horizon', () => {
    // Co-spouse's first deceased year predates the projection start
    // (ageAttained > lifeAge + 1 at start). Positive survivor at start is
    // already-paying pre-horizon — not a new entitlement.
    const ctx = context(70, 62, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-survivor',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 500,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
    ] as never
    // DOB 1960, lifeAge 60 → last alive 2020, first deceased 2021 (before 2026).
    ctx.plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1960-01-01',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 95, source: 'manual' },
    })
    ctx.plan.incomes.push({
      id: 'ss-decedent',
      type: 'socialSecurity',
      personId: 'p2',
      piaMonthly: 2_500,
      earnings: null,
      claimAge: { years: 66, months: 0 },
    } as never)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean; lifeAge?: number }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      // ageAttained 66 > lifeAge + 1 (61) — death-before-start.
      year.people = [
        { personId: 'p1', ageAttained: 70 + (year.year - 2026), alive: true, lifeAge: 95 },
        { personId: 'p2', ageAttained: 66 + (year.year - 2026), alive: false, lifeAge: 60 },
      ]
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss-survivor',
          source: 'survivor',
          annualAmount: 30_000,
          claimInForce: true,
          preWithholdingAnnual: 30_000,
          isSpousalSurvivorGateStream: true,
        },
        {
          personId: 'p2',
          streamId: 'ss-decedent',
          source: 'none',
          annualAmount: 0,
          claimInForce: false,
          preWithholdingAnnual: 0,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('stays silent under deathAgeByPersonId override when plan planningAge still looks mid-life', () => {
    // Pin: plan planningAge 95 would classify age 66 as death-at-start
    // (66 === 95+1 is false, but 66 > 96 is also false → old code fired).
    // Published lifeAge 60 (deathAge override) makes 66 > 61 → already paying.
    const ctx = context(70, 62, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-survivor',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 500,
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
    ] as never
    ctx.plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1960-01-01',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 95, source: 'manual' },
    })
    ctx.plan.incomes.push({
      id: 'ss-decedent',
      type: 'socialSecurity',
      personId: 'p2',
      piaMonthly: 2_500,
      earnings: null,
      claimAge: { years: 66, months: 0 },
    } as never)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean; lifeAge?: number }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.people = [
        { personId: 'p1', ageAttained: 70 + (year.year - 2026), alive: true, lifeAge: 95 },
        // deathAgeByPersonId: 60 — published alive/lifeAge, not plan planningAge 95.
        { personId: 'p2', ageAttained: 66 + (year.year - 2026), alive: false, lifeAge: 60 },
      ]
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss-survivor',
          source: 'survivor',
          annualAmount: 30_000,
          claimInForce: true,
          preWithholdingAnnual: 30_000,
          isSpousalSurvivorGateStream: true,
        },
        {
          personId: 'p2',
          streamId: 'ss-decedent',
          source: 'none',
          annualAmount: 0,
          claimInForce: false,
          preWithholdingAnnual: 0,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('stays silent for a pre-horizon survivor benefit from a deceased former spouse', () => {
    // Household co-person is alive; survivor is from a deceased former spouse
    // on the claimant's stream (not household co-death). Positive survivor at
    // start past claim age is already-paying, not a new claim.
    const ctx = context(70, 62, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-survivor',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 500,
        earnings: null,
        claimAge: { years: 62, months: 0 },
        formerSpouses: [
          {
            id: 'ex-deceased',
            relationship: 'deceased',
            dob: '1950-01-01',
            piaMonthly: 2_500,
            marriageYears: 15,
            remarriedAtAge: null,
          },
        ],
      },
    ] as never
    ctx.plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1956-01-01',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 95, source: 'manual' },
    })
    ctx.plan.incomes.push({
      id: 'ss-current-spouse',
      type: 'socialSecurity',
      personId: 'p2',
      piaMonthly: 1_800,
      earnings: null,
      claimAge: { years: 66, months: 0 },
    } as never)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.people = [
        { personId: 'p1', ageAttained: 70 + (year.year - 2026), alive: true },
        { personId: 'p2', ageAttained: 70 + (year.year - 2026), alive: true },
      ]
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss-survivor',
          source: 'survivor',
          annualAmount: 18_000,
          claimInForce: true,
          preWithholdingAnnual: 18_000,
          isSpousalSurvivorGateStream: true,
        },
        {
          personId: 'p2',
          streamId: 'ss-current-spouse',
          source: 'own-retirement',
          annualAmount: 22_000,
          claimInForce: true,
          preWithholdingAnnual: 22_000,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('formats sub-dollar positive benefits with cents', () => {
    const ctx = context(66, 67, 0)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    withSsStreams(years, 'p1', 'ss', 2027, 0.4)

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      evidence: expect.arrayContaining([
        {
          label: "Pat's modeled benefit in first claim year (own retirement)",
          value: '$0.40',
          year: 2027,
        },
      ]),
    })
  })

  it('formats non-integral benefits at and above $0.50 with cents', () => {
    const ctx = context(66, 67, 0)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    withSsStreams(years, 'p1', 'ss', 2027, 0.6)

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      evidence: expect.arrayContaining([
        {
          label: "Pat's modeled benefit in first claim year (own retirement)",
          value: '$0.60',
          year: 2027,
        },
      ]),
    })
  })

  it('formats larger non-integral benefits with cents and grouping', () => {
    const ctx = context(66, 67, 0)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    withSsStreams(years, 'p1', 'ss', 2027, 1234.56)

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      evidence: expect.arrayContaining([
        {
          label: "Pat's modeled benefit in first claim year (own retirement)",
          value: '$1,234.56',
          year: 2027,
        },
      ]),
    })
  })

  it('formats claim age with singular year and month forms for 1', () => {
    // Use an imminent claim (2027) with configured filing age 1y 1m solely to
    // exercise formatAge grammar in evidence/rationale.
    const ctx = context(66, 67, 0)
    ctx.plan.incomes = [
      {
        id: 'ss',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 1, months: 1 },
      },
    ] as never
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    withSsStreams(years, 'p1', 'ss', 2027)

    const card = ssClaimMilestone.screen(ctx)
    expect(card?.evidence[0]).toEqual({
      label: "Pat's modeled claim age (configured filing age)",
      value: '1 year 1 month',
    })
    expect(card?.rationale).toContain('1 year 1 month')
  })

  it('compares former-spouse win against summed own across all claimant streams', () => {
    // Stream with former spouses has zero own PIA; a sibling stream carries a
    // large resolved own benefit. Sim sums both into ssOwnByPerson before the
    // former-spouse replace check — single-stream own would wrongly treat the
    // former benefit as already-winning pre-horizon and suppress a NEW start-
    // year spousal that only appears because a second ex turns 62 at start.
    const ctx = context(70, 62, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-former-menu',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 0,
        earnings: null,
        claimAge: { years: 62, months: 0 },
        formerSpouses: [
          {
            id: 'low-pia-ex',
            relationship: 'divorced',
            dob: '1950-01-01', // eligible well before start
            piaMonthly: 500, // 50% << sibling own
            marriageYears: 12,
            remarriedAtAge: null,
          },
          {
            id: 'high-pia-ex',
            relationship: 'divorced',
            dob: '1964-01-01', // turns 62 in 2026 — first win at start
            piaMonthly: 4_000,
            marriageYears: 12,
            remarriedAtAge: null,
          },
        ],
      },
      {
        id: 'ss-own-sibling',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 2_000, // dominates low-pia-ex alone
        earnings: null,
        claimAge: { years: 62, months: 0 },
      },
    ] as never
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss-former-menu',
          source: 'spousal',
          annualAmount: 18_000,
          claimInForce: true,
          preWithholdingAnnual: 18_000,
          isSpousalSurvivorGateStream: false,
        },
        {
          personId: 'p1',
          streamId: 'ss-own-sibling',
          source: 'none',
          annualAmount: 0,
          claimInForce: true,
          preWithholdingAnnual: 0,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'attention',
      evidence: expect.arrayContaining([
        {
          label: 'Modeled first claim year (claim in force)',
          value: '2026',
          year: 2026,
        },
      ]),
    })
  })

  it('considers best former benefit across split records on all claimant streams', () => {
    // Former-spouse records split across two streams: the start-year published
    // aux lands on the stream whose high-PIA ex first becomes eligible at
    // start, but a sibling stream already carries a pre-horizon winning former.
    // Single-stream formers-only comparison would treat start as NEW and fire;
    // the sim's pass takes the best former across streams against summed own.
    const ctx = context(70, 62, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-new-ex',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 0,
        earnings: null,
        claimAge: { years: 62, months: 0 },
        formerSpouses: [
          {
            id: 'new-ex-at-start',
            relationship: 'divorced',
            dob: '1964-01-01', // turns 62 in 2026 — first eligibility at start
            piaMonthly: 4_000, // 50% × 12 = 24_000 > own at start
            marriageYears: 12,
            remarriedAtAge: null,
          },
        ],
      },
      {
        id: 'ss-prior-ex',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 800, // own annual 9_600; prior ex spousal 12_000 wins pre-horizon
        earnings: null,
        claimAge: { years: 62, months: 0 },
        formerSpouses: [
          {
            id: 'already-winning-ex',
            relationship: 'divorced',
            dob: '1950-01-01', // eligible well before start
            piaMonthly: 2_000, // 50% × 12 = 12_000 > own 9_600
            marriageYears: 12,
            remarriedAtAge: null,
          },
        ],
      },
    ] as never
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss-new-ex',
          // Larger former at start pays here; siblings zeroed (sim publication).
          source: 'spousal',
          annualAmount: 24_000,
          claimInForce: true,
          preWithholdingAnnual: 24_000,
          isSpousalSurvivorGateStream: false,
        },
        {
          personId: 'p1',
          streamId: 'ss-prior-ex',
          source: 'none',
          annualAmount: 0,
          claimInForce: true,
          preWithholdingAnnual: 0,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    // Already-paying former-spouse source (sibling stream's pre-horizon win) —
    // do not re-fire when a second ex becomes eligible at start.
    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('does not treat a zero-PIA prior-year eligible former as an enabler (positive ex first pays at start)', () => {
    // Pin: age-eligible zero-PIA ex could not have paid pre-horizon — must not
    // set anyEligibleFormer / null-own already-paying. A positive-PIA second ex
    // first reaches 62 at start → NEW entitlement fires (same shape as the
    // low-vs-high former menu, with the low ex at piaMonthly 0).
    const ctx = context(70, 62, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-former-menu',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: null,
        earnings: null,
        claimAge: { years: 62, months: 0 },
        formerSpouses: [
          {
            id: 'zero-pia-ex',
            relationship: 'divorced',
            dob: '1950-01-01', // eligible well before start
            piaMonthly: 0, // age-eligible but could not have paid
            marriageYears: 12,
            remarriedAtAge: null,
          },
          {
            id: 'high-pia-ex',
            relationship: 'divorced',
            dob: '1964-01-01', // turns 62 in 2026 — first win at start
            piaMonthly: 4_000,
            marriageYears: 12,
            remarriedAtAge: null,
          },
        ],
      },
    ] as never
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss-former-menu',
          source: 'spousal',
          annualAmount: 24_000,
          claimInForce: true,
          preWithholdingAnnual: 24_000,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'attention',
      evidence: expect.arrayContaining([
        {
          label: 'Modeled first claim year (claim in force)',
          value: '2026',
          year: 2026,
        },
      ]),
    })
  })

  it('does not treat a former on a not-yet-paying stream as a prior-year enabler', () => {
    // Pin: formers live on a stream whose claim age is first reached at the
    // horizon start (prior year payableMonthsAtAge === 0). The ex is
    // age-eligible and high-PIA, but the sim's former-spouse pass skips
    // streams with no payable months — that record enables nothing pre-horizon.
    // Start-year spousal is a NEW entitlement when the stream begins paying.
    const ctx = context(70, 70, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-late-claim-formers',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: null,
        earnings: null,
        claimAge: { years: 70, months: 0 },
        formerSpouses: [
          {
            id: 'high-pia-ex',
            relationship: 'divorced',
            dob: '1950-01-01', // eligible well before start
            piaMonthly: 4_000,
            marriageYears: 12,
            remarriedAtAge: null,
          },
        ],
      },
    ] as never
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss-late-claim-formers',
          source: 'spousal',
          annualAmount: 24_000,
          claimInForce: true,
          preWithholdingAnnual: 24_000,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'attention',
      evidence: expect.arrayContaining([
        {
          label: 'Modeled first claim year (claim in force; partial when claim months > 0)',
          value: '2026',
          year: 2026,
        },
      ]),
    })
  })

  it('recognizes auxiliary override paying through a non-gate unresolved stream', () => {
    // Former-spouse pass pays on an unresolved (non-gate) stream and zeros the
    // resolved sibling. Override-recognition must not require the gate marker —
    // published source/amounts identify the aux so the zeroed sibling's filing
    // at claim age still surfaces.
    const ctx = context(66, 67, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-unresolved-aux',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: null,
        earnings: null,
        claimAge: { years: 62, months: 0 },
        formerSpouses: [
          {
            id: 'former-spouse',
            relationship: 'divorced',
            dob: '1950-01-01',
            piaMonthly: 3_000,
            marriageYears: 12,
            remarriedAtAge: null,
          },
        ],
      },
      {
        id: 'ss-own-resolved',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 67, months: 0 },
      },
    ] as never
    ctx.projection.result.years = Array.from({ length: 3 }, (_, offset) => {
      const y = 2026 + offset
      const ownFiling = y >= 2027
      return {
        year: y,
        people: [{ personId: 'p1', ageAttained: 66 + offset, alive: true }],
        socialSecurityStreams: [
          {
            personId: 'p1',
            streamId: 'ss-unresolved-aux',
            // Paying aux on non-gate / unresolved stream (gate is last resolved).
            source: 'spousal' as StreamSource,
            annualAmount: 18_000,
            claimInForce: true,
            preWithholdingAnnual: 18_000,
            isSpousalSurvivorGateStream: false,
          },
          {
            personId: 'p1',
            streamId: 'ss-own-resolved',
            source: 'none' as StreamSource,
            annualAmount: 0,
            claimInForce: ownFiling,
            preWithholdingAnnual: 0,
            isSpousalSurvivorGateStream: true,
          },
        ],
      }
    }) as never

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'attention',
      evidence: expect.arrayContaining([
        { label: "Pat's modeled claim age (configured filing age)", value: '67 years 0 months' },
        {
          label: 'Modeled first claim year (claim in force)',
          value: '2027',
          year: 2027,
        },
        {
          label: "Pat's modeled benefit in first claim year (claim in force; none)",
          value: '$0',
          year: 2027,
        },
      ]),
    })
  })

  it('stays silent for a sub-half-cent published benefit (visible-cent floor)', () => {
    // Amounts in (0, 0.005) render as $0 evidence via Math.round — same floor as
    // missingDataBasis. Must not fire with a "$0" modeled-benefit evidence row.
    const ctx = context(66, 67, 0)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    withSsStreams(years, 'p1', 'ss', 2027, 0.004)

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('fires at the half-cent visible benefit threshold', () => {
    // 0.005 rounds to $0.01 — guaranteed nonzero rendered amount.
    const ctx = context(66, 67, 0)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    withSsStreams(years, 'p1', 'ss', 2027, 0.005)

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      evidence: expect.arrayContaining([
        {
          label: "Pat's modeled benefit in first claim year (own retirement)",
          value: '$0.01',
          year: 2027,
        },
      ]),
    })
  })

  it('keeps already-paying former-spouse survivor pre-horizon when household dies at start', () => {
    // Claimant already receives survivor from a deceased FORMER spouse. Household
    // co-spouse's first deceased year is the projection start (death-at-start).
    // Precedence: already-paying former-spouse source stays pre-horizon — do not
    // reclassify as a new household-death entitlement.
    const ctx = context(70, 62, 0)
    ctx.plan.incomes = [
      {
        id: 'ss-survivor',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 500,
        earnings: null,
        claimAge: { years: 62, months: 0 },
        formerSpouses: [
          {
            id: 'ex-deceased',
            relationship: 'deceased',
            dob: '1950-01-01',
            piaMonthly: 2_500,
            marriageYears: 15,
            remarriedAtAge: null,
          },
        ],
      },
    ] as never
    // DOB 1960, lifeAge 65 → last alive 2025, first deceased year 2026 (= start).
    ctx.plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1960-01-01',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 65, source: 'manual' },
    })
    ctx.plan.incomes.push({
      id: 'ss-decedent',
      type: 'socialSecurity',
      personId: 'p2',
      piaMonthly: 2_500,
      earnings: null,
      claimAge: { years: 66, months: 0 },
    } as never)
    const years = ctx.projection.result.years as Array<{
      year: number
      people: { personId: string; ageAttained: number; alive: boolean; lifeAge?: number }[]
      socialSecurityStreams?: {
        personId: string
        streamId: string
        source: StreamSource
        annualAmount: number
        claimInForce: boolean
        preWithholdingAnnual: number
        isSpousalSurvivorGateStream: boolean
      }[]
    }>
    for (const year of years) {
      year.people = [
        { personId: 'p1', ageAttained: 70 + (year.year - 2026), alive: true, lifeAge: 95 },
        { personId: 'p2', ageAttained: 66 + (year.year - 2026), alive: false, lifeAge: 65 },
      ]
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss-survivor',
          source: 'survivor',
          annualAmount: 30_000,
          claimInForce: true,
          preWithholdingAnnual: 30_000,
          isSpousalSurvivorGateStream: true,
        },
        {
          personId: 'p2',
          streamId: 'ss-decedent',
          source: 'none',
          annualAmount: 0,
          claimInForce: false,
          preWithholdingAnnual: 0,
          isSpousalSurvivorGateStream: true,
        },
      ]
    }

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })
})
