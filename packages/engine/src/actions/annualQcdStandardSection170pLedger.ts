import { annualCharitableDeductionParameters } from '../tax/annualCharitableDeductionParameters.js'
import type { PersonId } from './identity.js'
import { asUsdCents, type UsdCents } from './money.js'
import { stageAnnualQcdResidualForm8606, type AnnualQcdResidualForm8606Staged } from './annualQcdResidualForm8606.js'
import type { StageAnnualQcdTaxCharacterPostPassInput } from './annualQcdTaxCharacterPostPass.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'
import type { AnnualLiabilityRunBinding } from './annualLiabilityRunIdentity.js'
import type { TaxableWithdrawalTaxUnitEvidence } from './taxableWithdrawalCharacter.js'

/** The canonical liability-run binding, under this ledger's published name. */
export type AnnualQcdSection170pRunBinding = AnnualLiabilityRunBinding
export interface AnnualQcdStandardSection170pTaxUnitInput {
  readonly taxUnit: Readonly<TaxableWithdrawalTaxUnitEvidence>
  readonly annualTaxLiabilityEvidenceId: string
  readonly taxInputSnapshotId: string
  readonly liabilityRun: Readonly<AnnualQcdSection170pRunBinding>
  readonly sourceTaxYears: Readonly<{ readonly standardDeduction: number; readonly priorQualifyingCashContributions: number; readonly cashPercentageLimit: number }>
  readonly sourceTaxUnitIds: Readonly<{ readonly standardDeduction: string; readonly priorQualifyingCashContributions: string; readonly cashPercentageLimit: string }>
  readonly adjustedGrossIncomeBeforeCharitableDeductionCents: number
  readonly unchangedItemizedDeductionCents: number
  readonly standardDeductionCents: number
  readonly selectedStandardDeductionEvidenceId: string
  readonly contributionBaseCents: number
  readonly contributionBaseEvidenceId: string
  readonly priorQualifyingCashContributionUsedCents: number
  readonly priorQualifyingCashContributionEvidenceId: string
  readonly priorCashPercentageLimitUsedCents: number
  readonly cashPercentageLimitEvidenceId: string
}
export interface StageAnnualQcdStandardSection170pLedgerInput {
  readonly postPassInput: Readonly<StageAnnualQcdTaxCharacterPostPassInput>
  readonly taxUnits: readonly Readonly<AnnualQcdStandardSection170pTaxUnitInput>[]
}
export interface AnnualQcdStandardSection170pStateEvidence {
  readonly remainingStatutoryLimitCents: UsdCents
  readonly cashPercentageLimitCapacityRemainingCents: UsdCents
}
export interface AnnualQcdStandardSection170pActionEvidence {
  readonly treatment: 'notApplicable' | 'evaluated'
  readonly actionId: string
  readonly donorPersonId: PersonId
  readonly scheduledDate: string
  readonly scheduledSequence: number
  readonly postPassApplicationEvidenceId: string
  readonly eligibleContributionCents: UsdCents
  readonly qualifyingCashContributionAmountUsedBeforeActionCents: UsdCents
  readonly remainingLimitBeforeActionCents: UsdCents
  readonly claimedByActionCents: UsdCents
  readonly remainingLimitAfterActionCents: UsdCents
  readonly cashPercentageLimitCapacityBeforeActionCents: UsdCents
  readonly cashPercentageLimitUsedByActionCents: UsdCents
  readonly cashPercentageLimitCapacityAfterActionCents: UsdCents
  readonly currentYearClaimedDeductionCents: UsdCents
  /**
   * Contributions exceeding the 170(b)(1)(G) percentage ceiling, which carry
   * forward five years under (G)(ii). The 170(p) dollar cap is NOT a
   * carryover-generating limitation: 170(d)(1)(C)(ii) lists the carryover rules
   * and 170(p) is not among them. So in the common case — gifts above
   * $1,000/$2,000 but below the ceiling — this is zero and the excess is lost.
   */
  readonly limitationCarryforwardCents: UsdCents
  /**
   * Discloses that a nonzero carryforward from a standard-deduction year rests
   * on an unsettled reading. 170(d)(1)(A) keys the carryover to the percentage
   * ceiling and never references the itemizing election, and Treas. Reg.
   * 1.170A-10(a)(2) preserves it expressly for a standard-deduction year — but
   * that regulation still cites section 144, repealed in 1976, and no
   * post-OBBBA authority applies it. Consumers must not present an affected
   * carryforward as filing-grade without review.
   */
  readonly standardDeductionCarryforwardBasis:
    | 'notApplicable'
    | 'percentageCeilingExcessUnsettled'
  readonly unclaimedWithoutCarryforwardCents: UsdCents
  readonly deductionAmountAppliedByTaxLedgerCents: UsdCents
  readonly standardPlusClaimedByActionCents: UsdCents
  readonly adjustedGrossIncomeBeforeCharitableDeductionCents: number
  readonly itemizedDeductionBeforeActionCents: UsdCents
  readonly itemizedDeductionAfterActionCents: UsdCents
  readonly cashContributionQualified: true
  readonly eligibilityEvidenceId: string
  readonly actionEvidenceId: string
}
export interface AnnualQcdStandardSection170pTaxUnitEvidence {
  readonly taxUnit: Readonly<TaxableWithdrawalTaxUnitEvidence & { readonly taxYear: 2026 }>
  readonly filingTreatment: 'standardDeduction'
  readonly annualTaxLiabilityEvidenceId: string
  readonly taxInputSnapshotId: string
  readonly liabilityRun: Readonly<AnnualQcdSection170pRunBinding>
  readonly sourceTaxYears: Readonly<{ readonly standardDeduction: 2026; readonly priorQualifyingCashContributions: 2026; readonly cashPercentageLimit: 2026 }>
  readonly sourceTaxUnitIds: Readonly<{ readonly standardDeduction: string; readonly priorQualifyingCashContributions: string; readonly cashPercentageLimit: string }>
  readonly adjustedGrossIncomeBeforeCharitableDeductionCents: number
  readonly unchangedItemizedDeductionCents: UsdCents
  readonly standardDeductionCents: UsdCents
  readonly selectedStandardDeductionEvidenceId: string
  readonly statutoryLimitCents: 100000 | 200000
  readonly statutoryLimitSourceId: string
  readonly contributionBaseCents: UsdCents
  readonly contributionBaseEvidenceId: string
  readonly cashPercentageLimitRateNumerator: 3
  readonly cashPercentageLimitRateDenominator: 5
  readonly cashPercentageLimitQuantization: 'nearestCentHalfUp'
  readonly cashPercentageLimitAmountCents: UsdCents
  readonly priorQualifyingCashContributionUsedCents: UsdCents
  readonly priorQualifyingCashContributionEvidenceId: string
  readonly priorCashPercentageLimitUsedCents: UsdCents
  readonly cashPercentageLimitEvidenceId: string
  readonly exactAmountAuthority: 'cents'
  readonly openingState: Readonly<AnnualQcdStandardSection170pStateEvidence>
  readonly finalState: Readonly<AnnualQcdStandardSection170pStateEvidence>
  readonly annualClaimedDeductionCents: UsdCents
  readonly finalTotalDeductionAppliedCents: UsdCents
  readonly parameterEvidenceId: string
  readonly orderedActionEvidence: readonly Readonly<AnnualQcdStandardSection170pActionEvidence>[]
  readonly residualEvidenceId: string
  readonly evidenceId: string
}
export interface AnnualQcdStandardSection170pIssue {
  readonly kind: 'hostileInput' | 'postPassInvalid' | 'taxUnitInvalid' | 'ledgerInvalid'
  readonly detail: string
}
interface LedgerBase { readonly committed: false; readonly movement: 'notCommitted'; readonly itemizedAndSection68Status: 'notOwnedByStandardLedger' }
export interface AnnualQcdStandardSection170pStaged extends LedgerBase {
  readonly status: 'annualQcdStandardSection170pStaged'
  readonly taxYear: 2026
  readonly residualEvidenceId: string
  readonly taxUnits: readonly Readonly<AnnualQcdStandardSection170pTaxUnitEvidence>[]
  readonly issues: readonly []
}
export interface AnnualQcdStandardSection170pBlocked extends LedgerBase {
  readonly status: 'annualQcdStandardSection170pBlocked'
  readonly taxYear: null
  readonly residualEvidenceId: null
  readonly taxUnits: readonly []
  readonly issues: readonly [Readonly<AnnualQcdStandardSection170pIssue>]
}
export type StageAnnualQcdStandardSection170pLedgerResult = AnnualQcdStandardSection170pStaged | AnnualQcdStandardSection170pBlocked
class LedgerError extends Error {
  readonly kind: AnnualQcdStandardSection170pIssue['kind']
  constructor(kind: AnnualQcdStandardSection170pIssue['kind'], detail: string) { super(detail); this.kind = kind }
}
function fail(kind: AnnualQcdStandardSection170pIssue['kind'], detail: string): never { throw new LedgerError(kind, detail) }
function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}
function id(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail('taxUnitInvalid', `${label} is required.`)
  return value
}
function cents(value: unknown, label: string): UsdCents {
  try { return asUsdCents(value) } catch { return fail('taxUnitInvalid', `${label} must be exact cents.`) }
}
function signedCents(value: unknown, label: string): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || Object.is(value, -0)) fail('taxUnitInvalid', `${label} must be exact signed cents.`); return value }
function exact(value: bigint, label: string): UsdCents {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) fail('ledgerInvalid', `${label} overflowed.`)
  return asUsdCents(Number(value))
}
const add = (left: UsdCents, right: UsdCents, label: string): UsdCents => exact(BigInt(left) + BigInt(right), label)
const subtract = (left: UsdCents, right: UsdCents, label: string): UsdCents => exact(BigInt(left) - BigInt(right), label)
function sixtyPercent(base: UsdCents): UsdCents {
  const product = 3n * BigInt(base); const quotient = product / 5n; const remainder = product % 5n
  return exact(quotient + (2n * remainder >= 5n ? 1n : 0n), 'Cash percentage limit')
}
function run(value: Readonly<AnnualQcdSection170pRunBinding>): AnnualQcdSection170pRunBinding {
  if (value.liabilityRunKind === 'candidateT1') return { liabilityRunKind: 'candidateT1', candidateFundingVectorEvidenceId: id(value.candidateFundingVectorEvidenceId, 'Funding vector') }
  if ((value.liabilityRunKind !== 'committedAnnual' && value.liabilityRunKind !== 'baselineT0') || value.candidateFundingVectorEvidenceId !== null) fail('taxUnitInvalid', 'Liability run is inconsistent.')
  return { liabilityRunKind: value.liabilityRunKind, candidateFundingVectorEvidenceId: null }
}
function blocked(error: unknown): AnnualQcdStandardSection170pBlocked {
  const issue = error instanceof LedgerError ? { kind: error.kind, detail: error.message }
    : { kind: 'hostileInput' as const, detail: 'Section 170(p) input must be detached canonical data.' }
  return deepFreeze({ status: 'annualQcdStandardSection170pBlocked', committed: false,
    movement: 'notCommitted', itemizedAndSection68Status: 'notOwnedByStandardLedger',
    taxYear: null, residualEvidenceId: null, taxUnits: [], issues: [issue] })
}
function buildTaxUnit(input: Readonly<AnnualQcdStandardSection170pTaxUnitInput>, residual: Readonly<AnnualQcdResidualForm8606Staged>, requests: ReadonlyMap<string, StageAnnualQcdTaxCharacterPostPassInput['physicalInput']['prerequisite']['requests'][number]>, membersUsed: Set<PersonId>, actionsUsed: Set<string>): Readonly<AnnualQcdStandardSection170pTaxUnitEvidence> {
  if (input.taxUnit.taxYear !== 2026 || residual.taxYear !== 2026) fail('taxUnitInvalid', 'Only sourced tax year 2026 is supported.')
  const rawMembers = [...input.taxUnit.taxUnitMemberPersonIds]
  if (rawMembers.some((personId) => typeof personId !== 'string' || personId.trim().length === 0)) fail('taxUnitInvalid', 'Tax-unit members must be identifiers.')
  const members = rawMembers.sort(compareUtf16CodeUnits)
  if (members.length === 0 || new Set(members).size !== members.length || JSON.stringify(members) !== JSON.stringify(input.taxUnit.taxUnitMemberPersonIds) || members.some((personId) => membersUsed.has(personId))) fail('taxUnitInvalid', 'Tax-unit membership must be canonical and unique.')
  members.forEach((personId) => membersUsed.add(personId))
  const taxUnit = { taxUnitId: id(input.taxUnit.taxUnitId, 'Tax unit ID'),
    taxUnitMemberPersonIds: members as [PersonId, ...PersonId[]], federalFilingStatus: input.taxUnit.federalFilingStatus,
    stateFilingStatusId: id(input.taxUnit.stateFilingStatusId, 'State filing status ID'),
    taxUnitEvidenceId: id(input.taxUnit.taxUnitEvidenceId, 'Tax-unit evidence ID'), taxYear: 2026 as const }
  const statuses = ['single', 'marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold', 'qualifyingSurvivingSpouse']
  if (!statuses.includes(taxUnit.federalFilingStatus)) fail('taxUnitInvalid', 'Federal filing status is unsupported.')
  const parameters = annualCharitableDeductionParameters(2026)
  if (parameters.cashContributionPercentageLimitRate.numerator !== 3n || parameters.cashContributionPercentageLimitRate.denominator !== 5n) fail('ledgerInvalid', 'Section 170(p) parameters are inconsistent.')
  const statutoryLimit = parameters.nonitemizerDeductionCapByFilingStatusCents[taxUnit.federalFilingStatus]
  const expectedLimit = taxUnit.federalFilingStatus === 'marriedFilingJointly' ? 200_000 : 100_000
  if (statutoryLimit !== expectedLimit) fail('ledgerInvalid', 'Section 170(p) statutory limit is inconsistent.')
  const standard = cents(input.standardDeductionCents, 'Standard deduction')
  const base = cents(input.contributionBaseCents, 'Contribution base')
  if (Object.values(input.sourceTaxYears).some((year) => year !== 2026)) fail('taxUnitInvalid', 'Every deduction source must belong to tax year 2026.')
  if (Object.values(input.sourceTaxUnitIds).some((taxUnitId) => id(taxUnitId, 'Source tax-unit ID') !== taxUnit.taxUnitId)) fail('taxUnitInvalid', 'Every deduction source must belong to the action tax unit.')
  const cashLimit = sixtyPercent(base)
  const priorCash = cents(input.priorCashPercentageLimitUsedCents, 'Prior cash-limit use')
  const priorQualifying = cents(input.priorQualifyingCashContributionUsedCents, 'Prior qualifying cash gifts')
  const limitSourceId = deriveActionStructuralId('annual-qcd-section170p-limit-source', [parameters.evidenceId, taxUnit.federalFilingStatus, statutoryLimit])
  const liabilityRun = run(input.liabilityRun); const liabilityId = id(input.annualTaxLiabilityEvidenceId, 'Liability evidence ID'); const taxInputId = id(input.taxInputSnapshotId, 'Tax-input snapshot ID')
  const standardId = id(input.selectedStandardDeductionEvidenceId, 'Standard deduction evidence ID')
  const baseId = id(input.contributionBaseEvidenceId, 'Contribution-base evidence ID')
  const priorGiftId = id(input.priorQualifyingCashContributionEvidenceId, 'Prior gift evidence ID')
  const cashId = id(input.cashPercentageLimitEvidenceId, 'Cash-limit evidence ID')
  const sources = deepFreeze({ sourceTaxYears: { standardDeduction: 2026 as const, priorQualifyingCashContributions: 2026 as const, cashPercentageLimit: 2026 as const }, sourceTaxUnitIds: { ...input.sourceTaxUnitIds }, adjustedGrossIncomeBeforeCharitableDeductionCents: signedCents(input.adjustedGrossIncomeBeforeCharitableDeductionCents, 'Adjusted gross income'), unchangedItemizedDeductionCents: cents(input.unchangedItemizedDeductionCents, 'Unchanged itemized deduction'), standardDeductionCents: standard, selectedStandardDeductionEvidenceId: standardId, contributionBaseCents: base, contributionBaseEvidenceId: baseId, priorQualifyingCashContributionUsedCents: priorQualifying, priorQualifyingCashContributionEvidenceId: priorGiftId, priorCashPercentageLimitUsedCents: priorCash, cashPercentageLimitEvidenceId: cashId })
  let remaining = asUsdCents(Math.max(0, statutoryLimit - priorQualifying))
  let capacity = asUsdCents(Math.max(0, cashLimit - priorCash))
  let qualifyingUsed = priorQualifying
  const applications = residual.postPass.applications.map((application) => {
    const request = requests.get(application.actionId)
    if (request === undefined || request.executionDate === null) fail('postPassInvalid', 'Post-pass action did not resolve to its request.')
    return { application, request }
  }).filter(({ application }) => members.includes(application.donorPersonId))
    .sort((left, right) => compareUtf16CodeUnits(left.request.executionDate!, right.request.executionDate!) || left.request.executionSequence - right.request.executionSequence)
  if (applications.length === 0) fail('taxUnitInvalid', 'Every tax unit must own a QCD action.')
  if (new Set(applications.map(({ request }) => `${request.executionDate}\u0000${request.executionSequence}`)).size !== applications.length) fail('postPassInvalid', 'Tax-unit action chronology must be unique.')
  const actionEvidence = applications.map(({ application, request }) => {
    if (actionsUsed.has(application.actionId)) fail('taxUnitInvalid', 'QCD actions may belong to only one tax unit.')
    actionsUsed.add(application.actionId)
    const eligible = application.charitableDeductionEligibleAmount
    if (BigInt(eligible) !== BigInt(application.taxableQcdAmount) + BigInt(application.nonQcdCharitableRemainder) || BigInt(eligible) !== BigInt(application.charitableDistributionAmount) - BigInt(application.excludableQcdAmount)) fail('postPassInvalid', 'Post-pass charitable amount did not reconcile.')
    const claimed = asUsdCents(Math.min(eligible, remaining, capacity))
    const remainingAfter = subtract(remaining, claimed, 'Remaining statutory limit')
    const capacityAfter = subtract(capacity, claimed, 'Remaining cash capacity')
    // IRC 170(d)(1)(A) and 170(b)(1)(G)(ii) key the five-year carryover to
    // contributions exceeding the percentage-of-contribution-base ceiling. The
    // trigger is mechanical — contributions paid minus the ceiling — and never
    // references the itemizing election or "the amount deductible". So a
    // standard-deduction year still generates a carryover above the ceiling,
    // while the slice between the 170(p) dollar cap and the ceiling is
    // permanently lost: 170(p) is not a carryover rule under 170(d)(1)(C)(ii).
    //
    // Worked check. Base $50,000, cash gifts $70,000: ceiling $30,000, cap
    // $1,000. Claimed $1,000, carryforward $40,000, permanently lost $29,000.
    // Base $100,000, cash gifts $8,000: ceiling $60,000, so no excess —
    // carryforward $0 and $7,000 lost. The second is the common case.
    const percentageCeilingExcess = asUsdCents(Math.max(0, eligible - capacity))
    const permanentlyUnclaimed = subtract(
      subtract(eligible, claimed, 'Unclaimed contribution'),
      percentageCeilingExcess, 'Noncarryover excess')
    const facts = { treatment: eligible === 0 ? 'notApplicable' as const : 'evaluated' as const,
      actionId: application.actionId, donorPersonId: application.donorPersonId,
      scheduledDate: request.executionDate!, scheduledSequence: request.executionSequence,
      postPassApplicationEvidenceId: application.evidenceId, eligibleContributionCents: eligible,
      qualifyingCashContributionAmountUsedBeforeActionCents: qualifyingUsed,
      remainingLimitBeforeActionCents: remaining, claimedByActionCents: claimed,
      remainingLimitAfterActionCents: remainingAfter,
      cashPercentageLimitCapacityBeforeActionCents: capacity,
      cashPercentageLimitUsedByActionCents: claimed,
      cashPercentageLimitCapacityAfterActionCents: capacityAfter,
      currentYearClaimedDeductionCents: claimed,
      limitationCarryforwardCents: percentageCeilingExcess,
      standardDeductionCarryforwardBasis: percentageCeilingExcess > 0
        ? 'percentageCeilingExcessUnsettled' as const
        : 'notApplicable' as const,
      unclaimedWithoutCarryforwardCents: permanentlyUnclaimed,
      deductionAmountAppliedByTaxLedgerCents: claimed,
      standardPlusClaimedByActionCents: add(standard, claimed, 'Standard plus QCD claim'),
      adjustedGrossIncomeBeforeCharitableDeductionCents: sources.adjustedGrossIncomeBeforeCharitableDeductionCents,
      itemizedDeductionBeforeActionCents: sources.unchangedItemizedDeductionCents,
      itemizedDeductionAfterActionCents: sources.unchangedItemizedDeductionCents,
      cashContributionQualified: true as const,
      eligibilityEvidenceId: application.prerequisiteEvidenceId }
    remaining = remainingAfter; capacity = capacityAfter
    qualifyingUsed = add(qualifyingUsed, claimed, 'Qualifying gifts used')
    return deepFreeze({ ...facts, actionEvidenceId: deriveActionStructuralId('annual-qcd-standard-section170p-action', [taxUnit, liabilityId, taxInputId, liabilityRun, sources, limitSourceId, residual.evidenceId, facts]) })
  })
  const openingState = deepFreeze({ remainingStatutoryLimitCents: asUsdCents(Math.max(0, statutoryLimit - priorQualifying)), cashPercentageLimitCapacityRemainingCents: asUsdCents(Math.max(0, cashLimit - priorCash)) })
  const finalState = deepFreeze({ remainingStatutoryLimitCents: remaining, cashPercentageLimitCapacityRemainingCents: capacity })
  const annualClaimed = exact(actionEvidence.reduce((sum, entry) => sum + BigInt(entry.claimedByActionCents), 0n), 'Annual QCD claims')
  const withoutId = { taxUnit, filingTreatment: 'standardDeduction' as const,
    annualTaxLiabilityEvidenceId: liabilityId, taxInputSnapshotId: taxInputId, liabilityRun, ...sources,
    statutoryLimitCents: statutoryLimit as 100000 | 200000, statutoryLimitSourceId: limitSourceId,
    cashPercentageLimitRateNumerator: 3 as const,
    cashPercentageLimitRateDenominator: 5 as const, cashPercentageLimitQuantization: 'nearestCentHalfUp' as const,
    cashPercentageLimitAmountCents: cashLimit, exactAmountAuthority: 'cents' as const,
    openingState, finalState, orderedActionEvidence: actionEvidence,
    annualClaimedDeductionCents: annualClaimed,
    finalTotalDeductionAppliedCents: add(standard, annualClaimed, 'Final standard deduction'),
    parameterEvidenceId: parameters.evidenceId,
    residualEvidenceId: residual.evidenceId }
  return deepFreeze({ ...withoutId, evidenceId: deriveActionStructuralId('annual-qcd-standard-section170p-tax-unit', [withoutId]) })
}
function stageUnchecked(input: StageAnnualQcdStandardSection170pLedgerInput): AnnualQcdStandardSection170pStaged {
  const residual = stageAnnualQcdResidualForm8606({ postPassInput: input.postPassInput })
  if (residual.status !== 'annualQcdResidualForm8606Staged') fail('postPassInvalid', 'QCD residual/post-pass rebuilding failed.')
  for (const application of residual.postPass.applications.filter((entry) => entry.nonQcdCharitableRemainder > 0)) {
    const binding = residual.pools.flatMap((pool) => pool.qcdRemainderBindings).filter((entry) => entry.postPassApplicationEvidenceId === application.evidenceId)
    if (binding.length !== 1 || binding[0]!.allocation.actionId !== application.actionId || binding[0]!.allocation.allocationId !== application.allocationId || binding[0]!.allocation.sourceAccountId !== application.sourceAccountId || binding[0]!.allocation.grossAmount !== application.nonQcdCharitableRemainder || binding[0]!.allocation.allocatedBasisAmount !== application.nonQcdCharitableRemainder || binding[0]!.allocation.taxableAmount !== 0) fail('postPassInvalid', 'Residual QCD remainder binding is incomplete.')
  }
  const requests = new Map(input.postPassInput.physicalInput.prerequisite.requests.map((entry) => [entry.actionId, entry]))
  const sorted = [...input.taxUnits].sort((left, right) => compareUtf16CodeUnits(left.taxUnit.taxUnitId, right.taxUnit.taxUnitId))
  const planPeople = new Set(input.postPassInput.physicalInput.plan.household.people.map((person) => person.id))
  if (sorted.some((entry) => entry.taxUnit.taxUnitMemberPersonIds.some((personId) => !planPeople.has(personId)))) fail('taxUnitInvalid', 'Every tax-unit member must resolve in the authoritative Plan.')
  if (new Set(sorted.map((entry) => entry.taxUnit.taxUnitId)).size !== sorted.length || new Set(sorted.map((entry) => entry.taxUnit.taxUnitEvidenceId)).size !== sorted.length) fail('taxUnitInvalid', 'Tax-unit evidence must be unique.')
  const members = new Set<PersonId>(); const actions = new Set<string>()
  const taxUnits = sorted.map((entry) => buildTaxUnit(entry, residual, requests, members, actions))
  if (actions.size !== residual.postPass.applications.filter((entry) => members.has(entry.donorPersonId)).length) fail('taxUnitInvalid', 'Tax units must cover their QCD action subset exactly once.')
  return deepFreeze({ status: 'annualQcdStandardSection170pStaged', committed: false,
    movement: 'notCommitted', itemizedAndSection68Status: 'notOwnedByStandardLedger',
    taxYear: 2026, residualEvidenceId: residual.evidenceId, taxUnits, issues: [] })
}
export function stageAnnualQcdStandardSection170pLedger(input: Readonly<StageAnnualQcdStandardSection170pLedgerInput>): Readonly<StageAnnualQcdStandardSection170pLedgerResult> {
  try { return stageUnchecked(structuredClone(input) as StageAnnualQcdStandardSection170pLedgerInput) }
  catch (error) { return blocked(error) }
}
