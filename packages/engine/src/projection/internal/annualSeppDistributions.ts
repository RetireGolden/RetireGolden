/**
 * Pure annual 72(t) SEPP distribution planning.
 *
 * The annual pass owns balance mutations, runtime journal/application records,
 * cash-flow publication, deferred Form 8606 character, and the cross-year
 * amortization cache. This helper returns those effects as an ordered operation
 * stream so the caller can apply them at the original mutation site.
 *
 * A cache write is a first-class operation because the inlined phase cached a
 * newly calculated amortization amount before suppressing a sub-cent payment.
 * A private shadow makes a later duplicate account id observe that write even
 * though this helper mutates neither input map.
 */
import type { Account } from '../../model/plan.js'
import type { ParameterPack } from '../../params/types.js'
import { planDollarsMoveNoLedgerCent } from '../../actions/planBalanceAdapter.js'
import { seppSeriesBeginsAfterSeparation } from '../../actions/traditionalEmployerPlanPenaltyPrerequisite.js'
import {
  isAggregatedIra,
  isTreatAsOwnEffective,
} from '../../strategies/accountEligibility.js'
import { seppActive, seppAnnualAmount } from '../../strategies/sepp.js'

type SeppEligibleAccount = Extract<Account, {
  type: 'cash' | 'taxable' | 'equityComp' | 'traditional' | 'roth' | 'hsa'
}>

export interface AnnualSeppBalanceView {
  readonly account: Readonly<SeppEligibleAccount>
  readonly balance: number
}

export interface AnnualSeppOwnerState {
  readonly alive: boolean
  readonly ageAttained: number
}

export interface AnnualSeppDistributionsInput {
  /** Live annual-pass balance rows in plan order, viewed without mutation. */
  readonly balances: readonly Readonly<AnnualSeppBalanceView>[]
  readonly year: number
  readonly primaryPersonId: string
  /** The caller's current annual person state, resolved by normalized owner id. */
  readonly resolveOwnerState: (ownerPersonId: string) => Readonly<AnnualSeppOwnerState>
  /** The Plan person's retirement age; called only for an eligible employer plan. */
  readonly resolveOwnerRetirementAge: (ownerPersonId: string) => number | null
  /** Start-of-year balances use account-id map semantics, including duplicate ids. */
  readonly startOfYearBalance: ReadonlyMap<string, number>
  readonly amortizationAmountByAccountId: ReadonlyMap<string, number>
  readonly pack: ParameterPack
}

export interface AnnualSeppAmortizationCacheWrite {
  readonly kind: 'amortizationCacheWrite'
  readonly accountId: string
  readonly amount: number
}

export interface AnnualSeppDistribution {
  readonly kind: 'distribution'
  /** Index into the caller's `balances`, avoiding a rebuilt account-id lookup. */
  readonly balanceIndex: number
  readonly accountId: string
  /** Raw Plan identity for the occurrence, application, and cash-flow row. */
  readonly ownerPersonId: string | null
  /** Primary-normalized identity used only by the Form 8606 character queue. */
  readonly characterOwnerPersonId: string
  readonly take: number
  readonly sourceBalanceBefore: number
  readonly sourceBalanceAfter: number
  /** Static owned-IRA gate used by the inlined SEPP phase. */
  readonly recordsOwnedIraApplication: boolean
  /** Kind gate paired with the recorded application before character deferral. */
  readonly defersIraCharacter: boolean
}

export type AnnualSeppOperation =
  | AnnualSeppAmortizationCacheWrite
  | AnnualSeppDistribution

export interface AnnualSeppDistributionsResult {
  readonly operations: readonly AnnualSeppOperation[]
  /** Exact left-to-right `+=` fold over distributed amounts. */
  readonly total: number
}

export function annualSeppDistributions(
  input: AnnualSeppDistributionsInput,
): AnnualSeppDistributionsResult {
  const operations: AnnualSeppOperation[] = []
  const shadowAmortizationAmounts = new Map<string, number>()
  let total = 0

  for (let balanceIndex = 0; balanceIndex < input.balances.length; balanceIndex++) {
    const state = input.balances[balanceIndex]!
    if (state.account.type !== 'traditional' || !state.account.sepp) continue
    // Year-aware inherited gate: before an S2 election the account remains on
    // the beneficiary path; once effective, its active series can distribute.
    if (
      state.account.inherited !== undefined &&
      !isTreatAsOwnEffective(state.account, input.year)
    ) continue

    const ownerPersonId = state.account.ownerPersonId ?? input.primaryPersonId
    const ownerState = input.resolveOwnerState(ownerPersonId)
    if (!ownerState.alive) continue
    const election = state.account.sepp
    if (!seppActive(election.startAge, ownerState.ageAttained)) continue

    // IRC 72(t)(3)(B): an employer-plan series must begin after separation.
    // The annual model has no separation date, so its established proxy is the
    // first whole attained age at which wages stop. Math.ceil is load-bearing:
    // retirementAge 65.5 pays wages at 65 and separates at 66. A missing age
    // establishes no separation. IRAs deliberately bypass this test.
    if (state.account.kind === 'employer') {
      const ownerRetirementAge = input.resolveOwnerRetirementAge(ownerPersonId)
      if (ownerRetirementAge === null) continue
      const birthYear = input.year - ownerState.ageAttained
      const separatedFrom = `${birthYear + Math.ceil(ownerRetirementAge)}-01-01`
      const seriesBegunBy = `${birthYear + election.startAge}-12-31`
      if (!seppSeriesBeginsAfterSeparation(seriesBegunBy, separatedFrom)) continue
    }

    const startBalance = input.startOfYearBalance.get(state.account.id) ?? 0
    let amount: number
    if (election.method === 'amortization') {
      // Notice 2022-6 section 3.02(d) permits a balance determined from
      // December 31 before the first distribution through its distribution
      // date. The start-of-year balance opens that window. The first payment is
      // fixed using the owner's CURRENT age and cached for the series.
      let fixed = shadowAmortizationAmounts.has(state.account.id)
        ? shadowAmortizationAmounts.get(state.account.id)!
        : input.amortizationAmountByAccountId.get(state.account.id)
      if (fixed === undefined) {
        fixed = seppAnnualAmount(
          input.pack,
          'amortization',
          startBalance,
          ownerState.ageAttained,
        )
        shadowAmortizationAmounts.set(state.account.id, fixed)
        operations.push({
          kind: 'amortizationCacheWrite',
          accountId: state.account.id,
          amount: fixed,
        })
      }
      amount = fixed
    } else {
      amount = seppAnnualAmount(
        input.pack,
        'rmd',
        startBalance,
        ownerState.ageAttained,
      )
    }

    const take = Math.min(amount, state.balance)
    // Exact-cent discharge: a sub-cent movement publishes no occurrence and
    // contributes nothing to total, but any amortization cache write above has
    // already happened and therefore remains in the operation stream.
    if (take <= 0 || planDollarsMoveNoLedgerCent(take)) continue

    const recordsOwnedIraApplication = isAggregatedIra(state.account)
    total += take
    operations.push({
      kind: 'distribution',
      balanceIndex,
      accountId: state.account.id,
      ownerPersonId: state.account.ownerPersonId ?? null,
      characterOwnerPersonId: ownerPersonId,
      take,
      sourceBalanceBefore: state.balance,
      sourceBalanceAfter: state.balance - take,
      recordsOwnedIraApplication,
      // Deferred until the year's charitable distribution settles the Form
      // 8606 pro-rata denominator. Static `isAggregatedIra` is intentional:
      // year-aware S2 ownership does not rewrite this existing character gate.
      defersIraCharacter:
        state.account.kind === 'ira' && recordsOwnedIraApplication,
    })
  }

  return { operations, total }
}
