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
import type { Plan } from '@retiregolden/engine/model/plan'

import {
  buildRetirementActionManualIntent,
  emptyRetirementActionManualEditorDraft,
  formatPositiveUsdCents,
  RETIREMENT_ACTION_CONVERSION_EXECUTOR_BOUNDARY,
  retirementActionManualPersonSupportIssue,
  retirementActionManualSourceSupportIssue,
} from './retirementActionManualEditor'

const DEFAULT_REQUESTED_AMOUNT = asPositiveUsdCents(1_234_56)

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
    personId: 'person-a',
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
        RETIREMENT_ACTION_CONVERSION_EXECUTOR_BOUNDARY,
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
      ok: false,
      issues: [RETIREMENT_ACTION_CONVERSION_EXECUTOR_BOUNDARY],
    })
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
        RETIREMENT_ACTION_CONVERSION_EXECUTOR_BOUNDARY,
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
      }],
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
        RETIREMENT_ACTION_CONVERSION_EXECUTOR_BOUNDARY,
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
        DEFAULT_REQUESTED_AMOUNT, ordinaryPlan,
      ) === null,
    )).toEqual([true, true, true, false, false, false, false])
    expect(retirementActionManualSourceSupportIssue(
      'legacyAggregateWithdrawal', ordinaryAccounts[3]!, '2034-09-01', 2034,
      DEFAULT_REQUESTED_AMOUNT, ordinaryPlan,
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
        DEFAULT_REQUESTED_AMOUNT, conversionPlan,
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
      DEFAULT_REQUESTED_AMOUNT, twoLivingSingle,
    )).toBe(
      'Taxable-account withdrawal review requires an unambiguous projected tax unit; 2 household members are modeled alive in 2034 under Single status.',
    )

    const twoLivingJoint = structuredClone(twoLivingSingle)
    twoLivingJoint.household.filingStatus = 'marriedFilingJointly'
    expect(retirementActionManualSourceSupportIssue(
      'legacyAggregateWithdrawal', taxableAccount, '2034-06-15', 2034,
      DEFAULT_REQUESTED_AMOUNT, twoLivingJoint,
    )).toBeNull()

    const oneLivingSingle = structuredClone(twoLivingSingle)
    oneLivingSingle.household.people[1]!.dob = '1973-01-01'
    oneLivingSingle.household.people[1]!.longevity.planningAge = 60
    expect(retirementActionManualSourceSupportIssue(
      'legacyAggregateWithdrawal', taxableAccount, '2034-06-15', 2034,
      DEFAULT_REQUESTED_AMOUNT, oneLivingSingle,
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
        DEFAULT_REQUESTED_AMOUNT, boundaryPlan,
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
      DEFAULT_REQUESTED_AMOUNT, overPlan,
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
        requestedAmount, { ...supportedPlan, accounts },
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
