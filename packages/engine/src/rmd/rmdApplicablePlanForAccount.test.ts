import { describe, expect, it } from 'vitest'

import type { Account } from '../model/plan.js'
import { rmdApplicablePlanForAccount } from './rmdApplicablePlanForAccount.js'

type RetirementAccount = Extract<
  Account,
  { type: 'traditional' | 'roth' }
>

function account(
  overrides: Partial<RetirementAccount> & Pick<RetirementAccount, 'id'>,
): RetirementAccount {
  return {
    type: 'traditional',
    name: overrides.id,
    ownerPersonId: 'beneficiary',
    annualReturnPct: 0,
    kind: 'ira',
    balance: 100,
    annualContribution: 0,
    ...overrides,
  } as RetirementAccount
}

describe('rmdApplicablePlanForAccount', () => {
  it('pins every inherited identity branch from one shared boundary', () => {
    const inherited = {
      ownerDeathYear: 2022,
      decedentHadStartedRmds: true,
    }

    expect(rmdApplicablePlanForAccount(account({
      id: 'employer',
      kind: 'employer',
      employerPlanType: '401k',
      inherited,
    }), 'primary')).toEqual({
      kind: 'inheritedEmployerPlan',
      payeePersonId: 'beneficiary',
      accountId: 'employer',
    })
    expect(rmdApplicablePlanForAccount(account({
      id: 'unproved-ira',
      inherited,
      ownerPersonId: null,
    }), 'primary')).toEqual({
      kind: 'inheritedIraAccount',
      payeePersonId: 'primary',
      accountId: 'unproved-ira',
    })
    expect(rmdApplicablePlanForAccount(account({
      id: 'traditional-pool',
      inherited: { ...inherited, decedentId: 'decedent' },
    }), 'primary')).toEqual({
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent',
      iraType: 'traditional',
    })
    expect(rmdApplicablePlanForAccount(account({
      id: 'roth-pool',
      type: 'roth',
      inherited: { ...inherited, decedentId: 'decedent' },
    }), 'primary')).toEqual({
      kind: 'inheritedIras',
      payeePersonId: 'beneficiary',
      decedentId: 'decedent',
      iraType: 'roth',
    })
  })

  it('keeps the owned IRA, aggregable 403(b), and account-only plan identities', () => {
    expect(rmdApplicablePlanForAccount(account({ id: 'ira' }), 'primary')).toEqual({
      kind: 'ownedTraditionalIras',
      payeePersonId: 'beneficiary',
    })
    expect(rmdApplicablePlanForAccount(account({
      id: '403b',
      kind: 'employer',
      employerPlanType: '403b',
    }), 'primary')).toEqual({
      kind: 'aggregable403bPlans',
      payeePersonId: 'beneficiary',
    })
    expect(rmdApplicablePlanForAccount(account({
      id: '401k',
      kind: 'employer',
      employerPlanType: '401k',
    }), 'primary')).toEqual({
      kind: 'employerPlan',
      accountId: '401k',
    })
  })
})
