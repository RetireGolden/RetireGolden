import { describe, expect, it } from 'vitest'
import { describeRule } from '../rules/describeRule.js'
import { parsePlan } from '../model/plan.js'
import { couplePlan, singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import type { RetirementActionEligibilityRuntimeEvidence } from '../strategies/accountEligibility.js'
import type { QualifiedCharitableDistributionRequest } from './contract.js'
import { asAccountId, asActionId, asAllocationId, asPersonId } from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { evaluateAnnualQcdExecutionPrerequisites } from './annualQcdExecutionPrerequisite.js'
import type { AnnualQcdRmdPoolOpeningSnapshot } from './annualQcdPhysicalExecution.js'
import type { ClassifyOwnedNonRothIraAnnualWithdrawalsInput } from './ownedNonRothIraWithdrawalCharacter.js'
import {
  stageAnnualQcdItemizedSection170Ledger,
  type AnnualQcdItemizedSection170TaxUnitInput,
  type StageAnnualQcdItemizedSection170LedgerInput,
} from './annualQcdItemizedSection170Ledger.js'

interface Spec { id: string; donor?: 'p1' | 'p2'; amount: number; date: string; sequence?: number }
interface Options {
  year?: number
  taxableCapacity?: Partial<Record<'p1' | 'p2', number>>
  joint?: boolean
  contributionBase?: number
  priorFloor?: number
  priorPercentage?: number
  openingItemized?: number
  carry?: Record<string, boolean>
}
const charity = {
  designationId: 'public-charity', name: 'Public charity',
  designationKind: 'eligiblePublicCharity' as const,
  directFromCustodianAttested: true, eligibleOrganizationAttested: true,
  notDonorAdvisedFundOrSupportingOrganizationAttested: true,
  notSplitInterestEntityAttested: true, entireDistributionOtherwiseDeductibleAttested: true,
}
function request(spec: Spec, year: number): QualifiedCharitableDistributionRequest {
  const donor = spec.donor ?? 'p1'
  return {
    actionId: asActionId(spec.id), kind: 'qcd', year,
    executionDate: spec.date, executionSequence: spec.sequence ?? 1,
    requestedAmount: asPositiveUsdCents(spec.amount), provenance: { source: 'manual' },
    donorPersonId: asPersonId(donor),
    allocation: {
      allocationId: asAllocationId(`allocation-${spec.id}`),
      sourceAccountId: asAccountId(`ira-${donor}`),
      requestedAmount: asPositiveUsdCents(spec.amount),
    },
    charity: { ...charity, designationId: `charity-${spec.id}` },
  }
}
function fixture(
  specs: readonly Spec[] = [{ id: 'qcd-a', amount: 1_000, date: '2026-08-01' }],
  options: Options = {},
): StageAnnualQcdItemizedSection170LedgerInput {
  const year = options.year ?? 2026
  const requests = specs.map((spec) => request(spec, year))
  const donors = [...new Set(requests.map((entry) => entry.donorPersonId))].sort()
  const rawPlan = options.joint || donors.includes(asPersonId('p2'))
    ? couplePlan({ p1Dob: '1955-01-31', p2Dob: '1955-01-31', p1PlanningAge: 90, p2PlanningAge: 90 })
    : singlePersonPlan({ dob: '1955-01-31', planningAge: 90 })
  rawPlan.accounts = donors.map((donor) => traditionalAccount(`ira-${donor}`, 1_000_000, donor))
  rawPlan.strategies.retirementActions = [...requests]
  rawPlan.retirementActionEligibilityFacts = {
    iraClassifications: donors.map((donor) => ({
      sourceAccountId: asAccountId(`ira-${donor}`), subtype: 'traditional' as const,
      evidenceId: `classification-${donor}`, provenance: { source: 'manual' as const },
    })),
    sepSimpleActivities: [],
    deductibleIraContributions: donors.flatMap((donorPersonId) =>
      Array.from({ length: year - 2024 }, (_, index) => ({
        donorPersonId, taxYear: 2025 + index, amountCents: asUsdCents(0),
        evidenceId: `contribution-${donorPersonId}-${2025 + index}`,
        provenance: { source: 'manual' as const, sourceId: `ledger-${donorPersonId}-${2025 + index}` },
      }))),
  }
  const parsed = parsePlan(rawPlan)
  if (!parsed.ok) throw new Error('invalid Plan fixture')
  const runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = {
    personAliveEvidence: requests.map((entry) => ({
      evidenceId: `alive-${entry.actionId}`, actionId: entry.actionId,
      personId: entry.donorPersonId, actionYear: year,
      actionDate: entry.executionDate ?? null, alive: true,
    })),
    priorQcdOffsetEvidence: requests.map((entry) => ({
      evidenceId: `offset-${entry.actionId}`, actionId: entry.actionId,
      donorPersonId: entry.donorPersonId, actionYear: year,
      actionDate: entry.executionDate ?? null, priorOffsetApplied: asUsdCents(0),
    })),
  }
  const prerequisite = evaluateAnnualQcdExecutionPrerequisites({
    taxYear: year, plan: parsed.plan, requests, runtimeEvidence,
  })
  if (prerequisite.status !== 'evaluated') throw new Error('invalid prerequisite fixture')
  const rmdPools: AnnualQcdRmdPoolOpeningSnapshot[] = donors.map((donor) => ({
    predicate: 'annualQcdOwnedIraRmdPoolOpeningSnapshot', poolId: `rmd-${donor}-${year}`,
    taxYear: year, donorPersonId: donor, scope: 'ownedIra',
    sourceAccountIds: [asAccountId(`ira-${donor}`)],
    rmdRequiredAmount: asUsdCents(0), rmdSatisfiedBefore: asUsdCents(0),
    rmdRemainingBefore: asUsdCents(0), upstreamEvidenceId: `rmd-source-${donor}`,
  }))
  const openingBalances = donors.map((donor) => ({
    accountId: asAccountId(`ira-${donor}`), openingBalance: asUsdCents(requests
      .filter((entry) => entry.donorPersonId === donor)
      .reduce((sum, entry) => sum + entry.requestedAmount, 0)),
  }))
  const poolCapacityInputs = donors.map((donor): ClassifyOwnedNonRothIraAnnualWithdrawalsInput => {
    const physical = requests.filter((entry) => entry.donorPersonId === donor)
      .reduce((sum, entry) => sum + entry.requestedAmount, 0)
    const capacity = options.taxableCapacity?.[donor as 'p1' | 'p2'] ?? 0
    const gross = Math.max(physical, capacity)
    const yearEnd = gross - physical
    return {
      ownerPersonId: donor, ownerWideNonRothIraPoolId: `pool-${donor}-${year}`,
      completePoolEvidence: {
        predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear', ownerPersonId: donor,
        ownerWideNonRothIraPoolId: `pool-${donor}-${year}`, taxYear: year,
        accountIds: [asAccountId(`ira-${donor}`)],
        yearEndApplicablePoolBalanceAmount: asUsdCents(yearEnd),
        evidenceId: `complete-pool-${donor}`,
      },
      annualBasisRecordEvidenceId: `basis-record-${donor}`, taxYear: year,
      poolMembers: [{
        sourceAccountId: asAccountId(`ira-${donor}`), ownerPersonId: donor,
        accountType: 'traditional', accountKind: 'ira', inheritanceStatus: 'owned',
        subtype: 'traditional', yearEndApplicableBalanceAmount: asUsdCents(yearEnd),
        iraClassificationEvidenceId: `tax-classification-${donor}`,
        accountOwnershipEvidenceId: `tax-ownership-${donor}`,
      }],
      annualFacts: {
        openingBasisAmount: asUsdCents(gross - capacity),
        taxYearNondeductibleContributionAmount: asUsdCents(0),
        postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
        yearEndApplicablePoolBalanceAmount: asUsdCents(yearEnd),
        outstandingRolloverAmount: asUsdCents(0), rolloverRepaymentAdjustmentAmount: asUsdCents(0),
        form8606Line7DistributionAmount: asUsdCents(0), form8606Line8NetConversionAmount: asUsdCents(0),
      },
      line7Distributions: [], line8Conversions: [],
    }
  })
  const taxUnit = (members: readonly typeof donors[number][], suffix: string): AnnualQcdItemizedSection170TaxUnitInput => ({
    taxUnit: {
      taxUnitId: `tax-unit-${suffix}`,
      taxUnitMemberPersonIds: members as [typeof donors[number], ...typeof donors[number][]],
      federalFilingStatus: members.length === 2 ? 'marriedFilingJointly' : 'single',
      stateFilingStatusId: members.length === 2 ? 'state-joint' : 'state-single',
      taxUnitEvidenceId: `tax-unit-evidence-${suffix}`, taxYear: year,
    },
    annualTaxLiabilityEvidenceId: `liability-${suffix}`,
    taxInputSnapshotId: `tax-input-${suffix}`,
    liabilityRun: { liabilityRunKind: 'committedAnnual', candidateFundingVectorEvidenceId: null },
    contributionBaseCents: options.contributionBase ?? 10_000,
    priorItemizerFloorAppliedCents: options.priorFloor ?? 0,
    priorCashPercentageLimitUsedCents: options.priorPercentage ?? 0,
    openingPostOtherLimitItemizedDeductionCents: options.openingItemized ?? 500,
    floorCarryforwardEligibility: requests.filter((entry) => members.includes(entry.donorPersonId))
      .map((entry) => ({ actionId: entry.actionId,
        eligible: options.carry?.[entry.actionId] ?? true,
        evidenceId: `carry-${entry.actionId}` })),
  })
  const taxUnits = options.joint
    ? [taxUnit(parsed.plan.household.people.map((person) => asPersonId(person.id)), 'joint')]
    : donors.map((donor) => taxUnit([donor], donor))
  return {
    postPassInput: {
      physicalInput: { prerequisite, plan: parsed.plan, runtimeEvidence, openingBalances, rmdPools },
      poolCapacityInputs,
    },
    taxUnits,
  }
}
function staged(input: StageAnnualQcdItemizedSection170LedgerInput) {
  const result = stageAnnualQcdItemizedSection170Ledger(input)
  expect(result.status).toBe('annualQcdItemizedSection170Staged')
  if (result.status !== 'annualQcdItemizedSection170Staged') throw new Error(result.issues[0].detail)
  return result
}

describe('stageAnnualQcdItemizedSection170Ledger', () => {
  // IRC 170(b)(1)(I)(i) allows a contribution "otherwise allowable (without
  // regard to this subparagraph)" only above 0.5% of the contribution base. The
  // parenthetical excepts only the floor itself, so the 170(b)(1)(G) percentage
  // ceiling applies first and the floor reduces what survives it: min(C, L) - F.
  //
  // This fixture is chosen so the two candidate orderings disagree. Base 10,000c
  // gives a 50c floor and a 6,000c ceiling; 5,500c of prior use leaves 500c of
  // capacity against a 1,000c contribution.
  //   min(C, L) - F = min(1,000, 500) - 50 = 450  <- statute
  //   min(C - F, L) = min(950, 500)        = 500  <- rejected reading
  describeRule('irc-170-b-1-I-floor-ordering', {
    readings: { statute: 450, rejectedFloorBeforeCeiling: 500 },
    accepted: 'statute',
    note: 'The rejected reading survived for a whole chain because the prior fixture returned the same number under both orderings.',
  }, ({ accepted, readings }) => {
    it('claims the post-ceiling amount reduced by the floor', () => {
      const claimed = staged(fixture(undefined, { priorPercentage: 5_500 }))
        .taxUnits[0]!.orderedActionEvidence[0]!.currentYearClaimedDeductionCents
      expect(claimed).toBe(accepted)
      expect(claimed).not.toBe(readings.rejectedFloorBeforeCeiling)
    })
  })

  // IRC 170(b)(1)(G)(i)(II) subtracts contributions already taken into account
  // under (A) from the 60% ceiling, so cash gifts fill only the headroom rather
  // than stacking an independent 60% bucket on top of the 50% limit. Here 5,500c
  // of the 6,000c ceiling is already consumed, leaving 500c against a 1,000c
  // contribution: the combined reading claims 450c after the floor, the
  // independent-bucket reading would claim 950c.
  describeRule('irc-170-b-1-G-cash-percentage-ceiling', {
    readings: { combinedCeilingNetOfCategoryA: 450, independentSixtyPercentBucket: 950 },
    accepted: 'combinedCeilingNetOfCategoryA',
  }, ({ accepted, readings }) => {
    it('fills only the headroom left by contributions already counted', () => {
      const action = staged(fixture(undefined, { priorPercentage: 5_500 }))
        .taxUnits[0]!.orderedActionEvidence[0]!
      expect(action.currentYearClaimedDeductionCents).toBe(accepted)
      expect(action.currentYearClaimedDeductionCents)
        .not.toBe(readings.independentSixtyPercentBucket)
      expect(action.percentageAllowableBeforeFloorCents).toBe(500)
    })
  })

  describeRule('irc-170-d-1-C-floor-carryforward-gate', {
    // Same 50c floor consumed either way; the readings differ on whether it can
    // be carried when the year has no percentage-limit excess.
    readings: { statute: 0, rejectedIndependentCarryover: 50 },
    accepted: 'statute',
  }, ({ accepted, readings }) => {
    it('permanently loses the floor amount when no excess exists to increase', () => {
      const action = staged(fixture(undefined, { carry: { 'qcd-a': false } }))
        .taxUnits[0]!.orderedActionEvidence[0]!
      expect(action.floorCarryforwardCents).toBe(accepted)
      expect(action.floorCarryforwardCents).not.toBe(readings.rejectedIndependentCarryover)
      expect(action.floorPermanentlyDisallowedCents).toBe(50)
    })

    it('refuses to deny the carryforward in a year that does have an excess', () => {
      const blocked = stageAnnualQcdItemizedSection170Ledger(
        fixture(undefined, { priorPercentage: 5_500, carry: { 'qcd-a': false } }),
      )
      expect(blocked.status).toBe('annualQcdItemizedSection170Blocked')
    })
  })

  describeRule('irc-170-b-1-I-ii-category-waterfall', {
    // Cash gifts to public charities are category (G) and absorb the floor
    // sixth. Whether this single-category ledger charges the floor to the QCD
    // depends entirely on the floor the caller reports already consumed by
    // categories (D) through (A).
    readings: { earlierCategoriesAbsorbedIt: 1_000, chargedToCashCategory: 950 },
    accepted: 'earlierCategoriesAbsorbedIt',
  }, ({ accepted, readings }) => {
    it('leaves the cash category unreduced once earlier categories consume the floor', () => {
      const absorbed = staged(fixture(undefined, { priorFloor: 50 }))
        .taxUnits[0]!.orderedActionEvidence[0]!
      expect(absorbed.currentYearClaimedDeductionCents).toBe(accepted)
      expect(absorbed.floorAppliedCents).toBe(0)

      const unabsorbed = staged(fixture(undefined, { priorFloor: 0 }))
        .taxUnits[0]!.orderedActionEvidence[0]!
      expect(unabsorbed.currentYearClaimedDeductionCents).toBe(readings.chargedToCashCategory)
    })
  })

  it('applies the 0.5% floor to the contribution otherwise allowable after the percentage ceiling', () => {
    const result = staged(fixture(undefined, { priorPercentage: 5_500 }))
    const ledger = result.taxUnits[0]!
    expect(ledger).toMatchObject({
      filingTreatment: 'itemized', contributionBaseCents: 10_000,
      itemizerFloorRateNumerator: 1, itemizerFloorRateDenominator: 200,
      itemizerFloorAmountCents: 50, cashPercentageLimitRateNumerator: 3,
      cashPercentageLimitRateDenominator: 5, cashPercentageLimitAmountCents: 6_000,
      exactAmountAuthority: 'cents', residualEvidenceId: result.residualEvidenceId,
    })
    expect(ledger.orderedActionEvidence[0]).toMatchObject({
      treatment: 'evaluated', eligibleContributionCents: 1_000,
      // The ceiling binds first, so 500c is the amount "otherwise allowable";
      // the floor then reduces that rather than the gross contribution.
      percentageAllowableBeforeFloorCents: 500,
      floorAppliedCents: 50, floorCarryforwardCents: 50,
      floorPermanentlyDisallowedCents: 0,
      currentYearClaimedDeductionCents: 450,
      // IRC 170(d)(1)(C): the 50c floor amount rides along with the 500c
      // percentage excess, because an excess exists in this year.
      percentageLimitCarryforwardCents: 500,
      limitationCarryforwardCents: 550,
      unclaimedWithoutCarryforwardCents: 0,
      beforeAction: { cashPercentageLimitCapacityRemainingCents: 500,
        postOtherLimitItemizedDeductionBeforeSection68Cents: 500 },
      // Capacity is consumed by the pre-floor allowable amount, because that is
      // what the ceiling limited — not by the 450c finally claimed.
      afterAction: { cashPercentageLimitCapacityRemainingCents: 0,
        postOtherLimitItemizedDeductionBeforeSection68Cents: 950 },
    })
    expect(result.section68Status).toBe('awaitingSection68Reconciliation')
  })

  it('rounds the half-cent floor once, upward, against the post-ceiling allowable amount', () => {
    // Base 100c makes the floor exactly half a cent, which must round up to 1c.
    // The 60c ceiling binds against the 1,000c contribution, so the amount
    // otherwise allowable is 60c and the claim is 60 - 1 = 59c.
    const result = staged(fixture(undefined, { contributionBase: 100 }))
    expect(result.taxUnits[0]).toMatchObject({
      itemizerFloorAmountCents: 1, cashPercentageLimitAmountCents: 60,
      orderedActionEvidence: [{
        percentageAllowableBeforeFloorCents: 60,
        floorAppliedCents: 1, floorCarryforwardCents: 1,
        floorPermanentlyDisallowedCents: 0,
        currentYearClaimedDeductionCents: 59,
        percentageLimitCarryforwardCents: 940,
        limitationCarryforwardCents: 941, unclaimedWithoutCarryforwardCents: 0,
      }],
    })
  })

  // IRC 170(d)(1)(C) carries the floor-disallowed amount forward only "in the
  // case of any taxable year from which an excess is carried forward
  // (determined without regard to this subparagraph)". With no percentage-limit
  // excess there is nothing to increase, so the floor amount is lost outright.
  it('permanently disallows the floor amount in a year with no percentage-limit excess', () => {
    // Ceiling 6,000c does not bind against the 1,000c contribution, so there is
    // no excess and the 50c consumed by the floor cannot be carried.
    const result = staged(fixture(undefined, { carry: { 'qcd-a': false } }))
    expect(result.taxUnits[0]).toMatchObject({
      orderedActionEvidence: [{
        percentageAllowableBeforeFloorCents: 1_000,
        floorAppliedCents: 50, floorCarryforwardCents: 0,
        floorPermanentlyDisallowedCents: 50,
        currentYearClaimedDeductionCents: 950,
        percentageLimitCarryforwardCents: 0,
        limitationCarryforwardCents: 0, unclaimedWithoutCarryforwardCents: 50,
      }],
    })
  })

  it('rejects denying the floor carryforward in a year that does have a percentage-limit excess', () => {
    // Same denial as above, but the ceiling now binds, so 170(d)(1)(C) requires
    // the floor amount to ride along with the excess. The caller cannot say no.
    const result = stageAnnualQcdItemizedSection170Ledger(
      fixture(undefined, { priorPercentage: 5_500, carry: { 'qcd-a': false } }),
    )
    expect(result.status).toBe('annualQcdItemizedSection170Blocked')
    if (result.status !== 'annualQcdItemizedSection170Blocked') throw new Error('expected refusal')
    expect(result.issues[0]).toMatchObject({ kind: 'taxUnitInvalid' })
    expect(result.issues[0]!.detail).toContain('exceed the percentage limitation')
  })

  it('requires floor carryforward eligibility to agree across a joint tax unit', () => {
    // The 170(d)(1)(C) gate is a year-level determination, so two actions in one
    // tax unit cannot answer it differently.
    const result = stageAnnualQcdItemizedSection170Ledger(fixture([
      { id: 'qcd-a', donor: 'p1', amount: 500, date: '2026-03-01', sequence: 1 },
      { id: 'qcd-b', donor: 'p2', amount: 500, date: '2026-09-01', sequence: 2 },
    ], { joint: true, carry: { 'qcd-a': true, 'qcd-b': false } }))
    expect(result.status).toBe('annualQcdItemizedSection170Blocked')
    if (result.status !== 'annualQcdItemizedSection170Blocked') throw new Error('expected refusal')
    expect(result.issues[0]!.detail).toContain('year-level determination')
  })

  it('shares floor and cash-cap state across joint spouses in canonical chronology', () => {
    const result = staged(fixture([
      { id: 'later-p1', donor: 'p1', amount: 500, date: '2026-09-01', sequence: 2 },
      { id: 'earlier-p2', donor: 'p2', amount: 500, date: '2026-03-01', sequence: 1 },
    ], { joint: true, contributionBase: 1_000, priorFloor: 5 }))
    const actions = result.taxUnits[0]!.orderedActionEvidence
    expect(actions.map((entry) => entry.actionId)).toEqual(['earlier-p2', 'later-p1'])
    expect(actions[0]).toMatchObject({
      currentYearClaimedDeductionCents: 500,
      afterAction: { cashPercentageLimitCapacityRemainingCents: 100 },
    })
    expect(actions[1]).toMatchObject({
      beforeAction: { cashPercentageLimitCapacityRemainingCents: 100 },
      currentYearClaimedDeductionCents: 100, percentageLimitCarryforwardCents: 400,
      afterAction: { cashPercentageLimitCapacityRemainingCents: 0 },
    })
    expect(actions[1]!.beforeAction).toBe(actions[0]!.afterAction)
  })

  it('owns only the supplied tax-unit action subset', () => {
    const input = fixture([{ id: 'p1-qcd', donor: 'p1', amount: 100, date: '2026-06-01' }, { id: 'p2-qcd', donor: 'p2', amount: 100, date: '2026-07-01' }])
    Object.assign(input, { taxUnits: [input.taxUnits[0]!] })
    expect(staged(input).taxUnits[0]!.orderedActionEvidence.map((entry) => entry.actionId)).toEqual(['p1-qcd'])
    expect(staged(fixture(undefined, { joint: true })).taxUnits[0]!.taxUnit.taxUnitMemberPersonIds).toEqual(['p1', 'p2'])
  })

  it('emits a literal zero treatment while preserving the authoritative source run', () => {
    const result = staged(fixture(undefined, { taxableCapacity: { p1: 1_000 } }))
    expect(result.taxUnits[0]!.orderedActionEvidence[0]).toMatchObject({
      treatment: 'notApplicable', eligibleContributionCents: 0,
      floorAppliedCents: 0, currentYearClaimedDeductionCents: 0,
      limitationCarryforwardCents: 0, unclaimedWithoutCarryforwardCents: 0,
    })
  })

  it('binds run and tax-input identities deterministically and freezes the result', () => {
    const input = fixture()
    const before = structuredClone(input)
    const committed = staged(input)
    const repeat = staged(input)
    const t1Input = fixture()
    Object.assign(t1Input.taxUnits[0]!, { liabilityRun: {
      liabilityRunKind: 'candidateT1', candidateFundingVectorEvidenceId: 'funding-1',
    } })
    const t1 = staged(t1Input)
    const liabilityInput = fixture()
    Object.assign(liabilityInput.taxUnits[0]!, { annualTaxLiabilityEvidenceId: 'liability-other' })
    const liability = staged(liabilityInput)
    expect(input).toEqual(before)
    expect(repeat.taxUnits[0]!.evidenceId).toBe(committed.taxUnits[0]!.evidenceId)
    expect(t1.taxUnits[0]!.evidenceId).not.toBe(committed.taxUnits[0]!.evidenceId)
    expect(liability.taxUnits[0]!.orderedActionEvidence[0]!.actionEvidenceId)
      .not.toBe(committed.taxUnits[0]!.orderedActionEvidence[0]!.actionEvidenceId)
    expect(Object.isFrozen(committed)).toBe(true)
    expect(Object.isFrozen(committed.taxUnits[0]!.orderedActionEvidence[0]!.beforeAction)).toBe(true)
  })

  it.each([
    ['taxUnitInvalid', (input: StageAnnualQcdItemizedSection170LedgerInput) => { Object.assign(input.taxUnits[0]!, { floorCarryforwardEligibility: [] }) }],
    ['taxUnitInvalid', (input: StageAnnualQcdItemizedSection170LedgerInput) => { Object.assign(input.taxUnits[0]!, { contributionBaseCents: -1 }) }],
    ['taxUnitInvalid', (input: StageAnnualQcdItemizedSection170LedgerInput) => { Object.assign(input.taxUnits[0]!.taxUnit, { taxYear: 2027 }) }],
    ['taxUnitInvalid', (input: StageAnnualQcdItemizedSection170LedgerInput) => { Object.assign(input.taxUnits[0]!, { liabilityRun: { liabilityRunKind: 'candidateT1', candidateFundingVectorEvidenceId: '' } }) }],
    ['ledgerInvalid', (input: StageAnnualQcdItemizedSection170LedgerInput) => { Object.assign(input.taxUnits[0]!, { priorCashPercentageLimitUsedCents: 6_001 }) }],
    ['taxUnitInvalid', (input: StageAnnualQcdItemizedSection170LedgerInput) => { Object.assign(input.taxUnits[0]!.taxUnit, { taxUnitMemberPersonIds: [asPersonId('p1'), asPersonId('p1')] }) }],
    ['taxUnitInvalid', (input: StageAnnualQcdItemizedSection170LedgerInput) => { Object.assign(input.taxUnits[0]!.taxUnit, { taxUnitMemberPersonIds: [asPersonId('foreign'), asPersonId('p1')] }) }],
  ] as const)('fails closed with %s evidence', (kind, mutate) => {
    const input = fixture() as unknown as StageAnnualQcdItemizedSection170LedgerInput
    mutate(input)
    expect(stageAnnualQcdItemizedSection170Ledger(input)).toMatchObject({
      status: 'annualQcdItemizedSection170Blocked', issues: [{ kind }],
    })
  })

  it('fails closed on hostile input without publishing partial ledgers', () => {
    const result = stageAnnualQcdItemizedSection170Ledger(
      new Proxy(fixture(), {}) as StageAnnualQcdItemizedSection170LedgerInput,
    )
    expect(result).toMatchObject({
      status: 'annualQcdItemizedSection170Blocked', taxUnits: [],
      issues: [{ kind: 'hostileInput' }],
    })
  })
})
