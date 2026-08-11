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

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      severity: 'attention',
      evidence: expect.arrayContaining([
        {
          label: "Pat's modeled benefit in first claim year (earnings test / SGA withheld to $0; own retirement)",
          value: '$0',
          year: 2027,
        },
      ]),
    })
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
    for (const year of years) {
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss',
          source: year.year >= 2027 ? 'own-retirement' : 'none',
          annualAmount: 0,
          claimInForce: year.year >= 2027,
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
        { label: 'Modeled first claim year (claim in force; partial when claim months > 0)', value: '2028', year: 2028 },
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
        { label: 'Modeled first claim year (claim in force; partial when claim months > 0)', value: '2027', year: 2027 },
        { label: "Pat's modeled benefit in first claim year (own retirement)", value: '$24,000', year: 2027 },
      ]),
    })
  })

  it('continues past a zero-PIA claim-in-force row to a later positive sibling stream', () => {
    // Zero-PIA stream becomes claim-in-force in 2027 with both published amounts
    // zero (unmodeled). A sibling stream starts a positive claim in 2028 — the
    // empty row must not abort the person's search.
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
            source: (y >= 2027 ? 'own-retirement' : 'none') as StreamSource,
            annualAmount: 0,
            claimInForce: y >= 2027,
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
          label: 'Modeled first claim year (claim in force; partial when claim months > 0)',
          value: '2028',
          year: 2028,
        },
        { label: "Pat's modeled benefit in first claim year (own retirement)", value: '$24,000', year: 2028 },
      ]),
    })
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
          label: 'Modeled first claim year (claim in force; partial when claim months > 0)',
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
    // entitled to a positive spousal amount in the projection's first year.
    // claimAge pre-horizon must not suppress this new auxiliary entitlement.
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
      year.socialSecurityStreams = [
        {
          personId: 'p1',
          streamId: 'ss-zero-pia',
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
        { label: "Pat's modeled claim age (configured filing age)", value: '62 years 0 months' },
        {
          label: 'Modeled first claim year (claim in force; partial when claim months > 0)',
          value: '2026',
          year: 2026,
        },
        { label: "Pat's modeled benefit in first claim year (spousal)", value: '$12,000', year: 2026 },
      ]),
    })
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
})
