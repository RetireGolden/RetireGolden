import { expect, it } from 'vitest'

import { packForYear } from '../../params/index.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import {
  annualLegacyQcdGiftPlan,
  type AnnualLegacyQcdGiftPlanInput,
} from './annualLegacyQcdGiftPlan.js'

const pack = packForYear(2026).pack

function expectWithin(
  actual: number,
  expected: number,
  tolerance: Parameters<typeof withinTolerance>[2],
  label: string,
): void {
  expect(
    withinTolerance(actual, expected, tolerance),
    `${label} ${actual} is not within ${JSON.stringify(tolerance)} of the worksheet's ${expected}`,
  ).toBe(true)
}

describeCalculation(
  'qcd-limit-and-age-proxy',
  {
    example: {
      inputs: {
        qcdAnnualLimit: 111_000,
        limitGrowth: 1,
        atCap: { ageAttained: 71, birthMonth: 12, requestedGift: 111_000 },
        ageGateEligible: { ageAttained: 70, birthMonth: 6, requestedGift: 1_000 },
        ageGateIneligible: { ageAttained: 70, birthMonth: 7, requestedGift: 1_000 },
      },
      expected: { perDonorCap: 111_000, atCap: 111_000, ageGateEligible: 1_000, ageGateIneligible: 0 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/rmd/qcd-limit-and-age-proxy.md',
    mutation: 'DOCS/calculations/rmd/qcd-limit-and-age-proxy.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | { ageAttained: number; birthMonth: number; requestedGift: number }>
    const expected = example.expected as Record<string, number>
    const limitGrowth = inputs.limitGrowth as number
    const perDonorLimit = pack.rmd.qcdAnnualLimit * limitGrowth

    const giftFor = (
      donor: { ageAttained: number; birthMonth: number; requestedGift: number },
      overrides: Partial<AnnualLegacyQcdGiftPlanInput> = {},
    ) =>
      annualLegacyQcdGiftPlan({
        qcdAnnual: donor.requestedGift,
        inflFactor: limitGrowth,
        perDonorLimit,
        hasNamedQcdRequest: false,
        people: [
          { personId: 'p1', alive: true, ageAttained: donor.ageAttained, birthMonth: donor.birthMonth },
        ],
        ownedIraRmdTotal: 0,
        ownedIraRmdGrossByOwner: new Map(),
        balances: [
          {
            balanceIndex: 0,
            accountId: 'ira-1',
            ownerId: 'p1',
            isAggregatedIra: true,
            balance: 500_000,
          },
        ],
        ...overrides,
      })

    it('caps one donor at the pack\'s 111,000 limit times the limit growth', () => {
      expect(pack.rmd.qcdAnnualLimit).toBe(inputs.qcdAnnualLimit)
      expectWithin(perDonorLimit, expected.perDonorCap!, example.tolerance, 'perDonorCap')
      const atCap = inputs.atCap as { ageAttained: number; birthMonth: number; requestedGift: number }
      expectWithin(giftFor(atCap).qcd, expected.atCap!, example.tolerance, 'qcd at cap')
    })

    it('admits an attained-70 donor born in June under the annual 70.5 proxy', () => {
      const eligible = inputs.ageGateEligible as { ageAttained: number; birthMonth: number; requestedGift: number }
      expectWithin(giftFor(eligible).qcd, expected.ageGateEligible!, example.tolerance, 'qcd on the eligible side')
    })

    it('refuses an attained-70 donor born in July under the same proxy', () => {
      const ineligible = inputs.ageGateIneligible as { ageAttained: number; birthMonth: number; requestedGift: number }
      const plan = giftFor(ineligible)
      expectWithin(plan.qcd, expected.ageGateIneligible!, example.tolerance, 'qcd on the ineligible side')
      expect(plan.debitIntents).toEqual([])
    })

    it('holds the cap per donor rather than per household', () => {
      // The third wrong reading: a household cap would leave two donors with
      // the same 111,000 the single donor had.
      const twoDonors = annualLegacyQcdGiftPlan({
        qcdAnnual: perDonorLimit * 2,
        inflFactor: limitGrowth,
        perDonorLimit,
        hasNamedQcdRequest: false,
        people: [
          { personId: 'p1', alive: true, ageAttained: 71, birthMonth: 12 },
          { personId: 'p2', alive: true, ageAttained: 71, birthMonth: 12 },
        ],
        ownedIraRmdTotal: 0,
        ownedIraRmdGrossByOwner: new Map(),
        balances: [
          { balanceIndex: 0, accountId: 'ira-1', ownerId: 'p1', isAggregatedIra: true, balance: 500_000 },
          { balanceIndex: 1, accountId: 'ira-2', ownerId: 'p2', isAggregatedIra: true, balance: 500_000 },
        ],
      })
      expectWithin(twoDonors.qcd, expected.perDonorCap! * 2, example.tolerance, 'qcd for two donors')
    })
  },
)
