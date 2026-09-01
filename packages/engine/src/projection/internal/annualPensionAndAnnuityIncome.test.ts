import { describe, expect, it } from 'vitest'

import type { Account, Person } from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import type { PersonYearState } from '../types.js'
import {
  annualPensionAndAnnuityIncome,
  type AnnualPensionAndAnnuityIncomeInput,
} from './annualPensionAndAnnuityIncome.js'

const pat: Person = {
  id: 'p1',
  name: 'Pat',
  dob: '1966-01-01',
  sex: 'average',
  retirementAge: 60,
  longevity: { planningAge: 95, source: 'manual' },
}

const sam: Person = {
  id: 'p2',
  name: 'Sam',
  dob: '1966-01-01',
  sex: 'average',
  retirementAge: 60,
  longevity: { planningAge: 95, source: 'manual' },
}

function pension(
  id: string,
  monthlyAmount: number,
  source: 'private' | 'public',
): Account {
  return {
    type: 'pension',
    id,
    name: id,
    ownerPersonId: pat.id,
    annualReturnPct: null,
    startAge: 60,
    monthlyAmount,
    colaPct: 0,
    survivorPct: 50,
    source,
  }
}

function annuity(
  taxQualification: 'qualified' | 'nonQualified',
): Account {
  return {
    type: 'annuity',
    id: 'annuity',
    name: 'Annuity',
    ownerPersonId: pat.id,
    annualReturnPct: null,
    startAge: 60,
    monthlyAmount: 10_000 / 12,
    colaPct: 0,
    taxablePct: 100,
    purchase: {
      year: 2026,
      premium: 150_000,
      fundingAccountId: 'funding',
      taxQualification,
    },
  }
}

function annualInput(
  accounts: readonly Account[],
  peopleStates: readonly PersonYearState[] = [
    { personId: pat.id, ageAttained: 60, alive: true, lifeAge: 95 },
    { personId: sam.id, ageAttained: 60, alive: true, lifeAge: 95 },
  ],
): AnnualPensionAndAnnuityIncomeInput {
  const people = [pat, sam]
  return {
    accounts,
    people,
    personById: new Map(people.map((person) => [person.id, person])),
    peopleStates,
    primaryPersonId: pat.id,
    lifeAgeOf: (person) => person.longevity.planningAge,
    runtimeOccurrenceKey: (kind, ...binding) =>
      JSON.stringify([kind, ...binding]),
    pack: packForYear(2026).pack,
    year: 2026,
    recordCashFlow: true,
    opening: {
      annuityIncome: 0,
      pensionIncome: 0,
      ordinaryIncome: 0,
      privateRetirementOrdinary: 0,
      publicPensionOrdinary: 0,
    },
    annuityInvestmentInContract: new Map(),
    annuityExclusionState: new Map(),
    annuityContractValue: new Map(),
    annuityContractPoolOwner: new Map(),
  }
}

describe('annualPensionAndAnnuityIncome', () => {
  it('folds living and survivor pension payments into the correct state-tax subsets', () => {
    const living = annualPensionAndAnnuityIncome(annualInput([
      pension('private-pension', 1_000, 'private'),
      pension('public-pension', 500, 'public'),
    ]))
    expect(living.pensionIncome).toBe(18_000)
    expect(living.ordinaryIncome).toBe(18_000)
    expect(living.privateRetirementOrdinary).toBe(12_000)
    expect(living.publicPensionOrdinary).toBe(6_000)
    expect(living.rows).toEqual([
      {
        kind: 'pension',
        record: {
          accountId: 'private-pension',
          payeePersonId: 'p1',
          amount: 12_000,
          source: 'private',
        },
      },
      {
        kind: 'pension',
        record: {
          accountId: 'public-pension',
          payeePersonId: 'p1',
          amount: 6_000,
          source: 'public',
        },
      },
    ])

    const survivor = annualPensionAndAnnuityIncome(annualInput(
      [pension('private-pension', 1_000, 'private')],
      [
        { personId: pat.id, ageAttained: 63, alive: false, lifeAge: 62 },
        { personId: sam.id, ageAttained: 63, alive: true, lifeAge: 95 },
      ],
    ))
    expect(survivor.pensionIncome).toBe(6_000)
    expect(survivor.rows[0]).toEqual({
      kind: 'pension',
      record: {
        accountId: 'private-pension',
        payeePersonId: 'p2',
        amount: 6_000,
        source: 'private',
      },
    })

    const ownerDiedBeforeStart = annualPensionAndAnnuityIncome({
      ...annualInput(
        [pension('private-pension', 1_000, 'private')],
        [
          { personId: pat.id, ageAttained: 63, alive: false, lifeAge: 59 },
          { personId: sam.id, ageAttained: 63, alive: true, lifeAge: 95 },
        ],
      ),
      lifeAgeOf: () => 59,
    })
    expect(ownerDiedBeforeStart.pensionIncome).toBe(0)
    expect(ownerDiedBeforeStart.rows).toEqual([])
  })

  it('plans the Pub 939 exclusion write without mutating the supplied map', () => {
    const exclusionState = new Map<string, { ratio: number; remaining: number }>()
    const input = {
      ...annualInput([annuity('nonQualified')]),
      annuityInvestmentInContract: new Map([['annuity', 150_000]]),
      annuityExclusionState: exclusionState,
    }

    const result = annualPensionAndAnnuityIncome(input)
    // Independent Pub 939 worksheet: age-60 Table V multiple 24.2;
    // expected return = $10,000 × 24.2 = $242,000; exclusion ratio =
    // $150,000 / $242,000; taxable payment = $10,000 × (1 - ratio).
    const ratio = 150_000 / 242_000
    const excluded = 10_000 * ratio
    expect(result.annuityIncome).toBeCloseTo(10_000, 9)
    expect(result.ordinaryIncome).toBeCloseTo(10_000 - excluded, 9)
    expect(result.rows[0]).toEqual(expect.objectContaining({
      kind: 'annuity',
      exclusionStateWrite: {
        accountId: 'annuity',
        value: {
          ratio,
          remaining: 150_000 - excluded,
        },
      },
    }))
    expect(exclusionState.size).toBe(0)
  })

  it('does not mutate a carried Pub 939 exclusion entry', () => {
    const carried = { ratio: 0.25, remaining: 8_000 }
    const exclusionState = new Map([['annuity', carried]])
    const result = annualPensionAndAnnuityIncome({
      ...annualInput([annuity('nonQualified')]),
      annuityExclusionState: exclusionState,
    })

    expect(result.annuityIncome).toBeCloseTo(10_000, 9)
    expect(result.ordinaryIncome).toBeCloseTo(7_500, 9)
    expect(result.rows[0]).toEqual(expect.objectContaining({
      kind: 'annuity',
      exclusionStateWrite: {
        accountId: 'annuity',
        value: { ratio: 0.25, remaining: 5_500 },
      },
    }))
    expect(exclusionState.get('annuity')).toBe(carried)
    expect(carried).toEqual({ ratio: 0.25, remaining: 8_000 })
  })

  it('returns a qualified-contract debit and publication without mutating contract state', () => {
    const contractValues = new Map([['annuity', 5_000]])
    const result = annualPensionAndAnnuityIncome({
      ...annualInput([annuity('qualified')]),
      annuityContractValue: contractValues,
      annuityContractPoolOwner: new Map([['annuity', pat.id]]),
      runtimeOccurrenceKey: (kind, ...binding) =>
        `sentinel:${kind}:${binding.join(':')}`,
    })

    // IRC 408(d)(2)(B) puts the full $10,000 payment into current ordinary
    // income here even though the contract-value channel can debit only $5,000;
    // the annual settlement applies any Form 8606 basis later.
    expect(result.annuityIncome).toBe(10_000)
    expect(result.ordinaryIncome).toBe(10_000)
    expect(result.privateRetirementOrdinary).toBe(10_000)
    expect(result.qualifiedAnnuityPayments).toEqual([{
      annuityAccountId: 'annuity',
      payment: 10_000,
      fundingOwnerPersonId: pat.id,
    }])
    expect(result.rows[0]).toEqual(expect.objectContaining({
      kind: 'annuity',
      contractDistribution: {
        annuityAccountId: 'annuity',
        poolOwnerPersonId: pat.id,
        grossAmountPlanDollars: 10_000,
        contractValueAfter: 0,
        occurrence: expect.objectContaining({
          producerOccurrenceKey:
            'sentinel:annuityContractDistribution:annuity',
          kind: 'annuityContractDistribution',
          grossAmountPlanDollars: 10_000,
          ownerPersonId: pat.id,
          sourceAccountId: 'annuity',
        }),
        application: expect.objectContaining({
          applicationKind: 'debit',
          producerOccurrenceKey:
            'sentinel:annuityContractDistribution:annuity',
          sourceBalanceBeforePlanDollars: 5_000,
          appliedAmountPlanDollars: 5_000,
          sourceBalanceAfterPlanDollars: 0,
        }),
      },
    }))
    expect(contractValues.get('annuity')).toBe(5_000)
  })

  it('omits cash-flow records when capture is disabled without omitting effects', () => {
    const nonqualified = {
      ...annuity('nonQualified'),
      id: 'nonqualified-annuity',
    } satisfies Account
    const qualified = {
      ...annuity('qualified'),
      id: 'qualified-annuity',
    } satisfies Account
    const result = annualPensionAndAnnuityIncome({
      ...annualInput([
        pension('private-pension', 1_000, 'private'),
        nonqualified,
        qualified,
      ]),
      recordCashFlow: false,
      annuityInvestmentInContract: new Map([
        ['nonqualified-annuity', 150_000],
      ]),
      annuityContractValue: new Map([['qualified-annuity', 5_000]]),
      annuityContractPoolOwner: new Map([['qualified-annuity', pat.id]]),
    })

    expect(result.pensionIncome).toBe(12_000)
    expect(result.annuityIncome).toBe(20_000)
    expect(result.ordinaryIncome).toBeCloseTo(25_801.652892561982, 9)
    expect(result.rows.map((row) => row.record)).toEqual([null, null, null])
    expect(result.rows[1]).toEqual(expect.objectContaining({
      kind: 'annuity',
      accountId: 'nonqualified-annuity',
      exclusionStateWrite: {
        accountId: 'nonqualified-annuity',
        value: {
          ratio: 0.6198347107438017,
          remaining: 143_801.65289256198,
        },
      },
    }))
    expect(result.rows[2]).toEqual(expect.objectContaining({
      kind: 'annuity',
      accountId: 'qualified-annuity',
      contractDistribution: expect.objectContaining({
        annuityAccountId: 'qualified-annuity',
        contractValueAfter: 0,
      }),
    }))
    expect(result.qualifiedAnnuityPayments).toHaveLength(1)
  })
})
