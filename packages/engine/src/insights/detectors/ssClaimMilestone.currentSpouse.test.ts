import { beforeEach, describe, expect, it, vi } from 'vitest'

import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { spouseDualEntitlementMonthly } from '../../socialSecurity/dualEntitlement.js'
import { bestMaritalBenefit } from '../../socialSecurity/maritalBenefits.js'

vi.mock('../../socialSecurity/dualEntitlement.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../socialSecurity/dualEntitlement.js')>()
  return {
    ...original,
    spouseDualEntitlementMonthly: vi.fn(original.spouseDualEntitlementMonthly),
  }
})

vi.mock('../../socialSecurity/maritalBenefits.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../socialSecurity/maritalBenefits.js')>()
  return {
    ...original,
    bestMaritalBenefit: vi.fn(original.bestMaritalBenefit),
  }
})

import { ssClaimMilestone } from './ssClaimMilestone.js'

const mockedHelper = vi.mocked(spouseDualEntitlementMonthly)
const mockedFormer = vi.mocked(bestMaritalBenefit)

/** Sentinel former monthly — isolates non-owned pricing; annual 15_840 at 12 payable months. */
const FORMER_SENTINEL_MONTHLY = 1_320

// Both claimed at 62 in January 2026, so the spouse benefit starts with her own
// claim and carries the 62-year spouse factor, 0.65.
const expectedHelperInput = {
  ownPiaMonthly: 800,
  ownActualMonthly: 560,
  spouseBaseMonthly: 2_000,
  spouseFactor: 0.65,
}

/** Totals around the sentinel's 15,840 a year: 560 + 780 = 1,340 a month wins, 560 + 740 = 1,300 loses. */
const WINNING_TOTAL_MONTHLY = 1_340
const LOSING_TOTAL_MONTHLY = 1_300

type FormerRelationship = 'deceased' | 'surviving-divorced'

/**
 * MFJ death-at-start with a prior-year current-spouse competitor. start 2028;
 * both DOB 1964-01-02, original claims 62; claimant alive 64, worker dies 64
 * (planningAge 63); prior 2027 both alive 63. Published survivor at start is a
 * given insight input, not a second legal oracle.
 */
function deathAtStartCurrentSpouseContext(
  survivorFormerRelationship: FormerRelationship = 'deceased',
): DetectorContext {
  const plan = singlePersonPlan({ dob: '1964-01-02', planningAge: 95 })
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people.push({
    id: 'p2',
    name: 'Sam',
    dob: '1964-01-02',
    sex: 'average',
    retirementAge: null,
    longevity: { planningAge: 63, source: 'manual' },
  })
  plan.incomes = [
    {
      id: 'ss-claimant',
      type: 'socialSecurity',
      personId: 'p1',
      piaMonthly: 800,
      earnings: null,
      claimAge: { years: 62, months: 0 },
      formerSpouses: [
        {
          id: 'ex-survivor-former',
          relationship: survivorFormerRelationship,
          dob: '1950-01-01',
          piaMonthly: 600,
          marriageYears: survivorFormerRelationship === 'surviving-divorced' ? 10 : 15,
          remarriedAtAge: null,
        },
      ],
    },
    {
      id: 'ss-decedent',
      type: 'socialSecurity',
      personId: 'p2',
      piaMonthly: 4_000,
      earnings: null,
      claimAge: { years: 62, months: 0 },
    },
  ] as never

  return {
    plan,
    params: { year: 2028 },
    projection: {
      startYear: 2028,
      result: {
        years: [
          {
            year: 2028,
            people: [
              { personId: 'p1', ageAttained: 64, alive: true, lifeAge: 95 },
              { personId: 'p2', ageAttained: 64, alive: false, lifeAge: 63 },
            ],
            socialSecurityStreams: [
              {
                personId: 'p1',
                streamId: 'ss-claimant',
                source: 'survivor',
                annualAmount: 24_000,
                claimInForce: true,
                preWithholdingAnnual: 24_000,
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
            ],
          },
        ],
      },
    },
  } as unknown as DetectorContext
}

/**
 * MFJ with a live co-person and a surviving-divorced former already paying
 * survivor benefits before the horizon. 404.336(a)(2) ten-year duration and
 * preserved remarriage (null remarriedAtAge) are plan facts; published survivor
 * at start is the insight input.
 */
function survivingDivorcedAlreadyPayingWithLiveCoPersonContext(): DetectorContext {
  const plan = singlePersonPlan({ dob: '1956-01-01', planningAge: 95 })
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people.push({
    id: 'p2',
    name: 'Sam',
    dob: '1956-01-01',
    sex: 'average',
    retirementAge: null,
    longevity: { planningAge: 95, source: 'manual' },
  })
  plan.incomes = [
    {
      id: 'ss-claimant',
      type: 'socialSecurity',
      personId: 'p1',
      piaMonthly: 500,
      earnings: null,
      claimAge: { years: 62, months: 0 },
      formerSpouses: [
        {
          id: 'ex-surviving-divorced',
          relationship: 'surviving-divorced',
          dob: '1950-06-15',
          piaMonthly: 2_400,
          marriageYears: 10,
          remarriedAtAge: null,
        },
      ],
    },
    {
      id: 'ss-co-spouse',
      type: 'socialSecurity',
      personId: 'p2',
      piaMonthly: 1_800,
      earnings: null,
      claimAge: { years: 66, months: 0 },
    },
  ] as never

  return {
    plan,
    params: { year: 2026 },
    projection: {
      startYear: 2026,
      result: {
        years: [
          {
            year: 2026,
            people: [
              { personId: 'p1', ageAttained: 70, alive: true, lifeAge: 95 },
              { personId: 'p2', ageAttained: 70, alive: true, lifeAge: 95 },
            ],
            socialSecurityStreams: [
              {
                personId: 'p1',
                streamId: 'ss-claimant',
                source: 'survivor',
                annualAmount: 28_800,
                claimInForce: true,
                preWithholdingAnnual: 28_800,
                isSpousalSurvivorGateStream: true,
              },
              {
                personId: 'p2',
                streamId: 'ss-co-spouse',
                source: 'own-retirement',
                annualAmount: 22_000,
                claimInForce: true,
                preWithholdingAnnual: 22_000,
                isSpousalSurvivorGateStream: true,
              },
            ],
          },
        ],
      },
    },
  } as unknown as DetectorContext
}

describe('ssClaimMilestone current-spouse prior-year competitor wiring', () => {
  beforeEach(() => {
    mockedHelper.mockReset()
    mockedFormer.mockReset()
    mockedFormer.mockReturnValue({ kind: 'survivor', monthly: FORMER_SENTINEL_MONTHLY })
  })

  it('calls the dual-entitlement helper with lower-earner claimant and higher-earner worker mapping', () => {
    mockedHelper.mockReturnValue(WINNING_TOTAL_MONTHLY)

    ssClaimMilestone.screen(deathAtStartCurrentSpouseContext())

    expect(mockedHelper).toHaveBeenCalledTimes(1)
    expect(mockedHelper).toHaveBeenCalledWith(expectedHelperInput)
  })

  it('fires death-at-start survivor when the helper total makes current-spouse beat the former sentinel', () => {
    mockedHelper.mockReturnValue(WINNING_TOTAL_MONTHLY)

    expect(ssClaimMilestone.screen(deathAtStartCurrentSpouseContext())).not.toBeNull()
  })

  it('stays silent when the helper total leaves current-spouse below the former sentinel', () => {
    mockedHelper.mockReturnValue(LOSING_TOTAL_MONTHLY)

    expect(ssClaimMilestone.screen(deathAtStartCurrentSpouseContext())).toBeNull()
  })

  it('discriminates winner ordering by varying the injected helper total around the former threshold', () => {
    mockedHelper
      .mockReturnValueOnce(560 + 700)
      .mockReturnValueOnce(WINNING_TOTAL_MONTHLY)

    expect(ssClaimMilestone.screen(deathAtStartCurrentSpouseContext())).toBeNull()
    expect(ssClaimMilestone.screen(deathAtStartCurrentSpouseContext())).not.toBeNull()
  })

  it('stays silent for surviving-divorced survivor already paying when the co-person is alive', () => {
    expect(ssClaimMilestone.screen(survivingDivorcedAlreadyPayingWithLiveCoPersonContext())).toBeNull()
    expect(mockedFormer).not.toHaveBeenCalled()
  })

  it('includes surviving-divorced formers in prior-year bestMaritalBenefit at death-at-start', () => {
    mockedHelper.mockReturnValue(WINNING_TOTAL_MONTHLY)

    ssClaimMilestone.screen(deathAtStartCurrentSpouseContext('surviving-divorced'))

    expect(mockedFormer).toHaveBeenCalled()
    const pricedFormers = mockedFormer.mock.calls[0]?.[0] as { relationship: string }[]
    expect(pricedFormers).toEqual([
      expect.objectContaining({ relationship: 'surviving-divorced', marriageYears: 10 }),
    ])
  })

  it('stays silent at death-at-start when surviving-divorced former won the prior-year menu', () => {
    mockedHelper.mockReturnValue(LOSING_TOTAL_MONTHLY)

    expect(ssClaimMilestone.screen(deathAtStartCurrentSpouseContext('surviving-divorced'))).toBeNull()
  })

  it('fires at death-at-start when current-spouse beats the surviving-divorced former sentinel', () => {
    mockedHelper.mockReturnValue(WINNING_TOTAL_MONTHLY)

    expect(ssClaimMilestone.screen(deathAtStartCurrentSpouseContext('surviving-divorced'))).not.toBeNull()
  })
})
