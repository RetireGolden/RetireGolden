import { describe, expect, it } from 'vitest'

import {
  parseRetirementActionRequest,
  type LegacyAggregateRetirementActionRequest,
} from '@retiregolden/engine/actions/contract'
import { asPositiveUsdCents, asUsdCents } from '@retiregolden/engine/actions/money'
import {
  ledgerCentsToPlanDollars,
  planDollarsToLedgerCents,
} from '@retiregolden/engine/actions/planBalanceAdapter'
import {
  reviewAndReplaceRetirementActionManually,
} from '@retiregolden/engine/actions/retirementActionManualReview'
import type { Plan } from '@retiregolden/engine/model/plan'
import { createFlatTaxCalculator } from '@retiregolden/engine/projection/flatTax'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import {
  couplePlan,
  singlePersonPlan,
  validatePlan,
} from '@retiregolden/engine/testing/planFixtures'

import {
  buildRetirementActionManualIntent,
  emptyRetirementActionManualEditorDraft,
  formatPositiveUsdCents,
  retirementActionManualDestinationSupportIssue,
  retirementActionManualExecutionIssue,
  retirementActionManualPersonSupportIssue,
  retirementActionManualSourceSupportIssue,
} from './retirementActionManualEditor'

const DEFAULT_REQUESTED_AMOUNT = asPositiveUsdCents(1_234_56)
const noTax = createFlatTaxCalculator(0)

function migrated(
  kind: 'legacyAggregateWithdrawal' | 'legacyAggregateRothConversion',
  requestedAmount = DEFAULT_REQUESTED_AMOUNT,
): Extract<
  LegacyAggregateRetirementActionRequest,
  { kind: 'legacyAggregateWithdrawal' | 'legacyAggregateRothConversion' }
> {
  const result = parseRetirementActionRequest({
    actionId: `migrated-${kind}`,
    kind,
    year: 2034,
    requestedAmount,
    provenance: { source: 'migration', sourceId: 'plan-v1' },
    ...(kind === 'legacyAggregateWithdrawal' ? { legacyCategory: 'traditional' } : {}),
  })
  if (!result.ok || result.request.kind === 'legacyAggregateQcd' ||
      result.request.kind === 'qcd' || result.request.kind === 'ordinaryWithdrawal' ||
      result.request.kind === 'rothConversion') {
    throw new Error('expected migrated withdrawal/conversion')
  }
  return result.request
}

function scheduledAction(executionDate: string, executionSequence: number) {
  const result = parseRetirementActionRequest({
    actionId: 'preserved-action',
    kind: 'ordinaryWithdrawal',
    year: 2034,
    executionDate,
    executionSequence,
    requestedAmount: asPositiveUsdCents(100),
    provenance: { source: 'manual' },
    personId: 'p1',
    allocations: [{
      allocationId: 'preserved-allocation',
      sourceAccountId: 'ira-a',
      requestedAmount: asPositiveUsdCents(100),
    }],
    purpose: { kind: 'spending' },
  })
  if (!result.ok) throw new Error(result.issues.join('; '))
  return result.request
}

const supportedPlan: Pick<
  Plan,
  'accounts' | 'household' | 'retirementActionEligibilityFacts'
> = {
  household: {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'KY',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [{
      id: 'person-a',
      name: 'Person A',
      dob: '1974-01-01',
      sex: 'average',
      retirementAge: 65,
      longevity: { planningAge: 90, source: 'manual' },
    }],
  },
  accounts: [
    {
      type: 'cash',
      id: 'cash-a',
      name: 'Cash',
      ownerPersonId: 'person-a',
      annualReturnPct: null,
      balance: 10_000,
      annualContribution: 0,
    },
    {
      type: 'traditional',
      id: 'ira-a',
      name: 'Traditional IRA',
      ownerPersonId: 'person-a',
      annualReturnPct: null,
      kind: 'ira',
      balance: 100_000,
      annualContribution: 0,
    },
    {
      type: 'roth',
      id: 'roth-a',
      name: 'Roth IRA',
      ownerPersonId: 'person-a',
      annualReturnPct: null,
      kind: 'ira',
      balance: 10_000,
      annualContribution: 0,
    },
  ],
  retirementActionEligibilityFacts: {
    iraClassifications: [{
      evidenceId: 'ira-a-classification',
      provenance: { source: 'manual' },
      sourceAccountId: 'ira-a',
      subtype: 'traditional',
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  },
}

describe('buildRetirementActionManualIntent', () => {
  it('starts fail-closed and does not infer a person, account, date, sequence, or purpose', () => {
    const result = buildRetirementActionManualIntent(
      migrated('legacyAggregateWithdrawal'),
      emptyRetirementActionManualEditorDraft(),
      [],
      supportedPlan,
    )

    expect(result).toEqual({
      ok: false,
      issues: [
        'Choose the person responsible for this action.',
        'Choose the exact source account.',
        'Confirm that the full preserved amount belongs to the selected source account.',
        'Choose a valid execution date in 2034.',
        'Enter a positive whole-number execution sequence.',
        'Choose the withdrawal purpose.',
      ],
    })
  })

  it('builds a complete manual withdrawal intent while preserving exact family/year/cents', () => {
    const target = migrated('legacyAggregateWithdrawal')
    const draft = {
      ...emptyRetirementActionManualEditorDraft(),
      personId: 'person-a',
      sourceAccountId: 'cash-a',
      fullSourceAmountConfirmed: true,
      executionDate: '2034-06-15',
      executionSequence: '7',
      withdrawalPurpose: 'taxPayment' as const,
    }

    expect(buildRetirementActionManualIntent(
      target,
      draft,
      [],
      supportedPlan,
    )).toEqual({
      ok: true,
      intent: {
        kind: 'ordinaryWithdrawal',
        year: 2034,
        executionDate: '2034-06-15',
        executionSequence: 7,
        requestedAmount: target.requestedAmount,
        personId: 'person-a',
        provenance: { source: 'manual' },
        sourceAllocations: [{
          sourceAccountId: 'cash-a',
          requestedAmount: target.requestedAmount,
        }],
        purpose: { kind: 'taxPayment' },
      },
    })
  })

  it('fails closed when the selected person is removed before submission', () => {
    const target = migrated('legacyAggregateWithdrawal')
    const changedPlan = structuredClone(supportedPlan)
    changedPlan.household.people = [{
      ...changedPlan.household.people[0]!,
      id: 'person-b',
      name: 'Person B',
    }]
    changedPlan.accounts[0]!.ownerPersonId = 'person-b'

    expect(buildRetirementActionManualIntent(target, {
      ...emptyRetirementActionManualEditorDraft(),
      personId: 'person-a',
      sourceAccountId: 'cash-a',
      fullSourceAmountConfirmed: true,
      executionDate: '2034-06-15',
      executionSequence: '1',
      withdrawalPurpose: 'spending',
    }, [], changedPlan)).toEqual({
      ok: false,
      issues: [
        'The selected person is no longer available in this Plan. Choose a current household member.',
        'This source account is owned by a different household member than the selected person.',
      ],
    })
  })

  it('fails closed when the selected source account is removed before submission', () => {
    const target = migrated('legacyAggregateWithdrawal')
    const changedPlan = structuredClone(supportedPlan)
    changedPlan.accounts = changedPlan.accounts.filter((account) => account.id !== 'cash-a')

    expect(buildRetirementActionManualIntent(target, {
      ...emptyRetirementActionManualEditorDraft(),
      personId: 'person-a',
      sourceAccountId: 'cash-a',
      fullSourceAmountConfirmed: true,
      executionDate: '2034-06-15',
      executionSequence: '1',
      withdrawalPurpose: 'spending',
    }, [], changedPlan)).toEqual({
      ok: false,
      issues: [
        'The selected source account is no longer available in this Plan. Choose the exact source account again.',
      ],
    })
  })

  it('requires explicit conversion destination and funding facts', () => {
    const target = migrated('legacyAggregateRothConversion')
    const incomplete = {
      ...emptyRetirementActionManualEditorDraft(),
      personId: 'person-a',
      sourceAccountId: 'ira-a',
      fullSourceAmountConfirmed: true,
      executionDate: '2034-06-15',
      executionSequence: '1',
      conversionTaxFunding: 'externalCash' as const,
    }
    expect(buildRetirementActionManualIntent(
      target,
      incomplete,
      [],
      supportedPlan,
    )).toEqual({
      ok: false,
      issues: [
        'Choose the exact Roth destination account.',
        'Enter a positive exact-cent tax-funding amount.',
        'Confirm that the external cash is available for conversion taxes.',
      ],
    })

    const built = buildRetirementActionManualIntent(
      target,
      {
        ...incomplete,
        destinationRothAccountId: 'roth-a',
        taxFundingAmountDollars: 0.07,
        externalCashAttested: true,
      },
      [],
      supportedPlan,
    )
    expect(built).toEqual({
      ok: true,
      intent: {
        kind: 'rothConversion',
        year: 2034,
        executionDate: '2034-06-15',
        executionSequence: 1,
        requestedAmount: target.requestedAmount,
        personId: 'person-a',
        provenance: { source: 'manual' },
        sourceAllocations: [{
          sourceAccountId: 'ira-a',
          requestedAmount: target.requestedAmount,
        }],
        destinationRothAccountId: 'roth-a',
        taxFunding: { kind: 'externalCash', amount: 7, attested: true },
      },
    })
  })

  it('refuses every Roth destination the canonical allocator would refuse', () => {
    const target = migrated('legacyAggregateRothConversion')
    const draft = {
      ...emptyRetirementActionManualEditorDraft(),
      personId: 'person-a',
      sourceAccountId: 'ira-a',
      fullSourceAmountConfirmed: true,
      executionDate: '2034-06-15',
      executionSequence: '1',
      conversionTaxFunding: 'noneExpected' as const,
    }
    const issuesFor = (destinationRothAccountId: string, accounts = supportedPlan.accounts) => {
      const result = buildRetirementActionManualIntent(
        target,
        { ...draft, destinationRothAccountId },
        [],
        { ...supportedPlan, accounts },
      )
      return result.ok ? [] : result.issues
    }
    const withDestination = (
      overrides: Partial<Plan['accounts'][number]>,
    ): Plan['accounts'] => [
      supportedPlan.accounts[1]!,
      { ...supportedPlan.accounts[2]!, ...overrides } as Plan['accounts'][number],
    ]

    expect(issuesFor('')).toEqual(['Choose the exact Roth destination account.'])
    expect(issuesFor('roth-missing')).toEqual([
      'The selected Roth destination account is no longer available in this Plan. Choose the exact destination account again.',
    ])
    expect(issuesFor('roth-a', [
      supportedPlan.accounts[1]!,
      supportedPlan.accounts[2]!,
      supportedPlan.accounts[2]!,
    ])).toEqual([
      'The selected Roth destination account ID is duplicated in this Plan. Choose a unique destination account.',
    ])
    expect(issuesFor('roth-a', withDestination({ ownerPersonId: null }))).toEqual([
      'This jointly owned Roth destination does not record the individual owner identity a conversion requires.',
    ])
    expect(issuesFor('roth-a', withDestination({ ownerPersonId: 'person-b' }))).toEqual([
      'This Roth destination account is owned by a different household member than the selected person.',
    ])
    expect(issuesFor('roth-a', withDestination({ kind: 'employer' }))).toEqual([
      'Employer Roth destinations are not supported until same-plan evidence is modeled. Choose a Roth IRA.',
    ])
    expect(issuesFor('ira-a')).toEqual(['A conversion destination must be a Roth account.'])
    expect(issuesFor('roth-a')).toEqual([])
  })

  it('states the destination support matrix the allocator enforces', () => {
    const roth = supportedPlan.accounts[2]!
    expect(retirementActionManualDestinationSupportIssue(roth, 'person-a')).toBeNull()
    expect(retirementActionManualDestinationSupportIssue(
      { ...roth, ownerPersonId: null },
      'person-a',
    )).toBe(
      'This jointly owned Roth destination does not record the individual owner identity a conversion requires.',
    )
    expect(retirementActionManualDestinationSupportIssue(
      supportedPlan.accounts[0]!,
      'person-a',
    )).toBe('A conversion destination must be a Roth account.')
  })

  it('keeps conversion-principal withholding explicitly unsupported and non-saveable', () => {
    const target = migrated('legacyAggregateRothConversion')
    const result = buildRetirementActionManualIntent(
      target,
      {
        ...emptyRetirementActionManualEditorDraft(),
        personId: 'person-a',
        sourceAccountId: 'ira-a',
        destinationRothAccountId: 'roth-a',
        fullSourceAmountConfirmed: true,
        executionDate: '2034-06-15',
        executionSequence: '1',
        conversionTaxFunding: 'conversionPrincipalWithholding',
      },
      [],
      supportedPlan,
    )

    expect(result).toEqual({
      ok: false,
      issues: [
        'Conversion-principal withholding is not supported. Choose external cash or no tax funding expected.',
      ],
    })
  })

  it('rejects an employer-plan conversion source before replacement', () => {
    const target = migrated('legacyAggregateRothConversion')
    const employerPlan: Pick<
      Plan,
      'accounts' | 'household' | 'retirementActionEligibilityFacts'
    > = {
      household: supportedPlan.household,
      accounts: [{
        type: 'traditional',
        id: 'employer-401k',
        name: 'Employer 401(k)',
        ownerPersonId: 'person-a',
        annualReturnPct: null,
        kind: 'employer',
        balance: 100_000,
        annualContribution: 0,
      }, supportedPlan.accounts[2]!],
      retirementActionEligibilityFacts: undefined,
    }

    expect(buildRetirementActionManualIntent(
      target,
      {
        ...emptyRetirementActionManualEditorDraft(),
        personId: 'person-a',
        sourceAccountId: 'employer-401k',
        destinationRothAccountId: 'roth-a',
        fullSourceAmountConfirmed: true,
        executionDate: '2034-06-15',
        executionSequence: '1',
        conversionTaxFunding: 'noneExpected',
      },
      [],
      employerPlan,
    )).toEqual({
      ok: false,
      issues: [
        'Employer-plan conversion sources are not supported until plan-availability evidence is modeled. Choose a traditional IRA.',
      ],
    })
  })

  it('pins the public manual-review source support matrix', () => {
    const owner = 'person-a'
    const ordinaryAccounts: Plan['accounts'] = [
      supportedPlan.accounts[0]!,
      {
        type: 'taxable', id: 'taxable-a', name: 'Taxable', ownerPersonId: owner,
        annualReturnPct: null, balance: 10_000, costBasis: 8_000, annualContribution: 0,
      },
      {
        type: 'equityComp', id: 'equity-final', name: 'Vested equity', ownerPersonId: owner,
        annualReturnPct: null, balance: 10_000, costBasis: 8_000, annualContribution: 0,
        vestingMode: 'final', vestDate: null,
      },
      {
        type: 'equityComp', id: 'equity-cliff', name: 'Cliff equity', ownerPersonId: owner,
        annualReturnPct: null, balance: 10_000, costBasis: 8_000, annualContribution: 0,
        vestingMode: 'cliff', vestDate: '2034-09-01',
      },
      supportedPlan.accounts[1]!,
      {
        type: 'roth', id: 'roth-a', name: 'Roth IRA', ownerPersonId: owner,
        annualReturnPct: null, kind: 'ira', balance: 10_000, annualContribution: 0,
      },
      {
        type: 'hsa', id: 'hsa-a', name: 'HSA', ownerPersonId: owner,
        annualReturnPct: null, balance: 10_000, annualContribution: 0,
      },
    ]
    const ordinaryPlan = { ...supportedPlan, accounts: ordinaryAccounts }
    expect(ordinaryAccounts.map((account) =>
      retirementActionManualSourceSupportIssue(
        'legacyAggregateWithdrawal', account, '2034-06-15', 2034,
        DEFAULT_REQUESTED_AMOUNT, 'person-a', ordinaryPlan,
      ) === null,
    )).toEqual([true, true, true, false, false, false, false])
    expect(retirementActionManualSourceSupportIssue(
      'legacyAggregateWithdrawal', ordinaryAccounts[3]!, '2034-09-01', 2034,
      DEFAULT_REQUESTED_AMOUNT, 'person-a', ordinaryPlan,
    )).toBeNull()

    const conversionAccounts: Plan['accounts'] = [
      ...(['traditional', 'sep', 'simple', 'simple'] as const).map((subtype, index) => ({
        type: 'traditional' as const,
        id: `ira-${subtype}-${index}`,
        name: `${subtype} IRA`,
        ownerPersonId: owner,
        annualReturnPct: null,
        kind: 'ira' as const,
        balance: 10_000,
        annualContribution: 0,
      })),
      {
        type: 'traditional', id: 'ira-missing', name: 'Unclassified IRA', ownerPersonId: owner,
        annualReturnPct: null, kind: 'ira', balance: 10_000, annualContribution: 0,
      },
      {
        type: 'traditional', id: 'employer-a', name: '401(k)', ownerPersonId: owner,
        annualReturnPct: null, kind: 'employer', balance: 10_000, annualContribution: 0,
      },
    ]
    const conversionPlan: Pick<
      Plan,
      'accounts' | 'household' | 'retirementActionEligibilityFacts'
    > = {
      household: supportedPlan.household,
      accounts: conversionAccounts,
      retirementActionEligibilityFacts: {
        iraClassifications: [
          { evidenceId: 'c-traditional', provenance: { source: 'manual' }, sourceAccountId: conversionAccounts[0]!.id, subtype: 'traditional' },
          { evidenceId: 'c-sep', provenance: { source: 'manual' }, sourceAccountId: conversionAccounts[1]!.id, subtype: 'sep' },
          { evidenceId: 'c-simple-mature', provenance: { source: 'manual' }, sourceAccountId: conversionAccounts[2]!.id, subtype: 'simple', simpleParticipationStartDate: '2030-01-01' },
          { evidenceId: 'c-simple-open', provenance: { source: 'manual' }, sourceAccountId: conversionAccounts[3]!.id, subtype: 'simple', simpleParticipationStartDate: '2033-01-01' },
        ],
        sepSimpleActivities: [],
        deductibleIraContributions: [],
      },
    }
    expect(conversionAccounts.map((account) =>
      retirementActionManualSourceSupportIssue(
        'legacyAggregateRothConversion', account, '2034-06-15', 2034,
        DEFAULT_REQUESTED_AMOUNT, 'person-a', conversionPlan,
      ) === null,
    )).toEqual([true, true, true, false, false, false])
  })

  it('matches the projection last-alive boundary and rejects a deceased owner injection', () => {
    const livingOwner = supportedPlan.household.people[0]!
    expect(retirementActionManualPersonSupportIssue(livingOwner, 2064)).toBeNull()
    expect(retirementActionManualPersonSupportIssue(livingOwner, 2065)).toBe(
      'Person A (ID person-a) is not modeled alive in 2065; their last modeled-alive year is 2064.',
    )

    const deceasedPlan = structuredClone(supportedPlan)
    deceasedPlan.household.people[0]!.dob = '1973-01-01'
    deceasedPlan.household.people[0]!.longevity.planningAge = 60
    const target = migrated('legacyAggregateWithdrawal')
    const result = buildRetirementActionManualIntent(target, {
      ...emptyRetirementActionManualEditorDraft(),
      personId: 'person-a',
      sourceAccountId: 'cash-a',
      fullSourceAmountConfirmed: true,
      executionDate: '2034-06-15',
      executionSequence: '1',
      withdrawalPurpose: 'spending',
    }, [], deceasedPlan)

    expect(result).toEqual({
      ok: false,
      issues: [
        'Person A (ID person-a) is not modeled alive in 2034; their last modeled-alive year is 2033.',
      ],
    })
  })

  it('matches the projection tax-unit predicate for taxable sources', () => {
    const taxableAccount: Plan['accounts'][number] = {
      type: 'taxable',
      id: 'taxable-a',
      name: 'Taxable',
      ownerPersonId: 'person-a',
      annualReturnPct: null,
      balance: 10_000,
      costBasis: 8_000,
      annualContribution: 0,
    }
    const secondPerson: Plan['household']['people'][number] = {
      id: 'person-b',
      name: 'Person B',
      dob: '1975-01-01',
      sex: 'average',
      retirementAge: 65,
      longevity: { planningAge: 90, source: 'manual' },
    }
    const twoLivingSingle = structuredClone(supportedPlan)
    twoLivingSingle.accounts = [taxableAccount]
    twoLivingSingle.household.people.push(secondPerson)

    expect(retirementActionManualSourceSupportIssue(
      'legacyAggregateWithdrawal', taxableAccount, '2034-06-15', 2034,
      DEFAULT_REQUESTED_AMOUNT, 'person-a', twoLivingSingle,
    )).toBe(
      'Taxable-account withdrawal review requires an unambiguous projected tax unit; 2 household members are modeled alive in 2034 under Single status.',
    )

    const twoLivingJoint = structuredClone(twoLivingSingle)
    twoLivingJoint.household.filingStatus = 'marriedFilingJointly'
    expect(retirementActionManualSourceSupportIssue(
      'legacyAggregateWithdrawal', taxableAccount, '2034-06-15', 2034,
      DEFAULT_REQUESTED_AMOUNT, 'person-a', twoLivingJoint,
    )).toBeNull()

    const oneLivingSingle = structuredClone(twoLivingSingle)
    oneLivingSingle.household.people[1]!.dob = '1973-01-01'
    oneLivingSingle.household.people[1]!.longevity.planningAge = 60
    expect(retirementActionManualSourceSupportIssue(
      'legacyAggregateWithdrawal', taxableAccount, '2034-06-15', 2034,
      DEFAULT_REQUESTED_AMOUNT, 'person-a', oneLivingSingle,
    )).toBeNull()

    const target = migrated('legacyAggregateWithdrawal')
    expect(buildRetirementActionManualIntent(target, {
      ...emptyRetirementActionManualEditorDraft(),
      personId: 'person-a',
      sourceAccountId: 'taxable-a',
      fullSourceAmountConfirmed: true,
      executionDate: '2034-06-15',
      executionSequence: '1',
      withdrawalPurpose: 'spending',
    }, [], twoLivingSingle)).toEqual({
      ok: false,
      issues: [
        'Taxable-account withdrawal review requires an unambiguous projected tax unit; 2 household members are modeled alive in 2034 under Single status.',
      ],
    })
  })

  it('matches allocator acting-owner semantics for every ordinary source shape', () => {
    const secondPerson: Plan['household']['people'][number] = {
      id: 'person-b',
      name: 'Person B',
      dob: '1975-01-01',
      sex: 'average',
      retirementAge: 65,
      longevity: { planningAge: 90, source: 'manual' },
    }
    const plan = structuredClone(supportedPlan)
    plan.household.people.push(secondPerson)
    plan.household.filingStatus = 'marriedFilingJointly'
    const accountsFor = (ownerPersonId: string | null): Plan['accounts'] => [
      {
        type: 'cash', id: 'cash-owner', name: 'Cash', ownerPersonId,
        annualReturnPct: null, balance: 100, annualContribution: 0,
      },
      {
        type: 'taxable', id: 'taxable-owner', name: 'Taxable', ownerPersonId,
        annualReturnPct: null, balance: 100, costBasis: 80, annualContribution: 0,
      },
      {
        type: 'equityComp', id: 'equity-owner', name: 'Equity', ownerPersonId,
        annualReturnPct: null, balance: 100, costBasis: 80, annualContribution: 0,
        vestingMode: 'final', vestDate: null,
      },
    ]
    const supportIssues = (accounts: Plan['accounts']) => accounts.map((account) =>
      retirementActionManualSourceSupportIssue(
        'legacyAggregateWithdrawal', account, '2034-06-15', 2034,
        DEFAULT_REQUESTED_AMOUNT, 'person-a', { ...plan, accounts },
      ))
    const target = migrated('legacyAggregateWithdrawal')
    const buildWith = (account: Plan['accounts'][number]) =>
      buildRetirementActionManualIntent(target, {
        ...emptyRetirementActionManualEditorDraft(),
        personId: 'person-a',
        sourceAccountId: account.id,
        fullSourceAmountConfirmed: true,
        executionDate: '2034-06-15',
        executionSequence: '1',
        withdrawalPurpose: 'spending',
      }, [], { ...plan, accounts: [account] })

    const validAccounts = accountsFor('person-a')
    expect(supportIssues(validAccounts)).toEqual([null, null, null])
    for (const account of validAccounts) expect(buildWith(account).ok).toBe(true)

    const mismatchedAccounts = accountsFor('person-b')
    expect(supportIssues(mismatchedAccounts)).toEqual(Array(3).fill(
      'This source account is owned by a different household member than the selected person.',
    ))
    for (const account of mismatchedAccounts) expect(buildWith(account).ok).toBe(false)

    const jointAccounts = accountsFor(null)
    expect(supportIssues(jointAccounts)).toEqual(Array(3).fill(
      'This jointly owned source does not record the individual acting-owner identity required for manual review.',
    ))
    for (const account of jointAccounts) expect(buildWith(account).ok).toBe(false)
  })

  it('pins exact-cent execution snapshot boundaries for every ordinary source shape', () => {
    const boundary = ledgerCentsToPlanDollars(asUsdCents(Number.MAX_SAFE_INTEGER - 1))
    const oneCentOver = boundary + 0.01
    const base = {
      ownerPersonId: 'person-a',
      annualReturnPct: null,
      annualContribution: 0,
    }
    const boundaryAccounts: Plan['accounts'] = [
      { type: 'cash', id: 'cash-boundary', name: 'Cash', balance: boundary, ...base },
      {
        type: 'equityComp', id: 'equity-boundary', name: 'Equity', balance: boundary,
        costBasis: 0, vestingMode: 'final', vestDate: null, ...base,
      },
      {
        type: 'taxable', id: 'taxable-boundary', name: 'Taxable', balance: boundary,
        costBasis: boundary, ...base,
      },
    ]
    const boundaryPlan = { ...supportedPlan, accounts: boundaryAccounts }
    for (const account of boundaryAccounts) {
      expect(retirementActionManualSourceSupportIssue(
        'legacyAggregateWithdrawal', account, '2034-06-15', 2034,
        DEFAULT_REQUESTED_AMOUNT, 'person-a', boundaryPlan,
      )).toBeNull()
    }

    const overAccounts: Plan['accounts'] = [
      { type: 'cash', id: 'cash-over', name: 'Cash', balance: oneCentOver, ...base },
      {
        type: 'equityComp', id: 'equity-over', name: 'Equity', balance: oneCentOver,
        costBasis: 0, vestingMode: 'final', vestDate: null, ...base,
      },
      {
        type: 'taxable', id: 'taxable-balance-over', name: 'Taxable', balance: oneCentOver,
        costBasis: boundary, ...base,
      },
      {
        type: 'taxable', id: 'taxable-basis-over', name: 'Taxable', balance: boundary,
        costBasis: oneCentOver, ...base,
      },
    ]
    const overPlan = { ...supportedPlan, accounts: overAccounts }
    expect(overAccounts.map((account) => retirementActionManualSourceSupportIssue(
      'legacyAggregateWithdrawal', account, '2034-06-15', 2034,
      DEFAULT_REQUESTED_AMOUNT, 'person-a', overPlan,
    ))).toEqual([
      'This source account balance cannot be represented in the exact-cent execution ledger. Reduce the balance before completing review.',
      'This source account balance cannot be represented in the exact-cent execution ledger. Reduce the balance before completing review.',
      'This source account balance cannot be represented in the exact-cent execution ledger. Reduce the balance before completing review.',
      'This taxable source account cost basis cannot be represented in the exact-cent execution ledger. Reduce the cost basis before completing review.',
    ])

    const target = migrated('legacyAggregateWithdrawal')
    for (const account of overAccounts) {
      expect(buildRetirementActionManualIntent(target, {
        ...emptyRetirementActionManualEditorDraft(),
        personId: 'person-a',
        sourceAccountId: account.id,
        fullSourceAmountConfirmed: true,
        executionDate: '2034-06-15',
        executionSequence: '1',
        withdrawalPurpose: 'spending',
      }, [], { ...supportedPlan, accounts: [account] }).ok).toBe(false)
    }
  })

  it('rejects zero and unrepresentable closing balances while allowing truthful partials', () => {
    const requestedAmount = asPositiveUsdCents(3)
    const target = migrated('legacyAggregateWithdrawal', requestedAmount)
    const boundary = ledgerCentsToPlanDollars(asUsdCents(Number.MAX_SAFE_INTEGER - 1))
    expect(planDollarsToLedgerCents(boundary)).toBe(9_007_199_254_740_990)
    const base = {
      ownerPersonId: 'person-a',
      annualReturnPct: null,
      annualContribution: 0,
    }
    const accountsAt = (balance: number): Plan['accounts'] => [
      { type: 'cash', id: 'cash-a', name: 'Cash', balance, ...base },
      {
        type: 'equityComp', id: 'equity-a', name: 'Equity', balance,
        costBasis: 0, vestingMode: 'final', vestDate: null, ...base,
      },
      {
        type: 'taxable', id: 'taxable-a', name: 'Taxable', balance,
        costBasis: 0, ...base,
      },
    ]
    const supportIssues = (accounts: Plan['accounts']) => accounts.map((account) =>
      retirementActionManualSourceSupportIssue(
        'legacyAggregateWithdrawal', account, '2034-06-15', 2034,
        requestedAmount, 'person-a', { ...supportedPlan, accounts },
      ))
    const buildWith = (account: Plan['accounts'][number]) =>
      buildRetirementActionManualIntent(target, {
        ...emptyRetirementActionManualEditorDraft(),
        personId: 'person-a',
        sourceAccountId: account.id,
        fullSourceAmountConfirmed: true,
        executionDate: '2034-06-15',
        executionSequence: '1',
        withdrawalPurpose: 'spending',
      }, [], { ...supportedPlan, accounts: [account] })

    const closingBoundaryAccounts = accountsAt(boundary)
    expect(supportIssues(closingBoundaryAccounts)).toEqual(Array(3).fill(
      'This source account would have a closing balance that cannot be represented exactly in the Plan after the reviewed withdrawal. Choose another funded source.',
    ))
    for (const account of closingBoundaryAccounts) expect(buildWith(account).ok).toBe(false)

    const zeroAccounts = accountsAt(0)
    expect(supportIssues(zeroAccounts)).toEqual(Array(3).fill(
      'This source account has no available exact-cent balance for the reviewed withdrawal. Choose a funded source.',
    ))
    for (const account of zeroAccounts) expect(buildWith(account).ok).toBe(false)

    const partialAccounts = accountsAt(0.02)
    expect(supportIssues(partialAccounts)).toEqual([null, null, null])
    for (const account of partialAccounts) expect(buildWith(account).ok).toBe(true)
  })

  it('refuses unsupported injected ordinary, cliff, and unclassified IRA selections', () => {
    const withdrawalTarget = migrated('legacyAggregateWithdrawal')
    const withdrawalDraft = {
      ...emptyRetirementActionManualEditorDraft(),
      personId: 'person-a',
      fullSourceAmountConfirmed: true,
      executionDate: '2034-06-15',
      executionSequence: '1',
      withdrawalPurpose: 'spending' as const,
    }
    const unsupportedAccounts: Plan['accounts'] = [
      supportedPlan.accounts[1]!,
      {
        type: 'equityComp', id: 'equity-cliff', name: 'Cliff equity', ownerPersonId: 'person-a',
        annualReturnPct: null, balance: 10_000, costBasis: 8_000, annualContribution: 0,
        vestingMode: 'cliff', vestDate: '2034-09-01',
      },
    ]
    for (const account of unsupportedAccounts) {
      expect(buildRetirementActionManualIntent(
        withdrawalTarget,
        { ...withdrawalDraft, sourceAccountId: account.id },
        [],
        { ...supportedPlan, accounts: [account] },
      ).ok).toBe(false)
    }

    const conversionTarget = migrated('legacyAggregateRothConversion')
    expect(buildRetirementActionManualIntent(
      conversionTarget,
      {
        ...emptyRetirementActionManualEditorDraft(),
        personId: 'person-a', sourceAccountId: 'ira-a', destinationRothAccountId: 'roth-a',
        fullSourceAmountConfirmed: true, executionDate: '2034-06-15', executionSequence: '1',
        conversionTaxFunding: 'noneExpected',
      },
      [],
      { ...supportedPlan, retirementActionEligibilityFacts: undefined },
    ).ok).toBe(false)
  })

  it('rejects invalid or wrong-year dates and unsafe/nonpositive sequences', () => {
    const target = migrated('legacyAggregateWithdrawal')
    const base = {
      ...emptyRetirementActionManualEditorDraft(),
      personId: 'person-a',
      sourceAccountId: 'cash-a',
      fullSourceAmountConfirmed: true,
      withdrawalPurpose: 'spending' as const,
    }
    for (const executionDate of ['2033-12-31', '2034-02-30', 'not-a-date']) {
      const result = buildRetirementActionManualIntent(target, {
        ...base,
        executionDate,
        executionSequence: '1',
      }, [], supportedPlan)
      expect(result.ok).toBe(false)
    }
    for (const executionSequence of ['', '0', '-1', '1.5', '9007199254740992']) {
      const result = buildRetirementActionManualIntent(target, {
        ...base,
        executionDate: '2034-01-01',
        executionSequence,
      }, [], supportedPlan)
      expect(result.ok).toBe(false)
    }
  })

  it('rejects an execution slot already used by a preserved current action', () => {
    const target = migrated('legacyAggregateWithdrawal')
    const draft = {
      ...emptyRetirementActionManualEditorDraft(),
      personId: 'person-a',
      sourceAccountId: 'cash-a',
      fullSourceAmountConfirmed: true,
      executionDate: '2034-06-15',
      executionSequence: '7',
      withdrawalPurpose: 'spending' as const,
    }

    expect(buildRetirementActionManualIntent(
      target,
      draft,
      [target, scheduledAction('2034-06-15', 7)],
      supportedPlan,
    )).toEqual({
      ok: false,
      issues: [
        'Another retirement action already uses this execution date and sequence. Choose an unused sequence.',
      ],
    })
    expect(buildRetirementActionManualIntent(
      target,
      draft,
      [target, scheduledAction('2034-06-15', 8)],
      supportedPlan,
    ).ok).toBe(true)
  })

  it('formats exact cents without dropping the fractional amount', () => {
    expect(formatPositiveUsdCents(7)).toBe('$0.07')
    expect(formatPositiveUsdCents(123_456)).toBe('$1,234.56')
  })
})

function exactWithdrawal(
  actionId: string,
  sourceAccountId: string,
  requestedAmount: number,
  executionDate: string,
  executionSequence: number,
  year = 2034,
) {
  const parsed = parseRetirementActionRequest({
    actionId,
    kind: 'ordinaryWithdrawal',
    year,
    executionDate,
    executionSequence,
    requestedAmount: asPositiveUsdCents(requestedAmount),
    provenance: { source: 'manual' },
    personId: 'p1',
    allocations: [{
      allocationId: `${actionId}-allocation`,
      sourceAccountId,
      requestedAmount: asPositiveUsdCents(requestedAmount),
    }],
    purpose: { kind: 'spending' },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

function executionPreviewPlan(): Plan {
  const plan = couplePlan({
    p1Dob: '2000-01-01',
    p2Dob: '2000-01-01',
    p1PlanningAge: 100,
    p2PlanningAge: 100,
  })
  plan.accounts = []
  plan.strategies.retirementActions = []
  return plan
}

const CONVERSION_YEAR = 2034

/**
 * A Plan carrying exactly one migrated aggregate conversion, with the source
 * IRA classified and a Roth IRA destination the same person owns. Returns are
 * flat and spending is nil so the only movement in the projection is the one
 * under review.
 */
function conversionReviewPlan(options: { iraBalanceDollars?: number } = {}): {
  plan: Plan
  target: ReturnType<typeof migrated>
} {
  const plan = singlePersonPlan({ planningAge: 100, dob: '1970-01-01' })
  plan.id = 'migrated-conversion-review'
  plan.accounts = [
    {
      type: 'traditional', id: 'ira-a', name: 'Traditional IRA', ownerPersonId: 'p1',
      annualReturnPct: 0, kind: 'ira',
      balance: options.iraBalanceDollars ?? 100_000, annualContribution: 0,
    },
    {
      type: 'roth', id: 'roth-a', name: 'Roth IRA', ownerPersonId: 'p1',
      annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0,
    },
  ]
  plan.retirementActionEligibilityFacts = {
    iraClassifications: [{
      evidenceId: 'ira-a-classification',
      provenance: { source: 'manual' },
      sourceAccountId: 'ira-a',
      subtype: 'traditional',
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  plan.strategies.rothConversion = { mode: 'none' }
  const target = migrated('legacyAggregateRothConversion')
  plan.strategies.retirementActions = [target]
  return { plan: validatePlan(plan), target }
}

const conversionReviewDraft = {
  ...emptyRetirementActionManualEditorDraft(),
  personId: 'p1',
  sourceAccountId: 'ira-a',
  destinationRothAccountId: 'roth-a',
  fullSourceAmountConfirmed: true,
  executionDate: '2034-06-15',
  executionSequence: '1',
  conversionTaxFunding: 'noneExpected' as const,
}

/** Build the intent, then replace the migrated row through the engine. */
function completeConversionReview(plan: Plan, target: ReturnType<typeof migrated>) {
  const built = buildRetirementActionManualIntent(
    target,
    conversionReviewDraft,
    plan.strategies.retirementActions,
    plan,
  )
  if (!built.ok) throw new Error(built.issues.join('; '))
  const result = reviewAndReplaceRetirementActionManually({
    plan,
    targetActionId: target.actionId,
    replacementIntent: built.intent,
  })
  if (result.status !== 'replacementReady') {
    throw new Error(result.issues.map((entry) => entry.detail).join('; '))
  }
  return result
}

describe('migrated aggregate conversion replacement', () => {
  it('supersedes the migrated row with one named conversion in its place', () => {
    const { plan, target } = conversionReviewPlan()
    const result = completeConversionReview(plan, target)

    expect(result.replacement.kind).toBe('rothConversion')
    expect(result.plan.strategies.retirementActions).toHaveLength(1)
    expect(result.plan.strategies.retirementActions[0]).toEqual(result.replacement)
    expect(result.plan.strategies.retirementActions.some(
      (action) => action.actionId === target.actionId,
    )).toBe(false)
    expect(result.evidence.targetOmittedBeforeAllocation).toBe(true)
    expect(result.evidence.target.actionId).toBe(target.actionId)

    const replacement = result.replacement
    if (replacement.kind !== 'rothConversion') throw new Error('expected a conversion')
    expect(replacement.year).toBe(CONVERSION_YEAR)
    expect(replacement.personId).toBe('p1')
    expect(replacement.executionDate).toBe('2034-06-15')
    expect(replacement.executionSequence).toBe(1)
    expect(replacement.requestedAmount).toBe(DEFAULT_REQUESTED_AMOUNT)
    expect(replacement.destinationRothAccountId).toBe('roth-a')
    expect(replacement.taxFunding).toEqual({ kind: 'noneExpected' })
    expect(replacement.provenance).toEqual({ source: 'manual' })
    expect(replacement.allocations).toHaveLength(1)
    expect(replacement.allocations[0]!.sourceAccountId).toBe('ira-a')
    expect(replacement.allocations[0]!.requestedAmount).toBe(DEFAULT_REQUESTED_AMOUNT)
  })

  it('moves the exact cents out of the IRA and into the Roth in the projection', () => {
    const { plan, target } = conversionReviewPlan()
    const result = completeConversionReview(plan, target)

    const year = simulatePlan(structuredClone(result.plan) as Plan, {
      startYear: CONVERSION_YEAR,
      horizonEndYear: CONVERSION_YEAR,
      taxCalculator: noTax,
    }).years.find((entry) => entry.year === CONVERSION_YEAR)
    const execution = year?.rothConversionActionExecution
    expect(execution?.committed).toBe(true)

    const evidence = execution!.evidence.find(
      (entry) => entry.actionId === result.replacement.actionId,
    )!
    expect(evidence.readiness).toBe('actionable')
    expect(evidence.outcome).toBe('executed')
    expect(evidence.reasons).toEqual([])
    expect(evidence.executedAmount).toBe(123_456)
    expect(evidence.destinationCreditAmount).toBe(123_456)
    expect(evidence.executedDate).toBe('2034-06-15')

    expect(execution!.balances).toEqual([
      { accountId: 'ira-a', openingBalance: 10_000_000, closingBalance: 9_876_544 },
      { accountId: 'roth-a', openingBalance: 0, closingBalance: 123_456 },
    ])
    expect(year!.rothConversion).toBe(1_234.56)
  })
})

describe('retirementActionManualExecutionIssue', () => {
  it('uses executor basis rounding to reject an unrepresentable taxable closing basis', () => {
    const plan = executionPreviewPlan()
    plan.accounts = [{
      type: 'taxable',
      id: 'taxable-a',
      name: 'Taxable',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      balance: ledgerCentsToPlanDollars(asUsdCents(9_007_199_254_740_990)),
      costBasis: ledgerCentsToPlanDollars(asUsdCents(9_007_199_254_740_989)),
      annualContribution: 0,
    }]
    const action = exactWithdrawal('taxable-sale', 'taxable-a', 2, '2034-01-01', 1)
    plan.strategies.retirementActions = [action]

    expect(retirementActionManualExecutionIssue(
      plan,
      action.actionId,
      2034,
      noTax,
    )).toBe(
      'The reviewed taxable withdrawal would leave a cost basis that cannot be represented exactly in the Plan. Choose another source or amount.',
    )
  })

  it('rejects an unrepresentable same-year total independently of request order', () => {
    const plan = executionPreviewPlan()
    plan.accounts = [
      {
        type: 'cash', id: 'cash-large', name: 'Large cash', ownerPersonId: 'p1',
        annualReturnPct: null,
        balance: ledgerCentsToPlanDollars(asUsdCents(9_007_199_254_740_990)),
        annualContribution: 0,
      },
      {
        type: 'cash', id: 'cash-cent', name: 'One cent', ownerPersonId: 'p1',
        annualReturnPct: null, balance: 0.01, annualContribution: 0,
      },
    ]
    const large = exactWithdrawal(
      'large-withdrawal',
      'cash-large',
      9_007_199_254_740_990,
      '2034-01-01',
      1,
    )
    const cent = exactWithdrawal('cent-withdrawal', 'cash-cent', 1, '2034-01-02', 1)
    const expected =
      'This withdrawal would make a same-year retirement-action total that cannot be represented exactly in the Plan. Choose another source or amount.'

    plan.strategies.retirementActions = [large, cent]
    expect(retirementActionManualExecutionIssue(
      plan,
      cent.actionId,
      2034,
      noTax,
    )).toBe(expected)
    plan.strategies.retirementActions = [cent, large]
    expect(retirementActionManualExecutionIssue(
      plan,
      cent.actionId,
      2034,
      noTax,
    )).toBe(expected)
  })

  it('accepts a truthful positive partial after an earlier same-year withdrawal', () => {
    const plan = executionPreviewPlan()
    plan.accounts = [{
      type: 'cash', id: 'cash-shared', name: 'Shared chronology cash',
      ownerPersonId: 'p1', annualReturnPct: null, balance: 1, annualContribution: 0,
    }]
    const first = exactWithdrawal('first', 'cash-shared', 75, '2034-01-01', 1)
    const partial = exactWithdrawal('partial', 'cash-shared', 75, '2034-01-02', 1)
    plan.strategies.retirementActions = [partial, first]

    expect(retirementActionManualExecutionIssue(
      plan,
      partial.actionId,
      2034,
      noTax,
    )).toBeNull()
  })

  it('rejects a reviewed withdrawal depleted by an earlier same-year action', () => {
    const plan = executionPreviewPlan()
    plan.accounts = [{
      type: 'cash', id: 'cash-shared', name: 'Shared chronology cash',
      ownerPersonId: 'p1', annualReturnPct: null, balance: 1, annualContribution: 0,
    }]
    const first = exactWithdrawal('first', 'cash-shared', 100, '2034-01-01', 1)
    const depleted = exactWithdrawal('depleted', 'cash-shared', 1, '2034-01-02', 1)
    plan.strategies.retirementActions = [depleted, first]

    expect(retirementActionManualExecutionIssue(
      plan,
      depleted.actionId,
      2034,
      noTax,
    )).toBe(
      'The reviewed withdrawal would execute no funds after earlier same-year actions. Choose another source, date, or sequence.',
    )
  })

  it('rejects a reviewed withdrawal depleted in a prior projection year', () => {
    const plan = executionPreviewPlan()
    plan.expenses.baseAnnual = 1
    plan.accounts = [{
      type: 'cash', id: 'cash-multiyear', name: 'Multi-year cash',
      ownerPersonId: 'p1', annualReturnPct: 0, balance: 1, annualContribution: 0,
    }]
    const priorYear = exactWithdrawal(
      'prior-year',
      'cash-multiyear',
      100,
      '2033-01-01',
      1,
      2033,
    )
    const reviewed = exactWithdrawal(
      'reviewed',
      'cash-multiyear',
      1,
      '2034-01-01',
      1,
    )
    plan.strategies.retirementActions = [reviewed, priorYear]

    expect(retirementActionManualExecutionIssue(
      plan,
      reviewed.actionId,
      2033,
      noTax,
    )).toBe(
      'The reviewed withdrawal would execute no funds from its projected action-year source state after prior-year activity. Choose another source or keep the migrated row under review.',
    )
  })

  it('accepts a reviewed conversion whose projection commits the movement', () => {
    const { plan, target } = conversionReviewPlan()
    const result = completeConversionReview(plan, target)

    expect(retirementActionManualExecutionIssue(
      result.plan,
      result.replacement.actionId,
      CONVERSION_YEAR,
      noTax,
    )).toBeNull()
  })

  it('carries the projection refusal out verbatim when the source cannot fund it', () => {
    const { plan, target } = conversionReviewPlan({ iraBalanceDollars: 500 })
    const result = completeConversionReview(plan, target)

    expect(retirementActionManualExecutionIssue(
      result.plan,
      result.replacement.actionId,
      CONVERSION_YEAR,
      noTax,
    )).toBe(
      'The reviewed conversion would move no funds in 2034. ' +
        'The named conversion source had less available; no principal disappeared.',
    )
  })

  it('refuses a reviewed conversion scheduled before the projection starts', () => {
    const { plan, target } = conversionReviewPlan()
    const result = completeConversionReview(plan, target)

    expect(retirementActionManualExecutionIssue(
      result.plan,
      result.replacement.actionId,
      CONVERSION_YEAR + 1,
      noTax,
    )).toBe(
      'The reviewed conversion is scheduled before the current projection starts in 2035, so its action-year source state cannot be established. The migrated row remains under review.',
    )
  })

  it('accepts a truthful taxable partial from evolved balance and basis', () => {
    const plan = executionPreviewPlan()
    plan.expenses.baseAnnual = 0.75
    plan.accounts = [{
      type: 'taxable', id: 'taxable-multiyear', name: 'Multi-year taxable',
      ownerPersonId: 'p1', annualReturnPct: 0, balance: 1, costBasis: 0.75,
      annualContribution: 0,
    }]
    const priorYear = exactWithdrawal(
      'prior-taxable-sale',
      'taxable-multiyear',
      75,
      '2033-01-01',
      1,
      2033,
    )
    const reviewed = exactWithdrawal(
      'reviewed-taxable-sale',
      'taxable-multiyear',
      75,
      '2034-01-01',
      1,
    )
    plan.strategies.retirementActions = [reviewed, priorYear]

    expect(retirementActionManualExecutionIssue(
      plan,
      reviewed.actionId,
      2033,
      noTax,
    )).toBeNull()
  })
})
