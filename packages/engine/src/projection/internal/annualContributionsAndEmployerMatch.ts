/**
 * Pure planner for the annual contribution and employer-match phase.
 *
 * The helper never mutates caller balances, basis pools, warnings, or runtime
 * journals. It returns one ordered operation stream; `simulatePlan` remains the
 * owner of those mutations and applies each operation at its original site.
 */
import type { Account } from '../../model/plan.js'
import type { ParameterPack } from '../../params/types.js'
import {
  acceptsContributions,
  isAggregatedIra,
} from '../../strategies/accountEligibility.js'
import { addCalendarMonths } from '../../actions/civilDate.js'
import {
  allocateEmployerElectiveDeferrals,
  employerMatchElectiveBase,
  indexRothCatchUpWageThreshold,
  type EmployerElectiveAllocation,
  type EmployerElectiveRequest,
} from '../employerRothCatchUp.js'
import type {
  RecordedContribution,
  RecordedEmployerMatch,
} from '../annualCashFlowYearSites.js'
import type {
  SimulatorAnnualRetirementRuntimeOccurrence,
} from '../annualRetirementRuntimeJournal.js'
import type {
  ProjectedFilingStatus,
  SimulatorRetirementRuntimeApplication,
} from '../types.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from '../moneyTolerance.js'

type ContributionAccount = Extract<Account, {
  type: 'cash' | 'taxable' | 'equityComp' | 'traditional' | 'roth' | 'hsa'
}>

type RuntimeApplicationWithoutOrdinal =
  SimulatorRetirementRuntimeApplication extends infer Application
    ? Application extends SimulatorRetirementRuntimeApplication
      ? Omit<Application, 'mutationOrdinal'>
      : never
    : never

export interface AnnualContributionBalanceView {
  readonly account: ContributionAccount
  readonly balance: number
  readonly costBasis: number
}

export interface AnnualContributionOwnerState {
  readonly alive: boolean
  readonly ageAttained: number
}

export interface AnnualContributionsAndEmployerMatchInput {
  readonly balances: readonly AnnualContributionBalanceView[]
  readonly year: number
  readonly startYear: number
  readonly inflFactor: number
  readonly limitGrowth: number
  readonly filingStatus: ProjectedFilingStatus
  readonly aliveCount: number
  readonly peopleCount: number
  readonly primaryPersonId: string
  readonly wagesByPerson: ReadonlyMap<string, number>
  readonly resolveOwnerState: (ownerPersonId: string) => AnnualContributionOwnerState
  readonly resolveOwnerBirthYear: (ownerPersonId: string) => number
  readonly resolveOwnerDob: (ownerPersonId: string) => string | null
  readonly resolveRothPoolKey: (
    account: Extract<Account, { type: 'roth' }>,
  ) => string
  readonly runtimeOccurrenceKey: (
    kind: SimulatorAnnualRetirementRuntimeOccurrence['kind'],
    ...binding: readonly unknown[]
  ) => string
  readonly iraHouseholdCompensationKey: string
  readonly indexWithStatutoryRounding: (
    base: number,
    growth: number,
  ) => number
  readonly pack: ParameterPack
}

export interface AnnualContributionWarningOperation {
  readonly kind: 'warning'
  readonly message: string
}

export interface AnnualContributionCreditOperation {
  readonly kind: 'contribution'
  /** Index into the caller's balance array; account ids may collide. */
  readonly balanceIndex: number
  /** Exact positional account supplied by the caller; duplicate ids are valid. */
  readonly sourceAccount: ContributionAccount
  readonly balanceBefore: number
  readonly balanceAfter: number
  readonly costBasisBefore: number
  readonly costBasisAfter: number
  readonly credited: number
  readonly retirementOccurrence:
    Readonly<SimulatorAnnualRetirementRuntimeOccurrence> | null
  readonly retirementApplication:
    Readonly<RuntimeApplicationWithoutOrdinal> | null
  readonly rothContributionPoolKey: string | null
  readonly rothContributionBasisDelta: number
  readonly qcdSection219OwnerPersonId: string | null
  readonly qcdSection219Amount: number
  readonly record: Readonly<RecordedContribution>
}

export interface AnnualEmployerMatchOperation {
  readonly kind: 'employerMatch'
  /** Index into the caller's balance array; account ids may collide. */
  readonly balanceIndex: number
  /** Exact positional account supplied by the caller; duplicate ids are valid. */
  readonly sourceAccount: ContributionAccount
  readonly balanceBefore: number
  readonly balanceAfter: number
  readonly retirementOccurrence:
    Readonly<SimulatorAnnualRetirementRuntimeOccurrence> | null
  readonly record: Readonly<RecordedEmployerMatch>
}

export type AnnualContributionAndMatchOperation =
  | AnnualContributionWarningOperation
  | AnnualContributionCreditOperation
  | AnnualEmployerMatchOperation

export type AnnualContributionAndMatchOperationIdentity =
  | Readonly<{ kind: 'warning' }>
  | Readonly<{
      kind: 'contribution' | 'employerMatch'
      balanceIndex: number
    }>

export interface AnnualContributionsAndEmployerMatchTotals {
  readonly contributions: number
  readonly ownedNonRothIraContributions: number
  readonly employerMatch: number
  readonly preTaxContributions: number
  readonly traditionalInflow: number
  readonly otherInflow: number
  readonly taxableInflow: number
}

export interface AnnualContributionsAndEmployerMatchResult {
  readonly operations: readonly AnnualContributionAndMatchOperation[]
  /**
   * Identity channel emitted with the operation stream. The caller reconciles
   * it with both the stream and the independently planned expectation below.
   */
  readonly operationIdentities:
    readonly AnnualContributionAndMatchOperationIdentity[]
  /**
   * Expected operation order derived at the planning decision sites rather
   * than from `emit`. Keeping this witness separate means a coordinated
   * omission or insertion in the emitted stream still fails closed.
   */
  readonly expectedOperationIdentities:
    readonly AnnualContributionAndMatchOperationIdentity[]
  /**
   * Physical contribution rows derived from request eligibility before the
   * operation loop. This does not repeat limit or dollar arithmetic.
   */
  readonly expectedContributionBalanceIndices: readonly number[]
  readonly totals: Readonly<AnnualContributionsAndEmployerMatchTotals>
  readonly employerAllocationByOwner:
    ReadonlyMap<string, Readonly<EmployerElectiveAllocation>>
}

const CONTRIBUTION_LIMIT_WARNING =
  'Some contributions were reduced to stay within IRS annual limits.'

function isEmployerPlanAccount(account: Account): account is Extract<
  Account,
  { type: 'traditional' | 'roth' }
> & { readonly kind: 'employer' } {
  return (account.type === 'traditional' || account.type === 'roth') &&
    account.kind === 'employer'
}

export function annualContributionsAndEmployerMatch(
  input: AnnualContributionsAndEmployerMatchInput,
): AnnualContributionsAndEmployerMatchResult {
  const operations: AnnualContributionAndMatchOperation[] = []
  const operationIdentities: AnnualContributionAndMatchOperationIdentity[] = []
  const expectedOperationIdentities:
    AnnualContributionAndMatchOperationIdentity[] = []
  const emit = (operation: AnnualContributionAndMatchOperation): void => {
    operationIdentities.push(
      operation.kind === 'warning'
        ? { kind: operation.kind }
        : {
            kind: operation.kind,
            balanceIndex: operation.balanceIndex,
          },
    )
    operations.push(operation)
  }
  const shadowBalances = input.balances.map((state) => state.balance)
  const shadowCostBases = input.balances.map((state) => state.costBasis)
  let contributions = 0
  let ownedNonRothIraContributions = 0
  let employerMatch = 0
  let preTaxContributions = 0
  let traditionalInflow = 0
  let otherInflow = 0
  let taxableInflow = 0
  const groupUsed = new Map<string, number>()
  const addition415cUsed = new Map<string, number>()
  const iraCompensationIsShared =
    input.filingStatus === 'marriedFilingJointly' && input.aliveCount === 2
  const iraCompensationRemaining = new Map<string, number>()
  if (iraCompensationIsShared) {
    let combined = 0
    for (const wages of input.wagesByPerson.values()) combined += wages
    iraCompensationRemaining.set(input.iraHouseholdCompensationKey, combined)
  } else {
    for (const [personId, wages] of input.wagesByPerson) {
      iraCompensationRemaining.set(personId, wages)
    }
  }

  const employerCatchUpForAge = (age: number): number =>
    age >= 60 && age <= 63
      ? input.indexWithStatutoryRounding(
          input.pack.contributionLimits.superCatchUp60to63,
          input.limitGrowth,
        )
      : age >= 50
        ? input.pack.contributionLimits.catchUp50 * input.limitGrowth
        : 0

  // Contribution rows are positional even when public account ids collide.
  // Never use an id-keyed map to decide what a row requested or received.
  const desiredByBalanceIndex = new Map<number, number>()
  const employerRowKey = (balanceIndex: number): string => String(balanceIndex)
  for (const [balanceIndex, state] of input.balances.entries()) {
    const account = state.account
    const hasSchedule = 'contributionSchedule' in account &&
      account.contributionSchedule && account.contributionSchedule.length > 0
    if (
      account.annualContribution <= 0 &&
      !hasSchedule &&
      !isEmployerPlanAccount(account)
    ) continue
    if (!acceptsContributions(account)) continue
    const ownerId = account.ownerPersonId ?? input.primaryPersonId
    const ownerState = input.resolveOwnerState(ownerId)
    if (!ownerState.alive) continue

    let desired = 0
    if (hasSchedule) {
      const ownerBirthYear = input.resolveOwnerBirthYear(ownerId)
      const ownerAgeAtStartYear = input.startYear - ownerBirthYear
      for (const phase of account.contributionSchedule!) {
        const fromAge = phase.fromAge ?? 0
        const toAge = phase.toAge ?? 120
        const age = ownerState.ageAttained
        if (age >= fromAge && age <= toAge) {
          const phaseStartYear = phase.fromAge !== null
            ? input.startYear + (phase.fromAge - ownerAgeAtStartYear)
            : input.startYear
          const yearsElapsed = Math.max(0, input.year - phaseStartYear)
          desired += phase.annualAmount *
            Math.pow(1 + phase.escalationPct / 100, yearsElapsed) *
            input.inflFactor
        }
      }
      if (
        isEmployerPlanAccount(account) &&
        (input.wagesByPerson.get(ownerId) ?? 0) <= 0
      ) {
        desired = 0
      }
    } else if ((input.wagesByPerson.get(ownerId) ?? 0) <= 0) {
      desired = 0
    } else {
      desired = account.annualContribution * input.inflFactor
    }
    desiredByBalanceIndex.set(balanceIndex, desired)
  }
  const expectedContributionBalanceIndices = input.balances.flatMap(
    (state, balanceIndex) => {
      if (!desiredByBalanceIndex.has(balanceIndex)) return []
      const desired = desiredByBalanceIndex.get(balanceIndex) ?? 0
      return desired > 0 || isEmployerPlanAccount(state.account)
        ? [balanceIndex]
        : []
    },
  )

  const employerAllocated = new Map<string, number>()
  const employerAllocationByOwner =
    new Map<string, EmployerElectiveAllocation>()
  const employerRequestsByOwner =
    new Map<string, EmployerElectiveRequest[]>()
  const employeeLandedByEmployerRowKey = new Map<string, number>()
  for (const [balanceIndex, state] of input.balances.entries()) {
    const account = state.account
    if (
      !isEmployerPlanAccount(account) ||
      !desiredByBalanceIndex.has(balanceIndex)
    ) continue
    const ownerId = account.ownerPersonId ?? input.primaryPersonId
    const rowKey = employerRowKey(balanceIndex)
    const list = employerRequestsByOwner.get(ownerId) ?? []
    list.push({
      accountId: rowKey,
      type: account.type,
      desired: desiredByBalanceIndex.get(balanceIndex) ?? 0,
      priorCalendarYearFicaWages: account.priorCalendarYearFicaWages ?? 0,
    })
    employerRequestsByOwner.set(ownerId, list)
  }
  for (const [ownerId, requests] of employerRequestsByOwner) {
    const age = input.resolveOwnerState(ownerId).ageAttained
    const allocation = allocateEmployerElectiveDeferrals(requests, {
      contributionYear: input.year,
      baseLimit: input.pack.contributionLimits.employee401k * input.limitGrowth,
      catchUpLimit: employerCatchUpForAge(age),
      wageThreshold: indexRothCatchUpWageThreshold(
        input.pack.contributionLimits.rothCatchUpWageThreshold,
        input.limitGrowth,
      ),
      compensation: input.wagesByPerson.get(ownerId) ?? 0,
    })
    employerAllocationByOwner.set(ownerId, allocation)
    for (const [accountId, amount] of allocation.allowed) {
      employerAllocated.set(accountId, amount)
    }
  }

  for (
    let balanceIndex = 0;
    balanceIndex < input.balances.length;
    balanceIndex++
  ) {
    const state = input.balances[balanceIndex]!
    const account = state.account
    if (!desiredByBalanceIndex.has(balanceIndex)) continue
    const ownerId = account.ownerPersonId ?? input.primaryPersonId
    const ownerState = input.resolveOwnerState(ownerId)
    const desired = desiredByBalanceIndex.get(balanceIndex) ?? 0
    const isEmployerAccount = isEmployerPlanAccount(account)
    const rowKey = employerRowKey(balanceIndex)
    if (desired <= 0 && !isEmployerAccount) continue

    let allowed = desired
    let groupKey: string | null = null
    let compensationKey: string | null = null
    let limit = Infinity
    const age = ownerState.ageAttained
    if (isEmployerAccount) {
      groupKey = `${ownerId}:employer`
      allowed = employerAllocated.get(rowKey) ?? 0
    } else if (
      (account.type === 'traditional' || account.type === 'roth') &&
      account.kind === 'ira'
    ) {
      groupKey = `${ownerId}:ira`
      const catchUp = age >= 50 ? input.pack.contributionLimits.iraCatchUp50 : 0
      limit = (input.pack.contributionLimits.ira + catchUp) * input.limitGrowth
      compensationKey = iraCompensationIsShared
        ? input.iraHouseholdCompensationKey
        : ownerId
    } else if (account.type === 'hsa') {
      groupKey = `${ownerId}:hsa`
      const hasFamilyCoverage = input.peopleCount === 2
      const dividesFamilyLimit = hasFamilyCoverage &&
        input.filingStatus === 'marriedFilingJointly' && input.aliveCount === 2
      const base = hasFamilyCoverage
        ? input.pack.contributionLimits.hsaFamily /
          (dividesFamilyLimit ? 2 : 1)
        : input.pack.contributionLimits.hsaSelfOnly
      const catchUp = age >= 55
        ? input.pack.contributionLimits.hsaCatchUp55
        : 0
      limit = base * input.limitGrowth + catchUp
    }
    if (groupKey !== null && !isEmployerAccount) {
      const used = groupUsed.get(groupKey) ?? 0
      allowed = Math.max(0, Math.min(desired, limit - used))
    }

    const used415c = addition415cUsed.get(ownerId) ?? 0
    let countableEmployee = 0
    if (isEmployerAccount) {
      const catchUp = employerAllocationByOwner.get(ownerId)
        ?.catchUpByAccount.get(rowKey) ?? 0
      const countable = Math.max(0, allowed - catchUp)
      const limit415c = Math.min(
        input.pack.contributionLimits.section415cLimit * input.limitGrowth,
        input.wagesByPerson.get(ownerId) ?? 0,
      )
      countableEmployee = Math.max(
        0,
        Math.min(countable, limit415c - used415c),
      )
      allowed = countableEmployee + catchUp
    }

    if (groupKey !== null) {
      if (compensationKey !== null) {
        const compensation = iraCompensationRemaining.get(compensationKey) ?? 0
        allowed = Math.max(0, Math.min(allowed, compensation))
        iraCompensationRemaining.set(compensationKey, compensation - allowed)
      }
      if (
        !isEmployerAccount &&
        allowed < desired - ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS
      ) {
        expectedOperationIdentities.push({ kind: 'warning' })
        emit({ kind: 'warning', message: CONTRIBUTION_LIMIT_WARNING })
      }
      groupUsed.set(groupKey, (groupUsed.get(groupKey) ?? 0) + allowed)
    }

    const catchUpAllocation = employerAllocationByOwner.get(ownerId)
    const redirectedFromHere = catchUpAllocation
      ?.redirectedCatchUpBySource.get(rowKey) ?? 0
    const redirectedOntoHere = catchUpAllocation !== undefined &&
      catchUpAllocation.catchUpRothAccountId === rowKey
      ? [...catchUpAllocation.redirectedCatchUpBySource.values()].reduce(
          (sum, amount) => sum + amount,
          0,
        )
      : 0
    const postRoutingRequested =
      Math.max(0, desired - redirectedFromHere) + redirectedOntoHere
    const contributionOwnerPersonId = 'ownerPersonId' in account
      ? account.ownerPersonId ?? null
      : null
    const record: RecordedContribution = {
      destinationAccountId: account.id,
      ownerPersonId: contributionOwnerPersonId,
      requested: postRoutingRequested,
      credited: allowed <= 0 ? 0 : allowed,
    }
    const balanceBefore = shadowBalances[balanceIndex]!
    const costBasisBefore = shadowCostBases[balanceIndex]!
    expectedOperationIdentities.push({ kind: 'contribution', balanceIndex })
    if (allowed <= 0) {
      emit({
        kind: 'contribution',
        balanceIndex,
        sourceAccount: account,
        balanceBefore,
        balanceAfter: balanceBefore,
        costBasisBefore,
        costBasisAfter: costBasisBefore,
        credited: 0,
        retirementOccurrence: null,
        retirementApplication: null,
        rothContributionPoolKey: null,
        rothContributionBasisDelta: 0,
        qcdSection219OwnerPersonId: null,
        qcdSection219Amount: 0,
        record,
      })
      continue
    }

    if (isEmployerAccount) {
      addition415cUsed.set(ownerId, used415c + countableEmployee)
    }
    const balanceAfter = balanceBefore + allowed
    shadowBalances[balanceIndex] = balanceAfter
    const contributionKind = account.type === 'traditional'
      ? account.kind === 'employer'
        ? 'employerPlanEmployeeContribution' as const
        : 'ownedIraContribution' as const
      : null
    const producerOccurrenceKey = contributionKind === null
      ? null
      : input.runtimeOccurrenceKey(
          contributionKind,
          account.id,
          balanceIndex,
        )
    const retirementOccurrence = contributionKind === null
      ? null
      : {
          producerOccurrenceKey: producerOccurrenceKey!,
          kind: contributionKind,
          grossAmountPlanDollars: allowed,
          ownerPersonId: account.type === 'traditional'
            ? account.ownerPersonId
            : null,
          sourceAccountId: account.id,
          executionDate: null,
          executionSequence: null,
          movementAuthorityId: null,
        } satisfies SimulatorAnnualRetirementRuntimeOccurrence
    const retirementApplication =
      contributionKind !== null && isAggregatedIra(account)
        ? {
            applicationKind: 'credit' as const,
            producerOccurrenceKey: producerOccurrenceKey!,
            simulatorPhase: 'employeeContribution' as const,
            ownerPersonId: account.ownerPersonId,
            sourceAccountId: account.id,
            balanceIndex,
            sourceBalanceBeforePlanDollars: balanceBefore,
            creditedAmountPlanDollars: allowed,
            sourceBalanceAfterPlanDollars: balanceAfter,
          }
        : null
    let costBasisAfter = costBasisBefore
    if (account.type === 'taxable' || account.type === 'equityComp') {
      costBasisAfter += allowed
      shadowCostBases[balanceIndex] = costBasisAfter
    }
    const rothContributionPoolKey = account.type === 'roth'
      ? input.resolveRothPoolKey(account)
      : null
    let qcdSection219OwnerPersonId: string | null = null
    let qcdSection219Amount = 0
    contributions += allowed
    if (isAggregatedIra(account)) ownedNonRothIraContributions += allowed
    if (account.type === 'traditional' && account.kind === 'ira') {
      const ownerDob = input.resolveOwnerDob(ownerId)
      const thresholdDate = ownerDob === null
        ? null
        : addCalendarMonths(ownerDob, 846)
      const thresholdYear = thresholdDate === null
        ? null
        : Number(thresholdDate.slice(0, 4))
      if (thresholdYear !== null && input.year >= thresholdYear) {
        qcdSection219OwnerPersonId = ownerId
        qcdSection219Amount = allowed
      }
    }
    if (account.type === 'traditional' || account.type === 'hsa') {
      preTaxContributions += allowed
    }
    if (account.type === 'traditional') traditionalInflow += allowed
    else otherInflow += allowed
    if (account.type === 'taxable' || account.type === 'equityComp') {
      taxableInflow += allowed
    }
    if (isEmployerAccount) {
      employeeLandedByEmployerRowKey.set(rowKey, allowed)
    }
    emit({
      kind: 'contribution',
      balanceIndex,
      sourceAccount: account,
      balanceBefore,
      balanceAfter,
      costBasisBefore,
      costBasisAfter,
      credited: allowed,
      retirementOccurrence,
      retirementApplication,
      rothContributionPoolKey,
      rothContributionBasisDelta: account.type === 'roth' ? allowed : 0,
      qcdSection219OwnerPersonId,
      qcdSection219Amount,
      record,
    })
  }

  for (const [, requests] of employerRequestsByOwner) {
    let desiredTotal = 0
    let landedTotal = 0
    for (const request of requests) {
      desiredTotal += request.desired
      landedTotal += employeeLandedByEmployerRowKey.get(request.accountId) ?? 0
    }
    if (
      landedTotal <
      desiredTotal - ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS
    ) {
      expectedOperationIdentities.push({ kind: 'warning' })
      emit({ kind: 'warning', message: CONTRIBUTION_LIMIT_WARNING })
    }
  }

  for (
    let balanceIndex = 0;
    balanceIndex < input.balances.length;
    balanceIndex++
  ) {
    const state = input.balances[balanceIndex]!
    const account = state.account
    if (
      !isEmployerPlanAccount(account) ||
      !desiredByBalanceIndex.has(balanceIndex)
    ) continue
    if (!account.employerMatch) continue
    const ownerId = account.ownerPersonId ?? input.primaryPersonId
    const rowKey = employerRowKey(balanceIndex)
    const matchInfo = account.employerMatch
    const ownerWages = input.wagesByPerson.get(ownerId) ?? 0
    if (ownerWages <= 0) continue
    const allocation = employerAllocationByOwner.get(ownerId)
    const electiveForMatch = allocation === undefined
      ? employeeLandedByEmployerRowKey.get(rowKey) ?? 0
      : employerMatchElectiveBase({
          accountId: rowKey,
          employeeLandedByAccountId: employeeLandedByEmployerRowKey,
          allocatedByAccountId: employerAllocated,
          redirectedCatchUpBySource: allocation.redirectedCatchUpBySource,
          catchUpRothAccountId: allocation.catchUpRothAccountId,
        })
    const matchCap = (matchInfo.capPctOfPay / 100) * ownerWages
    const baseMatch = Math.min(electiveForMatch, matchCap)
    let matchVal = baseMatch * (matchInfo.matchPct / 100)
    const limit415c = Math.min(
      input.pack.contributionLimits.section415cLimit * input.limitGrowth,
      ownerWages,
    )
    const usedSoFar = addition415cUsed.get(ownerId) ?? 0
    const remaining415cLimit = Math.max(0, limit415c - usedSoFar)
    matchVal = Math.min(matchVal, remaining415cLimit)
    if (matchVal <= 0) continue

    const balanceBefore = shadowBalances[balanceIndex]!
    const balanceAfter = balanceBefore + matchVal
    shadowBalances[balanceIndex] = balanceAfter
    const kind = account.type === 'traditional'
      ? 'employerPlanEmployerMatch' as const
      : null
    const retirementOccurrence = kind === null
      ? null
      : {
          producerOccurrenceKey: input.runtimeOccurrenceKey(
            kind,
            account.id,
            balanceIndex,
          ),
          kind,
          grossAmountPlanDollars: matchVal,
          ownerPersonId: account.ownerPersonId,
          sourceAccountId: account.id,
          executionDate: null,
          executionSequence: null,
          movementAuthorityId: null,
        } satisfies SimulatorAnnualRetirementRuntimeOccurrence
    const record: RecordedEmployerMatch = {
      destinationAccountId: account.id,
      ownerPersonId: account.ownerPersonId ?? null,
      amount: matchVal,
    }
    expectedOperationIdentities.push({ kind: 'employerMatch', balanceIndex })
    emit({
      kind: 'employerMatch',
      balanceIndex,
      sourceAccount: account,
      balanceBefore,
      balanceAfter,
      retirementOccurrence,
      record,
    })
    employerMatch += matchVal
    if (account.type === 'traditional') traditionalInflow += matchVal
    else otherInflow += matchVal
    addition415cUsed.set(ownerId, usedSoFar + matchVal)
  }

  return {
    operations,
    operationIdentities,
    expectedOperationIdentities,
    expectedContributionBalanceIndices,
    totals: {
      contributions,
      ownedNonRothIraContributions,
      employerMatch,
      preTaxContributions,
      traditionalInflow,
      otherInflow,
      taxableInflow,
    },
    employerAllocationByOwner,
  }
}
