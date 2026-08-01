import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  asActionId,
  asAccountId,
  asAllocationId,
  asPersonId,
  asPlanId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import {
  buildPlanOwnedNonRothIraAnnualFilingEvidence,
  type BuildPlanOwnedNonRothIraAnnualFilingEvidenceInput,
  type PlanOwnedNonRothIraAnnualFilingSourceRecord,
} from './ownedNonRothIraAnnualFilingEvidence.js'
import * as structuralId from './structuralId.js'
import type { Plan } from '../model/plan.js'
import {
  singlePersonPlan,
  traditionalAccount,
} from '../testing/planFixtures.js'

const planId = asPlanId('plan-filing-facts')
const ownerPersonId = asPersonId('owner')
const requestedIra = asAccountId('ira-requested')
const siblingIra = asAccountId('ira-sibling')

function plan(): Plan {
  const value = singlePersonPlan({ dob: '1950-01-01', planningAge: 100 })
  value.id = planId
  value.household.people[0]!.id = ownerPersonId
  value.accounts = [
    traditionalAccount(requestedIra, 100_000, ownerPersonId),
    traditionalAccount(siblingIra, 20_000, ownerPersonId),
  ]
  return value
}

function sourceRecord(): PlanOwnedNonRothIraAnnualFilingSourceRecord {
  return {
    predicate: 'completePlanOwnedNonRothIraAnnualFilingSourceRecord',
    planId,
    ownerPersonId,
    taxYear: 2030,
    evidenceScope: 'realWorldTaxRecordNotProjection',
    sourceRecordId: 'filing-source-record',
    sourceEvidenceId: 'filing-source-evidence',
    authority: {
      acquisition: 'import',
      recordKind: 'filedForm8606',
      sourceId: 'filed-return-source',
      finalizedDate: '2031-04-15',
    },
    reviewedSourceAccountIds: [requestedIra, siblingIra],
    openingBasis: {
      asOfDate: '2030-01-01',
      openingBasisAmount: asUsdCents(400_000),
      sourceEvidenceId: 'opening-basis-source',
    },
    rolloverFacts: {
      inventoryStatus: 'completeIncludingExplicitEmpty',
      outstandingRolloverAmount: 0,
      rolloverRepaymentAdjustmentAmount: 0,
      sourceEvidenceId: 'rollover-inventory-source',
    },
    nondeductibleContributionFacts: {
      inYearInventoryStatus: 'completeExplicitEmpty',
      inYearContributions: [],
      postYearWindowStatus: 'completeThroughOrdinaryDeadline',
      completedThroughDate: '2031-04-15',
      deadlineAuthority: {
        authoritySourceId: 'irs-deadline-source',
        designatedTaxYear: 2030,
        deadlineStatus: 'authoritativeFederalDeadlineEstablished',
        deadlineKind:
          'ordinaryFederalFilingDeadlineExcludingDisasterRelief',
        calendarAdjustmentStatus:
          'weekendAndDistrictOfColumbiaHolidayAdjustmentApplied',
        disasterReliefContributionStatus:
          'noPostOrdinaryDeadlineContributionClaimed',
        deadlineDate: '2031-04-15',
      },
      contributions: [{
        sourceRecordId: 'post-year-contribution-record',
        sourceEvidenceId: 'post-year-contribution-source',
        sourceAccountId: siblingIra,
        designatedTaxYear: 2030,
        contributionDate: '2031-02-01',
        nondeductibleContributionAmount: asPositiveUsdCents(250_000),
      }],
    },
  }
}

function input(): BuildPlanOwnedNonRothIraAnnualFilingEvidenceInput {
  return {
    plan: plan(),
    ownerPersonId,
    taxYear: 2030,
    ledgerRunId: 'ledger-2030',
    knowledgeAsOfDate: '2031-04-15',
    sourceRecord: sourceRecord(),
  }
}

function built(
  value: BuildPlanOwnedNonRothIraAnnualFilingEvidenceInput = input(),
) {
  const result = buildPlanOwnedNonRothIraAnnualFilingEvidence(value)
  expect(result.status).toBe('annualFilingEvidenceBuilt')
  if (result.status !== 'annualFilingEvidenceBuilt') {
    throw new Error(JSON.stringify(result.issues))
  }
  return result
}

function clone(): BuildPlanOwnedNonRothIraAnnualFilingEvidenceInput {
  return structuredClone(input())
}

function issueKinds(
  value: BuildPlanOwnedNonRothIraAnnualFilingEvidenceInput,
): string[] {
  const result = buildPlanOwnedNonRothIraAnnualFilingEvidence(value)
  expect(result.status).toBe('annualFilingEvidenceBlocked')
  if (result.status !== 'annualFilingEvidenceBlocked') return []
  expect(result.annualBasisRecord).toBeNull()
  expect(result.postYearContributionWindow).toBeNull()
  return result.issues.map((item) => item.kind)
}

afterEach(() => vi.restoreAllMocks())

describe('Plan-owned non-Roth IRA annual filing evidence', () => {
  it('atomically builds the two existing PR105 filing-fact inputs', () => {
    const result = built()

    expect(result).toMatchObject({
      movement: 'notCommitted',
      actionability: 'notEstablished',
      annualBasisRecord: {
        predicate: 'completePlanOwnedNonRothIraAnnualBasisRecord',
        planId,
        ownerPersonId,
        taxYear: 2030,
        ledgerRunId: 'ledger-2030',
        recordStatus: 'openingBasisAndExplicitZeroRolloverFactsComplete',
        openingBasisAmount: 400_000,
        outstandingRolloverAmount: 0,
        rolloverRepaymentAdjustmentAmount: 0,
      },
      postYearContributionWindow: {
        predicate:
          'completePlanOwnedNonRothIraPostYearNondeductibleContributionWindow',
        inventoryStatus: 'completeIncludingExplicitEmpty',
        deadlineEvidence: {
          predicate: 'federalIraContributionDeadlineForTaxYear',
          deadlineStatus: 'authoritativeFederalDeadlineEstablished',
          deadlineDate: '2031-04-15',
        },
        contributions: [{
          planId,
          ownerPersonId,
          sourceAccountId: siblingIra,
          designatedTaxYear: 2030,
          contributionDate: '2031-02-01',
          nondeductibleContributionAmount: 250_000,
        }],
      },
      issues: [],
    })
    expect(result.annualBasisRecord.evidenceId).not.toBe(
      result.annualBasisRecord.upstreamEvidenceId,
    )
    expect(result.postYearContributionWindow.evidenceId).not.toBe(
      result.postYearContributionWindow.upstreamEvidenceId,
    )
  })

  it('supports a filing-record-complete explicit-empty post-year window', () => {
    const value = clone()
    const source = value.sourceRecord as PlanOwnedNonRothIraAnnualFilingSourceRecord
    source.nondeductibleContributionFacts.contributions = []

    expect(built(value).postYearContributionWindow.contributions).toEqual([])
  })

  it('accepts manual entry of a real tax-professional workpaper', () => {
    const value = clone()
    const authority =
      (value.sourceRecord as PlanOwnedNonRothIraAnnualFilingSourceRecord)
        .authority
    authority.acquisition = 'manual'
    authority.recordKind = 'taxProfessionalWorkpaper'

    expect(built(value).status).toBe('annualFilingEvidenceBuilt')
  })

  it('rejects projection observations instead of promoting modeled emptiness', () => {
    const value = clone()
    value.sourceRecord = {
      predicate: 'completeSimulatorOwnedNonRothIraAnnualObservation',
      evidenceScope: 'projectionModelOnlyNotRealWorldFilingCompleteness',
      startOfTaxYearBasisObservation: { startOfTaxYearIraBasisAmount: 400_000 },
      projectionPostYearContributionWindow: { contributions: [] },
    }

    expect(issueKinds(value)).toEqual(['projectionEvidenceRejected'])
  })

  it('rejects projection evidence even when hidden under an arbitrary wrapper', () => {
    const value = clone()
    value.sourceRecord = {
      predicate: 'arbitraryWrapper',
      nested: {
        predicate: 'simulatorOwnedNonRothIraStartOfTaxYearBasisObservation',
        evidenceScope: 'projectionModelOnlyNotRealWorldFilingCompleteness',
      },
    }

    expect(issueKinds(value)).toEqual(['projectionEvidenceRejected'])
  })

  it('does not treat Plan nondeductibleBasis as a source record', () => {
    const value = clone()
    const valuePlan = value.plan as Plan
    const account = valuePlan.accounts[0]
    if (account?.type !== 'traditional') throw new Error('fixture drift')
    account.nondeductibleBasis = 4_000
    value.sourceRecord = null

    expect(issueKinds(value)).toEqual(['sourceRecordInvalid'])
  })

  it.each([
    ['wrong Plan', { planId: asPlanId('other-plan') }],
    ['wrong owner', { ownerPersonId: asPersonId('other-owner') }],
    ['wrong year', { taxYear: 2031 }],
  ] as const)('blocks a source record with the %s binding', (_name, mutation) => {
    const value = clone()
    Object.assign(value.sourceRecord as object, mutation)
    expect(issueKinds(value)).toContain('sourceBindingMismatch')
  })

  it('requires the exact reviewed owner-wide pool', () => {
    const missing = clone()
    ;(missing.sourceRecord as PlanOwnedNonRothIraAnnualFilingSourceRecord)
      .reviewedSourceAccountIds = [requestedIra]
    expect(issueKinds(missing)).toContain('reviewedPoolMismatch')

    const duplicate = clone()
    ;(duplicate.sourceRecord as PlanOwnedNonRothIraAnnualFilingSourceRecord)
      .reviewedSourceAccountIds = [requestedIra, siblingIra, siblingIra]
    expect(issueKinds(duplicate)).toContain('reviewedPoolMismatch')

    const added = clone()
    ;(added.plan as Plan).accounts.push(
      traditionalAccount(asAccountId('new-sibling'), 1, ownerPersonId),
    )
    expect(issueKinds(added)).toContain('reviewedPoolMismatch')
  })

  it('requires January 1 opening basis and literal-zero rollover facts', () => {
    const wrongDate = clone()
    ;(wrongDate.sourceRecord as PlanOwnedNonRothIraAnnualFilingSourceRecord)
      .openingBasis.asOfDate = '2030-01-02'
    expect(issueKinds(wrongDate)).toEqual(['annualBasisIncomplete'])

    const rollover = clone()
    ;((rollover.sourceRecord as PlanOwnedNonRothIraAnnualFilingSourceRecord)
      .rolloverFacts as { outstandingRolloverAmount: number })
      .outstandingRolloverAmount = 1
    expect(issueKinds(rollover)).toContain('sourceRecordInvalid')

    for (const field of [
      'outstandingRolloverAmount',
      'rolloverRepaymentAdjustmentAmount',
    ] as const) {
      const negativeZero = clone()
      const facts = (negativeZero.sourceRecord as
        PlanOwnedNonRothIraAnnualFilingSourceRecord).rolloverFacts
      ;(facts as Record<typeof field, number>)[field] = -0
      expect(issueKinds(negativeZero)).toContain('sourceRecordInvalid')
    }
  })

  it('requires the complete in-year contribution inventory to be explicitly empty', () => {
    const value = clone()
    ;((value.sourceRecord as PlanOwnedNonRothIraAnnualFilingSourceRecord)
      .nondeductibleContributionFacts.inYearContributions as unknown[])
      .push({ amount: 1 })

    expect(issueKinds(value)).toContain('sourceRecordInvalid')
  })

  it('requires the source record and window to be final by the knowledge date', () => {
    const premature = clone()
    ;(premature.sourceRecord as PlanOwnedNonRothIraAnnualFilingSourceRecord)
      .authority.finalizedDate = '2031-04-14'
    expect(issueKinds(premature)).toEqual(['sourceNotFinal'])

    const future = clone()
    future.knowledgeAsOfDate = '2031-04-14'
    expect(issueKinds(future)).toEqual(['sourceNotFinal'])
  })

  it.each([
    ['2031-04-14', 'deadlineAuthorityInvalid'],
    ['2031-04-16', 'deadlineAuthorityInvalid'],
    ['2031-04-19', 'deadlineAuthorityInvalid'],
    ['2031-02-29', 'deadlineAuthorityInvalid'],
  ])('rejects invalid authoritative deadline %s', (deadlineDate, expected) => {
    const value = clone()
    const source = value.sourceRecord as PlanOwnedNonRothIraAnnualFilingSourceRecord
    source.nondeductibleContributionFacts.deadlineAuthority.deadlineDate =
      deadlineDate
    source.nondeductibleContributionFacts.completedThroughDate = deadlineDate
    source.authority.finalizedDate = deadlineDate
    value.knowledgeAsOfDate = '2031-04-20'

    expect(issueKinds(value)).toContain(expected)
  })

  it('accepts an exact weekend and DC-holiday-adjusted ordinary deadline', () => {
    const value = clone()
    value.taxYear = 2027
    value.knowledgeAsOfDate = '2028-04-18'
    const source = value.sourceRecord as PlanOwnedNonRothIraAnnualFilingSourceRecord
    source.taxYear = 2027
    source.openingBasis.asOfDate = '2027-01-01'
    source.authority.finalizedDate = '2028-04-18'
    source.nondeductibleContributionFacts.completedThroughDate = '2028-04-18'
    source.nondeductibleContributionFacts.deadlineAuthority.designatedTaxYear = 2027
    source.nondeductibleContributionFacts.deadlineAuthority.deadlineDate =
      '2028-04-18'
    source.nondeductibleContributionFacts.contributions[0]!.designatedTaxYear =
      2027
    source.nondeductibleContributionFacts.contributions[0]!.contributionDate =
      '2028-02-01'

    expect(built(value).postYearContributionWindow.deadlineEvidence.deadlineDate)
      .toBe('2028-04-18')
  })

  it.each([
    [2011, '2012-04-17'],
    [2021, '2022-04-18'],
  ])(
    'accepts the modeled ordinary deadline branches for tax year %i',
    (taxYear, deadlineDate) => {
      const value = clone()
      value.taxYear = taxYear
      value.knowledgeAsOfDate = deadlineDate
      const source = value.sourceRecord as
        PlanOwnedNonRothIraAnnualFilingSourceRecord
      source.taxYear = taxYear
      source.openingBasis.asOfDate = `${taxYear}-01-01`
      source.authority.finalizedDate = deadlineDate
      source.nondeductibleContributionFacts.completedThroughDate = deadlineDate
      source.nondeductibleContributionFacts.deadlineAuthority.designatedTaxYear =
        taxYear
      source.nondeductibleContributionFacts.deadlineAuthority.deadlineDate =
        deadlineDate
      source.nondeductibleContributionFacts.contributions[0]!.designatedTaxYear =
        taxYear
      source.nondeductibleContributionFacts.contributions[0]!.contributionDate =
        `${taxYear + 1}-02-01`

      expect(built(value).postYearContributionWindow.deadlineEvidence.deadlineDate)
        .toBe(deadlineDate)
    },
  )

  it.each([
    ['2030-12-31', 'ira-sibling'],
    ['2031-04-16', 'ira-sibling'],
    ['2031-02-01', 'foreign-account'],
  ])(
    'rejects a post-year contribution dated %s from %s',
    (contributionDate, sourceAccountId) => {
      const value = clone()
      const contribution =
        (value.sourceRecord as PlanOwnedNonRothIraAnnualFilingSourceRecord)
          .nondeductibleContributionFacts.contributions[0]!
      contribution.contributionDate = contributionDate
      contribution.sourceAccountId = asAccountId(sourceAccountId)

      expect(issueKinds(value)).toContain('postYearContributionInvalid')
    },
  )

  it('rejects duplicate contribution source identities', () => {
    const value = clone()
    const facts = (value.sourceRecord as PlanOwnedNonRothIraAnnualFilingSourceRecord)
      .nondeductibleContributionFacts
    facts.contributions = [facts.contributions[0]!, {
      ...facts.contributions[0]!,
      contributionDate: '2031-02-02',
    }]

    expect(issueKinds(value)).toContain('postYearContributionInvalid')
  })

  it('detects exact-cent aggregate overflow', () => {
    const value = clone()
    const facts = (value.sourceRecord as PlanOwnedNonRothIraAnnualFilingSourceRecord)
      .nondeductibleContributionFacts
    facts.contributions = [
      {
        ...facts.contributions[0]!,
        nondeductibleContributionAmount:
          asPositiveUsdCents(Number.MAX_SAFE_INTEGER),
      },
      {
        ...facts.contributions[0]!,
        sourceRecordId: 'second-contribution-record',
        sourceEvidenceId: 'second-contribution-source',
        contributionDate: '2031-02-02',
        nondeductibleContributionAmount: asPositiveUsdCents(1),
      },
    ]

    expect(issueKinds(value)).toEqual(['amountOverflow'])
  })

  it('canonicalizes source, contribution, and Plan account permutations', () => {
    const first = input()
    const second = clone()
    ;(second.plan as Plan).accounts.reverse()
    const source = second.sourceRecord as PlanOwnedNonRothIraAnnualFilingSourceRecord
    source.reviewedSourceAccountIds.reverse()
    source.nondeductibleContributionFacts.contributions = [
      {
        ...source.nondeductibleContributionFacts.contributions[0]!,
        sourceRecordId: 'earlier-record',
        sourceEvidenceId: 'earlier-source',
        sourceAccountId: requestedIra,
        contributionDate: '2031-01-15',
      },
      source.nondeductibleContributionFacts.contributions[0]!,
    ].reverse()
    const matching = clone()
    const matchingSource =
      matching.sourceRecord as PlanOwnedNonRothIraAnnualFilingSourceRecord
    matchingSource.nondeductibleContributionFacts.contributions = [
      {
        ...matchingSource.nondeductibleContributionFacts.contributions[0]!,
        sourceRecordId: 'earlier-record',
        sourceEvidenceId: 'earlier-source',
        sourceAccountId: requestedIra,
        contributionDate: '2031-01-15',
      },
      matchingSource.nondeductibleContributionFacts.contributions[0]!,
    ]

    expect(built(second)).toEqual(built(matching))
    expect(built(first)).not.toEqual(built(matching))
  })

  it('returns detached, deeply frozen evidence', () => {
    const value = input()
    const result = built(value)
    const source = value.sourceRecord as PlanOwnedNonRothIraAnnualFilingSourceRecord
    source.openingBasis.openingBasisAmount = asUsdCents(1)
    source.nondeductibleContributionFacts.contributions[0]!
      .nondeductibleContributionAmount = asPositiveUsdCents(1)

    expect(result.annualBasisRecord.openingBasisAmount).toBe(400_000)
    expect(result.postYearContributionWindow.contributions[0]!
      .nondeductibleContributionAmount).toBe(250_000)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.annualBasisRecord)).toBe(true)
    expect(Object.isFrozen(result.postYearContributionWindow.contributions)).toBe(true)
    expect(Object.isFrozen(result.postYearContributionWindow.contributions[0])).toBe(true)
  })

  it('reads each caller-controlled root and nested source property once', () => {
    const value = input()
    const reads = new Map<string, number>()
    const once = <T>(key: string, first: T, later: T): (() => T) => () => {
      const count = (reads.get(key) ?? 0) + 1
      reads.set(key, count)
      return count === 1 ? first : later
    }
    const rawSource = sourceRecord() as unknown as Record<string, unknown>
    Object.defineProperty(rawSource, 'openingBasis', {
      enumerable: true,
      get: once('nested-opening', rawSource['openingBasis'], null),
    })
    const hostile = {} as BuildPlanOwnedNonRothIraAnnualFilingEvidenceInput
    Object.defineProperties(hostile, {
      plan: { enumerable: true, get: once('plan', value.plan, null) },
      ownerPersonId: {
        enumerable: true,
        get: once('owner', value.ownerPersonId, 'other'),
      },
      taxYear: { enumerable: true, get: once('year', value.taxYear, 9999) },
      ledgerRunId: {
        enumerable: true,
        get: once('ledger', value.ledgerRunId, ''),
      },
      knowledgeAsOfDate: {
        enumerable: true,
        get: once('knowledge', value.knowledgeAsOfDate, 'bad'),
      },
      sourceRecord: {
        enumerable: true,
        get: once('source', rawSource, null),
      },
    })

    expect(built(hostile).annualBasisRecord.openingBasisAmount).toBe(400_000)
    expect([...reads.values()]).toEqual([1, 1, 1, 1, 1, 1, 1])
  })

  it('changes ledger-bound evidence IDs when the ledger run changes', () => {
    const first = built()
    const changed = clone()
    changed.ledgerRunId = 'ledger-2030-retry'
    const second = built(changed)

    expect(second.annualBasisRecord.evidenceId).not.toBe(
      first.annualBasisRecord.evidenceId,
    )
    expect(second.postYearContributionWindow.evidenceId).not.toBe(
      first.postYearContributionWindow.evidenceId,
    )
  })

  it('rejects source identifiers that collide with Plan identities', () => {
    const value = clone()
    ;(value.sourceRecord as PlanOwnedNonRothIraAnnualFilingSourceRecord)
      .sourceRecordId = planId

    expect(issueKinds(value)).toContain('identifierCollision')
  })

  it('rejects collisions with every other persisted Plan identity role', () => {
    const collisionId = 'filing-source-record'
    const mutations: ReadonlyArray<(target: Plan) => void> = [
      (target) => {
        target.insurance = [{
          kind: 'ltc',
          id: collisionId,
          name: 'Policy',
          owner: ownerPersonId,
          annualPremium: 0,
          premiumMode: 'paidUp',
          benefitMonthly: 0,
          benefitPeriodYears: 1,
          eliminationPeriodDays: 0,
        }]
      },
      (target) => {
        target.careEvents = [{
          id: collisionId,
          personId: ownerPersonId,
          startAge: 80,
          durationYears: 1,
          annualCost: 1,
        }]
      },
      (target) => {
        target.incomeFloor = { ladders: [{
          id: collisionId,
          name: 'Ladder',
          purpose: 'floor',
          startYear: 2030,
          endYear: 2030,
          annualRealAmount: 1,
        }] }
      },
      (target) => {
        target.incomes = [{
          type: 'recurring',
          id: collisionId,
          label: 'Income',
          annualAmount: 1,
          startYear: null,
          endYear: null,
          inflationAdjusted: false,
          taxTreatment: 'ordinary',
        }]
      },
      (target) => {
        target.incomes = [{
          type: 'socialSecurity',
          id: 'social-security-income',
          personId: ownerPersonId,
          piaMonthly: 1,
          earnings: null,
          formerSpouses: [{
            id: collisionId,
            relationship: 'divorced',
            dob: '1950-01-01',
            piaMonthly: 1,
            marriageYears: 10,
            remarriedAtAge: null,
          }],
          claimAge: { years: 67, months: 0 },
        }]
      },
      (target) => {
        target.expenses.oneTimeGoals = [{
          id: collisionId,
          label: 'Goal',
          year: 2030,
          amount: 1,
        }]
      },
      (target) => {
        target.scenarios = [{ id: collisionId, name: 'Scenario', patch: {} }]
      },
      (target) => {
        const amount = asPositiveUsdCents(1)
        target.strategies.retirementActions = [{
          actionId: asActionId('qcd-action'),
          kind: 'qcd',
          donorPersonId: ownerPersonId,
          year: 2030,
          executionDate: '2030-12-15',
          executionSequence: 1,
          requestedAmount: amount,
          allocation: {
            allocationId: asAllocationId('qcd-allocation'),
            sourceAccountId: requestedIra,
            requestedAmount: amount,
          },
          charity: {
            designationId: collisionId,
            name: 'Charity',
            designationKind: 'eligiblePublicCharity',
            directFromCustodianAttested: true,
            eligibleOrganizationAttested: true,
            notDonorAdvisedFundOrSupportingOrganizationAttested: true,
            notSplitInterestEntityAttested: true,
            entireDistributionOtherwiseDeductibleAttested: true,
          },
          provenance: { source: 'manual' },
        }]
      },
    ]

    for (const mutate of mutations) {
      const value = clone()
      mutate(value.plan as Plan)
      expect(issueKinds(value)).toContain('identifierCollision')
    }
  })

  it('rejects derived identifier collisions and emits neither complete record', () => {
    vi.spyOn(structuralId, 'deriveActionStructuralId').mockReturnValue('collision')

    expect(issueKinds(input())).toContain('identifierCollision')
  })

  it('fails closed without throwing on hostile or malformed inputs', () => {
    const malformed = {
      ...input(),
      sourceRecord: { predicate: 'wrong' },
    }
    expect(() => buildPlanOwnedNonRothIraAnnualFilingEvidence(malformed))
      .not.toThrow()
    expect(issueKinds(malformed)).toContain('sourceRecordInvalid')

    const throwing = {} as BuildPlanOwnedNonRothIraAnnualFilingEvidenceInput
    Object.defineProperty(throwing, 'plan', {
      get: () => { throw new Error('hostile') },
    })
    const result = buildPlanOwnedNonRothIraAnnualFilingEvidence(throwing)
    expect(result).toMatchObject({
      status: 'annualFilingEvidenceBlocked',
      annualBasisRecord: null,
      postYearContributionWindow: null,
      issues: [{ kind: 'inputInvalid' }],
    })
  })
})
