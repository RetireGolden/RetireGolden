import { describe, expect, it } from 'vitest'

import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { ssClaimMilestone } from './ssClaimMilestone.js'

function context(ageAtStart = 67, claimYears = 67, claimMonths = 6): DetectorContext {
  const plan = singlePersonPlan({ dob: '1960-01-01' })
  plan.incomes = [
    {
      id: 'ss',
      type: 'socialSecurity',
      personId: 'p1',
      claimAge: { years: claimYears, months: claimMonths },
    },
  ] as never
  return {
    plan,
    params: { year: 2026 },
    projection: {
      startYear: 2026,
      result: { years: [{ year: 2026, people: [{ personId: 'p1', ageAttained: ageAtStart, alive: true }] }] },
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

  it('uses info for a decision more than one year away and stays silent just beyond two years', () => {
    expect(ssClaimMilestone.screen(context(66))?.severity).toBe('info')
    expect(ssClaimMilestone.screen(context(67, 69, 1))).toBeNull()
  })

  it('stays silent when a below-FRA SSDI onset replaces the retirement claim path', () => {
    const ctx = context()
    const income = ctx.plan.incomes[0] as { disability?: { onsetAge: number } }
    income.disability = { onsetAge: 60 }

    expect(ssClaimMilestone.screen(ctx)).toBeNull()
  })
})
