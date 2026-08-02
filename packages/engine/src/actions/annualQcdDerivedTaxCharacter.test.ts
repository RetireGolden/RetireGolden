import { describe, expect, it } from 'vitest'
import { parsePlan } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import type { RetirementActionEligibilityRuntimeEvidence } from '../strategies/accountEligibility.js'
import type { AnnualQcdItemizedLiabilitySourceInput } from './annualQcdItemizedLiabilityReconciliation.js'
import type { AnnualQcdItemizedSection170TaxUnitInput, StageAnnualQcdItemizedSection170LedgerInput } from './annualQcdItemizedSection170Ledger.js'
import type { QualifiedCharitableDistributionRequest } from './contract.js'
import { finalizeAnnualQcdDerivedTaxCharacter } from './annualQcdDerivedTaxCharacter.js'
import type { CoordinateAnnualQcdDeductionTreatmentInput } from './annualQcdDeductionTreatmentCoordinator.js'
import { asAccountId, asActionId, asAllocationId, asPersonId } from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { evaluateAnnualQcdExecutionPrerequisites } from './annualQcdExecutionPrerequisite.js'
import type { AnnualQcdRmdPoolOpeningSnapshot } from './annualQcdPhysicalExecution.js'
import type { ClassifyOwnedNonRothIraAnnualWithdrawalsInput } from './ownedNonRothIraWithdrawalCharacter.js'

interface Spec { id: string; amount: number; date: string; sequence?: number }
interface Options { taxableCapacity?: number; base?: number; openingBalance?: number; subtype?: 'traditional' | 'sep' | 'simple'; activityYear?: number; employerContribution?: boolean }
const donor = asPersonId('p1'); const source = asAccountId('ira-p1'); const year = 2026
const charity = { designationId: 'public-charity', name: 'Public charity', designationKind: 'eligiblePublicCharity' as const,
  directFromCustodianAttested: true, eligibleOrganizationAttested: true,
  notDonorAdvisedFundOrSupportingOrganizationAttested: true, notSplitInterestEntityAttested: true,
  entireDistributionOtherwiseDeductibleAttested: true }
function request(spec: Spec): QualifiedCharitableDistributionRequest {
  return { actionId: asActionId(spec.id), kind: 'qcd', year, executionDate: spec.date, executionSequence: spec.sequence ?? 1,
    requestedAmount: asPositiveUsdCents(spec.amount), provenance: { source: 'manual' }, donorPersonId: donor,
    allocation: { allocationId: asAllocationId(`allocation-${spec.id}`), sourceAccountId: source, requestedAmount: asPositiveUsdCents(spec.amount) },
    charity: { ...charity, designationId: `charity-${spec.id}` } }
}
function ledgerFixture(specs: readonly Spec[], options: Options): StageAnnualQcdItemizedSection170LedgerInput {
  const requests = specs.map(request); const rawPlan = singlePersonPlan({ dob: '1955-01-31', planningAge: 90 })
  rawPlan.accounts = [traditionalAccount('ira-p1', 1_000_000, 'p1')]; rawPlan.strategies.retirementActions = [...requests]
  const subtype = options.subtype ?? 'traditional'; const activityYear = options.activityYear ?? year
  const classification = subtype === 'simple' ? { sourceAccountId: source, subtype, simpleParticipationStartDate: '2020-01-01', evidenceId: 'classification-p1', provenance: { source: 'manual' as const } }
    : { sourceAccountId: source, subtype, evidenceId: 'classification-p1', provenance: { source: 'manual' as const } }
  rawPlan.retirementActionEligibilityFacts = { iraClassifications: [classification], sepSimpleActivities: subtype === 'traditional' ? [] : [{ sourceAccountId: source,
    actionTaxYear: activityYear, planYearEndDate: `${activityYear}-12-31`, employerContributionMadeForPlanYear: options.employerContribution ?? false,
    evidenceId: `activity-${activityYear}`, provenance: { source: 'manual' } }], deductibleIraContributions: [{ donorPersonId: donor, taxYear: 2025, amountCents: asUsdCents(0), evidenceId: 'contribution-2025', provenance: { source: 'manual', sourceId: 'ledger-2025' } },
      { donorPersonId: donor, taxYear: year, amountCents: asUsdCents(0), evidenceId: 'contribution-2026', provenance: { source: 'manual', sourceId: 'ledger-2026' } }] }
  const parsed = parsePlan(rawPlan); if (!parsed.ok) throw new Error('invalid fixture Plan')
  const runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = { personAliveEvidence: requests.map((entry) => ({ evidenceId: `alive-${entry.actionId}`,
    actionId: entry.actionId, personId: donor, actionYear: year, actionDate: entry.executionDate ?? null, alive: true })),
  priorQcdOffsetEvidence: requests.map((entry) => ({ evidenceId: `offset-${entry.actionId}`, actionId: entry.actionId, donorPersonId: donor,
    actionYear: year, actionDate: entry.executionDate ?? null, priorOffsetApplied: asUsdCents(0) })) }
  const prerequisite = evaluateAnnualQcdExecutionPrerequisites({ taxYear: year, plan: parsed.plan, requests, runtimeEvidence })
  if (prerequisite.status !== 'evaluated') throw new Error('invalid prerequisite fixture')
  const rmdPools: AnnualQcdRmdPoolOpeningSnapshot[] = [{ predicate: 'annualQcdOwnedIraRmdPoolOpeningSnapshot', poolId: 'rmd-p1-2026', taxYear: year,
    donorPersonId: donor, scope: 'ownedIra', sourceAccountIds: [source], rmdRequiredAmount: asUsdCents(0), rmdSatisfiedBefore: asUsdCents(0),
    rmdRemainingBefore: asUsdCents(0), upstreamEvidenceId: 'rmd-source-p1' }]
  const requested = requests.reduce((sum, entry) => sum + entry.requestedAmount, 0); const physical = options.openingBalance ?? requested
  const capacity = options.taxableCapacity ?? 0; const gross = Math.max(physical, capacity); const yearEnd = gross - physical
  const poolCapacityInputs: ClassifyOwnedNonRothIraAnnualWithdrawalsInput[] = [{ ownerPersonId: donor, ownerWideNonRothIraPoolId: 'pool-p1-2026',
    completePoolEvidence: { predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear', ownerPersonId: donor, ownerWideNonRothIraPoolId: 'pool-p1-2026', taxYear: year,
      accountIds: [source], yearEndApplicablePoolBalanceAmount: asUsdCents(yearEnd), evidenceId: 'complete-pool-p1' }, annualBasisRecordEvidenceId: 'basis-p1', taxYear: year,
    poolMembers: [{ sourceAccountId: source, ownerPersonId: donor, accountType: 'traditional', accountKind: 'ira', inheritanceStatus: 'owned', subtype: 'traditional',
      yearEndApplicableBalanceAmount: asUsdCents(yearEnd), iraClassificationEvidenceId: 'tax-class-p1', accountOwnershipEvidenceId: 'owner-p1' }],
    annualFacts: { openingBasisAmount: asUsdCents(gross - capacity), taxYearNondeductibleContributionAmount: asUsdCents(0), postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
      yearEndApplicablePoolBalanceAmount: asUsdCents(yearEnd), outstandingRolloverAmount: asUsdCents(0), rolloverRepaymentAdjustmentAmount: asUsdCents(0),
      form8606Line7DistributionAmount: asUsdCents(0), form8606Line8NetConversionAmount: asUsdCents(0) }, line7Distributions: [], line8Conversions: [] }]
  const taxUnit: AnnualQcdItemizedSection170TaxUnitInput = { taxUnit: { taxUnitId: 'tax-unit-p1', taxUnitMemberPersonIds: [donor], federalFilingStatus: 'single',
    stateFilingStatusId: 'state-p1', taxUnitEvidenceId: 'tax-unit-evidence-p1', taxYear: year }, annualTaxLiabilityEvidenceId: 'liability-p1',
    taxInputSnapshotId: 'tax-input-p1', liabilityRun: { liabilityRunKind: 'committedAnnual', candidateFundingVectorEvidenceId: null },
    contributionBaseCents: options.base ?? 100_000_000, priorItemizerFloorAppliedCents: 0, priorCashPercentageLimitUsedCents: 0,
    openingPostOtherLimitItemizedDeductionCents: 500, floorCarryforwardEligibility: requests.map((entry) => ({ actionId: entry.actionId, eligible: true, evidenceId: `carry-${entry.actionId}` })) }
  return { postPassInput: { physicalInput: { prerequisite, plan: parsed.plan, runtimeEvidence,
    openingBalances: [{ accountId: source, openingBalance: asUsdCents(physical) }], rmdPools }, poolCapacityInputs }, taxUnits: [taxUnit] }
}
function itemizedSource(unit: Readonly<AnnualQcdItemizedSection170TaxUnitInput>): AnnualQcdItemizedLiabilitySourceInput {
  return { taxUnitId: unit.taxUnit.taxUnitId, taxYear: year, filingStatus: 'single', annualTaxLiabilityEvidenceId: unit.annualTaxLiabilityEvidenceId,
    taxInputSnapshotId: unit.taxInputSnapshotId, liabilityRun: unit.liabilityRun, adjustedGrossIncomeBeforeCharitableDeductionCents: 100_000_000,
    qualifiedBusinessIncomeDeductionCents: 0, qualifiedBusinessIncomeComputedWithoutSection68: true, additionalSchedule1ADeductionCents: 0,
    standardDeductionCents: 1_500_000, selectedFilingTreatment: 'itemized', selectedItemizationEvidenceId: 'itemization-p1', adjustedGrossIncomeEvidenceId: 'agi-p1',
    qualifiedBusinessIncomeEvidenceId: 'qbi-p1', additionalSchedule1AEvidenceId: 'schedule1a-p1', standardDeductionEvidenceId: 'standard-p1',
    section170SourceBindings: { contributionBaseEvidenceId: 'base-p1', priorFloorUseEvidenceId: 'floor-p1', priorCashPercentageUseEvidenceId: 'cash-p1',
      openingItemizedDeductionEvidenceId: 'opening-p1' } }
}
function fixture(specs: readonly Spec[] = [{ id: 'qcd-a', amount: 1_000, date: '2026-08-01' }], options: Options = {}): CoordinateAnnualQcdDeductionTreatmentInput {
  const ledger = ledgerFixture(specs, options); return { postPassInput: ledger.postPassInput, itemizedTaxUnits: ledger.taxUnits,
    itemizedLiabilitySources: ledger.taxUnits.map(itemizedSource), standardTaxUnits: [] }
}
function finalized(input: CoordinateAnnualQcdDeductionTreatmentInput) {
  const result = finalizeAnnualQcdDerivedTaxCharacter(input)
  expect(result.status).toBe('annualQcdDerivedTaxCharacterFinal')
  if (result.status !== 'annualQcdDerivedTaxCharacterFinal') throw new Error(result.issues[0].detail)
  return result
}

describe('finalizeAnnualQcdDerivedTaxCharacter', () => {
  it('publishes the exact ordered three-way post-pass partition with containing-action and accepted-source evidence', () => {
    const result = finalized(fixture([{ id: 'three-way', amount: 13_100_000, date: '2026-08-01' }], { taxableCapacity: 12_000_000 }))
    const action = result.actions[0]!
    expect(action.derivedTaxCharacter.map((entry) => [entry.kind, entry.amountCents, entry.characterEvidence.component]))
      .toEqual([['qcdIncomeExclusion', 11_100_000, 'excludableQcdAmount'], ['ordinaryIncome', 900_000, 'taxableQcdAmount'], ['basisReturn', 1_100_000, 'nonQcdCharitableRemainder']])
    expect(action.derivedTaxCharacter.every((entry) => entry.amountCents === entry.characterEvidence.segmentAmountCents && entry.characterEvidence.qcdActionId === action.actionId &&
      entry.characterEvidence.allocationId === action.allocationId && entry.sourceAccountId === action.acceptedSourceEligibility.sourceIraAccountId && entry.sourceClass === 'qcd')).toBe(true)
    expect(action.acceptedSourceEligibility).toEqual({ sourceIraAccountId: source, donorPersonId: donor, ownershipKind: 'owned', iraSubtype: 'traditional',
      sepSimpleActivity: { applicability: 'notApplicable' } })
    expect(action.residualRemainderBinding).toMatchObject({ postPassApplicationEvidenceId: action.postPassApplication.evidenceId,
      allocation: { actionId: action.actionId, allocationId: action.allocationId, sourceAccountId: source, grossAmount: 1_100_000, allocatedBasisAmount: 1_100_000, taxableAmount: 0 } })
    expect(result).toMatchObject({ committed: false, movement: 'notCommitted', publicationStatus: 'notOwnedByDerivedTaxCharacter', exactAmountAuthority: 'cents' })
  })

  it('omits literal-zero arms, emits only ordinary income after the personal limit, and emits an empty tuple for zero movement', () => {
    const mixed = finalized(fixture([{ id: 'limit', amount: 11_100_000, date: '2026-03-01' }, { id: 'taxable', amount: 1_000, date: '2026-08-01' }], { taxableCapacity: 11_101_000 }))
    expect(mixed.actions.map((action) => action.derivedTaxCharacter.map((entry) => entry.kind))).toEqual([['qcdIncomeExclusion'], ['ordinaryIncome']])
    const zero = finalized(fixture(undefined, { openingBalance: 0, taxableCapacity: 0 }))
    expect(zero.actions[0]).toMatchObject({ status: 'notApplicableZeroMovement', derivedTaxCharacter: [], residualRemainderBinding: null })
  })

  it('emits basis return only for a wholly non-QCD charitable remainder', () => {
    const action = finalized(fixture()).actions[0]!
    expect(action.derivedTaxCharacter).toMatchObject([{ kind: 'basisReturn', amountCents: 1_000,
      characterEvidence: { component: 'nonQcdCharitableRemainder', residualRemainderBindingEvidenceId: action.residualRemainderBinding?.bindingEvidenceId } }])
  })

  it.each(['sep', 'simple'] as const)('normalizes accepted %s evidence and rejects employer-active or wrong-year activity', (subtype) => {
    const accepted = finalized(fixture(undefined, { subtype })).actions[0]!
    expect(accepted.acceptedSourceEligibility).toEqual({ sourceIraAccountId: source, donorPersonId: donor, ownershipKind: 'owned', iraSubtype: subtype,
      sepSimpleActivity: { applicability: 'evaluated', taxYear: year, planYearEndDate: '2026-12-31', employerContributionMadeForPlanYear: false, evidenceId: 'activity-2026' } })
    expect(finalizeAnnualQcdDerivedTaxCharacter(fixture(undefined, { subtype, employerContribution: true })))
      .toMatchObject({ status: 'annualQcdDerivedTaxCharacterBlocked', actions: [], issues: [{ kind: 'sourceInvalid' }] })
    expect(finalizeAnnualQcdDerivedTaxCharacter(fixture(undefined, { subtype, activityYear: 2025 })))
      .toMatchObject({ status: 'annualQcdDerivedTaxCharacterBlocked', actions: [], issues: [{ kind: 'sourceInvalid' }] })
  })

  it('is deterministic, immutable, recursively frozen, and hostile-input closed', () => {
    const input = fixture(); const before = structuredClone(input); const first = finalized(input); const repeat = finalized(input)
    expect(input).toEqual(before); expect(repeat.evidenceId).toBe(first.evidenceId); expect(Object.isFrozen(first.actions[0]!.acceptedSourceEligibility)).toBe(true)
    expect(Object.isFrozen(first.actions[0]!.derivedTaxCharacter[0]!.characterEvidence)).toBe(true)
    const chronologyDrift = structuredClone(fixture()); Object.assign(chronologyDrift.postPassInput.physicalInput.prerequisite.evidence[0]!.eligibility.schedule, { scheduledSequence: 2 })
    expect(finalizeAnnualQcdDerivedTaxCharacter(chronologyDrift)).toMatchObject({ status: 'annualQcdDerivedTaxCharacterBlocked', actions: [], issues: [{ kind: 'physicalInvalid' }] })
    expect(finalizeAnnualQcdDerivedTaxCharacter(new Proxy(input, {}) as CoordinateAnnualQcdDeductionTreatmentInput))
      .toMatchObject({ status: 'annualQcdDerivedTaxCharacterBlocked', actions: [], evidenceId: null, issues: [{ kind: 'hostileInput' }] })
  })
})
