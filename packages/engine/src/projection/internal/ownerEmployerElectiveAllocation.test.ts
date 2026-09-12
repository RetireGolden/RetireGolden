import { describe, expect, it } from 'vitest'

import { allocateOwnerEmployerElectivesAcrossPlans } from './ownerEmployerElectiveAllocation.js'

const BASE = 24_500
const CATCH_UP = 8_000

describe('allocateOwnerEmployerElectivesAcrossPlans', () => {
  it('keeps one owner-wide §402(g)/§414(v) budget across two employer plans', () => {
    const result = allocateOwnerEmployerElectivesAcrossPlans({
      groups: [
        {
          groupKey: 'p1\0plan-a',
          ownerId: 'p1',
          employerPlanId: 'plan-a',
          requests: [
            {
              accountId: 'a-trad',
              type: 'traditional',
              desired: 20_000,
              priorCalendarYearFicaWages: 200_000,
            },
            {
              accountId: 'a-roth',
              type: 'roth',
              desired: 0,
              priorCalendarYearFicaWages: 200_000,
            },
          ],
          prior: {
            status: 'known',
            totalElectiveDeferrals: 10_000,
            designatedRothElectiveDeferrals: 0,
            asOfDate: '2026-06-01',
          },
        },
        {
          groupKey: 'p1\0plan-b',
          ownerId: 'p1',
          employerPlanId: 'plan-b',
          requests: [
            {
              accountId: 'b-trad',
              type: 'traditional',
              desired: 20_000,
              priorCalendarYearFicaWages: 200_000,
            },
            {
              accountId: 'b-roth',
              type: 'roth',
              desired: 0,
              priorCalendarYearFicaWages: 200_000,
            },
          ],
          prior: {
            status: 'known',
            totalElectiveDeferrals: 5_000,
            designatedRothElectiveDeferrals: 0,
            asOfDate: '2026-06-01',
          },
        },
      ],
      contributionYear: 2026,
      baseLimit: BASE,
      catchUpLimit: CATCH_UP,
      wageThreshold: 150_000,
      compensationByOwner: new Map([['p1', 200_000]]),
    })

    let incrementalTotal = 0
    for (const amount of result.allocatedByAccountId.values()) incrementalTotal += amount
    // Priors already consumed 15,000 of the 32,500 owner annual budget.
    expect(incrementalTotal).toBeLessThanOrEqual(BASE + CATCH_UP - 15_000 + 1e-9)
    expect(incrementalTotal).toBeGreaterThan(0)
  })

  it('keeps per-plan Roth catch-up destinations and does not cross-redirect', () => {
    const result = allocateOwnerEmployerElectivesAcrossPlans({
      groups: [
        {
          groupKey: 'p1\0plan-a',
          ownerId: 'p1',
          employerPlanId: 'plan-a',
          requests: [
            {
              accountId: 'a-trad',
              type: 'traditional',
              desired: 30_000,
              priorCalendarYearFicaWages: 200_000,
            },
            {
              accountId: 'a-roth',
              type: 'roth',
              desired: 0,
              priorCalendarYearFicaWages: 200_000,
            },
          ],
        },
        {
          groupKey: 'p1\0plan-b',
          ownerId: 'p1',
          employerPlanId: 'plan-b',
          requests: [
            {
              accountId: 'b-trad',
              type: 'traditional',
              desired: 30_000,
              priorCalendarYearFicaWages: 200_000,
            },
            {
              accountId: 'b-roth',
              type: 'roth',
              desired: 0,
              priorCalendarYearFicaWages: 200_000,
            },
          ],
        },
      ],
      contributionYear: 2026,
      baseLimit: BASE,
      catchUpLimit: CATCH_UP,
      wageThreshold: 150_000,
      compensationByOwner: new Map([['p1', 200_000]]),
    })

    const planA = result.allocationByGroupKey.get('p1\0plan-a')!
    const planB = result.allocationByGroupKey.get('p1\0plan-b')!
    expect(planA.catchUpRothAccountId).toBe('a-roth')
    expect(planB.catchUpRothAccountId).toBe('b-roth')
    expect(planA.redirectedCatchUpBySource.has('b-trad')).toBe(false)
    expect(planB.redirectedCatchUpBySource.has('a-trad')).toBe(false)
    // Owner merge must not publish a single cross-plan Roth destination.
    expect(result.allocationByOwner.get('p1')!.catchUpRothAccountId).toBeUndefined()
  })

  it('treats missing history on an explicit plan id as unknown, not known zero', () => {
    const result = allocateOwnerEmployerElectivesAcrossPlans({
      groups: [
        {
          groupKey: 'p1\0plan-a',
          ownerId: 'p1',
          employerPlanId: 'plan-a',
          requests: [
            {
              accountId: 'a-trad',
              type: 'traditional',
              desired: 5_000,
              priorCalendarYearFicaWages: 200_000,
            },
          ],
          prior: { status: 'unknown' },
        },
      ],
      contributionYear: 2026,
      baseLimit: BASE,
      catchUpLimit: CATCH_UP,
      wageThreshold: 150_000,
      compensationByOwner: new Map([['p1', 200_000]]),
    })
    const allocation = result.allocationByGroupKey.get('p1\0plan-a')!
    expect(allocation.priorContributionsStatus).toBe('unknown')
    expect(allocation.additionalRothCatchUpStillRequired).toBeNull()
  })
})


it.each([{ compensation: 200000, expected: 24500 }, { compensation: 30000, expected: 22000 }])(
  'preserves real prior Roth/total without consuming it twice (compensation $compensation)', ({ compensation, expected }) => {
    // IRC402(g)/414(v):8000 actual YTD Roth +24500 requested =32500 annual.
    // With30000 compensation only22000 additional dollars fit. Prior Roth
    // already covers the8000 mandate; there is no new Roth redirection.
    const result = allocateOwnerEmployerElectivesAcrossPlans({
      groups: [{ groupKey: 'p/plan', ownerId: 'p', employerPlanId: 'plan',
        prior: { status: 'known', designatedRothElectiveDeferrals: 8000,
          totalElectiveDeferrals: 8000, asOfDate: '2026-06-01' },
        requests: [{ accountId: 'traditional', type: 'traditional', desired: 24500, priorCalendarYearFicaWages: 200000 },
          { accountId: 'roth', type: 'roth', desired: 0, priorCalendarYearFicaWages: 200000 }] }],
      contributionYear: 2026, baseLimit: BASE, catchUpLimit: CATCH_UP,
      wageThreshold: 150000, compensationByOwner: new Map([['p', compensation]]),
    })
    expect(result.allocatedByAccountId.get('traditional')).toBe(expected)
    expect(result.allocatedByAccountId.get('roth') ?? 0).toBe(0)
    expect(result.allocationByGroupKey.get('p/plan')?.priorContributionsStatus).toBe('known')
  })

it('retains actual over-compensation history rather than creating incremental room', () => {
  const result = allocateOwnerEmployerElectivesAcrossPlans({
    groups: [{ groupKey: 'p/plan', ownerId: 'p', employerPlanId: 'plan',
      prior: { status: 'known', designatedRothElectiveDeferrals: 8000,
        totalElectiveDeferrals: 35000, asOfDate: '2026-06-01' },
      requests: [{ accountId: 'traditional', type: 'traditional', desired: 100, priorCalendarYearFicaWages: 200000 }] }],
    contributionYear: 2026, baseLimit: BASE, catchUpLimit: CATCH_UP,
    wageThreshold: 150000, compensationByOwner: new Map([['p', 30000]]),
  })
  expect([...result.allocatedByAccountId.values()].reduce((sum, amount) => sum + amount, 0)).toBe(0)
})
