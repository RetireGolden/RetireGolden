import {
  reconcileAnnualQcdItemizedLiability,
  type AnnualQcdItemizedLiabilityActionEvidence,
  type AnnualQcdItemizedLiabilitySourceInput,
  type AnnualQcdItemizedLiabilityTaxUnitEvidence,
} from './annualQcdItemizedLiabilityReconciliation.js'
import type { AnnualQcdItemizedSection170ActionEvidence, AnnualQcdItemizedSection170TaxUnitInput } from './annualQcdItemizedSection170Ledger.js'
import type { AnnualSection68ItemizedDeductionEvidence, Section68ItemizedActionAttributionEvidence } from './annualSection68ItemizedDeduction.js'
import { stageAnnualQcdResidualForm8606 } from './annualQcdResidualForm8606.js'
import {
  stageAnnualQcdStandardSection170pLedger,
  type AnnualQcdStandardSection170pActionEvidence,
  type AnnualQcdStandardSection170pTaxUnitEvidence,
  type AnnualQcdStandardSection170pTaxUnitInput,
} from './annualQcdStandardSection170pLedger.js'
import type { StageAnnualQcdTaxCharacterPostPassInput } from './annualQcdTaxCharacterPostPass.js'
import type { PersonId } from './identity.js'
import { asUsdCents, type UsdCents } from './money.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'
import { deepFreeze } from './freeze.js'

export interface CoordinateAnnualQcdDeductionTreatmentInput {
  readonly postPassInput: Readonly<StageAnnualQcdTaxCharacterPostPassInput>
  readonly itemizedTaxUnits: readonly Readonly<AnnualQcdItemizedSection170TaxUnitInput>[]
  readonly itemizedLiabilitySources: readonly Readonly<AnnualQcdItemizedLiabilitySourceInput>[]
  readonly standardTaxUnits: readonly Readonly<AnnualQcdStandardSection170pTaxUnitInput>[]
}
/**
 * The literal not-applicable arm: every component is the number zero, not a
 * `UsdCents` that happens to be zero. IRC 408(d)(8)(E) denies a deduction for
 * exactly the excluded amount, so a gift with nothing left over has no
 * contribution to limit and no filing treatment to select. The contract makes
 * this arm literal for that reason -- zero is a derived zero here, never a
 * placeholder for a limit nobody sourced.
 */
export type QcdNotApplicableDeductionTreatmentEvidence =
  { readonly treatment: 'notApplicable'; readonly eligibleContributionCents: 0; readonly currentYearClaimedDeductionCents: 0; readonly limitationCarryforwardCents: 0; readonly unclaimedWithoutCarryforwardCents: 0 }
export type QcdCharitableDeductionTreatmentEvidence =
  | QcdNotApplicableDeductionTreatmentEvidence
  | { readonly treatment: 'evaluated'; readonly filingTreatment: 'itemized'; readonly taxUnitId: string; readonly taxYear: 2026; readonly adjustedGrossIncomeBeforeCharitableDeductionCents: number; readonly itemizedDeductionBeforeActionCents: UsdCents; readonly itemizedDeductionAfterActionCents: UsdCents; readonly standardDeductionCents: UsdCents; readonly eligibleContributionCents: UsdCents; readonly currentYearClaimedDeductionCents: UsdCents; readonly limitationCarryforwardCents: UsdCents; readonly unclaimedWithoutCarryforwardCents: UsdCents; readonly deductionAmountAppliedByTaxLedgerCents: UsdCents; readonly totalDeductionAmountAppliedByTaxLedgerCents: UsdCents; readonly limitationEvidenceId: string; readonly itemizationEvidenceId: string; readonly itemizedLiabilityActionEvidence: Readonly<AnnualQcdItemizedLiabilityActionEvidence>; readonly itemizedSection170ActionEvidence: Readonly<AnnualQcdItemizedSection170ActionEvidence>; readonly annualSection68Evidence: Readonly<AnnualSection68ItemizedDeductionEvidence>; readonly section68ActionAttributionEvidence: Readonly<Section68ItemizedActionAttributionEvidence> }
  | { readonly treatment: 'evaluated'; readonly filingTreatment: 'standardDeduction'; readonly taxUnitId: string; readonly taxYear: 2026; readonly adjustedGrossIncomeBeforeCharitableDeductionCents: number; readonly itemizedDeductionBeforeActionCents: UsdCents; readonly itemizedDeductionAfterActionCents: UsdCents; readonly standardDeductionCents: UsdCents; readonly eligibleContributionCents: UsdCents; readonly currentYearClaimedDeductionCents: UsdCents; readonly limitationCarryforwardCents: UsdCents; readonly unclaimedWithoutCarryforwardCents: UsdCents; readonly deductionAmountAppliedByTaxLedgerCents: UsdCents; readonly totalDeductionAmountAppliedByTaxLedgerCents: UsdCents; readonly limitationEvidenceId: string; readonly itemizationEvidenceId: string; readonly standardSection170pActionEvidence: Readonly<AnnualQcdStandardSection170pActionEvidence>; readonly standardSection170pTaxUnitEvidence: Readonly<AnnualQcdStandardSection170pTaxUnitEvidence> }
interface AnnualQcdDeductionTreatmentActionBase {
  readonly actionId: string
  readonly donorPersonId: PersonId
  readonly scheduledDate: string
  readonly scheduledSequence: number
  readonly postPassApplicationEvidenceId: string
  readonly evidenceId: string
}
/**
 * A QCD's deduction treatment, in two structurally separated arms.
 *
 * The `itemized`/`standardDeduction` arm is backed by a tax unit: a selected
 * filing treatment, a sourced §170 limit chain, and an annual tax-liability run
 * the amounts were computed inside. It is the only arm that may carry an
 * `evaluated` treatment, and every action with a positive
 * `charitableDeductionEligibleAmount` must land in it.
 *
 * The `notApplicableNoDeductionEvidence` arm exists because a gift that is
 * wholly excluded leaves nothing for §170 to consider. The contract makes that
 * case the literal not-applicable arm (doc: "When charitableDeductionEligibleAmount
 * is zero, charitableDeductionTreatment is the literal notApplicable arm"), and
 * demands tax-unit-wide AGI, limit and filing-treatment evidence only for the
 * evaluated arm whose fields that evidence backs. Requiring a tax unit anyway
 * would have forced a caller to supply a filing treatment it had not selected
 * and a liability run it had not made, to describe a deduction of zero -- which
 * is the substitution the contract forbids, wearing the opposite mask.
 *
 * The separation is what keeps the relaxation from leaking. This arm can carry
 * only `QcdNotApplicableDeductionTreatmentEvidence`, whose components are the
 * literal zero, so no positive amount is expressible here at all; and the
 * coordinator additionally refuses at runtime if any action with a positive
 * eligible amount reaches it.
 */
export type AnnualQcdDeductionTreatmentActionEvidence =
  | (AnnualQcdDeductionTreatmentActionBase & {
    readonly filingTreatment: 'itemized' | 'standardDeduction'
    readonly deductionTreatment: Readonly<QcdCharitableDeductionTreatmentEvidence>
  })
  | (AnnualQcdDeductionTreatmentActionBase & {
    readonly filingTreatment: 'notApplicableNoDeductionEvidence'
    readonly deductionTreatment: Readonly<QcdNotApplicableDeductionTreatmentEvidence>
  })
export type AnnualQcdSelectedDeductionTaxUnitEvidence =
  | { readonly filingTreatment: 'itemized'; readonly taxUnitId: string; readonly taxUnitEvidenceId: string; readonly memberPersonIds: readonly PersonId[]; readonly finalTotalDeductionAppliedByTaxLedgerCents: UsdCents; readonly terminalEvidence: Readonly<AnnualQcdItemizedLiabilityTaxUnitEvidence> }
  | { readonly filingTreatment: 'standardDeduction'; readonly taxUnitId: string; readonly taxUnitEvidenceId: string; readonly memberPersonIds: readonly PersonId[]; readonly finalTotalDeductionAppliedByTaxLedgerCents: UsdCents; readonly terminalEvidence: Readonly<AnnualQcdStandardSection170pTaxUnitEvidence> }
export interface AnnualQcdDeductionTreatmentIssue {
  readonly kind: 'hostileInput' | 'residualInvalid' | 'itemizedInvalid' | 'standardInvalid' | 'selectionInvalid' | 'actionInvalid'
  readonly detail: string
}
interface ResultBase { readonly committed: false; readonly movement: 'notCommitted' }
export interface AnnualQcdDeductionTreatmentCoordinated extends ResultBase {
  readonly status: 'annualQcdDeductionTreatmentCoordinated'; readonly taxYear: 2026
  readonly residualEvidenceId: string; readonly taxUnits: readonly Readonly<AnnualQcdSelectedDeductionTaxUnitEvidence>[]
  readonly orderedActionEvidence: readonly Readonly<AnnualQcdDeductionTreatmentActionEvidence>[]
  readonly exactAmountAuthority: 'cents'; readonly reasonCode: null; readonly evidenceId: string; readonly issues: readonly []
}
export interface AnnualQcdDeductionTreatmentBlocked extends ResultBase {
  readonly status: 'annualQcdDeductionTreatmentBlocked'; readonly taxYear: null; readonly residualEvidenceId: null
  readonly taxUnits: readonly []; readonly orderedActionEvidence: readonly []; readonly exactAmountAuthority: 'cents'
  readonly reasonCode: 'qcd-nonqcd-deduction-unsupported'; readonly evidenceId: null
  readonly issues: readonly [Readonly<AnnualQcdDeductionTreatmentIssue>]
}
export type CoordinateAnnualQcdDeductionTreatmentResult = AnnualQcdDeductionTreatmentCoordinated | AnnualQcdDeductionTreatmentBlocked
class CoordinationError extends Error {
  readonly kind: AnnualQcdDeductionTreatmentIssue['kind']
  constructor(kind: AnnualQcdDeductionTreatmentIssue['kind'], detail: string) { super(detail); this.kind = kind }
}
function fail(kind: AnnualQcdDeductionTreatmentIssue['kind'], detail: string): never { throw new CoordinationError(kind, detail) }
function blocked(error: unknown): AnnualQcdDeductionTreatmentBlocked {
  const issue = error instanceof CoordinationError ? { kind: error.kind, detail: error.message }
    : { kind: 'hostileInput' as const, detail: 'QCD deduction inputs must be detached canonical data.' }
  return deepFreeze({ status: 'annualQcdDeductionTreatmentBlocked', committed: false, movement: 'notCommitted',
    taxYear: null, residualEvidenceId: null, taxUnits: [], orderedActionEvidence: [], exactAmountAuthority: 'cents',
    reasonCode: 'qcd-nonqcd-deduction-unsupported', evidenceId: null, issues: [issue] })
}
function validId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail('selectionInvalid', `${label} is required.`)
  return value
}
function checkPartition(eligible: UsdCents, claimed: UsdCents, carryforward: UsdCents, unclaimed: UsdCents, applied: UsdCents): boolean {
  if (BigInt(eligible) !== BigInt(claimed) + BigInt(carryforward) + BigInt(unclaimed)) fail('actionInvalid', 'QCD deduction partition is incomplete.')
  if (eligible === 0 && (claimed !== 0 || carryforward !== 0 || unclaimed !== 0 || applied !== 0)) fail('actionInvalid', 'Not-applicable QCD deduction effects must be literal zero.')
  return eligible > 0
}
const notApplicable = (): QcdNotApplicableDeductionTreatmentEvidence => deepFreeze({ treatment: 'notApplicable', eligibleContributionCents: 0, currentYearClaimedDeductionCents: 0, limitationCarryforwardCents: 0, unclaimedWithoutCarryforwardCents: 0 })
function coordinate(input: CoordinateAnnualQcdDeductionTreatmentInput): AnnualQcdDeductionTreatmentCoordinated {
  const residual = stageAnnualQcdResidualForm8606({ postPassInput: input.postPassInput })
  if (residual.status !== 'annualQcdResidualForm8606Staged') fail('residualInvalid', 'Canonical QCD residual rebuilding failed.')
  const itemized = reconcileAnnualQcdItemizedLiability({ itemizedLedgerInput: { postPassInput: input.postPassInput,
    taxUnits: input.itemizedTaxUnits }, liabilitySources: input.itemizedLiabilitySources })
  if (itemized.status !== 'annualQcdItemizedLiabilityReconciled') fail('itemizedInvalid', 'Itemized QCD liability rebuilding failed.')
  const standard = stageAnnualQcdStandardSection170pLedger({ postPassInput: input.postPassInput, taxUnits: input.standardTaxUnits })
  if (standard.status !== 'annualQcdStandardSection170pStaged' || standard.residualEvidenceId !== residual.evidenceId) fail('standardInvalid', 'Standard QCD deduction rebuilding failed.')
  if (itemized.taxUnits.some((entry) => entry.itemizedSection170Evidence.residualEvidenceId !== residual.evidenceId)) fail('itemizedInvalid', 'Itemized QCD residual evidence drifted.')
  const taxUnits: AnnualQcdSelectedDeductionTaxUnitEvidence[] = [
    ...itemized.taxUnits.map((entry) => ({ filingTreatment: 'itemized' as const,
      taxUnitId: entry.taxUnitId, taxUnitEvidenceId: entry.itemizedSection170Evidence.taxUnit.taxUnitEvidenceId,
      memberPersonIds: entry.itemizedSection170Evidence.taxUnit.taxUnitMemberPersonIds,
      finalTotalDeductionAppliedByTaxLedgerCents: entry.finalTotalDeductionAppliedByTaxLedgerCents, terminalEvidence: entry })),
    ...standard.taxUnits.map((entry) => ({ filingTreatment: 'standardDeduction' as const,
      taxUnitId: entry.taxUnit.taxUnitId, taxUnitEvidenceId: entry.taxUnit.taxUnitEvidenceId,
      memberPersonIds: entry.taxUnit.taxUnitMemberPersonIds,
      finalTotalDeductionAppliedByTaxLedgerCents: entry.finalTotalDeductionAppliedCents, terminalEvidence: entry })),
  ].sort((left, right) => compareUtf16CodeUnits(left.taxUnitId, right.taxUnitId))
  if (new Set(taxUnits.map((entry) => entry.taxUnitId)).size !== taxUnits.length || new Set(taxUnits.map((entry) => validId(entry.taxUnitEvidenceId, 'Tax-unit evidence ID'))).size !== taxUnits.length) fail('selectionInvalid', 'Selected tax-unit identities must be globally unique.')
  const members = new Set<PersonId>()
  for (const unit of taxUnits) for (const personId of unit.memberPersonIds) {
    if (members.has(personId)) fail('selectionInvalid', 'A person may belong to only one selected deduction tax unit.')
    members.add(personId)
  }
  const actionCandidates: AnnualQcdDeductionTreatmentActionEvidence[] = []
  for (const unit of itemized.taxUnits) for (const entry of unit.orderedActionEvidence) {
    const provisional = unit.itemizedSection170Evidence.orderedActionEvidence.filter((candidate) => candidate.actionId === entry.actionId)
    if (provisional.length !== 1 || !unit.itemizedSection170Evidence.taxUnit.taxUnitMemberPersonIds.includes(entry.donorPersonId)) fail('actionInvalid', 'Itemized QCD action does not resolve inside its tax unit.')
    const source = provisional[0]!
    const positive = checkPartition(entry.eligibleContributionCents, entry.currentYearClaimedDeductionCents,
      asUsdCents(entry.limitationCarryforwardCents), entry.unclaimedWithoutCarryforwardCents, entry.deductionAmountAppliedByTaxLedgerCents)
    const attributions = unit.annualSection68Evidence.orderedActionAttributions.filter((candidate) => candidate.actionAttributionEvidenceId === entry.section68ActionAttributionEvidenceId)
    if (positive && attributions.length !== 1) fail('actionInvalid', 'Evaluated itemized QCD lacks its Section 68 attribution snapshot.')
    const deductionTreatment: QcdCharitableDeductionTreatmentEvidence = !positive ? notApplicable() : deepFreeze({
      treatment: 'evaluated' as const, filingTreatment: 'itemized' as const, taxUnitId: unit.taxUnitId, taxYear: 2026 as const,
      adjustedGrossIncomeBeforeCharitableDeductionCents: unit.liabilitySource.adjustedGrossIncomeBeforeCharitableDeductionCents,
      itemizedDeductionBeforeActionCents: entry.itemizedDeductionBeforeSection68Cents,
      itemizedDeductionAfterActionCents: entry.itemizedDeductionAfterSection68Cents,
      standardDeductionCents: asUsdCents(unit.liabilitySource.standardDeductionCents), eligibleContributionCents: entry.eligibleContributionCents,
      currentYearClaimedDeductionCents: entry.currentYearClaimedDeductionCents, limitationCarryforwardCents: entry.limitationCarryforwardCents,
      unclaimedWithoutCarryforwardCents: entry.unclaimedWithoutCarryforwardCents, deductionAmountAppliedByTaxLedgerCents: entry.deductionAmountAppliedByTaxLedgerCents,
      totalDeductionAmountAppliedByTaxLedgerCents: entry.totalDeductionAmountAppliedByTaxLedgerCents,
      limitationEvidenceId: source.actionEvidenceId, itemizationEvidenceId: unit.liabilitySource.selectedItemizationEvidenceId,
      itemizedLiabilityActionEvidence: entry, itemizedSection170ActionEvidence: source,
      annualSection68Evidence: unit.annualSection68Evidence, section68ActionAttributionEvidence: attributions[0]! })
    const facts = { actionId: entry.actionId, donorPersonId: entry.donorPersonId, scheduledDate: entry.scheduledDate,
      scheduledSequence: entry.scheduledSequence, postPassApplicationEvidenceId: source.postPassApplicationEvidenceId,
      filingTreatment: 'itemized' as const, deductionTreatment }
    actionCandidates.push(deepFreeze({ ...facts, evidenceId: deriveActionStructuralId('annual-qcd-deduction-treatment-action', [residual.evidenceId, unit.evidenceId, facts]) }))
  }
  for (const unit of standard.taxUnits) for (const entry of unit.orderedActionEvidence) {
    if (!unit.taxUnit.taxUnitMemberPersonIds.includes(entry.donorPersonId)) fail('actionInvalid', 'Standard QCD action does not resolve inside its tax unit.')
    const positive = checkPartition(entry.eligibleContributionCents, entry.currentYearClaimedDeductionCents,
      asUsdCents(entry.limitationCarryforwardCents), entry.unclaimedWithoutCarryforwardCents, entry.deductionAmountAppliedByTaxLedgerCents)
    const deductionTreatment: QcdCharitableDeductionTreatmentEvidence = !positive ? notApplicable() : deepFreeze({
      treatment: 'evaluated' as const, filingTreatment: 'standardDeduction' as const, taxUnitId: unit.taxUnit.taxUnitId, taxYear: 2026 as const,
      adjustedGrossIncomeBeforeCharitableDeductionCents: unit.adjustedGrossIncomeBeforeCharitableDeductionCents,
      itemizedDeductionBeforeActionCents: entry.itemizedDeductionBeforeActionCents,
      itemizedDeductionAfterActionCents: entry.itemizedDeductionAfterActionCents, standardDeductionCents: unit.standardDeductionCents,
      eligibleContributionCents: entry.eligibleContributionCents, currentYearClaimedDeductionCents: entry.currentYearClaimedDeductionCents,
      limitationCarryforwardCents: entry.limitationCarryforwardCents, unclaimedWithoutCarryforwardCents: entry.unclaimedWithoutCarryforwardCents,
      deductionAmountAppliedByTaxLedgerCents: entry.deductionAmountAppliedByTaxLedgerCents,
      totalDeductionAmountAppliedByTaxLedgerCents: entry.standardPlusClaimedByActionCents,
      limitationEvidenceId: entry.actionEvidenceId, itemizationEvidenceId: unit.selectedStandardDeductionEvidenceId,
      standardSection170pActionEvidence: entry, standardSection170pTaxUnitEvidence: unit })
    const facts = { actionId: entry.actionId, donorPersonId: entry.donorPersonId, scheduledDate: entry.scheduledDate,
      scheduledSequence: entry.scheduledSequence, postPassApplicationEvidenceId: entry.postPassApplicationEvidenceId,
      filingTreatment: 'standardDeduction' as const, deductionTreatment }
    actionCandidates.push(deepFreeze({ ...facts, evidenceId: deriveActionStructuralId('annual-qcd-deduction-treatment-action', [residual.evidenceId, unit.evidenceId, facts]) }))
  }
  if (new Set(actionCandidates.map((entry) => entry.actionId)).size !== actionCandidates.length) fail('actionInvalid', 'QCD actions may appear in only one deduction branch.')
  const byId = new Map(actionCandidates.map((entry) => [entry.actionId, entry]))
  const requests = new Map(input.postPassInput.physicalInput.prerequisite.requests.map((entry) => [entry.actionId, entry]))
  let unclaimed = 0
  const orderedActionEvidence = residual.postPass.applications.map((application) => {
    const entry = byId.get(application.actionId)
    const request = requests.get(application.actionId)
    const scheduledDate: string | null | undefined = request?.executionDate
    if (request === undefined || scheduledDate === null || scheduledDate === undefined) fail('actionInvalid', 'Every canonical QCD action must resolve to its scheduled request.')
    if (entry === undefined) {
      // No tax unit claimed this action. That is admissible only when the gift
      // was wholly excluded, so §170 has nothing to consider and the contract's
      // literal not-applicable arm is the whole truth about its treatment. A
      // positive eligible amount here is the unsupported case the contract
      // names, and it refuses rather than treating the missing limit,
      // filing-treatment and carryforward facts as zero.
      if (application.charitableDeductionEligibleAmount !== 0) fail('actionInvalid', 'Every canonical QCD action with a positive charitable amount must have one matching deduction treatment.')
      unclaimed += 1
      const facts = { actionId: application.actionId, donorPersonId: application.donorPersonId,
        scheduledDate, scheduledSequence: request.executionSequence,
        postPassApplicationEvidenceId: application.evidenceId,
        filingTreatment: 'notApplicableNoDeductionEvidence' as const, deductionTreatment: notApplicable() }
      return deepFreeze({ ...facts, evidenceId: deriveActionStructuralId('annual-qcd-deduction-treatment-action', [residual.evidenceId, facts]) })
    }
    if (entry.donorPersonId !== application.donorPersonId || entry.scheduledDate !== scheduledDate || entry.scheduledSequence !== request.executionSequence || entry.postPassApplicationEvidenceId !== application.evidenceId || entry.deductionTreatment.eligibleContributionCents !== application.charitableDeductionEligibleAmount) fail('actionInvalid', 'Every canonical QCD action must have one matching deduction treatment.')
    return entry
  })
  if (orderedActionEvidence.length - unclaimed !== actionCandidates.length) fail('actionInvalid', 'Deduction treatment contains an extra QCD action.')
  const withoutId = { status: 'annualQcdDeductionTreatmentCoordinated' as const, committed: false as const,
    movement: 'notCommitted' as const, taxYear: 2026 as const, residualEvidenceId: residual.evidenceId,
    taxUnits, orderedActionEvidence, exactAmountAuthority: 'cents' as const, reasonCode: null, issues: [] as const }
  return deepFreeze({ ...withoutId, evidenceId: deriveActionStructuralId('annual-qcd-deduction-treatment-coordinator', [withoutId]) })
}
export function coordinateAnnualQcdDeductionTreatment(input: Readonly<CoordinateAnnualQcdDeductionTreatmentInput>): Readonly<CoordinateAnnualQcdDeductionTreatmentResult> {
  try { return coordinate(structuredClone(input) as CoordinateAnnualQcdDeductionTreatmentInput) }
  catch (error) { return blocked(error) }
}
