import { describe, expect, it } from 'vitest'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asPositiveUsdCents,
  asUsdCents,
  type OrdinaryWithdrawalRequest,
  type QualifiedCharitableDistributionRequest,
  type RetirementActionRequest,
  type RothConversionRequest,
} from '../../actions/index.js'
import {
  REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
  type AnnualConversionLinkedWithdrawalRelease,
} from './annualConversionLinkedWithdrawalFunding.js'
import {
  annualRetirementActionPreflight,
  type AnnualRetirementActionPreflightInput,
} from './annualRetirementActionPreflight.js'

const YEAR = 2026
const PERSON_ID = asPersonId('p1')
const CASH_ID = asAccountId('cash')
const IRA_ID = asAccountId('ira')
const ROTH_ID = asAccountId('roth')

function ordinary(
  id: string,
  options: Readonly<{
    year?: number
    date?: string
    sequence?: number
    sourceAccountId?: typeof CASH_ID
    amount?: number
    conversionId?: string
  }> = {},
): OrdinaryWithdrawalRequest {
  const amount = asPositiveUsdCents(options.amount ?? 10_000)
  return {
    actionId: asActionId(id),
    kind: 'ordinaryWithdrawal',
    personId: PERSON_ID,
    year: options.year ?? YEAR,
    executionDate: options.date ?? `${YEAR}-06-14`,
    executionSequence: options.sequence ?? 1,
    requestedAmount: amount,
    allocations: [{
      allocationId: asAllocationId(`${id}-allocation`),
      sourceAccountId: options.sourceAccountId ?? CASH_ID,
      requestedAmount: amount,
    }],
    purpose: {
      kind: 'taxPayment',
      referenceId: options.conversionId ?? 'conversion',
    },
    provenance: { source: 'manual' },
  }
}

function conversion(
  id: string,
  withdrawalId: string,
  options: Readonly<{
    year?: number
    date?: string
    sequence?: number
    amount?: number
  }> = {},
): RothConversionRequest {
  const amount = asPositiveUsdCents(options.amount ?? 50_000)
  return {
    actionId: asActionId(id),
    kind: 'rothConversion',
    personId: PERSON_ID,
    year: options.year ?? YEAR,
    executionDate: options.date ?? `${YEAR}-06-15`,
    executionSequence: options.sequence ?? 2,
    requestedAmount: amount,
    allocations: [{
      allocationId: asAllocationId(`${id}-allocation`),
      sourceAccountId: IRA_ID,
      requestedAmount: amount,
    }],
    destinationRothAccountId: ROTH_ID,
    taxFunding: {
      kind: 'linkedWithdrawal',
      withdrawalActionId: asActionId(withdrawalId),
    },
    provenance: { source: 'manual' },
  }
}

function qcd(
  id: string,
  options: Readonly<{
    date?: string
    sequence?: number
  }> = {},
): QualifiedCharitableDistributionRequest {
  const amount = asPositiveUsdCents(5_000)
  return {
    actionId: asActionId(id),
    kind: 'qcd',
    year: YEAR,
    executionDate: options.date ?? `${YEAR}-08-01`,
    executionSequence: options.sequence ?? 3,
    requestedAmount: amount,
    provenance: { source: 'manual' },
    donorPersonId: PERSON_ID,
    allocation: {
      allocationId: asAllocationId(`${id}-allocation`),
      sourceAccountId: IRA_ID,
      requestedAmount: amount,
    },
    charity: {
      designationId: `${id}-charity`,
      name: 'Public charity',
      designationKind: 'eligiblePublicCharity',
      directFromCustodianAttested: true,
      eligibleOrganizationAttested: true,
      notDonorAdvisedFundOrSupportingOrganizationAttested: true,
      notSplitInterestEntityAttested: true,
      entireDistributionOtherwiseDeductibleAttested: true,
    },
  }
}

function input(
  retirementActions: readonly Readonly<RetirementActionRequest>[],
  overrides: Partial<AnnualRetirementActionPreflightInput> = {},
): AnnualRetirementActionPreflightInput {
  return {
    taxYear: YEAR,
    retirementActions,
    balances: [
      { accountId: CASH_ID, balancePlanDollars: 1_000 },
      { accountId: IRA_ID, balancePlanDollars: 1_000 },
      { accountId: ROTH_ID, balancePlanDollars: 0 },
    ],
    annualLiabilityBaseline: 'read',
    linkedGroupRelease: REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
    ...overrides,
  }
}

function stagingRelease(): AnnualConversionLinkedWithdrawalRelease {
  return { kind: 'stageProvisionally' }
}

describe('annualRetirementActionPreflight', () => {
  it('scopes every executor and group decision to the current year', () => {
    const currentWithdrawal = ordinary('withdrawal')
    const currentConversion = conversion('conversion', 'withdrawal')
    const futureWithdrawal = ordinary('future-withdrawal', { year: YEAR + 1 })
    const futureConversion = conversion('future-conversion', 'future-withdrawal', {
      year: YEAR + 1,
    })

    const result = annualRetirementActionPreflight(input([
      currentWithdrawal,
      currentConversion,
      futureWithdrawal,
      futureConversion,
    ]))

    expect(result.ordinaryActions).toEqual([currentWithdrawal])
    expect(result.conversionActions).toEqual([currentConversion])
    expect(result.linkedGroupAssessmentRequests).not.toContain(futureWithdrawal)
    expect(result.linkedGroupAssessmentRequests).not.toContain(futureConversion)
    expect(result.conversionLinkedWithdrawalGroups.groups).toHaveLength(1)
  })

  it('keeps a cross-kind QCD collision in the ordinary executor source', () => {
    const collidingQcd = qcd('qcd', { date: `${YEAR}-06-14`, sequence: 1 })
    const collidingWithdrawal = ordinary('withdrawal')

    const result = annualRetirementActionPreflight(input([
      collidingQcd,
      collidingWithdrawal,
    ]))

    expect(result.mixedKindScheduleBlocked).toBe(false)
    expect(result.qcdExecutionActions).toEqual([])
    expect(result.ordinaryExecutionActions).toEqual([
      collidingQcd,
      collidingWithdrawal,
    ])
  })

  it('leaves a QCD-only collision with the QCD executor', () => {
    const first = qcd('qcd-a', { sequence: 1 })
    const second = qcd('qcd-b', { sequence: 1 })

    const result = annualRetirementActionPreflight(input([first, second]))

    expect(result.qcdExecutionActions).toEqual([first, second])
    expect(result.ordinaryExecutionActions).toEqual([])
  })

  it('widens a mixed-kind invalid schedule to one ordinary execution batch', () => {
    const withdrawal = ordinary('withdrawal', { conversionId: 'conversion' })
    const linkedConversion = conversion('conversion', 'withdrawal', {
      date: withdrawal.executionDate ?? undefined,
      sequence: withdrawal.executionSequence ?? undefined,
    })

    const result = annualRetirementActionPreflight(input([
      withdrawal,
      linkedConversion,
    ]))

    expect(result.mixedKindScheduleBlocked).toBe(true)
    expect(result.ordinaryExecutionActions).toEqual([
      withdrawal,
      linkedConversion,
    ])
  })

  it('provisionally releases a fundable linked pair with authored withdrawal cents', () => {
    const withdrawal = ordinary('withdrawal', { conversionId: 'conversion' })
    const linkedConversion = conversion('conversion', 'withdrawal')

    const result = annualRetirementActionPreflight(input(
      [withdrawal, linkedConversion],
      { linkedGroupRelease: stagingRelease() },
    ))

    expect(result.conversionLinkedWithdrawalGroups.groups).toMatchObject([{
      conversionActionId: 'conversion',
      withdrawalActionId: 'withdrawal',
      disposition: 'executedAsAtomicGroup',
      fundingAuthority: {
        requiredFundingAmount: 10_000,
        fundedAmount: 10_000,
      },
    }])
  })

  it('fails provisional release closed when floored capacity is one cent short', () => {
    const withdrawal = ordinary('withdrawal', {
      amount: 10_001,
      conversionId: 'conversion',
    })
    const linkedConversion = conversion('conversion', 'withdrawal')

    const result = annualRetirementActionPreflight(input(
      [withdrawal, linkedConversion],
      {
        balances: [
          { accountId: CASH_ID, balancePlanDollars: 100.009 },
          { accountId: IRA_ID, balancePlanDollars: 1_000 },
        ],
        linkedGroupRelease: stagingRelease(),
      },
    ))

    expect(result.conversionLinkedWithdrawalGroups.groups[0]).toMatchObject({
      disposition: 'refusedPendingGroupExecution',
      reasonCode: 'conversion-tax-funding-unallocated',
      fundingAuthority: null,
    })
  })

  it.each([
    ['missing', []],
    ['outside the exact-cent safe range', [
      { accountId: CASH_ID, balancePlanDollars: Number.MAX_VALUE },
      { accountId: IRA_ID, balancePlanDollars: 1_000 },
    ]],
  ])('fails provisional release closed when a balance is %s', (_, balances) => {
    const withdrawal = ordinary('withdrawal', { conversionId: 'conversion' })
    const linkedConversion = conversion('conversion', 'withdrawal')

    const result = annualRetirementActionPreflight(input(
      [withdrawal, linkedConversion],
      { balances, linkedGroupRelease: stagingRelease() },
    ))

    expect(result.conversionLinkedWithdrawalGroups.groups[0]).toMatchObject({
      disposition: 'refusedPendingGroupExecution',
      fundingAuthority: null,
    })
  })

  it('distinguishes an unavailable annual liability baseline', () => {
    const withdrawal = ordinary('withdrawal', { conversionId: 'conversion' })
    const linkedConversion = conversion('conversion', 'withdrawal')

    const result = annualRetirementActionPreflight(input(
      [withdrawal, linkedConversion],
      { annualLiabilityBaseline: 'unavailable' },
    ))

    expect(result.conversionLinkedWithdrawalGroups.groups[0]).toMatchObject({
      disposition: 'refusedPendingGroupExecution',
      reasonCode: 'conversion-tax-funding-evidence-unsupported',
    })
  })

  it('never provisionally releases two conversions contesting one withdrawal', () => {
    const withdrawal = ordinary('withdrawal', { conversionId: 'conversion-a' })
    const first = conversion('conversion-a', 'withdrawal')
    const second = conversion('conversion-b', 'withdrawal')

    const result = annualRetirementActionPreflight(input(
      [withdrawal, first, second],
      { linkedGroupRelease: stagingRelease() },
    ))

    expect(result.conversionLinkedWithdrawalGroups.groups).toHaveLength(2)
    expect(result.conversionLinkedWithdrawalGroups.groups.every((group) =>
      group.disposition === 'refusedPendingGroupExecution' &&
      group.refusalKind === 'sharedFundingWithdrawal')).toBe(true)
  })

  it('forwards a proven pair without re-litigating current snapshot capacity', () => {
    const withdrawal = ordinary('withdrawal', { conversionId: 'conversion' })
    const linkedConversion = conversion('conversion', 'withdrawal')

    const result = annualRetirementActionPreflight(input(
      [withdrawal, linkedConversion],
      {
        balances: [],
        linkedGroupRelease: {
          kind: 'proven',
          authorizations: [{
            conversionActionId: linkedConversion.actionId,
            withdrawalActionId: withdrawal.actionId,
            funding: {
              requiredFundingAmount: asUsdCents(9_000),
              fundedAmount: asUsdCents(9_000),
            },
          }],
        },
      },
    ))

    expect(result.conversionLinkedWithdrawalGroups.groups[0]).toMatchObject({
      disposition: 'executedAsAtomicGroup',
      fundingAuthority: {
        requiredFundingAmount: 9_000,
        fundedAmount: 9_000,
      },
    })
  })
})
