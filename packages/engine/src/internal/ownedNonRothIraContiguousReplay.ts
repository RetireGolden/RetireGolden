import {
  allocateAnnualIraBasis,
  type AnnualIraBasisAllocationEntryInput,
  type AnnualIraBasisAllocationEvidence,
  type AnnualIraBasisRatio,
} from '../actions/annualIraBasisAllocation.js'
import { asActionId, asAllocationId, type PersonId } from '../actions/identity.js'
import { asPositiveUsdCents, asUsdCents, type UsdCents } from '../actions/money.js'
import { planDollarsToLedgerCents } from '../actions/planBalanceAdapter.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from '../actions/structuralId.js'
import { planSchema, type Account, type Plan } from '../model/plan.js'
import { isAggregatedIra } from '../strategies/accountEligibility.js'
import {
  buildSimulatorOwnedNonRothIraAnnualObservation,
  type CompleteSimulatorOwnedNonRothIraAnnualObservation,
} from '../projection/ownedNonRothIraAnnualObservation.js'
import type { YearResult } from '../projection/types.js'
import {
  validateOwnedNonRothIraRuntimeSourceSeries,
  type NormalizedAggregateRothDestinationCredit,
  type NormalizedOwnedNonRothIraApplication,
  type OwnedNonRothIraRuntimeSourceSeriesIssue,
} from './ownedNonRothIraRuntimeSourceSeries.js'

const MAX_SAFE_CENTS = BigInt(Number.MAX_SAFE_INTEGER)

export type OwnedNonRothIraContiguousReplayIssue =
  | Readonly<OwnedNonRothIraRuntimeSourceSeriesIssue>
  | Readonly<{
      kind:
        | 'openingBasisInvalid'
        | 'annualObservationInvalid'
        | 'basisReplayInvalid'
        | 'replayConstructionInvalid'
      detail: string
      taxYear?: number
      ownerPersonId?: string
      sourceAccountId?: string
    }>

export interface OwnedNonRothIraAnnualOwnerReplay {
  readonly ownerPersonId: PersonId
  readonly taxYear: number
  readonly openingBasisSource: 'planSeed' | 'priorYearCarryforward'
  readonly openingBasisAmount: UsdCents
  readonly taxYearNondeductibleContributionAmount: 0
  readonly postYearNondeductibleContributionExcludedAmount: 0
  readonly outstandingRolloverAmount: 0
  readonly rolloverRepaymentAdjustmentAmount: 0
  readonly annualObservation:
    Readonly<CompleteSimulatorOwnedNonRothIraAnnualObservation>
  readonly annualBasisRatio: Readonly<AnnualIraBasisRatio>
  readonly line7AllocationEvidence: Readonly<AnnualIraBasisAllocationEvidence>
  readonly line8AllocationEvidence: Readonly<AnnualIraBasisAllocationEvidence>
  readonly nextYearOpeningBasisAmount: UsdCents
  readonly sourceChainEvidenceId: string
  readonly replayEvidenceId: string
}

export interface OwnedNonRothIraAnnualReplay {
  readonly taxYear: number
  readonly ownerReplays: readonly Readonly<OwnedNonRothIraAnnualOwnerReplay>[]
  readonly aggregateRothDestinationCredit:
    Readonly<NormalizedAggregateRothDestinationCredit> | null
  readonly evidenceId: string
}

interface ReplayResultBase {
  readonly evidenceScope: 'projectionModelOnlyNotRealWorldFilingCompleteness'
  readonly movement: 'notCommitted'
  readonly actionability: 'notEstablished'
  readonly filingCompleteness: 'notEstablished'
}

export interface OwnedNonRothIraContiguousReplayComplete extends ReplayResultBase {
  readonly status: 'ownedNonRothIraContiguousReplayComplete'
  readonly startTaxYear: number
  readonly endTaxYear: number
  readonly sourceSeriesEvidenceId: string
  readonly annualReplays: readonly Readonly<OwnedNonRothIraAnnualReplay>[]
  readonly replayEvidenceId: string
  readonly issues: readonly []
}

export interface OwnedNonRothIraContiguousReplayBlocked extends ReplayResultBase {
  readonly status: 'ownedNonRothIraContiguousReplayBlocked'
  readonly startTaxYear: number | null
  readonly endTaxYear: number | null
  readonly sourceSeriesEvidenceId: null
  readonly annualReplays: null
  readonly replayEvidenceId: null
  readonly issues: readonly [OwnedNonRothIraContiguousReplayIssue]
}

export type OwnedNonRothIraContiguousReplayResult =
  | OwnedNonRothIraContiguousReplayComplete
  | OwnedNonRothIraContiguousReplayBlocked

class BasisReplayFailure extends Error {
  readonly issue: OwnedNonRothIraContiguousReplayIssue

  constructor(issue: OwnedNonRothIraContiguousReplayIssue) {
    super(issue.detail)
    this.issue = issue
  }
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function fail(
  kind: Extract<OwnedNonRothIraContiguousReplayIssue, { kind: string }>['kind'],
  detail: string,
  context: { taxYear?: number; ownerPersonId?: string; sourceAccountId?: string } = {},
): never {
  throw new BasisReplayFailure({ kind, detail, ...context } as OwnedNonRothIraContiguousReplayIssue)
}

function safeDetail(error: unknown): string {
  try {
    return error instanceof Error ? error.message : String(error)
  } catch {
    return 'uninspectable error'
  }
}

function sum(values: readonly UsdCents[], label: string, context: {
  taxYear?: number
  ownerPersonId?: string
}): UsdCents {
  const total = values.reduce((accumulator, value) => accumulator + BigInt(value), 0n)
  if (total > MAX_SAFE_CENTS) fail('basisReplayInvalid', `${label} exceeds the safe-integer range`, context)
  return asUsdCents(Number(total))
}

function pools(plan: Plan): Map<PersonId, Extract<Account, { type: 'traditional' }>[]> {
  const result = new Map<PersonId, Extract<Account, { type: 'traditional' }>[]>()
  for (const account of plan.accounts) {
    if (!isAggregatedIra(account)) continue
    const owner = account.ownerPersonId as PersonId
    result.set(owner, [...(result.get(owner) ?? []), account])
  }
  return new Map([...result]
    .sort(([left], [right]) => compareUtf16CodeUnits(left, right))
    .map(([owner, accounts]) => [owner, accounts.sort((left, right) =>
      compareUtf16CodeUnits(left.id, right.id))]))
}

function entry(
  planId: string,
  taxYear: number,
  application: Readonly<NormalizedOwnedNonRothIraApplication>,
): AnnualIraBasisAllocationEntryInput {
  const actionId = asActionId(deriveActionStructuralId(
    'projection-owned-ira-runtime-replay-action',
    [planId, taxYear, application.producerOccurrenceKey, application.occurrenceKind],
  ))
  return {
    actionId,
    allocationId: asAllocationId(deriveActionStructuralId(
      'projection-owned-ira-runtime-replay-allocation',
      [actionId, application.sourceAccountId, application.mutationOrdinal],
    )),
    sourceAccountId: application.sourceAccountId,
    scheduledDate: null,
    scheduledSequence: application.mutationOrdinal,
    grossAmount: application.amount,
  }
}

function blocked(
  issue: OwnedNonRothIraContiguousReplayIssue,
  startTaxYear: number,
): Readonly<OwnedNonRothIraContiguousReplayBlocked> {
  return deepFreeze({
    status: 'ownedNonRothIraContiguousReplayBlocked',
    evidenceScope: 'projectionModelOnlyNotRealWorldFilingCompleteness',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    filingCompleteness: 'notEstablished',
    startTaxYear: Number.isSafeInteger(startTaxYear) ? startTaxYear : null,
    // Never inspect rejected source inputs while building fail-closed diagnostics.
    endTaxYear: null,
    sourceSeriesEvidenceId: null,
    annualReplays: null,
    replayEvidenceId: null,
    issues: [issue],
  })
}

function replayUnchecked(
  rawPlan: Plan,
  projectionStartTaxYear: number,
  years: readonly Readonly<YearResult>[],
): Readonly<OwnedNonRothIraContiguousReplayResult> {
  const parsedPlan = planSchema.safeParse(rawPlan)
  if (!parsedPlan.success) fail('planInvalid', 'Contiguous basis replay requires a valid Plan snapshot')
  const plan = parsedPlan.data
  const sourceSeries = validateOwnedNonRothIraRuntimeSourceSeries(
    plan, projectionStartTaxYear, years,
  )
  if (sourceSeries.status !== 'ownedNonRothIraRuntimeSourceSeriesComplete') {
    return blocked(sourceSeries.issues[0], projectionStartTaxYear)
  }
  const ownerPools = pools(plan)
  const basisByOwner = new Map<PersonId, UsdCents>()
  for (const [owner, accounts] of ownerPools) {
    const basisAmounts = accounts.map((account) => {
      try {
        return planDollarsToLedgerCents(account.nondeductibleBasis ?? 0)
      } catch (error) {
        fail('openingBasisInvalid', `Plan IRA basis cannot cross the exact-cent boundary: ${safeDetail(error)}`, {
          ownerPersonId: owner,
          sourceAccountId: account.id,
        })
      }
    })
    basisByOwner.set(owner, sum(basisAmounts, 'Owner opening IRA basis', { ownerPersonId: owner }))
  }

  const annualReplays: OwnedNonRothIraAnnualReplay[] = []
  for (let yearIndex = 0; yearIndex < sourceSeries.years.length; yearIndex += 1) {
    const sourceYear = sourceSeries.years[yearIndex]!
    const ownerReplays: OwnedNonRothIraAnnualOwnerReplay[] = []
    for (const ownerSource of sourceYear.ownerSources) {
      const owner = ownerSource.ownerPersonId
      const openingBasisAmount = basisByOwner.get(owner)!
      const ledgerRunId = deriveActionStructuralId(
        'projection-owned-ira-runtime-replay-annual-ledger-run',
        [plan.id, sourceYear.taxYear, owner, ownerSource.sourceChainEvidenceId,
          yearIndex === 0 ? 'planSeed' : annualReplays.at(-1)!.evidenceId,
          openingBasisAmount],
      )
      const observationResult = buildSimulatorOwnedNonRothIraAnnualObservation({
        plan,
        ownerPersonId: owner,
        taxYear: sourceYear.taxYear,
        ledgerRunId,
        observationBoundary: 'sealedAfterAllAnnualTransactionsAndGrowth',
        startOfTaxYearIraBasis: 0,
        startOfTaxYearIraBasisAmount: openingBasisAmount,
        yearEndBalances: ownerSource.yearEndBalances.map((balance) => ({
          sourceAccountId: balance.sourceAccountId,
          balance: balance.balancePlanDollars,
        })),
      })
      if (observationResult.status !== 'annualObservationBuilt') {
        fail('annualObservationInvalid', `Annual observation blocked: ${observationResult.issues.map((issue) => issue.detail).join('; ')}`, {
          taxYear: sourceYear.taxYear,
          ownerPersonId: owner,
        })
      }
      const line7Entries = ownerSource.applications
        .filter((application) => application.form8606Line === 'line7')
        .map((application) => entry(plan.id, sourceYear.taxYear, application))
      const line8Entries = ownerSource.applications
        .filter((application) => application.form8606Line === 'line8')
        .map((application) => entry(plan.id, sourceYear.taxYear, application))
      const context = { taxYear: sourceYear.taxYear, ownerPersonId: owner }
      const line7Gross = sum(line7Entries.map((item) => item.grossAmount), 'Form 8606 line 7 total', context)
      const line8Gross = sum(line8Entries.map((item) => item.grossAmount), 'Form 8606 line 8 total', context)
      const denominator = sum([
        observationResult.observation.aggregateYearEndApplicableBalanceAmount,
        line7Gross,
        line8Gross,
      ], 'Annual IRA basis denominator', context)
      const ratio: AnnualIraBasisRatio = denominator === 0
        ? {
          representation: 'notApplicableZeroDenominator',
          numeratorMinorUnits: 0,
          denominatorMinorUnits: 0,
          intermediateArithmetic: 'notApplicable',
        }
        : {
          representation: 'exactMinorUnitRational',
          numeratorMinorUnits: asUsdCents(Math.min(openingBasisAmount, denominator)),
          denominatorMinorUnits: asPositiveUsdCents(denominator),
          intermediateArithmetic: 'bigintRational',
        }
      const accounts = ownerPools.get(owner)!
      const poolId = deriveActionStructuralId(
        'projection-owned-non-roth-ira-pool',
        [plan.id, owner, accounts.map((account) => account.id)],
      )
      let line7AllocationEvidence: Readonly<AnnualIraBasisAllocationEvidence>
      let line8AllocationEvidence: Readonly<AnnualIraBasisAllocationEvidence>
      try {
        line7AllocationEvidence = allocateAnnualIraBasis({
          poolId,
          taxYear: sourceYear.taxYear,
          calculationScope: 'form8606Line7Distributions',
          annualBasisRatio: ratio,
          annualGrossAmount: line7Gross,
          entries: line7Entries,
        })
        line8AllocationEvidence = allocateAnnualIraBasis({
          poolId,
          taxYear: sourceYear.taxYear,
          calculationScope: 'form8606Line8NetConversions',
          annualBasisRatio: ratio,
          annualGrossAmount: line8Gross,
          entries: line8Entries,
        })
      } catch (error) {
        fail('basisReplayInvalid', `Annual IRA basis allocation failed: ${safeDetail(error)}`, context)
      }
      const recovered = BigInt(line7AllocationEvidence.annualNontaxableBasisAmount) +
        BigInt(line8AllocationEvidence.annualNontaxableBasisAmount)
      if (recovered > BigInt(openingBasisAmount)) {
        fail('basisReplayInvalid', 'Independent Form 8606 line rounding cannot recover more than annual IRA basis', context)
      }
      const nextBasis = asUsdCents(Number(BigInt(openingBasisAmount) - recovered))
      const withoutId = {
        ownerPersonId: owner,
        taxYear: sourceYear.taxYear,
        openingBasisSource: yearIndex === 0 ? 'planSeed' as const : 'priorYearCarryforward' as const,
        openingBasisAmount,
        taxYearNondeductibleContributionAmount: 0 as const,
        postYearNondeductibleContributionExcludedAmount: 0 as const,
        outstandingRolloverAmount: 0 as const,
        rolloverRepaymentAdjustmentAmount: 0 as const,
        annualObservation: observationResult.observation,
        annualBasisRatio: ratio,
        line7AllocationEvidence,
        line8AllocationEvidence,
        nextYearOpeningBasisAmount: nextBasis,
        sourceChainEvidenceId: ownerSource.sourceChainEvidenceId,
      }
      ownerReplays.push({
        ...withoutId,
        replayEvidenceId: deriveActionStructuralId(
          'projection-owned-ira-runtime-replay-owner-year', [withoutId],
        ),
      })
      basisByOwner.set(owner, nextBasis)
    }
    const withoutId = {
      taxYear: sourceYear.taxYear,
      ownerReplays,
      aggregateRothDestinationCredit: sourceYear.aggregateRothDestinationCredit,
    }
    annualReplays.push(deepFreeze({
      ...withoutId,
      evidenceId: deriveActionStructuralId(
        'projection-owned-ira-runtime-replay-year', [plan.id, sourceYear.evidenceId, withoutId],
      ),
    }))
  }

  const withoutId = {
    status: 'ownedNonRothIraContiguousReplayComplete' as const,
    evidenceScope: 'projectionModelOnlyNotRealWorldFilingCompleteness' as const,
    movement: 'notCommitted' as const,
    actionability: 'notEstablished' as const,
    filingCompleteness: 'notEstablished' as const,
    startTaxYear: projectionStartTaxYear,
    endTaxYear: sourceSeries.endTaxYear,
    sourceSeriesEvidenceId: sourceSeries.evidenceId,
    annualReplays,
  }
  return deepFreeze({
    ...withoutId,
    replayEvidenceId: deriveActionStructuralId(
      'projection-owned-ira-runtime-contiguous-replay', [plan.id, withoutId],
    ),
    issues: [],
  })
}

/** Replay basis only from the complete private source-series validator. */
export function replayOwnedNonRothIraContiguousYears(
  plan: Plan,
  projectionStartTaxYear: number,
  years: readonly Readonly<YearResult>[],
): Readonly<OwnedNonRothIraContiguousReplayResult> {
  try {
    return replayUnchecked(plan, projectionStartTaxYear, years)
  } catch (error) {
    if (error instanceof BasisReplayFailure) return blocked(error.issue, projectionStartTaxYear)
    return blocked({
      kind: 'replayConstructionInvalid',
      detail: `Contiguous basis replay failed closed: ${safeDetail(error)}`,
    }, projectionStartTaxYear)
  }
}
