import type { Account } from '@retiregolden/engine/model/plan'

/**
 * What the owner means for the account types where it decides a figure. For a
 * joint cash, taxable or equity-compensation account, the engine's rule
 * (annualContributionsAndEmployerMatch; decision D-PEOPLE-ORDER, R3): a flat
 * contribution while anyone is alive and the household has wages, a schedule
 * on the named person's age while anyone is alive, with no wage test (the
 * independent review's L5). A one-person plan is spoken to as "you".
 */
export function ownerHelp(account: Account, peopleCount: number): string | undefined {
  const type = account.type
  if (type === 'annuity') {
    return "The person whose age starts the payments and whose life they are paid for. A joint-and-survivor payout keeps paying the other person after this person dies. An annuity bought from an IRA or 401(k) belongs to that account's owner."
  }
  if (type === 'pension') {
    return "The person who earned the pension: its start age is this person's age, and a survivor benefit goes to the other person after this person dies."
  }
  if (type === 'cash' || type === 'taxable' || type === 'equityComp') {
    const scheduled = account.contributionSchedule !== undefined
    if (peopleCount < 2) {
      return scheduled
        ? 'Joint: the contribution schedule follows your age and keeps contributing while you are alive, whether or not you have wages.'
        : 'Joint: contributions continue while you are alive and have wages.'
    }
    return scheduled
      ? 'Joint: the contribution schedule follows the age of the person named under Ages follow and keeps contributing while either of you is alive, whether or not either of you has wages.'
      : 'Joint: contributions continue while either of you is alive and either of you has wages.'
  }
  return undefined
}
