import { addCalendarMonths } from '@retiregolden/engine/actions'
import type { Plan } from '@retiregolden/engine/model/plan'

/** Remove durable facts whose source account no longer exists or is no longer
 * an owned, non-inherited traditional IRA. */
export function clearAccountEligibilityFacts(plan: Plan, accountId: string): void {
  const facts = plan.retirementActionEligibilityFacts
  if (facts === undefined) return
  facts.iraClassifications = facts.iraClassifications.filter(
    (classification) => classification.sourceAccountId !== accountId,
  )
  facts.sepSimpleActivities = facts.sepSimpleActivities.filter(
    (activity) => activity.sourceAccountId !== accountId,
  )
}

/** Apply an account edit and fail closed by dropping facts the new account
 * shape can no longer support. */
export function updateAccountField(
  plan: Plan,
  accountIndex: number,
  key: string,
  value: unknown,
): void {
  const account = plan.accounts[accountIndex]
  if (account === undefined) return
  ;(account as unknown as Record<string, unknown>)[key] = value
  const updated = plan.accounts[accountIndex]
  if (
    updated === undefined ||
    updated.type !== 'traditional' ||
    updated.kind !== 'ira' ||
    updated.ownerPersonId === null ||
    updated.inherited !== undefined
  ) {
    clearAccountEligibilityFacts(plan, account.id)
  }
}

/** Remove evidence bound to a person who no longer exists. */
export function clearDonorEligibilityFacts(plan: Plan, donorPersonId: string): void {
  const facts = plan.retirementActionEligibilityFacts
  if (facts === undefined) return
  facts.deductibleIraContributions = facts.deductibleIraContributions.filter(
    (contribution) => contribution.donorPersonId !== donorPersonId,
  )
}

/** Apply a DOB correction and remove only contribution evidence that the new
 * age-70½ threshold makes impossible. */
export function updatePersonDob(
  plan: Plan,
  personIndex: number,
  dob: string,
): void {
  const person = plan.household.people[personIndex]
  if (person === undefined) return
  person.dob = dob
  const facts = plan.retirementActionEligibilityFacts
  if (facts === undefined) return
  const thresholdDate = addCalendarMonths(dob, 846)
  const thresholdYear =
    thresholdDate === null ? null : Number(thresholdDate.slice(0, 4))
  facts.deductibleIraContributions = facts.deductibleIraContributions.filter(
    (contribution) =>
      contribution.donorPersonId !== person.id ||
      (thresholdYear !== null && contribution.taxYear >= thresholdYear),
  )
}
