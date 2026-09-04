import { describe, expect, it } from 'vitest'

import type {
  AnnualIraBasisAllocationEntryInput,
} from './annualIraBasisAllocation.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asUsdCents } from './money.js'
import {
  resolveOwnedNonRothIraAnnualWithdrawalEvidence,
  type ResolveOwnedNonRothIraAnnualWithdrawalEvidenceInput,
} from './ownedNonRothIraAnnualFinalization.js'
import type {
  ClassifyOwnedNonRothIraAnnualWithdrawalsInput,
  OwnedNonRothIraPoolMemberEvidence,
  OwnedNonRothIraSubtype,
} from './ownedNonRothIraWithdrawalCharacter.js'
import type {
  OwnedNonRothIraPenaltySourceEvidence,
  SimpleIraParticipationEvidence,
} from './ownedNonRothIraPenaltyPrerequisite.js'

function member(
  suffix: string,
  subtype: OwnedNonRothIraSubtype,
): OwnedNonRothIraPoolMemberEvidence {
  return {
    sourceAccountId: asAccountId(`ira-${suffix}`),
    ownerPersonId: asPersonId('owner'),
    accountType: 'traditional',
    accountKind: 'ira',
    inheritanceStatus: 'owned',
    subtype,
    yearEndApplicableBalanceAmount: asUsdCents(0),
    iraClassificationEvidenceId: `classification-${suffix}`,
    accountOwnershipEvidenceId: `ownership-${suffix}`,
  }
}

function withdrawal(
  suffix: string,
  scheduledDate: string,
  scheduledSequence = 1,
): AnnualIraBasisAllocationEntryInput {
  return {
    actionId: asActionId(`action-${suffix}`),
    allocationId: asAllocationId(`allocation-${suffix}`),
    sourceAccountId: asAccountId(`ira-${suffix}`),
    scheduledDate,
    scheduledSequence,
    grossAmount: asUsdCents(1),
  }
}

function source(
  suffix: string,
  subtype: OwnedNonRothIraSubtype,
  evaluationDate: string,
): OwnedNonRothIraPenaltySourceEvidence {
  return {
    predicate: 'ownedNonRothIraPenaltySourceForWithdrawal',
    actionId: asActionId(`action-${suffix}`),
    allocationId: asAllocationId(`allocation-${suffix}`),
    sourceAccountId: asAccountId(`ira-${suffix}`),
    ownerPersonId: asPersonId('owner'),
    subtype,
    evaluationDate,
    distributionDateEvidenceId: `distribution-date-${suffix}`,
    accountOwnershipEvidenceId: `ownership-${suffix}`,
    iraClassificationEvidenceId: `classification-${suffix}`,
  }
}

function simpleParticipation(): SimpleIraParticipationEvidence {
  return {
    predicate: 'simpleIraParticipationStartForPenaltyRate',
    sourceAccountId: asAccountId('ira-disability'),
    ownerPersonId: asPersonId('owner'),
    participationStartDate: '2029-01-01',
    participationStartEvidenceId: 'simple-participation-disability',
  }
}

function fixture(options: {
  birthDate?: string
  includeDisability?: boolean
  openingBasisAmount?: number
  annualFactsContributionAmount?: number
  annualFactsPostYearExcludedAmount?: number
  includeLine8?: boolean
  includeSimpleParticipation?: boolean
} = {}): ResolveOwnedNonRothIraAnnualWithdrawalEvidenceInput {
  const poolMembers = [
    member('basis', 'traditional'),
    member('disability', 'simple'),
    member('age', 'sep'),
  ]
  const stagedExecutedWithdrawals = [
    withdrawal('basis', '2030-01-01'),
    withdrawal('disability', '2030-01-15'),
    withdrawal('age', '2030-02-01'),
  ]
  const includeLine8 = options.includeLine8 ?? false
  const line8Conversions: AnnualIraBasisAllocationEntryInput[] =
    includeLine8
      ? [{
          actionId: asActionId('action-conversion'),
          allocationId: asAllocationId('allocation-conversion'),
          sourceAccountId: asAccountId('ira-age'),
          scheduledDate: '2030-03-01',
          scheduledSequence: 1,
          grossAmount: asUsdCents(1),
        }]
      : []
  const annualInput:
    Omit<ClassifyOwnedNonRothIraAnnualWithdrawalsInput, 'line7Distributions'> = {
      ownerPersonId: asPersonId('owner'),
      ownerWideNonRothIraPoolId: 'owner-pool',
      completePoolEvidence: {
        predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
        ownerPersonId: asPersonId('owner'),
        ownerWideNonRothIraPoolId: 'owner-pool',
        taxYear: 2030,
        accountIds: [
          asAccountId('ira-basis'),
          asAccountId('ira-disability'),
          asAccountId('ira-age'),
        ],
        yearEndApplicablePoolBalanceAmount: asUsdCents(0),
        evidenceId: 'complete-owner-pool',
      },
      annualBasisRecordEvidenceId: 'annual-basis-record',
      taxYear: 2030,
      poolMembers,
      annualFacts: {
        openingBasisAmount: asUsdCents(options.openingBasisAmount ?? 1),
        taxYearNondeductibleContributionAmount:
          asUsdCents(options.annualFactsContributionAmount ?? 0),
        postYearNondeductibleContributionExcludedAmount:
          asUsdCents(options.annualFactsPostYearExcludedAmount ?? 0),
        yearEndApplicablePoolBalanceAmount: asUsdCents(0),
        outstandingRolloverAmount: asUsdCents(0),
        rolloverRepaymentAdjustmentAmount: asUsdCents(0),
        form8606Line7DistributionAmount: asUsdCents(3),
        form8606Line8NetConversionAmount: asUsdCents(includeLine8 ? 1 : 0),
      },
      line8Conversions,
    }
  return {
    annualInput,
    stagedExecutedWithdrawals,
    ownerEvidence: {
      predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
      ownerPersonId: asPersonId('owner'),
      birthDate: options.birthDate ?? '1970-08-01',
      evidenceId: 'owner-birth-date',
    },
    sourceEvidence: [
      source('basis', 'traditional', '2030-01-01'),
      source('disability', 'simple', '2030-01-15'),
      source('age', 'sep', '2030-02-01'),
    ],
    qualifiedDisabilityEvidence:
      (options.includeDisability ?? true)
        ? [{
            kind: 'disability',
            disabledPersonId: asPersonId('owner'),
            disabilityQualificationDate: '2030-01-10',
            evaluationDate: '2030-01-15',
            qualifiedOnEvaluationDate: true,
            disabilityEvidenceId: 'qualified-disability',
          }]
        : [],
    simpleParticipationEvidence:
      (options.includeSimpleParticipation ?? false)
        ? [simpleParticipation()]
        : [],
  }
}

function resolvedId(
  input: ResolveOwnedNonRothIraAnnualWithdrawalEvidenceInput,
): string {
  const result = resolveOwnedNonRothIraAnnualWithdrawalEvidence(input)
  if (result.status !== 'annualEvidenceResolved') {
    throw new Error('fixture unexpectedly failed finalization')
  }
  return result.annualEvidence.finalizationEvidenceId
}

describe('resolveOwnedNonRothIraAnnualWithdrawalEvidence', () => {
  it('publishes a mixed basis-only, disability, and age-59½ owner-year bundle', () => {
    const result = resolveOwnedNonRothIraAnnualWithdrawalEvidence(fixture())

    expect(result.status).toBe('annualEvidenceResolved')
    expect(result.movement).toBe('notCommitted')
    expect(result.issues).toEqual([])
    if (result.status !== 'annualEvidenceResolved') return
    expect(result.annualEvidence).toMatchObject({
      predicate:
        'completeOwnedNonRothIraAnnualWithdrawalFinalizationForOwnerAndTaxYear',
      ownerPersonId: 'owner',
      ownerWideNonRothIraPoolId: 'owner-pool',
      taxYear: 2030,
    })
    expect(
      result.annualEvidence.characterization.withdrawals.map(
        (item) => item.basisRecoveredAmount,
      ),
    ).toEqual([1, 0, 0])
    expect(
      result.annualEvidence.penaltyPrerequisites.evaluations.map(
        (item) => item.outcome,
      ),
    ).toEqual(['disabilityQualified', 'age59HalfReached'])
    expect(
      result.annualEvidence.penaltyPrerequisites.coverage,
    ).toHaveLength(3)
  })

  it('allows a disability-qualified SIMPLE allocation without participation evidence', () => {
    const result = resolveOwnedNonRothIraAnnualWithdrawalEvidence(fixture())

    expect(result.status).toBe('annualEvidenceResolved')
    if (result.status !== 'annualEvidenceResolved') return
    const disability =
      result.annualEvidence.penaltyPrerequisites.evaluations.find(
        (item) => item.outcome === 'disabilityQualified',
      )
    expect(disability?.subtype).toBe('simple')
  })

  it('blocks the whole owner-year with one typed issue for one unresolved allocation', () => {
    const result = resolveOwnedNonRothIraAnnualWithdrawalEvidence(
      fixture({
        includeDisability: false,
        includeSimpleParticipation: true,
      }),
    )

    expect(result.status).toBe('penaltyEvidenceMissing')
    expect(result.movement).toBe('notCommitted')
    expect(result.annualEvidence).toBeNull()
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toMatchObject({
      actionId: 'action-disability',
      allocationId: 'allocation-disability',
      sourceAccountId: 'ira-disability',
      prerequisite: {
        outcome: 'exceptionEvaluationRequired',
      },
      reason: {
        code: 'withdrawal-penalty-evidence-missing',
        personId: 'owner',
        accountId: 'ira-disability',
        allocationId: 'allocation-disability',
      },
    })
  })

  it('emits one issue per unresolved allocation while publishing none of the owner-year', () => {
    const result = resolveOwnedNonRothIraAnnualWithdrawalEvidence(
      fixture({
        birthDate: '1975-01-01',
        includeDisability: false,
        includeSimpleParticipation: true,
      }),
    )

    expect(result.status).toBe('penaltyEvidenceMissing')
    expect(result.annualEvidence).toBeNull()
    expect(result.issues.map((item) => item.allocationId)).toEqual([
      'allocation-disability',
      'allocation-age',
    ])
  })

  it('publishes an all-basis owner-year without penalty evaluations', () => {
    const result = resolveOwnedNonRothIraAnnualWithdrawalEvidence(
      fixture({ openingBasisAmount: 3, includeDisability: false }),
    )

    expect(result.status).toBe('annualEvidenceResolved')
    if (result.status !== 'annualEvidenceResolved') return
    expect(
      result.annualEvidence.characterization.withdrawals.every(
        (item) => item.ordinaryIncomeAmount === 0,
      ),
    ).toBe(true)
    expect(
      result.annualEvidence.penaltyPrerequisites.evaluations,
    ).toEqual([])
  })

  it('requires complete SIMPLE participation facts before forming a blocked candidate', () => {
    expect(() =>
      resolveOwnedNonRothIraAnnualWithdrawalEvidence(
        fixture({ includeDisability: false }),
      ),
    ).toThrow('participation evidence is missing')

    const result = resolveOwnedNonRothIraAnnualWithdrawalEvidence(
      fixture({
        includeDisability: false,
        includeSimpleParticipation: true,
      }),
    )
    expect(result.status).toBe('penaltyEvidenceMissing')
    expect(result.issues[0]?.prerequisite.rateEvidence.kind).toBe(
      'simpleIraParticipationRate',
    )
  })

  it('binds annual facts and line-8 allocation evidence into the finalization ID', () => {
    const baseline = fixture({
      openingBasisAmount: 4,
      includeDisability: false,
    })
    const changedFacts = fixture({
      openingBasisAmount: 4,
      annualFactsContributionAmount: 1,
      annualFactsPostYearExcludedAmount: 1,
      includeDisability: false,
    })
    const changedLine8 = fixture({
      openingBasisAmount: 4,
      includeLine8: true,
      includeDisability: false,
    })

    expect(resolvedId(changedFacts)).not.toBe(resolvedId(baseline))
    expect(resolvedId(changedLine8)).not.toBe(resolvedId(baseline))
  })

  it('is invariant to permutations of complete input collections', () => {
    const baseline = fixture()
    const permuted: ResolveOwnedNonRothIraAnnualWithdrawalEvidenceInput = {
      ...baseline,
      annualInput: {
        ...baseline.annualInput,
        poolMembers: [...baseline.annualInput.poolMembers].reverse(),
        completePoolEvidence: {
          ...baseline.annualInput.completePoolEvidence,
          accountIds: [
            ...baseline.annualInput.completePoolEvidence.accountIds,
          ].reverse() as [
            ReturnType<typeof asAccountId>,
            ...ReturnType<typeof asAccountId>[],
          ],
        },
      },
      stagedExecutedWithdrawals:
        [...baseline.stagedExecutedWithdrawals].reverse(),
      sourceEvidence: [...baseline.sourceEvidence].reverse(),
    }

    expect(
      resolveOwnedNonRothIraAnnualWithdrawalEvidence(permuted),
    ).toEqual(resolveOwnedNonRothIraAnnualWithdrawalEvidence(baseline))
  })

  it('propagates malformed and contradictory evidence instead of downgrading it', () => {
    const malformed = fixture()
    ;(
      malformed.sourceEvidence[1] as {
        ownerPersonId: ReturnType<typeof asPersonId>
      }
    ).ownerPersonId = asPersonId('other-owner')

    expect(() =>
      resolveOwnedNonRothIraAnnualWithdrawalEvidence(malformed),
    ).toThrow('source evidence must exactly bind')
  })

  it('rejects empty or zero-gross staged execution entries instead of silently dropping them', () => {
    const emptyBaseline = fixture()
    const empty: ResolveOwnedNonRothIraAnnualWithdrawalEvidenceInput = {
      ...emptyBaseline,
      annualInput: {
        ...emptyBaseline.annualInput,
        annualFacts: {
          ...emptyBaseline.annualInput.annualFacts,
          form8606Line7DistributionAmount: asUsdCents(0),
        },
      },
      stagedExecutedWithdrawals: [],
    }
    expect(() =>
      resolveOwnedNonRothIraAnnualWithdrawalEvidence(empty),
    ).toThrow('requires at least one staged executed withdrawal')

    const zeroBaseline = fixture()
    const zero: ResolveOwnedNonRothIraAnnualWithdrawalEvidenceInput = {
      ...zeroBaseline,
      annualInput: {
        ...zeroBaseline.annualInput,
        annualFacts: {
          ...zeroBaseline.annualInput.annualFacts,
          form8606Line7DistributionAmount: asUsdCents(2),
        },
      },
      stagedExecutedWithdrawals:
        zeroBaseline.stagedExecutedWithdrawals.map((entry, index) =>
          index === 0 ? { ...entry, grossAmount: asUsdCents(0) } : entry,
        ),
    }
    expect(() =>
      resolveOwnedNonRothIraAnnualWithdrawalEvidence(zero),
    ).toThrow('must have positive executed gross')
  })

  it('returns detached, deterministic, deeply frozen evidence without freezing callers', () => {
    const input = fixture()
    const baseline = resolveOwnedNonRothIraAnnualWithdrawalEvidence(input)

    expect(Object.isFrozen(input)).toBe(false)
    expect(Object.isFrozen(input.annualInput)).toBe(false)
    expect(Object.isFrozen(input.stagedExecutedWithdrawals)).toBe(false)
    expect(Object.isFrozen(baseline)).toBe(true)
    expect(Object.isFrozen(baseline.issues)).toBe(true)
    if (baseline.status !== 'annualEvidenceResolved') return
    expect(Object.isFrozen(baseline.annualEvidence)).toBe(true)
    expect(
      Object.isFrozen(
        baseline.annualEvidence.penaltyPrerequisites.coverage[0],
      ),
    ).toBe(true)

    ;(
      input.annualInput as {
        annualBasisRecordEvidenceId: string
      }
    ).annualBasisRecordEvidenceId = 'mutated-record'
    ;(
      input.stagedExecutedWithdrawals[0] as {
        grossAmount: ReturnType<typeof asUsdCents>
      }
    ).grossAmount = asUsdCents(999)
    expect(
      baseline.annualEvidence.characterization.annualBasisEvidence
        .annualBasisRecordEvidenceId,
    ).toBe('annual-basis-record')
    expect(
      baseline.annualEvidence.characterization.withdrawals[0]
        ?.executedAmount,
    ).toBe(1)
    expect(
      resolveOwnedNonRothIraAnnualWithdrawalEvidence(fixture()),
    ).toEqual(baseline)
  })

  it('mints the finalization evidence ID with the hardened structural minter', () => {
    const id = resolvedId(fixture())

    expect(id).toBe(
      'owned-non-roth-ira-annual-withdrawal-finalization:575657a1ef6e' +
        'a4970a5d5ce0f12e28fc938f0a4c964e172a8df14b4b3a5b2e55',
    )
    expect(resolvedId(fixture())).toBe(id)
    expect(resolvedId(fixture({ includeLine8: true }))).not.toBe(id)
  })
})
