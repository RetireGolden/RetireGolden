import { describe, expect, it } from 'vitest'

import { describeRule } from '../../rules/describeRule.js'
import {
  annualLegacyQcdGiftPlan,
  type AnnualLegacyQcdGiftPlanInput,
} from './annualLegacyQcdGiftPlan.js'

/**
 * Authorities for the fixture worksheets below:
 * - IRC 408(d)(8)(A): the indexed annual exclusion is measured per taxpayer.
 * - IRC 408(d)(8)(B)(ii): the donor must have attained age 70½.
 * - DOCS/domain/domain-rules-reference/06-rmds-secure-20.md, "QCD": the
 *   registered annual age proxy and the household-scalar attribution,
 *   sorted-reallocation, source-order, and exact-cent conventions.
 */

function baseInput(
  patch: Partial<AnnualLegacyQcdGiftPlanInput> = {},
): AnnualLegacyQcdGiftPlanInput {
  return {
    qcdAnnual: 10_000,
    inflFactor: 1,
    perDonorLimit: 111_000,
    hasNamedQcdRequest: false,
    people: [{
      personId: 'p1', alive: true, ageAttained: 71, birthMonth: 12,
    }],
    ownedIraRmdTotal: 0,
    ownedIraRmdGrossByOwner: new Map(),
    balances: [],
    ...patch,
  }
}

describeRule('irc-408-d-8-B-ii-projection-annual-age-proxy', {
  readings: {
    statutoryDatedGateCannotAdmitAnUndatedGift: 0,
    registeredAnnualJuneBirthProxy: 111_000,
  },
  accepted: 'statutoryDatedGateCannotAdmitAnUndatedGift',
  produced: 'registeredAnnualJuneBirthProxy',
  note: 'scalar planner annual age proxy',
}, ({ accepted, produced }) => {
  it('admits a June-born age-70 donor for the annual scalar', () => {
    // IRC 408(d)(8)(B)(ii) is a dated 70½ gate. The scalar carries no date;
    // the registered projection convention uses birth months 1-6 in the year
    // ageAttained is 70, a deliberately permissive annual approximation.
    const result = annualLegacyQcdGiftPlan(baseInput({
      qcdAnnual: 500_000,
      people: [{
        personId: 'june', alive: true, ageAttained: 70, birthMonth: 6,
      }],
      balances: [{
        balanceIndex: 0, accountId: 'june-ira', ownerId: 'june',
        isAggregatedIra: true, balance: 500_000,
      }],
    }))

    expect(result.qcd).toBe(produced)
    expect(result.qcd).not.toBe(accepted)
  })

  it('excludes a July-born age-70 donor from the annual scalar', () => {
    // The same annual proxy turns off on the other side of its independent
    // month boundary: a July birth does not reach 70½ in this calendar year.
    const result = annualLegacyQcdGiftPlan(baseInput({
      qcdAnnual: 500_000,
      people: [{
        personId: 'july', alive: true, ageAttained: 70, birthMonth: 7,
      }],
      balances: [{
        balanceIndex: 0, accountId: 'july-ira', ownerId: 'july',
        isAggregatedIra: true, balance: 500_000,
      }],
    }))

    expect(result.qcd).toBe(accepted)
    expect(result.qcd).not.toBe(produced)
    expect(result.qcdGrossByOwner).toEqual(new Map())
  })
})

describeRule('irc-408-d-8-A-projection-household-qcd-aggregation', {
  readings: {
    statutoryPerTaxpayerCaps: 222_000,
    rejectedSingleHouseholdCap: 111_000,
  },
  accepted: 'statutoryPerTaxpayerCaps',
  note: 'two eligible donors each receive the Notice 2025-67 limit',
}, ({ accepted, readings }) => {
  it('allows two eligible taxpayers one indexed cap apiece', () => {
    // Independent worksheet: IRC 408(d)(8)(A) measures the exclusion "with
    // respect to a taxpayer" and Notice 2025-67 supplies $111,000 for 2026.
    // Two eligible donors therefore carry 2 × $111,000 = $222,000, not one
    // household-wide $111,000 cap.
    const result = annualLegacyQcdGiftPlan(baseInput({
      qcdAnnual: 500_000,
      people: [
        { personId: 'p1', alive: true, ageAttained: 80, birthMonth: 1 },
        { personId: 'p2', alive: true, ageAttained: 80, birthMonth: 1 },
      ],
      balances: [
        {
          balanceIndex: 0, accountId: 'p1-ira', ownerId: 'p1',
          isAggregatedIra: true, balance: 500_000,
        },
        {
          balanceIndex: 1, accountId: 'p2-ira', ownerId: 'p2',
          isAggregatedIra: true, balance: 500_000,
        },
      ],
    }))

    expect(result.qcd).toBe(accepted)
    expect(result.qcd).not.toBe(readings.rejectedSingleHouseholdCap)
    expect([...result.qcdGrossByOwner]).toEqual([
      ['p1', 111_000],
      ['p2', 111_000],
    ])
  })
})

describeRule('irc-408-d-8-A-projection-household-qcd-aggregation', {
  readings: {
    registeredSortedReallocation: 110,
    rejectedSingleProportionalPass: 107.5,
  },
  accepted: 'registeredSortedReallocation',
  note: 'stranded routed dollars are reallocated',
}, ({ accepted, readings }) => {
  it('offers a capped owner’s stranded routed share to the other owner', () => {
    // Independent convention worksheet from the registered rule: a $150 gift
    // over RMD grosses a=$10 and z=$190 first attributes $7.50/$142.50. z is
    // clamped at $100, leaving $42.50; a can accept $2.50 more, so routed QCD
    // is $110. A single proportional pass would stop at $107.50.
    const result = annualLegacyQcdGiftPlan(baseInput({
      qcdAnnual: 150,
      perDonorLimit: 100,
      people: [
        { personId: 'z', alive: true, ageAttained: 80, birthMonth: 1 },
        { personId: 'a', alive: true, ageAttained: 80, birthMonth: 1 },
      ],
      ownedIraRmdTotal: 200,
      ownedIraRmdGrossByOwner: new Map([['z', 190], ['a', 10]]),
      balances: [],
    }))

    expect(result.qcdFromRmd).toBe(accepted)
    expect(result.qcdFromRmd).not.toBe(readings.rejectedSingleProportionalPass)
  })
})

describeRule('treas-reg-1-408-8-projection-sub-cent-distribution-discharge', {
  readings: {
    sourceResidueBeforeDischarge: 0.009,
    engineDistributedAfterDischarge: 0,
  },
  accepted: 'sourceResidueBeforeDischarge',
  produced: 'engineDistributedAfterDischarge',
  note: 'aggregate scalar-QCD sub-cent source-residue discharge',
}, ({ accepted, produced }) => {
  it('discharges a scalar-QCD source residue below one ledger cent', () => {
    const result = annualLegacyQcdGiftPlan(baseInput({
      qcdAnnual: 10,
      balances: [{
        balanceIndex: 7,
        accountId: 'sub-cent-source',
        ownerId: 'p1',
        isAggregatedIra: true,
        balance: accepted,
      }],
    }))

    expect(result.qcd).toBe(produced)
    expect(result.qcd).not.toBe(accepted)
    expect(result.debitIntents).toEqual([])
  })
})

describe('annualLegacyQcdGiftPlan', () => {
  it('fails closed for an absent scalar, a named request, and no eligible donor', () => {
    const absent = annualLegacyQcdGiftPlan(baseInput({ qcdAnnual: 0 }))
    const named = annualLegacyQcdGiftPlan(baseInput({ hasNamedQcdRequest: true }))
    const ineligible = annualLegacyQcdGiftPlan(baseInput({
      people: [
        { personId: 'young', alive: true, ageAttained: 69, birthMonth: 1 },
        { personId: 'dead', alive: false, ageAttained: 90, birthMonth: 1 },
      ],
    }))

    for (const result of [absent, named, ineligible]) {
      expect(result).toEqual({
        qcd: 0,
        qcdFromRmd: 0,
        qcdGrossByOwner: new Map(),
        qcdFromRmdByOwner: new Map(),
        debitIntents: [],
        offsetHistoryUnprovableDonorIds: [],
      })
    }
    expect(absent.qcdGrossByOwner).not.toBe(named.qcdGrossByOwner)
    expect(absent.debitIntents).not.toBe(named.debitIntents)
  })

  it('uses the half-birthday gate and one indexed cap per living donor', () => {
    const result = annualLegacyQcdGiftPlan(baseInput({
      qcdAnnual: 500_000,
      perDonorLimit: 111_000,
      people: [
        { personId: 'june', alive: true, ageAttained: 70, birthMonth: 6 },
        { personId: 'july', alive: true, ageAttained: 70, birthMonth: 7 },
        { personId: 'dead', alive: false, ageAttained: 80, birthMonth: 1 },
      ],
      balances: [
        {
          balanceIndex: 0, accountId: 'june-ira', ownerId: 'june',
          isAggregatedIra: true, balance: 500_000,
        },
        {
          balanceIndex: 1, accountId: 'july-ira', ownerId: 'july',
          isAggregatedIra: true, balance: 500_000,
        },
      ],
    }))

    expect(result.qcd).toBe(111_000)
    expect(result.qcdFromRmd).toBe(0)
    expect([...result.qcdGrossByOwner]).toEqual([['june', 111_000]])
    expect(result.debitIntents).toEqual([{
      balanceIndex: 0,
      sourceAccountId: 'june-ira',
      ownerId: 'june',
      sourceBalanceBefore: 500_000,
      amount: 111_000,
    }])
    expect(result.offsetHistoryUnprovableDonorIds).toEqual(['june'])
  })

  it('inflates the household ask before applying each donor cap', () => {
    const result = annualLegacyQcdGiftPlan(baseInput({
      qcdAnnual: 100,
      inflFactor: 1.5,
      perDonorLimit: 100,
      people: [
        { personId: 'first', alive: true, ageAttained: 80, birthMonth: 1 },
        { personId: 'second', alive: true, ageAttained: 80, birthMonth: 1 },
      ],
      balances: [
        {
          balanceIndex: 0, accountId: 'first-ira', ownerId: 'first',
          isAggregatedIra: true, balance: 200,
        },
        {
          balanceIndex: 1, accountId: 'second-ira', ownerId: 'second',
          isAggregatedIra: true, balance: 200,
        },
      ],
    }))

    expect(result.qcd).toBe(150)
    expect([...result.qcdGrossByOwner]).toEqual([
      ['first', 100],
      ['second', 50],
    ])
    expect(result.debitIntents.map((intent) => intent.amount))
      .toEqual([100, 50])
  })

  it('sorts routed owners, clamps personal capacity, and reallocates before debiting', () => {
    const input = baseInput({
      qcdAnnual: 150,
      perDonorLimit: 100,
      people: [
        { personId: 'z-owner', alive: true, ageAttained: 80, birthMonth: 12 },
        { personId: 'a-owner', alive: true, ageAttained: 80, birthMonth: 12 },
      ],
      ownedIraRmdTotal: 200,
      // Deliberately reverse lexical insertion order. Attribution sorts it.
      ownedIraRmdGrossByOwner: new Map([
        ['z-owner', 190],
        ['a-owner', 10],
      ]),
      balances: [
        {
          balanceIndex: 0, accountId: 'z-ira', ownerId: 'z-owner',
          isAggregatedIra: true, balance: 100,
        },
        {
          balanceIndex: 1, accountId: 'a-ira', ownerId: 'a-owner',
          isAggregatedIra: true, balance: 100,
        },
      ],
    })
    const peopleBefore = structuredClone(input.people)
    const balancesBefore = structuredClone(input.balances)
    const rmdBefore = [...input.ownedIraRmdGrossByOwner]

    const result = annualLegacyQcdGiftPlan(input)

    expect(result.qcdFromRmd).toBe(110)
    expect(result.qcd).toBe(150)
    expect([...result.qcdFromRmdByOwner]).toEqual([
      ['a-owner', 10],
      ['z-owner', 100],
    ])
    expect([...result.qcdGrossByOwner]).toEqual([
      ['a-owner', 50],
      ['z-owner', 100],
    ])
    expect(result.debitIntents).toEqual([{
      balanceIndex: 1,
      sourceAccountId: 'a-ira',
      ownerId: 'a-owner',
      sourceBalanceBefore: 100,
      amount: 40,
    }])
    expect(result.offsetHistoryUnprovableDonorIds).toEqual([
      'z-owner', 'a-owner',
    ])
    expect(input.people).toEqual(peopleBefore)
    expect(input.balances).toEqual(balancesBefore)
    expect([...input.ownedIraRmdGrossByOwner]).toEqual(rmdBefore)
  })

  it('filters sources in caller order, floors a full drain, and skips sub-cent movement', () => {
    const result = annualLegacyQcdGiftPlan(baseInput({
      qcdAnnual: 10,
      balances: [
        {
          balanceIndex: 0, accountId: 'not-ira', ownerId: 'p1',
          isAggregatedIra: false, balance: 100,
        },
        {
          balanceIndex: 1, accountId: 'other-owner', ownerId: 'p2',
          isAggregatedIra: true, balance: 100,
        },
        {
          balanceIndex: 2, accountId: 'sub-cent', ownerId: 'p1',
          isAggregatedIra: true, balance: 0.009,
        },
        {
          balanceIndex: 3, accountId: 'fractional', ownerId: 'p1',
          isAggregatedIra: true, balance: 3.456,
        },
        {
          balanceIndex: 4, accountId: 'remainder', ownerId: 'p1',
          isAggregatedIra: true, balance: 10,
        },
      ],
    }))

    expect(result.qcd).toBe(10)
    expect([...result.qcdGrossByOwner]).toEqual([['p1', 10]])
    expect(result.debitIntents).toEqual([
      {
        balanceIndex: 3,
        sourceAccountId: 'fractional',
        ownerId: 'p1',
        sourceBalanceBefore: 3.456,
        amount: 3.45,
      },
      {
        balanceIndex: 4,
        sourceAccountId: 'remainder',
        ownerId: 'p1',
        sourceBalanceBefore: 10,
        amount: 6.55,
      },
    ])
  })

  it('preserves proportional arithmetic association before assigning the residue', () => {
    const result = annualLegacyQcdGiftPlan(baseInput({
      qcdAnnual: 0.01,
      perDonorLimit: 1,
      people: [
        { personId: 'b', alive: true, ageAttained: 80, birthMonth: 12 },
        { personId: 'a', alive: true, ageAttained: 80, birthMonth: 12 },
      ],
      ownedIraRmdTotal: 0.03,
      ownedIraRmdGrossByOwner: new Map([
        ['b', 0.02],
        ['a', 0.01],
      ]),
    }))
    const originalAssociation = 0.01 * (0.01 / 0.03)
    const regrouped = (0.01 * 0.01) / 0.03

    expect(originalAssociation).toBe(0.003333333333333334)
    expect(regrouped).toBe(0.0033333333333333335)
    expect(originalAssociation).not.toBe(regrouped)
    expect(result.qcd).toBe(0.01)
    expect(result.qcdFromRmd).toBe(0.01)
    expect([...result.qcdFromRmdByOwner]).toEqual([
      ['a', originalAssociation],
      ['b', 0.006666666666666666],
    ])
    // Donor history retains household insertion order even though routed
    // owner attribution uses sorted ids.
    expect(result.offsetHistoryUnprovableDonorIds).toEqual(['b', 'a'])
  })

  it('publishes the routed amount after the ordered beyond-RMD debit fold', () => {
    const result = annualLegacyQcdGiftPlan(baseInput({
      qcdAnnual: 1.3,
      perDonorLimit: 10,
      ownedIraRmdTotal: 0.1,
      ownedIraRmdGrossByOwner: new Map([['p1', 0.1]]),
      balances: [
        {
          balanceIndex: 0, accountId: 'first', ownerId: 'p1',
          isAggregatedIra: true, balance: 0.29,
        },
        {
          balanceIndex: 1, accountId: 'second', ownerId: 'p1',
          isAggregatedIra: true, balance: 2,
        },
      ],
    }))
    const historicalFold = result.debitIntents.reduce(
      (qcd, intent) => qcd + intent.amount,
      0,
    ) + result.qcdFromRmd

    expect(result.debitIntents.map((intent) => intent.amount))
      .toEqual([0.29, 0.9099999999999999])
    expect(result.qcd).toBe(historicalFold)
  })

  it('retains a representable partial fraction', () => {
    const balances = [{
      balanceIndex: 7,
      accountId: 'fractional-source',
      ownerId: 'p1',
      isAggregatedIra: true,
      balance: 1,
    }]
    const partialFraction = annualLegacyQcdGiftPlan(baseInput({
      qcdAnnual: 0.015,
      balances,
    }))

    expect(partialFraction.qcd).toBe(0.015)
    expect(partialFraction.debitIntents).toEqual([{
      balanceIndex: 7,
      sourceAccountId: 'fractional-source',
      ownerId: 'p1',
      sourceBalanceBefore: 1,
      amount: 0.015,
    }])
  })

  it('emits one intent for an aggregate logical source crossing its first physical capacity', () => {
    // The caller groups compatible physical rows before this boundary. A
    // $1,200 logical IRA backed by $1,000 + $200 physical rows therefore
    // crosses the first row's capacity as one source, one debit, and one
    // runtime identity. Its opaque logical index is preserved exactly.
    const result = annualLegacyQcdGiftPlan(baseInput({
      qcdAnnual: 1_100,
      people: [{
        personId: 'p1', alive: true, ageAttained: 70, birthMonth: 6,
      }],
      balances: [{
        balanceIndex: 9, accountId: 'grouped-ira', ownerId: 'p1',
        isAggregatedIra: true, balance: 1_200,
      }],
    }))

    expect(result.qcd).toBe(1_100)
    expect(result.debitIntents).toEqual([{
      balanceIndex: 9,
      sourceAccountId: 'grouped-ira',
      ownerId: 'p1',
      sourceBalanceBefore: 1_200,
      amount: 1_100,
    }])
  })

  it('returns fresh maps, intents, and intent objects on every invocation', () => {
    const input = baseInput({
      balances: [{
        balanceIndex: 0, accountId: 'ira', ownerId: 'p1',
        isAggregatedIra: true, balance: 10_000,
      }],
    })
    const first = annualLegacyQcdGiftPlan(input)
    const second = annualLegacyQcdGiftPlan(input)

    expect(first).toEqual(second)
    expect(first.qcdGrossByOwner).not.toBe(second.qcdGrossByOwner)
    expect(first.qcdFromRmdByOwner).not.toBe(second.qcdFromRmdByOwner)
    expect(first.debitIntents).not.toBe(second.debitIntents)
    expect(first.debitIntents[0]).not.toBe(second.debitIntents[0])
    expect(first.offsetHistoryUnprovableDonorIds)
      .not.toBe(second.offsetHistoryUnprovableDonorIds)
  })
})
