import { describe, expect, it } from 'vitest'
import { parsePlan } from '../model/plan.js'
import { couplePlan, singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import type { RetirementActionEligibilityRuntimeEvidence } from '../strategies/accountEligibility.js'
import type { AnnualQcdItemizedLiabilitySourceInput } from './annualQcdItemizedLiabilityReconciliation.js'
import type { AnnualQcdItemizedSection170TaxUnitInput, StageAnnualQcdItemizedSection170LedgerInput } from './annualQcdItemizedSection170Ledger.js'
import type { QualifiedCharitableDistributionRequest } from './contract.js'
import { asAccountId, asActionId, asAllocationId, asPersonId } from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { evaluateAnnualQcdExecutionPrerequisites } from './annualQcdExecutionPrerequisite.js'
import type { AnnualQcdRmdPoolOpeningSnapshot } from './annualQcdPhysicalExecution.js'
import {
  coordinateAnnualQcdDeductionTreatment,
  type CoordinateAnnualQcdDeductionTreatmentInput,
} from './annualQcdDeductionTreatmentCoordinator.js'
import type { AnnualQcdStandardSection170pTaxUnitInput } from './annualQcdStandardSection170pLedger.js'
import type { ClassifyOwnedNonRothIraAnnualWithdrawalsInput } from './ownedNonRothIraWithdrawalCharacter.js'

interface Spec { id: string; donor?: 'p1' | 'p2'; amount: number; date: string; sequence?: number }
interface Options { year?: number; taxableCapacity?: Partial<Record<'p1' | 'p2', number>>; joint?: boolean; base?: number; priorFloor?: number; priorCash?: number; opening?: number; carry?: Record<string, boolean> }
const charity = { designationId: 'public-charity', name: 'Public charity', designationKind: 'eligiblePublicCharity' as const,
  directFromCustodianAttested: true, eligibleOrganizationAttested: true,
  notDonorAdvisedFundOrSupportingOrganizationAttested: true, notSplitInterestEntityAttested: true,
  entireDistributionOtherwiseDeductibleAttested: true }
function request(spec: Spec, year: number): QualifiedCharitableDistributionRequest {
  const donor = spec.donor ?? 'p1'
  return { actionId: asActionId(spec.id), kind: 'qcd', year, executionDate: spec.date, executionSequence: spec.sequence ?? 1,
    requestedAmount: asPositiveUsdCents(spec.amount), provenance: { source: 'manual' }, donorPersonId: asPersonId(donor),
    allocation: { allocationId: asAllocationId(`allocation-${spec.id}`), sourceAccountId: asAccountId(`ira-${donor}`), requestedAmount: asPositiveUsdCents(spec.amount) },
    charity: { ...charity, designationId: `charity-${spec.id}` } }
}
function ledgerFixture(specs: readonly Spec[], options: Options = {}): StageAnnualQcdItemizedSection170LedgerInput {
  const year = options.year ?? 2026; const requests = specs.map((spec) => request(spec, year))
  const donors = [...new Set(requests.map((entry) => entry.donorPersonId))].sort()
  const rawPlan = options.joint || donors.includes(asPersonId('p2'))
    ? couplePlan({ p1Dob: '1955-01-31', p2Dob: '1955-01-31', p1PlanningAge: 90, p2PlanningAge: 90 }) : singlePersonPlan({ dob: '1955-01-31', planningAge: 90 })
  rawPlan.accounts = donors.map((donor) => traditionalAccount(`ira-${donor}`, 1_000_000, donor)); rawPlan.strategies.retirementActions = [...requests]
  rawPlan.retirementActionEligibilityFacts = { iraClassifications: donors.map((donor) => ({ sourceAccountId: asAccountId(`ira-${donor}`), subtype: 'traditional' as const,
    evidenceId: `classification-${donor}`, provenance: { source: 'manual' as const } })), sepSimpleActivities: [], deductibleIraContributions: donors.flatMap((donorPersonId) =>
    Array.from({ length: year - 2024 }, (_, index) => ({ donorPersonId, taxYear: 2025 + index, amountCents: asUsdCents(0), evidenceId: `contribution-${donorPersonId}-${2025 + index}`,
      provenance: { source: 'manual' as const, sourceId: `ledger-${donorPersonId}-${2025 + index}` } }))) }
  const parsed = parsePlan(rawPlan); if (!parsed.ok) throw new Error('invalid fixture Plan')
  const runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = { personAliveEvidence: requests.map((entry) => ({ evidenceId: `alive-${entry.actionId}`, actionId: entry.actionId,
    personId: entry.donorPersonId, actionYear: year, actionDate: entry.executionDate ?? null, alive: true })), priorQcdOffsetEvidence: requests.map((entry) => ({
      evidenceId: `offset-${entry.actionId}`, actionId: entry.actionId, donorPersonId: entry.donorPersonId, actionYear: year,
      actionDate: entry.executionDate ?? null, priorOffsetApplied: asUsdCents(0) })) }
  const prerequisite = evaluateAnnualQcdExecutionPrerequisites({ taxYear: year, plan: parsed.plan, requests, runtimeEvidence })
  if (prerequisite.status !== 'evaluated') throw new Error('invalid prerequisite fixture')
  const rmdPools: AnnualQcdRmdPoolOpeningSnapshot[] = donors.map((donor) => ({ predicate: 'annualQcdOwnedIraRmdPoolOpeningSnapshot', poolId: `rmd-${donor}-${year}`,
    taxYear: year, donorPersonId: donor, scope: 'ownedIra', sourceAccountIds: [asAccountId(`ira-${donor}`)], rmdRequiredAmount: asUsdCents(0), rmdSatisfiedBefore: asUsdCents(0),
    rmdRemainingBefore: asUsdCents(0), upstreamEvidenceId: `rmd-source-${donor}` }))
  const openingBalances = donors.map((donor) => ({ accountId: asAccountId(`ira-${donor}`), openingBalance: asUsdCents(requests
    .filter((entry) => entry.donorPersonId === donor).reduce((sum, entry) => sum + entry.requestedAmount, 0)) }))
  const poolCapacityInputs = donors.map((donor): ClassifyOwnedNonRothIraAnnualWithdrawalsInput => {
    const physical = requests.filter((entry) => entry.donorPersonId === donor).reduce((sum, entry) => sum + entry.requestedAmount, 0)
    const capacity = options.taxableCapacity?.[donor as 'p1' | 'p2'] ?? 0; const gross = Math.max(physical, capacity); const yearEnd = gross - physical
    return { ownerPersonId: donor, ownerWideNonRothIraPoolId: `pool-${donor}-${year}`, completePoolEvidence: { predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
      ownerPersonId: donor, ownerWideNonRothIraPoolId: `pool-${donor}-${year}`, taxYear: year, accountIds: [asAccountId(`ira-${donor}`)],
      yearEndApplicablePoolBalanceAmount: asUsdCents(yearEnd), evidenceId: `complete-pool-${donor}` }, annualBasisRecordEvidenceId: `basis-${donor}`, taxYear: year,
      poolMembers: [{ sourceAccountId: asAccountId(`ira-${donor}`), ownerPersonId: donor, accountType: 'traditional', accountKind: 'ira', inheritanceStatus: 'owned', subtype: 'traditional',
        yearEndApplicableBalanceAmount: asUsdCents(yearEnd), iraClassificationEvidenceId: `tax-class-${donor}`, accountOwnershipEvidenceId: `owner-${donor}` }],
      annualFacts: { openingBasisAmount: asUsdCents(gross - capacity), taxYearNondeductibleContributionAmount: asUsdCents(0), postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
        yearEndApplicablePoolBalanceAmount: asUsdCents(yearEnd), outstandingRolloverAmount: asUsdCents(0), rolloverRepaymentAdjustmentAmount: asUsdCents(0),
        form8606Line7DistributionAmount: asUsdCents(0), form8606Line8NetConversionAmount: asUsdCents(0) }, line7Distributions: [], line8Conversions: [] }
  })
  const taxUnit = (members: readonly typeof donors[number][], suffix: string): AnnualQcdItemizedSection170TaxUnitInput => ({ taxUnit: { taxUnitId: `tax-unit-${suffix}`,
    taxUnitMemberPersonIds: members as [typeof donors[number], ...typeof donors[number][]], federalFilingStatus: members.length === 2 ? 'marriedFilingJointly' : 'single',
    stateFilingStatusId: `state-${suffix}`, taxUnitEvidenceId: `tax-unit-evidence-${suffix}`, taxYear: year }, annualTaxLiabilityEvidenceId: `liability-${suffix}`,
    taxInputSnapshotId: `tax-input-${suffix}`, liabilityRun: { liabilityRunKind: 'committedAnnual', candidateFundingVectorEvidenceId: null },
    contributionBaseCents: options.base ?? 10_000, priorItemizerFloorAppliedCents: options.priorFloor ?? 0, priorCashPercentageLimitUsedCents: options.priorCash ?? 0,
    openingPostOtherLimitItemizedDeductionCents: options.opening ?? 500, floorCarryforwardEligibility: requests.filter((entry) => members.includes(entry.donorPersonId))
      .map((entry) => ({ actionId: entry.actionId, eligible: options.carry?.[entry.actionId] ?? true, evidenceId: `carry-${entry.actionId}` })) })
  const members = options.joint ? parsed.plan.household.people.map((person) => asPersonId(person.id)) : donors
  return { postPassInput: { physicalInput: { prerequisite, plan: parsed.plan, runtimeEvidence, openingBalances, rmdPools }, poolCapacityInputs },
    taxUnits: options.joint ? [taxUnit(members, 'joint')] : donors.map((donor) => taxUnit([donor], donor)) }
}

function itemizedSource(unit: Readonly<AnnualQcdItemizedSection170TaxUnitInput>): AnnualQcdItemizedLiabilitySourceInput {
  return { taxUnitId: unit.taxUnit.taxUnitId, taxYear: 2026, filingStatus: unit.taxUnit.federalFilingStatus,
    annualTaxLiabilityEvidenceId: unit.annualTaxLiabilityEvidenceId, taxInputSnapshotId: unit.taxInputSnapshotId,
    liabilityRun: unit.liabilityRun, adjustedGrossIncomeBeforeCharitableDeductionCents: 1_000_000,
    qualifiedBusinessIncomeDeductionCents: 0, qualifiedBusinessIncomeComputedWithoutSection68: true,
    additionalSchedule1ADeductionCents: 0, standardDeductionCents: 1_500_000,
    selectedFilingTreatment: 'itemized', selectedItemizationEvidenceId: `itemization-${unit.taxUnit.taxUnitId}`,
    adjustedGrossIncomeEvidenceId: `agi-${unit.taxUnit.taxUnitId}`, qualifiedBusinessIncomeEvidenceId: `qbi-${unit.taxUnit.taxUnitId}`,
    additionalSchedule1AEvidenceId: `schedule1a-${unit.taxUnit.taxUnitId}`, standardDeductionEvidenceId: `standard-${unit.taxUnit.taxUnitId}`,
    section170SourceBindings: { contributionBaseEvidenceId: `base-${unit.taxUnit.taxUnitId}`,
      priorFloorUseEvidenceId: `floor-${unit.taxUnit.taxUnitId}`, priorCashPercentageUseEvidenceId: `cash-${unit.taxUnit.taxUnitId}`,
      openingItemizedDeductionEvidenceId: `opening-${unit.taxUnit.taxUnitId}` } }
}
function standardUnit(unit: Readonly<AnnualQcdItemizedSection170TaxUnitInput>): AnnualQcdStandardSection170pTaxUnitInput {
  const id = unit.taxUnit.taxUnitId
  return { taxUnit: unit.taxUnit, annualTaxLiabilityEvidenceId: unit.annualTaxLiabilityEvidenceId,
    taxInputSnapshotId: unit.taxInputSnapshotId, liabilityRun: unit.liabilityRun,
    sourceTaxYears: { standardDeduction: 2026, priorQualifyingCashContributions: 2026, cashPercentageLimit: 2026 },
    sourceTaxUnitIds: { standardDeduction: id, priorQualifyingCashContributions: id, cashPercentageLimit: id },
    adjustedGrossIncomeBeforeCharitableDeductionCents: 1_000_000, unchangedItemizedDeductionCents: unit.openingPostOtherLimitItemizedDeductionCents,
    standardDeductionCents: 1_500_000, selectedStandardDeductionEvidenceId: `standard-${id}`,
    contributionBaseCents: unit.contributionBaseCents, contributionBaseEvidenceId: `base-${id}`,
    priorQualifyingCashContributionUsedCents: 0, priorQualifyingCashContributionEvidenceId: `prior-${id}`,
    priorCashPercentageLimitUsedCents: unit.priorCashPercentageLimitUsedCents, cashPercentageLimitEvidenceId: `cash-${id}` }
}
function fixture(specs: readonly Spec[] = [{ id: 'qcd-a', amount: 1_000, date: '2026-08-01' }],
  options: Options = {}, itemizedIds: readonly string[] = ['tax-unit-p1']): CoordinateAnnualQcdDeductionTreatmentInput {
  const ledger = ledgerFixture(specs, options); const selected = new Set(itemizedIds)
  const itemizedTaxUnits = ledger.taxUnits.filter((unit) => selected.has(unit.taxUnit.taxUnitId))
  const standardTaxUnits = ledger.taxUnits.filter((unit) => !selected.has(unit.taxUnit.taxUnitId)).map(standardUnit)
  return { postPassInput: ledger.postPassInput, itemizedTaxUnits,
    itemizedLiabilitySources: itemizedTaxUnits.map(itemizedSource), standardTaxUnits }
}
function coordinated(input: CoordinateAnnualQcdDeductionTreatmentInput) {
  const result = coordinateAnnualQcdDeductionTreatment(input)
  expect(result.status).toBe('annualQcdDeductionTreatmentCoordinated')
  if (result.status !== 'annualQcdDeductionTreatmentCoordinated') throw new Error(result.issues[0].detail)
  return result
}

describe('coordinateAnnualQcdDeductionTreatment', () => {
  it('selects a disjoint complete mixed-treatment union from one post-pass', () => {
    const result = coordinated(fixture([
      { id: 'itemized', donor: 'p1', amount: 1_000, date: '2026-03-01' },
      { id: 'standard', donor: 'p2', amount: 1_000, date: '2026-08-01' },
    ]))
    expect(result.taxUnits.map((unit) => unit.filingTreatment)).toEqual(['itemized', 'standardDeduction'])
    expect(result.orderedActionEvidence.map((entry) => [entry.actionId, entry.filingTreatment]))
      .toEqual([['itemized', 'itemized'], ['standard', 'standardDeduction']])
    expect(result.orderedActionEvidence.map((entry) => [entry.scheduledDate, entry.scheduledSequence]))
      .toEqual([['2026-03-01', 1], ['2026-08-01', 1]])
    const itemized = result.orderedActionEvidence[0]!.deductionTreatment
    const standard = result.orderedActionEvidence[1]!.deductionTreatment
    if (itemized.treatment !== 'evaluated' || itemized.filingTreatment !== 'itemized' || standard.treatment !== 'evaluated' || standard.filingTreatment !== 'standardDeduction') throw new Error('expected evaluated branch fixtures')
    expect(itemized.limitationEvidenceId).toBe(itemized.itemizedSection170ActionEvidence.actionEvidenceId)
    expect(standard.limitationEvidenceId).toBe(standard.standardSection170pActionEvidence.actionEvidenceId)
    expect(result.reasonCode).toBeNull()
  })

  it('accepts either branch empty and preserves positive-zero versus literal not-applicable arms', () => {
    const itemized = coordinated(fixture(undefined, { base: 1_000, priorCash: 600 }))
    expect(itemized.orderedActionEvidence[0]!.deductionTreatment).toMatchObject({ treatment: 'evaluated',
      currentYearClaimedDeductionCents: 0, deductionAmountAppliedByTaxLedgerCents: 0 })
    const standard = coordinated(fixture(undefined, { taxableCapacity: { p1: 1_000 } }, []))
    expect(standard.orderedActionEvidence[0]!.deductionTreatment).toEqual({ treatment: 'notApplicable',
      eligibleContributionCents: 0, currentYearClaimedDeductionCents: 0, limitationCarryforwardCents: 0,
      unclaimedWithoutCarryforwardCents: 0 })
  })

  // A wholly excluded gift leaves nothing for §170 to consider, and the
  // contract makes that case the literal not-applicable arm. Demanding a tax
  // unit for it would have forced a caller to name a filing treatment it never
  // selected and a liability run it never made, in order to describe a
  // deduction of zero -- the same substitution the contract forbids, from the
  // other side. So the tax unit becomes required exactly where an amount exists
  // to limit, and the two cases are separated by the evidence type rather than
  // by convention: this arm can hold only literal zeros.
  it('coordinates an all-not-applicable batch with no tax-unit evidence at all', () => {
    const input = fixture(undefined, { taxableCapacity: { p1: 1_000 } }, [])
    const result = coordinated({ ...input, standardTaxUnits: [] })

    expect(result.taxUnits).toEqual([])
    expect(result.orderedActionEvidence).toHaveLength(1)
    const only = result.orderedActionEvidence[0]!
    expect(only.filingTreatment).toBe('notApplicableNoDeductionEvidence')
    expect(only.deductionTreatment).toEqual({ treatment: 'notApplicable', eligibleContributionCents: 0,
      currentYearClaimedDeductionCents: 0, limitationCarryforwardCents: 0, unclaimedWithoutCarryforwardCents: 0 })
    expect(result.reasonCode).toBeNull()
    // Nothing was invented to get here: no liability-run binding, no tax-input
    // snapshot, no AGI, no contribution base, no selected filing treatment.
    expect(JSON.stringify(result)).not.toContain('liabilityRun')
    expect(JSON.stringify(result)).not.toContain('adjustedGrossIncome')
  })

  it('refuses an unclaimed action whose charitable amount is positive', () => {
    // Same shape, but the gift exceeds the donor's otherwise-taxable pool, so a
    // non-QCD remainder survives and needs §170 evidence nobody supplied.
    const input = fixture([{ id: 'qcd-a', amount: 1_000, date: '2026-08-01' }], { taxableCapacity: { p1: 400 } }, [])
    expect(coordinateAnnualQcdDeductionTreatment({ ...input, standardTaxUnits: [] }))
      .toMatchObject({ status: 'annualQcdDeductionTreatmentBlocked',
        reasonCode: 'qcd-nonqcd-deduction-unsupported', issues: [{ kind: 'actionInvalid' }] })
  })

  it('keeps standard per-action total distinct from the annual tax-unit total', () => {
    const result = coordinated(fixture([
      { id: 'first', amount: 75_000, date: '2026-03-01' }, { id: 'second', amount: 75_000, date: '2026-08-01' },
    ], { base: 1_000_000 }, []))
    const unit = result.taxUnits[0]!; const second = result.orderedActionEvidence[1]!.deductionTreatment
    expect(unit.finalTotalDeductionAppliedByTaxLedgerCents).toBe(1_600_000)
    expect(second).toMatchObject({ treatment: 'evaluated', currentYearClaimedDeductionCents: 25_000,
      totalDeductionAmountAppliedByTaxLedgerCents: 1_525_000 })
  })

  // The `actionInvalid` case below is deliberately a POSITIVE-eligible batch.
  // A tax unit is what supplies the §170 limit chain, the selected filing
  // treatment, and the liability run an evaluated amount was computed inside,
  // so removing it from an action that has a charitable amount to deduct must
  // still refuse. The relaxation registered in the suite above applies only
  // where there is no such amount; this pin is what keeps the two apart.
  it.each([
    ['standardInvalid', (input: CoordinateAnnualQcdDeductionTreatmentInput) => { (input.standardTaxUnits as AnnualQcdStandardSection170pTaxUnitInput[]).push(input.standardTaxUnits[0]!) }],
    ['actionInvalid', (input: CoordinateAnnualQcdDeductionTreatmentInput) => { (input.standardTaxUnits as AnnualQcdStandardSection170pTaxUnitInput[]).splice(0) }],
    ['selectionInvalid', (input: CoordinateAnnualQcdDeductionTreatmentInput) => { Object.assign(input.standardTaxUnits[0]!.taxUnit, { taxUnitMemberPersonIds: [input.itemizedTaxUnits[0]!.taxUnit.taxUnitMemberPersonIds[0]!] }) }],
  ] as const)('fails closed with %s for invalid global ownership', (kind, mutate) => {
    const input = fixture([
      { id: 'p1', donor: 'p1', amount: 1_000, date: '2026-03-01' },
      { id: 'p2', donor: 'p2', amount: 1_000, date: '2026-08-01' },
    ]) as unknown as CoordinateAnnualQcdDeductionTreatmentInput & { itemizedTaxUnits: AnnualQcdItemizedSection170TaxUnitInput[]; itemizedLiabilitySources: AnnualQcdItemizedLiabilitySourceInput[]; standardTaxUnits: AnnualQcdStandardSection170pTaxUnitInput[] }
    mutate(input)
    expect(coordinateAnnualQcdDeductionTreatment(input)).toMatchObject({ status: 'annualQcdDeductionTreatmentBlocked',
      reasonCode: 'qcd-nonqcd-deduction-unsupported', issues: [{ kind }] })
  })

  it('is deterministic, immutable, recursively frozen, and hostile-input closed', () => {
    const input = fixture(); const before = structuredClone(input); const first = coordinated(input); const repeat = coordinated(input)
    expect(input).toEqual(before); expect(repeat.evidenceId).toBe(first.evidenceId)
    expect(Object.isFrozen(first.taxUnits[0]!.terminalEvidence)).toBe(true)
    expect(coordinateAnnualQcdDeductionTreatment(new Proxy(input, {}) as CoordinateAnnualQcdDeductionTreatmentInput))
      .toMatchObject({ status: 'annualQcdDeductionTreatmentBlocked', orderedActionEvidence: [], issues: [{ kind: 'hostileInput' }] })
  })
})
