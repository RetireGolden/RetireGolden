/**
 * Prepares the immutable evidence and exact-cent snapshots consumed by the
 * named-QCD executor for one annual pass.
 *
 * This coordinator owns no economic movement. `simulatePlan` retains the
 * executor call, every live debit, RMD/basis character adjustment, runtime
 * occurrence/application, warning, cash-flow write, and settlement result.
 */
import type { Plan } from '../../model/plan.js'
import type { NonpersistedPriorQcdOffsetEvidence } from
  '../../strategies/accountEligibility.js'
import {
  addCalendarMonths,
  asAccountId,
  asPersonId,
  asUsdCents,
  evaluateAnnualQcdExecutionPrerequisites,
  planDollarsToFlooredLedgerCents,
  planDollarsToLedgerCents,
  stageAnnualQcdPhysicalExecution,
  type ClassifyOwnedNonRothIraAnnualWithdrawalsInput,
  type EvaluateAnnualQcdExecutionPrerequisitesResult,
  type ExecuteAnnualQcdsInput,
  type QualifiedCharitableDistributionRequest,
  type StageAnnualQcdPhysicalExecutionInput,
} from '../../actions/index.js'
import { compareUtf16CodeUnits } from '../../actions/structuralId.js'

export interface AnnualQcdExecutionInputPerson {
  readonly personId: string
  readonly dob: string
  readonly alive: boolean
}

export interface AnnualQcdExecutionInputBalance {
  readonly accountId: string
  readonly ownerPersonId: string | null
  readonly isAggregatedIra: boolean
  /** Live balance immediately before named-QCD preparation. */
  readonly balancePlanDollars: number
  /** Owner-wide Form 8606 balance captured before annual distributions. */
  readonly preDistributionBalancePlanDollars: number
}

export interface AnnualQcdExecutionInputOwnerRmd {
  readonly ownerPersonId: string
  readonly requiredPlanDollars: number
  readonly unsatisfiedPlanDollars: number
}

export interface AnnualQcdExecutionInputOwnerBasis {
  readonly ownerPersonId: string
  readonly basisPlanDollars: number
}

export interface AnnualQcdExecutionInputPriorOffset {
  readonly donorPersonId: string
  readonly consumedAmountCents: number
}

export interface AnnualQcdExecutionInput {
  readonly taxYear: number
  readonly plan: Readonly<Plan>
  readonly primaryPersonId: string
  readonly requests:
    readonly Readonly<QualifiedCharitableDistributionRequest>[]
  readonly people: readonly Readonly<AnnualQcdExecutionInputPerson>[]
  readonly balances: readonly Readonly<AnnualQcdExecutionInputBalance>[]
  readonly ownerRmd: readonly Readonly<AnnualQcdExecutionInputOwnerRmd>[]
  readonly ownerBasis: readonly Readonly<AnnualQcdExecutionInputOwnerBasis>[]
  readonly priorOffsets:
    readonly Readonly<AnnualQcdExecutionInputPriorOffset>[]
  readonly offsetHistoryUnprovableDonorIds: readonly string[]
}

export type AnnualQcdExecutionInputResult =
  | Readonly<{
      readonly status: 'notRequested'
      readonly prerequisite: undefined
      readonly executorInput: null
    }>
  | Readonly<{
      readonly status: 'blocked'
      readonly prerequisite: Extract<
        EvaluateAnnualQcdExecutionPrerequisitesResult,
        { readonly status: 'blocked' }
      >
      readonly executorInput: null
    }>
  | Readonly<{
      readonly status: 'ready'
      readonly prerequisite: Extract<
        EvaluateAnnualQcdExecutionPrerequisitesResult,
        { readonly status: 'evaluated' }
      >
      readonly executorInput: Readonly<ExecuteAnnualQcdsInput>
    }>

function freezeRows<T extends object>(rows: readonly T[]): readonly Readonly<T>[] {
  return Object.freeze(rows.map((row) => Object.freeze(row)))
}

/**
 * Prepare one annual QCD executor call without mutating the annual ledger.
 */
export function annualQcdExecutionInput(
  input: Readonly<AnnualQcdExecutionInput>,
): AnnualQcdExecutionInputResult {
  if (input.requests.length === 0) {
    return Object.freeze({
      status: 'notRequested',
      prerequisite: undefined,
      executorInput: null,
    })
  }

  const peopleById = new Map(input.people.map((person) => [
    person.personId,
    person,
  ] as const))
  const priorOffsetByDonor = new Map(input.priorOffsets.map((offset) => [
    offset.donorPersonId,
    offset.consumedAmountCents,
  ] as const))
  const offsetHistoryUnprovable = new Set(
    input.offsetHistoryUnprovableDonorIds,
  )

  const personAliveEvidenceFor = (
    request: Readonly<QualifiedCharitableDistributionRequest>,
  ) => Object.freeze({
    evidenceId: `projection-alive:${JSON.stringify([
      request.actionId,
      request.donorPersonId,
      input.taxYear,
      request.executionDate ?? null,
    ])}`,
    actionId: request.actionId,
    personId: request.donorPersonId,
    actionYear: input.taxYear,
    actionDate: request.executionDate ?? null,
    alive: peopleById.get(request.donorPersonId)?.alive ?? false,
  })

  const priorQcdOffsetEvidenceFor = (
    request: Readonly<QualifiedCharitableDistributionRequest>,
  ): Readonly<NonpersistedPriorQcdOffsetEvidence> | null => {
    const donor = peopleById.get(request.donorPersonId)
    const thresholdDate = donor === undefined
      ? null
      : addCalendarMonths(donor.dob, 846)
    if (thresholdDate === null) return null
    const thresholdYear = Number(thresholdDate.slice(0, 4))
    const offsetTotalCents = (
      input.plan.retirementActionEligibilityFacts
        ?.deductibleIraContributions ?? []
    ).filter((record) =>
      record.donorPersonId === request.donorPersonId &&
      record.taxYear >= thresholdYear && record.taxYear <= request.year)
      .reduce((sum, record) => sum + BigInt(record.amountCents), 0n)
    const consumed = priorOffsetByDonor.get(request.donorPersonId) ?? 0
    // IRC 408(d)(8)(A)'s second sentence, read with Notice 2020-68, is a
    // lifetime net: post-70½ section 219 deductions less reductions already
    // taken before this year. Zero is honest when no deduction ever entered
    // limb (i). Once the deduction total is positive, however, unprovable
    // prior consumption cannot be replaced with zero: doing so would invent
    // unused deductions and overstate the exclusion. Omit the evidence so the
    // prerequisite can refuse qcd-contribution-history-unknown instead.
    if (offsetTotalCents > 0n &&
        offsetHistoryUnprovable.has(request.donorPersonId)) {
      return null
    }
    const actionDate = request.executionDate ?? null
    return Object.freeze({
      evidenceId: `projection-prior-qcd-offset:${JSON.stringify([
        request.actionId,
        request.donorPersonId,
        input.taxYear,
        actionDate,
      ])}`,
      actionId: request.actionId,
      donorPersonId: request.donorPersonId,
      actionYear: input.taxYear,
      actionDate,
      priorOffsetApplied: asUsdCents(offsetTotalCents === 0n ? 0 : consumed),
    })
  }

  const runtimeEvidenceFor = (
    requests: readonly Readonly<QualifiedCharitableDistributionRequest>[],
  ) => Object.freeze({
    personAliveEvidence: Object.freeze(
      requests.map(personAliveEvidenceFor),
    ),
    priorQcdOffsetEvidence: Object.freeze(requests.flatMap((request) => {
      const evidence = priorQcdOffsetEvidenceFor(request)
      return evidence === null ? [] : [evidence]
    })),
  })

  const prerequisite = evaluateAnnualQcdExecutionPrerequisites({
    taxYear: input.taxYear,
    plan: input.plan,
    requests: input.requests,
    runtimeEvidence: runtimeEvidenceFor(input.requests),
  })
  if (prerequisite.status !== 'evaluated') {
    return Object.freeze({
      status: 'blocked',
      prerequisite,
      executorInput: null,
    })
  }

  const requests = prerequisite.requests
  const donorIds = [...new Set(requests.map((request) =>
    String(request.donorPersonId)))].sort(compareUtf16CodeUnits)
  const sourceIds = new Set(requests.map((request) =>
    String(request.allocation.sourceAccountId)))
  const ownerRmdById = new Map(input.ownerRmd.map((row) => [
    row.ownerPersonId,
    row,
  ] as const))
  const ownerBasisById = new Map(input.ownerBasis.map((row) => [
    row.ownerPersonId,
    row.basisPlanDollars,
  ] as const))

  // Source capacity is truncated, never rounded: the executor may draw every
  // reported cent, so a half-up snapshot could authorize money the float does
  // not contain. Destination-like measurements need no such protection here.
  const openingBalances = freezeRows(input.balances
    .filter((balance) => sourceIds.has(balance.accountId))
    .map((balance) => ({
      accountId: asAccountId(balance.accountId),
      openingBalance: planDollarsToFlooredLedgerCents(
        balance.balancePlanDollars,
      ),
    })))

  const rmdPools = freezeRows(donorIds.map((donorId) => {
    const rmd = ownerRmdById.get(donorId)
    const required = planDollarsToLedgerCents(
      rmd?.requiredPlanDollars ?? 0,
    )
    const remaining = planDollarsToLedgerCents(Math.min(
      rmd?.unsatisfiedPlanDollars ?? 0,
      rmd?.requiredPlanDollars ?? 0,
    ))
    const sourceAccountIds = Object.freeze(input.balances
      .filter((balance) => balance.isAggregatedIra &&
        (balance.ownerPersonId ?? input.primaryPersonId) === donorId)
      .map((balance) => asAccountId(balance.accountId))
      .sort(compareUtf16CodeUnits))
    return {
      predicate: 'annualQcdOwnedIraRmdPoolOpeningSnapshot' as const,
      poolId: `projection-owned-ira-rmd-pool:${JSON.stringify([
        input.plan.id,
        donorId,
        input.taxYear,
      ])}`,
      taxYear: input.taxYear,
      donorPersonId: asPersonId(donorId),
      scope: 'ownedIra' as const,
      sourceAccountIds: sourceAccountIds as readonly [
        ReturnType<typeof asAccountId>,
        ...ReturnType<typeof asAccountId>[],
      ],
      rmdRequiredAmount: required,
      rmdSatisfiedBefore: asUsdCents(
        Number(BigInt(required) - BigInt(remaining)),
      ),
      rmdRemainingBefore: remaining,
      upstreamEvidenceId:
        `projection-owner-ira-rmd-satisfaction:${JSON.stringify([
          input.plan.id,
          donorId,
          input.taxYear,
        ])}`,
    }
  }))

  const physicalInput: Readonly<StageAnnualQcdPhysicalExecutionInput> =
    Object.freeze({
      prerequisite,
      plan: input.plan,
      runtimeEvidence: runtimeEvidenceFor(requests),
      openingBalances,
      rmdPools,
    })

  // Stage once to attribute each donor's exact gift across physical sources.
  // The executor rebuilds this detached staging from the same immutable input.
  const staging = stageAnnualQcdPhysicalExecution(physicalInput)
  const stagedGiftByAccount = new Map<string, number>()
  if (staging.status === 'annualQcdPhysicalExecutionStaged') {
    for (const application of staging.applications) {
      const accountId = String(application.request.allocation.sourceAccountId)
      stagedGiftByAccount.set(
        accountId,
        (stagedGiftByAccount.get(accountId) ?? 0) +
          application.executedAmount,
      )
    }
  }

  const subtypeById = new Map(
    (input.plan.retirementActionEligibilityFacts?.iraClassifications ?? [])
      .map((record) => [
        String(record.sourceAccountId),
        record.subtype,
      ] as const),
  )
  const poolCapacityInputs = Object.freeze(donorIds.map((donorId) => {
    const poolAccounts = input.balances
      .filter((balance) => balance.isAggregatedIra &&
        (balance.ownerPersonId ?? input.primaryPersonId) === donorId)
      .sort((left, right) =>
        compareUtf16CodeUnits(left.accountId, right.accountId))
    const poolMembers = freezeRows(poolAccounts.map((account) => {
      const preDistribution = planDollarsToLedgerCents(
        account.preDistributionBalancePlanDollars,
      )
      const gift = stagedGiftByAccount.get(account.accountId) ?? 0
      return {
        sourceAccountId: asAccountId(account.accountId),
        ownerPersonId: asPersonId(donorId),
        accountType: 'traditional' as const,
        accountKind: 'ira' as const,
        inheritanceStatus: 'owned' as const,
        subtype: subtypeById.get(account.accountId) ?? 'traditional' as const,
        yearEndApplicableBalanceAmount: asUsdCents(
          Number(BigInt(preDistribution) -
            BigInt(Math.min(gift, preDistribution))),
        ),
        iraClassificationEvidenceId:
          `projection-owned-ira-classification:${JSON.stringify([
            input.plan.id,
            account.accountId,
            input.taxYear,
          ])}`,
        accountOwnershipEvidenceId:
          `projection-owned-ira-ownership:${JSON.stringify([
            input.plan.id,
            account.accountId,
            input.taxYear,
          ])}`,
      }
    }))
    const poolBalance = asUsdCents(Number(poolMembers.reduce(
      (sum, member) =>
        sum + BigInt(member.yearEndApplicableBalanceAmount),
      0n,
    )))
    const poolId = `projection-owned-ira-pool:${JSON.stringify([
      input.plan.id,
      donorId,
      input.taxYear,
    ])}`
    return Object.freeze({
      ownerPersonId: asPersonId(donorId),
      ownerWideNonRothIraPoolId: poolId,
      completePoolEvidence: Object.freeze({
        predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear' as const,
        ownerPersonId: asPersonId(donorId),
        ownerWideNonRothIraPoolId: poolId,
        taxYear: input.taxYear,
        accountIds: Object.freeze(poolMembers.map((member) =>
          member.sourceAccountId)) as readonly [
            ReturnType<typeof asAccountId>,
            ...ReturnType<typeof asAccountId>[],
          ],
        yearEndApplicablePoolBalanceAmount: poolBalance,
        evidenceId: `projection-owned-ira-pool-evidence:${JSON.stringify([
          input.plan.id,
          donorId,
          input.taxYear,
        ])}`,
      }),
      annualBasisRecordEvidenceId:
        `projection-owned-ira-annual-basis:${JSON.stringify([
          input.plan.id,
          donorId,
          input.taxYear,
        ])}`,
      taxYear: input.taxYear,
      poolMembers,
      annualFacts: Object.freeze({
        openingBasisAmount: planDollarsToLedgerCents(
          ownerBasisById.get(donorId) ?? 0,
        ),
        taxYearNondeductibleContributionAmount: asUsdCents(0),
        postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
        yearEndApplicablePoolBalanceAmount: poolBalance,
        outstandingRolloverAmount: asUsdCents(0),
        rolloverRepaymentAdjustmentAmount: asUsdCents(0),
        form8606Line7DistributionAmount: asUsdCents(0),
        form8606Line8NetConversionAmount: asUsdCents(0),
      }),
      line7Distributions: Object.freeze([]),
      line8Conversions: Object.freeze([]),
    }) satisfies Readonly<ClassifyOwnedNonRothIraAnnualWithdrawalsInput>
  }))

  return Object.freeze({
    status: 'ready',
    prerequisite,
    executorInput: Object.freeze({ physicalInput, poolCapacityInputs }),
  })
}
