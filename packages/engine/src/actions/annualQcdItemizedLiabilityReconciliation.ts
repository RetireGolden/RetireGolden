import type { CharitableDeductionFilingStatus } from '../tax/annualCharitableDeductionParameters.js'
import {
  buildAnnualSection68ItemizedDeductionEvidence,
  type AnnualSection68ItemizedDeductionEvidence,
  type AnnualSection68LiabilityRunBinding,
} from './annualSection68ItemizedDeduction.js'
import {
  stageAnnualQcdItemizedSection170Ledger,
  type AnnualQcdItemizedSection170ActionEvidence,
  type AnnualQcdItemizedSection170TaxUnitEvidence,
  type StageAnnualQcdItemizedSection170LedgerInput,
} from './annualQcdItemizedSection170Ledger.js'
import type { PersonId } from './identity.js'
import { asUsdCents, type UsdCents } from './money.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'
import { deepFreeze } from './freeze.js'

export interface AnnualQcdItemizedLiabilitySourceInput {
  readonly taxUnitId: string
  readonly taxYear: number
  readonly filingStatus: CharitableDeductionFilingStatus
  readonly annualTaxLiabilityEvidenceId: string
  readonly taxInputSnapshotId: string
  readonly liabilityRun: Readonly<AnnualSection68LiabilityRunBinding>
  readonly adjustedGrossIncomeBeforeCharitableDeductionCents: number
  readonly qualifiedBusinessIncomeDeductionCents: number
  readonly qualifiedBusinessIncomeComputedWithoutSection68: true
  readonly additionalSchedule1ADeductionCents: number
  readonly standardDeductionCents: number
  readonly selectedFilingTreatment: 'itemized'
  readonly selectedItemizationEvidenceId: string
  readonly adjustedGrossIncomeEvidenceId: string
  readonly qualifiedBusinessIncomeEvidenceId: string
  readonly additionalSchedule1AEvidenceId: string
  readonly standardDeductionEvidenceId: string
  readonly section170SourceBindings: Readonly<{
    readonly contributionBaseEvidenceId: string
    readonly priorFloorUseEvidenceId: string
    readonly priorCashPercentageUseEvidenceId: string
    readonly openingItemizedDeductionEvidenceId: string
  }>
}
export interface ReconcileAnnualQcdItemizedLiabilityInput {
  readonly itemizedLedgerInput: Readonly<StageAnnualQcdItemizedSection170LedgerInput>
  readonly liabilitySources: readonly Readonly<AnnualQcdItemizedLiabilitySourceInput>[]
}
export interface AnnualQcdItemizedLiabilityActionEvidence {
  readonly treatment: 'notApplicable' | 'evaluated'
  readonly actionId: string
  readonly donorPersonId: PersonId
  readonly scheduledDate: string
  readonly scheduledSequence: number
  readonly eligibleContributionCents: UsdCents
  readonly currentYearClaimedDeductionCents: UsdCents
  readonly limitationCarryforwardCents: UsdCents
  readonly unclaimedWithoutCarryforwardCents: UsdCents
  readonly itemizedDeductionBeforeSection68Cents: UsdCents
  readonly itemizedDeductionAfterSection68Cents: UsdCents
  readonly deductionAmountAppliedByTaxLedgerCents: UsdCents
  readonly totalDeductionAmountAppliedByTaxLedgerCents: UsdCents
  readonly itemizedSection170ActionEvidenceId: string
  readonly section68ActionAttributionEvidenceId: string | null
  readonly actionEvidenceId: string
}
export interface AnnualQcdItemizedLiabilityTaxUnitEvidence {
  readonly filingTreatment: 'itemized'
  readonly taxUnitId: string
  readonly taxYear: 2026
  readonly liabilitySource: Readonly<AnnualQcdItemizedLiabilitySourceInput & { readonly taxYear: 2026 }>
  readonly itemizedSection170Evidence: Readonly<AnnualQcdItemizedSection170TaxUnitEvidence>
  readonly annualSection68Evidence: Readonly<AnnualSection68ItemizedDeductionEvidence>
  readonly orderedActionEvidence: readonly Readonly<AnnualQcdItemizedLiabilityActionEvidence>[]
  readonly finalTotalDeductionAppliedByTaxLedgerCents: UsdCents
  readonly exactAmountAuthority: 'cents'
  readonly evidenceId: string
}
export interface AnnualQcdItemizedLiabilityIssue {
  readonly kind: 'hostileInput' | 'itemizedLedgerInvalid' | 'liabilitySourceInvalid' | 'section68Invalid' | 'reconciliationInvalid'
  readonly detail: string
}
interface ResultBase { readonly committed: false; readonly movement: 'notCommitted'; readonly standardDeductionStatus: 'notOwnedByItemizedReconciler' }
export interface AnnualQcdItemizedLiabilityReconciled extends ResultBase {
  readonly status: 'annualQcdItemizedLiabilityReconciled'; readonly taxYear: 2026
  readonly taxUnits: readonly Readonly<AnnualQcdItemizedLiabilityTaxUnitEvidence>[]; readonly issues: readonly []
}
export interface AnnualQcdItemizedLiabilityBlocked extends ResultBase {
  readonly status: 'annualQcdItemizedLiabilityBlocked'; readonly taxYear: null
  readonly taxUnits: readonly []; readonly issues: readonly [Readonly<AnnualQcdItemizedLiabilityIssue>]
}
export type ReconcileAnnualQcdItemizedLiabilityResult = AnnualQcdItemizedLiabilityReconciled | AnnualQcdItemizedLiabilityBlocked
class ReconciliationError extends Error {
  readonly kind: AnnualQcdItemizedLiabilityIssue['kind']
  constructor(kind: AnnualQcdItemizedLiabilityIssue['kind'], detail: string) { super(detail); this.kind = kind }
}
function fail(kind: AnnualQcdItemizedLiabilityIssue['kind'], detail: string): never { throw new ReconciliationError(kind, detail) }
function id(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail('liabilitySourceInvalid', `${label} is required.`)
  return value
}
function cents(value: unknown, label: string, signed = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || Object.is(value, -0) || (!signed && value < 0)) fail('liabilitySourceInvalid', `${label} must be exact cents.`)
  return value
}
function blocked(error: unknown): AnnualQcdItemizedLiabilityBlocked {
  const issue = error instanceof ReconciliationError ? { kind: error.kind, detail: error.message }
    : { kind: 'hostileInput' as const, detail: 'Itemized liability inputs must be detached canonical data.' }
  return deepFreeze({ status: 'annualQcdItemizedLiabilityBlocked', committed: false, movement: 'notCommitted',
    standardDeductionStatus: 'notOwnedByItemizedReconciler', taxYear: null, taxUnits: [], issues: [issue] })
}
function sameRun(left: Readonly<AnnualSection68LiabilityRunBinding>, right: Readonly<AnnualSection68LiabilityRunBinding>): boolean {
  return left.liabilityRunKind === right.liabilityRunKind && left.candidateFundingVectorEvidenceId === right.candidateFundingVectorEvidenceId
}
function source(input: Readonly<AnnualQcdItemizedLiabilitySourceInput>, itemized: Readonly<AnnualQcdItemizedSection170TaxUnitEvidence>): Readonly<AnnualQcdItemizedLiabilitySourceInput & { readonly taxYear: 2026 }> {
  if (input.taxYear !== 2026 || input.selectedFilingTreatment !== 'itemized' || input.taxUnitId !== itemized.taxUnit.taxUnitId || input.filingStatus !== itemized.taxUnit.federalFilingStatus || input.annualTaxLiabilityEvidenceId !== itemized.annualTaxLiabilityEvidenceId || input.taxInputSnapshotId !== itemized.taxInputSnapshotId || !sameRun(input.liabilityRun, itemized.liabilityRun)) fail('liabilitySourceInvalid', 'Liability source does not match the itemized tax-unit run.')
  const bindingKeys = ['contributionBaseEvidenceId', 'priorFloorUseEvidenceId', 'priorCashPercentageUseEvidenceId', 'openingItemizedDeductionEvidenceId'] as const
  if (Object.keys(input.section170SourceBindings).length !== bindingKeys.length || bindingKeys.some((key) => !Object.hasOwn(input.section170SourceBindings, key))) fail('liabilitySourceInvalid', 'Section 170 source bindings must be exact and complete.')
  const bindings = Object.fromEntries(bindingKeys.map((key) => [key, id(input.section170SourceBindings[key], key)])) as unknown as AnnualQcdItemizedLiabilitySourceInput['section170SourceBindings']
  const normalized = { ...input, taxYear: 2026 as const,
    taxUnitId: id(input.taxUnitId, 'Tax-unit ID'), annualTaxLiabilityEvidenceId: id(input.annualTaxLiabilityEvidenceId, 'Liability evidence ID'),
    taxInputSnapshotId: id(input.taxInputSnapshotId, 'Tax-input snapshot ID'),
    adjustedGrossIncomeBeforeCharitableDeductionCents: cents(input.adjustedGrossIncomeBeforeCharitableDeductionCents, 'AGI', true),
    qualifiedBusinessIncomeDeductionCents: cents(input.qualifiedBusinessIncomeDeductionCents, 'QBI'),
    additionalSchedule1ADeductionCents: cents(input.additionalSchedule1ADeductionCents, 'Schedule 1-A deduction'),
    standardDeductionCents: cents(input.standardDeductionCents, 'Standard deduction'),
    selectedItemizationEvidenceId: id(input.selectedItemizationEvidenceId, 'Itemization evidence ID'),
    adjustedGrossIncomeEvidenceId: id(input.adjustedGrossIncomeEvidenceId, 'AGI evidence ID'),
    qualifiedBusinessIncomeEvidenceId: id(input.qualifiedBusinessIncomeEvidenceId, 'QBI evidence ID'),
    additionalSchedule1AEvidenceId: id(input.additionalSchedule1AEvidenceId, 'Schedule 1-A evidence ID'),
    standardDeductionEvidenceId: id(input.standardDeductionEvidenceId, 'Standard deduction evidence ID'), section170SourceBindings: bindings }
  return deepFreeze(normalized)
}
function action(provisional: Readonly<AnnualQcdItemizedSection170ActionEvidence>, annual: Readonly<AnnualSection68ItemizedDeductionEvidence>, sourceEvidence: Readonly<AnnualQcdItemizedLiabilitySourceInput>): Readonly<AnnualQcdItemizedLiabilityActionEvidence> {
  const total = asUsdCents(annual.finalState.allowedItemizedDeductionCents)
  if (provisional.eligibleContributionCents === 0) {
    if (provisional.currentYearClaimedDeductionCents !== 0 || provisional.limitationCarryforwardCents !== 0 || provisional.unclaimedWithoutCarryforwardCents !== 0) fail('reconciliationInvalid', 'A not-applicable action must have literal zero effects.')
    const facts = { treatment: 'notApplicable' as const, actionId: provisional.actionId, donorPersonId: provisional.donorPersonId,
      scheduledDate: provisional.scheduledDate, scheduledSequence: provisional.scheduledSequence,
      eligibleContributionCents: asUsdCents(0), currentYearClaimedDeductionCents: asUsdCents(0), limitationCarryforwardCents: asUsdCents(0), unclaimedWithoutCarryforwardCents: asUsdCents(0),
      itemizedDeductionBeforeSection68Cents: provisional.beforeAction.postOtherLimitItemizedDeductionBeforeSection68Cents,
      itemizedDeductionAfterSection68Cents: provisional.afterAction.postOtherLimitItemizedDeductionBeforeSection68Cents,
      deductionAmountAppliedByTaxLedgerCents: asUsdCents(0), totalDeductionAmountAppliedByTaxLedgerCents: total,
      itemizedSection170ActionEvidenceId: provisional.actionEvidenceId, section68ActionAttributionEvidenceId: null }
    return deepFreeze({ ...facts, actionEvidenceId: deriveActionStructuralId('annual-qcd-itemized-liability-action', [sourceEvidence, annual.section68EvidenceId, facts]) })
  }
  const matches = annual.orderedActionAttributions.filter((entry) => entry.actionId === provisional.actionId)
  if (matches.length !== 1) fail('reconciliationInvalid', 'Every positive itemized QCD must resolve one Section 68 attribution.')
  const attribution = matches[0]!
  if (attribution.scheduledDate !== provisional.scheduledDate || attribution.scheduledSequence !== provisional.scheduledSequence || attribution.itemizedDeductionIncreaseCents !== provisional.currentYearClaimedDeductionCents || attribution.beforeAction.totalItemizedDeductionsBeforeOverallLimitCents !== provisional.beforeAction.postOtherLimitItemizedDeductionBeforeSection68Cents || attribution.afterAction.totalItemizedDeductionsBeforeOverallLimitCents !== provisional.afterAction.postOtherLimitItemizedDeductionBeforeSection68Cents) fail('reconciliationInvalid', 'Section 170 and Section 68 action evidence do not reconcile.')
  const partition = BigInt(provisional.currentYearClaimedDeductionCents) + BigInt(provisional.limitationCarryforwardCents) + BigInt(provisional.unclaimedWithoutCarryforwardCents)
  if (partition !== BigInt(provisional.eligibleContributionCents)) fail('reconciliationInvalid', 'Itemized deduction partition is incomplete.')
  const facts = { treatment: 'evaluated' as const, actionId: provisional.actionId, donorPersonId: provisional.donorPersonId,
    scheduledDate: provisional.scheduledDate, scheduledSequence: provisional.scheduledSequence,
    eligibleContributionCents: provisional.eligibleContributionCents, currentYearClaimedDeductionCents: provisional.currentYearClaimedDeductionCents,
    limitationCarryforwardCents: provisional.limitationCarryforwardCents, unclaimedWithoutCarryforwardCents: provisional.unclaimedWithoutCarryforwardCents,
    itemizedDeductionBeforeSection68Cents: asUsdCents(attribution.beforeAction.totalItemizedDeductionsBeforeOverallLimitCents),
    itemizedDeductionAfterSection68Cents: asUsdCents(attribution.afterAction.totalItemizedDeductionsBeforeOverallLimitCents),
    deductionAmountAppliedByTaxLedgerCents: asUsdCents(attribution.allowedItemizedDeductionDeltaCents), totalDeductionAmountAppliedByTaxLedgerCents: total,
    itemizedSection170ActionEvidenceId: provisional.actionEvidenceId, section68ActionAttributionEvidenceId: attribution.actionAttributionEvidenceId }
  return deepFreeze({ ...facts, actionEvidenceId: deriveActionStructuralId('annual-qcd-itemized-liability-action', [sourceEvidence, annual.section68EvidenceId, facts]) })
}
function reconcile(input: ReconcileAnnualQcdItemizedLiabilityInput): AnnualQcdItemizedLiabilityReconciled {
  const itemized = stageAnnualQcdItemizedSection170Ledger(input.itemizedLedgerInput)
  if (itemized.status !== 'annualQcdItemizedSection170Staged') fail('itemizedLedgerInvalid', 'Itemized Section 170 rebuilding failed.')
  const sources = [...input.liabilitySources].sort((left, right) => compareUtf16CodeUnits(left.taxUnitId, right.taxUnitId))
  if (sources.length !== itemized.taxUnits.length || new Set(sources.map((entry) => entry.taxUnitId)).size !== sources.length) fail('liabilitySourceInvalid', 'Liability sources must cover itemized tax units exactly once.')
  const taxUnits = itemized.taxUnits.map((unit) => {
    const matches = sources.filter((entry) => entry.taxUnitId === unit.taxUnit.taxUnitId)
    if (matches.length !== 1) fail('liabilitySourceInvalid', 'Itemized tax unit has no unique liability source.')
    const liabilitySource = source(matches[0]!, unit)
    const positive = unit.orderedActionEvidence.filter((entry) => entry.eligibleContributionCents > 0)
    const built = buildAnnualSection68ItemizedDeductionEvidence({ taxUnitId: unit.taxUnit.taxUnitId, taxYear: 2026,
      annualTaxLiabilityEvidenceId: unit.annualTaxLiabilityEvidenceId, taxInputSnapshotId: unit.taxInputSnapshotId,
      liabilityRun: unit.liabilityRun, filingStatus: unit.taxUnit.federalFilingStatus,
      adjustedGrossIncomeBeforeItemizedDeductionCents: liabilitySource.adjustedGrossIncomeBeforeCharitableDeductionCents,
      qualifiedBusinessIncomeDeductionCents: liabilitySource.qualifiedBusinessIncomeDeductionCents,
      qualifiedBusinessIncomeComputedWithoutSection68: liabilitySource.qualifiedBusinessIncomeComputedWithoutSection68,
      additionalSchedule1ADeductionCents: liabilitySource.additionalSchedule1ADeductionCents,
      nonActionItemizedDeductionCents: unit.openingState.postOtherLimitItemizedDeductionBeforeSection68Cents,
      actions: positive.map((entry) => ({ actionKind: 'qcd', actionId: entry.actionId, scheduledDate: entry.scheduledDate,
        scheduledSequence: entry.scheduledSequence, itemizedDeductionIncreaseCents: entry.currentYearClaimedDeductionCents })) })
    if (built.status !== 'built') fail('section68Invalid', 'Annual Section 68 rebuilding failed.')
    const annual = built.evidence
    if (annual.initialState.totalItemizedDeductionsBeforeOverallLimitCents !== unit.openingState.postOtherLimitItemizedDeductionBeforeSection68Cents || annual.orderedActionAttributions.length !== positive.length) fail('reconciliationInvalid', 'Annual Section 68 action chain is incomplete.')
    const orderedActionEvidence = unit.orderedActionEvidence.map((entry) => action(entry, annual, liabilitySource))
    const withoutId = { filingTreatment: 'itemized' as const, taxUnitId: unit.taxUnit.taxUnitId, taxYear: 2026 as const,
      liabilitySource, itemizedSection170Evidence: unit, annualSection68Evidence: annual, orderedActionEvidence,
      finalTotalDeductionAppliedByTaxLedgerCents: asUsdCents(annual.finalState.allowedItemizedDeductionCents), exactAmountAuthority: 'cents' as const }
    return deepFreeze({ ...withoutId, evidenceId: deriveActionStructuralId('annual-qcd-itemized-liability-tax-unit', [withoutId]) })
  })
  return deepFreeze({ status: 'annualQcdItemizedLiabilityReconciled', committed: false, movement: 'notCommitted',
    standardDeductionStatus: 'notOwnedByItemizedReconciler', taxYear: 2026, taxUnits, issues: [] })
}
export function reconcileAnnualQcdItemizedLiability(input: Readonly<ReconcileAnnualQcdItemizedLiabilityInput>): Readonly<ReconcileAnnualQcdItemizedLiabilityResult> {
  try { return reconcile(structuredClone(input) as ReconcileAnnualQcdItemizedLiabilityInput) }
  catch (error) { return blocked(error) }
}
