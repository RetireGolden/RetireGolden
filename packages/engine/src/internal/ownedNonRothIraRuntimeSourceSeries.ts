import { asAccountId, type AccountId, type PersonId } from '../actions/identity.js'
import { asUsdCents, type UsdCents } from '../actions/money.js'
import { planDollarsToLedgerCents } from '../actions/planBalanceAdapter.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from '../actions/structuralId.js'
import { planSchema, type Account, type Plan } from '../model/plan.js'
import { isAggregatedIra } from '../strategies/accountEligibility.js'
import type { SimulatorAnnualRetirementRuntimeOccurrence } from '../projection/annualRetirementRuntimeJournal.js'
import type {
  SimulatorRetirementRuntimeAggregateRothDestinationCredit,
  SimulatorRetirementRuntimeApplication,
  YearResult,
} from '../projection/types.js'

const MAX_SAFE_CENTS = BigInt(Number.MAX_SAFE_INTEGER)
const MAX_RAW_RECONCILIATION_TOLERANCE_DOLLARS = 0.000001

export type OwnedNonRothIraRuntimeSourceSeriesIssueKind =
  | 'planInvalid'
  | 'yearSeriesInvalid'
  | 'sourceMissing'
  | 'sourceContractInvalid'
  | 'sourceOrderInvalid'
  | 'sourceIdentityInvalid'
  | 'sourceAmountInvalid'
  | 'sourceCoverageInvalid'
  | 'applicationOrderInvalid'
  | 'balanceChainInvalid'
  | 'postGrowthPoolInvalid'
  | 'qcdStageRequired'
  | 'annuityStageRequired'
  | 'aggregateRothCreditInvalid'
  | 'sourceSeriesConstructionInvalid'

export interface OwnedNonRothIraRuntimeSourceSeriesIssue {
  readonly kind: OwnedNonRothIraRuntimeSourceSeriesIssueKind
  readonly detail: string
  readonly taxYear?: number
  readonly ownerPersonId?: string
  readonly sourceAccountId?: string
  readonly producerOccurrenceKey?: string
}

export interface NormalizedOwnedNonRothIraApplication {
  readonly producerOccurrenceKey: string
  readonly occurrenceKind:
    | 'ownedIraRmd'
    | 'automaticSeppDistribution'
    | 'legacyNeedBasedWithdrawal'
    | 'legacyRothConversion'
    | 'ownedIraContribution'
    | 'rolloverInflow'
  readonly applicationKind: 'debit' | 'credit'
  readonly simulatorPhase:
    | 'pensionLumpSumRollover'
    | 'employeeContribution'
    | 'ownerRmdDistribution'
    | 'automaticSeppDistribution'
    | 'legacyRothConversion'
    | 'legacyNeedBasedWithdrawal'
  readonly mutationOrdinal: number
  readonly ownerPersonId: PersonId
  readonly sourceAccountId: AccountId
  readonly amount: UsdCents
  readonly sourceBalanceBefore: UsdCents
  readonly sourceBalanceAfter: UsdCents
  readonly form8606Line: 'line7' | 'line8' | null
}

export interface NormalizedOwnedNonRothIraYearEndBalance {
  readonly sourceAccountId: AccountId
  readonly balancePlanDollars: number
  readonly balanceAmount: UsdCents
}

export interface NormalizedOwnedNonRothIraOwnerYearSource {
  readonly ownerPersonId: PersonId
  readonly taxYear: number
  readonly applications: readonly Readonly<NormalizedOwnedNonRothIraApplication>[]
  readonly yearEndBalances: readonly Readonly<NormalizedOwnedNonRothIraYearEndBalance>[]
  readonly sourceChainEvidenceId: string
}

export interface NormalizedAggregateRothDestinationCredit {
  readonly status: 'aggregateDestinationCreditSourceReconciled'
  readonly destinationAttribution: 'aggregateOnlyNotSourceAllocated'
  readonly actionability: 'notEstablished'
  readonly destinationRothAccountId: AccountId
  readonly destinationOwnerPersonId: PersonId
  readonly destinationCreditedAmount: UsdCents
  readonly producerOccurrenceKeys: readonly string[]
  readonly sourceOwnerPersonIds: readonly PersonId[]
  readonly evidenceId: string
}

export interface NormalizedOwnedNonRothIraRuntimeSourceYear {
  readonly taxYear: number
  readonly ownerSources: readonly Readonly<NormalizedOwnedNonRothIraOwnerYearSource>[]
  readonly aggregateRothDestinationCredit:
    Readonly<NormalizedAggregateRothDestinationCredit> | null
  readonly evidenceId: string
}

interface SourceSeriesResultBase {
  readonly evidenceScope: 'projectionModelOnlyNotRealWorldFilingCompleteness'
  readonly movement: 'notCommitted'
  readonly actionability: 'notEstablished'
}

export interface OwnedNonRothIraRuntimeSourceSeriesComplete
  extends SourceSeriesResultBase {
  readonly status: 'ownedNonRothIraRuntimeSourceSeriesComplete'
  readonly projectionStartTaxYear: number
  readonly endTaxYear: number
  readonly years: readonly Readonly<NormalizedOwnedNonRothIraRuntimeSourceYear>[]
  readonly evidenceId: string
  readonly issues: readonly []
}

export interface OwnedNonRothIraRuntimeSourceSeriesBlocked
  extends SourceSeriesResultBase {
  readonly status: 'ownedNonRothIraRuntimeSourceSeriesBlocked'
  readonly projectionStartTaxYear: number | null
  readonly endTaxYear: number | null
  readonly years: null
  readonly evidenceId: null
  readonly issues: readonly [
    Readonly<OwnedNonRothIraRuntimeSourceSeriesIssue>,
    ...Readonly<OwnedNonRothIraRuntimeSourceSeriesIssue>[],
  ]
}

export type OwnedNonRothIraRuntimeSourceSeriesResult =
  | OwnedNonRothIraRuntimeSourceSeriesComplete
  | OwnedNonRothIraRuntimeSourceSeriesBlocked

interface ApplicationShape {
  applicationKind: 'debit' | 'credit'
  simulatorPhase: Exclude<
    NormalizedOwnedNonRothIraApplication['simulatorPhase'],
    never
  > | 'annuityPurchaseFunding'
  form8606Line: 'line7' | 'line8' | null
}

class SourceSeriesFailure extends Error {
  readonly issue: OwnedNonRothIraRuntimeSourceSeriesIssue

  constructor(issue: OwnedNonRothIraRuntimeSourceSeriesIssue) {
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
  kind: OwnedNonRothIraRuntimeSourceSeriesIssueKind,
  detail: string,
  context: Omit<OwnedNonRothIraRuntimeSourceSeriesIssue, 'kind' | 'detail'> = {},
): never {
  throw new SourceSeriesFailure({ kind, detail, ...context })
}

function safeDetail(error: unknown): string {
  try {
    return error instanceof Error ? error.message : String(error)
  } catch {
    return 'uninspectable error'
  }
}

function cents(
  value: number,
  label: string,
  context: Omit<OwnedNonRothIraRuntimeSourceSeriesIssue, 'kind' | 'detail'>,
): UsdCents {
  try {
    return planDollarsToLedgerCents(value)
  } catch (error) {
    return fail('sourceAmountInvalid', `${label} cannot cross the exact-cent boundary: ${safeDetail(error)}`, context)
  }
}

function summedPlanDollars(
  values: readonly number[],
  label: string,
  context: Omit<OwnedNonRothIraRuntimeSourceSeriesIssue, 'kind' | 'detail'>,
): number {
  const total = values.reduce((sum, value) => sum + value, 0)
  if (!Number.isFinite(total) || total < 0 || Object.is(total, -0)) {
    fail('sourceAmountInvalid', `${label} must be a finite nonnegative Plan-dollar total`, context)
  }
  return total
}

function rawTotalsReconcile(
  left: number,
  right: number,
  operationCount: number,
): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right))
  const floatingPointTolerance = Number.EPSILON * scale *
    Math.max(8, operationCount * 4)
  return Math.abs(left - right) <= Math.min(
    MAX_RAW_RECONCILIATION_TOLERANCE_DOLLARS,
    floatingPointTolerance,
  )
}

function reconcilePublishedTotal(
  occurrences: readonly Readonly<SimulatorAnnualRetirementRuntimeOccurrence>[],
  kinds: readonly SimulatorAnnualRetirementRuntimeOccurrence['kind'][],
  publishedPlanDollars: number,
  label: string,
  taxYear: number,
): void {
  const selectedKinds = new Set(kinds)
  const occurrenceTotal = summedPlanDollars(
    occurrences
      .filter((occurrence) => selectedKinds.has(occurrence.kind))
      .map((occurrence) => occurrence.grossAmountPlanDollars),
    `${label} occurrence total`,
    { taxYear },
  )
  cents(occurrenceTotal, `${label} occurrence total`, { taxYear })
  cents(publishedPlanDollars, `Published ${label} total`, { taxYear })
  if (!rawTotalsReconcile(
    occurrenceTotal,
    publishedPlanDollars,
    occurrences.length,
  )) {
    fail('sourceCoverageInvalid', `${label} occurrences must exact-rejoin the published annual total`, {
      taxYear,
    })
  }
}

function compareNullableString(left: string | null, right: string | null): number {
  if (left === right) return 0
  if (left === null) return -1
  if (right === null) return 1
  return compareUtf16CodeUnits(left, right)
}

function compareNullableNumber(left: number | null, right: number | null): number {
  if (left === right) return 0
  if (left === null) return -1
  if (right === null) return 1
  return left - right
}

function compareOccurrences(
  left: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
  right: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
): number {
  return compareUtf16CodeUnits(left.producerOccurrenceKey, right.producerOccurrenceKey) ||
    compareUtf16CodeUnits(left.kind, right.kind) ||
    left.grossAmountPlanDollars - right.grossAmountPlanDollars ||
    compareNullableString(left.ownerPersonId, right.ownerPersonId) ||
    compareNullableString(left.sourceAccountId, right.sourceAccountId) ||
    compareNullableString(left.executionDate, right.executionDate) ||
    compareNullableNumber(left.executionSequence, right.executionSequence) ||
    compareNullableString(left.movementAuthorityId, right.movementAuthorityId)
}

function ownedPools(plan: Plan): Map<PersonId, Extract<Account, { type: 'traditional' }>[]> {
  const pools = new Map<PersonId, Extract<Account, { type: 'traditional' }>[]>()
  for (const account of plan.accounts) {
    if (!isAggregatedIra(account)) continue
    const owner = account.ownerPersonId as PersonId
    pools.set(owner, [...(pools.get(owner) ?? []), account])
  }
  return new Map([...pools]
    .sort(([left], [right]) => compareUtf16CodeUnits(left, right))
    .map(([owner, accounts]) => [owner, accounts.sort((left, right) =>
      compareUtf16CodeUnits(left.id, right.id))]))
}

function applicationShape(
  kind: SimulatorAnnualRetirementRuntimeOccurrence['kind'],
): ApplicationShape | null {
  switch (kind) {
    case 'annuityFundingTransfer':
      return { applicationKind: 'debit', simulatorPhase: 'annuityPurchaseFunding', form8606Line: null }
    case 'rolloverInflow':
      return { applicationKind: 'credit', simulatorPhase: 'pensionLumpSumRollover', form8606Line: null }
    case 'ownedIraContribution':
      return { applicationKind: 'credit', simulatorPhase: 'employeeContribution', form8606Line: null }
    case 'ownedIraRmd':
      return { applicationKind: 'debit', simulatorPhase: 'ownerRmdDistribution', form8606Line: 'line7' }
    case 'automaticSeppDistribution':
      return { applicationKind: 'debit', simulatorPhase: 'automaticSeppDistribution', form8606Line: 'line7' }
    case 'legacyRothConversion':
      return { applicationKind: 'debit', simulatorPhase: 'legacyRothConversion', form8606Line: 'line8' }
    case 'legacyNeedBasedWithdrawal':
      return { applicationKind: 'debit', simulatorPhase: 'legacyNeedBasedWithdrawal', form8606Line: 'line7' }
    default:
      return null
  }
}

function phaseRank(application: Readonly<SimulatorRetirementRuntimeApplication>): number {
  switch (application.simulatorPhase) {
    case 'annuityPurchaseFunding': return 0
    case 'pensionLumpSumRollover': return 1
    case 'employeeContribution': return 2
    case 'ownerRmdDistribution': return 3
    case 'automaticSeppDistribution': return 4
    case 'legacyRothConversion': return 5
    case 'legacyRothConversionAggregateDestinationCredit': return 6
    case 'legacyNeedBasedWithdrawal': return 7
  }
}

function sourceCompatible(
  occurrence: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
  account: Account,
): boolean {
  if (account.type !== 'traditional') return false
  switch (occurrence.kind) {
    case 'ownedIraRmd':
    case 'ownedIraContribution':
    case 'ownedIraEmployerContribution': return isAggregatedIra(account)
    case 'employerPlanRmd':
    case 'employerPlanEmployeeContribution':
    case 'employerPlanEmployerMatch': return account.kind === 'employer' && account.inherited === undefined
    case 'inheritedIraRmd': return account.inherited !== undefined
    case 'legacyRothConversion': return account.inherited === undefined
    default: return true
  }
}

function parseKey(key: string, taxYear: number): unknown[] {
  try {
    const parsed: unknown = JSON.parse(key)
    if (Array.isArray(parsed) && JSON.stringify(parsed) === key) return parsed
  } catch {
    // Fail below with a source-bound diagnostic.
  }
  return fail('sourceIdentityInvalid', 'Runtime producer key must be the canonical simulator tuple', {
    taxYear,
    producerOccurrenceKey: key,
  })
}

function occurrenceOrderAccountId(
  plan: Plan,
  occurrence: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
  taxYear: number,
): string {
  const key = parseKey(occurrence.producerOccurrenceKey, taxYear)
  const sourceId = occurrence.sourceAccountId
  const simpleKinds = new Set([
    'ownedIraRmd', 'employerPlanRmd', 'inheritedIraRmd',
    'automaticSeppDistribution', 'legacyNeedBasedWithdrawal',
    'ownedIraContribution', 'ownedIraEmployerContribution',
    'employerPlanEmployeeContribution', 'employerPlanEmployerMatch',
  ])
  if (simpleKinds.has(occurrence.kind)) {
    if (key.length !== 2 || key[0] !== occurrence.kind || key[1] !== sourceId) {
      fail('sourceIdentityInvalid', 'Runtime producer key must exact-bind its kind and source account', {
        taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
      })
    }
    return sourceId!
  }
  if (occurrence.kind === 'annuityFundingTransfer') {
    const destinationId = key[2]
    const destination = plan.accounts.find((account) => account.id === destinationId)
    if (key.length !== 3 || key[0] !== occurrence.kind || key[1] !== sourceId ||
        destination?.type !== 'annuity' || destination.purchase?.year !== taxYear ||
        destination.purchase.fundingAccountId !== sourceId) {
      fail('sourceIdentityInvalid', 'Annuity funding key must bind the actual Plan purchase and funding source', {
        taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
      })
    }
    return destination.id
  }
  if (occurrence.kind === 'rolloverInflow') {
    const pensionId = key[1]
    const pension = plan.accounts.find((account) => account.id === pensionId)
    if (key.length !== 3 || key[0] !== occurrence.kind || key[2] !== sourceId ||
        pension?.type !== 'pension' || pension.lumpSumOffer?.electionYear !== taxYear ||
        pension.lumpSumElection?.rolloverAccountId !== sourceId) {
      fail('sourceIdentityInvalid', 'Rollover key must bind the actual Plan pension election and target', {
        taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
      })
    }
    return pension.id
  }
  if (occurrence.kind === 'legacyRothConversion') {
    const destination = plan.accounts.find((account) => account.id === key[2])
    if (key.length !== 3 || key[0] !== occurrence.kind || key[1] !== sourceId ||
        destination?.type !== 'roth') {
      fail('sourceIdentityInvalid', 'Conversion key must bind its source and actual Plan Roth destination', {
        taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
      })
    }
    return sourceId!
  }
  fail(
    occurrence.kind === 'legacyQcd' ? 'qcdStageRequired' : 'sourceCoverageInvalid',
    'This retirement occurrence requires a later characterization or transfer stage',
    { taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey },
  )
}

function aggregateRothCredit(
  plan: Plan,
  taxYear: number,
  occurrences: readonly Readonly<SimulatorAnnualRetirementRuntimeOccurrence>[],
  applications: readonly Readonly<SimulatorRetirementRuntimeApplication>[],
  normalized: readonly NormalizedOwnedNonRothIraApplication[],
): Readonly<NormalizedAggregateRothDestinationCredit> | null {
  const conversions = occurrences.filter((entry) => entry.kind === 'legacyRothConversion')
  const ownedConversions = normalized.filter((entry) => entry.occurrenceKind === 'legacyRothConversion')
  const credits = applications.filter((entry): entry is Readonly<SimulatorRetirementRuntimeAggregateRothDestinationCredit> =>
    entry.applicationKind === 'aggregateRothDestinationCredit')
  const context = { taxYear }
  if (ownedConversions.length === 0) {
    if (credits.length !== 0) fail('aggregateRothCreditInvalid', 'Aggregate Roth credit requires an owned-IRA conversion debit', context)
    return null
  }
  if (credits.length !== 1) fail('aggregateRothCreditInvalid', 'Owned-IRA conversions require exactly one aggregate Roth credit', context)
  const credit = credits[0]!
  if (credit.simulatorPhase !== 'legacyRothConversionAggregateDestinationCredit' ||
      credit.producerOccurrenceKey !== null || credit.ownerPersonId !== null ||
      credit.sourceAccountId !== null || credit.sourceBalanceBeforePlanDollars !== null ||
      credit.sourceBalanceAfterPlanDollars !== null) {
    fail('aggregateRothCreditInvalid', 'Aggregate Roth credit must not impersonate per-source evidence', context)
  }
  const bySource = new Map(conversions.map((entry) => [entry.sourceAccountId, entry]))
  const ordered = plan.accounts.flatMap((account) => {
    const occurrence = bySource.get(account.id)
    return occurrence === undefined ? [] : [occurrence]
  })
  if (ordered.length !== conversions.length || bySource.size !== conversions.length) {
    fail('aggregateRothCreditInvalid', 'Conversion occurrences must map uniquely to Plan account order', context)
  }
  const keys = ordered.map((entry) => entry.producerOccurrenceKey)
  const owners = ordered.map((entry) => entry.ownerPersonId)
  if (JSON.stringify(credit.producerOccurrenceKeys) !== JSON.stringify(keys) ||
      JSON.stringify(credit.sourceOwnerPersonIds) !== JSON.stringify(owners) ||
      new Set(keys).size !== keys.length ||
      credit.mutationOrdinal <= Math.max(...ownedConversions.map((entry) => entry.mutationOrdinal))) {
    fail('aggregateRothCreditInvalid', 'Aggregate Roth credit must preserve the complete ordered legacy source loop after its debits', context)
  }
  const destinationId = credit.destinationRothAccountId
  const destination = plan.accounts.find((account) => account.id === destinationId)
  if (destinationId === null || destination?.type !== 'roth' ||
      credit.destinationOwnerPersonId === null || destination.ownerPersonId !== credit.destinationOwnerPersonId ||
      ordered.some((entry) => parseKey(entry.producerOccurrenceKey, taxYear)[2] !== destinationId)) {
    fail('aggregateRothCreditInvalid', 'Aggregate Roth credit must bind the common actual Plan Roth destination', context)
  }
  const rawTotal = summedPlanDollars(
    ordered.map((entry) => entry.grossAmountPlanDollars),
    'Aggregate conversion occurrence amount',
    context,
  )
  const total = cents(rawTotal, 'Aggregate conversion occurrence amount', context)
  cents(credit.destinationBalanceBeforePlanDollars, 'Roth destination opening balance', context)
  const credited = cents(credit.destinationCreditedAmountPlanDollars, 'Roth destination credit', context)
  cents(credit.destinationBalanceAfterPlanDollars, 'Roth destination closing balance', context)
  if (credit.destinationBalanceBeforePlanDollars +
      credit.destinationCreditedAmountPlanDollars !==
        credit.destinationBalanceAfterPlanDollars ||
      credited !== total ||
      !rawTotalsReconcile(
        rawTotal,
        credit.destinationCreditedAmountPlanDollars,
        ordered.length,
      )) {
    fail('aggregateRothCreditInvalid', 'Aggregate Roth credit must reconcile all conversion occurrences and its destination balance', context)
  }
  if (owners.some((owner) => owner === null)) fail('aggregateRothCreditInvalid', 'Conversion sources require explicit owners', context)
  const withoutId = {
    status: 'aggregateDestinationCreditSourceReconciled' as const,
    destinationAttribution: 'aggregateOnlyNotSourceAllocated' as const,
    actionability: 'notEstablished' as const,
    destinationRothAccountId: asAccountId(destinationId),
    destinationOwnerPersonId: credit.destinationOwnerPersonId as PersonId,
    destinationCreditedAmount: credited,
    producerOccurrenceKeys: keys,
    sourceOwnerPersonIds: owners as PersonId[],
  }
  return deepFreeze({
    ...withoutId,
    evidenceId: deriveActionStructuralId(
      'projection-owned-ira-runtime-source-aggregate-roth-credit',
      [plan.id, taxYear, withoutId],
    ),
  })
}

function blocked(
  issue: OwnedNonRothIraRuntimeSourceSeriesIssue,
  projectionStartTaxYear: number,
): Readonly<OwnedNonRothIraRuntimeSourceSeriesBlocked> {
  return deepFreeze({
    status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
    evidenceScope: 'projectionModelOnlyNotRealWorldFilingCompleteness',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    projectionStartTaxYear: Number.isSafeInteger(projectionStartTaxYear)
      ? projectionStartTaxYear : null,
    // Do not inspect rejected inputs while constructing fail-closed diagnostics.
    endTaxYear: null,
    years: null,
    evidenceId: null,
    issues: [issue],
  })
}

function validateUnchecked(
  rawPlan: Plan,
  projectionStartTaxYear: number,
  years: readonly Readonly<YearResult>[],
): Readonly<OwnedNonRothIraRuntimeSourceSeriesComplete> {
  const parsedPlan = planSchema.safeParse(rawPlan)
  if (!parsedPlan.success) fail('planInvalid', 'Runtime source replay requires a valid Plan')
  const plan = parsedPlan.data
  if (!Number.isSafeInteger(projectionStartTaxYear) || projectionStartTaxYear < 1 ||
      projectionStartTaxYear > 9999 || years.length === 0 ||
      years[0]!.year !== projectionStartTaxYear) {
    fail('yearSeriesInvalid', 'Runtime source series must begin at its authoritative projection start year')
  }
  for (let index = 0; index < years.length; index += 1) {
    if (years[index]!.year !== projectionStartTaxYear + index) {
      fail('yearSeriesInvalid', 'Runtime source years must be unique, ordered, and exactly contiguous')
    }
  }

  const accountById = new Map(plan.accounts.map((account) => [account.id, account]))
  const accountOrder = new Map(plan.accounts.map((account, index) => [account.id, index]))
  const pools = ownedPools(plan)
  const personIds = new Set(plan.household.people.map((person) => person.id))
  let openingBalances = new Map<AccountId, UsdCents>([...pools.values()].flat().map((account) => [
    asAccountId(account.id), cents(account.balance, 'Plan opening IRA balance', { sourceAccountId: account.id }),
  ]))
  const normalizedYears: NormalizedOwnedNonRothIraRuntimeSourceYear[] = []

  for (const yearResult of years) {
    const taxYear = yearResult.year
    const occurrenceSource = yearResult.retirementRuntimeSource
    const applicationSource = yearResult.retirementRuntimeApplicationSource
    const balanceSource = yearResult.ownedNonRothIraPostGrowthSource
    if (!occurrenceSource || !applicationSource || !balanceSource) {
      fail('sourceMissing', 'Each year requires occurrences, applications, and post-growth balances', { taxYear })
    }
    if (occurrenceSource.status !== 'runtimeOccurrenceSourcesCaptured' ||
        occurrenceSource.captureBoundary !== 'legacyAnnualPassCommittedBeforeYearResultPublication' ||
        occurrenceSource.journalValidation !== 'notRun' ||
        applicationSource.status !== 'runtimeApplicationSourcesCaptured' ||
        applicationSource.captureBoundary !== 'atOwnedNonRothIraMutationSitesBeforeAnnualGrowth' ||
        applicationSource.applicationValidation !== 'notRun' ||
        balanceSource.status !== 'postGrowthOwnedNonRothIraBalancesCaptured' ||
        balanceSource.captureBoundary !== 'afterAllAnnualTransactionsAndGrowthBeforeYearResultPublication' ||
        balanceSource.annualObservationValidation !== 'notRun' ||
        occurrenceSource.planId !== plan.id || applicationSource.planId !== plan.id ||
        balanceSource.planId !== plan.id || occurrenceSource.taxYear !== taxYear ||
        applicationSource.taxYear !== taxYear || balanceSource.taxYear !== taxYear) {
      fail('sourceContractInvalid', 'Raw sources must retain exact Plan/year/status/boundaries', { taxYear })
    }

    const occurrenceByKey = new Map<string, Readonly<SimulatorAnnualRetirementRuntimeOccurrence>>()
    const occurrenceOrderId = new Map<string, string>()
    for (let index = 0; index < occurrenceSource.runtimeOccurrences.length; index += 1) {
      const occurrence = occurrenceSource.runtimeOccurrences[index]!
      if (index > 0 && compareOccurrences(occurrenceSource.runtimeOccurrences[index - 1]!, occurrence) > 0) {
        fail('sourceOrderInvalid', 'Runtime occurrences must retain canonical publication order', { taxYear })
      }
      if (!occurrence.producerOccurrenceKey.trim() || occurrenceByKey.has(occurrence.producerOccurrenceKey)) {
        fail('sourceIdentityInvalid', 'Runtime occurrence keys must be nonblank and unique', {
          taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
        })
      }
      const amount = cents(occurrence.grossAmountPlanDollars, 'Runtime occurrence amount', {
        taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
      })
      if (amount === 0 || occurrence.executionDate !== null || occurrence.executionSequence !== null ||
          occurrence.movementAuthorityId !== null || occurrence.ownerPersonId === null ||
          occurrence.sourceAccountId === null || !personIds.has(occurrence.ownerPersonId)) {
        fail('sourceContractInvalid', 'Legacy occurrences require positive amount and Plan identity without invented chronology/authority', {
          taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
        })
      }
      const account = accountById.get(occurrence.sourceAccountId)
      if (!account || account.ownerPersonId !== occurrence.ownerPersonId || !sourceCompatible(occurrence, account)) {
        fail('sourceIdentityInvalid', 'Occurrence owner/source/kind must exact-rejoin its Plan account', {
          taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
        })
      }
      occurrenceOrderId.set(occurrence.producerOccurrenceKey, occurrenceOrderAccountId(plan, occurrence, taxYear))
      occurrenceByKey.set(occurrence.producerOccurrenceKey, occurrence)
    }
    reconcilePublishedTotal(
      occurrenceSource.runtimeOccurrences,
      ['ownedIraRmd', 'employerPlanRmd'],
      yearResult.rmd,
      'RMD',
      taxYear,
    )
    reconcilePublishedTotal(
      occurrenceSource.runtimeOccurrences,
      ['automaticSeppDistribution'],
      yearResult.sepp,
      'SEPP',
      taxYear,
    )
    reconcilePublishedTotal(
      occurrenceSource.runtimeOccurrences,
      ['inheritedIraRmd'],
      yearResult.inheritedDistribution,
      'inherited distribution',
      taxYear,
    )
    reconcilePublishedTotal(
      occurrenceSource.runtimeOccurrences,
      ['legacyRothConversion'],
      yearResult.rothConversion,
      'Roth conversion',
      taxYear,
    )

    const expectedOwners = [...pools.keys()]
    if (balanceSource.ownerPools.length !== expectedOwners.length) {
      fail('postGrowthPoolInvalid', 'Post-growth source must contain every and only complete owned-IRA pool', { taxYear })
    }
    const postGrowthBalances = new Map<AccountId, UsdCents>()
    const ownerBalances = new Map<PersonId, NormalizedOwnedNonRothIraYearEndBalance[]>()
    for (let ownerIndex = 0; ownerIndex < expectedOwners.length; ownerIndex += 1) {
      const owner = expectedOwners[ownerIndex]!
      const rawPool = balanceSource.ownerPools[ownerIndex]!
      const accounts = pools.get(owner)!
      if (rawPool.ownerPersonId !== owner || rawPool.accountBalances.length !== accounts.length) {
        fail('postGrowthPoolInvalid', 'Post-growth pools must retain canonical owner order and membership', { taxYear, ownerPersonId: owner })
      }
      const normalizedBalances = rawPool.accountBalances.map((raw, accountIndex) => {
        const account = accounts[accountIndex]!
        if (raw.sourceAccountId !== account.id) {
          fail('postGrowthPoolInvalid', 'Post-growth balances must retain canonical account order including zero siblings', {
            taxYear, ownerPersonId: owner, sourceAccountId: raw.sourceAccountId,
          })
        }
        if (!Object.hasOwn(yearResult.balances, account.id) ||
            yearResult.balances[account.id] !== raw.balancePlanDollars) {
          fail('postGrowthPoolInvalid', 'Post-growth balances must exact-rejoin the published account balance', {
            taxYear, ownerPersonId: owner, sourceAccountId: raw.sourceAccountId,
          })
        }
        const sourceAccountId = asAccountId(account.id)
        const balanceAmount = cents(raw.balancePlanDollars, 'Post-growth IRA balance', {
          taxYear, ownerPersonId: owner, sourceAccountId,
        })
        postGrowthBalances.set(sourceAccountId, balanceAmount)
        return { sourceAccountId, balancePlanDollars: raw.balancePlanDollars, balanceAmount }
      })
      ownerBalances.set(owner, normalizedBalances)
    }

    const normalizedApplications: NormalizedOwnedNonRothIraApplication[] = []
    const appliedKeys = new Set<string>()
    let priorPhase = -1
    let priorPhaseAccountOrder = -1
    for (let index = 0; index < applicationSource.applications.length; index += 1) {
      const application = applicationSource.applications[index]!
      const currentPhase = phaseRank(application)
      if (application.mutationOrdinal !== index + 1 || currentPhase < priorPhase) {
        fail('applicationOrderInvalid', 'Applications must retain contiguous ordinals and annual phase order', { taxYear })
      }
      if (application.applicationKind === 'aggregateRothDestinationCredit') {
        priorPhase = currentPhase
        priorPhaseAccountOrder = -1
        continue
      }
      const occurrence = occurrenceByKey.get(application.producerOccurrenceKey)
      const orderId = occurrenceOrderId.get(application.producerOccurrenceKey)
      const currentAccountOrder = orderId === undefined ? undefined : accountOrder.get(orderId)
      if (!occurrence || currentAccountOrder === undefined || appliedKeys.has(application.producerOccurrenceKey)) {
        fail('sourceCoverageInvalid', 'Each application must rejoin one unique ordered occurrence', {
          taxYear, producerOccurrenceKey: application.producerOccurrenceKey,
        })
      }
      if (currentPhase === priorPhase && currentAccountOrder < priorPhaseAccountOrder) {
        fail('applicationOrderInvalid', 'Applications within a simulator phase must retain controlling Plan account order', { taxYear })
      }
      priorPhase = currentPhase
      priorPhaseAccountOrder = currentAccountOrder
      appliedKeys.add(application.producerOccurrenceKey)
      const shape = applicationShape(occurrence.kind)
      const account = accountById.get(occurrence.sourceAccountId!)
      if (!shape || !account || !isAggregatedIra(account) ||
          shape.applicationKind !== application.applicationKind || shape.simulatorPhase !== application.simulatorPhase ||
          application.ownerPersonId !== occurrence.ownerPersonId || application.sourceAccountId !== occurrence.sourceAccountId) {
        fail('sourceCoverageInvalid', 'Application kind/phase/owner/source must exact-rejoin its owned-IRA occurrence', {
          taxYear, producerOccurrenceKey: application.producerOccurrenceKey,
        })
      }
      const context = {
        taxYear, ownerPersonId: occurrence.ownerPersonId!, sourceAccountId: occurrence.sourceAccountId!,
        producerOccurrenceKey: occurrence.producerOccurrenceKey,
      }
      const rawAmount = application.applicationKind === 'debit'
        ? application.appliedAmountPlanDollars : application.creditedAmountPlanDollars
      cents(rawAmount, 'Application amount', context)
      const before = cents(application.sourceBalanceBeforePlanDollars, 'Application opening balance', context)
      const after = cents(application.sourceBalanceAfterPlanDollars, 'Application closing balance', context)
      const occurrenceAmount = cents(occurrence.grossAmountPlanDollars, 'Occurrence amount', context)
      const sourceAccountId = asAccountId(occurrence.sourceAccountId!)
      const rawExpectedAfter = application.applicationKind === 'debit'
        ? application.sourceBalanceBeforePlanDollars - rawAmount
        : application.sourceBalanceBeforePlanDollars + rawAmount
      const normalizedAmount = application.applicationKind === 'debit'
        ? BigInt(before) - BigInt(after)
        : BigInt(after) - BigInt(before)
      if (rawAmount !== occurrence.grossAmountPlanDollars ||
          occurrenceAmount === 0 ||
          rawExpectedAfter !== application.sourceBalanceAfterPlanDollars ||
          openingBalances.get(sourceAccountId) !== before ||
          normalizedAmount <= 0n || normalizedAmount > MAX_SAFE_CENTS) {
        fail('balanceChainInvalid', 'Application must continue the exact per-account before/amount/after chain', context)
      }
      const amount = asUsdCents(Number(normalizedAmount))
      openingBalances.set(sourceAccountId, after)
      if (occurrence.kind === 'annuityFundingTransfer') {
        fail('annuityStageRequired', 'Annuity funding leaves the captured owned-IRA pool and requires a broader transfer stage', context)
      }
      normalizedApplications.push({
        producerOccurrenceKey: occurrence.producerOccurrenceKey,
        occurrenceKind: occurrence.kind as NormalizedOwnedNonRothIraApplication['occurrenceKind'],
        applicationKind: application.applicationKind,
        simulatorPhase: application.simulatorPhase as
          NormalizedOwnedNonRothIraApplication['simulatorPhase'],
        mutationOrdinal: application.mutationOrdinal,
        ownerPersonId: occurrence.ownerPersonId as PersonId,
        sourceAccountId,
        amount,
        sourceBalanceBefore: before,
        sourceBalanceAfter: after,
        form8606Line: shape.form8606Line,
      })
    }
    for (const occurrence of occurrenceSource.runtimeOccurrences) {
      const account = accountById.get(occurrence.sourceAccountId!)
      if (account && isAggregatedIra(account) && !appliedKeys.has(occurrence.producerOccurrenceKey)) {
        fail('sourceCoverageInvalid', 'Every owned-IRA occurrence must have one supported application', {
          taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
        })
      }
    }

    const qcd = cents(yearResult.qcd, 'Annual QCD total', { taxYear })
    const overlay = occurrenceSource.nonmovingLegacyQcdOverlay
    if ((overlay === null) !== (qcd === 0) || (overlay && (
      overlay.status !== 'nonmovingLegacyQcdCaptured' || overlay.kind !== 'legacyQcd' ||
      overlay.taxYear !== taxYear || overlay.ownerPersonId !== null || overlay.sourceAccountId !== null ||
      overlay.physicalMovement !== 'notAdditionalMovement' ||
      overlay.inventoryReplay !== 'requiresSeparateQcdCharacterizationStage' ||
      cents(overlay.grossAmountPlanDollars, 'QCD overlay amount', { taxYear }) !== qcd))) {
      fail('sourceContractInvalid', 'QCD overlay must exact-rejoin the annual nonmoving total', { taxYear })
    }
    if (qcd > 0) fail('qcdStageRequired', 'Household QCD cannot be source-allocated from RMD debits', { taxYear })

    const aggregate = aggregateRothCredit(
      plan, taxYear, occurrenceSource.runtimeOccurrences,
      applicationSource.applications, normalizedApplications,
    )
    const ownerSources = expectedOwners.map((owner) => {
      const applications = normalizedApplications.filter((entry) => entry.ownerPersonId === owner)
      const yearEndBalances = ownerBalances.get(owner)!
      const withoutId = { ownerPersonId: owner, taxYear, applications, yearEndBalances }
      return deepFreeze({
        ...withoutId,
        sourceChainEvidenceId: deriveActionStructuralId(
          'projection-owned-ira-runtime-source-chain',
          [plan.id, withoutId],
        ),
      })
    })
    const withoutId = { taxYear, ownerSources, aggregateRothDestinationCredit: aggregate }
    normalizedYears.push(deepFreeze({
      ...withoutId,
      evidenceId: deriveActionStructuralId('projection-owned-ira-runtime-source-year', [plan.id, withoutId]),
    }))
    openingBalances = postGrowthBalances
  }

  const withoutId = {
    status: 'ownedNonRothIraRuntimeSourceSeriesComplete' as const,
    evidenceScope: 'projectionModelOnlyNotRealWorldFilingCompleteness' as const,
    movement: 'notCommitted' as const,
    actionability: 'notEstablished' as const,
    projectionStartTaxYear,
    endTaxYear: years.at(-1)!.year,
    years: normalizedYears,
  }
  return deepFreeze({
    ...withoutId,
    evidenceId: deriveActionStructuralId('projection-owned-ira-runtime-source-series', [plan.id, withoutId]),
    issues: [],
  })
}

/** Validate and normalize only simulator-owned sources; derive no tax basis. */
export function validateOwnedNonRothIraRuntimeSourceSeries(
  plan: Plan,
  projectionStartTaxYear: number,
  years: readonly Readonly<YearResult>[],
): Readonly<OwnedNonRothIraRuntimeSourceSeriesResult> {
  try {
    return validateUnchecked(plan, projectionStartTaxYear, years)
  } catch (error) {
    if (error instanceof SourceSeriesFailure) return blocked(error.issue, projectionStartTaxYear)
    return blocked({
      kind: 'sourceSeriesConstructionInvalid',
      detail: `Runtime source validation failed closed: ${safeDetail(error)}`,
    }, projectionStartTaxYear)
  }
}
