/** Pure annual plans for debt service and long-term-care cash flows. */
import type { Account, CareEvent, InsurancePolicy } from '../../model/plan.js'
import type { PersonYearState } from '../types.js'

export interface AnnualDebtServiceRow {
  readonly accountId: string
  readonly ownerPersonId: string | null
  readonly amount: number
  readonly nextBalance: number
}

/**
 * One row per debt account with a positive balance: the balance first grows
 * by `1 + interestPct / 100`, then the year pays the whole grown balance when
 * a payoff year is set and reached, else `min(grown balance, monthlyPayment ×
 * 12)`; the level payment is never inflated and self-caps at the balance, so
 * the debt cannot go negative. `nextBalance` is what remains after the payment.
 */
export function annualDebtServiceRows(input: {
  readonly accounts: readonly Account[]
  readonly balances: ReadonlyMap<string, number>
  readonly year: number
}): AnnualDebtServiceRow[] {
  const shadow = new Map(input.balances)
  const rows: AnnualDebtServiceRow[] = []
  for (const account of input.accounts) {
    if (account.type !== 'debt') continue
    let balance = shadow.get(account.id) ?? 0
    if (balance <= 0) continue
    balance *= 1 + account.interestPct / 100
    // A scheduled payoff clears the whole remaining balance; otherwise the
    // level annual payment is capped so the loan self-terminates.
    const payoff =
      typeof account.payoffYear === 'number' && input.year >= account.payoffYear
    const amount = payoff
      ? balance
      : Math.min(balance, account.monthlyPayment * 12)
    balance -= amount
    shadow.set(account.id, balance)
    rows.push({
      accountId: account.id,
      ownerPersonId: account.ownerPersonId ?? null,
      amount,
      nextBalance: balance,
    })
  }
  return rows
}

export interface AnnualLtcBenefitYearWrite {
  readonly policyId: string
  readonly yearsUsed: number
}

export interface AnnualLongTermCarePersonRow {
  readonly personId: string
  readonly careEventIds: string[]
  readonly payingPolicyIds: string[]
  readonly gross: number
  readonly benefit: number
  readonly net: number
}

export interface AnnualLongTermCarePlan {
  readonly careCost: number
  readonly ltcBenefit: number
  readonly benefitYearWrites: AnnualLtcBenefitYearWrite[]
  readonly personRows: AnnualLongTermCarePersonRow[]
}

/**
 * Care episodes and policy benefits for the year. A care event applies while
 * its person is alive and `0 ≤ ageAttained − startAge < durationYears`, at
 * `annualCost × the health-inflation factor`; `careCost` is the sum. Each LTC
 * policy the person owns pays `min(remaining cost, cap)` where `cap =
 * benefitMonthly × 12 × (1 + riderPct / 100)^(year − startYear)`, reduced in
 * the episode's first year by `max(0, 1 − eliminationPeriodDays / 365)` (the
 * elimination period is self-paid), and only while the policy's benefit
 * years remain (`benefitPeriodYears`, or unlimited for lifetime); `ltcBenefit`
 * is the sum and never exceeds `careCost`.
 */
export function annualLongTermCarePlan(input: {
  readonly careEvents: readonly CareEvent[]
  readonly policies: readonly InsurancePolicy[]
  readonly benefitYearsUsed: ReadonlyMap<string, number>
  readonly resolvePerson: (personId: string) => PersonYearState
  readonly healthInflFactor: number
  readonly year: number
  readonly startYear: number
  readonly capturePersonRows: boolean
}): AnnualLongTermCarePlan {
  const shadowYearsUsed = new Map(input.benefitYearsUsed)
  const benefitYearWrites: AnnualLtcBenefitYearWrite[] = []
  let careCost = 0
  let ltcBenefit = 0
  const byPerson = input.capturePersonRows
    ? new Map<string, {
        careEventIds: string[]
        payingPolicyIds: string[]
        gross: number
        benefit: number
      }>()
    : null

  for (const event of input.careEvents) {
    const state = input.resolvePerson(event.personId)
    if (!state.alive) continue
    const yearsIntoEpisode = state.ageAttained - event.startAge
    if (yearsIntoEpisode < 0 || yearsIntoEpisode >= event.durationYears) continue
    const gross = event.annualCost * input.healthInflFactor
    careCost += gross
    let remaining = gross
    const payingPolicyIds: string[] = []
    for (const policy of input.policies) {
      if (
        policy.kind !== 'ltc' ||
        policy.owner !== event.personId ||
        remaining <= 0
      ) continue
      const used = shadowYearsUsed.get(policy.id) ?? 0
      if (
        policy.benefitPeriodYears !== 'lifetime' &&
        used >= policy.benefitPeriodYears
      ) continue
      const rider = (policy.inflationRiderPct ?? 0) / 100
      let cap =
        policy.benefitMonthly *
        12 *
        Math.pow(1 + rider, input.year - input.startYear)
      // The first episode year bears the elimination period out of pocket.
      if (yearsIntoEpisode === 0) {
        cap *= Math.max(0, 1 - policy.eliminationPeriodDays / 365)
      }
      const pay = Math.min(remaining, cap)
      if (pay > 0) {
        ltcBenefit += pay
        remaining -= pay
        const yearsUsed = used + 1
        shadowYearsUsed.set(policy.id, yearsUsed)
        benefitYearWrites.push({ policyId: policy.id, yearsUsed })
        payingPolicyIds.push(policy.id)
      }
    }
    if (byPerson !== null) {
      const existing = byPerson.get(event.personId) ?? {
        careEventIds: [],
        payingPolicyIds: [],
        gross: 0,
        benefit: 0,
      }
      existing.careEventIds.push(event.id)
      existing.gross += gross
      existing.benefit += gross - remaining
      for (const policyId of payingPolicyIds) {
        if (!existing.payingPolicyIds.includes(policyId)) {
          existing.payingPolicyIds.push(policyId)
        }
      }
      byPerson.set(event.personId, existing)
    }
  }

  return {
    careCost,
    ltcBenefit,
    benefitYearWrites,
    personRows: byPerson === null
      ? []
      : [...byPerson].map(([personId, row]) => ({
          personId,
          careEventIds: row.careEventIds,
          payingPolicyIds: row.payingPolicyIds,
          gross: row.gross,
          benefit: row.benefit,
          net: row.gross - row.benefit,
        })),
  }
}
