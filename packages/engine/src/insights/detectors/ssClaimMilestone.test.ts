import { describe, expect, it } from 'vitest'

import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { ssClaimMilestone } from './ssClaimMilestone.js'

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
  return {
    plan,
    params: { year: 2026 },
    projection: {
      startYear: 2026,
      result: {
        years: Array.from({ length: finalYear - 2026 + 1 }, (_, offset) => ({
          year: 2026 + offset,
          people: [{ personId: 'p1', ageAttained: ageAtStart + offset, alive: true }],
        })),
      },
    },
  } as unknown as DetectorContext
}

describe('Social Security claim milestone detector', () => {
  it('flags a claim within one year as attention with exact claim evidence', () => {
    const card = ssClaimMilestone.screen(context())

    // Engine annual-ledger convention: first benefit year = dobYear +
    // claimAge.years (1960 + 67 = 2027), partial because claim months = 6.
    expect(card).toMatchObject({
      severity: 'attention',
      plannerRoute: 'social-security-analysis',
      evidence: [
        { label: "Pat's modeled claim age", value: '67 years 6 months' },
        { label: 'Age at projection start (2026)', value: '67', year: 2026 },
        { label: 'Modeled first benefit year (partial when claim months > 0)', value: '2027', year: 2027 },
        { label: 'Full retirement age', value: '66 years 10 months' },
      ],
    })
  })

  it('uses the annual-ledger start year for non-January birthdays', () => {
    const ctx = context()
    ctx.plan.household.people[0]!.dob = '1960-11-15'
    const card = ssClaimMilestone.screen(ctx)
    // dobYear + claimAge.years = 1960 + 67 = 2027 even though calendar-month
    // arithmetic (Nov 1960 + 67y6m = May 2028) would say otherwise — the
    // ledger ages people by calendar year.
    expect(card?.evidence.find((e) => e.label.startsWith('Modeled first benefit year'))?.value).toBe('2027')
  })

  it('uses info for a decision two model years away and stays silent just beyond two years', () => {
    expect(ssClaimMilestone.screen(context(66, 68, 0))?.severity).toBe('info')
    expect(ssClaimMilestone.screen(context(67, 69, 1))).toBeNull()
  })

  it('stays silent when a below-FRA SSDI onset replaces the retirement claim path', () => {
    const ctx = context()
    const income = ctx.plan.incomes[0] as { disability?: { onsetAge: number } }
    income.disability = { onsetAge: 60 }

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('fires for a claim at 68 years 1 month exactly two model years away', () => {
    const card = ssClaimMilestone.screen(context(66, 68, 1))

    expect(card?.severity).toBe('info')
    expect(card?.evidence).toContainEqual({ label: "Pat's modeled claim age", value: '68 years 1 months' })
    expect(card?.evidence).toContainEqual({
      label: 'Modeled first benefit year (partial when claim months > 0)',
      value: '2028',
      year: 2028,
    })
  })

  it('stays silent when the model skips a stream without PIA or earnings', () => {
    const ctx = context()
    const income = ctx.plan.incomes[0] as { piaMonthly: number | null; earnings: unknown[] | null }
    income.piaMonthly = null
    income.earnings = null

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('stays silent when the stream has zero PIA and no earnings history', () => {
    const ctx = context()
    const income = ctx.plan.incomes[0] as { piaMonthly: number; earnings: unknown[] | null }
    income.piaMonthly = 0
    income.earnings = null

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('stays silent when pia is null with an all-zero earnings history and no other SS stream', () => {
    const ctx = context()
    const income = ctx.plan.incomes[0] as { piaMonthly: number | null; earnings: { year: number; amount: number }[] | null }
    income.piaMonthly = null
    income.earnings = [{ year: 2020, amount: 0 }, { year: 2021, amount: 0 }]

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('fires for a zero-own-PIA claimant when another SS stream has positive PIA', () => {
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
      // Out of the two-year window so the anchor spouse's own card cannot win
      // most-imminent selection — this test isolates the zero-PIA keep.
      claimAge: { years: 70, months: 0 },
    } as never)
    for (const year of ctx.projection.result.years) {
      year.people.push({ personId: 'p2', ageAttained: year.year - 1960, alive: true } as never)
    }

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'info',
    })
  })

  it('stays silent when the stream has zero PIA despite earnings history', () => {
    const ctx = context()
    const income = ctx.plan.incomes[0] as { piaMonthly: number; earnings: unknown[] | null }
    income.piaMonthly = 0
    income.earnings = [{ year: 2020, amount: 100_000 }]

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })

  it('stays silent when the projection does not reach the claim year', () => {
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
    for (const year of ctx.projection.result.years) {
      year.people.push({ personId: 'p2', ageAttained: year.year - 1960, alive: true } as never)
    }

    expect(ssClaimMilestone.screen(ctx)?.title).toBe("Sam's Social Security claim is imminent")
  })

  it('considers every Social Security stream for a person', () => {
    const ctx = context(66, 68, 0)
    ctx.plan.incomes.push({
      id: 'ss-imminent',
      type: 'socialSecurity',
      personId: 'p1',
      piaMonthly: 2_000,
      earnings: null,
      claimAge: { years: 67, months: 0 },
    } as never)

    expect(ssClaimMilestone.screen(ctx)).toMatchObject({
      title: "Pat's Social Security claim is imminent",
      severity: 'attention',
      evidence: expect.arrayContaining([
        { label: "Pat's modeled claim age", value: '67 years 0 months' },
      ]),
    })
  })
})
