/**
 * Annuity payout forms: payment continuation and exclusion-ratio inputs per
 * form (annuity-pension-and-home-equity decisions, step 1).
 *
 * The IRS Pub 939 General Rule prices a non-qualified annuity's tax-free share
 * as investment-in-contract ÷ expected return, where expected return = annual
 * payment × an expected-return multiple. The multiple depends on the payout
 * form:
 *  - life-only: Pub 939 Table V by age at the starting date (embedded in the
 *    parameter pack — the shipped guaranteed-income behavior);
 *  - life with N years certain: Pub 939 adjusts the investment for the value
 *    of the refund/period-certain feature (Tables III/VII). We approximate the
 *    same economics from the payment side: the expected payment stream can
 *    never be shorter than the guarantee, so the multiple is
 *    max(Table V multiple, N). Documented planning-grade approximation;
 *  - joint & survivor: Pub 939 uses Tables VI/VIA (joint last-survivor and
 *    joint-life multiples). We decompose by expectation instead — exactly the
 *    stream the ledger pays: the full payment for the owner's expected
 *    lifetime (Table V) plus the survivor share for the years the joint
 *    annuitant is expected to outlive the owner (joint last-survivor
 *    expectancy from the SSA-derived mortality model, per-sex where Pub 939's
 *    tables are unisex). Same General-Rule method, sourced from the tables
 *    already in the repo.
 *
 * In all forms the exclusion ratio is fixed at the starting date and the
 * excludable share of each payment continues to a survivor/beneficiary until
 * the investment is recovered (IRS Pub 575/939 treatment).
 */

import type { Account, AnnuityPayoutForm, Person } from '../model/plan'
import { annuityExpectedReturnMultiple } from '../params'
import type { ParameterPack } from '../params/types'
import { jointLastSurvivorExpectancy } from '../montecarlo/mortality'

type AnnuityAccount = Extract<Account, { type: 'annuity' }>

/** The payout form in effect; absent = life-only (legacy behavior). */
export function annuityPayoutForm(account: AnnuityAccount): AnnuityPayoutForm {
  return account.payoutForm ?? { kind: 'lifeOnly' }
}

/**
 * Expected-return multiple (years of the FULL annual payment) for the
 * exclusion ratio under the account's payout form. `owner` is the annuitant;
 * `joint` is the other household member for a joint-and-survivor form (the
 * form is validated to require a two-person household).
 */
export function annuityExclusionMultiple(
  pack: ParameterPack,
  account: AnnuityAccount,
  owner: Person,
  joint: Person | undefined,
): number {
  const form = annuityPayoutForm(account)
  const lifeMultiple = annuityExpectedReturnMultiple(pack, account.startAge)
  if (form.kind === 'lifeOnly') return lifeMultiple
  if (form.kind === 'periodCertain') {
    // The guarantee floors the expected payment years at the certain period.
    return Math.max(lifeMultiple, form.certainYears)
  }
  if (!joint) return lifeMultiple
  // Joint & survivor: full payment for the owner's expected lifetime, then
  // survivorPct of it for the expected years the joint annuitant survives the
  // owner. Ages at the starting date: the joint annuitant's age when the owner
  // attains startAge.
  const ownerBirthYear = Number(owner.dob.slice(0, 4))
  const jointBirthYear = Number(joint.dob.slice(0, 4))
  const jointAgeAtStart = account.startAge + (ownerBirthYear - jointBirthYear)
  const jointExpectancy = jointLastSurvivorExpectancy(account.startAge, owner.sex, Math.max(0, jointAgeAtStart), joint.sex)
  const survivorYears = Math.max(0, jointExpectancy - lifeMultiple)
  return lifeMultiple + (form.survivorPct / 100) * survivorYears
}

/**
 * Fraction of the full payment paid this year under the payout form.
 *  - life-only: 1 while the owner is alive, else 0;
 *  - period certain: 1 while the owner is alive; after the owner's death the
 *    remaining guaranteed years continue to the household (any member alive).
 *    Documented simplification: if the whole household dies inside the
 *    guarantee window, the remaining certain payments (which a real contract
 *    would keep paying to a beneficiary or the estate) are not modeled — the
 *    ledger has no post-household cash-flow path, so a long guarantee's
 *    estate value is understated in that case (domain rules §19);
 *  - joint & survivor: 1 while the owner is alive, survivorPct% while the
 *    joint annuitant survives them.
 */
export function annuityPayoutFraction(
  form: AnnuityPayoutForm,
  state: { ownerAlive: boolean; otherAlive: boolean; anyAlive: boolean; yearsSinceStart: number },
): number {
  if (form.kind === 'lifeOnly') return state.ownerAlive ? 1 : 0
  if (form.kind === 'periodCertain') {
    if (state.ownerAlive) return 1
    return state.yearsSinceStart < form.certainYears && state.anyAlive ? 1 : 0
  }
  if (state.ownerAlive) return 1
  return state.otherAlive ? form.survivorPct / 100 : 0
}
