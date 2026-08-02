import { describe, expect, it } from 'vitest'

import { asAccountId, asPersonId } from './identity.js'
import { asPositiveUsdCents } from './money.js'
import {
  allocateRetirementActionCandidateIdentity,
  type QcdCandidateIdentityIntent,
} from './retirementActionCandidateIdentityAllocator.js'
import type { Account, Plan } from '../model/plan.js'
import { couplePlan, singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'

const charity = {
  designationId: 'charity-a',
  name: 'Public charity',
  designationKind: 'eligiblePublicCharity' as const,
  directFromCustodianAttested: true,
  eligibleOrganizationAttested: true,
  notDonorAdvisedFundOrSupportingOrganizationAttested: true,
  notSplitInterestEntityAttested: true,
  entireDistributionOtherwiseDeductibleAttested: true,
}

function qcdIntent(overrides: Partial<QcdCandidateIdentityIntent> = {}): QcdCandidateIdentityIntent {
  return {
    kind: 'qcd',
    year: 2030,
    executionDate: '2030-09-01',
    executionSequence: 1,
    requestedAmount: asPositiveUsdCents(25_000),
    donorPersonId: asPersonId('p1'),
    provenance: { source: 'generator', sourceId: 'qcd-efficiency' },
    sourceAllocation: {
      sourceAccountId: asAccountId('ira-a'),
      requestedAmount: asPositiveUsdCents(25_000),
    },
    charity,
    ...overrides,
  }
}

describe('QCD candidate identity allocation', () => {
  it('materializes a deterministic owned-IRA QCD independent of Plan order', () => {
    const plan = couplePlan()
    plan.accounts = [
      traditionalAccount('ira-b', 100_000),
      traditionalAccount('ira-a', 100_000),
    ]
    const permuted: Plan = {
      ...plan,
      household: { ...plan.household, people: [...plan.household.people].reverse() },
      accounts: [...plan.accounts].reverse(),
    }

    const first = allocateRetirementActionCandidateIdentity(plan, qcdIntent())
    const second = allocateRetirementActionCandidateIdentity(permuted, qcdIntent())

    expect(second).toEqual(first)
    expect(first.status).toBe('allocated')
    if (first.status !== 'allocated') return
    expect(first.request).toMatchObject({
      kind: 'qcd',
      donorPersonId: 'p1',
      requestedAmount: 25_000,
      allocation: { sourceAccountId: 'ira-a', requestedAmount: 25_000 },
      charity: { designationId: 'charity-a' },
    })
    expect(first.evidence).toMatchObject({
      personId: 'p1',
      sourceAccountIds: ['ira-a'],
      destinationRothAccountId: null,
    })
  })

  it('preserves an omitted execution date without inventing one', () => {
    const plan = singlePersonPlan()
    plan.accounts = [traditionalAccount('ira-a', 100_000)]
    const intent = qcdIntent({ executionDate: undefined })

    const result = allocateRetirementActionCandidateIdentity(plan, intent)

    expect(result.status).toBe('allocated')
    if (result.status !== 'allocated') return
    expect(result.request.kind).toBe('qcd')
    expect(result.request.executionDate).toBeUndefined()
  })

  it('fails closed for cross-owner, joint, employer, inherited, and ambiguous sources', () => {
    const plan = couplePlan()
    const joint = traditionalAccount('joint', 100_000)
    joint.ownerPersonId = null
    const employer = { ...traditionalAccount('employer', 100_000), kind: 'employer' as const }
    const inherited = {
      ...traditionalAccount('inherited', 100_000),
      inherited: { ownerDeathYear: 2025, decedentHadStartedRmds: true },
    }
    plan.accounts = [
      traditionalAccount('p2-ira', 100_000, 'p2'),
      joint,
      employer,
      inherited,
    ]
    const reason = (accountId: string) => {
      const result = allocateRetirementActionCandidateIdentity(plan, qcdIntent({
        sourceAllocation: {
          sourceAccountId: asAccountId(accountId),
          requestedAmount: asPositiveUsdCents(25_000),
        },
      }))
      return result.status === 'blocked'
        ? result.issues.flatMap((entry) => entry.reason?.code ?? [])
        : []
    }

    expect(reason('p2-ira')).toContain('qcd-source-owner-mismatch')
    expect(reason('joint')).toContain('qcd-source-owner-mismatch')
    expect(reason('employer')).toContain('qcd-source-not-ira')
    expect(reason('inherited')).toContain('qcd-inherited-basis-unsupported')

    const duplicated: Plan = {
      ...plan,
      accounts: [traditionalAccount('ira-a', 100_000), traditionalAccount('ira-a', 100_000)] as Account[],
    }
    const ambiguous = allocateRetirementActionCandidateIdentity(duplicated, qcdIntent())
    expect(ambiguous.status).toBe('blocked')
    if (ambiguous.status === 'blocked') {
      expect(ambiguous.issues.map((entry) => entry.kind)).toContain('ambiguousIdentity')
    }
  })

  it('rejects malformed amounts, charity facts, caller IDs, and deterministic collisions', () => {
    const plan = singlePersonPlan()
    plan.accounts = [traditionalAccount('ira-a', 100_000)]
    const malformed = allocateRetirementActionCandidateIdentity(plan, {
      ...qcdIntent(),
      requestedAmount: 25_001,
      actionId: 'caller-action',
      sourceAllocation: {
        sourceAccountId: 'ira-a',
        requestedAmount: 25_000,
        allocationId: 'caller-allocation',
      },
      charity: { ...charity, designationId: ' ' },
    } as never)
    expect(malformed.status).toBe('blocked')
    if (malformed.status === 'blocked') {
      expect(malformed.issues.map((entry) => entry.kind)).toContain('amountMismatch')
      expect(malformed.issues.map((entry) => entry.kind)).toContain('invalidIntent')
      expect(malformed.issues.map((entry) => entry.field)).toEqual(expect.arrayContaining([
        'actionId',
        'sourceAllocation.allocationId',
      ]))
    }

    const first = allocateRetirementActionCandidateIdentity(plan, qcdIntent())
    expect(first.status).toBe('allocated')
    if (first.status !== 'allocated') return
    plan.strategies.retirementActions = [first.request]
    const collision = allocateRetirementActionCandidateIdentity(plan, qcdIntent())
    expect(collision.status).toBe('blocked')
    if (collision.status === 'blocked') {
      expect(collision.issues.map((entry) => entry.kind)).toContain('generatedIdentityCollision')
    }
  })
})
