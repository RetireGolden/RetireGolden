import { parsePlan, type Plan } from '../model/plan.js'
import {
  PARAMETER_DATA_AS_OF,
  PARAMETER_DATA_BASIS,
  PARAMETER_PROVENANCE,
  packForYear,
  type ParameterSource,
} from '../params/index.js'
import {
  buildAnnualOwnedNonRothIraPoolCapacity,
  type AnnualOwnedNonRothIraPoolCapacityEvidence,
} from './annualOwnedNonRothIraPoolCapacity.js'
import {
  stageAnnualQcdPhysicalExecution,
  type AnnualQcdPhysicalApplication,
  type StageAnnualQcdPhysicalExecutionInput,
} from './annualQcdPhysicalExecution.js'
import { evaluateRetirementActionSchedule } from './execution.js'
import type { AccountId, ActionId, AllocationId, PersonId } from './identity.js'
import { asUsdCents, type UsdCents } from './money.js'
import type { ClassifyOwnedNonRothIraAnnualWithdrawalsInput } from './ownedNonRothIraWithdrawalCharacter.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'

export interface AnnualQcdPersonalLimitEvidence {
  readonly predicate: 'annualQcdExactYearPersonalLimit'
  readonly taxYear: number
  readonly personalLimitAmount: UsdCents
  readonly parameterPackYear: number
  readonly parameterSource: Readonly<ParameterSource>
  readonly parameterDataAsOf: string
  readonly parameterDataBasis: string
  readonly evidenceId: string
}
export interface AnnualQcdProvisionalCharacterPartition {
  readonly status: 'provisionalAwaitingResidualAndSection170Reconciliation'
  readonly qcdIncomeExclusionAmount: UsdCents
  readonly ordinaryIncomeAmount: UsdCents
  readonly basisReturnAmount: UsdCents
}
export interface AnnualQcdPostPassApplication {
  readonly predicate: 'annualQcdPostPassApplication'
  readonly actionId: ActionId
  readonly allocationId: AllocationId
  readonly donorPersonId: PersonId
  readonly sourceAccountId: AccountId
  readonly physicalStagingEvidenceId: string
  readonly prerequisiteEvidenceId: string
  readonly capacityEvidenceId: string
  readonly personalLimitEvidenceId: string
  readonly charitableDistributionAmount: UsdCents
  readonly otherwiseTaxableAmountBefore: UsdCents
  readonly otherwiseTaxableAmountUsed: UsdCents
  readonly otherwiseTaxableAmountAfter: UsdCents
  readonly qualifiedCharitableDistributionAmount: UsdCents
  readonly nonQcdCharitableRemainder: UsdCents
  readonly personalLimitBefore: UsdCents
  readonly personalLimitUsed: UsdCents
  readonly personalLimitAfter: UsdCents
  readonly deductibleContributionOffsetBefore: UsdCents
  readonly deductibleContributionOffsetApplied: UsdCents
  readonly deductibleContributionOffsetAfter: UsdCents
  readonly excludableQcdAmount: UsdCents
  readonly taxableQcdAmount: UsdCents
  readonly charitableDeductionEligibleAmount: UsdCents
  readonly charitableDeductionRequirement:
    | 'notApplicableZeroEligibleAmount'
    | 'requiresSection170Ledger'
  readonly provisionalCharacter: Readonly<AnnualQcdProvisionalCharacterPartition>
  readonly rmdPoolId: string
  readonly rmdRemainingBefore: UsdCents
  readonly rmdSatisfiedByAction: UsdCents
  readonly rmdRemainingAfter: UsdCents
  readonly evidenceId: string
}
export interface AnnualQcdPostPassPoolTransition {
  readonly baseForm8606Facts: Readonly<AnnualOwnedNonRothIraPoolCapacityEvidence>
  readonly physicalQcdGrossAmount: UsdCents
  readonly taxablePoolGrossBalanceBefore: UsdCents
  readonly taxablePoolBasisBefore: UsdCents
  readonly otherwiseTaxableAmountBefore: UsdCents
  readonly qualifiedCharitableDistributionAmount: UsdCents
  readonly nonQcdCharitableRemainder: UsdCents
  readonly adjustedResidualBasisDenominatorAmount: UsdCents
  readonly adjustedResidualBasisNumeratorAmount: UsdCents
  readonly otherwiseTaxableAmountAfter: UsdCents
  readonly transitionEvidenceId: string
}
export interface AnnualQcdTaxCharacterPostPassIssue {
  readonly kind:
    | 'hostileInput'
    | 'physicalInvalid'
    | 'incompletePlanBatch'
    | 'taxParameterUnavailable'
    | 'poolCapacityInvalid'
    | 'contributionOffsetInvalid'
  readonly detail: string
}
export interface StageAnnualQcdTaxCharacterPostPassInput {
  readonly physicalInput: Readonly<StageAnnualQcdPhysicalExecutionInput>
  readonly poolCapacityInputs:
    readonly Readonly<ClassifyOwnedNonRothIraAnnualWithdrawalsInput>[]
}
interface PostPassBase {
  readonly committed: false
  readonly movement: 'notCommitted'
  readonly taxCharacterStatus:
    'awaitingResidualAndSection170Reconciliation'
}
export interface AnnualQcdTaxCharacterPostPassStaged extends PostPassBase {
  readonly status: 'annualQcdTaxCharacterPostPassStaged'
  readonly taxYear: number
  readonly personalLimitEvidence: Readonly<AnnualQcdPersonalLimitEvidence>
  readonly pools: readonly Readonly<AnnualQcdPostPassPoolTransition>[]
  readonly applications: readonly Readonly<AnnualQcdPostPassApplication>[]
  readonly issues: readonly []
}
export interface AnnualQcdTaxCharacterPostPassBlocked extends PostPassBase {
  readonly status: 'annualQcdTaxCharacterPostPassBlocked'
  readonly taxYear: null
  readonly personalLimitEvidence: null
  readonly pools: readonly []
  readonly applications: readonly []
  readonly issues: readonly [Readonly<AnnualQcdTaxCharacterPostPassIssue>]
}
export type StageAnnualQcdTaxCharacterPostPassResult =
  | AnnualQcdTaxCharacterPostPassStaged
  | AnnualQcdTaxCharacterPostPassBlocked
class StageError extends Error {
  readonly kind: AnnualQcdTaxCharacterPostPassIssue['kind']
  constructor(
    kind: AnnualQcdTaxCharacterPostPassIssue['kind'],
    detail: string,
  ) {
    super(detail)
    this.kind = kind
  }
}
function fail(kind: AnnualQcdTaxCharacterPostPassIssue['kind'], detail: string): never {
  throw new StageError(kind, detail)
}
function cents(value: bigint, label: string): UsdCents {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    fail('hostileInput', `${label} exceeded the exact-cent range.`)
  }
  return asUsdCents(Number(value))
}
function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}
function blocked(error: unknown): AnnualQcdTaxCharacterPostPassBlocked {
  const issue = error instanceof StageError
    ? { kind: error.kind, detail: error.message }
    : { kind: 'hostileInput' as const, detail: 'QCD post-pass input must be canonical lossless data.' }
  return deepFreeze({
    status: 'annualQcdTaxCharacterPostPassBlocked', committed: false,
    movement: 'notCommitted',
    taxCharacterStatus: 'awaitingResidualAndSection170Reconciliation',
    taxYear: null, personalLimitEvidence: null, pools: [], applications: [], issues: [issue],
  })
}
function exactPersonalLimit(taxYear: number): AnnualQcdPersonalLimitEvidence {
  const lookup = packForYear(taxYear)
  const sources = PARAMETER_PROVENANCE.filter((source) => source.id === 'rmd-qcd')
  const dollars = lookup.pack.rmd.qcdAnnualLimit
  if (lookup.isStandIn || lookup.pack.year !== taxYear || sources.length !== 1 ||
      !Number.isSafeInteger(dollars) || dollars <= 0) {
    fail('taxParameterUnavailable', `Tax year ${taxYear} lacks an exact sourced QCD limit.`)
  }
  const personalLimitAmount = cents(BigInt(dollars) * 100n, 'QCD personal limit')
  const parameterSource = { ...sources[0]! }
  const evidenceId = deriveActionStructuralId('annual-qcd-personal-limit', [
    taxYear, personalLimitAmount, lookup.pack.year, parameterSource,
    PARAMETER_DATA_AS_OF, PARAMETER_DATA_BASIS,
  ])
  return {
    predicate: 'annualQcdExactYearPersonalLimit', taxYear, personalLimitAmount,
    parameterPackYear: lookup.pack.year, parameterSource,
    parameterDataAsOf: PARAMETER_DATA_AS_OF,
    parameterDataBasis: PARAMETER_DATA_BASIS, evidenceId,
  }
}
function requireCompletePlanBatch(
  plan: Readonly<Plan>, taxYear: number,
  applications: readonly Readonly<AnnualQcdPhysicalApplication>[],
): void {
  const planRequests = plan.strategies.retirementActions.filter(
    (request) => request.kind === 'qcd' && request.year === taxYear,
  )
  const schedule = evaluateRetirementActionSchedule(taxYear, planRequests)
  if (schedule.scheduleIssues.length > 0 ||
      JSON.stringify(schedule.requests) !== JSON.stringify(applications.map((entry) => entry.request))) {
    fail('incompletePlanBatch', 'QCD post-pass requires the complete canonical Plan batch for its year.')
  }
}

function canonicalCapacities(
  inputs: readonly Readonly<ClassifyOwnedNonRothIraAnnualWithdrawalsInput>[],
  plan: Readonly<Plan>, taxYear: number,
  applications: readonly Readonly<AnnualQcdPhysicalApplication>[],
): Map<PersonId, Readonly<AnnualOwnedNonRothIraPoolCapacityEvidence>> {
  const donors = new Set(applications.map((entry) => entry.request.donorPersonId))
  const byDonor = new Map<PersonId, Readonly<AnnualOwnedNonRothIraPoolCapacityEvidence>>()
  const evidenceIds = new Set<string>()
  for (const input of inputs) {
    let capacity: Readonly<AnnualOwnedNonRothIraPoolCapacityEvidence>
    try { capacity = buildAnnualOwnedNonRothIraPoolCapacity(input) } catch {
      fail('poolCapacityInvalid', 'QCD taxable-pool capacity input failed canonical rebuilding.')
    }
    const planAccounts = plan.accounts.filter((account) =>
      account.ownerPersonId === capacity.ownerPersonId && account.type === 'traditional' &&
      account.kind === 'ira' && account.inherited === undefined)
      .map((account) => account.id).sort(compareUtf16CodeUnits)
    if (capacity.taxYear !== taxYear || !donors.has(capacity.ownerPersonId) ||
        byDonor.has(capacity.ownerPersonId) || evidenceIds.has(capacity.capacityEvidenceId) ||
        JSON.stringify(capacity.accountIds) !== JSON.stringify(planAccounts)) {
      fail('poolCapacityInvalid', 'QCD capacity must uniquely bind each donor and complete Plan-owned IRA pool.')
    }
    byDonor.set(capacity.ownerPersonId, capacity)
    evidenceIds.add(capacity.capacityEvidenceId)
  }
  if (byDonor.size !== donors.size) {
    fail('poolCapacityInvalid', 'Every QCD donor requires exactly one annual taxable-pool capacity.')
  }
  for (const application of applications) {
    const capacity = byDonor.get(application.request.donorPersonId)!
    const input = inputs.find((entry) => entry.ownerPersonId === capacity.ownerPersonId)!
    const request = application.request
    const leaked = [...input.line7Distributions, ...input.line8Conversions]
      .some((entry) => entry.actionId === request.actionId)
    if (!capacity.accountIds.includes(request.allocation.sourceAccountId) || leaked) {
      fail('poolCapacityInvalid', 'Physical QCD candidates must be absent from base Form 8606 lines 7 and 8.')
    }
  }
  return byDonor
}

function contributionTotal(application: Readonly<AnnualQcdPhysicalApplication>,
  physicalInput: Readonly<StageAnnualQcdPhysicalExecutionInput>,
  expectedPrior: UsdCents | undefined,
): { readonly total: UsdCents; readonly priorOffsetApplied: UsdCents } {
  const prerequisite = physicalInput.prerequisite.evidence.find(
    (entry) => entry.actionId === application.request.actionId,
  )
  const history = prerequisite?.eligibility.contributionHistory
  const prior = prerequisite?.eligibility.priorQcdOffsetEvidence
  if (history === null || history === undefined || prior === null || prior === undefined ||
      history.donorPersonId !== application.request.donorPersonId ||
      history.priorOffsetApplied !== prior.priorOffsetApplied ||
      (expectedPrior !== undefined && prior.priorOffsetApplied !== expectedPrior)) {
    fail('contributionOffsetInvalid', 'QCD contribution-offset evidence must follow donor chronology exactly.')
  }
  const total = cents(history.taxYears.reduce(
    (sum, fact) => sum + BigInt(fact.deductibleContributionAmount), 0n,
  ), 'QCD deductible-contribution total')
  return { total, priorOffsetApplied: prior.priorOffsetApplied }
}

function stageUnchecked(input: StageAnnualQcdTaxCharacterPostPassInput): AnnualQcdTaxCharacterPostPassStaged {
  const physical = stageAnnualQcdPhysicalExecution(input.physicalInput)
  if (physical.status !== 'annualQcdPhysicalExecutionStaged')
    fail('physicalInvalid', 'QCD post-pass requires a canonically rebuilt staged physical batch.')
  const parsed = parsePlan(input.physicalInput.plan)
  if (!parsed.ok) fail('physicalInvalid', 'QCD post-pass requires one valid authoritative Plan.')
  requireCompletePlanBatch(parsed.plan, physical.taxYear, physical.applications)
  const personalLimitEvidence = exactPersonalLimit(physical.taxYear)
  const capacities = canonicalCapacities(
    input.poolCapacityInputs, parsed.plan, physical.taxYear, physical.applications,
  )
  const physicalGross = new Map([...capacities].map(([donor]) => [donor, cents(
    physical.applications.filter((entry) => entry.request.donorPersonId === donor)
      .reduce((sum, entry) => sum + BigInt(entry.charitableDistributionAmount), 0n),
    'Physical QCD gross')]))
  const poolGross = new Map([...capacities].map(([donor, value]) => [donor, cents(
    BigInt(value.form8606BaseDenominatorAmount) + BigInt(physicalGross.get(donor)!),
    'Pre-QCD taxable-pool gross')]))
  const poolRemaining = new Map([...capacities].map(([donor, value]) => [
    donor, cents(BigInt(poolGross.get(donor)!) -
      BigInt(Math.min(value.basisNumeratorAmount, poolGross.get(donor)!)),
    'Pre-QCD otherwise-taxable amount'),
  ]))
  const personalRemaining = new Map<PersonId, UsdCents>()
  const offsetConsumed = new Map<PersonId, UsdCents>()
  const offsetTotals = new Map<PersonId, UsdCents>()
  const applications: AnnualQcdPostPassApplication[] = []
  for (const physicalApplication of physical.applications) {
    const request = physicalApplication.request
    const donor = request.donorPersonId
    const capacity = capacities.get(donor)!
    const poolBefore = poolRemaining.get(donor)!
    const personalBefore = personalRemaining.get(donor) ?? personalLimitEvidence.personalLimitAmount
    const priorState = offsetConsumed.get(donor)
    const contribution = contributionTotal(
      physicalApplication, input.physicalInput, priorState,
    )
    const consumed = priorState ?? contribution.priorOffsetApplied
    const total = contribution.total
    const knownTotal = offsetTotals.get(donor)
    if (knownTotal !== undefined && knownTotal !== total) {
      fail('contributionOffsetInvalid', 'One donor must use one complete deductible-contribution history.')
    }
    offsetTotals.set(donor, total)
    const offsetBefore = cents(BigInt(total) - BigInt(consumed), 'QCD contribution offset')
    const distribution = physicalApplication.charitableDistributionAmount
    const taxableUsed = asUsdCents(Math.min(distribution, poolBefore))
    const nonQcd = cents(BigInt(distribution) - BigInt(taxableUsed), 'Non-QCD charitable remainder')
    const candidate = asUsdCents(Math.min(taxableUsed, personalBefore))
    const poolAfter = cents(BigInt(poolBefore) - BigInt(taxableUsed), 'QCD taxable capacity')
    const offsetApplied = asUsdCents(Math.min(candidate, offsetBefore))
    const excludable = cents(BigInt(candidate) - BigInt(offsetApplied), 'Excludable QCD')
    const taxableQcd = cents(BigInt(taxableUsed) - BigInt(excludable), 'Taxable QCD')
    const deductionEligible = cents(BigInt(taxableQcd) + BigInt(nonQcd), 'QCD deduction-eligible amount')
    const personalAfter = cents(BigInt(personalBefore) - BigInt(candidate), 'QCD personal limit')
    const offsetAfter = cents(BigInt(offsetBefore) - BigInt(offsetApplied), 'QCD contribution offset')
    const consumedAfter = cents(BigInt(consumed) + BigInt(offsetApplied), 'QCD consumed offset')
    const provisionalCharacter: AnnualQcdProvisionalCharacterPartition = {
      status: 'provisionalAwaitingResidualAndSection170Reconciliation',
      qcdIncomeExclusionAmount: excludable, ordinaryIncomeAmount: taxableQcd,
      basisReturnAmount: nonQcd,
    }
    const evidenceId = deriveActionStructuralId('annual-qcd-tax-character-post-pass', [
      request.actionId, physicalApplication.stagingEvidenceId,
      physicalApplication.prerequisiteEvidenceId, capacity.capacityEvidenceId,
      personalLimitEvidence.evidenceId, distribution, poolBefore, taxableUsed, poolAfter,
      personalBefore, candidate, personalAfter, offsetBefore, offsetApplied, offsetAfter,
      excludable, taxableQcd, nonQcd, deductionEligible, provisionalCharacter,
      physicalApplication.rmdPoolId, physicalApplication.rmdRemainingBefore,
      physicalApplication.rmdSatisfiedByAction, physicalApplication.rmdRemainingAfter,
    ])
    applications.push({
      predicate: 'annualQcdPostPassApplication', actionId: request.actionId,
      allocationId: request.allocation.allocationId, donorPersonId: donor,
      sourceAccountId: request.allocation.sourceAccountId,
      physicalStagingEvidenceId: physicalApplication.stagingEvidenceId,
      prerequisiteEvidenceId: physicalApplication.prerequisiteEvidenceId,
      capacityEvidenceId: capacity.capacityEvidenceId,
      personalLimitEvidenceId: personalLimitEvidence.evidenceId,
      charitableDistributionAmount: distribution,
      otherwiseTaxableAmountBefore: poolBefore, otherwiseTaxableAmountUsed: taxableUsed,
      otherwiseTaxableAmountAfter: poolAfter,
      qualifiedCharitableDistributionAmount: taxableUsed,
      nonQcdCharitableRemainder: nonQcd,
      personalLimitBefore: personalBefore, personalLimitUsed: candidate,
      personalLimitAfter: personalAfter,
      deductibleContributionOffsetBefore: offsetBefore,
      deductibleContributionOffsetApplied: offsetApplied,
      deductibleContributionOffsetAfter: offsetAfter,
      excludableQcdAmount: excludable, taxableQcdAmount: taxableQcd,
      charitableDeductionEligibleAmount: deductionEligible,
      charitableDeductionRequirement: deductionEligible === 0
        ? 'notApplicableZeroEligibleAmount' : 'requiresSection170Ledger',
      provisionalCharacter,
      rmdPoolId: physicalApplication.rmdPoolId,
      rmdRemainingBefore: physicalApplication.rmdRemainingBefore,
      rmdSatisfiedByAction: physicalApplication.rmdSatisfiedByAction,
      rmdRemainingAfter: physicalApplication.rmdRemainingAfter, evidenceId,
    })
    poolRemaining.set(donor, poolAfter)
    personalRemaining.set(donor, personalAfter)
    offsetConsumed.set(donor, consumedAfter)
  }
  const pools = [...capacities.values()].sort((left, right) => compareUtf16CodeUnits(
    left.ownerPersonId, right.ownerPersonId)).map((baseForm8606Facts) => {
    const donor = baseForm8606Facts.ownerPersonId
    const poolApplications = applications.filter((entry) =>
      entry.capacityEvidenceId === baseForm8606Facts.capacityEvidenceId)
    const physicalQcdGrossAmount = physicalGross.get(donor)!
    const taxablePoolGrossBalanceBefore = poolGross.get(donor)!
    const taxablePoolBasisBefore = asUsdCents(Math.min(
      baseForm8606Facts.basisNumeratorAmount, taxablePoolGrossBalanceBefore))
    const otherwiseTaxableAmountBefore = cents(BigInt(taxablePoolGrossBalanceBefore) -
      BigInt(taxablePoolBasisBefore), 'Pre-QCD otherwise-taxable amount')
    const qualifiedCharitableDistributionAmount = cents(poolApplications.reduce((sum, entry) =>
      sum + BigInt(entry.qualifiedCharitableDistributionAmount), 0n), 'Qualified QCDs')
    const nonQcdCharitableRemainder = cents(poolApplications.reduce((sum, entry) =>
      sum + BigInt(entry.nonQcdCharitableRemainder), 0n), 'Non-QCD remainder')
    const adjustedResidualBasisDenominatorAmount = cents(
      BigInt(baseForm8606Facts.form8606BaseDenominatorAmount) + BigInt(nonQcdCharitableRemainder),
      'Residual Form 8606 denominator')
    const adjustedResidualBasisNumeratorAmount = baseForm8606Facts.basisNumeratorAmount
    const otherwiseTaxableAmountAfter = cents(BigInt(adjustedResidualBasisDenominatorAmount) -
      BigInt(Math.min(adjustedResidualBasisNumeratorAmount,
        adjustedResidualBasisDenominatorAmount)), 'Residual otherwise-taxable amount')
    if (BigInt(physicalQcdGrossAmount) !== BigInt(qualifiedCharitableDistributionAmount) +
        BigInt(nonQcdCharitableRemainder) ||
        BigInt(taxablePoolGrossBalanceBefore) - BigInt(qualifiedCharitableDistributionAmount) !==
          BigInt(adjustedResidualBasisDenominatorAmount) ||
        poolRemaining.get(donor) !== otherwiseTaxableAmountAfter) {
      fail('poolCapacityInvalid', 'QCD pool transition failed exact annual reconciliation.')
    }
    return {
      baseForm8606Facts, physicalQcdGrossAmount, taxablePoolGrossBalanceBefore,
      taxablePoolBasisBefore, otherwiseTaxableAmountBefore,
      qualifiedCharitableDistributionAmount, nonQcdCharitableRemainder,
      adjustedResidualBasisDenominatorAmount, adjustedResidualBasisNumeratorAmount,
      otherwiseTaxableAmountAfter,
      transitionEvidenceId: deriveActionStructuralId('annual-qcd-pool-transition', [
        baseForm8606Facts.capacityEvidenceId, physicalQcdGrossAmount,
        taxablePoolGrossBalanceBefore, taxablePoolBasisBefore,
        otherwiseTaxableAmountBefore, qualifiedCharitableDistributionAmount,
        nonQcdCharitableRemainder, adjustedResidualBasisDenominatorAmount,
        adjustedResidualBasisNumeratorAmount, otherwiseTaxableAmountAfter,
        poolApplications.map((entry) => entry.evidenceId),
      ]),
    }
  })
  return deepFreeze({
    status: 'annualQcdTaxCharacterPostPassStaged', committed: false,
    movement: 'notCommitted',
    taxCharacterStatus: 'awaitingResidualAndSection170Reconciliation',
    taxYear: physical.taxYear, personalLimitEvidence, pools, applications, issues: [],
  })
}

/** Stage exact annual QCD partitions while leaving final character and §170 treatment provisional. */
export function stageAnnualQcdTaxCharacterPostPass(input: Readonly<StageAnnualQcdTaxCharacterPostPassInput>): Readonly<StageAnnualQcdTaxCharacterPostPassResult> {
  try {
    return stageUnchecked(structuredClone(input) as StageAnnualQcdTaxCharacterPostPassInput)
  } catch (error) {
    return blocked(error)
  }
}
