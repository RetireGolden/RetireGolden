/**
 * Pure annual owner-RMD and first-year-deferral planner.
 *
 * The input contains exactly one live row per logical account ID. The planner
 * computes logical draws, aggregation sweeps, §4974 obligations, and ordered
 * cross-year deferral-map operations without mutating caller-owned state.
 */
import type { Account, Person } from '../../model/plan.js'
import type { ParameterPack } from '../../params/types.js'
import { rmdStartAgeForBirthYear } from '../../params/index.js'
import { requiredMinimumDistribution } from '../../rmd/rmd.js'
import {
  rmdApplicablePlanKey,
  rmdShortfallObligationId,
  sameRmdApplicablePlan,
  type RmdApplicablePlan,
  type RmdShortfallObligation,
} from '../../rmd/rmdShortfallExcise.js'
import { socialSecurityDobParts } from '../../socialSecurity/annualTiming.js'
import type { SimulatorAnnualPassDeferredFirstRmd } from '../annualPassTransaction.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from '../moneyTolerance.js'
import type { PersonYearState } from '../types.js'

export interface OwnerRmdLogicalBalance {
  readonly account: Readonly<Account>
  readonly balance: number
}

export interface OwnerRmdFirstYearDeferralElection {
  readonly distributionCalendarYear: number
  readonly applicablePlan: RmdApplicablePlan
}

export type DeferredFirstRmdOperation =
  | Readonly<{ kind: 'delete'; applicablePlanKey: string }>
  | Readonly<{
      kind: 'set'
      applicablePlanKey: string
      value: SimulatorAnnualPassDeferredFirstRmd
    }>

export interface AnnualOwnerRmdPlanInput {
  /** Required contract: one aggregate live row per logical ID; simulatePlan supplies annualLogicalBalanceLedger.liveStates(), and other callers must group duplicate physical rows first. Repeated IDs are rejected rather than sharing RMD state. */
  readonly balances: readonly OwnerRmdLogicalBalance[]
  /** Aggregate prior-Dec-31 balance by logical account ID. */
  readonly startOfYearBalance: ReadonlyMap<string, number>
  readonly people: readonly Readonly<Person>[]
  readonly personById: ReadonlyMap<string, Readonly<Person>>
  readonly stateOf: (personId: string) => Readonly<PersonYearState>
  readonly primaryPersonId: string
  readonly followsOwnerRmdsThisYear: (account: Readonly<Account>) => boolean
  readonly applicablePlanForAccount: (
    account: Readonly<Extract<Account, { type: 'traditional' }>>,
  ) => RmdApplicablePlan
  readonly deferredFirstRmdByApplicablePlan: ReadonlyMap<
    string,
    Readonly<SimulatorAnnualPassDeferredFirstRmd>
  >
  readonly firstYearDeferrals: readonly Readonly<OwnerRmdFirstYearDeferralElection>[]
  readonly pack: Readonly<ParameterPack>
  readonly year: number
}

export interface AnnualOwnerRmdPlanResult {
  readonly rmdTakeByAccount: Map<string, number>
  readonly rmdObligationByAccount: Map<string, number>
  readonly applicablePlanByKey: Map<string, RmdApplicablePlan>
  readonly iraRmdRequiredByOwner: Map<string, number>
  readonly iraRmdUnsatisfiedByOwner: Map<string, number>
  readonly rmdShortfallObligations: RmdShortfallObligation[]
  readonly deferredFirstRmdOperations: readonly DeferredFirstRmdOperation[]
}

function assertUniqueLogicalIds(balances: readonly OwnerRmdLogicalBalance[]): void {
  const seen = new Set<string>()
  for (const { account } of balances) {
    if (seen.has(account.id)) {
      throw new Error(`annual owner-RMD input repeated logical account id "${account.id}"`)
    }
    seen.add(account.id)
  }
}

export function annualOwnerRmdPlan(
  input: AnnualOwnerRmdPlanInput,
): AnnualOwnerRmdPlanResult {
  const {
    balances,
    startOfYearBalance,
    people,
    personById,
    stateOf,
    primaryPersonId,
    followsOwnerRmdsThisYear,
    applicablePlanForAccount,
    deferredFirstRmdByApplicablePlan,
    firstYearDeferrals,
    pack,
    year,
  } = input
  assertUniqueLogicalIds(balances)
  const epsilon = ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS
  const rmdTakeByAccount = new Map<string, number>()
  const rmdObligationByAccount = new Map<string, number>()
  const currentRmdRequiredByApplicablePlan = new Map<string, number>()
  const currentRmdDistributedByApplicablePlan = new Map<string, number>()
  const applicablePlanByKey = new Map<string, RmdApplicablePlan>()
  const unmetAggregableRmdByApplicablePlan = new Map<string, number>()
  const iraRmdRequiredByOwner = new Map<string, number>()
  const iraRmdUnsatisfiedByOwner = new Map<string, number>()
  const rmdShortfallObligations: RmdShortfallObligation[] = []
  const deferredFirstRmdOperations: DeferredFirstRmdOperation[] = []
  const deferredShadow = new Map(deferredFirstRmdByApplicablePlan)

  // April 1 obligations consume capacity before current December 31 amounts.
  // Map insertion order is observable and intentionally preserved.
  for (const [planKey, deferred] of deferredShadow) {
    if (deferred.dueYear !== year) continue
    let distributedByDeadline = 0
    for (const state of balances) {
      if (distributedByDeadline >= deferred.requiredAmount - epsilon) break
      if (state.account.type !== 'traditional') continue
      if (!followsOwnerRmdsThisYear(state.account)) continue
      if (!sameRmdApplicablePlan(
        applicablePlanForAccount(state.account),
        deferred.applicablePlan,
      )) continue
      const capacity = state.balance - (rmdTakeByAccount.get(state.account.id) ?? 0)
      if (capacity <= epsilon) continue
      const take = Math.min(capacity, deferred.requiredAmount - distributedByDeadline)
      rmdTakeByAccount.set(
        state.account.id,
        (rmdTakeByAccount.get(state.account.id) ?? 0) + take,
      )
      distributedByDeadline += take
    }
    rmdShortfallObligations.push({
      obligationId: rmdShortfallObligationId(
        deferred.applicablePlan,
        deferred.distributionCalendarYear,
        year,
      ),
      distributionCalendarYear: deferred.distributionCalendarYear,
      taxYear: year,
      taxImposedOn: `${year}-04-01`,
      applicablePlan: deferred.applicablePlan,
      requirementKind: 'ownedAnnual',
      requiredAmount: deferred.requiredAmount,
      distributedByDeadline,
    })
    applicablePlanByKey.set(planKey, deferred.applicablePlan)
    deferredShadow.delete(planKey)
    deferredFirstRmdOperations.push({ kind: 'delete', applicablePlanKey: planKey })
  }

  // Compute one requirement per logical account ID in first-ID order.
  for (const state of balances) {
    if (state.account.type !== 'traditional') continue
    if (!followsOwnerRmdsThisYear(state.account)) continue
    const ownerId = state.account.ownerPersonId ?? primaryPersonId
    const owner = personById.get(ownerId)!
    const ownerState = stateOf(ownerId)
    if (!ownerState.alive) continue
    const spousePerson = state.account.spouseSoleBeneficiary
      ? people.find((person) => person.id !== ownerId)
      : undefined
    const spouseState = spousePerson ? stateOf(spousePerson.id) : undefined
    const spouse = spousePerson && spouseState?.alive
      ? { ageAttained: spouseState.ageAttained, sex: spousePerson.sex }
      : undefined
    const ownerDobYear = socialSecurityDobParts(owner).y
    const rmd = requiredMinimumDistribution(
      pack,
      ownerDobYear,
      ownerState.ageAttained,
      startOfYearBalance.get(state.account.id) ?? 0,
      { ownerSex: owner.sex, spouse },
    )
    if (rmd <= 0) continue
    const applicablePlan = applicablePlanForAccount(state.account)
    const applicablePlanKey = rmdApplicablePlanKey(applicablePlan)
    applicablePlanByKey.set(applicablePlanKey, applicablePlan)
    const firstDistributionCalendarYear =
      ownerState.ageAttained === rmdStartAgeForBirthYear(ownerDobYear)
    const deferFirstAmount = firstDistributionCalendarYear &&
      firstYearDeferrals.some((election) =>
        election.distributionCalendarYear === year &&
        sameRmdApplicablePlan(election.applicablePlan, applicablePlan))
    if (deferFirstAmount) {
      const existing = deferredShadow.get(applicablePlanKey)
      const value: SimulatorAnnualPassDeferredFirstRmd = {
        applicablePlan,
        distributionCalendarYear: year,
        dueYear: year + 1,
        requiredAmount: (existing?.requiredAmount ?? 0) + rmd,
      }
      deferredShadow.set(applicablePlanKey, value)
      deferredFirstRmdOperations.push({
        kind: 'set',
        applicablePlanKey,
        value,
      })
      // Preserve the owned-IRA RMD reserve used by the conversion and named
      // QCD gates. Deferral moves the payment deadline; it does not turn the
      // amount into an eligible rollover or let a conversion absorb it.
      if (applicablePlan.kind === 'ownedTraditionalIras') {
        iraRmdRequiredByOwner.set(ownerId, (iraRmdRequiredByOwner.get(ownerId) ?? 0) + rmd)
        iraRmdUnsatisfiedByOwner.set(ownerId, (iraRmdUnsatisfiedByOwner.get(ownerId) ?? 0) + rmd)
      }
      continue
    }
    rmdObligationByAccount.set(state.account.id, rmd)
    currentRmdRequiredByApplicablePlan.set(
      applicablePlanKey,
      (currentRmdRequiredByApplicablePlan.get(applicablePlanKey) ?? 0) + rmd,
    )
    if (applicablePlan.kind === 'ownedTraditionalIras') {
      iraRmdRequiredByOwner.set(ownerId, (iraRmdRequiredByOwner.get(ownerId) ?? 0) + rmd)
    }
    const alreadyTaken = rmdTakeByAccount.get(state.account.id) ?? 0
    const take = Math.min(rmd, Math.max(0, state.balance - alreadyTaken))
    if (take > 0) {
      rmdTakeByAccount.set(state.account.id, alreadyTaken + take)
      currentRmdDistributedByApplicablePlan.set(
        applicablePlanKey,
        (currentRmdDistributedByApplicablePlan.get(applicablePlanKey) ?? 0) + take,
      )
    }
    if (
      rmd - take > epsilon &&
      (applicablePlan.kind === 'ownedTraditionalIras' ||
        applicablePlan.kind === 'aggregable403bPlans')
    ) {
      unmetAggregableRmdByApplicablePlan.set(
        applicablePlanKey,
        (unmetAggregableRmdByApplicablePlan.get(applicablePlanKey) ?? 0) + (rmd - take),
      )
    }
  }

  // Aggregate-plan shortfalls sweep logical accounts in first-ID order.
  for (const [applicablePlanKey, unmet] of unmetAggregableRmdByApplicablePlan) {
    const applicablePlan = applicablePlanByKey.get(applicablePlanKey)!
    let remaining = unmet
    for (const state of balances) {
      if (remaining <= epsilon) break
      if (state.account.type !== 'traditional') continue
      if (!followsOwnerRmdsThisYear(state.account)) continue
      if (!sameRmdApplicablePlan(
        applicablePlanForAccount(state.account),
        applicablePlan,
      )) continue
      const ownShare = rmdTakeByAccount.get(state.account.id) ?? 0
      const capacity = state.balance - ownShare
      if (capacity <= epsilon) continue
      const swept = Math.min(capacity, remaining)
      rmdTakeByAccount.set(state.account.id, ownShare + swept)
      currentRmdDistributedByApplicablePlan.set(
        applicablePlanKey,
        (currentRmdDistributedByApplicablePlan.get(applicablePlanKey) ?? 0) + swept,
      )
      remaining -= swept
    }
    if (remaining > epsilon && applicablePlan.kind === 'ownedTraditionalIras') {
      iraRmdUnsatisfiedByOwner.set(
        applicablePlan.payeePersonId,
        (iraRmdUnsatisfiedByOwner.get(applicablePlan.payeePersonId) ?? 0) + remaining,
      )
    }
  }

  for (const [applicablePlanKey, requiredAmount] of currentRmdRequiredByApplicablePlan) {
    const applicablePlan = applicablePlanByKey.get(applicablePlanKey)!
    rmdShortfallObligations.push({
      obligationId: rmdShortfallObligationId(applicablePlan, year),
      distributionCalendarYear: year,
      taxYear: year,
      taxImposedOn: `${year}-12-31`,
      applicablePlan,
      requirementKind: 'ownedAnnual',
      requiredAmount,
      distributedByDeadline:
        currentRmdDistributedByApplicablePlan.get(applicablePlanKey) ?? 0,
    })
  }

  return {
    rmdTakeByAccount,
    rmdObligationByAccount,
    applicablePlanByKey,
    iraRmdRequiredByOwner,
    iraRmdUnsatisfiedByOwner,
    rmdShortfallObligations,
    deferredFirstRmdOperations,
  }
}
