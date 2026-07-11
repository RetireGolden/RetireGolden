/**
 * Account eligibility service (account/HSA/fixed-asset depth plan, step 1).
 *
 * One pure module answering, per account (and where relevant, per year/owner):
 * can it accept contributions? can it be converted to Roth? does it follow the
 * owner's own RMDs? is its balance spendable this year? and what early-
 * withdrawal penalty rate applies? The ledger (`projection/simulate.ts`), the
 * optimizer input builder (`projection/optimizePlan.ts`), and the decision
 * engine (`decisions/*`) all consume these helpers, so every recommended
 * account movement is explainable by a rule that exists in exactly one place —
 * the roadmap §7 acceptance criterion.
 *
 * Rules encoded here (each documented in DOCS/domain/domain-rules-reference.md):
 * - Inherited traditional accounts (SECURE Act 10-year rule) cannot receive
 *   contributions, cannot be converted to Roth, are exempt from the owner's
 *   Uniform-Lifetime RMDs (they follow their own forced-distribution schedule),
 *   and are never subject to the 10% early-withdrawal penalty.
 * - Cliff-vesting equity compensation is not spendable before its vest year.
 * - Traditional withdrawals before 59½ (approximated as age < 60) carry a 10%
 *   penalty unless the Rule of 55 applies (employer plan, separation in/after
 *   the year the owner turned 55, approximated by the owner's retirement age).
 *   72(t) SEPP and inherited distributions are taken outside the need-based
 *   flow and are penalty-free by construction.
 * - HSA non-qualified withdrawals before 65 carry a 20% penalty; from 65 on
 *   they are penalty-free (ordinary income only).
 */

import type { Account } from '../model/plan.js'

export type TraditionalAccount = Extract<Account, { type: 'traditional' }>
export type EquityCompAccount = Extract<Account, { type: 'equityComp' }>

/** Traditional pre-59½ early-withdrawal penalty rate (age approximated annually). */
export const TRADITIONAL_EARLY_PENALTY_RATE = 0.1
/** HSA non-qualified withdrawal penalty rate before age 65 (IRC §223(f)(4)). */
export const HSA_NON_QUALIFIED_PENALTY_RATE = 0.2

/** Can this account receive new contributions? (Inherited accounts cannot.) */
export function acceptsContributions(account: Account): boolean {
  return !(account.type === 'traditional' && account.inherited !== undefined)
}

/**
 * Can this account's balance be converted to Roth? Only an owned (non-
 * inherited) traditional account qualifies: inherited accounts follow the
 * 10-year rule and are never convertible by a non-spouse beneficiary.
 */
export function isConvertibleToRoth(account: Account): account is TraditionalAccount {
  return account.type === 'traditional' && account.inherited === undefined
}

/**
 * Does this account follow the owner's own age-based RMDs (Uniform Lifetime /
 * Joint Life)? Inherited accounts are exempt — they follow the beneficiary
 * 10-year schedule in `strategies/inheritedIra.ts` instead.
 */
export function followsOwnerRmds(account: Account): account is TraditionalAccount {
  return account.type === 'traditional' && account.inherited === undefined
}

/**
 * Does this account participate in the owner's Form-8606 IRA aggregation for
 * the nondeductible-basis pro-rata rule? Only the owner's own traditional
 * IRAs aggregate: employer plans track after-tax money separately, and a
 * beneficiary's inherited IRA has its own separate Form 8606.
 */
export function isAggregatedIra(account: Account): account is TraditionalAccount {
  return account.type === 'traditional' && account.kind === 'ira' && account.inherited === undefined
}

/** Is a cliff-vesting equity-comp account vested (available for spending) in `year`? */
export function isEquityCompVested(account: EquityCompAccount, year: number): boolean {
  if (account.vestingMode === 'final') return true
  if (account.vestDate === null) return false
  return Number(account.vestDate.slice(0, 4)) <= year
}

/** Is this account's balance available for need-based spending withdrawals in `year`? */
export function isSpendableInYear(account: Account, year: number): boolean {
  if (account.type === 'equityComp') return isEquityCompVested(account, year)
  return true
}

export interface EarlyWithdrawalContext {
  /** Owner's age attained this calendar year. */
  ownerAgeAttained: number
  /** Owner's plan retirement age (the separation-from-service proxy), or null. */
  ownerRetirementAge: number | null
}

/**
 * Penalty rate on a need-based traditional withdrawal this year: 10% before
 * 59½ (approximated as age < 60), waived for inherited accounts (never
 * penalized), and waived by the Rule of 55 for an EMPLOYER plan the owner
 * separated from in/after the year they turned 55 (IRAs never qualify).
 */
export function traditionalWithdrawalPenaltyRate(account: TraditionalAccount, ctx: EarlyWithdrawalContext): number {
  if (account.inherited !== undefined) return 0
  if (ctx.ownerAgeAttained >= 60) return 0
  const ruleOf55 =
    account.kind === 'employer' &&
    ctx.ownerRetirementAge !== null &&
    ctx.ownerRetirementAge >= 55 &&
    ctx.ownerAgeAttained >= ctx.ownerRetirementAge
  return ruleOf55 ? 0 : TRADITIONAL_EARLY_PENALTY_RATE
}

/**
 * Penalty rate on the NON-QUALIFIED portion of an HSA withdrawal this year:
 * 20% before age 65, none after. Qualified (medical) withdrawals are never
 * penalized; the HSA subledger decides how much of a withdrawal is qualified.
 */
export function hsaNonQualifiedPenaltyRate(ownerAgeAttained: number): number {
  return ownerAgeAttained < 65 ? HSA_NON_QUALIFIED_PENALTY_RATE : 0
}
